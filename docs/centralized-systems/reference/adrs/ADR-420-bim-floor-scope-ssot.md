# ADR-420 — BIM Floor-Scope SSoT (stable `floorId`, not volatile `floorplanId`)

- **Status:** Accepted — implemented 2026-06-07
- **Supersedes scope of:** ADR-399 (floor navigation) for BIM persistence keying
- **Related:** ADR-179 (IFC floor hierarchy), ADR-237 (level↔floor link), ADR-355 (subscribe SSoT), ADR-363 (BIM drawing mode), ADR-395 (per-floor BOQ)

## Context / Problem

The «Εισαγωγή Κάτοψης» wizard imports a floor plan onto a selected building floor.
A user reported: importing onto **floor #2 made all BIM entities of floor #1
disappear**. «Κάθε όροφος πρέπει να είναι ανεξάρτητος.»

**Firestore diagnosis (project `proj_cfe6f430…`, company `comp_9c7c1a50…`):** no data
was lost — all 50 walls still existed, all carrying the stable level reference
`layerId = lvl_b798d67c` (floor #1, `floorId = flr_bbd663ce`). But they were
scattered across **3 different `floorplanId` values** (3 file-record generations),
while floor #1's level pointed at a 4th `sceneFileId`. The walls were **orphaned**.

**Root cause:** all 20 BIM persistence services subscribed with
`where('floorplanId','==', this.config.floorplanId)`, where `floorplanId` ===
`levelManager.fileRecordId` — the cadFiles id of the *currently loaded DXF file*,
**regenerated on every re-import**. Every re-import re-pointed the subscription at a
new (empty) file id, orphaning everything previously drawn on that floor. The stable
building-storey id (`floorId`, IfcBuildingStorey) was stored on docs (optional) but
**never used as the query key**.

## Decision

Scope every BIM entity by the **stable `floorId`** (building storey), not the volatile
`floorplanId`. `floorId` survives re-import, file re-upload and level delete+recreate
(unlike `floorplanId` and `layerId`/`levelId`, which are both volatile). `floorplanId`
is retained on documents as **provenance** (which physical DXF file the entity came
from), never again as the scope key.

### SSoT
A single module owns the scope definition — ending the 20× `where('floorplanId',…)`
copy-paste:

`src/subapps/dxf-viewer/bim/persistence/bim-floor-scope.ts`
- `resolveBimScope(cfg)` → `{ key:'floorId', value } | { key:'floorplanId', value }`
  (prefers `floorId`; falls back to `floorplanId` for project/building-level canvases
  that have no storey).
- `buildBimScopeConstraints(cfg)` → the `where(...)` array every `subscribe*` uses.
- `bimScopeWriteFields(cfg)` → `{ floorplanId, floorId? }` every `save*` spreads.

## Rollout (additive → backfill → flip, zero-downtime)

1. **Dual-write** `floorId` on every BIM `save*` (provenance `floorplanId` kept). Thread
   `floorId` from the single chokepoint `app/DxfViewerTopBar.tsx` (already resolves it
   3-tier: saveContext → linked Level → FLOORS doc) → all 20 `*PersistenceHost` → hooks →
   service configs.
2. **Indexes** — added `[companyId, projectId, floorId]` + `[projectId, floorId]` for all
   20 BIM collections (`firestore.indexes.json`, CHECK 3.15).
3. **Backfill** — `scripts/migrations/backfill-bim-floor-scope.mjs` derives `floorId` for
   every legacy doc from `layerId`→`dxf_viewer_levels[levelId].floorId` (stairs: `levelId`;
   fallback `floorplanId`→`sceneFileId`→`floorId`). Idempotent, dry-run by default. This
   recovers the orphaned walls (unifying the 3 fileRecordId generations under one floorId).
4. **Flip** — all 20 `subscribe*` now use `buildBimScopeConstraints(this.config)` (one SSoT).

### Outliers
- **stairs** — level ref field is `levelId` (not `layerId`); scope migrated identically.
- **mep_systems** — logical network; `floorId` added to `MepSystemDoc`; backfill resolves
  it via the `floorplanId`→`sceneFileId` fallback only.

## Wizard targeting fix (ADR-399 follow-up)
`ui/components/LevelPanel.tsx` `onComplete` now resolves the level that owns the selected
floor via `systems/levels/level-floor-resolution.ts` `findOrCreateLevelForFloor`
(find-or-create by `floorId`), `setCurrentLevel(target)`, and threads an explicit
`targetLevelId` through `onSceneImported → handleFileImportWithEncoding → handleFileImport`
(race-free), so the import writes to the selected floor's level — never the active one.

## Consequences
- ✅ Re-import never orphans BIM entities; floors are truly independent.
- ✅ Full SSoT — scope key defined once; 20 services delegate.
- ✅ `firestore.rules` unchanged (BIM rules use `hasAll`, not `hasOnly`; `floorId` already permitted; not immutable).
- ⚠️ Requires the backfill to run once in each environment before legacy docs resolve under the new key.

## Verification
- `tsc --noEmit` clean (3 pre-existing errors unrelated: mesh-to-object3d:124, DeleteEntityCommand:52, drawing-preview-generator:116).
- `bim-floor-scope.test.ts` (7) + `stair-firestore-service.test.ts` (22) pass.
- Browser: floor #1 re-shows its walls after backfill; import onto floor #2 keeps floor #1; re-import same floor loses nothing.

## Changelog
- 2026-06-07 — Initial: SSoT module, 20-service flip to `floorId`, 40 indexes, backfill script, wizard targeting fix.
- 2026-06-07 — **Replace-wipe semantics (keep vs full replace).** Because BIM is scoped to the durable `floorId`, a plain floorplan **re-import keeps the model** (by design — you don't lose your walls). A **replace** that swaps the file/scene therefore leaves the old BIM as orphans rendering on the new plan. Resolution: the wizard now asks — **«Διατήρηση BIM»** (default) vs **«Διαγραφή όλων»**. Full replace hard-wipes every floor-scoped BIM collection + `bim-auto` BOQ via the NEW `bim-floor-wipe.service` (driven by the NEW `FLOOR_SCOPED_BIM_COLLECTIONS` SSoT in `firestore-collections.ts`, the TS mirror of `scripts/migrations/backfill-bim-floor-scope.mjs`). Catalog collections (`bim_presets/materials/settings/family_types`, `stair_presets`) are company/project-scoped and excluded. See ADR-340 changelog (2026-06-07) for the full file list.
- 2026-06-16 — **Write-once extended to `createdAt` + `displayName`, and real `layerCount` on auto-save (incident: DXF-viewer entity-delete auto-save corrupted the `files` doc).** Follow-up to the same-day write-once fix below. A DB/Storage baseline test of the delete→auto-save path found `writeToFilesCollection` (`dual-write-to-files.ts`) still mutated three more fields on EVERY merge-update: (1) `createdAt: serverTimestamp()` written unconditionally → with `merge:true` the creation time was overwritten on every save (immutability violation; `createdAt===updatedAt` after any edit); (2) `displayName` regenerated via `buildFileDisplayName` every save → the auto-save context (category default `'drawings'`, `entityLabel=fileName`) clobbered the wizard's "Κατόψεις Ορόφου - <label>" (and any user rename) with "drawings - <file>"; (3) `sceneStats.layerCount`/`parseTimeMs` hardcoded to `0` → zeroed the wizard's real values. **Fix (same write-once principle):** `createdAt` and `displayName` are now written ONLY on `isCreate` (merge preserves them on update); real `layerCount` is threaded from the scene (`Object.keys(scene.layersById).length`) through the payload chain (`dxf-firestore-storage.impl` → `cad-file-mutation-gateway` `UpsertCadFilePayload` → `cad-files.schemas` zod → `cad-files.handlers` → `DualWriteParams`), and `parseTimeMs` is omitted on auto-save so `merge:true` preserves the wizard's value instead of zeroing it. The wizard create path is a separate server writer (unaffected). +4 jest in `dual-write-to-files.test.ts` (8 total).
- 2026-06-17 — **Subscription effect re-binds on `floorId` change (incident: footing + column vanish after repeated floor toggles).** Follow-up to the same-day gate fix below. The service-INSTANTIATION effect keyed on `[…, floorplanId, floorId, userId]` (recreates `serviceRef.current` when the durable `floorId` resolves), but the SUBSCRIPTION effect keyed on `[currentLevelId, …, floorplanId, userId]` — **`floorId` was missing**. So when returning to a floor whose `floorId` resolved on a later render than `currentLevelId`/`floorplanId` settled, the service was re-created for the correct `floorId` scope but the live `onSnapshot` subscription stayed bound to the stale/null previous service → its first snapshot had an empty doc set → the ADR-390 reconcile loop dropped the in-scene BIM entities (not in docs, not dirty/pending) → the DXF scene fast-path then froze the BIM-less scene for all future returns (permanent in-session loss). **Fix:** add `floorId` to the subscription effect dep array in all 12 BIM persistence hooks that lacked it (`useFoundationPersistence`, `useColumnPersistence`, `useBeam/Wall/Slab/SlabOpening/Opening/Railing/Roof/SpaceSeparator/ThermalSpace/FloorFinishPersistence`) so the subscription re-binds to the freshly-created service whenever the resolved scope changes — aligning it with the instantiation effect. (Boy-Scout: also added the missing `beamDocToEntity` import in `useBeamPersistence` — a pre-existing broken file-split.)
- 2026-06-16 — **Persistence-ready gate centralized (`resolveBimPersistenceScope`) + write-once file identity (incident: column/BIM not persisting on a cross-linked floor).** The query side was already `floorId`-scoped (2026-06-07), but the **service-instantiation gate** was still 26× copy-pasted as `if (!companyId || !projectId || !floorplanId || !userId)` — and `floorplanId` = `levelManager.fileRecordId`, the VOLATILE save target the ADR-399 cross-floor guard nulls (`useLevelSceneLoader.resetDxfAutoSaveTarget`). So a floor whose own DXF file was cross-linked de-instantiated every BIM persistence service → entities drawn there were never saved (lost on reload). **Fix:** new SSoT `resolveBimPersistenceScope` in `bim-floor-scope.ts` — requires identity (`companyId`/`projectId`/`userId`) + at least ONE scope key (`floorId` preferred, `floorplanId` fallback); mirrors `floorId` into the provenance slot so the per-entity service configs (`floorplanId: string`) stay valid unchanged. Wired into all 26 persistence hooks (kills the copy-paste). `DxfViewerTopBar` now derives `projectId` from the durable `Level` doc (`currentLevel?.projectId`, ADR-309), not only the volatile `saveContext`. **Root data corruption** (the trigger): `dual-write-to-files.ts` re-derived `entityType`/`entityId`/`projectId` from the per-save `context.floorId` on EVERY merge-update → a stale `saveContext.floorId` overwrote a floor file's `entityId` with another floor's id (storagePath stayed correct → `isCrossFloorSceneLink` false-positive). Now those identity fields are **write-once** (`isCreate` flag from the handler). Healing migration `scripts/migrations/heal-floor-file-entityid.ts` (run via `tsx`) corrects `entityId` from the immutable `storagePath` for any already-drifted floor file — reusing the canonical `parseStoragePath()` SSoT (ADR-293), not a bespoke regex. See ADR-399 changelog (2026-06-16).
