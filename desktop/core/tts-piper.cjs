'use strict';
// Optional Piper TTS adapter.
// Differences: user points to an existing piper executable and .onnx voice
// (nothing is downloaded or silently installed), no shell, hard timeout, bounded output,
// temp files deleted immediately, single in-flight synthesis with prompt cancellation.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawn} = require('node:child_process');

const MAX_WAV_BYTES = 12 * 1024 * 1024;

function probeVoiceModel(modelPath) {
  if (!modelPath || !path.isAbsolute(modelPath)) return {ok: false, reason: 'Model path must be absolute.'};
  try {
    const st = fs.statSync(modelPath);
    if (!st.isFile()) return {ok: false, reason: 'Voice model is not a regular file.'};
    if (!modelPath.endsWith('.onnx')) return {ok: false, reason: 'Voice model must end in .onnx.'};

    const dir = path.dirname(modelPath);
    const base = path.basename(modelPath, '.onnx');
    const jsonPaths = [
      path.join(dir, `${base}.onnx.json`),
      path.join(dir, `${base}.json`)
    ];
    let config = null;
    let configPath = null;
    for (const p of jsonPaths) {
      if (fs.existsSync(p)) {
        try {
          config = JSON.parse(fs.readFileSync(p, 'utf8'));
          configPath = p;
          break;
        } catch {}
      }
    }

    const speakers = [];
    if (config?.speaker_id_map && typeof config.speaker_id_map === 'object') {
      for (const [name, id] of Object.entries(config.speaker_id_map)) {
        speakers.push({name, id});
      }
    } else if (Number.isInteger(config?.num_speakers) && config.num_speakers > 1) {
      for (let i = 0; i < config.num_speakers; i++) {
        speakers.push({name: `Speaker ${i}`, id: i});
      }
    }

    return {
      ok: true,
      path: modelPath,
      sizeBytes: st.size,
      hasConfig: Boolean(config),
      configPath,
      sampleRate: config?.audio?.sample_rate || 22050,
      speakers
    };
  } catch (err) {
    return {ok: false, reason: err.message};
  }
}

async function probePiper(piperPath, {spawnImpl = spawn, timeoutMs = 5000} = {}) {
  if (!piperPath || !path.isAbsolute(piperPath)) {
    return {ok: false, state: 'missing', reason: 'Piper executable path is required.'};
  }
  try {
    const st = fs.statSync(piperPath);
    if (!st.isFile()) return {ok: false, state: 'invalid', reason: 'Piper path is not a file.'};
    fs.accessSync(piperPath, fs.constants.X_OK);
  } catch (err) {
    return {ok: false, state: 'invalid', reason: `Piper binary is not executable (${err.code || err.message}).`};
  }

  return new Promise(resolve => {
    let stdout = '', stderr = '';
    const proc = spawnImpl(piperPath, ['--help'], {stdio: ['ignore', 'pipe', 'pipe'], shell: false});
    const timer = setTimeout(() => {
      try { proc.kill('SIGKILL'); } catch {}
      resolve({ok: false, state: 'invalid', reason: 'Piper binary execution timed out.'});
    }, timeoutMs);

    proc.stdout?.on('data', d => { if (stdout.length < 4000) stdout += String(d); });
    proc.stderr?.on('data', d => { if (stderr.length < 4000) stderr += String(d); });
    proc.on('error', err => {
      clearTimeout(timer);
      resolve({ok: false, state: 'invalid', reason: `Execution failed: ${err.message}`});
    });
    proc.on('close', code => {
      clearTimeout(timer);
      const combined = (stdout + '\n' + stderr).toLowerCase();
      const hasModelFlag = combined.includes('--model') || combined.includes('-m');
      const hasOutputFlag = combined.includes('--output_file') || combined.includes('--output-file');
      const hasSpeakerFlag = combined.includes('--speaker') || combined.includes('-s');
      const hasLengthScale = combined.includes('--length-scale') || combined.includes('--length_scale');

      // Version detection
      const versionMatch = stdout.match(/version\s+([0-9.]+)/i) || stderr.match(/version\s+([0-9.]+)/i);
      const version = versionMatch ? versionMatch[1] : 'unknown';

      if (!hasModelFlag) {
        return resolve({
          ok: false,
          state: 'invalid',
          reason: 'Executable ran, but does not recognize standard Piper CLI arguments.'
        });
      }

      resolve({
        ok: true,
        state: 'ready',
        version,
        flags: {
          outputFlag: combined.includes('--output_file') ? '--output_file' : '--output-file',
          hasSpeakerFlag,
          hasLengthScale
        }
      });
    });
  });
}

