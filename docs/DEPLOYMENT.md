# Deployment and access handoff

The agent continues these routine setup steps once the owner provides the missing access. The owner is not expected to write code, create database columns or manually register students.

## Required access

- Google owner: g-49369646@moe-dl.edu.my with Editor rights on the supplied GRADUASI 2026 folder.
- GitHub: write access to methodistPJ/daftargraduasi and ability to enable Pages/Actions. Browser/CLI identity methodistPJ now has confirmed write/admin access. The older connector identity may still differ.
- Cloudflare: an authorized Workers deployment session/account. Free-tier target; no paid purchase is authorized or required by this source.
- Apps Script and Google sign-in client under the selected Google owner. The existing machine's unrelated Apps Script credential must not be used to deploy under a different owner.

## Google project setup

1. Inspect the supplied parent folder, reuse any previously created subfolders, and create only missing DATABASE, PAYMENT_RECEIPTS, BRAND_ASSETS, REPORTS_EXPORTS, DOCUMENTATION and BACKUPS.
2. Enable limited access on DATABASE, PAYMENT_RECEIPTS, REPORTS_EXPORTS and BACKUPS. Verify every permission page. Only the owner and explicit allowlisted organizer users can access data. Inherited metadata-only visibility does not grant file-content access.
3. Keep the application workbook separate from the official source. Preserve a native copy of the official source as ROSTER_SNAPSHOT in the restricted DATABASE folder; never write application tables into the original source file.
4. The source's actual layout is headerless: student name in A, class in B, tab Sheet1. Sync reads the original source rather than treating its copied snapshot as authoritative.
5. Create the Apps Script project under the selected owner and push appsscript.json, Code.gs and generated Domain.gs from backend/apps-script after npm run build. Enable the Drive v3 and Sheets v4 advanced services declared in the manifest so REST calls can use the default Apps Script Cloud project.
6. Configure Script Properties privately:

| Property | Meaning |
|---|---|
| PARENT_FOLDER_ID | Supplied project folder ID |
| SOURCE_SPREADSHEET_ID | Actual official roster ID |
| SOURCE_SHEET_NAME | Sheet1, verified from metadata |
| APP_SPREADSHEET_ID | New private application workbook ID |
| GATEWAY_SECRET | Cryptographically random secret, at least 32 characters; same secret in Worker |
| ADMIN_EMAILS | Comma-separated organizer allowlist, initially selected owner |

initializePortal creates/verifies needed folder IDs and sheets, imports stable student IDs, audits the import and leaves registration closed. Its returned roster count must be 56 unless the official source changes.

7. Authorize the real owner account, run initializePortal, and deploy as a web app executing as the owner. Only HMAC-signed gateway POSTs can reach application data. doGet exposes service readiness only. API URL goes into a Worker secret, never frontend.
8. Confirm the actual workbook is private, inside restricted DATABASE and distinct from the source. This is enforced again by runtime checks. Do not claim private storage from folder location alone.

## Cloudflare gateway

Deploy gateway/worker.mjs with gateway/wrangler.jsonc. Keep ALLOWED_ORIGINS as the exact production GitHub Pages origin. Supply APPS_SCRIPT_URL, GATEWAY_SECRET, ADMIN_GOOGLE_CLIENT_ID and ADMIN_EMAILS using runtime secrets, not Git or shell arguments. Configure the rate-limit binding from the provided manifest.

Use an appropriate Google web sign-in client with the deployed Pages origin. Admin tokens are verified for RSA signature, issuer, audience, expiration, verified email and allowlist. No hardcoded administrator password exists.

## GitHub Pages

Push the reviewed source, configure Pages to use GitHub Actions, and set repository variables TWY_API_BASE and TWY_GOOGLE_CLIENT_ID. The existing workflow tests, checks, builds and uploads dist. Use the Pages URL returned by the actual deployment; do not infer a successful deployment from the proposed URL.

Do not deploy an untested app with the real roster. Before opening registration, test the real Google/Cloudflare integration with a separate dummy workbook/receipt folder and confirm that production frontend never bundles student records.

## Bank values supplied by owner

- Bank: CIMB BANK
- Holder: PIBG SK METHODIST PJ
- Account: 8003392687
- Required transfer reference: **123 GRADUASI**
- QR: none

Verify these in the actual SETTINGS tab, parent summary and returning-parent page. Registration numbers TWY26-xxxx remain separate application references.

## Recovery

Keep an access-status note with actual created IDs and returned deployment IDs in private workspace state; never predict IDs or recreate uncertain operations. On failure, inspect first and resume the same project/deployment. Back up the private application workbook before replacing a runtime version. Restore canonical STATE_STORE and mirrors together from a validated backup under the script lock; never paste sensitive snapshots into a public issue or repository.
