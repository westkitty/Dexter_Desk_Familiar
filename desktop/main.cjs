'use strict';
// Dexter Desktop — Electron main process.
// One small transparent window for Dexter, plus two on-demand panels
// (conversation, settings). No global input capture, no screen inspection,
// no network unless the user enables Local AI. See desktop/ARCHITECTURE.md.
const {app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, screen, dialog, session, protocol, powerMonitor} = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const ws = require('./window-state.cjs');
const {createOllamaClient} = require('./core/ollama.cjs');
const persona = require('./core/persona.cjs');
const attention = require('./core/attention.cjs');
const {createConversation} = require('./core/conversation.cjs');
const {createEventLog} = require('./core/events.cjs');
const diagnostics = require('./core/diagnostics.cjs');
const {createPiper, checkPiper} = require('./core/tts-piper.cjs');

const ROOT = __dirname;
const SETTINGS_NAME = 'desktop-settings.json';
const HISTORY_NAME = 'conversation.json';
const SMOKE_TEST = process.env.DEXTER_DESKTOP_SMOKE === '1';
const PLATFORM_MAC = process.platform === 'darwin';

// ---------------------------------------------------------------- profile
// Runtime smoke never uses or mutates a real user's preferences. A caller may
// pass a persistent smoke profile to test quit-and-relaunch persistence.
const smokeKeep = SMOKE_TEST && process.env.DEXTER_DESKTOP_SMOKE_PROFILE;
const smokeProfile = SMOKE_TEST ? (smokeKeep || fs.mkdtempSync(path.join(os.tmpdir(), 'dexter-desktop-smoke-'))) : null;
if (smokeProfile) {
  fs.mkdirSync(smokeProfile, {recursive: true});
  app.setPath('userData', smokeProfile);
  if (!smokeKeep) app.on('quit', () => {
    try { fs.rmSync(smokeProfile, {recursive: true, force: true}); } catch (error) { console.error('Smoke profile cleanup failed', error.message); }
  });
}

protocol.registerSchemesAsPrivileged([{scheme: 'dexter', privileges: {standard: true, secure: true, supportFetchAPI: true, stream: true}}]);
app.commandLine.appendSwitch('disable-features', 'MediaSessionService');
// Chromium background services Dexter never needs. Belt-and-braces with the
// session settings below; verified by the syscall egress audit in CI.
for (const flag of ['disable-background-networking', 'disable-component-update', 'disable-domain-reliability', 'no-pings', 'disable-breakpad'])
  app.commandLine.appendSwitch(flag);

// ---------------------------------------------------------------- state
const state = {
  win: null, chatWin: null, settingsWin: null, tray: null,
  settings: null, settingsPath: null, historyPath: null, saveTimer: null, settingsWritable: true,
  passThrough: false, overPet: false, moving: false, dragVirtual: null,
  quitting: false, familiarState: 'idle', napping: false, bubbleOpen: false,
  aiStatus: 'off', aiDetail: '', ttsStatus: 'off', egressCount: 0, egressWhileDisabled: 0,
  checkinTimer: null, lastCheckinAt: null, lastCheckinId: null, activeCheckin: null,
  displayTimer: null, crashTimes: [], startedAt: Date.now()
};
const events = createEventLog({limit: 200});
const budget = attention.createBudget();
const piper = createPiper();
let conversation = createConversation();
const ai = createOllamaClient({
  getConfig: () => ({enabled: state.settings?.aiEnabled, endpoint: state.settings?.aiEndpoint, allowRemote: state.settings?.aiAllowRemote,
    model: state.settings?.aiModel, timeoutSeconds: state.settings?.aiTimeoutSeconds, contextMessages: state.settings?.aiContextMessages}),
  onEgress: ({kind, loopback}) => { state.egressCount++; if (!state.settings?.aiEnabled) state.egressWhileDisabled++; events.record('ai', 'request', {kind, loopback}); }
});

// ---------------------------------------------------------------- persistence
function save() {
  if (!state.settingsPath) return;
  const target = state.settingsPath + '.tmp';
  try {
    fs.writeFileSync(target, JSON.stringify(state.settings, null, 2), {mode: 0o600});
    fs.renameSync(target, state.settingsPath);
    state.settingsWritable = true;
  } catch (error) {
    state.settingsWritable = false;
    events.record('error', 'settings-save', {message: error.code || 'write failed'});
  }
}
// Record the pet window position explicitly: programmatic moves (IPC drags,
// display recovery, rescale) do not reliably emit 'moved' on every platform.
function rememberPosition() {
  if (!alive(state.win) || !state.settings) return;
  const {x, y} = state.win.getBounds();
  state.settings.x = x; state.settings.y = y;
}
function scheduleSave() {
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(save, 250);
}
function load() {
  state.settingsPath = path.join(app.getPath('userData'), SETTINGS_NAME);
  state.historyPath = path.join(app.getPath('userData'), HISTORY_NAME);
  try { state.settings = ws.sanitizeSettings(JSON.parse(fs.readFileSync(state.settingsPath, 'utf8'))); }
  catch { state.settings = ws.sanitizeSettings(null); }
  conversation = createConversation({file: state.historyPath, persist: state.settings.rememberConversation});
  conversation.load();
  // Remembering was turned off while the app was not running: never leave a file behind.
  if (!state.settings.rememberConversation) { try { fs.rmSync(state.historyPath, {force: true}); } catch {} }
}

// ---------------------------------------------------------------- helpers
const alive = w => Boolean(w && !w.isDestroyed());
function sendPet(channel, payload) { if (alive(state.win)) state.win.webContents.send(channel, payload); }
function sendUi(channel, payload) {
  for (const w of [state.chatWin, state.settingsWin]) if (alive(w)) w.webContents.send(channel, payload);
}
function emit(action) { sendPet('dexter:action', action); }
function signal(stateName, priority, ms, line) { sendPet('dexter:signal', {state: stateName, priority, ms, line: line || ''}); }
function workAreas() { return screen.getAllDisplays().map(d => d.workArea); }

