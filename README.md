# Dexter Desk Familiar

A small, opinionated, privacy-first browser familiar starring **Dexter**. Three reference-derived pixel poses and a semantic behavior engine. He is present first; the UI stays secondary.

**Status:** v0.2.x working browser/PWA foundation, not a native desktop overlay. This repository is a **new, separate project** and does not contain copied code from the Westcat projects.

## Run locally

Requires Node.js 20+ only. No package installation, bundler, account, network service, or external runtime dependency.

1. Clone this repository.
2. Run: \`npm start\`
3. Open \`http://127.0.0.1:4173\` in a browser.
4. Let it load once while online to populate the PWA cache, then test using browser offline mode.
5. Install through a supporting browser's Install / Add to Dock / Add to Home Screen option.

The app itself is static. \`index.html\` also opens for a quick visual preview, but PWA installation and service-worker caching require HTTPS or localhost.

## Interactions

- Click Dexter to earn disapproval; drag him left/right to reposition him for the current session.
- **Treat** provides an offering; **Huff** triggers a one-shot reaction.
- **Nap** holds sleep until waking or a direct interaction.
- **Desk** opens an ephemeral typing practice area. Only *keypress timing/counts within that input* influence behavior; the text is never serialized, logged or sent, and is cleared when the panel closes.
- **Settings** controls sound (off by default), quiet mode, motion, and idle threshold. A deliberately labeled imaginary tab pile demonstrates tab-overload behavior without inspecting real tabs.
- Keyboard: T=treat, H=huff, N=nap/wake, D=typing desk. Escape closes the desk input. Drag and pet controls support pointer and keyboard.

## Privacy boundary

**No analytics, network APIs, third-party dependencies, global input monitoring, or AI services.** Settings alone persist in localStorage; offline app assets reside in the browser's Cache Storage by necessity. Session counters, simulated tabs and transient behavior state live in memory. The app does not read the contents of your actual browser tabs or activity outside its own window. A browser may still check for service worker updates when it has connectivity.

A PWA cannot make itself an always-on-top transparent desktop companion or inspect other apps. Such features would require a distinct native/extension project with clear user permissions and separate review.

## Architecture

- \`src/behavior.mjs\`: deterministic state arbitration, priorities, TTLs and ambient state.
- \`app.js\`: page-only events, actions, view, WebAudio, ephemeral typing.
- \`styles.css\`: responsive desk stage, stateful animation, motion-reduction fallbacks.
- \`sw.js\`: cache-first same-origin offline shell; blocks external fetches under its control.
- \`assets/\`: small reference-derived pixel art of **this** Dexter (sitting, standing, resting).
- \`tests/\`: behavior tests using Node's built-in runner.

The source-derived sprite art is an adaptation of the reference images supplied by the project owner; no unrelated generic pet art is substituted.

## Validation

Run \`npm test\`. Service-worker and offline/installation behavior must additionally be checked in a real browser. Source inspection or a passed Node test does **not** prove browser installation or a zero-request network trace. See \`docs/ACCEPTANCE.md\`.

## Product evolution

See \`docs/PRODUCT_BLUEPRINT.md\` and \`docs/WESTCAT_LINEAGE.md\`. Keep the app independent of WESTCAT Familiar: borrow interaction *concepts*, never copy its code or transfer its project-specific DOM/CSS art restrictions.

## Web deployment and browser proof

Run `npm run check` to verify the allowlisted public bundle. Only the contents of `dist/` may be deployed via the main-only GitHub Pages workflow. `docs/PAGES_DEPLOYMENT.md` documents setup and the private-source boundary. Cloud Chromium smoke tests are kept out of the runtime bundle, and may be run with `npx playwright test` after installing the test tooling. An installation, offline, Safari and final character-likeness release gate still remain.

Focused Dexter supports Left/Right arrow keys to reposition in 5% increments and Home to re-center; pointer drag is also supported. The typing desk erases text when closed or when the page is left.
