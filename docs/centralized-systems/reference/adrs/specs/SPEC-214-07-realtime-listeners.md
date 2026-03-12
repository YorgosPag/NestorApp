# SPEC-214-07: Real-time Listeners Migration

| Metadata | Value |
|----------|-------|
| **ADR** | ADR-214 |
| **Phase** | 7 |
| **Status** | PENDING |
| **Risk** | HIGH |
| **Αρχεία** | 3-4 modified |
| **Depends On** | SPEC-214-01 |

---

## Στόχος

Migration `onSnapshot()` listeners. **ΥΨΗΛΟ ΡΙΣΚΟ** γιατί:
- Listeners είναι stateful (subscribe/unsubscribe lifecycle)
- Bugs εδώ = memory leaks ή stale data στο UI
- Πρέπει να διατηρηθεί η React lifecycle integration

---

## Αρχεία προς Αλλαγή

### 1. `src/services/realtime/RealtimeService.ts`

**Κρίσιμο**: Αυτό είναι ήδη centralized subscription manager. Ίσως δεν χρειάζεται migration αλλά **integration** με το queryService.

### 2. `src/services/realtime/hooks/useRealtimeUnits.ts`

### 3. `src/services/realtime/hooks/useRealtimeBuildings.ts`

### 4. `src/components/property-viewer/ReadOnlyLayerViewer.tsx`

---

## Migration Pattern

```typescript
// ΠΡΙΝ
const unsubscribe = onSnapshot(
  query(collection(db, COLLECTION_NAME), where(...), orderBy(...)),
  (snapshot) => { /* handle */ },
  (error) => { /* handle */ }
);

// ΜΕΤΑ
const unsubscribe = queryService.subscribe<Unit>({
  collection: 'UNITS',
  constraints: [where(...)],
  orderByField: '...'
}, (items) => { /* handle */ }, (error) => { /* handle */ });
```

---

## Κανόνες Ασφαλείας

```
1. ΠΟΤΕ μην αλλάξεις περισσότερα από 1 listener ανά commit
2. Test κάθε listener LIVE πριν commit
3. Verify: Unsubscribe δουλεύει (component unmount → no memory leak)
4. Verify: Data updates σε real-time (αλλαγή στο Firestore → UI update)
```

---

## Verification Checklist (ανά listener)

- [ ] Initial data loads correctly
- [ ] Real-time updates propagate to UI
- [ ] Component unmount → listener unsubscribed
- [ ] No console errors/warnings
- [ ] No memory leaks (check React DevTools)
- [ ] `npx tsc --noEmit` clean
