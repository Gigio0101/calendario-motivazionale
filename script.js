// =========================
// Utilità base
// =========================

const STORAGE_KEY = "motivationalCalendarV2";

function stripTime(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toIso(date) {
    return date.toISOString().split("T")[0];
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
    // Lunedì come primo giorno
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

function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), daysInMonth(date));
}

function startOfYear(date) {
    return new Date(date.getFullYear(), 0, 1);
}

function endOfYear(date) {
    return new Date(date.getFullYear(), 11, 31);
}

function formatItalianDay(date) {
    const fmt = new Intl.DateTimeFormat("it-IT", {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    });
    return fmt.format(date);
}

function isDateBetween(d, start, end) {
    const t = d.getTime();
    return t >= start.getTime() && t <= end.getTime();
}

// =========================
// Stato globale
// =========================

let savedData = loadData();
let currentDate = stripTime(new Date());

// Target piano
const WEEKLY_CARDIO_TARGET = 7;
const WEEKLY_GYM_TARGET = 3;
const WEEKLY_DIET_TARGET = 7;

const WEEKS_IN_MONTH = 4; // come da tua richiesta: 3/week -> 12/month
const WEEKS_IN_YEAR = 52;

const MONTHLY_GYM_TARGET = WEEKLY_GYM_TARGET * WEEKS_IN_MONTH; // 12
const YEARLY_GYM_TARGET = WEEKLY_GYM_TARGET * WEEKS_IN_YEAR;   // 156

// =========================
// Audio suono successo
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
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
        osc.stop(ctx.currentTime + 0.25);
    } catch (e) {
        // ignora eventuali errori audio
    }
}

function isDayComplete(dayData) {
    return !!(dayData &&
        dayData.cardio &&
        isGymWorkout(dayData.workout) &&
        dayData.diet
    );
}

// =========================
// DOM
// =========================

const cardioCheckbox = document.getElementById("cardio-checkbox");
const workoutSelect = document.getElementById("workout-select");
const dietCheckbox = document.getElementById("diet-checkbox");
const notesTextarea = document.getElementById("notes-textarea");
const currentDateInput = document.getElementById("current-date-input");
const currentDayLabel = document.getElementById("current-day-label");
const prevDayBtn = document.getElementById("prev-day-btn");
const nextDayBtn = document.getElementById("next-day-btn");
const todayBtn = document.getElementById("today-btn");
const dayCompleteBadge = document.getElementById("day-complete-badge");

const rangeStartInput = document.getElementById("range-start");
const rangeEndInput = document.getElementById("range-end");
const rangeCalcBtn = document.getElementById("range-calc-btn");

// =========================
// Gestione giorno
// =========================

function getDayData(date) {
    const iso = toIso(date);
    if (!savedData[iso]) {
        savedData[iso] = {
            cardio: false,
            workout: "Rest",
            diet: false,
            notes: ""
        };
    }
    return savedData[iso];
}

function loadDayToUI(date) {
    currentDate = stripTime(date);
    const data = getDayData(currentDate);

    currentDateInput.value = toIso(currentDate);
    currentDayLabel.textContent = formatItalianDay(currentDate);

    cardioCheckbox.checked = !!data.cardio;
    workoutSelect.value = data.workout || "Rest";
    dietCheckbox.checked = !!data.diet;
    notesTextarea.value = data.notes || "";

    updateDayCompleteBadge();
}

function saveCurrentDay(playSound) {
    const iso = toIso(currentDate);
    const prevData = savedData[iso] || {
        cardio: false,
        workout: "Rest",
        diet: false,
        notes: ""
    };
    const prevComplete = isDayComplete(prevData);

    const newData = {
        cardio: !!cardioCheckbox.checked,
        workout: workoutSelect.value || "Rest",
        diet: !!dietCheckbox.checked,
        notes: notesTextarea.value || ""
    };

    savedData[iso] = newData;
    saveData(savedData);
    updateDayCompleteBadge();
    updateAllStats();

    const nowComplete = isDayComplete(newData);
    if (playSound && !prevComplete && nowComplete) {
        playSuccessSound();
    }
}

function updateDayCompleteBadge() {
    const data = getDayData(currentDate);
    if (isDayComplete(data)) {
        dayCompleteBadge.style.display = "inline-flex";
    } else {
        dayCompleteBadge.style.display = "none";
    }
}

// =========================
// Statistiche globali
// =========================

