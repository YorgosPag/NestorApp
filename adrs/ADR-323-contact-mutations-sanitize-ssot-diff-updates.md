# ADR-323: Contact Update Sanitize SSoT + Dirty-Diff Writes (CHECK 5B — Contact Sanitize)

**Status:** ✅ IMPLEMENTED — 2026-04-25
**Date:** 2026-04-25
**Category:** Data Integrity / SSoT Enforcement / Regression Prevention
**Author:** Γιώργος Παγώνης + Claude Code
**Related ADRs:** ADR-017 (Enterprise IDs), ADR-195 (CDC audit), ADR-249 (Name cascade), ADR-294 (SSoT Ratchet), ADR-322 (Contact Mappers Test Coverage — predecessor incident), ADR-299 (Ratchet Backlog)

---

## 1. Context — Γιατί τώρα

Στη συνέχεια του incident της ADR-322 (empty edit form), στις **2026-04-24** κατά τη διάρκεια του QA session παρατηρήθηκε ότι κάθε `update` σε μια υπάρχουσα επαφή **έγραφε ~30 κενά default πεδία** στο Firestore document. Παράδειγμα μετά από απλή προσθήκη του `fatherName`:

```json
{
  "fatherName": "ΝΕΣΤΟΡΑΣ",    ← μόνο αυτό είχε αλλάξει
  "specialty": "",              ← bloat
  "notes": "",                  ← bloat
  "emails": [],                 ← bloat
  "phones": [],                 ← bloat
  "socialMedia": { "facebook": "", "instagram": "", "linkedin": "", "twitter": "" },
  "personas": [],
  "documents": { "announcementDocs": [], "registrationDocs": [] },
  "escoSkills": [], "websites": [], "individualAddresses": [],
  "profession": "", "employer": "", "position": "", "workAddress": "",
  "taxOffice": "", "birthCountry": "", "gender": "",
  "amka": "", "documentType": "", "documentNumber": "", …
  ← 20+ ακόμα κενά πεδία
}
```

### 1.1 Root causes

Δύο ανεξάρτητα bugs στη ίδια pipeline:

| # | Bug | Layer |
|---|-----|-------|
| 1 | `updateContact` never called `sanitizeContactData` — only `deepCleanUndefined` (removes `undefined`, not `''` / `[]` / `{empty}`). | Service layer |
| 2 | Form's `handleStartEdit` pre-populated `editedData` with the FULL mapped form snapshot (including all `initialFormData` defaults). Save then sent that full snapshot to `updateContactFromForm` → `EnterpriseContactSaver.updateExistingContact` → `Object.assign` merge → `updateContact` → write ALL fields, even untouched ones. | Controller / form state |

Result: every save overwrote the document with a full replay of form state, injecting stale defaults and drowning the audit trail.

### 1.2 Why existing layers didn't catch it

| Layer | Why it missed |
|-------|---------------|
| Firestore rules | Valid writes — no schema enforcement beyond field allowlists. |
| `sanitizeContactData` | Lives in `data-cleaning.ts`, but only invoked by `createContact`. Never reached the update path. |
| `deepCleanUndefined` | Strips `undefined`, not empty strings/arrays/objects. |
| Unit tests | No existing coverage for `updateContact` write payload shape. |
| Pre-commit hook | Existing CHECK 5B "Contact Mutations" runs `contact-mutation-*` tests, not `data-cleaning` or `updateContact`. |

## 2. Decision — 4 layers, SSoT everywhere

### Layer 1 — SSoT sanitize (`sanitizeContactForUpdate`)

**File:** `src/utils/contactForm/utils/data-cleaning.ts`

New exported function that partitions a partial update payload into two lists:

```typescript
function sanitizeContactForUpdate(
  updates: ContactDataRecord,
): { cleanUpdates: ContactDataRecord; fieldsToDelete: string[] };
```

Semantics:

