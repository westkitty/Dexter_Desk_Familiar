export function clampPosition(value,min=15,max=85){
 if(!Number.isFinite(value))return 50;
 if(!Number.isFinite(min)||!Number.isFinite(max)||min>max)return 50;
 return Math.min(max,Math.max(min,Math.round(value*100)/100));
}
// The 15%-85% rail is reduced on narrow windows so Dexter stays fully onscreen.
export function safePosition(value,sceneWidth,petWidth,padding=8){
 if(!Number.isFinite(sceneWidth)||sceneWidth<=0||!Number.isFinite(petWidth)||petWidth<=0)
  return clampPosition(value);
 const inset=(petWidth/2+Math.max(0,padding))/sceneWidth*100;
 if(inset>=50)return 50;
 return clampPosition(value,Math.max(15,inset),Math.min(85,100-inset));
}
export function draggedPosition(start,deltaX,sceneWidth,petWidth){
 if(!Number.isFinite(sceneWidth)||sceneWidth<=0||!Number.isFinite(deltaX))
  return safePosition(start,sceneWidth,petWidth);
 return safePosition(start+deltaX/sceneWidth*100,sceneWidth,petWidth);
}
export function keyboardPosition(current,key,sceneWidth,petWidth){
 const next=key==="Home"?50:key==="ArrowLeft"?current-5:key==="ArrowRight"?current+5:current;
 return safePosition(next,sceneWidth,petWidth);
}
