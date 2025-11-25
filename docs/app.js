const STORAGE_KEY = 'calorie-tracker-state-v2';
let calorieChart;
let weightChart;
let deficitChart;
let pieChart;
let catalogs = { foods: [], activities: [] };

let state = loadState();

init();

function loadState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed.users && parsed.activeUserId) return parsed;
      // migrate from v1
      return {
        activeUserId: 'default',
        users: {
          default: {
            profile: parsed.profile || defaultProfile(),
            foods: parsed.foods || [],
            exercises: parsed.exercises || [],
            weights: parsed.weights || [],
            detox: defaultDetoxState(),
          },
        },
      };
    } catch (e) {
      console.error('Bad stored state', e);
    }
  }
  return {
    activeUserId: 'default',
    users: {
      default: {
        profile: defaultProfile(),
        foods: [],
        exercises: [],
        weights: [],
        detox: defaultDetoxState(),
      },
    },
  };
}

function defaultProfile() {
  return {
    name: 'Default',
    age: 30,
    height: 170,
    weight: 70,
    gender: 'Male',
    activity: 1.2,
    deficit: 500,
    fastingStart: '18:00',
    fastingEnd: '20:00',
  };
}

function defaultDetoxState() {
  return {
    items: [
      { id: 'mood', label: 'Mood (1–5)', type: 'number' },
      { id: 'cigarettes', label: 'Cigarettes', type: 'number' },
      { id: 'alcohol', label: 'Alcohol units', type: 'number' },
      { id: 'gym', label: 'Gym?', type: 'checkbox' },
      { id: 'weight', label: 'Weight entry', type: 'number' },
      { id: 'fasting', label: 'Fasting kept', type: 'checkbox' },
      { id: 'sugar', label: 'No sugar', type: 'checkbox' },
      { id: 'fat', label: 'No deep-fried fats', type: 'checkbox' },
      { id: 'porn', label: 'No pornography', type: 'checkbox' },
    ],
    daily: [],
    streakStart: new Date().toISOString().slice(0, 10),
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

async function init() {
  bindUserControls();
  bindProfileForm();
  bindFoodControls();
  bindExerciseControls();
  bindWeightControls();
  bindDetoxControls();
  document.getElementById('log-date').value = new Date().toISOString().slice(0, 10);
  await loadCatalog();
  renderAll();
  startCountdown();
}

async function loadCatalog() {
  try {
    const res = await fetch('data.json');
    catalogs = await res.json();
  } catch (e) {
    console.warn('Could not load catalog', e);
    catalogs = { foods: [], activities: [] };
  }
  populateFoodSelect();
  populateActivitySelect();
}

function getUser() {
  return state.users[state.activeUserId];
}

function bindUserControls() {
  const select = document.getElementById('user-select');
  const addBtn = document.getElementById('add-user');
  const nameInput = document.getElementById('user-name');

  const refresh = () => {
    select.innerHTML = '';
    Object.entries(state.users).forEach(([id, user]) => {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = user.profile.name;
      select.appendChild(option);
    });
    select.value = state.activeUserId;
    nameInput.value = getUser().profile.name;
  };

  select.addEventListener('change', () => {
    state.activeUserId = select.value;
    saveState();
    refresh();
    renderAll();
  });

  addBtn.addEventListener('click', () => {
    const newName = prompt('New user name?');
    if (!newName) return;
    const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`;
    state.users[id] = { profile: { ...defaultProfile(), name: newName }, foods: [], exercises: [], weights: [], detox: defaultDetoxState() };
    state.activeUserId = id;
    saveState();
    refresh();
    renderAll();
  });

  nameInput.addEventListener('change', () => {
    getUser().profile.name = nameInput.value || 'Unnamed';
    saveState();
    refresh();
    renderAll();
  });

  refresh();
}

function bindProfileForm() {
  const form = document.getElementById('profile-form');
  const fastingStart = document.getElementById('fasting-start');
  const fastingEnd = document.getElementById('fasting-end');

  const fill = () => {
    const profile = getUser().profile;
    form.age.value = profile.age;
    form.height.value = profile.height;
    form.weight.value = profile.weight;
    form.gender.value = profile.gender;
    form.activity.value = profile.activity;
    form.deficit.value = profile.deficit;
    fastingStart.value = profile.fastingStart;
    fastingEnd.value = profile.fastingEnd;
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const profile = getUser().profile;
    profile.age = parseInt(form.age.value, 10) || 0;
    profile.height = parseFloat(form.height.value) || 0;
    profile.weight = parseFloat(form.weight.value) || 0;
    profile.gender = form.gender.value;
    profile.activity = parseFloat(form.activity.value);
    profile.deficit = parseFloat(form.deficit.value) || 0;
    profile.fastingStart = fastingStart.value || '18:00';
    profile.fastingEnd = fastingEnd.value || '20:00';
    saveState();
    renderAll();
  });

  fill();
}

function bindFoodControls() {
  document.getElementById('add-food').addEventListener('click', () => {
    const user = getUser();
    const date = document.getElementById('log-date').value;
    const time = document.getElementById('food-time').value || '12:00';
    const qty = parseFloat(document.getElementById('food-qty').value) || 1;
    const select = document.getElementById('food-select');
    const selectedOption = select.options[select.selectedIndex];
    const selectedFood = catalogs.foods.find((f) => f.name === selectedOption?.dataset?.name || selectedOption?.value);

    const macros = {
      protein: parseFloat(document.getElementById('food-protein').value) || (selectedFood?.protein || 0),
      fat: parseFloat(document.getElementById('food-fat').value) || (selectedFood?.fat || 0),
      carbs: parseFloat(document.getElementById('food-carbs').value) || (selectedFood?.carbs || 0),
      alcohol: parseFloat(document.getElementById('food-alcohol').value) || 0,
      fiber: parseFloat(document.getElementById('food-fiber').value) || 0,
    };

    const kcalInput = parseFloat(document.getElementById('food-kcal').value);
    const kcal = Number.isFinite(kcalInput) && kcalInput > 0 ? kcalInput : calcCalories(macros);
    const name = document.getElementById('food-name').value || selectedFood?.name || 'Custom';

    user.foods.push({
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
      date,
      time,
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
    const name = e.target.options[e.target.selectedIndex]?.dataset?.name || e.target.value;
    const food = catalogs.foods.find((f) => f.name === name);
    if (!food) return;
    document.getElementById('food-name').value = food.name;
    document.getElementById('food-protein').value = food.protein;
    document.getElementById('food-fat').value = food.fat;
    document.getElementById('food-carbs').value = food.carbs;
    document.getElementById('food-kcal').value = food.kcal;
  });

  document.getElementById('log-date').addEventListener('change', renderAll);
}

function bindExerciseControls() {
  const select = document.getElementById('exercise-type');

  document.getElementById('add-exercise').addEventListener('click', () => {
    const user = getUser();
    const date = document.getElementById('log-date').value;
    const time = document.getElementById('exercise-time').value || '18:00';
    const mins = parseFloat(document.getElementById('exercise-mins').value) || 0;
    const met = parseFloat(select.value) || 3.5;
    if (mins <= 0) return;
    const weight = getWeightForDate(date);
    const kcalBurn = (met * 3.5 * weight) / 200 * mins;

    user.exercises.push({
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
      date,
      time,
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
  const user = getUser();
  document.getElementById('weight-entry').value = user.profile.weight;
  document.getElementById('add-weight').addEventListener('click', () => {
    const date = document.getElementById('log-date').value;
    const weight = parseFloat(document.getElementById('weight-entry').value) || 0;
    if (!weight) return;
    const u = getUser();
    u.weights = u.weights.filter((w) => w.date !== date);
    u.weights.push({ date, weight });
    u.weights.sort((a, b) => a.date.localeCompare(b.date));
    u.profile.weight = weight;
    saveState();
    renderAll();
  });
}

function bindDetoxControls() {
  document.getElementById('add-detox-item').addEventListener('click', () => {
    const label = document.getElementById('detox-label').value.trim();
    const type = document.getElementById('detox-type').value;
    if (!label) return;
    const u = getUser();
    u.detox.items.push({ id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`, label, type });
    document.getElementById('detox-label').value = '';
    saveState();
    renderAll();
  });

  document.getElementById('save-detox-day').addEventListener('click', () => {
    const date = document.getElementById('log-date').value;
    const u = getUser();
    const entry = { date, values: {}, keptPlan: document.getElementById('detox-kept').checked };
    u.detox.items.forEach((item) => {
      const input = document.querySelector(`[data-detox="${item.id}"]`);
      if (item.type === 'checkbox') {
        entry.values[item.id] = input.checked;
      } else {
        entry.values[item.id] = input.value;
      }
    });
    u.detox.daily = u.detox.daily.filter((d) => d.date !== date);
    u.detox.daily.push(entry);
    u.detox.daily.sort((a, b) => a.date.localeCompare(b.date));
    const streakBroken = !entry.keptPlan;
    if (streakBroken) {
      u.detox.streakStart = date;
    }
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

  const grouped = catalogs.foods.reduce((acc, food) => {
    acc[food.category] = acc[food.category] || [];
    acc[food.category].push(food);
    return acc;
  }, {});

  Object.entries(grouped).forEach(([category, foods]) => {
    const optgroup = document.createElement('optgroup');
    optgroup.label = category;
    foods.forEach((food) => {
      const option = document.createElement('option');
      option.value = food.name;
      option.dataset.name = food.name;
      option.textContent = `${food.name} (${food.kcal} kcal)`;
      optgroup.appendChild(option);
    });
    select.appendChild(optgroup);
  });

  document.getElementById('food-db-count').textContent = `${catalogs.foods.length} foods ready (edit data.json)`;
}

function populateActivitySelect() {
  const select = document.getElementById('exercise-type');
  select.innerHTML = '';
  const grouped = catalogs.activities.reduce((acc, act) => {
    acc[act.category] = acc[act.category] || [];
    acc[act.category].push(act);
    return acc;
  }, {});
  Object.entries(grouped).forEach(([category, acts]) => {
    const optgroup = document.createElement('optgroup');
    optgroup.label = category;
    acts.forEach((act) => {
      const option = document.createElement('option');
      option.value = act.met;
      option.textContent = `${act.label} (${act.met} METs)`;
      optgroup.appendChild(option);
    });
    select.appendChild(optgroup);
  });
  select.value = catalogs.activities[0]?.met || 3.5;
}

function renderAll() {
  renderProfileMetrics();
  renderFoodTable();
  renderExerciseTable();
  renderSummary();
  renderWeightTable();
  renderDetox();
  renderStreaks();
}

function renderProfileMetrics() {
  const user = getUser();
  const metrics = document.getElementById('profile-metrics');
  const bmr = mifflin(user.profile);
  const tdee = calcTdee(bmr, user.profile.activity);
  metrics.innerHTML = `
    <strong>${user.profile.name}</strong><br />
    <strong>BMR:</strong> ${bmr.toFixed(0)} kcal/day<br />
    <strong>TDEE:</strong> ${tdee.toFixed(0)} kcal/day (${activityLabel(user.profile.activity)})<br />
    <strong>Target intake:</strong> ${(tdee - user.profile.deficit).toFixed(0)} kcal/day
  `;
}

function renderFoodTable() {
  const tbody = document.querySelector('#food-table tbody');
  tbody.innerHTML = '';
  const date = document.getElementById('log-date').value;
  const rows = getUser().foods.filter((f) => f.date === date).sort((a, b) => a.time.localeCompare(b.time));
  let total = 0;
  rows.forEach((row) => {
    total += row.kcal;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.time}</td>
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
  const rows = getUser().exercises.filter((f) => f.date === date).sort((a, b) => a.time.localeCompare(b.time));
  let total = 0;
  rows.forEach((row) => {
    total += row.kcalBurn;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.time}</td>
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
    <p><strong>Daily deficit:</strong> ${summary.deficit.toFixed(0)} kcal (≈ ${(summary.weightDeltaKg).toFixed(2)} kg)</p>
    <p><strong>Predicted weight today:</strong> ${summary.predictedWeight.toFixed(2)} kg</p>
    <div class="metric-grid">
      <div class="metric">Protein: ${summary.macros.protein.toFixed(1)} g</div>
      <div class="metric">Fat: ${summary.macros.fat.toFixed(1)} g</div>
      <div class="metric">Carbs: ${summary.macros.carbs.toFixed(1)} g</div>
      <div class="metric">Current weight: ${summary.currentWeight.toFixed(1)} kg</div>
      <div class="metric">Weekly change: ${summary.weeklyChange.toFixed(1)} kg</div>
      <div class="metric">Monthly change: ${summary.monthlyChange.toFixed(1)} kg</div>
    </div>
  `;

  drawCalorieChart(summary);
  drawPieChart(summary);
  drawDeficitChart(date);
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

function renderDetox() {
  const user = getUser();
  const container = document.getElementById('detox-list');
  container.innerHTML = '';
  user.detox.items.forEach((item) => {
    const wrapper = document.createElement('label');
    wrapper.innerHTML = `${item.label} ${inputForDetox(item)}`;
    container.appendChild(wrapper);
  });
  const date = document.getElementById('log-date').value;
  const entry = user.detox.daily.find((d) => d.date === date);
  if (entry) {
    user.detox.items.forEach((item) => {
      const input = document.querySelector(`[data-detox="${item.id}"]`);
      if (!input) return;
      if (item.type === 'checkbox') input.checked = !!entry.values[item.id];
      else input.value = entry.values[item.id] ?? '';
    });
    document.getElementById('detox-kept').checked = entry.keptPlan;
  } else {
    document.getElementById('detox-kept').checked = false;
    user.detox.items.forEach((item) => {
      const input = document.querySelector(`[data-detox="${item.id}"]`);
      if (item.type === 'checkbox') input.checked = false;
      else input.value = '';
    });
  }
}

function renderStreaks() {
  const user = getUser();
  const streakEl = document.getElementById('streaks');
  const now = new Date();
  const streakStart = new Date(user.detox.streakStart);
  const msDiff = now - streakStart;
  const hours = Math.floor(msDiff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  streakEl.innerHTML = `
    <strong>Streak:</strong> ${days} days (${months} months, ${hours} hours) on fasting + detox plan
  `;
}

function summarizeDate(date) {
  const user = getUser();
  const foods = user.foods.filter((f) => f.date === date);
  const exercises = user.exercises.filter((e) => e.date === date);
  const intake = foods.reduce((sum, f) => sum + f.kcal, 0);
  const exercise = exercises.reduce((sum, e) => sum + e.kcalBurn, 0);
  const bmr = mifflin({ ...user.profile, weight: getWeightForDate(date) });
  const base = calcTdee(bmr, user.profile.activity);
  const deficit = base + exercise - intake;
  const predictedWeight = getPredictionForDate(date, base, exercise, intake);
  const weightDeltaKg = (deficit / 3500) * 0.4536;
  const currentWeight = getWeightForDate(date);
  const weeklyChange = currentWeight - getWeightForDate(addDays(date, -7));
  const monthlyChange = currentWeight - getWeightForDate(addDays(date, -30));
  return {
    intake,
    exercise,
    base,
    totalBurn: base + exercise,
    deficit,
    weightDeltaKg,
    macros: {
      protein: foods.reduce((sum, f) => sum + f.protein, 0),
      fat: foods.reduce((sum, f) => sum + f.fat, 0),
      carbs: foods.reduce((sum, f) => sum + f.carbs, 0),
    },
    predictedWeight,
    currentWeight,
    weeklyChange,
    monthlyChange,
  };
}

function buildPredictions() {
  const user = getUser();
  const dates = new Set();
  user.foods.forEach((f) => dates.add(f.date));
  user.exercises.forEach((e) => dates.add(e.date));
  user.weights.forEach((w) => dates.add(w.date));
  if (!dates.size) {
    dates.add(new Date().toISOString().slice(0, 10));
  }
  const sorted = [...dates].sort();
  let cumulativeDeficit = 0;
  const baseWeight = user.weights.length ? user.weights[0].weight : user.profile.weight;
  return sorted.map((date) => {
    const foods = user.foods.filter((f) => f.date === date);
    const exercises = user.exercises.filter((e) => e.date === date);
    const intake = foods.reduce((sum, f) => sum + f.kcal, 0);
    const exercise = exercises.reduce((sum, e) => sum + e.kcalBurn, 0);
    const weightForDay = getWeightForDate(date);
    const bmr = mifflin({ ...user.profile, weight: weightForDay });
    const base = calcTdee(bmr, user.profile.activity);
    const dailyDeficit = base + exercise - intake;
    cumulativeDeficit += dailyDeficit;
    const predictedKg = baseWeight - (cumulativeDeficit / 3500) * 0.4536;
    const actualEntry = user.weights.find((w) => w.date === date);
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
  const user = getUser();
  user.foods = user.foods.filter((f) => f.id !== id);
  saveState();
  renderAll();
}

function deleteExercise(id) {
  const user = getUser();
  user.exercises = user.exercises.filter((f) => f.id !== id);
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
  const user = getUser();
  const sorted = [...user.weights].sort((a, b) => a.date.localeCompare(b.date));
  let latest = user.profile.weight;
  for (const entry of sorted) {
    if (entry.date <= date) {
      latest = entry.weight;
    }
  }
  return latest;
}

function activityLabel(value) {
  const map = {
    1.2: 'Sedentary',
    1.375: 'Light',
    1.55: 'Moderate',
    1.725: 'Intense',
    1.9: 'Extra',
  };
  return map[value] || value;
}

function getMetLabel(value) {
  const match = catalogs.activities.find((a) => a.met === value);
  return match ? match.label : `${value} METs`;
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
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
  });
}

function drawPieChart(summary) {
  const ctx = document.getElementById('pie-chart');
  const data = {
    labels: ['Base burn', 'Exercise', 'Intake', 'Net deficit'],
    datasets: [
      {
        data: [summary.base, summary.exercise, summary.intake, Math.max(summary.deficit, 0)],
        backgroundColor: ['#22c55e', '#a855f7', '#3b82f6', '#f97316'],
      },
    ],
  };
  if (pieChart) pieChart.destroy();
  pieChart = new Chart(ctx, {
    type: 'doughnut',
    data,
    options: {
      plugins: {
        tooltip: {
          callbacks: {
            afterLabel: () => `Δweight ≈ ${summary.weightDeltaKg.toFixed(2)} kg`,
          },
        },
        legend: { position: 'bottom' },
      },
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
    options: { responsive: true, plugins: { legend: { position: 'bottom' } } },
  });
}

function drawDeficitChart(date) {
  const user = getUser();
  const base = calcTdee(mifflin({ ...user.profile, weight: getWeightForDate(date) }), user.profile.activity);
  const events = [
    ...user.foods.filter((f) => f.date === date).map((f) => ({ time: f.time, delta: -f.kcal })),
    ...user.exercises.filter((e) => e.date === date).map((e) => ({ time: e.time, delta: e.kcalBurn })),
  ].sort((a, b) => a.time.localeCompare(b.time));
  let running = base;
  const labels = ['Start'];
  const values = [running];
  events.forEach((evt, idx) => {
    running += evt.delta;
    labels.push(evt.time || `Event ${idx + 1}`);
    values.push(running);
  });
  const ctx = document.getElementById('deficit-chart');
  if (deficitChart) deficitChart.destroy();
  deficitChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Running total (kcal)',
          data: values,
          borderColor: '#0ea5e9',
          fill: false,
          tension: 0.2,
        },
      ],
    },
    options: { scales: { y: { beginAtZero: false } }, plugins: { legend: { display: false } } },
  });
}

function inputForDetox(item) {
  if (item.type === 'checkbox') {
    return `<input type="checkbox" data-detox="${item.id}" />`;
  }
  return `<input type="number" data-detox="${item.id}" />`;
}

function addDays(dateStr, days) {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function startCountdown() {
  setInterval(renderCountdown, 1000 * 30);
  renderCountdown();
}

function renderCountdown() {
  const profile = getUser().profile;
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const start = new Date(`${today}T${profile.fastingStart}:00`);
  const end = new Date(`${today}T${profile.fastingEnd}:00`);
  let status = '';
  let target = end;
  if (now >= start && now <= end) {
    status = 'Eating window open';
    target = end;
  } else {
    status = 'Fasting';
    if (now < start) target = start;
    else target = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  }
  const diffMs = target - now;
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const mins = Math.floor((diffMs / (1000 * 60)) % 60);
  document.getElementById('fasting-status').textContent = `${status} · ${hours}h ${mins}m remaining`;
}
