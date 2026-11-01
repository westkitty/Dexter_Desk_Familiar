'use strict';
// Optional push-to-talk transcription with a whisper.cpp program the user
// installed (no download, no network). Audio arrives as 16 kHz mono WAV bytes
// recorded only while the user holds the button; it is written to a private
// temp folder, transcribed, and deleted immediately.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawn} = require('node:child_process');
const MAX_WAV = 2 * 1024 * 1024; // ~60 s of 16 kHz mono 16-bit
function checkWhisper({whisperPath, whisperModel}) {
  const problems = [];
  const isFile = p => { try { return fs.statSync(p).isFile(); } catch { return false; } };
  if (!whisperPath || !path.isAbsolute(whisperPath) || !isFile(whisperPath)) problems.push('Choose the whisper.cpp program (for example whisper-cli).');
  else { try { fs.accessSync(whisperPath, fs.constants.X_OK); } catch { problems.push('The whisper program is not executable.'); } }
  if (!whisperModel || !path.isAbsolute(whisperModel) || !/\.(bin|gguf)$/.test(whisperModel) || !isFile(whisperModel)) problems.push('Choose a whisper model file (.bin or .gguf).');
  return {ok: !problems.length, problems};
}
function isWav(bytes) {
  return bytes && bytes.length > 44 && bytes.length <= MAX_WAV && Buffer.from(bytes.subarray(0, 4)).toString() === 'RIFF' && Buffer.from(bytes.subarray(8, 12)).toString() === 'WAVE';
}
function createWhisper({spawnImpl = spawn, tmpRoot = os.tmpdir(), timeoutMs = 60000} = {}) {
  let child = null;
  function cancel() { if (child) { try { child.kill('SIGKILL'); } catch {} child = null; } }
  function transcribe(bytes, config) {
    const checked = checkWhisper(config);
    if (!checked.ok) return Promise.reject(new Error(checked.problems[0]));
    const data = Buffer.from(bytes || []);
    if (!isWav(data)) return Promise.reject(new Error('Recording was not valid audio or was too long.'));
    cancel();
    const dir = fs.mkdtempSync(path.join(tmpRoot, 'dexter-stt-'));
    const wav = path.join(dir, 'speech.wav'), base = path.join(dir, 'speech');
    fs.writeFileSync(wav, data, {mode: 0o600});
    const cleanup = () => { try { fs.rmSync(dir, {recursive: true, force: true}); } catch {} };
    return new Promise((resolve, reject) => {
      let settled = false, stderr = '';
      const proc = spawnImpl(config.whisperPath, ['-m', config.whisperModel, '-f', wav, '-nt', '-otxt', '-of', base, '-l', 'auto'], {stdio: ['ignore', 'ignore', 'pipe'], shell: false});
      child = proc;
      const finish = (error, text) => { if (settled) return; settled = true; clearTimeout(timer); if (child === proc) child = null; cleanup(); error ? reject(error) : resolve(text); };
      const timer = setTimeout(() => { try { proc.kill('SIGKILL'); } catch {} finish(new Error('Transcription took too long.')); }, timeoutMs);
      proc.stderr?.on('data', d => { if (stderr.length < 2000) stderr += String(d); });
      proc.on('error', e => finish(new Error('Whisper could not start: ' + e.message)));
      proc.on('close', (code, signal) => {
        if (signal) return finish(new Error('Transcription cancelled.'));
        if (code !== 0) return finish(new Error('Whisper failed (' + code + ').'));
        try { finish(null, fs.readFileSync(base + '.txt', 'utf8').replace(/\s+/g, ' ').trim().slice(0, 2000)); }
        catch { finish(new Error('Whisper produced no text.')); }
      });
    });
  }
  return {transcribe, cancel, get busy() { return Boolean(child); }};
}
module.exports = {createWhisper, checkWhisper, isWav, MAX_WAV};
