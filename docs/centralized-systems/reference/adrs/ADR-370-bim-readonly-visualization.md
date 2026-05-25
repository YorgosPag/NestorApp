# ADR-370 — BIM Read-Only Visualization in Properties Floorplan Tab

- **Status**: ✅ IMPLEMENTED
- **Date**: 2026-05-20
- **Author**: Giorgio Pagonis + Claude (Opus 4.7)
- **Related**: ADR-040 (Preview Canvas Performance), ADR-294 (SSoT Ratchet), ADR-356 (Tenant SSoT), ADR-361 (Firestore Subscribe Equality Guard), ADR-363 (BIM Drawing Mode), ADR-366 (3D BIM Viewer)
- **Scope**: Properties subapp read-only floorplan tab — show BIM entities (`walls`, `slabs`, `beams`, `columns`, `openings`, `slab-openings`, `stairs`) drawn in the DXF Viewer subapp. **Phase 5 (2026-05-25)**: 3D stair coverage parity (read-only + `/dxf/viewer` 3D toggle).
- **Impact**: 🟢 Additive — new render layer, no schema/persistence changes.

---

## 1. Context

Ο χρήστης σχεδιάζει BIM entities (τοίχοι, πλάκες, δοκάρια, κολόνες, κουφώματα, διανοίξεις πλάκας, σκάλες) στον `/dxf/viewer` (DXF Viewer subapp). Αυτά persistάρουν σωστά σε Firestore (`floorplan_walls`, `floorplan_slabs`, `floorplan_beams`, `floorplan_columns`, `floorplan_openings`, `floorplan_slab_openings`, `floorplan_stairs`), scoped by `(companyId, projectId, floorplanId)` per ADR-363 §5.10 / ADR-358 §6.1.

Όμως στο read-only floorplan tab του Properties subapp στο URL pattern `/properties?view=floorplan&selected=<propertyId>&mediaTab=floorplan-floor` **δεν εμφανίζονται**. Ο χρήστης εύλογα περιμένει να βλέπει τα BIM στοιχεία που σχεδίασε.

### 1.1 Root cause

Δύο εντελώς ξεχωριστά render pipelines:

1. **DXF Viewer subapp** (`src/subapps/dxf-viewer/`): έχει τους class-based BIM renderers (`WallRenderer`, `SlabRenderer`, `BeamRenderer`, `ColumnRenderer`, `OpeningRenderer`, `SlabOpeningRenderer`) που κάνουν extend `BaseEntityRenderer` και χρησιμοποιούν `CoordinateTransforms.worldToScreen` (με `COORDINATE_LAYOUT.MARGINS` offset).
2. **Properties read-only floorplan tab** (`src/components/shared/files/media/FloorplanGallery.tsx`): χρησιμοποιεί `floorplan-dxf-renderer.ts` που ζωγραφίζει **μόνο raw DXF geometry** (lines/polylines/arcs/circles/text) + `floorplan-overlay-system.ts` για unit selection polygons. Καμία αναφορά στα BIM collections, κανένα import από τους BIM renderers.

Render chain στο Properties tab:
```
PropertiesPageContent → ReadOnlyMediaViewer → FloorFloorplanTabContent
  → FloorplanGallery → floorplan-dxf-renderer + floorplan-overlay-system
```

Επιπλέον τα δύο pipelines χρησιμοποιούν **διαφορετικό coordinate transform**:
- `renderDxfToCanvas`: `screenX = (worldX - bounds.min.x) * scale + offsetX`, `screenY = (bounds.max.y - worldY) * scale + offsetY`, με `offsetX/Y = (canvas.size - drawing*scale)/2 + panOffset` και `scale = min(canvas.w/dW, canvas.h/dH) * zoom`. Κανένα margin.
- `CoordinateTransforms.worldToScreen`: `screenX = MARGINS.left + worldX * scale + transform.offsetX`, `screenY = (viewport.height - MARGINS.top) - worldY * scale - transform.offsetY`. Με `MARGINS.left = MARGINS.top = 30px` για rulers (που στο Properties tab δεν υπάρχουν).

