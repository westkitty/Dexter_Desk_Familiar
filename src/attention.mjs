// Voluntary local presence. This governor never reads activity outside the page.
export function createAttentionBudget({hourlyCap=3,windowMs=3600000,minGapMs=240000}={}){
 const cap=Number.isInteger(hourlyCap)&&hourlyCap>=0?hourlyCap:3;
 const window=Number.isFinite(windowMs)&&windowMs>0?windowMs:3600000;
 const gap=Number.isFinite(minGapMs)&&minGapMs>=0?minGapMs:240000;
 let entries=[],last=-Infinity;
 const prune=now=>{entries=entries.filter(t=>t<=now&&now-t<window);};
 function eligible({now=Date.now(),visible=true,quiet=false,sleeping=false,deskOpen=false,settingsOpen=false,reducedMotion=false}={}){
  if(!Number.isFinite(now)||!visible||quiet||sleeping||deskOpen||settingsOpen||reducedMotion)return false;
  prune(now);
  return entries.length<cap&&now-last>=gap;
 }
 function record(now=Date.now()){
  if(!Number.isFinite(now))return false;
  prune(now);
  if(entries.length>=cap||now-last<gap)return false;
  entries.push(now);last=now;return true;
 }
 function snapshot(now=Date.now()){if(Number.isFinite(now))prune(now);return {used:entries.length,cap,last};}
 function reset(){entries=[];last=-Infinity;}
 return {eligible,record,snapshot,reset};
}
