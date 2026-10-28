export const STATES=Object.freeze(["idle","watching","working","judging","wandering","resting","sleeping","huffing","eating"]);
export class FamiliarBus{
 constructor(){this.active=[];this.sequence=0}
 publish(state,priority=10,durationMs=1700,now=Date.now()){
  if(!STATES.includes(state))throw new TypeError("Unknown familiar state: "+state);
  this.active.push({state,priority,until:now+Math.max(1,durationMs),sequence:++this.sequence});
  if(this.active.length>48)this.active=this.active.slice(-48);
 }
 current(now=Date.now()){
  this.active=this.active.filter(s=>s.until>now);
  if(!this.active.length)return null;
  const ordered=this.active.slice().sort((a,b)=>b.priority-a.priority||b.sequence-a.sequence);
  return ordered[0].state;
 }
 clear(){this.active=[]}
}
export function ambientState({now=Date.now(),lastActivity=now,idleMs=60000,typingKeys=0,night=false,manualNap=false,visible=true}={}){
 if(manualNap||!visible)return "sleeping";
 const quietFor=Math.max(0,now-lastActivity);
 if(quietFor>=idleMs*2)return "sleeping";
 if(quietFor>=idleMs)return "resting";
 if(typingKeys>=9)return "working";
 if(night&&quietFor>=15000)return "resting";
 if(quietFor<7000)return "watching";
 return "idle";
}
export function effectiveState(bus,context){
 const forced=bus.current(context.now);
 if(context.manualNap)return forced==="eating"?"eating":"sleeping";
 return forced||ambientState(context);
}
