from __future__ import annotations

import reflex as rx

from .state import AppState
from . import services


EXERCISE_TYPES = list(services.MET_VALUES.keys())
ACTIVITY_LEVELS = list(services.ACTIVITY_MULTIPLIERS.keys())
GENDERS = ["Male", "Female"]

WORKOUT_LIBRARY = {
    "Chest": [
        "Seated Chest Press",
        "Horizontal Chest Press",
        "Decline Chest Press",
        "Incline Chest Press",
        "High-to-Low Cable Fly",
        "Low-to-High Cable Fly",
        "Standing Cable Chest Fly",
        "Single-Arm Cable Press",
    ],
    "Back": [
        "Wide-Grip Lat Pulldown",
        "Close-Grip Pulldown",
        "Reverse-Grip Pulldown",
        "Seated Cable Row",
        "Wide-Grip Row",
        "Neutral-Grip Row",
        "Assisted Pull-Up",
        "Assisted Chin-Up",
        "Back Extension",
    ],
    "Shoulders": [
        "Seated Shoulder Press",
        "Machine Lateral Raise",
        "Rear Delt Fly",
    ],
    "Arms": [
        "Machine Bicep Curl",
        "Cable Bicep Curl",
        "Hammer Curl",
        "Single-Arm Cable Curl",
        "Seated Tricep Extension",
        "Tricep Pushdown",
        "Overhead Cable Extension",
        "Single-Arm Cable Kickback",
    ],
    "Legs": [
        "Horizontal Leg Press",
        "45-Degree Leg Press",
        "Single-Leg Press",
        "Leg Extension",
        "Seated Leg Curl",
        "Lying Leg Curl",
        "Hack Squat",
        "Smith Machine Squat",
        "Split Squat",
        "Calf Raise",
        "Hip Thrust",
        "Standing Calf Raise",
        "Seated Calf Raise",
    ],
    "Glutes / Hips": [
        "Glute Kickback",
        "Hip Abduction",
        "Hip Adduction",
        "Cable Kickbacks",
        "Cable Hip Abduction",
        "Cable Hip Adduction",
    ],
    "Core": [
        "Machine Crunch",
        "Torso Rotation",
    ],
    "Full Body": [
        "Cable Woodchop",
        "Face Pull",
        "Cable Squat",
        "Cable Lunge",
        "Smith Machine Bench Press",
        "Smith Machine Deadlift",
        "Smith Machine Overhead Press",
    ],
}


def card(*children, **kwargs) -> rx.Component:
    """Reusable white card container."""
    base_kwargs = {
        "padding": "1rem",
        "border_radius": "lg",
        "background": "white",
        "box_shadow": "sm",
    }
    base_kwargs.update(kwargs)
    return rx.box(*children, **base_kwargs)


def metric_card(title: str, value_component: rx.Component, subtitle: str = "") -> rx.Component:
    return card(
        rx.vstack(
            rx.text(title, font_weight="bold", color="gray.500"),
            value_component,
            rx.cond(subtitle != "", rx.text(subtitle, color="gray.600", font_size="3"), rx.fragment()),
        )
    )


def summary_section() -> rx.Component:
    return rx.cond(
        AppState.profile_metrics != None,
        rx.vstack(
            rx.heading("Today's Summary", size="4"),
            rx.flex(
                metric_card(
                    "Intake",
                    rx.text(AppState.summary_intake_kcal, font_size="2xl", font_weight="bold"),
                    "kcal",
                ),
                metric_card(
                    "Burn",
                    rx.text(AppState.summary_burn_kcal, font_size="2xl", font_weight="bold"),
                    "kcal",
                ),
                metric_card(
                    "Net",
                    rx.text(AppState.summary_net_kcal, font_size="2xl", font_weight="bold"),
                    "kcal",
                ),
                metric_card(
                    "Remaining",
                    rx.text(AppState.summary_remaining, font_size="2xl", font_weight="bold"),
                    "kcal",
                ),
                gap="1rem",
                wrap="wrap",
            ),
            rx.box(
                rx.text("Protein (g): "),
                rx.text(AppState.summary_macro_protein),
                rx.text("  Fat (g): "),
                rx.text(AppState.summary_macro_fat),
                rx.text("  Carbs (g): "),
                rx.text(AppState.summary_macro_carbs),
                padding_y="0.5rem",
                color="gray.600",
            ),
        ),
        rx.text("Create a profile to start tracking", color="gray"),
    )


