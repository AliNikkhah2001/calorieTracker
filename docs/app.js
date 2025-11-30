const STORAGE_KEY = 'calorie-tracker-state-v3';
let calorieChart;
let weightChart;
let deficitChart;
let deficitTrendChart;
let pieChart;
let detoxChart;
let catalogs = { foods: [], activities: [] };
let foodSearchTerm = '';

let state = loadState();
let activeTab = 'insights';
let setActiveTabFn = () => {};

init();

function loadState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  const buildDefault = () => ({
    activeUserId: 'default',
    users: { default: defaultUser('Default') },
  });
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed.users && parsed.activeUserId) {
        Object.entries(parsed.users).forEach(([id, user]) => {
          parsed.users[id] = ensureUserSchema(user);
        });
        return parsed;
      }
      // migrate from v1
      const migrated = buildDefault();
      migrated.users.default.profile = parsed.profile || defaultProfile();
      migrated.users.default.foods = parsed.foods || [];
      migrated.users.default.exercises = parsed.exercises || [];
      migrated.users.default.weights = parsed.weights || [];
      return migrated;
    } catch (e) {
      console.error('Bad stored state', e);
    }
  }
  return buildDefault();
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

function defaultUser(name = 'Default') {
  return {
    profile: { ...defaultProfile(), name },
    foods: [],
    exercises: [],
    weights: [],
    detox: defaultDetoxState(),
    customFoods: [],
    recentFoods: [],
    favoriteFoods: [],
    recentExercises: [],
    setupComplete: false,
  };
}

function ensureUserSchema(user) {
  return {
    ...defaultUser(user?.profile?.name || 'User'),
    ...user,
    profile: { ...defaultProfile(), ...(user?.profile || {}) },
    detox: user?.detox || defaultDetoxState(),
    customFoods: user?.customFoods || [],
    recentFoods: user?.recentFoods || [],
    favoriteFoods: user?.favoriteFoods || [],
    recentExercises: user?.recentExercises || [],
    setupComplete: user?.setupComplete || false,
    exercises: (user?.exercises || []).map((ex) => normalizeExercise(ex)),
  };
}

function normalizeExercise(exercise) {
  const base = { ...exercise };
  base.type = exercise?.type || (exercise?.met ? 'cardio' : 'strength');
  base.date = exercise?.date || new Date().toISOString().slice(0, 10);
  base.time = exercise?.time || '12:00';
  base.mins = parseFloat(exercise?.mins || exercise?.duration || 0) || 0;
  if (base.type === 'strength') {
    base.sets = parseInt(exercise?.sets, 10) || 1;
    base.reps = parseInt(exercise?.reps, 10) || 8;
    base.weight = parseFloat(exercise?.weight) || 0;
    base.volume = (base.sets || 0) * (base.reps || 0) * (base.weight || 0);
    base.notes = exercise?.notes || '';
    base.met = parseFloat(exercise?.met || 4) || 4;
  } else {
    base.met = parseFloat(exercise?.met) || 3.5;
    base.distance = parseFloat(exercise?.distance) || 0;
    base.incline = parseFloat(exercise?.incline) || 0;
    base.label = exercise?.label || exercise?.name || getMetLabel(base.met);
  }
  if (!base.kcalBurn && base.mins) {
    const weightGuess = state?.users?.[state.activeUserId]?.profile?.weight || 70;
    base.kcalBurn = computeKcalFromMet(base.met, base.mins, weightGuess);
  }
  return base;
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
  bindTabs();
  bindUserControls();
  bindProfileForm();
  bindFoodControls();
  bindExerciseControls();
  bindWeightControls();
  bindDetoxControls();
  const today = new Date().toISOString().slice(0, 10);
  syncDateInputs(today);
  await loadCatalog();
  renderAll();
  startCountdown();
  registerServiceWorker();
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch((err) =>
      console.warn('Service worker registration failed', err)
    );
  }
}

function syncDateInputs(value, sourceId) {
  const ids = ['log-date', 'insight-date', 'detox-date', 'exercise-date'];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el && (sourceId !== id || el.value !== value)) {
      el.value = value;
    }
  });
}

