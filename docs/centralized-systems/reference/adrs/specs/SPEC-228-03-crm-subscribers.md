# SPEC-228-03: CRM Subscribers (Tier 3)

| Field | Value |
|-------|-------|
| **ADR** | ADR-228 |
| **Phase** | Tier 3 — Medium Priority (CRM) |
| **Status** | ✅ IMPLEMENTED |
| **Priority** | MEDIUM |
| **Estimated Effort** | 1 session |
| **Prerequisite** | SPEC-228-00 (Tier 0) |
| **Files Created** | 0 |
| **Files Modified** | 3 |

---

## 1. Objective

Wire event subscribers για 3 CRM-related entity groups:
- **COMMUNICATION_*** → inbox, triage view (3 dispatch sites)
- **RELATIONSHIP_*** → contact network views (3 dispatch sites)
- **OBLIGATION_*** → compliance dashboard (4 dispatch sites)

---

## 2. Task A: COMMUNICATION Event Subscribers

### Context
- **Dispatchers**: `communications-client.service.ts` dispatches COMMUNICATION_CREATED (:93), COMMUNICATION_UPDATED (:139), COMMUNICATION_DELETED (:178)
- **Consumers**: Inbox views, triage communications, contact detail communication tabs

### Target Hook
Ψάξε hook που κάνει fetch communications — πιθανώς `useRealtimeTriageCommunications.ts` ή `useRealtimeMessages.ts` (ήδη migrated στο canonical pattern, ADR-227 Phase 2).

### Implementation Pattern
```typescript
useEffect(() => {
  const handleCreated = (_payload: CommunicationCreatedPayload) => {
    refetch(); // New communication — refetch full list
  };

  const handleUpdated = (payload: CommunicationUpdatedPayload) => {
    setCommunications(prev => prev.map(comm =>
      comm.id === payload.communicationId
        ? applyUpdates(comm, payload.updates as Partial<CommunicationDocument>)
        : comm
    ));
  };

  const handleDeleted = (payload: CommunicationDeletedPayload) => {
    setCommunications(prev => prev.filter(c => c.id !== payload.communicationId));
  };

  const unsubCreate = RealtimeService.subscribe('COMMUNICATION_CREATED', handleCreated);
  const unsubUpdate = RealtimeService.subscribe('COMMUNICATION_UPDATED', handleUpdated);
  const unsubDelete = RealtimeService.subscribe('COMMUNICATION_DELETED', handleDeleted);

  return () => { unsubCreate(); unsubUpdate(); unsubDelete(); };
}, [refetch]);
```

### Payload Types (already defined)
```typescript
CommunicationCreatedPayload { communicationId, communication: { type?, subject?, leadId?, contactId?, userId? }, timestamp }
CommunicationUpdatedPayload { communicationId, updates: { type?, subject?, content?, leadId?, contactId? }, timestamp }
CommunicationDeletedPayload { communicationId, timestamp }
```

### Impact
- Triage view updates optimistically when communications are created/updated
- Operator inbox reflects status changes without refresh

---

## 3. Task B: RELATIONSHIP Event Subscribers

### Context
- **Dispatchers**: `FirestoreRelationshipAdapter.ts` dispatches RELATIONSHIP_CREATED (:86), RELATIONSHIP_UPDATED (:140), RELATIONSHIP_DELETED (:164)
- **Consumers**: Contact detail pages — relationship/network tabs

### Target Hook
Ψάξε hook/component που renders contact relationships (π.χ. `ContactRelationshipsTab`, `useContactRelationships`).

### Implementation Pattern
```typescript
useEffect(() => {
  const handleCreated = (_payload: RelationshipCreatedPayload) => {
    refetch();
  };

  const handleUpdated = (payload: RelationshipUpdatedPayload) => {
    setRelationships(prev => prev.map(rel =>
      rel.id === payload.relationshipId
        ? applyUpdates(rel, payload.updates as Partial<RelationshipDocument>)
        : rel
    ));
  };

  const handleDeleted = (payload: RelationshipDeletedPayload) => {
    setRelationships(prev => prev.filter(r => r.id !== payload.relationshipId));
  };

  const unsubCreate = RealtimeService.subscribe('RELATIONSHIP_CREATED', handleCreated);
  const unsubUpdate = RealtimeService.subscribe('RELATIONSHIP_UPDATED', handleUpdated);
  const unsubDelete = RealtimeService.subscribe('RELATIONSHIP_DELETED', handleDeleted);

  return () => { unsubCreate(); unsubUpdate(); unsubDelete(); };
}, [refetch]);
```

