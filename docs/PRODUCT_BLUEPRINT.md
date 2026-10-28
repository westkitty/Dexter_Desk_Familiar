# Dexter Desk Familiar — Product Blueprint

## Core promise
A small pixel Dexter shares a bounded browser habitat with the user. He is recognizable, expressive, reactive only to signals this page can truly observe, and capable of life between interactions. The **familiar is the product**, not a mascot on a productivity dashboard.

## Experience laws
1. **Dexter first:** the stage dominates the screen. Primary controls occupy less than 20% of the viewport at normal desktop heights.
2. **Character truth:** black floppy ears, warm tan eyebrow and cheek marks, cream blaze/ruff/paws, black coat, curled cream-tip tail, heavy-lidded eyes and persistent scowl.
3. **Motion means state:** pose, breath, posture, wander and huff correspond to explicit state, not arbitrary particles.
4. **Attention is scarce:** no auto-opening panels, flashing, unsolicited sounds, or intrusive notifications.
5. **Honest sensing:** the web app sees only this page. Never claim knowledge of unrelated browser tabs, global typing, active apps or OS idleness.
6. **Genuinely local:** no account, tracker, backend, third-party CDN or model; offline app shell; no captured text in storage.
7. **Low-cost runtime:** no framework or build chain, small raster art, minimal DOM updates, throttled timers and motion reduction.
8. **Delight is optional:** sounds muted; reactions offer a quiet mode.
9. **Independent authority:** only \`westkitty/Dexter_Desk_Familiar\` is writable for this project.

## v0.1
A standalone PWA with three supplied-reference-derived pixel poses, 9 named states, a priority/TTL signal bus, 4 direct interactions, temporary in-window typing lab, simulated desk clutter, 24-hour local mood influence, draggable sprite, preference settings, keyboard/touch support, local WebAudio, offline cache, zero third-party calls.

## Next passes
### v0.2 — Pixel character polish
- Hand-finish a true 64/96-pixel authored sprite atlas: blink, scowl, huff, sit, stand, walk, eat, curl, stretch, sleep, wake.
- Validate each against the supplied reference sheet at 1x and 3x scale. No animal-archetype drift.
- Add subtle one-shot effects and transitions without exceeding the mobile power budget.
### v0.3 — Desk personality
- Local voluntary focus session; Dexter observes time inside the page, not external work.
- Several deterministic micro-routines with interrupted/returning behavior.
- Temperament threshold controls and calm/quiet defaults.
### v0.4 — Optional integration experiments (separate consent)
- Research a *separate* extension for tab counts only, not URLs/content; explicit permission and uninstall instructions.
- Research a *separate* native shell for a transparent always-on-top window and desktop-wide idle reaction.
- Neither integration is necessary for the offline web version; they cannot be silently added.

## Non-goals
Not an AI chatbot, task manager, note store, keylogger, browser extension, global telemetry collector, native macOS app, WESTCAT rewrite, or Starsilk experience.

## Acceptance
Every state reachable by a local trigger or deterministic time, coherent sprite identity at working size, quiet mode respected, keyboard and touch actions work, no input text persisted, actual offline repeat load, no outbound application requests beyond browser-managed own-origin updates, PWA install tested on supported browsers, layout intact at phone/desktop sizes.
