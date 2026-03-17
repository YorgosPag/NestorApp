# ADR-238: Entity Creation Centralization

| Metadata | Value |
|----------|-------|
| **Status** | PHASE 2 COMPLETE |
| **Date** | 2026-03-17 |
| **Category** | Entity Systems |
| **Canonical Location** | `src/lib/firestore/entity-creation.service.ts` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## 1. Context

### The Problem

Κατά τον end-to-end έλεγχο αλυσίδας δημιουργίας οντοτήτων (**Contact → Company → Project → Building → Floor → Unit → Storage → Parking**), διαπιστώθηκε ότι κάθε entity POST handler υλοποιεί ανεξάρτητα τα ίδια patterns: companyId resolution, timestamps, audit logging, tenant isolation, entity code generation.

- ❌ **6 διαφορετικές υλοποιήσεις** για companyId resolution
- ❌ **3 copy-paste blocks** (~105 γραμμές duplication) για entity code generation (ADR-233)
- ❌ **Bugs σε timestamps** (Floors χρησιμοποιεί `toISOString()` αντί `serverTimestamp()`)
- ❌ **Κενά σε audit logging** (Buildings, Floors δεν καλούν `logAuditEvent`)
- ❌ **Κενά σε tenant isolation** (Buildings, Floors δεν ελέγχουν)
- ❌ **Missing fields** (Floors: `linkedCompanyId`, `updatedAt` — Parking: `floorId`)
- ❌ **~175 γραμμές συνολικό duplication** σε 7 endpoints

### Audited Entities

| Entity | API Route | Creation Pattern |
|--------|-----------|-----------------|
| Contact | Client-side (`ContactsService.createContact()`) | Firestore SDK |
| Project | `POST /api/projects/create-for-companies` | Bulk creation |
| Building | `POST /api/buildings` | Server-side |
| Floor | `POST /api/floors` | Server-side (bugs) |
| Unit | `POST /api/units/create` | Server-side (reference) |
| Storage | `POST /api/storages` | Server-side |
| Parking | `POST /api/parking` | Server-side |

### Audited Source Files

- `src/services/contacts.service.ts` — Client-side contact creation
- `src/app/api/projects/create-for-companies/route.ts` — Bulk project creation
- `src/app/api/buildings/route.ts` — Building POST
- `src/app/api/floors/route.ts` — Floor POST (bugs)
- `src/app/api/units/create/route.ts` — Unit POST (reference implementation)
- `src/app/api/storages/route.ts` — Storage POST
- `src/app/api/parking/route.ts` — Parking POST
- `src/services/enterprise-id.service.ts` — ID generators
- `src/services/entity-code.service.ts` — ADR-233 code functions
- `src/lib/auth/tenant-isolation.ts` — `requireBuildingInTenant`

---

## 2. Decision

Δημιουργία **κεντρικοποιημένου Entity Creation Service** — μία και μοναδική πηγή αλήθειας (SSoT) για τη δημιουργία οντοτήτων. Κάθε API route handler γίνεται thin wrapper (~30-50 γραμμές) που δηλώνει μόνο entity-specific fields και validation.

### 2.1 Architecture (3 Layers)

