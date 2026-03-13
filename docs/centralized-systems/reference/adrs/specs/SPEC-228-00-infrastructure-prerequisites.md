# SPEC-228-00: Infrastructure Prerequisites (Tier 0)

| Field | Value |
|-------|-------|
| **ADR** | ADR-228 |
| **Phase** | Tier 0 — Infrastructure |
| **Priority** | BLOCKER — Prerequisite for all other tiers |
| **Estimated Effort** | 1 session |
| **Files Created** | 0 |
| **Files Modified** | 5 |

---

## 1. Objective

Προσθήκη 2 νέων methods στο `firestoreQueryService` και migration 4 blocked hooks (ADR-227 Phase 2) στο canonical pattern.

---

## 2. Task A: `subscribeDoc()` Method (~20 lines)

### Target File
`src/services/firestore/firestore-query.service.ts`

### Method Signature
```typescript
subscribeDoc<T extends DocumentData>(
  key: CollectionKey,
  docId: string,
  onData: (document: T | null) => void,
  onError: (error: Error) => void,
  options?: SubscribeOptions
): Unsubscribe
```

### Implementation Pattern
Ακολουθεί τον ίδιο async auth context pattern με `subscribe()`:
1. Early return αν `options.enabled === false`
2. `cancelled` flag + async `requireAuthContext()`
3. `doc(db, collectionPath, docId)` αντί `collection(db, collectionPath)`
4. `onSnapshot(docRef, snapshot => ...)` αντί `onSnapshot(query, snapshot => ...)`
5. Return cleanup: `() => { cancelled = true; unsubscribe(); }`

### Key Differences vs `subscribe()`
- **ΔΕΝ** χρειάζεται tenant isolation constraints (doc ID = explicit)
- **ΔΕΝ** χρειάζεται `QueryConstraint[]` — single document
- Returns `T | null` αντί `QueryResult<T>`
- `snapshot.exists()` check → αν δεν υπάρχει, `onData(null)`

### Interface Addition
Προσθήκη στο `IFirestoreQueryService` interface (`firestore-query.types.ts`):
```typescript
subscribeDoc<T extends DocumentData>(
  key: CollectionKey,
  docId: string,
  onData: (document: T | null) => void,
  onError: (error: Error) => void,
  options?: SubscribeOptions
): Unsubscribe;
```

---

## 3. Task B: `subscribeSubcollection()` Method (~40 lines)

### Target File
`src/services/firestore/firestore-query.service.ts`

### Method Signature
```typescript
subscribeSubcollection<T extends DocumentData>(
  parentKey: CollectionKey,
  parentId: string,
  subcollectionName: string,
  onData: (result: QueryResult<T>) => void,
  onError: (error: Error) => void,
  options?: SubscribeOptions
): Unsubscribe
```

### Implementation Pattern
1. Early return αν `options.enabled === false`
2. `cancelled` flag + async `requireAuthContext()`
3. Path: `collection(db, parentCollectionPath, parentId, subcollectionName)`
4. Apply `options.constraints` (where/orderBy) — **ΔΕΝ** inject tenant constraints (subcollection inherits)
5. `onSnapshot(query, snapshot => ...)` → transform to `QueryResult<T>`
6. Return cleanup function

### Key Differences vs `subscribe()`
- Path construction: parent collection + parentId + subcollection name
- **ΔΕΝ** inject `companyId` constraint — subcollection inherits parent's tenant scope
- Constraints (where, orderBy) apply κανονικά στα subcollection fields

### Interface Addition
Προσθήκη στο `IFirestoreQueryService` interface:
```typescript
subscribeSubcollection<T extends DocumentData>(
  parentKey: CollectionKey,
  parentId: string,
  subcollectionName: string,
  onData: (result: QueryResult<T>) => void,
  onError: (error: Error) => void,
  options?: SubscribeOptions
): Unsubscribe;
```

---

