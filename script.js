// Calendario Motivazionale - FULL (v8)
const STORAGE_KEY = "motivationalCalendarV8_data";
const CONFIG_KEY  = "motivationalCalendarV8_config";

const REASON_LABELS = {
  tempo: "Mancanza di tempo",
  stanchezza: "Stanchezza",
  salute: "Problemi di salute",
  lavoro: "Impegni di lavoro",
  viaggio: "Viaggio / spostamenti",
  altro: "Altro"
};

function loadJSON(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch { return fallback; }
}
function saveJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function makeIsoLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function parseIsoLocal(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function stripTime(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}
function daysInMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}
function daysInYear(date) {
  return isLeapYear(date.getFullYear()) ? 366 : 365;
}
function startOfWeek(date) {
  const d = stripTime(date);
  const day = d.getDay(); // 0=dom
  const diffToMonday = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diffToMonday);
  return d;
}
function endOfWeek(date) {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return end;
}
function startOfMonth(date) { return new Date(date.getFullYear(), date.getMonth(), 1); }
function endOfMonth(date) { return new Date(date.getFullYear(), date.getMonth(), daysInMonth(date)); }
function startOfYear(date) { return new Date(date.getFullYear(), 0, 1); }
function endOfYear(date) { return new Date(date.getFullYear(), 11, 31); }
function formatItalianWeekday(date) {
  return new Intl.DateTimeFormat("it-IT", { weekday: "long" }).format(date);
}
function isDateBetween(d, start, end) {
  const t = d.getTime();
  return t >= start.getTime() && t <= end.getTime();
}
function parseNum(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function playSuccessSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.setValueAtTime(0.14, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
    osc.stop(ctx.currentTime + 0.22);
  } catch {}
}

// ====== State ======
let dataStore = loadJSON(STORAGE_KEY, {});
let config = loadJSON(CONFIG_KEY, null);
let currentDate = stripTime(new Date());
let currentStatsMode = "week";

// ====== Default config ======
function defaultConfig() {
  return {
    configured: false,
    welcomeImage: "",
    welcomeTitle: "Calendario Motivazionale",
    welcomeText: "Imposta i tuoi obiettivi e traccia i progressi.",
    workoutsPerWeek: 3,
    restLabel: "Rest",
    workoutTypes: ["Leg", "Pull", "Push"],
    body: {
      heightCm: "",
      startWeight: "",
      goalWeight: "",
      fatPercent: "",
      leanMass: "",
      waterPercent: "",
      bmr: "",
      visceralFat: "",
      impedance: "",
      notes: ""
    }
  };
}
function ensureConfig() {
  if (!config) config = defaultConfig();
  if (!Array.isArray(config.workoutTypes) || config.workoutTypes.length === 0) config.workoutTypes = ["Allenamento"];
  if (!config.restLabel) config.restLabel = "Rest";
  if (!config.workoutsPerWeek || config.workoutsPerWeek < 1) config.workoutsPerWeek = 3;
  if (!config.body) config.body = defaultConfig().body;
}

// ====== Workout helpers ======
function getWorkoutOptions() {
  return [config.restLabel, ...config.workoutTypes];
}
function isWorkoutDone(selected) {
  return selected && selected !== config.restLabel;
}

// ====== Per-day data ======
function getDayData(date) {
  const iso = makeIsoLocal(date);
  if (!dataStore[iso]) {
    dataStore[iso] = {
      cardio: false,
      cardioReason: "",
      workout: config.restLabel,
      workoutReason: "",
      diet: false,
      dietReason: "",
      weight: null,
      notes: ""
    };
  }
  return dataStore[iso];
}
function isDayComplete(day) {
  return !!(day.cardio && isWorkoutDone(day.workout) && day.diet);
}

// ====== DOM refs ======
const screenHome  = document.getElementById("screen-home");
const screenSetup = document.getElementById("screen-setup");
const screenMain  = document.getElementById("screen-main");

const btnOpenToday    = document.getElementById("btn-open-today");
const btnOpenCalendar = document.getElementById("btn-open-calendar");
const btnOpenSetup    = document.getElementById("btn-open-setup");

const btnSetupBack = document.getElementById("btn-setup-back");
const btnSaveSetup = document.getElementById("btn-save-setup");
const btnResetAll  = document.getElementById("btn-reset-all");

const btnMainHome  = document.getElementById("btn-main-home");
const btnMainSetup = document.getElementById("btn-main-setup");