| Input value | Behaviour |
|-------------|-----------|
| real value (non-empty string, non-empty array, number, boolean) | → `cleanUpdates` (written as-is) |
| `''` / `'   '` (whitespace only) | → `fieldsToDelete` (explicit clear) |
| `[]` | → `fieldsToDelete` |
| `null` | → `fieldsToDelete` |
| `{ all nested empty }` | → `fieldsToDelete` (whole object dropped) |
| `{ some empty, some filled }` | → recurse; object kept with filled subset |
| `undefined` | dropped entirely (no write, no delete — Firestore value left alone) |
| `photoURL` / `logoURL` / `multiplePhotoURLs` | preserved-as-is (own deletion flow via `requiresSpecialDeletion`) |

The firebase SDK dependency stays out of the utils layer — the caller
(`ContactsService.updateContact`) pairs each `fieldsToDelete` entry with
Firestore's `deleteField()` sentinel.

**SSoT guarantee:** `contact-sanitize` module added to `.ssot-registry.json`
(tier 3) with `forbiddenPatterns` blocking re-implementation of
`sanitizeContactData` / `sanitizeContactForUpdate` in any other file.

### Layer 2 — Dirty-diff writes (editedData = diff)

**Files:**
- `src/components/contacts/details/contact-details/useContactDetailsController.ts`
- `src/components/contacts/details/ContactDetails.tsx`
- `src/services/contacts.service.ts` (`updateContactFromForm`)

Refactor of the controller/form state so `editedData` holds **only the fields
the user actually touched**, not a full snapshot:

| Before | After |
|--------|-------|
| `handleStartEdit` → `setEditedData(mapContactToFormData(contact).formData)` (full snapshot) | `setEditedData({})` (starts empty — true dirty accumulator) |
| `resolvedFormData = isEditing ? editedData : enhancedFormData` (display reads from editedData → needs full data) | `resolvedFormData = isEditing ? { ...enhancedFormData, ...editedData } : enhancedFormData` (display merges diff on top of base) |
| `handleSaveEdit` → `updateExistingContactFromForm(contact, mergedFormData)` (full snapshot written) | `handleSaveEdit` → `runExistingContactPartialFormUpdate(mergedFormData, editedData, …)` (guards see full merged view; write action sends only `editedData`) |
| `updateContactFromForm` built `enterpriseData = updateExistingContact(existing, full)` and wrote that | `updateContactFromForm` keeps `enterpriseFull` for validation + photo diff + name-cascade, but writes `enterpriseDiff = convertToEnterpriseStructure(dirtyFormData)` — diff only |

Net effect: a save that changed only `fatherName` writes a Firestore update
containing `{ fatherName: 'Χ', updatedAt, _lastModifiedBy, _lastModifiedByName, _lastModifiedAt }` — nothing else.

### Layer 3 — Unit tests + pre-commit gate (CHECK 5B — Contact Sanitize)

**New test file:** `src/utils/contactForm/utils/__tests__/data-cleaning.test.ts` (15 tests, 1 suite, ~8 s):

| Group | Tests | What it locks |
|-------|-------|---------------|
| `cleanUpdates` | 4 | non-empty strings / arrays / numbers / booleans / objects pass through |
| `fieldsToDelete` | 5 | empty string, whitespace, empty array, null, whole-object-empty → flagged |
| `undefined` | 1 | dropped entirely (no write, no delete) |
| `requiresSpecialDeletion` | 3 | `photoURL` / `logoURL` / `multiplePhotoURLs` preserved even when empty |
| Real-world regression | 1 | the exact 2026-04-24 bloat payload → only `fatherName` + preserved photo fields survive |
| Idempotency | 1 | double-sanitize of `cleanUpdates` returns the same result |

**Pre-commit hook — new entry in CHECK 5B (`scripts/git-hooks/pre-commit`):**

```bash
run_area_tests "Contact Sanitize" \
    "^src/utils/contactForm/utils/data-cleaning\.ts|^src/services/contacts\.service\.ts" \
    "src/utils/contactForm/utils/__tests__/data-cleaning" \
    "npm run test:contact-sanitize"
```

Trigger condition: staged file matches `data-cleaning.ts` OR `contacts.service.ts`.
Action: runs the sanitize test suite (~8 s). Fail → commit blocked.

**New npm script:** `"test:contact-sanitize": "jest --testPathPatterns=src/utils/contactForm/utils/__tests__/data-cleaning --verbose"`.

