# Dexter Desktop — target MacBook acceptance checklist

**Artifact:** `Dexter_Desk_Familiar_macOS_arm64_unsigned_alpha.zip` from the Dexter desktop GitHub Actions run associated with draft PR #9. The artifact supplied by Actions is an **outer archive** containing this ZIP and its `.sha256` proof. It is an unsigned internal **test build**, not a public, notarized release.

## Acquire and verify

1. Open [the draft desktop PR](https://github.com/westkitty/Dexter_Desk_Familiar/pull/9), select its **Checks** tab, open the **Dexter desktop macOS alpha checks** workflow run and download its `Dexter-Desktop-macOS-arm64-unsigned-alpha-pr9-*` artifact. A GitHub sign-in may be required.
2. Unzip the downloaded **Actions artifact**. Verify the inner ZIP using the provided `.sha256` checksum:
   ```sh
   shasum -a 256 -c Dexter_Desk_Familiar_macOS_arm64_unsigned_alpha.zip.sha256
   ```
3. Extract the inner `Dexter_Desk_Familiar_macOS_arm64_unsigned_alpha.zip`, then move `Dexter Desk Familiar.app` into `~/Applications` (or `/Applications` if preferred).
4. The app is unsigned and not notarized. macOS Gatekeeper may stop first launch. Do **not** globally disable Gatekeeper or use a blanket `xattr -dr` command. If you decide to trust this specific tested bundle, attempt opening it and use macOS **System Settings → Privacy & Security → Open Anyway** where macOS offers that choice.

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

Record: macOS version, Mac architecture, exact ZIP SHA, expected versus observed behavior, repeat steps, timestamp, and (if possible) a small screen capture with personal information removed. Do not expose Terminal secrets, system paths or private content.

**No automatic promotion:** Passing source tests or macOS CI does not replace physical click-through proof. Only advance PR #9 from draft after reviewing target MacBook results. Signing and notarization require an additional authorized release procedure.
