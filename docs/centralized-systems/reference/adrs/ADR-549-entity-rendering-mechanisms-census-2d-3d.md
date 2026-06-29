# ADR-549: Απογραφή & SSoT Audit μηχανισμών Rendering οντοτήτων (2D + 3D, BIM + DXF)

| Πεδίο | Τιμή |
|---|---|
| **Status** | ✏️ DRAFT |
| **Date** | 2026-06-29 |
| **Last Updated** | 2026-06-29 |
| **Category** | Canvas & Rendering |
| **Location** | `src/subapps/dxf-viewer/` (`rendering/`, `bim/renderers/`, `canvas-v2/`, `bim-3d/`) |
| **Author** | Claude (έρευνα κατόπιν εντολής Giorgio) |
| **Related ADRs** | ADR-040 (2D preview canvas perf), ADR-366 (3D BIM viewer), ADR-029 (Canvas V2), ADR-363 (BIM 2D leaves), ADR-408/417/436 (BIM entity families), ADR-535/537/542/543/544/545 (2D↔3D SSoT overlays), ADR-539 (per-face appearance) |

---

## Summary

Η υποεφαρμογή `/dxf/viewer` διαθέτει **δύο διακριτές μηχανές απόδοσης οντοτήτων (rendering pipelines)**:

- **A) 2D Canvas pipeline** — HTML5 Canvas 2D. Ένα κεντρικό dispatch (`EntityRendererComposite`) με **~38 entity renderers** (14 DXF-folder + 24 BIM-folder), συν bitmap cache, preview/ghost, grips, overlays, UI, layer & structural-overlay μηχανισμούς.
- **B) 3D Three.js pipeline** — WebGL. Scene-sync → **~19 entity-level converters** (18 BIM + 1 DXF) στο `bim-3d/converters/`, συν gizmo, placement ghosts, materials/lighting, post-FX, shared 2D↔3D overlays.

**Αρχιτεκτονική καταμέτρηση πυρήνα:** 2 pipelines · ~57 entity-level renderers/converters συνολικά (38 σε 2D + 19 σε 3D).
**Πλήρης απογραφή αρχείων:** ~101 αρχεία στο 2D layer · ~81 στο 3D layer (περιλαμβάνει helpers, overlays, infra — βλ. πίνακες).

Σκοπός του ADR: να είναι η **χάρτα (census) του render layer** — κάθε μελλοντική αλλαγή/προσθήκη rendering ξεκινά από εδώ (SSoT-first, αποφυγή νέου παράλληλου μηχανισμού). Περιλαμβάνει **SSoT audit** με επιβεβαιωμένα κοινά SSoT και εντοπισμένα ρίσκα διπλασιασμού.

---

## Context

Ο Giorgio ζήτησε βαθιά βουτιά: **πόσοι μηχανισμοί rendering οντοτήτων υπάρχουν** για BIM + DXF οντότητες στους 2D + 3D καμβάδες. Ο λόγος είναι αρχιτεκτονικός — όταν δουλεύουν πολλοί agents παράλληλα στον ίδιο render layer, ο κίνδυνος είναι να φτιαχτεί **νέος παράλληλος μηχανισμός** αντί να επεκταθεί ο υπάρχων (παραβίαση SSoT, N.0/N.12).

Χωρίς ενιαία χάρτα, η ερώτηση «υπάρχει ήδη renderer για αυτή την οντότητα;» απαντιόταν ad-hoc. Αυτό το ADR απαντά μία φορά, με ακριβείς αριθμούς επιβεβαιωμένους από τον κώδικα (dispatch tables διαβασμένα, όχι εκτίμηση).

**Θεμελιώδης διαχωρισμός (ADR-040 §1 / ADR-366 §1):** το 2D pipeline και το 3D pipeline είναι **σκόπιμα ανεξάρτητα**. Το 3D mode είναι additive overlay· το 2D `DxfCanvas` παραμένει άθικτο. Δεν συγχωνεύονται σε ένα engine — αλλά **μοιράζονται κώδικα στα overlays** (grips/crosshair/snap/HUD).

---

## 1. Census — 2D Canvas Pipeline

