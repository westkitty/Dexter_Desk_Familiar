// Ephemeral, page-only interaction cadence. No logs, persistence, or telemetry.
const LINES = Object.freeze({
  eating: Object.freeze([
    "Very well. One treat.",
    "This is beginning to look like a negotiation.",
    "Bribery. Continue."
  ]),
  huffing: Object.freeze([
    "Hff. An official protest.",
    "My objection remains on record.",
    "Your appeal has been denied."
  ]),
  watching: Object.freeze([
    "Personal space is a concept.",
    "Yes. It is still me.",
    "This inspection is concluded."
  ])
});

const STANDARD_LINES = Object.freeze({
  eating: "Very well. One treat.",
  huffing: "Hff. An official protest.",
  watching: "Personal space is a concept."
});

export function createRemarks({windowMs = 12000} = {}) {
  const window = Number.isFinite(windowMs) && windowMs > 0 ? windowMs : 12000;
  let lastAction = null;
  let lastTime = -Infinity;
  let streak = 0;
  function choose(action, fallback, now = Date.now()) {
    const lines = LINES[action];
    if (!lines || !Number.isFinite(now) || fallback !== STANDARD_LINES[action]) return fallback;
    const continuing = action === lastAction && now >= lastTime && now - lastTime <= window;
    streak = continuing ? Math.min(streak + 1, lines.length) : 1;
    lastTime = now;
    lastAction = action;
    return lines[streak - 1];
  }
  function reset() {
    lastAction = null;
    lastTime = -Infinity;
    streak = 0;
  }
  return {choose, reset};
}
