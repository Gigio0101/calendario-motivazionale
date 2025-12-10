// =========================
// Utilità base per la settimana
// =========================

function getCurrentWeek() {
    const now = new Date();
    const day = now.getDay(); // 0 = domenica
    const diffToMonday = (day === 0 ? -6 : 1) - day;

    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);

    const days = [];
    const labels = ["Lunedì","Martedì","Mercoledì","Giovedì","Venerdì","Sabato","Domenica"];

    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);

        days.push({
            id: d.toISOString().split("T")[0],
            label: labels[i],
            date: d.toLocaleDateString("it-IT"),
            jsDate: d
        });
    }

    return days;
}

function saveData(data) {
    localStorage.setItem("motivationalCalendar", JSON.stringify(data));
}

function loadData() {
    const saved = localStorage.getItem("motivationalCalendar");
    return saved ? JSON.parse(saved) : {};
}

// =========================
// Stato globale
// =========================

const savedData = loadData();
const week = getCurrentWeek();
const container = document.getElementById("days-container");

// =========================
// Audio – piccolo suono di conferma
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
        // Ignora eventuali errori audio
    }
}

// =========================
// Rendering card giorni
// =========================

let todayCardElement = null;
const todayId = new Date().toISOString().split("T")[0];

week.forEach(day => {
    const dayData = savedData[day.id] || {
        cardio: false,
        workout: "Rest",
        diet: false,
        notes: ""
    };

    const div = document.createElement("div");
    div.className = "day-card";
    div.id = `day-${day.id}`;

    const isToday = day.id === todayId;
    if (isToday) {
        div.classList.add("today");
        todayCardElement = div;
    }

    div.innerHTML = `
        <div class="day-header">
            <div>
                <span class="day-title">${day.label}
                    ${isToday ? '<span class="day-badge-today">Oggi</span>' : ""}
                </span>
            </div>
            <span class="day-date">${day.date}</span>
        </div>

        <div class="checkbox-row">
            <input type="checkbox" id="cardio-${day.id}" ${dayData.cardio ? "checked" : ""}>
            <label for="cardio-${day.id}">Cardio completato (60' walking pad)</label>
        </div>

        <label class="label" for="workout-${day.id}">Allenamento</label>
        <select id="workout-${day.id}">
            <option value="Leg"  ${dayData.workout === "Leg" ? "selected" : ""}>Leg</option>
            <option value="Pull" ${dayData.workout === "Pull" ? "selected" : ""}>Pull</option>
            <option value="Push" ${dayData.workout === "Push" ? "selected" : ""}>Push</option>
            <option value="Rest" ${dayData.workout === "Rest" ? "selected" : ""}>Rest</option>
        </select>

        <div class="checkbox-row" style="margin-top: 10px;">
            <input type="checkbox" id="diet-${day.id}" ${dayData.diet ? "checked" : ""}>
            <label for="diet-${day.id}">Aderenza piano alimentare</label>
        </div>

        <label class="label" for="notes-${day.id}">Note</label>
        <textarea id="notes-${day.id}">${dayData.notes || ""}</textarea>

        <div id="badge-${day.id}" style="display:none;"></div>
    `;

    container.appendChild(div);

    // Listeners
    const cardioEl = document.getElementById(`cardio-${day.id}`);
    const workoutEl = document.getElementById(`workout-${day.id}`);
    const dietEl = document.getElementById(`diet-${day.id}`);
    const notesEl = document.getElementById(`notes-${day.id}`);
    const badgeEl = document.getElementById(`badge-${day.id}`);

    function saveAndUpdate(playSound) {
        savedData[day.id] = {
            cardio: cardioEl.checked,
            workout: workoutEl.value,
            diet: dietEl.checked,
            notes: notesEl.value
        };
        saveData(savedData);
        updateBadge(day.id, badgeEl);
        updateSummary();
        if (playSound) {
            playSuccessSound();
        }
    }

    cardioEl.addEventListener("change", () => saveAndUpdate(true));
    workoutEl.addEventListener("change", () => saveAndUpdate(true));
    dietEl.addEventListener("change", () => saveAndUpdate(true));
    notesEl.addEventListener("input", () => saveAndUpdate(false));

    // Prima render, badge iniziale
    updateBadge(day.id, badgeEl);
});

// Scroll automatico alla card di oggi
if (todayCardElement) {
    setTimeout(() => {
        todayCardElement.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 200);
}

// =========================
// Badge giornata completata
// =========================

function updateBadge(dayId, badgeEl) {
    const data = savedData[dayId];
    if (!data) {
        badgeEl.style.display = "none";
        badgeEl.innerHTML = "";
        return;
    }
    const gymDone = data.workout === "Leg" || data.workout === "Pull" || data.workout === "Push";
    const completed = data.cardio && gymDone && data.diet;

    if (completed) {
        badgeEl.style.display = "inline-flex";
        badgeEl.className = "day-complete";
        badgeEl.innerHTML = `
            <span class="day-complete-icon">✓</span>
            <span>Giornata completata, ottimo lavoro.</span>
        `;
    } else {
        badgeEl.style.display = "none";
        badgeEl.innerHTML = "";
    }
}

// =========================
// Riepilogo settimanale
// =========================

function updateSummary() {
    let cardioCount = 0;
    let gymCount = 0;
    let dietCount = 0;
    const total = week.length; // 7

    week.forEach(day => {
        const data = savedData[day.id];
        if (!data) return;
        if (data.cardio) cardioCount++;
        if (data.workout === "Leg" || data.workout === "Pull" || data.workout === "Push") gymCount++;
        if (data.diet) dietCount++;
    });

    const cardioPct = Math.round((cardioCount / total) * 100) || 0;
    const gymPct = Math.round((gymCount / total) * 100) || 0;
    const dietPct = Math.round((dietCount / total) * 100) || 0;

    const cardioBar = document.getElementById("progress-cardio");
    const gymBar = document.getElementById("progress-gym");
    const dietBar = document.getElementById("progress-diet");
    const cardioText = document.getElementById("percent-cardio");
    const gymText = document.getElementById("percent-gym");
    const dietText = document.getElementById("percent-diet");

    if (cardioBar) cardioBar.style.width = `${cardioPct}%`;
    if (gymBar) gymBar.style.width = `${gymPct}%`;
    if (dietBar) dietBar.style.width = `${dietPct}%`;

    if (cardioText) cardioText.textContent = `${cardioPct}%`;
    if (gymText) gymText.textContent = `${gymPct}%`;
    if (dietText) dietText.textContent = `${dietPct}%`;
}

updateSummary();

// =========================
// Promemoria “leggero” alle 22:00 (solo se app aperta/attiva)
// =========================

function maybeRequestNotificationPermission() {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") {
        Notification.requestPermission().then(() => {
            // niente da fare qui, solo sblocco
        });
    }
}

function scheduleDailyReminder() {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    let lastNotifiedDate = null;

    setInterval(() => {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const todayKey = now.toISOString().split("T")[0];

        if (hours === 22 && minutes >= 0 && minutes <= 5) {
            if (lastNotifiedDate !== todayKey) {
                new Notification("Compila il calendario", {
                    body: "Ricordati di segnare cardio, palestra e dieta per oggi."
                });
                lastNotifiedDate = todayKey;
            }
        }
    }, 60000); // controllo ogni minuto
}

maybeRequestNotificationPermission();
scheduleDailyReminder();
