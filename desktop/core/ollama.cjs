'use strict';
// Optional local model adapter (Ollama-compatible HTTP API).
// Concepts adapted from WestCat_Overlay_MacOS/ollama_client.py: health check via
// /api/tags, NDJSON streaming from /api/chat, cooperative cancellation.
// Differences by design: no hardcoded host (loopback default), explicit opt-in
// checked on every call, endpoint policy enforcement, bounded context and reply,
// header/idle/total timeouts, and no model-family preference.
const {validateEndpoint} = require('../window-state.cjs');

const MAX_REPLY_CHARS = 6000;
const MAX_MESSAGE_CHARS = 4000;

class PolicyError extends Error {}

function resolveModel(configured, available) {
  const names = (Array.isArray(available) ? available : []).filter(n => typeof n === 'string' && n.trim()).map(n => n.trim());
  if (!names.length) return {model: null, fallback: false};
  const wanted = typeof configured === 'string' ? configured.trim() : '';
  if (wanted) {
    if (names.includes(wanted)) return {model: wanted, fallback: false};
    if (!wanted.includes(':') && names.includes(wanted + ':latest')) return {model: wanted + ':latest', fallback: false};
  }
  return {model: names[0], fallback: Boolean(wanted)};
}

// Keep only well-formed user/assistant turns, newest last, bounded by count and size.
function boundedContext(messages, limit) {
  const max = Number.isInteger(limit) && limit > 0 ? limit : 12;
  return (Array.isArray(messages) ? messages : [])
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-max)
    .map(m => ({role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS)}));
}

// Split an NDJSON byte stream into parsed objects. Returns leftover partial line.
function parseNdjson(buffer, chunk) {
  const lines = (buffer + chunk).split('\n');
  const rest = lines.pop();
  const items = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    items.push(JSON.parse(trimmed));
  }
  return {items, rest};
}

