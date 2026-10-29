import test from "node:test";
import assert from "node:assert/strict";
import{clampPosition,draggedPosition,keyboardPosition}from"../src/interaction.mjs";
test("pointer positioning is clamped, finite and responsive to scene size",()=>{
 assert.equal(draggedPosition(50,150,300),85);
 assert.equal(draggedPosition(50,-150,300),15);
 assert.equal(draggedPosition(50,0,0),50);
 assert.equal(draggedPosition(50,NaN,100),50);
 assert.equal(clampPosition(Infinity),50);
});
test("keyboard moves in 5 percent increments with Home reset",()=>{
 assert.equal(keyboardPosition(50,"ArrowLeft"),45);
 assert.equal(keyboardPosition(50,"ArrowRight"),55);
 assert.equal(keyboardPosition(85,"ArrowRight"),85);
 assert.equal(keyboardPosition(15,"ArrowLeft"),15);
 assert.equal(keyboardPosition(75,"Home"),50);
 assert.equal(keyboardPosition(50,"Other"),50);
});

test("mobile bounds keep the complete Dexter image inside the stage",()=>{
 const w=320,pet=201;
 for(const x of [0,15,50,85,100]){
  const at=keyboardPosition(x,"ArrowRight",w,pet);
  assert.ok(at/100*w+pet/2<=w-8+.02);
  assert.ok(at/100*w-pet/2>=8-.02);
 }
 assert.equal(draggedPosition(50,1000,w,pet),keyboardPosition(85,"ArrowRight",w,pet));
});
