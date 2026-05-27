# ADR-380 — Stair + Slab-Opening Audit Coverage

| Πεδίο | Τιμή |
|---|---|
| **Status** | ✅ **DONE** 2026-05-27 — All phases shipped, pending commit |
| **Date** | 2026-05-27 |
| **Category** | DXF Viewer — Persistence / Audit Trail |
| **Location** | `docs/centralized-systems/reference/adrs/ADR-380-stair-slab-opening-audit-coverage.md` |
| **Author** | Claude Sonnet 4.6 + Γιώργος Παγώνης |
| **Companions** | ADR-379 (BIM entity audit coverage — wall/column/slab/beam/opening), ADR-195 (Entity Audit Trail master), ADR-358 §6.1 (Stair persistence), ADR-363 §11.Q3 (Slab-opening persistence), ADR-294 (SSoT Ratchet) |
| **Industry alignment** | Mirror ADR-379 pattern — Revit Worksharing / ArchiCAD Teamwork audit log per-parameter delta |

---

## Summary

Δύο BIM entity types που έμειναν εκτός ADR-379 (verification live 2026-05-27 αποκάλυψε το gap):

1. **`stair`** — **ZERO audit coverage**. `use-stair-persistence.ts` έκανε save/delete απευθείας μέσω `StairFirestoreService` χωρίς ποτέ να καλεί audit endpoint. Δεν υπήρχε `stair-audit-client.ts`, δεν υπήρχε `STAIR_TRACKED_FIELDS` registry, και το route validator (`/api/audit-trail/record`) απέρριπτε `entityType: 'stair'` με 400 (όχι στο `VALID_ENTITY_TYPES` set). Επιπλέον το `AuditEntityType` union στο `src/types/audit-trail.ts` δεν περιελάμβανε `'stair'`.
2. **`slab-opening`** — **partial audit coverage** (placeholder pattern). Το `slab-opening-audit-client.ts` υπήρχε αλλά έγραφε μόνο `[{ field: 'kind', oldValue: X, newValue: Y }]` — το ίδιο "scaffolding" pattern που έσπρωξε το ADR-379 για τα άλλα 5 BIM entities. Δεν χρησιμοποιούσε το `diffTrackedFields` SSoT helper, δεν περνούσε `prevParams` για update diff, δεν είχε `SLAB_OPENING_TRACKED_FIELDS` registry. Επίσης δεν είχε καμία test suite (όλα τα άλλα audit-clients έχουν).

Άρα μετά το ADR-380: **7/7 BIM entity types audit-covered** (wall, column, slab, beam, opening, **stair**, **slab-opening**).

---

## 1. Pre-fix State

### 1.1 Type union missing `'stair'`

```ts
// src/types/audit-trail.ts (pre-fix)
export type AuditEntityType =
  | 'contact' | 'building' | ... | 'wall' | 'opening' | 'slab' | 'slab-opening'
  | 'column' | 'beam'
  // ← 'stair' λείπει
  | 'performance_diagnostic' | ...;
```

### 1.2 Route validator rejecting stair

```ts
// src/app/api/audit-trail/record/route.ts (pre-fix)
const VALID_ENTITY_TYPES: ReadonlySet<string> = new Set<AuditEntityType>([
  'contact', 'building', 'property', 'project', 'parking', 'storage',
  'wall', 'opening', 'slab', 'slab-opening', 'column', 'beam',
  // ← 'stair' λείπει
]);
```

POST με `entityType: 'stair'` → 400 `Invalid entityType`.

### 1.3 Stair persistence — zero audit calls

```ts
// src/subapps/dxf-viewer/bim/hooks/use-stair-persistence.ts (pre-fix persist)
const persist = useCallback(async (entity: StairEntity) => {
  // ...
  await svc.saveStair(entityToSaveInput(entity));
  lastSavedParamsRef.current.set(entity.id, entity.params);
  // ← καμία recordStairChange κλήση
}, [acquireLock]);
```

Όλο το stair lifecycle (create / update / delete) απουσίαζε από το audit trail.

### 1.4 Slab-opening placeholder pattern