Άρα ακόμη και αν περάσει κανείς ίδιο `scale`, οι BIM renderers θα ζωγραφίζουν μετατοπισμένα κατά `(30, 30)` pixels.

---

## 2. Decision

**Façade layer** στο Properties pipeline που:

1. **Subscribes** στα 6 BIM Firestore collections by `floorplanId` (μέσω `firestoreQueryService.subscribe`, με auto-applied `companyId` constraint από ADR-356 tenant SSoT, και ADR-361 equality guard + δεύτερο layer hash compare με `dequal`).
2. **Hydrates** τα Firestore docs σε scene entities καλώντας τα ίδια SSoT `computeXxxGeometry()` που χρησιμοποιεί ο DXF Viewer. Καμία αντιγραφή geometry logic.
3. **Builds a synthetic `ViewTransform`** που εξουδετερώνει το `COORDINATE_LAYOUT.MARGINS` offset, ώστε οι BIM renderers να ζωγραφίζουν στο ακριβές pixel space του `renderDxfToCanvas`.
4. **Calls `render(entity, { grips: false, hovered: false })`** στους υπάρχοντες BIM renderers — read-only, no edit affordances. Καμία αντιγραφή renderer logic.
5. **Inserts the BIM render pass** στο `useFloorplanCanvasRender` ανάμεσα στο `renderDxfToCanvas` και στο `drawOverlayPolygons`. Z-order: DXF geometry → BIM entities → unit selection polygons (selection UI πάντα πάνω).

### 2.1 Synthetic transform math

Έστω `bounds`, `canvas.{width,height}`, `zoom`, `panOffset` που χρησιμοποιεί `renderDxfToCanvas`:

```
drawingWidth  = bounds.max.x - bounds.min.x
drawingHeight = bounds.max.y - bounds.min.y
baseScale     = min(canvas.w / drawingWidth, canvas.h / drawingHeight)
scale         = baseScale * zoom
dxfOffsetX    = (canvas.w - drawingWidth  * scale) / 2 + panOffset.x
dxfOffsetY    = (canvas.h - drawingHeight * scale) / 2 + panOffset.y
```

Synthetic `ViewTransform` που ταυτίζει `CoordinateTransforms.worldToScreen` με `renderDxfToCanvas`:

```
transform.scale   = scale
transform.offsetX = dxfOffsetX - bounds.min.x * scale - MARGINS.left
transform.offsetY = canvas.h - MARGINS.top - bounds.max.y * scale - dxfOffsetY
viewport          = { width: canvas.w, height: canvas.h }
```

Η math ζει σε ένα μέρος (`buildBimViewTransform()`). Καμία αλλαγή στους renderers ή στο `CoordinateTransforms`.

### 2.2 Data scope & link

- **Query key**: `where('floorplanId', '==', floorplanId)` μόνο. Tenant `companyId` constraint αυτόματα από `firestoreQueryService` (ADR-294 / ADR-356).
- **`floorplanId` source**: `FloorplanGallery.currentFile.id` (= `FileRecord.id` του εκάστοτε floorplan). Συμβατό με `DxfViewerTopBar.tsx`'s `levelManager.fileRecordId`.
- **Synthetic fallback guard**: αν `floorplanId` ταιριάζει `/^floor_floorplan_/` (synthetic id από `adaptFloorFloorplanToFileRecord` όταν δεν υπάρχει `fileRecordId`), το hook επιστρέφει `EMPTY_SNAPSHOT` χωρίς subscriptions. Σωστή συμπεριφορά: όταν δεν υπάρχει πραγματικό `FileRecord.id`, δεν μπορεί να υπάρχουν BIM entities (το `floorplanId` δεν υπήρχε όταν σχεδιάστηκαν).

