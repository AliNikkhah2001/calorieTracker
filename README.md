# Calorie & Weight Tracker

This repository now provides two runnable experiences:

- A **static browser app** in `docs/` that runs entirely on GitHub Pages (or any static host) using localStorage for data.
- The original **Reflex + SQLite** prototype (under `weight_tracker/`) for users who want a server-backed experience.

## GitHub Pages / Static App

1. Push the repo to GitHub and enable Pages with the **`docs/` folder** as the source.
2. Visit the published URL – everything runs in the browser, storing data locally.
3. Features:
   - Profile form with Mifflin-St-Jeor BMR, TDEE, and target intake calculations.
   - Food logging using the Atwater factors (protein/carbs/alcohol/fiber) plus a searchable food database pulled from `docs/food_db.csv`.
   - Exercise logging with MET-based calorie burn calculations.
   - Daily deficit summary, macro totals, and charts (intake vs burn; actual vs predicted weight) powered by Chart.js.
   - Weight prediction uses cumulative deficit ÷ 3,500 kcal × 0.4536 kg to estimate trends.

To test locally, open `docs/index.html` in a browser or start a lightweight server:

```bash
python -m http.server --directory docs 8000
```

## Reflex / SQLite App

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
docs/                 # Static GitHub Pages app (Chart.js + PicoCSS + localStorage)
  index.html
  app.js
  style.css
  food_db.csv
rxconfig.py           # Reflex configuration
weight_tracker/
  weight_tracker.py   # Reflex UI + routing
  db.py               # SQLAlchemy engine/session helpers
  models.py           # ORM models (users, profiles, logs, foods)
  services.py         # Business logic + seeding utilities
  state.py            # Reflex AppState (auth, forms, logging)
data/app.db           # Created on first Reflex run
```

Run `python3 -m py_compile weight_tracker/*.py rxconfig.py` if you want a quick syntax check before starting the Reflex dev server.
