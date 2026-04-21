# ADR-278: Company Identity Field Guard

**Status:** ✅ IMPLEMENTED
**Date:** 2026-04-01
**Category:** Backend Systems / Data Safety
**Related:** ADR-277 (Address Impact Guard), ADR-226 (Deletion Guard), ADR-195 (Entity Audit Trail), ADR-249 (Name Cascade Safety)

## Context

7 company master-data fields (companyName, vatNumber, gemiNumber, taxOffice, legalForm, tradeName, gemiStatus) are identity-critical, yet the platform allowed free-form editing without impact awareness. These fields have dozens of downstream dependencies across projects, properties, obligations, invoices, building labels, duplicate detection, and AI enrichment.

Industry benchmarks (Google Business Profile, SAP Business Partner, Procore Directory, Microsoft Dynamics) show that company identity fields require: controlled editing, blocked unsafe clears, impact preview, and change history.

## Decision

Replicate the ADR-277 Address Impact Guard pattern for company identity fields:

1. **Field categorization:**
   - **Category A (Identity-critical):** companyName, vatNumber, gemiNumber — no silent clear, always validate
   - **Category B (Accounting/compliance):** taxOffice, legalForm, gemiStatus — warn on change when used downstream
   - **Category C (Display/fallback):** tradeName — allow edit, warn only if used as visible fallback

2. **Guard chain position:** Guard #3 in useContactSubmission, after Name Cascade (ADR-249) and Address Impact (ADR-277)

3. **Deferred submission pattern:** Same as ADR-277 — detect change → query impact API → show dialog if impact > 0 → defer save until user confirms

4. **Single unified dialog:** One dialog for all changed fields, grouped by category with color-coded badges

## Architecture

```
Form Save (company contact)
  ↓
Guard #1: Name Cascade (ADR-249)
  ↓
Guard #2: Address Impact (ADR-277)
  ↓
Guard #3: Company Identity (ADR-278) ← NEW
  ├─ detectCompanyIdentityChanges() — pure utility
  ├─ hasUnsafeClear? → block with error toast
  ├─ requiresImpactPreview? → GET /api/.../company-identity-impact-preview
  │   └─ totalAffected > 0? → show CompanyIdentityImpactDialog
  │       ├─ Confirm → deferred save executes
  │       └─ Cancel → no save
  └─ no impact → proceed silently
  ↓
Actual save: ContactsService.updateContact()
```

## Files

### New Files
| File | Lines | Purpose |
|------|-------|---------|
| `src/utils/contactForm/company-identity-guard.ts` | ~140 | Pure change detection utility |
| `src/utils/contactForm/identity-display-resolver.ts` | ~60 | Code → human-readable label resolver (SSoT reuse) |
| `src/lib/firestore/company-identity-impact-preview.service.ts` | ~110 | Server-only Firestore impact queries |
| `src/app/api/contacts/[contactId]/company-identity-impact-preview/route.ts` | ~38 | GET API endpoint |
| `src/components/contacts/dialogs/CompanyIdentityImpactDialog.tsx` | ~180 | AlertDialog component |

### Modified Files
| File | Change |
|------|--------|
| `src/hooks/useContactSubmission.ts` | Guard #3 insertion, state, confirm/cancel handlers |
| `src/hooks/useContactForm.ts` | Pass-through of new guard state |
| `src/components/contacts/dialogs/TabbedAddNewContactDialog.tsx` | Render new dialog |
| `src/i18n/locales/el/common.json` | Greek translations |
| `src/i18n/locales/en/common.json` | English translations |

## Impact Queries

| Dependency | Collection | Field | Query Type | Category |
|-----------|-----------|-------|------------|----------|
| Projects | PROJECTS | linkedCompanyId | equals | Live |
| Properties | PROPERTIES | commercial.ownerContactIds | array-contains | Live |
| Obligations | OBLIGATIONS | companyId | equals | Live |
| Invoices | ACCOUNTING_INVOICES | customer.contactId | equals | Snapshot |
| APY Certificates | ACCOUNTING_APY_CERTIFICATES | customerId | equals | Snapshot |

## Changelog

| Date | Change |
|------|--------|
| 2026-04-01 | Initial implementation — 4 new files, 5 modified |
| 2026-04-21 | Dialog display fix — (1) removed internal A/B/C category badge from rendered row (end-users should not see internal criticality codes); (2) resolve code-backed fields (`taxOffice`, `legalForm`, `gemiStatus`) to human-readable names via new `identity-display-resolver.ts`, reusing the same SSoT data sources (`GREEK_TAX_OFFICES`, `MODAL_SELECT_LEGAL_FORMS`, `MODAL_SELECT_GEMI_STATUSES`) the form dropdowns consume. `IdentityFieldChange.category` retained for guard logic (unsafe-clear checks). Safety net: 8 resolver tests + new dialog test asserting resolved names & absent badge. |
| 2026-04-21 | Duplicate-dialog fix — `useContactMutationImpactGuard` was running a parallel company-identity preview/dialog flow on top of the ADR-278 guard inside `runGuardChain`, so the dialog reopened after the first "Αποθήκευση & Συνέχεια". Company branch in `useContactMutationImpactGuard` now delegates directly to `action()` (no preview fetch, no state, no duplicated dialog); the authoritative flow is `runGuardChain` Guard #3 only. Removed `CompanyDialogState`, `companyDialogState`/`resetCompanyDialog`/`handleCompanyConfirm`, and the duplicated `CompanyIdentityImpactDialog` mount from that hook. Test `useContactMutationImpactGuard.test.tsx` updated: the two removed company paths are replaced by a single assertion that company mutations delegate to `action` with no dialog. |