### 2.3 Rationale (alternatives considered)

| Alternative | Why rejected |
|---|---|
| Embed DxfViewer canvas σε iframe μέσα στο Properties tab | Cross-frame complexity· σπάει SSoT isolation· υπερβολικό για read-only. |
| Duplicate τους BIM renderers σε `src/components/shared/files/media/` | SSoT violation (ADR-294)· διπλό maintenance· memory rule "3D mirrors 2D SSoT" παραβιάζεται. |
| Extract pure render functions από τους renderers (geometry-only) | Rework × 6 entity types χωρίς όφελος έναντι του façade· χάνεις και τα phase-based styles. |

Φάκαδα = reuse + zero duplication + minimum touchpoints.

---

## 3. Consequences

### Θετικά

- BIM entities ορατά στο Properties read-only viewer χωρίς edit affordances (read-only by design).
- Reuse renderers + geometry + persistence services (ADR-294 SSoT preserved).
- Zero coupling proliferation στο DXF Viewer subapp· το Properties pipeline μένει αυτόνομο.
- ADR-040 compliance: ο φάκαδος δεν προσθέτει state σε hot path· `FloorplanGallery` δεν είναι μέρος της DXF Viewer micro-leaf αρχιτεκτονικής.

### Όρια

- **Read-only**: edit BIM entities γίνεται μόνο από το `/dxf/viewer`. Phase 2 αν ζητηθεί.
- **No layer filter UI** στο Properties tab — όλα τα BIM entities ορατά. Phase 2 (εύκολη προσθήκη μέσω props).
- **No hover affordance** για BIM entities (`hovered: false` πάντα στους renderers). Phase 2 αν ζητηθεί.

### Performance

6 subscriptions ανά floorplan view. Διπλό equality guard (ADR-361 service-level + consumer hash compare) εξουδετερώνει spurious re-renders. Renderer instances δημιουργούνται per render call — lightweight canvas state machine, αμελητέο cost για << 1000 entities.

---

## 4. File impacts

### Νέα αρχεία

| Path | Ρόλος |
|---|---|
| `src/components/shared/files/media/bim-canvas-transform.ts` | Pure `buildBimViewTransform()` — synthetic ViewTransform/Viewport bridge. |
| `src/components/shared/files/media/bim-readonly-hydration.ts` | Pure `hydrateWall/Slab/Beam/Column/Opening/SlabOpening/Stair()` — docs → entities via SSoT geometry functions. |
| `src/components/shared/files/media/useFloorplanBimEntities.ts` | Hook: 7 παράλληλα Firestore subscriptions (Phase 4 +stairs) με equality guard + memoized hydration. |
| `src/components/shared/files/media/bim-readonly-render.ts` | Façade: instantiates BIM renderers (Phase 4 +StairRenderer), sets synthetic transform, calls `render()` no-grips/no-hover. |
| `src/subapps/dxf-viewer/bim-3d/converters/StairToThreeConverter.ts` | **Phase 5** — `stairToMeshes()` 5 sub-builders (treads/risers/stringers/handrails/landings). |
| `src/subapps/dxf-viewer/bim-3d/materials/stair-material-resolver.ts` | **Phase 5** — Revit-pattern per-component material chain + 2D preset → 3D PBR bridge. |
| `src/subapps/dxf-viewer/app/StairPersistenceHost.tsx` | **Phase 5** — feeds `currentScene` stairs στο `Bim3DEntitiesStore` (mirror του `SlabPersistenceHost`). |
| `docs/centralized-systems/reference/adrs/ADR-370-bim-readonly-visualization.md` | Αυτό το ADR. |

### Modified αρχεία

