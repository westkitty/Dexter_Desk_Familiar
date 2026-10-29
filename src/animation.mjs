// Candidate asset (not canonical-approved): westkitty/SNES_Dex/original/dexter_sprites.png
// 192x160 pixels: 6 columns x 5 rows, each tile 32x32. No re-rendering or modification.
export const ATLAS={width:192,height:160,columns:6,rows:5,cell:32,path:"./assets/dexter-snes-32-candidate.png"};
export const CLIPS=Object.freeze({
 idle:Object.freeze({row:0,frames:Object.freeze([0,1,2,3]),fps:1.25}),
 walk:Object.freeze({row:1,frames:Object.freeze([0,1,2,3,4,5]),fps:7}),
 sniff:Object.freeze({row:2,frames:Object.freeze([0,1,2,3]),fps:4}),
 bark:Object.freeze({row:3,frames:Object.freeze([0,1,2,3]),fps:5}),
 unimpressed:Object.freeze({row:4,frames:Object.freeze([0,1,2,3]),fps:2.5})
});
const STATE_CLIP=Object.freeze({idle:"idle",watching:"sniff",judging:"unimpressed",wandering:"walk",huffing:"unimpressed"});
export function clipForState(state,override="auto"){return CLIPS[override]?override:(STATE_CLIP[state]??null);}
export function frameRect(clip,index=0){
 const def=CLIPS[clip];if(!def||!Number.isInteger(index)||index<0||index>=def.frames.length)return null;
 return {x:def.frames[index]*ATLAS.cell,y:def.row*ATLAS.cell,width:ATLAS.cell,height:ATLAS.cell};
}
export function validateAtlas(){
 if(ATLAS.width!==ATLAS.columns*ATLAS.cell||ATLAS.height!==ATLAS.rows*ATLAS.cell)return false;
 return Object.values(CLIPS).every(c=>c.row>=0&&c.row<ATLAS.rows&&c.fps>0&&c.frames.length>0&&
 c.frames.every(f=>Number.isInteger(f)&&f>=0&&f<ATLAS.columns));
}
// Runs at clip FPS, only when opted in, visible, and allowed by motion preferences.
export function createSpritePreview({canvas,fallback,ImageClass=Image,setDelay=setTimeout,clearDelay=clearTimeout}){
 const context=canvas.getContext("2d",{alpha:true});
 let enabled=false,ready=false,source=null,state="idle",override="auto",reduced=false,visible=true;
 let frame=0,timer=null,token=0,active=null;
 function stop(){if(timer!==null){clearDelay(timer);timer=null;}}
 function fallbackMode(){canvas.hidden=true;fallback.hidden=false;}
 function draw(){
  const clip=clipForState(state,override);const rect=clip&&frameRect(clip,frame);
  if(!ready||!enabled||!rect||!context){fallbackMode();return false;}
  context.clearRect(0,0,32,32);context.imageSmoothingEnabled=false;
  context.drawImage(source,rect.x,rect.y,32,32,0,0,32,32);
  fallback.hidden=true;canvas.hidden=false;return true;
 }
 function schedule(){
  stop();if(!enabled||!ready||!visible||reduced)return;
  const clip=clipForState(state,override);
  if(!clip||CLIPS[clip].frames.length<2)return;
  timer=setDelay(()=>{
   if(!enabled||!visible||reduced)return;
   frame=(frame+1)%CLIPS[clip].frames.length;
   draw();schedule();
  },Math.round(1000/CLIPS[clip].fps));
 }
 function refresh(){frame=0;draw();schedule();}
 async function activate(){
  const current=++token;enabled=true;
  if(ready){refresh();return true;}
  try{
   const img=new ImageClass();
   await new Promise((resolve,reject)=>{
    img.onload=()=>resolve();img.onerror=()=>reject(new Error("Candidate image could not load"));
    img.src=ATLAS.path;
   });
   if(current!==token||!enabled)return false;
   if(img.naturalWidth!==ATLAS.width||img.naturalHeight!==ATLAS.height||!context)
    throw new Error("Candidate atlas dimensions or canvas unavailable");
   source=img;ready=true;refresh();return true;
  }catch(error){
   if(current===token){enabled=false;stop();fallbackMode();}
   throw error;
  }
 }
 function deactivate(){++token;enabled=false;stop();fallbackMode();}
 function setState(next){if(next===state)return;state=next;refresh();}
 function setClip(next){const valid=next==="auto"||Object.hasOwn(CLIPS,next)?next:"auto";if(valid!==override){override=valid;refresh();}}
 function setReducedMotion(value){reduced=Boolean(value);refresh();}
 function setVisible(value){visible=Boolean(value);if(visible)refresh();else stop();}
 function dispose(){deactivate();source=null;ready=false;}
 fallbackMode();
 return {activate,deactivate,setState,setClip,setReducedMotion,setVisible,dispose,get enabled(){return enabled;}};
}
