from __future__ import annotations

import csv
import hashlib
import secrets
from dataclasses import dataclass
from datetime import date, datetime, time
from pathlib import Path
from typing import Dict, List, Optional, Sequence

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError

from .db import DATA_DIR, get_session, init_db
from . import models


ACTIVITY_MULTIPLIERS = {
    "Sedentary": 1.2,
    "Light": 1.375,
    "Moderate": 1.55,
    "Intense": 1.725,
}


@dataclass
class UserDTO:
    id: int
    username: str
    created_at: str


@dataclass
class ProfileDTO:
    age: int
    gender: str
    height_cm: int
    weight_kg: float
    activity: str
    deficit: int
    bmr: float
    tdee: float


@dataclass
class DailySummary:
    date: str
    intake_kcal: float
    burn_kcal: float
    net_kcal: float
    target_intake: float
    remaining: float
    macros: Dict[str, float]
    food_log: List[Dict]
    exercise_log: List[Dict]


@dataclass
class WeightHistory:
    entries: List[Dict]


MET_VALUES = {
    "Walking": 3.5,
    "Jogging": 7,
    "Cycling": 6,
    "Weightlifting": 4,
}


def _hash_password(password: str) -> tuple[str, str]:
    salt = secrets.token_hex(16)
    hash_bytes = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt), 200_000)
    return hash_bytes.hex(), salt


def _verify_password(password: str, password_hash: str, salt: str) -> bool:
    test_hash = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt), 200_000)
    return secrets.compare_digest(test_hash.hex(), password_hash)


def mifflin_st_jeor(weight: float, height: float, age: int, gender: str) -> float:
    s = 5 if gender == "Male" else -161
    return 10 * weight + 6.25 * height - 5 * age + s


def calc_tdee(bmr: float, activity: str) -> float:
    mult = ACTIVITY_MULTIPLIERS.get(activity, ACTIVITY_MULTIPLIERS["Sedentary"])
    return bmr * mult


def ensure_profile(user: models.User) -> models.Profile:
    if user.profile is None:
        user.profile = models.Profile()
    return user.profile


def create_user(username: str, password: str) -> UserDTO:
    password_hash, salt = _hash_password(password)
    with get_session() as session:
        user = models.User(username=username.lower(), password_hash=password_hash, password_salt=salt)
        session.add(user)
        try:
            session.flush()
        except IntegrityError as exc:  # pragma: no cover - depends on DB
            raise ValueError("Username already exists") from exc
        return UserDTO(id=user.id, username=user.username, created_at=user.created_at.isoformat())


def authenticate_user(username: str, password: str) -> Optional[UserDTO]:
    with get_session() as session:
        stmt = select(models.User).where(models.User.username == username.lower())
        user = session.scalar(stmt)
        if user and _verify_password(password, user.password_hash, user.password_salt):
            return UserDTO(id=user.id, username=user.username, created_at=user.created_at.isoformat())
    return None


def upsert_profile(user_id: int, *, age: int, gender: str, height_cm: int, weight_kg: float, activity: str, deficit: int) -> ProfileDTO:
    with get_session() as session:
        user = session.get(models.User, user_id)
        if not user:
            raise ValueError("User not found")
        profile = ensure_profile(user)
        profile.age = age
        profile.gender = gender
        profile.height_cm = height_cm
        profile.weight_kg = weight_kg
        profile.activity = activity
        profile.deficit = deficit
        session.add(profile)
        session.flush()
        bmr = mifflin_st_jeor(profile.weight_kg, profile.height_cm, profile.age, profile.gender)
        tdee = calc_tdee(bmr, profile.activity)
        return ProfileDTO(
            age=profile.age,
            gender=profile.gender,
            height_cm=profile.height_cm,
            weight_kg=profile.weight_kg,
            activity=profile.activity,
            deficit=profile.deficit,
            bmr=bmr,
            tdee=tdee,
        )


def load_profile(user_id: int) -> Optional[ProfileDTO]:
    with get_session() as session:
        stmt = select(models.Profile).where(models.Profile.user_id == user_id)
        profile = session.scalar(stmt)
        if not profile:
            return None
        bmr = mifflin_st_jeor(profile.weight_kg, profile.height_cm, profile.age, profile.gender)
        tdee = calc_tdee(bmr, profile.activity)
        return ProfileDTO(
            age=profile.age,
            gender=profile.gender,
            height_cm=profile.height_cm,
            weight_kg=profile.weight_kg,
            activity=profile.activity,
            deficit=profile.deficit,
            bmr=bmr,
            tdee=tdee,
        )


def list_food_items(user_id: Optional[int] = None) -> List[Dict]:
    with get_session() as session:
        stmt = (
            select(models.FoodItem)
            .where(or_(models.FoodItem.owner_id == user_id, models.FoodItem.owner_id.is_(None)))
            .order_by(models.FoodItem.name.asc())
        )
        items = session.scalars(stmt).all()
        return [
            {
                "id": item.id,
                "name": item.name,
                "measure": item.measure,
                "kcal": item.kcal,
                "protein": item.protein,
                "fat": item.fat,
                "carbs": item.carbs,
                "category": item.category,
                "owner_id": item.owner_id,
            }
            for item in items
        ]