| Path | Αλλαγή |
|---|---|
| `src/components/shared/files/media/useFloorplanCanvasRender.ts` | + `bimEntities?: FloorplanBimSnapshot \| null` param. Renders BIM ανάμεσα σε DXF και overlays. |
| `src/components/shared/files/media/floorplan-gallery-config.ts` | + `floorplanId?: string \| null` στο `FloorplanGalleryProps`. |
| `src/components/shared/files/media/FloorplanGallery.tsx` | Καλεί `useFloorplanBimEntities`, περνά `bimEntities` σε inline + modal render hooks. |
| `src/features/read-only-viewer/components/ReadOnlyMediaSubTabs.tsx` | `FloorFloorplanTabContent` passes `floorplanId={files[0]?.id ?? null}` στο `FloorplanGallery`. |
| `.ssot-registry.json` | + module `bim-readonly-render` (Tier 3) — forbidden `new (Wall\|Slab\|Beam\|Column\|Opening\|SlabOpening)Renderer(` outside `src/subapps/dxf-viewer/` και του façade. |
| `src/subapps/dxf-viewer/bim-3d/stores/Bim3DEntitiesStore.ts` | **Phase 5** — `stairs: readonly StairEntity[]` + `setStairs` setter στο interface, `selectBim3DEntities` includes stairs. |
| `src/subapps/dxf-viewer/bim-3d/materials/MaterialCatalog3D.ts` | **Phase 5** — 5 νέα PBR entries `elem-stair-{tread,riser,stringer,landing,handrail}` + `getElementMaterial3D` union extended. |
| `src/subapps/dxf-viewer/bim-3d/scene/BimSceneLayer.ts` | **Phase 5** — 5ο loop για `entities.stairs` που καλεί `stairToMeshes()` και προσθέτει multi-mesh στο group. |
| `src/subapps/dxf-viewer/bim-3d/viewport/BimViewport3D.tsx` | **Phase 5** — `EMPTY_BIM_ENTITIES.stairs = []` + initial sync destructuring + subscribe pushes `s.stairs`. |
| `src/components/shared/files/media/Bim3DReadOnlyOverlay.tsx` | **Phase 5** — `useMemo` deps + `stairs: bimSnapshot.stairs`. |
| `src/subapps/dxf-viewer/app/DxfViewerTopBar.tsx` | **Phase 5** — mount `<StairPersistenceHost currentScene={currentScene} />`. |

---

## 5. Verification

### Visual smoke test

1. Άνοιξε `/dxf/viewer`, φόρτωσε floorplan ενός project, σχεδίασε από έναν 6 BIM entities (τοίχο, πλάκα, δοκάρι, κολόνα, κούφωμα σε τοίχο, διάνοιξη πλάκας).
2. Auto-save 500ms (ADR-363 §5.10).
3. Άνοιξε `/properties?view=floorplan&selected=<propertyId>&mediaTab=floorplan-floor` για property που χρησιμοποιεί την ίδια `floorplanId`.
4. Verify: όλα τα BIM entities εμφανίζονται στις σωστές θέσεις, ίδιο pixel space με DXF geometry, χωρίς grips ή hover affordances. Unit overlay polygons πάνω από τα BIM fills.

### Type/lint

- `npx tsc --noEmit` — background run.
- `npm run lint -- src/components/shared/files/media/`.
- `npm run ssot:audit` — verify το νέο `bim-readonly-render` module προστέθηκε σωστά.

---

## 6. Changelog

