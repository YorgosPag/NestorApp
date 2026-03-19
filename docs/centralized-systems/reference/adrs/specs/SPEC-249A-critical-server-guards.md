# SPEC-249A: Critical Server Guards (P0)

> **Invoice Immutability, Field Locking Bypass, Floor Uniqueness**

| Metadata | Value |
|----------|-------|
| **Parent ADR** | ADR-249 (Comprehensive Server-Side Integrity Audit) |
| **Phase** | P0 — Critical Fixes (Before Production) |
| **Priority** | CRITICAL |
| **Status** | ✅ IMPLEMENTED |
| **Estimated Effort** | ~4 hours |
| **Dependencies** | None — self-contained fixes |
| **Date** | 2026-03-19 |

---

## 1. Objective

Υλοποίηση **3 κρίσιμων server-side guards** που εμποδίζουν:
- Τροποποίηση finalized τιμολογίων (legal/tax compliance)
- Bypass field locking μέσω alternative endpoints (contract integrity)
- Duplicate floor numbers στο ίδιο building (data corruption)

Αυτά τα 3 findings είναι **P0 — must fix before production** λόγω legal risk ή data corruption.

---

## 2. Findings Covered

| Finding | Severity | Risk |
|---------|----------|------|
| **F-3** Invoice Immutability | CRITICAL | Legal — τροποποίηση τιμολογίων μετά υποβολή ΑΑΔΕ |
| **F-4** Field Locking Bypass | CRITICAL | Legal — τροποποίηση locked πεδίων σε sold/rented units |
| **F-2** Floor Number Uniqueness | CRITICAL | Data corruption — duplicate floors σε building |

---

## 3. Implementation Details

### P0-1: Invoice Immutability Guard (F-3)

**Problem**: Ο PATCH handler στο invoice endpoint δέχεται updates σε **ΟΛΕΣ** τις καταστάσεις, χωρίς κανέναν status check. Finalized τιμολόγια (accepted, cancelled) μπορούν να τροποποιηθούν.

**File**: `src/app/api/accounting/invoices/[id]/route.ts`
- **PATCH handler**: `handlePatch()` (line 69)
- Line 89–95: Fetch invoice, existence check only
- Line 97: Direct `repository.updateInvoice(id, body)` — **κανένας status guard**

**Invoice Statuses** (`src/subapps/accounting/types/common.ts`, lines 122–127):
```typescript
export type MyDataDocumentStatus =
  | 'draft'      // Πρόχειρο — EDITABLE ✅
  | 'sent'       // Υποβλήθηκε στο myDATA — EDITABLE ✅ (μόνο limited fields)
  | 'accepted'   // Αποδεκτό από ΑΑΔΕ — IMMUTABLE ❌
  | 'rejected'   // Απορρίφθηκε — EDITABLE ✅ (για διόρθωση & επανυποβολή)
  | 'cancelled'; // Ακυρωμένο — IMMUTABLE ❌
```

**Solution**: Πριν το `repository.updateInvoice()`:

```typescript
// 1. Fetch current invoice (ήδη γίνεται στο line 89)
const invoice = await repository.getInvoiceById(id);

// 2. Immutability check
const IMMUTABLE_STATUSES: MyDataDocumentStatus[] = ['accepted', 'cancelled'];
if (invoice.mydata?.status && IMMUTABLE_STATUSES.includes(invoice.mydata.status)) {
  return NextResponse.json(
    { error: `Cannot modify invoice with status '${invoice.mydata.status}'. Accepted and cancelled invoices are immutable.` },
    { status: 403 }
  );
}

// 3. Optional: For 'sent' status, allow only limited fields (notes, internalComments)
const SENT_ALLOWED_FIELDS = ['notes', 'internalComments'] as const;
if (invoice.mydata?.status === 'sent') {
  const bodyKeys = Object.keys(body);
  const disallowed = bodyKeys.filter(k => !SENT_ALLOWED_FIELDS.includes(k as typeof SENT_ALLOWED_FIELDS[number]));
  if (disallowed.length > 0) {
    return NextResponse.json(
      { error: `Cannot modify fields [${disallowed.join(', ')}] on a sent invoice. Only [${SENT_ALLOWED_FIELDS.join(', ')}] are editable.` },
      { status: 403 }
    );
  }
}
```

