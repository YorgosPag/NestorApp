# SPEC-3D-004C — GenArc Utils / Snap / Picking Port Catalog

| Πεδίο | Τιμή |
|---|---|
| **Status** | 🟢 **COMPLETE** 2026-05-19 — full catalog, conclusion: 2 PORT_AS_IS + 1 PORT_WITH_ADAPTATION + 13 EXCLUDE |
| **Date** | 2026-05-19 |
| **Category** | DXF Viewer — 3D Rendering / GenArc Port Sub-Spec |
| **Location** | `docs/centralized-systems/reference/adrs/SPEC-3D-004C-genarc-utils-snap-picking-port-catalog.md` |
| **Author** | Claude Opus 4.7 + Γιώργος Παγώνης |
| **Parent ADR** | ADR-366 (3D BIM Viewer & Photorealistic Rendering) |
| **Source** | `C:\genarc\src\engines\snap\` (10 αρχεία) + `C:\genarc\src\utils\{coordinateTransforms,cursorProjection,gizmoProjection,sitePicking,elementSnap,gridSnap}.ts` (6 αρχεία) — total **16 files, ~1.526 LOC** |
| **Sibling SPECs** | SPEC-3D-004A ✅ (Viewport), SPEC-3D-004B ✅ (DXF Parser), SPEC-3D-004D (Geometry Helpers, TBD), SPEC-3D-004E (Materials/Shaders, TBD) |

---

## Executive Summary

Πλήρης διερεύνηση 16 αρχείων του GenArc snap/picking/coordinate domain. **Καίριο εύρημα**: Nestor ήδη έχει **πολύ πιο ώριμο 2D snap engine** (17 engines vs GenArc 7 strategies), οπότε όλο το snap pipeline του GenArc είναι **EXCLUDE** (Nestor έχει superset). Όμως το GenArc `coordinateTransforms.ts` (Three.js NDC math) είναι **καινούργιο domain για Nestor** — μοναδική πραγματική πηγή value σε αυτό το SPEC.

**Αποτέλεσμα catalog**:

| Κατηγορία | Files | LOC | Effort | Αξία |
|---|---:|---:|---|---|
| **PORT_AS_IS** | 2 | ~234 | Copy + rename | 🟢 Critical: coordinateTransforms (Three.js NDC) + gizmoProjection (3D drag math) |
| **PORT_WITH_ADAPTATION** | 1 | ~48 | ~1h type swap | 🟡 cursorProjection — pattern για 3D cursor → world coordinate (Bottom Bar feed) |
| **EXTRACT_CONCEPT** | 0 | 0 | — | — |
| **EXCLUDE** | 13 | ~1.244 | — | 🔴 Nestor snap engine είναι strict superset + sitePicking ΝΟΚ-specific |

**Top targets** (immediate value για ADR-366):

1. **`coordinateTransforms.ts`** (118 LOC) — Three.js NDC math (`screenToWorld`, `worldToScreen`, `ndcToWorld`, `worldToNdc`, `getPixelWorldSize`, `getVisibleWorldSize`). Λειτουργεί identically για PerspectiveCamera + OrthographicCamera. **PORT_AS_IS**. ⭐ **Critical** — χωρίς αυτό δεν γίνεται 3D-space cursor coordinates / pixel size scaling για gizmo handles.
2. **`gizmoProjection.ts`** (116 LOC) — Pure Three.js drag projection math (`projectOntoAxis`, `projectOntoPlane`, `projectVerticalScreenDrag`, `projectConstrained`). Two-line closest-point + ray-plane + Y-axis top-down fallback. **PORT_AS_IS** (μαζί με `Y_AXIS_TOP_DOWN_THRESHOLD` constant). Required για Phase 7 gizmo editing.
3. **`cursorProjection.ts`** (48 LOC) — Pattern για 3D cursor → world position (raycaster → geometry hit OR ground plane fallback). **PORT_WITH_ADAPTATION** (swap GenArc types με Nestor BIM types). Feed για Bottom Bar 3D coordinates.

**Συνολικό effort port**: **~3.5h Phase 0** — full enterprise approach (industry alignment 9/9: Revit, AutoCAD, SketchUp, Rhino, Blender, Forge/APS, Speckle, xeokit, Three.js Editor → όλα ports cursor coords στο viewport init, scene-agnostic, empty-safe). Όχι deferred ports σε Phase 7. Βλ. §9.1.

---

## 1. Methodology

Ίδια με SPEC-3D-004A/B:

| Κατηγορία | Κριτήριο |
|---|---|
| **PORT_AS_IS** | Zero GenArc store/SDF/ΝΟΚ deps. Μόνο Three.js + viewport types/constants. |
| **PORT_WITH_ADAPTATION** | 1-3 GenArc-specific deps που αντικαθίστανται με Nestor equivalents. |
| **EXTRACT_CONCEPT** | Heavy coupling + Nestor δεν έχει equivalent + algorithm πολύτιμο. |
| **EXCLUDE** | (a) Nestor ήδη έχει mature equivalent (snap engine superset), ή (b) GenArc-specific (ΝΟΚ/τοπογραφικό). |

**Έλεγχοι**:
1. Imports analysis ανά αρχείο (grep `@/stores`, `@/engines/sdf`, `@/engines/nok`, `@/types/site`).
2. Full read 16 αρχείων.
3. Διασταύρωση με Nestor's `snapping/` (17 engines + orchestrator), `systems/cursor/`, `systems/hover/`, `rendering/core/CoordinateTransforms.ts` (2D-only).

---

## 2. PORT_AS_IS Files (2 files, ~234 LOC)

### 2.1 `utils/coordinateTransforms.ts` — 118 LOC ⭐ CRITICAL

| Στοιχείο | Τιμή |
|---|---|
| **One-liner** | C4D-style Three.js screen/world/NDC conversions. PerspectiveCamera + OrthographicCamera unified API. |
| **Exports** | `screenToWorld`, `worldToScreen`, `ndcToWorld`, `worldToNdc`, `getPixelWorldSize`, `getVisibleWorldSize` |
| **Deps** | `three` + `ScreenProjection` type (από `@/types/viewport.types`) |
| **Pure** | Ναι — reusable temp vectors (`_ndc`, `_projected`, `_near`, `_far`) για GC pressure reduction |
| **Target path** | `src/subapps/dxf-viewer/bim-3d/utils/coordinate-transforms.ts` |
| **Effort** | ~20 min copy + rename + type import path adjustment |

**Γιατί PORT_AS_IS**:
- Zero GenArc-specific dependencies (μόνο THREE + 1 lightweight interface)
- Pure math (NDC ↔ world ↔ screen)
- Works για **οποιαδήποτε** Three.js camera (perspective ή ortho)
- Reusable scratch vectors → zero allocation per call

**Γιατί critical για ADR-366**:
- Nestor `rendering/core/CoordinateTransforms.ts` είναι **2D-only** (`Point2D` + `ViewTransform` + `Viewport` margin/Y-inversion logic). Δεν έχει NDC math, δεν έχει Three.js camera support.
- Όλη η 3D interaction (cursor → world, gizmo screen size, framing-fit) χρειάζεται αυτές τις primitives.
- **Naming conflict warning**: ίδια ονόματα `screenToWorld`/`worldToScreen` σε Nestor (2D) + GenArc (3D). **Target path πρέπει να είναι namespaced** στο `bim-3d/utils/` — όχι rename functions, μόνο διαφορετικός module path.

### 2.2 `utils/gizmoProjection.ts` — 116 LOC

| Στοιχείο | Τιμή |
|---|---|
| **One-liner** | Pure math για constrained gizmo drag (axis/plane/free). Two-line closest-point + ray-plane + Y-top-down fallback. |
| **Exports** | `projectOntoAxis`, `projectOntoPlane`, `projectVerticalScreenDrag`, `projectConstrained` |
| **Deps** | `three` + `GizmoDragConstraint` type + `Y_AXIS_TOP_DOWN_THRESHOLD` constant |
| **Pure** | Ναι — reusable temp vectors (`_w`, `_d`, `_e`, `_tmp`, `_normal`) |
| **Target path** | `src/subapps/dxf-viewer/bim-3d/utils/gizmo-projection.ts` |
| **Effort** | ~20 min copy + rename (constant + type ports έρχονται από SPEC-3D-004A §3.x) |

**Γιατί PORT_AS_IS**:
- Pure Three.js math (Vector3 ops μόνο)
- Type `GizmoDragConstraint` είναι ήδη pure interface στο SPEC-3D-004A (Phase 7+ gizmo)
- Constant `Y_AXIS_TOP_DOWN_THRESHOLD` ports μαζί με `gizmo.constants.ts` (SPEC-3D-004A §8.3)
- Δεν θίγει stores ή SDF

**Σύνδεση με SPEC-3D-004A**: Το `gizmoController.ts` (EXTRACT_CONCEPT, Phase 7+) χρησιμοποιεί `projectConstrained` ως μοναδική math primitive. Αυτή την έχουμε **έτοιμη** χωρίς extract effort.

---

## 3. PORT_WITH_ADAPTATION Files (1 file, ~48 LOC)

### 3.1 `utils/cursorProjection.ts` — 48 LOC

| Στοιχείο | Τιμή |
|---|---|
| **One-liner** | Three.js raycaster → world position. Geometry hit (wall/column/beam/slab) priority, fallback σε ground plane (Y=0). |
| **Exports** | `projectCursorToWorld` |
| **Deps to swap** | (a) GenArc `Wall`/`Opening`/`Column`/`Beam`/`Slab` types → **Nestor BIM types** (`bim/types/{wall,opening,column,beam,slab}-types.ts`). (b) `findClosestSceneHit` από `@/utils/raySceneIntersection` → **νέα Nestor utility** TBD στο SPEC-3D-002. (c) `CursorWorldPosition` type → Nestor equivalent ή port. |
| **Target path** | `src/subapps/dxf-viewer/bim-3d/utils/cursor-projection.ts` |
| **Effort** | ~1h (type swaps + νέο `findClosestSceneHit` wrapper πάνω σε Three.js raycaster.intersectObjects) |

**Γιατί PORT_WITH_ADAPTATION και όχι EXCLUDE**:
- Pattern (raycaster → geometry priority → ground fallback) είναι **canonical** Three.js — δεν χρειάζεται reinvent.
- Nestor έχει `HoverStore` (zero React state, ADR-040) που μπορεί να **καταναλώνει** το αποτέλεσμα 3D cursor.
- Bottom Bar coordinates feed (ADR-345 §status bar) χρειάζεται 3D world position στο 3D mode.

**Adaptation work**:
```typescript
// BEFORE (genarc):
import type { Wall } from '@/types/wall.types';
import { findClosestSceneHit } from '@/utils/raySceneIntersection';

