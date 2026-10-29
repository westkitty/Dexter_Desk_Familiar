import{FamiliarBus,effectiveState}from"./src/behavior.mjs";
import{isCountedKey,countRecentKeys}from"./src/observations.mjs";
import{chooseAmbientRoutine}from"./src/director.mjs";
import{renderState}from"./src/renderer.mjs";
import{createAudio}from"./src/audio.mjs";
import{STORAGE_KEY,defaultSettings,readSettings,writeSettings,resetSettings}from"./src/settings.mjs";
const byId=id=>document.getElementById(id);
const scene=byId("scene"),pet=byId("pet"),sprite=byId("sprite"),thought=byId("thought"),stateLabel=byId("stateLabel"),sceneCaption=byId("sceneCaption");
const deskPanel=byId("deskPanel"),typingInput=byId("typingInput"),typingRate=byId("typingRate"),settingsDialog=byId("settingsDialog");
const systemReduced=Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
const defaults=defaultSettings(systemReduced);
let preferences=readSettings(window.localStorage,systemReduced);
const bus=new FamiliarBus();
const audio=createAudio({enabled:()=>preferences.sound});
let lastActivity=Date.now(),lastState="",lastCaption="",typingTimes=[],simulatedTabs=0,manualNap=false,installPrompt=null,soundContext=null;
let pointerStart=null,pointerMoved=false,petPosition=50,lastClutterHuff=0,lastWander=0;
const captions={
 idle:["The department of disapproval remains operational.","A perfectly adequate amount of nothing.","Monitoring the room. Against my better judgment."],
 watching:["I see you. That is sufficient.","Your presence is being evaluated.","You may proceed. Provisionally."],
 working:["An enormous amount of typing. Remarkable.","Continue. I am withholding applause.","Productivity detected. Suspicious."],
 judging:["This pace suggests either genius or panic.","The keyboard has filed a complaint.","You have my attention. Regrettably."],
 wandering:["A routine inspection of the premises.","I have decided to be elsewhere.","No one has earned a report."],
 resting:["I am not asleep. I am unavailable.","Please lower the civilization.","This is a formally sanctioned recess."],
 sleeping:["The office is closed.","Do not disturb the institution.","Zzz. Officially."],
 huffing:["Hff. My statement is complete.","I object, without elaboration.","The answer is a disappointed exhalation."],
 eating:["A reasonable tribute.","I will allow this.","The offering has been accepted."]
};
const labels={idle:"UNIMPRESSED",watching:"OBSERVING",working:"SUPERVISING",judging:"JUDGING",wandering:"PATROLLING",resting:"WITHDRAWN",sleeping:"ASLEEP",huffing:"DISAPPROVING",eating:"APPEASED"};
const images={idle:"sit",watching:"sit",working:"stand",judging:"sit",wandering:"stand",resting:"rest",sleeping:"rest",huffing:"sit",eating:"stand"};
function saveSettings(){writeSettings(window.localStorage,preferences)}
function applySettings(){
 document.body.classList.toggle("reduce-motion",preferences.reducedMotion);
 byId("soundToggle").checked=preferences.sound;
 byId("quietToggle").checked=preferences.quiet;
 byId("motionToggle").checked=preferences.reducedMotion;
 byId("idleSelect").value=String(preferences.idleSeconds);
}
function speak(msg,force=false){if(preferences.quiet&&!force)return;if(msg!==lastCaption){thought.textContent=msg;lastCaption=msg}}
function huffSound(){audio.play("huff")}
function reaction(state,priority=80,duration=1600,message){
 const now=Date.now();bus.publish(state,priority,duration,now);lastActivity=now;manualNap=false;
 if(message)speak(message,true);
 byId("napLabel").textContent="Nap";
 if(state==="huffing")huffSound();
 tick();
}
function keyWindow(now=Date.now()){
 typingTimes=typingTimes.filter(t=>t<=now&&now-t<6000);
 typingRate.textContent=String(countRecentKeys(typingTimes,now))+" keys / 6 seconds";
 return typingTimes.length;
}
function tick(){
 const now=Date.now(),date=new Date(now),night=date.getHours()>=23||date.getHours()<6;
 const keys=keyWindow(now);
 const context={now,lastActivity,idleMs:preferences.idleSeconds*1000,typingKeys:keys,night,manualNap,visible:document.visibilityState!=="hidden"};
 let next=effectiveState(bus,context);
 if(!manualNap&&bus.current(now)===null){
   if(keys>=24) next="judging";
   else {
     const routine=chooseAmbientRoutine({state:next,idleMs:now-lastActivity,now,lastRoutineAt:lastWander,visible:context.visible,manualNap,deskOpen:!deskPanel.hidden});
     if(routine){bus.publish(routine.state,12,routine.ttlMs,now);lastWander=now;next=routine.state;}
   }
 }
 if(next!==lastState){
  renderState(next,{pet,sprite,stateLabel,sceneCaption},lastState);
  lastState=next;
  const options=captions[next];const choice=options[Math.floor(Math.random()*options.length)];
  speak(choice);
 }
 byId("clock").textContent=date.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});
}
function openDesk(){deskPanel.hidden=false;lastActivity=Date.now();typingInput.focus();speak("Your text stays here, briefly.",true)}
function closeDesk(){typingInput.value="";typingTimes=[];deskPanel.hidden=true;keyWindow();byId("pet").focus();tick()}
function openSettings(){applySettings();settingsDialog.showModal()}
function doAction(action){
 lastActivity=Date.now();
 switch(action){
  case"treat":reaction("eating",95,2000,"Very well. One treat.");break;
  case"huff":reaction("huffing",95,1600,"Hff. An official protest.");break;
  case"nap":
   manualNap=!manualNap;bus.clear();byId("napLabel").textContent=manualNap?"Wake":"Nap";
   speak(manualNap?"I am not available for consultation.":"My break has been interrupted.",true);break;
  case"desk":deskPanel.hidden?openDesk():closeDesk();break;
  case"settings":openSettings();break;
 }
 tick();
}
document.querySelectorAll("[data-action]").forEach(button=>button.addEventListener("click",()=>doAction(button.dataset.action)));
byId("closeDesk").addEventListener("click",closeDesk);
byId("clearDesk").addEventListener("click",()=>{typingInput.value="";typingTimes=[];keyWindow();typingInput.focus()});
typingInput.addEventListener("keydown",event=>{
 if(event.key==="Escape"){event.preventDefault();closeDesk();return}
 if(!isCountedKey(event))return;
 typingTimes.push(Date.now());lastActivity=Date.now();const count=keyWindow();
 if(count>=24)bus.publish("judging",52,2600);
 else if(count>=9)bus.publish("working",41,2200);
 tick();
});
byId("closeSettings").addEventListener("click",()=>settingsDialog.close());
byId("doneSettings").addEventListener("click",()=>settingsDialog.close());
byId("soundToggle").addEventListener("change",event=>{preferences.sound=event.target.checked;saveSettings()});
byId("quietToggle").addEventListener("change",event=>{preferences.quiet=event.target.checked;saveSettings()});
byId("motionToggle").addEventListener("change",event=>{preferences.reducedMotion=event.target.checked;applySettings();saveSettings()});
byId("idleSelect").addEventListener("change",event=>{preferences.idleSeconds=Number(event.target.value);saveSettings();tick()});
byId("resetSettings").addEventListener("click",()=>{preferences={...defaults};resetSettings(window.localStorage)applySettings();speak("Settings have been returned to reason.",true);tick()});
function updateClutter(){
 byId("tabCount").textContent=String(simulatedTabs);
 const now=Date.now();
 if(simulatedTabs>=5&&now-lastClutterHuff>3000){lastClutterHuff=now;reaction("huffing",80,1800,"Five imaginary tabs. Zero imaginary discipline.")}
}
byId("addTab").addEventListener("click",()=>{simulatedTabs=Math.min(9,simulatedTabs+1);updateClutter()});
byId("removeTab").addEventListener("click",()=>{simulatedTabs=Math.max(0,simulatedTabs-1);updateClutter()});
document.addEventListener("keydown",event=>{
 if(event.target===typingInput||settingsDialog.open||event.metaKey||event.ctrlKey||event.altKey||event.isComposing||event.repeat)return;
 if(event.target?.tagName==="BUTTON"||event.target?.tagName==="SELECT")return;
 if(event.key==="t"||event.key==="T")doAction("treat");
 else if(event.key==="h"||event.key==="H")doAction("huff");
 else if(event.key==="n"||event.key==="N")doAction("nap");
 else if(event.key==="d"||event.key==="D")doAction("desk");
});
pet.addEventListener("pointerdown",event=>{
 if(event.button!==0)return;pointerStart={x:event.clientX,y:event.clientY,position:petPosition};pointerMoved=false;pet.setPointerCapture(event.pointerId);
});
pet.addEventListener("pointermove",event=>{
 if(!pointerStart)return;
 const delta=event.clientX-pointerStart.x,vertical=event.clientY-pointerStart.y;
 if(Math.abs(delta)>6||Math.abs(vertical)>6)pointerMoved=true;
 if(pointerMoved){const width=scene.clientWidth||1;petPosition=Math.min(85,Math.max(15,pointerStart.position+(delta/width)*100));pet.style.left=petPosition+"%"}
});
pet.addEventListener("pointerup",event=>{
 if(!pointerStart)return;pointerStart=null;lastActivity=Date.now();
 if(!pointerMoved)reaction("watching",70,1600,"Personal space is a concept.");
 else{bus.publish("judging",30,1100);speak("Reassigned. Without consultation.",true);tick()}
});
pet.addEventListener("pointercancel",()=>{pointerStart=null;pointerMoved=false});
pet.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();reaction("huffing",90,1700,"This meeting was unnecessary.")}});
scene.addEventListener("pointermove",()=>{lastActivity=Date.now()},{passive:true});
document.addEventListener("visibilitychange",()=>{if(document.hidden)audio.suspend();tick();});
window.addEventListener("online",()=>{byId("connectionText").textContent="LOCAL";tick()});
window.addEventListener("offline",()=>{byId("connectionText").textContent="OFFLINE";tick()});
window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();installPrompt=event;byId("installButton").hidden=false});
byId("installButton").addEventListener("click",async()=>{if(!installPrompt)return;const prompt=installPrompt;installPrompt=null;byId("installButton").hidden=true;await prompt.prompt()});
window.addEventListener("appinstalled",()=>{byId("installButton").hidden=true});
if("serviceWorker"in navigator&&(location.protocol==="https:"||location.hostname==="localhost"||location.hostname==="127.0.0.1")){
 window.addEventListener("load",()=>{navigator.serviceWorker.register("./sw.js").then(()=>{byId("connectionBlock").title="App shell is eligible for offline caching; test offline after first successful load"}).catch(()=>{byId("connectionBlock").title="Offline cache registration unavailable in this browser"})});
}
applySettings();keyWindow();tick();
let ticker=setInterval(tick,1100);
document.addEventListener("visibilitychange",()=>{clearInterval(ticker);ticker=setInterval(tick,document.hidden?15000:1100);});
window.addEventListener("pagehide",()=>{clearInterval(ticker);audio.dispose();});