function setIgnore() {
  if (!alive(state.win)) return;
  state.win.setIgnoreMouseEvents(ws.shouldIgnoreMouse({passThrough: state.passThrough, preciseHitTest: state.settings.preciseHitTest, overPet: state.overPet}), {forward: true});
}
function setPassThrough(on) {
  state.passThrough = Boolean(on);
  events.record('window', 'pass-through', {on: state.passThrough});
  setIgnore(); refreshMenus();
  state.tray?.setToolTip(state.passThrough ? 'Dexter Desk Familiar — clicks pass through (menu → Restore)' : 'Dexter Desk Familiar');
}

// ---------------------------------------------------------------- geometry
function reposition(delta) {
  if (!alive(state.win)) return;
  const current = state.win.getBounds();
  if (!state.dragVirtual) state.dragVirtual = {x: current.x, y: current.y};
  state.dragVirtual.x += Math.round(delta.dx);
  state.dragVirtual.y += Math.round(delta.dy);
  const target = screen.getDisplayNearestPoint({x: state.dragVirtual.x + Math.floor(current.width / 2), y: state.dragVirtual.y + Math.floor(current.height / 2)}).workArea;
  const position = ws.clampPosition(state.dragVirtual, target, current);
  state.win.setPosition(position.x, position.y);
}
function placeWindow() {
  const size = ws.petWindowSize(state.settings.scale);
  const saved = state.settings.x !== null && state.settings.y !== null;
  const display = (saved ? screen.getDisplayNearestPoint({x: state.settings.x + Math.floor(size.width / 2), y: state.settings.y + Math.floor(size.height / 2)}) : screen.getPrimaryDisplay()).workArea;
  const candidate = {x: saved ? state.settings.x : display.x + display.width - size.width - 28, y: saved ? state.settings.y : display.y + display.height - size.height - 28};
  state.win.setBounds({...size, ...ws.clampPosition(candidate, display, size)});
}
function rescale() {
  if (!alive(state.win)) return;
  const next = ws.resizeAnchored(state.win.getBounds(), ws.petWindowSize(state.settings.scale));
  state.win.setBounds(ws.recoverBounds(next, workAreas()));
  rememberPosition();
}
function ensureOnScreen(win) {
  if (!alive(win)) return false;
  const before = win.getBounds();
  const after = ws.recoverBounds(before, workAreas());
  if (after.x !== before.x || after.y !== before.y || after.width !== before.width || after.height !== before.height) {
    win.setBounds(after);
    return true;
  }
  return false;
}
function onDisplaysChanged(kind) {
  clearTimeout(state.displayTimer);
  state.displayTimer = setTimeout(() => {
    const moved = ensureOnScreen(state.win);
    ensureOnScreen(state.chatWin);
    events.record('display', kind, {moved, displays: screen.getAllDisplays().length});
    if (moved) {
      rememberPosition(); scheduleSave();
      proactiveEvent('displays');
    }
  }, 400);
}

// ---------------------------------------------------------------- visibility / recovery
function showPet() {
  if (!alive(state.win)) return;
  state.win.showInactive(); setIgnore(); refreshMenus();
  events.record('window', 'show', {});
}
function hidePet() {
  if (!alive(state.win)) return;
  state.win.hide(); sendPet('dexter:speech', {op: 'cancel'}); refreshMenus();
  events.record('window', 'hide', {});
}
// Restore is the universal escape hatch: visible, clickable, on screen, opaque enough.
function restore() {
  if (!alive(state.win)) return;
  state.passThrough = false; state.overPet = true;
  if (state.settings.opacity < 0.4) state.settings.opacity = 1;
  ensureOnScreen(state.win);
  applyWindow();
  state.win.showInactive();
  setIgnore(); refreshMenus();
  state.tray?.setToolTip('Dexter Desk Familiar');
  events.record('window', 'restore', {});
}
function resetPosition() {
  state.settings.x = null; state.settings.y = null;
  placeWindow(); scheduleSave(); events.record('window', 'reset-position', {});
}

// ---------------------------------------------------------------- preferences → windows
function applyWindow() {
  if (!alive(state.win)) return;
  state.win.setAlwaysOnTop(state.settings.alwaysOnTop, 'floating');
  state.win.setOpacity(state.settings.opacity);
  try { state.win.setFocusable(!state.settings.passiveFocus); } catch {}
  if (alive(state.chatWin)) state.chatWin.setAlwaysOnTop(state.settings.alwaysOnTop, 'floating');
  setIgnore();
  refreshMenus();
}
function applyDock() {
  if (!PLATFORM_MAC || !app.dock) return;
  // Never hide the Dock icon unless the menu-bar recovery icon exists.
  if (state.settings.showInDock || !state.tray) void app.dock.show();
  else app.dock.hide();
}
function applyLoginItem() {
  if (SMOKE_TEST || !(PLATFORM_MAC || process.platform === 'win32')) return;
  try { app.setLoginItemSettings({openAtLogin: state.settings.launchAtLogin}); }
  catch (error) { events.record('error', 'login-item', {message: error.message}); }
}
function petPrefs() {
  const s = state.settings;
  return {quiet: s.quiet, motion: s.motion, sound: s.sound, idleSeconds: s.idleSeconds, intensity: s.intensity,
    flipped: s.flipped, art: s.art, bubbleTextSize: s.bubbleTextSize, highContrastBubble: s.highContrastBubble,
    preciseHitTest: s.preciseHitTest,
    tts: {enabled: s.ttsEnabled, engine: s.ttsEngine, volume: s.ttsVolume, rate: s.ttsRate, voice: s.ttsVoice}};
}
function sendPrefs() { sendPet('dexter:prefs', petPrefs()); }

