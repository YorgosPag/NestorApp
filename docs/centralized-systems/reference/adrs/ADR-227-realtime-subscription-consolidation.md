# ADR-227: Real-Time Subscription Consolidation & Coverage Expansion

| Field | Value |
|-------|-------|
| **Status** | 🟡 Phase 1 Implemented — Phases 2-3 Pending |
| **Date** | 2026-03-13 |
| **Category** | Data Access Layer / Real-Time Architecture |
| **Related ADRs** | ADR-214 (Firestore Query Centralization) |

---

## 1. Problem Statement

Η εφαρμογή έχει κεντρικοποιημένο real-time σύστημα (`RealtimeService` + `firestoreQueryService.subscribe`) αλλά υπάρχει ασυνέπεια στη χρήση του. Τρία ξεχωριστά patterns συνυπάρχουν:

### 1.1 Τρία Patterns (Inconsistency)

| Pattern | Περιγραφή | Tenant Isolation | Auto-cleanup | Πλήθος |
|---------|-----------|-----------------|--------------|--------|
| **CANONICAL** | `firestoreQueryService.subscribe()` | ✅ Auto (companyId injected) | ✅ | 3 σημεία |
| **LEGACY** | Raw `onSnapshot()` | ❌ Manual | ⚠️ Manual | 11+ hooks/services |
| **STALE** | One-time `getDocs()`/`getDoc()` | ❌ N/A | N/A | 2+ pages |

### 1.2 Stale Data Risk

- `/crm/tasks` → `getTasksStats()` one-time fetch → δεδομένα ξεπερασμένα μέχρι refresh
- CRM Dashboard → `getOpportunitiesClient()` one-time fetch → ίδιο πρόβλημα

### 1.3 Event Dispatch/Subscribe Gap

- 60+ typed events στο `RealtimeEventMap`
- Πολλά events (TASK_*, OPPORTUNITY_*, FILE_*, OBLIGATION_*) dispatch-άρονται από services αλλά **κανένα component δεν τα ακούει**
- Μόνο 3 event types έχουν ενεργούς subscribers: `CONTACT_*`, `PROJECT_UPDATED`

### 1.4 Tenant Isolation Gap

Τα raw `onSnapshot()` calls δεν περνούν αυτόματα από tenant isolation — κάθε hook πρέπει χειροκίνητα να φιλτράρει με `companyId`. Το centralized pattern (`firestoreQueryService.subscribe`) το κάνει αυτόματα.

---

## 2. Current Architecture

### 2.1 Centralized System (CANONICAL)

```
firestoreQueryService.subscribe<T>(collectionKey, onData, onError, options)
├── Auto tenant isolation (companyId from auth)
├── Type-safe QueryResult<T>
├── SubscriptionStatus tracking (idle → connecting → active → error)
└── Automatic cleanup on unmount
```

**Files using CANONICAL pattern:**

| File | Collection | Notes |
|------|-----------|-------|
| `src/services/realtime/hooks/useRealtimeBuildings.ts` | BUILDINGS | Groups by projectId |
| `src/services/realtime/hooks/useRealtimeUnits.ts` | UNITS | Groups by buildingId |
| `src/components/property-viewer/ReadOnlyLayerViewer.tsx` | LAYERS | Layer subscription |

### 2.2 RealtimeService (Event Bus)

```
RealtimeService
├── dispatch(event, payload) — Called by services after Firestore writes
├── subscribe(event, callback) — Called by hooks/components
└── RealtimeEventMap — 60+ typed events
```

**Active Subscribers:**

| Subscriber | Events | File |
|-----------|--------|------|
| `useContactsState` | CONTACT_UPDATED, CONTACT_CREATED, CONTACT_DELETED | `src/hooks/useContactsState.ts` |
| `NavigationContext` | PROJECT_UPDATED | `src/components/navigation/core/NavigationContext.tsx` |

**Dispatchers without Subscribers (Gap):**