### Layer 4 — Backfill script for already-bloated documents

**File:** `scripts/cleanup-empty-contact-fields.mjs`

One-shot migration that scans an existing collection and uses
`FieldValue.delete()` to strip empty defaults from docs created before the
runtime fix landed.

```
node scripts/cleanup-empty-contact-fields.mjs --dry-run
node scripts/cleanup-empty-contact-fields.mjs              # apply
node scripts/cleanup-empty-contact-fields.mjs --collection=contacts --dry-run
```

Mirrors `sanitizeContactForUpdate` semantics exactly (including the
`requiresSpecialDeletion` preservation list and a `SYSTEM_FIELDS` allowlist
for audit / lifecycle fields). Batches of 450 docs per commit (headroom under
the Firestore 500 limit).

## 3. Implementation Checklist

- [x] `sanitizeContactForUpdate` implemented in `data-cleaning.ts`
- [x] `ContactsService.updateContact` imports + calls sanitize, pairs `fieldsToDelete` with `deleteField()`
- [x] `ContactsService.updateContactFromForm` writes only `enterpriseDiff` (validation/photo/cascade still use merged)
- [x] `useContactDetailsController.handleStartEdit` no longer pre-populates `editedData`
- [x] `useContactDetailsController.handleSaveEdit` uses `runExistingContactPartialFormUpdate` with dirty-only payload
- [x] `useContactDetailsController.handlePersonaToggle` reads merged data (since `editedData` is now diff-only)
- [x] `ContactDetails.tsx` `resolvedFormData` merges base+diff for display in edit mode
- [x] `contact-sanitize` module registered in `.ssot-registry.json`
- [x] `data-cleaning.test.ts` — 15 tests covering partition + real-world regression
- [x] `test:contact-sanitize` npm script added
- [x] CHECK 5B pre-commit entry added for `Contact Sanitize`
- [x] Backfill script `cleanup-empty-contact-fields.mjs` (dry-run + apply modes)
- [x] ADR-323 (this file)
- [x] ADR-322 changelog updated to point at 323 as the follow-up

## 4. Consequences

### 4.1 Positive

- **Zero bloat on write** — a 1-field edit produces a 1-field Firestore update (+ audit metadata).
- **Explicit-clear works** — a user clearing `fatherName` in the form actually removes the field from Firestore (via `deleteField()`), instead of persisting an empty string.
- **Audit trail clean** — CDC `auditContactWrite` now sees meaningful diffs; no more false-positive change events for every unrelated field.
- **SSoT locked** — the three-layer guard (test + pre-commit + registry) prevents the class of bug from silently returning.
- **Pattern replicable** — same 4-layer structure can be applied to every other entity writer (`buildings.service`, `projects.service`, …) that suffers from the same "write full snapshot on update" pattern.

### 4.2 Trade-offs / risks

- **Refactor risk in controller** — `editedData` now holds a partial-only shape; any consumer that assumed it was a full snapshot needs the merged view. Audited call sites: `handlePersonaToggle` (fixed), `afterUpdate` photo post-save (safe — only reads fields explicitly set by user actions).
- **Pre-commit cost** — +~8 s when you touch `data-cleaning.ts` or `contacts.service.ts`. Acceptable (same order as other CHECK 5B areas).
- **Convert-side path changed** — `updateContactFromForm` now calls `convertToEnterpriseStructure(dirty)` instead of `updateExistingContact(existing, dirty)` for the WRITE. The latter is still called for validation / photo diff / name cascade to keep the merged-view consumers working.

### 4.3 Future work

- Extend the same 4-layer pattern to `buildings.service.ts`, `projects.service.ts`, `properties.service.ts`. They share the same "write full form snapshot on update" shape.
- Add CHECK 5B entries for each of the above once refactored.
- Consider extracting a generic `sanitizeEntityForUpdate` in `src/lib/firestore/` so the same helper serves every entity writer (further SSoT consolidation).

## 5. Changelog

- **2026-04-25** — Initial version. 4-layer fix (sanitize SSoT + dirty-diff writes + tests + backfill) landed in one commit following the successful end-to-end QA verification on `cont_dfa2bc20-*` showing a clean 1-field write.
