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

## 2026-10-29 — Cross-repository integration branch (staged and pending exact-head CI)

- Branch identity: `build/atlas-presence-reconcile-20261029` derived from verified `main` at `d666817d1f4d81ebbe39226551f85e9195150176`.
- Existing unmerged older uplift head `5478a368493600c49edcc614d6a020a81d62551b` diverged from new `main` and carried an obsolete service worker. Reapply selected useful changes onto current `main`; **do not merge that worker**.
- New (implemented, not yet release-verified): bounded ambient attention budget, page-only pointer proximity/pace and repeated-poke semantics, ephemeral authored response cadence, current-hour habitat lighting, mobile character bounds, optional audio throttling, and a candidate 32px animation preview.
- Candidate source `westkitty/SNES_Dex` / `original/dexter_sprites.png`, Git object `ee2e34f8c773e03846ce2800280328f3464a9603`, copied byte-for-byte and NOT canon-approved. Existing 96px images remain the default.
- New PWA cache version retains mainline no-force-activation, own-cache-only reads, atomic installation, completeness verification before old-cache deletion. Do not replace it with `uplift/presence-cadence-20261029`'s simplified worker.
- Modified public release allowlist only for needed small local modules and candidate image; no other files or accounts; source repository remains private.
- Mandatory gates: exact-head CI, Chromium and WebKit smoke, offline atlas preview/fallback, pointer/touch interactions, no third-party requests, mobile bounds, SW lifecycle and PNG-provenance tests; real Safari manual review still unverified.
- No native overlay or cross-project writes. Public Pages activation remains blocked outside this change scope. Do not claim promotion to canonical art or a v1.0 release.

## 2026-10-29 — Cross-repository integration verified and merged

- Verified merge: PR #6 `https://github.com/westkitty/Dexter_Desk_Familiar/pull/6`, code commit `a0f06cc7848b36f14059a21f06b5fcb952b08edc`. Source repository remains private; no sibling repositories were modified.
- Exact merge-commit Node/build/integrity: PASS `https://github.com/westkitty/Dexter_Desk_Familiar/actions/runs/40842942488`; 51 unit and SW lifecycle tests plus release allowlist passed.
- Exact merge-commit Playwright: PASS `https://github.com/westkitty/Dexter_Desk_Familiar/actions/runs/40842942441`; Chromium 10/10 and WebKit 10/10, 20/20 total. WebKit does not establish native Safari/macOS acceptance.
- Three original 96px sprite Git blobs remain unchanged from pre-change baseline: sit `c8423293c4562c64fa03388793055a3e36867b4c`, stand `fedd643fc9eaadd2de5857712eb46666771b61b1`, rest `c8d4cb1d8a4410c07d94bfefcf86fc0afc7043d0`.
- The 32px candidate remains opt-in, session-only and unapproved for canon. Exact upstream Git blob `ee2e34f8c773e03846ce2800280328f3464a9603` was preserved.
- Original current-main SW lifecycle safeguards survive and pass; do not merge obsolete worker from `uplift/presence-cadence-20261029`. This older branch is not deleted or merged, and its useful non-SW behavior is superseded by PR #6.
- GitHub Pages automatic deployment still **FAILED** at `Configure GitHub Pages` due missing repository Pages site; source built correctly, but this code was NOT confirmed publicly hosted. Evidence `https://github.com/westkitty/Dexter_Desk_Familiar/actions/runs/40842942407`.
- Remaining approval gates: verified canonical visual references and explicit user approval, actual Safari/target touch and assistive-tech journeys, real cross-version PWA upgrade/rollback test, long-session performance and v1.0 release certification. Native shell not in scope.

## 2026-10-29 — Pages activation closed (current evidence)

- GitHub repository visibility was directly observed as **public**. This supersedes historical `private` statements; no reversal of visibility was requested or performed in this turn.
- Pages site already configured when rechecked using authenticated user `westkitty`: `build_type=workflow`; `html_url=https://westkitty.github.io/Dexter_Desk_Familiar/`.
- Manual dispatch from `main` at `ad6e2433597303a415e878d3e9e9bff661c523e9`: https://github.com/westkitty/Dexter_Desk_Familiar/actions/runs/40846064963 — **SUCCESS**.
- Separate-machine external HTTPS probe: index 200, app.js 200, src/animation.mjs 200 and candidate atlas 200. Hosted site returned 404 for README.md and OPERATIONAL_STATE.md; those files remain publicly accessible through the source repository because the repository is public.
- All past 'Pages not enabled / not live' entries are historical and superseded by this verified deployment. Preserve earlier error evidence; do not continue treating the site as blocked.
- Unresolved: canon approval for candidate sprite, physical Safari/mobile/accessibility, long-session performance, cross-version service-worker rollback and v1.0 release readiness. Successful publishing is not evidence of those gates.