def profile_form() -> rx.Component:
    return card(
        rx.vstack(
            rx.heading("Profile", size="4"),
            rx.vstack(
                rx.text("Age"),
                rx.input(
                    type_="number",
                    value=AppState.profile_age,
                    on_change=AppState.set_profile_age,
                ),
                align_items="flex-start",
            ),
            rx.select(
                items=GENDERS,
                value=AppState.profile_gender,
                on_change=AppState.set_profile_gender,
            ),
            rx.vstack(
                rx.text("Height (cm)"),
                rx.input(type_="number", value=AppState.profile_height, on_change=AppState.set_profile_height),
                align_items="flex-start",
            ),
            rx.vstack(
                rx.text("Weight (kg)"),
                rx.input(type_="number", value=AppState.profile_weight, on_change=AppState.set_profile_weight),
                align_items="flex-start",
            ),
            rx.select(
                items=ACTIVITY_LEVELS,
                value=AppState.profile_activity,
                on_change=AppState.set_profile_activity,
            ),
            rx.vstack(
                rx.text("Daily kcal deficit goal"),
                rx.input(type_="number", value=AppState.profile_deficit, on_change=AppState.set_profile_deficit),
                align_items="flex-start",
            ),
            rx.button("Save profile", on_click=AppState.save_profile, color_scheme="green"),
            rx.cond(
                AppState.profile_metrics != None,
                rx.vstack(
                    rx.text("BMR: "),
                    rx.text(AppState.profile_metrics["bmr"]),
                    rx.text("TDEE: "),
                    rx.text(AppState.profile_metrics["tdee"]),
                ),
                rx.fragment(),
            ),
        ),
        width="100%",
        padding="1rem",
    )


def food_form() -> rx.Component:
    return card(
        rx.vstack(
            rx.heading("Add Food", size="4"),
            rx.select.root(
                rx.select.trigger(placeholder="Select food"),
                rx.select.content(
                    rx.select.group(rx.select.label("Custom"), rx.select.item("Custom entry", value="custom")),
                    rx.foreach(
                        AppState.food_groups,
                        lambda group: rx.select.group(
                            rx.select.label(group["category"]),
                            rx.foreach(
                                group["items"],
                                lambda item: rx.select.item(
                                    f"{item['name']} ({item['measure']})", value=item["value"]
                                ),
                            ),
                        ),
                    ),
                ),
                value=AppState.food_choice,
                on_change=AppState.set_food_choice,
            ),
            rx.input(type_="number", placeholder="Quantity", value=AppState.food_qty, on_change=AppState.update_food_qty),
            rx.input(placeholder="Food name", value=AppState.custom_food_name, on_change=AppState.set_custom_food_name),
            rx.input(placeholder="Measure", value=AppState.custom_food_measure, on_change=AppState.set_custom_food_measure),
            rx.flex(
                rx.input(
                    placeholder="kcal",
                    type_="number",
                    value=AppState.custom_food_kcal,
                    on_change=AppState.update_custom_kcal,
                ),
                rx.input(
                    placeholder="Protein",
                    type_="number",
                    value=AppState.custom_food_protein,
                    on_change=AppState.update_custom_protein,
                ),
                rx.input(
                    placeholder="Fat",
                    type_="number",
                    value=AppState.custom_food_fat,
                    on_change=AppState.update_custom_fat,
                ),
                rx.input(
                    placeholder="Carbs",
                    type_="number",
                    value=AppState.custom_food_carbs,
                    on_change=AppState.update_custom_carbs,
                ),
                gap="0.5rem",
                wrap="wrap",
            ),
            rx.button("Add food", on_click=AppState.log_food_entry, color_scheme="teal"),
            rx.button(
                "Save as template",
                on_click=lambda: AppState.add_custom_food_item(False),
                variant="outline",
            ),
        ),
        padding="1rem",
    )