```ts
// src/subapps/dxf-viewer/bim/slab-openings/slab-opening-audit-client.ts (pre-fix)
function buildChanges(action, entity): AuditFieldChange[] {
  if (action === 'created') return [{ field: 'kind', oldValue: null, newValue: entity.kind }];
  if (action === 'deleted') return [{ field: 'kind', oldValue: entity.kind, newValue: null }];
  return [{ field: 'params', oldValue: null, newValue: null }];  // ← noise
}
```

Συμμετρικό με το ADR-379 root bug — μόνο `kind` εγγραφή χωρίς dimensional fields (slabId / fireRating / material / sceneUnits).

---

## 2. Architecture (Post-fix)

### 2.1 Type + route enablement (Phase A)

- `src/types/audit-trail.ts` — προστέθηκε `| 'stair'` στο union.
- `src/app/api/audit-trail/record/route.ts` — προστέθηκε `'stair'` στο `VALID_ENTITY_TYPES` set + entry `stair: COLLECTIONS.FLOORPLAN_STAIRS` στο `ENTITY_COLLECTION_MAP`. Το delete-bypass branch του ADR-379 ισχύει αυτόματα.

### 2.2 Tracked-fields registries (Phase B)

Δύο νέα registries στο `src/config/audit-tracked-fields.ts`:

**`STAIR_TRACKED_FIELDS` (~28 fields):**
- Dimensional scalars: `rise`, `tread`, `nosing`, `nosingSide`, `width`, `stepCount`, `totalRise`, `totalRun`, `pitch`
- Structure / code: `structureType`, `riserType`, `codeProfile`, `nokSubType`, `antiskidNosing`, `adaContrastStrip`, `cutPlaneHeight`, `occupancyLoad`
- Walkline / direction: `walklineOffset`, `upDirection`
- Tread labelling: `treadNumberStart`, `treadLabelDisplay`, `treadLabelEveryN`, `treadLabelRestartPerFlight`, `treadLabelHeight`
- Storey FK: `storeyId`, `offsetFromStorey`
- Common: `kind`, `layerId`
- Nested JSON scalars: `variant`, `multiStoryConfig`, `stringerParams`, `materials`, `handrails`

**`SLAB_OPENING_TRACKED_FIELDS` (8 fields):**
- `kind`, `layerId`, `slabId`, `elevationOverride`, `multiStoreyStackGroupId`, `fireRating`, `material`, `sceneUnits`

**Excluded by design** (mirror ADR-379 policy):
- Stair: `basePoint`, `direction` (coord triples), `perTreadOverrides` (would explode payload per-tread)
- Slab-opening: `outline` (Polygon3D coord stream — noise per grip drag)

`getTrackedFieldsForEntityAuditType()` extended με `case 'stair'` + `case 'slab-opening'`.

### 2.3 Audit-clients (Phase C)

**NEW** `src/subapps/dxf-viewer/bim/stairs/stair-audit-client.ts` — full mirror του `beam-audit-client.ts` (ADR-379 canonical pattern):
- `StairAuditSnapshot = Pick<StairEntity, 'id' | 'kind'> & { layerId?; params? }`
- `recordStairChange(action, snapshot, options?)` με optional `prevParams`
- Routing μέσω `buildBimCreationChanges` / `buildBimUpdateChanges` / `buildBimDeletionChanges` (SSoT από `bim-audit-helpers.ts`)

**REFACTOR** `src/subapps/dxf-viewer/bim/slab-openings/slab-opening-audit-client.ts` — placeholder pattern → SSoT pattern:
- Νέα signature: `recordSlabOpeningChange(action, snapshot, options?)` (3-arg, options με `prevParams`)
- Ίδιες 3 routing branches μέσω helpers
- Παλιό 2-arg signature `recordSlabOpeningChange(action, entity, entityName?)` αντικαταστάθηκε — `useSlabOpeningPersistence` ενημερώθηκε.

### 2.4 Persistence hooks (Phase D)