```
┌─────────────────────────────────────────────────────────────┐
│  API Route Handlers (thin — ~30-50 lines each)              │
│  Μόνο: validation + entity-specific fields + response       │
├─────────────────────────────────────────────────────────────┤
│  Entity Creation Service (NEW — Centralized SSoT)           │
│  src/lib/firestore/entity-creation.service.ts               │
│                                                             │
│  resolveCompanyId()      — 1 υλοποίηση αντί 6              │
│  buildCommonFields()     — timestamps + createdBy + linked  │
│  generateEntityCode()    — ADR-233, 1 υλοποίηση αντί 3     │
│  ensureTenantIsolation() — requireBuildingInTenant wrapper  │
│  createEntity()          — orchestrator                     │
│  auditCreation()         — logAuditEvent wrapper            │
├─────────────────────────────────────────────────────────────┤
│  Existing Services (unchanged)                              │
│  enterprise-id.service, entity-code.service,                │
│  tenant-isolation, auth, firestore-collections              │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Entity Registry (Type-safe SSoT)

Κάθε entity type δηλώνεται σε ένα registry object:

| Entity | Collection | Hierarchy | Parent Field | ID Generator | Code Type | Tenant Check |
|--------|-----------|-----------|-------------|-------------|-----------|:---:|
| contact | `CONTACTS` | root | — | `generateContactId` | — | ❌ |
| project | `PROJECTS` | root | — | `generateProjectId` | — | ❌ |
| building | `BUILDINGS` | project-child | `projectId` | `generateBuildingId` | — | ❌ |
| floor | `FLOORS` | building-child | `buildingId` | `generateFloorId` | — | ❌ |
| unit | `UNITS` | building-child | `buildingId` | `generateUnitId` | `unit` | ✅ |
| storage | `STORAGE` | building-child | `buildingId` | `generateStorageId` | `storage` | ✅ |
| parking | `PARKING_SPACES` | building-child | `buildingId` | `generateParkingId` | `parking` | ✅ |

### 2.3 Planned File Structure

```
src/lib/firestore/
├── entity-creation.types.ts    — Types, interfaces, registry definition
├── entity-creation.service.ts  — Core functions (resolveCompanyId, buildCommonFields, createEntity, etc.)
└── entity-creation.utils.ts    — sanitizeForFirestore (undefined → null cleanup)
```

### 2.4 Planned API

```typescript
// Future usage in API route handlers:
import { createEntity, EntityCreationContext } from '@/lib/firestore/entity-creation.service';

