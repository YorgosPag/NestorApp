# SPEC-244D: Phase 3 — Cleanup & Migration (Breaking Changes)

**Parent ADR**: ADR-244 (Multi-Buyer Co-Ownership)
**Depends on**: SPEC-244A + SPEC-244B + SPEC-244C (ALL previous phases complete)
**Status**: DO NOT START until Phases 0-2 are stable
**Risk**: 🔴 ΥΨΗΛΟΣ — breaking changes σε 42 αρχεία
**Εκτίμηση**: 8-10 ώρες

---

## ΣΤΟΧΟΣ

Αφαίρεση `buyerContactId` + `buyerName` — ΟΛΟΙ οι consumers μεταφέρονται στο `owners[]`. Μετά αυτή τη φάση, `PropertyOwnerEntry[]` είναι η **μοναδική πηγή αλήθειας**.

---

## ⚠️ ΠΡΟΥΠΟΘΕΣΕΙΣ

1. ✅ Phase 0 υλοποιημένο + σταθερό
2. ✅ Phase 1 υλοποιημένο + σταθερό (reserve/sell writes owners[])
3. ✅ Phase 2 υλοποιημένο + σταθερό (payment plans read owners[])
4. ✅ ΟΛΑ τα existing data έχουν `owners[]` populated (μέσω dual-write)
5. ✅ Γιώργος επιβεβαιώνει ότι μπορούμε να προχωρήσουμε

---

## ΑΛΛΑΓΕΣ (42 αρχεία)

### Κατηγορία 1: Types (5 αρχεία)

| Αρχείο | Αλλαγή |
|--------|--------|
| `src/types/unit.ts` | Αφαίρεσε `buyerContactId`, `buyerName` → SSoT = `owners[]` |
| `src/types/ownership-table.ts` | `OwnershipTableRow`: `buyerContactId` → `owners: PropertyOwnerEntry[]` |
| `src/types/payment-plan.ts` | `PaymentPlan`: αφαίρεσε `buyerContactId` → `ownerContactId` ΜΟΝΟ |
| `src/types/brokerage.ts` | Αφαίρεσε `buyerContactId` → read from `owners[0]` |
| `src/types/legal-contracts.ts` | Αφαίρεσε `buyerContactId` → `owners[]` |

### Κατηγορία 2: Services (8 αρχεία)

| Αρχείο | Αλλαγή |
|--------|--------|
| `src/services/ownership/ownership-table-service.ts` | Row writes `owners[]` |
| `src/services/payment-plan.service.ts` | Read `owners[]` αντί `buyerContactId` |
| `src/services/sales-accounting/sales-accounting-bridge.ts` | **ΚΡΙΣΙΜΟ**: Resolve customer from `owners[]` for invoices |
| `src/services/brokerage.service.ts` | Commission → read from `owners[]` |
| `src/services/brokerage-server.service.ts` | Server-side → same |
| `src/services/legal-contract.service.ts` | Contract → `owners[]` |
| `src/services/client.service.ts` | Client operations → `owners[]` |
| `src/lib/firestore/cascade-propagation.service.ts` | Name cascade → update `owners[].name` |

### Κατηγορία 3: API Routes (6 αρχεία)

| Αρχείο | Αλλαγή |
|--------|--------|
| `src/app/api/units/[id]/route.ts` | PATCH writes `owners[]` only |
| `src/app/api/units/[id]/payment-plan/route.ts` | Read `owners[]` |
| `src/app/api/sales/[unitId]/appurtenance-sync/route.ts` | Sync `owners[]` |
| `src/app/api/sales/[unitId]/accounting-event/route.ts` | Invoice → `owners[]` |
| `src/app/api/contacts/[contactId]/name-cascade/route.ts` | Cascade `owners[].name` |
| `src/app/api/contracts/route.ts` | Contract → `owners[]` |

### Κατηγορία 4: Components (8 αρχεία)

| Αρχείο | Αλλαγή |
|--------|--------|
| `src/components/sales/cards/SalesUnitListCard.tsx` | Display `owners[]` names |
| `src/components/sales/tabs/SaleInfoContent.tsx` | Display `owners[]` |
| `src/components/sales/dialogs/SalesActionDialogs.tsx` | Αφαίρεσε dual-write |
| `src/components/sales/payments/PaymentTabContent.tsx` | Read `owners[]` |
| `src/components/sales/payments/CreatePaymentPlanWizard.tsx` | Read `owners[]` |
| `src/components/sales/legal/LegalTabContent.tsx` | Contract → `owners[]` |
| `src/components/projects/tabs/OwnershipTableTab.tsx` | Display multi-owner |
| `src/components/sales/payments/PaymentReportDialog.tsx` | Report → `owners[]` |

