// Calendario motivazionale v8
const DATA_KEY = "cm_data_v8";
const CONFIG_KEY = "cm_config_v2";

const REASON_LABELS = {
  tempo: "Mancanza di tempo",
  stanchezza: "Stanchezza",
  salute: "Problemi di salute",
  lavoro: "Impegni di lavoro",
  viaggio: "Viaggio / spostamenti",
  altro: "Altro"
};

function makeIsoLocal(date){
  const y=date.getFullYear();
  const m=String(date.getMonth()+1).padStart(2,"0");
  const d=String(date.getDate()).padStart(2,"0");
  return `${y}-${m}-${d}`;
}
function parseIsoLocal(iso){
  const [y,m,d]=iso.split("-").map(Number);
  return new Date(y,m-1,d);
}
function stripTime(date){ return new Date(date.getFullYear(),date.getMonth(),date.getDate()); }
function formatWeekday(date){ return new Intl.DateTimeFormat("it-IT",{weekday:"long"}).format(date); }
function isLeapYear(y){ return (y%4===0&&y%100!==0)||(y%400===0); }
function daysInMonth(date){ return new Date(date.getFullYear(),date.getMonth()+1,0).getDate(); }
function daysInYear(date){ return isLeapYear(date.getFullYear())?366:365; }
function startOfWeek(date){
  const d=stripTime(date);
  const day=d.getDay();
  const diff=(day===0?-6:1)-day;
  d.setDate(d.getDate()+diff);
  return d;
}
function endOfWeek(date){ const s=startOfWeek(date); const e=new Date(s); e.setDate(s.getDate()+6); return e; }
function startOfMonth(date){ return new Date(date.getFullYear(),date.getMonth(),1); }
function endOfMonth(date){ return new Date(date.getFullYear(),date.getMonth(),daysInMonth(date)); }
function startOfYear(date){ return new Date(date.getFullYear(),0,1); }
function endOfYear(date){ return new Date(date.getFullYear(),11,31); }
function isDateBetween(d,start,end){ const t=d.getTime(); return t>=start.getTime() && t<=end.getTime(); }

function loadJSON(key,fallback){
  try{ const raw=localStorage.getItem(key); return raw?JSON.parse(raw):fallback; }catch{ return fallback; }
}
function saveJSON(key,val){
  try{ localStorage.setItem(key,JSON.stringify(val)); }catch{}
}
function parseNum(v){
  if(v===null||v===undefined) return null;
  const s=String(v).trim().replace(",",".");
  if(!s) return null;
  const n=Number(s);
  return Number.isFinite(n)?n:null;
}
function playSuccessSound(){
  try{
    const AudioCtx=window.AudioContext||window.webkitAudioContext;
    if(!AudioCtx) return;
    const ctx=new AudioCtx();
    const osc=ctx.createOscillator();
    const gain=ctx.createGain();
    osc.type="sine";
    osc.frequency.value=880;
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start();
    gain.gain.setValueAtTime(0.14, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+0.22);
    osc.stop(ctx.currentTime+0.22);
  }catch{}
}

function defaultConfig(){
  return {
    welcomeImage:"",
    welcomeTitle:"Disciplina",
    welcomeText:"Un giorno alla volta.",
    workoutsPerWeek:3,
    restLabel:"Rest",
    workoutTypes:["Push","Pull","Leg"],
    body:{ heightCm:"", startWeight:"", goalWeight:"" }
  };
}

let config = loadJSON(CONFIG_KEY, null);
let dataStore = loadJSON(DATA_KEY, {});
let currentDate = stripTime(new Date());
let statsMode = "week";

function ensureConfig(){
  if(!config) config=defaultConfig();
  if(!config.body) config.body=defaultConfig().body;
  if(!Array.isArray(config.workoutTypes) || config.workoutTypes.length===0) config.workoutTypes=["Allenamento"];
  if(!config.restLabel) config.restLabel="Rest";
  if(!config.workoutsPerWeek || config.workoutsPerWeek<1) config.workoutsPerWeek=3;
}

function workoutOptions(){ return [config.restLabel, ...config.workoutTypes]; }
function isWorkoutDone(val){ return val && val !== config.restLabel; }

