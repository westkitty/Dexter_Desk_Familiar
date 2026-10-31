# Dexter Desktop — macOS alpha

A native Electron floating overlay for **the existing Dexter Desk Familiar**, not a replacement application or WESTCAT code import.

## Status

**Build-tested macOS alpha.** The native Electron app launched successfully both from the development stage and as a packaged arm64 `.app` on Big Mac; independent macOS GitHub Actions passed build, packaged smoke, and bundle inspection. This is **not** a signed/notarized release, not installed on the user's MacBook, and not manually accepted for physical pointer pass-through or accessibility. GitHub Pages PWA remains independently functional.

## Build on a Mac

Requires Node.js 22 and npm. In `desktop/`:

```sh
npm ci --no-audit --no-fund
npm run check
npm start
```

Build a standalone unsigned development bundle:

```sh
npm run package:mac
```

Use the app from `desktop/out/Dexter Desk Familiar-darwin-arm64/Dexter Desk Familiar.app`. Do not assume it is Gatekeeper approved. The source package locks Electron 45.2.1 and @electron/packager 20.3.0. The produced bundle has a native Dexter icon, but remains unsigned; double-click installation can be rejected by Gatekeeper.

## Verified macOS alpha evidence (October 31, 2026)

- [macOS Actions run 41218520502](https://github.com/westkitty/Dexter_Desk_Familiar/actions/runs/41218520502): locked install, tests, packaged arm64 app launch smoke, bundle metadata all passed.
- Big Mac arm64: source-stage and **packaged binary** launch passed. The runtime reported strict transparent root CSS, native bridge, pixel portrait load, real poke/treat reaction, optional cel-shaded animation decode (including the `slow_blink` VP9-alpha clip), a native window move, and a working tray object.
- Security smoke: `dexter://app/main.cjs` returned 403; 32 bytes of WebM responded with 206 and correct range; full-window captured alpha at transparent corners.
- Entire untouched PWA: 66/66 Node tests, 2/2 web-release tests and 36-file audited distribution build passed on Big Mac.
- **Not proven:** actual pointer pass-through over other applications, click-drag by a human on the target MacBook, accessibility/VoiceOver, physical-device login/quit behavior, 60-minute soak, Developer ID signing, Gatekeeper and notarization. Automated synthetic pointer moves are not equivalent to human desktop testing.

## Interactions

Dexter is a small transparent floating window. Drag the character, not the empty area. Right-click to summon controls; the menu-bar tray icon is always a recovery point. Size, opacity, topmost preference, visual flip, art mode and window position are saved locally. The same menu includes Hide Dexter, Show Dexter, quiet mode and click-through controls. The default art remains the original 96px pixel portraits; accepted cel-shaded WebM clips are opt-in; the unapproved 32px atlas stays labeled as such. If transparency is unsupported, the still fallback is the existing local art.

Hit-test passthrough forwards mouse movement to the renderer to regain interactivity when hovering the character. This requires direct target-machine validation on macOS; passing unit tests does not prove transparent-area forwarding works. **Pass through all clicks** is an explicit alternate mode; use the menu bar tray icon to turn it off. No global keyboard monitoring, screen recording or accessibility sensing.

## Boundaries

Core files from the current PWA are copied to an **ignored** staging folder; only the prepared desktop stage gets the desktop-only CSS/HTML adaptation. The public PWA release allowlist, service worker and hosted GitHub Pages are unchanged. No Ollama connection, real AI chat, TTS, telemetry, desktop keyboard observation, or public network listeners are added.

## Download the unsigned review build

Draft [PR #9](https://github.com/westkitty/Dexter_Desk_Familiar/pull/9) runs the **Dexter desktop macOS alpha checks** workflow. Once its test job passes, it uploads a short-lived GitHub Actions artifact named `Dexter-Desktop-macOS-arm64-unsigned-alpha-pr9-*` (14-day retention). A GitHub sign-in may be necessary.

This is an **Actions archive** containing an inner `Dexter_Desk_Familiar_macOS_arm64_unsigned_alpha.zip` and its matching `.sha256` checksum, which must be checked *before* extracting the inner ZIP. For exact download, install, Gatekeeper and mouse-acceptance steps, read [MACBOOK_QA.md](./MACBOOK_QA.md).

The earlier Big Mac local build, SHA-256 `35815d9dc90a5b9c294c278b983902cc6c0c92655ba05c2b7b79ccaef57cd263`, predates transparent-pixel hit testing. **Do not treat that hash as the expected checksum for a newer Actions artifact.** Every review ZIP has its own matching checksum.

An uploaded Actions artifact is not a published GitHub Release, a Developer ID signature, a notarized installer or a certificate that physical mouse passthrough works.

## Gate before release

Install exact packages, run `npm run check`, build macOS arm64 bundle, launch on macOS, verify alpha WebM transparency, draggable surface, passthrough, tray recovery, resize/opacity, shutdown and relaunch, persistent bounds, no outbound connections, reduced motion, VoiceOver and energy usage. Unsigned development artifacts are not distribution-ready.