## 4. Task C: Migrate `useVoiceCommandSubscription` (LOW)

### Current Code (`src/hooks/useVoiceCommandSubscription.ts:62`)
```typescript
const unsubscribe = onSnapshot(
  doc(db, COLLECTIONS.VOICE_COMMANDS, commandId),
  (snapshot) => {
    if (!snapshot.exists()) return;
    const data = snapshot.data() as VoiceCommandDoc;
    updateCommand(commandId, { status: data.status, aiResponse: data.aiResponse ?? null, ... });
  },
  (err) => { updateCommand(commandId, { status: 'failed', error: err.message }); }
);
```

### Target Code
```typescript
const unsubscribe = firestoreQueryService.subscribeDoc<VoiceCommandDoc>(
  'VOICE_COMMANDS',
  commandId,
  (data) => {
    if (!data) return;
    updateCommand(commandId, { status: data.status, aiResponse: data.aiResponse ?? null, ... });
  },
  (err) => { updateCommand(commandId, { status: 'failed', error: err.message }); }
);
```

### Changes
- Remove: `import { doc, onSnapshot } from 'firebase/firestore'`
- Remove: `import { db } from '...'`
- Add: `import { firestoreQueryService } from '@/services/firestore/firestore-query.service'`
- Replace: `onSnapshot(doc(...))` → `firestoreQueryService.subscribeDoc()`

---

## 5. Task D: Migrate `useContactEmailWatch` (LOW)

### Current Code (`src/hooks/sales/useContactEmailWatch.ts:48`)
```typescript
const unsubscribe = onSnapshot(
  doc(db, COLLECTIONS.CONTACTS, contactId),
  (snapshot) => {
    if (!snapshot.exists()) { setState({ hasEmail: false, email: null }); return; }
    const data = snapshot.data();
    // ... email resolution logic ...
    setState({ hasEmail: !!resolvedEmail, email: resolvedEmail });
  },
  () => { setState({ hasEmail: false, email: null }); }
);
```

### Target Code
```typescript
const unsubscribe = firestoreQueryService.subscribeDoc<ContactDocument>(
  'CONTACTS',
  contactId,
  (data) => {
    if (!data) { setState({ hasEmail: false, email: null }); return; }
    // ... same email resolution logic ...
    setState({ hasEmail: !!resolvedEmail, email: resolvedEmail });
  },
  () => { setState({ hasEmail: false, email: null }); }
);
```

### Changes
- Same import swaps as Task C
- Data transformation logic remains identical

---

## 6. Task E: Migrate `useProjectFloorplans` (MEDIUM)

### Current Code (`src/hooks/useProjectFloorplans.ts:184, :250`)
2 ξεχωριστά `onSnapshot()` calls σε 2 ξεχωριστά useEffect:
1. `doc(db, 'project_floorplans', `${projectIdStr}_project`)` → project floorplan
2. `doc(db, 'project_floorplans', `${projectIdStr}_parking`)` → parking floorplan

### Target Code
```typescript
// Project floorplan
const unsub1 = firestoreQueryService.subscribeDoc<FirestoreFloorplanData>(
  'PROJECT_FLOORPLANS',  // CollectionKey
  `${projectIdStr}_project`,
  (data) => {
    if (data) {
      const processed = processFloorplanData(data);
      setProjectFloorplan(processed);
    } else {
      setProjectFloorplan(null);
    }
    setLoading(false);
  },
  (err) => { setError(err.message); setLoading(false); }
);

// Parking floorplan
const unsub2 = firestoreQueryService.subscribeDoc<FirestoreFloorplanData>(
  'PROJECT_FLOORPLANS',
  `${projectIdStr}_parking`,
  (data) => {
    if (data) {
      setParkingFloorplan(processFloorplanData(data));
    } else {
      setParkingFloorplan(null);
    }
  },
  (err) => { setError(err.message); }
);
```