function applySettings(previous, next) {
  const changed = key => previous[key] !== next[key];
  state.settings = next;
  if (changed('scale')) rescale();
  if (['opacity', 'alwaysOnTop', 'passiveFocus', 'preciseHitTest'].some(changed)) applyWindow();
  if (changed('showInDock')) applyDock();
  if (changed('launchAtLogin')) applyLoginItem();
  if (changed('art')) emit(next.art);
  if (changed('rememberConversation')) conversation.setPersist(next.rememberConversation);
  if (changed('aiEnabled') || changed('aiEndpoint') || changed('aiAllowRemote')) {
    if (!next.aiEnabled) ai.cancel();
    setAiStatus(next.aiEnabled ? 'idle' : 'off', next.aiEnabled ? 'Enabled. Not yet connected.' : 'Local AI is off.');
  }
  if (changed('ttsEnabled') && !next.ttsEnabled) { sendPet('dexter:speech', {op: 'cancel'}); piper.cancel(); }
  if (['checkinsEnabled', 'checkinMinutes'].some(changed)) armCheckins();
  sendPrefs();
  scheduleSave();
  refreshMenus();
  sendUi('settings:changed', publicSettings());
  const keys = Object.keys(next).filter(changed);
  if (keys.length) events.record('settings', 'changed', {count: keys.length, first: keys[0]});
}
function updateSettings(patch) {
  const next = ws.mergeSettings(state.settings, patch);
  const rejected = [];
  let endpointError = '';
  if (patch && typeof patch === 'object') {
    for (const key of Object.keys(patch)) {
      if (!Object.hasOwn(ws.DEFAULTS, key)) continue;
      if (key === 'aiEndpoint') {
        const checked = ws.validateEndpoint(patch.aiEndpoint, {allowRemote: next.aiAllowRemote});
        if (!checked.ok) { rejected.push(key); endpointError = checked.reason; }
      } else if (next[key] !== patch[key]) rejected.push(key);
    }
  }
  applySettings(state.settings, next);
  return {...publicSettings(), rejected, endpointError};
}
function publicSettings() {
  const s = {...state.settings};
  delete s.size;
  return {settings: s, platform: process.platform, canLaunchAtLogin: PLATFORM_MAC || process.platform === 'win32',
    defaults: ws.DEFAULTS, aiStatus: state.aiStatus, aiDetail: state.aiDetail, ttsStatus: state.ttsStatus,
    passThrough: state.passThrough, visible: alive(state.win) && state.win.isVisible()};
}

// ---------------------------------------------------------------- menus
function setArt(art) { updateSettings({art}); }
function scaleMenu() {
  return [80, 100, 130, 160].map(scale => ({label: scale + '%', type: 'radio', checked: state.settings.scale === scale, click: () => updateSettings({scale})}));
}
function petMenu() {
  const s = state.settings;
  return Menu.buildFromTemplate([
    {label: 'Treat', click: () => emit('treat')},
    {label: 'Huff', click: () => emit('huff')},
    {label: state.napping ? 'Wake' : 'Nap', click: () => emit('nap')},
    {label: 'Talk to Dexter…', click: () => openChat()},
    {type: 'separator'},
    {label: 'Appearance', submenu: [
      {label: 'Original pixel Dexter', type: 'radio', checked: s.art === 'pixel', click: () => setArt('pixel')},
      {label: 'Accepted cel animations', type: 'radio', checked: s.art === 'cel', click: () => setArt('cel')},
      {label: 'Candidate SNES atlas (unapproved)', type: 'radio', checked: s.art === 'atlas', click: () => setArt('atlas')}
    ]},
    {label: 'Flip Dexter', type: 'checkbox', checked: s.flipped, click: () => updateSettings({flipped: !state.settings.flipped})},
    {label: 'Size', submenu: scaleMenu()},
    {label: 'Opacity', submenu: [1, 0.85, 0.7, 0.55].map(opacity => ({label: Math.round(opacity * 100) + '%', type: 'radio', checked: s.opacity === opacity, click: () => updateSettings({opacity})}))},
    {label: 'Always on top', type: 'checkbox', checked: s.alwaysOnTop, click: () => updateSettings({alwaysOnTop: !state.settings.alwaysOnTop})},
    {label: 'Click through transparent area', type: 'checkbox', checked: s.preciseHitTest, click: () => updateSettings({preciseHitTest: !state.settings.preciseHitTest})},
    {label: 'Pass through all clicks', type: 'checkbox', checked: state.passThrough, click: () => setPassThrough(!state.passThrough)},
    {label: 'Quiet mode', type: 'checkbox', checked: s.quiet, click: () => updateSettings({quiet: !state.settings.quiet})},
    {type: 'separator'},
    {label: 'Settings…', click: () => openSettings()},
    {label: 'Reset position', click: resetPosition},
    {label: alive(state.win) && state.win.isVisible() ? 'Hide Dexter' : 'Show Dexter', click: () => (alive(state.win) && state.win.isVisible() ? hidePet() : restore())},
    {label: 'Quit Dexter', click: () => app.quit()}
  ]);
}
function trayMenu() {
  const visible = alive(state.win) && state.win.isVisible();
  return Menu.buildFromTemplate([
    {label: 'Show Dexter', enabled: !visible, click: showPet},
    {label: 'Hide Dexter', enabled: visible, click: hidePet},
    {label: 'Restore Dexter', click: () => { restore(); proactiveEvent('restore', {force: true}); }},
    {type: 'separator'},
    {label: 'Talk to Dexter…', click: () => openChat()},
    {label: 'Settings…', click: () => openSettings()},
    {type: 'separator'},
    {label: 'Pass through all clicks', type: 'checkbox', checked: state.passThrough, click: () => setPassThrough(!state.passThrough)},
    {label: 'Quiet mode', type: 'checkbox', checked: state.settings.quiet, click: () => updateSettings({quiet: !state.settings.quiet})},
    {type: 'separator'},
    {label: 'Quit Dexter', click: () => app.quit()}
  ]);
}
function refreshMenus() {
  if (state.tray && !state.tray.isDestroyed()) state.tray.setContextMenu(trayMenu());
}

// ---------------------------------------------------------------- windows
const SECURE_PREFS = {nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true,
  allowRunningInsecureContent: false, webviewTag: false, spellcheck: false, navigateOnDragDrop: false};
