# The Wonder Years 2026 — Graduation Portal

Production target: GitHub Pages frontend → Cloudflare Workers gateway → Google Apps Script → Google Sheets / restricted Google Drive.

This source contains no real student roster, phone list, authentication tokens, gateway secret or receipts. The actual supplied roster remains in its original Drive spreadsheet. The source code's local-preview fixtures are clearly labelled dummy data and never used as a production fallback.

## Local commands

Requires Node.js 22 or later. No npm dependencies are required for local preview or the test suite.

```text
npm test
npm run check
npm run build
npm run dev
```

Preview: `http://127.0.0.1:4173`. It binds loopback only, stores dummy data in memory, and resets on restart. Its test-only administrator entry is unavailable in production; the production Worker requires a verified allowlisted Google ID token.

`node scripts/qa-http.mjs` runs integration scenarios only against a fresh loopback preview. Never point it at a live system. It intentionally refuses non-loopback destinations.

## Structure

| Directory | Purpose |
|---|---|
| frontend | Mobile-first portal and secure admin UI |
| backend/domain.js | Deterministic fee, quota, registration and payment rules |
| backend/apps-script | Apps Script adapter, manifest and generated Domain.gs |
| gateway | Signed proxy, request limits, CORS and Google token verification |
| scripts | Build, static privacy check, dummy preview and HTTP QA |
| tests | Domain, gateway and actual Apps Script adapter tests with mocked services |
| docs | Deployment, operations, data model, QA and privacy notes |

## Production configuration

Public build settings: `TWY_API_BASE` (HTTPS Worker `/api` endpoint), `TWY_GOOGLE_CLIENT_ID` (public Google sign-in client ID). These are GitHub repository variables, not secrets. `npm run build` writes only these public settings into `dist/config.js` and removes viewport-QA harness files.

Private configuration is stored in Cloudflare secrets and Apps Script Script Properties. See `docs/DEPLOYMENT.md`. Never publish a `.clasprc.json`, `.dev.vars`, receipt, canonical state snapshot or the official student roster.

The default production registration setting is closed. A missing API produces a clear unavailable state rather than fake availability or a simulated successful registration.
