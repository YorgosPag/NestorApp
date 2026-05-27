# ADR-379 — BIM Entity Audit Coverage Fix

| Πεδίο | Τιμή |
|---|---|
| **Status** | ✅ **DONE** 2026-05-27 — Phases A→E shipped, Phase F (this ADR + cross-refs) pending commit |
| **Date** | 2026-05-27 |
| **Category** | DXF Viewer — Persistence / Audit Trail |
| **Location** | `docs/centralized-systems/reference/adrs/ADR-379-bim-entity-audit-coverage.md` |
| **Author** | Claude Opus 4.7 + Γιώργος Παγώνης |
| **Companions** | ADR-195 (Entity Audit Trail master), ADR-363 §5.17 (BIM Drawing Mode — audit clients), ADR-294 (SSoT Ratchet) |
| **Industry alignment** | Revit Worksharing audit log, ArchiCAD Teamwork timeline, AutoCAD Civil 3D audit — all log the *parameter delta*, not just `kind` |

---

## Summary

Δύο root bugs στο BIM audit pipeline που μαζί καθιστούσαν το history tab **τυφλό** για κάθε wall / column / slab / beam / opening:

1. **Bug #1 — Delete silent fail (server):** το `/api/audit-trail/record` έτρεχε ownership check via `entityDoc.exists` ΜΕΤΑ το client-side delete → 404 → ο client swallow-ει το error με `.catch(() => {})` → **κανένα delete audit row δεν γραφόταν** για BIM entities.
2. **Bug #2 — Hardcoded `kind`-only payload (client):** όλα τα 5 BIM audit-clients δέχονταν `Pick<Entity, 'id' | 'kind'>` και έγραφαν μόνο `[{ field: 'kind', oldValue: X, newValue: Y }]`. Αποτέλεσμα: ακόμα κι όταν περνούσε το audit row, **δεν περιείχε κανένα dimensional field** (width / thickness / material / mark / κλπ). Πιο "λεπτομερές" audit row από Property/Building/Contact που χρησιμοποιούν `diffTrackedFields()` SSoT.

Bug #1 ζούσε για κάθε BIM type. Bug #2 ζούσε από Phase 1B (wall) → Phase 5 (beam). Επιβεβαιώθηκαν runtime την 2026-05-27 με DB state: 8 audit rows για ένα wall_*, 0 από αυτά `action='deleted'` παρότι ο user είχε διαγράψει 3 walls.

---

## 1. Pre-fix State

### 1.1 Route handler (server side)

```ts
// src/app/api/audit-trail/record/route.ts  (pre-fix lines 108-119)
const entityDoc = await db.collection(collectionName).doc(body.entityId).get();
if (!entityDoc.exists) {
  throw new ApiError(404, `Entity not found: ${body.entityType}/${body.entityId}`);
}
const entityData = entityDoc.data();
const entityCompanyId = entityData?.companyId;
if (ctx.globalRole !== 'super_admin' && entityCompanyId && entityCompanyId !== ctx.companyId) {
  throw new ApiError(403, 'Access denied: entity belongs to a different company');
}
```

Race timeline για delete:
1. `useWallPersistence.deleteWall()` → `svc.deleteWall(wallId)` → Firestore doc τσακίζεται
2. `recordWallChange('deleted', ...)` → POST `/api/audit-trail/record`
3. Server ψάχνει `floorplan_walls/wallId` → `entityDoc.exists === false` → 404
4. Client `.catch(() => {})` καταπίνει το 404

### 1.2 Audit clients (5 files)

```ts
// src/subapps/dxf-viewer/bim/walls/wall-audit-client.ts  (pre-fix)
export function recordWallChange(
  action: WallAuditAction,
  entity: Pick<WallEntity, 'id' | 'kind'>,   // ← ΜΟΝΟ id + kind
  entityName?: string | null,
): void { ... }

function buildWallChanges(action, entity): AuditFieldChange[] {
  if (action === 'created') return [{ field: 'kind', oldValue: null, newValue: entity.kind }];
  if (action === 'deleted') return [{ field: 'kind', oldValue: entity.kind, newValue: null }];
  return [{ field: 'params', oldValue: null, newValue: null }];  // ← noise
}
```