function lockNavigation(win, home) {
  win.webContents.setWindowOpenHandler(() => ({action: 'deny'}));
  win.webContents.on('will-navigate', (event, url) => { if (url !== home) event.preventDefault(); });
  win.webContents.on('will-attach-webview', event => event.preventDefault());
}
function createPetWindow() {
  const size = ws.petWindowSize(state.settings.scale);
  const win = new BrowserWindow({
    ...size, show: false, frame: false, transparent: true, hasShadow: false, resizable: false,
    minimizable: false, maximizable: false, fullscreenable: false, skipTaskbar: true,
    focusable: !state.settings.passiveFocus, acceptFirstMouse: true,
    backgroundColor: '#00000000', autoHideMenuBar: true, title: 'Dexter',
    webPreferences: {...SECURE_PREFS, preload: path.join(ROOT, 'preload.cjs'), backgroundThrottling: true}
  });
  state.win = win;
  placeWindow();
  applyWindow();
  win.on('moved', () => { rememberPosition(); scheduleSave(); });
  lockNavigation(win, 'dexter://app/index.html');
  win.webContents.on('did-finish-load', () => {
    win.webContents.executeJavaScript('document.body.dataset.desktop = "true"').catch(() => {});
    sendPrefs();
    if (state.settings.art !== 'pixel') emit(state.settings.art);
  });
  win.webContents.on('render-process-gone', (_event, details) => recoverRenderer(details));
  win.webContents.on('unresponsive', () => events.record('error', 'renderer-unresponsive', {}));
  win.on('show', refreshMenus); win.on('hide', refreshMenus);
  win.loadURL('dexter://app/index.html').catch(error => dialog.showErrorBox('Dexter cannot start', error.message));
  win.once('ready-to-show', () => { win.showInactive(); setIgnore(); });
}
function recoverRenderer(details) {
  const now = Date.now();
  state.crashTimes = state.crashTimes.filter(t => now - t < 5 * 60000);
  state.crashTimes.push(now);
  events.record('error', 'renderer-gone', {reason: details?.reason || 'unknown', count: state.crashTimes.length});
  if (state.crashTimes.length <= 3) setTimeout(() => { if (alive(state.win)) state.win.reload(); }, 1000);
  else if (!SMOKE_TEST) dialog.showMessageBox({type: 'warning', message: 'Dexter\'s renderer keeps failing.', detail: 'Use the menu-bar icon to Quit, then reopen Dexter. Diagnostics are available in Settings.'}).catch(() => {});
}
function chatSize() { return {width: 340, height: 440}; }
function createChatWindow() {
  const win = new BrowserWindow({
    ...chatSize(), show: false, frame: false, transparent: true, hasShadow: true, resizable: true,
    minWidth: 280, minHeight: 300, maxWidth: 640, maxHeight: 900,
    minimizable: false, maximizable: false, fullscreenable: false, skipTaskbar: true,
    backgroundColor: '#00000000', title: 'Talk to Dexter',
    webPreferences: {...SECURE_PREFS, preload: path.join(ROOT, 'preload-ui.cjs')}
  });
  lockNavigation(win, 'dexter://app/ui/chat.html');
  win.setAlwaysOnTop(state.settings.alwaysOnTop, 'floating');
  // Closing destroys the renderer to return its memory; history lives in this process.
  win.on('closed', () => { if (state.chatWin === win) state.chatWin = null; events.record('window', 'chat-closed', {}); });
  win.webContents.on('render-process-gone', () => { events.record('error', 'chat-renderer-gone', {}); state.chatWin = null; try { win.destroy(); } catch {} });
  win.loadURL('dexter://app/ui/chat.html').catch(() => {});
  return win;
}
function openChat() {
  if (!alive(state.chatWin)) state.chatWin = createChatWindow();
  const win = state.chatWin;
  const pet = alive(state.win) ? state.win.getBounds() : {x: 100, y: 100, width: 260, height: 369};
  const area = screen.getDisplayMatching(pet).workArea;
  const size = win.getBounds();
  win.setBounds(ws.panelBeside(pet, {width: size.width, height: size.height}, area));
  sendPet('dexter:bubble', {kind: 'hide'});
  const reveal = () => { win.show(); win.focus(); events.record('window', 'chat-shown', {}); };
  if (win.webContents.isLoading()) win.webContents.once('did-finish-load', reveal); else reveal();
  return win;
}
function openSettings(section) {
  if (!alive(state.settingsWin)) {
    const win = new BrowserWindow({
      width: 760, height: 640, minWidth: 560, minHeight: 420, show: false, title: 'Dexter Settings',
      backgroundColor: '#11191c', autoHideMenuBar: true, fullscreenable: false,
      webPreferences: {...SECURE_PREFS, preload: path.join(ROOT, 'preload-ui.cjs')}
    });
    lockNavigation(win, 'dexter://app/ui/settings.html');
    win.on('closed', () => { state.settingsWin = null; });
    win.loadURL('dexter://app/ui/settings.html').catch(() => {});
    win.once('ready-to-show', () => { win.show(); if (PLATFORM_MAC) app.focus({steal: true}); win.focus(); });
    state.settingsWin = win;
  } else { state.settingsWin.show(); state.settingsWin.focus(); }
  if (section) state.settingsWin.webContents.once('did-finish-load', () => sendUi('settings:section', section));
  events.record('window', 'settings-shown', {});
  return state.settingsWin;
}

