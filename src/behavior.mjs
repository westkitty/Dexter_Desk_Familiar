export const STATES=Object.freeze(["idle","watching","working","judging","wandering","resting","sleeping","huffing","eating"]);
export class FamiliarBus {
  constructor({limit=48}={}) { this.active=[]; this.sequence=0; this.limit=Number.isInteger(limit)&&limit>0?limit:48; }
  publish(state,priority=10,durationMs=1700,now=Date.now()) {
    if(!STATES.includes(state)) throw new TypeError("Unknown familiar state: "+state);
    if(![priority,durationMs,now].every(Number.isFinite)||durationMs<=0) throw new TypeError("Invalid signal priority, duration or time");
    this.active=this.active.filter(item=>item.until>now);
    const signal={state,priority,until:now+durationMs,sequence:++this.sequence};
    this.active.push(signal);
    if(this.active.length>this.limit) this.active.splice(0,this.active.length-this.limit);
    return signal.sequence;
  }
  current(now=Date.now()) {
    if(!Number.isFinite(now)) throw new TypeError("Invalid current time");
    this.active=this.active.filter(item=>item.until>now);
    let winner=null;
    for(const item of this.active) {
      if(!winner||item.priority>winner.priority||(item.priority===winner.priority&&item.sequence>winner.sequence)) winner=item;
    }
    return winner?.state??null;
  }
  clear(){this.active=[];}
}
export function ambientState({now=Date.now(),lastActivity=now,idleMs=60000,typingKeys=0,night=false,manualNap=false,visible=true}={}) {
  if(manualNap||!visible) return "sleeping";
  const idle=Number.isFinite(idleMs)&&idleMs>0?idleMs:60000;
  const since=Number.isFinite(now)&&Number.isFinite(lastActivity)?Math.max(0,now-lastActivity):0;
  if(since>=idle*2) return "sleeping";
  if(since>=idle) return "resting";
  if(typingKeys>=9) return "working";
  if(night&&since>=15000) return "resting";
  if(since<7000) return "watching";
  return "idle";
}
export function effectiveState(bus,context={}) {
  if(context.visible===false)return "sleeping";
  const forced=bus.current(context.now??Date.now());
  if(context.manualNap) return forced==="eating"?"eating":"sleeping";
  return forced??ambientState(context);
}
