# ADR-228: Real-Time Event Bus Coverage Gap Analysis & Implementation Roadmap

| Field | Value |
|-------|-------|
| **Status** | 🟡 Tiers 0-3 Implemented — Tier 4 Pending |
| **Date** | 2026-03-14 |
| **Category** | Data Access Layer / Real-Time Architecture |
| **Related ADRs** | ADR-227 (Real-Time Subscription Consolidation), ADR-214 (Firestore Query Centralization) |

---

## 1. Executive Summary

Πλήρης ανάλυση του real-time event bus system αποκάλυψε:

| Metric | Value |
|--------|-------|
| **Events ορισμένα στο RealtimeEventMap** | 61 |
| **Event groups με dispatchers + subscribers** | 15/18 (83%) |
| **Event groups μόνο με dispatchers (no subscribers)** | 2 |
| **Event groups μόνο με subscribers (no dispatchers)** | 1 (STORAGE anomaly) |
| **Infrastructure gaps (firestoreQueryService)** | 2 (`subscribeDoc`, `subscribeSubcollection`) |
| **Blocked Phase 2 hooks (ADR-227)** | 4 |
| **Total dispatch call sites** | ~75 |
| **Total subscribe call sites** | ~29 |

### Κύρια Ευρήματα

1. **50% event coverage**: Μόνο 9 από 18 entity groups έχουν ενεργούς subscribers
2. **2 infrastructure gaps** στο `firestoreQueryService`: λείπουν `subscribeDoc()` και `subscribeSubcollection()`
3. **4 blocked Phase 2 hooks** (ADR-227) εξαιτίας αυτών των gaps
4. **3 anomalies**: STORAGE dispatch gap, NOTIFICATION_* χωρίς dispatch, NAVIGATION_REFRESH χωρίς dispatch

---

## 2. Infrastructure Gaps (firestoreQueryService)

Το `firestoreQueryService` (`src/services/firestore/firestore-query.service.ts`) παρέχει μόνο `subscribe()` για collections. Δεν υποστηρίζει:

### Gap 1: `subscribeDoc()` — Blocks 3 hooks

| Hook | Collection Path | Usage | Complexity |
|------|----------------|-------|------------|
| `useVoiceCommandSubscription.ts` | `voice_commands/{commandId}` | Single doc watch for command status updates | LOW |
| `useContactEmailWatch.ts` | `contacts/{contactId}` | Single doc watch for email field changes | LOW |
| `useProjectFloorplans.ts` | `project_floorplans/{projectId}_project` + `{projectId}_parking` | Dual doc watch + pako decompression | MEDIUM |

**Εκτίμηση υλοποίησης**: ~20 γραμμές κώδικα — pattern ανάλογο του `subscribe()` αλλά με `doc()` αντί `collection()`

### Gap 2: `subscribeSubcollection()` — Blocks 1 service

| Service | Path | Usage | Complexity |
|---------|------|-------|------------|
| `BankAccountsService.ts` | `contacts/{contactId}/bankAccounts` | Subcollection subscription with `where('isActive','==',true)`, `orderBy('createdAt','desc')` | HIGH |

**Εκτίμηση υλοποίησης**: ~40 γραμμές κώδικα — χρειάζεται parent doc reference + query constraints + tenant isolation

---

## 3. Blocked Phase 2 Hooks — Detailed Analysis

### 3.1 BankAccountsService (HIGH complexity)

| Field | Detail |
|-------|--------|
| **File** | `src/services/banking/BankAccountsService.ts` |
| **Current Pattern** | Raw `onSnapshot()` on `contacts/{contactId}/bankAccounts` |
| **Query Constraints** | `where('isActive', '==', true)`, `orderBy('createdAt', 'desc')` |
| **Consumer** | `ContactBankingTab.tsx` |
| **Blocking Requirement** | `subscribeSubcollection()` method |
| **Migration Complexity** | HIGH — subcollection path, compound query, active filtering |

### 3.2 useVoiceCommandSubscription (LOW complexity)

| Field | Detail |
|-------|--------|
| **File** | `src/hooks/useVoiceCommandSubscription.ts:62` |
| **Current Pattern** | Raw `onSnapshot()` on `voice_commands/{commandId}` (single doc) |
| **Consumer** | `VoiceAIPanel.tsx` |
| **Related ADR** | ADR-164 (Voice AI Pipeline) |
| **Blocking Requirement** | `subscribeDoc()` method |
| **Migration Complexity** | LOW — single doc, no query constraints |