// ---------------------------------------------------------------- bubbles, speech, proactive events
function showBubble(payload) {
  state.bubbleOpen = payload.kind !== 'hide';
  sendPet('dexter:bubble', payload);
}
function speakOut(text, kind) {
  const s = state.settings;
  if (!s.ttsEnabled || !text) return;
  if (kind === 'reply' && !s.ttsSpeakReplies) return;
  if (kind === 'remark' && !s.ttsSpeakRemarks) return;
  sendPet('dexter:speech', {op: 'say', text, interrupt: kind === 'reply'});
}
function petBusyState() {
  return {hidden: !(alive(state.win) && state.win.isVisible()), passThrough: state.passThrough, dragging: state.moving,
    napping: state.napping, chatOpen: alive(state.chatWin) && state.chatWin.isVisible(), bubbleOpen: state.bubbleOpen};
}
function proactiveEvent(kind, {force = false} = {}) {
  const line = persona.eventLine(kind);
  if (!line) return false;
  const decision = force ? {allow: true, reason: 'User-requested.'} : attention.evaluateProactive({kind: 'event', settings: state.settings, state: petBusyState(), budget});
  events.record('state', 'event-' + kind, {allowed: decision.allow, reason: decision.reason});
  if (!decision.allow) return false;
  if (!force) budget.record(Date.now());
  signal(line.state, 60, 2400, line.line);
  speakOut(line.line, 'remark');
  return true;
}
function armCheckins() {
  clearTimeout(state.checkinTimer); state.checkinTimer = null;
  const delay = attention.nextCheckinDelay({settings: state.settings, lastAt: state.lastCheckinAt});
  if (delay === null) return;
  state.checkinTimer = setTimeout(runCheckin, delay);
}
function runCheckin({force = false} = {}) {
  state.checkinTimer = null;
  const decision = force ? {allow: true, reason: 'Requested from Settings.'} : attention.evaluateProactive({kind: 'checkin', settings: state.settings, state: petBusyState(), budget});
  events.record('checkin', decision.allow ? 'shown' : 'deferred', {reason: decision.reason});
  if (!decision.allow) {
    // Retry once later rather than polling; a fresh schedule follows either way.
    if (state.settings.checkinsEnabled) state.checkinTimer = setTimeout(runCheckin, 10 * 60000);
    return {shown: false, reason: decision.reason};
  }
  if (!force) budget.record(Date.now());
  const checkin = persona.chooseCheckin(state.lastCheckinId);
  state.activeCheckin = checkin; state.lastCheckinId = checkin.id; state.lastCheckinAt = Date.now();
  if (alive(state.win) && !state.win.isVisible() && force) restore();
  showBubble({kind: 'checkin', ...persona.publicCheckin(checkin), timeoutMs: 60000});
  speakOut(checkin.text, 'remark');
  armCheckins();
  return {shown: true, reason: decision.reason};
}
function answerCheckin(id, index) {
  const active = state.activeCheckin;
  if (!active || active.id !== id) return;
  const choice = persona.checkinChoice(id, index);
  if (!choice) return;
  state.activeCheckin = null;
  events.record('checkin', 'answered', {id, index});
  showBubble({kind: 'say', text: choice.reply, timeoutMs: 4500});
  signal(choice.state, 70, 2600, '');
  speakOut(choice.reply, 'remark');
  if (choice.action === 'reduce') {
    const options = ws.CHECKIN_MINUTES;
    const next = options.find(m => m > state.settings.checkinMinutes);
    updateSettings(next ? {checkinMinutes: next} : {checkinsEnabled: false});
  }
}

// ---------------------------------------------------------------- conversation
function setAiStatus(status, detail = '') {
  state.aiStatus = status; state.aiDetail = detail;
  sendUi('chat:status', {status, detail, enabled: state.settings.aiEnabled});
}
function chatSnapshot() {
  return {messages: conversation.list(), status: state.aiStatus, detail: state.aiDetail, enabled: state.settings.aiEnabled,
    remembering: state.settings.rememberConversation, commands: persona.COMMANDS};
}
function pushChat(event) { if (alive(state.chatWin)) state.chatWin.webContents.send('chat:event', event); }
function deliverReply(text) {
  if (!text) return;
  const decision = attention.evaluateProactive({kind: 'reply', settings: state.settings, state: petBusyState()});
  if (decision.allow) {
    const short = text.length > 180 ? text.slice(0, 177).replace(/\s+\S*$/, '') + '…' : text;
    showBubble({kind: 'reply', text: short, more: text.length > 180, timeoutMs: 9000});
  }
  speakOut(text, 'reply');
}
function localTurn(userText, reply, actions = []) {
  if (userText) pushChat({type: 'message', message: conversation.add('user', userText)});
  const m = conversation.add('dexter', reply, 'local');
  pushChat({type: 'message', message: m});
  for (const a of actions) emit(a);
  conversation.save();
  return m;
}
async function chatSend(raw) {
  const text = typeof raw === 'string' ? raw.slice(0, 4000).trim() : '';
  if (!text) return {ok: false};
  events.record('interaction', 'chat-send', {chars: text.length});
  const command = persona.parseCommand(text);
  if (command) {
    switch (command.name) {
      case '/help': localTurn(text, persona.helpText()); break;
      case '/treat': localTurn(text, 'Very well. One treat.', ['treat']); break;
      case '/huff': localTurn(text, 'Hff. Formally lodged.', ['huff']); break;
      case '/nap': localTurn(text, state.napping ? 'Awake. Reluctantly.' : 'I am not available for consultation.', ['nap']); break;
      case '/quiet': updateSettings({quiet: !state.settings.quiet}); localTurn(text, state.settings.quiet ? 'Silence. A reasonable policy.' : 'Complaints may resume.'); break;
      case '/status': localTurn(text, 'State: ' + state.familiarState + (state.napping ? ' (napping)' : '') + '. Local AI: ' + state.aiStatus +
        '. Speech: ' + (state.settings.ttsEnabled ? state.settings.ttsEngine : 'off') + '. Check-ins: ' + (state.settings.checkinsEnabled ? 'every ' + state.settings.checkinMinutes + ' min' : 'off') + '.'); break;
      case '/clear': conversation.clear(); pushChat({type: 'reset', snapshot: chatSnapshot()}); break;
      default: localTurn(text, 'I do not know ' + command.name.slice(0, 24) + '. Try /help.');
    }
    return {ok: true};
  }
  if (ai.busy()) return {ok: false, detail: 'Still answering. Stop the current reply first.'};
  pushChat({type: 'message', message: conversation.add('user', text)});
  if (!state.settings.aiEnabled) {
    const reply = persona.localReply(text);
    const m = conversation.add('assistant', reply, 'local');
    pushChat({type: 'message', message: m});
    conversation.save(); deliverReply(reply);
    signal('watching', 55, 1600, '');
    return {ok: true};
  }
  const pending = conversation.add('assistant', '', 'streaming');
  pushChat({type: 'message', message: pending});
  setAiStatus('streaming', 'Dexter is considering it.');
  const thinking = persona.eventLine('aiThinking');
  signal(thinking.state, 60, 30000, '');
  let collected = '';
  const result = await ai.streamChat({
    messages: conversation.context(), systemPrompt: persona.SYSTEM_PROMPT,
    onToken: token => { collected += token; pushChat({type: 'token', id: pending.id, text: token}); }
  });
  const finalText = result.text || collected;
  const status = result.status === 'done' ? 'complete' : result.status === 'truncated' ? 'truncated' : result.status === 'cancelled' ? 'cancelled' : 'error';
  conversation.update(pending.id, {content: finalText, status});
  events.record('ai', 'reply-' + result.status, {chars: finalText.length});
  pushChat({type: 'done', id: pending.id, status, text: finalText, detail: result.detail || ''});
  if (result.status === 'done' || result.status === 'truncated') {
    setAiStatus('ready', result.model ? 'Connected · ' + result.model : 'Connected.');
    signal('watching', 65, 1800, '');
    deliverReply(finalText);
  } else if (result.status === 'cancelled') {
    setAiStatus('ready', 'Reply stopped.');
    signal('idle', 50, 800, '');
  } else {
    const kind = result.status === 'offline' ? 'aiOffline' : 'aiError';
    setAiStatus(result.status === 'offline' ? 'offline' : result.status === 'disabled' ? 'off' : 'error', result.detail || '');
    const line = persona.eventLine(kind);
    signal(line.state, 70, 2000, '');
    pushChat({type: 'message', message: conversation.add('dexter', line.line + (result.detail ? ' (' + result.detail + ')' : ''), 'error')});
  }
  conversation.save();
  return {ok: true, status: result.status};
}