### Considerations
- **pako decompression**: `processFloorplanData()` παραμένει ως έχει — CPU-intensive, δεν αλλάζει
- **Authentication guard**: Ελέγξαι αν `subscribeDoc` χρειάζεται `enabled` option βασισμένο σε `user && !authLoading`
- **CollectionKey**: Βεβαιώσου ότι `PROJECT_FLOORPLANS` υπάρχει στο `firestore-collections.ts`

### Prerequisite Check
Verify `PROJECT_FLOORPLANS` exists in `firestore-collections.ts` — αν όχι, πρόσθεσέ το.

---

## 7. Task F: Migrate `BankAccountsService` (HIGH)

### Current Code (`src/services/banking/BankAccountsService.ts:510`)
```typescript
static subscribeToAccounts(contactId: string, callback: (accounts: BankAccount[]) => void): Unsubscribe {
  const accountsRef = this.getAccountsCollection(contactId);
  const q = query(accountsRef, where('isActive', '==', true), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const accounts = snapshot.docs.map(docToBankAccount);
    const sorted = accounts.sort((a, b) => { /* primary first, then newest */ });
    callback(sorted);
  }, (error) => { logger.error('Subscription error:', error); });
}
```

### Target Code
```typescript
static subscribeToAccounts(contactId: string, callback: (accounts: BankAccount[]) => void): Unsubscribe {
  return firestoreQueryService.subscribeSubcollection<BankAccountDocument>(
    'CONTACTS',
    contactId,
    'bankAccounts',
    (result) => {
      const accounts = result.documents.map(docToBankAccount);
      const sorted = accounts.sort((a, b) => { /* primary first, then newest */ });
      callback(sorted);
    },
    (error) => { logger.error('Subscription error:', error); },
    {
      constraints: [
        where('isActive', '==', true),
        orderBy('createdAt', 'desc'),
      ]
    }
  );
}
```

### Considerations
- **Subcollection path**: `contacts/{contactId}/bankAccounts` — handled by `subscribeSubcollection()`
- **Tenant isolation**: NOT needed — subcollection inherits from parent doc
- **Sort**: Secondary client-side sort (isPrimary first) remains
- **Static method**: Remains static — no hook conversion needed

---

## 8. Verification Checklist

- [ ] `subscribeDoc()` method added to `firestore-query.service.ts`
- [ ] `subscribeSubcollection()` method added to `firestore-query.service.ts`
- [ ] Both methods added to `IFirestoreQueryService` interface
- [ ] `useVoiceCommandSubscription.ts` migrated — no direct `onSnapshot` import
- [ ] `useContactEmailWatch.ts` migrated — no direct `onSnapshot` import
- [ ] `useProjectFloorplans.ts` migrated — no direct `onSnapshot` import
- [ ] `BankAccountsService.ts` migrated — no direct `onSnapshot` import
- [ ] `PROJECT_FLOORPLANS` exists in `firestore-collections.ts` (or added)
- [ ] TypeScript compiles without errors (`npx tsc --noEmit`)
- [ ] All 4 hooks/services maintain identical runtime behavior

---

## 9. Files Touched

| File | Action |
|------|--------|
| `src/services/firestore/firestore-query.service.ts` | ADD `subscribeDoc()` + `subscribeSubcollection()` |
| `src/services/firestore/firestore-query.types.ts` | ADD interface methods |
| `src/hooks/useVoiceCommandSubscription.ts` | MIGRATE onSnapshot → subscribeDoc |
| `src/hooks/sales/useContactEmailWatch.ts` | MIGRATE onSnapshot → subscribeDoc |
| `src/hooks/useProjectFloorplans.ts` | MIGRATE 2x onSnapshot → subscribeDoc |
| `src/services/banking/BankAccountsService.ts` | MIGRATE onSnapshot → subscribeSubcollection |
| `src/config/firestore-collections.ts` | VERIFY/ADD PROJECT_FLOORPLANS key |
