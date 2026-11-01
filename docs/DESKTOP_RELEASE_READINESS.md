# Dexter Desktop 0.2.0-alpha.1 — release readiness and remaining gaps

Date: 2026-11-01. Branch `ccr-465acaaa-d6o3hc`, draft PR #10, stacked on draft PR #9 (`feature/desktop-overlay-v1-20261031`).

**Recommendation:** usable as an **internal alpha for hands-on review on the target MacBook**. Do **not** merge to `main` or publish a release until the physical checks in `desktop/MACBOOK_QA.md` sections A–C pass. Developer ID signing and notarization are blocked on credentials that this project does not have.

## Evidence key

- **CI-mac**: GitHub-hosted `macos-15` Apple Silicon runner, packaged and DMG-installed app (see the CI table below).
- **CI-linux**: GitHub-hosted Ubuntu, real Electron under Xvfb, with a syscall egress audit.
- **Local-linux**: this session's container, real Electron 45.2.1 under Xvfb.
- **Unit**: `desktop/tests/*.test.cjs` (49 tests).

## CI evidence (commit `0042ab3`)

| Workflow / job | Run | Result |
|---|---|---|
| Desktop macOS: `desktop` (macos-15, arm64) | [41280711779](https://github.com/westkitty/Dexter_Desk_Familiar/actions/runs/41280711779) | PASS: build, verifier, packaged smoke with sampled sockets, DMG round trip, relaunch, checksum, upload |
| Desktop macOS: `desktop-linux-runtime` | same run | PASS: smoke, exhaustive egress audit (only `127.0.0.1:<fake model port>`), relaunch persistence |
| Verify (web unit + release) | [41280711745](https://github.com/westkitty/Dexter_Desk_Familiar/actions/runs/41280711745) | PASS |
| Browser smoke (Chromium/WebKit) | [41280311417](https://github.com/westkitty/Dexter_Desk_Familiar/actions/runs/41280311417) at `e581397` | PASS (web files are identical at `0042ab3`) |

**Review DMG:** `Dexter_Desk_Familiar_0.2.0-alpha.1_macOS_arm64_adhoc.dmg`, SHA-256 `00e0251f6916b419275a78f310b81bf1efd98e284af81d409ff15385b80f6ac6`. It is in Actions artifact `Dexter-Desktop-macOS-arm64-adhoc-DMG-10-118` (ID 13072858540, retained 14 days, outer ZIP 123,033,928 bytes). The verifier reported: identifier `dev.stinkyweasel.dexterdesk`, version 0.2.0, category entertainment, 8 nested helpers/frameworks individually verified, `Signature=adhoc`, Gatekeeper `rejected` (expected for an ad-hoc build).

**macOS runtime figures (CI runner, packaged app; not an M1 Air):** 356 MB working set at idle across Browser, GPU, Utility and Tab processes; about 625 MB with the conversation and settings panels open; about 437 MB after closing them. `isFocusable()==false`. The system voice reached `speaking`. The approved alpha WebM decoded in the copied-out app.

## Implemented and verified

| Area | Evidence |
|---|---|
| Transparent frameless window, topmost, scale 60–200%, opacity 40–100%, flip, art modes | CI-mac, CI-linux, Local-linux smoke |
| Alpha-mask click routing (opaque body captured; transparent pixels and bubble headroom released; bubble captured) | CI-mac, CI-linux smoke (synthetic events) |
| Tray Show/Hide/Restore/Talk/Settings/Quit; pass-through toggle and recovery; hide → tray recovery | CI-mac, CI-linux smoke |
| Display loss recovery (window forced off-screen, then `display-removed`) | CI-mac, CI-linux smoke (simulated) |
| Preference persistence across quit and relaunch, including position (bug found and fixed), and click-through reset on launch | CI-linux; CI-mac on the DMG copied-out app |
| Passive focus (`isFocusable()==false` on macOS) | CI-mac smoke assertion |
| Conversation panel: local replies, slash commands, streaming from a loopback model, Stop, offline state, notices | CI-mac, CI-linux smoke (fake Ollama server) |
| Local AI policy: zero requests when disabled; endpoint rejection (credentials, path, query, silent remote) | Unit, smoke |
| Speech: system voice reaches `speaking` and degrades to text on failure; bounded queue; Piper process handling | Unit, smoke. Real Piper not run |
| Check-ins: shown, choice answered, answers not stored; arbiter, budget, quiet hours | Unit, smoke |
| Settings window: 11 sections, every control labeled, every button named, live apply | CI-mac, CI-linux smoke |
| Self-audit (11 live checks, none failing) and private diagnostic export | CI-mac, CI-linux smoke |
| All three renderers sandboxed and context-isolated; protocol denies `main.cjs`, `core/`, preloads, smoke, traversal and queries | Smoke |
| No outbound traffic except to the user-enabled loopback model | CI-linux exhaustive syscall audit; CI-mac sampled `lsof` |
| Ad-hoc signature valid on app, mounted DMG and copied-out app, including every nested helper and framework; sealed resources; correct identifier and version | CI-mac `verify-macos.mjs` |
| DMG: UDZO, verified, read-only mount, drag-to-Applications layout, payload hash, SHA-256 file | CI-mac `package-dmg.mjs` |
| Browser/PWA edition unchanged: 66/66 unit, release 2/2, 36 files / 1,992,102 bytes, Chromium/WebKit smoke | Local plus CI `verify.yml` and `browser-smoke.yml` |

## Defects found and fixed during this work

1. **Dragged position was not saved.** Programmatic moves don't emit `moved`; Dexter could reopen in the wrong place. Bounds are now recorded on drag end, rescale, display recovery and quit, and the relaunch test proves it.
2. **Hidden network egress.** Electron downloaded spellchecker dictionaries from `redirector.gvt1.com` on Linux and Windows despite `spellcheck:false`. A local check had wrongly reported loopback-only, because the traffic went through a proxy listening on `127.0.0.1`. The spellchecker is now disabled with a loopback download URL plus Chromium switches, and the audit fails on proxy CONNECTs and DNS lookups.
3. The desktop `quiet` preference was stored but never applied; it is now driven by main.
4. Panels kept their renderer memory while hidden; the conversation panel is now destroyed on close.
5. A smoke race: closing the panel awaited a script in the frame it destroyed.

## Implemented but NOT verified (needs a person and a Mac)

- **Physical** transparent-area click-through above other apps, and real drag (QA B). This is the top risk.
- Focus behavior with a real keyboard while typing in another app (QA B).
- Two physical displays, unplugging, resolution changes and Spaces (QA C).
- Sleep and wake on hardware, launch at login, Dock-hidden mode, single-instance reopen (QA C).
- First-launch Gatekeeper flow for the ad-hoc DMG (QA A).
- VoiceOver, Reduce Motion following the system setting, Increase Contrast (QA E).
- 60-minute idle CPU and memory on a MacBook Air M1 with 8 GB (QA F). Only short CI snapshots exist: 356 MB idle on the macOS runner, about 440 MB on Linux/Xvfb. A long-run growth trend has not been measured.
- Real Ollama server and real Piper installation. Only protocol-faithful fakes were exercised.

## Blocked

- **Developer ID signing and Apple notarization:** no Developer ID certificate or notarization credentials are available to this project. The DMG is labeled ad-hoc. Nothing in this repository disables or bypasses Gatekeeper.

## Deferred (by decision)

- Microphone input and speech recognition: these need a separate explicit permission flow.
- Showing Dexter on all Spaces and over full-screen apps: changes macOS activation policy and needs physical testing.
- Native OS notifications: the in-overlay bubble is used instead.
- Importing WestCat frame-cluster animation: Dexter's approved alpha WebM clips already cover this, and replacing working assets is out of scope.

## Merge and release decision

| Step | Status | Needs |
|---|---|---|
| Review PR #10 (stacked on #9) | Ready for review | Owner |
| Physical QA A–C on the target MacBook | Not done | Owner, with the CI DMG artifact |
| Merge #10 into #9's branch, then #9 into `main` | Not authorized | Separate explicit authorization |
| Public release / notarized build | Blocked | Developer ID credentials and authorization |
| GitHub Pages | Unaffected | Nothing; the web edition is unchanged |
