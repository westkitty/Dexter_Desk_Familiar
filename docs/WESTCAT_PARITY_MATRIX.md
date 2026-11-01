# WestCat → Dexter Desktop capability parity matrix

Audit date: 2026-11-01. The reference repositories were read only; nothing was copied, committed or modified in them.

| Reference | Commit inspected | Stack | Code read |
|---|---|---|---|
| `westkitty/Westcat_Familiar` | shallow `main` | Electron + React + Zustand | `src/main/electronMain.ts`, `src/renderer/domain/{attentionEngine,familiarStateMachine,commandRouter}.ts`, `src/renderer/engines/selfAudit.ts` |
| `westkitty/WESTCAT-OVERLAY-RELOADED` | `451a5b1` | PySide6 | `app/poll_overlay.py`, `app/anim/cluster_sync.py`, `app/cat_window.py` (structure) |
| `westkitty/WestCat_Overlay_MacOS` | `fb99487` | PySide6 | `westcat_overlay_macos/{ollama_client,tts_integration,storage,app,ui,audio}.py` |
| `westkitty/west_cat_overlay` | `a2e89ff` | PySide6 | `app/{prompt_engine,tracker,speech_bubble,ui_cat}.py`, `assets/questions.json`, `config.yaml` |

## Legend

- **Verified (Linux runtime)**: exercised inside real Electron 45.2.1 under Xvfb by `desktop/smoke.cjs` in this session.
- **Verified (macOS CI)**: exercised by the packaged app on GitHub's macOS runner. See `OPERATIONAL_STATE.md` for run links.
- **Unit-tested**: covered by `desktop/tests/*.test.cjs` only.
- **Physical-unverified**: needs a person on real hardware (`desktop/MACBOOK_QA.md`).
- **Excluded**: deliberately not implemented, with a reason.

## 1. Native overlay

| Capability | Best reference source | Reference status (from code) | Dexter implementation | Dexter status |
|---|---|---|---|---|
| Transparent frameless window | All three PySide overlays (`FramelessWindowHint`, `WA_TranslucentBackground`); Westcat_Familiar `electronMain.ts` | Works in source, but Westcat_Familiar's window is a 1180×780 dashboard | `main.cjs` `createPetWindow`, transparent, no shadow, `skipTaskbar` | Verified (Linux runtime): transparent body, alpha-0 screenshot corners |
| Always on top, configurable | `ui.py` `WindowStaysOnTopHint` (always on); Westcat_Familiar lists it as an unimplemented "future seam" | Fixed on, or missing | `alwaysOnTop` preference, menu and settings | Verified (Linux runtime) |
| Per-pixel transparent click-through | None. All references use rectangular windows | **Missing in every reference** | `hit-test.js` alpha mask plus `setIgnoreMouseEvents(…, {forward:true})`; the bubble counts as hittable | Verified (Linux runtime, synthetic): opaque captured, transparent and headroom released. **Physical-unverified** |
| Drag anywhere in work areas | `ui.py` `mouseMoveEvent`; `docs/superpowers/plans/…drag-improvements.md` | Works, single display | IPC deltas, nearest-display clamp | Verified (Linux runtime, synthetic). **Physical-unverified** |
| Multi-monitor placement and restore | — | Not handled | Nearest display on restore; `recoverBounds` on display add/remove/metrics change | Unit-tested plus Verified (Linux runtime, simulated off-screen). **Physical-unverified** on two monitors |
| Size, scale, opacity, flip | `ui.py` size keys S/M/L, opacity, flip | Works | Scale 60–200%, opacity 40–100% (floor enforced), flip | Verified (Linux runtime) |
| Persisted position and preferences | `storage.py` `_atomic_write_json` | Works, but `load_settings` does no type validation | Atomic `0600` write; every value re-validated; legacy size migrated | Verified (Linux runtime) quit/relaunch. **Found and fixed:** a dragged position was not saved |
| Menu-bar icon: Show/Hide/Restore/Settings/Quit | — (PySide apps use window context menus) | **Missing** | `trayMenu()` | Verified (Linux runtime) |
| Recoverable full click-through | — | **Missing** | Tray toggle; Restore turns it off; never persisted, so it resets on launch | Verified (Linux runtime) |
| Right-click context menu | `ui.py` `_show_context_menu` | Works | `petMenu()` | Verified (Linux runtime) |
| Launch at login, default off | Westcat_Familiar lists it as a future seam | **Missing** | `app.setLoginItemSettings`, macOS/Windows only | Implemented. **Physical-unverified** |
| Display disconnect / resolution change | — | **Missing** | `screen` events, debounced, then `ensureOnScreen` | Verified (Linux runtime, simulated) |
| No keyboard-focus stealing | `Qt.Tool` flag (partial) | Partial | `focusable:false` by default (`passiveFocus`); `showInactive` | Verified (Linux runtime): `isFocusable()==false`. **Physical-unverified** on macOS |
| Low idle CPU/memory | — | Not measured | No polling; one check-in timer; panels destroyed on close; 15 s ticker when hidden | Measured, Linux/Xvfb only: 449 MB idle across 4 processes (software GL). macOS numbers come from CI. **60-minute soak physical-unverified** |
| Single instance / reopen restores | — | **Missing** | `requestSingleInstanceLock`, `second-instance` and `activate` call Restore | Implemented. **Physical-unverified** |

