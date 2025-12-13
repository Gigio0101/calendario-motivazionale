// v13 hotfix: intervallo personalizzato in modale + fix UI
const STORAGE_KEY = "motivationalCalendarV6";

const REASON_LABELS = {
  tempo: "Mancanza di tempo",
  stanchezza: "Stanchezza",
  salute: "Problemi di salute",
  lavoro: "Impegni di lavoro",
  viaggio: "Viaggio / spostamenti",
  altro: "Altro"
};

function makeIsoLocal(date){const y=date.getFullYear();const m=String(date.getMonth()+1).padStart(2,"0");const d=String(date.getDate()).padStart(2,"0");return `${y}-${m}-${d}`;}
function parseIsoLocal(iso){const [y,m,d]=iso.split("-").map(Number);return new Date(y,m-1,d);}
function stripTime(date){return new Date(date.getFullYear(),date.getMonth(),date.getDate());}

function loadData(){try{const raw=localStorage.getItem(STORAGE_KEY);return raw?JSON.parse(raw):{};}catch(e){console.error(e);return{};}}
function saveData(data){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(data));}catch(e){console.error(e);}}
function isGymWorkout(type){return type==="Leg"||type==="Pull"||type==="Push";}
function isLeapYear(year){return (year%4===0&&year%100!==0)||(year%400===0);}
function daysInMonth(date){return new Date(date.getFullYear(),date.getMonth()+1,0).getDate();}
function daysInYear(date){return isLeapYear(date.getFullYear())?366:365;}
function startOfWeek(date){const d=stripTime(date);const day=d.getDay();const diffToMonday=(day===0?-6:1)-day;d.setDate(d.getDate()+diffToMonday);return d;}
function endOfWeek(date){const s=startOfWeek(date);const e=new Date(s);e.setDate(s.getDate()+6);return e;}
function startOfMonth(date){return new Date(date.getFullYear(),date.getMonth(),1);}
function endOfMonth(date){return new Date(date.getFullYear(),date.getMonth(),daysInMonth(date));}
function startOfYear(date){return new Date(date.getFullYear(),0,1);}
function endOfYear(date){return new Date(date.getFullYear(),11,31);}
function formatItalianWeekday(date){return new Intl.DateTimeFormat("it-IT",{weekday:"long"}).format(date);}
function isDateBetween(d,start,end){const t=d.getTime();return t>=start.getTime()&&t<=end.getTime();}

let savedData=loadData();
let currentDate=stripTime(new Date());
let currentStatsMode="week";

const WEEKLY_CARDIO_TARGET=7;
const WEEKLY_GYM_TARGET=3;
const WEEKLY_DIET_TARGET=7;
const WEEKS_IN_MONTH=4;
const WEEKS_IN_YEAR=52;
const MONTHLY_GYM_TARGET=WEEKLY_GYM_TARGET*WEEKS_IN_MONTH;
const YEARLY_GYM_TARGET=WEEKLY_GYM_TARGET*WEEKS_IN_YEAR;

function playSuccessSound(){try{const AudioCtx=window.AudioContext||window.webkitAudioContext;if(!AudioCtx)return;const ctx=new AudioCtx();const osc=ctx.createOscillator();const gain=ctx.createGain();osc.type="sine";osc.frequency.value=880;osc.connect(gain);gain.connect(ctx.destination);osc.start();gain.gain.setValueAtTime(0.15,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+0.25);osc.stop(ctx.currentTime+0.25);}catch(e){}}

const cardioCheckbox=document.getElementById("cardio-checkbox");
const cardioReasonSelect=document.getElementById("cardio-reason-select");
const workoutSelect=document.getElementById("workout-select");
const workoutReasonSelect=document.getElementById("workout-reason-select");
const dietCheckbox=document.getElementById("diet-checkbox");
const dietReasonSelect=document.getElementById("diet-reason-select");
const weightInput=document.getElementById("weight-input");
const notesTextarea=document.getElementById("notes-textarea");

const currentDateInput=document.getElementById("current-date-input");
const currentDayLabel=document.getElementById("current-day-label");
const prevDayBtn=document.getElementById("prev-day-btn");
const nextDayBtn=document.getElementById("next-day-btn");
const todayBtn=document.getElementById("today-btn");
const dayCompleteBadge=document.getElementById("day-complete-badge");

