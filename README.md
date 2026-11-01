# Dexter Desk Familiar

A small, opinionated, privacy-first browser familiar starring **Dexter**. Three reference-derived pixel poses and a semantic behavior engine. He is present first; the UI stays secondary.

**Status:** v0.3.1 live PWA preview, tested with staged source and browser verification. A separate macOS desktop edition (0.2.0-alpha.1) is described at the end of this file. This repository is a **new, separate project** and does not contain copied code from the Westcat projects.

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

A PWA cannot make itself an always-on-top transparent desktop companion or inspect other apps. The always-on-top companion is the separate, explicitly installed desktop edition (see below), which still does not inspect other apps.

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

## Dexter Desktop (macOS) — 0.2.0-alpha.1 on `main`; 0.3.0-alpha.1 in PR #12

A separate macOS desktop edition of Dexter lives in `desktop/`. He floats in a transparent window beside your work and runs the same behavior engine and approved art as the web edition, which it does not replace or modify. Version 0.2.0 was merged to `main` on 2026-11-01 through PRs #10 and #9. Version 0.3.0 (draft PR #12) adds the remaining WestCat features: modes, sessions, an inspector, notes, a check-in editor, push-to-talk, a shortcut, and more. All of them are optional.

**What it does:** transparent always-on-top window; only Dexter's visible pixels catch clicks; drag, scale, opacity and flip; a menu-bar icon with Show, Hide, Restore, Talk, Settings and Quit; recovery when a display changes; preferences that survive relaunch. Optional, and all off by default: a conversation panel with a local Ollama-compatible AI (loopback only unless you allow another host; nothing downloaded), on-device speech, and check-ins in Dexter's voice. A settings window includes diagnostics and a self-audit. There is no microphone and no keyboard, screen or activity monitoring.

### Download the current DMG

1. In this repository go to **Actions → Dexter desktop macOS alpha checks**, open the latest successful run on `main`, and download the `Dexter-Desktop-macOS-arm64-adhoc-DMG-main-*` artifact.
2. Current build: run [41282357890](https://github.com/westkitty/Dexter_Desk_Familiar/actions/runs/41282357890) on `main` @ `30821b7`, artifact `Dexter-Desktop-macOS-arm64-adhoc-DMG-main-122` (kept 90 days).
   - File: `Dexter_Desk_Familiar_0.2.0-alpha.1_macOS_arm64_adhoc.dmg`
   - SHA-256: `0b3332ce3a7142211d58f55d7811398bf478f5cec37bbd0116aa6aff35704031`
3. Verify with `shasum -a 256 -c Dexter_Desk_Familiar_0.2.0-alpha.1_macOS_arm64_adhoc.dmg.sha256`, open the DMG, drag the app to **Applications**, and eject.
4. The app is ad-hoc signed for integrity only. It is **not Developer ID signed and not notarized**, so macOS asks you to approve it once under **System Settings → Privacy & Security → Open Anyway**. Do not disable Gatekeeper.

CI checked this build on a macOS runner: deep strict signature checks, including every nested helper; a full app test of the packaged app and of the copy made from the DMG; quit and relaunch with restored preferences; and the SHA-256. On Linux, a syscall audit found no network traffic except to the test's own local model server.

**Still to verify on a real MacBook** (see `desktop/MACBOOK_QA.md`): clicking through the empty space around Dexter onto other apps, real dragging, keyboard focus while typing elsewhere, two monitors, VoiceOver, and a 60-minute run on an M1 Air.

More: `desktop/README.md` (usage, privacy, troubleshooting) · `desktop/ARCHITECTURE.md` · `docs/WESTCAT_PARITY_MATRIX.md` · `docs/DESKTOP_RELEASE_READINESS.md`.