const welcomeImageInput = document.getElementById("welcome-image-input");
const welcomeTitleInput = document.getElementById("welcome-title-input");
const welcomeTextInput  = document.getElementById("welcome-text-input");

const heroPreviewBg = document.getElementById("hero-preview-bg");
const heroPreviewHeadline = document.getElementById("hero-preview-headline");
const heroPreviewDesc = document.getElementById("hero-preview-desc");

const homeHeroBg = document.getElementById("home-hero-bg");
const homeHeadline = document.getElementById("home-headline");
const homeDesc = document.getElementById("home-desc");

const workoutsPerWeekInput = document.getElementById("workouts-per-week");
const restLabelInput = document.getElementById("rest-label");
const workoutTypesTextarea = document.getElementById("workout-types-textarea");

const heightCmInput = document.getElementById("height-cm");
const bmiOutput = document.getElementById("bmi-output");
const startWeightInputSetup = document.getElementById("start-weight-input");
const goalWeightInputSetup  = document.getElementById("goal-weight-input");
const weightProgressPercentSetup = document.getElementById("weight-progress-percent-setup");
const weightProgressBarSetup = document.getElementById("weight-progress-bar-setup");

const fatPercentInput = document.getElementById("fat-percent");
const leanMassInput   = document.getElementById("lean-mass");
const waterPercentInput = document.getElementById("water-percent");
const bmrInput = document.getElementById("bmr");
const visceralFatInput = document.getElementById("visceral-fat");
const impedanceInput = document.getElementById("impedance");
const bodyNotesInput = document.getElementById("body-notes");

// Main day controls
const prevDayBtn = document.getElementById("prev-day-btn");
const nextDayBtn = document.getElementById("next-day-btn");
const todayBtn   = document.getElementById("today-btn");
const currentDateInput = document.getElementById("current-date-input");
const currentDayLabel  = document.getElementById("current-day-label");

const cardioCheckbox = document.getElementById("cardio-checkbox");
const cardioReasonSelect = document.getElementById("cardio-reason-select");
const workoutSelect = document.getElementById("workout-select");
const workoutReasonSelect = document.getElementById("workout-reason-select");
const dietCheckbox = document.getElementById("diet-checkbox");
const dietReasonSelect = document.getElementById("diet-reason-select");

const weightInput = document.getElementById("weight-input");
const weightTargetSummary = document.getElementById("weight-target-summary");
const weightProgressPercentMain = document.getElementById("weight-progress-percent-main");
const weightProgressBarMain = document.getElementById("weight-progress-bar-main");

const notesTextarea = document.getElementById("notes-textarea");
const dayCompleteBadge = document.getElementById("day-complete-badge");

// Stats
const statsTabs = document.querySelectorAll(".stats-tab");
const statsModeLabel = document.getElementById("stats-mode-label");
const rangeStartInput = document.getElementById("range-start");
const rangeEndInput = document.getElementById("range-end");
const rangeCalcBtn = document.getElementById("range-calc-btn");

// ====== Screen switching ======
function showScreen(which) {
  [screenHome, screenSetup, screenMain].forEach(s => s.classList.add("hidden"));
  which.classList.remove("hidden");
}

// ====== Setup render ======
function renderHeroPreview() {
  heroPreviewHeadline.textContent = config.welcomeTitle || "—";
  heroPreviewDesc.textContent = config.welcomeText || "—";
  heroPreviewBg.style.backgroundImage = config.welcomeImage ? `url(${config.welcomeImage})` : "";
}
function renderHome() {
  homeHeadline.textContent = config.welcomeTitle || "Calendario Motivazionale";
  homeDesc.textContent = config.welcomeText || "Imposta i tuoi obiettivi e traccia i progressi.";
  homeHeroBg.style.backgroundImage = config.welcomeImage ? `url(${config.welcomeImage})` : "";
}

function renderWorkoutSelect() {
  workoutSelect.innerHTML = "";
  getWorkoutOptions().forEach(opt => {
    const o = document.createElement("option");
    o.value = opt;
    o.textContent = opt;
    workoutSelect.appendChild(o);
  });
}

// ====== Weight helpers ======
function computeWeightPercent(currentWeight) {
  const start = parseNum(config.body.startWeight);
  const goal  = parseNum(config.body.goalWeight);
  const w     = parseNum(currentWeight);
  if (start == null || goal == null || w == null) return 0;

  let percent = 0;
  if (goal < start) {
    const total = start - goal;
    const done  = start - w;
    percent = total > 0 ? Math.round((done / total) * 100) : 0;
  } else if (goal > start) {
    const total = goal - start;
    const done  = w - start;
    percent = total > 0 ? Math.round((done / total) * 100) : 0;
  } else {
    percent = (w === goal) ? 100 : 0;
  }
  return Math.max(0, Math.min(100, percent));
}

