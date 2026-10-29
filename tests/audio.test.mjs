import test from "node:test";
import assert from "node:assert/strict";
import {createAudio} from "../src/audio.mjs";
function fakeContext(onStart){
 const param={setValueAtTime(){},exponentialRampToValueAtTime(){}};
 return {
  currentTime:0,state:"running",destination:{},
  createOscillator(){return {frequency:param,connect(){},start:onStart,stop(){},disconnect(){}}},
  createGain(){return {gain:param,connect(){},disconnect(){}}},
  suspend(){this.state="suspended";return Promise.resolve();},
  close(){this.state="closed";return Promise.resolve();}
 };
}
test("disabled sound creates no audio context",()=>{
 let count=0;
 const a=createAudio({enabled:()=>false,contextFactory:()=>{count++;return fakeContext(()=>{})}});
 assert.equal(a.play(),false);assert.equal(count,0);
});
test("rapid repeated explicit huffs are throttled without sound stacking",()=>{
 let time=0,starts=0;
 const a=createAudio({enabled:()=>true,clock:()=>time,contextFactory:()=>fakeContext(()=>starts++)});
 assert.equal(a.play(),true);
 time=300;assert.equal(a.play(),false);
 time=650;assert.equal(a.play(),true);
 assert.equal(starts,2);
 a.dispose();
});
