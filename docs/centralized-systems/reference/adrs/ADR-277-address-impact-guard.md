# ADR-277: Address Impact Guard — Company Address Change/Delete Safety

| Metadata | Value |
|----------|-------|
| **Status** | ✅ IMPLEMENTED |
| **Date** | 2026-04-01 |
| **Category** | Backend Systems / Data Safety |
| **Related ADRs** | ADR-226 (Deletion Guard), ADR-249 (Name Cascade Safety) |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## 1. Context

### Το Πρόβλημα

Η εφαρμογή επιτρέπει **αλλαγή/διαγραφή εταιρικών διευθύνσεων χωρίς κανένα warning**, ενώ ήδη εφαρμόζει guards για:
- Διαγραφή επαφής (deletion guard — ADR-226)
- Αλλαγή ονόματος επαφής (name cascade — ADR-249)

Η εταιρική διεύθυνση (HQ) είναι **business-critical data** που επηρεάζει:
- Invoice PDFs (customer address snapshot)
- APY certificate PDFs (provider/customer address)
- Property ownerships (live reference)
- Payment plans (live reference)
- Accounting company profile
- Contact exports

### Κενά που εντοπίστηκαν

1. `CompanyAddressesSection.tsx` — `removeBranch()` splice χωρίς confirmation
2. `AddressesSectionWithFullscreen.tsx` — HQ address edit/hierarchy χωρίς warning
3. Map drag μηδενίζει διοικητική ιεραρχία σιωπηλά
4. `EnterpriseContactSaver.ts` — replace addresses χωρίς impact analysis

---

## 2. Decision

### Αρχιτεκτονική: Mirror του Name Cascade Pattern (ADR-249)

| Αλλαγή | Guard |
|--------|-------|
| HQ address edit | Preview API → conditional dialog (μόνο αν `totalAffected > 0`) |
| Branch delete | Simple confirmation dialog (χωρίς API — downstream reference contact ID, όχι branch) |
| Map drag (HQ) | Client-only warning αν υπάρχει hierarchy (`settlementId`) |
| HQ delete | Block (HQ δεν έχει delete button — only edit) |

### Σειρά Guards στο Submit

Name cascade (ADR-249) → **Address impact (ADR-277)** → Save

Κάθε guard independent με δικά refs/state (deferred submit pattern).

### Τι ΔΕΝ κάνει server-side cascade

Σε αντίθεση με τα names (denormalized σε `owners[].name`), η address **δεν είναι denormalized** — properties/payment plans διαβάζουν live από τo contact. Άρα δεν χρειάζεται propagation, μόνο warning.

### Invoices/APY = Informational Only

Τα invoices και APY certificates αποθηκεύουν **snapshot** κατά τη δημιουργία. Δεν αλλάζουν. Το dialog τα δείχνει dimmed ως "παγωμένα".

---

## 3. Implementation

### Νέα Αρχεία (4)

| File | Lines | Purpose |
|------|-------|---------|
| `src/lib/firestore/address-impact-preview.service.ts` | ~100 | Server-side Firestore queries (properties, payment plans, invoices, APY certs) |
| `src/app/api/contacts/[contactId]/address-impact-preview/route.ts` | ~40 | GET API route (withStandardRateLimit + withAuth) |
| `src/components/contacts/dialogs/AddressImpactDialog.tsx` | ~120 | Confirmation dialog (live refs + snapshot sections) |
| `src/components/contacts/dialogs/BranchDeleteConfirmDialog.tsx` | ~60 | Simple AlertDialog for branch removal |

### Τροποποιημένα Αρχεία (8)

| File | Change |
|------|--------|
| `src/hooks/useContactSubmission.ts` | +50 lines: address impact detection, deferred submit, confirm/cancel handlers, helper functions |
| `src/hooks/useContactForm.ts` | +6 lines: pass-through νέων values |
| `src/components/contacts/dialogs/TabbedAddNewContactDialog.tsx` | +12 lines: render AddressImpactDialog |
| `src/components/contacts/dynamic/CompanyAddressesSection.tsx` | +15 lines: branch delete confirmation state |
| `src/components/contacts/dynamic/AddressesSectionWithFullscreen.tsx` | +20 lines: map drag hierarchy warning |
| `src/i18n/locales/el/common.json` | +25 lines: `contacts.addressImpact.*` keys |
| `src/i18n/locales/en/common.json` | +25 lines: English translations |

### Preview API Response

```typescript
interface AddressImpactPreview {
  totalAffected: number;   // properties + paymentPlans (drives dialog visibility)
  properties: number;      // live reference
  paymentPlans: number;    // live reference
  invoices: number;        // snapshot — informational
  apyCertificates: number; // snapshot — informational
}
```

### Detection Logic (useContactSubmission)

```
User clicks Save → handleSubmit()
  → Name cascade check (ADR-249)
  → Address impact check:
    1. Is company contact? Is HQ address changed?
    2. GET /api/contacts/{id}/address-impact-preview
    3. If totalAffected > 0 → show AddressImpactDialog, defer submit
    4. If 0 → proceed normally
  → ContactsService.updateContact()
```

---

## 4. UX Rules

| Scenario | Behavior |
|----------|----------|
| HQ edit, no dependencies | Silent save (no dialog) |
| HQ edit, has dependencies | AddressImpactDialog with counts → confirm/cancel |
| Branch delete | BranchDeleteConfirmDialog → confirm/cancel |
| HQ delete | Blocked (no delete button for HQ) |
| Map drag, HQ with hierarchy | AlertDialog warning about hierarchy reset |
| Map drag, HQ without hierarchy | Silent apply |
| Map drag, branch | Silent apply |

---

## 5. Firestore Queries (Preview)

1. `PROPERTIES` → `commercial.ownerContactIds` array-contains contactId → count
2. Per property → `payment_plans` subcollection where `ownerContactId == contactId` → count
3. `ACCOUNTING_INVOICES` → `customer.contactId == contactId` → count (informational)
4. `ACCOUNTING_APY_CERTIFICATES` → `customerId == contactId` → count (informational)

All queries use `.select()` (metadata only, no data transfer).

---

## 6. Consequences

- Users are warned before HQ address changes affect downstream records
- Branch deletions require explicit confirmation
- Map drag that would clear hierarchy requires confirmation
- Pattern consistent with ADR-226 (deletion guard) and ADR-249 (name cascade)
- Invoices/APY certificates clearly labeled as "frozen snapshots"

---

## 7. Decision Log

| Date | Decision | Author |
|------|----------|--------|
| 2026-04-01 | ADR Created — Full codebase audit of address consumers completed | Γιώργος Παγώνης + Claude Code |
| 2026-04-01 | **IMPLEMENTED**: All 5 phases — service, API, dialogs, submission integration, branch delete, map drag warning | Claude Code |
| 2026-04-01 | **Pattern reused**: Ίδιο deferred-submission + impact-preview pattern επεκτάθηκε για company identity fields — βλ. [ADR-278](./ADR-278-company-identity-field-guard.md) | Claude Code |

---

*ADR Format based on: Michael Nygard's Architecture Decision Records*
