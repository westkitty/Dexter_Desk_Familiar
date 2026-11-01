'use strict';
// Pure, testable desktop preference schema and window geometry.
// Every persisted value is re-validated on load: unknown keys are dropped and
// invalid values fall back to safe defaults, so a damaged settings file can
// never make Dexter invisible, unclickable or network-enabled.
const path = require('node:path');

const SIZES = Object.freeze({small: 200, medium: 260, large: 330});
const LEGACY_SIZE_SCALE = Object.freeze({small: 80, medium: 100, large: 130});
const BASE_WIDTH = 260;
// Extra headroom above Dexter for the speech bubble and check-in choices.
// Transparent headroom is click-through when precise hit testing is on.
const HEIGHT_RATIO = 1.42;
const SCALE = Object.freeze({min: 60, max: 200, step: 10});
const OPACITY = Object.freeze({min: 0.4, max: 1});
const INTENSITIES = Object.freeze(['reserved', 'standard', 'attentive']);
const MOTION = Object.freeze(['system', 'reduced', 'full']);
const IDLE_OPTIONS = Object.freeze([30, 60, 120, 300]);
const CHECKIN_MINUTES = Object.freeze([30, 60, 90, 120, 240]);
const TTS_ENGINES = Object.freeze(['system', 'piper', 'kokoro']);
const TEXT_SIZES = Object.freeze(['small', 'medium', 'large']);
const ARTS = Object.freeze(['pixel', 'cel', 'atlas']);
const DEFAULT_ENDPOINT = 'http://127.0.0.1:11434';
const MODES = Object.freeze(['plain', 'work', 'build', 'crisis', 'dex', 'quiet', 'chat']);
const CHECKIN_SOURCES = Object.freeze(['mixed', 'builtin', 'custom']);
const SESSION_MINUTES = Object.freeze([25, 50, 90, 120]);
const SESSION_CHECKIN_MINUTES = Object.freeze([10, 15, 25, 30]);
// Fixed choices only: a free-form accelerator could collide with system shortcuts.
const HOTKEYS = Object.freeze(['', 'CommandOrControl+Shift+K', 'CommandOrControl+Shift+D', 'Alt+Shift+D']);
const BUBBLE_MODES = Object.freeze(['pet', 'window']);
const MAX_CUSTOM_CHECKINS = 30;
const AI_PROVIDERS = Object.freeze(['ollama', 'openai_compatible', 'hermes_unverified']);
const SPEECH_INPUT_PROVIDERS = Object.freeze(['whisper', 'dexdictate']);
const CORNERS = Object.freeze(['none', 'bottom-right', 'bottom-left', 'top-right', 'top-left']);
const BUBBLE_DOCKS = Object.freeze(['auto', 'top', 'bottom', 'left', 'right']);

const DEFAULTS = Object.freeze({
  // Appearance
  art: 'pixel', flipped: false, scale: 100, opacity: 1,
  // Window behavior
  alwaysOnTop: true, preciseHitTest: true, passiveFocus: true,
  showInDock: true, launchAtLogin: false, x: null, y: null,
  pinned: true, roamingEnabled: false, preferredCorner: 'bottom-right',
  // Familiar behavior
  quiet: false, motion: 'system', sound: false, idleSeconds: 60, intensity: 'standard',
  // Speech output (optional, off)
  ttsEnabled: false, ttsEngine: 'system', ttsVolume: 0.8, ttsRate: 1, ttsVoice: '',
  ttsSpeakReplies: true, ttsSpeakRemarks: false, piperPath: '', piperModel: '',
  ttsCache: false, ttsCacheReplies: true, ttsCacheRemarks: true, ttsCacheCheckins: true, ttsCacheNeverSensitive: true,
  // Local AI (optional, off, explicit opt-in)
  aiEnabled: false, aiProvider: 'ollama', aiEndpoint: DEFAULT_ENDPOINT, aiAllowRemote: false, aiModel: '',
  aiTimeoutSeconds: 60, aiContextMessages: 12,
  // Conversation privacy
  rememberConversation: false,
  // Check-ins and reactions (optional, off)
  checkinsEnabled: false, checkinMinutes: 60, checkinQuietHours: true, eventReactions: true,
  // Accessibility
  bubbleTextSize: 'medium', highContrastBubble: false, bubbleDock: 'auto',
  // WestCat parity, round 2 (all optional; privacy-sensitive ones off)
  mode: 'plain', checkinSource: 'mixed', customCheckins: [], keepJournal: false,
  sessionMinutes: 50, sessionCheckinMinutes: 25,
  typewriter: true, typewriterCps: 45, gags: true, animationSpeed: 1, developerTools: false,
  chatCompact: false, chatBounds: null, bubbleMode: 'pet', bubbleBounds: null, showLastReplyOnStart: false,
  globalHotkey: '', piperVoicesDir: '',
  sttEnabled: false, speechInputProvider: 'whisper', whisperPath: '', whisperModel: '',
  notesInContext: false, useProjectMemory: false, allowProjectMemoryRemote: false,
  allSpaces: false, nativeNotifications: false,
  // Legacy (read for migration only)
  size: 'medium'
});

