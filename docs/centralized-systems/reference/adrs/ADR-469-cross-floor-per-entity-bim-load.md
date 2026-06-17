# ADR-469 — Cross-Floor Per-Entity BIM Load (file-less / orphaned floors)

> **Status:** ✅ APPROVED (implemented, UNCOMMITTED) — 2026-06-17
> **Scope:** DXF Viewer · scene load policy · cross-floor aggregation · BIM persistence
> **Relates:** ADR-390 Φ4 (active-floor SSoT load, `reconcileLoadedSceneBim`), ADR-399 (multi-floor aggregators), ADR-420 (BIM floor-scope SSoT, durable `floorId`), ADR-459 Φ7 (foundation model-SSoT cross-level), ADR-293 (canonical scene path)

---

## 1. Context / Problem

Incident 2026-06-17 — «η κολώνα εμφανίζεται και εξαφανίζεται». In the Ground floor the user
imported a DXF floorplan, **deleted all DXF entities**, then placed BIM columns on the empty
canvas. Two symptoms:

1. **Vanishing columns** — after reload a column flashed, then disappeared.
2. **`canonicalScenePath is required (ADR-293)`** console error on every column placement.

### Root causes (diagnosed)
- The floor's `sceneFileId` (`file_80efad96…`) is **orphaned** — its `files`/`cadFiles` doc is
  gone (`getFileStoragePath` → null), so `loadFileV2` returns no scene.
- **#1 vanish**: every load-time "empty scene" write in `useLevelSceneLoader` used a bare
  `createEmptyScene()`. A late async "scene not found" clobbered BIM that the per-entity
  subscription (`useColumnPersistence`, keyed by `floorId`) had already merged in-memory.
- **#2 error**: the auto-save target stayed pointed at the orphaned `fileRecordId` (no
  canonical path) → every local edit threw ADR-293.
- **Cross-floor gap**: the all-floors aggregators (`useFloors3DAggregator` 3Δ +
  `useBuildingFloorScenes` 2Δ) read other floors' BIM **only** from the `.scene.json` snapshot.
  A **file-less** floor (no DXF ever, only BIM) or an **orphaned** floor has no snapshot → its
  BIM is invisible in «Όλοι οι όροφοι» (except in-session, where in-memory `getLevelScene`
  covers it).

The columns themselves were never lost — they are correctly persisted in `floorplan_columns`
keyed by `floorId` (the durable ADR-420 scope). The defect is purely **load / cross-floor
render**.

## 2. Decision

Three coordinated fixes (FULL SSoT, Revit-grade), all reusing existing infrastructure.

### 2.1 FIX (Α) — anti-vanish load (`useLevelSceneLoader`)
Every load-time "empty scene" write goes through the BIM-preservation SSoT
`reconcileLoadedSceneBim(createEmptyScene(), getLevelScene(level))` (ADR-390 Φ4), via a local
`setEmptyScenePreservingBim()` helper. All 5 branches (no-file / dup / cross-floor /
scene-not-found / catch) use it. A late "scene not found" can no longer wipe BIM merged by a
per-entity subscription. **No new function** — the preservation helper already existed.

### 2.2 FIX (Β) — graceful auto-save suppress (`useLevelSceneLoader`)
On an orphaned / missing-scene load (the `else` + `catch` branches) call the existing
`resetDxfAutoSaveTarget()` — exactly as the cross-floor branch already did. `fileRecordId` →
null disables the auto-save gate → **zero ADR-293 throw**. BIM persists independently via its
`floorId`-keyed per-entity collections. No fake file is fabricated (rejected the "heal cadFile"
road — wrong abstraction for a file-less floor).

### 2.3 FIX (Γ) — per-entity cross-floor BIM source (file-less / orphaned floors)
New SSoT `bim/persistence/cross-floor-bim-loader.ts`:
- A **registry** of per-kind one-shot loaders, each reusing the kind's already-exported
  `docToEntity` converter + `firestoreQueryService.getAll` + `buildBimScopeConstraints`
  (ADR-420). Tenant `companyId` is auto-applied by `getAll`.
- `loadFloorBimEntities(scope)` fetches all covered kinds for one floor (by `floorId`,
  durable scope) and returns merged scene entities. A failing kind degrades to `[]`.

This generalizes the ADR-459 Φ7 foundation model-SSoT pattern to **all** structural BIM kinds,
but **one-shot** (not realtime) → no per-floor subscription explosion; only a floor *without a
valid snapshot* pays the cost, and the result is cached by the aggregator.

Both aggregators are wired identically: the lazy fetch now includes floors **without** a
`sceneFileId`, and falls back to `loadFloorBimEntities` whenever `loadFileV2` yields no scene.
The existing `foundation-level-store` (realtime, ADR-459 Φ7) is untouched; foundation footings
are still overridden authoritatively downstream.

### 2.4 Covered kinds (extensible registry)
Kinds with an already-exported, self-contained converter that are scene `Entity`s (10):
`column, wall, beam, slab, roof, stair, foundation, floor-finish, thermal-space,
space-separator`.

**Deferred** (require refactoring before inclusion — each is a 1-line registry add once done):
- `opening` — converter needs the host wall entity (cross-doc dependency).
- `slab-opening, railing, furniture, floorplan-symbol, electrical-panel,
  mep-fixture/segment/fitting/manifold/radiator/boiler/water-heater/underfloor` — converters are
  private inside their persistence hooks (need exporting).
- `mep-system` — a logical network entity, not a scene `Entity` (never rendered); excluded by design.

## 3. Consequences

- ✅ Columns (and all covered kinds) on a file-less / orphaned floor render in «all floors» 2Δ
  & 3Δ even when never visited this session.
- ✅ No vanishing on reload; no ADR-293 error spam.
- ✅ No new realtime subscriptions; cost only on snapshot-less floors, cached.
- ⚠️ Deferred kinds (openings, MEP equipment, decorative) still rely on the snapshot for unvisited
  snapshot-less floors — tracked for follow-up (export converters + registry add).
- ⚠️ Snapshot floors keep snapshot-sourced (possibly stale) BIM — unchanged behavior; the
  per-entity-SSoT-for-snapshot-floors path is out of scope.

## 4. Files

**Modified**
- `src/subapps/dxf-viewer/systems/levels/hooks/useLevelSceneLoader.ts` — FIX (Α)+(Β).
- `src/subapps/dxf-viewer/hooks/data/useFloors3DAggregator.ts` — FIX (Γ) 3Δ wiring.
- `src/subapps/dxf-viewer/hooks/data/useBuildingFloorScenes.ts` — FIX (Γ) 2Δ wiring.

**New**
- `src/subapps/dxf-viewer/bim/persistence/cross-floor-bim-loader.ts` — loader SSoT + registry.
- `src/subapps/dxf-viewer/bim/persistence/__tests__/cross-floor-bim-loader.test.ts` — 4 jest.

**Tests touched**
- `systems/levels/__tests__/scene-bim-load-policy.test.ts` — +3 (empty-load preservation).
- `hooks/data/__tests__/useFloors{3DAggregator,2DUnderlay}.test.ts` — useAuth + loader mocks.

## 5. Changelog
- **v1.0 (2026-06-17)** — Initial: FIX (Α) anti-vanish load, FIX (Β) ADR-293 suppress, FIX (Γ)
  per-entity cross-floor loader (10 kinds) + both aggregators. 24 jest GREEN (20 policy + 4
  loader) + aggregator regressions. UNCOMMITTED.
