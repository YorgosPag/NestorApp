# SPEC-249B: Name Cascade & Data Quality (P1)

> **buyerName Propagation, General Name Cascade, Cross-Company Guard**

| Metadata | Value |
|----------|-------|
| **Parent ADR** | ADR-249 (Comprehensive Server-Side Integrity Audit) |
| **Phase** | P1 — Data Quality (2 sprints) |
| **Priority** | HIGH |
| **Status** | 📋 PENDING |
| **Estimated Effort** | ~8 hours |
| **Dependencies** | P0-2 (shared validation pattern) |
| **Date** | 2026-03-19 |

---

## 1. Objective

Υλοποίηση **3 data quality guards** που εξασφαλίζουν:
- Denormalized `buyerName` ενημερώνεται αυτόματα όταν αλλάζει contact name
- Γενικό name cascade framework για contact names, building names σε associations
- Cross-company linking prevention (building↔project companyId mismatch)

Αυτά τα findings είναι **P1 — fix within 2 sprints** λόγω data quality issues visible to users.

---

## 2. Findings Covered

| Finding | Severity | Risk |
|---------|----------|------|
| **F-1** buyerName Staleness | CRITICAL | Λάθος ονόματα σε UI, reports, τιμολόγια |
| **F-5** General Name Cascade | HIGH | Stale names παντού, broken search/filter |
| **F-7** Cross-Company Linking | MEDIUM | Cross-company data leakage, GDPR |

---

## 3. Implementation Details

### P1-1: buyerName Cascade Propagation (F-1)

**Problem**: Όταν μετονομάζεται ένα contact, τα denormalized `buyerName` πεδία σε units και payment plans παραμένουν stale. Δεν υπάρχει κανένας cascade mechanism.

**Denormalized locations**:
- `units/{id}.commercial.buyerName` (`src/types/unit.ts`, line 112) — type: `string | null`
- `payment_plans/{id}.buyerName` (`src/types/payment-plan.ts`, line 289) — type: `string`
- `sales-accounting-bridge.ts:85` — reads buyerName for notifications

**Existing cascade service**: `src/lib/firestore/cascade-propagation.service.ts`
- 4 existing functions: `propagateBuildingProjectLink()`, `propagateChildBuildingLink()`, `propagateUnitBuildingLink()`, `propagateProjectCompanyLink()`
- All follow fire-and-forget pattern with `CascadeResult` return type
- Pattern: query affected entities → batch update → return result

**Solution**: Νέα function `propagateContactNameChange()` στο cascade service.

```typescript
/**
 * Propagates contact name change to all denormalized copies.
 * Triggered when contact firstName, lastName, or displayName changes.
 *
 * Updates:
 * - units.commercial.buyerName (where buyerContactId === contactId)
 * - payment_plans.buyerName (where buyerContactId === contactId)
 */
export async function propagateContactNameChange(
  contactId: string,
  newDisplayName: string
): Promise<CascadeResult> {
  const db = getAdminFirestore();
  const batch = db.batch();
  let totalUpdated = 0;
  const collections: Record<string, number> = {};

  // 1. Update units.commercial.buyerName
  const unitsSnap = await db
    .collection(COLLECTIONS.UNITS)
    .where('commercial.buyerContactId', '==', contactId)
    .get();

  for (const doc of unitsSnap.docs) {
    batch.update(doc.ref, { 'commercial.buyerName': newDisplayName });
    totalUpdated++;
  }
  collections['units'] = unitsSnap.size;

  // 2. Update payment_plans.buyerName
  const plansSnap = await db
    .collection(COLLECTIONS.PAYMENT_PLANS)
    .where('buyerContactId', '==', contactId)
    .get();

  for (const doc of plansSnap.docs) {
    batch.update(doc.ref, { buyerName: newDisplayName });
    totalUpdated++;
  }
  collections['payment_plans'] = plansSnap.size;

  // 3. Execute batch
  if (totalUpdated > 0) {
    await batch.commit();
  }

  return { success: true, totalUpdated, collections };
}
```

**Trigger point**: Contact PATCH handler — detect name change → fire cascade.

**File**: `src/app/api/contacts/[id]/route.ts` — PATCH handler. Μετά το successful update:
```typescript
// Detect name change
const nameFields = ['firstName', 'lastName', 'displayName'];
const nameChanged = nameFields.some(f => f in body);
if (nameChanged) {
  // Fire-and-forget (consistent with existing cascade pattern)
  const newName = body.displayName ?? `${body.firstName ?? existing.firstName} ${body.lastName ?? existing.lastName}`;
  propagateContactNameChange(id, newName).catch(err =>
    console.error('[Cascade] Contact name propagation failed:', err)
  );
}
```

**Effort**: ~3 hours

---

### P1-2: General Name Cascade Framework (F-5)

**Problem**: Γενικευμένη έλλειψη name cascade πέρα από buyerName. Entity associations (`contactName` field) δεν ενημερώνονται ποτέ.

**Affected fields**:
- `entity_associations.contactName` (`src/types/entity-associations.ts`, line 79) — type: `string`
- Building name denormalized σε child entities (floors, units display)

**Existing pattern**: `propagateCompanyIdChange()` — propagates IDs, NOT names.

**Solution**: Επέκταση cascade service με 2 νέες functions:

#### A. `propagateContactNameToAssociations()`

