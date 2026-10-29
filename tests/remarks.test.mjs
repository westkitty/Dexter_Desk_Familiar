import test from "node:test";
import assert from "node:assert/strict";
import {createRemarks} from "../src/remarks.mjs";
test("repeated explicit actions progress through three authored reactions",()=>{
 const r=createRemarks();
 assert.equal(r.choose("eating","Very well. One treat.",100),"Very well. One treat.");
 assert.equal(r.choose("eating","Very well. One treat.",200),"This is beginning to look like a negotiation.");
 assert.equal(r.choose("eating","Very well. One treat.",300),"Bribery. Continue.");
 assert.equal(r.choose("eating","Very well. One treat.",400),"Bribery. Continue.");
 assert.equal(r.choose("huffing","Hff. An official protest.",450),"Hff. An official protest.");
 r.reset();
 assert.equal(r.choose("eating","Very well. One treat.",500),"Very well. One treat.");
});
test("specific interaction messages cannot be overwritten by generic lines",()=>{
 const r=createRemarks();
 assert.equal(r.choose("huffing","This meeting was unnecessary.",100),"This meeting was unnecessary.");
 assert.equal(r.choose("huffing","Hff. An official protest.",110),"Hff. An official protest.");
 assert.equal(r.choose("sleeping","Off duty",200),"Off duty");
});
