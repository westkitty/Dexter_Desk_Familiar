'use strict';
// Check-in selection with follow-ups (built-in + user-authored), adapted from
// west_cat_overlay/tracker.py (no repeats until the set is exhausted, follow-up
// questions) and Reloaded's poll overlay, in Dexter's voice.
const persona = require('./persona.cjs');

const BUILTIN_FOLLOWUPS = Object.freeze({
  status: {1: {text: 'Poorly how. Pick one.', choices: [
    {label: 'Stuck', reply: 'Explain it to me. Out loud. I will pretend to listen.', state: 'watching'},
    {label: 'Tired', reply: 'Then rest. The work will still be disappointing later.', state: 'resting'}]}},
  focus: {1: {text: 'Then which one first.', choices: [
    {label: 'The hard one', reply: 'Correct. Proceed.', state: 'judging'},
    {label: 'The easy one', reply: 'Momentum. Acceptable, this once.', state: 'watching'}]}}
});
function builtinPool() {
  return persona.CHECKINS.map(c => ({id: c.id, text: c.text, choices: c.choices.map((ch, i) => {
    const f = BUILTIN_FOLLOWUPS[c.id] && BUILTIN_FOLLOWUPS[c.id][i];
    return f ? {...ch, followUp: f} : {...ch};
  })}));
}
function pool(settings) {
  const custom = Array.isArray(settings && settings.customCheckins) ? settings.customCheckins : [];
  const source = settings && settings.checkinSource;
  if (source === 'custom' && custom.length) return custom;
  if (source === 'builtin' || !custom.length) return builtinPool();
  return builtinPool().concat(custom);
}
function createPicker({random = Math.random} = {}) {
  let asked = new Set();
  function next(settings, lastId) {
    const all = pool(settings);
    let options = all.filter(c => !asked.has(c.id) && c.id !== lastId);
    if (!options.length) { asked = new Set(); options = all.filter(c => c.id !== lastId); }
    if (!options.length) options = all;
    const chosen = options[Math.min(options.length - 1, Math.floor(Math.max(0, Number(random()) || 0) * options.length))];
    asked.add(chosen.id);
    return chosen;
  }
  return {next, reset() { asked = new Set(); }};
}
// Resolve an answer path like [0] or [1, 0] (choice, then follow-up choice).
function resolve(checkin, path) {
  if (!checkin || !Array.isArray(path) || !path.length || path.length > 2) return null;
  let choices = checkin.choices, choice = null;
  for (const index of path) {
    if (!Array.isArray(choices) || !Number.isInteger(index) || index < 0 || index >= choices.length) return null;
    choice = choices[index];
    choices = choice.followUp ? choice.followUp.choices : null;
  }
  return choice;
}
function publicView(checkin, path = []) {
  if (!path.length) return {id: checkin.id, text: checkin.text, choices: checkin.choices.map(c => c.label), path: []};
  const choice = resolve(checkin, path);
  if (!choice || !choice.followUp) return null;
  return {id: checkin.id, text: choice.followUp.text, choices: choice.followUp.choices.map(c => c.label), path};
}
// Quick-add from chat: "/ask Question? | Answer A | Answer B"
function parseQuickAsk(args) {
  const parts = String(args || '').split('|').map(s => s.trim()).filter(Boolean);
  if (parts.length < 3 || parts.length > 5) return null;
  return {text: parts[0], choices: parts.slice(1).map(label => ({label, reply: 'Noted: ' + label.toLowerCase() + '.', state: 'watching'}))};
}
module.exports = {builtinPool, pool, createPicker, resolve, publicView, parseQuickAsk};