### Payload Types (already defined)
```typescript
RelationshipCreatedPayload { relationshipId, relationship: { type?, sourceId?, targetId? }, timestamp }
RelationshipUpdatedPayload { relationshipId, updates: { type?, notes? }, timestamp }
RelationshipDeletedPayload { relationshipId, timestamp }
```

---

## 4. Task C: OBLIGATION Event Subscribers

### Context
- **Dispatchers (4 sites)**: `ObligationsService.ts` dispatches OBLIGATION_CREATED (:43), OBLIGATION_UPDATED (×2: :60, :123), OBLIGATION_DELETED (:78)
- **Consumers**: Compliance/obligation dashboard, obligation tabs in entity detail

### Target Hook
Ψάξε hook/component που renders obligations (π.χ. `useObligations`, `ObligationsTab`).

### Implementation Pattern
```typescript
useEffect(() => {
  const handleCreated = (_payload: ObligationCreatedPayload) => {
    refetch();
  };

  const handleUpdated = (payload: ObligationUpdatedPayload) => {
    setObligations(prev => prev.map(obl =>
      obl.id === payload.obligationId
        ? applyUpdates(obl, payload.updates as Partial<ObligationDocument>)
        : obl
    ));
  };

  const handleDeleted = (payload: ObligationDeletedPayload) => {
    setObligations(prev => prev.filter(o => o.id !== payload.obligationId));
  };

  const unsubCreate = RealtimeService.subscribe('OBLIGATION_CREATED', handleCreated);
  const unsubUpdate = RealtimeService.subscribe('OBLIGATION_UPDATED', handleUpdated);
  const unsubDelete = RealtimeService.subscribe('OBLIGATION_DELETED', handleDeleted);

  return () => { unsubCreate(); unsubUpdate(); unsubDelete(); };
}, [refetch]);
```

### Payload Types (already defined)
```typescript
ObligationCreatedPayload { obligationId, obligation: { title?, type?, status? }, timestamp }
ObligationUpdatedPayload { obligationId, updates: { title?, status?, dueDate? }, timestamp }
ObligationDeletedPayload { obligationId, timestamp }
```

---

## 5. Research Required Before Implementation

1. **COMMUNICATION target**: `Grep` for hooks that fetch/display communications in triage or inbox
2. **RELATIONSHIP target**: `Grep` for hooks that fetch contact relationships
3. **OBLIGATION target**: `Grep` for hooks/components that display obligations

---

## 6. Verification Checklist

- [x] COMMUNICATION_* subscribers wired in `useCommunicationsHistory.ts` — scope-filtered by `contactId`
- [x] RELATIONSHIP_* subscribers wired in `RelationshipProvider.tsx` — bidirectional scope filtering
- [x] OBLIGATION_* subscribers wired in `useObligations.ts` — full refetch via `refreshObligations()`
- [x] All follow canonical pattern (CREATED→refetch, UPDATED→optimistic/refetch, DELETED→filter/refetch)
- [x] Cleanup functions in all useEffect blocks
- [x] TypeScript compiles without errors

---

## 7. Files Touched

| File | Action |
|------|--------|
| `src/components/communications/hooks/useCommunicationsHistory.ts` | ADD COMMUNICATION_* subscribers (scope: contactId) |
| `src/components/contacts/relationships/context/RelationshipProvider.tsx` | ADD RELATIONSHIP_* subscribers (scope: sourceId/targetId) |
| `src/hooks/useObligations.ts` | ADD OBLIGATION_* subscribers (full refetch pattern) |

---

## 8. Coverage Impact

| Entity Group | Before | After |
|-------------|--------|-------|
| COMMUNICATION | 0% ❌ | 100% ✅ |
| RELATIONSHIP | 0% ❌ | 100% ✅ |
| OBLIGATION | 0% ❌ | 100% ✅ |
| **Total Coverage** | 83% (after Tier 2) | 94% |
