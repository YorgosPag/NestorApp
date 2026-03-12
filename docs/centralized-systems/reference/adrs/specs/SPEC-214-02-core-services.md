# SPEC-214-02: Core Services Migration

| Metadata | Value |
|----------|-------|
| **ADR** | ADR-214 |
| **Phase** | 2 |
| **Status** | ✅ COMPLETED |
| **Risk** | MEDIUM |
| **Αρχεία** | 4 modified |
| **Depends On** | SPEC-214-01 |
| **Completed** | 2026-03-12 |

---

## Στόχος

Migration των core business services (`units.service.ts`, `contacts.service.ts`, `workspace.service.ts`) από inline Firebase SDK queries σε `FirestoreQueryService`.

---

## Αρχιτεκτονικές Αποφάσεις

### Converter Strategy: Post-query normalization

Αντί να προσθέσουμε `withConverter()` support στον FirestoreQueryService, κάθε service κάνει post-query normalization:

| Service | Helper | Replaces |
|---------|--------|----------|
| workspace.service.ts | `toWorkspace(raw)` | `workspaceConverter.fromFirestore` |
| units.service.ts | `toProperty(raw)` | `transformUnit(doc: DocumentSnapshot)` |
| units.service.ts | `toUnitModel(raw)` | `normalizeUnitSnapshot(doc: DocumentSnapshot)` |
| contacts.service.ts | `toContact(raw)` | `contactConverter.fromFirestore` (στα migrated methods) |

### Tenant Configuration

| Collection | Πριν | Μετά | Σημείωση |
|------------|------|------|----------|
| WORKSPACES | `tenantId` | `companyId` | Fix — documents use `companyId` |
| WORKSPACE_MEMBERS | `tenantId` | `companyId` | Fix — consistent with WORKSPACES |
| UNITS | default (`companyId`) | `tenantOverride: 'skip'` | Documents δεν έχουν companyId |
| CONTACTS | default (`companyId`) | default (`companyId`) ✅ | Auto tenant filter |

### Scope: Read methods only

Write methods (setDoc, updateDoc, writeBatch, API calls) παραμένουν ως έχουν. Pagination (startAfter) δεν μεταφέρεται — θα γίνει σε Phase 6.

---

## Migrated Methods

### workspace.service.ts (5 methods)

| Method | Πριν | Μετά |
|--------|------|------|
| `getWorkspaceById()` | `getDoc()` + converter | `firestoreQueryService.getById()` + `toWorkspace()` |
| `listWorkspaces()` | `getDocs()` + query + converter | `firestoreQueryService.getAll()` + constraints + `.documents.map(toWorkspace)` |
| `getWorkspaceForCompany()` | `getDocs()` + where + converter | `firestoreQueryService.getAll()` + constraints + `maxResults:1` |
| `createWorkspace()` | `setDoc()` + converter | `firestoreQueryService.create()` |
| `updateWorkspace()` | `updateDoc()` | `firestoreQueryService.update()` |

**Removed imports**: `collection`, `doc`, `getDoc`, `getDocs`, `setDoc`, `updateDoc`, `query`, `limit`, `db`, `workspaceConverter`

### units.service.ts (7 read methods)

| Method | Return Type | Normalizer |
|--------|------------|------------|
| `getUnits()` | `Property[]` | `toProperty()` |
| `getUnitsByOwner()` | `Property[]` | `toProperty()` |
| `getUnitsByBuildingAsModels()` | `UnitModel[]` | `toUnitModel()` |
| `getUnitsByBuilding()` | `Property[]` | `toProperty()` |
| `getUnitsByFeatures()` | `UnitModel[]` | `toUnitModel()` |
| `getUnitsByOperationalStatus()` | `UnitModel[]` | `toUnitModel()` |
| `getIncompleteUnits()` | `UnitModel[]` | `toUnitModel()` |

All use `tenantOverride: 'skip'` (unit documents lack companyId field).

**Removed imports**: `getDocs`, `collection`, `Timestamp`, `DocumentSnapshot` types (for read functions)

### contacts.service.ts (6 read methods)

| Method | Σημείωση |
|--------|----------|
| `getContact(id)` | `getById()` + `toContact()` |
| `getAllContactIds()` | `getAll()` → `.documents.map(d => d.id)` |
| `getOwnerContactIds()` | Queries UNITS collection with `tenantOverride: 'skip'` |
| `getContactStatistics()` | `getAll()` → iterate + count |
| `exportContacts(type?)` | `getAll()` + optional where constraint |
| `searchContacts(opts)` | `getAll()` + client-side filtering |

**NOT migrated**: `getAllContacts` (pagination with startAfter), `subscribeToContacts` (onSnapshot), all write methods

---

## Verification Checklist

- [x] `workspace.service.ts` — 5 methods migrated (3 read, 1 create, 1 update)
- [x] `units.service.ts` — 7 read methods migrated
- [x] `contacts.service.ts` — 6 read methods migrated
- [x] `tenant-config.ts` — WORKSPACES/WORKSPACE_MEMBERS field fixed
- [x] Return types unchanged (backward compatible)
- [x] Tenant filtering maintained (contacts auto-filter, units skip, workspaces fixed)
- [x] No `addDoc` introduced (ADR-210 compliance)
- [x] Public API of each service unchanged — zero consumer impact
