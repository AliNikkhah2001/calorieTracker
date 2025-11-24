# Calorie & Weight Tracker (static web app)

A lightweight, GitHub Pages–friendly web app for logging food, workouts, and weight while projecting weight change using evidence-based formulas (Atwater macros, Mifflin-St-Jeor BMR, activity multipliers, MET-based exercise burn, and the 3,500 kcal ≈ 1 lb rule of thumb).

The app runs entirely in the browser—data is stored in `localStorage`, so no backend is required for basic tracking or for hosting on GitHub Pages. The previous Reflex prototype remains under `weight_tracker/` if you want to continue experimenting with a Python backend, but the static experience lives at the repo root.

## Features
- Profile inputs (age, gender, height, weight, activity level, daily deficit goal) with automatic BMR and TDEE calculations.
- Food logging using Atwater factors (4/4/9/7 kcal per gram for protein/carbs/fat/alcohol) with optional fiber energy and a starter food database you can extend.
- Exercise logging with MET values to compute calories per minute via `(MET × 3.5 × weight_kg × minutes) / 200`.
- Daily energy balance (intake, burn, net, remaining vs. goal) plus macro totals.
- Weight logging and prediction charting that applies the 3,500 kcal per pound (~0.4536 kg) heuristic to cumulative deficits.
- Charts for calorie trends and actual vs. predicted weight.

## Running locally
1. Open `index.html` directly in your browser, or serve the folder to avoid CORS issues:
   ```bash
   python -m http.server 8000
   ```
   Then browse to `http://localhost:8000`.

2. All data stays in your browser’s `localStorage`. Use the **Reset data** button to clear it.

## Deploying to GitHub Pages
Commit the repo to GitHub and enable Pages for the `main` branch (or `/docs` if you prefer). Because everything is static, no build step is required—`index.html`, `styles.css`, and `src/` can be hosted as-is.

## Formulas used
- **Food energy:** `kcal = 4*protein + 4*carbs + 9*fat + 7*alcohol (+ 2*fiber optional)`.
- **BMR (Mifflin-St-Jeor):**
  - Male: `10*weight_kg + 6.25*height_cm - 5*age + 5`
  - Female: `10*weight_kg + 6.25*height_cm - 5*age - 161`
- **TDEE:** `BMR × activity multiplier` (Sedentary 1.2 … Extra active 1.9).
- **Exercise burn:** `Calories/min = (MET × 3.5 × weight_kg) / 200`.
- **Weight prediction:** `Δkg = (cumulative_deficit / 3500) × 0.4536` (deficit positive ⇒ weight decreases).

## Repository layout
- `index.html` — main UI shell for the static app.
- `styles.css` — global styling.
- `src/foods.js` — starter food templates, MET table, activity multipliers.
- `src/app.js` — browser logic for logging, calculations, storage, and charts.
- `weight_tracker/` — legacy Reflex prototype (multi-user with SQLite) retained for reference.
- `data/` — example CSV/JSON data from the earlier prototype.

## Screenshots
If you deploy to Pages or run locally, the homepage provides cards for profile, food/exercise/weight logging, energy summary, charts, and the editable food database.
