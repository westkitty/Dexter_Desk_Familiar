export const STATE_PRESENTATION=Object.freeze({
  idle:{label:"UNIMPRESSED",pose:"sit",caption:"PRESENT · UNIMPRESSED"},
  watching:{label:"OBSERVING",pose:"sit",caption:"WATCHING · PAGE ONLY"},
  working:{label:"SUPERVISING",pose:"stand",caption:"KEYS · THIS DESK ONLY"},
  judging:{label:"JUDGING",pose:"sit",caption:"EVALUATION IN PROGRESS"},
  wandering:{label:"PATROLLING",pose:"stand",caption:"BRIEF INSPECTION"},
  resting:{label:"WITHDRAWN",pose:"rest",caption:"OFF DUTY"},
  sleeping:{label:"ASLEEP",pose:"rest",caption:"DO NOT DISTURB"},
  huffing:{label:"DISAPPROVING",pose:"sit",caption:"STATEMENT ISSUED"},
  eating:{label:"APPEASED",pose:"stand",caption:"TRIBUTE ACCEPTED"}
});
export function poseForState(state){return STATE_PRESENTATION[state]?.pose??"sit";}
export function renderState(state,{pet,sprite,stateLabel,sceneCaption},previousState) {
  if(state===previousState) return false;
  const presentation=STATE_PRESENTATION[state]??STATE_PRESENTATION.idle;
  const src="./assets/dexter-"+presentation.pose+"-96.png";
  if(sprite.getAttribute("src")!==src) sprite.setAttribute("src",src);
  pet.dataset.state=state;
  stateLabel.textContent=presentation.label;
  sceneCaption.textContent=presentation.caption;
  return true;
}
