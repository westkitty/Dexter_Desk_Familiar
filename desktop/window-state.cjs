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
const TTS_ENGINES = Object.freeze(['system', 'piper']);
const TEXT_SIZES = Object.freeze(['small', 'medium', 'large']);
const ARTS = Object.freeze(['pixel', 'cel', 'atlas']);
const DEFAULT_ENDPOINT = 'http://127.0.0.1:11434';

const DEFAULTS = Object.freeze({
  // Appearance
  art: 'pixel', flipped: false, scale: 100, opacity: 1,
  // Window behavior
  alwaysOnTop: true, preciseHitTest: true, passiveFocus: true,
  showInDock: true, launchAtLogin: false, x: null, y: null,
  // Familiar behavior
  quiet: false, motion: 'system', sound: false, idleSeconds: 60, intensity: 'standard',
  // Speech output (optional, off)
  ttsEnabled: false, ttsEngine: 'system', ttsVolume: 0.8, ttsRate: 1, ttsVoice: '',
  ttsSpeakReplies: true, ttsSpeakRemarks: false, piperPath: '', piperModel: '',
  // Local AI (optional, off, explicit opt-in)
  aiEnabled: false, aiEndpoint: DEFAULT_ENDPOINT, aiAllowRemote: false, aiModel: '',
  aiTimeoutSeconds: 60, aiContextMessages: 12,
  // Conversation privacy
  rememberConversation: false,
  // Check-ins and reactions (optional, off)
  checkinsEnabled: false, checkinMinutes: 60, checkinQuietHours: true, eventReactions: true,
  // Accessibility
  bubbleTextSize: 'medium', highContrastBubble: false,
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
// non-HTTP schemes and paths: the endpoint is a base URL only.
function validateEndpoint(value, {allowRemote = false} = {}) {
  if (typeof value !== 'string' || value.length > 300) return {ok: false, reason: 'Endpoint must be a short URL.'};
  let url;
  try { url = new URL(value.trim()); } catch { return {ok: false, reason: 'Endpoint is not a valid URL.'}; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return {ok: false, reason: 'Only http and https endpoints are allowed.'};
  if (url.username || url.password) return {ok: false, reason: 'Credentials in the endpoint URL are not allowed.'};
  if (url.search || url.hash) return {ok: false, reason: 'Query strings and fragments are not allowed.'};
  if (url.pathname && url.pathname !== '/') return {ok: false, reason: 'Use the server base URL without a path.'};
  if (!url.hostname) return {ok: false, reason: 'Endpoint needs a host.'};
  const loopback = isLoopbackHost(url.hostname);
  if (!loopback && !allowRemote) return {ok: false, loopback, reason: 'Non-local endpoints require “Allow a non-local endpoint”.'};
  return {ok: true, loopback, url: url.origin};
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
    aiEnabled: bool(v.aiEnabled, d.aiEnabled),
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
    highContrastBubble: bool(v.highContrastBubble, d.highContrastBubble)
  };
  // Legacy compatibility for older readers and tests.
  s.size = Object.hasOwn(SIZES, v.size) ? v.size : d.size;
  // The endpoint is kept only when it passes the same policy used at connect time.
  if (typeof v.aiEndpoint === 'string') {
    const checked = validateEndpoint(v.aiEndpoint, {allowRemote: s.aiAllowRemote});
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
function clampPosition(position, bounds, windowSize) {
  return {
    x: Math.round(Math.max(bounds.x, Math.min(position.x, bounds.x + bounds.width - windowSize.width))),
    y: Math.round(Math.max(bounds.y, Math.min(position.y, bounds.y + bounds.height - windowSize.height)))
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
  return {...clampPosition(bounds, target, size), ...size};
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
  TEXT_SIZES, DEFAULT_ENDPOINT,
  sanitizeSettings, mergeSettings, validateEndpoint, isLoopbackHost,
  dimensions, petWindowSize, clampPosition, resizeAnchored, recoverBounds, intersects, panelBeside,
  shouldIgnoreMouse, isWithinRoot
};
