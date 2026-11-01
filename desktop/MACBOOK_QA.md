# Dexter Desktop — target MacBook acceptance checklist

**Important:** The earlier `...unsigned_alpha.dmg` had a *broken code signature* despite correct DMG integrity. Do not reuse it or assume its SHA-256 applies to the replacement.

**Preferred repaired artifact:** `Dexter_Desk_Familiar_macOS_arm64_adhoc_alpha.dmg`. This is an **ad-hoc-signed internal alpha review build** from draft PR #9, not an Apple Developer ID signed/notarized public release. The previous ZIP-only alpha remains an alternative.

## Acquire and verify

1. Download the `.dmg` and its matching `.dmg.sha256` through ChatGPT, or open [the desktop PR's Checks tab](https://github.com/westkitty/Dexter_Desk_Familiar/pull/9) and download a successful `Dexter-Desktop-macOS-arm64-adhoc-DMG-pr9-*` artifact. GitHub Actions downloads arrive as an **outer ZIP** containing the DMG and checksum.
2. With both files in the same folder, verify:
   ```sh
   shasum -a 256 -c Dexter_Desk_Familiar_macOS_arm64_adhoc_alpha.dmg.sha256
   ```
3. Open the DMG. Drag **Dexter Desk Familiar.app** onto the **Applications** shortcut in the mounted volume. Eject the volume before starting the copied application.
4. The app has a valid ad-hoc resource signature but is **not Developer ID signed or notarized**. macOS Gatekeeper may stop first launch. Do **not** globally disable Gatekeeper or run a blanket `xattr -dr` command. If you trust this specific verified review build, open the copied app and use **System Settings → Privacy & Security → Open Anyway** if macOS offers that option.
5. If macOS still says **damaged** after a verified download, stop. Do not bypass Gatekeeper generally; collect the exact error and run `codesign --verify --deep --strict -v "/Applications/Dexter Desk Familiar.app"` before making any trust exception.
6. For the older ZIP alternative, verify its own `.zip.sha256`, extract the application, and move it to Applications; never mix the ZIP and DMG checksums.

## Essential real-device acceptance

- [ ] On launching, only Dexter appears in a small transparent floating window; there is **no opaque rectangle**.
- [ ] Hover/click Dexter's *visible body*: one tap gives a reaction and holding+dragging moves the entire window.
- [ ] Click visibly empty pixels **inside the sprite's former rectangular bounds**: the application below receives the click, not Dexter. Check with ordinary, non-destructive desktop content.
- [ ] Right-click Dexter: treat, huff, nap, original pixel/cel modes, flip, size, opacity, always-on-top, and click-through all work.
- [ ] Choose **Pass through all clicks**. Recover Dexter from the macOS menu-bar icon without terminating him.
- [ ] Hide and show through the menu-bar icon. Quit from that menu; relaunch and verify saved position, size, opacity, flip and preferred art.
- [ ] Test on a second display if available; Dexter stays within a work area and can be moved.
- [ ] Enable macOS **Reduce Motion**: animations do not override that preference and the still image remains.
- [ ] Enable **VoiceOver** and verify usable controls through the menu-bar menu. Record any missing accessible labels.
- [ ] Leave Dexter running for at least 30–60 minutes during normal work and note heat/CPU/memory drift.

## Report failures with evidence

Record: macOS version, Mac architecture, exact DMG SHA-256 (or ZIP SHA for the ZIP route), expected versus observed behavior, repeat steps, timestamp, and (if possible) a small screen capture with personal information removed. Do not expose Terminal secrets, system paths or private content.

**No automatic promotion:** Passing source tests or macOS CI does not replace physical click-through proof. Only advance PR #9 from draft after reviewing target MacBook results. Signing and notarization require an additional authorized release procedure.
