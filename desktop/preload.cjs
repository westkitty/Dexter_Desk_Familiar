'use strict';
// Pet window bridge. Narrow, typed, allowlisted. Sends only booleans, small
// deltas, state names and check-in answers; never coordinates history or text input.
const {contextBridge, ipcRenderer} = require('electron');

const ACTIONS = new Set(['treat', 'huff', 'nap', 'pixel', 'cel', 'atlas']);
function subscribe(channel, filter, callback) {
  if (typeof callback !== 'function') return () => {};
  const handler = (_event, payload) => { const value = filter(payload); if (value !== undefined) callback(value); };
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}
const plain = value => value && typeof value === 'object' && !Array.isArray(value) ? value : undefined;

contextBridge.exposeInMainWorld('dexterDesktop', Object.freeze({
  move(dx, dy) { if (Number.isFinite(dx) && Number.isFinite(dy)) ipcRenderer.send('dexter:move', {dx, dy}); },
  hit(overPet) { if (typeof overPet === 'boolean') ipcRenderer.send('dexter:hit', overPet); },
  menu() { ipcRenderer.send('dexter:menu'); },
  endDrag() { ipcRenderer.send('dexter:drag-end'); },
  status(state, napping) { if (typeof state === 'string') ipcRenderer.send('dexter:status', {state: state.slice(0, 20), napping: napping === true}); },
  answer(id, path) {
    if (typeof id === 'string' && Array.isArray(path) && path.length >= 1 && path.length <= 2 && path.every(Number.isInteger))
      ipcRenderer.send('dexter:checkin-answer', {id: id.slice(0, 40), path: path.slice()});
  },
  dev() { ipcRenderer.send('dexter:dev'); },
  dismissBubble() { ipcRenderer.send('dexter:bubble-dismissed'); },
  openChat() { ipcRenderer.send('dexter:open-chat'); },
  speechState(state, detail) { if (typeof state === 'string') ipcRenderer.send('dexter:speech-state', {state, detail: typeof detail === 'string' ? detail.slice(0, 120) : ''}); },
  synthesize(text) { return typeof text === 'string' ? ipcRenderer.invoke('dexter:piper', text.slice(0, 1000)) : Promise.reject(new Error('text required')); },
  cancelSynthesis() { ipcRenderer.send('dexter:piper-cancel'); },
  onAction(callback) { return subscribe('dexter:action', a => ACTIONS.has(a) ? a : undefined, callback); },
  onPrefs(callback) { return subscribe('dexter:prefs', plain, callback); },
  onSignal(callback) { return subscribe('dexter:signal', plain, callback); },
  onBubble(callback) { return subscribe('dexter:bubble', plain, callback); },
  onSpeech(callback) { return subscribe('dexter:speech', plain, callback); },
  onGag(callback) { return subscribe('dexter:gag', g => ['sneeze', 'hop', 'shake', 'drop'].includes(g) ? g : undefined, callback); }
}));