Pattern repeat 5× (wall / opening / slab / column / beam) με σχεδόν πανομοιότυπες copy-paste implementations.

### 1.3 Persistence hooks

Όλα τα 5 hooks έκαναν: `void recordWallChange(isNew ? 'created' : 'updated', entity)` χωρίς ποτέ να περνούν previous state.

### 1.4 Comparison: Property/Building/Contact

Αυτές οι μη-BIM οντότητες είχαν ήδη το σωστό pattern μέσω `audit-tracked-fields.ts` + `diffTrackedFields()` SSoT (audit-diff.ts). BIM ήταν το outlier — όλα τα BIM clients είχαν "scaffolding" implementations που κανείς δεν επέστρεψε να ολοκληρώσει.

---

## 2. Architecture (Post-fix)

### 2.1 Server-side bypass (Phase A)

```ts
// route.ts (post-fix)
const entityDoc = await db.collection(collectionName).doc(body.entityId).get();
if (!entityDoc.exists) {
  if (body.action !== 'deleted') {
    throw new ApiError(404, ...);
  }
  // Action 'deleted' is recorded AFTER the entity is removed from
  // Firestore, so `!exists` is the normal case. Allow with caller's
  // companyId — defense-in-depth: a malicious caller can only pollute
  // their own tenant's audit trail, never cross-tenant.
} else {
  const entityCompanyId = entityDoc.data()?.companyId;
  if (ctx.globalRole !== 'super_admin' && entityCompanyId && entityCompanyId !== ctx.companyId) {
    throw new ApiError(403, ...);
  }
}
```

**Tenant safety:** ο audit row tag-άρεται πάντα με `ctx.companyId` (line 130). Ένας malicious caller μπορεί μόνο να πολλύνει το ΔΙΚΟ του audit trail με ψεύτικα IDs άλλων tenants — δεν διαρρέει cross-tenant data.

### 2.2 Tracked-fields registries (Phase B)

5 νέα registries στο `src/config/audit-tracked-fields.ts`:

- `WALL_TRACKED_FIELDS` (17 fields): category/height/thickness/flip/material/bindings/storey linkage/dna
- `COLUMN_TRACKED_FIELDS` (17 fields): kind/anchor/width/depth/height/rotation/material/catalogProfile/bindings/variant overrides
- `SLAB_TRACKED_FIELDS` (11 fields): kind/levelElevation/heightOffsetFromLevel/thickness/geometryType/slope/reinforcement
- `BEAM_TRACKED_FIELDS` (12 fields): kind/width/depth/topElevation/zOffset/material/supportType/sectionType/profileDesignation
- `OPENING_TRACKED_FIELDS` (15 fields): kind/wallId/offsetFromStart/width/height/sillHeight/handing/mark/markIsManual/tagVisible

**Excluded by design:** coordinate-heavy fields (`start`, `end`, `position`, `outline`, `polylineVertices`, `slope.direction…`). Παράγουν xyz triples σε κάθε grip drag και πνίγουν το history tab.

`getTrackedFieldsForEntityAuditType()` extended με 5 νέα cases.

### 2.3 Shared helper (Phase C)

Νέο SSoT module: `src/subapps/dxf-viewer/bim/utils/bim-audit-helpers.ts`

```ts
buildBimCreationChanges(snapshot, defs)  → diffTrackedFields({}, snapshot, defs)
buildBimUpdateChanges(prev, next, defs)  → diffTrackedFields(prev, next, defs)
buildBimDeletionChanges(snapshot, defs)  → reverse-iterate; emit oldValue=X, newValue=null per non-null tracked field
ensureNonEmptyChanges(changes, fallback) → server validator rejects [] with 400
```

Τα 3 audit-client patterns (create / update / delete) routed μέσω αυτού του ενός helper. Boy Scout: 5× duplicate `buildXxxChanges()` ⇒ 1 SSoT.

### 2.4 Audit-clients refactor (Phase C)

Νέα signature:

```ts
type WallAuditSnapshot = Pick<WallEntity, 'id' | 'kind'> & {
  readonly layerId?: string;
  readonly params?: Partial<WallEntity['params']>;
};

recordWallChange(
  action: WallAuditAction,
  entity: WallAuditSnapshot,
  options?: { entityName?: string | null; prevParams?: Partial<WallEntity['params']> | null },
): void
```

