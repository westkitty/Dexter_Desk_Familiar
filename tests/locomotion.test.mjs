import test from "node:test";
import assert from "node:assert/strict";
import {planPatrol,PATROL_MS} from "../src/locomotion.mjs";

test("Dexter patrols within the actual habitat and returns to an unchanged anchor",()=>{
 const route=planPatrol({anchor:50,sceneWidth:320,petWidth:200,random:()=>0.99});
 assert.ok(route);assert.equal(route.home,50);assert.equal(route.durationMs,PATROL_MS);
 for(const center of [route.home,route.target]){
  assert.ok(center/100*320-100>=8);
  assert.ok(center/100*320+100<=312);
 }
 assert.ok(route.target>route.home);
});
test("direction chooses usable side at the edge, without leaving the sprite cropped",()=>{
 const route=planPatrol({anchor:85,sceneWidth:320,petWidth:200,random:()=>0.99});
 assert.ok(route);assert.ok(route.target<route.home);
 assert.ok(route.target/100*320-100>=8);
});
test("too little room and invalid measurements cause no involuntary movement",()=>{
 assert.equal(planPatrol({anchor:50,sceneWidth:120,petWidth:200}),null);
 assert.equal(planPatrol({anchor:50,sceneWidth:0,petWidth:100}),null);
 assert.equal(planPatrol({anchor:50,sceneWidth:200,petWidth:90,random:()=>NaN}),null);
});
