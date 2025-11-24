const STORAGE_KEY = 'calorie-tracker-state-v1';
const ACTIVITY_LEVELS = {
  1.2: 'Sedentary',
  1.375: 'Light',
  1.55: 'Moderate',
  1.725: 'Intense',
  1.9: 'Extra',
};

const METS = {
  'Walking (3.5 METs)': 3.5,
  'Jogging (7 METs)': 7,
  'Cycling (6 METs)': 6,
  'Weightlifting (4 METs)': 4,
  'HIIT (10 METs)': 10,
};

const state = loadState();
let foodDb = [];
let calorieChart;
let weightChart;

init();

function loadState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error('Failed to parse stored state', e);
    }
  }
  return {
    profile: {
      age: 30,
      height: 170,
      weight: 70,
      gender: 'Male',
      activity: 1.2,
      deficit: 500,
    },
    foods: [],
    exercises: [],
    weights: [],
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

async function init() {
  bindProfileForm();
  bindFoodControls();
  bindExerciseControls();
  bindWeightControls();
  document.getElementById('log-date').value = new Date().toISOString().slice(0, 10);

  await loadFoodDb();
  renderAll();
}

async function loadFoodDb() {
  try {
    const res = await fetch('food_db.csv');
    const text = await res.text();
    foodDb = parseCsv(text);
  } catch (err) {
    console.warn('Could not load food database', err);
    foodDb = [];
  }
  populateFoodSelect();
}

function parseCsv(text) {
  const [header, ...rows] = text.trim().split(/\r?\n/);
  const cols = header.split(',');
  return rows.map((line) => {
    const values = line.split(',');
    const obj = {};
    cols.forEach((col, idx) => {
      obj[col] = values[idx];
    });
    obj.kcal = parseFloat(obj.kcal || 0);
    obj.protein = parseFloat(obj.protein || 0);
    obj.fat = parseFloat(obj.fat || 0);
    obj.carbs = parseFloat(obj.carbs || 0);
    return obj;
  });
}

function bindProfileForm() {
  const form = document.getElementById('profile-form');
  form.age.value = state.profile.age;
  form.height.value = state.profile.height;
  form.weight.value = state.profile.weight;
  form.gender.value = state.profile.gender;
  form.activity.value = state.profile.activity;
  form.deficit.value = state.profile.deficit;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    state.profile = {
      age: parseInt(form.age.value, 10) || 0,
      height: parseFloat(form.height.value) || 0,
      weight: parseFloat(form.weight.value) || 0,
      gender: form.gender.value,
      activity: parseFloat(form.activity.value),
      deficit: parseFloat(form.deficit.value) || 0,
    };
    saveState();
    renderAll();
  });
}

function bindFoodControls() {
  document.getElementById('add-food').addEventListener('click', () => {
    const date = document.getElementById('log-date').value;
    const qty = parseFloat(document.getElementById('food-qty').value) || 1;
    const select = document.getElementById('food-select');
    const selectedOption = select.options[select.selectedIndex];
    const selectedFood = foodDb.find((f) => f.food === selectedOption?.value);

    const macros = {
      protein: parseFloat(document.getElementById('food-protein').value) || (selectedFood?.protein || 0),
      fat: parseFloat(document.getElementById('food-fat').value) || (selectedFood?.fat || 0),
      carbs: parseFloat(document.getElementById('food-carbs').value) || (selectedFood?.carbs || 0),
      alcohol: parseFloat(document.getElementById('food-alcohol').value) || 0,
      fiber: parseFloat(document.getElementById('food-fiber').value) || 0,
    };

    const kcalInput = parseFloat(document.getElementById('food-kcal').value);
    const kcal = Number.isFinite(kcalInput) && kcalInput > 0 ? kcalInput : calcCalories(macros);
    const name = document.getElementById('food-name').value || selectedFood?.food || 'Custom';

    state.foods.push({
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
      date,
      name,
      qty,
      kcal: +(kcal * qty).toFixed(1),
      protein: +(macros.protein * qty).toFixed(1),
      fat: +(macros.fat * qty).toFixed(1),
      carbs: +(macros.carbs * qty).toFixed(1),
    });

    saveState();
    clearFoodInputs();
    renderAll();
  });

  document.getElementById('food-select').addEventListener('change', (e) => {
    const food = foodDb.find((f) => f.food === e.target.value);
    if (!food) return;
    document.getElementById('food-name').value = food.food;
    document.getElementById('food-protein').value = food.protein;
    document.getElementById('food-fat').value = food.fat;
    document.getElementById('food-carbs').value = food.carbs;
    document.getElementById('food-kcal').value = food.kcal;
  });

  document.getElementById('log-date').addEventListener('change', renderAll);
}

