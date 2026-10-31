'use strict';
const {contextBridge, ipcRenderer} = require('electron');

const ACTIONS = new Set(['treat', 'huff', 'nap', 'pixel', 'cel', 'atlas', 'quiet', 'flip']);
contextBridge.exposeInMainWorld('dexterDesktop', Object.freeze({
  move(dx, dy) {
    if (Number.isFinite(dx) && Number.isFinite(dy)) ipcRenderer.send('dexter:move', {dx, dy});
  },
  hit(overPet) {
    if (typeof overPet === 'boolean') ipcRenderer.send('dexter:hit', overPet);
  },
  menu() { ipcRenderer.send('dexter:menu'); },
  endDrag() { ipcRenderer.send('dexter:drag-end'); },
  onAction(callback) {
    if (typeof callback !== 'function') return () => {};
    const handler = (_event, action) => { if (ACTIONS.has(action)) callback(action); };
    ipcRenderer.on('dexter:action', handler);
    return () => ipcRenderer.removeListener('dexter:action', handler);
  }
}));