def exercise_form() -> rx.Component:
    return card(
        rx.vstack(
            rx.heading("Add Exercise", size="4"),
            rx.select(
                items=EXERCISE_TYPES,
                value=AppState.exercise_type,
                on_change=AppState.set_exercise_type,
            ),
            rx.input(type_="time", value=AppState.exercise_start, on_change=AppState.set_exercise_start),
            rx.input(type_="time", value=AppState.exercise_end, on_change=AppState.set_exercise_end),
            rx.button("Log exercise", on_click=AppState.log_exercise_entry, color_scheme="purple"),
        ),
        padding="1rem",
    )


def weight_form() -> rx.Component:
    return card(
        rx.vstack(
            rx.heading("Log Weight", size="4"),
            rx.input(type_="number", value=AppState.weight_value, on_change=AppState.update_weight_value),
            rx.button("Log weight", on_click=AppState.log_weight_entry, color_scheme="orange"),
        ),
        padding="1rem",
    )


def workout_form() -> rx.Component:
    return card(
        rx.vstack(
            rx.heading("Strength / Cardio", size="4"),
            rx.input(type_="date", value=AppState.workout_date, on_change=AppState.set_workout_date),
            rx.select(
                items=list(WORKOUT_LIBRARY.keys()),
                value=AppState.workout_category,
                on_change=AppState.set_workout_category,
            ),
            rx.select.root(
                rx.select.trigger(placeholder="Choose exercise"),
                rx.select.content(
                    rx.foreach(
                        WORKOUT_LIBRARY.items(),
                        lambda item: rx.select.group(
                            rx.select.label(item[0]),
                            rx.foreach(
                                item[1],
                                lambda name: rx.select.item(name, value=name),
                            ),
                        ),
                    )
                ),
                value=AppState.workout_exercise,
                on_change=AppState.set_workout_exercise,
            ),
            rx.flex(
                rx.input(
                    placeholder="Sets",
                    type_="number",
                    value=AppState.workout_sets,
                    on_change=AppState.set_workout_sets,
                ),
                rx.input(
                    placeholder="Reps",
                    type_="number",
                    value=AppState.workout_reps,
                    on_change=AppState.set_workout_reps,
                ),
                rx.input(
                    placeholder="Weight (kg)",
                    type_="number",
                    value=AppState.workout_weight,
                    on_change=AppState.set_workout_weight,
                ),
                gap="0.5rem",
                wrap="wrap",
            ),
            rx.textarea(placeholder="Notes", value=AppState.workout_notes, on_change=AppState.set_workout_notes),
            rx.button("Add workout", on_click=AppState.log_workout_entry, color_scheme="pink"),
        )
    )


def workout_table() -> rx.Component:
    return rx.cond(
        AppState.workout_log != [],
        card(
            rx.vstack(
                rx.heading("Recent Workouts", size="4"),
                rx.table.root(
                    rx.table.header(
                        rx.table.row(
                            rx.table.column_header_cell("Date"),
                            rx.table.column_header_cell("Category"),
                            rx.table.column_header_cell("Exercise"),
                            rx.table.column_header_cell("Sets"),
                            rx.table.column_header_cell("Reps"),
                            rx.table.column_header_cell("Weight"),
                            rx.table.column_header_cell("Notes"),
                            rx.table.column_header_cell(""),
                        )
                    ),
                    rx.table.body(
                        rx.foreach(
                            AppState.workout_log,
                            lambda row: rx.table.row(
                                rx.table.cell(row["date"]),
                                rx.table.cell(row["category"]),
                                rx.table.cell(row["exercise"]),
                                rx.table.cell(row["sets"]),
                                rx.table.cell(row["reps"]),
                                rx.table.cell(row["weight"]),
                                rx.table.cell(row["notes"]),
                                rx.table.cell(
                                    rx.button(
                                        "Delete",
                                        size="1",
                                        on_click=lambda: AppState.delete_workout_entry(row["id"]),
                                    )
                                ),
                            ),
                        )
                    ),
                ),
            )
        ),
        rx.text("No workouts logged yet", color="gray.500"),
    )