function bindExerciseControls() {
  const select = document.getElementById('exercise-type');
  Object.entries(METS).forEach(([label, value]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  });
  select.value = 3.5;

  document.getElementById('add-exercise').addEventListener('click', () => {
    const date = document.getElementById('log-date').value;
    const mins = parseFloat(document.getElementById('exercise-mins').value) || 0;
    const met = parseFloat(document.getElementById('exercise-type').value) || 3.5;
    if (mins <= 0) return;
    const weight = getWeightForDate(date);
    const kcalBurn = (met * 3.5 * weight) / 200 * mins;

    state.exercises.push({
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
      date,
      met,
      mins,
      kcalBurn: +kcalBurn.toFixed(1),
      label: getMetLabel(met),
    });
    saveState();
    document.getElementById('exercise-mins').value = '';
    renderAll();
  });
}

function bindWeightControls() {
  document.getElementById('weight-entry').value = state.profile.weight;
  document.getElementById('add-weight').addEventListener('click', () => {
    const date = document.getElementById('log-date').value;
    const weight = parseFloat(document.getElementById('weight-entry').value) || 0;
    if (!weight) return;
    state.weights = state.weights.filter((w) => w.date !== date);
    state.weights.push({ date, weight });
    state.weights.sort((a, b) => a.date.localeCompare(b.date));
    saveState();
    renderAll();
  });
}

function populateFoodSelect() {
  const select = document.getElementById('food-select');
  select.innerHTML = '';
  const manual = document.createElement('option');
  manual.value = '';
  manual.textContent = 'Manual entry';
  select.appendChild(manual);
  foodDb.forEach((food) => {
    const option = document.createElement('option');
    option.value = food.food;
    option.textContent = `${food.food} (${food.kcal} kcal)`;
    select.appendChild(option);
  });
  document.getElementById('food-db-count').textContent = `${foodDb.length} foods ready`;
}

function renderAll() {
  renderProfileMetrics();
  renderFoodTable();
  renderExerciseTable();
  renderSummary();
  renderWeightTable();
}

function renderProfileMetrics() {
  const metrics = document.getElementById('profile-metrics');
  const bmr = mifflin(state.profile);
  const tdee = calcTdee(bmr, state.profile.activity);
  metrics.innerHTML = `
    <strong>BMR:</strong> ${bmr.toFixed(0)} kcal/day<br />
    <strong>TDEE:</strong> ${tdee.toFixed(0)} kcal/day (${ACTIVITY_LEVELS[state.profile.activity]} activity)<br />
    <strong>Target intake:</strong> ${(tdee - state.profile.deficit).toFixed(0)} kcal/day
  `;
}