// POST /api/parking — becomes ~30 lines instead of ~120
const result = await createEntity('parking', {
  auth: ctx,
  parentId: body.buildingId,
  entitySpecificFields: {
    number: body.number,
    type: body.type,
    status: body.status ?? 'available',
    floorId: body.floorId ?? null,
    // ...entity-specific only
  },
  validation: () => {
    if (!body.number) throw ApiError.badRequest('Number required');
  },
});
```

---

## 3. Compliance Audit (7 Entities × 10 Patterns)

### 3.1 Full Compliance Matrix

| Pattern | Contacts | Projects | Buildings | Floors | Units | Storages | Parking |
|---------|:--------:|:--------:|:---------:|:------:|:-----:|:--------:|:-------:|
| **companyId resolution** | ✅ token claims | ⚠️ from contacts | ✅ from project | ❌ μόνο super_admin | ✅ from building | ✅ from building | ✅ from building |
| **linkedCompanyId: null** | ❌ λείπει | ❌ λείπει | ✅ | ❌ λείπει | ✅ | ✅ | ✅ |
| **Timestamps server** | ✅ serverTimestamp | ❌ toISOString | ✅ serverTimestamp | ❌ toISOString | ✅ serverTimestamp | ✅ serverTimestamp | ✅ serverTimestamp |
| **Enterprise ID** | ✅ generateContactId | ❌ counter-based | ✅ generateBuildingId | ✅ generateFloorId | ✅ generateUnitId | ✅ generateStorageId | ✅ generateParkingId |
| **Audit logging** | ❌ λείπει | ❌ λείπει | ❌ λείπει στο POST | ❌ λείπει | ✅ | ✅ | ✅ |
| **Tenant isolation** | N/A client | N/A bulk | ❌ λείπει | ❌ λείπει | ✅ implicit | ✅ requireBuilding | ✅ requireBuilding |
| **Entity code ADR-233** | N/A | N/A | N/A | N/A | ✅ 35 lines | ✅ 35 lines (copy) | ✅ 35 lines (copy) |
| **floorId field** | N/A | N/A | N/A | N/A | ✅ | ✅ | ❌ λείπει |
| **Error handling** | Client-side | NextResponse | ApiError | NextResponse | ApiError | ApiError | ApiError |
| **Validation** | Client-side | Minimal | ❌ καθόλου | ✅ explicit | ✅ name required | ✅ name required | ✅ number required |

### 3.2 Duplication Analysis

| Duplicated Block | Lines per endpoint | Εμφανίσεις | Σύνολο waste |
|-----------------|:-:|:-:|:-:|
| companyId resolution + building lookup | ~15 | 4 (Units, Storages, Parking, Floors) | 45 γραμμές |
| Entity code generation (ADR-233) | ~35 | 3 (Units, Storages, Parking) | 70 γραμμές |
| requireBuildingInTenant try/catch | ~12 | 2 (Storages, Parking) | 12 γραμμές |
| Common fields (timestamps, createdBy) | ~8 | 5 (Buildings, Floors, Units, Storages, Parking) | 32 γραμμές |
| Audit logging pattern | ~8 | 3 (Units, Storages, Parking) | 16 γραμμές |
| **ΣΥΝΟΛΟ DUPLICATION** | | | **~175 γραμμές** |

---

## 4. Critical Bugs Found

### Bug 1: Floors — Client Timestamps (CRITICAL)

**Current**: `new Date().toISOString()` — client-side timestamp
**Risk**: Clock skew μεταξύ client/server, inconsistent ordering
**Fix**: `FieldValue.serverTimestamp()` μέσω `buildCommonFields()`

### Bug 2: Floors — companyId μόνο για super_admin (HIGH)

**Current**: `if (isSuperAdmin) { resolve companyId }` — regular users δεν κληρονομούν
**Risk**: Entities χωρίς companyId → broken queries, data isolation failure
**Fix**: Unified `resolveCompanyId()` για ΟΛΟΥΣ τους users

### Bug 3: Floors — Missing updatedAt (MEDIUM)

**Current**: Δεν υπάρχει `updatedAt` κατά τη δημιουργία
**Risk**: Inconsistency στο data model — queries βασισμένα σε updatedAt αποτυγχάνουν
**Fix**: `buildCommonFields()` θέτει πάντα `updatedAt: FieldValue.serverTimestamp()`

### Bug 4: Buildings + Floors — Missing Audit Logging (HIGH)

**Current**: Δεν καλείται `logAuditEvent` στα POST endpoints
**Risk**: Audit trail gap — impossible to trace ποιος δημιούργησε τι
**Fix**: `createEntity()` orchestrator καλεί πάντα `auditCreation()`

### Bug 5: Floors — Missing linkedCompanyId (LOW)

**Current**: Omitted from creation payload
**Risk**: Minor inconsistency — EntityLinkCard expects field to exist
**Fix**: `buildCommonFields()` θέτει πάντα `linkedCompanyId: null`

### Bug 6: Buildings — Missing Validation (MEDIUM)

**Current**: Δεν υπάρχει validation (ούτε name required check)
**Risk**: Κενά ονόματα ή invalid data στη βάση
**Fix**: Entity-specific validation callback στον orchestrator

### Bug 7: Parking — Missing floorId (LOW)

**Current**: `floorId` δεν περνάει στο POST + PATCH payload
**Risk**: Parking spots χωρίς σύνδεση με floor
**Fix**: Entity-specific field — θα προστεθεί στο migration

### Bug 8: Projects — Counter-based IDs (MEDIUM)

**Current**: Bulk creation χρησιμοποιεί counter-based IDs αντί Enterprise IDs
**Risk**: Inconsistency με ADR-017 (Enterprise ID Generation)
**Fix**: Migration σε `generateProjectId()` — ξεχωριστό task

### Bug 9: Entity Code — 95% Copy-Paste (MAINTENANCE)

**Current**: 3 endpoints × ~35 γραμμές identically duplicated entity code generation
**Risk**: Τα fixes εφαρμόζονται σε ένα endpoint αλλά ξεχνιούνται στα υπόλοιπα
**Fix**: Ενιαία `generateEntityCode()` στο centralized service

---

## 5. Centralization Design

### 5.1 companyId Resolution (Unified Algorithm)

Ενιαίος αλγόριθμος αντικαθιστά 6 ξεχωριστές υλοποιήσεις:

```
resolveCompanyId(ctx, entityType, parentId?):
  IF parentId exists AND hierarchy = 'building-child':
    → Fetch building doc → return building.companyId
  ELSE IF parentId exists AND hierarchy = 'project-child':
    → Fetch project doc → return project.companyId
  ELSE:
    → return ctx.companyId (from auth context / token claims)
