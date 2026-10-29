# GitHub Pages — Dexter Desk Familiar

## Current verified state (2026-10-29)

- Site: https://westkitty.github.io/Dexter_Desk_Familiar/
- Repository: `westkitty/Dexter_Desk_Familiar`, **PUBLIC** (observed via GitHub API).
- Pages mode: `workflow` (observed using authenticated `westkitty` GitHub CLI).
- Deployment: **SUCCESS** https://github.com/westkitty/Dexter_Desk_Familiar/actions/runs/40846064963
- Published `main` commit: `ad6e2433597303a415e878d3e9e9bff661c523e9`.
- External HTTPS from Big Mac: site/index 200, app.js 200, src/animation.mjs 200, assets/dexter-snes-32-candidate.png 200.
- Hosted site exclusion checks: README.md and OPERATIONAL_STATE.md returned HTTP 404. This does **not** hide them from the public GitHub repository.

## Deployment contract

`.github/workflows/deploy-pages.yml` runs on pushes to `main` and manual dispatch. It validates source and builds the allowlisted `dist/`, uploads only that directory, and uses `actions/deploy-pages@v4` with `pages: write` and `id-token: write` permissions. Pages source is **GitHub Actions**. Do not switch back to legacy branch/Jekyll publishing: that would bypass the allowlisted release artifact.

## Remaining release gates

- Manual Mac Safari and mobile touch accessibility, assistive technology and long-session validation.
- Final approved Dexter visual identity. The 32px atlas stays opt-in and unapproved.
- Real cross-version service-worker update/rollback test and reproducible v1.0 release.

Pages hosting and a public repository both expose information to the internet; the app itself does not introduce analytics, accounts or third-party scripts. Initial HTTP retrieval and browser-managed worker update checks contact the Pages host.

Prior failure runs (e.g. 40842942407) occurred before Pages was configured. They are historical evidence, not the present deployment status.
