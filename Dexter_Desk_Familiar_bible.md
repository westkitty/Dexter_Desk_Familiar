# Dexter Desk Familiar — Project Bible

This additive ledger records significant implementation decisions. It does not override `OPERATIONAL_STATE.md` (current verified operations), `docs/PRODUCT_BLUEPRINT.md` (product purpose) or source/tests (behavioral truth).

## 2026-10-31 — Rare desk patrol and independently proven Pages delivery

### Repository and authority
- Allowed repository: `westkitty/Dexter_Desk_Familiar`, public at start; independent of all WESTCAT sibling projects.
- Start: `31e86db1b942517c7fbc57f2ddafc10ff81c9e3d` on `main`; isolated development branch `build/patrol-release-proof-20261031`.
- Authority: continue the existing uplift, preserve current character identity, privacy and working features; complete verified commit, push and Pages delivery.

### Frozen scope and decision
- Accepted: brief visual locomotion only when the existing low-frequency wandering state occurs, and exact live Pages content integrity checking.
- Rejected: replaying obsolete 2026-10-29 patch, replacing art, introducing external libraries, global monitoring or more decorative UI.
- Protected: only page-local sensing, no persisted input text, unchanged original 96px art, opt-in unapproved 32px candidate, accessible controls, reduced motion, quiet mode, browser offline PWA.

### Verified outcomes
- New tests: `tests/locomotion.test.mjs`, `tests/pages-verification.test.mjs`, expanded Playwright runtime test.
- Runtime code: `src/locomotion.mjs` with CSS-owned movement, interrupt and size bounds; service worker cache v5 and updated allowlists.
- Release: `scripts/verify-pages.mjs` exact commit/byte checks integrated after GitHub Pages deploy.
- Implementation merge commit: `b0242e3c060a068032f62ca6263f5209c79ad187`, PR #7.
- Node on exact code: 58/58 tests, release 2/2; cloud Chromium/WebKit 22/22 PASS.
- Pages: run 41186422183 SUCCESS, 23 file hashes and SHA `b0242e3c060a068032f62ca6263f5209c79ad187` independently verified.

### Deferred gates
- Physical Mac Safari/Android/assistive technology, long-session performance, full two-version PWA rollback, character art approval and v1.0 certification are not claimed complete.

### Continuity warning
- The source repository is currently public. Do not accidentally describe the repository as private or publish secrets. Historical private status is preserved only as historical evidence.

## 2026-10-31 — Approved cel-shaded motion set (distinct from default pixel canon)

- Owner explicitly approved the three originally held finished clips: treat_lick, sit_down, sleep_loop; five previously shortlisted clips are also accepted. This is a visual-asset acceptance for **eight exact encoded animations**, not a change to canonical 96px/32px character-art authority.
- Accepted named actions: lie down, stretch, slow blink, head tilt, tail wag, treat/lick, sit down, sleeping loop. Their SHA-256 locks are recorded in tests/cel-animation.test.mjs.
- Runtime route: opt-in, session-only cel-shaded mode; 96px pixel portraits remain default; independent opt-in 32px atlas cannot overlap. Original source pixels must not be rewritten, stretched or replaced.
- Behavior law: motion tied to explicit local semantic state; no outside-page sensing, no new persistent data, no third-party media fetches, no audio autoplay. When transparency is unsupported, display approved still artwork rather than an opaque matte.
- Approval does not waive real-browser, offline upgrade, accessible/reduced-motion, mobile/Safari and performance checks. Do not treat artistically approved sit-down end geometry as objectively identical to the 96px pixel pose.

## 2026-10-31 — PR #8 release verifier correction

- User expressly authorized merge and GitHub Pages deployment of the approved eight-clip cel-shaded mode. PR #8 merged into `main` at `e9eed54e4932f19c211199502c61c77fe2b1dbfa`.
- Initial Pages upload/deploy succeeded but the last public-byte verification rejected legitimate nested `.webm` paths: run `41214820461`. The verifier was out of sync with the release builder, not the clip artifacts.
- The bounded verifier correction maintains strict same-origin, filename, content-hash, total-size, and excluded-file checks while accepting approved nested media paths. Final public deployment truth must come from the hotfix run and independent HTTPS evidence, not from this planning record.

## 2026-10-31 — Independent native Dexter Desktop edition

### Accepted change of product scope
- User directed the browser Dexter to gain WESTCAT-like desktop-overlay functionality **without turning the original PWA into WESTCAT**. The existing web version is still an independently useful offline product. `docs/PRODUCT_BLUEPRINT.md` now reflects two independent editions.
- Target is only `westkitty/Dexter_Desk_Familiar`, draft PR #9 `feature/desktop-overlay-v1-20261031`. Do not modify the similarly named WESTCAT repositories or rely on them for runtime assets.
- Electron/Chromium native window host chosen over a speculative WKWebView shortcut for proven transparent WebM playback. Keep desktop-only files under `desktop/` and stage the original web behavior engine without editing shipped PWA files.

### Implemented desktop mechanism
- Native transparent frameless window, topmost preference, tray recovery, local position/size/opacity persistence, opt-in click-through control, draggable on-screen familiar, right-click actions, optional pixel/SNES/cel visual modes, quiet toggle and native app icon.
- `dexter://app` local protocol replaces initial file-fetch design after the first actual Electron launch failed. It serves approved local assets with MIME and video byte ranges, denies private source files and network routes, preserves strict page CSP and sandboxed preload IPC.
- Desktop staged copy disables the web habitat's in-scene drag handlers and instead routes native pointer gestures to existing Dexter reactions; actual web source remains byte-for-byte unmodified.
- Automated macOS arm64 package uses locked Electron 45.2.1 and @electron/packager 20.3.0, builds a `Dexter.icns` from the existing icon PNG, and runs a built-app smoke check in GitHub Actions.

### Evidence and remaining controls
- Big Mac macOS arm64 and GitHub macOS Actions independently passed packaging and actual Electron bundled startup smoke (Actions `41218157904` and `41218520502`). Big Mac observed 96px art, real poke/treat semantics, transparent cel video decoding, IPC movement of the native window, tray creation, correct local WebM range 206, private module request 403 and transparent capture-corner alpha.
- The original PWA source tests and Pages release checks remained green: 66 unit/lifecycle tests, 2 release tests, 36 allowed public files.
- **Not yet proven:** human mouse pass-through above other software, MacBook installation and login/quit recovery, multiple-monitor handling on actual hardware, accessibility/VoiceOver, long-session performance, app signing, notarization, and distribution to the target MacBook.
- Keep PR #9 draft until necessary release gates are verified. Do not merge merely because packaged smoke is green or imply that unsigned local binary is a public release.
