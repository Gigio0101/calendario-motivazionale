// Calendario Motivazionale (PWA) - Build stabile
// - Navigazione date senza limiti
// - Cardio / Allenamento / Dieta + motivazioni
// - Peso giornaliero + obiettivo (barra progresso)
// - Statistiche: settimanali / mensili / annuali
// - Intervallo personalizzato apribile via pulsante
// Nota: notifiche su iOS via browser hanno limiti (spesso solo con app aperta).

const STORAGE_KEY = "motivationalCalendarV7";

const REASON_LABELS = {
  tempo: "Mancanza di tempo",
  stanchezza: "Stanchezza",
  salute: "Problemi di salute",
  lavoro: "Impegni di lavoro",
  viaggio: "Viaggio / spostamenti",
  altro: "Altro"
};

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
function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error("Errore caricamento dati", e);
    return {};
  }
}
function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Errore salvataggio dati", e);
  }
}

function isGymWorkout(type) {
  return type === "Leg" || type === "Pull" || type === "Push";
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

// =========================
// Audio feedback
// =========================
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
  } catch (e) {}
}

// =========================
// Global state
// =========================
let savedData = loadData();
let currentDate = stripTime(new Date());
let currentStatsMode = "week"; // week | month | year

// Targets
const WEEKLY_CARDIO_TARGET = 7;
const WEEKLY_GYM_TARGET = 3;
const WEEKLY_DIET_TARGET = 7;

const MONTHLY_WEEKS = 4;
const YEARLY_WEEKS = 52;

// =========================
// Weight meta
// =========================
function getStartWeight() { return parseNum(savedData._startWeight); }
function getGoalWeight() { return parseNum(savedData._goalWeight); }
function setStartWeight(v) {
  const n = parseNum(v);
  if (n == null) delete savedData._startWeight;
  else savedData._startWeight = n;
  saveData(savedData);
}
function setGoalWeight(v) {
  const n = parseNum(v);
  if (n == null) delete savedData._goalWeight;
  else savedData._goalWeight = n;
  saveData(savedData);
}

// =========================
// Day data
// =========================
function getDayData(date) {
  const iso = makeIsoLocal(date);
  if (!savedData[iso]) {
    savedData[iso] = {
      cardio: false,
      cardioReason: "",
      workout: "Rest",
      workoutReason: "",
      diet: false,
      dietReason: "",
      weight: null,
      notes: ""
    };
  } else {
    const d = savedData[iso];
    d.cardio = !!d.cardio;
    d.cardioReason = typeof d.cardioReason === "string" ? d.cardioReason : "";
    d.workout = d.workout || "Rest";
    d.workoutReason = typeof d.workoutReason === "string" ? d.workoutReason : "";
    d.diet = !!d.diet;
    d.dietReason = typeof d.dietReason === "string" ? d.dietReason : "";
    d.weight = (d.weight === null || d.weight === "" || d.weight === undefined) ? null : parseNum(d.weight);
    d.notes = typeof d.notes === "string" ? d.notes : (d.notes || "");
  }
  return savedData[iso];
}
function isDayComplete(dayData) {
  return !!(dayData && dayData.cardio && isGymWorkout(dayData.workout) && dayData.diet);
}

// =========================
// DOM refs
// =========================
const cardioCheckbox = document.getElementById("cardio-checkbox");
const cardioReasonSelect = document.getElementById("cardio-reason-select");
const workoutSelect = document.getElementById("workout-select");
const workoutReasonSelect = document.getElementById("workout-reason-select");
const dietCheckbox = document.getElementById("diet-checkbox");
const dietReasonSelect = document.getElementById("diet-reason-select");
const weightInput = document.getElementById("weight-input");
const notesTextarea = document.getElementById("notes-textarea");

const currentDateInput = document.getElementById("current-date-input");
const currentDayLabel = document.getElementById("current-day-label");
const prevDayBtn = document.getElementById("prev-day-btn");
const nextDayBtn = document.getElementById("next-day-btn");
const todayBtn = document.getElementById("today-btn");
const dayCompleteBadge = document.getElementById("day-complete-badge");

const startWeightInput = document.getElementById("start-weight-input");
const goalWeightInput = document.getElementById("goal-weight-input");
const weightProgressPercent = document.getElementById("weight-progress-percent");
const weightProgressBar = document.getElementById("weight-progress-bar");
const weightProgressPercent2 = document.getElementById("weight-progress-percent-secondary");
const weightProgressBar2 = document.getElementById("weight-progress-bar-secondary");

const statsTabs = document.querySelectorAll(".stats-tab");
const statsModeLabel = document.getElementById("stats-mode-label");

const rangeCard = document.getElementById("range-card");
const openRangeBtn = document.getElementById("open-range-btn");
const closeRangeBtn = document.getElementById("close-range-btn");
const rangeStartInput = document.getElementById("range-start");
const rangeEndInput = document.getElementById("range-end");
const rangeCalcBtn = document.getElementById("range-calc-btn");

