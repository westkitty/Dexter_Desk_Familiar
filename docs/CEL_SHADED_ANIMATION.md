# Accepted cel-shaded Dexter — opt-in feature integration

## Provenance and scope

- Eight distinct source WebM files originated in Dexter_Desk_Familiar_Finished_Animations and were accepted by the owner in the 2026-10-31 project conversation. The three previous creative holds (treat_lick, sit_down, sleep_loop) are now accepted.
- The copied WebM video bytes are exactly locked via SHA-256 in tests/cel-animation.test.mjs. No video was re-rendered or recolored for this feature.
- Source artwork is **not** declared the default character canon; existing 96px artwork stays the default, and the unapproved 32px SNES atlas remains independent.
- This work does not touch WESTCAT or sibling repos.

## Runtime selection

Settings -> **Approved cel-shaded Dexter** (off at launch and after reload). Activating it disables the 32px atlas candidate, but never deletes the atlas or default sprites. A menu allows automatic state-following or isolated preview of every named clip.

| Trigger | Clip |
| --- | --- |
| Watching state | head_tilt |
| Judging state | slow_blink |
| Returning from working/wandering to seated | sit_down |
| Wandering state | stretch |
| Resting state | lie_down |
| Sleeping from seated state | lie_down then sleep_loop |
| Sleeping from rest | sleep_loop |
| First/repeated Treat action | Alternating treat_lick / tail_wag |
| Idle/working/huffing without a matching clip | Local cel-shaded still (never external art) |

## Browser, privacy, and power gates

- The renderer uses one muted HTML video element, loop flags for only tail_wag and sleep_loop, and CSS-native scaling. It pauses on document hide and disposes on pagehide.
- The clip remains hidden while its initial decoded frame is tested for transparent corners. If codec or alpha is unsupported, a packaged local poster remains visible; **never show an opaque WebM matte**.
- Reduced motion uses static art; Quiet Mode suppresses ambient video, while direct manual inspection may play unless reduced motion is enabled.
- No new localStorage fields. No runtime AI, CDN, external media URLs, app-wide typing observation or OS access.
- Both pixels and HTML video remain same-origin and precached as part of the offline service-worker shell. The explicit build budget remains 2 MiB.
- Chromium and Playwright WebKit behavior tested on Big Mac; native macOS Safari and real phone/tablet browsers remain unverified.

## Release/QA boundaries

- npm run check covers code, 64 Node tests (58 preexisting + 6 new), 36-file release allowlist, 2-MiB budget and SHA-256 of every packaged file.
- Playwright covers art-mode exclusivity, reset, no off-origin traffic, keyboard/typing privacy regression, offline caching and reload, reduced-motion/quiet behavior, and alpha/fallback. Chromium verifies real VP9 alpha rendering and lie-down-to-sleep transition; WebKit verifies static fallback or proven alpha, not native Safari.
- The earlier sit-down geometry mismatch is a known visual limitation accepted artistically; do not claim pixel-identical seamless 96px-to-cel transitions. Both art systems are isolated to avoid mixing them frame-by-frame.
- Do not publish or promote this branch until exact-head CI, deployment approval and release checks are complete.