const bool = (value, fallback) => typeof value === 'boolean' ? value : fallback;
const oneOf = (value, list, fallback) => list.includes(value) ? value : fallback;
function numberIn(value, min, max, fallback, step) {
  // Out-of-range values are treated as invalid (default), never clamped:
  // a corrupted opacity of 0.01 must not become "barely visible".
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) return fallback;
  let next = value;
  if (step) next = Math.round(next / step) * step;
  return Math.round(next * 1000) / 1000;
}
function shortText(value, max, fallback = '') {
  if (typeof value !== 'string') return fallback;
  // eslint-disable-next-line no-control-regex
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return cleaned.length <= max ? cleaned : fallback;
}
function absolutePathOrEmpty(value) {
  const text = shortText(value, 1024);
  return text && path.isAbsolute(text) ? text : '';
}

function isLoopbackHost(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  return host === 'localhost' || host === '::1' || /^127(\.\d{1,3}){3}$/.test(host);
}
// Returns {ok, url, loopback, reason}. Rejects credentials, query strings,
// non-HTTP schemes and arbitrary paths. allowPath permits clean path prefixes (e.g. /v1) for OpenAI-compatible gateways.
function validateEndpoint(value, {allowRemote = false, allowPath = false} = {}) {
  if (typeof value !== 'string' || value.length > 300) return {ok: false, reason: 'Endpoint must be a short URL.'};
  let url;
  try { url = new URL(value.trim()); } catch { return {ok: false, reason: 'Endpoint is not a valid URL.'}; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return {ok: false, reason: 'Only http and https endpoints are allowed.'};
  if (url.username || url.password) return {ok: false, reason: 'Credentials in the endpoint URL are not allowed.'};
  if (url.search || url.hash) return {ok: false, reason: 'Query strings and fragments are not allowed.'};
  if (!url.hostname) return {ok: false, reason: 'Endpoint needs a host.'};
  const loopback = isLoopbackHost(url.hostname);
  if (!loopback && !allowRemote) return {ok: false, loopback, reason: 'Non-local endpoints require “Allow a non-local endpoint”.'};
  if (url.pathname && url.pathname !== '/') {
    if (!allowPath) return {ok: false, loopback, reason: 'Use the server base URL without a path.'};
    if (!/^\/[A-Za-z0-9_/.-]+$/.test(url.pathname) || url.pathname.includes('..')) {
      return {ok: false, loopback, reason: 'Endpoint path contains disallowed characters.'};
    }
    const cleanPath = url.pathname.replace(/\/+$/, '');
    return {ok: true, loopback, url: url.origin + cleanPath};
  }
  return {ok: true, loopback, url: url.origin};
}

function rect(value, withSize) {
  if (!value || typeof value !== 'object') return null;
  const ok = n => Number.isInteger(n) && Math.abs(n) < 100000;
  if (!ok(value.x) || !ok(value.y)) return null;
  if (!withSize) return {x: value.x, y: value.y};
  if (!ok(value.width) || !ok(value.height) || value.width < 200 || value.height < 200 || value.width > 2000 || value.height > 2000) return null;
  return {x: value.x, y: value.y, width: value.width, height: value.height};
}
// User-authored check-ins (adapted from WESTCAT-OVERLAY-RELOADED's question editor).
// Each: {id, text, choices:[{label, reply, state, followUp?:{text, choices:[{label, reply, state}]}}]}
const CHOICE_STATES = Object.freeze(['idle', 'watching', 'judging', 'huffing', 'resting']);
function sanitizeChoices(list, allowFollowUp) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, 4).map(c => {
    if (!c || typeof c !== 'object') return null;
    const label = shortText(c.label, 40), reply = shortText(c.reply, 200);
    if (!label || !reply) return null;
    const out = {label, reply, state: oneOf(c.state, CHOICE_STATES, 'watching')};
    if (allowFollowUp && c.followUp && typeof c.followUp === 'object') {
      const text = shortText(c.followUp.text, 160), choices = sanitizeChoices(c.followUp.choices, false);
      if (text && choices.length >= 2) out.followUp = {text, choices};
    }
    return out;
  }).filter(Boolean);
}
function sanitizeCustomCheckins(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  return list.slice(0, MAX_CUSTOM_CHECKINS).map(q => {
    if (!q || typeof q !== 'object') return null;
    const text = shortText(q.text, 160), choices = sanitizeChoices(q.choices, true);
    let id = typeof q.id === 'string' && /^c-[a-z0-9]{1,24}$/.test(q.id) ? q.id : null;
    if (!text || choices.length < 2) return null;
    if (!id || seen.has(id)) id = 'c-' + Math.random().toString(36).slice(2, 10);
    seen.add(id);
    return {id, text, choices};
  }).filter(Boolean);
}

