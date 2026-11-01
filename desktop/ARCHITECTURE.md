# Dexter Desktop — architecture

```
┌────────────────────────────── main process (main.cjs) ──────────────────────────────┐
│ preferences (window-state.cjs) · tray & menus · display/power events · IPC guards    │
│ core/ollama.cjs ── only network client, opt-in, loopback default                     │
│ core/persona.cjs · core/attention.cjs · core/conversation.cjs · core/events.cjs      │
│ core/diagnostics.cjs · core/tts-piper.cjs · protocol dexter://app (allowlisted files)│
└──────────┬─────────────────────────┬───────────────────────────┬────────────────────┘
   preload.cjs (pet)        preload-ui.cjs (chat)        preload-ui.cjs (settings)
┌──────────┴──────────┐   ┌──────────┴──────────┐     ┌──────────┴──────────┐
│ Pet window          │   │ Conversation panel  │     │ Settings window     │
│ staged web app.js   │   │ ui/chat.html/js     │     │ ui/settings.html/js │
│ + renderer.js       │   │ created on demand,  │     │ created on demand,  │
│ hit-test, bubble,   │   │ destroyed on close  │     │ destroyed on close  │
│ speech-queue        │   └─────────────────────┘     └─────────────────────┘
└─────────────────────┘
```

## Principles

1. **Dexter is the product.** The only window that is always visible is a small transparent window around him. Panels appear only on request and are destroyed when closed, which also returns their memory.
2. **One behavior engine.** The pet window runs the browser edition's `app.js` and `src/*.mjs` unmodified, from an ignored stage (`scripts/prepare-web.cjs`). Desktop-only hooks are applied to the staged copy, and each hook asserts that its insertion point exists exactly once:
   - pointer handlers move the native window instead of the in-page habitat;
   - `dexter-desktop-poke`, `dexter-desktop-moved` and `dexter-desktop-signal` feed the existing priority bus, and a poke while napping wakes him;
   - `dexter-desktop-intensity` replaces the ambient attention budget.
3. **Main process is the source of truth** for preferences. The renderer receives a sanitized subset (`dexter:prefs`) and mirrors it into the web controls, which are hidden on desktop.
4. **Every persisted value is re-validated** (`sanitizeSettings`). Out-of-range values fall back to defaults; they are never clamped. Opacity is at least 40%, and click-through is never persisted.

## Security boundaries

| Boundary | Mechanism |
|---|---|
| Renderer isolation | `sandbox`, `contextIsolation`, no `nodeIntegration`, no webview, `spellcheck:false`; checked by self-audit |
| Renderer network | CSP `connect-src 'none'` on every page; session `onBeforeRequest` cancels anything not `dexter://app/` |
| Local files | `dexter://app` serves only top-level allowlisted files plus `src/ assets/ icons/ ui/`, with safe characters, known extensions, and realpath containment. `main.cjs`, `core/`, `smoke.cjs` and the preloads return 403 |
| IPC | Typed allowlists in the preloads; main checks the sending `webContents` (and for panels, the frame URL) per channel |
| Model traffic | `core/ollama.cjs` in main only; refuses unless enabled; endpoint policy (http/https, no credentials/path/query, loopback unless remote is allowed); counted; any request made while disabled fails the self-audit |
| Permissions | All permission requests and checks are refused (no microphone, camera, notifications or geolocation) |
| Speech | System voices filtered to `localService`; Piper launched with `shell:false`, absolute user paths, 30 s timeout, temp WAV deleted |

## Attention arbitration

Anything Dexter starts by himself (check-ins and lifecycle reactions) goes through `evaluateProactive`. It is denied when Dexter is hidden, being dragged, in pass-through, napping, in quiet mode, already showing a bubble, during quiet hours, or when the hourly budget for the chosen intensity is spent. A reply the user asked for bypasses the budget, but still is not shown when the conversation panel is already open. Every decision and its reason is logged to the in-memory event log, which is visible in diagnostics.

## Resource behavior

- There is no polling. The web ticker runs every 1.1 s while visible and every 15 s while hidden. Check-ins use one `setTimeout`. Display events are debounced at 400 ms.
- The pointer hit test samples a 64×64 alpha mask only on mouse movement, re-sampling animated media at most every 100 ms.
- The event log holds at most 200 entries. Conversations hold at most 100 messages. The speech queue holds at most 3 lines. AI replies are capped at 6000 characters.
- On sleep, the check-in timer, AI requests and speech are stopped. On wake, Dexter is placed back on screen and the timer is re-armed.
- If the renderer crashes, it is reloaded up to 3 times in 5 minutes; after that a dialog points to the tray.

## Testing layers

| Layer | Where | What it proves |
|---|---|---|
| Unit | `tests/*.test.cjs` (47) | Schema, policies, streaming parser, cancellation, arbiter, persistence, redaction, queue, Piper process handling |
| Runtime smoke | `smoke.cjs`, Linux/Xvfb CI and macOS packaged/DMG CI | Real Electron wiring for every subsystem, using synthetic DOM events and a loopback fake model |
| Egress audit | Linux CI under `strace` | No non-loopback socket activity during the full smoke |
| Packaging | `scripts/verify-macos.mjs`, `scripts/package-dmg.mjs` | Signature integrity at every handoff, DMG layout, copied-app launch, quit/relaunch |
| Physical | `MACBOOK_QA.md` | Real pointer click-through, focus, multi-display, VoiceOver, soak. **Only a person can sign these off** |
