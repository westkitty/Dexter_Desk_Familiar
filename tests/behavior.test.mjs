import test from"node:test";import assert from"node:assert/strict";import{FamiliarBus,ambientState,effectiveState,STATES}from"../src/behavior.mjs";
test("states are distinct and finite",()=>{assert.equal(new Set(STATES).size,STATES.length);assert.ok(STATES.includes("huffing"))});
test("higher priority wins; same-priority newest wins",()=>{const bus=new FamiliarBus();bus.publish("working",3,1000,100);bus.publish("huffing",8,1000,100);assert.equal(bus.current(500),"huffing");bus.publish("eating",8,1000,100);assert.equal(bus.current(501),"eating")});
test("expired signals disappear",()=>{const bus=new FamiliarBus();bus.publish("huffing",9,150,100);assert.equal(bus.current(249),"huffing");assert.equal(bus.current(250),null)});
test("unknown state rejected",()=>{assert.throws(()=>new FamiliarBus().publish("reading-thoughts"),TypeError)});
test("ambient detects rest and sleep without monitoring other apps",()=>{assert.equal(ambientState({now:100000,lastActivity:40000,idleMs:60000}),"resting");assert.equal(ambientState({now:200001,lastActivity:40000,idleMs:60000}),"sleeping")});
test("typing is a count, not text",()=>{assert.equal(ambientState({now:10000,lastActivity:9000,typingKeys:10}),"working")});
test("explicit nap wins over non-treat signals",()=>{const bus=new FamiliarBus();bus.publish("huffing",100,3000,100);assert.equal(effectiveState(bus,{now:110,manualNap:true}),"sleeping")});
test("offscreen state sleeps without global device signals",()=>{assert.equal(ambientState({visible:false}),"sleeping")});

test("bounded queue retains latest signals and refuses bad time/duration",()=>{
 const bus=new FamiliarBus({limit:3});
 for(let i=0;i<10;i++)bus.publish("watching",1,1000,100+i);
 assert.equal(bus.active.length,3);
 for(const value of [NaN,Infinity])assert.throws(()=>bus.publish("idle",1,200,value),TypeError);
 assert.throws(()=>bus.publish("idle",1,0,200),TypeError);
 assert.throws(()=>bus.current(NaN),TypeError);
});
test("manual nap cannot be interrupted by old high-priority activity",()=>{
 const bus=new FamiliarBus();bus.publish("huffing",100,5000,100);
 assert.equal(effectiveState(bus,{now:200,manualNap:true}),"sleeping");
 assert.equal(effectiveState(bus,{now:5200,manualNap:false,lastActivity:0,idleMs:1000}),"sleeping");
});
test("publish with same priority resolves newest first and expiry has no stuck state",()=>{
 const bus=new FamiliarBus();bus.publish("idle",5,10,100);bus.publish("huffing",5,20,100);
 assert.equal(bus.current(109),"huffing");assert.equal(bus.current(120),null);
});
