# Dexter Desk Familiar — acceptance gates

As of 2026-10-29 UTC. Check each item against evidence, not source presence alone.

## Evidence-backed passes
- [x] Verified private repository identity and merges #1/#2/#3 to main.
- [x] Node/unit/build/source-allowlist tests passed at code commit `d41e7dfdfeb7ddc0f38192cc3240249bfdd03594`.
- [x] Chromium real-browser test on that commit: four journeys passed, including nap/wake, typing privacy, keyboard reposition, 320/375/768/1440 layouts and offline service worker reload.
- [x] No cross-origin app requests observed during the Chromium smoke scenarios (not a universal privacy proof).

## Incomplete release gates
- [ ] Pages activated, deploy succeeded and public HTTPS responds with complete app.
- [ ] Mac Safari / iOS or Android touch manual acceptance.
- [ ] Assistive-technology, reduced-motion, quiet mode and audio manual acceptance.
- [ ] Service worker offline upgrade and failure rollback under version changes.
- [ ] 96×96 canonical character art and independent 32×32 atlas reviewed/approved.
- [ ] Long-session/performance and offline network-request audit across required browsers.
- [ ] Reproducible final v1.0 ZIP, checksums, and rollback tested.

See `docs/QA_EVIDENCE.md` for exact commit/run URLs. Passing source tests are not evidence of character likeness approval, live Pages hosting or production release.

## 2026-10-29 — v0.3 integration acceptance

- [x] Mainline PNG integrity and offline lifecycle regression tests still pass at `a0f06cc7848b36f14059a21f06b5fcb952b08edc`.
- [x] New local attention, pointer, audio, response-cadence, atlas geometry and exact Git-blob provenance unit tests pass; 51/51 total.
- [x] Chromium and Linux WebKit real-browser smoke 20/20 on merge commit, including offline atlas preview and fallback.
- [x] Existing 96px images remain byte-for-byte unchanged. Candidate 32px atlas remains opt-in/unapproved and can be disabled.
- [ ] Actual target Mac Safari and mobile touch/accessibility/manual screen-reader testing.
- [ ] Sprite candidate approved against authoritative reference images for default use.
- [ ] Full real-browser two-version service-worker upgrade/rollback and sustained performance checks.
- [ ] GitHub Pages site enabled and externally verified, final distribution/versioned v1.0 release.

These newer checks add evidence to the historical baseline above; they do not automatically complete the open release gates.
