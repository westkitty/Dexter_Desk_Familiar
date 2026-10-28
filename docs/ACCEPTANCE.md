# Acceptance & proof ledger

## Source-complete checks
- [ ] All referenced files exist under the app scope.
- [ ] Node tests pass on the exact commit.
- [ ] No external domains, runtime fetch/XHR/beacons, fonts, third-party scripts or analytics exist in the app bundle.
- [ ] Supplied-reference poses visibly preserve markings and scowl.

## Real-browser checks — required before claiming release-ready
- [ ] Chromium/Safari: first visit from HTTPS or loopback; manifest loads and install appears where supported.
- [ ] Service-worker cache installs; loading with network disabled succeeds after first load.
- [ ] Browser Network panel: no **application-initiated** external requests after install. Browser-managed own-origin service-worker update checks are outside the app's control.
- [ ] Trigger idle, watching, working, judging, wandering, resting, sleeping, huffing, eating; check priority/TTL and recovery.
- [ ] Type only inside the local desk field. Confirm text is not stored, sent, logged or preserved after closing.
- [ ] Inspect localStorage (settings only) and Cache Storage (offline files).
- [ ] Test drag, keyboard, touch, focus, textarea Escape, settings controls and screen-reader labels.
- [ ] Test reduced-motion mode, sound default-off and quiet mode, background tab handling and page reload.
- [ ] Test viewport widths 320/375/768/1440; visible controls should not bury the familiar.
- [ ] Verify sprite identity at 1x, 2x and 3x zoom against supplied canonical reference.

## Current proof state
Source and browser proof state must be updated after independent execution. A committed file or static test is not evidence of a passed visual/offline installation test.