### 1.1 Κεντρικό dispatch
| Μηχανισμός | Path | Ρόλος |
|---|---|---|
| `DxfRenderer` | `canvas-v2/dxf-canvas/DxfRenderer.ts` | Orchestrator: scene → culling → layer props → ενιαία render call |
| `EntityRendererComposite` | `rendering/core/EntityRendererComposite.ts` | **SSoT dispatch** — `Map<type, renderer>` (~42 type keys → ~38 renderers) |
| `BaseEntityRenderer` | `rendering/entities/BaseEntityRenderer.ts` | Abstract base (transforms, grips, phase) — κληρονομούν όλοι |
| `RendererRegistry` | `rendering/core/RendererRegistry.ts` | Registry lookup |
| `CoordinateTransforms` | `rendering/core/CoordinateTransforms.ts` | worldToScreen / screenToWorld SSoT |

### 1.2 DXF entity renderers (`rendering/entities/`) — 14 concrete (μέσω composite)
`LineRenderer`, `CircleRenderer`, `ArcRenderer`, `PolylineRenderer` (+`lwpolyline` alias), `EllipseRenderer`, `RectangleRenderer` (+`rect` alias), `HatchRenderer`, `TextRenderer` (+`mtext` alias), `DimensionRenderer` (10 variants), `XLineRenderer`, `RayRenderer`, `PointRenderer`, `SplineRenderer`, `AngleMeasurementRenderer`.

> ⚠️ Υπάρχει **και** `rendering/entities/StairRenderer.ts` στον δίσκο, αλλά το composite εγγράφει το `bim/renderers/StairRenderer` ως `'stair'` (βλ. §4 audit).

### 1.3 BIM entity renderers (`bim/renderers/`) — 24 μέσω composite / 28 αρχεία
Μέσω composite: `WallRenderer`, `OpeningRenderer`, `SlabRenderer`, `SlabOpeningRenderer`, `ColumnRenderer`, `BeamRenderer`, `FoundationRenderer`, `RailingRenderer`, `RoofRenderer`, `FloorFinishRenderer`, `WallCoveringRenderer`, `ThermalSpaceRenderer`, `SpaceSeparatorRenderer`, `FurnitureRenderer`, `StairRenderer`, `MepFixtureRenderer`, `MepSegmentRenderer`, `MepFittingRenderer`, `MepManifoldRenderer`, `MepRadiatorRenderer`, `MepBoilerRenderer`, `MepWaterHeaterRenderer`, `MepUnderfloorRenderer`, `ElectricalPanelRenderer`.
**Εκτός composite (scene-level / άλλο path):** `OpeningTagRenderer`, `FloorplanSymbolRenderer`, `MepWireRenderer`, `EnvelopeRenderer` (βλ. §4 audit).

### 1.4 Bitmap cache & performance
| Μηχανισμός | Path | Ρόλος |
|---|---|---|
| `dxf-bitmap-cache.ts` | `canvas-v2/dxf-canvas/dxf-bitmap-cache.ts` | Dual-buffer normal-state cache (ADR-040 Phase D)· **όχι** hover/selection/grip στο key |
| `dxf-canvas-renderer.ts` | `canvas-v2/dxf-canvas/dxf-canvas-renderer.ts` | renderScene callback + scheduler registration |
| `dxf-viewport-culling.ts` | `canvas-v2/dxf-canvas/dxf-viewport-culling.ts` | Skip εκτός-οθόνης οντοτήτων |
| `UnifiedFrameScheduler` | `rendering/core/UnifiedFrameScheduler.ts` | RAF orchestrator (όλα τα draws σε ΕΝΑ callback) |

### 1.5 Preview / ghost renderers
`PreviewRenderer` (`canvas-v2/preview-canvas/PreviewRenderer.ts`), `preview-entity-renderers.ts`, `preview-dimension-renderer.ts`, `bim-preview-render.ts` (WYSIWYG μέσω των ΠΡΑΓΜΑΤΙΚΩΝ renderers), `ghost-entity-renderer.ts`, και per-family ghosts (`opening-ghost-renderer`, `slab-opening-ghost-renderer`, MEP/`ElectricalPanel` ghosts).

