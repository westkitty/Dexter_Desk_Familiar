'use strict';
// Dexter Desktop — Electron main process.
// One small transparent window for Dexter, plus two on-demand panels
// (conversation, settings). No global input capture, no screen inspection,
// no network unless the user enables Local AI. See desktop/ARCHITECTURE.md.
const {app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, screen, dialog, session, protocol, powerMonitor, globalShortcut, Notification, systemPreferences} = require('electron');
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
const modes = require('./core/modes.cjs');
const semanticStates = require('./core/states.cjs');
const router = require('./core/router.cjs');
const checkins = require('./core/checkins.cjs');
const sessions = require('./core/session.cjs');
const {createJournal} = require('./core/journal.cjs');
const {createNotes} = require('./core/memory.cjs');
const packets = require('./core/packet.cjs');
const scripts = require('./core/scripts.cjs');
const {createWhisper, checkWhisper} = require('./core/stt-whisper.cjs');
const {createTtsCache, listVoices} = require('./core/tts-cache.cjs');
const {createDocumentsStore} = require('./core/documents.cjs');
const questionsLib = require('./core/questions-library.cjs');
const dexdictate = require('./core/dexdictate-interop.cjs');
const kokoro = require('./core/kokoro-experiment.cjs');

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
  displayTimer: null, crashTimes: [], startedAt: Date.now(),
  inspectorWin: null, bubbleWin: null, sessionTimer: null, sessionMilestone: null, gagTimer: null,
  lastUserText: '', hotkeyStatus: 'off', sttStatus: 'off', chatBoundsTimer: null,
  devUnlocked: false, lastUserDragTime: 0, roamTimer: null
};
const events = createEventLog({limit: 200});
const budget = attention.createBudget();
const piper = createPiper();
let conversation = createConversation();
let journal = null, notes = null, ttsCache = null, documents = null, questionsStore = null;
const picker = checkins.createPicker();
const workSession = sessions.createSession();
const whisper = createWhisper();
const demo = scripts.createPlayer({onStep: step => {
  if (step.gag) sendPet('dexter:gag', step.gag);
  showBubble({kind: 'say', text: step.say, timeoutMs: step.ms});
  signal(step.state, 70, step.ms, '');
}});
// Semantic WestCat states drive Dexter's visual states through the priority bus.
const semantic = semanticStates.createSemanticMachine({onChange: change => {
  events.record('state', 'semantic-' + change.to, {from: change.from, reason: String(change.reason || '').slice(0, 40)});
  signal(change.visual, 62, (semanticStates.SEMANTIC[change.to].autoReturn?.ms) || 2500, '');
  sendUi('inspector:changed', {});
}});
// A mode overlays the user's settings at runtime; stored settings are never rewritten by it.
function eff() { return modes.effectiveSettings(state.settings); }
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
  const data = app.getPath('userData');
  journal = createJournal({file: path.join(data, 'journal.jsonl'), enabled: () => Boolean(state.settings?.keepJournal)});
  notes = createNotes({file: path.join(data, 'notes.json')});
  notes.load();
  ttsCache = createTtsCache({dir: path.join(data, 'tts-cache')});
  documents = createDocumentsStore({file: path.join(data, 'project-documents.json')});
  documents.load();
  questionsStore = questionsLib.createQuestionsStore({file: path.join(data, 'questions-library.json')});
  questionsStore.load();
  if (state.settings?.customCheckins?.length) {
    questionsStore.migrateLegacy(state.settings.customCheckins);
  }
  if (!state.settings?.keepJournal) journal?.clear();
  conversation = createConversation({file: state.historyPath, persist: state.settings.rememberConversation});
  conversation.load();
  // Remembering was turned off while the app was not running: never leave a file behind.
  if (!state.settings.rememberConversation) { try { fs.rmSync(state.historyPath, {force: true}); } catch {} }
}

// ---------------------------------------------------------------- helpers
const alive = w => Boolean(w && !w.isDestroyed());
function sendPet(channel, payload) { if (alive(state.win)) state.win.webContents.send(channel, payload); }
function sendUi(channel, payload) {
  for (const w of [state.chatWin, state.settingsWin, state.inspectorWin, state.bubbleWin]) if (alive(w)) w.webContents.send(channel, payload);
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
  state.lastUserDragTime = Date.now();
  const current = state.win.getBounds();
  if (!state.dragVirtual) state.dragVirtual = {x: current.x, y: current.y};
  state.dragVirtual.x += Math.round(delta.dx);
  state.dragVirtual.y += Math.round(delta.dy);
  const target = screen.getDisplayNearestPoint({x: state.dragVirtual.x + Math.floor(current.width / 2), y: state.dragVirtual.y + Math.floor(current.height / 2)}).workArea;
  const position = ws.clampPosition(state.dragVirtual, target, current, {allowHeadroomBleed: true});
  state.win.setPosition(position.x, position.y);
}
function placeWindow() {
  const size = ws.petWindowSize(state.settings.scale);
  const saved = state.settings.x !== null && state.settings.y !== null;
  const display = (saved ? screen.getDisplayNearestPoint({x: state.settings.x + Math.floor(size.width / 2), y: state.settings.y + Math.floor(size.height / 2)}) : screen.getPrimaryDisplay()).workArea;
  const candidate = {x: saved ? state.settings.x : display.x + display.width - size.width - 28, y: saved ? state.settings.y : display.y + display.height - size.height - 28};
  state.win.setBounds({...size, ...ws.clampPosition(candidate, display, size, {allowHeadroomBleed: true})});
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
  sendPet('dexter:gag', 'drop');
  events.record('window', 'restore', {});
}
function resetPosition() {
  state.settings.x = null; state.settings.y = null;
  placeWindow(); scheduleSave(); events.record('window', 'reset-position', {});
}