```

**Κλειδί**: Floors τώρα θα κληρονομούν companyId από building για ΟΛΟΥΣ τους users (όχι μόνο super_admin).

### 5.2 Common Fields (buildCommonFields)

Κάθε entity δημιουργείται πάντα με:

```
{
  companyId:       resolved (from hierarchy — see 5.1)
  linkedCompanyId: null (set later via EntityLinkCard)
  createdAt:       FieldValue.serverTimestamp()  // ALWAYS server
  updatedAt:       FieldValue.serverTimestamp()  // ALWAYS server
  createdBy:       ctx.uid
}
```

### 5.3 Entity Code Generation (Unified — replaces ADR-233 duplication)

Ενιαίος αλγόριθμος αντικαθιστά 3 copy-paste blocks (~105 γραμμές):

```
generateEntityCode(entityType, buildingId, options?):
  1. Skip αν ήδη ADR-233 format → parseEntityCode()
  2. Fetch building name → extractBuildingLetter()
  3. resolveTypeCode(entityType, subType, locationZone)
  4. formatFloorCode(floorLevel)
  5. Query existing entities στο ίδιο building → maxSequence
  6. formatEntityCode(letter, type, floor, seq + 1)
```

### 5.4 createEntity Orchestrator

Η κεντρική function που ενορχηστρώνει τα πάντα:

```
createEntity(entityType, params):
  1. resolveCompanyId()          — unified hierarchy resolution
  2. ensureTenantIsolation()     — if registry[entityType].tenantCheck
  3. generateId()                — enterprise-id.service
  4. buildCommonFields()         — timestamps, createdBy, linkedCompanyId
  5. generateEntityCode()        — if registry[entityType].codeType
  6. sanitizeForFirestore()      — undefined → null
  7. setDoc()                    — Firestore write
  8. auditCreation()             — logAuditEvent (ALWAYS)
  return { id, code?, doc }
