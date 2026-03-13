# ADR-214: Firestore Query Centralization

| Metadata | Value |
|----------|-------|
| **Status** | IN PROGRESS — Phase 8 Complete |
| **Date** | 2026-03-12 |
| **Category** | Data Access Layer |
| **Priority** | P1 — Architectural Foundation |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## 1. Πρόβλημα

### 1.1 Τρέχουσα Κατάσταση

Η εφαρμογή έχει **400+ Firestore queries** σκορπισμένα σε **85+ αρχεία**. Δεν υπάρχει ενιαίο query layer — κάθε service, hook, και API route γράφει queries inline χρησιμοποιώντας απευθείας το Firebase SDK.

### 1.2 Γιατί Είναι Πρόβλημα

| Πρόβλημα | Επίπτωση |
|----------|----------|
| **Κανένα κεντρικό σημείο ελέγχου** | Αδύνατο auditing — δεν ξέρουμε ποια queries τρέχουν |
| **Duplicated patterns** | `where('companyId', '==', cid)` γράφεται 72+ φορές |
| **Inconsistent tenant filtering** | 15+ αρχεία χωρίς tenant isolation |
| **Αδύνατο optimization** | Δεν μπορούμε να προσθέσουμε caching, monitoring, ή rate limiting |
| **Testing nightmare** | Κάθε service χρειάζεται live Firestore για testing |
| **Security gaps** | Admin routes κάνουν full collection reads χωρίς limits |

### 1.3 Στατιστικά Audit

```
Συνολικά Queries:           400+
Αρχεία με Queries:          85+
Services:                   30+ αρχεία
API Routes:                 40+ αρχεία
Hooks/Components:           15+ αρχεία
where() clauses:            300+
Αρχεία με tenantId filter:  72
Αρχεία ΧΩΡΙΣ tenant filter: 15+
addDoc() (post ADR-210):    12+ (events, overlays, messages)
Full collection reads:      10+ admin routes
```

---

## 2. Υπάρχουσα Υποδομή

### 2.1 Τι ΥΠΑΡΧΕΙ Ήδη (δεν ξαναδημιουργούμε)

| Σύστημα | Αρχείο | Κατάσταση |
|---------|--------|-----------|
| **Collection Names SSoT** | `src/config/firestore-collections.ts` | ✅ Ενεργό — 80+ collections |
| **Schema Map (AI)** | `src/config/firestore-schema-map.ts` | ✅ Ενεργό — 25 schemas |
| **RelationshipQueryBuilder** | `src/services/contact-relationships/search/RelationshipQueryBuilder.ts` | ✅ Ενεργό — Domain-specific |
| **AuthorizedQueryService** | `src/lib/auth/query-middleware.ts` | ✅ Production-ready, υποχρησιμοποιημένο |
| **Firestore Helpers** | `src/utils/firestore-helpers.ts` | ✅ Ενεργό — ID sanitization |
| **Accounting Helpers** | `src/subapps/accounting/services/repository/firestore-helpers.ts` | ✅ Ενεργό — sanitizeForFirestore() |
| **Repository Pattern** | 6 repositories (Tasks, Appointments, Projects, Accounting, BOQ, Obligations) | ✅ Ενεργό |

### 2.2 Τι ΛΕΙΠΕΙ

| Κενό | Περιγραφή |
|------|-----------|
| **Unified Query Builder** | Δεν υπάρχει γενικός builder για όλα τα collections |
| **Base Repository** | Κάθε repository γράφει ξανά τα ίδια CRUD patterns |
| **Query Monitoring** | Κανένα logging/metrics για query performance |
| **Automatic Tenant Filtering** | Κάθε service πρέπει να θυμάται να βάλει `where('companyId')` |
| **Batch Query Safety** | Admin routes κάνουν unbounded reads |

---

## 3. Αρχιτεκτονική Απόφαση

### 3.1 Στρατηγική: Σταδιακή Κεντρικοποίηση

**ΔΕΝ** κάνουμε big-bang rewrite. Ακολουθούμε **migrate-on-touch** + phased rollout:

1. Δημιουργία `FirestoreQueryService` — centralized, type-safe, auditable
2. Migrate services σταδιακά (1-3 αρχεία ανά φάση)
3. Κάθε φάση = commit + test + verify
4. Τα παλιά inline queries παραμένουν μέχρι να αγγιχτεί το αρχείο

