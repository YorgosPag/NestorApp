# ADR-286: DXF Level Creation Centralization (SSOT)

| Metadata | Value |
|----------|-------|
| **Status** | Accepted |
| **Date** | 2026-04-05 |
| **Category** | Entity Systems / DXF Viewer |
| **Canonical Location** | `src/lib/firestore/entity-creation.service.ts` + `src/app/api/dxf-levels/` |
| **Related** | ADR-237 (Polygon Overlay Bridge), ADR-238 (Entity Creation Centralization), ADR-285 (DXF Tenant Scoping) |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## 1. Context

### Το πρόβλημα

Κατά τον έλεγχο SSOT για τη δημιουργία ορόφων/levels εντοπίστηκαν **3 διαφορετικά creation paths** με ανομοιογενή μεταχείριση tenancy/audit/IDs:

| Σημείο | Pipeline | Status |
|---|---|---|
| Main `floors` API | `createEntity('floor', …)` (ADR-238) | ✅ SSOT |
| DXF Viewer `dxf-viewer-levels` | Direct client-side `setDoc` | ❌ Bypass |
| Admin `seed-floors` | Direct server-side `setDoc` loop | ❌ Bypass |

Οι 2 bypass-paths παραβίαζαν τις εγγυήσεις του ADR-238:

- ❌ Δεν κατέγραφαν audit events (`logAuditEvent`)
- ❌ Διαφορετικό validation (manual vs Zod)
- ❌ Tenant isolation χειροκίνητο (client-side `companyId ?? null`)
- ❌ Entity IDs παράγονταν σε πολλαπλά σημεία (client + server)
- ❌ Divergent error handling

### Domain Clarification

- **`Floor`** = business entity (όροφος κτιρίου) — αποθηκεύεται στο collection `floors`
- **`DXF Level`** = **scene/drawing attachment** σε έναν όροφο — η κάτοψη DXF πάνω στην οποία σχεδιάζονται Layers (polygons) που ταυτίζονται με τις μονάδες του ορόφου

Είναι **διαφορετικά entities**: ο Floor είναι domain, το DxfLevel είναι presentation/scene layer με σύνδεση `floorId` (FK → floors).

---

## 2. Decision

**Option A — Centralization (όχι Merge):**

- Διατηρούμε 2 entities (`floor`, `dxfLevel`) σε ξεχωριστά collections
- Προσθέτουμε νέο entity type `dxfLevel` στο `ENTITY_REGISTRY`
- Προσθέτουμε νέα ιεραρχία `'tenant-scoped'` για entities που δεν κληρονομούν companyId από parent
- DXF Viewer καλεί νέο API `/api/dxf-levels` (server-side `createEntity('dxfLevel', …)`)
- Admin seed refactored να περνάει από `createEntity('floor', …)`

**Γιατί όχι full merge**: Ο DxfLevel έχει DXF-specific fields (`order`, `isDefault`, `visible`, `sceneFileId`, `sceneFileName`) που δεν ανήκουν οντολογικά στον Floor. Breaking data migration + scope creep.

---

## 3. Implementation

### 3.1 New hierarchy type: `'tenant-scoped'`

Στο `entity-creation.types.ts` προστέθηκε τρίτος τύπος ιεραρχίας:

```typescript
export type EntityHierarchy = 'project-child' | 'building-child' | 'tenant-scoped';
```

**Σημασιολογία:**
- `'project-child'` / `'building-child'`: `companyId` κληρονομείται από parent doc
- `'tenant-scoped'`: `companyId` λαμβάνεται **απευθείας από auth context** (χωρίς parent fetch για tenant resolution). Αν παρέχεται optional `parentId` (π.χ. `floorId`), γίνεται validation ύπαρξης αλλά δεν χρησιμοποιείται για companyId.

### 3.2 Registry entry για `dxfLevel`

```typescript
dxfLevel: {
  collection: COLLECTIONS.DXF_VIEWER_LEVELS,  // 'dxf-viewer-levels'
  hierarchy: 'tenant-scoped',
  parentField: 'floorId',                      // optional FK
  idGenerator: 'generateLevelId',              // lvl_uuid-...
  codeType: null,
  codeField: null,
  tenantCheck: false,                          // auth.companyId is source of truth
  auditTargetType: 'api',
}
```

### 3.3 New API endpoint: `/api/dxf-levels`

- `POST` — create DxfLevel (calls `createEntity('dxfLevel', …)`)
- `GET` — list levels (tenant-filtered, optional `floorId` query)
- `PATCH` — update level with version check (ETag)
- `DELETE` — remove level

**Permissions:** `dxf:layers:view` (read/create/update), `dxf:layers:manage` (delete).

**Unique constraint:** `(companyId, name)` — μοναδικό όνομα level ανά tenant.

### 3.4 Client gateway

`src/services/dxf-level-mutation-gateway.ts` (mirror του `floor-mutation-gateway.ts`):

```typescript
createDxfLevelWithPolicy({ payload })
updateDxfLevelWithPolicy({ payload })
deleteDxfLevelWithPolicy({ levelId })
```

### 3.5 DXF Viewer refactor

`src/subapps/dxf-viewer/systems/levels/hooks/useLevelOperations.ts`:

