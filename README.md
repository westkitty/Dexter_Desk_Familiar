# Dexter Desk Familiar

A small, opinionated, privacy-first browser familiar starring **Dexter**. Three reference-derived pixel poses and a semantic behavior engine. He is present first; the UI stays secondary.

**Status:** v0.3.1 live PWA preview, tested with staged source and browser verification, not a native desktop overlay. This repository is a **new, separate project** and does not contain copied code from the Westcat projects.

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

Run `npm run check` to verify the allowlisted public bundle. Only the contents of `dist/` may be deployed via the main-only GitHub Pages workflow. `docs/PAGES_DEPLOYMENT.md` documents setup and the public-source deployment boundary. Cloud Chromium smoke tests are kept out of the runtime bundle, and may be run with `npx playwright test` after installing the test tooling. An installation, offline, Safari and final character-likeness release gate still remain.

Focused Dexter supports Left/Right arrow keys to reposition in 5% increments and Home to re-center; pointer drag is also supported. The typing desk erases text when closed or when the page is left.

## v0.3: Reused systems, not imported runtimes

The main pixel Dexter stays the reference-derived 96px three-pose familiar.
Settings offers an **off-by-default, session-only, explicitly unapproved** 32px atlas preview. It uses unmodified pixels from `westkitty/SNES_Dex/original/dexter_sprites.png`. Five authored rows support idle, walking, sniffing, barking, and an unimpressed reaction; eating and sleep still use the existing 96px art. Animation preview can be disabled at any time, and reduced motion holds the first frame.

A lightweight local presence observer distinguishes brief pointer approach, stationary dwell, and repeated deliberate taps **inside this page only**. No cursor tracking outside the habitat, telemetry, background service or persistent interaction history. An independent attention budget caps ambient routines at three per rolling hour, requires four minutes between them, and suppresses them while quiet, hidden, sleeping, in the typing desk or settings, or reduced motion.

The service worker retains the tested no-forced-activation, complete-cache-before-purge and app-scoped-cache protections from the newer `main`. The old uplift branch's service worker was **not** merged; useful behavior was reapplied on top of those protections.

See `docs/ATLAS_CANDIDATE.md` for pixel provenance and approval boundaries. These assets are not promoted to canonical art until the user has approved them.

## Public preview (2026-10-29)

**Live:** https://westkitty.github.io/Dexter_Desk_Familiar/

Pages was activated in GitHub Actions mode. The deployment workflow run 40846064963 succeeded from `main` at `ad6e2433597303a415e878d3e9e9bff661c523e9`. External HTTPS checks returned 200 for the site, app JavaScript, animation module, and opt-in candidate atlas; README and Operational State were 404 on the *hosted website*. The GitHub repository itself is now **public**, so source and project documentation are accessible on GitHub. Do not confuse exclusion from the hosted site with repo secrecy. Final visual canon approval, physical Safari and v1.0 release gates remain open.

## v0.3.1 — Dexter patrols and release proof

The scarce autonomous wandering state can now move Dexter a short distance out and back, without replacing a manually chosen position. Any direct interaction, viewport adjustment, backgrounding or reduced-motion preference interrupts the travel. No OS activity is observed.

The GitHub Pages workflow now verifies the publicly served release at the exact source commit by checking the release manifest, SHA-256 and byte count of every app file, and the exclusion of development documents from the website. The site remains https://westkitty.github.io/Dexter_Desk_Familiar/; the GitHub source repository is public. These checks do not replace native-device accessibility, final visual approval or v1.0 certification.

## Source-integrated 0.4.0-preview.1 — Owner-accepted cel-shaded animations

PR #8 merged `feat/approved-cel-shaded-20261031` into `main`, adding an **off-by-default, session-only** art mode in Settings. The existing 96px reference-derived pixel portraits remain the default; the optional 32px atlas remains a separate, not-canon-approved preview. These modes cannot render simultaneously.

The new mode includes the **eight exact, owner-accepted** transparent WebM clips: lie down, stretch, slow blink, head tilt, tail wag, treat/lick, sit down, and sleeping loop. The three clips previously held for review (treat_lick, sit_down, sleep_loop) were explicitly accepted by the owner on 2026-10-31. Approval is for the creative files, not a new visual-canon promotion or automatic authorization to deploy the public Pages site.

Select "Follow state" or inspect any one clip directly. The renderer enforces muted video, transparent-frame checks, static cel-shaded fallbacks when WebM alpha is unavailable, reduced-motion/quiet behavior, hidden-tab pause, and offline app-shell caching. All video URLs are same-origin and bundled. Neither animation mode records user text or accesses anything outside this page.

The eight-clip source reached `main` via PR #8. Current hosted Pages revision must be checked separately against its release manifest; a merge is not a live-deployment certificate. Native Safari, physical mobile accessibility, cross-version service-worker rollback, and long-session performance remain release gates. See docs/CEL_SHADED_ANIMATION.md.

## Native Dexter Desktop — isolated macOS alpha

The additional `desktop/` source in draft [PR #9](https://github.com/westkitty/Dexter_Desk_Familiar/pull/9) is a **separate macOS desktop edition** using the existing character engine, not a replacement for the browser/PWA edition. It supplies a transparent floating window, optional always-on-top and click-through controls, drag, local position/size/opacity, flip, context actions, tray recovery, native icon and approved animation playback.

A macOS arm64 app **built and launched successfully** in both Big Mac and GitHub-hosted macOS runtime tests; the original web build stayed green. The desktop ZIP is held locally on Big Mac for internal review. The app remains unsigned/unnotarized and uninstalled on the target MacBook; real user mouse passthrough, VoiceOver, long-soak and installation acceptance are open. No desktop OS sensing, network model connection or TTS was added. See `desktop/README.md` and `OPERATIONAL_STATE.md`.
