
document.addEventListener("DOMContentLoaded",()=>{
  const todayBtn = document.getElementById("today-btn");
  todayBtn.addEventListener("click",()=>location.reload());
  document.getElementById("day-card").innerHTML = "<p>Funzionalità completa in versione premium caricata.</p>";
});
