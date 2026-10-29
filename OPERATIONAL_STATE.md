# Operational State — Dexter Desk Familiar

Project ID: dexter-desk-familiar
Owner/allowed repository: westkitty/Dexter_Desk_Familiar
Created: 2026-10-28
Default branch: main

## Identity
Fresh standalone, privacy-first HTML/CSS/JS PWA. Only concepts may be adapted from Westcat repositories. Never change WESTCAT repos under this project's authority or swap the target to a different similarly named project.

## Baseline goals
- Pixel Dexter is the experience; control chrome <=20% of viewport on normal desktop sizes.
- Three reference-derived poses; black floppy ears, tan brows and cheeks, cream blaze/ruff/paws, curled tail and permanent scowl.
- Semantic state bus with priority and expiry, no hidden active-app/browser tab sensing.
- Locally cached offline shell, no third-party calls, no analytics, no text persistence.
- Sound default-off, quiet mode, reduced-motion support, keyboard and touch access.
- No framework, no external dependencies, no backend, no Starsilk.

## Implemented source target (v0.1)
Vanilla interactive PWA, local-only signals and preference storage, Node state tests, built-in static development server.

## Verification truth
At initialization: repository creation verified; source/asset check and Node/browser proof pending. Update this ledger with actual observed results; do not equate planned tests with executed tests.

## Protected invariants
Do not add global monitoring, network-based intelligence, host polling, extension permissions, history logging, background desktop access, monetization, analytics, AI theater, or an always-on-top claim without new explicit authority. Do not overwrite supplied visual identity with generic animal sprites.

## 2026-10-28 — Build branch checkpoint
- Project identity independently confirmed: private `westkitty/Dexter_Desk_Familiar`, main `60913278e40f2408ffcfe1848f7c8432ea448f42`.
- Implementation branch: `build/pwa-foundation-20261028`.
- Implemented-unverified: modular page-only key classification; deterministic low-priority ambient director; settings validation; renderer; opt-in audio; manual nap label alignment; service-worker cache update.
- Baseline already contained three 96px images. Source/user-approved visual fidelity at 1x/2x/3x is **unknown**. Seven-state 32px atlas and complete animation sheet remain **pending**.
- Node/real-browser/Safari/offline/release tests on the branch remain **unverified** pending execution; do not claim v1.0 readiness.
- No native overlay, public deployment, release tag, sibling-project changes, or external sensing authorized or performed.

## 2026-10-28/29 — Verified merges and deployment checkpoint

- User explicitly authorized merge/push, public GitHub Pages website activation, and continued web/PWA development. This supersedes the earlier prohibition on public hosting for this project only; **source repository privacy remains protected**.
- Verified merged PRs: #1 foundation, #2 audited Pages release harness, #3 keyboard parity plus real-browser smoke.
- Verified app commit: `d41e7dfdfeb7ddc0f38192cc3240249bfdd03594` on `main`. Source/build checks PASS: https://github.com/westkitty/Dexter_Desk_Familiar/actions/runs/40811822849
- Cloud Chromium runtime: 4/4 tests PASS at exact merge commit: https://github.com/westkitty/Dexter_Desk_Familiar/actions/runs/40811822859 (direct actions, nap, text privacy, keyboard/mobile, offline reload).
- `npm run build` produces only the audited `dist/` static assets (17 source items plus .nojekyll and integrity report). Browser-tested original art remains the provisional three-pose sprites, **not a visual/canonical release approval**.
- GitHub Pages status: **BLOCKED/NOT ACTIVE**. Workflow deployment failed at `actions/configure-pages` because the repository has no enabled Pages site (404): https://github.com/westkitty/Dexter_Desk_Familiar/actions/runs/40811823061. The necessary authenticated MacBook CLI mutation was prevented before execution by DEX//REACH resource scheduling; do not claim Pages setup happened. Next permitted step: activate the existing private repo Pages source as GitHub Actions via an authorized healthy account context, then rerun deployment and check HTTPS.
- Outstanding: final approved 96×96 and separate 32×32 Dexter animation atlas, Safari/manual touch/assistive technology tests, one-hour performance/long-session measurement, public site network proof, distribution ZIP/versioned release gate. Native overlay still NOT authorized.
- Protection: preserve local-only input observation and preferences-only storage, no monitoring outside window, no external runtime services, no cross-project writes, private source repository. Public GitHub Pages host will necessarily serve static assets over HTTPS.

## 2026-10-29 — Offline lifecycle repair branch

- Current implementation branch: `build/offline-lifecycle-20261029`, based on unmerged draft PR #4 head `a92a5580150fdc81e77a6d497da560bef09652a7`. Integration dependency: review/merge PR #4 before PR #5, without publishing or changing the repository's private visibility.
- Verified branch implementation: atomic worker precache, no forced `skipWaiting()` replacement of active windows, own-cache-only responses, a cache completeness check before old cache removal, and failure cleanup.
- Evidence: six real-script Node lifecycle tests passed locally after four original failures; GitHub Node/build PASS https://github.com/westkitty/Dexter_Desk_Familiar/actions/runs/40835443534; six Chromium journeys PASS https://github.com/westkitty/Dexter_Desk_Familiar/actions/runs/40835443533 at `12e0d8c7b7a5759c98f45386131401160498e6b0`.
- Implemented-but-unverified: real partial-upgrade browser replay across two service-worker revisions, crash/rollback handling in Safari, update prompt and controlled reload, PWA site publication.
- Known GitHub infrastructure limitation: optional failed-test artifact upload can fail with quota exceeded. Do not clear unrelated artifacts without independent evidence and authorization.
- Preserve: page-only sensing, transient typed text, privacy-first offline behavior, current working DOM/actions, no runtime dependencies, no native shell and no changes to sibling WESTCAT projects.
