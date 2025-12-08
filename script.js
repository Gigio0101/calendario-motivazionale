// =============================
//  MOTIVATION TRACKER PREMIUM
// =============================

const STORAGE_KEY = "motivationTracker_premium_v7";

function loadDB() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
        return {
            meta: {
                targetWeight: null,
                startWeight: null,
                bestWeight: null,
                lastMilestoneWeight: null,
                lastImpedanceDate: null,
                notifCountByDay: {},
                lastDailyReminderDate: null
            },
            days: {}
        };
    }
    try {
        const parsed = JSON.parse(raw);
        if (!parsed.meta) parsed.meta = {};
        parsed.meta.targetWeight ??= null;
        parsed.meta.startWeight ??= null;
        parsed.meta.bestWeight ??= null;
        parsed.meta.lastMilestoneWeight ??= null;
        parsed.meta.lastImpedanceDate ??= null;
        parsed.meta.notifCountByDay ??= {};
        parsed.meta.lastDailyReminderDate ??= null;
        if (!parsed.days) parsed.days = {};
        return parsed;
    } catch {
        return {
            meta: {
                targetWeight: null,
                startWeight: null,
                bestWeight: null,
                lastMilestoneWeight: null,
                lastImpedanceDate: null,
                notifCountByDay: {},
                lastDailyReminderDate: null
            },
            days: {}
        };
    }
}

function saveDB() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DB));
}

let DB = loadDB();

// ---- Date helpers ----

let currentDate = new Date();
currentDate.setHours(12,0,0,0);

function dayIdFromDate(date) {
    return date.toISOString().split("T")[0];
}

function ensureDay(dayId) {
    if (!DB.days[dayId]) {
        DB.days[dayId] = {
            cardio: false,
            workout: "Rest",
            diet: false,
            workoutReason: "",
            dietReason: "",
            dietJustify: "",
            notes: "",
            weight: null,
            impedance: ""
        };
    }
    return DB.days[dayId];
}

// ---- UI elements ----

const todayLabelEl = document.getElementById("today-label");
const dayCardEl = document.getElementById("day-card");

const cardioSummaryEl = document.getElementById("cardio-summary");
const gymSummaryEl = document.getElementById("gym-summary");
const dietSummaryEl = document.getElementById("diet-summary");
const weightSummaryEl = document.getElementById("weight-summary");
const cardioBarEl = document.getElementById("cardio-bar");
const gymBarEl = document.getElementById("gym-bar");
const dietBarEl = document.getElementById("diet-bar");
const weightBarEl = document.getElementById("weight-bar");

const workoutReasonsListEl = document.getElementById("workout-reasons-list");
const dietReasonsListEl = document.getElementById("diet-reasons-list");
const impedanceReminderEl = document.getElementById("impedance-reminder");
const motivationBannerEl = document.getElementById("motivation-banner");
const badgeEl = document.getElementById("badge");
const statsModeEl = document.getElementById("stats-mode");
const targetWeightEl = document.getElementById("target-weight");

const prevDayBtn = document.getElementById("prev-day");
const nextDayBtn = document.getElementById("next-day");

// ---- Sounds (stile Apple Fitness, generati via WebAudio) ----

let audioCtx = null;

function ensureAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playVictorySound() {
    try {
        ensureAudioContext();
        const now = audioCtx.currentTime;
        const osc1 = audioCtx.createOscillator();
        const gain1 = audioCtx.createGain();
        osc1.type = "sine";
        osc1.frequency.setValueAtTime(880, now);
        gain1.gain.setValueAtTime(0.18, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc1.connect(gain1).connect(audioCtx.destination);
        osc1.start(now);
        osc1.stop(now + 0.21);

        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.type = "triangle";
        osc2.frequency.setValueAtTime(1320, now + 0.2);
        gain2.gain.setValueAtTime(0.16, now + 0.2);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc2.connect(gain2).connect(audioCtx.destination);
        osc2.start(now + 0.2);
        osc2.stop(now + 0.46);
    } catch {}
}

function playMilestoneSound() {
    try {
        ensureAudioContext();
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(1320, now);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.36);
    } catch {}
}

// ---- Motivational phrases ----

const successPhrases = [
    "Perfetto, continua così e spacca tutto!",
    "Ogni spunta è un passo in meno verso il vecchio te.",
    "Stai costruendo costanza vera, non è da tutti.",
    "Questo è il lavoro che farà la differenza.",
    "Gigio, così si fa: oggi hai alzato l’asticella."
];