Routing:
- `created` → `buildBimCreationChanges` με fallback `{ field: 'kind', oldValue: null, newValue: kind }` αν empty
- `deleted` → `buildBimDeletionChanges` με fallback `{ field: 'kind', oldValue: kind, newValue: null }` αν empty
- `updated` με `!prevParams` → **skip POST** (no-op, σωστή semantics)
- `updated` με same params → **skip POST** (debounced auto-save fires on identical state συχνά)
- `updated` με real diff → POST changed fields only

### 2.5 Persistence hooks (Phase D)

5 hooks updated: `useWallPersistence`, `useColumnPersistence`, `useSlabPersistence`, `useBeamPersistence`, `useOpeningPersistence`.

Pattern σε κάθε `persist`:

```ts
const prevParams = lastSavedParamsRef.current.get(entity.id) ?? null;
const isNew = prevParams === null;
// ... save ...
void recordXxxChange(
  isNew ? 'created' : 'updated',
  entity,
  { prevParams: prevParams ?? undefined },
);
```

Pattern σε κάθε `deleteX`:

```ts
const deletedX = (deletedEntity && isX(deletedEntity)) ? deletedEntity : null;
// ... await svc.deleteX ...
void recordXxxChange('deleted',
  deletedX
    ? { id: deletedX.id, kind: deletedX.kind, layerId: deletedX.layerId, params: deletedX.params }
    : { id: xId, kind: 'fallback-kind' });
```

Snapshot ΠΑΝΤΑ captured BEFORE το `await svc.deleteX(...)` (ήδη υπήρχε pattern σε όλα τα hooks; απλώς τώρα περνάμε ολόκληρο το entity αντί για `{ id, kind }`).

### 2.6 Opening hook nuance

`useOpeningPersistence` έχει `lastKnownParams` που pulls είτε από `lastSavedParamsRef` είτε από `deletedEntity.params`. Πέρασμα `lastKnownParams ?? deletedOpening.params` ως `params` argument εξασφαλίζει πλήρες snapshot ακόμα και σε never-saved-locally openings.

---

## 3. Files changed

### New (2)
- `src/subapps/dxf-viewer/bim/utils/bim-audit-helpers.ts` — SSoT diff/build helpers (~110 lines)
- `docs/centralized-systems/reference/adrs/ADR-379-bim-entity-audit-coverage.md` — this ADR

### Modified (10)
- `src/app/api/audit-trail/record/route.ts` — delete bypass branch (Phase A)
- `src/config/audit-tracked-fields.ts` — 5 BIM registries + switch extension (Phase B)
- `src/subapps/dxf-viewer/bim/walls/wall-audit-client.ts` — new signature + diff routing (Phase C)
- `src/subapps/dxf-viewer/bim/walls/opening-audit-client.ts` — same
- `src/subapps/dxf-viewer/bim/columns/column-audit-client.ts` — same
- `src/subapps/dxf-viewer/bim/slabs/slab-audit-client.ts` — same
- `src/subapps/dxf-viewer/bim/beams/beam-audit-client.ts` — same
- `src/subapps/dxf-viewer/hooks/data/useWallPersistence.ts` — prevParams capture + delete snapshot (Phase D)
- `src/subapps/dxf-viewer/hooks/data/useColumnPersistence.ts` — same
- `src/subapps/dxf-viewer/hooks/data/useSlabPersistence.ts` — same
- `src/subapps/dxf-viewer/hooks/data/useBeamPersistence.ts` — same
- `src/subapps/dxf-viewer/hooks/data/useOpeningPersistence.ts` — same

### New tests (6)
- `src/subapps/dxf-viewer/bim/utils/__tests__/bim-audit-helpers.test.ts` — 12 tests
- `src/subapps/dxf-viewer/bim/walls/__tests__/wall-audit-client.test.ts` — 6 tests
- `src/subapps/dxf-viewer/bim/walls/__tests__/opening-audit-client.test.ts` — 3 tests
- `src/subapps/dxf-viewer/bim/columns/__tests__/column-audit-client.test.ts` — 3 tests
- `src/subapps/dxf-viewer/bim/slabs/__tests__/slab-audit-client.test.ts` — 3 tests
- `src/subapps/dxf-viewer/bim/beams/__tests__/beam-audit-client.test.ts` — 3 tests