**Valid State Transitions**:
```
draft → sent → accepted (terminal)
draft → sent → rejected → draft (re-edit cycle)
draft → cancelled (terminal)
sent → cancelled (terminal)
```

**Effort**: ~1 hour

---

### P0-2: Field Locking in Alternative Endpoints (F-4)

**Problem**: Το κύριο endpoint `units/[id]/route.ts` κλειδώνει 19 πεδία σε sold/rented units. Τα alternative endpoints `real-update` και `final-solution` κάνουν **direct `.update()`** χωρίς κανέναν έλεγχο.

**Existing locking** (`src/app/api/units/[id]/route.ts`, lines 112–130):

```typescript
// Sold/Rented: 19 locked fields
const soldLockedFields = [
  'code', 'type', 'name', 'areas', 'layout', 'floor', 'floorId',
  'commercialStatus', 'buildingId', 'linkedSpaces',
  'orientations', 'condition', 'energy', 'systemsOverride',
  'finishes', 'interiorFeatures', 'securityFeatures',
  'levels', 'isMultiLevel', 'levelData',
] as const;

// Reserved: 3 locked fields
const reservedLockedFields = ['code', 'type', 'name'] as const;
```

**Bypassing endpoints** (NO locking):
- `src/app/api/units/real-update/route.ts` (line 150) — direct `doc.update({ soldTo: contact.id })`
- `src/app/api/units/final-solution/route.ts` (line 149) — direct `doc.update({ soldTo: contact.id })`

**Solution**: Εξαγωγή field locking σε shared utility.

**Νέο αρχείο**: `src/lib/validation/unit-field-locking.ts`

```typescript
import { ApiError } from '@/lib/errors';

/** Fields locked when unit is sold or rented */
const SOLD_RENTED_LOCKED_FIELDS = [
  'code', 'type', 'name', 'areas', 'layout', 'floor', 'floorId',
  'commercialStatus', 'buildingId', 'linkedSpaces',
  'orientations', 'condition', 'energy', 'systemsOverride',
  'finishes', 'interiorFeatures', 'securityFeatures',
  'levels', 'isMultiLevel', 'levelData',
] as const;

/** Fields locked when unit is reserved */
const RESERVED_LOCKED_FIELDS = ['code', 'type', 'name'] as const;

/**
 * Validates that no locked fields are being modified based on unit's commercial status.
 * Throws ApiError(403) if locked fields are touched.
 *
 * @param commercialStatus - Current commercial status of the unit
 * @param updateKeys - Keys being updated (Object.keys of the update payload)
 */
export function validateFieldLocking(
  commercialStatus: string | null | undefined,
  updateKeys: string[]
): void {
  if (!commercialStatus) return;

  if (commercialStatus === 'sold' || commercialStatus === 'rented') {
    const violations = updateKeys.filter(k =>
      (SOLD_RENTED_LOCKED_FIELDS as readonly string[]).includes(k)
    );
    if (violations.length > 0) {
      throw new ApiError(
        403,
        `Cannot modify locked fields [${violations.join(', ')}] on a ${commercialStatus} unit`
      );
    }
  }

  if (commercialStatus === 'reserved') {
    const violations = updateKeys.filter(k =>
      (RESERVED_LOCKED_FIELDS as readonly string[]).includes(k)
    );
    if (violations.length > 0) {
      throw new ApiError(
        403,
        `Cannot modify locked fields [${violations.join(', ')}] on a reserved unit`
      );
    }
  }
}
```

**Εφαρμογή**:
1. `units/[id]/route.ts` — αντικατάσταση inline logic (lines 112–130) με `validateFieldLocking()`
2. `units/real-update/route.ts` — πριν το `.update()` (line 150)
3. `units/final-solution/route.ts` — πριν το `.update()` (line 149)

