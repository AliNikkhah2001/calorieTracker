from __future__ import annotations

from dataclasses import asdict
from datetime import date, datetime, timedelta
import logging
from typing import Dict, List, Optional

import reflex as rx

from . import services
from .services import ProfileDTO


logger = logging.getLogger(__name__)
if not logger.handlers:
    logging.basicConfig(level=logging.INFO)


class AppState(rx.State):
    """Global Reflex state that glue together auth, profile, and logging."""

    # Auth fields
    auth_mode: str = "login"
    login_username: str = ""
    login_password: str = ""
    register_username: str = ""
    register_password: str = ""
    register_confirm: str = ""
    message: str = ""
    error: str = ""

    # Session
    user_id: Optional[int] = None
    username: str = ""

    # Profile form fields
    profile_age: int = 30
    profile_gender: str = "Male"
    profile_height: int = 170
    profile_weight: float = 70.0
    profile_activity: str = "Sedentary"
    profile_deficit: int = 500
    profile_metrics: Optional[Dict] = None

    # Dashboard data
    today_date: str = date.today().isoformat()
    summary: Dict = {}
    food_items: List[Dict] = []
    food_groups: List[Dict] = []
    weight_history: List[Dict] = []
    workout_log: List[Dict] = []
    insights: Dict[str, float] = {}
    # Derived daily summary fields (typed for UI)
    summary_intake_kcal: float = 0.0
    summary_burn_kcal: float = 0.0
    summary_net_kcal: float = 0.0
    summary_remaining: float = 0.0
    summary_macro_protein: float = 0.0
    summary_macro_fat: float = 0.0
    summary_macro_carbs: float = 0.0
    summary_food_log: List[Dict] = []
    summary_exercise_log: List[Dict] = []

    # Food log form
    food_choice: str = "custom"
    food_qty: float = 1.0
    custom_food_name: str = ""
    custom_food_measure: str = "1 serving"
    custom_food_kcal: float = 0.0
    custom_food_protein: float = 0.0
    custom_food_fat: float = 0.0
    custom_food_carbs: float = 0.0

    # Workout form
    workout_date: str = date.today().isoformat()
    workout_category: str = "Chest"
    workout_exercise: str = "Seated Chest Press"
    workout_sets: int = 3
    workout_reps: int = 10
    workout_weight: float = 20.0
    workout_notes: str = ""

    # Exercise form
    exercise_type: str = "Walking"
    exercise_start: str = "18:00"
    exercise_end: str = "19:00"

    # Weight form
    weight_value: float = 70.0

    def set_auth_mode(self, mode: str):
        logger.info("set_auth_mode called with mode=%s", mode)
        self.auth_mode = mode
        self.error = ""
        self.message = ""

    def register(self):
        logger.info("register called with username=%s", self.register_username)
        self.error = ""
        self.message = ""
        if not self.register_username or not self.register_password:
            self.error = "Username and password are required"
            return
        if self.register_password != self.register_confirm:
            self.error = "Passwords do not match"
            return
        if len(self.register_password) < 6:
            self.error = "Password must be at least 6 characters"
            return
        try:
            user = services.create_user(self.register_username.strip(), self.register_password)
        except ValueError as exc:
            logger.warning("register failed for username=%s: %s", self.register_username, exc)
            self.error = str(exc)
            return
        logger.info("register succeeded for username=%s (id=%s)", user.username, user.id)
        self.message = f"Account {user.username} created. Please log in."
        self.auth_mode = "login"
        self.register_password = ""
        self.register_confirm = ""

    def login(self):
        logger.info("login called with username=%s", self.login_username)
        self.error = ""
        self.message = ""
        user = services.authenticate_user(self.login_username.strip(), self.login_password)
        if not user:
            logger.info("login failed for username=%s", self.login_username)
            self.error = "Invalid username or password"
            return
        logger.info("login succeeded for username=%s (id=%s)", user.username, user.id)
        self.user_id = user.id
        self.username = user.username
        self.login_password = ""
        self.load_user_state()
        self.message = f"Welcome back, {self.username}!"

    def logout(self):
        self.user_id = None
        self.username = ""
        self.profile_metrics = None
        self.summary = {}
        self.summary_intake_kcal = 0.0
        self.summary_burn_kcal = 0.0
        self.summary_net_kcal = 0.0
        self.summary_remaining = 0.0
        self.summary_macro_protein = 0.0
        self.summary_macro_fat = 0.0
        self.summary_macro_carbs = 0.0
        self.summary_food_log = []
        self.summary_exercise_log = []
        self.food_items = []
        self.weight_history = []
        self.message = "Logged out"

    # Profile field setters (called from UI inputs)
    def set_profile_age(self, value: str):
        """Update age from numeric input."""
        self.profile_age = self._to_int(value, self.profile_age)

    def set_profile_height(self, value: str):
        """Update height from numeric input."""
        self.profile_height = self._to_int(value, self.profile_height)

    def set_profile_weight(self, value: str):
        """Update weight from numeric input."""
        self.profile_weight = self._to_float(value, self.profile_weight)

    def set_profile_deficit(self, value: str):
        """Update deficit from numeric input."""
        self.profile_deficit = self._to_int(value, self.profile_deficit)

    def load_user_state(self):
        if not self.user_id:
            return
        profile = services.load_profile(self.user_id)
        if profile:
            self.profile_metrics = asdict(profile)
            self.profile_age = profile.age
            self.profile_gender = profile.gender
            self.profile_height = profile.height_cm
            self.profile_weight = profile.weight_kg
            self.profile_activity = profile.activity
            self.profile_deficit = profile.deficit
            self.weight_value = profile.weight_kg
        else:
            self.profile_metrics = None
        self._refresh_food_items()
        if profile:
            daily = services.get_daily_summary(self.user_id, date.fromisoformat(self.today_date), profile)
            self.summary = asdict(daily)
            self.summary_intake_kcal = daily.intake_kcal
            self.summary_burn_kcal = daily.burn_kcal
            self.summary_net_kcal = daily.net_kcal
            self.summary_remaining = daily.remaining
            self.summary_macro_protein = daily.macros.get("protein", 0.0)
            self.summary_macro_fat = daily.macros.get("fat", 0.0)
            self.summary_macro_carbs = daily.macros.get("carbs", 0.0)
            self.summary_food_log = daily.food_log
            self.summary_exercise_log = daily.exercise_log
            self._compute_insights()
        else:
            self.summary = {}
            self.summary_intake_kcal = 0.0
            self.summary_burn_kcal = 0.0
            self.summary_net_kcal = 0.0
            self.summary_remaining = 0.0
            self.summary_macro_protein = 0.0
            self.summary_macro_fat = 0.0
            self.summary_macro_carbs = 0.0
            self.summary_food_log = []
            self.summary_exercise_log = []
        self.weight_history = services.get_weight_history(self.user_id).entries
        self.workout_log = [asdict(entry) for entry in services.list_workout_entries(self.user_id)]
        self._compute_insights()

    def save_profile(self):
        if not self.user_id:
            return
        try:
            profile = services.upsert_profile(
                self.user_id,
                age=int(self.profile_age),
                gender=self.profile_gender,
                height_cm=int(self.profile_height),
                weight_kg=float(self.profile_weight),
                activity=self.profile_activity,
                deficit=int(self.profile_deficit),
            )
        except ValueError as exc:
            self.error = str(exc)
            return
        self.profile_metrics = asdict(profile)
        self.weight_value = profile.weight_kg
        self.message = "Profile saved"
        self.load_user_state()

    def log_food_entry(self):
        if not self.user_id:
            return
        qty = max(float(self.food_qty), 0.0)
        if qty <= 0:
            self.error = "Quantity must be greater than 0"
            return
        entry_date = date.fromisoformat(self.today_date)
        template = None
        if self.food_choice != "custom":
            template = next((item for item in self.food_items if str(item["id"]) == self.food_choice), None)
        if template:
            measure = template["measure"]
            food_name = template["name"]
            kcal = template["kcal"] * qty
            protein = template["protein"] * qty
            fat = template["fat"] * qty
            carbs = template["carbs"] * qty
        else:
            if not self.custom_food_name:
                self.error = "Enter a food name"
                return
            food_name = self.custom_food_name
            measure = self.custom_food_measure
            kcal = self.custom_food_kcal * qty
            protein = self.custom_food_protein * qty
            fat = self.custom_food_fat * qty
            carbs = self.custom_food_carbs * qty
            # Persist custom foods for future reuse
            existing = next((item for item in self.food_items if item["name"].lower() == food_name.lower()), None)
            if not existing:
                try:
                    services.add_food_item(
                        user_id=self.user_id,
                        name=food_name,
                        measure=measure,
                        kcal=self.custom_food_kcal,
                        protein=self.custom_food_protein,
                        fat=self.custom_food_fat,
                        carbs=self.custom_food_carbs,
                        category="Custom",
                        make_global=False,
                    )
                except ValueError as exc:
                    self.error = str(exc)
                    return
                self._refresh_food_items()
        services.log_food(
            user_id=self.user_id,
            entry_date=entry_date,
            food_name=food_name,
            measure=measure,
            qty=qty,
            kcal=kcal,
            protein=protein,
            fat=fat,
            carbs=carbs,
        )
        self.message = "Food entry added"
        self.load_user_state()

    def delete_food_entry(self, entry_id: int):
        if not self.user_id:
            return
        services.delete_food_log_entries(self.user_id, [entry_id])
        self.load_user_state()

    def log_exercise_entry(self):
        if not self.user_id or not self.profile_metrics:
            self.error = "Complete your profile first"
            return
        start = self._parse_time(self.exercise_start)
        end = self._parse_time(self.exercise_end)
        dt_start = datetime.combine(date.fromisoformat(self.today_date), start)
        dt_end = datetime.combine(date.fromisoformat(self.today_date), end)
        if dt_end <= dt_start:
            dt_end += timedelta(days=1)
        mins = (dt_end - dt_start).total_seconds() / 60
        weight = self.profile_metrics.get("weight_kg", 70.0)
        met = services.MET_VALUES.get(self.exercise_type, 3.5)
        kcal_burn = met * 3.5 * weight / 200 * mins
        services.log_exercise(
            user_id=self.user_id,
            entry_date=date.fromisoformat(self.today_date),
            ex_type=self.exercise_type,
            start=start,
            end=end,
            mins=mins,
            kcal_burn=kcal_burn,
        )
        self.message = "Exercise entry added"
        self.load_user_state()

    def delete_exercise_entry(self, entry_id: int):
        if not self.user_id:
            return
        services.delete_exercise_log_entries(self.user_id, [entry_id])
        self.load_user_state()

    def log_weight_entry(self):
        if not self.user_id:
            return
        entry_date = date.fromisoformat(self.today_date)
        services.log_weight(user_id=self.user_id, entry_date=entry_date, weight=float(self.weight_value))
        profile = services.upsert_profile(
            self.user_id,
            age=int(self.profile_age),
            gender=self.profile_gender,
            height_cm=int(self.profile_height),
            weight_kg=float(self.weight_value),
            activity=self.profile_activity,
            deficit=int(self.profile_deficit),
        )
        self.profile_metrics = asdict(profile)
        self.profile_weight = profile.weight_kg
        self.message = "Weight logged"
        self.load_user_state()

    def add_custom_food_item(self, make_global: bool = False):
        if not self.custom_food_name:
            self.error = "Provide a food name"
            return
        if not make_global and not self.user_id:
            self.error = "Log in to save personal foods"
            return
        if make_global and not self.user_id:
            self.error = "Only logged-in users can add foods"
            return
        try:
            services.add_food_item(
                user_id=None if make_global else self.user_id,
                name=self.custom_food_name,
                measure=self.custom_food_measure,
                kcal=self.custom_food_kcal,
                protein=self.custom_food_protein,
                fat=self.custom_food_fat,
                carbs=self.custom_food_carbs,
                category="Custom",
                make_global=make_global,
            )
        except ValueError as exc:
            self.error = str(exc)
            return
        self._refresh_food_items()
        self.message = "Food template saved"

    def delete_food_template(self, item_id: int):
        if not self.user_id:
            return
        services.delete_food_items(self.user_id, [item_id])
        self._refresh_food_items()

    def set_today(self, new_date: str):
        self.today_date = new_date
        if self.user_id and self.profile_metrics:
            profile = ProfileDTO(**self.profile_metrics)
            daily = services.get_daily_summary(self.user_id, date.fromisoformat(new_date), profile)
            self.summary = asdict(daily)
            self.summary_intake_kcal = daily.intake_kcal
            self.summary_burn_kcal = daily.burn_kcal
            self.summary_net_kcal = daily.net_kcal
            self.summary_remaining = daily.remaining
            self.summary_macro_protein = daily.macros.get("protein", 0.0)
            self.summary_macro_fat = daily.macros.get("fat", 0.0)
            self.summary_macro_carbs = daily.macros.get("carbs", 0.0)
            self.summary_food_log = daily.food_log
            self.summary_exercise_log = daily.exercise_log

    def update_food_qty(self, value: str):
        self.food_qty = self._to_float(value, 0.0)

    def update_custom_kcal(self, value: str):
        self.custom_food_kcal = self._to_float(value, 0.0)

    def update_custom_protein(self, value: str):
        self.custom_food_protein = self._to_float(value, 0.0)

    def update_custom_fat(self, value: str):
        self.custom_food_fat = self._to_float(value, 0.0)

    def update_custom_carbs(self, value: str):
        self.custom_food_carbs = self._to_float(value, 0.0)

    def update_weight_value(self, value: str):
        self.weight_value = self._to_float(value, self.weight_value)

    def _refresh_food_items(self):
        items = services.list_food_items(self.user_id)
        self.food_items = [{**item, "value": str(item["id"])} for item in items]
        self.food_groups = self._group_food_items(self.food_items)

    def set_workout_date(self, value: str):
        self.workout_date = value

    def set_workout_category(self, value: str):
        self.workout_category = value

    def set_workout_exercise(self, value: str):
        self.workout_exercise = value

    def set_workout_sets(self, value: str):
        self.workout_sets = self._to_int(value, self.workout_sets)

    def set_workout_reps(self, value: str):
        self.workout_reps = self._to_int(value, self.workout_reps)

    def set_workout_weight(self, value: str):
        self.workout_weight = self._to_float(value, self.workout_weight)

    def set_workout_notes(self, value: str):
        self.workout_notes = value

    def log_workout_entry(self):
        if not self.user_id:
            return
        services.log_workout_entry(
            user_id=self.user_id,
            entry_date=date.fromisoformat(self.workout_date or self.today_date),
            category=self.workout_category,
            exercise=self.workout_exercise,
            sets=int(self.workout_sets),
            reps=int(self.workout_reps),
            weight=float(self.workout_weight),
            notes=self.workout_notes,
        )
        self.message = "Workout logged"
        self.load_user_state()

    def delete_workout_entry(self, entry_id: int):
        if not self.user_id:
            return
        services.delete_workout_entries(self.user_id, [entry_id])
        self.load_user_state()

    def _group_food_items(self, items: List[Dict]) -> List[Dict]:
        grouped: Dict[str, List[Dict]] = {}
        for item in items:
            grouped.setdefault(item.get("category", "Other"), []).append(item)
        recent = [item for item in items if item.get("usage_count", 0) > 0]
        ordered_groups = []
        if recent:
            ordered_groups.append({"category": "Recently used", "items": recent})
        for category in sorted(grouped.keys()):
            ordered_groups.append({"category": category, "items": grouped[category]})
        return ordered_groups

    def _compute_insights(self):
        if not self.user_id or not self.profile_metrics:
            self.insights = {}
            return
        profile = ProfileDTO(**self.profile_metrics)
        summaries = services.get_recent_daily_summaries(self.user_id, profile, days=7)
        if self.weight_history:
            start_weight = float(self.weight_history[0]["weight"])
            current_weight = float(self.weight_history[-1]["weight"])
            diff = current_weight - start_weight
            percent = (diff / start_weight * 100) if start_weight else 0
        else:
            diff = 0
            percent = 0
        avg_net = sum(day.net_kcal for day in summaries) / len(summaries) if summaries else 0
        days_logged = len([day for day in summaries if day.intake_kcal > 0 or day.burn_kcal > 0])
        self.insights = {
            "weight_change": diff,
            "weight_change_pct": percent,
            "avg_net": avg_net,
            "days_logged": days_logged,
        }

    @staticmethod
    def _parse_time(value: str):
        try:
            return datetime.strptime(value, "%H:%M").time()
        except ValueError:
            return datetime.strptime("00:00", "%H:%M").time()

    @staticmethod
    def _to_int(value: str, default: int) -> int:
        try:
            return int(value or default)
        except ValueError:
            return default

    @staticmethod
    def _to_float(value: str, default: float) -> float:
        try:
            return float(value or default)
        except ValueError:
            return default
