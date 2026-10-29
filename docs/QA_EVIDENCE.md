# Dexter Desk Familiar — verified evidence ledger

Checked 2026-10-29 UTC. Repository: `westkitty/Dexter_Desk_Familiar` (private), branch: `main`.
Baseline before these changes: `60913278e40f2408ffcfe1848f7c8432ea448f42`.
Merged production-source commit: `d41e7dfdfeb7ddc0f38192cc3240249bfdd03594`.

## Observed PASS (exact commit)
- Foundation PR #1: https://github.com/westkitty/Dexter_Desk_Familiar/pull/1
- Pages build harness PR #2: https://github.com/westkitty/Dexter_Desk_Familiar/pull/2
- Accessibility & browser CI PR #3: https://github.com/westkitty/Dexter_Desk_Familiar/pull/3
- Node syntax + unit tests + distribution integrity/allowlist: https://github.com/westkitty/Dexter_Desk_Familiar/actions/runs/40811822849
- Cloud Chromium, four browser journeys (direct reactions, typed data isolation, keyboard/responsive layout, offline reload): https://github.com/westkitty/Dexter_Desk_Familiar/actions/runs/40811822859
- No offsite app requests were seen during the tested browser flows. This is not an exhaustive network/privacy audit across all browsers and modes.
- The release builder validates the exact 17 app source assets and keeps docs/tests/dev-server/GitHub workflow out of `dist/`.

## Observed BLOCKED
- GitHub Pages deployment https://github.com/westkitty/Dexter_Desk_Familiar/actions/runs/40811823061 failed on `Configure GitHub Pages` (repository Pages site not enabled / HTTP 404). Build and source validation passed before that failure. **No publicly reachable Pages site has been proven.**
- Authenticated local CLI execution was attempted but blocked before running due DEX//REACH MacBook resource admission. Source repo remained private; no alternate host chosen.

## Pending verification
- GitHub Pages one-time activation (GitHub Actions source), successful deploy and externally accessible HTTPS proof.
- Manual Safari and real touch/keyboard accessibility tests; reduced motion/quiet/sound and long-session telemetry-free performance checks.
- Dexter likeness approval for three current provisional sprites, a complete animation atlas and independently recognizable 32×32 sprites.
- Final signed-off web v1.0 release bundle and rollback verification.

## Scope preserved
No new runtime dependencies, third-party assets, personal input recording, extension permissions, native-overlay claim, public repository visibility change, or edits to WESTCAT projects.

## 2026-10-29 — Task 0 current-head reconciliation and PNG integrity regression

- **Baseline correction:** planning packet referenced main `60913278`, but authoritative main at task start was `2d91516bb67c824080b446e86a6a4d75abe02fa6` (version `0.2.2`). This baseline already contains merged PRs #1/#2/#3, cloud Chromium tests, and audited static bundle generation. Work was isolated to `build/png-integrity-20261029`; no WESTCAT repository was modified.
- **Previous CI passes:** Node/unit/release verification https://github.com/westkitty/Dexter_Desk_Familiar/actions/runs/40811995808 and Chromium smoke https://github.com/westkitty/Dexter_Desk_Familiar/actions/runs/40811995606 both completed successfully at `2d91516`. This does not establish Safari/manual acceptance or public Pages availability.
- **Observed defect (BRK-001):** `icons/icon-192.png` at `2d91516` contained an invalid PNG `IDAT` CRC and lacked a valid `IEND` chunk. Existing release checks validated signature and dimensions but not full PNG chunk integrity. The other four PNGs passed CRC and IEND checks.
- **RED proof:** `tests/png-integrity.test.mjs` wired into `npm test` at `ad23694c286b3ae8e0318e2b16a7114f26327ee7`; verification FAILED https://github.com/westkitty/Dexter_Desk_Familiar/actions/runs/40827241824. First candidate rejected on the same test: https://github.com/westkitty/Dexter_Desk_Familiar/actions/runs/40827342716.
- **GREEN proof:** 192-pixel PNG restored to independently verified good blob SHA `0543ddbf23a6f8fea23afef74ac7bc70cc2cf87d`; repaired commit `e68e296c9ad20d7cd51c67a35970a65b2fa828df` passed verification https://github.com/westkitty/Dexter_Desk_Familiar/actions/runs/40827430492. The automated suite now tests signature, chunk CRC, IEND, dimensions and sprite transparency for all five assets.
- **Browser follow-up:** https://github.com/westkitty/Dexter_Desk_Familiar/actions/runs/40827430405 (final status must be read before claiming a pass).
- **Remaining gates:** Safari/manual touch/assistive-tech checks, full offline upgrade/rollback, expanded 96×96 plus independent 32×32 art approval, long-soak performance, and public Pages activation/HTTPS proof.
- **Scope:** `main` remains unchanged by this work. Branch edits are a bounded asset repair, regression test and evidence update; merge/release/publish remain separate actions.

## 2026-10-29 — Offline lifecycle continuation on `build/offline-lifecycle-20261029`

- Source baseline: proposed PNG fix PR #4 head `a92a5580150fdc81e77a6d497da560bef09652a7` (not merged into `main`); this task must be merged only after PR #4 or reconciled as a dependent PR.
- **RED**: six deterministic service-worker lifecycle tests were exercised against original `sw.js`; four failed (forced activation, incomplete-cache cleanup, stale cache precedence, and unrelated cache access). Local log: `red.log` in this work unit, not a durable remote artifact.
- **GREEN implementation:** `80f84904df6f4269349f13ba1d27e4567015caea` introduces version `dexter-desk-familiar-v3`, scoped shell-only cache reads, complete-cache activation check, failed-install cleanup and no `skipWaiting()` takeover. Cloud Node/build PASS: https://github.com/westkitty/Dexter_Desk_Familiar/actions/runs/40835162640.
- **Real Chromium tests:** new fresh-window offline reopening and unrelated-cache isolation tests plus the four existing journeys: 6/6 PASS at `12e0d8c7b7a5759c98f45386131401160498e6b0`: https://github.com/westkitty/Dexter_Desk_Familiar/actions/runs/40835443533. Node/build PASS at same SHA: https://github.com/westkitty/Dexter_Desk_Familiar/actions/runs/40835443534.
- Two browser-test corrections were necessary: strict app CSP blocks in-page `fetch`, and unknown document navigations intentionally serve the offline index fallback with HTTP 200; the final test asserts that unrelated cached content is never exposed.
- **Not yet proven:** real interrupted upgrade with two successive service-worker revisions and browser shutdown/reopen; service-worker update notification UX; manual Safari install/update; long-session soak; final 32px/96px visual approval; live Pages activation. Browser success is not proof of these gates.
- GitHub Actions screenshot upload failed during earlier red runs because Actions artifact storage quota was exceeded; no artifacts were deleted and those optional uploads do not invalidate the observed test failures.
- Scope preserved: no third-party runtime assets, monitoring outside Dexter's page, native shell, changes to WESTCAT repositories, or changes to `main`.
