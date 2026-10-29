// WebAudio is instantiated lazily after an explicit user interaction and opt-in.
// A small minimum interval prevents rapid tapping from stacking sounds.
export function createAudio({
 enabled=()=>false,
 contextFactory=()=>new (globalThis.AudioContext||globalThis.webkitAudioContext)(),
 clock=()=>Date.now(),
 minGapMs=650
}={}) {
 let context=null;
 let lastSoundAt=-Infinity;
 const gap=Number.isFinite(minGapMs)&&minGapMs>=0?minGapMs:650;
 function play(cue="huff") {
  if(!enabled()||cue!=="huff")return false;
  const now=Number(clock());
  if(!Number.isFinite(now)||now<lastSoundAt||now-lastSoundAt<gap)return false;
  try {
   if(!context)context=contextFactory();
   if(context.state==="suspended")void context.resume();
   const at=context.currentTime;
   const oscillator=context.createOscillator(),gain=context.createGain();
   oscillator.type="triangle";
   oscillator.frequency.setValueAtTime(145,at);
   oscillator.frequency.exponentialRampToValueAtTime(78,at+0.16);
   gain.gain.setValueAtTime(0.0001,at);
   gain.gain.exponentialRampToValueAtTime(0.033,at+0.02);
   gain.gain.exponentialRampToValueAtTime(0.0001,at+0.18);
   oscillator.connect(gain);gain.connect(context.destination);
   oscillator.start(at);oscillator.stop(at+0.2);
   oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
   lastSoundAt=now;
   return true;
  }catch{return false;}
 }
 function suspend(){try{if(context?.state==="running")void context.suspend();}catch{}}
 function dispose(){try{void context?.close();}catch{}context=null;}
 return {play,suspend,dispose};
}