const failurePhrases = [
    "Oggi può essere andata così, ma domani hai un’altra occasione.",
    "Non cambiano 24 ore, cambia cosa fai nelle prossime 24.",
    "Usa questa giornata come benzina, non come scusa.",
    "Scivolare capita, mollare no. Torna più forte domani.",
    "Il fatto che ci tieni lo dimostra il fatto che lo stai registrando."
];

const weightPhrases = [
    "Un chilo in meno, una versione più leggera e più forte di te.",
    "Risultato di tutte le micro-scelte giuste. Continua.",
    "Sei ufficialmente sulla strada giusta, non fermarti ora.",
    "Ogni kg perso è un voto di fiducia che ti sei dato.",
    "Numeri giù sulla bilancia, mentalità sempre più su."
];

// ---- Badge & banner ----

function showBadge(message) {
    if (!badgeEl) return;
    badgeEl.textContent = message;
    badgeEl.classList.remove("hidden");
    badgeEl.classList.add("show");
    setTimeout(() => {
        badgeEl.classList.remove("show");
    }, 1700);
}

function showMotivation(message) {
    if (!motivationBannerEl) return;
    motivationBannerEl.textContent = message;
}

// ---- Notifications (limitate, solo se pagina aperta) ----

function getNotifCountFor(dayId) {
    return DB.meta.notifCountByDay[dayId] || 0;
}
function incrementNotifCountFor(dayId) {
    DB.meta.notifCountByDay[dayId] = getNotifCountFor(dayId) + 1;
}

function maybeSendFailureNotification(dayId) {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    if (getNotifCountFor(dayId) >= 3) return;

    const phrase = failurePhrases[Math.floor(Math.random() * failurePhrases.length)];
    new Notification("Non mollare adesso.", { body: phrase });
    incrementNotifCountFor(dayId);
    saveDB();
}

// reminder 22:00 per compilazione dati
function scheduleDailyReminder() {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    setInterval(() => {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const todayId = dayIdFromDate(now);

        if (hours === 22 && minutes === 0 && DB.meta.lastDailyReminderDate !== todayId) {
            new Notification("Compila il tuo Motivation Tracker", {
                body: "Segna cardio, allenamento e dieta di oggi."
            });
            DB.meta.lastDailyReminderDate = todayId;
            saveDB();
        }
    }, 60000);
}

// ---- Impedance reminder ----

function checkImpedanceReminder(todayId) {
    if (!impedanceReminderEl) return;
    const last = DB.meta.lastImpedanceDate;
    if (!last) {
        impedanceReminderEl.classList.remove("hidden");
        return;
    }
    const lastDate = new Date(last);
    const today = new Date(todayId);
    const diffMs = today - lastDate;
    const diffDays = diffMs / (1000*60*60*24);
    if (diffDays >= 7) {
        impedanceReminderEl.classList.remove("hidden");
    } else {
        impedanceReminderEl.classList.add("hidden");
    }
}

// ---- Stats ranges ----

function getRangeDates(mode, anchor) {
    const start = new Date(anchor.getTime());
    const end = new Date(anchor.getTime());
    if (mode === "week") {
        const day = anchor.getDay();
        const diffToMonday = (day === 0 ? -6 : 1) - day;
        start.setDate(anchor.getDate() + diffToMonday);
        start.setHours(12,0,0,0);
        end.setTime(start.getTime());
        end.setDate(start.getDate() + 6);
    } else if (mode === "month") {
        start.setDate(1);
        start.setHours(12,0,0,0);
        end.setMonth(start.getMonth() + 1);
        end.setDate(0);
    } else if (mode === "year") {
        start.setMonth(0,1);
        start.setHours(12,0,0,0);
        end.setMonth(11,31);
    }
    return { start, end };
}

function getDatesBetween(start, end) {
    const dates = [];
    const d = new Date(start.getTime());
    while (d <= end) {
        dates.push(new Date(d.getTime()));
        d.setDate(d.getDate() + 1);
    }
    return dates;
}

// ---- Stats & reasons ----

