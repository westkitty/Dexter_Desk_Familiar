import test from "node:test";
import assert from "node:assert/strict";
import {chooseAmbientRoutine,lightBand} from "../src/director.mjs";
const ready={state:"idle",idleMs:12000,now:100000,lastRoutineAt:10000,random:()=>0.1};
test("only allowed low-priority routine starts after cooldown",()=>{
 assert.deepEqual(chooseAmbientRoutine(ready),{state:"wandering",ttlMs:2900});
 assert.equal(chooseAmbientRoutine({...ready,lastRoutineAt:70000}),null);
 assert.equal(chooseAmbientRoutine({...ready,random:()=>0.9}),null);
 assert.equal(chooseAmbientRoutine({...ready,state:"huffing"}),null);
});
test("manual nap, hidden tab and typing desk cannot be interrupted",()=>{
 for(const change of [{manualNap:true},{visible:false},{deskOpen:true}]) assert.equal(chooseAmbientRoutine({...ready,...change}),null);
});
test("a long elapsed interval produces at most one routine and no catch-up queue",()=>{
 assert.deepEqual(chooseAmbientRoutine({...ready,now:99999999}),{state:"wandering",ttlMs:2900});
});

test("daylight uses the local hour, without any device or location access",()=>{
 for(const [hour,name] of [[0,"night"],[5,"night"],[6,"morning"],[10,"morning"],[11,"day"],[17,"day"],[18,"evening"],[21,"evening"],[22,"night"],[23,"night"]])assert.equal(lightBand(hour),name);
 assert.equal(lightBand(NaN),"day");
});
