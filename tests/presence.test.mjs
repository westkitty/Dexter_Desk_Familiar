import test from "node:test";
import assert from "node:assert/strict";
import {createPointerPresence,createPokeRhythm} from "../src/presence.mjs";
test("fast near-Dexter approach causes one subdued signal then observes cooldown",()=>{
 const p=createPointerPresence({cooldownMs:1000});
 assert.equal(p.observe({x:10,y:10,now:0,near:true}),null);
 const cue=p.observe({x:90,y:10,now:70,near:true});
 assert.equal(cue?.state,"watching");
 assert.equal(cue?.reason,"approach");
 assert.equal(p.observe({x:180,y:10,now:140,near:true}),null);
 p.observe({x:0,y:0,now:150,near:false});
 assert.equal(p.observe({x:0,y:0,now:1200,near:true}),null);
 assert.equal(p.observe({x:80,y:0,now:1280,near:true})?.reason,"approach");
});
test("stationary dwell reacts without reading other applications",()=>{
 const p=createPointerPresence();
 assert.equal(p.observe({x:2,y:2,now:0,near:true}),null);
 assert.equal(p.observe({x:2,y:2,now:500,near:true}),null);
 assert.equal(p.observe({x:2,y:2,now:900,near:true})?.reason,"dwell");
 p.reset();
 assert.equal(p.observe({x:2,y:2,now:1000,allowed:false}),null);
});
test("repeated taps have finite escalating sequence that expires",()=>{
 const p=createPokeRhythm();
 assert.equal(p.tap(100),1);
 assert.equal(p.tap(200),2);
 assert.equal(p.tap(300),3);
 assert.equal(p.tap(400),3);
 assert.equal(p.tap(2000),1);
 p.reset();assert.equal(p.tap(2010),1);
});
