# Candidate 32px Dexter animation atlas — NOT canon-approved

## Byte-level source

- Source repository: `westkitty/SNES_Dex` (public).
- Inspected source revision: `bdb16fa454de5533ca5bedfcd90dd93ea7b3448e`.
- Original path: `original/dexter_sprites.png`.
- Exact Git blob SHA: `ee2e34f8c773e03846ce2800280328f3464a9603`.
- Destination: `assets/dexter-snes-32-candidate.png` in `westkitty/Dexter_Desk_Familiar`, identical Git blob SHA. No changes to pixel data.
- Geometry: 192×160 pixels, 6 columns and 5 rows of 32×32, confirmed in `SNES_Dex/src/game.js` drawPlayer implementation.

## Existing semantic frame rows

| Row | Original meaning | Frames sampled |
| --- | --- | --- |
| 0 | Idle | 0–3 |
| 1 | Walk | 0–5 |
| 2 | Sniff | 0–3 |
| 3 | Bark | 0–3 |
| 4 | Unimpressed | 0–3 |

Frame mapping is versioned in `src/animation.mjs`. Idle/observe/judge/wander/huff states map into matching source rows. Sleep, rest, work, and eating intentionally retain the existing 96px visual fallback when the preview follows Dexter. An inspector may manually choose any of the five clips.

## Non-approval and gating

This image comes from another user-owned project but is **not confirmed canonical** for Dexter Desk Familiar. It is bundled as an opt-in evaluation candidate only. The toggle defaults off on every page load and is not persisted. The 96px poses remain the default, cannot be replaced by an automatic or failure path, and must survive disabling the preview, image errors, sleep, and network loss.

Before promotion to default: verify approved original reference images, compare exact markings/silhouette at 1× and 3×, check every frame for drift, verify different state meanings and reduced-motion/keyboard parity, and obtain explicit user approval for this exact image. Do not infer approval from repository ownership or filenames.

## Privacy and runtime

Pure same-origin raster, no external imports, runtime dependencies, telemetry, AI services, or permission changes. Asset bytes are enforced by `tests/asset-provenance.test.mjs`, geometry/PNG integrity by `tests/png-integrity.test.mjs` and `tests/animation.test.mjs`; offline service-worker completeness by the existing lifecycle tests. A browser test additionally verifies canvas/fallback transitions.
