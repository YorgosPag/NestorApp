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

> ⚠️ **v1.2 supersedes the reset-only approach below** — see §2.5. The bare reset proved
> **incomplete**: the load effect re-runs on every `levels` onSnapshot and re-opened the target
> (sync set) *after* the async reset, leaving a window where an edit still threw ADR-293.

### 2.5 FIX (Β v1.2) — orphaned-target latch (SSoT, idempotent)
**Incident 2026-06-17 (follow-up):** ADR-293 `canonicalScenePath is required` still fired for the
same `file_80efad96…` floor. Root cause of the residual throw: the FIX (Β) reset is **transient**,
but the auto-save target is **re-opened synchronously** at the top of the load effect (`if
(sceneFileId) setFileRecordId/setCurrentFileName`) **before** the async `loadFileV2` proves the
file is orphaned — and that effect re-runs on each `levels` snapshot. So the target keeps
re-pointing at the orphaned `fileRecordId`, and the resolve block fabricates a new id with no
canonical path → throw.

**Decision — a single source of truth for "this fileId has no DXF scene target":**
- New SSoT latch in `useAutoSaveSceneManager`: a `Set<fileId>` ref (`orphanedFileTargetsRef`)
  with `markFileTargetOrphaned(fileId)` (writer) + `isFileTargetOrphaned(fileId)` (reader). A
  **ref, not state** → marking never re-renders (ADR-040 auto-save-storm / micro-leaf safe).
- **Belt #1 (gate):** the auto-save gate adds
  `&& !orphanedFileTargetsRef.has(injectedFileRecordIdRef ?? '')` — a latched target never
  schedules a save.
- **Belt #2 (resolve safety net):** when the debounced resolve has a **known** `fileId` but
  `getFileStoragePath(fileId)` → null (backing doc gone), it `markFileTargetOrphaned(fileId)` +
  `setSaveStatus('idle')` + **returns** (skip) instead of falling through to the ADR-293 throw.
  Narrow by design: only fires for an injected id with no storagePath — never the legit
  new-standalone path (`fileId` unknown → `generateFileId`), so a genuine first save is never
  suppressed.
- **Loader primary fix (`useLevelSceneLoader`):** the sync set re-opens the target only when
  `sceneFileId && !isFileTargetOrphaned(sceneFileId)`; a known-orphaned floor short-circuits to
  the file-less branch (empty-scene-preserving-BIM) — no re-open, no wasteful repeat
  `loadFileV2`. The async "scene not found" branch calls `markFileTargetOrphaned(sceneFileId)`
  **before** the reset, so the latch is set the first time and every later re-run is suppressed.

**Belt-and-suspenders (N.7.2):** primary = an orphaned floor never acquires a DXF auto-save
target; safety net = the resolve dead-ends to skip+latch, not throw. Idempotent, zero race.
The latch is session-scoped and cleared by `resetSceneSession` (super-admin tenant switch).

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
**v1.1 (2026-06-17)** — coverage extended to **all** renderable BIM kinds. The registry now
holds **22** kinds, plus `wall` + `opening` as a co-located special case = **24** one-shot
`getAll` per snapshot-less floor:
`column, beam, slab, roof, stair, foundation, floor-finish, thermal-space, space-separator,
slab-opening, railing, furniture, floorplan-symbol, electrical-panel, mep-fixture, mep-segment,
mep-fitting, mep-manifold, mep-radiator, mep-boiler, mep-water-heater, mep-underfloor` (registry)
\+ `wall` + `opening` (special case).

**How the v1.0 «deferred» kinds were unblocked:**
- The 13 private converters (slab-opening, railing, furniture, floorplan-symbol,
  electrical-panel, the full MEP equipment set) were **extracted** from their persistence hooks
  into co-located pure modules `hooks/data/<kind>-persistence-helpers.ts` (mirror of the
  structural `column/beam/slab/roof` helper splits). Each hook re-imports its converter (call
  sites unchanged) — behavior-preserving. Then a 1-line `makeLoader(...)` registry add.
- `opening` is a **special case** (host-wall dependency, `params.wallId`): `wall` is pulled out
  of the registry and fetched explicitly by `loadFloorWalls` so the same wall set serves both as
  scene entities AND as the host lookup for `loadFloorOpenings` (no duplicate `getAll`). An
  opening whose host wall is absent hydrates to `null` (converter contract) and is dropped.

**Still excluded by design:**
- `mep-system` — a logical network entity, not a scene `Entity` (never rendered).

## 3. Consequences

- ✅ **All** renderable BIM kinds (structural + openings + MEP equipment + decorative) on a
  file-less / orphaned floor render in «all floors» 2Δ & 3Δ even when never visited this session
  (v1.1 — was structural-only in v1.0).
