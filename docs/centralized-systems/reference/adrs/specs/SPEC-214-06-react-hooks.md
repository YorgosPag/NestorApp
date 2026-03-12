# SPEC-214-06: React Hooks Migration

| Metadata | Value |
|----------|-------|
| **ADR** | ADR-214 |
| **Phase** | 6 |
| **Status** | PENDING |
| **Risk** | MEDIUM |
| **Αρχεία** | 5-6 modified |
| **Depends On** | SPEC-214-01 |

---

## Στόχος

Migration React hooks που κάνουν direct Firestore queries. Αυτά είναι client-side και χρησιμοποιούνται σε UI components.

---

## Αρχεία προς Αλλαγή

### 1. `src/hooks/useFirestoreProjectsPaginated.ts`

**Τρέχουσα κατάσταση**: Dynamic query building, pagination, filter composition

**Πρότυπο migration**:
```typescript
// ΠΡΙΝ (inline)
const buildQuery = useCallback((filters) => {
  let q = query(collection(db, COLLECTIONS.PROJECTS), orderBy('lastUpdate', 'desc'));
  if (filters.companyId) q = query(q, where('companyId', '==', filters.companyId));
  if (filters.status) q = query(q, where('status', '==', filters.status));
  return q;
}, []);

// ΜΕΤΑ (centralized)
const result = await queryService.read<Project>({
  collection: 'PROJECTS',
  constraints: [
    ...(filters.status ? [where('status', '==', filters.status)] : [])
  ],
  orderByField: 'lastUpdate',
  orderDirection: 'desc',
  limitCount: pageSize,
  cursor: lastDoc
});
```

### 2. `src/hooks/useFirestoreBuildings.ts`

### 3. `src/hooks/useFirestoreUnits.ts`

### 4. `src/hooks/useFirestoreNotifications.ts`

### 5. `src/hooks/useFirestoreParkingSpots.ts`

### 6. `src/hooks/useFirestoreStorages.ts`

---

## Προσοχή

- Hooks χρησιμοποιούν `useCallback` / `useMemo` — πρέπει να διατηρηθεί η memoization
- Pagination (InfiniteScroll) πρέπει να δουλεύει ακριβώς όπως πριν
- Αλλαγή σε hook = αλλαγή σε κάθε component που το χρησιμοποιεί

---

## Verification Checklist

- [ ] Projects list loads with pagination
- [ ] Buildings list loads correctly
- [ ] Units list loads correctly
- [ ] Notifications load
- [ ] Parking spots load
- [ ] Storages load
- [ ] Infinite scroll works
- [ ] Filters work (status, companyId, etc.)
- [ ] `npx tsc --noEmit` clean
