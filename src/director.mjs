// Deliberately modest. One authored wander, with a long cooldown and injected chance.
export function chooseAmbientRoutine({state,idleMs=0,now,lastRoutineAt=0,random=Math.random,visible=true,manualNap=false,deskOpen=false}={}) {
  if(!visible||manualNap||deskOpen||!(state==="idle"||state==="watching")) return null;
  if(!Number.isFinite(now)||!Number.isFinite(lastRoutineAt)||now-lastRoutineAt<45000||idleMs<7000) return null;
  const chance=Number(random());
  if(!Number.isFinite(chance)||chance<0||chance>=0.22) return null;
  return {state:"wandering",ttlMs:2900};
}

// Read only the clock already available inside the page. No location or OS query.
export function lightBand(hour){
 if(!Number.isInteger(hour)||hour<0||hour>23)return "day";
 if(hour>=6&&hour<11)return "morning";
 if(hour>=11&&hour<18)return "day";
 if(hour>=18&&hour<22)return "evening";
 return "night";
}
