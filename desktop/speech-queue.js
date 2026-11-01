/* Bounded speech queue shared by the desktop renderer and Node tests.
   Engine-agnostic: the caller supplies speak(text) -> Promise and stop(). */
(function (root) {
  'use strict';
  const MAX_QUEUE = 3;
  const MAX_TEXT = 400;
  function clean(text) {
    if (typeof text !== 'string') return '';
    // Never read markup, URLs or code fences aloud verbatim.
    const plain = text.replace(/```[\s\S]*?```/g, ' code omitted. ').replace(/https?:\/\/\S+/g, 'a link')
      .replace(/[*_`#>]/g, '').replace(/\s+/g, ' ').trim();
    if (plain.length <= MAX_TEXT) return plain;
    const cut = plain.slice(0, MAX_TEXT);
    const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '));
    return (end > 120 ? cut.slice(0, end + 1) : cut) + ' …';
  }
  function createSpeechQueue({speak, stop, onState = () => {}, max = MAX_QUEUE}) {
    if (typeof speak !== 'function' || typeof stop !== 'function') throw new TypeError('speak and stop required');
    let queue = [], current = null, generation = 0;
    function pump() {
      if (current || !queue.length) { if (!current) onState('idle'); return; }
      current = queue.shift();
      const mine = generation;
      onState('speaking');
      Promise.resolve().then(() => speak(current.text)).then(
        () => ({ok: true}), error => ({ok: false, error})
      ).then(result => {
        if (mine !== generation) return;
        if (!result.ok) onState('error', result.error && result.error.message ? result.error.message : String(result.error || 'speech failed'));
        current = null; pump();
      });
    }
    function enqueue(text, {interrupt = false} = {}) {
      const t = clean(text);
      if (!t) return false;
      if (interrupt) cancel();
      queue.push({text: t});
      // Drop the oldest pending lines rather than letting speech pile up.
      if (queue.length > max) queue = queue.slice(-max);
      pump();
      return true;
    }
    function cancel() {
      const active = Boolean(current || queue.length);
      generation++;
      queue = [];
      if (current) { current = null; try { stop(); } catch (e) { /* engine already stopped */ } }
      if (active) onState('idle');
    }
    return {enqueue, cancel, get pending() { return queue.length; }, get speaking() { return Boolean(current); }};
  }
  const api = Object.freeze({createSpeechQueue, clean, MAX_QUEUE, MAX_TEXT});
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DexterSpeechQueue = api;
})(typeof window !== 'undefined' ? window : null);