**Effort**: ~2 hours

---

### P0-3: Floor Number Uniqueness (F-2)

**Problem**: Ο POST handler δημιουργεί floor χωρίς να ελέγξει αν υπάρχει ήδη floor με τον ίδιο αριθμό στο ίδιο building.

**File**: `src/app/api/floors/route.ts`
- Line 233–241: Validation (number, name, buildingId) — **χωρίς uniqueness check**
- Line 256: `createEntity('floor', ...)` — direct creation

**Solution**: Query πριν το `createEntity`:

```typescript
// Before createEntity (line ~256):
const existingFloors = await getAdminFirestore()
  .collection(COLLECTIONS.FLOORS)
  .where(FIELDS.BUILDING_ID, '==', body.buildingId)
  .where('number', '==', body.number)
  .where(FIELDS.IS_DELETED, '==', false)
  .limit(1)
  .get();

if (!existingFloors.empty) {
  return NextResponse.json(
    { error: `Floor number ${body.number} already exists in this building` },
    { status: 409 }
  );
}
```

**Notes**:
- Χρήση `FIELDS.BUILDING_ID` και `FIELDS.IS_DELETED` από centralized constants
- `limit(1)` για performance — χρειαζόμαστε μόνο existence check
- 409 Conflict — standard HTTP status για duplicate resource

**Effort**: ~1 hour

---

## 4. Files Affected

### New Files
| File | Purpose |
|------|---------|
| `src/lib/validation/unit-field-locking.ts` | Shared field locking utility |

### Modified Files
| File | Change |
|------|--------|
| `src/app/api/accounting/invoices/[id]/route.ts` | Add immutability guard in PATCH |
| `src/app/api/units/[id]/route.ts` | Replace inline locking with `validateFieldLocking()` |
| `src/app/api/units/real-update/route.ts` | Add `validateFieldLocking()` call |
| `src/app/api/units/final-solution/route.ts` | Add `validateFieldLocking()` call |
| `src/app/api/floors/route.ts` | Add floor uniqueness query before create |

---

## 5. Verification Criteria

### P0-1: Invoice Immutability
- [x] PATCH on `accepted` invoice → returns 403
- [x] PATCH on `cancelled` invoice → returns 403
- [x] PATCH on `draft` invoice → succeeds (200)
- [x] PATCH on `rejected` invoice → succeeds (allows re-edit)
- [x] PATCH on `sent` invoice with `notes` → succeeds
- [x] PATCH on `sent` invoice with `amount` → returns 403
- [x] DELETE on any invoice → soft-delete still works (sets cancelled)

### P0-2: Field Locking
- [x] `units/[id]` PATCH with `code` on sold unit → 403
- [x] `units/real-update` with locked field on sold unit → 403
- [x] `units/final-solution` with locked field on sold unit → 403
- [x] `units/[id]` PATCH with `description` on sold unit → succeeds (not locked)
- [x] `units/[id]` PATCH with `code` on reserved unit → 403
- [x] `units/[id]` PATCH with `areas` on reserved unit → succeeds (not locked for reserved)

### P0-3: Floor Uniqueness
- [x] POST floor (buildingId=X, number=3) when no floor 3 → 201
- [x] POST floor (buildingId=X, number=3) when floor 3 exists → 409
- [x] POST floor (buildingId=Y, number=3) when floor 3 exists in X → 201 (different building)
- [x] POST floor (buildingId=X, number=3) when floor 3 is soft-deleted → 201 (deleted doesn't count)

---

## 6. Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-03-19 | Initial SPEC creation — 3 P0 fixes documented | Claude Code |
| 2026-03-19 | ✅ All 3 P0 fixes implemented: Invoice immutability guard (PATCH 403 for accepted/sent/cancelled, DELETE 409 for already cancelled), shared field locking utility (`unit-field-locking.ts`) with refactored units/[id] + guards in real-update and final-solution, floor uniqueness guard in floors/route.ts POST (409 for duplicate floor number per building) | Claude Code |
