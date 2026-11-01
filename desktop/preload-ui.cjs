'use strict';
// Bridge for the conversation and settings panels. The main process also
// verifies which window sent each request; this allowlist is the first fence.
const {contextBridge, ipcRenderer} = require('electron');

const INVOKE = new Set(['settings:get', 'settings:set', 'settings:reset', 'window:restore', 'window:reset-position', 'window:hide-self',
  'ai:test', 'chat:history', 'chat:send', 'chat:cancel', 'chat:clear', 'chat:open-settings',
  'tts:test', 'tts:stop', 'piper:check', 'checkin:now', 'diag:audit', 'diag:report', 'diag:export',
  'chat:retry', 'chat:packet', 'chat:compact', 'chat:snap', 'inspector:snapshot', 'inspector:open', 'journal:read', 'journal:clear',
  'notes:add', 'notes:remove', 'notes:clear', 'session:start', 'session:pause', 'session:resume', 'session:stop', 'demo:play',
  'piper:voices', 'tts:cache-clear', 'stt:check', 'stt:prepare', 'stt:transcribe', 'stt:cancel', 'bubble:dismiss', 'bubble:open-chat']);
const EVENTS = new Set(['settings:changed', 'settings:section', 'chat:event', 'chat:status', 'inspector:changed', 'bubble:show']);

contextBridge.exposeInMainWorld('dexterUI', Object.freeze({
  invoke(channel, payload) {
    if (!INVOKE.has(channel)) return Promise.reject(new Error('Unknown channel'));
    return ipcRenderer.invoke(channel, payload);
  },
  on(channel, callback) {
    if (!EVENTS.has(channel) || typeof callback !== 'function') return () => {};
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  }
}));