function sanitizeSettings(candidate) {
  const v = candidate && typeof candidate === 'object' && !Array.isArray(candidate) ? candidate : {};
  const d = DEFAULTS;
  const legacyScale = Object.hasOwn(LEGACY_SIZE_SCALE, v.size) ? LEGACY_SIZE_SCALE[v.size] : d.scale;
  const s = {
    art: oneOf(v.art, ARTS, d.art),
    flipped: bool(v.flipped, d.flipped),
    scale: numberIn(v.scale, SCALE.min, SCALE.max, legacyScale, SCALE.step),
    opacity: numberIn(v.opacity, OPACITY.min, OPACITY.max, d.opacity, 0.05),
    alwaysOnTop: bool(v.alwaysOnTop, d.alwaysOnTop),
    preciseHitTest: bool(v.preciseHitTest, d.preciseHitTest),
    passiveFocus: bool(v.passiveFocus, d.passiveFocus),
    showInDock: bool(v.showInDock, d.showInDock),
    launchAtLogin: bool(v.launchAtLogin, d.launchAtLogin),
    x: Number.isInteger(v.x) && Math.abs(v.x) < 100000 ? v.x : null,
    y: Number.isInteger(v.y) && Math.abs(v.y) < 100000 ? v.y : null,
    pinned: bool(v.pinned, d.pinned),
    roamingEnabled: bool(v.roamingEnabled, d.roamingEnabled),
    preferredCorner: oneOf(v.preferredCorner, CORNERS, d.preferredCorner),
    quiet: bool(v.quiet, d.quiet),
    motion: oneOf(v.motion, MOTION, d.motion),
    sound: bool(v.sound, d.sound),
    idleSeconds: oneOf(v.idleSeconds, IDLE_OPTIONS, d.idleSeconds),
    intensity: oneOf(v.intensity, INTENSITIES, d.intensity),
    ttsEnabled: bool(v.ttsEnabled, d.ttsEnabled),
    ttsEngine: oneOf(v.ttsEngine, TTS_ENGINES, d.ttsEngine),
    ttsVolume: numberIn(v.ttsVolume, 0, 1, d.ttsVolume, 0.05),
    ttsRate: numberIn(v.ttsRate, 0.5, 2, d.ttsRate, 0.05),
    ttsVoice: shortText(v.ttsVoice, 120),
    ttsSpeakReplies: bool(v.ttsSpeakReplies, d.ttsSpeakReplies),
    ttsSpeakRemarks: bool(v.ttsSpeakRemarks, d.ttsSpeakRemarks),
    piperPath: absolutePathOrEmpty(v.piperPath),
    piperModel: absolutePathOrEmpty(v.piperModel),
    ttsCache: bool(v.ttsCache, d.ttsCache),
    ttsCacheReplies: bool(v.ttsCacheReplies, d.ttsCacheReplies),
    ttsCacheRemarks: bool(v.ttsCacheRemarks, d.ttsCacheRemarks),
    ttsCacheCheckins: bool(v.ttsCacheCheckins, d.ttsCacheCheckins),
    ttsCacheNeverSensitive: bool(v.ttsCacheNeverSensitive, d.ttsCacheNeverSensitive),
    aiEnabled: bool(v.aiEnabled, d.aiEnabled),
    aiProvider: oneOf(v.aiProvider, AI_PROVIDERS, d.aiProvider),
    aiAllowRemote: bool(v.aiAllowRemote, d.aiAllowRemote),
    aiEndpoint: d.aiEndpoint,
    aiModel: shortText(v.aiModel, 120),
    aiTimeoutSeconds: numberIn(v.aiTimeoutSeconds, 10, 300, d.aiTimeoutSeconds, 5),
    aiContextMessages: numberIn(v.aiContextMessages, 2, 40, d.aiContextMessages, 2),
    rememberConversation: bool(v.rememberConversation, d.rememberConversation),
    checkinsEnabled: bool(v.checkinsEnabled, d.checkinsEnabled),
    checkinMinutes: oneOf(v.checkinMinutes, CHECKIN_MINUTES, d.checkinMinutes),
    checkinQuietHours: bool(v.checkinQuietHours, d.checkinQuietHours),
    eventReactions: bool(v.eventReactions, d.eventReactions),
    bubbleTextSize: oneOf(v.bubbleTextSize, TEXT_SIZES, d.bubbleTextSize),
    highContrastBubble: bool(v.highContrastBubble, d.highContrastBubble),
    bubbleDock: oneOf(v.bubbleDock, BUBBLE_DOCKS, d.bubbleDock)
  };
  s.mode = oneOf(v.mode, MODES, d.mode);
  s.checkinSource = oneOf(v.checkinSource, CHECKIN_SOURCES, d.checkinSource);
  s.customCheckins = sanitizeCustomCheckins(v.customCheckins);
  s.keepJournal = bool(v.keepJournal, d.keepJournal);
  s.sessionMinutes = oneOf(v.sessionMinutes, SESSION_MINUTES, d.sessionMinutes);
  s.sessionCheckinMinutes = oneOf(v.sessionCheckinMinutes, SESSION_CHECKIN_MINUTES, d.sessionCheckinMinutes);
  s.typewriter = bool(v.typewriter, d.typewriter);
  s.typewriterCps = numberIn(v.typewriterCps, 15, 120, d.typewriterCps, 5);
  s.gags = bool(v.gags, d.gags);
  s.animationSpeed = numberIn(v.animationSpeed, 0.5, 2, d.animationSpeed, 0.25);
  s.developerTools = bool(v.developerTools, d.developerTools);
  s.chatCompact = bool(v.chatCompact, d.chatCompact);
  s.chatBounds = rect(v.chatBounds, true);
  s.bubbleMode = oneOf(v.bubbleMode, BUBBLE_MODES, d.bubbleMode);
  s.bubbleBounds = rect(v.bubbleBounds, false);
  s.showLastReplyOnStart = bool(v.showLastReplyOnStart, d.showLastReplyOnStart);
  s.globalHotkey = oneOf(v.globalHotkey, HOTKEYS, d.globalHotkey);
  s.piperVoicesDir = absolutePathOrEmpty(v.piperVoicesDir);
  s.sttEnabled = bool(v.sttEnabled, d.sttEnabled);
  s.speechInputProvider = oneOf(v.speechInputProvider, SPEECH_INPUT_PROVIDERS, d.speechInputProvider);
  s.whisperPath = absolutePathOrEmpty(v.whisperPath);
  s.whisperModel = absolutePathOrEmpty(v.whisperModel);
  s.notesInContext = bool(v.notesInContext, d.notesInContext);
  s.useProjectMemory = bool(v.useProjectMemory, d.useProjectMemory);
  s.allowProjectMemoryRemote = bool(v.allowProjectMemoryRemote, d.allowProjectMemoryRemote);
  s.allSpaces = bool(v.allSpaces, d.allSpaces);
  s.nativeNotifications = bool(v.nativeNotifications, d.nativeNotifications);
  // Legacy compatibility for older readers and tests.
  s.size = Object.hasOwn(SIZES, v.size) ? v.size : d.size;
  // The endpoint is kept only when it passes the same policy used at connect time.
  if (typeof v.aiEndpoint === 'string') {
    const allowPath = s.aiProvider === 'openai_compatible' || s.aiProvider === 'hermes_unverified' || v.aiEndpoint.includes('/v1');
    const checked = validateEndpoint(v.aiEndpoint, {allowRemote: s.aiAllowRemote, allowPath});
    if (checked.ok) s.aiEndpoint = checked.url;
  }
  return s;
}