function bindTabs() {
  const tabs = document.querySelectorAll('.tab');
  const setActiveTab = (name, { force } = {}) => {
    const requiresSetup = !getUser().setupComplete;
    let target = name;
    if (requiresSetup && name !== 'account' && !force) {
      target = 'account';
      const hint = document.getElementById('setup-hint');
      if (hint) hint.textContent = 'Complete your profile to unlock all tabs.';
    }
    activeTab = target;
    tabs.forEach((t) => t.classList.toggle('active', t.dataset.tab === target));
    document.querySelectorAll('.tab-panel').forEach((panel) => panel.classList.remove('active'));
    const panel = document.getElementById(`panel-${target}`);
    if (panel) panel.classList.add('active');
    if (pieChart) pieChart.resize();
    if (deficitChart) deficitChart.resize();
    if (deficitTrendChart) deficitTrendChart.resize();
    if (weightChart) weightChart.resize();
    if (calorieChart) calorieChart.resize();
    if (detoxChart) detoxChart.resize();
  };
  setActiveTabFn = setActiveTab;

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => setActiveTab(tab.dataset.tab));
  });

  const initialTab = getUser().setupComplete ? 'insights' : 'account';
  setActiveTab(initialTab, { force: true });
}

async function loadCatalog() {
  try {
    const res = await fetch('data.json');
    catalogs = await res.json();
    catalogs.exercises = catalogs.exercises || [];
  } catch (e) {
    console.warn('Could not load catalog', e);
    catalogs = { foods: [], activities: [], exercises: [] };
  }
  populateFoodSelect();
  populateActivitySelect();
  populateStrengthSelect();
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
    const hint = document.getElementById('setup-hint');
    if (hint) {
      hint.textContent = getUser().setupComplete
        ? 'Profile complete. You can reset to revisit onboarding.'
        : 'Complete and save to unlock insights.';
    }
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
    getUser().setupComplete = true;
    saveState();
    renderAll();
  });

  const resetBtn = document.getElementById('reset-setup');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      getUser().setupComplete = false;
      saveState();
      setActiveTabFn('account', { force: true });
    });
  }

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

    const existingFood = getAllFoods().find((f) => f.name.toLowerCase() === name.toLowerCase());
    if (!existingFood) {
      user.customFoods.push({
        category: 'Custom',
        name,
        kcal: +(kcal || calcCalories(macros)).toFixed(1),
        protein: +(macros.protein || 0).toFixed(1),
        fat: +(macros.fat || 0).toFixed(1),
        carbs: +(macros.carbs || 0).toFixed(1),
      });
    }

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

    user.recentFoods = [name, ...user.recentFoods.filter((f) => f !== name)].slice(0, 10);

    saveState();
    clearFoodInputs();
    renderAll();
  });

  document.getElementById('food-select').addEventListener('change', (e) => {
    const name = e.target.options[e.target.selectedIndex]?.dataset?.name || e.target.value;
    const food = getAllFoods().find((f) => f.name === name);
    if (!food) return;
    document.getElementById('food-name').value = food.name;
    document.getElementById('food-protein').value = food.protein;
    document.getElementById('food-fat').value = food.fat;
    document.getElementById('food-carbs').value = food.carbs;
    document.getElementById('food-kcal').value = food.kcal;
  });

  const search = document.getElementById('food-search');
  if (search) {
    search.addEventListener('input', (e) => {
      foodSearchTerm = e.target.value.toLowerCase();
      populateFoodSelect();
    });
  }

  document.getElementById('log-date').addEventListener('change', (e) => {
    syncDateInputs(e.target.value, 'log-date');
    renderAll();
  });

  const insightDate = document.getElementById('insight-date');
  if (insightDate) {
    insightDate.addEventListener('change', (e) => {
      syncDateInputs(e.target.value, 'insight-date');
      renderAll();
    });
  }

  const detoxDate = document.getElementById('detox-date');
  if (detoxDate) {
    detoxDate.addEventListener('change', (e) => {
      syncDateInputs(e.target.value, 'detox-date');
      renderAll();
    });
  }

  const exerciseDate = document.getElementById('exercise-date');
  if (exerciseDate) {
    exerciseDate.addEventListener('change', (e) => {
      syncDateInputs(e.target.value, 'exercise-date');
      renderAll();
    });
  }
}

