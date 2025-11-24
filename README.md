# WeightTracker Reflex App

This project replaces the original single-user Streamlit MVP with a multi-user Reflex web application backed by SQLite + SQLAlchemy. All tracking data now lives in a relational schema, users authenticate with username/password, and every profile/log is scoped per account.

## Features

- Username/password authentication with salted PBKDF2 hashing.
- Profile management with automatic BMR/TDEE calculations per user.
- Daily logging for foods, exercises, and weights, including built-in MET values.
- Shared + personal food dictionary stored in SQL and editable in the UI.
- Dashboard pages (Today, Weight, Food DB) implemented with Reflex components.

## Getting Started

1. **Install dependencies**

   ```bash
   pip install -r requirements.txt
   ```

   Reflex installs a CLI entry point; make sure it is on your PATH (e.g. `pip install reflex==0.4.*`).

2. **Run the app**

   ```bash
   reflex run
   ```

   This launches the dev server, compiles frontend assets, and starts the backend API. The SQLite database is stored at `data/app.db`. Default food items are seeded from `data/food_db.csv` on first run.

3. **Optional: importing old CSV data**

   The previous Streamlit CSV files remain untouched under `data/`. You can write a one-off script to read them and create rows through the new SQLAlchemy services if you need legacy data migrated for a user.

## Project Structure

```
rxconfig.py            # Reflex configuration
weight_tracker/
  weight_tracker.py    # Reflex UI + routing
  db.py                # SQLAlchemy engine/session helpers
  models.py            # ORM models (users, profiles, logs, foods)
  services.py          # Business logic + seeding utilities
  state.py             # Reflex AppState (auth, forms, logging)
data/app.db            # Created on first run
```

Run `python3 -m py_compile app.py weight_tracker/*.py rxconfig.py` if you want a quick syntax check before starting the dev server.
# calorieTracker