const statsTabs=document.querySelectorAll(".stats-tab");
const statsModeLabel=document.getElementById("stats-mode-label");

const rangeStartInput=document.getElementById("range-start");
const rangeEndInput=document.getElementById("range-end");
const rangeCalcBtn=document.getElementById("range-calc-btn");

// modal range
const rangeModal=document.getElementById("range-modal");
const openRangeBtn=document.getElementById("open-range-btn");
const rangeModalCloseBackdrop=document.getElementById("range-modal-close");
const rangeModalX=document.getElementById("range-modal-x");

function openRangeModal(){rangeModal.classList.remove("hidden");}
function closeRangeModal(){rangeModal.classList.add("hidden");}

function getDayData(date){
  const iso=makeIsoLocal(date);
  if(!savedData[iso]){
    savedData[iso]={cardio:false,cardioReason:"",workout:"Rest",workoutReason:"",diet:false,dietReason:"",weight:null,notes:""};
  }else{
    const d=savedData[iso];
    if(typeof d.cardio!=="boolean")d.cardio=!!d.cardio;
    if(typeof d.cardioReason!=="string")d.cardioReason="";
    if(!d.workout)d.workout="Rest";
    if(typeof d.workoutReason!=="string")d.workoutReason="";
    if(typeof d.diet!=="boolean")d.diet=!!d.diet;
    if(typeof d.dietReason!=="string")d.dietReason="";
    if(d.weight===undefined)d.weight=null;
    if(d.weight!==null&&d.weight!==""&&typeof d.weight!=="number"){const num=Number(String(d.weight).replace(",","."));d.weight=isNaN(num)?null:num;}
    if(typeof d.notes!=="string")d.notes=d.notes||"";
  }
  return savedData[iso];
}
function isDayComplete(dayData){return !!(dayData&&dayData.cardio&&isGymWorkout(dayData.workout)&&dayData.diet);}

function loadDayToUI(date){
  currentDate=stripTime(date);
  const data=getDayData(currentDate);

  currentDateInput.value=makeIsoLocal(currentDate);
  currentDayLabel.textContent=formatItalianWeekday(currentDate);

  cardioCheckbox.checked=!!data.cardio;
  cardioReasonSelect.value=data.cardioReason||"";

  workoutSelect.value=data.workout||"Rest";
  workoutReasonSelect.value=data.workoutReason||"";

  dietCheckbox.checked=!!data.diet;
  dietReasonSelect.value=data.dietReason||"";

  weightInput.value=(data.weight!=null&&!isNaN(data.weight))?String(data.weight):"";
  notesTextarea.value=data.notes||"";

  if(cardioCheckbox.checked)cardioReasonSelect.value="";
  if(isGymWorkout(workoutSelect.value))workoutReasonSelect.value="";
  if(dietCheckbox.checked)dietReasonSelect.value="";

  updateDayCompleteBadge();
}

function saveCurrentDay(playSound){
  const iso=makeIsoLocal(currentDate);
  const prevData=getDayData(currentDate);
  const prevComplete=isDayComplete(prevData);

  const weightVal=(weightInput.value||"").toString().trim();
  let weightNum=null;
  if(weightVal!==""){const parsed=Number(weightVal.replace(",", "."));weightNum=isNaN(parsed)?null:parsed;}

  const newData={
    cardio:!!cardioCheckbox.checked,
    cardioReason: cardioCheckbox.checked ? "" : (cardioReasonSelect.value||""),
    workout: workoutSelect.value || "Rest",
    workoutReason: isGymWorkout(workoutSelect.value) ? "" : (workoutReasonSelect.value||""),
    diet: !!dietCheckbox.checked,
    dietReason: dietCheckbox.checked ? "" : (dietReasonSelect.value||""),
    weight: weightNum,
    notes: notesTextarea.value || ""
  };

  savedData[iso]=newData;
  saveData(savedData);

  updateDayCompleteBadge();
  updateAllStats();
  updateCustomRangeStats();

  const nowComplete=isDayComplete(newData);
  if(playSound&&!prevComplete&&nowComplete)playSuccessSound();
}

function updateDayCompleteBadge(){
  const data=getDayData(currentDate);
  dayCompleteBadge.style.display=isDayComplete(data)?"inline-flex":"none";
}

