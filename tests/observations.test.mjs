import test from "node:test";
import assert from "node:assert/strict";
import {isCountedKey,countRecentKeys} from "../src/observations.mjs";
const k=(key,extra={})=>({key,repeat:false,isComposing:false,ctrlKey:false,metaKey:false,altKey:false,...extra});
test("counts actual edits, not shortcuts or repeating keys",()=>{
  for(const key of ["a","3"," ","Backspace","Delete","Enter"]) assert.equal(isCountedKey(k(key)),true,key);
  for(const key of ["Escape","Tab","Shift","Control","Alt","Meta","Dead","Process"]) assert.equal(isCountedKey(k(key)),false,key);
  assert.equal(isCountedKey(k("a",{ctrlKey:true})),false);
  assert.equal(isCountedKey(k("a",{metaKey:true})),false);
  assert.equal(isCountedKey(k("a",{altKey:true})),false);
  assert.equal(isCountedKey(k("a",{isComposing:true})),false);
  assert.equal(isCountedKey(k("a",{repeat:true})),false);
});
test("rolling count has exclusive 6-second boundary and ignores future/invalid entries",()=>{
 assert.equal(countRecentKeys([100,101,6100,6101,NaN],6100),2);
 assert.equal(countRecentKeys([1,2,3],10,1),0);
 assert.equal(countRecentKeys([],Infinity),0);
});
