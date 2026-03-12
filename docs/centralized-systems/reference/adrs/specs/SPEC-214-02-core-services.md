# SPEC-214-02: Core Services Migration

| Metadata | Value |
|----------|-------|
| **ADR** | ADR-214 |
| **Phase** | 2 |
| **Status** | PENDING |
| **Risk** | MEDIUM |
| **Αρχεία** | 3-4 modified |
| **Depends On** | SPEC-214-01 |

---

## Στόχος

Migration των core business services (`units.service.ts`, `contacts.service.ts`, `workspace.service.ts`) από inline Firebase SDK queries σε `FirestoreQueryService`.

---

## Αρχεία προς Αλλαγή

### 1. `src/services/units.service.ts`

**Τρέχουσα κατάσταση**: 8 getDocs calls, inline queries, ⚠️ μόνο buildingId filter

**Αλλαγές**:
```typescript
// ΠΡΙΝ
const q = query(
  collection(db, UNITS_COLLECTION),
  where('buildingId', '==', buildingId),
  orderBy('name', 'asc')
);
const snapshot = await getDocs(q);

// ΜΕΤΑ
const result = await queryService.read<Unit>({
  collection: 'UNITS',
  constraints: [where('buildingId', '==', buildingId)],
  orderByField: 'name',
  orderDirection: 'asc'
});
```

**Κρίσιμα σημεία**:
- 8 query locations πρέπει να αλλάξουν
- `interiorFeatures` array-contains-any query πρέπει να δοκιμαστεί
- Return types πρέπει να παραμείνουν ίδια (backward compatible)

### 2. `src/services/contacts.service.ts`

**Τρέχουσα κατάσταση**: 6 where clauses, companyId filter ✅

**Αλλαγές**: Replace inline queries με `queryService.read()`. Ο tenant filter ήδη υπάρχει.

### 3. `src/services/workspace.service.ts`

**Τρέχουσα κατάσταση**: 2 getDocs calls, ⚠️ partial tenant filter

**Αλλαγές**: Replace inline queries. Πρέπει να ελεγχθεί αν χρειάζεται explicit companyId.

---

## Testing Plan

Μετά κάθε αρχείο:
1. `npx tsc --noEmit` — zero errors
2. Manual test: Φόρτωσε τη σελίδα που χρησιμοποιεί το service
3. Verify: Τα δεδομένα εμφανίζονται σωστά
4. Verify: Pagination δουλεύει (αν υπάρχει)

---

## Rollback Plan

Κάθε αρχείο αλλάζει σε ξεχωριστό commit. Αν σπάσει κάτι:
```bash
git revert HEAD  # Revert τελευταίο commit
git push origin main
```

---

## Verification Checklist

- [ ] `units.service.ts` — όλα τα 8 queries migrated
- [ ] `contacts.service.ts` — όλα τα queries migrated
- [ ] `workspace.service.ts` — migrated
- [ ] Return types unchanged (backward compatible)
- [ ] Tenant filtering maintained ή βελτιωμένο
- [ ] No `addDoc` introduced (ADR-210 compliance)
- [ ] `npx tsc --noEmit` clean
