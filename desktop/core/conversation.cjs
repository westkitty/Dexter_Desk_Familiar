'use strict';
// Conversation history. In memory by default; written to disk only when the
// user enables "Remember conversation on this Mac". Bounded in count and size.
const fs = require('node:fs');
const crypto = require('node:crypto');

const MAX_MESSAGES = 100;
const MAX_CHARS = 6000;
const ROLES = new Set(['user', 'assistant', 'dexter']);
const STATUSES = new Set(['complete', 'streaming', 'error', 'cancelled', 'truncated', 'local']);

function sanitizeMessage(m) {
  if (!m || typeof m !== 'object' || !ROLES.has(m.role) || typeof m.content !== 'string') return null;
  return {
    id: typeof m.id === 'string' && /^[a-f0-9-]{8,40}$/.test(m.id) ? m.id : crypto.randomUUID(),
    role: m.role,
    content: m.content.slice(0, MAX_CHARS),
    at: typeof m.at === 'string' && !Number.isNaN(Date.parse(m.at)) ? m.at : new Date().toISOString(),
    status: STATUSES.has(m.status) ? m.status : 'complete'
  };
}

function createConversation({file = null, persist = false} = {}) {
  let messages = [];
  let persisting = Boolean(persist && file);

  function trim() { if (messages.length > MAX_MESSAGES) messages = messages.slice(-MAX_MESSAGES); }
  function save() {
    if (!persisting) return false;
    const tmp = file + '.tmp';
    // Only completed turns are persisted; streaming placeholders are not.
    const data = messages.filter(m => m.status !== 'streaming');
    fs.writeFileSync(tmp, JSON.stringify({version: 1, messages: data}, null, 1), {mode: 0o600});
    fs.renameSync(tmp, file);
    return true;
  }
  function load() {
    if (!persisting) return 0;
    try {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
      messages = (Array.isArray(raw?.messages) ? raw.messages : []).map(sanitizeMessage).filter(Boolean);
      trim();
    } catch { messages = []; }
    return messages.length;
  }
  function add(role, content, status = 'complete') {
    const m = sanitizeMessage({role, content, status});
    if (!m) throw new TypeError('Invalid conversation message');
    messages.push(m); trim();
    return m;
  }
  function update(id, patch) {
    const m = messages.find(x => x.id === id);
    if (!m) return null;
    if (typeof patch.content === 'string') m.content = patch.content.slice(0, MAX_CHARS);
    if (STATUSES.has(patch.status)) m.status = patch.status;
    return m;
  }
  // Model context: only real user/assistant turns that completed.
  function context() {
    return messages.filter(m => (m.role === 'user' || m.role === 'assistant') &&
      (m.status === 'complete' || m.status === 'truncated' || m.status === 'local')).map(m => ({role: m.role, content: m.content}));
  }
  function list() { return messages.map(m => ({...m})); }
  function clear() {
    messages = [];
    if (file) { try { fs.rmSync(file, {force: true}); } catch {} }
  }
  function setPersist(enabled) {
    const next = Boolean(enabled && file);
    if (next === persisting) return;
    persisting = next;
    if (persisting) save();
    else if (file) { try { fs.rmSync(file, {force: true}); } catch {} }
  }
  return {add, update, context, list, clear, save, load, setPersist, get persisting() { return persisting; }, get size() { return messages.length; }};
}

module.exports = {createConversation, sanitizeMessage, MAX_MESSAGES, MAX_CHARS};
