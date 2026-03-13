# SPEC-228-04: Enhancements & Cleanup (Tier 4)

| Field | Value |
|-------|-------|
| **ADR** | ADR-228 |
| **Phase** | Tier 4 — Low Priority (Enhancements & Cleanup) |
| **Priority** | LOW |
| **Estimated Effort** | 1 session |
| **Prerequisite** | SPEC-228-00 (Tier 0) |
| **Files Created** | 0 |
| **Files Modified** | 4-6 |

---

## 1. Objective

Fix anomalies, cleanup dead code, wire remaining low-priority subscribers:
- **STORAGE dispatch gap** — fix missing CREATED/DELETED dispatchers
- **USER_SETTINGS_*** → cross-tab preference sync
- **ASSOC_LINKS** → contact/file link change subscribers
- **Dead code cleanup** — NOTIFICATION_*, NAVIGATION_REFRESH

---

## 2. Task A: Fix STORAGE Dispatch Gap (ANOMALY)

### Problem
- `useFirestoreStorages.ts` subscribes σε `STORAGE_CREATED`, `STORAGE_UPDATED`, `STORAGE_DELETED`
- **Μόνο `STORAGE_UPDATED`** dispatch-άρεται (από `StorageGeneralTab.tsx:190`)
- `STORAGE_CREATED` και `STORAGE_DELETED`: **0 dispatch calls** → subscribers are dead code

### Fix
Ψάξε τα σημεία δημιουργίας/διαγραφής storage spaces και πρόσθεσε dispatch calls.

**Πιθανά σημεία:**
- Storage creation dialog/form — πρόσθεσε:
```typescript
RealtimeService.dispatch('STORAGE_CREATED', {
  storageId: newStorageId,
  storage: { name: storageName, buildingId, type: storageType },
  timestamp: Date.now(),
});
```

- Storage deletion handler — πρόσθεσε:
```typescript
RealtimeService.dispatch('STORAGE_DELETED', {
  storageId: deletedId,
  timestamp: Date.now(),
});
```

### Research
`Grep` for storage creation/deletion logic to find exact files.

### Payload Types (already defined)
```typescript
StorageCreatedPayload { storageId, storage: { name?, buildingId?, type? }, timestamp }
StorageDeletedPayload { storageId, timestamp }
```

---

## 3. Task B: USER_SETTINGS Event Subscribers

### Context
- **Dispatchers (4 sites)**:
  - `UserNotificationSettingsService.ts` — 2x USER_SETTINGS_UPDATED
  - `EnterpriseUserPreferencesService.ts` — 2x USER_SETTINGS_UPDATED
- **Use Case**: Cross-tab preference sync — αν αλλάξεις theme/language σε ένα tab, ενημερώνεται και το άλλο

### Target
Ψάξε hook/component που κρατάει user settings state (π.χ. `useUserPreferences`, theme context).

### Implementation Pattern
```typescript
useEffect(() => {
  const handleSettingsUpdated = (payload: UserSettingsUpdatedPayload) => {
    // Only react to own settings changes
    if (payload.userId === currentUserId) {
      refetchSettings();
    }
  };

  const unsub = RealtimeService.subscribe('USER_SETTINGS_UPDATED', handleSettingsUpdated);
  return () => unsub();
}, [currentUserId, refetchSettings]);
```

### Payload Type (already defined)
```typescript
UserSettingsUpdatedPayload { userId, updates: { settingKey?, value? }, timestamp }
```

---

## 4. Task C: ASSOC_LINKS Subscribers

### Context
- **Dispatchers**: `association.service.ts` dispatches:
  - `CONTACT_LINK_CREATED` (:140)
  - `FILE_LINK_CREATED` (:315)
  - `CONTACT_LINK_REMOVED` (:471)
- **Note**: `CONTACT_LINK_DELETED` και `FILE_LINK_DELETED` are defined in types but NOT dispatched

### Target
Ψάξε components που δείχνουν linked contacts/files σε entity pages.

### Implementation Pattern
```typescript
useEffect(() => {
  const handleContactLinked = (_payload: ContactLinkCreatedPayload) => {
    refetchLinkedContacts();
  };

  const handleContactUnlinked = (_payload: ContactLinkRemovedPayload) => {
    refetchLinkedContacts();
  };

  const handleFileLinked = (_payload: FileLinkCreatedPayload) => {
    refetchLinkedFiles();
  };

  const unsubCL = RealtimeService.subscribe('CONTACT_LINK_CREATED', handleContactLinked);
  const unsubCR = RealtimeService.subscribe('CONTACT_LINK_REMOVED', handleContactUnlinked);
  const unsubFL = RealtimeService.subscribe('FILE_LINK_CREATED', handleFileLinked);

  return () => { unsubCL(); unsubCR(); unsubFL(); };
}, [refetchLinkedContacts, refetchLinkedFiles]);
```

---

## 5. Task D: Dead Code Cleanup

### NOTIFICATION_* Events
- Types ορισμένα στο `RealtimeEventMap`: NOTIFICATION_CREATED, NOTIFICATION_UPDATED, NOTIFICATION_DELETED
- **0 dispatch calls, 0 subscribe calls**
- Notifications ήδη δουλεύουν μέσω `firestoreQueryService.subscribe()` (ADR-227 Phase 2)

**Decision**: Κρατήσου τους types (δεν κοστίζουν τίποτα) — μπορεί να χρειαστούν αν θέλουμε optimistic updates μελλοντικά.

### NAVIGATION_REFRESH Event
- Type ορισμένο στο `RealtimeEventMap`
- **0 dispatch calls, 0 subscribe calls**
- Πιθανώς legacy remnant

**Decision**: Αφαίρεσε αν δεν χρησιμοποιείται πουθενά. Κάνε `Grep` για safety.

---

## 6. Research Required Before Implementation

1. **STORAGE creation/deletion**: `Grep` for storage create/delete handlers
2. **USER_SETTINGS target**: `Grep` for user preferences hook/context
3. **ASSOC_LINKS target**: `Grep` for linked contacts/files display components
4. **NAVIGATION_REFRESH usage**: `Grep` to confirm zero references before removal

---

## 7. Verification Checklist

- [ ] STORAGE_CREATED dispatch added to storage creation point
- [ ] STORAGE_DELETED dispatch added to storage deletion point
- [ ] USER_SETTINGS_UPDATED subscriber wired in user preferences hook
- [ ] CONTACT_LINK_CREATED/REMOVED subscribers wired
- [ ] FILE_LINK_CREATED subscriber wired
- [ ] NAVIGATION_REFRESH cleaned up (if confirmed unused)
- [ ] TypeScript compiles without errors

---

## 8. Files Touched

| File | Action |
|------|--------|
| Storage creation component (TBD) | ADD STORAGE_CREATED dispatch |
| Storage deletion handler (TBD) | ADD STORAGE_DELETED dispatch |
| User preferences hook (TBD) | ADD USER_SETTINGS_UPDATED subscriber |
| Entity linked contacts/files component (TBD) | ADD ASSOC_LINKS subscribers |
| `src/services/realtime/types.ts` | REMOVE NAVIGATION_REFRESH (if unused) |

---

## 9. Coverage Impact

| Entity Group | Before | After |
|-------------|--------|-------|
| STORAGE | 33% ⚠️ | 100% ✅ |
| USER_SETTINGS | 0% ❌ | 100% ✅ |
| ASSOC_LINKS | 0% ❌ | 100% ✅ |
| NOTIFICATION | 0% (types only) | — (no action) |
| NAVIGATION_REFRESH | Dead code | Removed |
| **Total Coverage** | 94% (after Tier 3) | **100%** ✅ |