function renderFoodTable() {
  const tbody = document.querySelector('#food-table tbody');
  tbody.innerHTML = '';
  const date = document.getElementById('log-date').value;
  const rows = state.foods.filter((f) => f.date === date);
  let total = 0;
  rows.forEach((row) => {
    total += row.kcal;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.name}</td>
      <td>${row.qty}</td>
      <td>${row.kcal}</td>
      <td>${row.protein}</td>
      <td>${row.fat}</td>
      <td>${row.carbs}</td>
      <td><button data-id="${row.id}" class="ghost">Remove</button></td>
    `;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('button').forEach((btn) => btn.addEventListener('click', () => deleteFood(btn.dataset.id)));
  document.getElementById('intake-total').textContent = `${total.toFixed(1)} kcal`;
}

function renderExerciseTable() {
  const tbody = document.querySelector('#exercise-table tbody');
  tbody.innerHTML = '';
  const date = document.getElementById('log-date').value;
  const rows = state.exercises.filter((f) => f.date === date);
  let total = 0;
  rows.forEach((row) => {
    total += row.kcalBurn;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.label}</td>
      <td>${row.mins}</td>
      <td>${row.kcalBurn}</td>
      <td><button data-id="${row.id}" class="ghost">Remove</button></td>
    `;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('button').forEach((btn) => btn.addEventListener('click', () => deleteExercise(btn.dataset.id)));
  document.getElementById('burn-total').textContent = `${total.toFixed(1)} kcal`;
}

function renderSummary() {
  const date = document.getElementById('log-date').value;
  const summary = summarizeDate(date);
  const container = document.getElementById('summary');
  container.innerHTML = `
    <p><strong>Base burn (TDEE):</strong> ${summary.base.toFixed(0)} kcal</p>
    <p><strong>Exercise burn:</strong> ${summary.exercise.toFixed(0)} kcal</p>
    <p><strong>Intake:</strong> ${summary.intake.toFixed(0)} kcal</p>
    <p><strong>Total expenditure:</strong> ${summary.totalBurn.toFixed(0)} kcal</p>
    <p><strong>Daily deficit:</strong> ${summary.deficit.toFixed(0)} kcal</p>
    <p><strong>Predicted weight today:</strong> ${summary.predictedWeight.toFixed(2)} kg</p>
    <div class="metric-grid">
      <div class="metric">Protein: ${summary.macros.protein.toFixed(1)} g</div>
      <div class="metric">Fat: ${summary.macros.fat.toFixed(1)} g</div>
      <div class="metric">Carbs: ${summary.macros.carbs.toFixed(1)} g</div>
    </div>
  `;

  drawCalorieChart(summary);
}

function renderWeightTable() {
  const tbody = document.querySelector('#weight-table tbody');
  tbody.innerHTML = '';
  const predicted = buildPredictions();
  predicted.forEach((row) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.date}</td>
      <td>${row.actual ?? '—'}</td>
      <td>${row.predicted.toFixed(2)}</td>
    `;
    tbody.appendChild(tr);
  });
  drawWeightChart(predicted);
}

function summarizeDate(date) {
  const foods = state.foods.filter((f) => f.date === date);
  const exercises = state.exercises.filter((e) => e.date === date);
  const intake = foods.reduce((sum, f) => sum + f.kcal, 0);
  const exercise = exercises.reduce((sum, e) => sum + e.kcalBurn, 0);
  const bmr = mifflin({ ...state.profile, weight: getWeightForDate(date) });
  const base = calcTdee(bmr, state.profile.activity);
  const totalBurn = base + exercise;
  const deficit = totalBurn - intake;
  const predictedWeight = getPredictionForDate(date, base, exercise, intake);
  return {
    intake,
    exercise,
    base,
    totalBurn,
    deficit,
    macros: {
      protein: foods.reduce((sum, f) => sum + f.protein, 0),
      fat: foods.reduce((sum, f) => sum + f.fat, 0),
      carbs: foods.reduce((sum, f) => sum + f.carbs, 0),
    },
    predictedWeight,
  };
}

function buildPredictions() {
  const dates = new Set();
  state.foods.forEach((f) => dates.add(f.date));
  state.exercises.forEach((e) => dates.add(e.date));
  state.weights.forEach((w) => dates.add(w.date));
  if (!dates.size) {
    dates.add(new Date().toISOString().slice(0, 10));
  }
  const sorted = [...dates].sort();
  let cumulativeDeficit = 0;
  const baseWeight = state.weights.length ? state.weights[0].weight : state.profile.weight;
  return sorted.map((date) => {
    const foods = state.foods.filter((f) => f.date === date);
    const exercises = state.exercises.filter((e) => e.date === date);
    const intake = foods.reduce((sum, f) => sum + f.kcal, 0);
    const exercise = exercises.reduce((sum, e) => sum + e.kcalBurn, 0);
    const weightForDay = getWeightForDate(date);
    const bmr = mifflin({ ...state.profile, weight: weightForDay });
    const base = calcTdee(bmr, state.profile.activity);
    const dailyDeficit = base + exercise - intake;
    cumulativeDeficit += dailyDeficit;
    const predictedKg = baseWeight - (cumulativeDeficit / 3500) * 0.4536;
    const actualEntry = state.weights.find((w) => w.date === date);
    return {
      date,
      predicted: predictedKg,
      actual: actualEntry ? actualEntry.weight : null,
    };
  });
}

function getPredictionForDate(date, base, exercise, intake) {
  const preds = buildPredictions();
  const match = preds.find((p) => p.date === date);
  if (match) return match.predicted;
  const last = preds[preds.length - 1];
  const dailyDeficit = base + exercise - intake;
  const predicted = last.predicted - (dailyDeficit / 3500) * 0.4536;
  return predicted;
}

function deleteFood(id) {
  state.foods = state.foods.filter((f) => f.id !== id);
  saveState();
  renderAll();
}

function deleteExercise(id) {
  state.exercises = state.exercises.filter((f) => f.id !== id);
  saveState();
  renderAll();
}

function clearFoodInputs() {
  document.getElementById('food-qty').value = '1';
  document.getElementById('food-name').value = '';
  document.getElementById('food-protein').value = '';
  document.getElementById('food-fat').value = '';
  document.getElementById('food-carbs').value = '';
  document.getElementById('food-alcohol').value = '';
  document.getElementById('food-fiber').value = '';
  document.getElementById('food-kcal').value = '';
  document.getElementById('food-select').value = '';
}

function calcCalories({ protein = 0, fat = 0, carbs = 0, alcohol = 0, fiber = 0 }) {
  return protein * 4 + carbs * 4 + fat * 9 + alcohol * 7 + fiber * 2;
}

function mifflin({ weight, height, age, gender }) {
  const s = gender === 'Male' ? 5 : -161;
  return 10 * weight + 6.25 * height - 5 * age + s;
}

function calcTdee(bmr, activity) {
  return bmr * activity;
}

function getWeightForDate(date) {
  const sorted = [...state.weights].sort((a, b) => a.date.localeCompare(b.date));
  let latest = state.profile.weight;
  for (const entry of sorted) {
    if (entry.date <= date) {
      latest = entry.weight;
    }
  }
  return latest;
}

function getMetLabel(value) {
  const match = Object.entries(METS).find(([, v]) => v === value);
  return match ? match[0] : `${value} METs`;
}

function drawCalorieChart(summary) {
  const ctx = document.getElementById('calorie-chart');
  const data = {
    labels: ['Intake', 'Base burn', 'Exercise', 'Deficit'],
    datasets: [
      {
        label: 'kcal',
        data: [summary.intake, summary.base, summary.exercise, summary.deficit],
        backgroundColor: ['#3b82f6', '#22c55e', '#a855f7', '#f97316'],
      },
    ],
  };
  if (calorieChart) calorieChart.destroy();
  calorieChart = new Chart(ctx, {
    type: 'bar',
    data,
    options: {
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } },
    },
  });
}

function drawWeightChart(rows) {
  const ctx = document.getElementById('weight-chart');
  const labels = rows.map((r) => r.date);
  const actual = rows.map((r) => r.actual);
  const predicted = rows.map((r) => r.predicted);
  if (weightChart) weightChart.destroy();
  weightChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Actual (kg)',
          data: actual,
          spanGaps: true,
          borderColor: '#2563eb',
          tension: 0.2,
        },
        {
          label: 'Predicted (kg)',
          data: predicted,
          borderColor: '#f97316',
          borderDash: [6, 4],
          tension: 0.2,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' } },
    },
  });
}
