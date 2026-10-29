// Audio is created lazily only after an explicit action and user opt-in.
export function createAudio({enabled=()=>false,contextFactory=()=>new (globalThis.AudioContext||globalThis.webkitAudioContext)()}={}) {
  let context=null;
  function play(cue="huff") {
    if(!enabled()||cue!=="huff") return false;
    try {
      if(!context) context=contextFactory();
      if(context.state==="suspended") void context.resume();
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
      return true;
    }catch{return false;}
  }
  function suspend(){try{if(context?.state==="running") void context.suspend();}catch{}}
  function dispose(){try{void context?.close();}catch{}context=null;}
  return {play,suspend,dispose};
}