function computeStatsForRange(start,end){
  let cardioDone=0,gymDone=0,dietDone=0;
  let cardioMiss=0,gymMiss=0,dietMiss=0;
  const cardioReasons={},gymReasons={},dietReasons={};

  Object.keys(savedData).forEach(key=>{
    if(key.startsWith("_"))return;
    const d=stripTime(parseIsoLocal(key));
    if(isNaN(d))return;
    if(!isDateBetween(d,start,end))return;

    const data=getDayData(d);
    const isGym=isGymWorkout(data.workout);

    if(data.cardio)cardioDone++;
    else if(data.cardioReason){cardioMiss++;cardioReasons[data.cardioReason]=(cardioReasons[data.cardioReason]||0)+1;}

    if(isGym)gymDone++;
    else if(data.workoutReason){gymMiss++;gymReasons[data.workoutReason]=(gymReasons[data.workoutReason]||0)+1;}

    if(data.diet)dietDone++;
    else if(data.dietReason){dietMiss++;dietReasons[data.dietReason]=(dietReasons[data.dietReason]||0)+1;}
  });

  return {cardioDone,gymDone,dietDone,cardioMiss,gymMiss,dietMiss,cardioReasons,gymReasons,dietReasons};
}

function setText(id,text){const el=document.getElementById(id);if(el)el.textContent=text;}
function setProgress(id,percent){const el=document.getElementById(id);if(el)el.style.width=`${Math.max(0,Math.min(100,percent))}%`;}

function updateStatsMode(mode){
  currentStatsMode=mode;

  const today=stripTime(new Date());
  let start,end,cardioTarget,gymTarget,dietTarget,labelText;

  if(mode==="week"){
    start=startOfWeek(today);end=endOfWeek(today);
    cardioTarget=WEEKLY_CARDIO_TARGET;gymTarget=WEEKLY_GYM_TARGET;dietTarget=WEEKLY_DIET_TARGET;
    labelText="Settimana corrente";
  }else if(mode==="month"){
    start=startOfMonth(today);end=endOfMonth(today);
    const dim=daysInMonth(today);
    cardioTarget=dim;dietTarget=dim;gymTarget=MONTHLY_GYM_TARGET;
    labelText="Mese corrente";
  }else{
    start=startOfYear(today);end=endOfYear(today);
    const diy=daysInYear(today);
    cardioTarget=diy;dietTarget=diy;gymTarget=YEARLY_GYM_TARGET;
    labelText="Anno corrente";
  }

  statsModeLabel.textContent=labelText;

  const stats=computeStatsForRange(start,end);

  setText("stats-cardio-value", `${stats.cardioDone} / ${cardioTarget}`);
  setText("stats-gym-value", `${stats.gymDone} / ${gymTarget}`);
  setText("stats-diet-value", `${stats.dietDone} / ${dietTarget}`);

  const cardioPct=cardioTarget?Math.round((stats.cardioDone/cardioTarget)*100):0;
  const gymPct=gymTarget?Math.round((stats.gymDone/gymTarget)*100):0;
  const dietPct=dietTarget?Math.round((stats.dietDone/dietTarget)*100):0;

  setText("stats-cardio-percent", `${Math.max(0,Math.min(100,cardioPct||0))}%`);
  setText("stats-gym-percent", `${Math.max(0,Math.min(100,gymPct||0))}%`);
  setText("stats-diet-percent", `${Math.max(0,Math.min(100,dietPct||0))}%`);

  setProgress("stats-cardio-progress", cardioPct||0);
  setProgress("stats-gym-progress", gymPct||0);
  setProgress("stats-diet-progress", dietPct||0);

  setText("stats-cardio-missed-total", String(stats.cardioMiss));
  setText("stats-gym-missed-total", String(stats.gymMiss));
  setText("stats-diet-missed-total", String(stats.dietMiss));

  const reasonsDiv=document.getElementById("stats-reasons-list");
  if(reasonsDiv){
    reasonsDiv.innerHTML="";
    function append(category,map){
      Object.keys(map).forEach(k=>{
        const p=document.createElement("p");
        const label=REASON_LABELS[k]||k;
        p.textContent=`${category} – ${label}: ${map[k]}`;
        reasonsDiv.appendChild(p);
      });
    }
    append("Cardio", stats.cardioReasons);
    append("Allenamenti", stats.gymReasons);
    append("Dieta", stats.dietReasons);
    if(!reasonsDiv.innerHTML){
      const p=document.createElement("p");
      p.textContent="Nessun motivo registrato nell'intervallo selezionato.";
      reasonsDiv.appendChild(p);
    }
  }

  statsTabs.forEach(btn=>btn.classList.toggle("active", btn.dataset.mode===mode));
}
function updateAllStats(){updateStatsMode(currentStatsMode);}