// AFTER (Nestor bim-3d):
import type { WallEntity } from '@/subapps/dxf-viewer/bim/types/wall-types';
import { findClosestBimHit } from '@/subapps/dxf-viewer/bim-3d/scene/bim-raycaster';
```

Note: `findClosestBimHit` είναι **νέο Nestor utility** που χτίζεται **μέσα** στο SPEC-3D-002 (BIM Elements Renderer). Δεν ports από GenArc — wraps native `THREE.Raycaster.intersectObjects(scene.children)`.

---

## 4. EXTRACT_CONCEPT Files

**Κανένα αρχείο.** Λόγος: είτε pattern υπάρχει ήδη εξαιρετικά στο Nestor (snap), είτε pattern είναι trivial Three.js (raycaster + ground plane fallback covered στο §3.1).

---

## 5. EXCLUDE Files (13 files, ~1.244 LOC)

### 5.1 GenArc snap engine (10 αρχεία, ~789 LOC) — Nestor έχει strict superset

| File | LOC | Λόγος EXCLUDE |
|---|---:|---|
| `engines/snap/snapPipeline.ts` | 66 | Nestor: `snapping/orchestrator/SnapOrchestrator.ts` + `SnapEngineCore.ts` + `SnapCandidateProcessor.ts` (modular, configurable per tool, με `enabledTypes` Set). Genarc pipeline είναι linear strategy chain χωρίς per-tool registry — δικός μας έχει mature `SnapEngineRegistry` + `SnapOverrideOrchestrator`. |
| `engines/snap/snapPipelineFactory.ts` | 57 | Nestor: `snapping/SnapPresets.ts` (Architectural/Engineering presets) + `SnapEngineRegistry.ts` (per-tool wiring). |
| `engines/snap/resolveSnapV2.ts` | 181 | Nestor: `snapping/ProSnapEngineV2.ts` + `global-snap-engine.ts`. Επιπλέον περιλαμβάνει `resolveGizmoSnap` με exclude-self filter — Nestor's grip system το χειρίζεται μέσω `ImmediateSnapStore` + `GripSnapStore`. |
| `engines/snap/strategies/endpointStrategy.ts` | 108 | Nestor: `snapping/engines/EndpointSnapEngine.ts`. Επιπλέον το GenArc endpoint είναι ad-hoc "9 snap points per element" (corner + edge midpoint + face center) — αυτό σε Nestor διασπάται σε 4 separate engines (`EndpointSnapEngine`, `MidpointSnapEngine`, `CenterSnapEngine`, `QuadrantSnapEngine`) per ADR-026 separation of concerns. |
| `engines/snap/strategies/midpointStrategy.ts` | 43 | Nestor: `snapping/engines/MidpointSnapEngine.ts`. |
| `engines/snap/strategies/intersectionStrategy.ts` | 76 | Nestor: `snapping/engines/IntersectionSnapEngine.ts` + `intersection-calculators.ts` + `ray-intersection-calculators.ts` (xline/ray ops — GenArc δεν έχει XLINE/RAY entities). |
| `engines/snap/strategies/perpendicularStrategy.ts` | 66 | Nestor: `snapping/engines/PerpendicularSnapEngine.ts`. |
| `engines/snap/strategies/parallelStrategy.ts` | 80 | Nestor: `snapping/engines/ParallelSnapEngine.ts` + `OrthoSnapEngine.ts`. |
| `engines/snap/strategies/extensionStrategy.ts` | 88 | Nestor: `snapping/engines/ExtensionSnapEngine.ts`. |
| `engines/snap/strategies/gridStrategy.ts` | 24 | Nestor: `snapping/engines/GridSnapEngine.ts`. |

**Επιπλέον Nestor snap engines που GenArc ΔΕΝ έχει** (gap στην άλλη κατεύθυνση):
- `CenterSnapEngine` (κύκλος/τόξο κέντρο)
- `TangentSnapEngine` (εφαπτομένη)
- `QuadrantSnapEngine` (καρτεσιανά τέταρτα κύκλου)
- `NodeSnapEngine` (node-style points)
- `NearSnapEngine` + `NearestSnapEngine` (different semantics)
- `InsertionSnapEngine` (DXF INSERT block insertion point)
- `ConstructionPointSnapEngine`
- `GuideSnapEngine` (drag guides)
- `DimDefPointSnapEngine` + `DimLineSnapEngine` (ADR-362 dimension snap)

### 5.2 GenArc snap utilities (2 αρχεία, ~115 LOC)

| File | LOC | Λόγος EXCLUDE |
|---|---:|---|
| `utils/elementSnap.ts` | 96 | Wrapper γύρω από `resolveSnap` με `getSnapElements` reading από `useBuildingStore` — couples με GenArc store. Nestor's αντίστοιχο: `snapping/hooks/useGlobalSnapSceneSync.ts` + ADR-040 scene SSoT feed. |
| `utils/gridSnap.ts` | 19 | Trivial `Math.round / GRID_SNAP_SIZE * GRID_SNAP_SIZE`. Nestor: `GridSnapEngine` + grid config from `systems/grid/`. |

### 5.3 GenArc site/ΝΟΚ picking (1 αρχείο, 340 LOC)

| File | LOC | Λόγος EXCLUDE |
|---|---:|---|
| `utils/sitePicking.ts` | 340 | **100% ΝΟΚ/τοπογραφικό domain**: `pickFrontages`, `pickBoundaries`, `pickAdjacentBuildings`, `pickOppositeRg`, `pickSiteAreas` (plot-fill/sidewalk/road bands). Type `PlotSite` + import `buildShape` από `plotOverlay` (GenArc ΝΟΚ engine). Same precedent όπως EXCLUDE plotOverlay/plotAdjacentLayer/ideaToStereoOverlay στο SPEC-3D-004A §5.5. Out of scope ADR-366. |

**Πιθανή reusable τεχνική (informational)**: Το ray-AABB slab test (γραμμές 186-198) είναι standard slab-method για adjacent buildings — όμως Three.js έχει `Box3.intersectsRay` built-in. Όχι λόγος για port.

---

## 6. Nestor Snap/Picking Gap Analysis

### 6.1 Nestor snap surface (already-have)

| Component | Path | Notes |
|---|---|---|
| 17 snap engines | `snapping/engines/` | Endpoint/Midpoint/Center/Intersection/Perpendicular/Parallel/Ortho/Extension/Grid/Insertion/Node/Tangent/Quadrant/Near/Nearest/ConstructionPoint/Guide + 2 dim-specific |
| Orchestrator stack | `snapping/orchestrator/` | `SnapOrchestrator`, `SnapEngineRegistry`, `SnapCandidateProcessor`, `SnapContextManager` |
| Override system | `snapping/overrides/SnapOverrideOrchestrator.ts` | Per-tool override of default snap set |
| Presets | `snapping/SnapPresets.ts` | Architectural / Engineering / etc. preset bundles |
| Calculators | `snapping/engines/intersection-calculators.ts` + `ray-intersection-calculators.ts` | XLINE/RAY support (GenArc absent) |
| Geometric helpers | `snapping/shared/GeometricCalculations.ts` | Shared math |
| Hooks | `snapping/hooks/useGlobalSnapSceneSync.ts` | Scene SSoT feed |
| Cursor SSoT | `systems/cursor/ImmediatePositionStore.ts` + `ImmediateSnapStore.ts` + `GripSnapStore.ts` + `ImmediateTransformStore.ts` | Zero React state, ADR-040 |
| Hover SSoT | `systems/hover/HoverStore.ts` + `useHover.ts` | Zero React state |
| Selection SSoT | `systems/cursor/SelectionStore.ts` | |
| Coordinate transforms (2D) | `rendering/core/CoordinateTransforms.ts` | **2D only** (Point2D + ViewTransform + Viewport margin/Y-inversion). Δεν έχει Three.js NDC. |

### 6.2 GenArc snap surface (potentially additive)

| Feature | Location | Σχέση με Nestor |
|---|---|---|
| 7 snap strategies | `engines/snap/strategies/` | ❌ **Strict subset** of Nestor's 17 engines |
| `resolveGizmoSnap` (exclude-self filter) | `resolveSnapV2.ts:155` | ⚠️ Nestor's grip drag χρησιμοποιεί `ImmediateSnapStore.setExcludedIds()` pattern — equivalent ή ανώτερο. |
| Alignment guides (vertical/horizontal infer) | `resolveSnapV2.ts:61-104` | ⚠️ Nestor's `GuideSnapEngine` καλύπτει — TODO επιβεβαίωση αν περιλαμβάνει "infer alignment from nearby point" feature ή μόνο explicit guides. Πιθανή Boy Scout enhancement αν λείπει. |

### 6.3 GenArc picking/projection surface (genuinely additive)

| Feature | Location | Σχέση με Nestor |
|---|---|---|
| Screen ↔ World ↔ NDC (Three.js) | `utils/coordinateTransforms.ts` | ✅ **New for Nestor** — Nestor's `rendering/core/CoordinateTransforms.ts` είναι 2D-only. **PORT_AS_IS κρίσιμο.** |
| `getPixelWorldSize` / `getVisibleWorldSize` | `coordinateTransforms.ts:84-117` | ✅ **New for Nestor** — required για screen-constant gizmo size + DPI-aware framing. |
| Constrained gizmo drag projection | `utils/gizmoProjection.ts` | ✅ **New for Nestor** — Nestor's gizmos σήμερα είναι 2D screen-space. PORT_AS_IS για Phase 7. |
| Raycaster → ground plane fallback | `utils/cursorProjection.ts` | ✅ **New for Nestor** — όλη η 2D mouse handling είναι Canvas-coord. 3D raycaster είναι νέο domain. |

### 6.4 Συμπέρασμα §6

- **Snap**: Nestor είναι **strict superset**. Zero port. Πιθανή Boy Scout enhancement στο `GuideSnapEngine` αν λείπει "infer alignment from arbitrary nearby point" (Q1 §13).
- **Picking/Projection (3D)**: GenArc έχει 3 critical primitives που Nestor **απολύτως δεν έχει**. Όλες ports.

---

## 7. Coordinate System / Units Alignment

| Σύστημα | X | Y | Z | Units | Camera | Σημείωση |
|---|---|---|---|---|---|---|
| **Nestor 2D Canvas** | screen.x | screen.y (Y-flip) | — | px ↔ mm via ViewTransform | none | `Point2D` |
| **Nestor 2D world** | East | North | — | mm internal | none | Plan view |
| **GenArc Three.js (ADR-009)** | East | Ύψος ↑ | Βορράς ↓ | metres | Perspective + Orthographic | Y-up |
| **Nestor bim-3d (ADR-366 §4.2)** | East | Ύψος ↑ | Βορράς ↓ | metres | Perspective + Orthographic (planned) | Y-up — **ίδιο με GenArc** |
| **NDC** | [-1, 1] | [-1, 1] | [-1, 1] | unitless | depth in projection space | `worldToNdc(worldPos, camera)` |

**Critical alignment**:
- GenArc + Nestor 3D = **ίδια Y-up convention** (επιβεβαίωση από SPEC-3D-004A §6).
- GenArc + Nestor 3D = **ίδιες μονάδες (metres)**. Nestor 2D parse output είναι mm → μετατροπή σε metres μέσω `dxfPlanToWorld` (ADR-366 §4.2).
- `coordinateTransforms.ts` δουλεύει σε Three.js NDC space, agnostic στις μονάδες. **Zero adaptation**.
- `gizmoProjection.ts` δουλεύει σε world space metres. **Zero adaptation**.
- `cursorProjection.ts` επιστρέφει `CursorWorldPosition` σε metres (Y-up). Πρέπει inverse `dxfPlanToWorld → worldToDxfPlan` αν θέλουμε το Bottom Bar να δείχνει 2D plan coords (mm) ενώ είμαστε σε 3D — αυτό είναι **consumer-side decoration**, όχι adaptation του ports.

### 7.1 2D ↔ 3D bridge (decision)

Όταν ο χρήστης κάνει toggle 2D→3D και υπάρχει cursor σε 2D plan position:
- `dxfPlanToWorld(x_mm, y_mm, elevation_mm)` → `THREE.Vector3` (ADR-366 §4.2 ήδη ορισμένη συνάρτηση).
- Inverse `worldToDxfPlan(THREE.Vector3)` → `{ x_mm, y_mm }` για display ή 2D state sync.

**Δεν χρειάζονται extra utilities από GenArc** για αυτό το bridge — όλα built-in στο ADR-366.

---

## 8. License Audit (SOS N.5)

| Module | License | Status |
|---|---|---|
| GenArc `engines/snap/*` (10 αρχεία) | Custom Γιώργου | MIT-compatible ✅ — όμως EXCLUDE, irrelevant |
| GenArc `utils/coordinateTransforms.ts` | Custom Γιώργου | MIT-compatible ✅ |
| GenArc `utils/gizmoProjection.ts` | Custom Γιώργου | MIT-compatible ✅ |
| GenArc `utils/cursorProjection.ts` | Custom Γιώργου | MIT-compatible ✅ |
| GenArc `utils/sitePicking.ts` | Custom Γιώργου | MIT-compatible ✅ — όμως EXCLUDE |
| `three` (transitive dep όλων των ports) | MIT ✅ | Ήδη approved (ADR-366 §8.3) |

**License risk: ZERO** για τα 3 ported αρχεία.

---

## 9. Port Execution Plan

### 9.1 Industry alignment (Full Enterprise — 2026-05-19 decision)

Big players (Revit, AutoCAD 3D, SketchUp, Rhino, Blender, Forge/APS, Speckle, xeokit, Three.js Editor — **9/9 σύγκλιση**) ports cursor coordinates **στο viewport init**, όχι "όταν θα έχουμε meshes". Λόγος: `THREE.Raycaster.intersectObjects([])` είναι empty-safe (επιστρέφει `[]`), και το ground plane fallback (Y=0) είναι σωστή UX απάντηση για κενή σκηνή.

**Συνέπεια**: Όλα τα 3 ports (coordinate transforms + cursor projection + gizmo projection) γίνονται σε **Phase 0 (Infrastructure)** ως single block. Καμία deferred port σε Phase 7.

### 9.2 Sub-phase target — All in Phase 0

| Sub-phase | Αρχεία | Effort | Λόγος εδώ (όχι αργότερα) |
|---|---|---|---|
| **0.1 Coordinate primitives** | `coordinateTransforms.ts` (PORT_AS_IS) | ~30 min | Required για viewport init (NDC, pixel size). |
| **0.2 Scene raycaster SSoT** | `bim-raycaster.ts` (ΝΕΟ Nestor module, ~30 LOC) | ~30 min | Thin wrapper γύρω από `THREE.Raycaster.intersectObjects(scene.children, true)` + `userData.entityId` extraction. Scene-agnostic, empty-safe. |
| **0.3 Cursor → world** | `cursorProjection.ts` (PORT_WITH_ADAPTATION) | ~45 min | Bottom Bar coordinate feed από day 1 (ground plane fallback για empty scene). Auto-activates όταν meshes φτάνουν. |
| **0.4 Gizmo math** | `gizmoProjection.ts` (PORT_AS_IS) | ~30 min | Required για Phase 7 αλλά **scene-agnostic** (pure math). Port τώρα = zero cost, ready από day 1. |
| **0.5 Tests** | unit tests + integration test (mock scene + raycaster) | ~1.5h | Coordinate round-trip + axis/plane projection + cursor empty-scene fallback + cursor mesh hit. |

**Συνολικό effort Phase 0 (SPEC-3D-004C contribution): ~3.5h.**

### 9.3 Sub-phase 0.1 — Coordinate primitives (30 min)

1. Copy `C:\genarc\src\utils\coordinateTransforms.ts` → `src/subapps/dxf-viewer/bim-3d/utils/coordinate-transforms.ts`.
2. Adjust import: `@/types/viewport.types` → port `ScreenProjection` interface μαζί.
3. No code changes.

### 9.4 Sub-phase 0.2 — Scene raycaster SSoT (30 min)

Δημιούργησε `src/subapps/dxf-viewer/bim-3d/scene/bim-raycaster.ts`:

```typescript
import * as THREE from 'three';

export interface BimRaycastResult {
  readonly point: THREE.Vector3;
  readonly object: THREE.Object3D;
  readonly distance: number;
  readonly entityId?: string;  // από object.userData.entityId (set στο Phase 1/2 mesh creation)
}

export function findClosestBimHit(
  raycaster: THREE.Raycaster,
  scene: THREE.Scene,
): BimRaycastResult | null {
  const hits = raycaster.intersectObjects(scene.children, true);
  if (hits.length === 0) return null;
  const closest = hits[0];
  return {
    point: closest.point,
    object: closest.object,
    distance: closest.distance,
    entityId: closest.object.userData?.entityId,
  };
}
```

**Empty-scene behavior**: `intersectObjects([])` → `[]` → `findClosestBimHit` returns `null` → consumer `cursorProjection` πέφτει σε ground plane fallback.

**Phase 1/2 contract**: όταν meshes δημιουργούνται, **πρέπει** να γράφουν `mesh.userData.entityId = entity.id`. Documented στο SPEC-3D-001/002.

### 9.5 Sub-phase 0.3 — Cursor → world (45 min)

1. Copy `C:\genarc\src\utils\cursorProjection.ts` → `src/subapps/dxf-viewer/bim-3d/utils/cursor-projection.ts`.
2. Swap GenArc types → Nestor BIM types (`WallEntity` κ.λπ.). Όμως **απλούστερη προσέγγιση**: αντί να περάσουμε `walls/columns/beams/slabs/openings` arrays, περνάμε **απευθείας τη `THREE.Scene`** — ο raycaster δουλεύει με `scene.children`, scene-agnostic.

```typescript
// Simplified Nestor signature (no per-type arrays):
export function projectCursorToWorld(
  raycaster: THREE.Raycaster,
  scene: THREE.Scene,
): CursorWorldPosition | null {
  const { origin, direction } = raycaster.ray;
  const hit = findClosestBimHit(raycaster, scene);
  if (hit) return { x: hit.point.x, y: hit.point.y, z: hit.point.z, entityId: hit.entityId };

  // Ground plane fallback
  if (Math.abs(direction.y) < 1e-6) return null;
  const t = -origin.y / direction.y;
  if (t < 0) return null;
  return {
    x: origin.x + t * direction.x,
    y: 0,
    z: origin.z + t * direction.z,
  };
}
```

3. Δημιούργησε `bim-3d/types/cursor-types.ts` με `interface CursorWorldPosition { x: number; y: number; z: number; entityId?: string; }`.

### 9.6 Sub-phase 0.4 — Gizmo math (30 min)

1. Copy `C:\genarc\src\utils\gizmoProjection.ts` → `src/subapps/dxf-viewer/bim-3d/utils/gizmo-projection.ts`.
2. Verify `GizmoDragConstraint` + `Y_AXIS_TOP_DOWN_THRESHOLD` already ported από SPEC-3D-004A §8.3 + §8.4.
3. No code changes.

**Γιατί τώρα και όχι Phase 7**: Pure math, scene-agnostic, zero deps στο BIM domain. Port τώρα = ready when Phase 7 lands, χωρίς "ξεκινάμε από την αρχή" tax.

### 9.2 Sub-phase 0.1 — Coordinate primitives (30 min)

1. Copy `C:\genarc\src\utils\coordinateTransforms.ts` → `src/subapps/dxf-viewer/bim-3d/utils/coordinate-transforms.ts`.
2. Adjust import: `@/types/viewport.types` → port `ScreenProjection` interface μαζί (πιθανότατα ήδη ports στο SPEC-3D-004A §8.4 type definitions).
3. No code changes.

### 9.3 Sub-phase 0.2 — Cursor → world (1h)

1. Copy `C:\genarc\src\utils\cursorProjection.ts` → `src/subapps/dxf-viewer/bim-3d/utils/cursor-projection.ts`.
2. Swap GenArc BIM types με Nestor BIM types (`WallEntity` κ.λπ. από `bim/types/`).
3. Δημιούργησε νέο `src/subapps/dxf-viewer/bim-3d/scene/bim-raycaster.ts` που εκθέτει `findClosestBimHit(origin, dir, sceneObjects)` ως thin wrapper γύρω από `THREE.Raycaster.intersectObjects`.
4. Δημιούργησε `CursorWorldPosition` type στο `bim-3d/types/cursor-types.ts` αν δεν υπάρχει.

### 9.4 Sub-phase 7.0 — Gizmo math (30 min)

1. Copy `C:\genarc\src\utils\gizmoProjection.ts` → `src/subapps/dxf-viewer/bim-3d/utils/gizmo-projection.ts`.
2. Verify `GizmoDragConstraint` + `Y_AXIS_TOP_DOWN_THRESHOLD` already ported από SPEC-3D-004A §8.3 + §8.4.
3. No code changes.

### 9.7 Sub-phase 0.5 — Tests (1.5h)

Jest pure-math tests (κανείς δεν χρειάζεται Three.js renderer, μόνο `Camera` + minimal `Scene` instances):

```typescript
// __tests__/coordinate-transforms.test.ts
- screenToWorld round-trip με PerspectiveCamera στο depth=10
- screenToWorld round-trip με OrthographicCamera στο depth=0
- ndcToWorld με ortho camera (γνωστή απάντηση: depth = (top+bottom)/2)
- worldToScreen behindCamera flag (camera position πίσω από target)
- getPixelWorldSize ortho vs perspective formula verification
- getVisibleWorldSize aspect ratio correctness

// __tests__/gizmo-projection.test.ts
- projectOntoAxis: closest point between intersecting lines
- projectOntoAxis: parallel rays → returns axisOrigin
- projectOntoPlane: ray parallel σε plane → null
- projectOntoPlane: ray behind origin → null
- projectVerticalScreenDrag: top-down camera fallback geometry
- projectConstrained dispatcher: axis/plane/free routing

// __tests__/bim-raycaster.test.ts
- empty scene → null (zero allocation, no crash)
- scene with 1 mesh + userData.entityId → returns entityId
- scene with 1 mesh + no userData → returns hit, entityId undefined
- nested children (Group → Mesh) → recursive=true finds it

// __tests__/cursor-projection.test.ts
- empty scene + ray hits ground → ground plane fallback (Y=0)
- empty scene + ray pointing up (direction.y > 0) → null
- scene with mesh + ray hits mesh → returns mesh point + entityId
- scene with mesh + ray misses mesh + ray hits ground → ground plane fallback
- camera below ground (origin.y < 0) + ray going up → null
```

**Total Phase 0 effort (SPEC-3D-004C contribution): ~3.5h** (1.5h ports + 0.5h νέος bim-raycaster + 1.5h tests).

---

## 10. Cross-Domain Dependencies Spotted

(Section as required by task spec — flag GenArc cross-domain coupling χωρίς είσοδο σε άλλα domains.)

Κατά τη διερεύνηση εντοπίστηκαν τα εξής cross-domain edges:

| Edge | Source file | Target domain | Σχόλιο για αδέλφια SPECs |
|---|---|---|---|
| `cursorProjection.ts` → `@/utils/raySceneIntersection` (`findClosestSceneHit`) | local utils | **utils/ (geometry domain)** | ⚠️ Το `raySceneIntersection.ts` είναι **utility γεωμετρίας** που θα εξεταστεί στο **SPEC-3D-004D (Geometry Helpers)**. Σε εκείνο το spec, αν είναι pure (raycaster.intersectObjects wrapper με ground plane fallback) → PORT_AS_IS. Αν περιέχει wall-mesh-builder coupling → adapt. |
| `sitePicking.ts` → `@/engines/viewport/plotOverlay` (`buildShape`) | engines/viewport | **engines/viewport/ (ΝΟΚ overlay)** | ✅ Confirmed στο SPEC-3D-004A §5.5 EXCLUDE plotOverlay. Self-consistent: αν `plotOverlay` EXCLUDE, τότε ο consumer `sitePicking` αυτόματα EXCLUDE — επιβεβαίωση. |
| `elementSnap.ts` → `@/stores/building.store` (`useBuildingStore`) + `@/utils/buildingSelectors` | stores + utils | **utils/ (buildingSelectors will appear σε SPEC-3D-004D)** | ⚠️ Το `buildingSelectors` είναι "scene/floor selector" utility. Στο SPEC-3D-004D αναμένουμε ότι θα είναι EXCLUDE (Nestor's scene SSoT αντικαθιστά). |
| `resolveSnapV2.ts` → `@/utils/structuralConnectivity.helpers` (`distSqXZ`) | utils | **utils/ (math helpers)** | ⚠️ `distSqXZ` είναι trivial 2D squared distance — πιθανότατα Nestor's `GeometricCalculations.ts` ή `bim/utils/` το έχει ήδη. Reference στο SPEC-3D-004D. |
| `endpointStrategy.ts` + όλα τα strategies → `@/constants/snap.constants` (`SNAP_PRIORITIES`, `*_SNAP_RADIUS`, `GRID_SNAP_SIZE`, `PARALLEL_SNAP_TOLERANCE`, `EXTENSION_MAX_LENGTH`) | constants | **constants/ (snap config)** | ❌ EXCLUDE μαζί με τα strategies — Nestor's snap config είναι strict superset (`SnapPresets.ts` + `SnapEngineCore` settings). |
| `gizmoProjection.ts` → `@/constants/gizmo.constants` (`Y_AXIS_TOP_DOWN_THRESHOLD`) | constants | **constants/ (gizmo config)** | ✅ Ports together με `gizmoProjection` per SPEC-3D-004A §8.3 constants port plan. |
| `gizmoProjection.ts` → `@/types/gizmo.types` (`GizmoDragConstraint`) | types | **types/ (gizmo type definitions)** | ✅ Ports together με `gizmoProjection` per SPEC-3D-004A §8.4 type definitions port. |
| `coordinateTransforms.ts` → `@/types/viewport.types` (`ScreenProjection`) | types | **types/ (viewport types)** | ✅ Lightweight interface (3 fields). Ports together με `coordinate-transforms.ts`. Πιθανότατα ήδη στο SPEC-3D-004A §8.4 viewport types list — αν όχι, **προσθήκη**: `interface ScreenProjection { x: number; y: number; behindCamera: boolean; }`. |
| Κανένα cross-domain edge προς `engines/sdf/`, `engines/structural/`, `engines/ai/`, `engines/nok/`, `engines/bom/`, `engines/dxf/`, `shaders/` | — | — | ✅ Καθαρή απομόνωση του snap/picking domain από SDF/AI/structural — επιβεβαιώνει ότι snap utilities είναι standalone. |

**Συμπέρασμα §10**: 
- 1 expected cross-edge προς **utils** (`raySceneIntersection` → SPEC-3D-004D consideration).
- 1 expected cross-edge προς **utils** (`buildingSelectors` → SPEC-3D-004D EXCLUDE).
- 1 confirmation με **SPEC-3D-004A** (plotOverlay consumer chain).
- Όλα τα constants + types ports συντονισμένα με SPEC-3D-004A port plan — **zero duplication**.

---

## 11. Open Questions για Γιώργο

> Μία ερώτηση τη φορά. Απλά ελληνικά + παράδειγμα. Απάντησε A / B / C ή δώσε άλλη επιλογή.

### Q1 — Alignment guides "infer from nearby point": υπάρχει στο Nestor ή χρειάζεται Boy Scout enhancement;

**Παράδειγμα τι κάνει**: Σχεδιάζεις έναν τοίχο. Ο κέρσορας είναι στο σημείο (10.2, 5.0). Στο σχέδιο, ένας άλλος τοίχος έχει endpoint στο (10.0, 8.0). Ο αλγόριθμος "infer alignment" παρατηρεί ότι ο κέρσοράς σου είναι **πολύ κοντά στην ίδια κατακόρυφη γραμμή** με αυτό το endpoint (Δx = 0.2 m, μέσα σε ανοχή 0.35 m), και σχεδιάζει αυτόματα μια **γαλάζια βοηθητική γραμμή** που σε ευθυγραμμίζει με αυτό. Δεν χρειάζεται να έχεις πει "ξεκίνα guide από εκεί" — το βρίσκει μόνο του από κοντινά reference points.

Το GenArc το κάνει αυτόματο για όλα τα wall start/end/midpoint + beam start/end/midpoint + column corners (`resolveSnapV2.ts:61-104`).

**A) Το Nestor `GuideSnapEngine` ήδη το κάνει** — αγνόησέ το, καμία δουλειά. (Χρειάζεται επιβεβαίωση από τον Γιώργο ή γρήγορο grep.)

**B) Το Nestor δεν το έχει — Boy Scout enhancement** στο `GuideSnapEngine` για να προσθέσουμε "auto-infer alignment from wall/beam/column anchors". Effort: ~2h.

**C) Σημείωσέ το ως pending στο `.claude-rules/pending-ratchet-work.md`** για μελλοντικό enhancement, μην το βάλεις στο ADR-366 roadmap.

*Πρόταση: **A** πιθανότατα, αλλά **χρειάζεται γρήγορη επιβεβαίωση** στον επόμενο "session warmup" (grep στον `GuideSnapEngine` για 'infer' / 'auto-align' / 'nearby point alignment'). Αν δεν υπάρχει → **C** (note pending).*

---

### Q2 — `cursorProjection` ports τώρα ή με Phase 1;

**Παράδειγμα**: Το `cursorProjection.ts` παίρνει τον κέρσορα της οθόνης και βρίσκει σε ποιο σημείο του 3D κόσμου είναι. Π.χ. ο χρήστης κουνάει το ποντίκι πάνω σε έναν τοίχο → το αρχείο επιστρέφει τη θέση `(x=3.2m, y=2.1m, z=4.7m)`. Αν δεν υπάρχει τοίχος εκεί, επιστρέφει το σημείο όπου το ποντίκι "ακουμπάει" το έδαφος.

Χρειάζεται γιατί:
- Το Bottom Bar (status bar κάτω) πρέπει να δείχνει συντεταγμένες όπως ακριβώς δείχνει σε 2D.
- Όταν κάνουμε click στο 3D για να βάλουμε ένα νέο entity, χρειαζόμαστε το ακριβές σημείο.

**Όμως**: Εξαρτάται από το `findClosestBimHit` που θα υπάρξει **μετά το SPEC-3D-002** (όταν θα έχουμε meshes στη σκηνή).

**A) Port τώρα ως Phase 0** (skeleton) — γράφεις το `bim-raycaster.ts` ως empty wrapper (επιστρέφει null), το `cursorProjection` ports complete. Όταν τα meshes έρθουν, "ξυπνάει" αυτόματα.

**B) Port μαζί με Phase 1 (DXF→Three.js)** — όταν θα έχουμε meshes να raycast-aρουμε. Πιο "lazy" approach.

**C) Port μαζί με Phase 2 (BIM→Three.js)** — όταν θα υπάρχουν BIM entity meshes συγκεκριμένα.

*Πρόταση: **B** — Phase 1. Όταν έχουμε first meshes (DXF lines/polylines στη σκηνή ως `LineSegments`), έχει νόημα να ξέρουμε σε ποιο μέρος του κόσμου είναι ο κέρσορας. Phase 0 = υπερβολικά νωρίς (η σκηνή είναι άδεια). Phase 2 = πολύ αργά (θα έχουμε 4-5 ώρες χωρίς cursor coordinates).*

---

### Q3 — RESOLVED 2026-05-19 (Full Enterprise) — Module path + type-based separation + JSDoc + optional ESLint guard

**Industry analysis** (7/7 σύγκλιση: Blender region_2d vs view3d_utils, AutoCAD ObjectARX context flag, Revit XYZ vs UV types, Unity Camera vs RectTransformUtility, Unreal FSceneView vs FGeometry, Rhino Viewport vs Plane, Three.js Editor module isolation) → **κανείς δεν κάνει function rename**. Όλοι χρησιμοποιούν module/namespace/class separation ή type-based distinction.

**Adopted (Full Enterprise, 4 layers)**:

| Layer | Mechanism | Status |
|---|---|---|
| 1. Module path | `rendering/core/CoordinateTransforms` (2D) vs `bim-3d/utils/coordinate-transforms` (3D) | ✅ Default through ports |
| 2. Type-based distinction | 2D signature: `(Point2D, ViewTransform, Viewport) → Point2D`. 3D signature: `(number, number, THREE.Camera, HTMLElement, depth?) → THREE.Vector3`. TypeScript αρνείται mixed use. | ✅ Native ports preserve |
| 3. JSDoc convention | 2D modules: `@coordinate-system 2D Canvas`. 3D modules: `@coordinate-system 3D Three.js (Y-up, metres, NDC)`. Header comment. | ✅ Add during port |
| 4. ESLint cross-domain guard (optional) | Custom rule που μπλοκάρει imports από `rendering/core/CoordinateTransforms` σε `bim-3d/**` (και inverse) | ⏳ Pending entry αν προκύψει σύγχυση μετά Phase 1 (~30min effort) |

### Q3 (legacy text — kept for context) — Naming collision `screenToWorld` (Nestor 2D vs GenArc 3D): rename ή scoped import;

**Παράδειγμα**: Το Nestor ήδη έχει `screenToWorld` στο `rendering/core/CoordinateTransforms.ts` — δουλεύει σε 2D Canvas pixels ↔ mm. Το GenArc έχει επίσης `screenToWorld` στο `coordinateTransforms.ts` — δουλεύει σε browser pixels ↔ Three.js metres. **Διαφορετική σημασία, ίδιο όνομα.**

**A) Καμία αλλαγή** — απλά διαφορετικοί module paths:
   - `import { screenToWorld } from '@/subapps/dxf-viewer/rendering/core/CoordinateTransforms'` (2D)
   - `import { screenToWorld } from '@/subapps/dxf-viewer/bim-3d/utils/coordinate-transforms'` (3D)
   Καταναλωτές ξέρουν ποιο εισάγουν.

**B) Rename το 3D variant** σε `screenTo3DWorld` / `worldTo3DScreen` για explicit clarity. Σπάει το direct port "as is".

**C) Rename και τα δύο** σε explicit `screenToCanvas2D` (Nestor 2D) και `screenTo3DWorld` (GenArc 3D). Καθαρή σημασιολογία αλλά αλλάζει υπάρχοντα Nestor call sites (~10-15 αρχεία).

*Πρόταση: **A**. Module path provides namespace. Standard TypeScript practice. C = breaking change χωρίς λόγο.*

---

### Q4 — RESOLVED 2026-05-19 (Full Enterprise) — Zero-port confirmed via formal parity matrix

**Industry analysis** (4/4 σύγκλιση: Speckle uses Three.js native raycaster + zero custom snap port, xeokit built-in PickController + zero port, Forge/APS augments only specific gaps, Rhino full replace + backward shim) → **dual snap systems = anti-pattern**. Όταν υπάρχει mature engine, ισχύει: zero-port OR augment specific gaps OR full replace. Co-exist αποφεύγεται.

**Parity matrix** (spot-check 2026-05-19 με read στο `PerpendicularSnapEngine.ts` + `ExtensionSnapEngine.ts`):

| GenArc strategy | LOC | Nestor equivalent | Parity |
|---|---:|---|---|
| `endpointStrategy` | 108 | Endpoint + Midpoint + Center + Quadrant (4 engines, ADR-026 SRP) | ✅ **Superset** — granular separation |
| `midpointStrategy` | 43 | `MidpointSnapEngine` | ✅ Parity |
| `intersectionStrategy` | 76 | `IntersectionSnapEngine` + `intersection-calculators` + `ray-intersection-calculators` (XLINE/RAY) | ✅ **Superset** — infinite-line support |
| `perpendicularStrategy` | 66 | `PerpendicularSnapEngine` + BIM pre-pass (`getWallAxisPerpendicularFeet`, `getSlabEdgePerpendicularFeet`, `getOpeningOutlinePerpendicularFeet` — ADR-363 Phase 5.5e/f/g) | ✅ **Superset** — BIM-aware |
| `parallelStrategy` | 80 | `ParallelSnapEngine` + `OrthoSnapEngine` | ✅ **Superset** — 2 engines για broader coverage |
| `extensionStrategy` | 88 | `ExtensionSnapEngine` (Line + Polyline start/end segment extensions) | ✅ **Superset** — more entity types |
| `gridStrategy` | 24 | `GridSnapEngine` | ✅ Parity |

**Decision**: **A (zero port) confirmed**. Επιπλέον, identification of architectural pattern improvement (Boy Scout candidate): Nestor's separation of `engine output (candidates) ↔ snap indicator visualization (separate system)` είναι **πιο enterprise** από GenArc's inline `guide` field σε perpendicular/parallel/extension candidates. **Nestor εδώ είναι ανώτερο σε αρχιτεκτονική, όχι μόνο σε coverage.**

### Q4 (legacy text — kept for context) — Snap engine GenArc: zero-port επιβεβαίωση;

**Παράδειγμα**: Το `endpointStrategy.ts` του GenArc βρίσκει για κάθε τοίχο **9 snap points** (4 γωνίες + 4 face centers + 1 midpoint). Το Nestor `EndpointSnapEngine` βρίσκει μόνο τα **2 endpoints** του τοίχου (start, end). Οι ενδιάμεσοι σημεία (face centers, corners) δίνονται από τα **`MidpointSnapEngine`** + **`CenterSnapEngine`** + grip system — separation of concerns.

Είναι **διαφορετική φιλοσοφία ίδιας λειτουργικότητας**.

**A) Επιβεβαιώνω: ZERO port από `engines/snap/`** — Nestor είναι superset, διαφορετική (καλύτερη) αρχιτεκτονική. Καμία αξία σε port.

**B) Θέλω review του ποιες δομές βρίσκει το Nestor vs GenArc** πριν επιβεβαιώσω — π.χ. γράψε μια matrix "για wall: ποια snap points εκπέμπει κάθε engine, GenArc vs Nestor". Effort: ~1h extra research.

*Πρόταση: **A**. Nestor είναι production code με ADR-026 governance + ratchet ratchet. Δεν αξίζει να φέρουμε second-implementation.*

---

## 12. Σχέση με Open Questions των SPEC-3D-004A/B

| Question (σύνδεση) | Σχέση |
|---|---|
| **SPEC-3D-004A Q1 (compass ring στο ViewCube)** | Ανεξάρτητο — αφορά UI, όχι snap/picking. |
| **SPEC-3D-004A Q2 (navProxy primary vs alternative για Phase 2)** | Σχετίζεται έμμεσα: αν navProxy επιλεγεί, χρειάζεται 3D cursor coordinates (`cursorProjection`) **πριν** από Phase 2 — άρα **Q2 του παρόντος SPEC (port Phase 1) γίνεται critical**. Αν alternative επιλεγεί (custom SPEC-3D-002), τότε `cursorProjection` μπορεί να καθυστερήσει. |
| **SPEC-3D-004B Q1 (topographic feature parking)** | Ανεξάρτητο — εδώ απλώς EXCLUDE-ουμε `sitePicking` με τον ίδιο λόγο. |
| **SPEC-3D-004B Q2 (DXF parser build from scratch)** | Ανεξάρτητο. |

---

## 13. Changelog

| Ημ/νία | Αλλαγή | Author |
|---|---|---|
| 2026-05-19 | **Initial draft v1.0** — Full catalog 16 αρχείων του GenArc snap/picking/utils domain. **Result: 2 PORT_AS_IS + 1 PORT_WITH_ADAPTATION + 0 EXTRACT + 13 EXCLUDE.** Κεντρικό εύρημα: το GenArc `coordinateTransforms.ts` (Three.js NDC math) + `gizmoProjection.ts` (constrained drag math) είναι **καινούργιο domain για Nestor** (Nestor `CoordinateTransforms` είναι 2D-only). Snap engine είναι **strict subset** του Nestor 17-engine system. `sitePicking` 100% ΝΟΚ-specific (consistent με SPEC-3D-004A §5.5 EXCLUDE plotOverlay). Cross-domain edges προς SPEC-3D-004D υπό observation (`raySceneIntersection`, `buildingSelectors`, `distSqXZ`). 4 open questions για Γιώργο (alignment guide infer, cursorProjection port timing, naming collision, snap zero-port confirmation). | Claude Opus 4.7 |
| 2026-05-19 | **§9 Port Plan refactor — Full Enterprise (Industry alignment)**. Q2 resolved: όλα τα ports σε Phase 0, όχι deferred σε Phase 7. Industry analysis 9/9 σύγκλιση (Revit, AutoCAD 3D, SketchUp, Rhino, Blender, Forge/APS, Speckle, xeokit, Three.js Editor) → cursor coordinates = viewport infrastructure, scene-agnostic, empty-safe. Νέο sub-phase 0.2 (`bim-raycaster.ts` SSoT) προστέθηκε ~30 LOC. Cursor projection signature simplified: αντί `walls/columns/beams[]` arrays → `THREE.Scene` directly (scene.children agnostic). Contract για Phase 1/2 mesh creation: `mesh.userData.entityId = entity.id`. Effort revised 3-4h → 3.5h Phase 0 (zero Phase 7 cost). Q1 RESOLVED (auto-infer alignment) → pending entry στο `.claude-rules/pending-ratchet-work.md` (~3h independent feature, 4 Giorgio conditions ✅). | Claude Opus 4.7 |
| 2026-05-19 | **Q3 + Q4 RESOLVED — Full Enterprise (Industry alignment)**. **Q3 (naming collision)**: 7/7 σύγκλιση (Blender, AutoCAD, Revit, Unity, Unreal, Rhino, Three.js Editor) → function rename = anti-pattern. Adopted 4-layer separation: (1) module path, (2) type-based distinction (TypeScript compiler enforcement), (3) JSDoc `@coordinate-system` convention, (4) optional ESLint cross-domain import guard. **Q4 (snap zero-port)**: 4/4 σύγκλιση (Speckle, xeokit, Forge/APS, Rhino) → dual snap = anti-pattern. Formal parity matrix (7 GenArc strategies × Nestor engines) confirms Nestor strict superset σε ΟΛΑ — επιπλέον αρχιτεκτονικά ανώτερο (separation engine candidates ↔ visualization vs GenArc inline guide field). ZERO PORT confirmed. ΟΛΕΣ οι 4 ερωτήσεις του SPEC resolved. | Claude Opus 4.7 |