### 1.6 Grips (Facade)
`UnifiedGripRenderer` (`rendering/grips/UnifiedGripRenderer.ts`) + 4 sub: `GripShapeRenderer`, `GripSizeCalculator`, `GripColorManager`, `GripInteractionDetector`.

### 1.7 Overlays / paint helpers (`canvas-v2/preview-canvas/`)
`tracking-paint`, `ghost-face-dim-paint`, `wall-hud-paint`, `polar-tracking-line-paint`, `alignment-guide-paint`, `polar-disk-paint`, `rect-grid-paint`, `overlay-text-style`, `overlay-line-style`, `preview-render-labels`, `overlay-projector` (ADR-544 projector seam).

### 1.8 UI / guides / dimension overlays
`GridRenderer`, `RulerRenderer`, `OriginMarkersRenderer`, `UIRendererComposite`, `UIRenderer` (`rendering/ui/`)· `guide-renderer`, `guide-markers-renderer`, `guide-annotations-renderer` (`systems/guides/`)· `dim-arrowhead-renderer`, `dim-text-renderer` (`rendering/entities/dimension/`)· `center-mark-renderer` (`systems/dimensions/`).

### 1.9 Layer canvas
`LayerRenderer`, `SelectionRenderer`, `layer-polygon-renderer`, `layer-grid-ruler-renderer` (`canvas-v2/layer-canvas/`).

### 1.10 Structural overlays (scene-level BIM passes)
`dxf-renderer-structural-overlays.ts` (σοβάς + member reinforcement), `dxf-foundation-reinforcement-overlay.ts`, `dxf-slab-reinforcement-overlay.ts`, `column-renderer-overlays.ts`.

---

## 2. Census — 3D Three.js Pipeline

### 2.1 Scene management
| Μηχανισμός | Path | Ρόλος |
|---|---|---|
| `ThreeJsSceneManager` | `bim-3d/scene/ThreeJsSceneManager.ts` | Orchestrator (scene/renderer/render-loop/lighting/camera) |
| `BimViewport3D.tsx` | `bim-3d/viewport/BimViewport3D.tsx` | React mount + UnifiedFrameScheduler |
| `BimSceneLayer.ts` | `bim-3d/scene/BimSceneLayer.ts` | `THREE.Group` builder/updater (single + multi-floor) |
| `scene-manager-sync.ts` | `bim-3d/scene/scene-manager-sync.ts` | High-level sync wrappers (BIM/DXF/visibility) → `scene-manager-actions` |

### 2.2 BIM→mesh entity converters (`bim-3d/converters/`) — 18 entity-level
| Converter | Οντότητες |
|---|---|
| `BimToThreeConverter.ts` | Walls + opening cutouts + finish skin |
| `bim-three-structural-converters.ts` | Columns, Beams (box + I/H swept) |
| `bim-three-slab-converter.ts` | Slabs (floor/ceiling/roof) |
| `StairToThreeConverter.ts` | Treads/risers/stringers/landings |
| `roof-to-three.ts` | Roof decks (faces/ridge/eave/tiles) |
| `foundation-to-three.ts` | Footings/mats |
| `railing-to-three.ts` | Guardrails/balusters |
| `EnvelopeToThree.ts` | Curtain walls/frames/reveals |
| `floor-finish-to-three.ts` | Floor finishes |
| `bim-three-point-converters.ts` | Fixtures, panels, manifolds, radiators, boilers, water-heaters (6) |
| `mep-segment-to-mesh.ts` | Pipes/ducts |
| `mep-fitting-to-mesh.ts` | Elbows/tees/reducers |
| `mep-wire-to-three.ts` | Electrical wires |
| `mep-underfloor-to-three.ts` | Underfloor loops |
| `furniture-to-three.ts` | Generic furniture |
| `dxf-text-3d.ts` | DXF text σε 3D |

Συν **shared geometry/builders** (όχι entity-level, helpers): `bim-three-shape-helpers`, `bim-three-faced-prism` (ADR-539 per-face), `bim-three-edges`, `mesh-to-object3d`, `mesh-slope-shear`, `wall-*-geometry`, `opening-mesh*`, `roof-*`, `structural-finish-*`, rebar builders (`column-/beam-/slab-/footing-/joint-/linear-member-rebar-3d`, `rebar-3d-shared`).

