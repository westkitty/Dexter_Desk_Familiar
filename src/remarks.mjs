// Ephemeral interaction cadence. The original dialogue wins when action-specific.
const LINES=Object.freeze({
 eating:Object.freeze(["Very well. One treat.","This is beginning to look like a negotiation.","Bribery. Continue."]),
 huffing:Object.freeze(["Hff. An official protest.","My objection remains on record.","Your appeal has been denied."]),
 watching:Object.freeze(["Personal space is a concept.","Yes. It is still me.","This inspection is concluded."])
});
const DEFAULTS=Object.freeze({eating:LINES.eating[0],huffing:LINES.huffing[0],watching:LINES.watching[0]});
export function createRemarks({windowMs=12000}={}){
 const interval=Number.isFinite(windowMs)&&windowMs>0?windowMs:12000;
 let last=null,lastTime=-Infinity,streak=0;
 function choose(state,original,now=Date.now()){
  if(!LINES[state]||original!==DEFAULTS[state]||!Number.isFinite(now))return original;
  streak=state===last&&now>=lastTime&&now-lastTime<=interval?Math.min(3,streak+1):1;
  last=state;lastTime=now;return LINES[state][streak-1];
 }
 function reset(){last=null;lastTime=-Infinity;streak=0;}
 return {choose,reset};
}