// ---------------------------------------------------------------- diagnostics
function cspOk() {
  const pages = ['index.html', 'ui/chat.html', 'ui/settings.html'];
  try { return pages.every(p => /connect-src 'none'/.test(fs.readFileSync(path.join(ROOT, p), 'utf8'))); } catch { return false; }
}
function snapshot() {
  const windows = [['pet', state.win], ['chat', state.chatWin], ['settings', state.settingsWin]].filter(([, w]) => alive(w)).map(([name, w]) => {
    const p = w.webContents.getLastWebPreferences?.() || {};
    return {name, sandbox: p.sandbox === true, contextIsolation: p.contextIsolation === true, nodeIntegration: p.nodeIntegration === true};
  });
  let memoryMB = 0, cpuPercent = 0;
  for (const m of app.getAppMetrics()) { memoryMB += (m.memory?.workingSetSize || 0) / 1024; cpuPercent += m.cpu?.percentCPUUsage || 0; }
  const endpoint = ws.validateEndpoint(state.settings.aiEndpoint, {allowRemote: true});
  const bounds = alive(state.win) ? state.win.getBounds() : null;
  const channels = ['dexter:hit', 'dexter:move', 'dexter:drag-end', 'dexter:menu', 'dexter:status', 'dexter:checkin-answer', 'dexter:bubble-dismissed', 'dexter:open-chat', 'dexter:speech-state'];
  return {
    now: Date.now(), settings: {...state.settings}, windows, cspConnectNone: cspOk(), egressCount: state.egressCount, egressWhileDisabled: state.egressWhileDisabled,
    trayAlive: Boolean(state.tray && !state.tray.isDestroyed()), passThrough: state.passThrough,
    petOnScreen: Boolean(bounds && workAreas().some(a => ws.intersects(bounds, a))),
    historyFileExists: fs.existsSync(state.historyPath), settingsWritable: state.settingsWritable,
    maxIpcListeners: Math.max(...channels.map(c => ipcMain.listenerCount(c))), eventListeners: events.listenerCount,
    memoryMB, cpuPercent, uptimeSeconds: (Date.now() - state.startedAt) / 1000, displayCount: screen.getAllDisplays().length,
    familiarState: state.familiarState, visible: alive(state.win) && state.win.isVisible(),
    aiStatus: state.aiStatus, ttsStatus: state.ttsStatus, endpointLoopback: endpoint.loopback !== false,
    conversationSize: conversation.size, eventCounts: events.summary(), recentEvents: events.recent(40),
    app: {name: app.getName(), version: app.getVersion(), packaged: app.isPackaged},
    platform: {os: process.platform, arch: process.arch, release: os.release(), electron: process.versions.electron, chrome: process.versions.chrome}
  };
}
async function exportReport(target) {
  const report = diagnostics.buildReport(snapshot());
  let file = target;
  if (!file) {
    const result = await dialog.showSaveDialog(state.settingsWin || undefined, {
      title: 'Export Dexter diagnostics', defaultPath: path.join(app.getPath('downloads'), 'dexter-diagnostics-' + new Date().toISOString().slice(0, 10) + '.json'),
      filters: [{name: 'JSON', extensions: ['json']}]
    });
    if (result.canceled || !result.filePath) return {saved: false};
    file = result.filePath;
  }
  fs.writeFileSync(file, JSON.stringify(report, null, 2), {mode: 0o600});
  events.record('app', 'diagnostics-exported', {});
  return {saved: true, name: path.basename(file)};
}

