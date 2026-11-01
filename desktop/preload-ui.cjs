'use strict';
// Bridge for the conversation and settings panels. The main process also
// verifies which window sent each request; this allowlist is the first fence.
const {contextBridge, ipcRenderer} = require('electron');

const INVOKE = new Set(['settings:get', 'settings:set', 'settings:reset', 'window:restore', 'window:reset-position', 'window:hide-self',
  'ai:test', 'chat:history', 'chat:send', 'chat:cancel', 'chat:clear', 'chat:open-settings',
  'tts:test', 'tts:stop', 'piper:check', 'piper:probe', 'kokoro:check', 'checkin:now', 'diag:audit', 'diag:report', 'diag:export',
  'chat:retry', 'chat:packet', 'chat:compact', 'chat:snap', 'inspector:snapshot', 'inspector:open', 'journal:read', 'journal:clear',
  'notes:add', 'notes:remove', 'notes:clear', 'session:start', 'session:pause', 'session:resume', 'session:stop', 'demo:play',
  'piper:voices', 'tts:cache-clear', 'tts:cache-stats', 'tts:cache-remove', 'tts:cache-entries',
  'stt:check', 'stt:prepare', 'stt:transcribe', 'stt:cancel', 'dexdictate:check',
  'bubble:dismiss', 'bubble:open-chat', 'bubble:answer', 'bubble:snap', 'bubble:reset',
  'docs:list', 'docs:import', 'docs:import-text', 'docs:toggle', 'docs:delete', 'docs:clear', 'docs:preview',
  'questions:list', 'questions:save', 'questions:delete', 'questions:toggle-category', 'questions:export', 'questions:import',
  'dev:unlock', 'dev:lock', 'dialog:pick-file', 'dialog:pick-dir']);
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