def food_table() -> rx.Component:
    return rx.cond(
        AppState.summary_food_log != [],
        card(
            rx.vstack(
            rx.heading("Today's Food", size="3"),
                rx.table.root(
                    rx.table.header(
                        rx.table.row(
                            rx.table.column_header_cell("Food"),
                            rx.table.column_header_cell("Qty"),
                            rx.table.column_header_cell("kcal"),
                            rx.table.column_header_cell("Protein"),
                            rx.table.column_header_cell("Fat"),
                            rx.table.column_header_cell("Carbs"),
                            rx.table.column_header_cell(""),
                        )
                    ),
                    rx.table.body(
                        rx.foreach(
                            AppState.summary_food_log,
                            lambda row: rx.table.row(
                                rx.table.cell(row["food"]),
                                rx.table.cell(row["qty"]),
                                rx.table.cell(row["kcal"]),
                                rx.table.cell(row["protein"]),
                                rx.table.cell(row["fat"]),
                                rx.table.cell(row["carbs"]),
                                rx.table.cell(
                                    rx.button(
                                        "Delete",
                                        size="1",
                                        on_click=lambda: AppState.delete_food_entry(row["id"]),
                                    )
                                ),
                            ),
                        )
                    ),
                ),
            )
        ),
        rx.fragment(),
    )


def exercise_table() -> rx.Component:
    return rx.cond(
        AppState.summary_exercise_log != [],
        card(
            rx.vstack(
                rx.heading("Today's Exercise", size="3"),
                rx.table.root(
                    rx.table.header(
                        rx.table.row(
                            rx.table.column_header_cell("Type"),
                            rx.table.column_header_cell("mins"),
                            rx.table.column_header_cell("kcal"),
                            rx.table.column_header_cell(""),
                        )
                    ),
                    rx.table.body(
                        rx.foreach(
                            AppState.summary_exercise_log,
                            lambda row: rx.table.row(
                                rx.table.cell(row["type"]),
                                rx.table.cell(row["mins"]),
                                rx.table.cell(row["kcal_burn"]),
                                rx.table.cell(
                                    rx.button(
                                        "Delete",
                                        size="1",
                                        on_click=lambda: AppState.delete_exercise_entry(row["id"]),
                                    )
                                ),
                            ),
                        )
                    ),
                ),
            )
        ),
        rx.fragment(),
    )


def weight_history_table() -> rx.Component:
    return card(
        rx.vstack(
            rx.heading("Weight History", size="4"),
            rx.table.root(
                rx.table.header(
                    rx.table.row(
                        rx.table.column_header_cell("Date"),
                        rx.table.column_header_cell("Weight"),
                    )
                ),
                rx.table.body(
                    rx.foreach(
                        AppState.weight_history,
                        lambda row: rx.table.row(
                            rx.table.cell(row["date"]),
                            rx.table.cell(row["weight"]),
                        ),
                    )
                ),
            ),
        )
    )


