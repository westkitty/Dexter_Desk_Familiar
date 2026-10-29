// Deliberately modest. One authored wander, with a long cooldown and injected chance.
export function chooseAmbientRoutine({state,idleMs=0,now,lastRoutineAt=0,random=Math.random,visible=true,manualNap=false,deskOpen=false}={}) {
  if(!visible||manualNap||deskOpen||!(state==="idle"||state==="watching")) return null;
  if(!Number.isFinite(now)||!Number.isFinite(lastRoutineAt)||now-lastRoutineAt<45000||idleMs<7000) return null;
  const chance=Number(random());
  if(!Number.isFinite(chance)||chance<0||chance>=0.22) return null;
  return {state:"wandering",ttlMs:2900};
}