## 2026-10-31 — v0.3.1 patrol and deployed-byte verification

- Authoritative starting HEAD was `31e86db1b942517c7fbc57f2ddafc10ff81c9e3d` on public `westkitty/Dexter_Desk_Familiar`. The prior October 29 uplift ZIP was **not** reapplied because PR #6 already superseded its useful features and offline worker.
- User-directed continuation implemented in `build/patrol-release-proof-20261031` and merged through PR #7: `https://github.com/westkitty/Dexter_Desk_Familiar/pull/7`. Source merge SHA: `b0242e3c060a068032f62ca6263f5209c79ad187`.
- Change groups: (1) rare, page-local out-and-back patrol that does not overwrite user placement or bypass reduced motion; (2) Pages post-deployment verification requiring the exact GitHub source SHA, all allowlisted file hashes, and 404s for excluded docs. Offline shell cache bumped to `dexter-desk-familiar-v5-patrol` to avoid mixed versions.
- Local Big Mac Node verification PASS: 58 unit/lifecycle tests, two release tests, 23 allowlisted public files totaling 92,990 bytes. Exact-branch GitHub Node PASS: https://github.com/westkitty/Dexter_Desk_Familiar/actions/runs/41186244506, cloud Chromium/WebKit PASS 22/22: https://github.com/westkitty/Dexter_Desk_Familiar/actions/runs/41186244571.
- Exact merge SHA cloud Node PASS: https://github.com/westkitty/Dexter_Desk_Familiar/actions/runs/41186422188; cloud Chromium/WebKit PASS: https://github.com/westkitty/Dexter_Desk_Familiar/actions/runs/41186422191.
- Pages deployment **PASS** for source commit `b0242e3c060a068032f62ca6263f5209c79ad187`: https://github.com/westkitty/Dexter_Desk_Familiar/actions/runs/41186422183. Post-deploy verifier fetched and hashed all 23 files. Independent Big Mac HTTPS manifest probe confirmed version `0.3.1` and source SHA. URL remains https://westkitty.github.io/Dexter_Desk_Familiar/.
- Invariants: no new art or runtime dependency, no OS/global sensing, no stored input text, no telemetry, no native overlay, no changes to WESTCAT siblings. Repo was public at start and remains public; this task did not change visibility.
- Still unverified: full real two-version PWA upgrade/rollback in physical browsers, native macOS Safari and actual Android/touch/assistive technology devices, approved canonical 96px/32px art, 60-minute soak/performance, and v1.0 release certification.

## 2026-10-31 — Cel-shaded animation integration preview (not deployed)

- Identity and target: public westkitty/Dexter_Desk_Familiar, isolated local branch feat/approved-cel-shaded-20261031 on Big Mac; baseline main SHA 3d7d2d7e1af875524c20938adbc76e0a8b6b2e1b.
- Authority: user continuation after explicitly accepting all eight motion assets. Integration is limited to this repository. Do not merge into main or deploy solely because the clips were artistically approved.
- Input provenance: eight exact 384x384, 18fps, alpha WebM clips copied over an existing authorized SSH connection from the MacBook; SHA locks in tests/cel-animation.test.mjs match approved archive. Four source posters also copied for still fallbacks.
- Implemented: separate off-by-default, session-only cel-shaded renderer with native video alpha test and static cel poster fallback, muted media, quiet/reduced-motion/visibility behavior, explicit clip inspector and state mapping, automatic lie-down to sleep loop, preserve existing 96px and 32px modes.
- Release structure: 36 allowlisted static files, cache v6, 2 MiB budget preserved; package preview metadata 0.4.0-preview.1. Default app is unchanged when option is off.
- Validation: local Big Mac 58 pre-change unit PASS, 6 new owner-asset/state-controller tests PASS, release tests PASS. Chromium final 18 PASS + 1 WebKit-specific SKIP (includes all eight actual alpha-video decodes and lie-down-to-sleep playback); WebKit final 16 PASS + 3 Chromium-only SKIP. No browser failures. Any additional tests and exact feature-branch commit status are recorded separately on completion.
- Still pending: native physical Safari/mobile and accessibility QA, performance/long-session, real two-version offline service-worker upgrade/rollback, GitHub exact-commit CI, final deployment authorization. Feature is NOT a replacement for existing canonical pixel art.