// =========================
// Weight UI
// =========================
function computeWeightPercent(w) {
  const start = getStartWeight();
  const goal = getGoalWeight();
  const ww = parseNum(w);
  if (start == null || goal == null || ww == null) return 0;

  let percent = 0;
  if (goal < start) {
    const total = start - goal;
    const done = start - ww;
    percent = total > 0 ? Math.round((done / total) * 100) : 0;
  } else if (goal > start) {
    const total = goal - start;
    const done = ww - start;
    percent = total > 0 ? Math.round((done / total) * 100) : 0;
  } else {
    percent = (ww === goal) ? 100 : 0;
  }
  return Math.max(0, Math.min(100, percent));
}

function updateWeightUI() {
  const start = getStartWeight();
  const goal = getGoalWeight();
  const day = getDayData(currentDate);
  const w = day.weight;

  startWeightInput.value = start != null ? String(start) : "";
  goalWeightInput.value = goal != null ? String(goal) : "";

  const pctMain = computeWeightPercent(w);
  weightProgressPercent.textContent = `${pctMain}%`;
  weightProgressBar.style.width = `${pctMain}%`;

  // secondary progress uses today's weight if present, else start
  const pct2 = computeWeightPercent(w != null ? w : start);
  weightProgressPercent2.textContent = `${pct2}%`;
  weightProgressBar2.style.width = `${pct2}%`;
}

// =========================
// Load/save day
// =========================
function loadDayToUI(date) {
  currentDate = stripTime(date);
  const data = getDayData(currentDate);

  const iso = makeIsoLocal(currentDate);
  currentDateInput.value = iso;
  currentDayLabel.textContent = formatItalianWeekday(currentDate);

  cardioCheckbox.checked = !!data.cardio;
  cardioReasonSelect.value = data.cardioReason || "";

  workoutSelect.value = data.workout || "Rest";
  workoutReasonSelect.value = data.workoutReason || "";

  dietCheckbox.checked = !!data.diet;
  dietReasonSelect.value = data.dietReason || "";

  weightInput.value = data.weight != null ? String(data.weight) : "";
  notesTextarea.value = data.notes || "";

  if (cardioCheckbox.checked) cardioReasonSelect.value = "";
  if (isGymWorkout(workoutSelect.value)) workoutReasonSelect.value = "";
  if (dietCheckbox.checked) dietReasonSelect.value = "";

  updateDayCompleteBadge();
  updateWeightUI();
}

function saveCurrentDay(playSound) {
  const iso = makeIsoLocal(currentDate);
  const prev = getDayData(currentDate);
  const prevComplete = isDayComplete(prev);

  const next = {
    cardio: !!cardioCheckbox.checked,
    cardioReason: cardioCheckbox.checked ? "" : (cardioReasonSelect.value || ""),
    workout: workoutSelect.value || "Rest",
    workoutReason: isGymWorkout(workoutSelect.value) ? "" : (workoutReasonSelect.value || ""),
    diet: !!dietCheckbox.checked,
    dietReason: dietCheckbox.checked ? "" : (dietReasonSelect.value || ""),
    weight: parseNum(weightInput.value),
    notes: notesTextarea.value || ""
  };

  savedData[iso] = next;
  saveData(savedData);

  updateDayCompleteBadge();
  updateAllStats();
  updateCustomRangeStats();
  updateWeightUI();

  const nowComplete = isDayComplete(next);
  if (playSound && !prevComplete && nowComplete) playSuccessSound();
}

function updateDayCompleteBadge() {
  const data = getDayData(currentDate);
  dayCompleteBadge.style.display = isDayComplete(data) ? "flex" : "none";
}

