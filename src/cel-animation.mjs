// Owner-accepted 2026-10-31 cel-shaded motion set. Independent of the opt-in 32px atlas.
// All files are same-origin and served by the offline app shell; the default art stays 96px.
const root="./assets/cel-shaded/";
export const CEL_CLIPS=Object.freeze({
  lie_down:Object.freeze({loop:false,seconds:3.667}),
  stretch:Object.freeze({loop:false,seconds:3.112}),
  slow_blink:Object.freeze({loop:false,seconds:1.945}),
  head_tilt:Object.freeze({loop:false,seconds:3.167}),
  tail_wag:Object.freeze({loop:true,seconds:2.667}),
  treat_lick:Object.freeze({loop:false,seconds:1.389}),
  sit_down:Object.freeze({loop:false,seconds:2.223}),
  sleep_loop:Object.freeze({loop:true,seconds:1.5})
});
export const CEL_POSTERS=Object.freeze({
  seated:"slow_blink_start.png",
  standing:"stretch_start.png",
  resting:"lie_down_end.png",
  sleeping:"sleep_loop_start.png"
});
export function celPoseForState(state){
  if(state==="working"||state==="wandering")return "standing";
  if(state==="resting")return "resting";
  if(state==="sleeping")return "sleeping";
  return "seated";
}
export function chooseCelClip(previous,next,{treatOrdinal=0}={}){
  if(next==="sleeping")return previous==="sleeping"?"sleep_loop":previous==="resting"?"sleep_loop":"lie_down";
  if(next==="resting")return "lie_down";
  if(next==="eating")return treatOrdinal%2===0?"treat_lick":"tail_wag";
  if(next==="wandering")return "stretch";
  if(next==="judging")return "slow_blink";
  if(next==="watching")return previous==="working"||previous==="wandering"?"sit_down":"head_tilt";
  if(next==="idle"&&(previous==="working"||previous==="wandering"))return "sit_down";
  return null;
}

