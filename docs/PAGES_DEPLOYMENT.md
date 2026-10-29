# GitHub Pages deployment — Dexter Desk Familiar

Repository remains private: `westkitty/Dexter_Desk_Familiar`. The published website, once enabled, is public.

## Deployment model

Pushing `main` triggers `.github/workflows/deploy-pages.yml`: validate and build the source, upload **only** the allowlisted `dist/` folder, and deploy through official GitHub Actions.

Expected project site after a successful deployment:
`https://westkitty.github.io/Dexter_Desk_Familiar/`

This URL is **not evidence** of an active site; confirm the Pages deployment result and HTTPS response.

## One-time GitHub Pages setting (if missing)

Repository **Settings → Pages → Build and deployment → Source → GitHub Actions**.

Private repositories require a Pages-eligible GitHub plan. Keep this source repository private; do not make it public without a separate decision.

## Proof before calling this site live

1. GitHub Actions deployment job reports success and a page URL.
2. Published HTTPS root responds with the expected HTML, CSS, scripts and icons.
3. Check privacy boundaries and real browser install/offline behavior.
4. Keep the visual/canonical final-art approval and 32×32 animation sheet as separate release gates.

Publishing a website is different from local-only usage: a visitor's browser must contact GitHub to download the initial static files. No application telemetry is introduced.
