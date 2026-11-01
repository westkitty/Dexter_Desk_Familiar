'use strict';
// Optional Piper TTS adapter, adapted from WestCat_Overlay_MacOS/tts_integration.py.
// Differences: user must point to an existing piper executable and .onnx voice
// (nothing is downloaded or installed), no shell, hard timeout, bounded output,
// temp files deleted immediately, a single in-flight synthesis that can be cancelled.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawn} = require('node:child_process');

const MAX_WAV_BYTES = 12 * 1024 * 1024;

function checkPiper({piperPath, piperModel}) {
  const problems = [];
  const isFile = p => { try { return fs.statSync(p).isFile(); } catch { return false; } };
  if (!piperPath || !path.isAbsolute(piperPath)) problems.push('Choose the piper executable.');
  else if (!isFile(piperPath)) problems.push('The piper executable was not found.');
  else { try { fs.accessSync(piperPath, fs.constants.X_OK); } catch { problems.push('The piper file is not executable.'); } }
  if (!piperModel || !path.isAbsolute(piperModel)) problems.push('Choose a Piper .onnx voice model.');
  else if (!piperModel.endsWith('.onnx') || !isFile(piperModel)) problems.push('The voice model must be an existing .onnx file.');
  return {ok: problems.length === 0, problems};
}

function createPiper({spawnImpl = spawn, tmpRoot = os.tmpdir(), timeoutMs = 30000} = {}) {
  let child = null;
  function cancel() { if (child) { try { child.kill('SIGKILL'); } catch {} child = null; } }
  function synthesize(text, config) {
    const checked = checkPiper(config);
    if (!checked.ok) return Promise.reject(new Error(checked.problems[0]));
    cancel();
    const dir = fs.mkdtempSync(path.join(tmpRoot, 'dexter-tts-'));
    const out = path.join(dir, 'speech.wav');
    const cleanup = () => { try { fs.rmSync(dir, {recursive: true, force: true}); } catch {} };
    return new Promise((resolve, reject) => {
      let settled = false, stderr = '';
      const proc = spawnImpl(config.piperPath, ['--model', config.piperModel, '--output_file', out], {stdio: ['pipe', 'ignore', 'pipe'], shell: false});
      child = proc;
      const finish = (error, data) => {
        if (settled) return; settled = true;
        clearTimeout(timer); if (child === proc) child = null; cleanup();
        error ? reject(error) : resolve(data);
      };
      const timer = setTimeout(() => { try { proc.kill('SIGKILL'); } catch {} finish(new Error('Piper took too long.')); }, timeoutMs);
      proc.stderr?.on('data', d => { if (stderr.length < 2000) stderr += String(d); });
      proc.on('error', error => finish(new Error('Piper could not start: ' + error.message)));
      proc.on('close', (code, signal) => {
        if (signal) return finish(new Error('Speech cancelled.'));
        if (code !== 0) return finish(new Error('Piper failed (' + code + '). ' + stderr.trim().slice(0, 160)));
        try {
          const size = fs.statSync(out).size;
          if (size <= 44 || size > MAX_WAV_BYTES) return finish(new Error('Piper produced an unusable audio file.'));
          finish(null, fs.readFileSync(out));
        } catch { finish(new Error('Piper produced no audio.')); }
      });
      proc.stdin?.end(String(text).slice(0, 1000));
    });
  }
  return {synthesize, cancel, get busy() { return Boolean(child); }};
}

module.exports = {createPiper, checkPiper, MAX_WAV_BYTES};
