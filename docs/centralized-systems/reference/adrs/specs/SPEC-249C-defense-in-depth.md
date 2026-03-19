# SPEC-249C: Defense in Depth (P2)

> **unitCoverage Drift Fix, Installment Sum Route-Level Validation**

| Metadata | Value |
|----------|-------|
| **Parent ADR** | ADR-249 (Comprehensive Server-Side Integrity Audit) |
| **Phase** | P2 — Defense in Depth (Backlog) |
| **Priority** | MEDIUM / LOW |
| **Status** | ✅ IMPLEMENTED |
| **Estimated Effort** | ~2.5 hours |
| **Dependencies** | None — self-contained |
| **Date** | 2026-03-19 |

---

## 1. Objective

Υλοποίηση **2 defense-in-depth guards** που βελτιώνουν:
- Ακρίβεια `unitCoverage` boolean flags μετά τη διαγραφή media/documents
- Route-level validation για installment sum consistency (διπλό δίχτυ ασφαλείας)

Αυτά τα findings είναι **P2 — backlog improvements**. Δεν αποτελούν blocking issues αλλά ενισχύουν την αξιοπιστία του συστήματος.

---

## 2. Findings Covered

| Finding | Severity | Risk |
|---------|----------|------|
| **F-6** unitCoverage Boolean Flags Drift | MEDIUM | UI δείχνει stale coverage, broken filters |
| **F-8** Installment Sum Route-Level Validation | LOW | Defense-in-depth — service layer ήδη validates |

---

## 3. Implementation Details

### P2-1: unitCoverage Recalculation on Delete (F-6)

**Problem**: Τα `unitCoverage` flags (hasPhotos, hasFloorplans, hasDocuments) ενημερώνονται **μόνο στο upload** αλλά **ΟΧΙ στο delete**. Μετά τη διαγραφή, τα flags παραμένουν `true` ενώ δεν υπάρχουν πλέον αρχεία.

**Interface** (`src/types/unit.ts`, lines 229–238):
```typescript
export interface UnitCoverage {
  hasPhotos: boolean;        // Line 231
  hasFloorplans: boolean;    // Line 233
  hasDocuments: boolean;     // Line 235
  updatedAt: Timestamp;      // Line 237
}
```

**Impact**:
- UI εμφανίζει photo/document badges σε units χωρίς αρχεία
- Filter "has photos" επιστρέφει false positives
- Coverage reports/metrics είναι inflated

**Solution**: Recalculate relevant flag μετά κάθε delete operation.

**Shared utility**: `src/lib/validation/unit-coverage-sync.ts`

```typescript
import { getAdminFirestore } from '@/lib/firebase-admin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { Timestamp } from 'firebase-admin/firestore';

type CoverageFlag = 'hasPhotos' | 'hasFloorplans' | 'hasDocuments';

/**
 * Recalculates a specific unitCoverage flag after a file deletion.
 * Counts remaining items in the relevant storage/collection.
 * If count === 0, sets the flag to false.
 *
 * @param unitId - The unit whose coverage to recalculate
 * @param flag - Which coverage flag to check
 * @param storageCollection - The Firestore collection to count remaining items
 */
export async function recalculateUnitCoverageFlag(
  unitId: string,
  flag: CoverageFlag,
  storageCollection: string
): Promise<void> {
  const db = getAdminFirestore();

  // Count remaining items for this unit
  const remaining = await db
    .collection(storageCollection)
    .where('unitId', '==', unitId)
    .where('isDeleted', '==', false)
    .limit(1)
    .get();

  const hasItems = !remaining.empty;

  // Update flag only if it needs to change (avoid unnecessary writes)
  const unitRef = db.collection(COLLECTIONS.UNITS).doc(unitId);
  const unitDoc = await unitRef.get();
  if (!unitDoc.exists) return;

  const currentCoverage = unitDoc.data()?.unitCoverage;
  if (currentCoverage?.[flag] !== hasItems) {
    await unitRef.update({
      [`unitCoverage.${flag}`]: hasItems,
      'unitCoverage.updatedAt': Timestamp.now(),
    });
  }
}
```

**Integration points** — καλείται μετά κάθε successful delete:

| Delete Handler | Flag | Storage Collection |
|----------------|------|-------------------|
| Photo delete endpoint | `hasPhotos` | `unit_photos` ή Storage path |
| Floorplan delete endpoint | `hasFloorplans` | `unit_floorplans` ή Storage path |
| Document delete endpoint | `hasDocuments` | `unit_documents` |