function checkPiper({piperPath, piperModel}) {
  const problems = [];
  const isFile = p => { try { return fs.statSync(p).isFile(); } catch { return false; } };

  let executableState = 'missing';
  if (!piperPath || !path.isAbsolute(piperPath)) {
    problems.push('Choose the piper executable.');
  } else if (!isFile(piperPath)) {
    problems.push('The piper executable was not found.');
    executableState = 'invalid';
  } else {
    try {
      fs.accessSync(piperPath, fs.constants.X_OK);
      executableState = 'ready';
    } catch {
      problems.push('The piper file is not executable.');
      executableState = 'invalid';
    }
  }

  let modelState = 'missing';
  if (!piperModel || !path.isAbsolute(piperModel)) {
    problems.push('Choose a Piper .onnx voice model.');
  } else if (!piperModel.endsWith('.onnx') || !isFile(piperModel)) {
    problems.push('The voice model must be an existing .onnx file.');
    modelState = 'invalid';
  } else {
    modelState = 'ready';
  }

  const ok = problems.length === 0;
  const state = ok ? 'ready' : (executableState === 'invalid' || modelState === 'invalid') ? 'invalid' : 'missing';
  return {ok, state, problems};
}

function createPiper({spawnImpl = spawn, tmpRoot = os.tmpdir(), timeoutMs = 30000} = {}) {
  let child = null;
  function cancel() {
    if (child) {
      try { child.kill('SIGKILL'); } catch {}
      child = null;
    }
  }

  function synthesize(text, config) {
    const checked = checkPiper(config);
    if (!checked.ok) return Promise.reject(new Error(checked.problems[0]));
    cancel();
    const dir = fs.mkdtempSync(path.join(tmpRoot, 'dexter-tts-'));
    const out = path.join(dir, 'speech.wav');
    const cleanup = () => { try { fs.rmSync(dir, {recursive: true, force: true}); } catch {} };

    return new Promise((resolve, reject) => {
      let settled = false, stderr = '';
      const args = ['--model', config.piperModel, '--output_file', out];
      if (Number.isInteger(config.piperSpeaker) && config.piperSpeaker >= 0) {
        args.push('--speaker', String(config.piperSpeaker));
      }
      if (Number.isFinite(config.ttsRate) && config.ttsRate > 0 && config.ttsRate !== 1) {
        // piper length_scale: inverse of rate (higher length_scale = slower speech)
        const scale = (1 / config.ttsRate).toFixed(2);
        args.push('--length_scale', scale);
      }

      const proc = spawnImpl(config.piperPath, args, {stdio: ['pipe', 'ignore', 'pipe'], shell: false});
      child = proc;

      const finish = (error, data) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (child === proc) child = null;
        cleanup();
        error ? reject(error) : resolve(data);
      };

      const timer = setTimeout(() => {
        try { proc.kill('SIGKILL'); } catch {}
        finish(new Error('Piper took too long.'));
      }, timeoutMs);

      proc.stderr?.on('data', d => { if (stderr.length < 2000) stderr += String(d); });
      proc.on('error', error => finish(new Error('Piper could not start: ' + error.message)));
      proc.on('close', (code, signal) => {
        if (signal) return finish(new Error('Speech cancelled.'));
        if (code !== 0) return finish(new Error('Piper failed (' + code + '). ' + stderr.trim().slice(0, 160)));
        try {
          const size = fs.statSync(out).size;
          if (size <= 44 || size > MAX_WAV_BYTES) return finish(new Error('Piper produced an unusable audio file.'));
          finish(null, fs.readFileSync(out));
        } catch {
          finish(new Error('Piper produced no audio.'));
        }
      });
      proc.stdin?.end(String(text).slice(0, 1000));
    });
  }

  return {synthesize, cancel, get busy() { return Boolean(child); }};
}

module.exports = {
  createPiper,
  checkPiper,
  probePiper,
  probeVoiceModel,
  MAX_WAV_BYTES
};