### 3.3 useContactEmailWatch (LOW complexity)

| Field | Detail |
|-------|--------|
| **File** | `src/hooks/sales/useContactEmailWatch.ts:48` |
| **Current Pattern** | Raw `onSnapshot()` on `contacts/{contactId}` (single doc, email fields) |
| **Consumer** | `SalesActionDialogs.tsx` |
| **Context** | Sales pipeline — critical for CRM workflow |
| **Blocking Requirement** | `subscribeDoc()` method |
| **Migration Complexity** | LOW — single doc, field extraction |

### 3.4 useProjectFloorplans (MEDIUM complexity)

| Field | Detail |
|-------|--------|
| **File** | `src/hooks/useProjectFloorplans.ts:184, :250` |
| **Current Pattern** | Raw `onSnapshot()` on 2 separate docs: `project_floorplans/{projectId}_project` + `{projectId}_parking` |
| **Consumers** | FloorplansAuditTab, DXF Viewer |
| **Special Processing** | pako decompression (CPU-intensive, async) |
| **Blocking Requirement** | `subscribeDoc()` method |
| **Migration Complexity** | MEDIUM — dual doc subscription + async decompression pipeline |

---

## 4. Event Dispatch/Subscribe Coverage Matrix

### 4.1 Πλήρης Πίνακας ανά Entity Group

| Category | Events | Dispatch Sites | Subscribe Sites | Coverage | Notes |
|----------|--------|---------------|-----------------|----------|-------|
| **PROJECT** | 3 (C/U/D) | 5 (`projects-client.service.ts` + `GeneralProjectTab.tsx`) | 8 (`useProjectsState`, `useFirestoreProjects`, `useFirestoreProjectsPaginated`, `NavigationContext`, `CompanyProjectsTable`, `ProjectHierarchyContext`) | **100%** ✅ | |
| **BUILDING** | 3 (C/U/D) | 3 (`building-services.ts`) | 3 (`useFirestoreBuildings.ts`) | **100%** ✅ | |
| **CONTACT** | 3 (C/U/D) | 3 (`contacts.service.ts`) | 5 (`useContactsState`, `ContactsPageContent`, `ProjectHierarchyContext`) | **100%** ✅ | |
| **TASK** | 3 (C/U/D) | 4 (`tasks.service.ts`) | 3 (`useRealtimeTasks.ts`) | **100%** ✅ | ADR-227 Phase 3 |
| **OPPORTUNITY** | 3 (C/U/D) | 3 (`opportunities-client.service.ts`) | 3 (`useRealtimeOpportunities.ts`) | **100%** ✅ | ADR-227 Phase 3 |
| **PARKING** | 3 (C/U/D) | 8 (`AddParkingDialog`, `ParkingGeneralTab`, `ParkingTabContent`, `page.tsx`) | 3 (`useFirestoreParkingSpots.ts`) | **100%** ✅ | |
| **STORAGE** | 3 (C/U/D) | 1 (`StorageGeneralTab.tsx` — UPDATED μόνο) | 3 (`useFirestoreStorages.ts`) | **33%** ⚠️ | CREATED/DELETED dispatch missing |
| **UNIT** | 3 (C/U/D) | 3 (`units.service.ts`) | 3 (`useRealtimeUnits.ts`) | **100%** ✅ | SPEC-228-01 |
| **FILE** | 5 (C/U/D/Trashed/Restored) | 9 (`file-record.service.ts`) | 4 (`useEntityFiles.ts`) | **100%** ✅ | SPEC-228-02 |
| **FLOORPLAN** | 3 (C/U/D) | 9 (`UnitFloorplanService`, `FloorplanService`, `FloorFloorplanService`, `BuildingFloorplanService`) | 6 (`useUnitFloorplans`, `useBuildingFloorplans`, `useFloorFloorplans`) | **100%** ✅ | SPEC-228-02 |
| **COMMUNICATION** | 3 (C/U/D) | 3 (`communications-client.service.ts`) | 3 (`useCommunicationsHistory.ts`) | **100%** ✅ | SPEC-228-03 |
| **OBLIGATION** | 3 (C/U/D) | 4 (`ObligationsService.ts`) | 3 (`useObligations.ts`) | **100%** ✅ | SPEC-228-03 |
| **RELATIONSHIP** | 3 (C/U/D) | 3 (`FirestoreRelationshipAdapter.ts`) | 3 (`RelationshipProvider.tsx`) | **100%** ✅ | SPEC-228-03 |
| **WORKSPACE** | 3 (C/U/D) | 5 (`workspace.service.ts`, `navigation-companies.service.ts`, `EnterpriseCompanySettingsService.ts`) | 2 (`WorkspaceContext.tsx`) | **100%** ✅ | SPEC-228-02 |
| **SESSION** | 2 (C/D) | 2 (`EnterpriseSessionService.ts`) | 1 (`AuthContext.tsx`) | **100%** ✅ | SPEC-228-01 |
| **USER_SETTINGS** | 1 (U) | 4 (`UserNotificationSettingsService.ts`, `EnterpriseUserPreferencesService.ts`) | 0 | **0%** ❌ | |
| **ASSOC_LINKS** | 3 (C_LINK_C/C_LINK_R/F_LINK_C) | 3 (`association.service.ts`) | 0 | **0%** ❌ | |
| **ENTITY_LINKS** | 2 (LINKED/UNLINKED) | 2 (`EntityLinkingService.ts`) | 2 (`NavigationContext.tsx`) | **100%** ✅ | SPEC-228-01 |