function getDayData(date){
  const iso=makeIsoLocal(date);
  if(!dataStore[iso]){
    dataStore[iso]={
      cardio:false, cardioReason:"",
      workout: config.restLabel, workoutReason:"",
      diet:false, dietReason:"",
      weight:null, notes:""
    };
  }
  return dataStore[iso];
}
function isDayComplete(d){ return !!(d.cardio && isWorkoutDone(d.workout) && d.diet); }

function computeWeightPercent(weight){
  const start=parseNum(config.body.startWeight);
  const goal=parseNum(config.body.goalWeight);
  const w=parseNum(weight);
  if(start==null||goal==null||w==null) return 0;
  let p=0;
  if(goal<start){
    const total=start-goal, done=start-w;
    p = total>0 ? Math.round((done/total)*100) : 0;
  }else if(goal>start){
    const total=goal-start, done=w-start;
    p = total>0 ? Math.round((done/total)*100) : 0;
  }else{
    p = (w===goal)?100:0;
  }
  return Math.max(0, Math.min(100, p));
}

function updateBMI(){
  const h=parseNum(document.getElementById("height-cm").value);
  const sw=parseNum(document.getElementById("start-weight-input").value);
  const out=document.getElementById("bmi-output");
  if(!h||!sw){ out.value=""; return; }
  const hm=h/100;
  const bmi=sw/(hm*hm);
  out.value = Number.isFinite(bmi)? bmi.toFixed(1):"";
}

function updateWeightBars(){
  const setupP=computeWeightPercent(document.getElementById("start-weight-input").value);
  document.getElementById("weight-progress-percent").textContent = `${setupP}%`;
  document.getElementById("weight-progress-bar").style.width = `${setupP}%`;

  const day=getDayData(currentDate);
  const w=(day.weight!=null)?day.weight:document.getElementById("start-weight-input").value;
  const mainP=computeWeightPercent(w);
  document.getElementById("weight-progress-percent-main").textContent = `${mainP}%`;
  document.getElementById("weight-progress-bar-main").style.width = `${mainP}%`;
}

function renderHome(){
  ensureConfig();
  document.getElementById("hero-title").textContent = config.welcomeTitle || "Disciplina";
  document.getElementById("hero-subtitle").textContent = config.welcomeText || "Un giorno alla volta.";
  const bg=document.getElementById("hero-bg");
  if(config.welcomeImage){
    bg.style.backgroundImage = `url(${config.welcomeImage})`;
    bg.style.backgroundSize="cover";
    bg.style.backgroundPosition="center";
  }else{
    bg.style.backgroundImage="";
  }
}

