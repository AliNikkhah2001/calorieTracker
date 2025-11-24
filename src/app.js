import { starterFoods, metTable, activityMultipliers } from './foods.js';

const state = {
  profile: {
    age: 30,
    gender: 'Male',
    heightCm: 170,
    weightKg: 70,
    activity: 'Sedentary',
    deficit: 500,
  },
  foodDb: [...starterFoods],
  logs: {}, // date -> { foods: [], exercises: [], weight: number|null }
};

const STORAGE_KEY = 'calorie-tracker-state';
let calorieChart;
let weightChart;

const todayISO = () => new Date().toISOString().slice(0, 10);
const getDayLog = (dateStr) => {
  if (!state.logs[dateStr]) {
    state.logs[dateStr] = { foods: [], exercises: [], weight: null };
  }
  return state.logs[dateStr];
};

const kcalFromMacros = ({ protein = 0, carbs = 0, fat = 0, alcohol = 0, fiber = 0 }) => {
  // Atwater factors; fiber optional at ~2 kcal/g
  return protein * 4 + carbs * 4 + fat * 9 + alcohol * 7 + fiber * 2;
};

const calculateBmr = (profile) => {
  const base = 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age;
  return profile.gender === 'Male' ? base + 5 : base - 161;
};

const calculateTdee = (profile) => {
  const bmr = calculateBmr(profile);
  const multiplier = activityMultipliers[profile.activity] ?? 1.2;
  return bmr * multiplier;
};

const calculateExerciseKcal = (entry, weightKg) => {
  const met = metTable[entry.type] ?? 3;
  return (met * 3.5 * weightKg * entry.mins) / 200;
};

const saveState = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

const loadState = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    Object.assign(state, parsed);
  } catch (err) {
    console.error('Failed to parse state', err);
  }
};

const setDateDefaults = () => {
  document.getElementById('food-date').value = todayISO();
  document.getElementById('exercise-date').value = todayISO();
  document.getElementById('weight-date').value = todayISO();
};

const renderProfile = () => {
  document.getElementById('age').value = state.profile.age;
  document.getElementById('gender').value = state.profile.gender;
  document.getElementById('height').value = state.profile.heightCm;
  document.getElementById('weight').value = state.profile.weightKg;
  document.getElementById('deficit').value = state.profile.deficit;
  const activitySelect = document.getElementById('activity');
  activitySelect.innerHTML = Object.keys(activityMultipliers)
    .map((a) => `<option ${a === state.profile.activity ? 'selected' : ''}>${a}</option>`) 
    .join('');
  const bmr = calculateBmr(state.profile).toFixed(0);
  const tdee = calculateTdee(state.profile).toFixed(0);
  const metrics = document.getElementById('profile-metrics');
  metrics.innerHTML = `
    <div class="metric-pill"><p class="metric-title">BMR</p><p class="metric-value">${bmr} kcal</p></div>
    <div class="metric-pill"><p class="metric-title">TDEE</p><p class="metric-value">${tdee} kcal</p></div>
  `;
};