function updateBMI() {
  const hcm = parseNum(config.body.heightCm);
  const w = parseNum(config.body.startWeight);
  if (!hcm || !w) { bmiOutput.value = ""; return; }
  const hm = hcm / 100;
  const bmi = w / (hm * hm);
  bmiOutput.value = Number.isFinite(bmi) ? bmi.toFixed(1) : "";
}

function syncWeightProgressUI() {
  // setup preview uses "startWeight"
  const setupW = parseNum(config.body.startWeight);
  const setupPct = computeWeightPercent(setupW);
  weightProgressPercentSetup.textContent = `${setupPct}%`;
  weightProgressBarSetup.style.width = `${setupPct}%`;

  // main uses today's weight if set, else startWeight
  const day = getDayData(currentDate);
  const w = (day.weight != null) ? day.weight : config.body.startWeight;
  const pct = computeWeightPercent(w);
  weightProgressPercentMain.textContent = `${pct}%`;
  weightProgressBarMain.style.width = `${pct}%`;

  const sw = parseNum(config.body.startWeight);
  const gw = parseNum(config.body.goalWeight);
  weightTargetSummary.textContent = (sw!=null && gw!=null) ? `${sw} → ${gw} kg` : "—";
}

// ====== Day load/save ======
function loadDayToUI(date) {
  currentDate = stripTime(date);
  const day = getDayData(currentDate);

  currentDateInput.value = makeIsoLocal(currentDate);
  currentDayLabel.textContent = formatItalianWeekday(currentDate);

  cardioCheckbox.checked = !!day.cardio;
  cardioReasonSelect.value = day.cardioReason || "";

  workoutSelect.value = day.workout || config.restLabel;
  workoutReasonSelect.value = day.workoutReason || "";

  dietCheckbox.checked = !!day.diet;
  dietReasonSelect.value = day.dietReason || "";

  weightInput.value = (day.weight != null && !Number.isNaN(day.weight)) ? String(day.weight) : "";
  notesTextarea.value = day.notes || "";

  if (cardioCheckbox.checked) cardioReasonSelect.value = "";
  if (isWorkoutDone(workoutSelect.value)) workoutReasonSelect.value = "";
  if (dietCheckbox.checked) dietReasonSelect.value = "";

  dayCompleteBadge.classList.toggle("hidden", !isDayComplete(day));
  syncWeightProgressUI();
}

function saveCurrentDay(playSound) {
  const iso = makeIsoLocal(currentDate);
  const prev = getDayData(currentDate);
  const prevComplete = isDayComplete(prev);

  const weightVal = parseNum(weightInput.value);

  const next = {
    cardio: !!cardioCheckbox.checked,
    cardioReason: cardioCheckbox.checked ? "" : (cardioReasonSelect.value || ""),
    workout: workoutSelect.value || config.restLabel,
    workoutReason: isWorkoutDone(workoutSelect.value) ? "" : (workoutReasonSelect.value || ""),
    diet: !!dietCheckbox.checked,
    dietReason: dietCheckbox.checked ? "" : (dietReasonSelect.value || ""),
    weight: weightVal,
    notes: notesTextarea.value || ""
  };

  dataStore[iso] = next;
  saveJSON(STORAGE_KEY, dataStore);

  dayCompleteBadge.classList.toggle("hidden", !isDayComplete(next));
  updateAllStats();
  updateCustomRangeStats();
  syncWeightProgressUI();

  const nowComplete = isDayComplete(next);
  if (playSound && !prevComplete && nowComplete) playSuccessSound();
}

// ====== Stats ======
function computeStatsForRange(start, end) {
  let cardioDone = 0, gymDone = 0, dietDone = 0;
  let cardioMiss = 0, gymMiss = 0, dietMiss = 0;
  const cardioReasons = {}, gymReasons = {}, dietReasons = {};

  Object.keys(dataStore).forEach(key => {
    const d = stripTime(parseIsoLocal(key));
    if (isNaN(d)) return;
    if (!isDateBetween(d, start, end)) return;

    const day = dataStore[key] || {};
    const workoutDone = isWorkoutDone(day.workout);

    if (day.cardio) cardioDone++;
    else if (day.cardioReason) {
      cardioMiss++;
      cardioReasons[day.cardioReason] = (cardioReasons[day.cardioReason] || 0) + 1;
    }

    if (workoutDone) gymDone++;
    else if (day.workoutReason) {
      gymMiss++;
      gymReasons[day.workoutReason] = (gymReasons[day.workoutReason] || 0) + 1;
    }

    if (day.diet) dietDone++;
    else if (day.dietReason) {
      dietMiss++;
      dietReasons[day.dietReason] = (dietReasons[day.dietReason] || 0) + 1;
    }
  });

  return { cardioDone, gymDone, dietDone, cardioMiss, gymMiss, dietMiss, cardioReasons, gymReasons, dietReasons };
}