## 2026-10-31 — Pages verifier hotfix following approved animation deployment

- PR #8 merged to public main at `e9eed54e4932f19c211199502c61c77fe2b1dbfa`; the Pages deployment action reported success, but post-deployment verification failed in run 41214820461 with `Invalid public file declaration`.
- Confirmed cause: `scripts/verify-pages.mjs` still enforced the older flat-path PNG-only manifest rule. The new release intentionally includes owner-approved nested `assets/cel-shaded/clips/*.webm` and poster PNG files, which the builder and release tests allow.
- Narrow repair: align published-file validation with the release allowlist, retaining SHA-256, byte-size, origin/path, traversal, and excluded-document checks. Add nested WebM/poster and invalid-path regression fixtures.
- Production verification is pending the exact-commit Pages workflow for this repair. Do not claim it succeeded based on the deploy action alone. Preserve the pixel-art default, offline requirements, privacy boundary, and eight approved clip bytes.


## 2026-10-31 — Native desktop overlay alpha, isolated draft PR #9

- New user-approved goal: add a real desktop companion matching the useful WESTCAT overlay interaction model while retaining a separately working browser/PWA edition. This supersedes the earlier native-shell non-goal **only for a separately packaged opt-in desktop edition**; no global activity monitoring, browser tab inspection, AI routing or TTS are implied.
- Implementation branch: `feature/desktop-overlay-v1-20261031`, based on main `fdf3727e2c924fa42713e5cb443247e267d1103f`, draft PR #9: https://github.com/westkitty/Dexter_Desk_Familiar/pull/9
- Implemented in source (NOT yet runtime-verified): desktop-only Electron 45.2.1 host; transparent frameless window; topmost preference; native tray recovery; optional hit-test passthrough; character drag/window positioning; size, opacity, placement and art preference persistence; three existing art paths; bounded preload IPC; file-only load guard; no other network or permission services; separate staged desktop-only HTML/CSS.
- Source-protection contract: no changes to browser `index.html`, `app.js`, `styles.css`, `src/`, existing asset bytes, PWA build allowlist, existing Pages workflows or sibling WESTCAT repositories. Desktop stage and output ignored. Browser web edition remains the default.
- Validation requested: macOS GitHub Actions syntax, Node tests, staging and unsigned arm64 bundle checks; after CI, real macOS launch, alpha-WebM test, default pixel/cel fallback, click-through + tray recovery, multiple display bounds, menu interactions, settings persistence, VoiceOver/reduced-motion, long-session CPU/memory, and outbound traffic audit.
- Evidence currently: branch and PR creation verified through GitHub; desktop source and workflow committed. **Native runtime, CI outcome, installation, signing, notarization and release are unverified.** Never call this a finished desktop app until actual tests prove it.
- Rollback: discard draft PR/desktop directory; main web/PWA and published Pages remain untouched.


## 2026-10-31 — Desktop alpha advanced from source to verified macOS bundle