## 2. Familiar behavior

| Capability | Reference | Reference status | Dexter | Status |
|---|---|---|---|---|
| Explicit states with transitions | `familiarStateMachine.ts`: 10 states, `allowedTransitions`, `autoReturn` | Works (alien-familiar states) | Kept Dexter's 9 states and the priority/TTL bus (`src/behavior.mjs`); the desktop feeds the same bus | Preserved. Web tests 66/66 |
| Priority interruption and recovery | `attentionEngine.ts` | Works | Bus priorities: user actions 95, desktop signals capped at 94 | Verified (Linux runtime) |
| Configurable intensity | `modeManager.ts` attention profiles | Works | `intensity` sets both the ambient budget (staged `app.js` hook) and the proactive arbiter | Unit-tested plus Verified (Linux runtime) persistence |
| Quiet mode, reduced motion | — | Partial | Main process is now the source of truth, pushed to the renderer. The old desktop `quiet` preference was stored but never applied | Verified (Linux runtime) |
| Wake reaction | — | — | Poking while napping gives "Woken. Against policy." | Implemented (staged hook) |
| Personality | West Cat `questions.json` is cheerful ("You've got this!") | Incompatible tone | `core/persona.cjs`: restrained, no exclamation marks or emoji (enforced by a test) | Unit-tested |

## 3. Animation

| Capability | Reference | Dexter | Status |
|---|---|---|---|
| Frame clusters, easing, ZIP streaming | Reloaded `cluster_sync.py` (`ClusterSpec`, `out_back` easing) | Not imported. Dexter already has approved alpha WebM clips with poster fallbacks, which this would replace. **Excluded**: no working-asset replacement | Excluded with reason |
| Alpha video, still fallback, mirroring, reduced motion | — | Existing `src/cel-animation.mjs`, unchanged | Verified (Linux runtime) cel decode |

## 4. Communication

