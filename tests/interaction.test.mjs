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
