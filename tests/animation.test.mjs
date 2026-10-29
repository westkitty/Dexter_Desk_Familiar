import test from "node:test";
import assert from "node:assert/strict";
import {ATLAS,CLIPS,clipForState,frameRect,validateAtlas,createSpritePreview} from "../src/animation.mjs";
test("source atlas is 6 by 5 actual 32px tiles with no out-of-bounds clips",()=>{
 assert.equal(validateAtlas(),true);
 assert.equal(ATLAS.width,192);assert.equal(ATLAS.height,160);
 for(const [clip,def] of Object.entries(CLIPS)){
  for(let i=0;i<def.frames.length;i++){
   const rect=frameRect(clip,i);
   assert.ok(rect.x>=0&&rect.x+32<=192);
   assert.ok(rect.y>=0&&rect.y+32<=160);
  }
 }
 assert.equal(frameRect("walk",99),null);
 assert.equal(clipForState("wandering"),"walk");
 assert.equal(clipForState("sleeping"),null);
 assert.equal(clipForState("eating"),null);
 assert.equal(clipForState("huffing"),"unimpressed");
});
test("opt-in renderer restores 96px fallback for unavailable states and disable",async()=>{
 const calls=[],pending=new Map(),fallback={hidden:false};
 const canvas={hidden:true,getContext:()=>({
  clearRect(){calls.push("clear");},drawImage(){calls.push("draw");},
  set imageSmoothingEnabled(v){calls.push(v);}
 })};
 let timer=0;
 class ImageStub{
  naturalWidth=192;naturalHeight=160;
  set src(v){this.onload?.();}
 }
 const view=createSpritePreview({
  canvas,fallback,ImageClass:ImageStub,
  setDelay:(fn)=>{pending.set(++timer,fn);return timer;},
  clearDelay:id=>pending.delete(id)
 });
 assert.equal(fallback.hidden,false);assert.equal(canvas.hidden,true);
 assert.equal(await view.activate(),true);
 assert.equal(canvas.hidden,false);assert.equal(fallback.hidden,true);
 assert.ok(calls.includes("draw"));
 view.setState("sleeping");
 assert.equal(canvas.hidden,true);assert.equal(fallback.hidden,false);
 view.setState("wandering");assert.equal(canvas.hidden,false);
 view.setReducedMotion(true);
 assert.equal(pending.size,0);
 view.deactivate();
 assert.equal(canvas.hidden,true);assert.equal(fallback.hidden,false);
 view.dispose();
});
test("failed sprite load never hides approved fallback",async()=>{
 class BrokenImage{naturalWidth=8;naturalHeight=8;set src(v){this.onload?.();}}
 const canvas={hidden:true,getContext:()=>({clearRect(){},drawImage(){}})},fallback={hidden:false};
 const v=createSpritePreview({canvas,fallback,ImageClass:BrokenImage});
 await assert.rejects(v.activate(),/dimensions/);
 assert.equal(canvas.hidden,true);assert.equal(fallback.hidden,false);
});
