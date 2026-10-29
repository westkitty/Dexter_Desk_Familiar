export function clampPosition(value,min=15,max=85){
 if(!Number.isFinite(value))return 50;
 return Math.min(max,Math.max(min,Math.round(value*100)/100));
}
export function draggedPosition(start,deltaX,sceneWidth){
 if(!Number.isFinite(sceneWidth)||sceneWidth<=0||!Number.isFinite(deltaX))return clampPosition(start);
 return clampPosition(start+deltaX/sceneWidth*100);
}
export function keyboardPosition(current,key){
 if(key==="Home")return 50;
 if(key==="ArrowLeft")return clampPosition(current-5);
 if(key==="ArrowRight")return clampPosition(current+5);
 return clampPosition(current);
}
