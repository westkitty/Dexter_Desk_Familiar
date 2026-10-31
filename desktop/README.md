# Dexter Desktop — macOS alpha

A native Electron floating overlay for **the existing Dexter Desk Familiar**, not a replacement application or WESTCAT code import.

## Status

Source alpha only. The repository's GitHub Pages web/PWA build remains unchanged. A macOS `.app` has **not** been personally tested on the user's device, signed, notarized or installed.

## Build on a Mac

Requires Node.js 22 and npm. In `desktop/`:

```sh
npm install
npm run check
npm start
```

Build a standalone unsigned development bundle:

```sh
npm run package:mac
```

Use the app from `desktop/out/Dexter Desk Familiar-darwin-arm64/Dexter Desk Familiar.app`. Do not assume it is Gatekeeper approved. The source package uses Electron 45.2.1 and electron-packager 20.3.0, pending actual package installation in a Mac CI environment.

## Interactions

Dexter is a small transparent floating window. Drag the character, not the empty area. Right-click to summon controls; the menu bar tray icon is always a recovery point. Size, opacity, topmost preference, art mode and window position are saved locally. The default art remains the original 96px pixel portraits; accepted cel-shaded WebM clips are opt-in; the unapproved 32px atlas stays labeled as such. If transparency is unsupported, the still fallback is the existing local art.

Hit-test passthrough forwards mouse movement to the renderer to regain interactivity when hovering the character. This requires direct target-machine validation on macOS; passing unit tests does not prove transparent-area forwarding works. **Pass through all clicks** is an explicit alternate mode; use the menu bar tray icon to turn it off. No global keyboard monitoring, screen recording or accessibility sensing.

## Boundaries

Core files from the current PWA are copied to an **ignored** staging folder; only the prepared desktop stage gets the desktop-only CSS/HTML adaptation. The public PWA release allowlist, service worker and hosted GitHub Pages are unchanged. No Ollama connection, real AI chat, TTS, telemetry, desktop keyboard observation, or public network listeners are added.

## Gate before release

Install exact packages, run `npm run check`, build macOS arm64 bundle, launch on macOS, verify alpha WebM transparency, draggable surface, passthrough, tray recovery, resize/opacity, shutdown and relaunch, persistent bounds, no outbound connections, reduced motion, VoiceOver and energy usage. Unsigned development artifacts are not distribution-ready.
