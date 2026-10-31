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