// Apply an untrusted partial update from the settings UI. Only known keys are
// considered and the merged result is re-sanitized as a whole.
function mergeSettings(current, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return sanitizeSettings(current);
  const next = {...current};
  for (const key of Object.keys(DEFAULTS)) if (Object.hasOwn(patch, key)) next[key] = patch[key];
  if (Object.hasOwn(patch, 'scale')) delete next.size;
  // Programmatic geometry keys are owned by the main process, not the settings UI.
  for (const key of ['chatBounds', 'bubbleBounds']) if (Object.hasOwn(patch, key) && patch[key] !== null) next[key] = current[key];
  return sanitizeSettings(next);
}

function dimensions(size) {
  const width = SIZES[size] || SIZES.medium;
  return {width, height: Math.round(width * 1.16)};
}
function petWindowSize(scale) {
  const pct = numberIn(scale, SCALE.min, SCALE.max, 100, SCALE.step);
  const width = Math.round(BASE_WIDTH * pct / 100);
  return {width, height: Math.round(width * HEIGHT_RATIO)};
}
function headroomHeight(windowSize) {
  if (!windowSize || !windowSize.width || !windowSize.height) return 0;
  const artTopFromWindowBottom = windowSize.width * 0.92 * 0.92;
  const headYInWindow = windowSize.height - artTopFromWindowBottom;
  return Math.max(0, Math.round(headYInWindow + 38));
}
function visibleArtBounds(windowBounds) {
  if (!windowBounds) return null;
  const artSize = Math.min(windowBounds.width * 0.92, windowBounds.height * 0.92);
  return {
    x: Math.round(windowBounds.x + (windowBounds.width - artSize) / 2),
    y: Math.round(windowBounds.y + windowBounds.height - artSize),
    width: Math.round(artSize),
    height: Math.round(artSize)
  };
}
function clampPosition(position, bounds, windowSize, {allowHeadroomBleed = false} = {}) {
  const minY = allowHeadroomBleed ? bounds.y - headroomHeight(windowSize) : bounds.y;
  return {
    x: Math.round(Math.max(bounds.x, Math.min(position.x, bounds.x + bounds.width - windowSize.width))),
    y: Math.round(Math.max(minY, Math.min(position.y, bounds.y + bounds.height - windowSize.height)))
  };
}
// Keep Dexter's feet in place when the window is resized.
function resizeAnchored(bounds, size) {
  return {
    x: Math.round(bounds.x + (bounds.width - size.width) / 2),
    y: Math.round(bounds.y + bounds.height - size.height),
    width: size.width, height: size.height
  };
}
function intersects(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
// After a display is removed or its resolution changes, return bounds that are
// fully inside the work area of the display nearest to the window's centre.
function recoverBounds(bounds, workAreas) {
  const areas = (Array.isArray(workAreas) ? workAreas : []).filter(a => a && a.width > 0 && a.height > 0);
  if (!areas.length) return {...bounds};
  const cx = bounds.x + bounds.width / 2, cy = bounds.y + bounds.height / 2;
  const distance = a => {
    const dx = Math.max(a.x - cx, 0, cx - (a.x + a.width));
    const dy = Math.max(a.y - cy, 0, cy - (a.y + a.height));
    return dx * dx + dy * dy;
  };
  const target = areas.slice().sort((a, b) => distance(a) - distance(b))[0];
  const size = {width: Math.min(bounds.width, target.width), height: Math.min(bounds.height, target.height)};
  return {...clampPosition(bounds, target, size, {allowHeadroomBleed: true}), ...size};
}
// Place a companion panel beside Dexter without covering him.
function panelBeside(pet, panel, area, gap = 8) {
  const y = Math.round(pet.y + pet.height - panel.height);
  const left = {x: pet.x - panel.width - gap, y};
  const right = {x: pet.x + pet.width + gap, y};
  const fitsLeft = left.x >= area.x;
  const fitsRight = right.x + panel.width <= area.x + area.width;
  const chosen = fitsLeft || !fitsRight ? (fitsLeft ? left : right) : right;
  return {...clampPosition(chosen, area, panel), ...panel};
}
function shouldIgnoreMouse({passThrough = false, preciseHitTest = true, overPet = false} = {}) {
  return Boolean(passThrough || (preciseHitTest && !overPet));
}
function isWithinRoot(root, requested) {
  const relative = path.relative(root, requested);
  return relative === '' || (relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative));
}
module.exports = {
  SIZES, DEFAULTS, SCALE, OPACITY, INTENSITIES, MOTION, IDLE_OPTIONS, CHECKIN_MINUTES, TTS_ENGINES,
  TEXT_SIZES, DEFAULT_ENDPOINT, MODES, CHECKIN_SOURCES, SESSION_MINUTES, SESSION_CHECKIN_MINUTES, HOTKEYS, BUBBLE_MODES,
  AI_PROVIDERS, SPEECH_INPUT_PROVIDERS, CORNERS, BUBBLE_DOCKS,
  sanitizeCustomCheckins, MAX_CUSTOM_CHECKINS,
  sanitizeSettings, mergeSettings, validateEndpoint, isLoopbackHost,
  dimensions, petWindowSize, headroomHeight, visibleArtBounds, clampPosition, resizeAnchored, recoverBounds, intersects, panelBeside,
  shouldIgnoreMouse, isWithinRoot
};
