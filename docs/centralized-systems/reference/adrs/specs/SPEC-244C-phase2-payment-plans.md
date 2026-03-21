# SPEC-244C: Phase 2 — Payment Plans (Multi-Owner Split)

**Parent ADR**: ADR-244 (Multi-Buyer Co-Ownership)
**Depends on**: SPEC-244B (Phase 1 must be complete)
**Status**: READY FOR IMPLEMENTATION (μετά Phase 1)
**Risk**: ΜΕΣΑΙΟΣ — νέα financial logic
**Εκτίμηση**: 5-7 ώρες

---

## ΣΤΟΧΟΣ

Ο χρήστης μπορεί να δημιουργήσει:
- **Κοινό πλάνο**: 1 πλάνο, N ιδιοκτήτες (ζευγάρι πληρώνει μαζί)
- **Ξεχωριστά πλάνα**: N πλάνα, 1 ανά ιδιοκτήτη (2 ξένοι, κάθε ένας το δικό του)

---

## ΑΛΛΑΓΕΣ

### 1. PaymentPlan Type Extension

**Αρχείο**: `src/types/payment-plan.ts`

```typescript
export interface PaymentPlan {
  // ... existing fields

  // OLD (keep for backward compatibility)
  buyerContactId: string;
  buyerName: string;

  // NEW (Phase 2)
  /** Ιδιοκτήτης αυτού του πλάνου — αν null, κοινό πλάνο (all owners) */
  ownerContactId?: string | null;
  ownerName?: string | null;
  ownershipPct?: number | null;

  /** Τύπος πλάνου: κοινό (1 πλάνο for all) ή ατομικό (1 πλάνο per owner) */
  planType?: 'joint' | 'individual';
}
```

### 2. Payment Plan Creation Flow

**Αρχείο**: `src/components/sales/payments/CreatePaymentPlanWizard.tsx`

Νέο βήμα 1 στο wizard (αν unit.owners.length > 1):
```
┌──────────────────────────────────────────┐
│ Τύπος Πλάνου Αποπληρωμής                │
│                                          │
│ ○ Κοινό πλάνο (ένα για όλους)           │
│   → Γιάννης Π. & Μαρία Κ.              │
│   → Σύνολο: 200.000€                    │
│                                          │
│ ○ Ξεχωριστά πλάνα (ένα ανά ιδιοκτήτη)  │
│   → Γιάννης Π. (70%) = 140.000€        │
│   → Μαρία Κ. (30%) = 60.000€           │
│                                          │
│                              [Επόμενο →] │
└──────────────────────────────────────────┘
```

**Λογική**:
- **Κοινό**: 1 PaymentPlan document, `planType: 'joint'`, `totalAmount = finalPrice`
- **Ξεχωριστά**: N PaymentPlan documents, `planType: 'individual'`, `totalAmount = finalPrice × ownershipPct / 100`

### 3. Payment Plan Service

**Αρχείο**: `src/services/payment-plan.service.ts`

Νέα function:
```typescript
export async function createSplitPaymentPlans(
  unitId: string,
  owners: PropertyOwnerEntry[],
  baseConfig: PaymentPlanConfig,
  totalPrice: number,
): Promise<PaymentPlan[]>
```

### 4. Payment Tab Display

**Αρχείο**: `src/components/sales/payments/PaymentTabContent.tsx`

Αν unit has multiple plans:
- Tab εμφανίζει sub-tabs ή accordion ανά ιδιοκτήτη
- Κάθε ιδιοκτήτης: δικό του progress bar + installments

### 5. Reports & Exports

**Αρχεία**:
- `src/services/payment-export/payment-excel-exporter.ts`
- `src/services/payment-report.service.ts`

Αλλαγή: Πρόσθεσε στήλη "Ιδιοκτήτης" + "Ποσοστό" στα exports.

---

## ΑΡΧΕΙΑ ΠΟΥ ΑΛΛΑΖΟΥΝ

| # | Αρχείο | Αλλαγή | Risk |
|---|--------|--------|------|
| 1 | `src/types/payment-plan.ts` | + ownerContactId, planType | ZERO |
| 2 | `CreatePaymentPlanWizard.tsx` | Νέο step: joint vs individual | Μεσαίο |
| 3 | `payment-plan.service.ts` | + createSplitPaymentPlans() | Μεσαίο |
| 4 | `PaymentTabContent.tsx` | Multi-plan display | Μεσαίο |
| 5 | `payment-excel-exporter.ts` | + owner column | Χαμηλό |
| 6 | `payment-report.service.ts` | + owner grouping | Χαμηλό |

---

## VERIFICATION

1. Single buyer → πλάνο δημιουργείται ΟΠΩ ΠΡΙΝ
2. 2 buyers κοινό πλάνο → 1 plan, both names
3. 2 buyers ξεχωριστά → 2 plans, split amounts (70% + 30% = 100%)
4. Excel export → στήλη "Ιδιοκτήτης"
5. Σύνολο installments = totalAmount (ανά plan)

---

## EDGE CASES

- Αν owner % αλλάξει μετά τη δημιουργία plan → warning, manual adjustment
- Αν owner αφαιρεθεί → plan πρέπει να ακυρωθεί ή re-assigned
- Αν totalPrice αλλάξει → all plans πρέπει να updated αναλογικά

---

## ROLLBACK

Αν κάτι σπάσει: νέα plans (`planType: 'individual'`) μπορούν να ignored. Τα old plans (`buyerContactId`) δουλεύουν πάντα.