function showScreen(id){
  ["screen-home","screen-setup","screen-main"].forEach(s=>document.getElementById(s).classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
}

function renderWorkoutSelect(){
  const sel=document.getElementById("workout-select");
  sel.innerHTML="";
  workoutOptions().forEach(opt=>{
    const o=document.createElement("option");
    o.value=opt; o.textContent=opt;
    sel.appendChild(o);
  });
}

function renderSetup(){
  ensureConfig();
  document.getElementById("welcome-title-input").value = config.welcomeTitle || "";
  document.getElementById("welcome-text-input").value = config.welcomeText || "";
  document.getElementById("workouts-per-week").value = String(config.workoutsPerWeek||3);
  document.getElementById("rest-label").value = config.restLabel || "Rest";
  document.getElementById("height-cm").value = config.body.heightCm || "";
  document.getElementById("start-weight-input").value = config.body.startWeight || "";
  document.getElementById("goal-weight-input").value = config.body.goalWeight || "";
  renderWorkoutSelect();
  updateBMI();
  updateWeightBars();
}

function loadDayToUI(date){
  currentDate=stripTime(date);
  const d=getDayData(currentDate);
  document.getElementById("current-date-input").value = makeIsoLocal(currentDate);
  document.getElementById("current-day-label").textContent = formatWeekday(currentDate);

  document.getElementById("cardio-checkbox").checked = !!d.cardio;
  document.getElementById("cardio-reason-select").value = d.cardioReason || "";

  document.getElementById("workout-select").value = d.workout || config.restLabel;
  document.getElementById("workout-reason-select").value = d.workoutReason || "";

  document.getElementById("diet-checkbox").checked = !!d.diet;
  document.getElementById("diet-reason-select").value = d.dietReason || "";

  document.getElementById("weight-input").value = (d.weight!=null && !Number.isNaN(d.weight)) ? String(d.weight) : "";
  document.getElementById("notes-textarea").value = d.notes || "";

  if(d.cardio) document.getElementById("cardio-reason-select").value="";
  if(isWorkoutDone(document.getElementById("workout-select").value)) document.getElementById("workout-reason-select").value="";
  if(d.diet) document.getElementById("diet-reason-select").value="";

  document.getElementById("day-complete-badge").classList.toggle("hidden", !isDayComplete(d));
  updateWeightBars();
}

function saveCurrentDay(playSound){
  const iso=makeIsoLocal(currentDate);
  const prev=getDayData(currentDate);
  const prevComplete=isDayComplete(prev);

  const next={
    cardio: !!document.getElementById("cardio-checkbox").checked,
    cardioReason: document.getElementById("cardio-checkbox").checked ? "" : (document.getElementById("cardio-reason-select").value||""),
    workout: document.getElementById("workout-select").value || config.restLabel,
    workoutReason: isWorkoutDone(document.getElementById("workout-select").value) ? "" : (document.getElementById("workout-reason-select").value||""),
    diet: !!document.getElementById("diet-checkbox").checked,
    dietReason: document.getElementById("diet-checkbox").checked ? "" : (document.getElementById("diet-reason-select").value||""),
    weight: parseNum(document.getElementById("weight-input").value),
    notes: document.getElementById("notes-textarea").value || ""
  };

  dataStore[iso]=next;
  saveJSON(DATA_KEY, dataStore);

  document.getElementById("day-complete-badge").classList.toggle("hidden", !isDayComplete(next));
  updateAllStats();
  updateWeightBars();

  const nowComplete=isDayComplete(next);
  if(playSound && !prevComplete && nowComplete) playSuccessSound();
}

function computeStatsForRange(start,end){
  let cardioDone=0,gymDone=0,dietDone=0, cardioMiss=0,gymMiss=0,dietMiss=0;
  const cardioReasons={}, gymReasons={}, dietReasons={};

  Object.keys(dataStore).forEach(key=>{
    const d=stripTime(parseIsoLocal(key));
    if(isNaN(d) || !isDateBetween(d,start,end)) return;
    const day=dataStore[key]||{};
    const wDone=isWorkoutDone(day.workout);

    if(day.cardio) cardioDone++; else if(day.cardioReason){ cardioMiss++; cardioReasons[day.cardioReason]=(cardioReasons[day.cardioReason]||0)+1; }
    if(wDone) gymDone++; else if(day.workoutReason){ gymMiss++; gymReasons[day.workoutReason]=(gymReasons[day.workoutReason]||0)+1; }
    if(day.diet) dietDone++; else if(day.dietReason){ dietMiss++; dietReasons[day.dietReason]=(dietReasons[day.dietReason]||0)+1; }
  });

  return {cardioDone,gymDone,dietDone,cardioMiss,gymMiss,dietMiss,cardioReasons,gymReasons,dietReasons};
}

function setText(id,txt){ const el=document.getElementById(id); if(el) el.textContent=txt; }
function setBar(id,p){ const el=document.getElementById(id); if(el) el.style.width=`${Math.max(0,Math.min(100,p))}%`; }

function updateStatsMode(mode){
  statsMode=mode;
  const today=stripTime(new Date());
  const weekGym=Number(config.workoutsPerWeek||3);
  const monthGym=weekGym*4;
  const yearGym=weekGym*52;

  let start,end,label,cardioTarget,dietTarget,gymTarget;
  if(mode==="week"){
    start=startOfWeek(today); end=endOfWeek(today);
    label="Settimana corrente"; cardioTarget=7; dietTarget=7; gymTarget=weekGym;
  }else if(mode==="month"){
    start=new Date(today.getFullYear(),today.getMonth(),1);
    end=endOfMonth(today);
    label="Mese corrente"; const dim=daysInMonth(today); cardioTarget=dim; dietTarget=dim; gymTarget=monthGym;
  }else{
    start=startOfYear(today); end=endOfYear(today);
    label="Anno corrente"; const diy=daysInYear(today); cardioTarget=diy; dietTarget=diy; gymTarget=yearGym;
  }

  setText("stats-mode-label", label);
  const s=computeStatsForRange(start,end);

  setText("stats-cardio-value", `${s.cardioDone} / ${cardioTarget}`);
  setText("stats-gym-value", `${s.gymDone} / ${gymTarget}`);
  setText("stats-diet-value", `${s.dietDone} / ${dietTarget}`);

  const cp=cardioTarget?Math.round((s.cardioDone/cardioTarget)*100):0;
  const gp=gymTarget?Math.round((s.gymDone/gymTarget)*100):0;
  const dp=dietTarget?Math.round((s.dietDone/dietTarget)*100):0;

  setText("stats-cardio-percent", `${Math.max(0,Math.min(100,cp))}%`);
  setText("stats-gym-percent", `${Math.max(0,Math.min(100,gp))}%`);
  setText("stats-diet-percent", `${Math.max(0,Math.min(100,dp))}%`);

  setBar("stats-cardio-progress", cp);
  setBar("stats-gym-progress", gp);
  setBar("stats-diet-progress", dp);

  setText("stats-cardio-missed-total", String(s.cardioMiss));
  setText("stats-gym-missed-total", String(s.gymMiss));
  setText("stats-diet-missed-total", String(s.dietMiss));

  const reasons=document.getElementById("stats-reasons-list");
  reasons.innerHTML="";
  function add(cat,map){
    Object.keys(map).forEach(k=>{
      const p=document.createElement("p");
      p.textContent = `${cat} – ${(REASON_LABELS[k]||k)}: ${map[k]}`;
      reasons.appendChild(p);
    });
  }
  add("Cardio", s.cardioReasons); add("Allenamenti", s.gymReasons); add("Dieta", s.dietReasons);
  if(!reasons.innerHTML){
    const p=document.createElement("p"); p.textContent="Nessun motivo registrato nell’intervallo selezionato.";
    reasons.appendChild(p);
  }

  document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active", b.dataset.mode===mode));
}
function updateAllStats(){ updateStatsMode(statsMode); }

function updateRangeStats(){
  const startVal=document.getElementById("range-start").value;
  const endVal=document.getElementById("range-end").value;
  if(!startVal||!endVal){
    setText("range-cardio-count","0"); setText("range-gym-count","0"); setText("range-diet-count","0"); return;
  }
  const start=stripTime(parseIsoLocal(startVal));
  const end=stripTime(parseIsoLocal(endVal));
  if(isNaN(start)||isNaN(end)||start>end){
    setText("range-cardio-count","0"); setText("range-gym-count","0"); setText("range-diet-count","0"); return;
  }
  const s=computeStatsForRange(start,end);
  setText("range-cardio-count", String(s.cardioDone));
  setText("range-gym-count", String(s.gymDone));
  setText("range-diet-count", String(s.dietDone));
}

function openSheet(){
  document.getElementById("range-backdrop").classList.remove("hidden");
  document.getElementById("range-sheet").classList.remove("hidden");
}
function closeSheet(){
  document.getElementById("range-backdrop").classList.add("hidden");
  document.getElementById("range-sheet").classList.add("hidden");
}

// Wiring
(function init(){
  ensureConfig();
  renderHome();
  renderWorkoutSelect();
  loadDayToUI(currentDate);

  // default range = current week
  const today=stripTime(new Date());
  const s=startOfWeek(today), e=endOfWeek(today);
  document.getElementById("range-start").value = makeIsoLocal(s);
  document.getElementById("range-end").value = makeIsoLocal(e);

  updateAllStats();
  updateRangeStats();

  document.getElementById("btn-open-calendar").addEventListener("click", ()=>{ showScreen("screen-main"); renderWorkoutSelect(); loadDayToUI(currentDate); updateAllStats(); });
  document.getElementById("btn-open-setup").addEventListener("click", ()=>{ showScreen("screen-setup"); renderSetup(); });
  document.getElementById("btn-setup-back").addEventListener("click", ()=>{ showScreen("screen-home"); renderHome(); });
  document.getElementById("btn-main-back").addEventListener("click", ()=>{ showScreen("screen-home"); renderHome(); });
  document.getElementById("btn-main-setup").addEventListener("click", ()=>{ showScreen("screen-setup"); renderSetup(); });

  document.getElementById("btn-add-workout-type").addEventListener("click", ()=>{
    const v=(document.getElementById("workout-type-new").value||"").trim();
    if(!v) return;
    if(!Array.isArray(config.workoutTypes)) config.workoutTypes=[];
    config.workoutTypes.push(v);
    document.getElementById("workout-type-new").value="";
    renderWorkoutSelect();
    saveJSON(CONFIG_KEY, config);
  });

  document.getElementById("welcome-image-input").addEventListener("change", (e)=>{
    const file=e.target.files && e.target.files[0];
    if(!file) return;
    const reader=new FileReader();
    reader.onload=()=>{ config.welcomeImage=String(reader.result||""); saveJSON(CONFIG_KEY, config); renderHome(); };
    reader.readAsDataURL(file);
  });

  document.getElementById("btn-save-setup").addEventListener("click", ()=>{
    config.welcomeTitle=(document.getElementById("welcome-title-input").value||"").trim() || "Disciplina";
    config.welcomeText=(document.getElementById("welcome-text-input").value||"").trim() || "Un giorno alla volta.";
    config.workoutsPerWeek=Math.max(1, Math.min(14, Number(document.getElementById("workouts-per-week").value||3)));
    config.restLabel=(document.getElementById("rest-label").value||"").trim() || "Rest";
    config.body.heightCm=(document.getElementById("height-cm").value||"").trim();
    config.body.startWeight=(document.getElementById("start-weight-input").value||"").trim();
    config.body.goalWeight=(document.getElementById("goal-weight-input").value||"").trim();
    saveJSON(CONFIG_KEY, config);
    renderHome();
    showScreen("screen-home");
  });

  ["height-cm","start-weight-input","goal-weight-input"].forEach(id=>{
    document.getElementById(id).addEventListener("input", ()=>{ updateBMI(); updateWeightBars(); });
  });

  document.getElementById("cardio-checkbox").addEventListener("change", ()=>{ if(document.getElementById("cardio-checkbox").checked) document.getElementById("cardio-reason-select").value=""; saveCurrentDay(true); });
  document.getElementById("cardio-reason-select").addEventListener("change", ()=>saveCurrentDay(false));
  document.getElementById("workout-select").addEventListener("change", ()=>{ if(isWorkoutDone(document.getElementById("workout-select").value)) document.getElementById("workout-reason-select").value=""; saveCurrentDay(true); });
  document.getElementById("workout-reason-select").addEventListener("change", ()=>saveCurrentDay(false));
  document.getElementById("diet-checkbox").addEventListener("change", ()=>{ if(document.getElementById("diet-checkbox").checked) document.getElementById("diet-reason-select").value=""; saveCurrentDay(true); });
  document.getElementById("diet-reason-select").addEventListener("change", ()=>saveCurrentDay(false));
  document.getElementById("weight-input").addEventListener("input", ()=>saveCurrentDay(false));
  document.getElementById("notes-textarea").addEventListener("input", ()=>saveCurrentDay(false));

  document.getElementById("prev-day-btn").addEventListener("click", ()=>{ currentDate.setDate(currentDate.getDate()-1); loadDayToUI(currentDate); });
  document.getElementById("next-day-btn").addEventListener("click", ()=>{ currentDate.setDate(currentDate.getDate()+1); loadDayToUI(currentDate); });
  document.getElementById("today-btn").addEventListener("click", ()=>{ currentDate=stripTime(new Date()); loadDayToUI(currentDate); });
  document.getElementById("current-date-input").addEventListener("change", ()=>{ const v=document.getElementById("current-date-input").value; if(!v) return; const d=parseIsoLocal(v); if(isNaN(d)) return; loadDayToUI(d); });

  document.querySelectorAll(".tab").forEach(btn=>btn.addEventListener("click", ()=>updateStatsMode(btn.dataset.mode)));

  document.getElementById("btn-open-range").addEventListener("click", openSheet);
  document.getElementById("btn-close-range").addEventListener("click", closeSheet);
  document.getElementById("range-backdrop").addEventListener("click", closeSheet);
  document.getElementById("range-calc-btn").addEventListener("click", updateRangeStats);
})();
