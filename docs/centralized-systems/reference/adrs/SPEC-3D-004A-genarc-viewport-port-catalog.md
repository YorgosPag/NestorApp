# SPEC-3D-004A — GenArc Viewport Port Catalog

| Πεδίο | Τιμή |
|---|---|
| **Status** | 🟢 **READY FOR PHASE 4** 2026-05-19 — full catalog complete, port plan locked |
| **Date** | 2026-05-19 |
| **Category** | DXF Viewer — 3D Rendering / GenArc Port Sub-Spec |
| **Location** | `docs/centralized-systems/reference/adrs/SPEC-3D-004A-genarc-viewport-port-catalog.md` |
| **Author** | Claude Opus 4.7 + Γιώργος Παγώνης |
| **Parent ADR** | ADR-366 (3D BIM Viewer & Photorealistic Rendering) |
| **Source** | `C:\genarc\src\engines\viewport\` — 45 files, 11.423 LOC |
| **Sibling SPECs** | SPEC-3D-004B (DXF Parser, TBD), SPEC-3D-004C (Utils/Snap/Picking, TBD), SPEC-3D-004D (Geometry Helpers, TBD), SPEC-3D-004E (Materials/Shaders, TBD) |

---

## Executive Summary

Πλήρης διερεύνηση του `C:\genarc\src\engines\viewport\` (45 αρχεία, 11.423 LOC). Κάθε αρχείο ταξινομήθηκε σε μία από 4 κατηγορίες με βάση το coupling του στο GenArc-specific state (stores, SDF shaders, ΝΟΚ engine).

**Αποτέλεσμα catalog**:

| Κατηγορία | Files | LOC | Effort | Αξία |
|---|---:|---:|---|---|
| **PORT_AS_IS** | 15 | ~2.700 | Copy + rename | 🟢 Άμεσο όφελος |
| **PORT_WITH_ADAPTATION** | 8 | ~1.706 | 1-3h ανά file (type swap, store→callback) | 🟢 Phase 7 polish (section/loupe) |
| **EXTRACT_CONCEPT** | 7 | ~3.733 | Reimplementation στο Nestor SSoT | 🟡 Phase 7+ (gizmos, HLR proxy) |
| **EXCLUDE** | 15 | ~3.284 | — | 🔴 Δεν χρειάζονται (drawing/ΝΟΚ/snap αλληλεπικαλυπτόμενα) |

**Top 5 highest-value PORT_AS_IS targets** (zero adaptation, immediate value):
1. **`viewportCamera.ts`** (322 LOC) — Three.js perspective+ortho camera με OrbitControls + tumble + framing + projection switch
2. **`tumbleRotation.ts`** (167 LOC) — Quaternion-based pole-free rotation (no gimbal lock) — battle-tested
3. **`viewCubeMesh.ts` + `viewCubeOverlay.ts` + `viewCubeHighlight.ts`** (657 LOC συνολικά) — πλήρης ViewCube widget χωρίς GenArc deps
4. **`hlrEdgeGeometry.ts`** (88 LOC) — GPU Hidden Line Removal για box edges (vertex shader culling)
5. **`viewportFraming.ts` + `viewportAnimation.ts` + `viewSnapDetector.ts`** (255 LOC) — pure math, ζero deps

**Total Phase 4 effort estimate**: Original ADR-366 §4.5 = ~6h. **Updated με δεδομένα catalog: ~8-10h** (15 PORT_AS_IS files + 1 ADAPT for ViewCube north-callback). Sections + Loupe (Phase 7 polish) = +6-8h.

---

## 1. Methodology

### 1.1 Categorization rules

Κάθε αρχείο εξετάστηκε με:
1. **Imports analysis**: `grep -E "from '@/stores/|@/engines/sdf|@/engines/nok|@/engines/ai"` ανά αρχείο
2. **Source code review**: top 50-100 lines για κάθε αρχείο, full read για high-priority modules
3. **Dependency graph**: τι imports τι, ποιες είναι transitive GenArc-specific dependencies

| Κατηγορία | Κριτήριο |
|---|---|
| **PORT_AS_IS** | Zero imports από `@/stores/`, `@/engines/sdf/`, `@/engines/nok/`, `@/engines/ai/`. Μόνο Three.js + viewport constants + types. Copy → rename → done. |
| **PORT_WITH_ADAPTATION** | 1-3 GenArc-specific deps that can be swapped με Nestor equivalents (πχ `useSiteStore` → callback prop, GenArc `Wall` type → Nestor `WallEntity`). Δουλειά 1-3h ανά αρχείο. |
| **EXTRACT_CONCEPT** | Heavy GenArc coupling but the **pattern/algorithm** είναι πολύτιμη. Reimplementation στο Nestor SSoT απαιτείται. Algorithm μένει σταθερός, υλοποίηση γίνεται από το μηδέν. |
| **EXCLUDE** | (a) GenArc-specific feature (ΝΟΚ, ideal solid, plot setbacks), ή (b) Nestor ήδη έχει mature equivalent (drawing controllers, snap engine). |

### 1.2 Files outside scope

Αυτό το SPEC καλύπτει ΜΟΝΟ `engines/viewport/`. Τα παρακάτω θα έχουν δικά τους sub-SPECs:
- `engines/dxf/` + `types/dxf*` → **SPEC-3D-004B** (DXF Parser Port Catalog)
- `engines/snap/` + `utils/*Snap*` + `utils/cursorProjection`/`gizmoProjection`/`sitePicking` → **SPEC-3D-004C** (Utils/Snap/Picking)
- `engines/bom/` + `utils/{slab,column,beam,wall}*` → **SPEC-3D-004D** (Geometry Helpers)
- `engines/sdf/` + `shaders/` + `types/material.types` → **SPEC-3D-004E** (Materials/Shaders — concepts only για PBR mapping)
- `structural/` (190 files) → **EXCLUDED ENTIRELY** (Eurocode engine, ADR-186 territory)

---

## 2. PORT_AS_IS Files (15 files, ~2.700 LOC)

Αυτά τα αρχεία αντιγράφονται απλά σε `src/subapps/dxf-viewer/bim-3d/viewport/` με rename από camelCase → kebab-case. Καμία αλλαγή κώδικα.

### 2.1 Core viewport (6 files, ~850 LOC)

| File | LOC | One-liner | Deps | Target path |
|---|---:|---|---|---|
| `viewportCamera.ts` | 322 | PerspectiveCamera + OrthographicCamera + OrbitControls + tumble integration. Projection switch (animated), `frameBounds`, `snapToViewDirection`, `goHome`. | `viewport.constants`, `viewport.types`, `tumbleRotation`, `viewportAnimation`, `viewportFraming` | `viewport/viewport-camera.ts` |
| `tumbleRotation.ts` | 167 | Quaternion rotation around camera-local axes — no gimbal lock. Horizon-leveling near poles. Damping. AltKey-triggered. | `viewport.constants` | `viewport/tumble-rotation.ts` |
| `viewportAnimation.ts` | 124 | RAF-based interpolation engine. CameraKeyframe lerp με cubic ease. Auto-cancel on new start. | `viewport.types` | `viewport/viewport-animation.ts` |
| `viewportFraming.ts` | 96 | `computePerspectiveFraming` + `computeOrthoFraming` — pure bounds-fit math. | `viewport.constants` | `viewport/viewport-framing.ts` |
| `viewportPoi.ts` | 106 | POI cross indicator (visible during navigation). Billboard, fade-in/out. | `viewport.constants` | `viewport/viewport-poi.ts` |
| `viewSnapDetector.ts` | 35 | Pure dot product. Returns nearest canonical view if camera direction within ~23°. | `viewport.constants`, `viewport.types` | `viewport/view-snap-detector.ts` |

**Total: 850 LOC. Effort: ~30 min copy + rename + import path adjustments.**

### 2.2 ViewCube (3 of 4 files, ~657 LOC)

| File | LOC | One-liner | Deps | Target path |
|---|---:|---|---|---|
| `viewCubeMesh.ts` | 339 | `createVisualCube` (canvas-textured Phong cube), `createHitTargets` (6 faces + 12 edges + 8 corners), `createCompassRing`, `createHomeButton`. | `viewCubeHighlight` (sibling) | `viewport/view-cube/view-cube-mesh.ts` |
| `viewCubeOverlay.ts` | 184 | Roll arrows (curved arrows), face nav arrows (4 triangles), `computeCompassDirection` (pure math). | `viewCubeMesh` | `viewport/view-cube/view-cube-overlay.ts` |
| `viewCubeHighlight.ts` | 134 | Zone highlight computation (face/edge/corner → which face zone to light up). Canvas drawing. | — | `viewport/view-cube/view-cube-highlight.ts` |

**Total: 657 LOC. Effort: ~30 min copy + rename.**

> Note: `viewCube.ts` (4th file) requires adaptation (north-angle callback) → see §3.1.

### 2.3 Gizmo visual primitives (4 files, ~994 LOC)

Pure visual + hit-test logic, χωρίς state. Χρήσιμα για future interactive 3D editing (ADR-366 Phase 7+).

| File | LOC | One-liner | Deps | Target path |
|---|---:|---|---|---|
| `gizmoBuilders.ts` | 236 | `buildArrowAlongY`, `buildPlaneHandle` — axis arrows + plane (XY/XZ/YZ) handles. Pure visual. | `gizmo.constants` | `viewport/gizmo/gizmo-builders.ts` |
| `gizmoGeometry.ts` | 320 | Factory `createGizmoMeshes`. Assembles 3 axis arrows + 3 plane handles + 3 resize handles + center reticle + origin marker. Returns `GizmoMeshSet` (visuals + hitboxes). | `gizmo.types`, `gizmo.constants`, sibling builders | `viewport/gizmo/gizmo-geometry.ts` |
| `gizmoHandleBuilders.ts` | 333 | `buildResizeHandle` (octahedron + corner L-brackets + crosshair), `buildCenterHandle` (tetrahedron), `buildOriginReticle`. | `gizmo.constants`, `gizmoBuilders` | `viewport/gizmo/gizmo-handle-builders.ts` |
| `gizmoHitTest.ts` | 105 | Priority-based raycaster hit test. `rotate-* (5) > resize-* (4) > center (3) > plane-* (2) > axis-* (1)`. Returns nearest priority winner. | `gizmo.types`, `gizmoGeometry` | `viewport/gizmo/gizmo-hit-test.ts` |

**Total: 994 LOC. Effort: ~1h copy + rename. Έτοιμο για Phase 7+ interactive editing.**

### 2.4 Pure utilities (2 files, ~219 LOC)

| File | LOC | One-liner | Deps | Target path |
|---|---:|---|---|---|
| `hlrEdgeGeometry.ts` | 88 | **GPU Hidden Line Removal** για box edges. Vertex shader (via `onBeforeCompile` on `LineBasicMaterial`) culls back-facing segments per face normal. **PARITY με τεχνικά σχέδια.** | THREE only | `viewport/hlr-edge-geometry.ts` |
| `windowSelectionOverlay.ts` | 131 | DOM rubber-band rectangle. Left-to-right = enclosure (solid blue), right-to-left = crossing (dashed green). Pure DOM, zero Three.js. | — | `viewport/window-selection-overlay.ts` |

**Total: 219 LOC. Effort: ~15 min copy + rename.**

### 2.5 PORT_AS_IS Summary

**15 αρχεία, 2.720 LOC, εκτιμώμενη συνολική εργασία: ~2.5h** (mostly mechanical copy + import adjustments).

---

## 3. PORT_WITH_ADAPTATION (8 files, ~1.706 LOC)

Αυτά τα αρχεία έχουν 1-3 GenArc-specific dependencies που πρέπει να αντικατασταθούν με Nestor equivalents. Algorithm + dataflow μένουν ίδια.

### 3.1 ViewCube main engine (1 file)

| File | LOC | One-liner | GenArc deps to replace |
|---|---:|---|---|
| `viewCube.ts` | 385 | Main ViewCube engine — mini WebGL scene, 160px canvas, raycaster, hover/drag/click handlers, sync με main camera. | `useSiteStore` (north angle) → **callback `getNorthAngleDeg?: () => number`** στο `ViewCubeOptions` |

**Adaptation work** (~30 min):
```typescript
// BEFORE (genarc):
const unsubNorth = useSiteStore.subscribe((state) => {
  northAngleRad = ((state.site?.northAngle_deg ?? 0) * Math.PI) / 180;
});

// AFTER (Nestor):
// In ViewCubeOptions interface, add: getNorthAngleDeg?: () => number;
const northAngleRad = ((opts.getNorthAngleDeg?.() ?? 0) * Math.PI) / 180;
// (Nestor passes static 0 or building.orientation if available)
```

Optional: **remove compass ring entirely** for indoor BIM viewer (north not relevant for interior). Save ~80 LOC + 2 lights. Decision pending Giorgio (Q5).

### 3.2 Section (cross-section panel) (4 files, ~680 LOC)

Phase 7 polish (ADR-366 §4.5). Cross-section cuts τοίχων/κολώνων/πλακών per cutting plane.

| File | LOC | One-liner | GenArc deps to replace |
|---|---:|---|---|
| `sectionIntersect.ts` | 189 | **Pure intersection math** — `intersectEdge`, `intersectQuad`, `wallSection`, `columnSection`, `beamSection`, `slabSection`, `openingSection`, `clipByOpenings`. | GenArc Wall/Column/Beam/Slab/Opening types → **Nestor BIM types** (`WallEntity` from `bim/types/wall-types.ts` κ.λπ.) |
| `sectionGeometry.ts` | 170 | Builds 2D section meshes (filled rects + outlines). Color-codes per element type. Returns `LoupeSceneData`. | Same as above + `LOUPE_COLOR_*` constants → Nestor theme tokens |
| `sectionRenderer.ts` | 245 | Standalone WebGLRenderer + OrthographicCamera για section panel. Pan/zoom/pick. | Only `LoupeSceneData` type (port together με loupe) |
| `sectionSceneSync.ts` | 76 | Wires section renderer to GenArc stores. Synchronous scene rebuild during gizmo drag. | `useBuildingStore` + `useUiStore` → **Nestor scene SSoT + selection SSoT** |

**Adaptation work** (~4h total): Most code is pure math/Three.js. Type imports swap (2h) + store→Nestor selection wiring (2h).

### 3.3 Loupe (structural mini-viewport) (3 files, ~641 LOC)

ADR-024 in GenArc — top-down mini-viewport showing pinned element + its structural connections. Nestor δεν έχει αντίστοιχο. Phase 7+ feature.

| File | LOC | One-liner | GenArc deps to replace |
|---|---:|---|---|
| `loupeGeometry.ts` | 300 | XZ-plan footprint outlines (LineLoops) για κάθε BIM element type. | GenArc Wall/Column/Beam/Slab/Opening types → Nestor BIM types |
| `loupeRenderer.ts` | 274 | Standalone WebGLRenderer (top-down ortho). Mount/unmount/pan/zoom/pick. Same pattern με `sectionRenderer`. | `LoupeSceneData` type (port from loupeGeometry) |
| `loupeSceneSync.ts` | 67 | Wires loupe renderer to GenArc stores. | `useBuildingStore` + `useUiStore` → Nestor SSoT |

**Adaptation work** (~3-4h total).

### 3.4 PORT_WITH_ADAPTATION Summary

**8 αρχεία, 1.706 LOC, εκτιμώμενη συνολική εργασία: ~8h** (type swaps, store wiring).

---

## 4. EXTRACT_CONCEPT (7 files, ~3.733 LOC)

Pattern/algorithm είναι πολύτιμα αλλά implementation είναι heavily coupled με GenArc stores + utils. Reimplementation από το μηδέν χρησιμοποιώντας Nestor SSoT.

### 4.1 NavProxy — Hardware Rasterized BIM Scene (2 files, ~598 LOC) ⭐ HIGH VALUE

| File | LOC | One-liner | Why EXTRACT, not PORT |
|---|---:|---|---|
| `navProxy.ts` | 508 | **The non-SDF rasterized 3D viewer.** Builds box meshes για κάθε wall/column/beam/slab/opening. Render modes: solid / wireframe / solid+edges / **HLR (Hidden Line Removal)** / ΠΚΓ. Wall trim logic, slab split, opening cutouts. | Couples με `computeWallTrims`, `splitSlabByBeams`, `senazUniforms`, `staircase` proxy. **Algorithm pattern είναι ΑΥΤΟ που χρειαζόμαστε** για ADR-366 SPEC-3D-002 (BIM Elements Renderer) |
| `navProxyStaircase.ts` | 90 | Builds staircase HLR proxy as chain of BoxGeometry per step. | Stair type από GenArc. Nestor stair (ADR-358) έχει διαφορετική geometry. |

**ΓΙΑΤΙ HIGH VALUE**: Είναι ακριβώς ο **rasterizer approach** που επέλεξε ο ADR-366 αντί για SDF. Παρέχει την πλήρη pipeline: BIM entity → BoxGeometry/ExtrudeGeometry → scene → 5 render modes. **Reimplementation pattern** για Nestor `BimToThreeConverter`.

**Reimplementation effort**: ~6-8h. Δομή ίδια (per-element-type builder + composite scene). Adaptation: Nestor BIM types + Nestor BIM geometry helpers (computeWallGeometry, computeColumnGeometry already exist in `bim/geometry/`).

### 4.2 Gizmo Interaction (3 files, ~2.553 LOC) — Phase 7+

| File | LOC | One-liner | Why EXTRACT |
|---|---:|---|---|
| `gizmoController.ts` | 412 | FSM controller — idle/hover/drag lifecycle, raycaster routing, double-click handlers (invert axis, cycle anchor). | Heavy `useUiStore` + `useBuildingStore` + `useTimelineStore` deps. Pattern (FSM with raycaster + per-handle dispatch) είναι valuable. |
| `gizmoDragHandler.ts` | 539 | Drag orchestrator: snapshot → constrained projection (`projectConstrained`) → snap (`SnapResolver.resolveSnapV2`) → `applyMultiDelta3D`. **Single drag = one undo snapshot.** Supports duplicate-on-drag. | Heavy coupling με GenArc utils (multiMoveCapture, applyDelta*, elementDuplicator). |
| `gizmoOverlay.ts` | 1602 | Main gizmo overlay. Visual catalog (axis arrows, plane handles, resize handles, rotate rings, center reticle), positioning (screen-scaling), hover highlights. Updates ανά frame. | Heavy `useUiStore` + GenArc utils. **Visual catalog reusable** με adapter layer. |

**Reimplementation effort για Nestor**: ~15-20h. Phase 7+ priority. Πρόταση: αξιοποίηση Nestor's existing CommandHistory (ADR-031) + grip system + scene SSoT.

### 4.3 Vertex Editing Overlay (2 files, ~607 LOC) — Phase 7+

| File | LOC | One-liner | Why EXTRACT |
|---|---:|---|---|
| `vertexDotsOverlay.ts` | 514 | Industrial vertex/edge-midpoint/face-center markers για selected elements. 8-corner box vertex editing. | Heavy `useUiStore` + `useBuildingStore`. Nestor has its own grip system (`bim/<entity>/<entity>-grips.ts`). |
| `vertexEventHandler.ts` | 93 | Vertex dot click/hover handler. Pairs με vertexDotsOverlay. | Same coupling. |

**Reimplementation effort**: ~6-8h. Πιθανότατα **όχι απαραίτητο** για ADR-366 — Nestor's BIM grip system (ADR-363 Phase 1C) ήδη χειρίζεται vertex editing για walls. Skip unless 3D-specific vertex editing απαιτείται.

### 4.4 Viewport Event Handlers (1 file, ~468 LOC)

| File | LOC | One-liner | Why EXTRACT |
|---|---:|---|---|
| `viewportEventHandlers.ts` | 468 | Central pointer/keyboard event routing. Gizmo priority routing, draw controller wiring, vertex handler, window selection, click vs drag discrimination, double-click detection. | Imports ΟΛΑ τα draw controllers + GenArc utils + stores. |

**Reimplementation pattern**: priority chain → gizmo → vertex → draw tool → selection → default. Useful **only if Phase 7+ implements interactive 3D editing**. For Phase 1-5 (read-only 3D viewer), Nestor's existing canvas handler is sufficient.

### 4.5 EXTRACT_CONCEPT Summary

**7 αρχεία, 3.733 LOC. Reimplementation effort: ~30-40h. Phase 7+ priority μόνο.**

⭐ **Εξαίρεση: navProxy.ts (508 LOC).** Pattern είναι κρίσιμη για Phase 2 (BIM → 3D). Reimplementation effort ~6-8h, υψηλή προτεραιότητα. Αντικαθιστά ή ενισχύει ADR-366 SPEC-3D-002.

---

## 5. EXCLUDE (15 files, ~3.284 LOC)

Αρχεία που είτε Nestor ήδη έχει mature equivalent, είτε είναι GenArc-specific (ΝΟΚ engine, ideal solid, plot/site management).

### 5.1 Drawing controllers (5 files, ~817 LOC) — Nestor has BIM drawing (ADR-363)

| File | LOC | Reason |
|---|---:|---|
| `wallDrawController.ts` | 453 | Nestor: `hooks/drawing/useWallTool.ts` (ADR-363 Phase 1B) |
| `openingDrawController.ts` | 85 | Nestor: `hooks/drawing/useOpeningTool.ts` (ADR-363 Phase 2) |
| `slabDrawController.ts` | 110 | Nestor: `hooks/drawing/useSlabTool.ts` (ADR-363 Phase 3) |
| `columnDrawController.ts` | 70 | Nestor: `hooks/drawing/useColumnTool.ts` (ADR-363 Phase 4) |
| `beamDrawController.ts` | 99 | Phase 5 ADR-363 (pending). Same pattern as wall/column. |

### 5.2 Drawing previews (5 files, ~596 LOC) — Nestor has preview-canvas (ADR-040)

| File | LOC | Reason |
|---|---:|---|
| `wallPreview.ts` | 193 | Nestor: `hooks/drawing/drawing-preview-generator.ts:generateWallPreview` (ADR-363 Phase 1C) |
| `openingPreview.ts` | 91 | Phase 2.5 ADR-363 |
| `slabPreview.ts` | 117 | Phase 3.5 ADR-363 |
| `columnPreview.ts` | 75 | Phase 4.5 ADR-363 |
| `beamPreview.ts` | 120 | Phase 5 ADR-363 |

### 5.3 Snap visuals (1 file, 295 LOC) — Nestor has ProSnapEngineV2

| File | LOC | Reason |
|---|---:|---|
| `snapIndicator.ts` | 295 | Nestor: `snapping/global-snap-engine.ts` (17 snap engines) + visual indicator system |

### 5.4 Move + vertex legacy (2 files, ~186 LOC)

| File | LOC | Reason |
|---|---:|---|
| `moveController.ts` | 93 | Legacy GenArc drag-on-element (XZ + grid snap). Nestor has command-pattern grip movement. |
| `vertexEventHandler.ts` | 93 | Paired με vertexDotsOverlay (EXTRACT_CONCEPT). Excluded if vertex 3D editing not needed. |

### 5.5 ΝΟΚ / Greek building code visuals (3 files, ~970 LOC) — Out of scope ADR-366

| File | LOC | Reason |
|---|---:|---|
| `plotOverlay.ts` | 603 | Site boundary, ΡΓ (road line), ΟΓ (building setback line) per GenArc PlotSite. Greek ΝΟΚ engine territory. |
| `plotAdjacentLayer.ts` | 139 | Adjacent plots semi-transparent boxes. ΝΟΚ-specific. |
| `ideaToStereoOverlay.ts` | 228 | "Ιδεατό Στερεό" (ideal solid) per ΝΟΚ Gate 22 — vertical + sloped 1:1.5 envelope. ΝΟΚ-specific. |

### 5.6 EXCLUDE Summary

**15 αρχεία, 2.864 LOC. Zero effort. Documented for completeness.**

---

## 6. Coordinate System Alignment

GenArc και Nestor 3D viewer χρησιμοποιούν **την ίδια Y-up convention** (ADR-009 GenArc + ADR-366 §4.2 Nestor). Καμία adaptation στα coordinate transforms στα viewport files.

| Convention | X | Y | Z |
|---|---|---|---|
| GenArc + Nestor 3D | Ανατολή → | Ύψος ↑ | Βορράς ↓ |

Πλήρης συμβατότητα. Direct port χωρίς transforms στα viewport modules.

---

## 7. License Audit (SOS N.5)

Όλα τα GenArc viewport modules είναι:
- **Custom code Γιώργου Παγώνη** (no third-party derivatives).
- **Dependencies: μόνο Three.js** (MIT) → ήδη approved.

**License risk: ZERO.** Copy + port χωρίς προβλήματα IP/license.

---

## 8. Port Execution Plan (Phase 4 ADR-366)

### 8.1 Sub-phase 4.1 — Foundation (1.5h)

Copy + rename 15 PORT_AS_IS files σε `bim-3d/viewport/`:
1. Core 6 files (camera, tumble, animation, framing, POI, snap detector)
2. ViewCube 3 PORT_AS_IS files (mesh, overlay, highlight)
3. Gizmo 4 PORT_AS_IS files (builders, geometry, handle-builders, hit-test)
4. HLR + windowSelection 2 files

Adjust imports: `@/constants/viewport.constants` → `@/subapps/dxf-viewer/bim-3d/viewport/viewport.constants` κ.λπ.

### 8.2 Sub-phase 4.2 — ViewCube adaptation (30 min)

Port `viewCube.ts` με αλλαγή: `useSiteStore.subscribe` → `getNorthAngleDeg` callback option. Optional: remove compass ring.

### 8.3 Sub-phase 4.3 — Constants port (1h)

Port `constants/viewport.constants.ts` + `constants/gizmo.constants.ts` (and any required transitive constants for ViewCube mesh, like font names, padding factors). Pure constants, copy as-is.

### 8.4 Sub-phase 4.4 — Type definitions (1h)

Port relevant types from `types/viewport.types.ts` + `types/gizmo.types.ts`:
- `ViewportCamera`, `ProjectionMode`, `SpeedModifier`, `CameraKeyframe`, `AnimationTickCallback`, `CanonicalViewDef`
- `GizmoHandleId`, `GizmoAxis`, `GizmoResizeMode`, `GizmoDragConstraint`, `GizmoRotateSpace`

Δεν χρειάζονται αλλαγές — pure interfaces.

### 8.5 Sub-phase 4.5 — React integration (3-4h)

Wire to ADR-366 architecture:
- `bim-3d/components/ThreeViewport.tsx` instantiates `createViewportCamera` + `createViewCube` + `createPoi`
- Connect to `ViewMode3DStore` toggle (mode `'2d' ↔ '3d'`)
- RAF loop: `camera.update()` + `viewCube.sync()` + `poi.updateFade()` + `renderer.render()`

### 8.6 Sub-phase 4.6 — Tests (1.5h)

Jest pure-math tests για:
- `viewportFraming` — bounds → camera distance (perspective + ortho)
- `viewSnapDetector` — canonical view detection thresholds
- `viewCubeHighlight` — face/edge/corner zone computation
- `viewportAnimation` — easing curve + interpolation
- `coordinateTransforms` (when ported in SPEC-3D-004C)

**Total Phase 4 effort: 8-10h** (was estimated 6h in ADR-366 §4.5 → refined upward με actual catalog data).

---

## 9. Deferred to Future Sub-Phases

| Feature | Source files | Sub-Phase |
|---|---|---|
| Section cross-cut panel | sectionGeometry/Intersect/Renderer/SceneSync | Phase 7.1 (~4-6h) |
| Structural loupe mini-viewport | loupeGeometry/Renderer/SceneSync | Phase 7.2 (~3-4h) |
| Interactive 3D gizmo editing | gizmoController/DragHandler/Overlay + vertexDots* | Phase 7.3 (~15-20h, EXTRACT_CONCEPT) |
| Hardware-rasterized BIM scene με HLR | navProxy/navProxyStaircase | **Phase 2 alternative path** (~6-8h, EXTRACT_CONCEPT) — αντικαθιστά SPEC-3D-002 ή την ενισχύει |

---

## 10. Open Questions

### Q1 — Compass ring στο ViewCube για indoor BIM viewer;

**A) Κράτα compass ring** (N/E/S/W) — useful για outdoor reference αν το BIM περιλαμβάνει site context.
**B) Drop compass ring** — indoor BIM viewer, north irrelevant. Save ~80 LOC + 2 lights + raycaster targets.

*Πρόταση: **B** — drop. Nestor BIM viewer focus = interior, εκτός αν στο μέλλον προστεθεί site context (Phase 9+).*

---

### Q2 — Hardware rasterizer (navProxy) ως πρωτεύουσα Phase 2 pipeline ή ως alternative;

**A) Primary** — αντικατάστησε SPEC-3D-002 `BimToThreeConverter` με port του `navProxy` pattern. Battle-tested στο GenArc (5+ render modes έτοιμα: solid / wireframe / solid+edges / HLR / ΠΚΓ).
**B) Alternative path** — κράτα τη δικιά μας SPEC-3D-002 + offer navProxy port ως Phase 7+ optimization.

*Πρόταση: **A**. Είναι working code, 508 LOC, με HLR shader integration. Πιο γρήγορο από scratch SPEC-3D-002 implementation. Adaptation: swap GenArc types με Nestor BIM types.*

---

## 11. Changelog

| Ημ/νία | Αλλαγή | Author |
|---|---|---|
| 2026-05-19 | **Initial draft v1.0** — Full catalog of 45 viewport files. 15 PORT_AS_IS + 8 ADAPT + 7 EXTRACT + 15 EXCLUDE. Phase 4 effort revised 6h → 8-10h. 2 open questions (compass, navProxy primary vs alt). | Claude Opus 4.7 |
