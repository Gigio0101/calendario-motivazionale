[INIZIO FILE SCRIPT.JS]

/* --------------------------------------------------
   MOTIVATION TRACKER PREMIUM – VERSIONE 3.0
-------------------------------------------------- */

const STORAGE_KEY = "motivation_tracker_premium_v3";
let db = loadDB();

function loadDB() {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
}

function saveDB() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function getDayId(date) {
    return date.toISOString().split("T")[0];
}

function ensureEntry(dayId) {
    if (!db[dayId]) {
        db[dayId] = {
            cardio: false,
            workout: "Rest",
            workoutReason: "",
            diet: false,
            dietReason: "",
            dietJustify: "",
            notes: "",
            weight: "",
            impedance: "",
        };
    }
    return db[dayId];
}

/* --------------------------------------------------
   NAVIGAZIONE TRA GIORNI / MESI / ANNI
-------------------------------------------------- */

let currentDate = new Date();

document.getElementById("prevDay").onclick = () => {
    currentDate.setDate(currentDate.getDate() - 1);
    renderAll();
};

document.getElementById("nextDay").onclick = () => {
    currentDate.setDate(currentDate.getDate() + 1);
    renderAll();
};

/* --------------------------------------------------
   SUONO PREMIUM + FRASE MOTIVAZIONALE
-------------------------------------------------- */

const motivationalPhrases = [
    "Spacchi tutto!",
    "Continua così, sei un treno!",
    "Zero scuse, solo risultati!",
    "Tu puoi molto più di quanto credi!",
    "Mostra a te stesso chi sei davvero!"
];

function playSuccessSound() {
    const audio = new Audio(
        "https://actions.google.com/sounds/v1/cartoon/clang_and_wobble.ogg"
    );
    audio.volume = 0.4;
    audio.play();
}

function randomPhrase() {
    return motivationalPhrases[
        Math.floor(Math.random() * motivationalPhrases.length)
    ];
}

/* --------------------------------------------------
   BADGE PREMIUM
-------------------------------------------------- */

function showBadge(text) {
    const badge = document.getElementById("badge");
    badge.textContent = text;
    badge.classList.add("show");
    setTimeout(() => badge.classList.remove("show"), 1800);
}

/* --------------------------------------------------
   RENDER GIORNO
-------------------------------------------------- */

function renderDayEditor() {
    const dayId = getDayId(currentDate);
    const e = ensureEntry(dayId);

    const label = document.getElementById("currentDayLabel");
    label.textContent = currentDate.toLocaleDateString("it-IT", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
    });

    const container = document.getElementById("dayEditor");
    container.innerHTML = `
        <div class="section-title">Cardio</div>
        <input type="checkbox" id="cardioBox" ${e.cardio ? "checked" : ""}>

        <div class="section-title">Allenamento</div>
        <select id="workoutSelect">
            <option value="Leg">Leg</option>
            <option value="Pull">Pull</option>
            <option value="Push">Push</option>
            <option value="Rest">Rest</option>
        </select>

        <div class="section-title">Motivo mancato allenamento</div>
        <select id="workoutReason">
            <option value="">Nessuno</option>
            <option value="non_aria">Oggi non è aria</option>
            <option value="lavoro">Lavoro</option>
            <option value="scarico">Sono scarico</option>
        </select>

        <div class="section-title">Aderenza dieta</div>
        <input type="checkbox" id="dietBox" ${e.diet ? "checked" : ""}>

        <div class="section-title">Motivo mancata dieta</div>
        <select id="dietReason">
            <option value="">Nessuno</option>
            <option value="sgarro">Giornata sgarro</option>
            <option value="non_aria">Oggi non è aria</option>
            <option value="pasto_fuori">Pasto fuori</option>
        </select>

        <div class="section-title">Giustificazione pasto</div>
        <select id="dietJustify">
            <option value="">Nessuna</option>
            <option value="delivery">Delivery</option>
            <option value="ristorante">Ristorante</option>
            <option value="chef">Chef 👨‍🍳</option>
        </select>

        <div class="section-title">Peso</div>
        <input type="number" id="weightInput" value="${e.weight || ""}" placeholder="kg">

        <div class="section-title">Impedenziometria</div>
        <input type="text" id="impInput" value="${e.impedance || ""}" placeholder="Dati impedenziometrici">

        <div class="section-title">Note</div>
        <textarea id="notesBox">${e.notes}</textarea>
    `;

    document.getElementById("workoutSelect").value = e.workout;
    document.getElementById("dietReason").value = e.dietReason;
    document.getElementById("dietJustify").value = e.dietJustify;
    document.getElementById("workoutReason").value = e.workoutReason;

    document.querySelectorAll("#dayEditor input, #dayEditor select, #dayEditor textarea")
        .forEach(el => {
            el.onchange = saveDayData;
            el.oninput = saveDayData;
        });
}

