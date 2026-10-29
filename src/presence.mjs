// All coordinates and motion samples exist only in this browser tab's memory.
export function createPointerPresence({cooldownMs=12000,dwellMs=850,fastSpeed=680}={}){
 let previous=null,stillSince=null,lastSignal=-Infinity;
 function reset(){previous=null;stillSince=null;}
 function observe({x,y,now,near=true,allowed=true}={}){
  if(!allowed||!near||![x,y,now].every(Number.isFinite)){reset();return null;}
  if(!previous){previous={x,y,now};stillSince=now;return null;}
  const dt=now-previous.now;
  if(dt<=0||dt>2500){previous={x,y,now};stillSince=now;return null;}
  const distance=Math.hypot(x-previous.x,y-previous.y);
  const speed=distance*1000/dt;
  previous={x,y,now};
  if(speed>40)stillSince=now;
  if(now-lastSignal<cooldownMs)return null;
  if(speed>=fastSpeed&&dt>=16){
    lastSignal=now;stillSince=now;
    return {state:"watching",priority:18,durationMs:950,reason:"approach"};
  }
  if(speed<=40&&stillSince!==null&&now-stillSince>=dwellMs){
    lastSignal=now;stillSince=now;
    return {state:"watching",priority:13,durationMs:1200,reason:"dwell"};
  }
  return null;
 }
 return {observe,reset};
}
export function createPokeRhythm({windowMs=1300}={}){
 const window=Number.isFinite(windowMs)&&windowMs>0?windowMs:1300;
 let last=-Infinity,count=0;
 function tap(now=Date.now()){
  if(!Number.isFinite(now))return 0;
  count=now>=last&&now-last<=window?Math.min(3,count+1):1;
  last=now;return count;
 }
 function reset(){last=-Infinity;count=0;}
 return {tap,reset};
}