### Κατηγορία 5: Email Templates (4 αρχεία)

| Αρχείο | Αλλαγή |
|--------|--------|
| `src/services/email-templates/reservation-confirmation.ts` | `owners[].name` join |
| `src/services/email-templates/sale-confirmation.ts` | Same |
| `src/services/email-templates/cancellation-confirmation.ts` | Same |
| `src/services/email-templates/professional-assignment.ts` | Same |

### Κατηγορία 6: Config & Guards (3 αρχεία)

| Αρχείο | Αλλαγή |
|--------|--------|
| `src/config/deletion-registry.ts` | `buyerContactId` → `owners[].contactId` |
| `src/lib/firestore/deletion-guard.ts` | Check `owners[]` array |
| `src/config/audit-tracked-fields.ts` | Track `owners` array changes |

### Κατηγορία 7: Exports & Reports (2 αρχεία)

| Αρχείο | Αλλαγή |
|--------|--------|
| `src/services/payment-export/payment-excel-exporter.ts` | `owners[].name` |
| `src/services/payment-export/types.ts` | Type update |

---

## ΚΡΙΣΙΜΑ ΣΗΜΕΙΑ ΠΡΟΣΟΧΗΣ

### Sales Accounting Bridge (ΥΨΙΣΤΟ ΚΙΝΔΥΝΟΥ)

**Αρχείο**: `src/services/sales-accounting/sales-accounting-bridge.ts` (γρ. 87-145)

Αυτό το αρχείο resolve-άρει τον **customer** για invoice generation. Πρέπει:
- Αν 1 owner → ΟΠΩ ΠΡΙΝ
- Αν N owners → δημιουργεί N invoices (1 ανά owner × ποσοστό) ΄Η 1 invoice με N buyers
- **ΡΩΤΑ ΤΟΝ ΓΙΩΡΓΟ** πριν υλοποιήσεις

### Name Cascade

**Αρχείο**: `src/app/api/contacts/[contactId]/name-cascade/route.ts`

Τρέχον: Updates `buyerName` field directly.
Νέο: Πρέπει να κάνει update μέσα στο `owners[]` array — Firestore array update with `arrayRemove` + `arrayUnion` ή full array overwrite.

### Deletion Guard

**Αρχείο**: `src/lib/firestore/deletion-guard.ts`

Τρέχον: `where('commercial.buyerContactId', '==', contactId)`
Νέο: `where('commercial.owners', 'array-contains', { contactId: contactId })` — **Firestore δεν υποστηρίζει `array-contains` σε nested objects!** Χρειάζεται alternative approach (π.χ. `commercial.ownerContactIds[]` flat array for queries).

---

## VERIFICATION

1. `npx tsc --noEmit` → 0 errors
2. Reserve → writes ΜΟΝΟ `owners[]` (ΟΧΙ `buyerContactId`)
3. Sell → same
4. Payment plans → read `owners[]`
5. Invoice generation → correct customer
6. Name cascade → updates `owners[].name`
7. Delete contact → blocked if referenced in `owners[]`
8. Πίνακας ποσοστών → "Γιάννης Π. (70%) — Μαρία Κ. (30%)"

---

## ROLLBACK

**⚠️ ΔΥΣΚΟΛΟ** — αυτή η φάση αφαιρεί `buyerContactId`. Αν χρειαστεί rollback:
1. `git revert` the commit
2. Τα data στο Firestore πρέπει ΑΚΟΜΑ να έχουν `buyerContactId` (δεν αφαιρείται από Firestore, μόνο από τα types)
3. Λόγω αυτού, **ΜΗΝ διαγράψεις** `buyerContactId` από Firestore rules/indexes κατά το Phase 3

---

## ΣΗΜΕΙΩΣΗ

Αυτή η φάση **ΔΕΝ πρέπει να ξεκινήσει** αν οι Phases 0-2 δεν είναι σταθερές για τουλάχιστον 1-2 εβδομάδες. Ο Γιώργος πρέπει να επιβεβαιώσει ότι τα multi-buyer features δουλεύουν σωστά πριν αφαιρεθεί το fallback.