**Total: 27/27 tests PASS** σε ~6.3s.

---

## 4. Manual verification (Phase A route bypass)

Route integration test απαιτεί `Request` polyfill που next/server consumes σε load-time — `@jest-environment node` pragma δεν τρέχει νωρίς αρκετά λόγω SWC. Manual verification flow:

1. Open DXF viewer, draw a wall, observe `entity_audit_trail` collection — `action: 'created'` row με `changes` array περιέχει `kind`, `height`, `thickness`, `category` (όχι `start`/`end`).
2. Edit wall thickness → `action: 'updated'` row με μόνο `{ field: 'thickness', oldValue: X, newValue: Y }`.
3. Edit wall με unchanged params (κλικ same value) → **no new audit row** (skip-on-no-diff).
4. Delete wall → `action: 'deleted'` row με `oldValue: 250, newValue: null` για thickness + όλα τα tracked fields (αυτό ήταν **τελείως απόν** pre-fix).
5. Repeat 1-4 για column / slab / beam / opening — όλα συμμετρικά.

---

## 5. Security model

Pre-fix το ownership check ήταν δίκοπο μαχαίρι: legitimate delete audit rows blocked, αλλά cross-tenant ID polluting blocked. Post-fix:

| Σενάριο | Pre-fix | Post-fix |
|---|---|---|
| Legitimate delete (self-tenant) | ❌ 404, audit lost | ✅ 200, audit recorded |
| Updated entity που λείπει (race) | ❌ 404 | ❌ 404 (still) |
| Foreign-tenant entity που υπάρχει | ❌ 403 | ❌ 403 (still) |
| Foreign-tenant entity που λείπει + action='deleted' | ❌ 404 | ⚠️ 200 + audit tagged με caller's companyId |

Το τελευταίο σενάριο είναι defense-in-depth, όχι data leak: ο audit row γράφεται στον companyId του caller, **όχι** στον companyId του "θύματος". Ο malicious user πολλύνει μόνο το δικό του audit trail.

---

## 6. SSoT Ratchet implications

- **CHECK 3.17 (Entity Audit Coverage):** baseline unchanged (70 files). Τα 5 BIM audit-clients ήδη μετρούσαν ως "covered" από τον scanner (καλούσαν `recordXxxChange`), απλά το payload ήταν incomplete. Static analysis δεν μπορεί να εντοπίσει payload-quality issues — runtime-only bug.
- **Νέο module candidate:** Το `bim-audit-helpers.ts` είναι Tier 3 (BIM-scoped SSoT). Add σε `.ssot-registry.json` ως:
  ```json
  "bim-audit-helpers": {
    "tier": 3,
    "canonicalPaths": ["src/subapps/dxf-viewer/bim/utils/bim-audit-helpers.ts"],
    "forbiddenPatterns": [
      "buildWallChanges\\(",
      "buildColumnChanges\\(",
      "buildSlabChanges\\(",
      "buildBeamChanges\\(",
      "buildOpeningChanges\\("
    ]
  }
  ```
  Forbids return of the legacy per-type helpers.

---

## 7. Changelog

- **2026-05-27** — Initial ADR. Phases A→E shipped same day. ADR + cross-refs (Phase F) pending commit.
- **2026-05-27 (later)** — **Follow-up: ADR-380** ολοκληρώνει το audit coverage για τα τελευταία 2 BIM entity types (`stair` + `slab-opening`) που έμειναν εκτός scope. Live verification αυτής της συνεδρίας αποκάλυψε ότι (a) stair δεν είχε καθόλου audit-client / registry / type union entry, (b) slab-opening είχε placeholder pattern (mirror του Bug #2). Bundled commit ADR-379 + ADR-380 μαζί. 7/7 BIM entities audit-covered.

---

## Cross-refs

- ADR-195 §3.2 — Centralized audit endpoint architecture
- ADR-195 §4 — TrackedFieldDef pattern + diffTrackedFields SSoT
- ADR-363 §5.17 — BIM audit clients (initial scaffolding; this ADR completes them)
- ADR-380 — Stair + Slab-Opening audit coverage (follow-up, same session)
- ADR-294 — SSoT Ratchet enforcement (CHECK 3.7 / 3.17 / 3.18)