function updateStats() {
    const mode = statsModeEl.value;
    const { start, end } = getRangeDates(mode, currentDate);
    const dates = getDatesBetween(start, end);

    let cardioCount = 0;
    let gymCount = 0;
    let dietCount = 0;
    let totalDays = dates.length;

    let lastWeight = null;

    const workoutReasonsCounter = {
        non_aria: 0,
        lavoro: 0,
        scarico: 0
    };
    const dietReasonsCounter = {
        sgarro: 0,
        non_aria: 0,
        pasto_fuori: 0
    };

    dates.forEach(d => {
        const id = dayIdFromDate(d);
        const entry = DB.days[id];
        if (!entry) return;

        if (entry.cardio) cardioCount++;
        if (entry.workout === "Leg" || entry.workout === "Pull" || entry.workout === "Push") gymCount++;
        if (entry.diet) dietCount++;

        if (entry.weight != null) {
            lastWeight = entry.weight;
        }

        if (entry.workoutReason && workoutReasonsCounter[entry.workoutReason] != null) {
            workoutReasonsCounter[entry.workoutReason]++;
        }
        if (entry.dietReason && dietReasonsCounter[entry.dietReason] != null) {
            dietReasonsCounter[entry.dietReason]++;
        }
    });

    const cardioPerc = totalDays ? Math.round((cardioCount / totalDays) * 100) : 0;
    const dietPerc = totalDays ? Math.round((dietCount / totalDays) * 100) : 0;
    const gymTarget = 3;
    const gymPerc = gymTarget ? Math.min(100, Math.round((gymCount / gymTarget) * 100)) : 0;

    if (cardioSummaryEl) cardioSummaryEl.textContent = `${cardioCount}/${totalDays} (${cardioPerc}%)`;
    if (gymSummaryEl) gymSummaryEl.textContent = `${gymCount}/${gymTarget} (${gymPerc}%)`;
    if (dietSummaryEl) dietSummaryEl.textContent = `${dietCount}/${totalDays} (${dietPerc}%)`;

    if (cardioBarEl) cardioBarEl.style.width = `${cardioPerc}%`;
    if (dietBarEl) dietBarEl.style.width = `${dietPerc}%`;
    if (gymBarEl) gymBarEl.style.width = `${gymPerc}%`;

    // Weight progress vs target
    const target = DB.meta.targetWeight;
    const startW = DB.meta.startWeight;
    let weightText = "–";
    let weightPerc = 0;

    if (target != null && startW != null && lastWeight != null && startW > target) {
        const totalLossNeeded = startW - target;
        const currentLoss = startW - lastWeight;
        if (totalLossNeeded > 0) {
            weightPerc = Math.max(0, Math.min(100, Math.round((currentLoss / totalLossNeeded) * 100)));
            weightText = `${currentLoss.toFixed(1)}kg / ${totalLossNeeded.toFixed(1)}kg (${weightPerc}%)`;
        }
    } else if (lastWeight != null) {
        weightText = `${lastWeight.toFixed(1)} kg`;
        weightPerc = 0;
    }

    if (weightSummaryEl) weightSummaryEl.textContent = weightText;
    if (weightBarEl) weightBarEl.style.width = `${weightPerc}%`;

    // Reasons lists
    if (workoutReasonsListEl) {
        workoutReasonsListEl.innerHTML = "";
        const labels = {
            non_aria: "Oggi non è aria",
            lavoro: "Lavoro",
            scarico: "Sono scarico"
        };
        Object.keys(workoutReasonsCounter).forEach(key => {
            const li = document.createElement("li");
            li.innerHTML = `<span class="reason-label">${labels[key]}</span><span class="reason-count">${workoutReasonsCounter[key]}</span>`;
            workoutReasonsListEl.appendChild(li);
        });
    }

    if (dietReasonsListEl) {
        dietReasonsListEl.innerHTML = "";
        const labels = {
            sgarro: "Giornata sgarro",
            non_aria: "Oggi non è aria",
            pasto_fuori: "Pasto fuori"
        };
        Object.keys(dietReasonsCounter).forEach(key => {
            const li = document.createElement("li");
            li.innerHTML = `<span class="reason-label">${labels[key]}</span><span class="reason-count">${dietReasonsCounter[key]}</span>`;
            dietReasonsListEl.appendChild(li);
        });
    }
}

// ---- Rendering day card ----