```typescript
/**
 * Updates contactName in entity_associations where contactId matches.
 */
export async function propagateContactNameToAssociations(
  contactId: string,
  newContactName: string
): Promise<CascadeResult> {
  const db = getAdminFirestore();
  const batch = db.batch();

  const assocSnap = await db
    .collection(COLLECTIONS.ENTITY_ASSOCIATIONS)
    .where(FIELDS.CONTACT_ID, '==', contactId)
    .get();

  for (const doc of assocSnap.docs) {
    batch.update(doc.ref, { contactName: newContactName });
  }

  if (!assocSnap.empty) {
    await batch.commit();
  }

  return {
    success: true,
    totalUpdated: assocSnap.size,
    collections: { entity_associations: assocSnap.size },
  };
}
```

#### B. Integration with P1-1 trigger

Ο trigger στο contact PATCH handler καλεί **και τα δύο** cascades:
```typescript
if (nameChanged) {
  const newName = resolveDisplayName(body, existing);
  // Both cascades fire in parallel (fire-and-forget)
  Promise.all([
    propagateContactNameChange(id, newName),
    propagateContactNameToAssociations(id, newName),
  ]).catch(err => console.error('[Cascade] Name propagation failed:', err));
}
```

**Effort**: ~4 hours (includes testing across entity types)

---

### P1-3: Cross-Company Linking Guard (F-7)

**Problem**: Δεν υπάρχει validation ότι `building.companyId === project.companyId` κατά τη σύνδεση building→project. Αυτό επιτρέπει cross-company data leakage.

**File**: `src/lib/firestore/entity-linking.service.ts`
- `linkEntity()` function (lines 129–232) — 7-step pipeline
- Step 3 (lines 154–164): Field locking check based on `lockedStatuses` — **αλλά κανένας companyId check**

**Solution**: Νέο validation step στο `linkEntity()`, μετά το step 2 (change detection) και πριν το step 3 (field locking):

```typescript
// Step 2.5: Cross-company validation (for building→project links)
if (entry.linkField === 'projectId' && entry.collection === COLLECTIONS.BUILDINGS) {
  const buildingCompanyId = existingDoc[FIELDS.COMPANY_ID] as string | null;
  if (params.newValue && buildingCompanyId) {
    const projectDoc = await db.collection(COLLECTIONS.PROJECTS).doc(params.newValue).get();
    if (projectDoc.exists) {
      const projectCompanyId = projectDoc.data()?.[FIELDS.COMPANY_ID] as string | null;
      if (projectCompanyId && buildingCompanyId !== projectCompanyId) {
        throw new ApiError(
          400,
          `Cannot link building (company: ${buildingCompanyId}) to project (company: ${projectCompanyId}). Company IDs must match.`
        );
      }
    }
  }
}
```

**Exception**: Αν `building.companyId` ή `project.companyId` είναι `null` (unassigned), η σύνδεση **επιτρέπεται** — η εταιρεία θα ανατεθεί μέσω cascade.

**Alternative approach** (scalable): Γενικευμένος `crossEntityValidation` registry entry:
```typescript
// In link-registry, add optional validation:
crossValidation?: {
  field: string;           // e.g., 'companyId'
  mustMatch: true;
  allowNull: true;         // null means "unassigned, OK to link"
};
```

Η γενικευμένη προσέγγιση είναι καλύτερη μακροπρόθεσμα αλλά η inline check αρκεί για P1.

**Effort**: ~1 hour

---

## 4. Files Affected

### New Files
| File | Purpose |
|------|---------|
| — | Καμία νέα δημιουργία αρχείου — extensions σε existing files |

### Modified Files
| File | Change |
|------|--------|
| `src/lib/firestore/cascade-propagation.service.ts` | +`propagateContactNameChange()`, +`propagateContactNameToAssociations()` |
| `src/app/api/contacts/[id]/route.ts` | Trigger cascades on name change |
| `src/lib/firestore/entity-linking.service.ts` | Add cross-company validation in `linkEntity()` |

---

## 5. Verification Criteria

### P1-1: buyerName Cascade
- [ ] Update contact name → `units.commercial.buyerName` updated in all linked units
- [ ] Update contact name → `payment_plans.buyerName` updated in all linked plans
- [ ] Contact with no linked units → cascade completes with `totalUpdated: 0`
- [ ] Batch update stays under Firestore 500-doc limit (or splits into multiple batches)
- [ ] Fire-and-forget pattern — contact PATCH returns immediately, cascade runs async

### P1-2: General Name Cascade
- [ ] Update contact name → `entity_associations.contactName` updated
- [ ] Both cascades (P1-1 + P1-2) fire in parallel without conflicts
- [ ] Performance: cascade completes in <2s for typical data volumes (<50 affected docs)

### P1-3: Cross-Company Guard
- [ ] Link building (companyId=A) to project (companyId=A) → succeeds
- [ ] Link building (companyId=A) to project (companyId=B) → returns 400
- [ ] Link building (companyId=null) to project (companyId=A) → succeeds (unassigned OK)
- [ ] Link building (companyId=A) to project (companyId=null) → succeeds (unassigned OK)
- [ ] Unlink building from project → succeeds regardless of companyId

---

## 6. Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-03-19 | Initial SPEC creation — 3 P1 fixes documented | Claude Code |