### 2.3 DXF→3D
`DxfToThreeConverter.ts` — raw CAD underlay (lines/arcs/circles/text grouped by color → `LineSegments`).

### 2.4 Shared 2D↔3D overlays (μοιράζονται 2D κώδικα)
`BimGripOverlay2D` (→ `UnifiedGripRenderer`), `BimCrosshairOverlay3D` (→ `CrosshairCompositor`, ADR-545), `BimSnapIndicatorOverlay3D` (→ `SnapIndicatorGlyph`, ADR-542), `WallHudOverlay3D` (→ `paintWallHudCore`), `Tracking3DOverlay` (→ `paintAlignmentPaths`), `BimPlacementOverlay2D`, `DynamicInput3DLeaf` (→ RadialCommandRing), `DxfHoverGlowOverlay2D`. Mount: `BimViewport3DCanvasOverlays.tsx`.

### 2.5 Placement ghosts
`placement-ghost-overlay.ts` (**SSoT** unlit + post-FX) + `WallPlacementGhost`, `ColumnPlacementGhost`, MEP ghosts (×7), `FurniturePlacementGhost`, `BeamFromWallGhost`, `OpeningHostWallPreview`, `ProposalGhost3DOverlay`.

### 2.6 Gizmo (editing)
`bim-gizmo-overlay` + `-handles` + `-markers`, `gizmo-geometry`, `gizmo-hit-test`, drag bridges (`bim-gizmo-drag-bridge`, `bim3d-endpoint-move`, `-vertical-move`, `-tilt-bridge`, `-resize-bridge`, `-snap-bridge`).

### 2.7 Materials / lighting / post-FX
`MaterialCatalog3D` (PBR + per-category depth-bias SSoT), `face-appearance-material`, `bim-texture-cache`, `user-material-registry`· lighting modulators (`idle`/`quality`/`shadow`/`ssao`, `envmap-generator`, `apply-light-preset`, `lighting-presets`)· `post-fx-overlay-pass` (AO-immune forward pass).

### 2.8 Sync / perf
`scene-manager-actions`, `scene-render-frame`, `scene-setup`, `bim3d-resync`, `dxf-overlay-resync`, `bim-scene-structural-finish-sync`, `bim-scene-attach-syncs`, `bim-scene-joint-rebar-sync`, `sync-mep-elements`, `sync-circuit-wires`, `bim-scene-point-syncs`, `monolithic-slab-clip`· perf: `scene-render-stats`, `PerformanceCollector`, `PerformanceHUDExpanded`, `BimEntityRaycaster`.

---

## 3. Καταμέτρηση

| Επίπεδο | 2D | 3D | Σύνολο |
|---|---|---|---|
| **Entity-level renderers/converters** | ~38 (14 DXF + 24 BIM) | ~19 (18 BIM + 1 DXF) | **~57** |
| Κύρια dispatch/orchestration | 5 | 4 | 9 |
| Preview/ghost | ~10 | ~12 | ~22 |
| Grips/gizmo | 5 | 7 | 12 |
| Overlays/paint/UI/guides | ~22 | ~8 (shared) | ~30 |
| Materials/lighting/post-FX | — | ~12 | ~12 |
| Infra/cache/sync/perf | ~10 | ~16 | ~26 |
| **Σύνολο αρχείων (περίπου)** | **~101** | **~81** | **~182** |

**Κύρια απάντηση:** **2 pipelines** (2D Canvas + 3D Three.js), **~57 entity-level μηχανισμοί** απόδοσης οντοτήτων, εντός ~182 συνολικών αρχείων render layer.

---

## 4. SSoT Audit

