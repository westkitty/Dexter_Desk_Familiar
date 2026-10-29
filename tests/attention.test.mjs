import test from "node:test";
import assert from "node:assert/strict";
import {createAttentionBudget} from "../src/attention.mjs";
test("ambient attention is capped and has a minimum pause",()=>{
 const budget=createAttentionBudget({hourlyCap:3,minGapMs:1000,windowMs:60000});
 assert.equal(budget.eligible({now:0}),true);
 assert.equal(budget.record(0),true);
 assert.equal(budget.eligible({now:999}),false);
 assert.equal(budget.eligible({now:1000}),true);
 assert.equal(budget.record(1000),true);
 assert.equal(budget.record(2000),true);
 assert.equal(budget.snapshot(3000).used,3);
 assert.equal(budget.eligible({now:4000}),false);
 assert.equal(budget.eligible({now:61000}),true);
 assert.equal(budget.snapshot(62001).used,0);
});
test("sleep, quiet, settings, motion reduction and hidden page suppress unsummoned reactions",()=>{
 const b=createAttentionBudget();
 for(const key of ["visible","quiet","sleeping","deskOpen","settingsOpen","reducedMotion"]){
  const value=key==="visible"?false:true;
  assert.equal(b.eligible({now:2000000,[key]:value}),false,key);
 }
 assert.equal(b.snapshot(2000000).used,0);
 assert.equal(b.record(Infinity),false);
});