// ---------------------------------------------------------------- IPC
function fromPet(event) { return alive(state.win) && event.sender === state.win.webContents; }
function fromUi(event, which) {
  const allowed = which === 'settings' ? [state.settingsWin] : which === 'chat' ? [state.chatWin] : [state.settingsWin, state.chatWin];
  return allowed.some(w => alive(w) && event.sender === w.webContents) && String(event.senderFrame?.url || '').startsWith('dexter://app/ui/');
}
function handle(channel, which, fn) {
  ipcMain.handle(channel, async (event, payload) => {
    if (!fromUi(event, which)) throw new Error('Forbidden');
    return fn(payload, event);
  });
}
function setupIpc() {
  ipcMain.on('dexter:hit', (event, hit) => {
    if (!fromPet(event) || typeof hit !== 'boolean') return;
    state.overPet = hit;
    if (!state.moving) setIgnore();
  });
  ipcMain.on('dexter:move', (event, delta) => {
    if (!fromPet(event) || !delta || !Number.isFinite(delta.dx) || !Number.isFinite(delta.dy)) return;
    if (Math.abs(delta.dx) > 80 || Math.abs(delta.dy) > 80) return;
    state.moving = true;
    reposition(delta);
  });
  ipcMain.on('dexter:drag-end', event => {
    if (!fromPet(event)) return;
    state.moving = false; state.dragVirtual = null; setIgnore(); rememberPosition(); scheduleSave();
  });
  ipcMain.on('dexter:menu', event => { if (fromPet(event)) petMenu().popup({window: state.win}); });
  ipcMain.on('dexter:status', (event, status) => {
    if (!fromPet(event) || !status || typeof status !== 'object') return;
    const stateName = typeof status.state === 'string' ? status.state.slice(0, 20) : state.familiarState;
    if (stateName !== state.familiarState) events.record('state', stateName, {});
    state.familiarState = stateName;
    state.napping = status.napping === true;
  });
  ipcMain.on('dexter:checkin-answer', (event, answer) => {
    if (!fromPet(event) || !answer || typeof answer.id !== 'string') return;
    answerCheckin(answer.id, answer.index);
  });
  ipcMain.on('dexter:bubble-dismissed', event => {
    if (!fromPet(event)) return;
    state.bubbleOpen = false;
    if (state.activeCheckin) { events.record('checkin', 'dismissed', {id: state.activeCheckin.id}); state.activeCheckin = null; }
  });
  ipcMain.on('dexter:open-chat', event => { if (fromPet(event)) openChat(); });
  ipcMain.on('dexter:speech-state', (event, info) => {
    if (!fromPet(event) || !info || typeof info.state !== 'string') return;
    state.ttsStatus = info.state.slice(0, 20) + (typeof info.detail === 'string' && info.detail ? ': ' + info.detail.slice(0, 80) : '');
    if (info.state === 'error') events.record('tts', 'error', {detail: String(info.detail || '').slice(0, 60)});
    sendUi('settings:changed', publicSettings());
  });
  ipcMain.handle('dexter:piper', async (event, text) => {
    if (!fromPet(event) || typeof text !== 'string') throw new Error('Forbidden');
    if (!state.settings.ttsEnabled || state.settings.ttsEngine !== 'piper') throw new Error('Piper is not enabled.');
    const wav = await piper.synthesize(text, state.settings);
    return new Uint8Array(wav);
  });
  ipcMain.on('dexter:piper-cancel', event => { if (fromPet(event)) piper.cancel(); });

  handle('settings:get', 'any', () => publicSettings());
  handle('settings:set', 'settings', patch => updateSettings(patch));
  handle('settings:reset', 'settings', () => {
    const keep = {x: state.settings.x, y: state.settings.y};
    applySettings(state.settings, ws.sanitizeSettings(keep));
    restore();
    return publicSettings();
  });
  handle('window:restore', 'any', () => { restore(); return publicSettings(); });
  handle('window:reset-position', 'settings', () => { resetPosition(); restore(); return publicSettings(); });
  handle('window:hide-self', 'chat', () => { state.chatWin?.close(); return true; });
  handle('ai:test', 'settings', async () => {
    if (!state.settings.aiEnabled) return {ok: false, detail: 'Turn on Local AI first. Nothing was contacted.'};
    setAiStatus('connecting', 'Testing connection…');
    const result = await ai.testConnection();
    setAiStatus(result.ok ? 'ready' : 'offline', result.detail);
    events.record('ai', result.ok ? 'test-ok' : 'test-failed', {models: result.models?.length || 0});
    return result;
  });
  handle('chat:history', 'chat', () => chatSnapshot());
  handle('chat:send', 'chat', text => chatSend(text));
  handle('chat:cancel', 'chat', () => { ai.cancel(); events.record('ai', 'cancel', {}); return true; });
  handle('chat:clear', 'any', () => { conversation.clear(); pushChat({type: 'reset', snapshot: chatSnapshot()}); return true; });
  handle('chat:open-settings', 'chat', () => { openSettings('ai'); return true; });
  handle('tts:test', 'settings', () => {
    if (!state.settings.ttsEnabled) return {ok: false, detail: 'Turn on speech first.'};
    sendPet('dexter:speech', {op: 'say', text: 'Hff. This is my voice. Do not get used to it.', interrupt: true});
    return {ok: true, detail: 'Sent to the ' + state.settings.ttsEngine + ' voice.'};
  });
  handle('tts:stop', 'any', () => { sendPet('dexter:speech', {op: 'cancel'}); piper.cancel(); return true; });
  handle('piper:check', 'settings', () => checkPiper(state.settings));
  handle('checkin:now', 'settings', () => runCheckin({force: true}));
  handle('diag:audit', 'settings', () => diagnostics.runSelfAudit(snapshot()));
  handle('diag:report', 'settings', () => diagnostics.buildReport(snapshot()));
  handle('diag:export', 'settings', () => exportReport());
}