- ✅ No vanishing on reload; no ADR-293 error spam.
- ✅ No new realtime subscriptions; cost only on snapshot-less floors, cached.
- ✅ The 13 converter extractions are pure SSoT splits — the persistence hooks shrink, the
  converter logic is now reusable by both the hook and the cross-floor loader (zero duplication).
- ⚠️ Snapshot floors keep snapshot-sourced (possibly stale) BIM — unchanged behavior; the
  per-entity-SSoT-for-snapshot-floors path is out of scope.

## 4. Files

**Modified**
- `src/subapps/dxf-viewer/systems/levels/hooks/useLevelSceneLoader.ts` — FIX (Α)+(Β)+(Β v1.2 latch).
- `src/subapps/dxf-viewer/hooks/data/useFloors3DAggregator.ts` — FIX (Γ) 3Δ wiring.
- `src/subapps/dxf-viewer/hooks/data/useBuildingFloorScenes.ts` — FIX (Γ) 2Δ wiring.

**Modified (v1.2 — orphaned-target latch SSoT)**
- `src/subapps/dxf-viewer/hooks/scene/useAutoSaveSceneManager.ts` — `orphanedFileTargetsRef`
  Set + `markFileTargetOrphaned`/`isFileTargetOrphaned`, gate belt #1, resolve belt #2,
  `resetSceneSession` clears the latch.

**New (v1.2)**
- `src/subapps/dxf-viewer/hooks/scene/__tests__/useAutoSaveSceneManager-orphaned-target.test.ts`
  — 3 jest (gate belt, resolve safety-net, file-linked regression).

**New**
- `src/subapps/dxf-viewer/bim/persistence/cross-floor-bim-loader.ts` — loader SSoT + registry.
- `src/subapps/dxf-viewer/bim/persistence/__tests__/cross-floor-bim-loader.test.ts` — 5 jest.

**New (v1.1 — extracted pure converters, co-located with their hooks)**
- `hooks/data/slab-opening-persistence-helpers.ts`, `railing-persistence-helpers.ts`,
  `furniture-persistence-helpers.ts`, `floorplan-symbol-persistence-helpers.ts`,
  `electrical-panel-persistence-helpers.ts`, `mep-fixture-persistence-helpers.ts`,
  `mep-segment-persistence-helpers.ts`, `mep-fitting-persistence-helpers.ts`,
  `mep-manifold-persistence-helpers.ts`, `mep-radiator-persistence-helpers.ts`,
  `mep-boiler-persistence-helpers.ts`, `mep-water-heater-persistence-helpers.ts`,
  `mep-underfloor-persistence-helpers.ts` — 13 `<kind>DocToEntity` pure converters.

**Modified (v1.1 — re-import the extracted converter, remove the local one)**
- `cross-floor-bim-loader.ts` — +13 registry loaders + `wall`/`opening` special case.
- `hooks/data/useSlabOpeningPersistence.ts`, `useRailingPersistence.ts`,
  `useFurniturePersistence.ts`, `useFloorplanSymbolPersistence.ts`,
  `useElectricalPanelPersistence.ts`, `useMepFixturePersistence.ts`,
  `useMepSegmentPersistence.ts`, `useMepFittingAutoReconciliation.ts`,
  `useMepManifoldPersistence.ts`, `useMepRadiatorPersistence.ts`,
  `useMepBoilerPersistence.ts`, `useMepWaterHeaterPersistence.ts`,
  `useMepUnderfloorPersistence.ts` — 13 hooks.

**Tests touched**
- `systems/levels/__tests__/scene-bim-load-policy.test.ts` — +3 (empty-load preservation).
- `hooks/data/__tests__/useFloors{3DAggregator,2DUnderlay}.test.ts` — useAuth + loader mocks.

## 5. Changelog
- **v1.2 (2026-06-17)** — Orphaned-target **latch SSoT** (residual ADR-293 throw on the same
  `file_80efad96…` floor). FIX (Β) reset-only was incomplete: the load effect re-opened the
  auto-save target synchronously on every `levels` snapshot before the async orphaned-detection.
  New `orphanedFileTargetsRef` Set in `useAutoSaveSceneManager` + `markFileTargetOrphaned`/
  `isFileTargetOrphaned`; gate belt #1 (latched id never schedules), resolve belt #2 (known id
  with no storagePath → skip+latch, not throw); loader re-opens target only when not-latched +
  short-circuits known-orphaned floors + latches in the async branch. Ref/Set → no re-render
  (ADR-040-safe). +3 jest (8 total in the two autosave suites). UNCOMMITTED.
- **v1.1 (2026-06-17)** — Coverage extended to **all** renderable BIM kinds. Extracted the 13
  private `docToEntity` converters (slab-opening, railing, furniture, floorplan-symbol,
  electrical-panel, full MEP equipment set) into co-located pure
  `hooks/data/<kind>-persistence-helpers.ts` modules (each hook re-imports — behavior-preserving)
  + 13 registry loaders. Added `opening` as a host-aware special case (`wall` fetched explicitly,
  reused as host lookup → no duplicate `getAll`). Registry 10 → 24 covered kinds. Loader test
  4 → 5 (added opening host-filter). UNCOMMITTED.
