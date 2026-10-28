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

Parent access uses the selected official student ID from name/class search, as requested by the school. No registration reference, phone challenge or recovery code is required. Anyone who selects a student can open and edit that registration; this is a simplified lookup flow, not identity verification. A short-lived hashed session scopes subsequent updates and receipt submissions to that registration. Receipt files remain organizer-only. Internal registration references remain for bookkeeping and existing records are preserved.

Admin Google tokens are checked at the Worker and the allowlisted identity is rechecked in Apps Script. The gateway signs server-controlled identity, action, session token and a hashed client key. Client-supplied roles are ignored. The shared HMAC secret never enters frontend files.

Receipts accept bounded PNG/JPEG/PDF files, check actual byte signatures, restrict PNG dimensions and reject basic active PDF constructs. Receipt file type checks do not claim antivirus scanning. PDFs are offered as downloads, not executed in a dashboard frame. Original files remain in restricted Drive storage and are served to authorized admins through the API, not public Drive URLs.

## Operational limits

Sheets and Apps Script remain bounded services; the script lock serializes mutations and reads for this small school event. Gateway requests have timeouts and no automatic resubmission with new identifiers. Retrying the same registration/update/receipt preserves idempotency. Deployment and quotas of the actual selected Google and Cloudflare accounts still need live verification.

Snapshots, canonical state, phone lists, access codes and receipts must never enter GitHub, public build archives, debug console logs or public support tickets. Backups are private. CSV exports are admin-only and escape spreadsheet formula prefixes.
