import test from "node:test";
import assert from "node:assert/strict";
import {STORAGE_KEY,readSettings,writeSettings,resetSettings} from "../src/settings.mjs";
const mock=()=>{const data=new Map();return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};};
test("settings store only four explicit preference keys",()=>{
 const storage=mock();
 assert.equal(writeSettings(storage,{sound:true,quiet:false,reducedMotion:true,idleSeconds:120,typedText:"secret",tabHistory:[1]}),true);
 const parsed=JSON.parse(storage.getItem(STORAGE_KEY));
 assert.deepEqual(Object.keys(parsed).sort(),["idleSeconds","quiet","reducedMotion","sound"]);
 assert.equal(readSettings(storage).idleSeconds,120);
});
test("bad settings and unavailable storage restore defaults safely",()=>{
 const storage=mock();storage.setItem(STORAGE_KEY,"{bad");
 assert.equal(readSettings(storage,true).reducedMotion,true);
 storage.setItem(STORAGE_KEY,JSON.stringify({idleSeconds:-1,sound:"yes",unknown:123}));
 assert.deepEqual(readSettings(storage),{sound:false,quiet:false,reducedMotion:false,idleSeconds:60});
 const denied={getItem(){throw Error("denied")},setItem(){throw Error("denied")},removeItem(){throw Error("denied")}};
 assert.equal(writeSettings(denied,{}),false);
 assert.equal(resetSettings(denied),false);
 assert.equal(readSettings(denied).sound,false);
});
test("reset removes only own preference key",()=>{
 const storage=mock();storage.setItem("unrelated","preserve");writeSettings(storage,{sound:true});
 assert.equal(resetSettings(storage),true);assert.equal(storage.getItem(STORAGE_KEY),null);assert.equal(storage.getItem("unrelated"),"preserve");
});
