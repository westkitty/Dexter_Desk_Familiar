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
