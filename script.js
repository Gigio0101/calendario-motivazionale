// ==== UTILITÀ SETTIMANA CORRENTE ====

function getCurrentWeek() {
    const now = new Date();
    const day = now.getDay(); // 0 domenica, 1 lunedì ...
    const diffToMonday = (day === 0 ? -6 : 1) - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);

    const labels = ["Lunedì","Martedì","Mercoledì","Giovedì","Venerdì","Sabato","Domenica"];
    const days = [];

    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);

        days.push({
            id: d.toISOString().split("T")[0],
            label: labels[i],
            date: d.toLocaleDateString("it-IT")
        });
    }
    return days;
}

// ==== SALVATAGGIO LOCALE ====

function saveData(data) {
    localStorage.setItem("motivationalCalendarV2", JSON.stringify(data));
}

function loadData() {
    const saved = localStorage.getItem("motivationalCalendarV2");
    return saved ? JSON.parse(saved) : {};
}

// ==== SUONO SEMPLICE (senza file audio) ====

let audioContext = null;
function playSuccessSound() {
    try {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        const duration = 0.12;
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.type = "triangle";
        oscillator.frequency.value = 880;
        gainNode.gain.setValueAtTime(0.11, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration);
    } catch (e) {
        // Se qualcosa non va, semplicemente non suoniamo
    }
}

// ==== BADGE VISIVO ====

const badgeEl = document.getElementById("badge");

function showBadge() {
    if (!badgeEl) return;
    badgeEl.classList.remove("hidden");
    badgeEl.classList.add("show");
    setTimeout(() => {
        badgeEl.classList.remove("show");
    }, 1500);
}

// ==== COSTANTI E STATO ====

const week = getCurrentWeek();
const savedData = loadData();
const container = document.getElementById("days-container");

// Elementi summary
const cardioSummaryEl = document.getElementById("cardio-summary");
const gymSummaryEl = document.getElementById("gym-summary");
const dietSummaryEl = document.getElementById("diet-summary");
const cardioBarEl = document.getElementById("cardio-bar");
const gymBarEl = document.getElementById("gym-bar");
const dietBarEl = document.getElementById("diet-bar");
const todayLabelEl = document.getElementById("today-label");

const todayId = new Date().toISOString().split("T")[0];

// ==== BUILD UI GIORNI ====

week.forEach(day => {
    const dayData = savedData[day.id] || {
        cardio: false,
        workout: "Rest",
        diet: false,
        notes: ""
    };

    const div = document.createElement("div");
    div.className = "day-card";
    div.dataset.dayid = day.id;

    if (day.id === todayId) {
        div.classList.add("today");
        if (todayLabelEl) {
            todayLabelEl.textContent = `Oggi è ${day.label} ${day.date}`;
        }
    }

    div.innerHTML = `
        <div class="day-card-header">
            <div>
                <div class="day-title">${day.label}</div>
                <div class="day-date">${day.date}</div>
            </div>
        </div>

        <div class="checkbox-row">
            <input type="checkbox" id="cardio-${day.id}" ${dayData.cardio ? "checked" : ""}>
            <label for="cardio-${day.id}">Cardio completato (60 min walking pad)</label>
        </div>

        <div class="section-label">Allenamento</div>
        <select id="workout-${day.id}">
            <option value="Leg"  ${dayData.workout === "Leg"  ? "selected" : ""}>Leg</option>
            <option value="Pull" ${dayData.workout === "Pull" ? "selected" : ""}>Pull</option>
            <option value="Push" ${dayData.workout === "Push" ? "selected" : ""}>Push</option>
            <option value="Rest" ${dayData.workout === "Rest" ? "selected" : ""}>Rest</option>
        </select>

        <div class="section-label">Dieta</div>
        <div class="checkbox-row">
            <input type="checkbox" id="diet-${day.id}" ${dayData.diet ? "checked" : ""}>
            <label for="diet-${day.id}">Aderenza piano alimentare</label>
        </div>

        <div class="section-label">Note</div>
        <textarea id="notes-${day.id}" placeholder="Appunti su workout, sensazioni, ecc.">${dayData.notes}</textarea>
    `;

    container.appendChild(div);

    const cardioEl = document.getElementById(`cardio-${day.id}`);
    const workoutEl = document.getElementById(`workout-${day.id}`);
    const dietEl = document.getElementById(`diet-${day.id}`);
    const notesEl = document.getElementById(`notes-${day.id}`);

    function save() {
        savedData[day.id] = {
            cardio: cardioEl.checked,
            workout: workoutEl.value,
            diet: dietEl.checked,
            notes: notesEl.value
        };
        saveData(savedData);
        updateSummary();
        checkDayCompletion(day.id);
    }

    cardioEl.addEventListener("change", () => {
        save();
        if (cardioEl.checked) {
            playSuccessSound();
        }
    });

    workoutEl.addEventListener("change", () => {
        save();
        if (workoutEl.value !== "Rest") {
            playSuccessSound();
        }
    });

    dietEl.addEventListener("change", () => {
        save();
        if (dietEl.checked) {
            playSuccessSound();
        }
    });

    notesEl.addEventListener("input", save);
});