function bindExerciseControls() {
  const cardioSelect = document.getElementById('exercise-type');
  const strengthSelect = document.getElementById('strength-exercise');

  document.getElementById('add-exercise').addEventListener('click', () => {
    const user = getUser();
    const date = document.getElementById('exercise-date').value;
    const time = document.getElementById('exercise-time').value || '18:00';
    const mins = parseFloat(document.getElementById('exercise-mins').value) || 0;
    const met = parseFloat(cardioSelect.value) || 3.5;
    if (mins <= 0) return;
    const weight = getWeightForDate(date);
    const kcalBurn = computeKcalFromMet(met, mins, weight);
    const distance = parseFloat(document.getElementById('exercise-distance').value) || 0;
    const incline = parseFloat(document.getElementById('exercise-incline').value) || 0;

    user.exercises.push({
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
      type: 'cardio',
      date,
      time,
      met,
      mins,
      distance,
      incline,
      kcalBurn: +kcalBurn.toFixed(1),
      label: getMetLabel(met),
    });
    user.recentExercises = [getMetLabel(met), ...user.recentExercises.filter((n) => n !== getMetLabel(met))].slice(0, 8);
    saveState();
    document.getElementById('exercise-mins').value = '';
    document.getElementById('exercise-distance').value = '';
    document.getElementById('exercise-incline').value = '';
    renderAll();
  });

  document.getElementById('add-strength').addEventListener('click', () => {
    const user = getUser();
    const date = document.getElementById('exercise-date').value;
    const time = document.getElementById('strength-time').value || '18:00';
    const sets = parseInt(document.getElementById('strength-sets').value, 10) || 0;
    const reps = parseInt(document.getElementById('strength-reps').value, 10) || 0;
    const weight = parseFloat(document.getElementById('strength-weight').value) || 0;
    const mins = parseFloat(document.getElementById('strength-mins').value) || 0;
    if (!sets || !reps) return;
    const selection = strengthSelect.options[strengthSelect.selectedIndex];
    const name = selection?.dataset?.name || selection?.value || 'Strength work';
    const met = parseFloat(selection?.dataset?.met) || 4;
    const volume = sets * reps * weight;
    const kcalBurn = mins ? computeKcalFromMet(met, mins, getWeightForDate(date)) : 0;
    const notes = document.getElementById('strength-notes').value;

    user.exercises.push({
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
      type: 'strength',
      date,
      time,
      sets,
      reps,
      weight,
      mins,
      volume,
      kcalBurn: +kcalBurn.toFixed(1),
      label: name,
      notes,
      met,
    });
    user.recentExercises = [name, ...user.recentExercises.filter((n) => n !== name)].slice(0, 8);
    saveState();
    document.getElementById('strength-notes').value = '';
    document.getElementById('strength-mins').value = '';
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

  const foods = getAllFoods().filter((food) => {
    if (!foodSearchTerm) return true;
    return (
      food.name.toLowerCase().includes(foodSearchTerm) ||
      (food.category || '').toLowerCase().includes(foodSearchTerm)
    );
  });

  const recent = getUser()
    .recentFoods.map((name) => foods.find((f) => f.name === name) || { name, category: 'Recent', kcal: '' })
    .filter(Boolean);
  if (recent.length) {
    const optgroup = document.createElement('optgroup');
    optgroup.label = 'Recently used';
    recent.forEach((food) => {
      const option = document.createElement('option');
      option.value = food.name;
      option.dataset.name = food.name;
      option.textContent = `${food.name}${food.kcal ? ` (${food.kcal} kcal)` : ''}`;
      optgroup.appendChild(option);
    });
    select.appendChild(optgroup);
  }

  const grouped = foods.reduce((acc, food) => {
    acc[food.category || 'Misc'] = acc[food.category || 'Misc'] || [];
    acc[food.category || 'Misc'].push(food);
    return acc;
  }, {});

  Object.entries(grouped).forEach(([category, list]) => {
    const optgroup = document.createElement('optgroup');
    optgroup.label = category;
    list.forEach((food) => {
      const option = document.createElement('option');
      option.value = food.name;
      option.dataset.name = food.name;
      option.textContent = `${food.name} (${food.kcal} kcal)`;
      optgroup.appendChild(option);
    });
    select.appendChild(optgroup);
  });

  document.getElementById('food-db-count').textContent = `${foods.length} foods ready (edit data.json)`;
}

function getAllFoods() {
  const user = getUser();
  const merged = [...catalogs.foods, ...(user.customFoods || [])];
  const seen = new Set();
  return merged.filter((food) => {
    const key = food.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function populateActivitySelect() {
  const select = document.getElementById('exercise-type');
  select.innerHTML = '';
  const grouped = catalogs.activities.reduce((acc, act) => {
    acc[act.category] = acc[act.category] || [];
    acc[act.category].push(act);
    return acc;
  }, {});
  const recents = getUser().recentExercises
    .map((name) => catalogs.activities.find((a) => a.label === name))
    .filter(Boolean);
  if (recents.length) {
    const optgroup = document.createElement('optgroup');
    optgroup.label = 'Recently used';
    recents.forEach((act) => {
      const option = document.createElement('option');
      option.value = act.met;
      option.textContent = `${act.label} (${act.met} METs)`;
      optgroup.appendChild(option);
    });
    select.appendChild(optgroup);
  }
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

function populateStrengthSelect() {
  const select = document.getElementById('strength-exercise');
  if (!select) return;
  select.innerHTML = '';
  const grouped = catalogs.exercises.reduce((acc, ex) => {
    acc[ex.group] = acc[ex.group] || {};
    acc[ex.group][ex.machine] = acc[ex.group][ex.machine] || [];
    acc[ex.group][ex.machine].push(ex);
    return acc;
  }, {});

  const recents = getUser().recentExercises
    .map((name) => catalogs.exercises.find((e) => e.name === name))
    .filter(Boolean);
  if (recents.length) {
    const optgroup = document.createElement('optgroup');
    optgroup.label = 'Recently used';
    recents.forEach((ex) => {
      const option = document.createElement('option');
      option.value = ex.name;
      option.dataset.name = ex.name;
      option.dataset.met = ex.met || 4;
      option.textContent = `${ex.name} (${ex.machine})`;
      optgroup.appendChild(option);
    });
    select.appendChild(optgroup);
  }

  Object.entries(grouped).forEach(([group, machines]) => {
    const groupOpt = document.createElement('optgroup');
    groupOpt.label = group;
    Object.entries(machines).forEach(([machine, list]) => {
      list.forEach((ex) => {
        const option = document.createElement('option');
        option.value = ex.name;
        option.dataset.name = ex.name;
        option.dataset.met = ex.met || 4;
        option.textContent = `${machine} — ${ex.name}`;
        groupOpt.appendChild(option);
      });
    });
    select.appendChild(groupOpt);
  });
  select.value = select.options[0]?.value;
}

function renderAll() {
  populateFoodSelect();
  renderProfileMetrics();
  renderFoodTable();
  renderExerciseTable();
  renderSummary();
  renderWeightTable();
  renderDetox();
  renderStreaks();
  renderSnapshotMetrics();
  renderDetoxStats();
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
  const cardioTable = document.querySelector('#exercise-table tbody');
  const strengthTable = document.querySelector('#strength-table tbody');
  if (cardioTable) cardioTable.innerHTML = '';
  if (strengthTable) strengthTable.innerHTML = '';
  const date = document.getElementById('exercise-date').value;
  const rows = getUser().exercises
    .filter((f) => f.date === date)
    .sort((a, b) => a.time.localeCompare(b.time));
  let cardioTotal = 0;
  let strengthTotal = 0;
  let volumeTotal = 0;

  rows.forEach((row) => {
    if (row.type === 'strength') {
      strengthTotal += row.kcalBurn || 0;
      volumeTotal += row.volume || row.sets * row.reps * row.weight || 0;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${row.time}</td>
        <td>${row.label || 'Strength'}</td>
        <td>${row.sets || 0}</td>
        <td>${row.reps || 0}</td>
        <td>${row.weight || 0}</td>
        <td>${(row.volume || 0).toFixed(0)}</td>
        <td>${(row.kcalBurn || 0).toFixed(1)}</td>
        <td><button data-id="${row.id}" class="ghost">Remove</button></td>
      `;
      strengthTable.appendChild(tr);
    } else {
      cardioTotal += row.kcalBurn || 0;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${row.time}</td>
        <td>${row.label}</td>
        <td>${row.mins}</td>
        <td>${row.distance || 0}</td>
        <td>${row.incline || 0}</td>
        <td>${(row.kcalBurn || 0).toFixed(1)}</td>
        <td><button data-id="${row.id}" class="ghost">Remove</button></td>
      `;
      cardioTable.appendChild(tr);
    }
  });
  document
    .querySelectorAll('#exercise-table button, #strength-table button')
    .forEach((btn) => btn.addEventListener('click', () => deleteExercise(btn.dataset.id)));
  const burn = document.getElementById('burn-total');
  if (burn) burn.textContent = `${cardioTotal.toFixed(1)} kcal`;
  const cardio = document.getElementById('cardio-total');
  if (cardio) cardio.textContent = `${cardioTotal.toFixed(1)} kcal`;
  const strength = document.getElementById('strength-total');
  if (strength) strength.textContent = `${strengthTotal.toFixed(1)} kcal`;
  const volumeBadge = document.getElementById('volume-total');
  if (volumeBadge) volumeBadge.textContent = `${volumeTotal.toFixed(0)} kg total volume`;
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
  drawDeficitTrend();
}

function renderSnapshotMetrics() {
  const date = document.getElementById('log-date').value;
  const summary = summarizeDate(date);
  const template = `
    <div class="metric"><div>Current weight</div><div class="bold-metric">${summary.currentWeight.toFixed(1)} kg</div></div>
    <div class="metric"><div>Predicted weight</div><div class="bold-metric">${summary.predictedWeight.toFixed(1)} kg</div></div>
    <div class="metric"><div>Weekly change</div><div class="bold-metric">${summary.weeklyChange.toFixed(1)} kg</div></div>
    <div class="metric"><div>Monthly change</div><div class="bold-metric">${summary.monthlyChange.toFixed(1)} kg</div></div>
    <div class="metric"><div>Base burn</div><div class="bold-metric">${summary.base.toFixed(0)} kcal</div></div>
    <div class="metric"><div>Exercise burn</div><div class="bold-metric">${summary.exercise.toFixed(0)} kcal</div></div>
    <div class="metric"><div>Intake</div><div class="bold-metric">${summary.intake.toFixed(0)} kcal</div></div>
    <div class="metric"><div>Net deficit</div><div class="bold-metric">${summary.deficit.toFixed(0)} kcal</div></div>
  `;
  const metrics = document.getElementById('snapshot-metrics');
  const metricsAlt = document.getElementById('snapshot-metrics-alt');
  if (metrics) metrics.innerHTML = template;
  if (metricsAlt) metricsAlt.innerHTML = template;
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
  const list = document.getElementById('detox-items');
  const inputs = document.getElementById('detox-inputs');
  if (list) list.innerHTML = '';
  if (inputs) inputs.innerHTML = '';
  user.detox.items.forEach((item) => {
    if (list) {
      const badge = document.createElement('div');
      badge.className = 'pill';
      badge.textContent = `${item.label} (${item.type})`;
      list.appendChild(badge);
    }
    if (inputs) {
      const wrapper = document.createElement('label');
      wrapper.innerHTML = `${item.label} ${inputForDetox(item)}`;
      inputs.appendChild(wrapper);
    }
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

function renderDetoxStats() {
  const user = getUser();
  const entries = [...user.detox.daily].sort((a, b) => a.date.localeCompare(b.date));
  const keptCount = entries.filter((e) => e.keptPlan).length;
  const percent = entries.length ? Math.round((keptCount / entries.length) * 100) : 0;
  document.getElementById('plan-percent').textContent = entries.length ? `${percent}% kept` : '—';

  const metrics = document.getElementById('detox-metrics');
  const streak = computeStreakInfo();
  const daysSinceSmoking = daysSinceViolation('cigarettes');
  const daysSinceAlcohol = daysSinceViolation('alcohol');
  const daysSincePorn = daysSinceViolation('porn');

  metrics.innerHTML = `
    <div class="metric"><div>Days since smoking</div><div class="bold-metric">${formatDays(daysSinceSmoking)}</div></div>
    <div class="metric"><div>Days since drinking</div><div class="bold-metric">${formatDays(daysSinceAlcohol)}</div></div>
    <div class="metric"><div>Days since pornography</div><div class="bold-metric">${formatDays(daysSincePorn)}</div></div>
    <div class="metric"><div>Current plan streak</div><div class="bold-metric">${streak.days} days</div></div>
  `;

  drawDetoxChart(entries);
}

function daysSinceViolation(itemId) {
  const user = getUser();
  const item = user.detox.items.find((i) => i.id === itemId);
  if (!item) return null;
  const entries = [...user.detox.daily].sort((a, b) => b.date.localeCompare(a.date));
  for (const entry of entries) {
    const value = entry.values[itemId];
    const violated = item.type === 'checkbox' ? value === false : Number(value || 0) > 0;
    if (violated) {
      const diffMs = new Date() - new Date(entry.date);
      return Math.floor(diffMs / (1000 * 60 * 60 * 24));
    }
  }
  return entries.length ? entries.length : null;
}

function formatDays(value) {
  if (value === null) return '—';
  return `${value} days`;
}

function renderStreaks() {
  const streakEl = document.getElementById('streaks');
  const info = computeStreakInfo();
  const template = `
    <strong>Streak:</strong> ${info.days} days (${info.months} months, ${info.hours} hours) on fasting + detox plan
  `;
  if (streakEl) streakEl.innerHTML = template;
  const alt = document.getElementById('streaks-alt');
  if (alt) alt.innerHTML = template;
}

function computeStreakInfo() {
  const user = getUser();
  const now = new Date();
  const streakStart = new Date(user.detox.streakStart);
  const msDiff = Math.max(0, now - streakStart);
  const hours = Math.floor(msDiff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  return { hours, days, months };
}

function summarizeDate(date) {
  const user = getUser();
  const foods = user.foods.filter((f) => f.date === date);
  const exercises = user.exercises.filter((e) => e.date === date);
  const intake = foods.reduce((sum, f) => sum + f.kcal, 0);
  const exercise = exercises.reduce((sum, e) => sum + computeKcalBurn(e, date), 0);
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
    const exercise = exercises.reduce((sum, e) => sum + computeKcalBurn(e, date), 0);
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

function computeKcalFromMet(met, mins, weight) {
  return ((met || 3.5) * 3.5 * (weight || 70)) / 200 * (mins || 0);
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

function computeKcalBurn(entry, date) {
  const weight = getWeightForDate(date || entry.date);
  const met = entry.met || (entry.type === 'strength' ? 4 : 3.5);
  if (entry.kcalBurn) return entry.kcalBurn;
  return computeKcalFromMet(met, entry.mins || 0, weight);
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
    ...user.exercises
      .filter((e) => e.date === date)
      .map((e) => ({ time: e.time, delta: computeKcalBurn(e, date) })),
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

function drawDeficitTrend() {
  const user = getUser();
  const dates = new Set();
  user.foods.forEach((f) => dates.add(f.date));
  user.exercises.forEach((e) => dates.add(e.date));
  user.weights.forEach((w) => dates.add(w.date));
  if (!dates.size) {
    dates.add(new Date().toISOString().slice(0, 10));
  }
  const sorted = [...dates].sort();
  const deficits = sorted.map((d) => summarizeDate(d).deficit);
  const ctx = document.getElementById('calorie-line');
  if (!ctx) return;
  if (deficitTrendChart) deficitTrendChart.destroy();
  deficitTrendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: sorted,
      datasets: [
        {
          label: 'Daily deficit (kcal)',
          data: deficits,
          borderColor: '#0ea5e9',
          backgroundColor: 'rgba(14, 165, 233, 0.12)',
          tension: 0.25,
        },
      ],
    },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: false } } },
  });
}

function drawDetoxChart(entries) {
  const ctx = document.getElementById('detox-chart');
  if (!ctx) return;
  const labels = entries.map((e) => e.date);
  const kept = entries.map((e) => (e.keptPlan ? 1 : 0));
  if (detoxChart) detoxChart.destroy();
  detoxChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Plan kept (1=yes)',
          data: kept,
          borderColor: '#16a34a',
          backgroundColor: 'rgba(22, 163, 74, 0.15)',
          tension: 0.25,
        },
      ],
    },
    options: { scales: { y: { min: 0, max: 1, ticks: { stepSize: 1 } } }, plugins: { legend: { display: false } } },
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
  const message = `${status} · ${hours}h ${mins}m remaining`;
  document.getElementById('fasting-status').textContent = message;
  const countdown = document.getElementById('fasting-countdown');
  if (countdown) countdown.textContent = message;
}