const renderFoodDb = () => {
  const tbody = document.querySelector('#food-db-table tbody');
  tbody.innerHTML = '';
  state.foodDb.forEach((food) => {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${food.name}</td><td>${food.measure}</td><td>${food.kcal}</td><td>${food.protein}</td><td>${food.fat}</td><td>${food.carbs}</td>`;
    tbody.appendChild(row);
  });

  const select = document.getElementById('food-select');
  select.innerHTML = '<option value="">Custom entry</option>' +
    state.foodDb.map((food, idx) => `<option value="${idx}">${food.name}</option>`).join('');
};

const addFoodTemplate = () => {
  const food = readFoodForm(true);
  if (!food) return;
  state.foodDb.push(food);
  saveState();
  renderFoodDb();
  clearFoodForm();
};

const readFoodForm = (allowEmptyName = false) => {
  const selectValue = document.getElementById('food-select').value;
  const qty = parseFloat(document.getElementById('food-qty').value || '0');
  let food;
  if (selectValue !== '') {
    food = { ...state.foodDb[Number(selectValue)] };
  } else {
    const name = document.getElementById('food-name').value.trim();
    if (!name && !allowEmptyName) {
      alert('Enter a food name or choose one');
      return null;
    }
    food = {
      name: name || 'Custom food',
      measure: document.getElementById('food-measure').value || '1 serving',
      kcal: parseFloat(document.getElementById('food-kcal').value || '0'),
      protein: parseFloat(document.getElementById('food-protein').value || '0'),
      fat: parseFloat(document.getElementById('food-fat').value || '0'),
      carbs: parseFloat(document.getElementById('food-carbs').value || '0'),
      alcohol: parseFloat(document.getElementById('food-alcohol').value || '0'),
      fiber: parseFloat(document.getElementById('food-fiber').value || '0'),
    };
    if (!food.kcal) {
      food.kcal = kcalFromMacros(food);
    }
  }
  return { ...food, qty };
};

const clearFoodForm = () => {
  document.getElementById('food-select').value = '';
  document.getElementById('food-name').value = '';
  document.getElementById('food-measure').value = '';
  document.getElementById('food-kcal').value = '';
  document.getElementById('food-protein').value = '';
  document.getElementById('food-fat').value = '';
  document.getElementById('food-carbs').value = '';
  document.getElementById('food-alcohol').value = '';
  document.getElementById('food-fiber').value = '';
  document.getElementById('food-qty').value = 1;
};

const addFoodLog = () => {
  const food = readFoodForm();
  if (!food) return;
  const date = document.getElementById('food-date').value || todayISO();
  const log = getDayLog(date);
  const entry = {
    id: crypto.randomUUID(),
    name: food.name,
    measure: food.measure,
    qty: food.qty,
    macros: {
      protein: (food.protein ?? 0) * food.qty,
      fat: (food.fat ?? 0) * food.qty,
      carbs: (food.carbs ?? 0) * food.qty,
      alcohol: (food.alcohol ?? 0) * food.qty,
      fiber: (food.fiber ?? 0) * food.qty,
    },
  };
  entry.kcal = (food.kcal ?? kcalFromMacros(food)) * food.qty;
  log.foods.push(entry);
  saveState();
  renderFoodLog(date);
  updateSummary();
  clearFoodForm();
};

const addExerciseLog = () => {
  const date = document.getElementById('exercise-date').value || todayISO();
  const type = document.getElementById('exercise-type').value;
  const mins = parseFloat(document.getElementById('exercise-mins').value || '0');
  const start = document.getElementById('exercise-start').value;
  const end = document.getElementById('exercise-end').value;
  if (!type || !mins) return alert('Add an exercise type and duration');
  const entry = { id: crypto.randomUUID(), type, mins, start, end };
  entry.kcal = calculateExerciseKcal(entry, state.profile.weightKg);
  const log = getDayLog(date);
  log.exercises.push(entry);
  saveState();
  renderExerciseLog(date);
  updateSummary();
};

const addWeightLog = () => {
  const date = document.getElementById('weight-date').value || todayISO();
  const weight = parseFloat(document.getElementById('weight-value').value || '0');
  if (!weight) return alert('Enter weight');
  getDayLog(date).weight = weight;
  saveState();
  renderWeightLog();
  updateSummary();
};

const renderFoodLog = (date = document.getElementById('food-date').value || todayISO()) => {
  const tbody = document.querySelector('#food-log-table tbody');
  tbody.innerHTML = '';
  const log = getDayLog(date);
  log.foods.forEach((entry) => {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${entry.name}</td><td>${entry.qty}</td><td>${entry.kcal.toFixed(0)}</td><td>${entry.macros.protein.toFixed(1)}</td><td>${entry.macros.fat.toFixed(1)}</td><td>${entry.macros.carbs.toFixed(1)}</td><td><button class="table-action" data-id="${entry.id}" data-type="food" data-date="${date}">✕</button></td>`;
    tbody.appendChild(row);
  });
};