### 4.1 ✅ Επιβεβαιωμένα κοινά SSoT (καλή πρακτική — διατήρηση)
- **Grips:** ΕΝΑΣ `UnifiedGripRenderer` ζωγραφίζει 2D **και** 3D (`BimGripOverlay2D` reuse, ADR-535).
- **Crosshair:** `CrosshairCompositor` πυρήνας → 2D thin wrapper + `BimCrosshairOverlay3D` (ADR-545).
- **Snap markers:** `SnapIndicatorGlyph` κοινό → `BimSnapIndicatorOverlay3D` (ADR-542).
- **Wall HUD / tracking / placement:** `paintWallHudCore` / `paintAlignmentPaths` κοινά 2D↔3D.
- **Placement ghosts:** `placement-ghost-overlay.ts` ΕΝΑ SSoT για κάθε translucent ghost (ADR-537).
- **Z-fighting/depth-bias:** per-category bias στο `MaterialCatalog3D` (ένα σημείο).
- **2D dispatch:** ΕΝΑ `EntityRendererComposite` map — όχι σκορπισμένα `switch`.
- **Geometry ανά οντότητα (επιβεβαιωμένο 2026-06-29):** κάθε entity έχει `bim/geometry/{entity}-geometry.ts` (`computeColumnGeometry`/`computeBeamGeometry`/`computeSlabGeometry`) που υπολογίζει το geometry **μία φορά**, cached στο `entity.geometry.footprint.vertices`. Ο 2D renderer (αμιγώς drawing) **και** ο 3D converter διαβάζουν το **ίδιο** field — **όχι** διπλός υπολογισμός. (Ανέτρεψε την αρχική υπόθεση «διπλό geometry» του ADR-550.)

### 4.2 ⚠️ Ρίσκα / ευκαιρίες ενοποίησης
1. **~~Διπλό `StairRenderer`~~ → ΛΥΘΗΚΕ (2026-06-29, ADR-550 Φ4).** Το `rendering/entities/StairRenderer.ts` ήταν re-export shim (`export * from '../../bim/renderers/StairRenderer'`, ADR-363 Φ0.5 μετακίνηση) — **κανένα call-site** (grep: όλες οι χρήσεις δείχνουν στο `bim/renderers/StairRenderer`). **Διαγράφηκε.** Canonical: `bim/renderers/StairRenderer.ts`.
2. **4 BIM renderers εκτός του ενιαίου 2D dispatch — ΤΕΚΜΗΡΙΩΘΗΚΑΝ (2026-06-29).** Δεν εγγράφονται στο `EntityRendererComposite` γιατί **δεν είναι per-entity dispatch targets** — είναι σκόπιμα διαφορετικοί μηχανισμοί:
   - **`OpeningTagRenderer`** — **sub-renderer μέσα στο `OpeningRenderer`** (`static tagRenderer`, γρ. 150)· το tag ζωγραφίζεται ως μέρος του opening, όχι ως αυτόνομη οντότητα.
   - **`EnvelopeRenderer`** — **dedicated overlay** `components/dxf-layout/EnvelopeOverlay.tsx` (`new EnvelopeRenderer(ctx)`, scene-level layer).
   - **`MepWireRenderer`** — **function-based** (`drawCircuitWires`), scene-level overlay `components/dxf-layout/HomeRunWiresOverlay.tsx`· τα home-run wires είναι derived geometry, όχι persistent entity.
   - **`FloorplanSymbolRenderer`** — class `extends BaseEntityRenderer` (ADR-415 Φ1)· **δεν εντοπίστηκε ενεργό call-site** (ούτε composite ούτε overlay) → πιθανό dormant/partial Φ1· εκκρεμεί επιβεβαίωση πριν θεωρηθεί ενεργό.
3. **Καμία ενιαία entity-type registry 2D↔3D** — το 2D dispatch (`EntityRendererComposite` map) και το 3D dispatch (`scene-manager-actions` + converters) είναι **ανεξάρτητα**. Δεν υπάρχει εγγύηση ότι μια νέα οντότητα αποκτά ΚΑΙ 2D renderer ΚΑΙ 3D converter. **Σύσταση:** ένα type-coverage test (ένα `EntityType` union → assert ύπαρξη και στα δύο dispatch) ή SSoT registry module.
4. **DXF text διπλό path** — `TextRenderer` (2D) vs `dxf-text-3d.ts` (3D): δύο ανεξάρτητες υλοποιήσεις glyph (αναμενόμενο λόγω Canvas2D vs WebGL, αλλά να μη διαφύγουν διαφορές μετρικών).
5. **Ghost διπλασιασμός 2D vs 3D** — 2D ghosts (`*-ghost-renderer`) vs 3D `placement-ghost-overlay`: διαφορετικά seams ανά διάσταση· ευκαιρία για κοινό «ghost spec» abstraction μακροπρόθεσμα.