export function createCelAnimator({video,poster,pixel,status,documentRef=document}){
  let enabled=false,reduced=false,quiet=false,visible=true,state="idle",selection="auto";
  let serial=0,activeClip=null,treatOrdinal=0,alphaUnsupported=false,alphaVerified=false;
  const report=message=>{status.textContent=message;};
  const setStill=pose=>{
    const target=root+"posters/"+CEL_POSTERS[pose||celPoseForState(state)];
    if(poster.getAttribute("src")!==target)poster.setAttribute("src",target);
    poster.hidden=!enabled;
    video.hidden=true;
    pixel.hidden=enabled;
  };
  const stop=()=>{
    serial++;
    video.onloadeddata=null;video.onended=null;video.onerror=null;
    video.pause();
    if(video.hasAttribute("src")){video.removeAttribute("src");video.load();}
    video.hidden=true;
    activeClip=null;alphaVerified=false;
  };
  function proveVideoAlpha(){
    // Detect opaque black/pink mattes in browsers that decode VP9 but ignore alpha.
    if(!video.videoWidth||!video.videoHeight)return false;
    const surface=documentRef.createElement("canvas");
    surface.width=24;surface.height=24;
    const context=surface.getContext("2d",{willReadFrequently:true});
    if(!context)return false;
    context.clearRect(0,0,24,24);
    context.drawImage(video,0,0,24,24);
    return [[0,0],[23,0],[0,23],[23,23]].every(([x,y])=>
      context.getImageData(x,y,1,1).data[3]<24);
  }
  function showFailure(message){
    stop();setStill();
    report(message);
  }
  function playClip(name,{follow=null,explicit=false}={}){
    if(!enabled)return false;
    stop();setStill();
    if(!Object.hasOwn(CEL_CLIPS,name))return false;
    if(reduced||!visible||(quiet&&!explicit)){
      report(reduced?"Reduced motion: still Dexter.":quiet?"Quiet mode: still Dexter.":"Paused while hidden.");
      return false;
    }
    if(alphaUnsupported||video.canPlayType('video/webm; codecs="vp9"')===""){
      report("Transparent video unsupported here; using local still art.");
      return false;
    }
    activeClip=name;
    const generation=serial;
    const fail=()=>{
      if(generation!==serial||!enabled)return;
      alphaUnsupported=true;
      showFailure("Transparent WebM unavailable; local still art restored.");
    };
    video.loop=CEL_CLIPS[name].loop;
    video.muted=true;
    video.playsInline=true;
    video.onloadeddata=()=>{
      if(generation!==serial||!enabled)return;
      try{if(!proveVideoAlpha()){fail();return;}}
      catch{fail();return;}
      alphaVerified=true;poster.hidden=true;video.hidden=false;
      report("Playing "+name.replaceAll("_"," ")+".");
    };
    video.onerror=fail;
    video.onended=()=>{
      if(generation!==serial||!enabled)return;
      if(follow&&selection==="auto"&&state==="sleeping"){
        playClip(follow);return;
      }
      stop();setStill();
      report("Cel-shaded Dexter: "+state+".");
    };
    video.src=root+"clips/"+name+".webm";
    video.load();
    const result=video.play();
    result?.catch?.(fail);
    return true;
  }
  function setState(next,{previous=state,explicit=false,force=false}={}){
    const changed=next!==state;state=next;
    if(!enabled||selection!=="auto"||(!changed&&!force))return;
    const name=chooseCelClip(previous,next,{treatOrdinal});
    if(next==="eating"&&(changed||force))treatOrdinal++;
    if(!name){stop();setStill();report("Cel-shaded Dexter: "+next+".");return;}
    playClip(name,{follow:next==="sleeping"&&name==="lie_down"?"sleep_loop":null,explicit});
  }
  function enable(){
    if(enabled)return;
    enabled=true;setStill();report("Cel-shaded mode on. Original pixel art retained.");
    setState(state,{previous:state,force:true,explicit:true});
  }
  function disable(){
    if(!enabled)return;
    enabled=false;selection="auto";stop();poster.hidden=true;pixel.hidden=false;
    report("Cel-shaded mode off; original artwork restored.");
  }
  function setClip(name){
    selection=name==="auto"||Object.hasOwn(CEL_CLIPS,name)?name:"auto";
    if(!enabled)return;
    if(selection==="auto"){setState(state,{previous:state,force:true,explicit:true});return;}
    playClip(selection,{explicit:true});
  }
  function setReducedMotion(value){
    const updated=Boolean(value);if(reduced===updated)return;
    reduced=updated;
    if(enabled){if(reduced){stop();setStill();report("Reduced motion: still Dexter.");}
      else if(selection==="auto")setState(state,{force:true});
      else playClip(selection,{explicit:true});}
  }
  function setQuiet(value){
    const updated=Boolean(value);if(quiet===updated)return;
    quiet=updated;
    if(enabled){if(quiet){stop();setStill();report("Quiet mode: still Dexter.");}
      else if(selection==="auto")setState(state,{force:true});
      else playClip(selection,{explicit:true});}
  }
  function setVisible(value){
    const updated=Boolean(value);if(visible===updated)return;
    visible=updated;
    if(!enabled)return;
    if(!visible){video.pause();video.hidden=true;poster.hidden=false;return;}
    if(!reduced&&!quiet&&activeClip){
      const resume=video.play();resume?.catch?.(()=>showFailure("Playback paused; local still art restored."));
      if(alphaVerified){video.hidden=false;poster.hidden=true;}
    }else if(selection==="auto")setState(state,{force:true});
  }
  function dispose(){disable();}
  setStill();
  return {enable,disable,setState,setClip,setReducedMotion,setQuiet,setVisible,dispose,
    get enabled(){return enabled;},get currentClip(){return activeClip;},get selection(){return selection;}};
}