function renderDay() {
    const dayId = dayIdFromDate(currentDate);
    const entry = ensureDay(dayId);

    const dayName = currentDate.toLocaleDateString("it-IT", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
    });

    if (todayLabelEl) {
        const nice = dayName.charAt(0).toUpperCase() + dayName.slice(1);
        todayLabelEl.textContent = nice;
    }

    dayCardEl.innerHTML = `
        <div class="day-card-header">
            <div class="day-title">Dettagli giornata</div>
        </div>

        <div class="checkbox-row">
            <input type="checkbox" id="cardio" ${entry.cardio ? "checked" : ""}>
            <label for="cardio">Cardio completato (60 min walking pad)</label>
        </div>

        <div class="section-label">Allenamento</div>
        <select id="workout">
            <option value="Leg" ${entry.workout === "Leg" ? "selected" : ""}>Leg</option>
            <option value="Pull" ${entry.workout === "Pull" ? "selected" : ""}>Pull</option>
            <option value="Push" ${entry.workout === "Push" ? "selected" : ""}>Push</option>
            <option value="Rest" ${entry.workout === "Rest" ? "selected" : ""}>Rest (riposo)</option>
        </select>

        <div class="section-label">Motivo se non ti sei allenato</div>
        <select id="workout-reason">
            <option value="">Nessuno</option>
            <option value="non_aria" ${entry.workoutReason === "non_aria" ? "selected" : ""}>Oggi non è aria</option>
            <option value="lavoro" ${entry.workoutReason === "lavoro" ? "selected" : ""}>Lavoro</option>
            <option value="scarico" ${entry.workoutReason === "scarico" ? "selected" : ""}>Sono scarico</option>
        </select>

        <div class="section-label">Dieta</div>
        <div class="checkbox-row">
            <input type="checkbox" id="diet" ${entry.diet ? "checked" : ""}>
            <label for="diet">Aderenza al piano alimentare</label>
        </div>

        <div class="section-label">Motivo mancata aderenza dieta</div>
        <select id="diet-reason">
            <option value="">Nessuno</option>
            <option value="sgarro" ${entry.dietReason === "sgarro" ? "selected" : ""}>Giornata sgarro</option>
            <option value="non_aria" ${entry.dietReason === "non_aria" ? "selected" : ""}>Oggi non è aria</option>
            <option value="pasto_fuori" ${entry.dietReason === "pasto_fuori" ? "selected" : ""}>Pasto fuori</option>
        </select>

        <div class="section-label">Giustificazione pasto (se sgarro / non è aria)</div>
        <select id="diet-justify">
            <option value="">Nessuna</option>
            <option value="delivery" ${entry.dietJustify === "delivery" ? "selected" : ""}>Delivery</option>
            <option value="ristorante" ${entry.dietJustify === "ristorante" ? "selected" : ""}>Ristorante</option>
            <option value="chef" ${entry.dietJustify === "chef" ? "selected" : ""}>Chef 👨‍🍳</option>
        </select>

        <div class="section-label">Peso (kg) e Impedenziometria</div>
        <div class="fields-inline">
            <div>
                <label for="weight" style="font-size:11px;">Peso</label>
                <input type="number" id="weight" step="0.1" value="${entry.weight != null ? entry.weight : ""}" placeholder="Es. 82.5">
            </div>
            <div>
                <label for="impedance" style="font-size:11px;">Impedenziometria</label>
                <input type="text" id="impedance" value="${entry.impedance || ""}" placeholder="%BF, massa magra, ecc.">
            </div>
        </div>

        <div class="section-label">Note</div>
        <textarea id="notes" placeholder="Appunti su come è andata la giornata, sensazioni, focus...">${entry.notes || ""}</textarea>
    `;

    const cardioEl = document.getElementById("cardio");
    const workoutEl = document.getElementById("workout");
    const workoutReasonEl = document.getElementById("workout-reason");
    const dietEl = document.getElementById("diet");
    const dietReasonEl = document.getElementById("diet-reason");
    const dietJustifyEl = document.getElementById("diet-justify");
    const weightEl = document.getElementById("weight");
    const impedanceEl = document.getElementById("impedance");
    const notesEl = document.getElementById("notes");

    const dayId = dayIdFromDate(currentDate);

    function saveAndUpdate(source) {
        const e = ensureDay(dayId);
        e.cardio = cardioEl.checked;
        e.workout = workoutEl.value;
        e.workoutReason = workoutReasonEl.value;
        e.diet = dietEl.checked;
        e.dietReason = dietReasonEl.value;
        e.dietJustify = dietJustifyEl.value;
        e.notes = notesEl.value;
        const weightVal = parseFloat(weightEl.value);
        e.weight = isNaN(weightVal) ? null : weightVal;
        e.impedance = impedanceEl.value;

        // startWeight, bestWeight, milestone ogni kg
        if (e.weight != null) {
            if (DB.meta.startWeight == null) {
                DB.meta.startWeight = e.weight;
                DB.meta.bestWeight = e.weight;
                DB.meta.lastMilestoneWeight = e.weight;
            } else {
                if (DB.meta.bestWeight == null || e.weight < DB.meta.bestWeight) {
                    DB.meta.bestWeight = e.weight;
                }
                if (DB.meta.lastMilestoneWeight != null) {
                    const diff = DB.meta.lastMilestoneWeight - e.weight;
                    if (diff >= 1) {
                        DB.meta.lastMilestoneWeight = e.weight;
                        playMilestoneSound();
                        const phrase = weightPhrases[Math.floor(Math.random() * weightPhrases.length)];
                        showBadge("Nuovo traguardo peso! 🎉");
                        showMotivation(phrase);
                    }
                } else {
                    DB.meta.lastMilestoneWeight = e.weight;
                }
            }
        }

        if (e.impedance && e.impedance.trim().length > 0) {
            DB.meta.lastImpedanceDate = dayId;
        }

        saveDB();
        updateStats();
        checkImpedanceReminder(dayId);

        // victory events
        if (source === "cardio" && e.cardio) {
            playVictorySound();
            const phrase = successPhrases[Math.floor(Math.random() * successPhrases.length)];
            showBadge("Cardio completato ✅");
            showMotivation(phrase);
        }
        if (source === "workout" && (e.workout === "Leg" || e.workout === "Pull" || e.workout === "Push")) {
            playVictorySound();
            const phrase = successPhrases[Math.floor(Math.random() * successPhrases.length)];
            showBadge("Allenamento registrato ✅");
            showMotivation(phrase);
        }
        if (source === "diet" && e.diet) {
            playVictorySound();
            const phrase = successPhrases[Math.floor(Math.random() * successPhrases.length)];
            showBadge("Dieta rispettata ✅");
            showMotivation(phrase);
        }

        // failure notifications + motivation
        if (source === "workoutReason" && e.workoutReason) {
            maybeSendFailureNotification(dayId);
            const phrase = failurePhrases[Math.floor(Math.random() * failurePhrases.length)];
            showMotivation(phrase);
        }
        if (source === "dietReason" && e.dietReason) {
            maybeSendFailureNotification(dayId);
            const phrase = failurePhrases[Math.floor(Math.random() * failurePhrases.length)];
            showMotivation(phrase);
        }
    }

    cardioEl.addEventListener("change", () => saveAndUpdate("cardio"));
    workoutEl.addEventListener("change", () => saveAndUpdate("workout"));
    workoutReasonEl.addEventListener("change", () => saveAndUpdate("workoutReason"));
    dietEl.addEventListener("change", () => saveAndUpdate("diet"));
    dietReasonEl.addEventListener("change", () => saveAndUpdate("dietReason"));
    dietJustifyEl.addEventListener("change", () => saveAndUpdate("dietJustify"));
    weightEl.addEventListener("change", () => saveAndUpdate("weight"));
    impedanceEl.addEventListener("change", () => saveAndUpdate("impedance"));
    notesEl.addEventListener("input", () => saveAndUpdate("notes"));
}

// ---- Target weight ----

function initTargetWeight() {
    if (DB.meta.targetWeight != null) {
        targetWeightEl.value = DB.meta.targetWeight;
    }
    targetWeightEl.addEventListener("change", () => {
        const v = parseFloat(targetWeightEl.value);
        DB.meta.targetWeight = isNaN(v) ? null : v;
        saveDB();
        updateStats();
    });
}

// ---- Navigation & stats mode ----

prevDayBtn.addEventListener("click", () => {
    currentDate.setDate(currentDate.getDate() - 1);
    renderAll();
});

nextDayBtn.addEventListener("click", () => {
    currentDate.setDate(currentDate.getDate() + 1);
    renderAll();
});

statsModeEl.addEventListener("change", () => {
    renderAll();
});

// ---- Initial render ----

function renderAll() {
    renderDay();
    updateStats();
    const todayId = dayIdFromDate(currentDate);
    checkImpedanceReminder(todayId);
}

window.addEventListener("load", () => {
    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
    }
    initTargetWeight();
    renderAll();
    scheduleDailyReminder();
});