### 4.3 Σύσταση χρήσης (για agents)
- **Νέα οντότητα 2D** → εγγραφή στο `EntityRendererComposite.initializeRenderers()` (νέος renderer που κληρονομεί `BaseEntityRenderer`). **Ποτέ** νέο dispatch.
- **Νέα οντότητα 3D** → converter στο `bim-3d/converters/` + wiring στο `scene-manager-actions`. Reuse `bim-three-shape-helpers` / `placement-ghost-overlay` / `MaterialCatalog3D`.
- **Νέο overlay (snap/grip/HUD/crosshair)** → reuse τον υπάρχοντα 2D πυρήνα μέσω projected canvas overlay (πρότυπο ADR-535/542/545). **Ποτέ** νέα 3D-only υλοποίηση.

---

## Changelog

### 2026-06-29 — Αρχική απογραφή & SSoT audit (DRAFT)
**Πλαίσιο:** Εντολή Giorgio για βαθιά καταγραφή όλων των μηχανισμών rendering οντοτήτων (2D+3D, BIM+DXF) στο `/dxf/viewer`.

**Μέθοδος:** Glob/Read σε `rendering/entities/`, `bim/renderers/`, `bim-3d/converters/`· ανάγνωση των dispatch SSoT (`EntityRendererComposite.ts` map, `scene-manager-sync.ts`/`scene-manager-actions`) για ακριβείς αριθμούς (όχι εκτίμηση).

**Αποτέλεσμα:** 2 pipelines · ~57 entity-level renderers/converters (38 σε 2D + 19 σε 3D) · ~182 συνολικά render αρχεία. Εντοπίστηκαν 5 ρίσκα/ευκαιρίες SSoT (διπλό StairRenderer, 4 BIM renderers off-composite, απουσία ενιαίας 2D↔3D type registry, διπλό DXF-text path, ghost διπλασιασμός).

**Επόμενα (προτεινόμενα, εκτός scope τρέχουσας εντολής):** (1) dead-code έλεγχος `rendering/entities/StairRenderer.ts`· (2) 2D↔3D entity-type coverage test· (3) σύντομη τεκμηρίωση των off-composite scene-level renderers.

### 2026-06-29 — Διόρθωση & follow-up (ADR-550 Φ0/Φ3)
**Διόρθωση:** προστέθηκε στο §4.1 το επιβεβαιωμένο εύρημα ότι το geometry είναι **ήδη SSoT ανά οντότητα** (cached, κοινό 2D/3D) — ανέτρεψε την αρχική υπόθεση «διπλό geometry» του ADR-550.
**Follow-up:** το coverage test του finding #3 (§4.2) **υλοποιήθηκε** ως ADR-550 Φ3 (`rendering/contract/__tests__/entity-render-coverage.test.ts`, 7 GREEN), με canonical `RenderableEntityType` (Φ0).

**ADR-550 Φ4 (cleanup):** finding #1 **λύθηκε** (διαγραφή orphan `rendering/entities/StairRenderer.ts`)· finding #2 **τεκμηριώθηκε** (οι 4 off-composite = sub-renderer / overlays / function-based, βλ. §4.2). Νέο εκκρεμές: επιβεβαίωση call-site `FloorplanSymbolRenderer` (πιθανό dead-code).

### 2026-06-29 — ADR-550 Φ2 (contract registry + point auto-wiring)
**Follow-up:** το dispatch-fragmentation εύρημα (§4.2 finding #2 — «3D imperative loops, εύκολο να ξεχαστεί συμμετρία») **μετριάστηκε δομικά** ως ADR-550 Φ2: δηλωτικό `EntityRenderContract` registry (`d2/d3/d3Builder`) + auto-wiring των 11 ομοιόμορφων point-entity 3D builders μέσα από ΕΝΑ registry (`bim-scene-point-contracts.ts`), αντί 11 χειροκίνητων `BimSceneLayer.sync*()` μεθόδων. Coverage test +5 asserts δένει declaration↔execution. Βλ. ADR-550 Changelog.