function setText(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }
function setProgress(id, percent) {
  const el = document.getElementById(id);
  if (el) el.style.width = `${Math.max(0, Math.min(100, percent))}%`;
}

function updateStatsMode(mode) {
  currentStatsMode = mode;

  const today = stripTime(new Date());
  let start, end, cardioTarget, dietTarget, gymTarget, labelText;

  const weekGym = Number(config.workoutsPerWeek || 3);
  const monthGym = weekGym * 4;
  const yearGym = weekGym * 52;

  if (mode === "week") {
    start = startOfWeek(today);
    end = endOfWeek(today);
    cardioTarget = 7;
    dietTarget = 7;
    gymTarget = weekGym;
    labelText = "Settimana corrente";
  } else if (mode === "month") {
    start = startOfMonth(today);
    end = endOfMonth(today);
    const dim = daysInMonth(today);
    cardioTarget = dim;
    dietTarget = dim;
    gymTarget = monthGym;
    labelText = "Mese corrente";
  } else {
    start = startOfYear(today);
    end = endOfYear(today);
    const diy = daysInYear(today);
    cardioTarget = diy;
    dietTarget = diy;
    gymTarget = yearGym;
    labelText = "Anno corrente";
  }

  statsModeLabel.textContent = labelText;

  const stats = computeStatsForRange(start, end);

  setText("stats-cardio-value", `${stats.cardioDone} / ${cardioTarget}`);
  setText("stats-gym-value", `${stats.gymDone} / ${gymTarget}`);
  setText("stats-diet-value", `${stats.dietDone} / ${dietTarget}`);

  const cardioPct = cardioTarget ? Math.round((stats.cardioDone / cardioTarget) * 100) : 0;
  const gymPct = gymTarget ? Math.round((stats.gymDone / gymTarget) * 100) : 0;
  const dietPct = dietTarget ? Math.round((stats.dietDone / dietTarget) * 100) : 0;

  setText("stats-cardio-percent", `${Math.max(0, Math.min(100, cardioPct))}%`);
  setText("stats-gym-percent", `${Math.max(0, Math.min(100, gymPct))}%`);
  setText("stats-diet-percent", `${Math.max(0, Math.min(100, dietPct))}%`);

  setProgress("stats-cardio-progress", cardioPct);
  setProgress("stats-gym-progress", gymPct);
  setProgress("stats-diet-progress", dietPct);

  setText("stats-cardio-missed-total", String(stats.cardioMiss));
  setText("stats-gym-missed-total", String(stats.gymMiss));
  setText("stats-diet-missed-total", String(stats.dietMiss));

  const reasonsDiv = document.getElementById("stats-reasons-list");
  if (reasonsDiv) {
    reasonsDiv.innerHTML = "";
    const append = (cat, map) => {
      Object.keys(map).forEach(k => {
        const p = document.createElement("p");
        const label = REASON_LABELS[k] || k;
        p.textContent = `${cat} – ${label}: ${map[k]}`;
        reasonsDiv.appendChild(p);
      });
    };
    append("Cardio", stats.cardioReasons);
    append("Allenamenti", stats.gymReasons);
    append("Dieta", stats.dietReasons);

    if (!reasonsDiv.innerHTML) {
      const p = document.createElement("p");
      p.textContent = "Nessun motivo registrato nell’intervallo selezionato.";
      reasonsDiv.appendChild(p);
    }
  }

  statsTabs.forEach(btn => btn.classList.toggle("active", btn.dataset.mode === mode));
}

function updateAllStats() { updateStatsMode(currentStatsMode); }