**`use-stair-persistence.ts`:**
- `persist`: capture `prevParams = lastSavedParamsRef.current.get(entity.id) ?? null` πριν το `svc.saveStair(...)`, fire `recordStairChange(isNew ? 'created' : 'updated', { id, kind, layerId, params }, { prevParams })` μετά το save.
- `deleteStair`: snapshot capture πριν `svc.deleteStair(...)`, fire `recordStairChange('deleted', { id, kind, layerId, params }, ...)` με fallback `{ id, kind: 'straight' }` αν το entity δεν βρεθεί στο scene.

**`useSlabOpeningPersistence.ts`:**
- `persist`: ίδιο pattern με stair — capture `prevParams`, pass στο options.
- `deleteSlabOpening`: capture full entity snapshot, pass `{ id, kind, layerId, params }` (όχι μόνο `{ id, kind }`).

### 2.5 SSoT registry update (Phase E)

`.ssot-registry.json` — `bim-audit-helpers` module επεκτάθηκε:
- Description: 5 entities → 7 entities (added stair + slab-opening, cross-ref ADR-380)
- Forbidden patterns: +2 (`buildStairChanges`, `buildSlabOpeningChanges`)
- `addedByAdr`: "ADR-379, ADR-380"

---

## 3. Files changed

### New (3)
- `src/subapps/dxf-viewer/bim/stairs/stair-audit-client.ts` — ~95 lines
- `src/subapps/dxf-viewer/bim/stairs/__tests__/stair-audit-client.test.ts` — 4 tests
- `src/subapps/dxf-viewer/bim/slab-openings/__tests__/slab-opening-audit-client.test.ts` — 4 tests
- `docs/centralized-systems/reference/adrs/ADR-380-stair-slab-opening-audit-coverage.md` — this ADR

### Modified (6)
- `src/types/audit-trail.ts` — `+ | 'stair'` σε `AuditEntityType`
- `src/app/api/audit-trail/record/route.ts` — VALID_ENTITY_TYPES + ENTITY_COLLECTION_MAP
- `src/config/audit-tracked-fields.ts` — `STAIR_TRACKED_FIELDS` + `SLAB_OPENING_TRACKED_FIELDS` + switch
- `src/subapps/dxf-viewer/bim/slab-openings/slab-opening-audit-client.ts` — placeholder → SSoT
- `src/subapps/dxf-viewer/bim/hooks/use-stair-persistence.ts` — recordStairChange wiring (persist + delete)
- `src/subapps/dxf-viewer/hooks/data/useSlabOpeningPersistence.ts` — prevParams + full snapshot on delete
- `.ssot-registry.json` — bim-audit-helpers description / forbidden patterns / addedByAdr

---

## 4. Verification

Live verification (mirror ADR-379 protocol) εκκρεμεί — ο user πρόσθεσε stair + slab-opening σε localhost:3000 dev server. Έπειτα η επιβεβαίωση:

```
mcp__firestore__firestore_count collection='floorplan_stairs'
mcp__firestore__firestore_count collection='floorplan_slab_openings'
mcp__firestore__firestore_query collection='entity_audit_trail' filter entityType='stair'
mcp__firestore__firestore_query collection='entity_audit_trail' filter entityType='slab-opening'
```

Επιβεβαίωση: count 0↔1 με add/delete, audit rows created+deleted με tracked fields, source='service', companyId σωστό, `basePoint`/`direction`/`outline` absent.

Tests: 4 stair + 4 slab-opening + 27 ADR-379 = 35 total stable.

---

## 5. Changelog

| Date | What |
|---|---|
| 2026-05-27 | ADR-380 created. All Phase A-E shipped (type union + route + tracked fields + audit-clients + hooks wiring + ssot registry). Pending commit bundled με ADR-379. |

---

## 6. Cross-references

- ADR-195 §3.4 — Entity Audit Trail master (recordChange contract)
- ADR-294 — SSoT Ratchet (`bim-audit-helpers` module Tier 3)
- ADR-358 §6.1 — Stair Firestore persistence (collection `floorplan_stairs`)
- ADR-363 §11.Q3 — Slab-opening persistence (collection `floorplan_slab_openings`)
- ADR-379 — Original BIM audit coverage fix (5 entities)