| Capability | Reference | Reference status (code) | Dexter | Status |
|---|---|---|---|---|
| Speech bubble anchored to the character | `ui.py` `SpeechBubbleWindow`, `west_cat_overlay/app/speech_bubble.py` | Works, as separate windows | In-window bubble with auto-dismiss, dismiss button and "Open conversation" | Verified (Linux runtime) |
| Conversation history | `storage.py` `save_history` | **Defect:** unbounded; the entire history is sent on every request; history saved by default | Max 100 messages; bounded context (12 by default); memory-only unless the user opts in; deleted when opt-in is turned off | Unit-tested plus Verified (Linux runtime) |
| Ollama health check, model list | `ollama_client.py` `list_models` | Works | `listModels`, `testConnection` | Unit-tested plus Verified (Linux runtime, fake server) |
| Endpoint configuration | `storage.py` `DEFAULT_OLLAMA_HOST = "http://100.67.12.66:11434"` | **Defect:** hardcoded personal Tailscale IP | Loopback default; remote requires a second opt-in; credentials, paths and queries rejected | Unit-tested plus Verified (Linux runtime) |
| Model fallback | `app.py` `resolve_preferred_model` (hardcoded gemma family) | Works, but vendor-biased | Configured, then `:latest`, then first installed; never downloads | Unit-tested |
| Streaming, cancel | `ollama_client.py` `stream_chat`, `cancel_current_request` | Works (thread plus closing the response) | AbortController; header, idle and total timeouts; 6000-character cap | Unit-tested plus Verified (Linux runtime) stream, cancel and offline |
| Settings path on Linux/Windows | `storage.py` `Path.getenv(...)` | **Defect:** `Path` has no `getenv`, so it crashes off macOS | n/a (Electron `userData`) | — |
| Piper TTS | `tts_integration.py` | **Defects:** `tts_enabled=True` by default; MD5 WAV cache kept in `~/.westcat`; voice list falls back to hardcoded names even without Piper | User-supplied absolute binary and `.onnx`; `shell:false`; 30 s timeout; temp file deleted; cancel | Unit-tested (fake spawn). Real Piper **unverified** (not installed here) |
| System TTS | — | — | On-device `speechSynthesis` voices only (`localService`) | Verified (Linux runtime): reaches `speaking` |
| Queue, volume, interrupt | `audio.py` | Single playback | `speech-queue.js`: max 3 pending, drop oldest, cancel, failure falls back to text | Unit-tested |
| Microphone / speech recognition | — | — | **Excluded**: needs separate explicit permission; permission handler refuses all | Excluded |

## 5. Interactive systems

| Capability | Reference | Reference status | Dexter | Status |
|---|---|---|---|---|
| Polls / question prompts | Reloaded `poll_overlay.py`; West Cat `prompt_engine.py` | **Defects:** `PromptEngine` reads key `prompts`, but `questions.json` uses `questions`, so it loads nothing. Poll answers are written to a cwd-relative `data/poll_responses.json` without consent | `core/persona.cjs` `CHECKINS`; answers never stored | Verified (Linux runtime) |
| Lightweight check-ins, scheduling | `tracker.py` session timers; logs to `data/log.jsonl` | Works, but logs activity to disk | One timer, ±10% jitter, quiet hours, deferral retry; nothing logged to disk | Unit-tested plus Verified (Linux runtime) forced check-in |
| Attention arbitration | `attentionEngine.ts` (pure, with reasons) | Works | `core/attention.cjs` `evaluateProactive` with reasons; shown in diagnostics | Unit-tested |
| Command drawer | `commandRouter.ts` (mock AI seam) | Works, but mock data | Slash commands in the conversation panel (`/help /treat /huff /nap /quiet /status /clear`); no permanent dashboard | Verified (Linux runtime) |
| Self-audit, status, event bus, exportable report | `selfAudit.ts` (audits mock collections) | Works, against mocks | `core/diagnostics.cjs` runs 11 live checks; `core/events.cjs` ring buffer; `/status`; export redacts text, paths, coordinates and remote hosts | Verified (Linux runtime): no FAIL, export contains no message text |
| Notifications | — | — | Non-intrusive bubble, gated by the arbiter; no OS notifications | Implemented |

## 6. Excluded with justification

| Item | Reason |
|---|---|
| Westcat_Familiar dashboard, mock data, mode panels, Fable routing | Dexter must stay a quiet companion, not a dashboard. Mock data violates evidence honesty. |
| Reloaded multi-window networking, Bryan demo parser | Not useful for a single-user local familiar. |
| Global hotkeys, activity/idle tracking, app or window observation | The brief and the product law forbid implicit monitoring. Dexter sees only clicks on himself and his own lifecycle. |
| `sandbox:false` (Westcat_Familiar) | Weaker isolation. All Dexter renderers are sandboxed and context-isolated, and the self-audit checks it. |
| Automatic model download / cloud APIs | Forbidden by the brief. |
| Visible on all Spaces / full-screen apps (macOS) | Changes activation policy on macOS; deferred until it can be tested physically. |

## Round 2 (desktop 0.3.0-alpha.1): the remaining WestCat features

The owner asked for every remaining WestCat feature to be implemented. Status after PR #12:

| WestCat feature (source) | Dexter implementation | Status |
|---|---|---|
| Inspection dashboard: Dexter Inspect, stack status, self-audit view (Westcat_Familiar) | `ui/inspector.*`: an on-demand window with live data and evidence-tier labels | Verified (Linux runtime) |
| Evidence tiers (Westcat_Familiar `evidence.ts`) | Inspector labels each reading verified, configured or inferred | Implemented |
| Named modes (Westcat_Familiar `modeManager.ts`) | `core/modes.cjs`: plain, work, build, crisis, dex and quiet. Each layers changes over your settings without rewriting them | Unit-tested and Verified (Linux runtime) |
| 10-state machine with transitions and auto-return (`familiarStateMachine.ts`) | `core/states.cjs`, mapped onto Dexter's 9 visual states | Unit-tested and Verified (Linux runtime) |
| Command router (`commandRouter.ts`) | `core/router.cjs`: slash commands, then natural-language intents, then your local model, then an offline reply | Unit-tested and Verified (Linux runtime) |
| Continuity firewall and long-term memory (`continuityFirewall.ts`) | `core/memory.cjs`: notes you write yourself; they reach the model only if you allow it, and each crossing is counted | Verified (Linux runtime) against the fake model, both closed and open |
| Context packet (`packetForge.ts`) | `core/packet.cjs`, exported with `/packet` or the panel button as Markdown or JSON | Verified (Linux runtime) |
| Global summon hotkey (future seam) | Opt-in; one combination from a fixed list | Verified (Linux runtime) registers and releases; **macOS physical-unverified** |
| Question and quick-question editors (Reloaded) | Settings editor with follow-ups, plus `/ask` | Verified (Linux runtime) |
| Poll response recording (Reloaded) | Opt-in journal, 0600 file, bounded, deleted when switched off | Verified (Linux runtime) |
| Typewriter text, drop-in animation, sneeze (Reloaded) | Typewriter bubbles and easing tricks; skipped under reduced motion | Verified (Linux runtime) |
| Dev panel opened by 5 clicks (Reloaded) | Developer menu opened by 5 quick pokes; only when enabled | Verified (Linux runtime): the menu exists only when enabled |
| Scripted conversation playback (Reloaded Bryan demo) | `core/scripts.cjs`: a Dexter demonstration | Verified (Linux runtime) |
| Separate bubble and input windows, saved positions, snap to cat (WestCat macOS) | Optional detached bubble window; the conversation panel remembers its geometry; Snap | Verified (Linux runtime) |
| Compact mode, retry, Ctrl+Shift+K, last reply on start (WestCat macOS) | All implemented; the shortcut is the opt-in global hotkey | Verified (Linux runtime), except last reply on start (Implemented) |
| Animation speed (WestCat macOS) | Setting applies to video clips and CSS/WAAPI animations | Implemented |
| Piper voice list and TTS cache (WestCat macOS) | Voice folder picker; opt-in SHA-256 LRU cache | Unit-tested; voice listing Verified (Linux runtime) |
| Sessions with cadence and summaries (west_cat_overlay `tracker.py`) | `core/session.cjs`: start, pause, resume and end; halfway and end remarks; session check-in rhythm | Unit-tested and Verified (Linux runtime) with a 3-second session |
| Questions with follow-ups (west_cat_overlay `questions.json`) | Built-in and custom follow-ups, in Dexter's voice | Verified (Linux runtime) |
| Microphone / speech input (previously excluded) | Push-to-talk through your own whisper.cpp; permission limited to the panel, audio only, while enabled; usage string in Info.plist | Verified (Linux runtime) with a fake whisper.cpp; **real microphone and macOS permission prompt physical-unverified** |
| All Spaces / full screen | Opt-in | **macOS physical-unverified** |
| Native notifications | Opt-in, only when Dexter is hidden | Implemented; not supported on the Linux CI runner; **macOS physical-unverified** |

### Still excluded, with the owner informed

| Item | Reason |
|---|---|
| Allowlisted shell execution (Westcat_Familiar future seam) | With a model in the loop, a prompt injection becomes code execution on the Mac. WestCat never shipped it either. |
| Fable / cloud model routing | The brief forbids automatic external API calls. The router only uses local paths. |
| Hardcoded Tailscale host (WestCat macOS) | The brief forbids personal IPs. A remote host is already possible through explicit opt-in. |
| Mock data collections | Replaced by real data in the Inspector. |
| Multi-window network sync (Reloaded), SVG vectorize tools (west_cat_overlay) | No function for a single local familiar with raster art. |