### 3.2 Design Principles

```
1. ZERO BREAKING CHANGES — Τα existing queries συνεχίζουν να δουλεύουν
2. TYPE-SAFE — Generics, discriminated unions, proper return types
3. TENANT-AWARE — Automatic companyId injection (opt-out, όχι opt-in)
4. AUDITABLE — Κάθε query logged με collection, filters, caller
5. TESTABLE — Mockable interface, δεν εξαρτάται από live Firestore
6. COMPOSABLE — Builds on existing infrastructure (COLLECTIONS, schema-map)
```

### 3.3 Target Architecture

```
┌─────────────────────────────────────────────────┐
│                   Consumer Layer                 │
│  (Services, Hooks, API Routes, Components)       │
└──────────────────────┬──────────────────────────┘
                       │ uses
┌──────────────────────▼──────────────────────────┐
│              FirestoreQueryService               │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │ read()   │ │ write()  │ │ subscribe()      │ │
│  │ readOne()│ │ create() │ │ subscribeOne()   │ │
│  │ count()  │ │ update() │ │                  │ │
│  │ exists() │ │ delete() │ │                  │ │
│  └──────────┘ └──────────┘ └──────────────────┘ │
│           ┌──────────────────┐                   │
│           │ QueryBuilder     │                   │
│           │ .where()         │                   │
│           │ .orderBy()       │                   │
│           │ .limit()         │                   │
│           │ .paginate()      │                   │
│           │ .compile()       │                   │
│           └──────────────────┘                   │
└──────────────────────┬──────────────────────────┘
                       │ delegates to
┌──────────────────────▼──────────────────────────┐
│              Existing Infrastructure             │
│  firestore-collections.ts (collection names)     │
│  query-middleware.ts (auth context)              │
│  firestore-helpers.ts (sanitization)             │
│  Firebase SDK (actual Firestore calls)           │
└─────────────────────────────────────────────────┘
```

---

## 4. Κατάλογος Query Patterns ανά Collection

### 4.1 Core Business Collections

| Collection | Queries | Tenant Filter | Read Ops | Write Ops | Listen |
|-----------|---------|---------------|----------|-----------|--------|
| PROJECTS | 5+ | ✅ companyId | getDocs, getDoc | setDoc, updateDoc | — |
| BUILDINGS | 3+ | ✅ projectId→company | getDocs, getDoc | setDoc | onSnapshot |
| UNITS | 8 | ⚠️ buildingId only | getDocs | setDoc, updateDoc, deleteDoc | onSnapshot |
| CONTACTS | 6 | ✅ companyId | getDocs | setDoc | — |
| FILES | 12+ | ⚠️ companyId partial | getDocs | setDoc, updateDoc | — |
| OPPORTUNITIES | 2 | ❌ missing | getDocs | setDoc | — |

### 4.2 Communication Collections

| Collection | Queries | Tenant Filter | Read Ops | Write Ops | Listen |
|-----------|---------|---------------|----------|-----------|--------|
| NOTIFICATIONS | 2+ | ✅ userId | getDocs | setDoc, updateDoc | onSnapshot |
| MESSAGES | 1+ | channel-based | getDocs | setDoc | onSnapshot |
| CONVERSATIONS | 2+ | channel-based | getDocs | setDoc | — |
| COMMUNICATIONS | 6 | ✅ companyId | getDocs | — | — |

### 4.3 CRM Collections

| Collection | Queries | Tenant Filter | Read Ops | Write Ops | Listen |
|-----------|---------|---------------|----------|-----------|--------|
| TASKS | 4+ | ✅ companyId | getDocs | setDoc, updateDoc, deleteDoc | — |
| APPOINTMENTS | 3+ | ✅ companyId | getDocs | setDoc, updateDoc | — |
| LEADS | 2+ | companyId | getDocs | setDoc | — |
| OBLIGATIONS | 2+ | — | getDocs | setDoc | — |

### 4.4 DXF Viewer Collections

| Collection | Queries | Tenant Filter | Read Ops | Write Ops | Listen |
|-----------|---------|---------------|----------|-----------|--------|
| CAD_FILES | 2 | — | getDocs | — | — |
| OVERLAYS | 3+ | — | getDocs | addDoc, setDoc, deleteDoc | onSnapshot |
| LEVELS | 3+ | — | getDocs | addDoc, deleteDoc | onSnapshot |