function updateAllStats() {
    const now = new Date();
    const today = stripTime(now);

    const wStart = startOfWeek(today);
    const wEnd = endOfWeek(today);
    const mStart = startOfMonth(today);
    const mEnd = endOfMonth(today);
    const yStart = startOfYear(today);
    const yEnd = endOfYear(today);

    const daysMonth = daysInMonth(today);
    const daysYear = daysInYear(today);

    let weeklyCardio = 0, weeklyGym = 0, weeklyDiet = 0;
    let monthlyCardio = 0, monthlyGym = 0, monthlyDiet = 0;
    let yearlyCardio = 0, yearlyGym = 0, yearlyDiet = 0;

    Object.keys(savedData).forEach(iso => {
        const d = stripTime(new Date(iso));
        if (isNaN(d)) return;
        const data = savedData[iso];
        const isGym = isGymWorkout(data.workout);

        // settimanale
        if (isDateBetween(d, wStart, wEnd)) {
            if (data.cardio) weeklyCardio++;
            if (isGym) weeklyGym++;
            if (data.diet) weeklyDiet++;
        }

        // mensile
        if (isDateBetween(d, mStart, mEnd)) {
            if (data.cardio) monthlyCardio++;
            if (isGym) monthlyGym++;
            if (data.diet) monthlyDiet++;
        }

        // annuale
        if (isDateBetween(d, yStart, yEnd)) {
            if (data.cardio) yearlyCardio++;
            if (isGym) yearlyGym++;
            if (data.diet) yearlyDiet++;
        }
    });

    // Weekly
    setStat("weekly-cardio-value", `${weeklyCardio} / ${WEEKLY_CARDIO_TARGET}`);
    setStat("weekly-cardio-percent",
        pctText(weeklyCardio, WEEKLY_CARDIO_TARGET));

    setStat("weekly-gym-value", `${weeklyGym} / ${WEEKLY_GYM_TARGET}`);
    setStat("weekly-gym-percent",
        pctText(weeklyGym, WEEKLY_GYM_TARGET));

    setStat("weekly-diet-value", `${weeklyDiet} / ${WEEKLY_DIET_TARGET}`);
    setStat("weekly-diet-percent",
        pctText(weeklyDiet, WEEKLY_DIET_TARGET));

    // Monthly
    const monthlyCardioTarget = daysMonth;
    const monthlyDietTarget = daysMonth;

    setStat("monthly-cardio-value", `${monthlyCardio} / ${monthlyCardioTarget}`);
    setStat("monthly-cardio-percent",
        pctText(monthlyCardio, monthlyCardioTarget));

    setStat("monthly-gym-value", `${monthlyGym} / ${MONTHLY_GYM_TARGET}`);
    setStat("monthly-gym-percent",
        pctText(monthlyGym, MONTHLY_GYM_TARGET));

    setStat("monthly-diet-value", `${monthlyDiet} / ${monthlyDietTarget}`);
    setStat("monthly-diet-percent",
        pctText(monthlyDiet, monthlyDietTarget));

    // Yearly
    const yearlyCardioTarget = daysYear;
    const yearlyDietTarget = daysYear;

    setStat("yearly-cardio-value", `${yearlyCardio} / ${yearlyCardioTarget}`);
    setStat("yearly-cardio-percent",
        pctText(yearlyCardio, yearlyCardioTarget));

    setStat("yearly-gym-value", `${yearlyGym} / ${YEARLY_GYM_TARGET}`);
    setStat("yearly-gym-percent",
        pctText(yearlyGym, YEARLY_GYM_TARGET));

    setStat("yearly-diet-value", `${yearlyDiet} / ${yearlyDietTarget}`);
    setStat("yearly-diet-percent",
        pctText(yearlyDiet, yearlyDietTarget));
}

function setStat(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function pctText(done, target) {
    if (!target || target <= 0) return "0%";
    const p = Math.min(100, Math.round((done / target) * 100));
    return `${p}%`;
}

// =========================
// Statistiche intervallo personalizzato
// =========================

function updateCustomRangeStats() {
    const startVal = rangeStartInput.value;
    const endVal = rangeEndInput.value;
    if (!startVal || !endVal) {
        setStat("range-cardio-count", "0");
        setStat("range-gym-count", "0");
        setStat("range-diet-count", "0");
        return;
    }
    const start = stripTime(new Date(startVal));
    const end = stripTime(new Date(endVal));
    if (isNaN(start) || isNaN(end) || start > end) {
        setStat("range-cardio-count", "0");
        setStat("range-gym-count", "0");
        setStat("range-diet-count", "0");
        return;
    }

    let cardio = 0, gym = 0, diet = 0;

    Object.keys(savedData).forEach(iso => {
        const d = stripTime(new Date(iso));
        if (isNaN(d)) return;
        if (!isDateBetween(d, start, end)) return;
        const data = savedData[iso];
        if (data.cardio) cardio++;
        if (isGymWorkout(data.workout)) gym++;
        if (data.diet) diet++;
    });

    setStat("range-cardio-count", String(cardio));
    setStat("range-gym-count", String(gym));
    setStat("range-diet-count", String(diet));
}

// =========================
// Notifiche leggere (solo se app aperta)
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
        const todayKey = toIso(now);

        if (hours === 22 && minutes >= 0 && minutes <= 5) {
            if (lastNotified !== todayKey) {
                new Notification("Compila il calendario", {
                    body: "Segna cardio, allenamento e dieta per oggi."
                });
                lastNotified = todayKey;
            }
        }
    }, 60000);
}

// =========================
// Event listeners
// =========================

cardioCheckbox.addEventListener("change", () => saveCurrentDay(true));
workoutSelect.addEventListener("change", () => saveCurrentDay(true));
dietCheckbox.addEventListener("change", () => saveCurrentDay(true));
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
    const d = new Date(currentDateInput.value);
    if (isNaN(d)) return;
    loadDayToUI(d);
});

rangeCalcBtn.addEventListener("click", updateCustomRangeStats);

// =========================
// Init
// =========================

loadDayToUI(currentDate);
updateAllStats();
updateCustomRangeStats();
maybeRequestNotificationPermission();
scheduleDailyReminder();
