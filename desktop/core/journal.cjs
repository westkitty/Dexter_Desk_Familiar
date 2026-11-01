'use strict';
// Opt-in local journal of check-in answers and session events (adapted from
// west_cat_overlay's log.jsonl and Reloaded's poll_responses.json). OFF by
// default. Bounded, mode 0600, never sent anywhere, deleted on disable/clear.
const fs = require('node:fs');
const MAX_ENTRIES = 1000;
const KINDS = new Set(['checkin', 'session']);
function createJournal({file, enabled = () => false, clock = () => Date.now()}) {
  function read() {
    try {
      return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    } catch { return []; }
  }
  function append(kind, data) {
    if (!enabled() || !KINDS.has(kind)) return false;
    const clean = {};
    for (const [k, v] of Object.entries(data || {}).slice(0, 6)) if (['string', 'number', 'boolean'].includes(typeof v)) clean[k] = typeof v === 'string' ? v.slice(0, 160) : v;
    let lines = read();
    lines.push({at: new Date(clock()).toISOString(), kind, ...clean});
    if (lines.length > MAX_ENTRIES) lines = lines.slice(-MAX_ENTRIES);
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, lines.map(l => JSON.stringify(l)).join('\n') + '\n', {mode: 0o600});
    fs.renameSync(tmp, file);
    return true;
  }
  function clear() { try { fs.rmSync(file, {force: true}); } catch {} }
  return {append, read, clear, exists: () => fs.existsSync(file)};
}
module.exports = {createJournal, MAX_ENTRIES};
