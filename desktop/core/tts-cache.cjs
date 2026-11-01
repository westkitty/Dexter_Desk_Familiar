'use strict';
// Bounded, privacy-preserving audio cache for synthesized speech.
// Features:
// - Fine-grained fingerprinting across engine, model, voice, speaker, rate, volume, pitch, text.
// - LRU and TTL eviction with strict bounds on file count and byte footprint.
// - Statistics tracking (files, bytes, hits, misses).
// - Per-source controls (replies, remarks, check-ins) and sensitive input suppression.
// - File storage in mode 0600 under directory mode 0700.
// - In-memory LRU session cache for instantaneous local replays.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const DEFAULT_MAX_FILES = 50;
const DEFAULT_MAX_BYTES = 50 * 1024 * 1024; // 50 MiB
const DEFAULT_TTL_MS = 14 * 24 * 3600 * 1000; // 14 days

function makeFingerprint(text, voiceOrOptions, rateFallback = 1) {
  let engine = 'piper';
  let model = '';
  let voice = '';
  let speaker = '';
  let rate = rateFallback;
  let volume = 1;
  let pitch = 1;

  if (typeof voiceOrOptions === 'object' && voiceOrOptions !== null) {
    engine = voiceOrOptions.engine || 'piper';
    model = voiceOrOptions.model || voiceOrOptions.piperModel || '';
    voice = voiceOrOptions.voice || voiceOrOptions.ttsVoice || '';
    speaker = voiceOrOptions.speaker || '';
    rate = Number.isFinite(voiceOrOptions.rate) ? voiceOrOptions.rate : (voiceOrOptions.ttsRate || 1);
    volume = Number.isFinite(voiceOrOptions.volume) ? voiceOrOptions.volume : (voiceOrOptions.ttsVolume || 1);
    pitch = Number.isFinite(voiceOrOptions.pitch) ? voiceOrOptions.pitch : 1;
  } else {
    voice = String(voiceOrOptions || '');
    rate = rateFallback;
  }

  const parts = [
    engine,
    model,
    voice,
    String(speaker),
    String(Math.round(Number(rate) * 100) / 100),
    String(Math.round(Number(volume) * 100) / 100),
    String(Math.round(Number(pitch) * 100) / 100),
    String(text || '').trim()
  ];
  return crypto.createHash('sha256').update(parts.join('\0')).digest('hex');
}

function shouldCacheSource(source, settings = {}) {
  if (source === 'sensitive' || settings.neverCacheSensitive) {
    if (source === 'sensitive') return false;
  }
  if (source === 'reply' && settings.ttsCacheReplies === false) return false;
  if (source === 'remark' && settings.ttsCacheRemarks === false) return false;
  if (source === 'checkin' && settings.ttsCacheCheckins === false) return false;
  return true;
}

