# Dexter Desktop — macOS alpha (0.2.0-alpha.1)

A small, judgmental black dog who floats beside your work. This is the native desktop edition of **Dexter Desk Familiar**. It is a separate package that reuses Dexter's browser behavior engine and approved art. It does not replace the web/PWA edition, which stays independent and unchanged.

- **Status:** internal alpha. The app is ad-hoc signed, which proves the bundle's integrity only. It is **not Developer ID signed and not notarized**, so Gatekeeper will ask you to approve it once.
- **Architecture:** [ARCHITECTURE.md](./ARCHITECTURE.md). **Physical acceptance tests:** [MACBOOK_QA.md](./MACBOOK_QA.md). **Feature lineage:** [../docs/WESTCAT_PARITY_MATRIX.md](../docs/WESTCAT_PARITY_MATRIX.md).

## Install (Apple Silicon)

1. Download the `Dexter-Desktop-macOS-arm64-adhoc-DMG-*` artifact from a successful **Dexter desktop macOS alpha checks** run on the desktop pull request. GitHub delivers it as a ZIP that contains the DMG and a `.sha256` file.
2. Verify the checksum, with both files in the same folder:
   ```sh
   shasum -a 256 -c Dexter_Desk_Familiar_0.2.0-alpha.1_macOS_arm64_adhoc.dmg.sha256
   ```
3. Open the DMG and drag **Dexter Desk Familiar** onto **Applications**. Eject the disk image.
4. Open the copied app. macOS will say it cannot verify the developer. If you trust this checked build, go to **System Settings → Privacy & Security → Open Anyway**. Do **not** disable Gatekeeper globally, and do **not** run blanket `xattr -dr` commands.
5. If macOS says the app is **damaged**, stop. Run `codesign --verify --deep --strict -v "/Applications/Dexter Desk Familiar.app"` and report the output.

## Using Dexter

| To… | Do this |
|---|---|
| Move him | Drag his visible body. Empty space around him lets clicks through to whatever is underneath. |
| Interact | Click to poke (repeated pokes escalate). Right-click for Treat, Huff, Nap/Wake, Talk, appearance, size, opacity and window options. |
| Talk | Right-click → **Talk to Dexter…**, or menu-bar icon → **Talk to Dexter…**. Enter sends; Shift+Enter adds a new line; Esc stops a reply or closes the panel. Commands such as `/help`, `/treat` and `/status` work without AI. |
| Change settings | Menu-bar icon → **Settings…**. Changes apply immediately and are saved. |
| Recover him | Menu-bar icon → **Restore Dexter**. This shows him, turns click-through off, and moves him back onto a connected screen. Opening the app again from Applications does the same. |

Defaults are conservative: no network, no speech, no check-ins, conversation not saved, does not take keyboard focus, not opened at login.

### Optional features (all off until you turn them on)

- **Local AI:** Settings → Local AI. Connects to an Ollama-compatible server you run, by default `http://127.0.0.1:11434`. Dexter asks for confirmation before enabling. Another computer's address needs a second explicit permission. Nothing is downloaded and no model is installed for you. If the server is down, Dexter says so and still gives his usual local replies.
- **Speech:** Settings → Sound & speech. The *System voice* engine uses only on-device macOS voices. The *Piper* engine runs a `piper` program and `.onnx` voice that you installed yourself, given as absolute paths. Speech can be cancelled, its queue is short, and if it fails Dexter falls back to text. Dexter never uses the microphone.
- **Check-ins:** short questions in Dexter's voice, roughly every 30 minutes to 4 hours, with quiet hours from 22:00 to 08:00. Answers are not stored. One answer asks him to check in less often.
- **Remember conversation:** saves the conversation to `~/Library/Application Support/dexter-desk-desktop/conversation.json` (mode 0600), next to `desktop-settings.json`. Turning this off deletes the file.

### Privacy

No analytics, accounts, telemetry, crash uploads, keyboard or screen monitoring, clipboard access, or browser access. Dexter observes only clicks on himself, his own sleep/wake events, and display changes, which he needs for placement. Renderer pages have `connect-src 'none'` and may load only bundled `dexter://app/` files. The only network client is `core/ollama.cjs` in the main process, and it refuses to run unless Local AI is enabled. Settings → Diagnostics → **Run self-audit** checks these rules in the running app.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Dexter is gone or invisible | Menu-bar icon → **Restore Dexter**, or open the app from Applications again. Opacity cannot be set below 40%. |
| Clicks go straight through Dexter | You enabled **Pass through all clicks**. Use Restore, or untick it in the menu-bar menu. It always turns off when Dexter restarts. |
| Clicks on empty space near Dexter don't reach the app below | Turn on Settings → Window → **Click through empty space**. |
| Typing went into Dexter instead of my app | Turn on Settings → Window → **Never take keyboard focus** (on by default). |
| Dexter is off-screen after unplugging a display | Restore, or Settings → Reset & recovery → **Reset position**. Dexter also moves himself automatically when displays change. |
| "AI offline" | Check that your server is running at the endpoint, then Settings → Local AI → **Test connection**. Dexter keeps working without it. |
| No speech | Settings → Sound & speech → **Test voice**. The result line names the problem, for example no on-device voice, or Piper not found. Text bubbles always work. |
| Something else | Settings → Diagnostics → **Export report…**. The report contains no conversation text, file paths, coordinates or non-local host names. |

## Build from source (on a Mac)

Requires Node.js 22. Run these in `desktop/`:

```sh
npm ci --no-audit --no-fund
npm run check          # syntax, 47 unit tests, stage the payload
npm start              # run in development
npm run smoke          # full runtime smoke in a disposable profile
npm run package:mac    # ad-hoc signed arm64 .app; fails unless deep strict signature verifies
npm run package:dmg    # DMG + mounted/copied-out verification + launch + relaunch + SHA-256
```

The DMG builder refuses to overwrite an existing DMG or checksum. Electron 45.2.1 and @electron/packager 20.3.0 are pinned by `package-lock.json`.

**Signing invariant (regression from the 2026-11-01 broken DMG):** Electron Packager leaves an invalid linker signature on Apple Silicon. `package-macos.mjs` re-signs the whole bundle ad hoc, and `verify-macos.mjs` must pass at three handoff stages: the packaged app, the mounted DMG, and the copied-out app. It checks deep strict verification, every nested helper and framework individually, sealed resources, and the identifier. Never remove these checks.

## History

- **0.2.0-alpha.1 (2026-11-01):** WestCat parity work. Added conversation, optional local AI and speech, check-ins, a settings window, diagnostics, recovery hardening, display handling and fixed position persistence. Also added the Linux runtime and egress CI, and the versioned DMG with relaunch verification. The legacy ZIP artifact has been retired in favor of the DMG.
- **0.1.0-alpha.1 (2026-10-31):** first native overlay, alpha hit testing, tray recovery and ad-hoc signed DMG (PR #9). The earlier `…unsigned_alpha.dmg` had a broken signature and must not be reused.
