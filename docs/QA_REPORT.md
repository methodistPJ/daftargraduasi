# Name lookup update — 28 October 2026

Latest checks: 73 automated tests, 15 loopback HTTP scenarios, and browser verification of an existing registered pupil, an unregistered pupil, carrying the selected name into registration, and successful registration without a reference/code. Real API results are in QA_NAME_LOOKUP_LIVE.json. No dummy registrations are submitted to production. Previous deployment-stage integration results below are historical.

# QA report — 28 October 2026

## Verified locally

**69 automated tests passed** across domain rules, the real Apps Script handler executed against mocked Google services, and the Cloudflare gateway executed in Node's Web API runtime.

**15 loopback HTTP integration scenarios passed** against the isolated dummy-data preview. Full results: QA_HTTP_RESULT.json.

Covered behavior:

- Partial-name student matching with class and six-result bound; unknown/short queries rejected.
- Student-only RM100, one guardian RM130, four guardians RM220.
- Invalid phones/names/guardian IDs rejected; duplicate student registrations and retry duplication prevented.
- Reserved/confirmed/available arithmetic; final-seat concurrent requests serialized; full quota still permits student-only registration.
- Receipt upload remains pending, does not reserve twice, and is idempotent.
- Byte-signature MIME validation, size limits, PNG dimension limits, active-PDF rejection and duplicate-receipt hash checks.
- Verification, partial payments, additional RM30, payment history, overpayment preservation and no automatic refund.
- Parent access by selected student name/class; registered and unregistered paths; existing records and quota preserved; parent session scoping.
- Allowlisted admin identity and actual RSA Google-token signature validation; invalid algorithm/audience and fake tokens rejected.
- HMAC verification and nonce replay protection in actual Apps Script handler; lock released on failures; server-side search rate limiting.
- Drive permission pagination, original-roster/database separation and restricted workbook parent checks.
- Stable roster IDs across class correction, separate same-name pupils across classes, Unicode-safe state chunks.
- One atomic Sheets batch for all mirrors and canonical state; literal string cells cannot become formulas.
- Ambiguous receipt commit reconciles through fresh Sheets REST state and retains a committed file.
- Malaysia-time payment deadline; contact edits allowed after closure, added seats denied.
- Bounded streamed Worker request bodies, strict CORS, no-store responses, safe upstream errors.

## Browser verification actually performed

The local app was opened in the Codex browser and inspected through DOM/accessibility state and screenshots.

- Desktop landing composition and exact approved logo.
- Phone viewport 390 × 844 and tablet viewport 768 × 1024, using a same-origin viewport harness. Harness is excluded from production build.
- Student search, class selection, student-only fee and deferred receipt registration.
- Success confirmation without reference or access code, followed by the dress-code guide.
- Returning-parent login, adding four guardians, RM220 summary, same-reference update.
- A dummy PNG receipt uploaded through the UI to the existing registration; successful receipt state observed.
- Student and guardian full-body guide, mobile carousel, optional-blazer wording.
- Admin dashboard totals and class filter, using dummy records only.

User-facing screenshots show the public portal, dummy test screens or an organizer dashboard without student-name rows.

## Verified on the deployed system

Public URL: https://methodistpj.github.io/daftargraduasi/

Eight integration scenarios passed against real Cloudflare Workers, Apps Script, Sheets and restricted Drive using a separate dummy workbook and receipt folder. See QA_LIVE_INTEGRATION_RESULT.json. Concurrent identical registrations held seats once; the former parent recovery flow worked in that historical integration run; a real dummy PNG was privately stored and its retry created one pending payment; guardian updates retained receipt history; duplicate registration was rejected; student-only registration did not use seats; unauthorized admin and foreign-origin access were denied.

The production workbook was restored with 56 active students, zero test registrations and 100 available guardian places. Bank details and the required reference were read back through the real API. The original roster was untouched. A native source snapshot and private backup were created.

GitHub Pages deployment passed. Real Google sign-in to the allowlisted organizer account reached the dashboard. The organizer Backup action succeeded and was audited against the real account; bank/quota settings were verified and registration was opened through the organizer interface.

The live parent UI was inspected through student search and a four-guardian RM220 payment summary, then closed without submitting test records. The actual site was rendered in 390px and 768px iframe viewports; document widths matched the viewport widths with no horizontal overflow. Dress-code guide layout and illustration loading were inspected.

Real bank transactions were not performed. Payment verification and quota-transition rules were exercised with dummy data in the automated/local tests; the live integration used dummy receipt submissions. No real family receipt was used as test data.

## Policies intentionally taken from latest master

Registrations reserve guardian seats immediately; verification moves seats to confirmed; no automatic expiry; manual releases require an organizer reason. The initial configurable form limit is four guardians. These are the latest master instructions. The older poster's no per-student guardian cap wording and payment-priority wording should be read alongside these configured portal rules before public communication; the approved poster has not been silently changed.

## Launch status

The storage, bank/reference, live integration, organizer sign-in and frontend checks passed. Production registration was opened on 28 October 2026. No test registration was submitted against the real student roster.