- **v1.0 (2026-06-17)** — Initial: FIX (Α) anti-vanish load, FIX (Β) ADR-293 suppress, FIX (Γ)
  per-entity cross-floor loader (10 kinds) + both aggregators. 24 jest GREEN (20 policy + 4
  loader) + aggregator regressions. UNCOMMITTED.
- **v1.3 (2026-07-26)** — 🐛 **Το per-entity fallback δεν έτρεχε ΠΟΤΕ σε ορόφους με κάτοψη DXF.**
  **Σύμπτωμα:** στο «Όλοι οι όροφοι» έλειπαν οι κολώνες ορόφων που ο χρήστης δεν είχε επισκεφθεί.
  **Root cause — λάθος ερώτηση, σωστός μηχανισμός.** Ο `useFloors3DAggregator` ρωτούσε δύο φορές
  `scene.entities.length > 0`, δηλαδή **«έχει κάτι;»**, ενώ οι all-floors καταναλωτές χρειάζονται
  **«έχει BIM;»**. Μια in-memory σκηνή ορόφου μπορεί να είναι **μόνο-DXF**: το
  `reconcileLoadedSceneBim(Preserving)` (ADR-390 Φ4) πετά το BIM του snapshot στο load ως παράγωγο
  cache, και τα per-entity subscriptions που το ξαναγεμίζουν είναι δεμένα στον **ενεργό** όροφο.
  Άρα ένας όροφος με κάτοψη DXF **έμοιαζε γεμάτος** → ο lazy-fetch τον έκοβε από τη λίστα `missing`
  ΚΑΙ το `resolveEntities` προτιμούσε την άδεια σκηνή αντί του snapshot → ούτε snapshot ούτε
  per-entity fallback έτρεχε ποτέ. Οι δύο καταναλωτές ρωτούσαν την ίδια λάθος ερώτηση σε **δύο**
  σημεία, οπότε καμία ασυμφωνία δεν πρόδιδε το λάθος.
  **FIX:** νέο `hasAnyBim3DEntity(entities)` στο `extract-bim3d-entities.ts` — pure + total, παράγεται
  από τα **ίδια κλειδιά** που γεννά το `extractBim3DEntities` (`Object.values`), ΟΧΙ από χειρόγραφη
  λίστα slices: νέο BIM slice καλύπτεται αυτόματα και δεν μπορεί να ξεχαστεί (ίδια εγγύηση με το
  `EMPTY_BIM_ENTITIES`). Στον aggregator, ένα `resolveInMemoryBim` callback τροφοδοτεί **και τους δύο**
  καταναλωτές, ώστε να ρωτούν εξ ορισμού την ίδια ερώτηση. Η in-memory σκηνή προηγείται μόνο όταν
  όντως κουβαλάει BIM· αλλιώς snapshot → per-entity (ο `loaded` guard κρατά την προσπάθεια one-shot
  ακόμη κι όταν γυρίσει κενή).
  **Tests:** νέο `useFloors3DAggregator.bim-source.test.ts` (3): μόνο-DXF σκηνή → ζητά snapshot·
  in-memory BIM → ΔΕΝ ζητά· χωρίς BIM πουθενά → μία μόνο προσπάθεια. 10/10 GREEN στα δύο suites.

- **2026-07-26 (ADR-714 — ο orphaned-target latch συνυπάρχει με το Save Ticket)** — Το v1.2 belt #2 («injected fileId χωρίς storagePath → latch + skip αντί για throw ADR-293») **διατηρείται ακέραιο**, αλλά το read που το τροφοδοτεί άλλαξε: από `getFileStoragePath(fileId)` σε `getFileFloorScope(fileId)` — **ένα** `getDoc` που απαντά ΚΑΙ «πού γράφω» (`storagePath`) ΚΑΙ «σε ποιον ανήκει» (`entityType`/`entityId`), ώστε το ίδιο read να τροφοδοτεί και τον cross-floor φρουρό του ADR-714 χωρίς δεύτερο round-trip ανά save. Το `getFileStoragePath` παραμένει ως thin delegate. Η συμπεριφορά latch+skip είναι αμετάβλητη (test `useAutoSaveSceneManager-orphaned-target.test.ts` πράσινο, με ενημερωμένο mock). Το belt #1 (gate) δεν αγγίχτηκε. Σημείωση: ο `isDxfWipe` του ADR-714 είναι **ανεξάρτητο** στρώμα — ο latch προστατεύει από εγγραφή σε **ανύπαρκτο** στόχο, ο `isDxfWipe` από **καταστροφική** εγγραφή σε υπαρκτό.