// Scroll automatico al giorno corrente (se presente)
window.addEventListener("load", () => {
    const todayCard = document.querySelector(`.day-card.today`);
    if (todayCard && todayCard.scrollIntoView) {
        todayCard.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    updateSummary();
});

// ==== RIEPILOGO SETTIMANALE ====

function updateSummary() {
    let cardioCount = 0;
    let gymCount = 0;
    let dietCount = 0;

    week.forEach(day => {
        const data = savedData[day.id];
        if (!data) return;
        if (data.cardio) cardioCount++;
        if (data.workout === "Leg" || data.workout === "Pull" || data.workout === "Push") gymCount++;
        if (data.diet) dietCount++;
    });

    const totalDays = week.length;
    const cardioPerc = totalDays ? Math.round((cardioCount / totalDays) * 100) : 0;
    const dietPerc = totalDays ? Math.round((dietCount / totalDays) * 100) : 0;

    const targetGym = 3; // obiettivo settimanale palestra
    const gymPerc = targetGym ? Math.min(100, Math.round((gymCount / targetGym) * 100)) : 0;

    if (cardioSummaryEl) cardioSummaryEl.textContent = `${cardioCount}/${totalDays} (${cardioPerc}%)`;
    if (dietSummaryEl) dietSummaryEl.textContent = `${dietCount}/${totalDays} (${dietPerc}%)`;
    if (gymSummaryEl) gymSummaryEl.textContent = `${gymCount}/${targetGym} (${gymPerc}%)`;

    if (cardioBarEl) cardioBarEl.style.width = `${cardioPerc}%`;
    if (dietBarEl) dietBarEl.style.width = `${dietPerc}%`;
    if (gymBarEl) gymBarEl.style.width = `${gymPerc}%`;
}

// Badge quando una giornata è completa al 100%
function checkDayCompletion(dayId) {
    const data = savedData[dayId];
    if (!data) return;
    const allDone = data.cardio && data.diet &&
        (data.workout === "Leg" || data.workout === "Pull" || data.workout === "Push");
    if (allDone) {
        showBadge();
    }
}

// ==== PROMEMORIA (LIMITI IMPORTANTI SU iOS) ====
//
// Nota importante:
// una web-app statica (GitHub Pages) NON può programmare vere notifiche
// di sistema alle 22:00 se l’app è chiusa o in background.
// Possiamo solo:
// - chiedere il permesso alle notifiche
// - mostrare una notifica mentre la pagina è aperta / attiva
// Per promemoria rigidi alle 22:00 ogni giorno servirebbe una app nativa
// o un backend con push notification.

const reminderBtn = document.getElementById("reminder-btn");

if (reminderBtn && "Notification" in window) {
    reminderBtn.addEventListener("click", async () => {
        try {
            const permission = await Notification.requestPermission();
            if (permission !== "granted") {
                alert("Per i promemoria devi consentire le notifiche al sito.");
                return;
            }
            alert("Permesso notifiche attivato.\nNota: i promemoria funzionano solo quando la pagina è aperta.");
            scheduleInPageReminder();
        } catch (e) {
            console.error(e);
        }
    });
}

function scheduleInPageReminder() {
    // Semplice check: se sono vicino alle 22:00 mostra una notifica.
    // Valido SOLO se la pagina è ancora aperta.
    setInterval(() => {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        if (hours === 22 && minutes === 0) {
            if (Notification.permission === "granted") {
                new Notification("Compila il tuo Motivation Tracker", {
                    body: "Ricordati di segnare cardio, palestra e dieta di oggi.",
                });
            }
        }
    }, 60000); // controlla ogni minuto
}