### 4.5 Enterprise Config Collections

| Collection | Queries | Tenant Filter | Read Ops | Write Ops | Listen |
|-----------|---------|---------------|----------|-----------|--------|
| COMPANY_SETTINGS | 3 | ✅ tenantId | getDocs, getDoc | setDoc | — |
| LAYER_STYLES | 4+ | ✅ tenantId | getDocs | setDoc | — |
| POLYGON_STYLES | 2 | ✅ tenantId | getDocs | setDoc | — |
| USER_PREFERENCES | 2 | ✅ tenantId | getDocs | setDoc | — |
| SECURITY_CONFIGS | 3 | ✅ tenantId | getDocs | setDoc | — |
| TEAMS | 3 | ✅ tenantId | getDocs | setDoc | — |

### 4.6 Admin/Migration Routes (Full Collection Reads)

| Route | Collections | Risk |
|-------|------------|------|
| `/api/admin/migrate-units` | UNITS | 🔴 Unbounded read |
| `/api/admin/migrate-dxf` | CAD_FILES | 🔴 Unbounded read |
| `/api/admin/cleanup-duplicates` | UNITS | 🔴 Unbounded read |
| `/api/admin/migrate-building-features` | BUILDINGS | 🔴 Unbounded read |
| `/api/admin/create-clean-projects` | PROJECTS, BUILDINGS, FLOORS | 🔴 Unbounded read |
| `/api/admin/fix-projects-direct` | PROJECTS | 🔴 Unbounded read |
| `/api/admin/seed-floors` | FLOORS | 🔴 Unbounded read |
| `/api/admin/seed-parking` | PARKING_SPACES | 🔴 Unbounded read |
| `/api/admin/search-backfill` | Multiple | 🔴 Unbounded read |
| `/api/units/force-update` | UNITS | 🔴 Unbounded read |

---

## 5. Phased Implementation Plan

### Επισκόπηση Φάσεων

| Φάση | Περιγραφή | Αρχεία | Ρίσκο | Spec |
|------|-----------|--------|-------|------|
| **0** | ADR + Specs (αυτό το αρχείο) | 4 | — | — |
| **1** | FirestoreQueryService foundation | 6 νέα + 1 mod | LOW | ✅ DONE |
| **2** | Core Services migration (units, contacts) | 3-4 | MEDIUM | SPEC-164-02 |
| **3** | File services migration | 2-3 | MEDIUM | SPEC-164-03 |
| **4** | CRM services migration (tasks, appointments, opportunities) | 4-5 | MEDIUM | SPEC-164-04 |
| **5** | Communication services migration | 3-4 | LOW | SPEC-164-05 |
| **6** | React hooks migration (useFirestore*) | 5-6 | MEDIUM | SPEC-164-06 |
| **7** | Real-time listeners migration (onSnapshot) | 3-4 | HIGH | SPEC-164-07 |
| **8** | Admin routes safety (add limits + batching) | 10+ | LOW | SPEC-164-08 |
| **9** | Enterprise config services migration | 6 | LOW | SPEC-164-09 |
| **10** | DXF Viewer collections migration | 3 | LOW | SPEC-164-10 |
| **11** | AuthorizedQueryService integration | 2-3 | MEDIUM | SPEC-164-11 |

**Σύνολο**: ~50-60 αρχεία σε 11 φάσεις

### Κανόνες Εκτέλεσης

```
1. ΜΟΝΟ 1 φάση κάθε φορά
2. Κάθε φάση = commit + tsc check + manual verify
3. Αν κάτι σπάσει → revert + fix πριν προχωρήσουμε
4. Κάθε φάση ενημερώνει αυτό το ADR (Section 7 Changelog)
5. Migrate-on-touch: αν αγγίξουμε αρχείο για άλλο λόγο → migrate τότε
```

---

## 6. Αρχεία Specification

