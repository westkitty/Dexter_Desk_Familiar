'use strict';
// Work sessions (adapted from west_cat_overlay/tracker.py start/pause/stop and
// cadence). Pure state with an injected clock; main.cjs owns the timers.
function createSession({clock = () => Date.now()} = {}) {
  let s = null; // {minutes, startedAt, pausedAt, pausedMs}
  const elapsed = () => !s ? 0 : ((s.pausedAt ?? clock()) - s.startedAt - s.pausedMs);
  function start(minutes) {
    if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 240) return {ok: false, reason: 'invalid length'};
    s = {minutes, startedAt: clock(), pausedAt: null, pausedMs: 0};
    return {ok: true};
  }
  function pause() { if (!s || s.pausedAt !== null) return {ok: false}; s.pausedAt = clock(); return {ok: true}; }
  function resume() { if (!s || s.pausedAt === null) return {ok: false}; s.pausedMs += clock() - s.pausedAt; s.pausedAt = null; return {ok: true}; }
  function stop() { if (!s) return {ok: false}; const summary = snapshot(); s = null; return {ok: true, summary}; }
  function snapshot() {
    if (!s) return {active: false};
    const total = s.minutes * 60000, used = Math.min(total, Math.max(0, elapsed()));
    return {active: true, paused: s.pausedAt !== null, minutes: s.minutes, elapsedMs: used, remainingMs: total - used, done: used >= total};
  }
  // Milestones Dexter remarks on: halfway and the end.
  function milestone(lastNotified) {
    const snap = snapshot();
    if (!snap.active || snap.paused) return null;
    const half = snap.minutes * 30000;
    if (snap.done && lastNotified !== 'end') return 'end';
    if (snap.elapsedMs >= half && !lastNotified) return 'half';
    return null;
  }
  return {start, pause, resume, stop, snapshot, milestone};
}
const LINES = Object.freeze({
  start: 'Session started. I will be watching. As usual.',
  half: 'Halfway. Do not get comfortable.',
  end: 'Time. Stop, stand up, and admit what you finished.',
  pause: 'Paused. The clock respects you more than I do.',
  resume: 'Resumed. Finally.',
  stop: 'Session ended. Noted, without ceremony.'
});
function formatRemaining(ms) {
  const m = Math.max(0, Math.round(ms / 60000));
  return m >= 60 ? Math.floor(m / 60) + ' h ' + (m % 60) + ' min' : m + ' min';
}
module.exports = {createSession, LINES, formatRemaining};