### 4.2 Σύνοψη Coverage

```
Fully Covered (100%):  15 groups  — PROJECT, BUILDING, CONTACT, TASK, OPPORTUNITY, PARKING,
                                    UNIT, SESSION, ENTITY_LINKS, FILE, FLOORPLAN, WORKSPACE,
                                    COMMUNICATION, OBLIGATION, RELATIONSHIP
Partially Covered:      1 group   — STORAGE (33%)
Zero Coverage:          2 groups  — USER_SETTINGS, ASSOC_LINKS
```

---

## 5. Anomalies

### 5.1 STORAGE_CREATED / STORAGE_DELETED: Subscribers χωρίς Dispatchers

- **`useFirestoreStorages.ts`** subscribes σε `STORAGE_CREATED`, `STORAGE_UPDATED`, `STORAGE_DELETED`
- **Μόνο `STORAGE_UPDATED`** dispatch-άρεται (από `StorageGeneralTab.tsx:190`)
- **`STORAGE_CREATED` και `STORAGE_DELETED`**: Κανένα dispatch call στο codebase
- **Impact**: Οι subscribers δεν θα ενεργοποιηθούν ποτέ για create/delete — dead code

**Fix**: Πρόσθεση dispatch calls στα σημεία δημιουργίας/διαγραφής storage spaces

### 5.2 NOTIFICATION_*: Types ορισμένα χωρίς dispatch calls

- `NOTIFICATION_CREATED`, `NOTIFICATION_UPDATED`, `NOTIFICATION_DELETED` ορίζονται στο `RealtimeEventMap`
- **0 dispatch calls** σε ολόκληρο το codebase
- Οι notifications χρησιμοποιούν `firestoreQueryService.subscribe()` (migrated ADR-227 Phase 2) — δεν περνούν μέσω event bus

**Impact**: Χαμηλό — τα notifications λειτουργούν ήδη μέσω Firestore subscription

### 5.3 NAVIGATION_REFRESH: Ορισμένο αλλά ποτέ dispatched

- `NAVIGATION_REFRESH` event type ορίζεται στο `RealtimeEventMap`
- **0 dispatch calls**, **0 subscribe calls**
- Πιθανώς legacy remnant ή planned feature

**Impact**: Κανένα — dead code

---

## 6. Implementation Roadmap (4 Tiers)

### Tier 0: Infrastructure Prerequisites

| Task | Description | Effort | Blocks |
|------|------------|--------|--------|
| **T0.1** | Add `subscribeDoc()` to `firestoreQueryService` | ~20 lines | Hooks #3.2, #3.3, #3.4 |
| **T0.2** | Add `subscribeSubcollection()` to `firestoreQueryService` | ~40 lines | Service #3.1 |
| **T0.3** | Migrate 4 blocked Phase 2 hooks (ADR-227) | 4 files | Full canonical coverage |

### Tier 1: Critical (Security & Navigation)

