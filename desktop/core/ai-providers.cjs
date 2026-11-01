'use strict';
// Unified local and private-network AI provider layer.
// Supports:
// 1. Ollama native API: /api/tags (model listing), /api/chat (NDJSON streaming)
// 2. OpenAI-compatible API: /v1/models (model listing), /v1/chat/completions (SSE streaming)
// 3. Hermes gateway compatibility: marked UNVERIFIED pending protocol inspection.
// Reuses stream caps, timeouts, cancellation, conversation context bounding, and egress auditing.

const {validateEndpoint} = require('../window-state.cjs');

const MAX_REPLY_CHARS = 6000;
const MAX_MESSAGE_CHARS = 4000;

class PolicyError extends Error {}

function resolveModel(configured, available) {
  const names = (Array.isArray(available) ? available : [])
    .filter(n => typeof n === 'string' && n.trim())
    .map(n => n.trim());
  if (!names.length) return {model: null, fallback: false};
  const wanted = typeof configured === 'string' ? configured.trim() : '';
  if (wanted) {
    if (names.includes(wanted)) return {model: wanted, fallback: false};
    if (!wanted.includes(':') && names.includes(wanted + ':latest')) return {model: wanted + ':latest', fallback: false};
  }
  return {model: names[0], fallback: Boolean(wanted)};
}

function boundedContext(messages, limit) {
  const max = Number.isInteger(limit) && limit > 0 ? limit : 12;
  return (Array.isArray(messages) ? messages : [])
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-max)
    .map(m => ({role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS)}));
}

function parseNdjson(buffer, chunk) {
  const lines = (buffer + chunk).split('\n');
  const rest = lines.pop();
  const items = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      items.push(JSON.parse(trimmed));
    } catch {
      // Ignore partial/corrupt line
    }
  }
  return {items, rest};
}

function parseSse(buffer, chunk) {
  const lines = (buffer + chunk).split('\n');
  const rest = lines.pop();
  const items = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith('data:')) continue;
    const payload = trimmed.slice(5).trim();
    if (payload === '[DONE]') {
      items.push({done: true});
      continue;
    }
    try {
      items.push(JSON.parse(payload));
    } catch {
      // Ignore non-JSON SSE ping or comment
    }
  }
  return {items, rest};
}

function normalizeOpenAiBase(baseUrl) {
  const clean = String(baseUrl || '').replace(/\/+$/, '');
  return clean;
}

