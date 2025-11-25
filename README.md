# Calorie & Weight Tracker

This repository now provides two runnable experiences:

- A **static browser app** in `docs/` that runs entirely on GitHub Pages (or any static host) using localStorage for data.
- The original **Reflex + SQLite** prototype (under `weight_tracker/`) for users who want a server-backed experience.

## GitHub Pages / Static App

1. Push the repo to GitHub and enable Pages with the **`docs/` folder** as the source.
2. Visit the published URL – everything runs in the browser, storing data locally.
3. Features:
   - Multiple user profiles with Mifflin-St-Jeor BMR, TDEE, target intake calculations, and configurable fasting windows.
   - Food logging using the Atwater factors (protein/carbs/alcohol/fiber) plus a categorized food database pulled from `docs/data.json` that you can edit directly.
   - Exercise logging with MET-based calorie burn calculations sourced from the same JSON catalog.
   - Daily deficit summary, macro totals, donut + running-deficit charts, fasting countdown, and a pie view of base burn vs. intake vs. exercise.
   - Weight prediction using cumulative deficit ÷ 3,500 kcal × 0.4536 kg with weekly/monthly deltas and actual vs. predicted charting.
   - Fasting and dopamine-detox streak tracking with customizable checklist items and daily compliance logging.
   - Mobile-friendly layout tuned for iPhone/iPad breakpoints plus installable PWA support (manifest + offline cache via service worker). A vector `docs/icon.svg` keeps the repo free of binary image assets.

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

   This launches the dev server, compiles frontend assets, and starts the backend API. The SQLite database is stored at `data/app.db` (created automatically). The repo excludes sample CSV seeds to keep it binary-free; add your own CSV in `data/` before the first run if you want automatic seeding.

3. **Optional: importing old CSV data**

   The previous Streamlit CSV files remain untouched under `data/`. You can write a one-off script to read them and create rows through the new SQLAlchemy services if you need legacy data migrated for a user.

## Project Structure

```
docs/                 # Static GitHub Pages app (Chart.js + PicoCSS + localStorage)
  index.html
  app.js
  style.css
  data.json           # Editable food + activity catalog for the static app
rxconfig.py           # Reflex configuration
weight_tracker/
  weight_tracker.py   # Reflex UI + routing
  db.py               # SQLAlchemy engine/session helpers
  models.py           # ORM models (users, profiles, logs, foods)
  services.py         # Business logic + seeding utilities
  state.py            # Reflex AppState (auth, forms, logging)
data/app.db           # Created on first Reflex run (add your own CSV seeds to data/ if desired)
```

Run `python3 -m py_compile weight_tracker/*.py rxconfig.py` if you want a quick syntax check before starting the Reflex dev server.
