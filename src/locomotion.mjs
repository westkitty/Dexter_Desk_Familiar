import {safePosition} from "./interaction.mjs";

// A tiny out-and-back patrol, calculated from local habitat geometry only.
// Visual motion is CSS-owned; the user's chosen resting position is not replaced.
export const PATROL_MS=2900;
export function planPatrol({anchor=50,sceneWidth,petWidth,random=Math.random}={}){
 if(!Number.isFinite(sceneWidth)||!Number.isFinite(petWidth)||sceneWidth<=0||petWidth<=0)return null;
 const home=safePosition(anchor,sceneWidth,petWidth);
 const delta=Math.min(72,sceneWidth*0.12)/sceneWidth*100;
 const left=safePosition(home-delta,sceneWidth,petWidth);
 const right=safePosition(home+delta,sceneWidth,petWidth);
 const choices=[left,right].filter(p=>Math.abs(p-home)>=1);
 if(choices.length===0)return null;
 let chance;
 try{chance=Number(random());}catch{return null;}
 if(!Number.isFinite(chance))return null;
 const target=choices.length===1?choices[0]:choices[chance<0.5?0:1];
 return {home,target,durationMs:PATROL_MS};
}