def food_db_table() -> rx.Component:
    return card(
        rx.vstack(
            rx.heading("Food Database", size="4"),
            rx.table.root(
                rx.table.header(
                    rx.table.row(
                        rx.table.column_header_cell("Food"),
                        rx.table.column_header_cell("Measure"),
                        rx.table.column_header_cell("kcal"),
                        rx.table.column_header_cell("Protein"),
                        rx.table.column_header_cell("Fat"),
                        rx.table.column_header_cell("Carbs"),
                        rx.table.column_header_cell(""),
                    )
                ),
                rx.table.body(
                    rx.foreach(
                        AppState.food_items,
                        lambda item: rx.table.row(
                            rx.table.cell(item["name"]),
                            rx.table.cell(item["measure"]),
                            rx.table.cell(item["kcal"]),
                            rx.table.cell(item["protein"]),
                            rx.table.cell(item["fat"]),
                            rx.table.cell(item["carbs"]),
                            rx.table.cell(
                                rx.cond(
                                    item["owner_id"] == AppState.user_id,
                                    rx.button(
                                        "Delete",
                                        size="1",
                                        on_click=lambda: AppState.delete_food_template(item["id"]),
                                    ),
                                    rx.badge("Global", color_scheme="purple"),
                                )
                            ),
                        ),
                    )
                ),
            ),
        )
    )


def date_toolbar() -> rx.Component:
    return rx.hstack(
        rx.text("Date:"),
        rx.input(type_="date", value=AppState.today_date, on_change=AppState.set_today, width="200px"),
        rx.spacer(),
        rx.badge(AppState.today_date, color_scheme="gray"),
        width="100%",
    )


def insights_tab() -> rx.Component:
    return rx.vstack(
        date_toolbar(),
        rx.cond(
            AppState.profile_metrics != None,
            rx.vstack(
                summary_section(),
                rx.flex(
                    metric_card(
                        "Weight change",
                        rx.text(
                            rx.cond(
                                AppState.insights.get("weight_change", 0) < 0,
                                rx.text(f"{AppState.insights.get('weight_change', 0):.1f} kg", color="green.600"),
                                rx.text(f"{AppState.insights.get('weight_change', 0):.1f} kg", color="red.600"),
                            ),
                            font_size="xl",
                            font_weight="bold",
                        ),
                        "vs. first entry",
                    ),
                    metric_card(
                        "Change %",
                        rx.text(f"{AppState.insights.get('weight_change_pct', 0):.1f}%", font_size="xl", font_weight="bold"),
                    ),
                    metric_card(
                        "Avg net kcal (7d)",
                        rx.text(f"{AppState.insights.get('avg_net', 0):.0f}", font_size="xl", font_weight="bold"),
                    ),
                    metric_card(
                        "Days logged (7d)",
                        rx.text(f"{AppState.insights.get('days_logged', 0)}", font_size="xl", font_weight="bold"),
                        "with intake or exercise",
                    ),
                    gap="1rem",
                    wrap="wrap",
                ),
            ),
            rx.vstack(
                rx.text("Set up your profile to unlock insights", color="gray.600"),
                rx.text("Open the Account tab to enter age, weight, height, and goals."),
            ),
        ),
        spacing="4",
    )


def food_tab() -> rx.Component:
    return rx.vstack(
        date_toolbar(),
        rx.flex(food_form(), food_table(), gap="1rem", wrap="wrap"),
        spacing="3",
    )


def exercise_tab() -> rx.Component:
    return rx.vstack(
        date_toolbar(),
        rx.flex(exercise_form(), exercise_table(), gap="1rem", wrap="wrap"),
        spacing="3",
    )


def fitness_tab() -> rx.Component:
    return rx.vstack(
        workout_form(),
        workout_table(),
        spacing="3",
    )


def weight_tab() -> rx.Component:
    return rx.vstack(weight_form(), weight_history_table(), spacing="4")


def food_db_tab() -> rx.Component:
    return rx.vstack(
        food_db_table(),
        rx.hstack(
            rx.button(
                "Save personal template",
                on_click=lambda: AppState.add_custom_food_item(False),
            ),
            rx.button(
                "Save global template",
                variant="outline",
                on_click=lambda: AppState.add_custom_food_item(True),
                is_disabled=AppState.user_id == None,
            ),
        ),
    )