function updateCustomRangeStats() {
  const startVal = rangeStartInput.value;
  const endVal = rangeEndInput.value;

  if (!startVal || !endVal) {
    setText("range-cardio-count", "0");
    setText("range-gym-count", "0");
    setText("range-diet-count", "0");
    return;
  }
  const start = stripTime(parseIsoLocal(startVal));
  const end = stripTime(parseIsoLocal(endVal));
  if (isNaN(start) || isNaN(end) || start > end) {
    setText("range-cardio-count", "0");
    setText("range-gym-count", "0");
    setText("range-diet-count", "0");
    return;
  }

  const stats = computeStatsForRange(start, end);
  setText("range-cardio-count", String(stats.cardioDone));
  setText("range-gym-count", String(stats.gymDone));
  setText("range-diet-count", String(stats.dietDone));
}

// ====== Notifications (best-effort) ======
function maybeRequestNotificationPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") Notification.requestPermission().catch(() => {});
}
function scheduleDailyReminder() {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  let lastNotified = null;
  setInterval(() => {
    const now = new Date();
    const todayKey = makeIsoLocal(now);
    if (now.getHours() === 22 && now.getMinutes() >= 0 && now.getMinutes() <= 5) {
      if (lastNotified !== todayKey) {
        new Notification("Compila il calendario", { body: "Segna cardio, allenamento, dieta e peso per oggi." });
        lastNotified = todayKey;
      }
    }
  }, 60000);
}

// ====== Setup load/save ======
function setupFromUI() {
  config.welcomeTitle = (welcomeTitleInput.value || "").trim() || "Calendario Motivazionale";
  config.welcomeText  = (welcomeTextInput.value || "").trim() || "Imposta i tuoi obiettivi e traccia i progressi.";
  config.workoutsPerWeek = Math.max(1, Math.min(14, Number(workoutsPerWeekInput.value || 3)));
  config.restLabel = (restLabelInput.value || "").trim() || "Rest";

  const types = (workoutTypesTextarea.value || "")
    .split("\n").map(v => v.trim()).filter(Boolean);

  config.workoutTypes = types.length ? types : ["Allenamento"];

  config.body.heightCm = (heightCmInput.value || "").trim();
  config.body.startWeight = (startWeightInputSetup.value || "").trim();
  config.body.goalWeight = (goalWeightInputSetup.value || "").trim();

  config.body.fatPercent = (fatPercentInput?.value || "").trim();
  config.body.leanMass = (leanMassInput?.value || "").trim();
  config.body.waterPercent = (waterPercentInput?.value || "").trim();
  config.body.bmr = (bmrInput?.value || "").trim();
  config.body.visceralFat = (visceralFatInput?.value || "").trim();
  config.body.impedance = (impedanceInput?.value || "").trim();
  config.body.notes = (bodyNotesInput?.value || "").trim();

  config.configured = true;
}

function setupToUI() {
  welcomeTitleInput.value = config.welcomeTitle || "";
  welcomeTextInput.value  = config.welcomeText || "";
  workoutsPerWeekInput.value = String(config.workoutsPerWeek || 3);
  restLabelInput.value = config.restLabel || "Rest";
  workoutTypesTextarea.value = (config.workoutTypes || []).join("\n");

  heightCmInput.value = config.body.heightCm || "";
  startWeightInputSetup.value = config.body.startWeight || "";
  goalWeightInputSetup.value  = config.body.goalWeight || "";

  if (fatPercentInput) fatPercentInput.value = config.body.fatPercent || "";
  if (leanMassInput) leanMassInput.value = config.body.leanMass || "";
  if (waterPercentInput) waterPercentInput.value = config.body.waterPercent || "";
  if (bmrInput) bmrInput.value = config.body.bmr || "";
  if (visceralFatInput) visceralFatInput.value = config.body.visceralFat || "";
  if (impedanceInput) impedanceInput.value = config.body.impedance || "";
  if (bodyNotesInput) bodyNotesInput.value = config.body.notes || "";

  renderHeroPreview();
  renderHome();
  updateBMI();
  renderWorkoutSelect();
  syncWeightProgressUI();
}

welcomeImageInput.addEventListener("change", (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    config.welcomeImage = String(reader.result || "");
    saveJSON(CONFIG_KEY, config);
    renderHeroPreview();
    renderHome();
  };
  reader.readAsDataURL(file);
});

[welcomeTitleInput, welcomeTextInput, workoutsPerWeekInput, restLabelInput, workoutTypesTextarea,
 heightCmInput, startWeightInputSetup, goalWeightInputSetup,
 fatPercentInput, leanMassInput, waterPercentInput, bmrInput, visceralFatInput, impedanceInput, bodyNotesInput
].filter(Boolean).forEach(el => {
  el.addEventListener("input", () => {
    ensureConfig();
    setupFromUI();
    saveJSON(CONFIG_KEY, config);
    renderHeroPreview();
    renderHome();
    updateBMI();
    renderWorkoutSelect();
    syncWeightProgressUI();
  });
});

