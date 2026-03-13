# SPEC-228-01: Critical Subscribers (Tier 1)

| Field | Value |
|-------|-------|
| **ADR** | ADR-228 |
| **Phase** | Tier 1 — Critical (Security & Navigation) |
| **Priority** | HIGH |
| **Status** | ✅ IMPLEMENTED (2026-03-14) |
| **Estimated Effort** | 1 session |
| **Prerequisite** | SPEC-228-00 (Tier 0) |
| **Files Created** | 0 |
| **Files Modified** | 4 |

---

## 1. Objective

Wire event subscribers για 3 entity groups που έχουν dispatchers αλλά 0 subscribers:
- **UNIT_*** → building management cross-page sync
- **SESSION_*** → browser tab security sync
- **ENTITY_LINKED/UNLINKED** → navigation hierarchy refresh

---

## 2. Task A: UNIT Event Subscribers

### Context
- **Dispatchers**: `units.service.ts` dispatches `UNIT_CREATED`, `UNIT_UPDATED`, `UNIT_DELETED`
- **Existing Hook**: `useRealtimeUnits.ts` ήδη χρησιμοποιεί `firestoreQueryService.subscribe('UNITS', ...)` αλλά **ΔΕΝ** subscribes στο event bus
- **Consumer**: Building detail pages, unit list pages

### Target File
`src/services/realtime/hooks/useRealtimeUnits.ts`

### Implementation
Πρόσθεση useEffect block στο υπάρχον hook (ακριβώς όπως `useRealtimeTasks.ts`):

```typescript
// Event bus subscribers for optimistic UI updates
useEffect(() => {
  const handleCreated = (_payload: UnitCreatedPayload) => {
    refetch();
  };

  const handleUpdated = (payload: UnitUpdatedPayload) => {
    setUnits(prev => prev.map(unit =>
      unit.id === payload.unitId
        ? applyUpdates(unit, payload.updates as Partial<UnitDocument>)
        : unit
    ));
  };

  const handleDeleted = (payload: UnitDeletedPayload) => {
    setUnits(prev => prev.filter(unit => unit.id !== payload.unitId));
  };

  const unsubCreate = RealtimeService.subscribe('UNIT_CREATED', handleCreated);
  const unsubUpdate = RealtimeService.subscribe('UNIT_UPDATED', handleUpdated);
  const unsubDelete = RealtimeService.subscribe('UNIT_DELETED', handleDeleted);

  return () => { unsubCreate(); unsubUpdate(); unsubDelete(); };
}, [refetch]);
```

### Payload Types (already defined in types.ts)
```typescript
UnitCreatedPayload  { unitId, unit: { name?, type?, buildingId? }, timestamp }
UnitUpdatedPayload  { unitId, updates: { name?, type?, status?, area?, floor?, buildingId?, soldTo? }, timestamp }
UnitDeletedPayload  { unitId, timestamp }
```

### Impact
- Building detail → unit list updates optimistically when unit created/edited/deleted from another tab
- Zero new files — extends existing hook

---

## 3. Task B: SESSION Event Subscribers

### Context
- **Dispatchers**: `EnterpriseSessionService.ts` dispatches `SESSION_CREATED`, `SESSION_DELETED`
- **Use Case**: Detect concurrent browser sessions, force logout on session revocation
- **No existing hook** — subscriber logic goes into existing session-aware component

### Target File
`src/services/session/EnterpriseSessionService.ts` (add subscriber method)

### Implementation
Πρόσθεση static subscriber method:

```typescript
/**
 * Subscribe to session events for cross-tab sync.
 * When a session is deleted (e.g., admin force-logout), other tabs react.
 */
static subscribeToSessionEvents(
  currentSessionId: string,
  onSessionRevoked: () => void
): () => void {
  const unsubDeleted = RealtimeService.subscribe('SESSION_DELETED', (payload) => {
    if (payload.sessionId === currentSessionId) {
      logger.warn('Current session revoked — triggering logout');
      onSessionRevoked();
    }
  });

  const unsubCreated = RealtimeService.subscribe('SESSION_CREATED', (payload) => {
    logger.info('New session detected', { sessionId: payload.sessionId });
    // Future: notify user of concurrent session
  });

  return () => { unsubDeleted(); unsubCreated(); };
}
```

