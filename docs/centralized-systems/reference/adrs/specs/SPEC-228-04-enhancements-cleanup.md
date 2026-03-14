# SPEC-228-04: Enhancements & Cleanup (Tier 4)

| Field | Value |
|-------|-------|
| **ADR** | ADR-228 |
| **Phase** | Tier 4 — Low Priority (Enhancements & Cleanup) |
| **Priority** | LOW |
| **Status** | ✅ IMPLEMENTED |
| **Implemented** | 2026-03-14 |
| **Estimated Effort** | 1 session |
| **Prerequisite** | SPEC-228-00 (Tier 0) |
| **Files Created** | 0 |
| **Files Modified** | 3 |

---

## 1. Objective

Wire remaining low-priority subscribers and close coverage gaps:
- **STORAGE dispatch gap** — Already implemented (no changes needed)
- **USER_SETTINGS_*** → cross-tab preference sync via cache invalidation
- **ASSOC_LINKS** → contact/file link change subscribers
- **Dead code cleanup** — NAVIGATION_REFRESH kept (active), NOTIFICATION_* types kept (no cost)

---

## 2. Task A: STORAGE Dispatch Gap — ✅ Already Implemented

### Research Findings
- `AddStorageDialog.tsx:118` already dispatches `STORAGE_CREATED`
- `page.tsx:88` (storage management) already dispatches `STORAGE_DELETED`
- **No changes needed** — gap was already fixed in prior work

---

## 3. Task B: USER_SETTINGS Event Subscriber — ✅ Implemented

### Implementation
- **File**: `src/auth/contexts/AuthContext.tsx`
- **Strategy**: Subscribe to `USER_SETTINGS_UPDATED` in AuthContext (global scope, guaranteed activation, always has userId)
- **Action**: Cache invalidation via `userPreferencesService.clearCacheForUser(userId)` — next read fetches fresh data

```typescript
useEffect(() => {
  if (!user) return;
  const handleSettingsUpdated = (payload: UserSettingsUpdatedPayload) => {
    if (payload.userId === user.uid) {
      userPreferencesService.clearCacheForUser(user.uid);
    }
  };
  const unsub = RealtimeService.subscribe('USER_SETTINGS_UPDATED', handleSettingsUpdated);
  return () => unsub();
}, [user]);
```

---

## 4. Task C: ASSOC_LINKS Subscribers — ✅ Implemented

### Contact Link Subscribers
- **File**: `src/hooks/useEntityAssociations.ts`
- **Two hooks wired**:
  - `useEntityContactLinks` — subscribes to `CONTACT_LINK_CREATED` (filtered by entityType+entityId) + `CONTACT_LINK_REMOVED` (full refresh)
  - `useContactEntityLinks` — subscribes to `CONTACT_LINK_CREATED` (filtered by sourceContactId) + `CONTACT_LINK_REMOVED` (full refresh)

### File Link Subscriber
- **File**: `src/components/shared/files/hooks/useEntityFiles.ts`
- Extended existing ADR-228 Tier 2 useEffect with `FILE_LINK_CREATED` handler
- Filtered by `targetEntityType` + `targetEntityId`

---

## 5. Task D: Dead Code Assessment — No Changes

### NAVIGATION_REFRESH
- Research found **3 dispatch sites** and **4 active subscribers** — NOT dead code
- **Decision**: Keep as-is

### NOTIFICATION_*
- Types defined but 0 dispatches / 0 subscribers
- Notifications work via `firestoreQueryService.subscribe()` (ADR-227 Phase 2)
- **Decision**: Keep types (zero cost, may be needed for optimistic updates)

---

## 6. Verification Checklist

- [x] STORAGE_CREATED/DELETED — already dispatched (no changes needed)
- [x] USER_SETTINGS_UPDATED subscriber wired in AuthContext
- [x] CONTACT_LINK_CREATED/REMOVED subscribers wired in useEntityAssociations
- [x] FILE_LINK_CREATED subscriber wired in useEntityFiles
- [x] NAVIGATION_REFRESH — kept (active, not dead code)
- [x] NOTIFICATION_* — types kept (no cost)
- [x] TypeScript compiles without errors

---

## 7. Files Touched

| File | Action |
|------|--------|
| `src/auth/contexts/AuthContext.tsx` | ADD USER_SETTINGS_UPDATED subscriber + imports |
| `src/hooks/useEntityAssociations.ts` | ADD CONTACT_LINK_CREATED/REMOVED subscribers (2 hooks) + imports |
| `src/components/shared/files/hooks/useEntityFiles.ts` | EXTEND existing useEffect with FILE_LINK_CREATED + import |

---

## 8. Coverage Impact

| Entity Group | Before | After |
|-------------|--------|-------|
| STORAGE | 33% ⚠️ | 100% ✅ (already fixed) |
| USER_SETTINGS | 0% ❌ | 100% ✅ |
| ASSOC_LINKS | 0% ❌ | 100% ✅ |
| NOTIFICATION | 0% (types only) | — (no action, kept) |
| NAVIGATION_REFRESH | Active (not dead) | — (no action) |
| **Total Coverage** | 94% (after Tier 3) | **100%** ✅ |