const renderExerciseLog = (date = document.getElementById('exercise-date').value || todayISO()) => {
  const tbody = document.querySelector('#exercise-log-table tbody');
  tbody.innerHTML = '';
  const log = getDayLog(date);
  log.exercises.forEach((entry) => {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${entry.type}</td><td>${entry.mins}</td><td>${entry.kcal.toFixed(0)}</td><td><button class="table-action" data-id="${entry.id}" data-type="exercise" data-date="${date}">✕</button></td>`;
    tbody.appendChild(row);
  });
};

const renderWeightLog = () => {
  const tbody = document.querySelector('#weight-table tbody');
  tbody.innerHTML = '';
  Object.keys(state.logs)
    .filter((date) => state.logs[date].weight)
    .sort()
    .forEach((date) => {
      const weight = state.logs[date].weight;
      const row = document.createElement('tr');
      row.innerHTML = `<td>${date}</td><td>${weight.toFixed(1)}</td><td><button class="table-action" data-id="${date}" data-type="weight" data-date="${date}">✕</button></td>`;
      tbody.appendChild(row);
    });
};

const deleteEntry = (id, type, date) => {
  const logDate = date || todayISO();
  const log = getDayLog(logDate);
  if (type === 'food') {
    log.foods = log.foods.filter((f) => f.id !== id);
  } else if (type === 'exercise') {
    log.exercises = log.exercises.filter((e) => e.id !== id);
  } else if (type === 'weight') {
    if (state.logs[logDate]) state.logs[logDate].weight = null;
  }
  saveState();
  renderFoodLog();
  renderExerciseLog();
  renderWeightLog();
  updateSummary();
};

const calcDayTotals = (dateStr) => {
  const log = getDayLog(dateStr);
  const intake = log.foods.reduce((sum, f) => sum + f.kcal, 0);
  const protein = log.foods.reduce((sum, f) => sum + f.macros.protein, 0);
  const fat = log.foods.reduce((sum, f) => sum + f.macros.fat, 0);
  const carbs = log.foods.reduce((sum, f) => sum + f.macros.carbs, 0);
  const exercise = log.exercises.reduce((sum, e) => sum + e.kcal, 0);
  const bmr = calculateBmr(state.profile);
  const tdee = calculateTdee(state.profile);
  const burn = tdee + exercise;
  const net = burn - intake;
  const remaining = (tdee - state.profile.deficit) - intake;
  return { intake, protein, fat, carbs, exercise, burn, net, remaining, tdee, bmr };
};

const updateSummary = () => {
  const date = document.getElementById('food-date').value || todayISO();
  const totals = calcDayTotals(date);
  const grid = document.getElementById('summary-grid');
  grid.innerHTML = '';
  const items = [
    { label: 'Intake', value: `${totals.intake.toFixed(0)} kcal` },
    { label: 'Burn (TDEE + exercise)', value: `${totals.burn.toFixed(0)} kcal` },
    { label: 'Net', value: `${totals.net.toFixed(0)} kcal` },
    { label: 'Remaining (goal)', value: `${totals.remaining.toFixed(0)} kcal` },
    { label: 'Protein', value: `${totals.protein.toFixed(1)} g` },
    { label: 'Fat', value: `${totals.fat.toFixed(1)} g` },
    { label: 'Carbs', value: `${totals.carbs.toFixed(1)} g` },
  ];
  items.forEach((item) => {
    const pill = document.createElement('div');
    pill.className = 'pill';
    pill.innerHTML = `<strong>${item.value}</strong><span>${item.label}</span>`;
    grid.appendChild(pill);
  });

  drawCharts();
};

const buildDailySeries = () => {
  const dates = Object.keys(state.logs).sort();
  return dates.map((date) => {
    const totals = calcDayTotals(date);
    return { date, ...totals, weight: state.logs[date].weight };
  });
};

const cumulativeWeightPredictions = () => {
  const series = buildDailySeries();
  if (!series.length) return [];
  const startWeight = (series.find((d) => d.weight)?.weight) ?? state.profile.weightKg;
  let cumulativeDeficit = 0;
  return series.map((day) => {
    cumulativeDeficit += day.net;
    const deltaKg = (cumulativeDeficit / 3500) * 0.4536 * -1; // deficit positive => weight down
    return { date: day.date, predicted: startWeight + deltaKg, actual: day.weight };
  });
};

const drawCharts = () => {
  const series = buildDailySeries();
  const labels = series.map((d) => d.date);
  const intake = series.map((d) => d.intake);
  const burn = series.map((d) => d.burn);
  const deficit = series.map((d) => d.net);

  const ctxCal = document.getElementById('calorie-chart');
  if (calorieChart) calorieChart.destroy();
  calorieChart = new Chart(ctxCal, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Intake (kcal)', data: intake, borderColor: '#ef4444', tension: 0.2 },
        { label: 'Burn (kcal)', data: burn, borderColor: '#10b981', tension: 0.2 },
        { label: 'Net (surplus/deficit)', data: deficit, borderColor: '#6366f1', tension: 0.2 },
      ],
    },
    options: {
      responsive: true,
      scales: { y: { beginAtZero: true } },
    },
  });

  const weightSeries = cumulativeWeightPredictions();
  const weightLabels = weightSeries.map((d) => d.date);
  const predicted = weightSeries.map((d) => d.predicted?.toFixed(1));
  const actual = weightSeries.map((d) => d.actual ?? null);

  const ctxWeight = document.getElementById('weight-chart');
  if (weightChart) weightChart.destroy();
  weightChart = new Chart(ctxWeight, {
    type: 'line',
    data: {
      labels: weightLabels,
      datasets: [
        { label: 'Predicted weight (kg)', data: predicted, borderColor: '#2563eb', tension: 0.3 },
        { label: 'Actual weight (kg)', data: actual, borderColor: '#f59e0b', tension: 0.3 },
      ],
    },
    options: { responsive: true },
  });
};

const readProfileForm = () => {
  state.profile.age = Number(document.getElementById('age').value || state.profile.age);
  state.profile.gender = document.getElementById('gender').value;
  state.profile.heightCm = Number(document.getElementById('height').value || state.profile.heightCm);
  state.profile.weightKg = Number(document.getElementById('weight').value || state.profile.weightKg);
  state.profile.activity = document.getElementById('activity').value;
  state.profile.deficit = Number(document.getElementById('deficit').value || state.profile.deficit);
};

const resetAll = () => {
  if (!confirm('This clears all locally stored data. Continue?')) return;
  localStorage.removeItem(STORAGE_KEY);
  window.location.reload();
};

const initEventListeners = () => {
  document.getElementById('save-profile').addEventListener('click', () => {
    readProfileForm();
    saveState();
    renderProfile();
    updateSummary();
  });
  document.getElementById('reset-data').addEventListener('click', resetAll);
  document.getElementById('add-food').addEventListener('click', addFoodLog);
  document.getElementById('save-food-template').addEventListener('click', addFoodTemplate);
  document.getElementById('add-exercise').addEventListener('click', addExerciseLog);
  document.getElementById('add-weight').addEventListener('click', addWeightLog);

  document.body.addEventListener('click', (evt) => {
    if (!evt.target.matches('.table-action')) return;
    const { id, type, date } = evt.target.dataset;
    deleteEntry(id, type, date);
  });
};

const initSelects = () => {
  const exerciseSelect = document.getElementById('exercise-type');
  exerciseSelect.innerHTML = Object.keys(metTable).map((k) => `<option>${k}</option>`).join('');
};

const bootstrap = () => {
  loadState();
  setDateDefaults();
  initSelects();
  renderProfile();
  renderFoodDb();
  renderFoodLog();
  renderExerciseLog();
  renderWeightLog();
  updateSummary();
  initEventListeners();
};

document.addEventListener('DOMContentLoaded', bootstrap);