| # | Event Group | Subscriber Target | Benefit | Priority |
|---|------------|-------------------|---------|----------|
| 1 | `UNIT_*` | `useRealtimeUnits` (already uses canonical subscribe) | Building management — unit CRUD cross-page sync | HIGH |
| 2 | `SESSION_*` | Browser tab sync subscriber | Security — detect concurrent sessions, force logout | HIGH |
| 3 | `ENTITY_LINKED/UNLINKED` | Navigation hierarchy refresh | UI consistency — entity linking reflects in sidebar | MEDIUM |

### Tier 2: High (Core Features)

| # | Event Group | Subscriber Target | Benefit |
|---|------------|-------------------|---------|
| 4 | `FILE_*` | File galleries, document tabs, entity file panels | Real-time file upload/trash/restore sync |
| 5 | `FLOORPLAN_*` | DXF viewer, building/floor/unit floorplan tabs | Cross-tab floorplan change sync |
| 6 | `WORKSPACE_*` | Company switcher, workspace settings | Multi-tenant workspace updates |

### Tier 3: Medium (CRM)

| # | Event Group | Subscriber Target | Benefit |
|---|------------|-------------------|---------|
| 7 | `COMMUNICATION_*` | Inbox, triage view, operator inbox | Message status sync without refresh |
| 8 | `RELATIONSHIP_*` | Contact network views, relationship tabs | Contact relationship CRUD sync |
| 9 | `OBLIGATION_*` | Compliance dashboard, obligation tabs | Payment/deadline tracking sync |

### Tier 4: Low (Enhancements & Cleanup)

| # | Event Group | Action | Benefit |
|---|------------|--------|---------|
| 10 | `USER_SETTINGS_*` | Cross-tab preference sync subscriber | Settings changes reflected across browser tabs |
| 11 | `NOTIFICATION_*` | Add dispatch calls (if needed beyond Firestore sub) | Redundant optimistic updates |
| 12 | `STORAGE_*` | Fix missing CREATED/DELETED dispatch calls | Complete the existing subscriber wiring |
| 13 | `ASSOC_LINKS` | Subscribers for contact/file link changes | Association change sync |
| 14 | `NAVIGATION_REFRESH` | Remove or implement | Cleanup dead code |

---

## 7. Canonical Pattern Reference

Documented pattern from existing implementations (ADR-227 Phase 3):

### 7.1 Event Subscriber Pattern (from `useRealtimeTasks.ts`)

```typescript
// CREATED → refetch (onSnapshot brings fresh data from Firestore)
// UPDATED → optimistic: applyUpdates() on matching item (~0ms vs 200-500ms round-trip)
// DELETED → optimistic: filter out by id

useEffect(() => {
  const unsubCreate = RealtimeService.subscribe('TASK_CREATED', () => refetch());
  const unsubUpdate = RealtimeService.subscribe('TASK_UPDATED', (payload) => {
    setItems(prev => prev.map(item =>
      item.id === payload.taskId ? applyUpdates(item, payload.updates) : item
    ));
  });
  const unsubDelete = RealtimeService.subscribe('TASK_DELETED', (payload) => {
    setItems(prev => prev.filter(item => item.id !== payload.taskId));
  });
  return () => { unsubCreate(); unsubUpdate(); unsubDelete(); };
}, [refetch]);
```

### 7.2 Event Dispatch Pattern (from `tasks.service.ts`)

```typescript
// Dispatch AFTER successful Firestore write
const docRef = await addDoc(collectionRef, data);
RealtimeService.dispatch('TASK_CREATED', {
  taskId: docRef.id,
  task: { id: docRef.id, ...data },
});
```

### 7.3 Key Principles

1. **onSnapshot = Source of Truth** — always reflects actual Firestore state
2. **Event bus = Optimistic UI** — instant visual feedback before Firestore round-trip
3. **CREATED → refetch()** — let onSnapshot bring the complete document
4. **UPDATED → applyUpdates()** — merge partial updates into local state
5. **DELETED → filter()** — remove from local state immediately

---

## 8. Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-03-14 | Initial ADR — full coverage gap analysis, 4-tier implementation roadmap | Claude |
| 2026-03-14 | SPEC-228-01 implemented — UNIT/SESSION/ENTITY_LINKS subscribers wired, coverage 50%→67% | Claude |
| 2026-03-14 | SPEC-228-02 implemented — FILE/FLOORPLAN/WORKSPACE subscribers wired (5 files), coverage 67%→83% | Claude |
| 2026-03-14 | SPEC-228-03 implemented — COMMUNICATION/RELATIONSHIP/OBLIGATION subscribers wired (3 files), coverage 83%→94% | Claude |
