# Dexter Desktop 0.2.0-alpha.1 — physical MacBook acceptance

CI drives the real app with synthetic in-app events. **It cannot prove physical mouse click-through, real focus behavior, multi-monitor hardware, VoiceOver, Gatekeeper first launch, or long-session energy use.** Only these checks can. Record each result with the DMG's SHA-256, the macOS version and the Mac model.

Do not reuse the older `…unsigned_alpha.dmg`; its signature was broken. Every DMG has its own checksum.

## A. Install (Gatekeeper path)

- [ ] `shasum -a 256 -c Dexter_Desk_Familiar_0.2.0-alpha.1_macOS_arm64_adhoc.dmg.sha256` prints `OK`.
- [ ] The DMG window shows exactly **Dexter Desk Familiar** and an **Applications** shortcut. Drag the app across, then eject.
- [ ] First open: note the exact Gatekeeper message. Approve through **System Settings → Privacy & Security → Open Anyway** only. Do not disable Gatekeeper and do not use `xattr -dr`.
- [ ] If macOS says **damaged**, stop and record `codesign --verify --deep --strict -v "/Applications/Dexter Desk Familiar.app"`.
- [ ] The menu-bar icon appears. The Dock icon is shown by default.

## B. Overlay and pointer (the highest-risk item)

- [ ] Dexter appears with **no opaque rectangle** behind him, in both pixel and cel art modes.
- [ ] Put a Finder window under Dexter. Clicking **transparent pixels inside his rectangle**, including the empty space above his head, selects Finder items, not Dexter.
- [ ] Clicking his **visible body** pokes him. Three quick pokes escalate to a formal complaint.
- [ ] Dragging his body moves the whole window smoothly, and it stays inside the screen edges and the menu-bar/Dock work area.
- [ ] Type in TextEdit, click Dexter, and keep typing: **the text keeps going into TextEdit** (Never take keyboard focus is on by default).
- [ ] Right-click opens his menu. Check Treat, Huff, Nap, then poke while napping ("Woken. Against policy."), appearance, flip, size, opacity, always on top.
- [ ] Turn on **Pass through all clicks**. Dexter ignores all clicks. Menu-bar icon → **Restore Dexter** makes him clickable again.
- [ ] Set opacity to 55%, quit and relaunch. Also confirm Settings won't go below 40%.

## C. Displays, sleep and relaunch

- [ ] With a second display: drag Dexter onto it, quit, relaunch. He reappears there.
- [ ] Unplug that display while Dexter is on it. Within about a second he moves onto the remaining screen.
- [ ] Change the display resolution. Dexter stays fully visible.
- [ ] Sleep and wake the Mac. Dexter is still on screen. With event reactions on, he may say he kept the desk; this is budget-limited.
- [ ] Quit from the menu bar and reopen. Position, size, opacity, flip, art, quiet and intensity are all restored, and click-through is off.
- [ ] Open the app again while it is already running. No second Dexter appears; the existing one is restored.

## D. Conversation, AI and speech

- [ ] **Talk to Dexter…** opens a panel beside him, not covering him. Esc closes it. Enter sends.
- [ ] With Local AI off: `/status`, `/treat` and `hello?` work, and Settings → Diagnostics → self-audit shows 0 model requests.
- [ ] Optional, if you run Ollama locally: enable Local AI (a confirmation appears), **Test connection**, then ask a question. Tokens stream in. **Stop** cancels. Stopping Ollama shows "AI offline" and local replies keep working.
- [ ] Settings → Sound & speech: enable speech, **Test voice**, adjust volume and rate, **Stop speaking**. Disabling speech stops it immediately.
- [ ] Check-ins: Settings → Check-ins → **Show one now**. Answer with a mouse click on a choice.

## E. Accessibility

- [ ] Turn on macOS **Reduce Motion** with Settings → Animation set to *Follow macOS*. There are no patrols or video, and still poses are used.
- [ ] Turn on **VoiceOver**. The menu-bar menu items are announced and usable. The Settings window can be navigated with Tab and VO keys, and every control has a spoken label. Conversation replies are announced.
- [ ] Turn on **Increase Contrast**, plus Settings → Accessibility → High-contrast bubbles and Large text. Bubbles are readable and do not cover Dexter's face.

## F. Resources (MacBook Air M1, 8 GB)

- [ ] Leave Dexter idle for 60 minutes during normal work. Note Activity Monitor CPU % and memory for "Dexter Desk Familiar" and its helpers at 5 and 60 minutes. Expected: near 0% CPU at idle and no steady memory growth.
- [ ] Open and close the conversation panel 10 times. Memory returns to about the idle level.
- [ ] Optional: watch network traffic with Little Snitch, LuLu or `nettop -p <pid>` while Local AI is off. Expect no connections.

## Reporting

Note the macOS version, Mac model, DMG SHA-256, the checklist item, what you expected and what you observed, and the steps to reproduce. Attach **Settings → Diagnostics → Export report…**; it contains no conversation text, paths or coordinates. Only after sections A–C pass should the desktop PRs leave draft. Developer ID signing and notarization are a separate, authorized release step.