def account_tab() -> rx.Component:
    return rx.flex(profile_form(), weight_form(), gap="1rem", wrap="wrap")


def message_center() -> rx.Component:
    return rx.vstack(
        rx.cond(
            AppState.error != "",
            rx.text(AppState.error, color="red"),
            rx.fragment(),
        ),
        rx.cond(
            AppState.message != "",
            rx.text(AppState.message, color="green"),
            rx.fragment(),
        ),
    )


def dashboard_view() -> rx.Component:
    return rx.vstack(
        rx.box(
            rx.hstack(
                rx.heading("Weight Tracker", size="5"),
                rx.spacer(),
                rx.text(f"Logged in as {AppState.username}"),
                rx.button("Logout", on_click=AppState.logout),
            ),
            position="sticky",
            top="0",
            background="white",
            z_index="100",
            padding_y="0.5rem",
            box_shadow="md",
        ),
        message_center(),
        rx.tabs.root(
            rx.tabs.list(
                rx.tabs.trigger("Insights", value="insights"),
                rx.tabs.trigger("Food", value="food"),
                rx.tabs.trigger("Exercise", value="exercise"),
                rx.tabs.trigger("Fitness", value="fitness"),
                rx.tabs.trigger("Weight", value="weight"),
                rx.tabs.trigger("Food DB", value="fooddb"),
                rx.tabs.trigger("Account", value="account"),
            ),
            rx.tabs.content(insights_tab(), value="insights"),
            rx.tabs.content(food_tab(), value="food"),
            rx.tabs.content(exercise_tab(), value="exercise"),
            rx.tabs.content(fitness_tab(), value="fitness"),
            rx.tabs.content(weight_tab(), value="weight"),
            rx.tabs.content(food_db_tab(), value="fooddb"),
            rx.tabs.content(account_tab(), value="account"),
            default_value="insights",
        ),
        spacing="5",
        width="100%",
    )


def auth_view() -> rx.Component:
    return rx.center(
        card(
            rx.vstack(
                rx.heading("Weight Tracker", size="5"),
                rx.hstack(
                    rx.button(
                        "Login",
                        on_click=lambda: AppState.set_auth_mode("login"),
                        variant="solid",
                    ),
                    rx.button(
                        "Register",
                        on_click=lambda: AppState.set_auth_mode("register"),
                        variant="outline",
                    ),
                ),
                rx.cond(AppState.auth_mode == "login", login_form(), register_form()),
                message_center(),
            ),
            padding="2rem",
            width="400px",
        ),
        min_height="100vh",
    )


def login_form() -> rx.Component:
    return rx.vstack(
        rx.input(placeholder="Username", value=AppState.login_username, on_change=AppState.set_login_username),
        rx.input(
            placeholder="Password",
            value=AppState.login_password,
            on_change=AppState.set_login_password,
            type_="password",
        ),
        rx.button("Login", on_click=AppState.login, width="100%", color_scheme="blue"),
    )


def register_form() -> rx.Component:
    return rx.vstack(
        rx.input(
            placeholder="Username",
            value=AppState.register_username,
            on_change=AppState.set_register_username,
        ),
        rx.input(
            placeholder="Password",
            value=AppState.register_password,
            on_change=AppState.set_register_password,
            type_="password",
        ),
        rx.input(
            placeholder="Confirm Password",
            value=AppState.register_confirm,
            on_change=AppState.set_register_confirm,
            type_="password",
        ),
        rx.button("Create account", on_click=AppState.register, width="100%", color_scheme="green"),
    )


def index() -> rx.Component:
    return rx.box(
        rx.cond(AppState.user_id, dashboard_view(), auth_view()),
        padding="2rem",
        min_height="100vh",
        background="gray.50",
    )


app = rx.App(_state=AppState)
app.add_page(index, title="Weight Tracker")
