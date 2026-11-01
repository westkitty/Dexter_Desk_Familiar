/* Encode mono Float32 PCM as 16-bit WAV at 16 kHz for whisper.cpp.
   Shared by the conversation panel and Node tests. */
(function (root) {
  'use strict';
  const TARGET_RATE = 16000;
  function downsample(samples, fromRate, toRate = TARGET_RATE) {
    if (fromRate === toRate) return samples;
    const ratio = fromRate / toRate, length = Math.floor(samples.length / ratio), out = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      const start = Math.floor(i * ratio), end = Math.min(samples.length, Math.floor((i + 1) * ratio));
      let sum = 0; for (let j = start; j < end; j++) sum += samples[j];
      out[i] = end > start ? sum / (end - start) : 0;
    }
    return out;
  }
  function encodeWav(samples, rate = TARGET_RATE) {
    const buffer = new ArrayBuffer(44 + samples.length * 2), view = new DataView(buffer);
    const str = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); view.setUint32(4, 36 + samples.length * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    str(36, 'data'); view.setUint32(40, samples.length * 2, true);
    for (let i = 0; i < samples.length; i++) { const v = Math.max(-1, Math.min(1, samples[i])); view.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true); }
    return new Uint8Array(buffer);
  }
  const api = Object.freeze({TARGET_RATE, downsample, encodeWav});
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DexterWav = api;
})(typeof window !== 'undefined' ? window : null);
