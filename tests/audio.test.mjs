import test from 'node:test';
import assert from 'node:assert/strict';
import {createAudio} from '../src/audio.mjs';
function makeContext(onStart){
 const point={setValueAtTime(){},exponentialRampToValueAtTime(){}};
 const oscillator={frequency:point,connect(){},disconnect(){},start(){onStart();},stop(){},onended:null};
 const gain={gain:point,connect(){},disconnect(){}};
 return {state:'running',currentTime:0,destination:{},createOscillator:()=>({...oscillator}),createGain:()=>({...gain}),suspend(){this.state='suspended'},resume(){this.state='running'},close(){this.state='closed'}};
}
test('opt-out does not instantiate audio',()=>{
 let constructed=0;
 const a=createAudio({enabled:()=>false,contextFactory:()=>{constructed++;return makeContext(()=>{});}});
 assert.equal(a.play('huff'),false);
 assert.equal(constructed,0);
});
test('fast repeated clicks never stack huff oscillators',()=>{
 let t=0,started=0,constructed=0;
 const audio=createAudio({enabled:()=>true,clock:()=>t,contextFactory:()=>{constructed++;return makeContext(()=>started++);}});
 assert.equal(audio.play(),true);
 t=100;assert.equal(audio.play(),false);
 t=649;assert.equal(audio.play(),false);
 t=650;assert.equal(audio.play(),true);
 assert.equal(started,2);
 assert.equal(constructed,1);
 audio.dispose();
});
test('unexpected audio cues and invalid clocks are ignored',()=>{
 let t=NaN;
 const a=createAudio({enabled:()=>true,clock:()=>t,contextFactory:()=>makeContext(()=>{})});
 assert.equal(a.play('other'),false);
 assert.equal(a.play('huff'),false);
});