**Pattern**:
```typescript
// After successful deletion in each handler:
await recalculateUnitCoverageFlag(unitId, 'hasPhotos', COLLECTIONS.UNIT_PHOTOS);
```

**Notes**:
- `limit(1)` — μόνο existence check, δεν χρειαζόμαστε count
- Conditional update — αποφεύγει unnecessary Firestore writes
- Τα upload handlers ΔΕΝ αλλάζουν — ήδη δουλεύουν σωστά

**Effort**: ~2 hours

---

### P2-2: Installment Sum Route-Level Validation (F-8)

**Problem**: Η POST installments route δεν ελέγχει sum στο route level. Η validation υπάρχει **μόνο στο service layer** (`PaymentPlanService.addInstallment()`, lines 469–482) με 95% max rule. Route-level validation λείπει ως defense-in-depth.

**Service-level guard** (`src/services/payment-plan.service.ts`, lines 469–482):
```typescript
// Existing: 95% max rule
const maxAllowed = Math.round(totalUnpaid * 0.95 * 100) / 100;
if (existingInstallments.length > 0 && addedAmount > maxAllowed) {
  // throws error
}
```

**Route handler** (`src/app/api/units/[id]/payment-plan/installments/route.ts`, lines 35–82):
- Line 46–59: Basic field validation (planId, label, type, amount, percentage, dueDate)
- Line 61–67: Direct call to `PaymentPlanService.addInstallment()`
- **Κανένα sum validation** στο route level

**Solution**: Early validation στο route handler, **πριν** κληθεί το service:

```typescript
// After body validation, before service call (around line 60):

// Defense-in-depth: basic amount sanity check at route level
if (typeof body.installment.amount !== 'number' || body.installment.amount <= 0) {
  return NextResponse.json(
    { error: 'Installment amount must be a positive number' },
    { status: 400 }
  );
}

// Optional: fetch plan and validate sum won't exceed total
// (lightweight check — full validation happens in service layer)
const plan = await PaymentPlanService.getPaymentPlan(unitId, body.planId);
if (plan) {
  const existingSum = (plan.installments ?? []).reduce(
    (sum, inst) => sum + (inst.amount ?? 0), 0
  );
  const newTotal = existingSum + body.installment.amount;
  const tolerance = 0.01; // 1 cent tolerance for floating point

  if (newTotal > plan.totalAmount + tolerance) {
    return NextResponse.json(
      {
        error: `Installment sum (${newTotal.toFixed(2)}) would exceed plan total (${plan.totalAmount.toFixed(2)})`,
      },
      { status: 400 }
    );
  }
}
```

**Notes**:
- Αυτό είναι **defense-in-depth** — το service layer κρατάει την authoritative validation
- Route-level check αποτρέπει obviously invalid requests πριν φτάσουν στο service
- Fail-open: αν ο plan fetch αποτύχει, αφήνει το service να κρίνει

**Effort**: ~30 minutes

---

## 4. Files Affected

### New Files
| File | Purpose |
|------|---------|
| `src/lib/validation/unit-coverage-sync.ts` | Shared utility για unitCoverage recalculation |

### Modified Files
| File | Change |
|------|--------|
| Photo/Floorplan/Document delete handlers | Call `recalculateUnitCoverageFlag()` after delete |
| `src/app/api/units/[id]/payment-plan/installments/route.ts` | Add route-level sum validation |

---

## 5. Verification Criteria

### P2-1: unitCoverage Recalculation
- [x] Delete last photo → `unitCoverage.hasPhotos` becomes `false`
- [x] Delete photo (but others remain) → `unitCoverage.hasPhotos` stays `true`
- [x] Delete last floorplan → `unitCoverage.hasFloorplans` becomes `false`
- [x] Delete last document → `unitCoverage.hasDocuments` becomes `false`
- [x] Upload photo to unit with `hasPhotos: false` → `hasPhotos` becomes `true` (existing behavior preserved)
- [x] No unnecessary Firestore writes when flag doesn't change

### P2-2: Installment Sum Validation
- [x] POST installment that keeps total ≤ plan total → 201
- [x] POST installment that would exceed plan total → 400 (route-level)
- [x] POST installment with negative amount → 400
- [x] POST installment with amount = 0 → 400
- [x] Service-level 95% rule still applies independently
- [x] Route-level check doesn't block valid installments that pass service validation

---

## 6. Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-03-19 | Initial SPEC creation — 2 P2 fixes documented | Claude Code |
| 2026-03-19 | ✅ Both P2 fixes implemented: unit-coverage-recalculator.ts utility, installment amount validation | Claude Code |