// ---------------------------------------------------------------- protocol
const TOP_FILES = new Set(['index.html', 'app.js', 'styles.css', 'overlay.css', 'renderer.js', 'hit-test.js', 'speech-queue.js', 'manifest.webmanifest']);
const ASSET_FOLDERS = new Set(['src', 'assets', 'icons', 'ui']);
const SAFE = /^[A-Za-z0-9_./-]+$/;
const TYPES = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.webm': 'video/webm', '.webmanifest': 'application/manifest+json', '.json': 'application/json'};
function serve(request) {
  let url;
  try { url = new URL(request.url); } catch { return new Response('Bad URL', {status: 400}); }
  if (url.hostname !== 'app' || url.username || url.password || url.port || url.search || url.hash) return new Response('Forbidden', {status: 403});
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { return new Response('Bad path', {status: 400}); }
  if (pathname.includes('\\') || pathname.includes('\0')) return new Response('Forbidden', {status: 403});
  const relative = pathname.startsWith('/') ? pathname.slice(1) : pathname;
  const slash = relative.indexOf('/');
  const folder = slash > 0 ? relative.slice(0, slash) : '';
  const leaf = slash > 0 ? relative.slice(slash + 1) : '';
  const isAsset = ASSET_FOLDERS.has(folder) && leaf.length > 0 && SAFE.test(leaf) && !leaf.split('/').includes('..');
  if (!TOP_FILES.has(relative) && !isAsset) return new Response('Forbidden', {status: 403});
  const ext = path.extname(relative);
  if (!Object.hasOwn(TYPES, ext)) return new Response('Forbidden', {status: 403});
  const requested = path.resolve(ROOT, relative);
  if (!ws.isWithinRoot(ROOT, requested)) return new Response('Forbidden', {status: 403});
  let data;
  try {
    const canonical = fs.realpathSync.native(requested);
    if (!ws.isWithinRoot(fs.realpathSync.native(ROOT), canonical) || !fs.statSync(canonical).isFile()) return new Response('Forbidden', {status: 403});
    data = fs.readFileSync(canonical);
  } catch { return new Response('Not found', {status: 404}); }
  const headers = {'Content-Type': TYPES[ext], 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'};
  const requestedRange = request.headers.get('range');
  if (requestedRange) {
    const match = /^bytes=([0-9]*)-([0-9]*)$/.exec(requestedRange);
    if (!match || (!match[1] && !match[2]) || data.length === 0) return new Response(null, {status: 416, headers: {...headers, 'Content-Range': 'bytes */' + data.length}});
    let from, end;
    if (!match[1]) { const suffix = Number(match[2]); from = Math.max(0, data.length - suffix); end = data.length - 1; }
    else { from = Number(match[1]); end = match[2] ? Math.min(data.length - 1, Number(match[2])) : data.length - 1; }
    if (!Number.isSafeInteger(from) || !Number.isSafeInteger(end) || from > end || from >= data.length) return new Response(null, {status: 416, headers: {...headers, 'Content-Range': 'bytes */' + data.length}});
    headers['Content-Range'] = 'bytes ' + from + '-' + end + '/' + data.length;
    return new Response(data.subarray(from, end + 1), {status: 206, headers});
  }
  return new Response(data, {status: 200, headers});
}

// ---------------------------------------------------------------- lifecycle
const gotLock = SMOKE_TEST || app.requestSingleInstanceLock();
if (!gotLock) app.quit();
app.on('second-instance', () => { restore(); events.record('app', 'second-instance', {}); });

app.whenReady().then(() => {
  if (!gotLock) return;
  app.setAppUserModelId('dev.stinkyweasel.dexterdesk');
  app.setName('Dexter Desk Familiar');
  const ses = session.defaultSession;
  ses.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  ses.setPermissionCheckHandler(() => false);
  // Electron downloads Hunspell dictionaries from redirector.gvt1.com on Linux and
  // Windows even when every window has spellcheck:false (found by the egress audit).
  // Disable the spellchecker and point any download at an unroutable loopback port.
  try { ses.setSpellCheckerEnabled(false); } catch {}
  try { ses.setSpellCheckerDictionaryDownloadURL('http://127.0.0.1:9/'); } catch {}
  if (!PLATFORM_MAC) { try { ses.setSpellCheckerLanguages([]); } catch {} }
  // Renderers may only load bundled dexter://app files. Model traffic happens
  // in this process, only through core/ollama.cjs, only when enabled.
  ses.webRequest.onBeforeRequest((details, callback) => callback({cancel: !details.url.startsWith('dexter://app/')}));
  load();
  protocol.handle('dexter', serve);
  setupIpc();
  createPetWindow();
  const image = nativeImage.createFromPath(path.join(ROOT, 'icons', 'icon-192.png'));
  state.tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image.resize({width: 18, height: 18}));
  state.tray.setToolTip('Dexter Desk Familiar');
  state.tray.on('click', () => restore());
  refreshMenus();
  applyDock();
  applyLoginItem();
  setAiStatus(state.settings.aiEnabled ? 'idle' : 'off', state.settings.aiEnabled ? 'Enabled. Not yet connected.' : 'Local AI is off.');
  armCheckins();
  for (const kind of ['display-added', 'display-removed', 'display-metrics-changed']) screen.on(kind, () => onDisplaysChanged(kind));
  powerMonitor.on('suspend', () => {
    clearTimeout(state.checkinTimer); state.checkinTimer = null;
    ai.cancel(); sendPet('dexter:speech', {op: 'cancel'});
    events.record('power', 'suspend', {});
  });
  powerMonitor.on('resume', () => {
    events.record('power', 'resume', {});
    ensureOnScreen(state.win);
    armCheckins();
    setTimeout(() => proactiveEvent('resume'), 1500);
  });
  app.on('activate', () => restore());
  events.record('app', 'ready', {smoke: SMOKE_TEST});
  if (SMOKE_TEST) require('./smoke.cjs').run({app, state, events, petMenu, trayMenu, openChat, openSettings, updateSettings, restore, snapshot, exportReport, runCheckin, onDisplaysChanged, conversation: () => conversation});
});
app.on('window-all-closed', () => { if (!PLATFORM_MAC) app.quit(); });
app.on('before-quit', () => {
  state.quitting = true;
  clearTimeout(state.saveTimer); clearTimeout(state.checkinTimer); clearTimeout(state.displayTimer);
  ai.cancel(); piper.cancel();
  if (state.settings) { rememberPosition(); save(); conversation.save(); }
});