```

### 5.5 What is Centralized vs What Stays Entity-Specific

| Κεντρικοποιείται (service) | Παραμένει entity-specific (route handler) |
|---------------------------|------------------------------------------|
| companyId resolution | Payload validation (name, number, etc.) |
| Timestamps + createdBy | Entity-specific fields (type, status, area, etc.) |
| linkedCompanyId: null | Multi-level validation (ADR-236 — Units only) |
| Tenant isolation check | Open-space logic (Parking/Storage without building) |
| Entity code generation | Entity-specific type codes |
| Enterprise ID generation | Response format (unitId vs storageId, etc.) |
| Audit logging | Permission string |
| Undefined field cleanup (sanitize) | |

### 5.6 Contacts: Ξεχωριστή Περίπτωση

Τα Contacts δημιουργούνται **client-side** μέσω `ContactsService.createContact()` (`src/services/contacts.service.ts`). Αυτό είναι ριζικά διαφορετικό pattern — client Firestore SDK, duplicate detection, ID token claims.

**Απόφαση**: ΔΕΝ μεταφέρονται τα Contacts στο centralized service σε αυτή τη φάση. Καταγράφονται στο registry ως `serverSide: false` για documentation. Μελλοντικό migration αν χρειαστεί.

---

## 6. Bugs Auto-Fixed by Centralization

Αυτά τα 5 bugs διορθώνονται **αυτόματα** μόλις κεντρικοποιηθούν τα endpoints:

| # | Bug | Τρέχουσα κατάσταση | Μετά κεντρικοποίηση |
|---|-----|-------------------|---------------------|
| 1 | Floors: client timestamps | `new Date().toISOString()` | `FieldValue.serverTimestamp()` via `buildCommonFields()` |
| 2 | Floors: companyId μόνο super_admin | `if (isSuperAdmin)` check | Unified `resolveCompanyId()` για όλους |
| 3 | Floors: missing updatedAt | Δεν υπάρχει | Πάντα via `buildCommonFields()` |
| 4 | Buildings + Floors: missing audit | Δεν καλείται `logAuditEvent` | Πάντα via `createEntity()` orchestrator |
| 5 | Floors: missing linkedCompanyId | Omitted | `null` via `buildCommonFields()` |

---

## 7. Implementation Plan

### Phase 1: Foundation + Canary ✅ IMPLEMENTED (2026-03-17)

| Step | File | Status | Description |
|:---:|------|:---:|-------------|
| 1 | `src/lib/firestore/entity-creation.types.ts` | ✅ | Types, interfaces, ENTITY_REGISTRY (5 server entities) |
| 2 | `src/lib/firestore/entity-creation.service.ts` | ✅ | Core: fetchParentData, verifyTenantAccess, buildCommonFields, generateEntityCode, createEntity |
| 3 | `src/lib/firestore/entity-creation.utils.ts` | ⏭️ SKIPPED | `sanitizeForFirestore` already exists at `@/utils/firestore-sanitize` — reused, not duplicated |
| 4 | `src/app/api/parking/route.ts` | ✅ | **Canary migration** — POST reduced from ~150 to ~65 lines |

**Key decisions during Phase 1:**
- `sanitizeForFirestore` reused from `@/utils/firestore-sanitize.ts` (no new utils file)
- Building-child entities auto-propagate `projectId` from parent building data
- Single Firestore read per parent (tenant check + companyId + entity code share same data)
- Open-space parking (no buildingId) pre-verified in route handler before calling service

### Phase 2: Migration ✅ COMPLETE (2026-03-17)

| Step | File | Status | Description |
|:---:|------|:---:|-------------|
| 5 | `src/app/api/storages/route.ts` | ✅ | POST reduced ~130 → ~50 lines |
| 6 | `src/app/api/buildings/route.ts` | ✅ | POST reduced ~70 → ~35 lines. **Bug fix**: audit logging added |
| 7 | `src/app/api/floors/route.ts` | ✅ | POST reduced ~125 → ~45 lines. **5 bug fixes**: serverTimestamp, companyId ALL users, updatedAt, linkedCompanyId, audit logging |
| 8 | `src/app/api/units/create/route.ts` | ✅ | POST reduced ~165 → ~60 lines. Tenant check added via registry |
| 9 | `src/lib/firestore/entity-creation.types.ts` | ✅ | Fix: codeField union added `'code'`, unit registry `codeField: 'code'` |
| 10 | `src/components/building-management/tabs/FloorsTabContent.tsx` | ✅ | Frontend fix: canonical response handling (apiSuccess format) |

**Net result**: ~490 lines removed, ~190 added. **-300 lines net reduction**.

**Bug fixes auto-applied**:
- Floors: `toISOString()` → `serverTimestamp()` (CRITICAL)
- Floors: companyId inherited for ALL users, not just super_admin (HIGH)
- Floors: `updatedAt` + `linkedCompanyId` now included (MEDIUM)
- Buildings + Floors: audit logging now included (HIGH)
- Units: tenant isolation check now enabled via registry (security improvement)

### Phase 3: Cleanup & Documentation

| Step | Description |
|:---:|-------------|
| 9 | Ενημέρωση `docs/centralized-systems/reference/adr-index.md` |
| 10 | Ενημέρωση `docs/centralized-systems/README.md` |
| 11 | Ενημέρωση σχετικών ADRs (ADR-017, ADR-233) |

### Phase 4: Optional Enhancements

| Step | Description |
|:---:|-------------|
| 12 | Projects bulk creation: migrate counter-based IDs → Enterprise IDs |
| 13 | Contacts: evaluate client→server migration (separate ADR) |
| 14 | Add unit tests for entity-creation.service |

---

## 8. Consequences

### Positive

- ✅ **~175 γραμμές duplication eliminated** — DRY principle enforced
- ✅ **5 bugs auto-fixed** — server timestamps, companyId, audit, linkedCompanyId
- ✅ **Consistent behavior** — κάθε entity ακολουθεί τα ίδια patterns
- ✅ **Thin route handlers** — ~30-50 γραμμές αντί 100-150
- ✅ **Complete audit trail** — κανένα entity χωρίς audit logging
- ✅ **Type-safe registry** — compile-time verification entity configurations
- ✅ **Single fix point** — bug fix στο service → fixes ALL entities

### Negative

- ⚠️ **Migration effort** — 5 endpoints πρέπει να αλλάξουν (one-time cost)
- ⚠️ **Learning curve** — developers πρέπει να μάθουν τη νέα δομή
- ⚠️ **Abstraction layer** — ένα extra layer indirection

---

## 9. Prohibitions (after this ADR)

- ⛔ **ΑΠΑΓΟΡΕΥΕΤΑΙ** δημιουργία νέου entity endpoint χωρίς χρήση `createEntity()`
- ⛔ **ΑΠΑΓΟΡΕΥΕΤΑΙ** `new Date().toISOString()` για timestamps — μόνο `FieldValue.serverTimestamp()`
- ⛔ **ΑΠΑΓΟΡΕΥΕΤΑΙ** inline companyId resolution — μόνο `resolveCompanyId()`
- ⛔ **ΑΠΑΓΟΡΕΥΕΤΑΙ** copy-paste entity code generation — μόνο `generateEntityCode()`
- ⛔ **ΑΠΑΓΟΡΕΥΕΤΑΙ** entity creation χωρίς audit logging
- ⛔ **ΑΠΑΓΟΡΕΥΕΤΑΙ** `addDoc()` — μόνο `setDoc()` με Enterprise ID (per ADR-017)

---

## 10. References

- Related: [ADR-017](./ADR-017-enterprise-id-generation.md) — Enterprise ID Generation
- Related: [ADR-233](./adrs/specs/SPEC-233-entity-code-system.md) — Entity Code System
- Related: [ADR-236](./adrs/specs/) — Multi-level Validation (Units)
- Related: [ADR-012](./ADR-012-entity-linking-service.md) — Entity Linking Service
- Canonical: `src/lib/firestore/entity-creation.service.ts`
- Registry: `src/lib/firestore/entity-creation.types.ts`
- Industry Standards: Google Cloud Best Practices, Firebase Security Rules Guide

---

## 11. Decision Log

| Date | Decision | Author |
|------|----------|--------|
| 2026-03-17 | ADR Created — audit complete, architecture designed, 9 bugs documented | Γιώργος Παγώνης + Claude Code |
| 2026-03-17 | Phase 1 IMPLEMENTED — types, service, parking canary migration. No utils file (reused existing sanitize). Single parent read optimization. | Γιώργος Παγώνης + Claude Code |
| 2026-03-17 | Phase 2 COMPLETE — All 4 remaining endpoints migrated (storages, buildings, floors, units). 5 bugs auto-fixed. Unit codeField corrected to 'code'. Frontend FloorsTabContent adapted to canonical response format. Net -300 lines. | Γιώργος Παγώνης + Claude Code |

---

*ADR Format based on: Michael Nygard's Architecture Decision Records*
*Enterprise standards inspired by: Autodesk, Adobe, Bentley Systems, SAP, Google*