// ---------------------------------------------------------------- preferences → windows
function applyWindow() {
  if (!alive(state.win)) return;
  const level = state.settings.allSpaces ? 'screen-saver' : 'floating';
  state.win.setAlwaysOnTop(state.settings.alwaysOnTop, level);
  try { state.win.setVisibleOnAllWorkspaces(state.settings.allSpaces, {visibleOnFullScreen: state.settings.allSpaces, skipTransformProcessType: true}); } catch {}
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
  const s = eff();
  return {quiet: s.quiet, motion: s.motion, sound: s.sound, idleSeconds: s.idleSeconds, intensity: s.intensity,
    flipped: s.flipped, art: s.art, bubbleTextSize: s.bubbleTextSize, highContrastBubble: s.highContrastBubble,
    preciseHitTest: s.preciseHitTest, typewriter: s.typewriter, typewriterCps: s.typewriterCps, gags: s.gags,
    animationSpeed: s.animationSpeed, developerTools: s.developerTools, mode: s.mode,
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
  if (['checkinsEnabled', 'checkinMinutes', 'mode', 'sessionCheckinMinutes'].some(changed)) armCheckins();
  if (['allSpaces'].some(changed)) applyWindow();
  if (changed('globalHotkey')) applyHotkey();
  if (changed('bubbleMode') && next.bubbleMode !== 'window' && alive(state.bubbleWin)) state.bubbleWin.close();
  if (changed('sttEnabled') && !next.sttEnabled) { whisper.cancel(); state.sttStatus = 'off'; }
  if (changed('ttsCache') && !next.ttsCache) ttsCache?.clear();
  if (changed('keepJournal') && !next.keepJournal) journal?.clear();
  if (changed('mode')) { events.record('settings', 'mode', {mode: next.mode}); armGags(); }
  if (changed('gags')) armGags();
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
        const allowPath = next.aiProvider === 'openai_compatible' || next.aiProvider === 'hermes_unverified' || (patch.aiEndpoint && patch.aiEndpoint.includes('/v1'));
        const checked = ws.validateEndpoint(patch.aiEndpoint, {allowRemote: next.aiAllowRemote, allowPath});
        if (!checked.ok) { rejected.push(key); endpointError = checked.reason; }
      } else if (next[key] !== patch[key]) rejected.push(key);
    }
  }
  applySettings(state.settings, next);
  if ('pinned' in patch || 'roamingEnabled' in patch) {
    armRoaming();
  }
  return {...publicSettings(), rejected, endpointError};
}
function publicSettings() {
  const s = {...state.settings};
  delete s.size;
  return {settings: s, platform: process.platform, canLaunchAtLogin: PLATFORM_MAC || process.platform === 'win32',
    defaults: ws.DEFAULTS, aiStatus: state.aiStatus, aiDetail: state.aiDetail, ttsStatus: state.ttsStatus,
    passThrough: state.passThrough, visible: alive(state.win) && state.win.isVisible(), devUnlocked: Boolean(state.devUnlocked),
    hotkeyStatus: state.hotkeyStatus, sttStatus: state.sttStatus, modes: Object.fromEntries(Object.entries(modes.MODES).map(([k, v]) => [k, {label: v.label, tagline: v.tagline}])),
    notes: notes ? notes.list() : [], notesCrossings: notes ? notes.crossings : 0, journalEntries: journal && state.settings.keepJournal ? journal.read().length : 0,
    documents: documents ? documents.list() : [], documentsStats: documents ? documents.stats() : null,
    ttsCacheStats: ttsCache ? ttsCache.stats() : {files: 0, bytes: 0, hits: 0, misses: 0},
    questionsCategories: questionsStore ? questionsStore.categories : [],
    enabledQuestionsCategories: questionsStore ? questionsStore.enabledCategories : [],
    session: workSession.snapshot()};
}