def add_food_item(
    *,
    user_id: Optional[int],
    name: str,
    measure: str,
    kcal: float,
    protein: float,
    fat: float,
    carbs: float,
    category: str,
    make_global: bool = False,
) -> None:
    with get_session() as session:
        item = models.FoodItem(
            name=name,
            measure=measure,
            kcal=kcal,
            protein=protein,
            fat=fat,
            carbs=carbs,
            category=category,
            owner_id=None if make_global else user_id,
        )
        session.add(item)
        try:
            session.flush()
        except IntegrityError as exc:
            raise ValueError("Food item already exists") from exc


def delete_food_items(user_id: int, item_ids: Sequence[int]) -> None:
    with get_session() as session:
        stmt = select(models.FoodItem).where(models.FoodItem.id.in_(item_ids))
        for item in session.scalars(stmt):
            if item.owner_id == user_id:
                session.delete(item)


def log_food(
    *,
    user_id: int,
    entry_date: date,
    food_name: str,
    measure: str,
    qty: float,
    kcal: float,
    protein: float,
    fat: float,
    carbs: float,
) -> None:
    with get_session() as session:
        session.add(
            models.FoodLog(
                user_id=user_id,
                date=entry_date,
                food_name=food_name,
                measure=measure,
                qty=qty,
                kcal=kcal,
                protein=protein,
                fat=fat,
                carbs=carbs,
            )
        )


def log_exercise(
    *,
    user_id: int,
    entry_date: date,
    ex_type: str,
    start: time,
    end: time,
    mins: float,
    kcal_burn: float,
) -> None:
    with get_session() as session:
        session.add(
            models.ExerciseLog(
                user_id=user_id,
                date=entry_date,
                type=ex_type,
                start=start,
                end=end,
                mins=mins,
                kcal_burn=kcal_burn,
            )
        )


def log_weight(*, user_id: int, entry_date: date, weight: float) -> None:
    with get_session() as session:
        session.add(models.WeightEntry(user_id=user_id, date=entry_date, weight=weight))


def get_daily_summary(user_id: int, target_date: date, profile: ProfileDTO) -> DailySummary:
    with get_session() as session:
        food_stmt = select(models.FoodLog).where(
            models.FoodLog.user_id == user_id,
            models.FoodLog.date == target_date,
        )
        exercise_stmt = select(models.ExerciseLog).where(
            models.ExerciseLog.user_id == user_id,
            models.ExerciseLog.date == target_date,
        )
        food_entries = session.scalars(food_stmt).all()
        exercise_entries = session.scalars(exercise_stmt).all()

    food_log = [
        {
            "id": entry.id,
            "food": entry.food_name,
            "measure": entry.measure,
            "qty": entry.qty,
            "kcal": entry.kcal,
            "protein": entry.protein,
            "fat": entry.fat,
            "carbs": entry.carbs,
        }
        for entry in food_entries
    ]
    exercise_log = [
        {
            "id": entry.id,
            "type": entry.type,
            "mins": entry.mins,
            "kcal_burn": entry.kcal_burn,
        }
        for entry in exercise_entries
    ]

    intake_kcal = sum(entry["kcal"] for entry in food_log)
    burn_kcal = sum(entry["kcal_burn"] for entry in exercise_log)
    net_kcal = intake_kcal - burn_kcal
    target_intake = max(profile.tdee - profile.deficit, 0)
    remaining = target_intake - net_kcal
    macros = {
        "protein": sum(entry["protein"] for entry in food_log),
        "fat": sum(entry["fat"] for entry in food_log),
        "carbs": sum(entry["carbs"] for entry in food_log),
    }
    return DailySummary(
        date=target_date.isoformat(),
        intake_kcal=intake_kcal,
        burn_kcal=burn_kcal,
        net_kcal=net_kcal,
        target_intake=target_intake,
        remaining=remaining,
        macros=macros,
        food_log=food_log,
        exercise_log=exercise_log,
    )


def delete_food_log_entries(user_id: int, entry_ids: Sequence[int]) -> None:
    with get_session() as session:
        stmt = select(models.FoodLog).where(models.FoodLog.id.in_(entry_ids), models.FoodLog.user_id == user_id)
        for entry in session.scalars(stmt):
            session.delete(entry)


def delete_exercise_log_entries(user_id: int, entry_ids: Sequence[int]) -> None:
    with get_session() as session:
        stmt = select(models.ExerciseLog).where(models.ExerciseLog.id.in_(entry_ids), models.ExerciseLog.user_id == user_id)
        for entry in session.scalars(stmt):
            session.delete(entry)


def get_weight_history(user_id: int) -> WeightHistory:
    with get_session() as session:
        stmt = select(models.WeightEntry).where(models.WeightEntry.user_id == user_id).order_by(models.WeightEntry.date.asc())
        entries = session.scalars(stmt).all()
    return WeightHistory(entries=[{"date": entry.date.isoformat(), "weight": entry.weight} for entry in entries])


def seed_food_items() -> None:
    csv_path = DATA_DIR / "food_db.csv"
    if not csv_path.exists():
        return
    with get_session() as session:
        count = session.scalar(select(func.count(models.FoodItem.id)))
        if count and count > 0:
            return
        with csv_path.open("r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                session.add(
                    models.FoodItem(
                        name=row.get("food") or row.get("name"),
                        measure=row.get("measure", "1 serving"),
                        kcal=float(row.get("kcal", 0)),
                        protein=float(row.get("protein", 0)),
                        fat=float(row.get("fat", 0)),
                        carbs=float(row.get("carbs", 0)),
                        category=row.get("category", "Other"),
                        owner_id=None,
                    )
                )


# Initialize DB + seed on module import
init_db()
seed_food_items()