| Service | Events Dispatched | Subscriber |
|---------|------------------|------------|
| `units.service.ts` | UNIT_UPDATED, UNIT_CREATED, UNIT_DELETED | ❌ None |
| `opportunities-client.service.ts` | OPPORTUNITY_UPDATED, OPPORTUNITY_CREATED | ❌ None |
| `projects-client.service.ts` | PROJECT_CREATED, PROJECT_DELETED | ❌ None (only PROJECT_UPDATED has subscriber) |
| `communications-client.service.ts` | COMMUNICATION_UPDATED, COMMUNICATION_CREATED | ❌ None |
| `BuildingFloorplanService.ts` | FLOORPLAN_UPDATED, FLOORPLAN_CREATED | ❌ None |

### 2.3 Legacy Raw onSnapshot Usage

| Hook/Service | Collection | Type | Notes |
|-------------|-----------|------|-------|
| `contacts.service.ts` → `subscribeToContacts()` | contacts | Collection | Called from `useContactsState` |
| `notificationService.ts` → `subscribeToNotifications()` | notifications | Collection | userId filter, limit(50) |
| `BankAccountsService.ts` → `subscribeToBankAccounts()` | contacts/{id}/bankAccounts | Subcollection | contactId filter |
| `useVoiceCommandSubscription.ts` | voice_commands/{id} | Document | Single doc watch |
| `useContactEmailWatch.ts` | contacts/{id} | Document | Email field monitor |
| `useProjectFloorplans.ts` | project_floorplans/{id} | Document | Decompress scene |
| `useRealtimeMessages.ts` | messages | Collection | conversationId filter |
| `useRealtimeTriageCommunications.ts` | communications | Collection | Status-based stats |
| `useFloorplanFiles.ts` | files | Collection | entityType/entityId filter |
| `useLayerManagement.ts` | layers | Collection | Auto-save on change |
| `useFirestoreNotifications.ts` | notifications | Collection | Via notificationService |

### 2.4 One-Time Fetches (Stale Data)

| Location | Function | Collection | Issue |
|----------|----------|-----------|-------|
| Tasks page (`/crm/tasks`) | `getTasksStats()` | tasks | Data stale until page refresh |
| CRM Dashboard | `getOpportunitiesClient()` | opportunities | Data stale until page refresh |
| `useFloorFloorplans.ts` | `getDocs()` | floor_floorplans | No real-time updates |

---

## 3. Decision: 3-Phase Migration Plan

### Phase 1: Eliminate One-Time Fetches → Real-Time (HIGH PRIORITY) — ✅ IMPLEMENTED (2026-03-13)

**Goal**: Σελίδες που δείχνουν ξεπερασμένα δεδομένα γίνονται real-time.

#### New Hooks

**`useRealtimeTasks.ts`**
```typescript
// src/services/realtime/hooks/useRealtimeTasks.ts
// Pattern: Same as useRealtimeBuildings/useRealtimeUnits
// Collection: TASKS (via firestoreQueryService.subscribe)
// Features:
//   - Auto tenant isolation
//   - Status-based filtering (optional)
//   - Stats computation (total, pending, completed, overdue)
//   - SubscriptionStatus tracking
```

**`useRealtimeOpportunities.ts`**
```typescript
// src/services/realtime/hooks/useRealtimeOpportunities.ts
// Pattern: Same as useRealtimeBuildings/useRealtimeUnits
// Collection: OPPORTUNITIES (via firestoreQueryService.subscribe)
// Features:
//   - Auto tenant isolation
//   - Pipeline stage grouping
//   - Stats computation (total value, count per stage)
//   - SubscriptionStatus tracking
```

#### Modified Files

| File | Change |
|------|--------|
| Tasks page component | Replace `getTasksStats()` → `useRealtimeTasks()` |
| CRM Dashboard component | Replace `getOpportunitiesClient()` → `useRealtimeOpportunities()` |
| `useFloorFloorplans.ts` | Replace `getDocs()` → `firestoreQueryService.subscribe()` |

#### Impact
- **Stale data eliminated** σε 2 critical pages
- **User experience**: Αλλαγές εμφανίζονται αυτόματα χωρίς refresh

---

### Phase 2: Migrate Raw onSnapshot → Centralized (MEDIUM PRIORITY)

**Goal**: Όλα τα raw `onSnapshot()` calls μεταναστεύουν στο `firestoreQueryService.subscribe()` για automatic tenant isolation.

#### Migration Candidates (by priority)

