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
- Parent access by reference + normalized phone + random recovery code; session scoping; administrator-controlled recovery invalidates old sessions.
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
- Success reference and recovery code, followed by mandatory dress-code guide.
- Returning-parent login, adding four guardians, RM220 summary, same-reference update.
- A dummy PNG receipt uploaded through the UI to the existing registration; successful receipt state observed.
- Student and guardian full-body guide, mobile carousel, optional-blazer wording.
- Admin dashboard totals and class filter, using dummy records only.

Screenshots in the parent `qa-screenshots` directory contain dummy data, not the real roster.

## Not yet verified; no claim of live completion

- Google Drive folder creation and application database writes: blocked by insufficient Editor rights in supplied folder.
- Real Apps Script deployment under chosen owner; restricted Drive permissions and atomic Sheets behavior in Google's live runtime.
- Cloudflare deployment and real Google OAuth client configuration.
- GitHub source push and GitHub Pages deployment: connected account lacks write permission.
- Live phone/tablet tests against the final public URL, real receipt storage, quota transitions and administrator sign-in.
- End-to-end initial-registration receipt branch in a real production browser; the registration/upload domain, HTTP sequence and returning-upload UI were tested locally, but that does not replace live testing.

No real receipts or payment records were used for tests. No real student details were deployed or included in public build files.

## Policies intentionally taken from latest master

Registrations reserve guardian seats immediately; verification moves seats to confirmed; no automatic expiry; manual releases require an organizer reason. The initial configurable form limit is four guardians. These are the latest master instructions. The older poster's no per-student guardian cap wording and payment-priority wording should be read alongside these configured portal rules before public communication; the approved poster has not been silently changed.

## Launch gate

Keep production registration closed until access issues are resolved, the actual bank details/reference are read back, private storage is verified, dummy integration tests pass on Google/Cloudflare, and the final live application is inspected. A successful local preview is not a successful production deployment.
