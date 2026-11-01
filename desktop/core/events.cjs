'use strict';
// In-memory familiar event bus + bounded log for diagnostics.
// Never persisted. Details are restricted to short primitive values, so message
// text, file paths or coordinates cannot leak into exported reports.
const TYPES = new Set(['app', 'window', 'interaction', 'state', 'ai', 'tts', 'checkin', 'settings', 'error', 'power', 'display']);

function cleanDetail(detail) {
  const out = {};
  if (!detail || typeof detail !== 'object') return out;
  for (const [key, value] of Object.entries(detail).slice(0, 8)) {
    if (!/^[a-zA-Z][a-zA-Z0-9]{0,23}$/.test(key)) continue;
    if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
    else if (typeof value === 'boolean') out[key] = value;
    else if (typeof value === 'string') out[key] = value.slice(0, 80);
  }
  return out;
}

function createEventLog({limit = 200, clock = () => Date.now()} = {}) {
  const max = Number.isInteger(limit) && limit > 0 ? limit : 200;
  let entries = [];
  const counts = Object.create(null);
  const listeners = new Set();
  function record(type, name, detail) {
    if (!TYPES.has(type) || typeof name !== 'string') return null;
    const entry = {t: clock(), type, name: name.slice(0, 40), detail: cleanDetail(detail)};
    entries.push(entry);
    if (entries.length > max) entries = entries.slice(-max);
    counts[type + ':' + entry.name] = (counts[type + ':' + entry.name] || 0) + 1;
    for (const listener of listeners) { try { listener(entry); } catch {} }
    return entry;
  }
  function on(listener) { listeners.add(listener); return () => listeners.delete(listener); }
  function recent(n = 50) { return entries.slice(-Math.max(0, n)).map(e => ({...e, detail: {...e.detail}})); }
  function count(type, name) { return counts[type + ':' + name] || 0; }
  function summary() { return {...counts}; }
  return {record, on, recent, count, summary, get size() { return entries.length; }, get listenerCount() { return listeners.size; }};
}

module.exports = {createEventLog, cleanDetail, TYPES};