// =========================
// Stats
// =========================
function computeStatsForRange(start, end) {
  let cardioDone = 0, gymDone = 0, dietDone = 0;
  let cardioMiss = 0, gymMiss = 0, dietMiss = 0;

  const cardioReasons = {};
  const gymReasons = {};
  const dietReasons = {};

  Object.keys(savedData).forEach(key => {
    if (key.startsWith("_")) return;
    const d = stripTime(parseIsoLocal(key));
    if (isNaN(d)) return;
    if (!isDateBetween(d, start, end)) return;

    const data = getDayData(d);

    if (data.cardio) cardioDone++;
    else if (data.cardioReason) {
      cardioMiss++;
      cardioReasons[data.cardioReason] = (cardioReasons[data.cardioReason] || 0) + 1;
    }

    if (isGymWorkout(data.workout)) gymDone++;
    else if (data.workoutReason) {
      gymMiss++;
      gymReasons[data.workoutReason] = (gymReasons[data.workoutReason] || 0) + 1;
    }

    if (data.diet) dietDone++;
    else if (data.dietReason) {
      dietMiss++;
      dietReasons[data.dietReason] = (dietReasons[data.dietReason] || 0) + 1;
    }
  });

  return { cardioDone, gymDone, dietDone, cardioMiss, gymMiss, dietMiss, cardioReasons, gymReasons, dietReasons };
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
function setProgress(id, percent) {
  const el = document.getElementById(id);
  if (el) el.style.width = `${Math.max(0, Math.min(100, percent))}%`;
}

function updateStatsMode(mode) {
  currentStatsMode = mode;

  const today = stripTime(new Date());
  let start, end, cardioTarget, gymTarget, dietTarget, labelText;

  if (mode === "week") {
    start = startOfWeek(today);
    end = endOfWeek(today);
    cardioTarget = WEEKLY_CARDIO_TARGET;
    gymTarget = WEEKLY_GYM_TARGET;
    dietTarget = WEEKLY_DIET_TARGET;
    labelText = "Settimana corrente";
  } else if (mode === "month") {
    start = startOfMonth(today);
    end = endOfMonth(today);
    const dim = daysInMonth(today);
    cardioTarget = dim;
    dietTarget = dim;
    gymTarget = WEEKLY_GYM_TARGET * MONTHLY_WEEKS;
    labelText = "Mese corrente";
  } else {
    start = startOfYear(today);
    end = endOfYear(today);
    const diy = daysInYear(today);
    cardioTarget = diy;
    dietTarget = diy;
    gymTarget = WEEKLY_GYM_TARGET * YEARLY_WEEKS;
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

    function append(category, map) {
      Object.keys(map).forEach(k => {
        const p = document.createElement("p");
        const label = REASON_LABELS[k] || k;
        p.textContent = `${category} – ${label}: ${map[k]}`;
        reasonsDiv.appendChild(p);
      });
    }

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

function updateAllStats() {
  updateStatsMode(currentStatsMode);
}

// =========================
// Custom range
// =========================
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

// =========================
// Notifications (best-effort)
// =========================
function maybeRequestNotificationPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
}
function scheduleDailyReminder() {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  let lastNotified = null;
  setInterval(() => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const todayKey = makeIsoLocal(now);

    if (hours === 22 && minutes >= 0 && minutes <= 5) {
      if (lastNotified !== todayKey) {
        new Notification("Compila il calendario", {
          body: "Segna cardio, allenamento, dieta e peso per oggi."
        });
        lastNotified = todayKey;
      }
    }
  }, 60000);
}

// =========================
// Range open/close
// =========================
openRangeBtn.addEventListener("click", () => {
  rangeCard.classList.remove("hidden");
  // scroll into view to avoid "white line" artifact/overlaps
  rangeCard.scrollIntoView({ behavior: "smooth", block: "start" });
});
closeRangeBtn.addEventListener("click", () => {
  rangeCard.classList.add("hidden");
});

// =========================
// Listeners
// =========================
cardioCheckbox.addEventListener("change", () => {
  if (cardioCheckbox.checked) cardioReasonSelect.value = "";
  saveCurrentDay(true);
});
cardioReasonSelect.addEventListener("change", () => saveCurrentDay(false));

workoutSelect.addEventListener("change", () => {
  if (isGymWorkout(workoutSelect.value)) workoutReasonSelect.value = "";
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

prevDayBtn.addEventListener("click", () => {
  currentDate.setDate(currentDate.getDate() - 1);
  loadDayToUI(currentDate);
});
nextDayBtn.addEventListener("click", () => {
  currentDate.setDate(currentDate.getDate() + 1);
  loadDayToUI(currentDate);
});
todayBtn.addEventListener("click", () => {
  currentDate = stripTime(new Date());
  loadDayToUI(currentDate);
});
currentDateInput.addEventListener("change", () => {
  if (!currentDateInput.value) return;
  const d = parseIsoLocal(currentDateInput.value);
  if (isNaN(d)) return;
  loadDayToUI(d);
});

rangeCalcBtn.addEventListener("click", updateCustomRangeStats);

statsTabs.forEach(btn => {
  btn.addEventListener("click", () => {
    const mode = btn.dataset.mode;
    if (mode) updateStatsMode(mode);
  });
});

startWeightInput.addEventListener("input", () => {
  setStartWeight(startWeightInput.value);
  updateWeightUI();
  updateAllStats();
});
goalWeightInput.addEventListener("input", () => {
  setGoalWeight(goalWeightInput.value);
  updateWeightUI();
  updateAllStats();
});

// =========================
// Init
// =========================
(function init() {
  // default range: week
  const today = stripTime(new Date());
  const wStart = startOfWeek(today);
  const wEnd = endOfWeek(today);
  rangeStartInput.value = makeIsoLocal(wStart);
  rangeEndInput.value = makeIsoLocal(wEnd);

  loadDayToUI(currentDate);
  updateAllStats();
  updateCustomRangeStats();

  maybeRequestNotificationPermission();
  scheduleDailyReminder();
})();