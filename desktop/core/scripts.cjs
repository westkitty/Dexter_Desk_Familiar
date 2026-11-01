'use strict';
// Scripted playback (adapted from WESTCAT-OVERLAY-RELOADED's demo conversation
// player). A short authored Dexter routine, played through his bubble.
const DEMO = Object.freeze([
  {say: 'Ah. A demonstration. Very well.', state: 'watching', ms: 2600},
  {say: 'This is me, observing. Note the restraint.', state: 'judging', ms: 3000},
  {gag: 'hop', say: 'This is me, moving. Do not expect it often.', state: 'wandering', ms: 3000},
  {gag: 'sneeze', say: 'That did not happen.', state: 'huffing', ms: 2600},
  {say: 'Right-click me for options. Or do not. I will judge either way.', state: 'watching', ms: 3600},
  {say: 'Demonstration concluded. You may applaud silently.', state: 'idle', ms: 2600}
]);
function createPlayer({onStep, setTimer = setTimeout, clearTimer = clearTimeout}) {
  let timer = null, index = -1, script = null;
  function step() {
    index++;
    if (!script || index >= script.length) { stop(); return; }
    const s = script[index];
    onStep(s, index, script.length);
    timer = setTimer(step, s.ms);
  }
  function play(steps = DEMO) { stop(); script = steps; index = -1; step(); return true; }
  function stop() { clearTimer(timer); timer = null; const was = Boolean(script); script = null; index = -1; return was; }
  return {play, stop, get playing() { return Boolean(script); }};
}
module.exports = {DEMO, createPlayer};