function createOllamaClient({fetchImpl = globalThis.fetch, getConfig, onEgress = () => {}, headerTimeoutMs = 15000, idleTimeoutMs = 30000} = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetch implementation required');
  if (typeof getConfig !== 'function') throw new TypeError('getConfig required');
  let active = null;

  function allowedBase() {
    const config = getConfig() || {};
    if (!config.enabled) throw new PolicyError('Local AI is turned off in Settings.');
    const checked = validateEndpoint(config.endpoint, {allowRemote: Boolean(config.allowRemote)});
    if (!checked.ok) throw new PolicyError(checked.reason);
    return {config, base: checked.url, loopback: checked.loopback};
  }

  async function timedFetch(url, options, ms, external) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (external) {
      if (external.aborted) controller.abort();
      else external.addEventListener('abort', abort, {once: true});
    }
    const timer = setTimeout(() => controller.abort(new Error('timeout')), ms);
    try {
      return {response: await fetchImpl(url, {...options, signal: controller.signal}), controller};
    } finally {
      clearTimeout(timer);
      external?.removeEventListener?.('abort', abort);
    }
  }

  async function listModels() {
    const {base, loopback} = allowedBase();
    onEgress({kind: 'tags', loopback});
    let result;
    try { result = await timedFetch(base + '/api/tags', {method: 'GET'}, 8000); }
    catch { throw new Error('Could not reach the model server at ' + base + '.'); }
    const {response} = result;
    if (!response.ok) throw new Error('Model server returned HTTP ' + response.status + '.');
    let payload;
    try { payload = await response.json(); } catch { throw new Error('Model server sent an unreadable model list.'); }
    const models = Array.isArray(payload?.models) ? payload.models : [];
    return models.map(m => m && typeof m.name === 'string' ? m.name : null).filter(Boolean).slice(0, 200);
  }

  async function testConnection() {
    try {
      const models = await listModels();
      const {config} = allowedBase();
      const chosen = resolveModel(config.model, models);
      if (!chosen.model) return {ok: false, models, detail: 'Connected, but no models are installed. Dexter will not download one.'};
      return {ok: true, models, model: chosen.model, fallback: chosen.fallback,
        detail: chosen.fallback ? 'Connected. Configured model missing; using ' + chosen.model + '.' : 'Connected. Using ' + chosen.model + '.'};
    } catch (error) {
      return {ok: false, models: [], detail: error.message, policy: error instanceof PolicyError};
    }
  }

  function cancel() {
    if (active) { active.cancelled = true; active.controller?.abort(); }
  }
  function busy() { return Boolean(active); }

  // Streams a reply. Never throws for network/model failures: returns a status.
  async function streamChat({messages, systemPrompt, onToken = () => {}, contextLimit}) {
    if (active) return {status: 'error', text: '', detail: 'A reply is already in progress.'};
    const job = {cancelled: false, controller: null};
    active = job;
    let text = '';
    let idleTimer = null, totalTimer = null, reason = null;
    try {
      const {config, base, loopback} = allowedBase();
      const available = await listModels();
      const {model} = resolveModel(config.model, available);
      if (!model) return {status: 'error', text: '', detail: 'No local model is installed.'};
      if (job.cancelled) return {status: 'cancelled', text: '', detail: 'Cancelled.'};
      const body = JSON.stringify({model, stream: true,
        messages: [{role: 'system', content: String(systemPrompt || '')}, ...boundedContext(messages, contextLimit || config.contextMessages)]});
      const controller = new AbortController();
      job.controller = controller;
      const totalMs = Math.max(10, Number(config.timeoutSeconds) || 60) * 1000;
      totalTimer = setTimeout(() => { reason = 'timeout'; controller.abort(); }, totalMs);
      const armIdle = ms => { clearTimeout(idleTimer); idleTimer = setTimeout(() => { reason = reason || 'stalled'; controller.abort(); }, ms); };
      armIdle(headerTimeoutMs);
      onEgress({kind: 'chat', loopback});
      const response = await fetchImpl(base + '/api/chat', {method: 'POST', headers: {'Content-Type': 'application/json'}, body, signal: controller.signal});
      if (!response.ok) return {status: 'error', text: '', detail: 'Model server returned HTTP ' + response.status + '.'};
      if (!response.body?.getReader) return {status: 'error', text: '', detail: 'Model server did not stream a reply.'};
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let rest = '';
      for (;;) {
        armIdle(idleTimeoutMs);
        const {value, done} = await reader.read();
        if (done) break;
        const parsed = parseNdjson(rest, decoder.decode(value, {stream: true}));
        rest = parsed.rest;
        for (const item of parsed.items) {
          if (item && typeof item.error === 'string') return {status: 'error', text, detail: 'Model error: ' + item.error.slice(0, 200)};
          const piece = typeof item?.message?.content === 'string' ? item.message.content : '';
          if (piece) {
            const room = MAX_REPLY_CHARS - text.length;
            const accepted = piece.slice(0, Math.max(0, room));
            if (accepted) { text += accepted; onToken(accepted); }
            if (text.length >= MAX_REPLY_CHARS) { controller.abort(); return {status: 'truncated', text, detail: 'Reply truncated at ' + MAX_REPLY_CHARS + ' characters.'}; }
          }
          if (item?.done) return {status: 'done', text, model};
        }
      }
      return text ? {status: 'done', text, model} : {status: 'error', text, detail: 'The model ended without a reply.'};
    } catch (error) {
      if (job.cancelled) return {status: 'cancelled', text, detail: 'Cancelled.'};
      if (reason === 'timeout') return {status: 'error', text, detail: 'The model took too long and was stopped.'};
      if (reason === 'stalled') return {status: 'error', text, detail: 'The model stopped responding.'};
      if (error instanceof PolicyError) return {status: 'disabled', text: '', detail: error.message};
      if (error instanceof SyntaxError) return {status: 'error', text, detail: 'Model server sent malformed data.'};
      return {status: 'offline', text, detail: error.message && error.message.startsWith('Could not reach') ? error.message : 'Could not reach the model server.'};
    } finally {
      clearTimeout(idleTimer); clearTimeout(totalTimer);
      if (active === job) active = null;
    }
  }
  return {listModels, testConnection, streamChat, cancel, busy};
}

module.exports = {createOllamaClient, resolveModel, boundedContext, parseNdjson, PolicyError, MAX_REPLY_CHARS};
