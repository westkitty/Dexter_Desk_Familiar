'use strict';
// Attention arbitration for proactive (Dexter-initiated) desktop events.
// Adapted from Westcat_Familiar/attentionEngine.ts: a pure decision with an
// inspectable reason, an hourly budget and a cooldown. Direct user interaction
// never passes through here; only things Dexter would start on his own do.

const PROFILES = Object.freeze({
  reserved: Object.freeze({hourlyCap: 1, minGapMs: 20 * 60000, ambientHourlyCap: 1, ambientGapMs: 15 * 60000}),
  standard: Object.freeze({hourlyCap: 3, minGapMs: 8 * 60000, ambientHourlyCap: 3, ambientGapMs: 4 * 60000}),
  attentive: Object.freeze({hourlyCap: 6, minGapMs: 3 * 60000, ambientHourlyCap: 6, ambientGapMs: 2 * 60000})
});
function profileFor(intensity) { return PROFILES[intensity] || PROFILES.standard; }

function createBudget() {
  let entries = [];
  const prune = now => { entries = entries.filter(t => t <= now && now - t < 3600000); };
  return {
    used(now) { prune(now); return entries.length; },
    last() { return entries.length ? entries[entries.length - 1] : -Infinity; },
    record(now) { prune(now); entries.push(now); },
    reset() { entries = []; }
  };
}

function inQuietHours(date) {
  const hour = date instanceof Date ? date.getHours() : NaN;
  return Number.isInteger(hour) && (hour >= 22 || hour < 8);
}

// kind: 'checkin' | 'event' | 'reply'
// 'reply' notifies the user of an answer they asked for, so it ignores the
// budget, but still respects hidden/nap/quiet/visible-chat.
function evaluateProactive({kind, now = Date.now(), date = new Date(now), settings = {}, state = {}, budget}) {
  const deny = reason => ({allow: false, reason});
  if (state.hidden) return deny('Dexter is hidden.');
  if (state.passThrough) return deny('Clicks pass through; choices could not be answered.');
  if (state.dragging) return deny('Being moved. Interruptions would be rude.');
  if (kind === 'reply') {
    if (state.chatOpen) return deny('Conversation panel already shows the reply.');
    return {allow: true, reason: 'Reply the user requested.'};
  }
  if (settings.quiet) return deny('Quiet mode.');
  if (state.napping) return deny('Napping. He earns nothing by waking you.');
  if (state.chatOpen) return deny('Already in conversation.');
  if (state.bubbleOpen) return deny('A bubble is already showing.');
  if (kind === 'checkin') {
    if (!settings.checkinsEnabled) return deny('Check-ins are off.');
    if (settings.checkinQuietHours && inQuietHours(date)) return deny('Quiet hours (22:00–08:00).');
  }
  if (kind === 'event' && !settings.eventReactions) return deny('Event reactions are off.');
  const profile = profileFor(settings.intensity);
  if (budget) {
    if (budget.used(now) >= profile.hourlyCap) return deny('Hourly attention budget spent. Attention is earned, not farmed.');
    if (now - budget.last() < profile.minGapMs) return deny('Cooldown active.');
  }
  return {allow: true, reason: 'Within the ' + (settings.intensity || 'standard') + ' attention budget.'};
}

// Delay until the next check-in attempt. Uses a single timer, never polling.
function nextCheckinDelay({settings, now = Date.now(), lastAt = null, random = Math.random}) {
  if (!settings || !settings.checkinsEnabled) return null;
  const base = Math.max(30, Number(settings.checkinMinutes) || 60) * 60000;
  // +/-10% jitter so Dexter does not feel like an alarm clock.
  const jitter = (Number(random()) * 0.2 - 0.1) * base;
  const due = (Number.isFinite(lastAt) ? lastAt : now) + base + jitter;
  return Math.max(60000, Math.round(due - now));
}

module.exports = {PROFILES, profileFor, createBudget, inQuietHours, evaluateProactive, nextCheckinDelay};
