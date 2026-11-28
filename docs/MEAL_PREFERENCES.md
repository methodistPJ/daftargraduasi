# Vegetarian meal preferences

Parents use the existing name + primary phone login, then answer the prominent meal question in Semak / Kemaskini. Both NONE and VEGETARIAN must be explicitly saved. Vegetarian answers select stable person IDs belonging to that registered family; counts are derived server-side, never trusted from a client number.

The deadline is 29 November 2026 at 12:00 noon Asia/Kuala_Lumpur (2026-11-29T04:00:00Z). At and after that instant, parent submissions are closed. An unanswered family is displayed as assumed to need no vegetarian meals, without fabricating a saved response. Changed family membership flags an existing answer for review and excludes removed people from the current meal count.

Compatibility: existing parent.get, parent.update and admin.dashboard requests and response shapes remain unchanged. The new UI requests the explicit `section: mealPreferences` variant through those same authenticated routes, so no gateway access expansion or new public endpoint is needed. The variant returns meal data only.

Storage is independent of canonical registration/payment/quota/QR state and existing spreadsheet schemas. Apps Script Script Properties contains one JSON value per registration under DIET_RESPONSE_V1_<registrationId>. Values contain choice, personIds, memberIds and updatedAt. Only these prefixed values are selected for the admin summary; credentials and unrelated properties are never returned. The existing script lock serializes writes. Repeat saves replace that family's response and never accumulate duplicate servings.

The organizer Hidangan vegetarian tab includes totals for graduate/guest vegetarian servings, answered/unanswered families, membership-review flags, filters, a private full-response CSV, and a kitchen CSV without phone numbers. The existing canonical JSON backup remains unchanged; export the meal CSV separately for the catering handoff and meal-record backup.

Validation: isolated tests cover family ownership, missing/duplicate selections, inclusive noon cutoff, repeated saves, removed guests, authorization, private-property filtering, and complete canonical-state preservation. Browser QA uses loopback dummy records only; no live parent's meal answer is fabricated for testing.
