# SPEC-228-02: Core Feature Subscribers (Tier 2)

| Field | Value |
|-------|-------|
| **ADR** | ADR-228 |
| **Phase** | Tier 2 — High Priority (Core Features) |
| **Priority** | HIGH |
| **Estimated Effort** | 1 session |
| **Prerequisite** | SPEC-228-00 (Tier 0), SPEC-228-01 (Tier 1) |
| **Files Created** | 0 |
| **Files Modified** | 3-4 |

---

## 1. Objective

Wire event subscribers για 3 entity groups με πολλούς dispatchers αλλά 0 subscribers:
- **FILE_*** → file galleries, document tabs (9 dispatch sites!)
- **FLOORPLAN_*** → DXF viewer, building tabs (9 dispatch sites!)
- **WORKSPACE_*** → company switcher, workspace settings (5 dispatch sites)

---

## 2. Task A: FILE Event Subscribers

### Context
- **Dispatchers (9 sites)**: `file-record.service.ts` dispatches FILE_CREATED, FILE_UPDATED (×5), FILE_TRASHED, FILE_RESTORED
- **No FILE_DELETED dispatch** — files use trash→purge pattern, not direct delete
- **Consumers**: Document tabs (`DocumentsTabContent`), file galleries, entity file panels

### Target: Existing hooks that display files

Ψάξε hook/component που κάνει fetch files (π.χ. `useEntityFiles`, `useDocumentFiles`, ή component με `firestoreQueryService.subscribe('FILES', ...)`) και πρόσθεσε event bus subscribers.

### Implementation Pattern
```typescript
useEffect(() => {
  const handleFileCreated = (_payload: FileCreatedPayload) => {
    refetch(); // Let onSnapshot bring complete FileRecord
  };

  const handleFileUpdated = (payload: FileUpdatedPayload) => {
    setFiles(prev => prev.map(file =>
      file.id === payload.fileId
        ? applyUpdates(file, payload.updates as Partial<FileRecord>)
        : file
    ));
  };

  const handleFileTrashed = (payload: FileTrashedPayload) => {
    // Remove trashed file from active list
    setFiles(prev => prev.filter(file => file.id !== payload.fileId));
  };

  const handleFileRestored = (payload: FileRestoredPayload) => {
    refetch(); // Restored file needs full data
  };

  const unsubCreate = RealtimeService.subscribe('FILE_CREATED', handleFileCreated);
  const unsubUpdate = RealtimeService.subscribe('FILE_UPDATED', handleFileUpdated);
  const unsubTrash = RealtimeService.subscribe('FILE_TRASHED', handleFileTrashed);
  const unsubRestore = RealtimeService.subscribe('FILE_RESTORED', handleFileRestored);

  return () => {
    unsubCreate();
    unsubUpdate();
    unsubTrash();
    unsubRestore();
  };
}, [refetch]);
```

### Payload Types (already defined)
```typescript
FileCreatedPayload   { fileId, file: { displayName?, entityType?, entityId?, category?, contentType?, status? }, timestamp }
FileUpdatedPayload   { fileId, updates: { displayName?, description?, status?, lifecycleState?, sizeBytes?, hasDownloadUrl? }, timestamp }
FileTrashedPayload   { fileId, trashedBy, purgeAt?, timestamp }
FileRestoredPayload  { fileId, restoredBy, timestamp }
```

### Scope Filtering
Αν ο subscriber βρίσκεται σε entity-specific context (π.χ. files for building X):
```typescript
const handleFileCreated = (payload: FileCreatedPayload) => {
  // Only refetch if file belongs to current entity
  if (payload.file.entityId === currentEntityId) {
    refetch();
  }
};
```

### Impact
- Document tabs update in real-time when files uploaded/trashed/restored
- Cross-tab file management sync

---

## 3. Task B: FLOORPLAN Event Subscribers

### Context
- **Dispatchers (9 sites)**: `UnitFloorplanService`, `FloorplanService`, `FloorFloorplanService`, `BuildingFloorplanService` — all dispatch FLOORPLAN_CREATED, FLOORPLAN_DELETED
- **No FLOORPLAN_UPDATED dispatch** — floorplans are created/deleted, not updated in-place
- **Consumers**: Floorplan tabs in building/floor/unit detail, DXF viewer

### Target: Hooks/components that list floorplans

Ψάξε hooks που κάνουν fetch floorplans (π.χ. `useFloorplanFiles`, floorplan gallery components) και πρόσθεσε event bus subscribers.

