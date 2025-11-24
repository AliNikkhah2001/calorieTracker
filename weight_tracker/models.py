from __future__ import annotations

from datetime import datetime, date, time
from typing import List, Optional

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, Time, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(256), nullable=False)
    password_salt: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    profile: Mapped["Profile"] = relationship(back_populates="user", uselist=False, cascade="all, delete-orphan")
    food_logs: Mapped[List["FoodLog"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    exercise_logs: Mapped[List["ExerciseLog"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    weight_logs: Mapped[List["WeightEntry"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    food_items: Mapped[List["FoodItem"]] = relationship(back_populates="owner", cascade="all, delete-orphan")


class Profile(Base):
    __tablename__ = "profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    age: Mapped[int] = mapped_column(Integer, default=30)
    gender: Mapped[str] = mapped_column(String(10), default="Male")
    height_cm: Mapped[int] = mapped_column(Integer, default=170)
    weight_kg: Mapped[float] = mapped_column(Float, default=70.0)
    activity: Mapped[str] = mapped_column(String(20), default="Sedentary")
    deficit: Mapped[int] = mapped_column(Integer, default=500)

    user: Mapped[User] = relationship(back_populates="profile")


class FoodItem(Base):
    __tablename__ = "food_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    measure: Mapped[str] = mapped_column(String(100), default="1 serving")
    kcal: Mapped[float] = mapped_column(Float, default=0)
    protein: Mapped[float] = mapped_column(Float, default=0)
    fat: Mapped[float] = mapped_column(Float, default=0)
    carbs: Mapped[float] = mapped_column(Float, default=0)
    category: Mapped[str] = mapped_column(String(50), default="Other")
    owner_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)

    owner: Mapped[Optional[User]] = relationship(back_populates="food_items")

    __table_args__ = (UniqueConstraint("name", "owner_id", name="uq_fooditem_name_owner"),)


class FoodLog(Base):
    __tablename__ = "food_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    date: Mapped[date] = mapped_column(Date, default=date.today)
    food_name: Mapped[str] = mapped_column(String(120))
    measure: Mapped[str] = mapped_column(String(100))
    qty: Mapped[float] = mapped_column(Float, default=1.0)
    kcal: Mapped[float] = mapped_column(Float, default=0.0)
    protein: Mapped[float] = mapped_column(Float, default=0.0)
    fat: Mapped[float] = mapped_column(Float, default=0.0)
    carbs: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped[User] = relationship(back_populates="food_logs")


class ExerciseLog(Base):
    __tablename__ = "exercise_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    date: Mapped[date] = mapped_column(Date, default=date.today)
    type: Mapped[str] = mapped_column(String(50))
    start: Mapped[time] = mapped_column(Time)
    end: Mapped[time] = mapped_column(Time)
    mins: Mapped[float] = mapped_column(Float, default=0.0)
    kcal_burn: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped[User] = relationship(back_populates="exercise_logs")


class WeightEntry(Base):
    __tablename__ = "weight_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    date: Mapped[date] = mapped_column(Date, default=date.today, index=True)
    weight: Mapped[float] = mapped_column(Float, nullable=False)

    user: Mapped[User] = relationship(back_populates="weight_logs")
