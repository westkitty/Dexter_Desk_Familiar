import test from"node:test";import assert from"node:assert/strict";import{FamiliarBus,ambientState,effectiveState,STATES}from"../src/behavior.mjs";
test("states are distinct and finite",()=>{assert.equal(new Set(STATES).size,STATES.length);assert.ok(STATES.includes("huffing"))});
test("higher priority wins; same-priority newest wins",()=>{const bus=new FamiliarBus();bus.publish("working",3,1000,100);bus.publish("huffing",8,1000,100);assert.equal(bus.current(500),"huffing");bus.publish("eating",8,1000,100);assert.equal(bus.current(501),"eating")});
test("expired signals disappear",()=>{const bus=new FamiliarBus();bus.publish("huffing",9,150,100);assert.equal(bus.current(249),"huffing");assert.equal(bus.current(250),null)});
test("unknown state rejected",()=>{assert.throws(()=>new FamiliarBus().publish("reading-thoughts"),TypeError)});
test("ambient detects rest and sleep without monitoring other apps",()=>{assert.equal(ambientState({now:100000,lastActivity:40000,idleMs:60000}),"resting");assert.equal(ambientState({now:200001,lastActivity:40000,idleMs:60000}),"sleeping")});
test("typing is a count, not text",()=>{assert.equal(ambientState({now:10000,lastActivity:9000,typingKeys:10}),"working")});
test("explicit nap wins over non-treat signals",()=>{const bus=new FamiliarBus();bus.publish("huffing",100,3000,100);assert.equal(effectiveState(bus,{now:110,manualNap:true}),"sleeping")});
test("offscreen state sleeps without global device signals",()=>{assert.equal(ambientState({visible:false}),"sleeping")});
