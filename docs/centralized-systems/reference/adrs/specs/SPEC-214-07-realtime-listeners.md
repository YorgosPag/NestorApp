# SPEC-214-07: Real-time Listeners Migration

| Metadata | Value |
|----------|-------|
| **ADR** | ADR-214 |
| **Phase** | 7 |
| **Status** | COMPLETED (3/4 targets — RealtimeService integration deferred) |
| **Risk** | HIGH |
| **Αρχεία** | 3 modified |
| **Depends On** | SPEC-214-01 |
| **Completed** | 2026-03-13 |

---

## Στόχος

Migration `onSnapshot()` listeners → `firestoreQueryService.subscribe()`. **ΥΨΗΛΟ ΡΙΣΚΟ** γιατί:
- Listeners είναι stateful (subscribe/unsubscribe lifecycle)
- Bugs εδώ = memory leaks ή stale data στο UI
- Πρέπει να διατηρηθεί η React lifecycle integration

---

## Αρχεία που Άλλαξαν

### 1. `src/services/realtime/hooks/useRealtimeUnits.ts` ✅

**Αφαιρέθηκε**: `onSnapshot`, `collection`, `db`, `getAuth`, `onAuthStateChanged`, `COLLECTIONS`
**Προστέθηκε**: `firestoreQueryService.subscribe('UNITS', ...)`
**SECURITY FIX**: Πριν → `onSnapshot` στο ΟΛΟΚΛΗΡΟ collection χωρίς tenant filter. Τώρα → auto-inject `companyId`.

### 2. `src/services/realtime/hooks/useRealtimeBuildings.ts` ✅

Ίδιο pattern. `firestoreQueryService.subscribe('BUILDINGS', ...)`
**SECURITY FIX**: Ίδιο cross-tenant data leak fixed.

### 3. `src/components/property-viewer/ReadOnlyLayerViewer.tsx` ✅

**Αφαιρέθηκε**: `db`, `collection`, `query`, `onSnapshot`, `COLLECTIONS`
**Προστέθηκε**: `firestoreQueryService.subscribe('LAYERS', { constraints: [where('floorId'), orderBy('zIndex')] })`

### 4. `src/services/realtime/RealtimeService.ts` ⏸️ DEFERRED

Ήδη centralized subscription manager. Integration με `firestoreQueryService` deferred — δεν αλλάζει function signatures.

---

## Migration Pattern (Εφαρμόστηκε)

```typescript
// ΠΡΙΝ — manual auth gating + raw onSnapshot
const auth = getAuth();
const authUnsub = onAuthStateChanged(auth, (user) => {
  if (!user) return;
  const ref = collection(db, COLLECTIONS.XXX);
  firestoreUnsub = onSnapshot(ref, callback, errorCallback);
});

// ΜΕΤΑ — firestoreQueryService handles auth + tenant internally
const unsubscribe = firestoreQueryService.subscribe<DocumentData>(
  'XXX',
  (result: QueryResult<DocumentData>) => { /* map result.documents */ },
  (err: Error) => { /* handle */ },
  { constraints: [...] } // optional
);
```

---

## Κανόνες Ασφαλείας

```
1. ✅ ΠΟΤΕ μην αλλάξεις περισσότερα από 1 listener ανά commit
2. ✅ Test κάθε listener LIVE πριν commit
3. ✅ Verify: Unsubscribe δουλεύει (component unmount → no memory leak)
4. ✅ Verify: Data updates σε real-time (αλλαγή στο Firestore → UI update)
```

---

## Verification Checklist (ανά listener)

- [x] Initial data loads correctly
- [x] Real-time updates propagate to UI
- [x] Component unmount → listener unsubscribed
- [x] No console errors/warnings
- [x] No memory leaks (check React DevTools)
- [x] `npx tsc --noEmit` clean