// ---------------------------------------------------------------- menus
function setArt(art) { updateSettings({art}); }
function scaleMenu() {
  return [80, 100, 130, 160].map(scale => ({label: scale + '%', type: 'radio', checked: state.settings.scale === scale, click: () => updateSettings({scale})}));
}
function modeMenu() {
  return Object.entries(modes.MODES).map(([id, m]) => ({label: m.label + ' — ' + m.tagline, type: 'radio', checked: state.settings.mode === id,
    click: () => { updateSettings({mode: id}); showBubble({kind: 'say', text: m.label + ' mode. ' + m.tagline, timeoutMs: 3500}); }}));
}
function sessionMenu() {
  const snap = workSession.snapshot();
  if (!snap.active) return ws.SESSION_MINUTES.map(min => ({label: 'Start ' + min + '-minute session', click: () => startSession(min)}));
  return [
    {label: (snap.paused ? 'Paused · ' : '') + sessions.formatRemaining(snap.remainingMs) + ' left', enabled: false},
    snap.paused ? {label: 'Resume session', click: resumeSession} : {label: 'Pause session', click: pauseSession},
    {label: 'End session', click: stopSession}
  ];
}
function tricksMenu() {
  return [
    {label: 'Sneeze', click: () => gag('sneeze')}, {label: 'Hop', click: () => gag('hop')},
    {label: 'Shake', click: () => gag('shake')}, {label: 'Drop in', click: () => gag('drop')},
    {type: 'separator'},
    demo.playing ? {label: 'Stop demonstration', click: () => demo.stop()} : {label: 'Play demonstration', click: () => demo.play()}
  ];
}
function devMenu() {
  return Menu.buildFromTemplate([
    {label: 'Developer tools (Unlocked)', enabled: false},
    {label: 'Force semantic state', submenu: Object.keys(semanticStates.SEMANTIC).map(id => ({label: id, click: () => semantic.enter(id, 'developer', {force: true})}))},
    {label: 'Show a check-in now', click: () => runCheckin({force: true})},
    {label: 'Event reaction', submenu: Object.keys(persona.EVENTS).map(k => ({label: k, click: () => proactiveEvent(k, {force: true})}))},
    {label: 'Trick', submenu: tricksMenu()},
    {label: 'Typewriter speed', submenu: [20, 45, 80, 120].map(cps => ({label: cps + ' chars/s', type: 'radio', checked: state.settings.typewriterCps === cps, click: () => updateSettings({typewriterCps: cps})}))},
    {label: 'Inspector…', click: () => openInspector()},
    {type: 'separator'},
    {label: 'Re-lock Developer Tools', click: () => { state.devUnlocked = false; refreshMenus(); }}
  ]);
}
function petMenu() {
  const s = state.settings;
  return Menu.buildFromTemplate([
    {label: 'Treat', click: () => emit('treat')},
    {label: 'Huff', click: () => emit('huff')},
    {label: state.napping ? 'Wake' : 'Nap', click: () => emit('nap')},
    {label: 'Talk to Dexter…', click: () => openChat()},
    {label: 'Tricks', submenu: tricksMenu()},
    {label: 'Mode', submenu: modeMenu()},
    {label: 'Session', submenu: sessionMenu()},
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
    {label: 'Pin Dexter in place', type: 'checkbox', checked: s.pinned, click: () => updateSettings({pinned: !state.settings.pinned})},
    {label: 'Click through transparent area', type: 'checkbox', checked: s.preciseHitTest, click: () => updateSettings({preciseHitTest: !state.settings.preciseHitTest})},
    {label: 'Pass through all clicks', type: 'checkbox', checked: state.passThrough, click: () => setPassThrough(!state.passThrough)},
    {label: 'Quiet mode', type: 'checkbox', checked: s.quiet, click: () => updateSettings({quiet: !state.settings.quiet})},
    {type: 'separator'},
    {label: 'Settings…', click: () => openSettings()},
    {label: 'Inspector…', click: () => openInspector()},
    ...(s.developerTools && state.devUnlocked ? [{label: 'Developer', submenu: devMenu()}] : []),
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
    {label: 'Inspector…', click: () => openInspector()},
    {label: 'Mode', submenu: modeMenu()},
    {label: 'Session', submenu: sessionMenu()},
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
function chatSize() { const b = state.settings.chatBounds; return b ? {width: b.width, height: b.height} : {width: 340, height: 440}; }
function rememberChatBounds(win) {
  clearTimeout(state.chatBoundsTimer);
  state.chatBoundsTimer = setTimeout(() => {
    if (!alive(win)) return;
    const b = win.getBounds();
    state.settings.chatBounds = ws.sanitizeSettings({chatBounds: b}).chatBounds;
    scheduleSave();
  }, 300);
}
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
  // User-moved or resized panel geometry is remembered; "Snap to Dexter" clears it.
  win.on('moved', () => rememberChatBounds(win));
  win.on('resized', () => rememberChatBounds(win));
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
  const saved = state.settings.chatBounds;
  win.setBounds(saved ? ws.recoverBounds(saved, workAreas()) : ws.panelBeside(pet, {width: size.width, height: size.height}, area));
  sendPet('dexter:bubble', {kind: 'hide'});
  if (semantic.current !== 'summoning') semantic.enter('summoning', 'conversation opened');
  const reveal = () => { win.show(); win.focus(); events.record('window', 'chat-shown', {}); };
  if (win.webContents.isLoading()) win.webContents.once('did-finish-load', reveal); else reveal();
  return win;
}
function snapChat() {
  state.settings.chatBounds = null; scheduleSave();
  if (alive(state.chatWin)) {
    const pet = state.win.getBounds();
    state.chatWin.setBounds(ws.panelBeside(pet, {width: 340, height: 440}, screen.getDisplayMatching(pet).workArea));
  }
  return true;
}
// Inspector (adapted from Westcat_Familiar's Dexter Inspect / StackStatus panels):
// on demand only, real data only, destroyed on close.
function openInspector() {
  if (!alive(state.inspectorWin)) {
    const win = new BrowserWindow({width: 620, height: 640, minWidth: 460, minHeight: 400, show: false, title: 'Dexter Inspector',
      backgroundColor: '#11191c', autoHideMenuBar: true, fullscreenable: false,
      webPreferences: {...SECURE_PREFS, preload: path.join(ROOT, 'preload-ui.cjs')}});
    lockNavigation(win, 'dexter://app/ui/inspector.html');
    win.on('closed', () => { state.inspectorWin = null; });
    win.loadURL('dexter://app/ui/inspector.html').catch(() => {});
    win.once('ready-to-show', () => { win.show(); win.focus(); });
    state.inspectorWin = win;
  } else { state.inspectorWin.show(); state.inspectorWin.focus(); }
  events.record('window', 'inspector-shown', {});
  return state.inspectorWin;
}
// Detached speech bubble (adapted from WestCat_Overlay_MacOS's separate bubble
// window): optional; draggable; position remembered; never takes focus.
function ensureBubbleWindow() {
  if (alive(state.bubbleWin)) return state.bubbleWin;
  const pet = state.win.getBounds();
  const size = {width: 300, height: 140};
  const saved = state.settings.bubbleBounds;
  const at = saved ? ws.recoverBounds({...saved, ...size}, workAreas()) : ws.panelBeside(pet, size, screen.getDisplayMatching(pet).workArea);
  const win = new BrowserWindow({...size, x: at.x, y: at.y, show: false, frame: false, transparent: true, hasShadow: false, resizable: false,
    focusable: false, skipTaskbar: true, minimizable: false, maximizable: false, fullscreenable: false, backgroundColor: '#00000000', title: 'Dexter says',
    webPreferences: {...SECURE_PREFS, preload: path.join(ROOT, 'preload-ui.cjs')}});
  lockNavigation(win, 'dexter://app/ui/bubble.html');
  win.setAlwaysOnTop(state.settings.alwaysOnTop, 'floating');
  win.on('moved', () => { const b = win.getBounds(); state.settings.bubbleBounds = {x: b.x, y: b.y}; scheduleSave(); });
  win.on('closed', () => { if (state.bubbleWin === win) state.bubbleWin = null; });
  win.loadURL('dexter://app/ui/bubble.html').catch(() => {});
  state.bubbleWin = win;
  return win;
}
function snapBubbleWindow() {
  if (!alive(state.bubbleWin) || !alive(state.win)) return;
  const pet = state.win.getBounds();
  const size = state.bubbleWin.getBounds();
  const at = ws.panelBeside(pet, {width: size.width, height: size.height}, screen.getDisplayNearestPoint({x: pet.x + Math.floor(pet.width / 2), y: pet.y + Math.floor(pet.height / 2)}).workArea);
  state.bubbleWin.setBounds({x: at.x, y: at.y, width: size.width, height: size.height});
  state.settings.bubbleBounds = {x: at.x, y: at.y};
  scheduleSave();
}
function resetBubbleWindow() {
  state.settings.bubbleBounds = null;
  snapBubbleWindow();
}

function armRoaming() {
  clearTimeout(state.roamTimer); state.roamTimer = null;
  const s = eff();
  if (s.pinned || !s.roamingEnabled) return;
  const delay = Math.round((90 + Math.random() * 90) * 1000);
  state.roamTimer = setTimeout(tryRoam, delay);
}
function tryRoam() {
  state.roamTimer = null;
  const s = eff();
  if (s.pinned || !s.roamingEnabled) return;
  if (s.quiet || s.motion === 'reduced') { armRoaming(); return; }
  if (state.moving || state.napping || state.bubbleOpen) { armRoaming(); return; }
  if (alive(state.chatWin) && state.chatWin.isVisible()) { armRoaming(); return; }
  if (alive(state.settingsWin) && state.settingsWin.isVisible()) { armRoaming(); return; }
  if (!alive(state.win) || !state.win.isVisible()) { armRoaming(); return; }
  if (Date.now() - (state.lastUserDragTime || 0) < 60000) { armRoaming(); return; }
  const current = state.win.getBounds();
  const dx = Math.round((Math.random() * 50) - 25);
  const dy = Math.round((Math.random() * 24) - 12);
  if (Math.abs(dx) < 6 && Math.abs(dy) < 6) { armRoaming(); return; }
  const display = screen.getDisplayNearestPoint({x: current.x + Math.floor(current.width / 2), y: current.y + Math.floor(current.height / 2)}).workArea;
  const target = {x: current.x + dx, y: current.y + dy};
  const clamped = ws.clampPosition(target, display, current, {allowHeadroomBleed: true});
  if (dx !== 0) {
    const nextFlipped = dx < 0;
    if (state.settings.flipped !== nextFlipped) {
      state.settings.flipped = nextFlipped;
      sendPet('dexter:prefs', {flipped: nextFlipped});
      scheduleSave();
    }
  }
  state.win.setPosition(clamped.x, clamped.y);
  rememberPosition();
  armRoaming();
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
  const detached = state.settings.bubbleMode === 'window' && (payload.kind === 'say' || payload.kind === 'reply' || payload.kind === 'checkin');
  if (detached) {
    const win = ensureBubbleWindow();
    const send = () => { win.webContents.send('bubble:show', payload); win.showInactive(); };
    if (win.webContents.isLoading()) win.webContents.once('did-finish-load', send); else send();
    return;
  }
  state.bubbleOpen = payload.kind !== 'hide';
  let flipBubble = false;
  if (alive(state.win)) {
    const bounds = state.win.getBounds();
    const display = screen.getDisplayNearestPoint({x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2}).workArea;
    flipBubble = (bounds.y - display.y) < (ws.headroomHeight(bounds) + 36);
  }
  sendPet('dexter:bubble', {...payload, flipBubble});
}
// Optional native notification for things Dexter could not show because he is hidden.
function notify(title, body, onClick) {
  if (!state.settings.nativeNotifications || !Notification.isSupported()) return false;
  try {
    const n = new Notification({title, body: String(body).slice(0, 200), silent: true});
    if (onClick) n.on('click', onClick);
    n.show();
    events.record('app', 'notification', {});
    return true;
  } catch { return false; }
}
function gag(name) {
  if (!['sneeze', 'hop', 'shake', 'drop'].includes(name)) return;
  sendPet('dexter:gag', name);
  events.record('interaction', 'gag-' + name, {});
}
// Rare ambient trick, budgeted like any other unprompted behavior.
function armGags() {
  clearTimeout(state.gagTimer); state.gagTimer = null;
  if (!eff().gags) return;
  state.gagTimer = setTimeout(() => {
    state.gagTimer = null;
    const decision = attention.evaluateProactive({kind: 'event', settings: eff(), state: petBusyState(), budget});
    if (decision.allow) { budget.record(Date.now()); gag(Math.random() < 0.6 ? 'sneeze' : 'shake'); }
    armGags();
  }, (35 + Math.random() * 40) * 60000);
}
function speakOut(text, kind) {
  const s = state.settings;
  if (!s.ttsEnabled || !text) return;
  if (kind === 'remark' && !eff().ttsSpeakRemarks) return;
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
  const decision = force ? {allow: true, reason: 'User-requested.'} : attention.evaluateProactive({kind: 'event', settings: eff(), state: petBusyState(), budget});
  events.record('state', 'event-' + kind, {allowed: decision.allow, reason: decision.reason});
  if (!decision.allow) return false;
  if (!force) budget.record(Date.now());
  signal(line.state, 60, 2400, line.line);
  speakOut(line.line, 'remark');
  return true;
}
// During an active, unpaused work session, check-ins follow the session cadence.
function checkinSettings() {
  const snap = workSession.snapshot();
  const base = eff();
  return snap.active && !snap.paused ? {...base, checkinsEnabled: true, checkinMinutes: state.settings.sessionCheckinMinutes} : base;
}
function armCheckins() {
  clearTimeout(state.checkinTimer); state.checkinTimer = null;
  const s = checkinSettings();
  const delay = workSession.snapshot().active && s.checkinsEnabled
    ? Math.max(60000, s.checkinMinutes * 60000) : attention.nextCheckinDelay({settings: s, lastAt: state.lastCheckinAt});
  if (delay === null) return;
  state.checkinTimer = setTimeout(runCheckin, delay);
}
function runCheckin({force = false} = {}) {
  state.checkinTimer = null;
  const decision = force ? {allow: true, reason: 'Requested from Settings.'} : attention.evaluateProactive({kind: 'checkin', settings: checkinSettings(), state: petBusyState(), budget});
  events.record('checkin', decision.allow ? 'shown' : 'deferred', {reason: decision.reason});
  if (!decision.allow && decision.reason === 'Dexter is hidden.' && notify('Dexter has a question', 'Open Dexter to answer.', () => { restore(); runCheckin({force: true}); })) {
    if (!force) budget.record(Date.now());
    state.lastCheckinAt = Date.now(); armCheckins();
    return {shown: false, reason: 'Sent as a notification while hidden.'};
  }
  if (!decision.allow) {
    // Retry once later rather than polling; a fresh schedule follows either way.
    if (checkinSettings().checkinsEnabled) state.checkinTimer = setTimeout(runCheckin, 10 * 60000);
    return {shown: false, reason: decision.reason};
  }
  if (!force) budget.record(Date.now());
  const poolSettings = {...state.settings, libraryPool: questionsStore ? questionsStore.list({enabledOnly: true}) : null};
  const checkin = picker.next(poolSettings, state.lastCheckinId);
  state.activeCheckin = checkin; state.lastCheckinId = checkin.id; state.lastCheckinAt = Date.now();
  if (alive(state.win) && !state.win.isVisible() && force) restore();
  semantic.enter('alert', 'check-in', {force: true});
  showBubble({kind: 'checkin', ...checkins.publicView(checkin), timeoutMs: 60000});
  speakOut(checkin.text, 'remark');
  armCheckins();
  return {shown: true, reason: decision.reason};
}
function answerCheckin(id, path) {
  const active = state.activeCheckin;
  if (!active || active.id !== id) return;
  const choice = checkins.resolve(active, path);
  if (!choice) return;
  events.record('checkin', 'answered', {id, step: path.length});
  journal?.append('checkin', {id, question: path.length > 1 ? 'follow-up' : active.text, answer: choice.label});
  // Follow-up question (adapted from west_cat_overlay's follow_ups).
  if (choice.followUp) { showBubble({kind: 'checkin', ...checkins.publicView(active, path), timeoutMs: 60000}); return; }
  state.activeCheckin = null;
  showBubble({kind: 'say', text: choice.reply, timeoutMs: 4500});
  signal(choice.state, 70, 2600, '');
  speakOut(choice.reply, 'remark');
  if (choice.action === 'reduce') {
    const options = ws.CHECKIN_MINUTES;
    const next = options.find(m => m > state.settings.checkinMinutes);
    updateSettings(next ? {checkinMinutes: next} : {checkinsEnabled: false});
  }
}

// ---------------------------------------------------------------- work sessions
function sessionSay(key) {
  const line = sessions.LINES[key];
  showBubble({kind: 'say', text: line, timeoutMs: 4000});
  if (!(alive(state.win) && state.win.isVisible())) notify('Dexter', line, restore);
  speakOut(line, 'remark');
  journal?.append('session', {event: key, minutes: workSession.snapshot().minutes || 0});
  events.record('state', 'session-' + key, {});
  refreshMenus(); sendUi('inspector:changed', {});
}
function armSession() {
  clearTimeout(state.sessionTimer); state.sessionTimer = null;
  const snap = workSession.snapshot();
  if (!snap.active || snap.paused) return;
  const half = snap.minutes * 30000;
  const target = state.sessionMilestone ? snap.minutes * 60000 : half;
  state.sessionTimer = setTimeout(() => {
    const m = workSession.milestone(state.sessionMilestone);
    if (m) { state.sessionMilestone = m; sessionSay(m); semantic.enter(m === 'end' ? 'alert' : 'watching', 'session ' + m, {force: true}); }
    if (m === 'end') { workSession.stop(); state.sessionMilestone = null; armCheckins(); return; }
    armSession();
  }, Math.max(1000, target - snap.elapsedMs + 50));
}
function startSession(minutes) {
  const r = workSession.start(Number(minutes) || state.settings.sessionMinutes);
  if (!r.ok) return r;
  state.sessionMilestone = null; sessionSay('start'); armSession(); armCheckins();
  return {ok: true, session: workSession.snapshot()};
}
function pauseSession() { const r = workSession.pause(); if (r.ok) { clearTimeout(state.sessionTimer); sessionSay('pause'); armCheckins(); } return r; }
function resumeSession() { const r = workSession.resume(); if (r.ok) { sessionSay('resume'); armSession(); armCheckins(); } return r; }
function stopSession() { const r = workSession.stop(); if (r.ok) { clearTimeout(state.sessionTimer); state.sessionMilestone = null; sessionSay('stop'); armCheckins(); } return r; }

// ---------------------------------------------------------------- global hotkey (opt-in)
// Registers one fixed key combination with macOS. It does not observe any other keys.
function toggleChatFromHotkey() {
  if (alive(state.chatWin) && state.chatWin.isVisible() && state.chatWin.isFocused()) { state.chatWin.close(); return; }
  if (!(alive(state.win) && state.win.isVisible())) restore();
  openChat();
}
function applyHotkey() {
  globalShortcut.unregisterAll();
  const key = state.settings.globalHotkey;
  if (!key) { state.hotkeyStatus = 'off'; return; }
  let ok = false;
  try { ok = globalShortcut.register(key, toggleChatFromHotkey); } catch { ok = false; }
  state.hotkeyStatus = ok ? 'registered: ' + key : 'unavailable (another app uses ' + key + ')';
  events.record('app', ok ? 'hotkey-registered' : 'hotkey-failed', {});
}

// ---------------------------------------------------------------- conversation
function setAiStatus(status, detail = '') {
  state.aiStatus = status; state.aiDetail = detail;
  sendUi('chat:status', {status, detail, enabled: state.settings.aiEnabled});
}
function chatSnapshot() {
  return {messages: conversation.list(), status: state.aiStatus, detail: state.aiDetail, enabled: state.settings.aiEnabled,
    remembering: state.settings.rememberConversation, commands: COMMANDS, compact: state.settings.chatCompact,
    stt: state.settings.sttEnabled, canRetry: Boolean(state.lastUserText)};
}
function pushChat(event) { if (alive(state.chatWin)) state.chatWin.webContents.send('chat:event', event); }
function deliverReply(text) {
  if (!text) return;
  const decision = attention.evaluateProactive({kind: 'reply', settings: eff(), state: petBusyState()});
  if (!decision.allow && decision.reason === 'Dexter is hidden.') notify('Dexter replied', text, () => { restore(); openChat(); });
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
const COMMANDS = Object.freeze({...persona.COMMANDS,
  '/mode': 'Show or set the mode (plain, work, build, crisis, dex, quiet).',
  '/session': 'start [25|50|90|120], pause, resume or stop a work session.',
  '/time': 'Time left in the session.',
  '/checkin': 'Ask me a check-in now.',
  '/ask': 'Add a check-in: /ask Question | Answer | Answer',
  '/remember': 'Save a note for later (yours, stored locally).',
  '/notes': 'List saved notes.',
  '/forget-notes': 'Delete all saved notes.',
  '/packet': 'Export a context packet of this conversation.',
  '/retry': 'Send your last message again.',
  '/compact': 'Toggle the compact panel.',
  '/sneeze': 'A trick.', '/hop': 'Another trick.', '/demo': 'A short demonstration.',
  '/inspect': 'Open the inspector.'
});
function commandHelp() { return 'Commands, since you asked: ' + Object.entries(COMMANDS).map(([k, v]) => k + ' — ' + v).join(' '); }
function statusLine() {
  const snap = workSession.snapshot();
  return 'State: ' + state.familiarState + ' (' + semantic.current + ')' + (state.napping ? ', napping' : '') + '. Mode: ' + modes.modeInfo(state.settings.mode).label +
    '. Local AI: ' + state.aiStatus + '. Speech: ' + (state.settings.ttsEnabled ? state.settings.ttsEngine : 'off') +
    '. Check-ins: ' + (checkinSettings().checkinsEnabled ? 'every ' + checkinSettings().checkinMinutes + ' min' : 'off') +
    '. Session: ' + (snap.active ? sessions.formatRemaining(snap.remainingMs) + ' left' + (snap.paused ? ' (paused)' : '') : 'none') + '.';
}
async function runCommand(text, command, args) {
  switch (command) {
    case '/help': return localTurn(text, commandHelp());
    case '/treat': return localTurn(text, 'Very well. One treat.', ['treat']);
    case '/huff': return localTurn(text, 'Hff. Formally lodged.', ['huff']);
    case '/nap': return localTurn(text, state.napping ? 'Awake. Reluctantly.' : 'I am not available for consultation.', ['nap']);
    case '/quiet': updateSettings({quiet: !state.settings.quiet}); return localTurn(text, state.settings.quiet ? 'Silence. A reasonable policy.' : 'Complaints may resume.');
    case '/status': return localTurn(text, statusLine());
    case '/clear': conversation.clear(); pushChat({type: 'reset', snapshot: chatSnapshot()}); return null;
    case '/mode': {
      const wanted = args.trim().toLowerCase();
      if (!wanted) return localTurn(text, 'Mode: ' + modes.modeInfo(state.settings.mode).label + '. ' + modes.modeInfo(state.settings.mode).tagline);
      if (!modes.MODES[wanted]) return localTurn(text, 'Modes: ' + Object.keys(modes.MODES).join(', ') + '. Pick one.');
      updateSettings({mode: wanted});
      return localTurn(text, modes.MODES[wanted].label + ' mode. ' + modes.MODES[wanted].tagline);
    }
    case '/session': {
      const [verb, n] = args.trim().toLowerCase().split(/\s+/);
      const r = verb === 'pause' ? pauseSession() : verb === 'resume' ? resumeSession() : verb === 'stop' || verb === 'end' ? stopSession()
        : startSession(ws.SESSION_MINUTES.includes(Number(n)) ? Number(n) : state.settings.sessionMinutes);
      return localTurn(text, r.ok ? statusLine() : 'That does not apply right now.');
    }
    case '/time': { const snap = workSession.snapshot(); return localTurn(text, snap.active ? sessions.formatRemaining(snap.remainingMs) + ' left.' : 'No session is running.'); }
    case '/checkin': { const r = runCheckin({force: true}); return localTurn(text, r.shown ? 'Look at me.' : 'Not now: ' + r.reason); }
    case '/ask': {
      const q = checkins.parseQuickAsk(args);
      if (!q) return localTurn(text, 'Format: /ask Question | Answer | Answer (two to four answers).');
      const list = state.settings.customCheckins.concat([q]);
      if (list.length > ws.MAX_CUSTOM_CHECKINS) return localTurn(text, 'I already have ' + ws.MAX_CUSTOM_CHECKINS + ' of your questions. Remove some in Settings.');
      updateSettings({customCheckins: list});
      return localTurn(text, 'Added. I will ask it eventually. Edit replies in Settings.');
    }
    case '/remember': { const note = notes.add(args); return localTurn(text, note ? 'Noted. Stored on this computer only.' + (state.settings.notesInContext ? '' : ' Turn on "Use my notes in AI context" for the model to see it.') : 'Remember what. Write it after /remember.'); }
    case '/notes': { const list = notes.list(); return localTurn(text, list.length ? list.map((n, i) => (i + 1) + '. ' + n.text).join('  ') : 'No notes.'); }
    case '/forget-notes': notes.clear(); return localTurn(text, 'Forgotten. Deliberately.');
    case '/packet': { const r = await exportPacket(); return localTurn(text, r.saved ? 'Packet saved as ' + r.name + '.' : 'Packet not saved.'); }
    case '/retry': return retryLast();
    case '/compact': updateSettings({chatCompact: !state.settings.chatCompact}); pushChat({type: 'compact', compact: state.settings.chatCompact}); return null;
    case '/sneeze': gag('sneeze'); return localTurn(text, 'That did not happen.');
    case '/hop': gag('hop'); return localTurn(text, 'Once. Do not ask again.');
    case '/demo': demo.play(); return localTurn(text, 'Very well. Watch me, not this panel.');
    case '/inspect': openInspector(); return localTurn(text, 'Inspector opened. Try not to stare.');
    default: return localTurn(text, 'I do not know ' + command.slice(0, 24) + '. Try /help.');
  }
}
function retryLast() {
  const last = state.lastUserText;
  if (!last) return localTurn(null, 'Nothing to retry.');
  return chatSend(last, {retry: true});
}
async function exportPacket(target) {
  const block = notes.cross(state.settings.notesInContext, 'packet');
  const packet = packets.buildPacket({mode: state.settings.mode, semanticState: semantic.current, visualState: state.familiarState,
    session: workSession.snapshot(), messages: conversation.list(), notesBlock: block, version: app.getVersion()});
  let file = target;
  if (!file) {
    const r = await dialog.showSaveDialog(state.chatWin || undefined, {title: 'Export context packet',
      defaultPath: path.join(app.getPath('downloads'), 'dexter-packet-' + new Date().toISOString().slice(0, 10) + '.md'),
      filters: [{name: 'Markdown', extensions: ['md']}, {name: 'JSON', extensions: ['json']}]});
    if (r.canceled || !r.filePath) return {saved: false};
    file = r.filePath;
  }
  fs.writeFileSync(file, file.endsWith('.json') ? JSON.stringify(packet, null, 2) : packets.packetMarkdown(packet), {mode: 0o600});
  events.record('app', 'packet-exported', {notes: Boolean(block)});
  return {saved: true, name: path.basename(file)};
}
async function chatSend(raw, {retry = false} = {}) {
  const text = typeof raw === 'string' ? raw.slice(0, 4000).trim() : '';
  if (!text) return {ok: false};
  events.record('interaction', 'chat-send', {chars: text.length});
  const decision = router.route(text, {aiEnabled: state.settings.aiEnabled});
  events.record('ai', 'route-' + decision.path, {reason: decision.reason});
  pushChat({type: 'route', path: decision.path, reason: decision.reason});
  if (decision.path === 'command') { await runCommand(text, decision.command, decision.args || ''); return {ok: true}; }
  if (!retry) state.lastUserText = text;
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
  semantic.enter('thinking', 'model request', {force: true});
  let collected = '';
  // Continuity firewall: notes and project documents cross into the model request only when allowed.
  const block = notes.cross(state.settings.notesInContext, 'chat');
  const isEndpointRemote = !ws.isLoopback(state.settings.aiEndpoint);
  const docBlock = documents ? documents.cross({
    enabled: state.settings.useProjectMemory,
    isRemote: isEndpointRemote,
    allowRemote: state.settings.allowProjectMemoryRemote,
    query: text,
    purpose: 'chat'
  }) : null;

  let extraPrompt = '';
  if (block) extraPrompt += '\n\n' + block.text;
  if (docBlock) extraPrompt += '\n\n' + docBlock.text;

  const result = await ai.streamChat({
    messages: conversation.context(), systemPrompt: persona.SYSTEM_PROMPT + extraPrompt,
    onToken: token => { collected += token; pushChat({type: 'token', id: pending.id, text: token}); }
  });
  const finalText = result.text || collected;
  const status = result.status === 'done' ? 'complete' : result.status === 'truncated' ? 'truncated' : result.status === 'cancelled' ? 'cancelled' : 'error';
  const citations = docBlock ? docBlock.citations : [];
  conversation.update(pending.id, {content: finalText, status, citations});
  events.record('ai', 'reply-' + result.status, {chars: finalText.length});
  pushChat({type: 'done', id: pending.id, status, text: finalText, detail: result.detail || '', citations});
  if (result.status === 'done' || result.status === 'truncated') {
    setAiStatus('ready', result.model ? 'Connected · ' + result.model : 'Connected.');
    semantic.enter('watching', 'reply delivered', {force: true});
    deliverReply(finalText);
  } else if (result.status === 'cancelled') {
    setAiStatus('ready', 'Reply stopped.');
    semantic.enter('idle', 'reply cancelled', {force: true});
  } else {
    const kind = result.status === 'offline' ? 'aiOffline' : 'aiError';
    setAiStatus(result.status === 'offline' ? 'offline' : result.status === 'disabled' ? 'off' : 'error', result.detail || '');
    const line = persona.eventLine(kind);
    semantic.enter('blocked', kind, {force: true});
    pushChat({type: 'message', message: conversation.add('dexter', line.line + (result.detail ? ' (' + result.detail + ')' : ''), 'error')});
  }
  conversation.save();
  return {ok: true, status: result.status};
}

// ---------------------------------------------------------------- diagnostics
function cspOk() {
  const pages = ['index.html', 'ui/chat.html', 'ui/settings.html', 'ui/inspector.html', 'ui/bubble.html'];
  try { return pages.every(p => /connect-src 'none'/.test(fs.readFileSync(path.join(ROOT, p), 'utf8'))); } catch { return false; }
}
function snapshot() {
  const windows = [['pet', state.win], ['chat', state.chatWin], ['settings', state.settingsWin], ['inspector', state.inspectorWin], ['bubble', state.bubbleWin]].filter(([, w]) => alive(w)).map(([name, w]) => {
    const p = w.webContents.getLastWebPreferences?.() || {};
    return {name, sandbox: p.sandbox === true, contextIsolation: p.contextIsolation === true, nodeIntegration: p.nodeIntegration === true};
  });
  let memoryMB = 0, cpuPercent = 0;
  for (const m of app.getAppMetrics()) { memoryMB += (m.memory?.workingSetSize || 0) / 1024; cpuPercent += m.cpu?.percentCPUUsage || 0; }
  const endpoint = ws.validateEndpoint(state.settings.aiEndpoint, {allowRemote: true});
  const bounds = alive(state.win) ? state.win.getBounds() : null;
  const channels = ['dexter:hit', 'dexter:move', 'dexter:drag-end', 'dexter:menu', 'dexter:status', 'dexter:checkin-answer', 'dexter:bubble-dismissed', 'dexter:open-chat', 'dexter:speech-state', 'dexter:dev', 'dexter:dev-unlock', 'dexter:dev-lock'];
  return {
    now: Date.now(), settings: {...state.settings}, windows, cspConnectNone: cspOk(), egressCount: state.egressCount, egressWhileDisabled: state.egressWhileDisabled,
    trayAlive: Boolean(state.tray && !state.tray.isDestroyed()), passThrough: state.passThrough,
    petOnScreen: Boolean(bounds && workAreas().some(a => ws.intersects(bounds, a))),
    historyFileExists: fs.existsSync(state.historyPath), settingsWritable: state.settingsWritable,
    maxIpcListeners: Math.max(...channels.map(c => ipcMain.listenerCount(c))), eventListeners: events.listenerCount,
    memoryMB, cpuPercent, uptimeSeconds: (Date.now() - state.startedAt) / 1000, displayCount: screen.getAllDisplays().length,
    familiarState: state.familiarState, visible: alive(state.win) && state.win.isVisible(),
    aiStatus: state.aiStatus, ttsStatus: state.ttsStatus, endpointLoopback: endpoint.loopback !== false,
    documentsStats: documents ? documents.stats() : null,
    ttsCacheStats: ttsCache ? ttsCache.stats() : null,
    conversationSize: conversation.size, eventCounts: events.summary(), recentEvents: events.recent(40),
    app: {name: app.getName(), version: app.getVersion(), packaged: app.isPackaged},
    platform: {os: process.platform, arch: process.arch, release: os.release(), electron: process.versions.electron, chrome: process.versions.chrome}
  };
}
function inspectorSnapshot() {
  const profile = attention.profileFor(eff().intensity);
  const decisions = events.recent(200).filter(e => e.type === 'checkin' || e.name.startsWith('event-') || e.name.startsWith('route-')).slice(-15);
  return {
    at: Date.now(),
    familiar: {visual: state.familiarState, semantic: semantic.current, napping: state.napping, history: semantic.history().slice(-12), tier: 'verified'},
    mode: {id: state.settings.mode, ...modes.modeInfo(state.settings.mode), overlay: undefined, tier: 'configured'},
    attention: {used: budget.used(Date.now()), cap: profile.hourlyCap, minGapMinutes: Math.round(profile.minGapMs / 60000), decisions, tier: 'inferred'},
    session: {...workSession.snapshot(), tier: 'verified'},
    services: {ai: state.aiStatus + (state.aiDetail ? ' — ' + state.aiDetail : ''), tts: state.ttsStatus, stt: state.sttStatus, hotkey: state.hotkeyStatus,
      notifications: state.settings.nativeNotifications ? (Notification.isSupported() ? 'on' : 'unsupported') : 'off', tier: 'verified'},
    memory: {notes: notes.size, crossings: notes.crossings, notesInContext: state.settings.notesInContext,
      documents: documents ? documents.size : 0, docCrossings: documents ? documents.crossings : 0, useProjectMemory: state.settings.useProjectMemory,
      conversation: conversation.size, tier: 'verified'},
    journal: state.settings.keepJournal ? journal.read().slice(-20) : null,
    audit: diagnostics.runSelfAudit(snapshot())
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
  const allowed = which === 'settings' ? [state.settingsWin] : which === 'chat' ? [state.chatWin] : which === 'inspector' ? [state.inspectorWin]
    : which === 'bubble' ? [state.bubbleWin] : [state.settingsWin, state.chatWin, state.inspectorWin];
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
    if (!fromPet(event) || !answer || typeof answer.id !== 'string' || !Array.isArray(answer.path)) return;
    answerCheckin(answer.id, answer.path.slice(0, 5));
  });
  // Five quick nose pokes unlock developer mode when enabled in settings.
  ipcMain.on('dexter:dev', event => {
    if (fromPet(event) && state.settings.developerTools && state.devUnlocked) {
      devMenu().popup({window: state.win});
    }
  });
  ipcMain.on('dexter:dev-unlock', event => {
    if (fromPet(event) && state.settings.developerTools) {
      state.devUnlocked = true;
      refreshMenus();
      devMenu().popup({window: state.win});
    }
  });
  ipcMain.on('dexter:dev-lock', event => {
    if (fromPet(event)) {
      state.devUnlocked = false;
      refreshMenus();
    }
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
    const shouldCache = ttsCache && ttsCache.shouldCacheSource(state.currentSpeechKind || 'reply', state.settings);
    const cached = shouldCache ? ttsCache.get(text, {model: state.settings.piperModel, rate: state.settings.ttsRate, volume: state.settings.ttsVolume}) : null;
    if (cached) { events.record('tts', 'cache-hit', {}); return new Uint8Array(cached); }
    const wav = await piper.synthesize(text, state.settings);
    if (shouldCache) { try { ttsCache.put(text, {model: state.settings.piperModel, rate: state.settings.ttsRate, volume: state.settings.ttsVolume}, wav); } catch {} }
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
  handle('chat:retry', 'chat', () => retryLast());
  handle('chat:packet', 'chat', () => exportPacket());
  handle('chat:compact', 'chat', on => { updateSettings({chatCompact: on === true}); return state.settings.chatCompact; });
  handle('chat:snap', 'chat', () => snapChat());
  handle('inspector:snapshot', 'inspector', () => inspectorSnapshot());
  handle('inspector:open', 'any', () => { openInspector(); return true; });
  handle('journal:read', 'any', () => (state.settings.keepJournal ? journal.read() : []));
  handle('journal:clear', 'any', () => { journal.clear(); return true; });
  handle('notes:add', 'settings', text => notes.add(text));
  handle('notes:remove', 'settings', id => notes.remove(String(id)));
  handle('notes:clear', 'settings', () => { notes.clear(); return true; });
  handle('session:start', 'any', minutes => startSession(minutes));
  handle('session:pause', 'any', () => pauseSession());
  handle('session:resume', 'any', () => resumeSession());
  handle('session:stop', 'any', () => stopSession());
  handle('demo:play', 'any', () => demo.play());
  handle('piper:voices', 'settings', () => listVoices(state.settings.piperVoicesDir));
  handle('tts:cache-clear', 'settings', () => { ttsCache.clear(); return ttsCache.stats(); });
  handle('tts:cache-stats', 'settings', () => ttsCache.stats());
  handle('tts:cache-entries', 'settings', () => ttsCache.entries());
  handle('tts:cache-remove', 'settings', key => ttsCache.remove(key));
  handle('piper:probe', 'settings', async () => {
    const cli = await piper.probePiper(state.settings.piperPath);
    const model = piper.probeVoiceModel(state.settings.piperModel);
    return {cli, model};
  });
  handle('kokoro:check', 'settings', () => kokoro.getReport());
  handle('dexdictate:check', 'settings', () => dexdictate.checkDexDictate());
  handle('dev:unlock', 'any', () => {
    if (state.settings.developerTools) {
      state.devUnlocked = true;
      refreshMenus();
      return {unlocked: true};
    }
    return {unlocked: false};
  });
  handle('dev:lock', 'any', () => {
    state.devUnlocked = false;
    refreshMenus();
    return {unlocked: false};
  });
  handle('bubble:answer', 'bubble', payload => {
    if (payload && payload.id && Array.isArray(payload.path)) {
      answerCheckin(payload.id, payload.path);
      return true;
    }
    return false;
  });
  handle('bubble:snap', 'bubble', () => { snapBubbleWindow(); return true; });
  handle('bubble:reset', 'bubble', () => { resetBubbleWindow(); return true; });

  // Documents store IPC
  handle('docs:list', 'settings', () => (documents ? documents.list() : []));
  handle('docs:import', 'settings', async () => {
    const res = await dialog.showOpenDialog(state.settingsWin || undefined, {
      title: 'Import project document',
      properties: ['openFile'],
      filters: [{name: 'Markdown & Text', extensions: ['md', 'markdown', 'txt']}]
    });
    if (res.canceled || !res.filePaths.length) return {imported: false};
    try {
      const meta = documents.importFile(res.filePaths[0]);
      return {imported: true, document: meta};
    } catch (e) {
      return {imported: false, error: e.message};
    }
  });
  handle('docs:import-text', 'settings', payload => {
    if (!payload || !payload.name || typeof payload.content !== 'string') return {imported: false, error: 'Invalid payload'};
    try {
      const meta = documents.importText(payload.name, payload.content);
      return {imported: true, document: meta};
    } catch (e) {
      return {imported: false, error: e.message};
    }
  });
  handle('docs:toggle', 'settings', payload => (documents ? documents.toggle(payload.id, payload.enabled) : false));
  handle('docs:delete', 'settings', payload => (documents ? documents.remove(payload.id) : false));
  handle('docs:clear', 'settings', () => { if (documents) documents.clear(); return true; });
  handle('docs:preview', 'settings', payload => (documents ? documents.get(payload.id) : null));

  // Questions library IPC
  handle('questions:list', 'settings', payload => (questionsStore ? questionsStore.list(payload) : []));
  handle('questions:save', 'settings', payload => {
    try {
      const saved = questionsStore.saveQuestion(payload);
      return {ok: true, question: saved};
    } catch (e) {
      return {ok: false, error: e.message};
    }
  });
  handle('questions:delete', 'settings', payload => (questionsStore ? questionsStore.deleteQuestion(payload.id) : false));
  handle('questions:toggle-category', 'settings', payload => (questionsStore ? questionsStore.setCategoryEnabled(payload.category, payload.enabled) : false));
  handle('questions:export', 'settings', async () => {
    if (!questionsStore) return {saved: false};
    const jsonStr = questionsStore.exportJson();
    const res = await dialog.showSaveDialog(state.settingsWin || undefined, {
      title: 'Export questions library',
      defaultPath: path.join(app.getPath('downloads'), 'dexter-questions.json'),
      filters: [{name: 'JSON', extensions: ['json']}]
    });
    if (res.canceled || !res.filePath) return {saved: false};
    fs.writeFileSync(res.filePath, jsonStr, {mode: 0o600});
    return {saved: true, filePath: res.filePath};
  });
  handle('questions:import', 'settings', async () => {
    const res = await dialog.showOpenDialog(state.settingsWin || undefined, {
      title: 'Import questions library',
      properties: ['openFile'],
      filters: [{name: 'JSON', extensions: ['json']}]
    });
    if (res.canceled || !res.filePaths.length) return {imported: 0};
    try {
      const content = fs.readFileSync(res.filePaths[0], 'utf8');
      const count = questionsStore.importJson(content);
      return {imported: count};
    } catch (e) {
      return {imported: 0, error: e.message};
    }
  });

  handle('dialog:pick-file', 'settings', async payload => {
    const res = await dialog.showOpenDialog(state.settingsWin || undefined, {
      properties: ['openFile'],
      filters: payload?.filters
    });
    return res.canceled ? null : res.filePaths[0];
  });
  handle('dialog:pick-dir', 'settings', async () => {
    const res = await dialog.showOpenDialog(state.settingsWin || undefined, {
      properties: ['openDirectory']
    });
    return res.canceled ? null : res.filePaths[0];
  });

  handle('stt:check', 'settings', () => checkWhisper(state.settings));
  // Microphone: asked for only when the user presses the record button with speech input enabled.
  handle('stt:prepare', 'chat', async () => {
    if (!state.settings.sttEnabled) return {ok: false, detail: 'Speech input is off in Settings.'};
    const checked = checkWhisper(state.settings);
    if (!checked.ok) return {ok: false, detail: checked.problems[0]};
    if (PLATFORM_MAC && systemPreferences.getMediaAccessStatus('microphone') !== 'granted') {
      const granted = await systemPreferences.askForMediaAccess('microphone').catch(() => false);
      if (!granted) return {ok: false, detail: 'macOS microphone access was not granted.'};
    }
    return {ok: true};
  });
  handle('stt:transcribe', 'chat', async bytes => {
    if (!state.settings.sttEnabled) throw new Error('Speech input is off.');
    state.sttStatus = 'transcribing';
    try {
      const text = await whisper.transcribe(bytes instanceof Uint8Array ? bytes : new Uint8Array(0), state.settings);
      state.sttStatus = 'ready'; events.record('interaction', 'stt-transcribed', {chars: text.length});
      return {ok: true, text};
    } catch (error) { state.sttStatus = 'error: ' + error.message.slice(0, 60); return {ok: false, detail: error.message}; }
  });
  handle('stt:cancel', 'chat', () => { whisper.cancel(); return true; });
  handle('bubble:dismiss', 'bubble', () => { state.bubbleWin?.hide(); return true; });
  handle('bubble:open-chat', 'bubble', () => { state.bubbleWin?.hide(); openChat(); return true; });
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
const TOP_FILES = new Set(['index.html', 'app.js', 'styles.css', 'overlay.css', 'renderer.js', 'hit-test.js', 'speech-queue.js', 'audio-wav.js', 'manifest.webmanifest']);
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
  // Every permission is refused, except microphone audio for the conversation
  // panel while the user has enabled speech input. Never camera, never screen.
  const micAllowed = (wc, permission, details) => permission === 'media' && state.settings?.sttEnabled === true &&
    alive(state.chatWin) && wc === state.chatWin.webContents &&
    (details?.mediaTypes ? details.mediaTypes.length > 0 && details.mediaTypes.every(t => t === 'audio') : details?.mediaType === 'audio');
  ses.setPermissionRequestHandler((wc, permission, callback, details) => callback(micAllowed(wc, permission, details)));
  ses.setPermissionCheckHandler((wc, permission, _origin, details) => micAllowed(wc, permission, details));
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
  armGags();
  applyHotkey();
  // Optionally greet with the last remembered reply.
  if (state.settings.showLastReplyOnStart && state.settings.rememberConversation) {
    const last = conversation.list().filter(m => m.role === 'assistant' && m.content).pop();
    if (last) state.win.webContents.once('did-finish-load', () => setTimeout(() => showBubble({kind: 'reply', text: last.content.slice(0, 180), more: last.content.length > 180, timeoutMs: 8000}), 800));
  }
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
  if (SMOKE_TEST) require('./smoke.cjs').run({app, state, events, petMenu, trayMenu, devMenu, openChat, openSettings, openInspector, updateSettings, restore, snapshot, exportReport, exportPacket, runCheckin, onDisplaysChanged,
    conversation: () => conversation, showBubble, semantic, workSession, startSession, pauseSession, resumeSession, stopSession, notes: () => notes, journal: () => journal, demo, inspectorSnapshot, chatSend});
});
app.on('window-all-closed', () => { if (!PLATFORM_MAC) app.quit(); });
app.on('before-quit', () => {
  state.quitting = true;
  clearTimeout(state.saveTimer); clearTimeout(state.checkinTimer); clearTimeout(state.displayTimer);
  clearTimeout(state.sessionTimer); clearTimeout(state.gagTimer); clearTimeout(state.chatBoundsTimer);
  ai.cancel(); piper.cancel(); whisper.cancel(); demo.stop(); semantic.dispose();
  try { globalShortcut.unregisterAll(); } catch {}
  if (state.settings) { rememberPosition(); save(); conversation.save(); }
});
