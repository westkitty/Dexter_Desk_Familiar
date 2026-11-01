'use strict';
// Modes (adapted from Westcat_Familiar/modeManager.ts: "mode changes behavior,
// never just chrome"). A mode overlays the user's settings without rewriting
// them; switching back to Plain restores exactly what the user configured.
const MODES = Object.freeze({
  plain: {label: 'Plain', tagline: 'Your settings, unmodified.', overlay: {}},
  work: {label: 'Work', tagline: 'Deep work guard. Interruptions suppressed.',
    overlay: {checkinsEnabled: false, eventReactions: false, intensity: 'reserved', gags: false}},
  build: {label: 'Build', tagline: 'Fast loops. Checks in if the loop stalls.',
    overlay: {checkinsEnabled: true, checkinMinutes: 30, intensity: 'standard'}},
  crisis: {label: 'Crisis', tagline: 'Everything is on fire. He checks in often.',
    overlay: {checkinsEnabled: true, checkinMinutes: 30, checkinQuietHours: false, intensity: 'attentive', gags: false}},
  dex: {label: 'Dex', tagline: 'Diagnostic lens. Speaks only when asked.',
    overlay: {quiet: true, checkinsEnabled: false, eventReactions: false, gags: false}},
  quiet: {label: 'Quiet', tagline: 'Present. Silent. Judging inwardly.',
    overlay: {quiet: true, checkinsEnabled: false, eventReactions: false, ttsSpeakRemarks: false, gags: false}}
});
function modeInfo(id) { return MODES[id] || MODES.plain; }
function effectiveSettings(settings) {
  return {...settings, ...modeInfo(settings && settings.mode).overlay};
}
module.exports = {MODES, modeInfo, effectiveSettings};