| Spec ID | Αρχείο | Φάση |
|---------|--------|------|
| SPEC-214-01 | `specs/SPEC-214-01-query-service-foundation.md` | Phase 1 |
| SPEC-214-02 | `specs/SPEC-214-02-core-services.md` | Phase 2 |
| SPEC-214-03 | `specs/SPEC-214-03-file-services.md` | Phase 3 |
| SPEC-214-04 | `specs/SPEC-214-04-crm-services.md` | Phase 4 |
| SPEC-214-05 | `specs/SPEC-214-05-communication-services.md` | Phase 5 |
| SPEC-214-06 | `specs/SPEC-214-06-react-hooks.md` | Phase 6 |
| SPEC-214-07 | `specs/SPEC-214-07-realtime-listeners.md` | Phase 7 |
| SPEC-214-08 | `specs/SPEC-214-08-admin-routes-safety.md` | Phase 8 |
| SPEC-214-09 | `specs/SPEC-214-09-enterprise-config.md` | Phase 9 |
| SPEC-214-10 | `specs/SPEC-214-10-dxf-viewer.md` | Phase 10 |
| SPEC-214-11 | `specs/SPEC-214-11-auth-integration.md` | Phase 11 |

---

## 7. Changelog

| Ημερομηνία | Αλλαγή |
|-----------|--------|
| 2026-03-12 | Initial audit + ADR creation. 400+ queries catalogued across 85+ files |
| 2026-03-12 | **Phase 1 COMPLETE**: FirestoreQueryService foundation — 6 new files (`src/services/firestore/` + `src/utils/firestore-sanitize.ts`), 1 modified (`accounting/firestore-helpers.ts` → re-export). Singleton service with tenant-aware CRUD, real-time subscriptions, batch reads. Centralized `requireAuthContext()`, `sanitizeForFirestore()`, `getTenantConfig()`. |
| 2026-03-12 | **Phase 2 COMPLETE**: Core Services Migration — 3 services migrated to `firestoreQueryService`. **workspace.service.ts**: 5 methods (getWorkspaceById, listWorkspaces, getWorkspaceForCompany, createWorkspace, updateWorkspace) → `getById()`, `getAll()`, `create()`, `update()`. **units.service.ts**: 7 read methods (getUnits, getUnitsByOwner, getUnitsByBuilding, getUnitsByBuildingAsModels, getUnitsByFeatures, getUnitsByOperationalStatus, getIncompleteUnits) → `getAll()` with `tenantOverride: 'skip'`. **contacts.service.ts**: 6 read methods (getContact, getAllContactIds, getOwnerContactIds, getContactStatistics, exportContacts, searchContacts) → `getById()`, `getAll()`. Post-query normalization helpers (`toWorkspace`, `toProperty`, `toUnitModel`, `toContact`) replace `withConverter()`. tenant-config.ts fixed: WORKSPACES `tenantId` → `companyId`. Write methods + pagination untouched. |
| 2026-03-13 | **Phase 3 COMPLETE**: File Services Migration — 3 services migrated. **file-record.service.ts**: 7 read methods (getFileRecord, getFilesByEntity, queryFileRecords, getTrashedFiles, getFilesEligibleForPurge, getLinkedFiles, findByHash) → `getById()`, `getAll()`. Shared `toFileRecord()` helper for timestamp normalization + validation. `getFilesEligibleForPurge` uses `tenantOverride: 'skip'`. Removed unused imports (collection, query, getDocs). **file-approval.service.ts**: 2 read methods (getFileApprovals, getPendingForUser) → `getAll()`. **file-folder.service.ts**: 2 read methods (getFolders, createFolder siblings query) → `getAll()`. All manual `companyId` constraints replaced by auto tenant filter. Write methods + onSnapshot unchanged. |
| 2026-03-13 | **Phase 4 COMPLETE**: CRM Services Migration — 5 files migrated (19 read methods total). **TasksRepository.ts**: 7 reads (getById, getAll, getByUser, getByLead, getByStatus, getOverdue, getStats) + deleteAll read part. Private `requireAuthContext()` removed. New `toTask()` mapper. **AppointmentsRepository.ts**: 4 reads (getById, getAll, getByUser, getByDateRange). Private `requireAuthContext()` removed. **opportunities.service.ts**: 2 reads (getOpportunities, getOpportunityById) + deleteAllOpportunities read. **SECURITY FIX**: tenant filtering auto-injected (was MISSING). **opportunities-client.service.ts**: 1 read (getOpportunitiesClient). **SECURITY FIX**: tenant filtering auto-injected. **InMemoryObligationsRepository.ts**: 5 reads (getAll, getById, getTemplates, search, getTransmittalsForObligation). Templates use `tenantOverride: 'skip'`. Super admin dual-mode handled automatically by `buildTenantConstraints()`. |
| 2026-03-13 | **Phase 5 COMPLETE**: Communication + Notification Services Migration — 4 files modified (5 read methods). **communications-client.service.ts**: 4 reads (getCommunicationsClient, getCommunicationsByContactClient, getCommunicationsByContact, deleteAllCommunications). **SECURITY FIX**: companyId tenant filter auto-injected (was MISSING in all 4). `getCommunicationsByContact` + `deleteAllCommunications` relocated from `communications.service.ts` ('use server' → client SDK auth unavailable). **communications.service.ts**: Removed 2 client SDK reads + `transformCommunication`. Admin SDK methods (triage, approve, reject) UNTOUCHED. **notificationService.ts**: `fetchNotifications` → dual-path: firestoreQueryService (client, auto userId) / direct query fallback (server API routes). `toNotification()` helper added. `subscribeToNotifications` → Phase 7 (onSnapshot). **useCommunicationsHistory.ts**: Import source updated. |
| 2026-03-13 | **Phase 6 COMPLETE**: React Hooks Migration — 1 file modified. **useFirestoreProjectsPaginated.ts**: Replaced `buildQuery` + `InfiniteScrollPagination` + `mapDocument` with `firestoreQueryService.getAll('PROJECTS', { constraints, maxResults })`. Cursor pagination via `lastDocument` ref. `toProject()` transform helper (plain objects). Removed explicit `companyId` filter (auto-injected by tenant config). Pre-existing TS2345 error eliminated. **5 hooks skipped** (useFirestoreBuildings, useFirestoreUnits, useFirestoreNotifications, useFirestoreParkingSpots, useFirestoreStorages) — already use API clients, not direct Firestore. **Zero UI consumers** verified — zero-risk migration. `useFloorFloorplans` deferred to Phase 10, 4 onSnapshot hooks to Phase 7. |
| 2026-03-13 | **Phase 7 COMPLETE**: Real-time Listeners Migration — 3 files modified. **useRealtimeUnits.ts**: `onSnapshot` + manual `onAuthStateChanged` → `firestoreQueryService.subscribe('UNITS', ...)`. **SECURITY FIX**: Was reading ENTIRE units collection without tenant filter — now auto-injects `companyId`. **useRealtimeBuildings.ts**: Same pattern — `onSnapshot` + `onAuthStateChanged` → `firestoreQueryService.subscribe('BUILDINGS', ...)`. **SECURITY FIX**: Same cross-tenant data leak fixed. **ReadOnlyLayerViewer.tsx**: `onSnapshot(query(...))` → `firestoreQueryService.subscribe('LAYERS', { constraints: [where('floorId'), orderBy('zIndex')] })`. Tenant filter auto-injected. RealtimeService integration deferred (already centralized subscription manager). |
| 2026-03-13 | **Phase 8 COMPLETE**: Admin Routes Safety — Batch Processing. **NEW**: `src/lib/admin-batch-utils.ts` (shared `processClientBatch()` + `processAdminBatch()` with cursor pagination, `BATCH_SIZE_READ=500`, `BATCH_SIZE_WRITE=200`). **Client SDK** (4 routes): migrate-units, migrate-dxf, cleanup-duplicates, migrate-building-features → `processClientBatch()`. **Admin SDK** (6 routes): create-clean-projects (verification → `.count().get()`), fix-projects-direct + seed-floors + seed-parking + force-update → `processAdminBatch()`, search-backfill → default `limit(500)`. **BUG FIX**: migrate-dxf N+1 bug — full collection scan per document replaced with `getDoc(doc(db, col, id))`. |

---

## 8. References

- **ADR-017**: Enterprise ID Generation (generators for all entities)
- **ADR-210**: Document ID Generation Audit (addDoc → setDoc migration)
- **ADR-156**: Centralization Gap Audit (broader centralization findings)
- **SECURITY_AUDIT_REPORT.md**: Security blockers (public data access, rate limiting)
- **PR-1A**: Firestore tenant isolation hotfix