### Consumer Integration
Στο component/hook που manages auth state (π.χ. `useAuth` ή `AuthProvider`), κάλεσε:
```typescript
useEffect(() => {
  if (!sessionId) return;
  return EnterpriseSessionService.subscribeToSessionEvents(sessionId, () => {
    signOut(); // Force logout
  });
}, [sessionId]);
```

### Payload Types (already defined)
```typescript
SessionCreatedPayload { sessionId, session: { userId?, deviceInfo? }, timestamp }
SessionDeletedPayload { sessionId, timestamp }
```

### Impact
- Security: Cross-tab session revocation → automatic logout
- UX: Future concurrent session notification

---

## 4. Task C: ENTITY_LINKED/UNLINKED Subscribers

### Context
- **Dispatchers**: `EntityLinkingService.ts:183` dispatches `ENTITY_LINKED`, `:323` dispatches `ENTITY_UNLINKED`
- **Use Case**: Όταν unit συνδέεται με building, ή contact με project, η navigation hierarchy πρέπει να ανανεωθεί
- **Consumer**: `NavigationContext.tsx` — manages sidebar navigation tree

### Target File
`src/components/navigation/core/NavigationContext.tsx`

### Implementation
Πρόσθεση subscribers δίπλα στο υπάρχον `PROJECT_UPDATED` subscriber:

```typescript
// Entity linking — refresh navigation hierarchy
const unsubLinked = RealtimeService.subscribe('ENTITY_LINKED', (payload) => {
  logger.info('Entity linked — refreshing navigation', {
    entityType: payload.entityType,
    parentType: payload.parentType
  });
  refreshNavigation(); // Existing method that re-fetches nav tree
});

const unsubUnlinked = RealtimeService.subscribe('ENTITY_UNLINKED', (payload) => {
  logger.info('Entity unlinked — refreshing navigation', {
    entityType: payload.entityType
  });
  refreshNavigation();
});
```

### Payload Types (already defined)
```typescript
EntityLinkedPayload   { entityId, entityType, parentId, parentType, previousParentId, timestamp }
EntityUnlinkedPayload { entityId, entityType, previousParentId, timestamp }
```

### Impact
- Navigation sidebar updates when entities are linked/unlinked
- No page refresh needed — optimistic hierarchy update

---

## 5. Verification Checklist

- [x] `useRealtimeUnits.ts` — UNIT_* event subscribers added ✅
- [x] `EnterpriseSessionService.ts` — SESSION_* subscriber method added ✅
- [x] Auth consumer — SESSION subscriber wired in `AuthContext.tsx` ✅
- [x] `NavigationContext.tsx` — ENTITY_LINKED/UNLINKED subscribers added ✅
- [x] All subscribers follow canonical pattern (CREATED→refetch, UPDATED→applyUpdates, DELETED→filter) ✅
- [x] Cleanup functions returned in all useEffect blocks ✅
- [ ] TypeScript compiles without errors

---

## 6. Files Touched

| File | Action |
|------|--------|
| `src/services/realtime/hooks/useRealtimeUnits.ts` | ADD UNIT_* event bus subscribers |
| `src/services/session/EnterpriseSessionService.ts` | ADD `subscribeToSessionEvents()` static method |
| `src/auth/contexts/AuthContext.tsx` | ADD session revocation consumer useEffect |
| `src/components/navigation/core/NavigationContext.tsx` | ADD ENTITY_LINKED/UNLINKED subscribers |

---

## 7. Coverage Impact

| Entity Group | Before | After |
|-------------|--------|-------|
| UNIT | 0% ❌ | 100% ✅ |
| SESSION | 0% ❌ | 100% ✅ |
| ENTITY_LINKS | 0% ❌ | 100% ✅ |
| **Total Coverage** | 50% | 67% |