**Before:**
```typescript
const { generateLevelId } = await import('@/services/enterprise-id.service');
const enterpriseId = generateLevelId();
await setDoc(doc(db, firestoreCollection, enterpriseId), {
  name, order, isDefault, visible, createdAt, companyId: user?.companyId ?? null, createdBy: user?.uid ?? null, floorId
});
```

**After:**
```typescript
const response = await createDxfLevelWithPolicy<DxfLevelCreateResponse>({
  payload: { name, order, isDefault, visible, ...(floorId ? { floorId } : {}) },
});
const enterpriseId = response?.levelId;
```

Το `companyId`/`createdBy`/`createdAt` γράφονται πλέον server-side από `createEntity()`. Αφαιρέθηκε το `useAuth()` import (περιττό).

### 3.6 Admin seed refactor

`src/app/api/admin/seed-floors/route.ts` — ο creation loop αντικαταστάθηκε:

**Before:** Direct `setDoc` ανά floor με hardcoded `companyId` fallback, `generateFloorId()` client-invoked, χωρίς audit.

**After:**
```typescript
for (const template of FLOOR_TEMPLATES) {
  const result = await createEntity('floor', {
    auth: ctx,
    parentId: TARGET_BUILDING.id,
    entitySpecificFields: { number, name, units, description, buildingId, buildingName, projectId, projectName },
    apiPath: '/api/admin/seed-floors (POST)',
  });
}
```

### 3.7 Collection constant alignment

Διορθώθηκε το `COLLECTIONS.DXF_VIEWER_LEVELS` default από `'dxfViewerLevels'` (camelCase, unused) → `'dxf-viewer-levels'` (kebab-case, actual production value). Το hardcoded literal σε `LevelsSystem.tsx`, `config.ts`, `useFloorOverlays.ts` παραμένει ενεργό.

---

## 4. Consequences

### Positive

- ✅ **Single SSOT pipeline** για creation σε ΟΛΑ τα σημεία (floors + dxfLevels + admin seed)
- ✅ **Audit trail** για κάθε δημιουργία DXF level (προηγουμένως σιωπηλή)
- ✅ **Server-side tenancy**: `companyId`/`createdBy` δεν εξαρτώνται από client code
- ✅ **Enterprise IDs ομοιόμορφα** (server-generated)
- ✅ **Rate limiting** + **RBAC** σε κάθε dxf-level mutation
- ✅ **Validation via Zod schema** (`CreateDxfLevelSchema`)
- ✅ **Duplicate name detection** ανά tenant
- ✅ Η αρχιτεκτονική `'tenant-scoped'` hierarchy είναι reusable για μελλοντικά standalone entities

### Negative / Trade-offs

- ⚠️ Extra HTTP roundtrip για κάθε level creation (vs direct setDoc) — ~100-200ms latency
- ⚠️ Existing `dxf-viewer-levels` documents (pre-migration) δεν έχουν audit entries — acceptable, no back-fill
- ⚠️ Update/delete/reorder/rename operations **παραμένουν direct-write** προς το παρόν (next iteration)

### Out of Scope

- ❌ Data migration για back-fill audit events σε existing DXF levels
- ❌ Collection rename (`dxf-viewer-levels` → `floor_scenes`) — breaking change
- ❌ Refactor update/delete/reorder operations μέσω `/api/dxf-levels` PATCH/DELETE (gateway έτοιμο αλλά `useLevelOperations` δεν το χρησιμοποιεί ακόμα)

---

## 5. Files Changed

### New
- `src/app/api/dxf-levels/route.ts`
- `src/app/api/dxf-levels/dxf-levels.handlers.ts`
- `src/app/api/dxf-levels/dxf-levels.schemas.ts`
- `src/app/api/dxf-levels/dxf-levels.types.ts`
- `src/services/dxf-level-mutation-gateway.ts`
- `docs/centralized-systems/reference/adrs/ADR-286-dxf-level-creation-centralization.md`

### Modified
- `src/lib/firestore/entity-creation.types.ts` (add `dxfLevel` + `'tenant-scoped'` hierarchy)
- `src/lib/firestore/entity-creation.service.ts` (support `'tenant-scoped'` path)
- `src/config/firestore-collections.ts` (align `DXF_VIEWER_LEVELS` default)
- `src/config/domain-constants.ts` (add `API_ROUTES.DXF_LEVELS`)
- `src/subapps/dxf-viewer/systems/levels/hooks/useLevelOperations.ts` (use gateway)
- `src/app/api/admin/seed-floors/route.ts` (use `createEntity('floor', …)`)

---

## 6. Verification

- [ ] TypeScript compilation clean (`npx tsc --noEmit`)
- [ ] UI: Create DXF level via LevelPanel → Firestore doc έχει `companyId`, `createdBy`, `createdAt`, audit entry
- [ ] UI: Existing DXF levels εξακολουθούν να φαίνονται και editable
- [ ] Admin: `POST /api/admin/seed-floors` → created floors έχουν audit entries με enterprise IDs
- [ ] Floor overlay view (`/properties?view=floorplan`) — levels φορτώνουν κανονικά
- [ ] Rate limit + RBAC enforced on `/api/dxf-levels`

---

## 7. Changelog

| Date | Change |
|---|---|
| 2026-04-05 | Initial draft — ADR accepted, implementation complete |
