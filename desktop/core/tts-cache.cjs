'use strict';
// Optional cache for synthesized Piper audio (adapted from WestCat_Overlay_MacOS's
// TTS cache, with SHA-256 keys instead of MD5, a size bound and LRU eviction).
// Off by default; stored under the app's own data folder; clearable.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
function createTtsCache({dir, maxFiles = 50, maxBytes = 50 * 1024 * 1024}) {
  const key = (text, voice, rate) => crypto.createHash('sha256').update(String(voice) + '\0' + String(rate) + '\0' + String(text)).digest('hex');
  const file = k => path.join(dir, k + '.wav');
  function entries() {
    try { return fs.readdirSync(dir).filter(n => /^[a-f0-9]{64}\.wav$/.test(n)).map(n => { const st = fs.statSync(path.join(dir, n)); return {n, size: st.size, t: st.mtimeMs}; }); }
    catch { return []; }
  }
  function get(text, voice, rate) {
    const f = file(key(text, voice, rate));
    try { const data = fs.readFileSync(f); const now = new Date(); fs.utimesSync(f, now, now); return data; } catch { return null; }
  }
  function put(text, voice, rate, data) {
    fs.mkdirSync(dir, {recursive: true, mode: 0o700});
    fs.writeFileSync(file(key(text, voice, rate)), data, {mode: 0o600});
    let list = entries().sort((a, b) => a.t - b.t);
    let total = list.reduce((n, e) => n + e.size, 0);
    while (list.length > maxFiles || total > maxBytes) { const e = list.shift(); total -= e.size; try { fs.rmSync(path.join(dir, e.n)); } catch {} }
  }
  function stats() { const list = entries(); return {files: list.length, bytes: list.reduce((n, e) => n + e.size, 0)}; }
  function clear() { for (const e of entries()) { try { fs.rmSync(path.join(dir, e.n)); } catch {} } }
  return {get, put, stats, clear};
}
// List Piper voices in a user-chosen folder (adapted from WestCat's voice listing).
function listVoices(folder) {
  if (!folder || !path.isAbsolute(folder)) return [];
  try {
    return fs.readdirSync(folder).filter(n => n.endsWith('.onnx')).slice(0, 200)
      .map(n => ({name: n.replace(/\.onnx$/, '').replace(/[_-]/g, ' '), path: path.join(folder, n)}));
  } catch { return []; }
}
module.exports = {createTtsCache, listVoices};