function createAiClient({
  fetchImpl = globalThis.fetch,
  getConfig,
  onEgress = () => {},
  headerTimeoutMs = 15000,
  idleTimeoutMs = 30000
} = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetch implementation required');
  if (typeof getConfig !== 'function') throw new TypeError('getConfig required');
  let active = null;

  function allowedBase() {
    const config = getConfig() || {};
    if (!config.enabled) throw new PolicyError('Local AI is turned off in Settings.');
    const provider = config.provider || 'ollama';
    const allowPath = provider === 'openai_compatible' || provider === 'hermes_unverified' || String(config.endpoint || '').includes('/v1');
    const checked = validateEndpoint(config.endpoint, {
      allowRemote: Boolean(config.allowRemote),
      allowPath
    });
    if (!checked.ok) throw new PolicyError(checked.reason);
    return {config, base: checked.url, loopback: checked.loopback, provider};
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
    const {base, loopback, provider} = allowedBase();
    onEgress({kind: 'tags', loopback, provider});

    if (provider === 'openai_compatible' || provider === 'hermes_unverified') {
      const url = base.endsWith('/v1') ? `${base}/models` : `${base}/v1/models`;
      let result;
      try {
        result = await timedFetch(url, {method: 'GET'}, 8000);
      } catch (err) {
        throw new Error('Could not reach model server at ' + base + '. ' + (loopback ? 'If using Big Mac via tunnel, verify port forward is active.' : ''));
      }
      const {response} = result;
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Protocol incompatible: /v1/models returned HTTP 404.');
        }
        throw new Error('Model server returned HTTP ' + response.status + '.');
      }
      let payload;
      try { payload = await response.json(); } catch { throw new Error('Model server sent an unreadable model list.'); }
      const list = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.models) ? payload.models : [];
      return list.map(m => (m && typeof m.id === 'string' ? m.id : typeof m?.name === 'string' ? m.name : null)).filter(Boolean).slice(0, 200);
    }

    // Default: Ollama native API
    let result;
    try {
      result = await timedFetch(`${base}/api/tags`, {method: 'GET'}, 8000);
    } catch {
      throw new Error('Could not reach the model server at ' + base + '.');
    }
    const {response} = result;
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Protocol incompatible: /api/tags returned HTTP 404.');
      }
      throw new Error('Model server returned HTTP ' + response.status + '.');
    }
    let payload;
    try { payload = await response.json(); } catch { throw new Error('Model server sent an unreadable model list.'); }
    const models = Array.isArray(payload?.models) ? payload.models : [];
    return models.map(m => (m && typeof m.name === 'string' ? m.name : null)).filter(Boolean).slice(0, 200);
  }

  async function testConnection() {
    const startTime = Date.now();
    try {
      const {config, provider} = allowedBase();
      const models = await listModels();
      const chosen = resolveModel(config.model, models);
      const elapsedMs = Date.now() - startTime;
      const providerLabel = provider === 'openai_compatible' ? 'OpenAI-compatible' : provider === 'hermes_unverified' ? 'Hermes (unverified)' : 'Ollama';
      if (!chosen.model) {
        return {
          ok: false,
          models,
          elapsedMs,
          provider,
          detail: `Connected (${providerLabel}, ${elapsedMs}ms), but no models are installed. Dexter will not download one.`
        };
      }
      return {
        ok: true,
        models,
        model: chosen.model,
        fallback: chosen.fallback,
        elapsedMs,
        provider,
        detail: chosen.fallback
          ? `Connected (${providerLabel}, ${elapsedMs}ms). Configured model missing; using ${chosen.model}.`
          : `Connected (${providerLabel}, ${elapsedMs}ms). Using ${chosen.model}.`
      };
    } catch (error) {
      const elapsedMs = Date.now() - startTime;
      return {
        ok: false,
        models: [],
        elapsedMs,
        detail: error.message,
        policy: error instanceof PolicyError
      };
    }
  }

  function cancel() {
    if (active) {
      active.cancelled = true;
      active.controller?.abort();
    }
  }

  function busy() {
    return Boolean(active);
  }

  async function streamChat({messages, systemPrompt, onToken = () => {}, contextLimit}) {
    if (active) return {status: 'error', text: '', detail: 'A reply is already in progress.'};
    const job = {cancelled: false, controller: null};
    active = job;
    let text = '';
    let idleTimer = null, totalTimer = null, reason = null;

    try {
      const {config, base, loopback, provider} = allowedBase();
      const available = await listModels();
      const {model} = resolveModel(config.model, available);
      if (!model) return {status: 'error', text: '', detail: 'No local model is installed.'};
      if (job.cancelled) return {status: 'cancelled', text: '', detail: 'Cancelled.'};

      const controller = new AbortController();
      job.controller = controller;
      const totalMs = Math.max(10, Number(config.timeoutSeconds) || 60) * 1000;
      totalTimer = setTimeout(() => { reason = 'timeout'; controller.abort(); }, totalMs);
      const armIdle = ms => {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => { reason = reason || 'stalled'; controller.abort(); }, ms);
      };
      armIdle(headerTimeoutMs);

      onEgress({kind: 'chat', loopback, provider});

      if (provider === 'openai_compatible' || provider === 'hermes_unverified') {
        const url = base.endsWith('/v1') ? `${base}/chat/completions` : `${base}/v1/chat/completions`;
        const chatMessages = [];
        if (systemPrompt) chatMessages.push({role: 'system', content: String(systemPrompt)});
        chatMessages.push(...boundedContext(messages, contextLimit || config.contextMessages));

        const body = JSON.stringify({
          model,
          stream: true,
          messages: chatMessages
        });

        const response = await fetchImpl(url, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body,
          signal: controller.signal
        });

        if (!response.ok) {
          if (response.status === 404) return {status: 'error', text: '', detail: 'Protocol incompatible: chat completions returned 404.'};
          if (response.status === 503) return {status: 'error', text: '', detail: 'Model server is busy or loading.'};
          return {status: 'error', text: '', detail: 'Model server returned HTTP ' + response.status + '.'};
        }
        if (!response.body?.getReader) return {status: 'error', text: '', detail: 'Model server did not stream a reply.'};

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let rest = '';

        for (;;) {
          armIdle(idleTimeoutMs);
          const {value, done} = await reader.read();
          if (done) break;
          if (job.cancelled) return {status: 'cancelled', text: '', detail: 'Cancelled.'};
          const parsed = parseSse(rest, decoder.decode(value, {stream: true}));
          rest = parsed.rest;
          for (const item of parsed.items) {
            if (item?.error) {
              const errDetail = typeof item.error === 'string' ? item.error : item.error.message || JSON.stringify(item.error);
              return {status: 'error', text, detail: 'Model error: ' + String(errDetail).slice(0, 200)};
            }
            if (item?.done) return {status: 'done', text, model};
            const piece = item?.choices?.[0]?.delta?.content;
            if (typeof piece === 'string' && piece) {
              const room = MAX_REPLY_CHARS - text.length;
              const accepted = piece.slice(0, Math.max(0, room));
              if (accepted) { text += accepted; onToken(accepted); }
              if (text.length >= MAX_REPLY_CHARS) {
                controller.abort();
                return {status: 'truncated', text, detail: 'Reply truncated at ' + MAX_REPLY_CHARS + ' characters.'};
              }
            }
          }
        }
        if (job.cancelled) return {status: 'cancelled', text: '', detail: 'Cancelled.'};
        return text ? {status: 'done', text, model} : {status: 'error', text, detail: 'The model ended without a reply.'};
      }

      // Default: Ollama native /api/chat
      const body = JSON.stringify({
        model,
        stream: true,
        messages: [{role: 'system', content: String(systemPrompt || '')}, ...boundedContext(messages, contextLimit || config.contextMessages)]
      });

      const response = await fetchImpl(`${base}/api/chat`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body,
        signal: controller.signal
      });

      if (!response.ok) {
        if (response.status === 404) return {status: 'error', text: '', detail: 'Protocol incompatible: /api/chat returned 404.'};
        if (response.status === 503) return {status: 'error', text: '', detail: 'Model server is busy or loading.'};
        return {status: 'error', text: '', detail: 'Model server returned HTTP ' + response.status + '.'};
      }
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
            if (text.length >= MAX_REPLY_CHARS) {
              controller.abort();
              return {status: 'truncated', text, detail: 'Reply truncated at ' + MAX_REPLY_CHARS + ' characters.'};
            }
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
      return {
        status: 'offline',
        text: '',
        detail: error.message && error.message.startsWith('Could not reach') ? error.message : 'Could not reach the model server.'
      };
    } finally {
      clearTimeout(idleTimer);
      clearTimeout(totalTimer);
      if (active === job) active = null;
    }
  }

  return {listModels, testConnection, streamChat, cancel, busy};
}

module.exports = {
  createAiClient,
  createOllamaClient: createAiClient,
  resolveModel,
  boundedContext,
  parseNdjson,
  parseSse,
  normalizeOpenAiBase,
  PolicyError,
  MAX_REPLY_CHARS
};