function updateCustomRangeStats(){
  const startVal=rangeStartInput.value;
  const endVal=rangeEndInput.value;

  if(!startVal||!endVal){
    setText("range-cardio-count","0");
    setText("range-gym-count","0");
    setText("range-diet-count","0");
    return;
  }

  const start=stripTime(parseIsoLocal(startVal));
  const end=stripTime(parseIsoLocal(endVal));
  if(isNaN(start)||isNaN(end)||start>end){
    setText("range-cardio-count","0");
    setText("range-gym-count","0");
    setText("range-diet-count","0");
    return;
  }

  const stats=computeStatsForRange(start,end);
  setText("range-cardio-count", String(stats.cardioDone));
  setText("range-gym-count", String(stats.gymDone));
  setText("range-diet-count", String(stats.dietDone));
}

function maybeRequestNotificationPermission(){
  if(!("Notification" in window))return;
  if(Notification.permission==="default"){Notification.requestPermission().catch(()=>{});}
}
function scheduleDailyReminder(){
  if(!("Notification" in window))return;
  if(Notification.permission!=="granted")return;
  let lastNotified=null;
  setInterval(()=>{
    const now=new Date();
    const hours=now.getHours();
    const minutes=now.getMinutes();
    const todayKey=makeIsoLocal(now);
    if(hours===22 && minutes>=0 && minutes<=5){
      if(lastNotified!==todayKey){
        new Notification("Compila il calendario",{body:"Segna cardio, allenamento, dieta e peso per oggi."});
        lastNotified=todayKey;
      }
    }
  },60000);
}

// listeners
cardioCheckbox.addEventListener("change", ()=>{if(cardioCheckbox.checked)cardioReasonSelect.value="";saveCurrentDay(true);});
cardioReasonSelect.addEventListener("change", ()=>saveCurrentDay(false));

workoutSelect.addEventListener("change", ()=>{if(isGymWorkout(workoutSelect.value))workoutReasonSelect.value="";saveCurrentDay(true);});
workoutReasonSelect.addEventListener("change", ()=>saveCurrentDay(false));

dietCheckbox.addEventListener("change", ()=>{if(dietCheckbox.checked)dietReasonSelect.value="";saveCurrentDay(true);});
dietReasonSelect.addEventListener("change", ()=>saveCurrentDay(false));

weightInput.addEventListener("input", ()=>saveCurrentDay(false));
notesTextarea.addEventListener("input", ()=>saveCurrentDay(false));

prevDayBtn.addEventListener("click", ()=>{currentDate.setDate(currentDate.getDate()-1);loadDayToUI(currentDate);});
nextDayBtn.addEventListener("click", ()=>{currentDate.setDate(currentDate.getDate()+1);loadDayToUI(currentDate);});
todayBtn.addEventListener("click", ()=>{currentDate=stripTime(new Date());loadDayToUI(currentDate);});

currentDateInput.addEventListener("change", ()=>{if(!currentDateInput.value)return;const d=parseIsoLocal(currentDateInput.value);if(isNaN(d))return;loadDayToUI(d);});

rangeCalcBtn.addEventListener("click", updateCustomRangeStats);

statsTabs.forEach(btn=>btn.addEventListener("click", ()=>{const mode=btn.dataset.mode;if(!mode)return;updateStatsMode(mode);}))

openRangeBtn.addEventListener("click", openRangeModal);
rangeModalCloseBackdrop.addEventListener("click", closeRangeModal);
rangeModalX.addEventListener("click", closeRangeModal);
document.addEventListener("keydown", (e)=>{if(e.key==="Escape")closeRangeModal();});

(function init(){
  loadDayToUI(currentDate);

  const today=stripTime(new Date());
  const wStart=startOfWeek(today);
  const wEnd=endOfWeek(today);
  rangeStartInput.value=makeIsoLocal(wStart);
  rangeEndInput.value=makeIsoLocal(wEnd);

  updateAllStats();
  updateCustomRangeStats();
  maybeRequestNotificationPermission();
  scheduleDailyReminder();
})();