function createTtsCache({
  dir,
  maxFiles = DEFAULT_MAX_FILES,
  maxBytes = DEFAULT_MAX_BYTES,
  ttlMs = DEFAULT_TTL_MS
} = {}) {
  let hits = 0;
  let misses = 0;
  const memoryCache = new Map(); // key -> Buffer, max 10 entries
  const MAX_MEMORY_ENTRIES = 10;

  const file = k => path.join(dir, k + '.wav');

  function entries() {
    try {
      if (!fs.existsSync(dir)) return [];
      return fs.readdirSync(dir)
        .filter(n => /^[a-f0-9]{64}\.wav$/.test(n))
        .map(n => {
          try {
            const st = fs.statSync(path.join(dir, n));
            return {key: n.replace(/\.wav$/, ''), size: st.size, t: st.mtimeMs};
          } catch {
            return null;
          }
        })
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  function prune() {
    try {
      const now = Date.now();
      let list = entries().sort((a, b) => a.t - b.t);
      // Evict expired entries
      if (ttlMs > 0) {
        const fresh = [];
        for (const e of list) {
          if (now - e.t > ttlMs) {
            try { fs.rmSync(path.join(dir, e.key + '.wav')); } catch {}
          } else {
            fresh.push(e);
          }
        }
        list = fresh;
      }
      let total = list.reduce((n, e) => n + e.size, 0);
      while (list.length > maxFiles || total > maxBytes) {
        const e = list.shift();
        total -= e.size;
        try { fs.rmSync(path.join(dir, e.key + '.wav')); } catch {}
      }
    } catch {}
  }

  function get(text, voiceOrOptions, rate = 1) {
    const k = makeFingerprint(text, voiceOrOptions, rate);
    if (memoryCache.has(k)) {
      hits++;
      const data = memoryCache.get(k);
      // refresh in memory LRU
      memoryCache.delete(k);
      memoryCache.set(k, data);
      return data;
    }

    const f = file(k);
    try {
      const data = fs.readFileSync(f);
      const now = new Date();
      try { fs.utimesSync(f, now, now); } catch {}
      hits++;
      // store in session memory cache
      memoryCache.set(k, data);
      if (memoryCache.size > MAX_MEMORY_ENTRIES) {
        const firstKey = memoryCache.keys().next().value;
        memoryCache.delete(firstKey);
      }
      return data;
    } catch {
      misses++;
      return null;
    }
  }

  function put(text, voiceOrOptions, rate = 1, data = null) {
    let rawData = data;
    let actualRate = rate;
    // Handle argument overloading put(text, voice, rate, data) or put(text, options, data)
    if (Buffer.isBuffer(rate) || rate instanceof Uint8Array) {
      rawData = rate;
      actualRate = 1;
    }
    if (!rawData || !rawData.length) return false;

    const k = makeFingerprint(text, voiceOrOptions, actualRate);
    try {
      fs.mkdirSync(dir, {recursive: true, mode: 0o700});
      fs.writeFileSync(file(k), rawData, {mode: 0o600});
      memoryCache.set(k, Buffer.from(rawData));
      if (memoryCache.size > MAX_MEMORY_ENTRIES) {
        const firstKey = memoryCache.keys().next().value;
        memoryCache.delete(firstKey);
      }
      prune();
      return true;
    } catch {
      return false;
    }
  }

  function remove(key) {
    memoryCache.delete(key);
    try {
      const f = file(key);
      if (fs.existsSync(f)) {
        fs.rmSync(f);
        return true;
      }
    } catch {}
    return false;
  }

  function clear() {
    memoryCache.clear();
    for (const e of entries()) {
      try { fs.rmSync(path.join(dir, e.key + '.wav')); } catch {}
    }
    hits = 0;
    misses = 0;
  }

  function stats() {
    const list = entries();
    return {
      files: list.length,
      bytes: list.reduce((n, e) => n + e.size, 0),
      hits,
      misses
    };
  }

  return {
    get,
    put,
    remove,
    clear,
    stats,
    entries: () => entries().map(e => ({key: e.key, size: e.size, mtimeMs: e.t})),
    fingerprint: makeFingerprint,
    shouldCacheSource
  };
}

// List Piper voices in a user-chosen folder (checks for companion .json config too)
function listVoices(folder) {
  if (!folder || !path.isAbsolute(folder)) return [];
  try {
    return fs.readdirSync(folder).filter(n => n.endsWith('.onnx')).slice(0, 200)
      .map(n => {
        const baseName = n.replace(/\.onnx$/, '');
        const jsonConfig = path.join(folder, baseName + '.onnx.json');
        const altJsonConfig = path.join(folder, baseName + '.json');
        const hasConfig = fs.existsSync(jsonConfig) || fs.existsSync(altJsonConfig);
        return {
          name: baseName.replace(/[_-]/g, ' '),
          path: path.join(folder, n),
          hasConfig
        };
      });
  } catch {
    return [];
  }
}

module.exports = {
  createTtsCache,
  listVoices,
  makeFingerprint,
  shouldCacheSource,
  DEFAULT_MAX_FILES,
  DEFAULT_MAX_BYTES
};