| Date | Change |
|---|---|
| 2026-05-20 | Initial implementation. Façade + transform bridge + hook + 4 modified files + SSoT registry entry. |
| 2026-05-20 | **Phase 2 wiring** — single-level `floorplan-floor` branch in `ReadOnlyMediaViewer.tsx` (γρ. 283-297) δεν περνούσε `floorplanId` prop στο `FloorplanGallery`. Στο URL `?view=floorplan&selected=<propertyId>&mediaTab=floorplan-floor` (single-level property) ο `FloorplanGallery` έπεφτε στο fallback `currentFile?.id` που, σε περιπτώσεις legacy floorplan χωρίς `fileRecordId` (π.χ. αμετάβατο entry στο `files` collection), παρήγαγε synthetic id `floor_floorplan_*` → `SYNTHETIC_FLOORPLAN_PREFIX` guard στο `useFloorplanBimEntities.isQueryable()` → `EMPTY_SNAPSHOT` → καμία BIM render. Fix: explicit `floorplanId={floorFloorplansData.files[0]?.id ?? null}` (mirror του `FloorFloorplanTabContent` pattern). Multi-file branches (`floorplans` unit single-level, `UnitFloorplanTabContent`) παραμένουν στο `currentFile?.id` fallback γιατί ο index αλλάζει per navigation — εκεί το fallback είναι το σωστό δυναμικό SSoT. |
| 2026-05-20 | **Phase 3 diagnosis + fix** — μετά τα Phase 1+2, οι BIM entities παρέμεναν αόρατες στο Properties tab παρά τα σωστά subscriptions. Διάγνωση: temporary diagnostic logs στο `useFloorplanBimEntities` εκτύπωσαν `[bim-readonly][error] code: "permission-denied"` σε όλα 6 collections. Cause: τα Firestore rules για τα 6 `floorplan_*` collections (που είχαν προστεθεί στον commit `05275d03` ADR-363 Phase 0) **ΔΕΝ είχαν deployed** στο production Firestore — μόνο το local `firestore.rules` αρχείο τα είχε. Auth token claims verified σωστά (`globalRole: super_admin`, `companyId: pzNUy8ksddGCtcQMqumR`). Fix: `firebase deploy --only firestore:rules --project pagonis-87766`. Μετά το deploy, τα 5/6 subscriptions επέστρεψαν `count: 0` (κανονικά — προηγουμένως δεν υπήρχαν persisted docs), και μετά από σχεδίαση walls στο `/dxf/viewer` οι τοίχοι εμφανίστηκαν σωστά στο read-only Properties canvas. Diagnostic logs αφαιρέθηκαν (production noise). **Verification finding**: τα `floorplan_*` collections αρχικά δεν υπήρχαν στο Firestore Console γιατί το test DB ήταν wiped — οι BIM persistence hosts (`WallPersistenceHost` κ.λπ.) στο `DxfViewerTopBar` λειτουργούν σωστά εφόσον `companyId && projectId && floorplanId && userId` είναι όλα present (guard στο `useWallPersistence.ts:165`). |
| 2026-05-25 | **Phase 4 — stair coverage extension**. Bug report: Giorgio σχεδίασε BIM σκάλα στο `/dxf/viewer` σε floor-plan, εμφανιζόταν εκεί κανονικά αλλά **όχι** στο Properties read-only canvas (`?view=floorplan&mediaTab=floorplan-floor`) ούτε στο Buildings → tab Όροφοι → expanded floor DXF preview (που μοιράζονται το ίδιο `FloorplanGallery` pipeline). Root cause: ο façade hook `useFloorplanBimEntities` κάλυπτε μόνο 6 collections — `FLOORPLAN_STAIRS` δεν υπήρχε καθόλου, και ο `bim-readonly-render` δεν είχε `StairRenderer`. Walls/slabs/beams/columns δούλευαν επειδή ήταν στα 6 από Phase 1. **Σκάλες ήταν totally invisible** σε όλα τα read-only canvases. Fix (3 αρχεία, additive): (1) `bim-readonly-hydration.ts` — `hydrateStair(doc)` που inlineάρει το legacy params hydration από `use-stair-persistence` (l-shape `cornerStyle` default `'landing'`, `nokSubType: 'secondary'` → `'low-rise'`), re-deriveάρει geometry μέσω SSoT `computeStairGeometry(params)` (ADR-358 §G6: geometry NOT persisted). (2) `useFloorplanBimEntities.ts` — προστέθηκε `FLOORPLAN_STAIRS` στο union του `useGuardedDocs<T>`, νέο `stairsRes` subscription, `stairs` field στο `FloorplanBimSnapshot`, μετράται στο `isLoading`/`hasAny`/`useMemo` deps. (3) `bim-readonly-render.ts` — instantiate `StairRenderer`, `setTransform(transform)`, render loop `for (const stair of snapshot.stairs) stairRenderer.render(stair, READONLY_OPTIONS)`. Δεν χρειάστηκε Firestore composite index — η ίδια query shape `where('companyId') + where('floorplanId')` δουλεύει για walls/slabs/beams/columns χωρίς explicit index (Firestore index-merging για multi-equality). Verified με Firestore MCP: η σκάλα `stair_a630d20e-f024-...` έχει `floorplanId: file_214e2453-...`, `floorId: flr_f64e9699-...`, `companyId: comp_9c7c1a50-...`, `kind: 'straight'`, full `params + validation`. 3D coverage extension followed σε Phase 5. |
| 2026-05-25 | **Phase 5 — 3D stair coverage parity** (ADR-371 read-only 3D + `/dxf/viewer` 3D toggle). Gap diagnosis: το 2D read-only stack είχε plain stair coverage μετά την Phase 4, αλλά ο 3D pipeline κάλυπτε μόνο 4 entity types (walls/columns/beams/slabs). `Bim3DEntities` interface δεν είχε `stairs` field, ο `BimToThreeConverter` δεν είχε `stairToMesh`, ο `BimSceneLayer.sync` δεν είχε 5ο loop, και το `Bim3DReadOnlyOverlay` δεν περνούσε snapshot.stairs. Σκάλες ήταν invisible σε 3D Properties tab + 3D toggle στο `/dxf/viewer`. Fix (3 νέα αρχεία, 6 modified): **(A)** `Bim3DEntitiesStore.ts` — `stairs: readonly StairEntity[]` + `setStairs` + `selectBim3DEntities` includes stairs. **(B)** `MaterialCatalog3D.ts` — 5 νέα PBR entries `elem-stair-{tread,riser,stringer,landing,handrail}` (Revit-aligned: wood treads, concrete risers/landings, metal stringers/handrails) + `getElementMaterial3D` union extended με `Stair3DComponent`. **(C)** `stair-material-resolver.ts` *(νέο)* — Revit-pattern fallback chain (per-tread override → stair.params.materials.X → element default), bridge από 2D presets ('oak'→`mat-wood`, 'marble'→`mat-stone`, 'concrete'→`mat-concrete`, 'steel'→`mat-metal`, 'glass'→`mat-glass`, 'terrazzo'/'tile' mapping). **(D)** `StairToThreeConverter.ts` *(νέο)* — `stairToMeshes(stair, floorElevationMm, levelId, buildingBaseElevationM)` με 5 sub-builders: treads (`ExtrudeGeometry` per polygon, depth 40mm), risers (`BoxGeometry`, μόνο όταν `riserType='closed'`), stringers (`BoxGeometry` segments κατά μήκος `geometry.stringers.{inner,outer}`, μόνο για `structureType ∈ stringer-1side/2side/central-stringer`), handrails (`TubeGeometry` radius 25mm από `walkline`-based offsets σε ύψος `handrails.height ?? 900mm`, μόνο όταν `handrails.inner/outer=true`), landings (`ExtrudeGeometry` per polygon, depth 200mm). Skip `arrowSymbol`/`cutLine`/`treadLabels` (2D-only). Each mesh tagged με `userData.{bimId,bimType,stairComponent,matId,levelId,buildingId}`. **(E)** `BimSceneLayer.ts` — 5ο loop για `entities.stairs` που καλεί `stairToMeshes()` και προσθέτει multi-mesh στο group. **(F)** `BimViewport3D.tsx` — `EMPTY_BIM_ENTITIES.stairs = []` + initial sync destructuring + ongoing subscribe pushes `s.stairs`. **(G)** `Bim3DReadOnlyOverlay.tsx` — `useMemo` deps + `stairs: bimSnapshot.stairs`. **(H)** `StairPersistenceHost.tsx` *(νέο)* — mirror του `SlabPersistenceHost` pattern, πιέζει `currentScene.entities.filter(isStairEntity)` στο `Bim3DEntitiesStore.setStairs()`. **(I)** `DxfViewerTopBar.tsx` — mount `<StairPersistenceHost currentScene={currentScene} />`. Industry alignment: Revit/ArchiCAD pattern για multi-component stair material assignment (per-component override + material library SSoT). Default thicknesses από industry references (Revit tread 40mm, riser 20mm, landing 200mm, handrail 25mm tube radius). |
| 2026-05-25 | **Phase 5.3 — Riser orientation + position bugfix (diagonal Segment3D convention)**. Bug report: σε ευθύγραμμη σκάλα τα ρίχτρια εμφανίζονταν ΠΑΡΑΛΛΗΛΑ στον άξονα διεύθυνσης αντί ΚΑΘΕΤΑ. Root cause: όλοι οι 12 `build*Risers` builders εκπέμπαν `Segment3D` με `start.xy === end.xy` σε ένα EDGE του riser (όχι midpoint, καμία orientation info). Ο `buildRiserBox` στο `StairToThreeConverter` έφτιαχνε `BoxGeometry(thickness, rise, width)` με width axis πάντα κατά τον world Z (καμία rotation) και κεντράρισε το mesh στο corner αντί στο midpoint — έτσι το riser ήταν shifted κατά `halfW` έξω από το tread footprint ακόμη και για direction=0, και τελείως λάθος orientation για direction ≠ 0 (αλλά και για curved kinds όπου ο width axis είναι radial/chord-perp). Fix (13 αρχεία): νέα DIAGONAL convention για `StairGeometry.risers` — `start` = corner A @zLow σε μία width edge, `end` = OPPOSITE corner B @zHigh στην άλλη edge. Το xy diagonal κουβαλά midpoint, width axis, ΚΑΙ width magnitude σε ένα segment, χωρίς να χρειάζεται downstream να consult `params.direction/width`. **(A)** Updated 12 builders (1 σε `StairGeometryService.ts` + 11 σε `stair-geometry-*.ts` για lshape/ushape/gamma/vshape/winder/spiral/helical/elliptical/sketch/triangular-fan/triangular-outline). Για straight/rectilinear: `end = (cx + v·width, cy + v·width, zHigh)` αντί `(cx, cy, zHigh)`. Για helical: `end = radialPoint(outerRadius, ...)` αντί `(innerRadius, ...)`. Για spiral/fan: `start = apex` αντί outer edge. Για elliptical/sketch: `start/end` σε opposite chord-perp edges. Για outline: `slice.a → slice.b`. **(B)** `StairToThreeConverter.buildRiserBox` — derives `widthM`, `midXScene`, `midYScene` από `(seg.end - seg.start).xy`, applies `mesh.rotation.y = atan2(dxScene, -dyScene)` για world Y rotation (DXF Y → world -Z mapping). Removed unused `widthM` param from `buildRiserMeshes`. **(C)** `bim/types/stair-types.ts` — `Segment3D` interface JSDoc αναλυτικά τη diagonal convention για risers (cutLine παραμένει plain segment). **(D)** Updated `StairGeometryService-straight.test.ts` Test 3 από "vertical risers" σε "diagonal risers (xy = width, Δz = rise)" + midpoint centerline check. Other geometry tests μόνο count assertions — safe. Transform tests (`bim-mirror-geometry`, `bim-rotate-geometry`) χρησιμοποιούν `risers: []` fixtures — safe. Single 3D consumer (`StairToThreeConverter:113`); δεν υπάρχει 2D consumer (ADR-358 §6.2 line 650 spec ήταν unimplemented). New convention strictly better — supports future 2D `drawLine(start, end)` σαν visible footprint. |