/* --------------------------------------------------
   SALVATAGGIO + LOGICA EVENTI
-------------------------------------------------- */

function saveDayData() {
    const dayId = getDayId(currentDate);
    const e = ensureEntry(dayId);

    e.cardio = document.getElementById("cardioBox").checked;
    e.workout = document.getElementById("workoutSelect").value;
    e.workoutReason = document.getElementById("workoutReason").value;
    e.diet = document.getElementById("dietBox").checked;
    e.dietReason = document.getElementById("dietReason").value;
    e.dietJustify = document.getElementById("dietJustify").value;
    e.notes = document.getElementById("notesBox").value;
    e.weight = document.getElementById("weightInput").value;
    e.impedance = document.getElementById("impInput").value;

    saveDB();

    if (e.cardio || e.workout !== "Rest" || e.diet) {
        playSuccessSound();
        showBadge(randomPhrase());
    }

    renderStats();
}

/* --------------------------------------------------
   STATISTICHE PREMIUM
-------------------------------------------------- */

function getStats(mode) {
    const stats = {
        cardio: 0,
        workout: 0,
        diet: 0,
        total: 0,
        reasonsWorkout: { non_aria: 0, lavoro: 0, scarico: 0 },
        reasonsDiet: { sgarro: 0, non_aria: 0, pasto_fuori: 0 },
    };

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    for (const dayId in db) {
        const d = new Date(dayId);
        const e = db[dayId];

        if (mode === "week") {
           
            const diff = (now - d) / 86400000;
            if (diff > 7 || diff < 0) continue;
        }

        if (mode === "month" && (d.getMonth() !== month || d.getFullYear() !== year)) continue;

        if (mode === "year" && d.getFullYear() !== year) continue;

        stats.total++;
        if (e.cardio) stats.cardio++;
        if (e.workout !== "Rest") stats.workout++;
        if (e.diet) stats.diet++;

        if (e.workoutReason) stats.reasonsWorkout[e.workoutReason]++;
        if (e.dietReason) stats.reasonsDiet[e.dietReason]++;
    }

    return stats;
}

function renderStats() {
    const container = document.getElementById("premiumStats");
    const mode = document.querySelector(".stats-mode button.active")?.dataset.mode || "week";
    const s = getStats(mode);

    container.innerHTML = `
        <h3>Statistiche ${mode}</h3>
        <p>Cardio: ${s.cardio}/${s.total}</p>
        <p>Allenamento: ${s.workout}/${s.total}</p>
        <p>Dieta: ${s.diet}/${s.total}</p>

        <h4>Motivi NON allenamento:</h4>
        <p>Oggi non è aria: ${s.reasonsWorkout.non_aria}</p>
        <p>Lavoro: ${s.reasonsWorkout.lavoro}</p>
        <p>Sono scarico: ${s.reasonsWorkout.scarico}</p>

        <h4>Motivi NON dieta:</h4>
        <p>Sgarro: ${s.reasonsDiet.sgarro}</p>
        <p>Oggi non è aria: ${s.reasonsDiet.non_aria}</p>
        <p>Pasto fuori: ${s.reasonsDiet.pasto_fuori}</p>
    `;
}

document.querySelectorAll(".stats-mode button").forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll(".stats-mode button").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        renderStats();
    };
});

/* --------------------------------------------------
   INIZIO APP
-------------------------------------------------- */

function renderAll() {
    renderDayEditor();
    renderStats();
}

renderAll();

[FINE FILE SCRIPT.JS]