### Implementation Pattern
```typescript
useEffect(() => {
  const handleFloorplanCreated = (payload: FloorplanCreatedPayload) => {
    // Scope check: only refetch if relevant to current entity
    if (payload.floorplan.entityId === currentEntityId) {
      refetch();
    }
  };

  const handleFloorplanDeleted = (payload: FloorplanDeletedPayload) => {
    setFloorplans(prev => prev.filter(fp => fp.id !== payload.floorplanId));
  };

  const unsubCreate = RealtimeService.subscribe('FLOORPLAN_CREATED', handleFloorplanCreated);
  const unsubDelete = RealtimeService.subscribe('FLOORPLAN_DELETED', handleFloorplanDeleted);

  return () => { unsubCreate(); unsubDelete(); };
}, [refetch, currentEntityId]);
```

### Payload Types (already defined)
```typescript
FloorplanCreatedPayload { floorplanId, floorplan: { name?, entityType?, entityId? }, timestamp }
FloorplanDeletedPayload { floorplanId, timestamp }
```

### Note
`FLOORPLAN_UPDATED` υπάρχει ως type αλλά **δεν dispatch-άρεται** — αν χρειαστεί μελλοντικά, η υποδομή είναι έτοιμη.

---

## 4. Task C: WORKSPACE Event Subscribers

### Context
- **Dispatchers (5 sites)**: `workspace.service.ts` (CREATED, UPDATED), `navigation-companies.service.ts` (UPDATED ×2), `EnterpriseCompanySettingsService.ts` (UPDATED)
- **Use Case**: Company switcher refresh, workspace settings sync across tabs
- **Consumer**: Navigation sidebar (company list), settings pages

### Target: Company/workspace navigation component

Ψάξε component/hook που manages workspace list ή company switcher.

### Implementation Pattern
```typescript
useEffect(() => {
  const handleWorkspaceCreated = (_payload: WorkspaceCreatedPayload) => {
    refetchWorkspaces(); // New company added
  };

  const handleWorkspaceUpdated = (payload: WorkspaceUpdatedPayload) => {
    setWorkspaces(prev => prev.map(ws =>
      ws.id === payload.workspaceId
        ? applyUpdates(ws, payload.updates as Partial<WorkspaceDocument>)
        : ws
    ));
  };

  const unsubCreate = RealtimeService.subscribe('WORKSPACE_CREATED', handleWorkspaceCreated);
  const unsubUpdate = RealtimeService.subscribe('WORKSPACE_UPDATED', handleWorkspaceUpdated);

  return () => { unsubCreate(); unsubUpdate(); };
}, [refetchWorkspaces]);
```

### Payload Types (already defined)
```typescript
WorkspaceCreatedPayload { workspaceId, workspace: { name?, companyId? }, timestamp }
WorkspaceUpdatedPayload { workspaceId, updates: { name?, settings? }, timestamp }
WorkspaceDeletedPayload { workspaceId, timestamp }
```

### Note
`WORKSPACE_DELETED` δεν dispatch-άρεται τώρα — subscriber μπορεί να προστεθεί μελλοντικά.

---

## 5. Research Required Before Implementation

Πριν γράψεις κώδικα, ψάξε:

1. **FILE subscribers target**: `Grep` for hooks/components that fetch file lists (`useEntityFiles`, `DocumentsTabContent`, etc.)
2. **FLOORPLAN subscribers target**: `Grep` for hooks/components that list floorplans per entity
3. **WORKSPACE subscribers target**: `Grep` for company switcher component, workspace list hook

Αυτή η αναζήτηση θα καθορίσει τα ακριβή αρχεία που πρέπει να τροποποιηθούν.

---

## 6. Verification Checklist

- [ ] FILE_* subscribers wired — FILE_CREATED, FILE_UPDATED, FILE_TRASHED, FILE_RESTORED
- [ ] FLOORPLAN_* subscribers wired — FLOORPLAN_CREATED, FLOORPLAN_DELETED
- [ ] WORKSPACE_* subscribers wired — WORKSPACE_CREATED, WORKSPACE_UPDATED
- [ ] Scope filtering applied (entityId check) where applicable
- [ ] Cleanup functions in all useEffect blocks
- [ ] TypeScript compiles without errors

---

## 7. Files Touched

| File | Action |
|------|--------|
| File list hook/component (TBD after research) | ADD FILE_* event bus subscribers |
| Floorplan list hook/component (TBD after research) | ADD FLOORPLAN_* event bus subscribers |
| Workspace/company switcher (TBD after research) | ADD WORKSPACE_* event bus subscribers |

---

## 8. Coverage Impact

| Entity Group | Before | After |
|-------------|--------|-------|
| FILE | 0% ❌ | 100% ✅ |
| FLOORPLAN | 0% ❌ | 100% ✅ |
| WORKSPACE | 0% ❌ | 100% ✅ |
| **Total Coverage** | 67% (after Tier 1) | 83% |
