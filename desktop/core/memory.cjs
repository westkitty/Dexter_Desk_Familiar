'use strict';
// Long-term notes behind a continuity firewall (adapted from Westcat_Familiar's
// continuityFirewall.ts, without its mock memory). Notes are written only by the
// user (/remember or Settings). They cross into a model request only when the
// user enabled "Use my notes in AI context"; every crossing is counted.
const fs = require('node:fs');
const crypto = require('node:crypto');
const MAX_NOTES = 50, MAX_NOTE = 280;
function createNotes({file}) {
  let notes = [];
  let crossings = 0;
  function load() {
    try {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
      notes = (Array.isArray(raw?.notes) ? raw.notes : []).map(n => n && typeof n.text === 'string' && n.text.trim()
        ? {id: typeof n.id === 'string' && /^n-[a-f0-9]{8}$/.test(n.id) ? n.id : 'n-' + crypto.randomBytes(4).toString('hex'),
          text: n.text.trim().slice(0, MAX_NOTE), at: typeof n.at === 'string' ? n.at : new Date().toISOString()} : null).filter(Boolean).slice(-MAX_NOTES);
    } catch { notes = []; }
    return notes.length;
  }
  function save() {
    if (!notes.length) { try { fs.rmSync(file, {force: true}); } catch {} return; }
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify({version: 1, notes}, null, 1), {mode: 0o600});
    fs.renameSync(tmp, file);
  }
  function add(text) {
    const t = String(text || '').replace(/\s+/g, ' ').trim().slice(0, MAX_NOTE);
    if (!t) return null;
    const note = {id: 'n-' + crypto.randomBytes(4).toString('hex'), text: t, at: new Date().toISOString()};
    notes.push(note); if (notes.length > MAX_NOTES) notes = notes.slice(-MAX_NOTES);
    save(); return note;
  }
  function remove(id) { const before = notes.length; notes = notes.filter(n => n.id !== id); if (notes.length !== before) save(); return before !== notes.length; }
  function clear() { notes = []; save(); }
  // The firewall: returns a system-context block only when allowed, and counts it.
  function cross(allowed, purpose) {
    if (!allowed || !notes.length) return null;
    crossings++;
    return {purpose: String(purpose || '').slice(0, 40), text: 'Notes the user asked you to remember:\n' + notes.map(n => '- ' + n.text).join('\n')};
  }
  return {load, add, remove, clear, cross, list: () => notes.map(n => ({...n})), get crossings() { return crossings; }, get size() { return notes.length; }};
}
module.exports = {createNotes, MAX_NOTES, MAX_NOTE};
