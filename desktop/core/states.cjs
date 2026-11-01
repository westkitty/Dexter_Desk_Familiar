'use strict';
// Semantic familiar states with explicit transitions and auto-return, adapted
// from Westcat_Familiar/familiarStateMachine.ts. Dexter's 9 visual states stay
// the rendering truth; each semantic state maps onto one of them.
const SEMANTIC = Object.freeze({
  idle: {visual: 'idle', to: ['watching', 'thinking', 'working', 'judging', 'alert', 'sleeping', 'summoning', 'annoyed', 'blocked']},
  watching: {visual: 'watching', to: ['idle', 'thinking', 'working', 'judging', 'alert', 'sleeping', 'summoning', 'annoyed', 'blocked']},
  thinking: {visual: 'judging', to: ['idle', 'watching', 'working', 'judging', 'blocked'], autoReturn: {to: 'idle', ms: 6000}},
  working: {visual: 'working', to: ['idle', 'watching', 'alert'], autoReturn: {to: 'idle', ms: 5000}},
  judging: {visual: 'judging', to: ['idle', 'watching', 'thinking', 'annoyed', 'blocked'], autoReturn: {to: 'watching', ms: 20000}},
  annoyed: {visual: 'huffing', to: ['idle', 'watching'], autoReturn: {to: 'idle', ms: 2600}},
  alert: {visual: 'watching', to: ['idle', 'watching', 'thinking', 'summoning', 'sleeping'], autoReturn: {to: 'watching', ms: 8000}},
  blocked: {visual: 'huffing', to: ['idle', 'watching'], autoReturn: {to: 'idle', ms: 7000}},
  sleeping: {visual: 'sleeping', to: ['idle', 'watching', 'summoning']},
  summoning: {visual: 'watching', to: ['idle', 'watching', 'thinking', 'judging', 'working', 'alert', 'sleeping'], autoReturn: {to: 'watching', ms: 2600}}
});
function canTransition(from, to) {
  if (from === to || !SEMANTIC[from] || !SEMANTIC[to]) return false;
  return SEMANTIC[from].to.includes(to);
}
// A small machine with injected timers so tests control time.
function createSemanticMachine({onChange = () => {}, setTimer = setTimeout, clearTimer = clearTimeout} = {}) {
  let current = 'idle', timer = null, history = [];
  function enter(next, reason, {force = false} = {}) {
    if (!SEMANTIC[next]) return {ok: false, reason: 'unknown state'};
    if (!force && !canTransition(current, next)) return {ok: false, reason: current + ' → ' + next + ' not allowed'};
    clearTimer(timer); timer = null;
    const from = current; current = next;
    history.push({at: Date.now(), from, to: next, reason: String(reason || '').slice(0, 60)});
    if (history.length > 50) history = history.slice(-50);
    onChange({from, to: next, visual: SEMANTIC[next].visual, reason});
    const back = SEMANTIC[next].autoReturn;
    if (back) timer = setTimer(() => { timer = null; enter(back.to, 'auto-return', {force: true}); }, back.ms);
    return {ok: true};
  }
  return {enter, get current() { return current; }, history: () => history.slice(), dispose() { clearTimer(timer); }};
}
module.exports = {SEMANTIC, canTransition, createSemanticMachine};