- Authority remains **only** `westkitty/Dexter_Desk_Familiar` and the isolated draft PR #9. Big Mac was verified as macOS arm64 and an independent clean checkout was created at `/Users/bigmac/Projects/Dexter_Desk_Familiar_desktop_validation`. The pre-existing `/Users/bigmac/Projects/Dexter_Desk_Familiar` checkout on the cel-animation branch was not changed.
- Implemented and tested: native Electron host over a privileged local `dexter://app` protocol (strict allowed file paths, realpath containment, correct MIME, WebM byte ranges), desktop-only renderer stage, retained pointer/poke semantics, native window movement, persistent size/opacity/bounds, multi-display-nearest restoration, optional topmost, tray recovery, context menu and quiet mode. Original web assets and page-only privacy boundary remain unchanged.
- Verified directly on Big Mac: `npm ci`, desktop `npm run check` (5/5 unit), `npm run package:mac`, launch smoke of **development Electron and packaged macOS arm64 .app**, all PASS. Smoke observed native bridge, pixel 96x96 image, correct poke/treat state, decoded and displayed `slow_blink` transparent cel video, a native window position delta, transparent document CSS and screenshot-corner alpha, tray object, denied private module URL 403 and WebM HTTP 206 partial response. The first actual launch initially failed because network interception blocked `file:` transport; direct bounded byte-serving corrected the cause and exact paths were retested.
- Independent GitHub-hosted macOS Actions run `41218157904` and later `41218520502` completed successfully for locked install, tests, arm64 package, bundled launch smoke and plist/executable inspection. A CI assertion was added to confirm packaged Dexter icon bytes match generated `.icns`; Big Mac `cmp` verified this. Electron Packager may warn about optional new `.icon` format even though matching `.icns` is copied successfully.
- The root **web/PWA** `npm run check` remained PASS on Big Mac (66/66 unit and lifecycle, 2/2 release, 36 public files / 1,992,102 bytes). No changes were made to the PWA HTML, JS, styles, service worker, static release allowlist or WESTCAT repositories.
- The desktop dependency tree is pinned in `desktop/package-lock.json`. Big Mac's unauthenticated HTTPS Git push failed harmlessly after a local lockfile-only commit; the same lockfile was committed through the connected GitHub tool, and the isolated checkout was reconciled by skipping the already-applied local patch. **Future GitHub writes should use the connected GitHub tool, not assume Big Mac `git push` or `gh` is authenticated.**
- Remaining blockers for a **public signed release**: genuine user mouse behavior above unrelated apps (transparent-region click-through and recovery), physical target MacBook install/quit/relaunch, multi-monitor drag demonstration, reduced-motion and VoiceOver pass, sustained CPU/memory, full no-egress audit, and Apple Developer ID signing/notarization. All remain `unverified`. The prior `codesign --verify` failed on the unsigned bundle as expected; no signing or notarization was attempted.
- Deployment policy: `main`/GitHub Pages unchanged. Keep desktop PR #9 draft until requested interaction checks are complete; do not advertise signed or installed app status from the macOS runtime smoke.

## 2026-10-31 — Desktop alpha native interaction closure and local archive

- Native feature code at `476b3cb207c2410eaaa1a89f19f69897b5093602` adds a persisted flip option, hide/show through the tray, explicit desktop poke-versus-drag ownership, and 6/6 pure desktop tests. Big Mac arm64 `DEXTER_DESKTOP_SMOKE=1 npm start` and the equivalent packaged `.app` smoke both passed, checking flipped/normal, hidden/recovered, persistent Mac window movement, transparent cel decode, local file isolation and video ranges.
- Independent macOS Actions run `41218938554` passed for the same native feature code, including locked install, 6 unit tests, real packaged Electron launch and app resource inspection. The packaged custom `Dexter.icns` matched the source-generated icon bytes. The optional `.icon` availability warning from packager v20 is not an icon failure.
- A **local-only**, validated unsigned arm64 ZIP was prepared on Big Mac under the isolated checkout's `desktop/out/Dexter_Desk_Familiar_macOS_arm64_unsigned_alpha.zip` (~115 MB). `unzip -tqq` passed; SHA-256 `35815d9dc90a5b9c294c278b983902cc6c0c92655ba05c2b7b79ccaef57cd263`. It has NOT been uploaded to the conversation, copied to the user's MacBook, signed, notarized, published or deployed.
- `desktop/README.md`, root `README.md`, `docs/PRODUCT_BLUEPRINT.md` and `Dexter_Desk_Familiar_bible.md` were updated to distinguish the new approved two-edition product scope from the old PWA-only non-goal.
- **Release verdict**: PASS for the tested macOS alpha source/bundle/zip path; BLOCKED for public/target-device macOS release by untested real mouse passthrough, MacBook manual interaction and accessibility, signing/notarization and longer-session monitoring. `main`/Pages remain unchanged. Do not equate a successful synthetic pointer-and-window smoke with a real user's click-through acceptance.

### Final independent browser regression receipt

- GitHub Chromium/WebKit browser-smoke run `41218938598` completed **SUCCESS** for native code commit `476b3cb207c2410eaaa1a89f19f69897b5093602`, alongside GitHub source check `41218938543` and macOS Electron bundle check `41218938554`, all **SUCCESS**. These do not substitute for physical target-Mac click-through or signed installation.