// ====== Navigation buttons ======
btnOpenSetup.addEventListener("click", () => {
  setupToUI();
  showScreen(screenSetup);
});
btnSetupBack.addEventListener("click", () => {
  showScreen(screenHome);
});
btnMainSetup.addEventListener("click", () => {
  setupToUI();
  showScreen(screenSetup);
});
btnMainHome.addEventListener("click", () => {
  showScreen(screenHome);
});

btnOpenCalendar.addEventListener("click", () => {
  showScreen(btnOpenToday ? screenMain : screenMain);
  renderWorkoutSelect();
  loadDayToUI(currentDate);
  updateAllStats();
  updateCustomRangeStats();
});
btnOpenToday.addEventListener("click", () => {
  currentDate = stripTime(new Date());
  showScreen(screenMain);
  renderWorkoutSelect();
  loadDayToUI(currentDate);
  updateAllStats();
  updateCustomRangeStats();
});

btnSaveSetup.addEventListener("click", () => {
  ensureConfig();
  setupFromUI();
  saveJSON(CONFIG_KEY, config);
  renderWorkoutSelect();
  // ensure current day workout is valid
  const day = getDayData(currentDate);
  const options = getWorkoutOptions();
  if (!options.includes(day.workout)) {
    day.workout = config.restLabel;
    saveJSON(STORAGE_KEY, dataStore);
  }
  showScreen(screenHome);
});

btnResetAll.addEventListener("click", () => {
  if (!confirm("Vuoi cancellare TUTTI i dati e le impostazioni?")) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(CONFIG_KEY);
  dataStore = {};
  config = defaultConfig();
  ensureConfig();
  setupToUI();
  showScreen(screenSetup);
});

// ====== Main events ======
cardioCheckbox.addEventListener("change", () => {
  if (cardioCheckbox.checked) cardioReasonSelect.value = "";
  saveCurrentDay(true);
});
cardioReasonSelect.addEventListener("change", () => saveCurrentDay(false));

workoutSelect.addEventListener("change", () => {
  if (isWorkoutDone(workoutSelect.value)) workoutReasonSelect.value = "";
  saveCurrentDay(true);
});
workoutReasonSelect.addEventListener("change", () => saveCurrentDay(false));

dietCheckbox.addEventListener("change", () => {
  if (dietCheckbox.checked) dietReasonSelect.value = "";
  saveCurrentDay(true);
});
dietReasonSelect.addEventListener("change", () => saveCurrentDay(false));

weightInput.addEventListener("input", () => saveCurrentDay(false));
notesTextarea.addEventListener("input", () => saveCurrentDay(false));

prevDayBtn.addEventListener("click", () => { currentDate.setDate(currentDate.getDate()-1); loadDayToUI(currentDate); });
nextDayBtn.addEventListener("click", () => { currentDate.setDate(currentDate.getDate()+1); loadDayToUI(currentDate); });
todayBtn.addEventListener("click", () => { currentDate = stripTime(new Date()); loadDayToUI(currentDate); });
currentDateInput.addEventListener("change", () => {
  if (!currentDateInput.value) return;
  const d = parseIsoLocal(currentDateInput.value);
  if (isNaN(d)) return;
  loadDayToUI(d);
});

// stats tabs and range
statsTabs.forEach(btn => btn.addEventListener("click", () => updateStatsMode(btn.dataset.mode)));
rangeCalcBtn.addEventListener("click", updateCustomRangeStats);

// ====== Init ======
(function init(){
  ensureConfig();

  // default range: current week
  const today = stripTime(new Date());
  rangeStartInput.value = makeIsoLocal(startOfWeek(today));
  rangeEndInput.value   = makeIsoLocal(endOfWeek(today));

  // load config
  const stored = loadJSON(CONFIG_KEY, null);
  config = stored || defaultConfig();
  ensureConfig();

  // render initial
  renderHeroPreview();
  renderHome();
  renderWorkoutSelect();
  loadDayToUI(currentDate);
  updateAllStats();
  updateCustomRangeStats();
  syncWeightProgressUI();
  updateBMI();

  // first run -> setup screen
  if (!config.configured) {
    setupToUI();
    showScreen(screenSetup);
  } else {
    showScreen(screenHome);
  }

  maybeRequestNotificationPermission();
  scheduleDailyReminder();
})();