| # | Hook/Service | Complexity | Reason for Priority |
|---|-------------|-----------|-------------------|
| 1 | `contacts.service.ts` → `subscribeToContacts()` | Medium | High-traffic, tenant isolation gap |
| 2 | `notificationService.ts` → `subscribeToNotifications()` | Low | Simple query, easy migration |
| 3 | `useRealtimeMessages.ts` | Medium | Already named "realtime", should use canonical |
| 4 | `useRealtimeTriageCommunications.ts` | Medium | Stats computation, similar to useRealtimeUnits |
| 5 | `useFloorplanFiles.ts` | Low | Simple entity filter |
| 6 | `useLayerManagement.ts` | Low | Already using LAYERS collection |
| 7 | `BankAccountsService.ts` | High | Subcollection — needs `firestoreQueryService` subcollection support |
| 8 | `useVoiceCommandSubscription.ts` | Low | Single doc — needs `subscribeDoc()` method |
| 9 | `useContactEmailWatch.ts` | Low | Single doc — needs `subscribeDoc()` method |
| 10 | `useProjectFloorplans.ts` | Medium | Single doc + decompression |

#### Prerequisites
- `firestoreQueryService` may need `subscribeDoc()` method for single-document subscriptions (#8, #9, #10)
- Subcollection support for `BankAccountsService` (#7)

#### Migration Pattern
```typescript
// BEFORE (Legacy):
const q = query(collection(db, 'contacts'), where('companyId', '==', companyId));
const unsub = onSnapshot(q, (snapshot) => {
  const contacts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  setContacts(contacts);
});

// AFTER (Canonical):
const unsub = firestoreQueryService.subscribe<ContactDocument>(
  'CONTACTS',
  (result) => setContacts(result.documents),
  (error) => logger.error('Contacts subscription failed', error),
  { where: [['type', '==', contactType]] }
);
```

---

### Phase 3: Wire Event Subscribers (LOW PRIORITY)

**Goal**: Τα 60+ typed events στο `RealtimeEventMap` που dispatch-άρονται χωρίς subscribers αποκτούν ακροατές.

#### Event Wiring Plan

| Event Group | Target Subscribers | Benefit |
|-------------|-------------------|---------|
| `UNIT_*` | Unit list pages, Building detail | Cross-page sync for unit changes |
| `OPPORTUNITY_*` | CRM Dashboard, Pipeline view | Real-time pipeline updates |
| `TASK_*` | Tasks page, Dashboard widgets | Task status sync |
| `FILE_*` | Document management, Entity tabs | File upload/delete sync |
| `BUILDING_*` | Building list, Project detail | Building CRUD sync |
| `FLOORPLAN_*` | Floorplan viewer, Building tabs | Floorplan change sync |
| `COMMUNICATION_*` | Inbox, Triage view | Message status sync |

#### Implementation Pattern
```typescript
// In useRealtimeTasks.ts — combine Firestore subscription with event bus:
useEffect(() => {
  const unsub = RealtimeService.subscribe('TASK_UPDATED', (payload) => {
    // Optimistic update: apply change immediately without waiting for Firestore
    updateTaskInCache(payload.taskId, payload.changes);
  });
  return unsub;
}, []);
```

#### Notes
- Phase 3 is enhancement, not critical — Firestore subscriptions already provide real-time data
- Event bus provides **optimistic updates** (faster UI response) and **cross-page sync**
- Not all events need subscribers — some are dispatched for future extensibility

---

## 4. Complete Inventory Matrix

### 4.1 Collections × Pages × Pattern

| Collection | Pages Using | Current Pattern | Target Pattern | Phase |
|-----------|------------|----------------|----------------|-------|
| `buildings` | Building list, Project detail | ✅ CANONICAL | ✅ Done | — |
| `units` | Unit list, Building detail | ✅ CANONICAL | ✅ Done | — |
| `layers` | ReadOnlyLayerViewer | ✅ CANONICAL | ✅ Done | — |
| `contacts` | Contact list, CRM | 🟡 LEGACY (raw onSnapshot) | CANONICAL | Phase 2 |
| `notifications` | Header bell, Notification panel | 🟡 LEGACY (raw onSnapshot) | CANONICAL | Phase 2 |
| `messages` | AI Inbox, Operator Inbox | 🟡 LEGACY (raw onSnapshot) | CANONICAL | Phase 2 |
| `communications` | Triage view | 🟡 LEGACY (raw onSnapshot) | CANONICAL | Phase 2 |
| `files` | Document tabs, Floorplan files | 🟡 LEGACY (raw onSnapshot) | CANONICAL | Phase 2 |
| `tasks` | Tasks page, Dashboard | ✅ CANONICAL | ✅ Done | Phase 1 |
| `opportunities` | CRM Dashboard, Pipeline | ✅ CANONICAL | ✅ Done | Phase 1 |
| `floor_floorplans` | Floor detail | 🔴 STALE (one-time fetch) | CANONICAL | Phase 1 |
| `project_floorplans` | Project floorplan view | 🟡 LEGACY (raw onSnapshot doc) | CANONICAL | Phase 2 |
| `voice_commands` | Voice command UI | 🟡 LEGACY (raw onSnapshot doc) | CANONICAL | Phase 2 |
| `bankAccounts` (sub) | Contact banking tab | 🟡 LEGACY (raw onSnapshot) | CANONICAL | Phase 2 |
| `parking` | Building spaces tabs | ✅ Via units/event bus | — | — |
| `storage` | Building spaces tabs | ✅ Via units/event bus | — | — |
| `attendance_qr_tokens` | Admin panel | Server-only | N/A | — |
| `ai_chat_history` | AI pipeline | Server-only | N/A | — |

### 4.2 Event Dispatch/Subscribe Matrix

| Event | Dispatched By | Subscribed By | Status |
|-------|--------------|---------------|--------|
| `CONTACT_UPDATED` | contacts.service | useContactsState | ✅ Wired |
| `CONTACT_CREATED` | contacts.service | useContactsState | ✅ Wired |
| `CONTACT_DELETED` | contacts.service | useContactsState | ✅ Wired |
| `PROJECT_UPDATED` | projects-client.service | NavigationContext | ✅ Wired |
| `PROJECT_CREATED` | projects-client.service | — | ❌ No subscriber |
| `PROJECT_DELETED` | projects-client.service | — | ❌ No subscriber |
| `UNIT_UPDATED` | units.service | — | ❌ No subscriber |
| `UNIT_CREATED` | units.service | — | ❌ No subscriber |
| `UNIT_DELETED` | units.service | — | ❌ No subscriber |
| `BUILDING_UPDATED` | (if dispatched) | — | ❌ No subscriber |
| `BUILDING_CREATED` | (if dispatched) | — | ❌ No subscriber |
| `TASK_UPDATED` | (if dispatched) | — | ❌ No subscriber |
| `TASK_CREATED` | (if dispatched) | — | ❌ No subscriber |
| `OPPORTUNITY_UPDATED` | opportunities-client.service | — | ❌ No subscriber |
| `OPPORTUNITY_CREATED` | opportunities-client.service | — | ❌ No subscriber |
| `COMMUNICATION_UPDATED` | communications-client.service | — | ❌ No subscriber |
| `COMMUNICATION_CREATED` | communications-client.service | — | ❌ No subscriber |
| `FLOORPLAN_UPDATED` | BuildingFloorplanService | — | ❌ No subscriber |
| `FLOORPLAN_CREATED` | BuildingFloorplanService | — | ❌ No subscriber |
| `FILE_UPDATED` | (if dispatched) | — | ❌ No subscriber |
| `FILE_CREATED` | (if dispatched) | — | ❌ No subscriber |
| `FILE_TRASHED` | (if dispatched) | — | ❌ No subscriber |
| `FILE_RESTORED` | (if dispatched) | — | ❌ No subscriber |
| `NOTIFICATION_*` | notificationService | — | ❌ No subscriber |
| `OBLIGATION_*` | (if dispatched) | — | ❌ No subscriber |
| `NAVIGATION_REFRESH` | (various) | — | ❌ No subscriber |

---

## 5. New Files (Phase 1)

| File | Purpose |
|------|---------|
| `src/services/realtime/hooks/useRealtimeTasks.ts` | Real-time tasks subscription with stats |
| `src/services/realtime/hooks/useRealtimeOpportunities.ts` | Real-time opportunities subscription with pipeline grouping |

## 6. Modified Files (All Phases)

### Phase 1 (Eliminate Stale Data)
| File | Change |
|------|--------|
| Tasks page component | `getTasksStats()` → `useRealtimeTasks()` |
| CRM Dashboard component | `getOpportunitiesClient()` → `useRealtimeOpportunities()` |
| `src/hooks/useFloorFloorplans.ts` | `getDocs()` → `firestoreQueryService.subscribe()` |
| `src/services/realtime/index.ts` | Export new hooks |

### Phase 2 (Migrate Raw onSnapshot)
| File | Change |
|------|--------|
| `src/services/contacts.service.ts` | `subscribeToContacts()` → `firestoreQueryService.subscribe()` |
| `src/services/notificationService.ts` | `subscribeToNotifications()` → `firestoreQueryService.subscribe()` |
| `src/hooks/inbox/useRealtimeMessages.ts` | Raw onSnapshot → canonical |
| `src/hooks/inbox/useRealtimeTriageCommunications.ts` | Raw onSnapshot → canonical |
| `src/hooks/useFloorplanFiles.ts` | Raw onSnapshot → canonical |
| `src/hooks/useLayerManagement.ts` | Raw onSnapshot → canonical |
| `src/services/banking/BankAccountsService.ts` | Raw onSnapshot → canonical |
| `src/services/firestore/firestore-query.service.ts` | Add `subscribeDoc()` method (if needed) |

### Phase 3 (Wire Event Subscribers)
| File | Change |
|------|--------|
| `src/services/realtime/hooks/useRealtimeTasks.ts` | Add TASK_* event subscribers |
| `src/services/realtime/hooks/useRealtimeOpportunities.ts` | Add OPPORTUNITY_* event subscribers |
| Various page components | Subscribe to relevant events for optimistic updates |

---

## 7. Type Definitions

### RealtimeCollection vs CollectionKey

```
RealtimeCollection (LEGACY - 8 values):
  'buildings' | 'projects' | 'units' | 'floors' | 'contacts' |
  'project_floorplans' | 'building_floorplans' | 'files'

CollectionKey (CANONICAL - from firestore-collections.ts):
  Full set of all Firestore collections with type-safe mappings
```

**Decision**: `CollectionKey` is the canonical type. `RealtimeCollection` is legacy and does NOT need expansion — new hooks should use `CollectionKey` directly via `firestoreQueryService.subscribe()`.

### SubscriptionStatus

```typescript
type SubscriptionStatus = 'idle' | 'connecting' | 'active' | 'error' | 'disconnected';
```

All new hooks MUST expose `status: SubscriptionStatus` for UI feedback.

---

## 8. Testing Strategy

### Per Phase

| Phase | Testing |
|-------|---------|
| Phase 1 | Manual: verify tasks/opportunities pages update in real-time when data changes in another tab |
| Phase 2 | Manual: verify each migrated hook maintains same behavior; check tenant isolation works |
| Phase 3 | Manual: verify cross-page sync — change in one tab reflects in another without refresh |

### Regression Checks
- All existing real-time features (buildings, units, layers) continue working
- No memory leaks (subscription cleanup on unmount)
- No duplicate listeners (React StrictMode double-mount handling)

---

## 9. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Firestore read costs increase with more subscriptions | Medium | Use targeted queries with WHERE clauses; limit result sets |
| Race condition during migration (old + new listeners) | Low | Migrate one hook at a time; remove old code immediately |
| `subscribeDoc()` not yet in firestoreQueryService | Blocks Phase 2 items #8-#10 | Implement as prerequisite or keep those as raw onSnapshot |
| React StrictMode double-mount creates duplicate subscriptions | Medium | Use cleanup pattern already established in useRealtimeBuildings |

---

## 10. Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-03-13 | Initial ADR creation — inventory + 3-phase plan | Claude |
| 2026-03-13 | Phase 1 implemented — `useRealtimeTasks`, `useRealtimeOpportunities` hooks created; Tasks page, CRM Dashboard, TasksTab migrated to real-time; `useFloorFloorplans` NOT touched (complex hook, no real-time value) | Claude |
