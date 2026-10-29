import test from "node:test";
import assert from "node:assert/strict";
import {poseForState,renderState,STATE_PRESENTATION} from "../src/renderer.mjs";
test("every logical state has an explicit static fallback pose",()=>{
 for(const [state,p] of Object.entries(STATE_PRESENTATION)){
   assert.ok(["sit","stand","rest"].includes(poseForState(state)));
   assert.ok(p.label&&p.caption);
 }
 assert.equal(poseForState("unknown"),"sit");
});
test("render does not change sprite for unchanged state",()=>{
 const attributes={src:"./assets/dexter-sit-96.png"};let writes=0;
 const sprite={getAttribute:n=>attributes[n],setAttribute:(n,v)=>{writes++;attributes[n]=v}};
 const pet={dataset:{}},stateLabel={textContent:""},sceneCaption={textContent:""};
 const elements={sprite,pet,stateLabel,sceneCaption};
 assert.equal(renderState("huffing",elements,"idle"),true);
 assert.equal(writes,0);assert.equal(stateLabel.textContent,"DISAPPROVING");
 assert.equal(renderState("huffing",elements,"huffing"),false);assert.equal(writes,0);
});
