# Data model and security

## Identity and persistence

STUDENTS contains immutable internal ID, official display name, class and active status. Original roster is the identity authority. IDs are derived from source/class/name on first import, then preserved across unique name/class corrections. Ambiguous same-name records do not silently merge.

REGISTRATIONS links one active registration to one student; GUARDIANS holds stable IDs with active/inactive history. PAYMENTS preserves each submission and its PENDING / VERIFIED / REJECTED state. RECEIPTS stores private Drive IDs and byte hashes. SETTINGS stores event and payment configuration. AUDIT_LOG stores actor, time, action and a minimal summary. Hidden STATE_STORE contains the canonical revision, sessions and idempotency metadata in Unicode-safe chunks.

All mutations operate on a cloned state inside LockService.getScriptLock(). One Google Sheets batchUpdate commits all mirrored tables and canonical state atomically. A failed operation does not consume seats. A receipt file created before a failed state commit is reconciled through a fresh REST state read; ambiguous files are retained rather than deleting a potentially committed receipt.

## Guardian quota

AVAILABLE = CAPACITY − RESERVED − CONFIRMED. Only active, held guardians consume seats. Students never consume guardian capacity. Verified funds first cover the RM100 student package, then complete RM30 guardian units confirm corresponding seats. Remaining guardians stay reserved. Uploading a receipt has no quota side effect. Removing guardians preserves payment history and flags excess funds for review.

No automatic reservation expiry is configured. Only an authorized organizer can release unpaid seats with a reason; ordinary parent contact edits cannot silently re-reserve released seats. Re-reservation is explicit and capacity-checked.

## Access

The public static build contains logos, event content, public API/client configuration and illustration assets only. No full roster or private contact list is shipped.

Name search accepts at least three characters, returns six matches at most and is rate-limited at gateway and backend. This intentionally provides minimal name/class discovery required by the brief; rate limiting mitigates rather than mathematically eliminates enumeration. Search is not a bulk-roster endpoint.

Parent access requires the selected official student ID plus a matching registered primary telephone number. Public lookup returns only a registered/not-registered flag. A mismatch or missing telephone returns no family record or session. Attempts are limited to five per client per ten minutes in Apps Script, under the transaction lock, in addition to gateway limits. This is a basic knowledge check, not proof of phone ownership or OTP verification. A hashed, versioned eight-hour session scopes later changes to one registration. Sessions from the former name-only flow are rejected. No registration reference or recovery code is required.

Telephone numbers are stored as strings in local Malaysian digits-only format, preserving the leading zero. Spaces, punctuation, +60, 60 and 0060 prefixes are normalized; legacy +60 records still match local input without bulk rewriting records. Frontend fields format registration, returning-parent and organizer edits consistently.

Search uses a service-side edge cache of minimal active student ID/name/class only, with a five-minute lifetime. The full minimal roster is supplied by an HMAC-signed internal action that has no public gateway route and requires a gateway identity. Public results remain bounded to six matches and three-character minimum. Apps Script caches the minimal roster for one minute and searches do not acquire the mutation lock. Organizer roster sync invalidates the Apps Script cache and current edge cache location; other edge locations expire naturally. Family contacts, registration status, sessions, payments and receipts are never stored in the search cache. Status and quota are read live.

Admin Google tokens are checked at the Worker and the allowlisted identity is rechecked in Apps Script. The gateway signs server-controlled identity, action, session token and a hashed client key. Client-supplied roles are ignored. The shared HMAC secret never enters frontend files.

Receipts accept bounded PNG/JPEG/PDF files, check actual byte signatures, restrict PNG dimensions and reject basic active PDF constructs. Receipt file type checks do not claim antivirus scanning. PDFs are offered as downloads, not executed in a dashboard frame. Original files remain in restricted Drive storage and are served to authorized admins through the API, not public Drive URLs.

## Operational limits

Sheets and Apps Script remain bounded services; the script lock serializes mutations and reads for this small school event. Gateway requests have timeouts and no automatic resubmission with new identifiers. Retrying the same registration/update/receipt preserves idempotency. Deployment and quotas of the actual selected Google and Cloudflare accounts still need live verification.

Snapshots, canonical state, phone lists, access codes and receipts must never enter GitHub, public build archives, debug console logs or public support tickets. Backups are private. CSV exports are admin-only and escape spreadsheet formula prefixes.


Attendance passes use one deterministic HMAC token per registration, scoped to an attendance-specific namespace and generated server-side. Only an authenticated parent session for that registration can retrieve an eligible pass; public lookup/search never returns it. A QR encodes only the opaque token. Phone ownership is not asserted by the QR; parent retrieval continues to use the agreed registered-phone match. Original financial and family data are not sent to a third-party QR service. Local vendored QR rendering and ZXing scanning are used.

Inspection and check-in require the existing Google organizer allowlist at both gateway and Apps Script. Check-in revalidates full verified payment, active status, reserved party and event date in Malaysia under the transaction lock. Attendance is stored once on the canonical registration with organizer, timestamp and party-size snapshot; repeated requests preserve the first event and return alreadyUsed. Scanner inspection is read-only, and a separate Sahkan Hadir action commits entry. The whole party enters on one pass; separate arrivals/re-entry are not represented as multiple admissions.
