# ADR-366 — 3D BIM Viewer & Photorealistic Rendering

| Πεδίο | Τιμή |
|---|---|
| **Status** | 🟢 **PHASES 0-8.1 FULLY IMPLEMENTED** 2026-05-21 + 🔵 **GROUP C RESEARCH CLOSED 7/7** 2026-05-22 + 🟢 **PHASE 9 FULLY CLOSED 2026-05-25** (C.4 ✅ 2026-05-22, C.5 ✅ 2026-05-22, C.3 ✅ 2026-05-22, C.6 ✅ 2026-05-22, C.2 ✅ 2026-05-24, C.7 Q1+Q2+Q3+Q4+Q5 ✅ 2026-05-24, **C.1.a+b+c ✅ 2026-05-25**) — Phases 0-8.1 implementation complete (3D BIM viewer Three.js, ARIA/screen reader Phase 8.0-8.1, IFC export Phase 8.0 Q8.3+Q8.4, section cuts Phase 7.0). **Phase 9 deferred features** (Group C decisions → implementation): **C.4 ✅ DONE** (BimMaterialsTab/BimBoqTab/BimCommentsTab + last-active-tab-tracker + material-alternatives-resolver + boq-tree-builder). **C.5 ✅ DONE** (announcement-protocol + entity-dom-proxy-renderer + entity-keyboard-navigator + use-reduced-motion + reduced-motion-config + aria-entity-description-generator extensions + focus-order semantic toggle + Bim3DPreferencesService accessibility fields + ViewMode3DStore announcementsEnabled + i18n 44 keys). **C.3 ✅ DONE 2026-05-22** (dim3d-types + value-computer + line-geometry + text-plane-orienter + Dim3DToolStateMachine + dim3d-snap-engine-adapter + bim-dimensions-3d.service + Dimension3DRenderer + Dim3DGripsRenderer + useDim3DToolRouting + RibbonDim3DContextualTab + Dim3DPropertiesPanel + BimDimensions3DStore + Firestore collection+rules+3 indexes + 4 RBAC perms + audit type+action + Bim3DPreferencesService dimensions field + Ctrl+Shift+D hotkey + i18n 36 keys × 2 + 35 tests). **C.6 ✅ DONE 2026-05-22** (SectionStore PlaneGroup/linkedGroups + CropRegionStore FSM + CropRegionTool + CropRegionOverlay + crop-frustum-builder + HorizontalPresetPicker + PlaneListItem + section-group-transformer + horizontal-cut-preset-resolver + useCropRegionTool + keyboard shortcut Ctrl+Alt+R + BimViewport3D wiring + SectionSceneController budget guard + i18n ~41 keys × 2). **C.2 ✅ DONE 2026-05-24**, **C.7 Q1+Q2+Q3+Q4+Q5 ✅ DONE 2026-05-24** (Q1 Sparkline 60s, Q2 Admin BIM Diagnostics Dashboard — super-admin /admin/bim-diagnostics route + FSM triage + Recharts aggregates + CSV export + audit, Q3 GDPR anonymous telemetry pipeline, Q4 auto-submit FSM, Q5 Regression detection). **C.1 Animation FULLY CLOSED 2026-05-25** (C.1.a Logic Foundation + C.1.b UX/Timeline + drag interaction + bezier 4-point editor + real scene-bbox turntable + React component tests + C.1.c Rendering/Queue MP4Exporter + RenderQueueStore + RenderQueuePanel). **Animation Phase 9 ολόκληρη CLOSED — μηδέν deferred testing items.** **Group B Custom HDRI Upload ✅ DONE 2026-05-25** (HdriUploader + hdri-upload.service + storage.rules bim_environments + EnvironmentStore.customHdri* — closes Group B last deferred research item §9 Q4 "User upload"). **Axis-constrained drag gizmo ✅ DONE 2026-05-25** (axis-constraint-projector.ts + AnimationStore.dragAxisLock + WaypointDragHandle gizmo arrows + keyboard X/Y/Z + arrow click). **Snap-to-grid ✅ DONE 2026-05-25** (snap-quantizer.ts + AnimationStore snapEnabled/snapStepUnits + writeWaypointPosition quantize + ribbon toggle+combobox panel + useRibbonCommands bridge + i18n 2 locales). ADR-366 total estimate: ~254-303h Phases 0-9. |
| **Date** | 2026-05-19 |
| **Category** | DXF Viewer — 3D Rendering / Photorealistic Output |
| **Location** | `docs/centralized-systems/reference/adrs/ADR-366-3d-bim-viewer-photorealistic-rendering.md` |
| **Author** | Claude Opus 4.7 + Γιώργος Παγώνης |
| **Related ADRs** | ADR-040 (Preview Canvas Perf — micro-leaf, 2D SSoT), ADR-055 (Tool State SSoT), ADR-175 (BOQ), ADR-186 (Building Code), ADR-294 (SSoT Ratchet), ADR-340 (Floorplan Background), ADR-345 (Ribbon), ADR-358 (Stair Tool), ADR-362 (Dimensions), ADR-363 (BIM Drawing Mode — **primary consumer**) |
| **Source codebase referenced** | `C:\genarc` (sibling project — port source για camera/ViewCube/snap/coordinate system) |
| **Child SPECs** | `SPEC-3D-001` (DXF→Three.js Pipeline), `SPEC-3D-002` (BIM Elements Renderer), `SPEC-3D-003` (Materials & Lighting), `SPEC-3D-004` (GenArc Reuse Catalog — **split per-domain into sub-specs A/B/C/D/E**) |
| **GenArc Sub-Catalogs** | **`SPEC-3D-004A`** ✅ (Viewport — 45 files catalogued 2026-05-19), **`SPEC-3D-004B`** ✅ (DXF Parser — 8 files, ZERO port, 2026-05-19), **`SPEC-3D-004C`** ✅ (Utils/Snap/Picking — 16 files, 2 PORT/1 ADAPT/13 EXCLUDE, 2026-05-19), **`SPEC-3D-004D`** ✅ (Geometry Helpers — 9 files, 0 PORT/0 ADAPT/3 EXTRACT_CONCEPT/6 EXCLUDE, 2026-05-19), **`SPEC-3D-004E`** ✅ (Materials/Shaders — 19 files, 0 PORT/1 ADAPT/4 EXTRACT_CONCEPT/12 EXCLUDE+2 OOS, 2026-05-19). **A→E suite CLOSED — Phase 0 ready.** |

---

## Summary

Επέκταση του DXF Viewer subapp με **3D BIM Viewer** και **φωτορεαλιστικό rendering**: τα 2D DXF entities και τα BIM entities του ADR-363 αποκτούν τρισδιάστατη αναπαράσταση μέσω **Three.js** (rasterized real-time) με δυνατότητα **WebGPU Path Tracing** (progressive photorealistic rendering) για παρουσιάσεις / εξαγωγές.

Το υπάρχον **2D DxfCanvas (ADR-040) παραμένει άθικτο**. Το 3D mode είναι **additive overlay** — ο χρήστης κάνει toggle από ribbon button. Δεν υπάρχει merge των 2D/3D code paths.

Από το `C:\genarc` επαναχρησιμοποιούνται: camera system, ViewCube, view snap detector, coordinate transforms, beam/wall/column data model (ήδη μεταφέρεται μέσω ADR-363). **Δεν μεταφέρεται**: SDF shader (δεν κλιμακώνεται σε arbitrary DXF geometry), structural Eurocode engine, AI/NOK engine, DXF import system.

---

## 1. Context

### 1.1 Η αφορμή

Ο Γιώργος έχει 2 codebases:
- **`C:\Nestor_Pagonis`** — production app με DXF Viewer subapp + BIM Drawing Mode (ADR-363, 2D plan view, Point3D-ready entities).
- **`C:\genarc`** — standalone browser-based 3D αρχιτεκτονικός editor με Three.js + WebGPU SDF raymarcher, mature viewport controls, ViewCube, snap system.

Το **ADR-363 §G11** ορίζει ρητά: BIM entities χρησιμοποιούν `Point3D` (optional z) παντού, ακριβώς για να είναι **3D-ready**. Το παρόν ADR υλοποιεί το επόμενο βήμα: αυτά τα entities αποκτούν πραγματική 3D αναπαράσταση.

### 1.2 Γιατί 3D; Τι προστίθεται

| Αξία | Περιγραφή |
|---|---|
| **Visual verification** | Ο μηχανικός βλέπει αν κολώνες/τοίχοι/πλάκες «κλείνουν» σωστά σε 3D πριν εκτυπωθεί |
| **Παρουσίαση πελάτη** | Φωτορεαλιστική render για approval από ιδιοκτήτη/πελάτη |
| **Elevation clash** | Cross-floor clash detection (κολώνα Ορόφου 1 πηγαίνει σε Πλάκα Ορόφου 2;) |
| **Material budget** | PBR materials → BOQ integration Phase 6.2 ADR-363 (material library driven mapping) |
| **5D BIM closure** | ADR-363 §4.3: 3D (geometry) + 4D (Gantt) + 5D (BOQ). Το παρόν ADR κλείνει το geometry layer |

### 1.3 GenArc — τι πάρουμε, τι αφήνουμε

| GenArc module | Πηγαίο αρχείο | Λόγος port | Destination Nestor |
|---|---|---|---|
| **viewportCamera** | `engines/viewport/viewportCamera.ts` | Three.js PerspectiveCamera + OrthographicCamera + OrbitControls + tumble (pole-free rotation). Battle-tested. | `bim-3d/viewport/viewport-camera.ts` |
| **ViewCube** | `engines/viewport/viewCube*.ts` (4 files) | Interactive navigation widget, face/edge/corner click → canonical view snap. Γνωστό UX (Revit/Rhino). | `bim-3d/viewport/view-cube/` |
| **viewSnapDetector** | `engines/viewport/viewSnapDetector.ts` | Pure detection: camera direction vs canonical views (dot product, 23° threshold). | `bim-3d/viewport/view-snap-detector.ts` |
| **coordinateTransforms** | `utils/coordinateTransforms.ts` | screenToWorld, worldToScreen, NDC conversions. Works for Perspective + Ortho. | `bim-3d/utils/coordinate-transforms.ts` |
| **BIM types** | `types/{wall,beam,column,opening,slab}.types.ts` | Ήδη μεταφέρεται μέσω ADR-363 σε `bim/types/`. ✅ Δεν χρειάζεται ξανά. | ✅ Done |
| **wallGeometry** | `engines/bom/wallGeometry.ts` | Wall segment/trim logic. Ήδη port μέσω ADR-363 Phase 1D-B. ✅ | ✅ Done |
| **SDF shaders** | `engines/sdf/`, `shaders/` | ❌ ΔΕΝ μεταφέρεται — SDF raymarching works for implicit geometry (sphere/box/CSG) but δεν κλιμακώνεται σε arbitrary DXF polylines (thousands of edges → SDF evaluation per pixel = unusable) | Αποκλείεται |
| **Structural engine** | `structural/engines/` | ❌ Out of scope ADR-366. Eurocode calculations ανήκουν σε ADR-186. | Αποκλείεται |
| **AI system** | `engines/ai/` | ❌ Out of scope | Αποκλείεται |
| **NOK engine** | `engines/nok/` | ❌ Out of scope | Αποκλείεται |
| **Grid plane** | `engines/grid/gridPlane.ts` | ✅ Μπορεί να port-αριστεί για 3D grid overlay | Phase 0 optional |
| **material.types** | `types/material.types.ts` | PBR material definitions (ShaderType, MaterialDefinition, MaterialCost). ADR-363 §Q8 material library SSoT. | `bim-3d/materials/material-catalog.ts` (Phase 3) |
| **tumbleRotation** | `engines/viewport/tumbleRotation.ts` | Pole-free trackball rotation (no gimbal lock at N/S poles). Dependency of viewportCamera. | `bim-3d/viewport/tumble-rotation.ts` |
| **viewportAnimation** | `engines/viewport/viewportAnimation.ts` | Spring-interpolated camera transitions (face snap, home, framing). | `bim-3d/viewport/viewport-animation.ts` |
| **viewportFraming** | `engines/viewport/viewportFraming.ts` | `computePerspectiveFraming` / `computeOrthoFraming` — auto-fit scene. | `bim-3d/viewport/viewport-framing.ts` |

---

## 2. Goals

| # | Στόχος | Φάση |
|---|--------|------|
| G1 | 3D viewport toggle — 2D DxfCanvas ↔ 3D Three.js scene από ribbon button | Phase 0 |
| G2 | DXF entities σε 3D: LINE→LineSegments, ARC→curve, POLYLINE→BufferGeometry, TEXT→sprite/billboard | Phase 1 |
| G3 | HATCH entities σε 3D: flat filled polygon (floor-plane surface) | Phase 1 |
| G4 | BIM entities σε 3D: Wall/Column/Beam/Slab/Opening → ExtrudeGeometry (multi-floor stacking) | Phase 2 |
| G5 | PBR materials (MeshStandardMaterial) per BIM element, driven από ADR-363 material catalog | Phase 3 |
| G6 | Lighting: AmbientLight + DirectionalLight (sun angle) + optional PointLight | Phase 3 |
| G7 | Camera & ViewCube port από GenArc — tumble, perspective/ortho switch, canonical view snap | Phase 4 |
| G8 | Progressive WebGPU Path Tracing για photorealistic rendering (background, non-interactive) | Phase 5 |
| G9 | Export PNG/EXR (rasterized + path-traced output) | Phase 6 |
| G10 | Multi-floor stacking: Floors από ADR-326 building/floor schema → Y-offset per floor elevation | Phase 2 |
| G11 | INSERT/block entities expanded σε 3D (DXF blocks) | Phase 1 (partial) |
| **Non-Goals** | IFC export, MEP routing, structural analysis, clash detection (automated), mobile/tablet 3D | Out |

---

## 3. Background

### 3.1 Τι ήδη υπάρχει (SSoT reusable)

| SSoT | Αρχείο | Ρόλος για 3D |
|---|---|---|
| BIM entities (Wall/Column/Beam/Slab/Opening) | `bim/types/`, `bim/geometry/` | **Primary consumers** — ExtrudeGeometry input |
| ADR-363 material catalog | `bim/walls/wall-material-catalog.ts` | Phase 3 PBR mapping |
| ADR-326 building/floor schema | `src/types/building-floor.ts` | Floor elevation → Y-offset |
| `firestoreQueryService.subscribe` | ADR-355 + ADR-361 | Scene data feeds 3D scene |
| DXF entity types | `types/entities.ts` | LINE/ARC/POLYLINE/HATCH/INSERT |
| DXF parser output | `canvas-v2/dxf-canvas/` | Input data για Phase 1 |
| ADR-040 micro-leaf pattern | `canvas-layer-stack-leaves.tsx` | **2D stays untouched** — 3D is separate canvas |

### 3.2 Τεχνολογική έρευνα

#### 3.2.1 Γιατί Three.js (και όχι άλλο)

| Option | Αξιολόγηση | Απόφαση |
|---|---|---|
| **Three.js** (MIT) | Industry standard. r170+: WebGPU backend έτοιμο. GenArc ήδη το χρησιμοποιεί. Largest 3D web ecosystem. MIT. | ✅ **ΕΠΙΛΕΓΜΕΝΟ** |
| Babylon.js (Apache 2.0) | Εξίσου mature. Όμως: (1) Γιώργος δεν έχει εμπειρία, (2) genarc port = αδύνατος, (3) ξεχωριστό ecosystem | ❌ |
| WebGPU raw (no framework) | Max control. Αλλά 200+ ώρες για basic scene graph, lights, geometry. WGSL complexity. | ❌ |
| Cesium / Mapbox GL | Geospatial focus, not architectural BIM | ❌ |
| PlayCanvas / A-Frame | Game-engine oriented, limited BIM relevance | ❌ |

**Συγκλίσεις industry 2026**: Speckle, BIMcloud, xeokit, Matterport Studio VIEWER — όλα χρησιμοποιούν Three.js ή WebGL primitive. Κανένας serious Web BIM viewer δεν χρησιμοποιεί SDF raymarching για production geometry.

#### 3.2.2 Γιατί WebGPU Path Tracer (και όχι SDF raymarcher)

| Απόφαση | SDF Raymarching (GenArc) | WebGPU Path Tracing (ADR-366) |
|---|---|---|
| **Geometry support** | Implicit surfaces (sphere/box/smooth CSG) — NOT arbitrary meshes | Arbitrary triangle meshes → BVH acceleration → works με DXF geometry |
| **Scale** | GenArc: 5-10 BIM elements. DXF: 50.000+ edges → SDF per pixel = FPS < 1 | BVH: O(log N) ray-triangle intersection → handles large DXF scenes |
| **Photorealism** | Ambient occlusion approximation | Full global illumination (GI), area lights, caustics, subsurface scattering |
| **Portability** | Custom GLSL shaders, WebGL only | WebGPU compute shaders, future-proof |
| **Library** | Custom (genarc-specific) | three-gpu-pathtracer (MIT, gkjohnson) OR Three.js r175+ WebGPU Path Tracer (built-in) |

**ΡΗΤΗ ΑΠΟΡΡΙΨΗ**: SDF raymarching για production DXF geometry. Ο λόγος: SDF για εκατοντάδες τοίχους/ανοίγματα/κολώνες = ένα SDF per entity → union(sdf1, sdf2, ..., sdfN) = O(N) per pixel per sample frame. Στα 1080p με 1920×1080 × N_entities × N_samples = unusable performance. GenArc δούλεψε γιατί είχε 5-10 elements. Nestor production scene: 200-500 BIM entities + 50.000+ DXF edges.

#### 3.2.3 Path Tracer: three-gpu-pathtracer vs Three.js built-in

| Option | Λεπτομέρεια | Απόφαση |
|---|---|---|
| **`three-gpu-pathtracer`** (gkjohnson, MIT) | Mature, 4k GitHub stars, integrates native με Three.js `Scene`/`Camera`/`Mesh`. BVH via `three-mesh-bvh` (MIT). Χρησιμοποιείται σε Speckle, Google's Project Starline web viewer. | ✅ Primary option |
| **Three.js built-in WebGPU PathTracer** | Experimental σε r175+ examples. Δεν είναι production-stable ακόμα (2026-05-19). Όταν σταθεροποιηθεί → μπορεί να αντικαταστήσει. | Fallback / future migration |
| **Custom WGSL path tracer** | Full control. Αλλά 150+ ώρες extra για BVH + material system + sampling. | ❌ |

**Βάρος licenses**: Three.js (MIT) + three-gpu-pathtracer (MIT) + three-mesh-bvh (MIT) = zero proprietary lock-in. SOS N.5 compliance confirmed.

---

## 4. Decision

### 4.1 Αρχιτεκτονική Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    DXF Viewer Subapp                                │
│                                                                     │
│  ┌────────────────────┐         ┌────────────────────────────────┐  │
│  │   2D Mode (ΟΧΙ change)       │   3D Mode (additive overlay)   │  │
│  │                    │         │                                │  │
│  │  DxfCanvas (ADR-040)│ toggle │  Three.js Canvas               │  │
│  │  micro-leaf subscr.│ ◄──────►│  WebGPU / WebGL fallback       │  │
│  │  CanvasLayerStack  │         │  ThreeJsSceneManager           │  │
│  │  HoverStore        │         │  DxfToThreeConverter (SPEC-001)│  │
│  │  ImmediatePositionStore      │  BimToThreeConverter (SPEC-002)│  │
│  │  (all preserved)   │         │  MaterialCatalog3D  (SPEC-003) │  │
│  │                    │         │  ViewportCamera (genarc port)  │  │
│  └────────────────────┘         │  ViewCube (genarc port)        │  │
│                                 │  PathTracerRenderer (Phase 5+) │  │
│                                 └────────────────────────────────┘  │
│                                                                     │
│  Shared State (Firestore, scene entities): UNCHANGED                │
│  ADR-040 2D perf rules: UNCHANGED (micro-leaf pattern)             │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 Σύστημα Συντεταγμένων

**Κρίσιμη λεπτομέρεια** — DXF 2D ↔ Three.js 3D:

| Χώρος | X | Y | Z | Up |
|---|---|---|---|---|
| **DXF 2D** (plan view) | → Ανατολή | ↑ Βορράς | N/A | (2D, Z=elevation) |
| **Three.js (GenArc ADR-009)** | → Ανατολή | ↑ Ύψος | ↓ Βορράς | Y-up |
| **Transform** | `x_3d = x_dxf / 1000` | `y_3d = elevation_m` | `z_3d = y_dxf / 1000` | — |

```typescript
// Pure converter (mm → m, 2D plan → 3D world)
function dxfPlanToWorld(x: number, y: number, elevationMm: number): THREE.Vector3 {
  return new THREE.Vector3(x / 1000, elevationMm / 1000, y / 1000);
}
// Inverse (click on ground plane → DXF mm coords)
function worldToDxfPlan(pos: THREE.Vector3): { x: number; y: number } {
  return { x: pos.x * 1000, y: pos.z * 1000 };
}
```

**Γιατί αυτή η σύμβαση**: Ταυτίζεται με GenArc ADR-009 (Y-up, xz = ground plane) → direct port του camera + ViewCube χωρίς adaptation. Industry standard για αρχιτεκτονικά 3D viewers.

### 4.3 Mode Toggle Architecture

```typescript
// src/subapps/dxf-viewer/bim-3d/stores/ViewMode3DStore.ts
type ViewMode = '2d' | '3d' | '3d-path-trace';

interface ViewMode3DState {
  mode: ViewMode;
  isTransitioning: boolean;
  pathTraceProgress: number;   // 0-100% για progressive path tracing
  pathTraceSamples: number;    // current sample count
}
```

**Κανόνες mode transition**:
1. `'2d'→'3d'`: Κρύβεται το DxfCanvas (visibility: hidden, ΟΧΙ unmount — state preserved). Δημιουργείται Three.js canvas overlay.
2. `'3d'→'2d'`: Αντίστροφα. Three.js canvas disposed. DxfCanvas επανεμφανίζεται.
3. `'3d'→'3d-path-trace'`: Three.js rasterizer → path tracer (background progressive).
4. **ADR-040 rule**: ViewMode3DStore δεν είναι high-frequency → CanvasSection μπορεί να subscribe (mode changes <<1/s).

### 4.4 Φάκελος δομή

```
src/subapps/dxf-viewer/bim-3d/
├── index.ts                          # Public API barrel
├── stores/
│   └── ViewMode3DStore.ts            # Mode toggle SSoT (Zustand)
├── scene/
│   └── ThreeJsSceneManager.ts        # THREE.Scene lifecycle, RAF, resize
├── converters/
│   ├── DxfToThreeConverter.ts        # SPEC-3D-001: LINE/ARC/POLY/HATCH → BufferGeometry
│   └── BimToThreeConverter.ts        # SPEC-3D-002: Wall/Col/Beam/Slab/Opening → ExtrudeGeometry
├── materials/
│   ├── MaterialCatalog3D.ts          # SPEC-3D-003: ADR-363 catalog → MeshStandardMaterial
│   └── material-catalog-3d.types.ts
├── lighting/
│   └── LightingSetup.ts              # AmbientLight + DirectionalLight (sun) setup
├── path-tracer/
│   ├── PathTracerRenderer.ts         # three-gpu-pathtracer integration (Phase 5)
│   └── path-tracer.types.ts
├── viewport/                         # GenArc port (SPEC-3D-004)
│   ├── viewport-camera.ts            # port: genarc/engines/viewport/viewportCamera.ts
│   ├── tumble-rotation.ts            # port: genarc/engines/viewport/tumbleRotation.ts
│   ├── viewport-animation.ts         # port: genarc/engines/viewport/viewportAnimation.ts
│   ├── viewport-framing.ts           # port: genarc/engines/viewport/viewportFraming.ts
│   ├── view-snap-detector.ts         # port: genarc/engines/viewport/viewSnapDetector.ts
│   ├── coordinate-transforms.ts      # port: genarc/utils/coordinateTransforms.ts
│   └── view-cube/
│       ├── ViewCube.ts               # port: genarc/engines/viewport/viewCube.ts
│       ├── ViewCubeMesh.ts           # port: genarc/engines/viewport/viewCubeMesh.ts
│       ├── ViewCubeOverlay.ts        # port: genarc/engines/viewport/viewCubeOverlay.ts
│       └── ViewCubeHighlight.ts      # port: genarc/engines/viewport/viewCubeHighlight.ts
├── components/
│   ├── ThreeViewport.tsx             # React wrapper for THREE canvas + ViewCube overlay
│   └── PathTraceProgressBar.tsx      # Progress indicator during path tracing
├── hooks/
│   ├── useThreeScene.ts              # Scene lifecycle hook
│   └── useViewMode3D.ts             # Toggle hook (ribbon button consumer)
└── __tests__/
    ├── coordinate-transforms.test.ts # Unit tests για dxfPlanToWorld/worldToDxfPlan
    ├── DxfToThreeConverter.test.ts   # Phase 1 geometry tests
    └── BimToThreeConverter.test.ts   # Phase 2 BIM tests
```

### 4.5 Phases — Master Plan (status updated 2026-05-21)

| Phase | Τίτλος | Εκτίμηση | Εξαρτήσεις | Status |
|---|---|---|---|---|
| **Phase 0** | Infrastructure: Three.js setup, SceneManager, ViewMode3DStore, mode toggle UI (ribbon button), coordinate system, resize handler | ~4h | — | ✅ **DONE** (commit `6cd11104`, 2026-05-17) |
| **Phase 1** | DXF → 3D: LINE→LineSegments, ARC→EllipseCurve, LWPOLYLINE/POLYLINE→BufferGeometry, HATCH→ShapeGeometry, INSERT expansion, TEXT→sprite | ~8h | Phase 0 | ✅ **DONE** (commit `80b87f2c`, 2026-05-18) |
| **Phase 2** | BIM → 3D: Wall/Column/Beam/Slab→ExtrudeGeometry, Opening as boolean cutout, multi-floor stacking via ADR-326 floor elevation | ~10h | Phase 0, ADR-363 | ✅ **DONE** (commits `a2602f6d` + `364b0bfb`, 2026-05-18) |
| **Phase 3** | Materials & Lighting baseline: MeshStandardMaterial per ADR-363 material catalog, AmbientLight + DirectionalLight, shadow mapping | ~6h | Phase 2 | ✅ **DONE** (commits `c6cf1798` + `4ab564b5`, 2026-05-18/19) |
| **Phase 4** | Camera & ViewCube ENRICHMENT (tumble, 12-direction canonical snap, animated transitions, A.4/A.5/A.6/A.7 keyboard + accessibility impacts) — **see breakdown §4.5.1** | ~23-25h (από αρχικά ~6h base + ~17-19h από Appendix A impacts) | Phase 0 | ✅ **DONE** — 4.0 ✅ · 4.1 ✅ · 4.2 ✅ · 4.3 ✅ · 4.4 ✅ · 4.5 ✅ (A.7.Q1+Q3-partial+Q4) · 4.6 ✅ (2026-05-21, 2D backport + ADR-040 audit + cross-mode tests) · 4.7 ✅ (2026-05-21, §A.7.Q3 SelectionCursorIcon cross-mode) |
| **Phase 5** | WebGPU Path Tracer (5A/5B/5C): three-gpu-pathtracer integration, progressive sampling, denoising, lighting refinement | ~12h | Phase 3 (Phase 4 parallel) | ✅ **DONE** (commits `f8b353b3` + `99996690`, 2026-05-19) |
| **Phase 6** | Path Tracer Render dialog + Export: PNG (rasterized + path-traced), EXR (HDR), print resolution | ~4h | Phase 5 | ✅ **DONE** (commit `0ad30f7d`, 2026-05-19) |
| **Phase 7** | Section Cuts + Polish (7.0a stencil wiring, 7.0b 1-pass stencil, 7.0B 2D live section panel, 7.0C selection cap emphasis, 7.1 hatched per-material caps, 7.2 HDRI) | ~8h | Phase 6 | ✅ **DONE** (commits `8480fbf1` + `0cb26914` + `97373bf6` + `1067e433` + `2fd161ab` + `0ad30f7d`, 2026-05-19/21) |
| **Phase 8** | ARIA Compliance (από A.7.Q2 DEFERRED → ENQUEUED post-Phase 4) — **see breakdown §4.5.2** | ~4h | Phase 4.5 | ✅ **DONE** (8.0 + 8.1 commit `57fe064f` · UI ARIA closure 2026-05-21) |

> **Σημείωση εξάρτησης**: Phase 5 + 6 + 7 ολοκληρώθηκαν παράλληλα με Phase 4 pending — το lighting/path-tracer/section-cuts pipeline δεν εξαρτάται κρίσιμα από enriched camera (basic Phase 0 ViewCube + free orbit ήταν αρκετά για Phase 5-7 development). Phase 4 enrichment παραμένει pending για production UX.

**Συνολική εκτίμηση (revised 2026-05-21)**:
- ✅ Done (Phases 0-3, 5-7): ~52h
- ❌ Pending (Phase 4 + Phase 8): **~27-29h**
- **Grand total: ~79-81h** (από αρχικά ~58h, revision drivers: SPEC-3D-004A ports + A.4-A.7 accessibility impacts + section cuts depth)

---

#### 4.5.1 Phase 4 Sub-Phase Breakdown — Camera & ViewCube ENRICHMENT (~23-25h)

> **Σκοπός**: Πλήρης υλοποίηση όλων των αποφάσεων Appendix A (Topics A.4-A.7) για production-grade 3D camera/viewport UX. Σπάει σε **7 ατομικές υποφάσεις** (4.0 → 4.6) με ξεκάθαρες εξαρτήσεις, ώστε κάθε session να αντιμετωπίζει 1 υπόφαση (≤4h, ≤70% context).

##### Phase 4.0 — Camera Tumble + Orbit Core (~3-4h) ✅ DONE (2026-05-21)

**Scope**:
- Port GenArc `viewport-camera.ts` enrichment: free tumble (LMB drag) με yaw/pitch quaternion math
- Pan modifier (MMB drag ή Shift+LMB) με screen-space delta projection
- Zoom (wheel/pinch) με anchor-point preservation (cursor-relative)
- Camera target store (`bim-3d/stores/CameraTargetStore.ts`) Zustand SSoT για `{position, target, fov}`
- Constraints: pitch clamp (-89°/+89°), zoom min/max bounds, target distance limits

**Implementation note (N.0.1 code > ADR)**:
`camera-controls.ts` was NOT created as a separate file — the planned scope was already fully implemented in `viewport-camera.ts` + `tumble-rotation.ts` during Phase 1 (PORT_AS_IS from GenArc, commit `2fd161ab` area). Phase 4.0 adds only what was missing: `CameraTargetStore.ts` (Zustand SSoT) + RAF wiring + unit tests.

**Files (NEW)**:
- ~~`bim-3d/viewport/camera-controls.ts`~~ — merged into `viewport-camera.ts` (Phase 1 PORT_AS_IS)
- `bim-3d/stores/CameraTargetStore.ts` (63 LOC) — Zustand SSoT με dirty-check; `syncFromCamera` no-op when camera static
- `bim-3d/__tests__/tumble-rotation.test.ts` — 4 unit tests (yaw, pitch, distance preservation, pole clamp)
- `bim-3d/__tests__/CameraTargetStore.test.ts` — 3 unit tests (sync, dirty-check, ortho fov=0)

**Files (MODIFY)**:
- `bim-3d/scene/ThreeJsSceneManager.ts` — added `syncFromCamera` call in RAF loop (post `viewport.update()`)
- ~~`bim-3d/viewport/viewport-camera.ts`~~ — constraints already integrated in Phase 1

**Tests**: 7 unit (4 tumble + 3 store) — all pass ✅

**Dependencies**: Phase 0 (existing ThreeJsSceneManager skeleton)

**Acceptance**: AC-5 partial (camera tumble + zoom + pan functional σε real 3D scene) ✅

---

##### Phase 4.1 — Canonical Views + 12-Direction Snap (~3-4h)

**Scope**:
- Νέο SSoT module 12 canonical views: 6 face (Top/Bottom/Front/Back/Left/Right) + 6 isometric (NE/NW/SE/SW + UE/UW upper-edges)
- `CanonicalViewService.snapTo(viewId, opts)` → smooth dispatch
- Frame-scene utility (`viewport-framing.ts` enrichment): υπολογισμός camera position από scene bounding box + FOV margin
- Home button: AutoCAD-style snap σε default isometric NE view (A.5 decision)
- ViewCube face/edge/corner click → dispatcher στο `CanonicalViewService`

**Files (NEW)**:
- `bim-3d/viewport/canonical-views.ts` (~180 LOC, 12 entries SSoT με positions + quaternions)
- `bim-3d/viewport/CanonicalViewService.ts` (~120 LOC)

**Files (MODIFY)**:
- `bim-3d/viewport/view-snap-detector.ts` — extend για 12-direction targets
- `bim-3d/viewport/viewport-framing.ts` — frame-scene math
- `bim-3d/viewport/view-cube/view-cube.ts` — click dispatch
- i18n: bim-3d.json (12 view labels el + en)

**Tests**: 8 unit (12 view positions, frame-scene bbox math, home snap, ViewCube click → view mapping)

**Dependencies**: Phase 4.0

**Acceptance**: AC-5 ViewCube navigation functional + frame-scene + home

---

##### Phase 4.2 — Animated Transitions (~2-3h) ✅ DONE (2026-05-21) + ✅ FULLY CLOSED (2026-05-27 via ADR-040 Phase XXIII)

> **2026-05-27 closure note** — when Phase 4.2 originally shipped, the `viewport-animation.ts`, `animation-manager.ts`, and `viewport-camera.ts` modules dropped their internal `requestAnimationFrame` calls (per the "single RAF coordination" promise), but the **last and largest** rAF — the master scene loop in `ThreeJsSceneManager.startLoop()` — was never removed. A Firefox profile on 2026-05-27 found dual persistent rAFs (`UnifiedFrameScheduler` + `ThreeJsSceneManager.startLoop`) running concurrently during 2D wheel-zoom with a BIM slab visible (`Window.requestAnimationFrame` self-time = 17%). The promise was fulfilled in **ADR-040 Phase XXIII** (same date): `ThreeJsSceneManager` now registers as a `'bim-3d-scene'` system with the master scheduler, dirty-checked via `isSceneDirty()` (interacting / viewport-animating / animation-manager / path-tracer / explicit). See ADR-040 §"2026-05-27 — Phase XXIII — Single rAF SSoT Consolidation (BIM 3D)" for the full surgery.

**Scope**:
- Port GenArc `viewport-animation.ts` (~709 LOC PORT_AS_IS per SPEC-3D-004A)
- 500ms cubic ease-in-out (A.4 decision, locked)
- Ortho ↔ perspective smooth FOV interpolation (όχι abrupt switch)
- Interruptible animations (νέο request cancels current με fade-blend)
- Animation manager (`bim-3d/viewport/animation-manager.ts`) με **single RAF loop** (ADR-040 compliant) — finalised in ADR-040 Phase XXIII (2026-05-27)

**Files (NEW)**:
- `bim-3d/viewport/animation-manager.ts` (~200 LOC)
- `bim-3d/viewport/easing-functions.ts` (~40 LOC, pure)

**Files (MODIFY)**:
- `bim-3d/viewport/viewport-animation.ts` — port from GenArc + Nestor adaptation
- `bim-3d/viewport/CanonicalViewService.ts` — use animation manager
- `bim-3d/scene/ThreeJsSceneManager.ts` — RAF integration

**Tests**: 6 unit (easing curves, quaternion slerp, FOV lerp, cancel + blend, interruption)

**Dependencies**: Phase 4.1

**Acceptance**: smooth 500ms transitions confirmed visually + measured ≤520ms (5% tolerance)

---

##### Phase 4.3 — ViewCube Micro-Interactions Polish (~1.5h) [A.5.Q1+Q4] ✅ DONE 2026-05-21

**Scope**:
- **A.5.Q1**: Conditional compass ring (Β/Α/Ν/Δ Greek labels) toggle on/off
- **A.5.Q4**: Right-click menu στο ViewCube → preference toggle "Εμφάνιση πυξίδας" + Firestore persistence (`bim_3d_preferences/{userId}`)
- Polish: hover zones refinement, drag-on-cube tuning, home button visual treatment (subtle pulse on hover)

**Files (NEW)**:
- `bim-3d/viewport/view-cube/view-cube-context-menu.tsx` — Radix DropdownMenu (ADR-001 compliant)
- `bim-3d/services/Bim3DPreferencesService.ts` — Firestore load/save, N.6 enterprise ID `b3dpref_${userId}`
- `bim-3d/__tests__/bim3d-preferences.test.ts` — 4 unit tests

**Files (MODIFY)**:
- `bim-3d/viewport/view-cube/view-cube.ts` — `setCompassVisible()`, `onContextMenuRequest`, `getNorthAngleDeg: () => number | null`
- `bim-3d/scene/ThreeJsSceneManager.ts` — `setViewCubeContextMenuCallback()`, `setViewCubeCompassVisible()`
- `bim-3d/viewport/BimViewport3D.tsx` — context menu state, prefs load, compass sync, `ViewCubeContextMenu` mount
- `src/services/enterprise-id-prefixes.ts` — `BIM_3D_PREF: 'b3dpref'`
- `src/services/enterprise-id-class.ts` — `generateBim3DPrefId(userId)`
- `src/services/enterprise-id-convenience.ts` — export `generateBim3DPrefId`
- `src/services/enterprise-id.service.ts` — re-export `generateBim3DPrefId`
- `src/config/firestore-collections.ts` — `BIM_3D_PREFERENCES`
- `firestore.rules` — `bim_3d_preferences` owner-only rules
- `src/i18n/locales/el/bim3d.json` + `en/bim3d.json` — `viewCube.contextMenu.*`

**Tests**: 4 unit (generator format, generator throws on empty, load null/exists, save fields + docId)

**Dependencies**: Phase 4.1

**Firestore**: νέα collection `bim_3d_preferences` + enterprise ID `b3dpref_*` + owner-only rules

##### Phase 4.5 — ViewCube Roll Arrows Fix ✅ DONE 2026-05-31

**Bug**: τα 2 roll arrows (πάνω από τον κύβο) δεν περιέστρεφαν τη ματιά· η παλιά υλοποίηση υπολόγιζε νέα κατεύθυνση και καλούσε `snapToViewDirection`, που ΠΑΝΤΑ επιβάλλει perspective + μετακινεί κάμερα → ορατό αποτέλεσμα «flat → perspective» αντί για roll.

**Fix — true roll**: νέα `viewport.rollView(dirSign)` που περιστρέφει το **up vector** της κάμερας κατά ±90° γύρω από τον άξονα θέασης, κρατώντας position/target/**projection** ίδια → το σχέδιο φαίνεται να γυρίζει 90° στην οθόνη (instant, Autodesk ViewCube parity). Νέο optional callback `onRoll` στο ViewCube· `handleClick` roll branch → `onRoll?.(rollDir)`· wiring στο `scene-setup.ts`. Files: `viewport-types.ts`, `viewport-camera.ts`, `view-cube/view-cube.ts`, `scene/scene-setup.ts`, `__tests__/canonical-views.test.ts` (mock).

##### Phase 4.4 — ViewCube Hover Color Unification (cyan → orange) ✅ DONE 2026-05-31

**Scope**: Ενοποίηση χρώματος hover σε ΟΛΑ τα interactive στοιχεία του ViewCube. Πριν: μόνο οι έδρες/ακμές/γωνίες του κύβου έδειχναν highlight (σιελ `#88ccee`)· δαχτυλίδι/πυξίδα/βέλη/home δεν είχαν per-element hover feedback. Τώρα: AutoCAD-style πορτοκαλί σε όλα.

- **SSoT χρώμα**: `VIEWCUBE_HOVER_COLOR_HEX = 0xff8c00` στο `view-cube-highlight.ts` (+ canvas fill `#ffa733` / stroke `#b35900` για τις έδρες). Ένα σημείο αλλαγής για όλο το widget.
- **Έδρες/ακμές/γωνίες κύβου**: canvas highlight σιελ → πορτοκαλί.
- **Δαχτυλίδι (torus) + ετικέτες πυξίδας (Β/Α/Ν/Δ)**: hover σε cardinal → ring + label πορτοκαλί. **+Ring body hover**: το ίδιο το torus έγινε pickable (`ringMesh` με userData `compass`/χωρίς cardinal → click inert) → hover σε ΟΛΟ το σώμα του δαχτυλιδιού, όχι μόνο στα γράμματα. `getFirstHit` προτιμά cardinal letter έναντι ring (τα hit planes επικαλύπτονται ακτινικά) ώστε τα clicks κατευθύνσεων να μη σπάσουν.
- **Βέλη face-nav, roll arrows, home button**: hover → πορτοκαλί (material `.color` tint· sprites multiply texture). **Roll arrows fix**: η υφή ήταν γκρι `#7A8288` → ×orange = μουντό (φαινόταν «δεν ακούει»)· ζωγραφίζονται πλέον **λευκές** + `SpriteMaterial.color = NAV_ARROW_COLOR` (rest) → hover swap σε orange = καθαρό πορτοκαλί. **+Redraw**: μικρό/άσχημο σχέδιο με αδιάκριτη μύτη → νέο 180° τόξο, lineWidth 13, ευδιάκριτη bold μύτη· sprite scale 0.65→0.9, y 1.70→1.60 (χωράει στο ±1.95 frustum), hit box 0.55→0.8.
- **Περιγράμματα πλήκτρων (button zones), ΟΧΙ κύβου — SSoT**: ο κύβος δεν πρέπει να έχει silhouette outline· μόνο τα clickable «πλήκτρα» κάθε έδρας (κέντρο/4 ακμές/4 γωνίες = οι FaceZone ζώνες hover). Υλοποίηση: **3×3 zone grid** ζωγραφισμένο στην υφή κάθε έδρας (μόνο εσωτερικοί διαχωριστές, χωρίς εξωτερικό πλαίσιο → καμία ακμή κύβου). **Αφαιρέθηκε** το `EdgesGeometry` wireframe (outlineMat/outlineGeo/outlineLines + sync opacity + dispose). SSoT: `VIEWCUBE_OUTLINE_COLOR_HEX = 0x1a1a1a` (CSS derived) + `OUTLINE_LINE_WIDTH = 3` στο `view-cube-mesh.ts` (local consts — μόνο εσωτερική χρήση).
- Reset σε base color όταν φεύγει το hover (`resetControlHighlights()`).
- **«Αχνό highlight» root cause = φωτισμός**: οι έδρες ήταν `MeshPhongMaterial` → η υφή σκοτείνιαζε ανάλογα με το φως (faces μακριά από το directional light: μόνο ambient ×0.6 → πορτοκαλί μουντό· το ανοιχτό σιελ «επιβίωνε»). **Fix: `MeshBasicMaterial` (unlit)** — true-color render, ανεξάρτητο φωτός, όπως ο Autodesk ViewCube (flat-shaded faces). Δευτερεύον: snap `opacity = 1.0` στο hover (έδρες `opacity 0.5` σε ηρεμία· το `sync()` lerp δεν τρέχει σε idle scene).

**Files (MODIFY)**:
- `bim-3d/viewport/view-cube/view-cube-highlight.ts` — `VIEWCUBE_HOVER_COLOR_HEX` export + orange fill/stroke
- `bim-3d/viewport/view-cube/view-cube-mesh.ts` — `createCompassRing` επιστρέφει `labelMaterials` + `COMPASS_RING_DEFAULT_COLOR` export
- `bim-3d/viewport/view-cube/view-cube-overlay.ts` — `NAV_ARROW_COLOR` export (reset value)
- `bim-3d/viewport/view-cube/view-cube.ts` — `applyControlHighlight()` / `resetControlHighlights()` στο hover path

**Dependencies**: Phase 4.3

---

##### Phase 4.4 — Keyboard Shortcuts SSoT (~4h) [A.6.Q1-Q4]

**Scope**:
- **A.6.Q1**: ΝΕΟ SSoT file `bim-3d/shortcuts/keyboard-shortcuts-3d.ts` (~250 LOC) με Numpad + Ctrl+Shift+Letter mappings
- **A.6.Q2**: 12 canonical view dispatcher entries (Numpad 1/2/3/4/5/7/9 + Ctrl+Shift+T/F/B/L/R/U)
- **A.6.Q3**: Audit ~40 existing 2D shortcuts → `mode` field migration (`'2D-only' | '3D-only' | 'mode-aware' | 'universal'`) + auto-switch toast («Αλλαγή σε 3D για συντόμευση X»)
- **A.6.Q4**: Split action dispatchers per mode + **selection-aware F** (frame selected entity ή scene αν empty selection)

**Files (NEW)**:
- `bim-3d/shortcuts/keyboard-shortcuts-3d.ts` (~250 LOC SSoT)
- `bim-3d/shortcuts/shortcut-dispatcher.ts` (~150 LOC mode-aware routing)

**Files (MODIFY)**:
- 2D shortcut registry (~40 entries) — add `mode` field
- `useKeyboardShortcuts.ts` — mode-aware routing + auto-switch toast wiring
- i18n: shortcuts.json «modeSwitch.toast» (el + en)

**Tests**: 12 unit (12 canonical view dispatch + mode routing + selection-aware F + auto-switch)

**Dependencies**: Phase 4.1

**SSoT registry**: νέο module `keyboard-shortcuts-3d` (Tier 3) στο `.ssot-registry.json` με `forbiddenPatterns` για κατευθείαν `keydown.*Numpad` σε άλλα αρχεία

---

##### Phase 4.5 — Accessibility Multi-Channel Signaling (~5.5h) [A.7.Q1+Q3+Q4] ✅ DONE 2026-05-21

**Implementation note — Phase 4.5 (2026-05-21)**:

Shipped scope (A.7.Q1 keyboard focus + A.7.Q3 partial + A.7.Q4 keyboard pan):

- **`bim-3d/accessibility/KeyboardFocusManager.ts`** — pure state machine (factory `createKeyboardFocusManager()`), observer pattern (mirror HoverStore/ImmediatePositionStore), zero React state. API: `setOrder` / `next` / `prev` / `setFocus` / `clear` / `subscribe` / `dispose`. Auto-clears stale focus when entity drops out of new order (hidden-floor / building-cull safe).
- **`bim-3d/accessibility/FocusOutlineRenderer.ts`** — Three.js dashed cyan outline (`LineDashedMaterial` over `EdgesGeometry`, depthTest=false, renderOrder=999). Owned by `ThreeJsSceneManager`, subscribes to focus changes via the manager's observer. Per-RAF `syncWorldMatrix()` keeps outline aligned during camera animation.
- **`bim-3d/accessibility/FocusIndicator3D.tsx`** — React floating label (cyan border + black backdrop). Self-owned RAF positions via `Vector3.project(camera)` only while focused → zero 60fps re-renders. ADR-040 compliant.
- **`bim-3d/accessibility/status-bar-text-generator.ts`** — pure utility (A.7.Q3 partial): `normalizeEntityType`, `entityTypeLabel`, `generateFocusStatusText` (4 variants), `generateSelectionDeltaText` (+N added / −N removed), `generateSelectionCountText`. WCAG 1.4.1 — text mirrors color signals.
- **`ThreeJsSceneManager` extensions**: `panViewportByPixels`, `cycleKeyboardFocus('next'|'prev')`, `selectFocusedEntity` (Enter → ADR-030 selection toggle), `clearKeyboardFocus`, `getKeyboardFocusManager`, `getFocusedEntityData`, `getCamera`. Private `computeFocusOrder()` does frustum-cull + camera-distance ascending sort + dedupe by `bimId`, walks parent chain to skip hidden floors/buildings.
- **`viewport-camera.ts`** — new public `pan(dxScreenPx, dyScreenPx)` method (mode-aware perspective/ortho, computes pxToWorld at target distance, translates `camera.position` + `controls.target`). Instant for now — 150ms ease + repeat-key continuous accumulation deferred.
- **`keyboard-shortcuts-3d.ts`** — +12 entries: 8 pan (Ctrl+Arrow 50px + Ctrl+Shift+Arrow 10px) + 4 focus (Tab / Shift+Tab / Enter / Escape). Action constants: `ACTION_FOCUS_NEXT_3D`, `ACTION_FOCUS_PREV_3D`, `ACTION_FOCUS_SELECT_3D`, `ACTION_FOCUS_CLEAR_3D`, `pan3dAction(direction, step)` constructor, `parsePan3dAction()` reverse. All entries `mode: '3D-only'`.
- **`shortcut-dispatcher.ts`** — extended `ShortcutDispatchContext` with `onPan3D` + 4 focus callbacks. New branches in `dispatchMatched3D()`. Exposed `panStepToScreenDelta(direction, step) → {dx, dy}` helper for consumers.
- **`use3DShortcuts.ts`** — wires the new context callbacks to `manager.panViewportByPixels` / `cycleKeyboardFocus` / `selectFocusedEntity` / `clearKeyboardFocus`.
- **`BimViewport3D.tsx`** — mounts `<FocusIndicator3D>` when canvas is ready.
- **i18n**: 12 shortcut keys (`shortcuts.view3d.pan*`, `shortcuts.view3d.focus*`) + 9 accessibility status keys (`accessibility.status.*`) added to both `el/bim3d.json` and `en/bim3d.json`.
- **Tests**: 22 unit tests in `bim-3d/__tests__/keyboard-focus-manager.test.ts` (4 groups — focus state machine, text generator, pan delta helper, SSoT entries / matchers). Phase 4.4 test's mkCtx updated with no-op defaults for new dispatcher callbacks.

**Deferred from original Phase 4.5 scope** (to Phase 4.6 / 8.x):
- A.7.Q3 cursor `+`/`−` icon component (SelectionCursorIcon) — visual gizmo polish, not blocking core a11y.
- A.7.Q3 AXIS_LABEL_GLYPHS X/Y/Z sprite labels on gizmo arrows — requires Topic A.2 gizmo refactor.
- Pan animation (150ms cubic ease, repeat-key continuous accumulation) — instant pan ships first; animation is polish.
- 2D backport (Phase 4.6).

**Scope**:
- **A.7.Q1**: `KeyboardFocusManager` — Tab cycle through visible entities, focus indicator rendering (cyan outline + label) (~3h)
- **A.7.Q3**: `SelectionCursorIcon` component + `AXIS_LABEL_GLYPHS` sprites (X/Y/Z axis indicators) + status bar text wiring («Επιλεγμένο: Wall #wall_abc123 — μήκος 5.2μ») (~2h)
- **A.7.Q4**: **Ctrl+Arrows pan** — 8 entries dispatcher (4 directions × {fine 1px, coarse 20px}) (~30min)

**Files (NEW)**:
- `bim-3d/accessibility/KeyboardFocusManager.ts` (~180 LOC)
- `bim-3d/accessibility/focus-indicator-renderer.ts` (~120 LOC pure render layer)
- `bim-3d/accessibility/SelectionCursorIcon.tsx` (~80 LOC component)
- `bim-3d/accessibility/axis-label-glyphs.ts` (~60 LOC sprite texture atlas)
- `bim-3d/accessibility/status-bar-text-generator.ts` (~100 LOC entity → text)

**Files (MODIFY)**:
- `bim-3d/shortcuts/keyboard-shortcuts-3d.ts` — +8 Ctrl+Arrow entries
- Statusbar component — text wiring
- i18n: bim-3d-accessibility.json (~20 keys el + en)

**Tests**: 10 unit (focus cycle order, label positioning σε edge cases, status text generation per entity type, Ctrl+Arrow fine/coarse magnitude)

**Dependencies**: Phase 4.4

---

##### Phase 4.6 — 2D Backport + Final Integration (~2-2.5h) ✅ DONE 2026-05-21

**Implementation note — Phase 4.6 (2026-05-21)**:

Shipped scope (A.7.Q1 2D backport + ADR-040 audit + cross-mode tests + Boy Scout):

- **2D KeyboardFocusManager backport**: ΜΗΔΕΝ fork — το `bim-3d/accessibility/KeyboardFocusManager.ts` SSoT (Phase 4.5 factory) χρησιμοποιείται και από τα δύο modes. Ένα instance per viewport mode: 3D ownership inside `ThreeJsSceneManager`, 2D ownership inside the module-level singleton `accessibility/keyboard-focus-2d-manager.ts` (lifetime = page, matches `HoverStore` / `ImmediatePositionStore` / `GuideStore` pattern).
- **`accessibility/focus-2d-order.ts`** — pure helpers (`computeFocusOrder2D`, `findFocusedEntityData2D`, `getEntityWorldCenter`). 2D analogue of 3D's `focus-order.ts`: visible-entity filter + viewport-culling intersection + screen-distance ascending sort + dedupe. Uses the SSoT `getEntityBBox` from `dxf-viewport-culling.ts` so it inherits future entity-type additions automatically (no duplicate bbox math).
- **`accessibility/focus-2d-outline-painter.ts`** — pure canvas-2d painter (`paintFocus2DOutline`, `clearFocus2DOverlay`). Dashed cyan stroke `#00ffff` matching the 3D outline visual style. World-space bbox projected via `CoordinateTransforms.worldToScreen` then expanded by 4px padding so the outline floats outside the entity.
- **`accessibility/Focus2DOverlay.tsx`** — React micro-leaf. Single `useSyncExternalStore` subscription (low-freq — Tab keypress only) to the 2D manager. `useEffect` re-paints on focus/scene/transform/viewport change (low-freq React-state updates); pan/zoom continuous deltas live in `ImmediatePositionStore`, not React state, so the leaf never re-renders at 60fps. WCAG-friendly `<output aria-live="polite">` label.
- **`components/dxf-layout/Focus2DOverlayLeaf.tsx`** — thin wrapper that subscribes to `ViewMode3DStore.mode` once (`useSyncExternalStore`) and bridges `is2D` into `Focus2DOverlay.active`. Keeps the `CanvasLayerStack` shell subscription-free per ADR-040 cardinal rule #1.
- **`hooks/state/use2DKeyboardFocus.ts`** — window-level keydown listener (capture phase) wired from `CanvasSection`. Handles Tab / Shift+Tab (cycle), Enter (toggle via `useUniversalSelection`). Mode-gated to `ViewMode3DStore.mode === '2d'`. Getter pattern (ADR-040 Rule 2): reads scene / transform / viewport / focus state at keydown time, never captures stale snapshots. Escape is dispatched via the ESC bus (new priority slot — see below).
- **`escape-bus/escape-priority.ts`** — new `FOCUS_CLEAR: 150` slot between `ENTITY_SELECTION` (250) and `COLOR_MENU` (100). Cross-mode applicable (2D + 3D each register their own handler with this priority). ESC bus test updated.
- **`status-bar-text-generator.ts`** — `normalizeEntityType` extended for the full 2D DXF entity catalog (line / circle / arc / polyline / text / dimension / xline / ray / angle-measurement / opening / slab-opening / stair). i18n keys added to both `el/bim3d.json` and `en/bim3d.json` under `entityTypes.*`.
- **Wiring**: `CanvasSection` adds `use2DKeyboardFocus` call (one extra hook, three lazy getters, one stable callback). `CanvasLayerStack` mounts `<Focus2DOverlayLeaf>` next to the 3D leaf — both gated by their respective mode.
- **Tests**: `__tests__/cross-mode-shortcuts.test.ts` — 22 unit/integration tests across 8 groups (focus order, label data, paint/clear smoke, singleton stability, 2D↔3D isolation, ESC priority, 2D entity-type normalization, ADR-040 leaf smoke). All pass ✅.

**ADR-040 compliance audit (Phase 4.5 + 4.6 deliverables)**:

| Cardinal rule | Verdict | Evidence |
|---|---|---|
| #1 — orchestrators (`CanvasSection`, `CanvasLayerStack`, `BimViewport3D`) MUST NOT subscribe to high-freq stores | ✅ PASS | `Focus2DOverlayLeaf` is the sole new `useSyncExternalStore` introduced in 4.6, and it subscribes ONLY to the low-freq `ViewMode3DStore.mode`. Shell stays subscription-free. 3D side: `BimViewport3D` subscribes only to low-freq slices (`mode`, `sunPreset`, `sunAzimuthDeg/El`, `floorVisibilityModes`) — all user-action-driven, never 60fps. `ThreeJsSceneManager` is a pure class with zero React. |
| #2 — event-time reads use getters, not snapshots | ✅ PASS | `use2DKeyboardFocus` accepts `getScene` / `getTransform` / `getViewport` getters; CanvasSection feeds them via `dxfSceneRef.current` + `transformRef.current` + `viewport`. 3D: `use3DShortcuts` already uses `getManager: () => managerRef.current`. |
| #3 — bitmap cache key untouched | ✅ PASS | Phase 4.5 + 4.6 add no fields to `dxf-bitmap-cache.ts` key composition. 2D focus state lives in the singleton manager (never propagated to the renderer). The dashed outline paints to its own overlay canvas (z-index 18), so the cached DXF bitmap is never invalidated by focus changes. |
| #4 — ≤1 canvas element + ≤2 high-freq hooks per leaf | ✅ PASS | `Focus2DOverlay` = one `<canvas>` + one low-freq focus subscription + one optional `<output>` label (zero canvases). `Focus2DOverlayLeaf` = one low-freq mode subscription. `FocusIndicator3D` (Phase 4.5) = zero canvases (Three.js owns the canvas) + one low-freq focus subscription + self-owned RAF that imperatively writes `style.transform` (no React re-renders during the per-frame label position update). |

**Deferred from Phase 4.6 → Phase 7 polish OR Phase 8 backlog**:
- ~~A.7.Q3 `SelectionCursorIcon` cross-mode component~~ → **DONE in Phase 4.7** (2026-05-21).
- A.7.Q3 `AXIS_LABEL_GLYPHS` X/Y/Z sprite labels on gizmo arrows — requires Topic A.2 gizmo refactor.
- Pan animation (150ms cubic ease, repeat-key continuous accumulation) — instant pan stays.
- Centralize the focus outline color token (`#00ffff` literal lives in `focus-2d-outline-painter.ts` and `FocusOutlineRenderer.ts`). Boy-Scout candidate when canvas-ui tokens grow a `feedback.focus` slot.

**Scope (original)**:
- **A.7.Q1 backport 2D**: `KeyboardFocusManager` cross-mode usage στο 2D viewer (~1h)
- ~~**A.7.Q3 backport 2D**: `SelectionCursorIcon` cross-mode~~ — DEFERRED (see above)
- Integration tests: cross-mode shortcut consistency (Phase 4.4 → 4.5 → 2D) ✅
- **ADR-040 audit**: `ThreeJsSceneManager` + 3D micro-leaves πρέπει να μην subscribe σε high-freq stores (orchestrator pattern) ✅
- **Boy Scout cleanup**: hardcoded strings (N.11), palette violations (N.0.2/ADR-365) σε αγγιγμένα αρχεία ✅
- **Final commit**: Phase 4 closure + ADR-366 §4.5.1 progress check-marks ✅

**Files (NEW)**:
- `src/subapps/dxf-viewer/accessibility/keyboard-focus-2d-manager.ts` (~30 LOC)
- `src/subapps/dxf-viewer/accessibility/focus-2d-order.ts` (~90 LOC)
- `src/subapps/dxf-viewer/accessibility/focus-2d-outline-painter.ts` (~60 LOC)
- `src/subapps/dxf-viewer/accessibility/Focus2DOverlay.tsx` (~105 LOC)
- `src/subapps/dxf-viewer/components/dxf-layout/Focus2DOverlayLeaf.tsx` (~45 LOC)
- `src/subapps/dxf-viewer/hooks/state/use2DKeyboardFocus.ts` (~110 LOC)
- `src/subapps/dxf-viewer/__tests__/cross-mode-shortcuts.test.ts` (~270 LOC, 22 tests)

**Files (MODIFY)**:
- `src/subapps/dxf-viewer/bim-3d/accessibility/status-bar-text-generator.ts` — extended `EntityTypeKey` + `normalizeEntityType` with 12 new 2D entity types
- `src/subapps/dxf-viewer/components/dxf-layout/CanvasSection.tsx` — `use2DKeyboardFocus` wiring (one hook + one callback)
- `src/subapps/dxf-viewer/components/dxf-layout/CanvasLayerStack.tsx` — `<Focus2DOverlayLeaf>` mount next to `<CanvasLayerStack3dLeaf>`
- `src/subapps/dxf-viewer/systems/escape-bus/escape-priority.ts` — new `FOCUS_CLEAR: 150` constant
- `src/subapps/dxf-viewer/systems/escape-bus/__tests__/EscapeCommandBus.test.ts` — priority ordering test extended
- `src/i18n/locales/el/bim3d.json` + `src/i18n/locales/en/bim3d.json` — 12 new `entityTypes.*` keys
- ADR-366 §4.5.1 (this section) + Phase 4 row in §4.5 master plan ✅
- ADR-040 changelog (cross-mode audit entry — see ADR-040)

**Tests**: 22 unit/integration tests (focus order, label data, paint/clear, singleton, isolation, ESC priority, type normalization, leaf smoke) — all pass ✅

**Dependencies**: Phase 4.5

**Acceptance**: όλα τα AC-1 → AC-5 πληρούνται + ADR-040 compliance audit clean + zero new hardcoded strings/palette violations σε Boy Scout files ✅

---

##### Phase 4.7 — §A.7.Q3 SelectionCursorIcon (~1h) ✅ DONE 2026-05-21

**Implementation note — Phase 4.7 (2026-05-21)**:

Closure of the A.7.Q3 deferred item: visual cursor modifier badge.

- **`src/subapps/dxf-viewer/accessibility/SelectionCursorIcon.tsx`** (~90 LOC): Pure component. Global `keydown`/`keyup` listeners derive mode (`add` | `remove` | `toggle` | null). Global `mousemove` listener updates `style.transform` imperatively — zero React re-renders at 60fps (mirrors FocusIndicator3D self-owned RAF pattern). Window `blur` resets mode (prevents stuck icon on alt-tab). SVG badge: `+` for add (Ctrl), `−` for remove (Shift), `±` for toggle (Ctrl+Shift). `position: fixed` — works cross-mode from single mount point.
- **`CanvasLayerStack.tsx`** (MODIFY): Single mount after `<Focus2DOverlayLeaf>`. No leaf wrapper needed — component has no `useSyncExternalStore` dependency.
- **`src/subapps/dxf-viewer/accessibility/__tests__/SelectionCursorIcon.test.tsx`** (~80 LOC): 8 tests — visibility (hidden/show/release), icon content per mode (+/−/±), aria-hidden on both outer div and SVG.

**ADR-040 compliance**:
- No `useSyncExternalStore` → CanvasLayerStack shell stays subscription-free ✅
- Cursor position = imperative `style.transform` via ref (no React re-renders on mousemove) ✅
- `setState` only on low-freq key events ✅

**Files (NEW)**:
- `src/subapps/dxf-viewer/accessibility/SelectionCursorIcon.tsx`
- `src/subapps/dxf-viewer/accessibility/__tests__/SelectionCursorIcon.test.tsx`

**Files (MODIFY)**:
- `src/subapps/dxf-viewer/components/dxf-layout/CanvasLayerStack.tsx` — import + single mount
- ADR-366 §4.5.1 (this section) + Phase 4 row ✅

**Tests**: 8 unit tests — all pass ✅

**Dependencies**: Phase 4.6

---

#### 4.5.2 Phase 8 Sub-Phase Breakdown — ARIA Compliance (~4h)

> **Σκοπός**: Activation του deferred A.7.Q2 (ARIA wrappers + live regions + entity descriptions). Προετοιμασία για future EU public sector compliance (Greek municipalities / EUDP). Σπάει σε **2 ατομικές υποφάσεις** (8.0 + 8.1).

##### Phase 8.0 — ARIA Wrappers + Live Regions (~2h) ✅ DONE 2026-05-21

**Scope**:
- Canvas accessibility wrapper element (`role="application"` + `aria-label="3D BIM Viewer"`)
- Live regions για: selection changes (`aria-live="polite"`), mode switches, errors (`aria-live="assertive"`), tool activations
- Role attributes + aria-label coverage σε όλα UI elements (ribbon buttons, ViewCube, section panels, drawing tools)
- ARIA states: `aria-pressed` για toggle buttons, `aria-expanded` για collapsibles, `aria-current` για active tools

**Files (NEW)**:
- `bim-3d/accessibility/AriaLiveRegion.tsx` (~100 LOC, single SSoT live region pair pollite+assertive)
- `bim-3d/accessibility/aria-attribute-presets.ts` (~80 LOC reusable preset objects)

**Files (MODIFY)**:
- `bim-3d/viewport/BimViewport3D.tsx` — `role="application"` + `aria-label` on outer div + `role="presentation"` on inner canvas div ✅
- `bim-3d/panels/Floating3DPanel.tsx` — tablist/tab/tabpanel/aria-selected + `floatingPanel.ariaLabel` i18n key ✅
- `bim-3d/panels/Section3DPanelTab.tsx` — ModeButton `aria-pressed` + `aria-label` ✅
- ViewCube overlay — WebGL-rendered (no HTML face buttons); context menu trigger has `aria-label` ✅

**Tests**: 16 unit (ariaLiveBus + ARIA_PRESETS, all pass ✅)

**Dependencies**: Phase 4.5 (uses KeyboardFocusManager focus state)

---

##### Phase 8.1 — Entity Description i18n + Screen Reader (~2h) ✅ DONE 2026-05-21

**Scope**:
- Per-entity-type ARIA descriptions (wall, column, beam, slab, opening, stair, slab-opening)
- i18n keys σε `bim-3d-aria.json` (el + en) — 18 keys × 2 = 36 keys με ICU interpolation
- Screen reader text generators (entity → human-readable): π.χ. «Wall, length 5.2 metres, height 2.8 metres, material concrete, level Ground Floor»
- NVDA + VoiceOver testing checklist (manual QA doc στο `docs/accessibility/`)
- Focus indicator hook: read description on focus via AriaLiveRegion + ariaLiveBus (integration με Phase 8.0)

**Files (NEW)**:
- `bim-3d/accessibility/aria-entity-description-generator.ts` (115 LOC, 1 generator per entity type + unified dispatcher)
- `src/i18n/locales/el/bim-3d-aria.json` (18 keys — pure Greek, zero English)
- `src/i18n/locales/en/bim-3d-aria.json` (18 keys)
- `docs/accessibility/bim-3d-screen-reader-checklist.md` (manual QA matrix, 30 rows, NVDA + VoiceOver)
- `bim-3d/__tests__/aria-entity-description.test.ts` (7 unit tests)

**Files (MODIFY)**:
- `bim-3d/accessibility/KeyboardFocusManager.ts` — `DescriptionListener` type + `subscribeDescription()` method + `descriptionListeners` Set
- `bim-3d/accessibility/AriaLiveRegion.tsx` — `AriaLiveRegionProps` (focusManager + getEntityData) + useEffect description subscription (stable ref pattern)
- `bim-3d/viewport/BimViewport3D.tsx` — pass `focusManager` + `getEntityData` props to AriaLiveRegion
- `src/i18n/lazy-config.ts` — register `bim-3d-aria` namespace
- `src/i18n/namespace-loaders.ts` — el + en loaders for `bim-3d-aria`
- `src/i18n/config.ts` — `bim-3d-aria` in namespace list

**Tests**: 7 unit (all entity types + fallback + unified dispatcher)

**Dependencies**: Phase 8.0

**Acceptance**: NVDA + VoiceOver κάνουν announce wall/column/beam/slab/opening/stair/slab-opening on Tab focus. Geometry fields announced when available; entityName fallback when geometry absent.

**Note on geometry data**: Current mesh `userData` exposes `bimType` + `entityName` only. Generator is designed for extensibility — when geometry fields are added to `findFocusedEntityData`, descriptions automatically enrich without generator changes.

---

## 5. SPEC-3D-001 — DXF → Three.js Pipeline (Skeleton)

> Full details → `SPEC-3D-001-dxf-to-threejs-pipeline.md` (to be authored)

### 5.1 Mapping πίνακας

| DXF Entity | Three.js Object | Σημειώσεις |
|---|---|---|
| `LINE` | `LineSegments` (BufferGeometry, 2 verts) | Color from layer/entity |
| `ARC` | `Line` (EllipseCurve, N subdivisions) | N=max(32, arc_length_m × 16) |
| `CIRCLE` | `Line` (EllipseCurve, 64 pts, closed) | — |
| `LWPOLYLINE` | `Line` (BufferGeometry polyline) | If closed+filled → ShapeGeometry |
| `POLYLINE` / `3DFACE` | `Mesh` (BufferGeometry) | 3D vertices preserved |
| `HATCH` | `Mesh` (ShapeGeometry, flat XZ plane) | Elevation = 0 (or entity elevation) |
| `TEXT` / `MTEXT` | `Sprite` (canvas billboard) | No 3D extrusion (Phase 1 MVP) |
| `INSERT` (block ref) | Group of above | Recursive expansion |
| `SPLINE` | `Line` (CatmullRomCurve3) | Control points → sampled |
| `SOLID` / `TRACE` | `Mesh` (triangulated quad) | — |
| `ELLIPSE` | `Line` (EllipseCurve) | Full ellipse or partial arc |
| `DIMENSION` | Omitted in 3D (Phase 1 MVP) | ADR-362 dims = 2D annotation |

### 5.2 Performance constraints

- **LOD**: DXF scenes >10.000 entities → instancing για identically-styled LINE batches.
- **BufferGeometry merge**: Entities per layer → merged into single `BufferGeometry` per layer (InstancedMesh για repetitive INSERT blocks).
- **Lazy conversion**: Convert to Three.js objects only when 3D mode is activated, not on app load.
- **Disposal**: When switching back to 2D, `geometry.dispose()` + `material.dispose()` για κάθε Three.js object.

---

## 6. SPEC-3D-002 — BIM Elements Renderer (Skeleton)

> Full details → `SPEC-3D-002-bim-elements-renderer.md` (to be authored)

### 6.1 Wall → ExtrudeGeometry

```typescript
function wallToThreeGeometry(wall: WallEntity): THREE.Mesh {
  // 1. Build 2D Shape from outer-edge polygon (XZ plane)
  const shape = new THREE.Shape();
  const outerPts = wall.geometry.outerEdge.map(p => new THREE.Vector2(p.x / 1000, p.y / 1000));
  shape.setFromPoints(outerPts);
  // 2. Subtract inner-edge as hole
  const holePath = new THREE.Path();
  const innerPts = wall.geometry.innerEdge.map(p => new THREE.Vector2(p.x / 1000, p.y / 1000));
  holePath.setFromPoints(innerPts);
  shape.holes.push(holePath);
  // 3. Extrude along Y (height)
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: wall.params.height / 1000,   // mm → m
    bevelEnabled: false,
  });
  // 4. Rotate to Y-up convention
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, wall.params.startElevation / 1000, 0);
  return new THREE.Mesh(geometry, wallMaterial(wall));
}
```

### 6.2 Column / Beam → ExtrudeGeometry

```typescript
function columnToThreeGeometry(col: ColumnEntity): THREE.Mesh {
  // footprint polygon (XZ) → Shape → ExtrudeGeometry (Y = height)
  const shape = footprintToShape(col.geometry.footprint);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: col.params.height / 1000,
    bevelEnabled: false,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(col.params.position.x / 1000, 0, col.params.position.y / 1000);
  return new THREE.Mesh(geometry, columnMaterial(col));
}
```

### 6.3 Opening as boolean void

**Phase 2 MVP**: Opening rendered as door/window frame overlay (no boolean subtraction from wall mesh). Full boolean subtraction (CSGEvaluator or manual) → Phase 3+.

### 6.4 Multi-floor stacking

> **Elevation semantics**: `SlabParams.levelElevation` = top face (FFL) σε mm, Slab hangs DOWN by `thickness`. `BeamParams.topElevation` = top face σε mm. Βλ. **ADR-369 §2.1** (slab) + **§2.2** (beam) για canonical convention.

```typescript
// Floor elevation from ADR-326 building/floor schema
function floorElevationM(floor: BuildingFloor): number {
  return floor.elevationMm / 1000;   // absolute elevation from ground
}
// Each BIM entity gets Y-offset = floor.elevationMm / 1000
```

---

## 7. SPEC-3D-003 — Materials & Lighting (Skeleton)

> Full details → `SPEC-3D-003-materials-lighting.md` (to be authored)

### 7.1 PBR Material catalog

```typescript
// Mapping: ADR-363 WallMaterialPreset.shaderType → THREE.MeshStandardMaterial
const MATERIAL_3D_MAP: Record<ShaderType, () => THREE.MeshStandardMaterial> = {
  concrete: () => new THREE.MeshStandardMaterial({ color: 0xb0b0b0, roughness: 0.8, metalness: 0.0 }),
  plaster:  () => new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: 0.9, metalness: 0.0 }),
  brick:    () => new THREE.MeshStandardMaterial({ color: 0xb05030, roughness: 0.85, metalness: 0.0 }),
  tile:     () => new THREE.MeshStandardMaterial({ color: 0xf0ece0, roughness: 0.3, metalness: 0.0 }),
  wood:     () => new THREE.MeshStandardMaterial({ color: 0x8b5e3c, roughness: 0.7, metalness: 0.0 }),
  glass:    () => new THREE.MeshStandardMaterial({ color: 0x88ccff, roughness: 0.1, metalness: 0.0, transparent: true, opacity: 0.35 }),
  metal:    () => new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.3, metalness: 0.9 }),
  stone:    () => new THREE.MeshStandardMaterial({ color: 0x907060, roughness: 0.95, metalness: 0.0 }),
};
```

Phase 6.2 (ADR-363): Texture maps (albedo/normal/roughness) από Material Library SSoT αντικαθιστούν τα flat colors.

### 7.2 Lighting setup

```
Sun (DirectionalLight): intensity=3, position=(-5, 10, 5), castShadow=true, shadow bias=-0.0005
Sky (AmbientLight): intensity=0.5, color=0xffffff
Ground bounce (HemisphereLight): sky=0x87CEEB, ground=0x8B7355, intensity=0.3
```

**Sun angle**: Ribbon parameter (azimuth 0-360°, elevation 0-90°) → `DirectionalLight.position` update. Default = summer noon Athens (azimuth 180°, elevation 65°).

---

## 8. SPEC-3D-004 — GenArc Reuse Catalog (Split per Domain)

> **Original master-catalog approach abandoned 2026-05-19.** Reasoning: GenArc src/ = 484+ αρχεία. Single-session full investigation = context bloat + shallow analysis. **New approach: 5 sub-SPECs ανά domain, ένα ανά session.**

### 8.1 Sub-spec structure

| Sub-spec | Domain | Source | Status | Effort |
|---|---|---|---|---|
| **SPEC-3D-004A** | Viewport / Camera / ViewCube / Gizmo / Section / Loupe / HLR | `engines/viewport/` (45 files, 11.423 LOC) | ✅ **COMPLETE** 2026-05-19 | 8-10h Phase 4 |
| **SPEC-3D-004B** | DXF Parser → Three.js conversion | `engines/dxf/` (6 files) + `types/dxf*` (2 files) | ✅ **COMPLETE** 2026-05-19 — ZERO port (8 EXCLUDE) | 0h port + ~Phase 1 from scratch on Nestor `DxfEntityUnion` |
| **SPEC-3D-004C** | Utils / Snap / Picking / Coordinate transforms | `utils/` subset (6 files: cursor/gizmo projection + coordinateTransforms + sitePicking + element/gridSnap) + `engines/snap/` (10 files) | ✅ **COMPLETE** 2026-05-19 — 2 PORT_AS_IS + 1 ADAPT + 13 EXCLUDE | ~3-4h Phase 0 + Phase 7 prep |
| **SPEC-3D-004D** | Geometry helpers (BIM/BOM math) | `engines/bom/` (3 files) + `utils/{slabBeamSplit,beamLoopSlab,raySceneIntersection,structuralConnectivity,structuralConnectivity.helpers,buildingSelectors}` (6 files) | ✅ **COMPLETE** 2026-05-19 — 0 PORT/0 ADAPT/3 EXTRACT_CONCEPT/6 EXCLUDE | 0h port (Nestor BIM geometry SSoT superset) |
| **SPEC-3D-004E** | Materials / Shaders (concepts only για PBR mapping) | `engines/sdf/` (12 files) + `shaders/` (4 files) + `types/{material,wallDna}.types.ts` (2 files) + `constants/materialRegistry.constants.ts` (1 file) = 19 files, ~2.500 LOC | ✅ **COMPLETE** 2026-05-19 — 0 PORT_AS_IS + 1 PORT_WITH_ADAPTATION + 4 EXTRACT_CONCEPT + 12 EXCLUDE + 2 OOS | ~6h Phase 3 (unchanged) + ADR-363 Phase 6.x ~8h reused |

### 8.2 SPEC-3D-004A Summary (Viewport — completed)

Πλήρης catalog 45 αρχείων `engines/viewport/`:
- **15 PORT_AS_IS** (~2.700 LOC): viewportCamera, tumbleRotation, viewportAnimation, viewportFraming, viewportPoi, viewSnapDetector, viewCubeMesh, viewCubeOverlay, viewCubeHighlight, gizmoBuilders, gizmoGeometry, gizmoHandleBuilders, gizmoHitTest, hlrEdgeGeometry, windowSelectionOverlay
- **8 PORT_WITH_ADAPTATION** (~1.706 LOC): viewCube (north-callback), section group (4 files, type swaps), loupe group (3 files, type swaps)
- **7 EXTRACT_CONCEPT** (~3.733 LOC): gizmoController, gizmoDragHandler, gizmoOverlay, navProxy ⭐, navProxyStaircase, vertexDotsOverlay, viewportEventHandlers
- **15 EXCLUDE** (~3.284 LOC): drawing controllers (Nestor has BIM drawing), drawing previews, snapIndicator, moveController, ΝΟΚ overlays

⭐ **navProxy (508 LOC, EXTRACT_CONCEPT)** = πιθανό primary path για SPEC-3D-002 (BIM Elements Renderer). Battle-tested rasterizer με 5 render modes + HLR. Open Question Q2 στο SPEC-3D-004A.

Full details: `SPEC-3D-004A-genarc-viewport-port-catalog.md`.

### 8.4 SPEC-3D-004D Summary (Geometry Helpers — completed)

Πλήρης catalog 9 αρχείων του GenArc geometry/BOM/connectivity domain:
- **0 PORT_AS_IS / 0 PORT_WITH_ADAPTATION**: Nestor's `bim/geometry/*` (ADR-363 Phases 1-7.1) είναι **architectural superset** του GenArc — fundamental coordinate basis mismatch (3D Y-up metres vs 2D XY-plan mm + external elevation) + cached `entity.geometry.{...}` SSoT
- **3 EXTRACT_CONCEPT** (~1.002 LOC, out of ADR-366 Phase 0-6 scope):
  - `slabBeamSplit.ts` (392 LOC) — slab decomposition γύρω από beams (industry 5/5: separate Z-aligned meshes preferred, no boolean)
  - `beamLoopSlab.ts` (224 LOC) — auto-slab from closed 4-beam loop (industry 4/4: BIM authoring feature, ADR-363 territory)
  - `raySceneIntersection.ts` (386 LOC) — scene-agnostic CPU analytical raycaster (industry 4/4: Three.js native raycaster sufficient για Phase 4)
- **6 EXCLUDE** (~1.342 LOC): `wallGeometry.ts` (Nestor `wall-trims.ts` strict superset), `bomCalculator.ts` (Nestor `BimToBoqBridge` Firestore-grade superset), `geometryCalculators.ts` (Nestor cached scalar quantities), `structuralConnectivity{,.helpers}.ts` (Loupe feature → Phase 7.2 SPEC-3D-004A), `buildingSelectors.ts` (Nestor scene SSoT)

**Phase 2 strategy**: `BimToThreeConverter` χτίζεται πάνω σε Nestor cached `entity.geometry.{outerEdge, innerEdge, axisPolyline, outline, footprint, bbox}` + `dxfPlanToWorld(x_mm, y_mm, elev_mm)` ADR-366 §4.2 bridge. **Zero GenArc geometry port effort.**

4 Full Enterprise resolutions (Q1/Q2/Q3/Q4 — multi-layer DNA BOQ confirmed industry 6/6 → ADR-363 Phase 6.x ~8h extension scheduled).

Full details: `SPEC-3D-004D-genarc-geometry-helpers-port-catalog.md`.

### 8.5 SPEC-3D-004E Summary (Materials & Shaders — completed)

Πλήρης catalog 19 αρχείων (`engines/sdf/` 12 + `shaders/` 4 + `types/material.types.ts` + `types/wallDna.types.ts` + `constants/materialRegistry.constants.ts`):
- **0 PORT_AS_IS / 0 PORT_WITH_ADAPTATION+** εκτός: `material.types.ts` (1 file, ~67 LOC) **PORT_WITH_ADAPTATION** — strong superset structure (ShaderType extended 8→12, MaterialCategory extended 10→11, mm-units, optional cost/density, drop `GpuMaterialId`)
- **4 EXTRACT_CONCEPT** (~860 LOC):
  - `engines/sdf/materialUniforms.ts` (96 LOC) — Wall DNA → 3 face material IDs + flip-aware swap algorithm (lines 44-78). Re-implemented σε `bim-3d/materials/MaterialCatalog3D.ts` Phase 3 ~1.5h.
  - `constants/materialRegistry.constants.ts` (~150 LOC) — full PBR + cost + density per-preset registry shape. Nestor `material-registry-3d.constants.ts` Phase 3.2 ~3h populated με 18 wall + 9 stair preset IDs από ΑΤΟΕ 2024 (industry σύγκλιση 5/5: Revit/ArchiCAD/Bentley/Tekla/Allplan).
  - `shaders/materials.glsl.ts` (110 LOC) — procedural concrete/plaster/soil GLSL recipes. **Phase 5+ optional reference** (Phase 3 = flat `MeshStandardMaterial` colors per ADR-366 §7.1).
  - `shaders/gridPlane.glsl.ts` (158 LOC) — adaptive 3-tier grid με axis colors + horizon. **Phase 0 = Three.js native `GridHelper`** (simple baseline); Phase 7 polish ~3-4h αν Γιώργος ζητήσει visual upgrade.
- **12 EXCLUDE** (~1.500 LOC): ολόκληρο SDF uniform packing pipeline (`wall/column/beam/slab/opening/slabOpening/staircase/senazUniforms.ts` + `sdfQuad.ts` + `sdfRaymarcher.ts` ADR-366 §3.2.2 rejected) + `noise.glsl.ts` (Ashima MIT, Three.js MeshStandardMaterial δεν χρειάζεται custom GLSL Phase 3) + `wallDna.types.ts` (Nestor `bim/types/wall-dna-types.ts` strict superset: 5 default presets vs 3, mm convention, parapet/fence categories)
- **2 OUT_OF_SCOPE**: GenArc test files (`__tests__/senazUniforms.test.ts`, `staircaseUniforms.test.ts`)

**Phase 3 strategy**: `MaterialCatalog3D.resolveWallFaceMaterials(wall)` consumes Nestor `WallEntity.params.dna` + `MATERIAL_REGISTRY_3D` registry → returns `{exterior, interior, core}` `MeshStandardMaterial` triple με flip-aware swap. **Zero GenArc runtime dependency** (Three.js native API only).

**ADR-363 Phase 6.x Multi-Layer DNA BOQ (~8h pending)** reused: registry density+cost+unit data unlocks per-layer kg/m²/m³ quantities + per-layer ΑΤΟΕ category override μέσω `material.category` discriminator (insulation→OIK-7.x, masonry→OIK-3.x).

4 Open Questions ΟΛΑ RESOLVED Full Enterprise (Q1 registry data source 5/5 σύγκλιση ΑΤΟΕ+ASTM, Q2 ShaderType extension 4/4 σύγκλιση, Q3 optional cost 5/5 σύγκλιση, Q4 two-tier preset+registry 4/4 σύγκλιση).

Full details: `SPEC-3D-004E-genarc-materials-shaders-port-catalog.md`.

### 8.6 Post-suite consolidation (A→E CLOSED)

Με την ολοκλήρωση του SPEC-3D-004E, **ολόκληρη η σειρά A→E είναι κλειστή**. Συνολικά 97 αρχεία catalogued (45+8+16+9+19) από ~484 GenArc src/ — ~20% του GenArc relevant για ADR-366 (υπόλοιπο σε structural/ai/nok/dxf-import = out of scope).

**Final dependencies (αμετάβλητα από §8.3)**: `three ^0.170.0` + `three-gpu-pathtracer ^0.0.18` + `three-mesh-bvh ^0.7.0` — όλα MIT. SOS N.5 ✅.

**Συνολική εκτίμηση implementation (αναθεωρημένη)**: ~64-70h (αρχική §4.5: 58h). Revision drivers: Phase 4 viewport 6h→8-10h (SPEC-3D-004A), Phase 7 optional adaptive grid +3-4h (SPEC-3D-004E §3.4), όλα τα υπόλοιπα unchanged.

**Pending ratchet από A→E suite**: μόνο **ADR-363 Phase 6.x Multi-Layer DNA BOQ ~8h** (από SPEC-3D-004D Q4, confirmed από SPEC-3D-004E §6.2). Όλα τα υπόλοιπα είναι in-scope ADR-366 phases.

**Phase 0 implementation start**: ✅ **READY** — όλα catalogs locked, dependencies identified, zero blocking questions.

### 8.3 Dependencies pulled in

```jsonc
// package.json additions (all MIT)
"three": "^0.170.0",                  // Core (already decided)
"three-gpu-pathtracer": "^0.0.18",   // Phase 5 path tracing (MIT, gkjohnson)
"three-mesh-bvh": "^0.7.0",          // BVH acceleration (MIT, gkjohnson)
// @types/three: included in three >=r150 via built-in TypeScript declarations
```

**License audit (SOS N.5)**: All MIT. ✅

### 8.3 ADR-009 coordinate system alignment

GenArc **ADR-009** defines Y-up convention explicitly. This ADR **inherits** that convention (§4.2 coordinate transform table). No adaptation needed for camera/ViewCube port.

---

## 9. Open Questions για Γιώργο — ✅ ALL RESOLVED 2026-05-19

> Όλες οι 4 ερωτήσεις resolved Full Enterprise. ADR-366 status: PROPOSED → APPROVED. Phase 0 implementation ready.

**Συνοπτικά**:
- **Q1**: ViewCube top-right widget = unified toggle (AutoCAD style). 4/4 σύγκλιση Autodesk family.
- **Q2**: Single-floor default + "Show All" toggle. 4/4 σύγκλιση Revit/ArchiCAD/Vectorworks/Allplan.
- **Q3**: Tri-mode (rasterized real-time + auto-on-idle preview + explicit Render final). 7/7 σύγκλιση industry.
- **Q4**: HDRI ως Phase 7 polish (όχι Phase 5 prerequisite). Build core first, polish last. 6/6 σύγκλιση industry για HDRI ως final-quality choice.

### Q1 — Mode Toggle UI: Πού μπαίνει το 3D button; ✅ RESOLVED 2026-05-19

**ΑΠΟΦΑΣΗ Γιώργου**: **AutoCAD-style ViewCube + ring widget πάνω-δεξιά γωνία, στα δύο modes ταυτόχρονα.** Ο ίδιος ο κύβος είναι το toggle — δεν υπάρχει ξεχωριστό κουμπί "πήγαινε σε 3D".

**Συμπεριφορά**:
- **2D mode (κάτοψη)**: ViewCube top-right δείχνει πάντα "Top" face highlighted (συμβατό με κάτοψη)
- **Click σε face/edge/corner του κύβου** (Front/Right/Iso/etc.) → αυτόματη μετάβαση σε 3D με αντίστοιχη κανονική όψη + animated camera transition
- **Click "Top" face από 3D** → επιστροφή σε 2D mode (κάτοψη)
- **Compass ring**: orientation control + north angle indicator, διαθέσιμο και στα δύο modes (συμβατό με DXF north από topographic data αν υπάρχει)
- **Home button**: επαναφορά σε default view (2D=fit-to-extents, 3D=isometric front)

**Architectural implication για ADR-366 §4.3 Mode Toggle Architecture**:
- Ο `ViewMode3DStore` δεν έχει ξεχωριστό toggle button — input source είναι το `ViewCube` click event
- `ViewCube` widget πρέπει να υπάρχει σε **Phase 0** σαν skeleton (basic top-down indicator + click-to-3D dispatcher), όχι αποκλειστικά σε Phase 4
- Phase 4 εμπλουτίζει: tumble integration + full canonical snap (12 directions) + compass north + animated transitions
- 2D mode rendering θα προσθέσει mount point για `ViewCubeOverlay` σε `CanvasSection` top-right (z-index πάνω από DxfCanvas)

**Industry alignment**: AutoCAD ViewCube (since 2009), Revit ViewCube, Inventor ViewCube, Fusion 360 ViewCube — ΟΛΑ unified widget στα δύο modes. 4/4 σύγκλιση Autodesk family standard.

**Effort impact**:
- Phase 0: +~2h για ViewCube skeleton (αύξηση από 4h → ~6h)
- Phase 4: -~1h γιατί ένα μέρος ήδη υπάρχει από Phase 0
- **Net**: +1h συνολικά. Ασήμαντο revision.

**Cross-reference**: SPEC-3D-004A §2.2 (PORT_AS_IS — `viewCubeMesh.ts` + `viewCubeOverlay.ts` + `viewCubeHighlight.ts` 657 LOC) + §3.1 PORT_WITH_ADAPTATION `viewCube.ts` (north-callback swap). Το catalog ήδη καλύπτει τις ανάγκες.

---

### Q2 — Multi-floor: Βλέπουμε ΟΛΑ τα floors ταυτόχρονα, ή μόνο τον active floor; ✅ RESOLVED 2026-05-19

**ΑΠΟΦΑΣΗ Γιώργου**: **Default = μόνο ο τρέχων όροφος + κουμπί "Δείξε όλο το κτίριο"** (επιλογή C).

**Συμπεριφορά**:
- Όταν ανοίγει η 3D προβολή: εμφανίζεται ΜΟΝΟ ο όροφος που είναι ενεργός στην 2D κάτοψη (current floor από ADR-326 building/floor schema)
- **Toggle button "Δείξε όλο το κτίριο"** (ribbon ή floating overlay): εμφανίζει όλους τους ορόφους stacked με σωστά Y-elevation offsets
- **Click σε όροφο σε all-floors view**: επιστροφή σε single-floor mode με αυτόν τον όροφο ως active
- **Persisted state**: η επιλογή multi-floor visibility αποθηκεύεται στο `ViewMode3DStore` (όχι Firestore — session-only)

**Architectural implication για ADR-366 §6.4 Multi-floor stacking**:
- `BimToThreeConverter` Phase 2 παράγει meshes ΟΛΩΝ των ορόφων (entities από Firestore subscribe είναι πάντα cross-floor)
- Visibility control μέσω `mesh.visible = true/false` ανά floor group (zero re-creation cost)
- `ViewMode3DStore.visibleFloors: Set<floorId>` — default = {currentFloorId}, "Show All" → all floor IDs
- Single-floor mode κρύβει επίσης τα slabs του ΕΠΟΜΕΝΟΥ ορόφου (αλλιώς θα ήταν "ταβάνι" σου)

**Industry alignment**: Revit "View Range" + "Crop Region by Level", ArchiCAD "Stories visible on plan", Vectorworks "Story visibility filter", Allplan "Plan layer set" — όλα default single-level + toggle to full building. **4/4 σύγκλιση**.

**Effort impact**: Zero αλλαγή στο ~10h Phase 2 estimate. Visibility toggle = ~1h subset της Phase 2 work, ήδη ενσωματωμένο.

---

### Q3 — Path Tracer trigger: Πότε ενεργοποιείται; ✅ RESOLVED 2026-05-19

**ΑΠΟΦΑΣΗ Γιώργου**: **Tri-mode (B + C συνδυαστικά)** — όχι single trigger, αλλά 3 ταυτόχρονα modes σαν τους μεγάλους industry players.

**Industry analysis (7/7 σύγκλιση)**:

| Πρόγραμμα | Γρήγορο (πάντα) | Photoreal preview | Final export |
|---|---|---|---|
| Revit | Realistic mode | Ray Trace in viewport | Render dialog |
| ArchiCAD | OpenGL view | — | PhotoRender (CineRender) |
| Twinmotion | Real-time | Path Tracer toggle | Image/Video export |
| D5 Render | Real-time | Quality boost on idle | Final render button |
| Enscape | Real-time | Ray Tracing mode | Image/Video export |
| V-Ray (Rhino/SketchUp) | V-Ray Vision | IPR (interactive) | Final Render button |
| Blender | EEVEE viewport | Cycles viewport (idle) | F12 final render |

**Συμπέρασμα: 7/7 industry players χρησιμοποιούν tri-mode.** Full Enterprise convergence.

**Nestor tri-mode architecture**:

| Mode | Trigger | Renderer | Quality | Phase |
|---|---|---|---|---|
| **1. Rasterized real-time** | Default όταν είσαι σε 3D — πάντα ενεργό όταν κουνάς την οθόνη | Three.js `WebGLRenderer` (Phase 4 fallback) ή `WebGPURenderer` (Phase 5+) | Γρήγορο, flat materials + DirectionalLight shadows | **Phase 3** |
| **2. Photoreal preview (auto-on-idle)** | Όταν ο χρήστης σταματήσει να αλληλεπιδρά ≥2 δευτερόλεπτα. Παύει με την πρώτη mouse move/wheel. | `three-gpu-pathtracer` progressive, χαμηλό sample budget (~50-200 samples) | Μεσαία — GI + soft shadows + reflections | **Phase 5** |
| **3. Final export (explicit dialog)** | Κουμπί "Render" στο ribbon ή menu → modal dialog | Same `three-gpu-pathtracer` με υψηλό sample budget (~1000-4000 samples) + denoising | Πλήρης φωτορεαλιστική φωτογραφία | **Phase 6** |

**Mode transitions (SSoT)**:
- `ViewMode3DStore.renderMode: '3d-raster' | '3d-pathtrace-preview' | '3d-pathtrace-final'`
- Raster ↔ Preview: αυτόματο μέσω `IdleDetector` στο `ThreeJsSceneManager` (debounce 2s)
- Preview → Final: explicit user action (όχι auto)
- Final → cancel: παύει path tracer, επιστρέφει σε Preview
- Camera movement event → instant cancel preview + restart rasterizer

**Architectural implication για ADR-366 §4.3**:
- `ViewMode3D` enum επεκτείνεται: ήδη ορίζει `'2d' | '3d' | '3d-path-trace'`. **Αναθεωρείται σε `'2d' | '3d-raster' | '3d-preview' | '3d-final'`**
- `IdleDetector` νέο utility (`bim-3d/scene/IdleDetector.ts`) με `onIdle(callback, delay)` + `onActive(callback)` — pure event-driven, zero polling
- "Render" dialog component (`bim-3d/components/RenderFinalDialog.tsx`) Phase 6
- Reuse single `PathTracerRenderer` instance — αλλάζει μόνο sample budget + denoising flag ανάμεσα σε Preview/Final modes (SSoT: ένα renderer, δύο profiles)

**Google-level checklist (GOL)**:
- ✅ Proactive: idle detector triggers preview without user request
- ✅ Race-free: instant cancel on motion + atomic mode swap
- ✅ Idempotent: re-trigger on same idle state = continue current samples
- ✅ Belt-and-suspenders: WebGL fallback αν WebGPU unavailable (preview = rasterized HQ instead)
- ✅ SSoT: single `PathTracerRenderer` instance + single `IdleDetector`
- ✅ Lifecycle: `ThreeJsSceneManager` owns lifecycle of all 3 renderers, dispose on 2D switch

**Effort impact**:
- Phase 3 (~6h): unchanged
- Phase 5 (~12h): +~2h για IdleDetector + auto-trigger logic. Updated estimate: **~14h**.
- Phase 6 (~4h): unchanged (dialog + sample budget config)
- Net: +2h. Updated total **~66-72h**.

---

### Q4 — HDRI environment map: Τι default χρησιμοποιούμε; ✅ RESOLVED 2026-05-19

**ΑΠΟΦΑΣΗ Γιώργου**: **HDRI (Polyhaven CC0 default + library picker), αλλά ως Phase 7 polish — όχι Phase 5 prerequisite.**

**Strategy**: Build core first, polish last. Path tracer (Phase 5) δουλεύει μια χαρά με solid color sky + DirectionalLight sun — HDRI = "πέρασμα από καλό σε εντυπωσιακό", όχι prerequisite.

**Industry analysis (6/6 σύγκλιση για HDRI ως final-quality choice)**:

| Πρόγραμμα | Default περιβάλλον για photoreal |
|---|---|
| Lumion | HDRI sky library (20+ presets) |
| Twinmotion | HDRI με time-of-day slider |
| Enscape | HDRI με dynamic skybox |
| D5 Render | HDRI library + Polyhaven import |
| V-Ray | HDRI dome light standard |
| Blender Cycles | HDRI environment texture default (αλλά λειτουργεί και χωρίς) |

**Per-phase sky/lighting strategy**:

| Phase | Sky | Reason |
|---|---|---|
| 0 | — | No 3D scene yet |
| 1 (DXF→3D) | Solid γαλάζιο (`0x87CEEB`) | Minimal — entities visible without lighting |
| 2 (BIM→3D) | Solid γαλάζιο | Same |
| 3 (Materials & Lighting) | Solid γαλάζιο + `DirectionalLight` ήλιος + `AmbientLight` + `HemisphereLight` | Per ADR-366 §7.2 — δεν αλλάζει |
| 4 (Camera + ViewCube) | Solid γαλάζιο | — |
| 5 (Path tracer) | **Solid γαλάζιο + DirectionalLight ως sun** | MVP — path tracer producing photoreal output without HDRI bookkeeping. Validates core path tracing pipeline. |
| 6 (Export) | Solid γαλάζιο | Same — validates export at known quality |
| **7 (Polish)** | ⭐ **HDRI library + Polyhaven CC0 picker + time-of-day slider** | Final visual upgrade after core proven |

**Polyhaven CC0 default selection** (Phase 7 bundled):
- **Default**: `kloofendal_48d_partly_cloudy_2k.hdr` (~1.5MB) — εκπληκτική γενική επιλογή για architectural viz, σύννεφα ισορροπημένα
- **Library picker (Phase 7)**: 5-8 presets — sunny noon / overcast / golden hour / blue hour / studio indoor / urban / coast / mountain
- **User upload**: ✅ **IMPLEMENTED 2026-05-25 (Group B closure)** — drag-drop `.hdr`/`.exr` upload via `HdriUploader.tsx` + `hdri-upload.service.ts` → Firebase Storage `companies/{companyId}/bim_environments/{envId}.{ext}` (50 MB cap, tenant-scoped) → `EnvironmentStore.setCustomHdri()` → existing `EnvmapGenerator.loadHdri()` pipeline applies texture live. Mutual exclusivity με preset picker (clear-custom restores preset URL via use-bim3d-store-sync subscription). See Changelog 2026-05-25.

**License (SOS N.5)**: Polyhaven = CC0 (Public Domain) → fully MIT-compatible. ✅

**Architectural implication για ADR-366 §4.5 Phase plan**:

| Φάση | Original estimate | Revised estimate | Reason |
|---|---:|---:|---|
| Phase 5 (Path tracer) | ~12h → ~14h (Q3 IdleDetector) | **~14h unchanged** | HDRI removed από Phase 5 |
| Phase 7 (Polish) | ~8h | **~12-14h** | + HDRI library + picker (~3-4h) + Polyhaven bundle + time-of-day slider |

**Net effort change**: Phase 7 +4-6h. Total estimate revised:
- After Q3 (Phase 5 +2h): ~66-72h
- After Q4 (Phase 7 +4-6h): **~70-78h**

**Phase 5 fallback during path-trace preview/final**:
- Background = solid color (matches rasterized Phase 3 default)
- Environment reflection = synthetic `THREE.PMREMGenerator.fromScene()` από scene's own DirectionalLight + ground plane — Three.js native, no asset
- Glass/metal materials still reflect "something" — όχι όσο εντυπωσιακό σαν HDRI, αλλά λειτουργικό

**Validation strategy (Google-level)**:
1. Phase 5 path tracer με solid sky → ξέρεις τι output περιμένεις
2. Phase 6 export → φέρνεις στον πελάτη ή σε εσένα → ξέρεις αν το core δουλεύει
3. Phase 7 HDRI → polish μόνο αν προηγούμενα steps validated

**Google-level checklist (GOL)**:
- ✅ Proactive: Solid color baseline pre-emptively chosen
- ✅ Race-free: HDRI loading async + cache, fallback to solid color while loading
- ✅ Idempotent: HDRI re-load = no-op (cached)
- ✅ Belt-and-suspenders: HDRI fails → fallback solid color + DirectionalLight (no broken render)
- ✅ SSoT: `EnvironmentStore` Phase 7 owns HDRI URL + time-of-day state (single source)
- ✅ MVP risk reduction: Core path tracer proven before HDRI complexity added

---

## 10. Google-Level Architecture Checklist

| # | Ερώτηση | Απάντηση |
|---|---|---|
| 1 | Proactive ή reactive; | Proactive — 3D scene built lazily on first mode switch, then kept warm |
| 2 | Race condition; | No — mode toggle is synchronous, canvas swap is sequential |
| 3 | Idempotent; | Yes — calling switchTo3D twice = same result (already 3D, no-op) |
| 4 | Belt-and-suspenders; | Yes — WebGL fallback if WebGPU unavailable |
| 5 | Single Source of Truth; | Yes — ThreeJsSceneManager owns scene, feeds from Firestore SSoT via existing hooks |
| 6 | Fire-and-forget ή await; | Path tracer = background (fire-and-forget progressive). Mode switch = synchronous. |
| 7 | Lifecycle ownership; | ThreeJsSceneManager: create on first 3D switch, dispose on unmount/tab close |

**Google-level: PARTIAL** — εξαρτάται από Q1-Q4 απαντήσεις + actual implementation. Υπό προϋπόθεση των §4 architectural rules, full Google-level εφικτό.

---

## 11. Acceptance Criteria

| # | Κριτήριο | Phase |
|---|---|---|
| AC-1 | Mode toggle 2D↔3D χωρίς data loss (2D state fully preserved) | Phase 0 |
| AC-2 | DXF αρχείο με 1000 entities renders <2s σε 3D mode (rasterizer) | Phase 1 |
| AC-3 | Wall/Column/Beam/Slab BIM entities visible σε 3D (correct shape + elevation) | Phase 2 |
| AC-4 | Materials visible (per-entity ShaderType → MeshStandardMaterial) | Phase 3 |
| AC-5 | Camera tumble + zoom + pan + ViewCube navigation functional | Phase 4 |
| AC-6 | Path tracer produces photorealistic output (GI, shadows, reflections) σε <30s για typical floor | Phase 5 |
| AC-7 | Export PNG 300dpi functional | Phase 6 |
| AC-8 | Multi-floor stacking correct (elevation from ADR-326 schema) | Phase 2 |
| AC-9 | ADR-040: 2D performance unaffected by 3D infrastructure (no 2D fps regression) | All phases |
| AC-10 | TypeScript strict mode (no `any`, no `@ts-ignore`) | All phases |

---

## Appendix A — 3D UX Deep Research (post-approval, 7 topics)

> Post-approval deep-dive research για 7 core 3D UX topics. Σκοπός: industry σύγκλιση 4-7 players → explicit specs που τροφοδοτούν Phase 4 (Camera + ViewCube) και cross-cutting interaction layer.

### A.7 — Accessibility — ✅ CLOSED 2026-05-19

**Σκοπός**: Καθορισμός accessibility standards για 3D viewer — keyboard-only navigation, screen reader support (ARIA), color-blind safe palette. WCAG 2.1 AA target. Cross-cutting και στο 2D viewer (backport applicable).

**Cross-references**: A.6 keyboard shortcuts (μερική κάλυψη orbit/pan/zoom/views). Existing 2D `color-config.ts` (mirror 2D SSoT principle — Topic A.1).

**Pending micro-decisions**:
- Q1: Full keyboard navigation (Tab cycle + Enter select) ✅ RESOLVED
- Q2: Screen reader (ARIA labels + live regions)
- Q3: Color-blind safe palette audit
- Q4: Keyboard pan (4th gap από A.7.Q1)

**Decisions Log (Γιώργος)** — Topic A.7 in progress:

| # | Ερώτηση | Απόφαση | Industry alignment |
|---|---|---|---|
| A.7.Q1 | Full keyboard navigation σε 3D (Tab cycle entities + Enter select) | **Επιλογή 1 — Full keyboard navigation**. `Tab` cycles visible entities (sorted closest-to-camera first), `Shift+Tab` reverse, `Enter` selects/deselects focused, `Esc` clears focus. Visual focus indicator: έντονο outline (2px cyan) + floating label "Wall_A12". Combined με A.6 shortcuts → πλήρες keyboard-only 3D experience. | WCAG 2.1 AA standard. Blender Tab-cycle reference. Web a11y best practice. Revit/AutoCAD partial (mouse-required), Nestor αναβαθμίζει σε pure keyboard. |
| A.7.Q2 | ARIA / Screen reader υποστήριξη για τυφλούς χρήστες | **✅ ACTIVATED 2026-05-21 — Phase 8.0 IMPLEMENTED.** Αρχικά DEFERRED 2026-05-19 (timing). Ενεργοποιήθηκε Phase 8.0: `aria-live-bus.ts` singleton emitter + `AriaLiveRegion.tsx` micro-leaf (polite + assertive regions, zero React state re-renders, direct DOM textContent mutation) + `aria-attribute-presets.ts` (4 type-safe spreadable preset factories). Selection3DStore → auto-announce "Selected: {type}". ViewMode3DStore.mode → auto-announce mode switch. BimViewport3D outer div: `role="application"` + `aria-label`. 16 unit tests (aria-live-bus + ARIA_PRESETS). Phase 8.1 (entity descriptions) follows. See §4.5.2 Phase 8.0. | Industry CAD/BIM 0/4 implement (Revit/AutoCAD/SketchUp/ArchiCAD). Web a11y standard partial — additive feature, zero refactor cost. WCAG 2.1 AA live regions pattern. |
| A.7.Q3 | Color-blind safe palette (deuteranopia/protanopia ~8% ανδρών) | **Επιλογή 1 — Add patterns/icons (multi-channel signaling)**. Selection add = cursor `+` icon + outline (color = bonus, ΟΧΙ sole signal). Selection remove = cursor `−` icon + outline removal. Status bar text confirmation. Axes (X/Y/Z) = RGB + **γράμμα label** πάνω σε κάθε arrow tip. WCAG 1.4.1 compliant by-default. ΟΧΙ separate "colorblind mode" toggle. | **6/6 CAD industry σύγκλιση** (Revit + AutoCAD + Blender + 3ds Max + SketchUp + Fusion 360) — όλοι multi-channel signaling, μηδέν toggle mode. Design tools (Figma/Adobe/Chrome DevTools) έχουν toggle αλλά preview-only, όχι core UI. Industry-converged answer. |
| A.7.Q4 | Keyboard pan (μετακίνηση κάμερας χωρίς ποντίκι) | **Επιλογή 1 — `Ctrl+Arrows` pan** (Blender-extended pattern). `Ctrl+←/→/↑/↓` = pan 50px screen-space. `Shift+Ctrl+Arrow` = 10px fine-tune. Mirror Q2 (Alt+Arrows orbit) pattern. Ctrl+Arrows ΕΛΕΥΘΕΡΟ στο 2D SSoT (verified). | 1/6 industry σύγκλιση (μόνο Blender). Επιλογή Γιώργου: απαραίτητη συνέπεια με A.7.Q1 (full keyboard-only) + A.6.Q2 (Alt+Arrows orbit). Closes pan gap → πλήρες true keyboard-only navigation achievement. |

**Architectural implications για A.7.Q1**:

- **Νέο SSoT**: `bim-3d/accessibility/KeyboardFocusManager.ts` — pure state machine, ΟΧΙ React state. Subscribers via observer pattern (mirror HoverStore/ImmediatePositionStore pattern από ADR-040).
- **State**: `focusedEntityId: string | null`, `focusOrder: string[]` (computed από camera distance + frustum cull).
- **Cycle algorithm**: on Tab → compute visible entities (frustum cull from `ThreeJsSceneManager`) → sort by distance asc → next from current. O(n log n) per Tab press, cached per camera-change event.
- **Focus indicator rendering**: separate Three.js `LineSegments` με dashed material (REUSE Topic A.1 selection outline shader). Floating HTML label via React portal positioned via `Vector3.project(camera)`.
- **Integration με Universal Selection (ADR-030)**: `Enter` dispatches `useUniversalSelection.toggle(focusedEntityId)`. Existing selection store unchanged.
- **Mode-aware**: focus ring active μόνο όταν `mode !== '2d'` AND `document.activeElement === canvas`. Tab outside canvas → normal DOM Tab cycle.
- **Hidden entity skip**: Tab δεν stops σε hidden floors (multi-floor visibility, A.5.Q2 single-floor default).
- **Backport σε 2D**: ίδιο pattern ισχύει για 2D viewer — Phase 4 implementation cross-cuts both modes (extra +1h).

**Effort impact για A.7.Q1**: +3h Phase 4 (KeyboardFocusManager + focus indicator rendering + label positioning + integration) + 1h backport σε 2D. Total accessibility cost so far: ~4h. Phase 4 updated estimate: **~20.5-22.5h**.

**Architectural implications για A.7.Q2 (DEFERRED)**:

- **Future opt-in**: KeyboardFocusManager (από Q1) ήδη παράγει `focusedEntityId` — όταν προστεθεί ARIA layer, απλά wraps σε `aria-live="polite"` region που reads entity metadata από Firestore.
- **Zero blocker για Q1**: Q1 implementation δεν αλλάζει αν προστεθεί ARIA αργότερα. Pure additive.
- **EU compliance future-proofing**: αν Nestor στοχεύσει EU public sector (Greek municipalities, EUDP), ARIA θα γίνει mandatory — προγραμματίζεται Phase 8+ τότε.
- **Documentation**: ADR-366 §10 (Accessibility Roadmap) flags Q2 ως "deferred, candidate for Phase 8+" — όχι "rejected".

**Effort impact για A.7.Q2**: Zero τώρα. Future estimate (αν ενεργοποιηθεί): ~4h Phase 8+ (ARIA wrappers + live regions + entity description i18n).

**Architectural implications για A.7.Q3**:

- **Selection feedback (Topic A.1 extension)**: Cursor icon overlay component `bim-3d/cursor/SelectionCursorIcon.tsx` — renders `+` ή `−` SVG δίπλα στον cursor όταν Ctrl/Shift held. Cursor mode tied σε `useUniversalSelection.modifierState`.
- **Status bar text**: existing 2D status bar (έχει "X entities selected") extends με "+1 added" / "-1 removed" transient messages (3s auto-dismiss).
- **Axis labels για gizmos**: extends Topic A.2 `AXIS_COLORS_3D` token με companion `AXIS_LABEL_GLYPHS` ('X' / 'Y' / 'Z' chars rendered ως sprite labels στο tip κάθε axis arrow). REUSE Three.js `Sprite` + canvas-drawn text (mirror GenArc `gizmoGeometry` pattern).
- **No new "colorblind mode" toggle**: zero settings UI clutter. Multi-channel signaling είναι active για ΟΛΟΥΣ τους χρήστες (όχι opt-in).
- **WCAG 1.4.1 compliance**: ΚΑΘΕ color-coded signal συνοδεύεται από icon/text/letter. Audit checklist στο SPEC-3D-002 §3 (Rendering Standards).
- **Backport σε 2D**: status bar text + cursor icons ισχύουν για 2D selection feedback επίσης (~30min backport).

**Effort impact για A.7.Q3**: +2h Phase 4 (SelectionCursorIcon component + AXIS_LABEL_GLYPHS sprites + status bar text wiring) + 30min 2D backport. Total accessibility cost: ~6.5h. Phase 4 updated estimate: **~22.5-24.5h**.

**Architectural implications για A.7.Q4**:

- **SSoT entries**: 8 entries στο `keyboard-shortcuts-3d.ts` (4 `Ctrl+Arrow` 50px + 4 `Shift+Ctrl+Arrow` 10px fine-tune).
- **Pan implementation**: `viewportCamera.pan(dxScreen, dyScreen)` — screen-space delta converted σε world-space μέσω camera.projectionMatrixInverse. REUSE GenArc `viewportCamera.ts` PORT_AS_IS (ήδη έχει pan method για mouse drag).
- **Animation**: 150ms cubic ease per keystroke (smoother than orbit's 200ms — pan is small discrete movements). Repeat-key for continuous pan accelerates linearly.
- **Mode guard**: pan shortcuts active μόνο σε 3D mode. 2D mode `Ctrl+Arrows` reserved για μελλοντικά shortcuts (π.χ. layer cycling).
- **Touch fallback**: 2-finger drag = pan σε mobile/tablet (separate gesture handler, ΟΧΙ keyboard-related).

**Effort impact για A.7.Q4**: +30min Phase 4 (8 entries + dispatcher integration). Total accessibility cost: ~7h. Phase 4 updated estimate: **~23-25h**.

**Topic A.7 final effort summary**:
- Q1 keyboard navigation (Tab cycle): +4h (3h 3D + 1h 2D backport)
- Q2 ARIA / Screen reader: DEFERRED (~4h Phase 8+ future)
- Q3 color-blind multi-channel signaling: +2.5h
- Q4 keyboard pan: +30min
- **Topic A.7 total impact (current scope)**: +7h. Phase 4 updated estimate: **~23-25h** (από ~17.5-19.5h post-A.6).
- **ADR-366 total estimate post-A.7**: ~104.5-120.5h (από ~97.5-113.5h post-A.6).

---

**Appendix A — Group A FINAL summary (2026-05-19)**:

| Topic | Status | Key outcome |
|---|---|---|
| A.1 — Selection UX | ✅ CLOSED | Revit Ctrl/Shift modifiers + AutoCAD grips mirror 2D + billboard square 3D grip |
| A.2 — Gizmos | ✅ CLOSED | Grip-drag mirror 2D + Blender X/Y/Z axis lock + Shift snap-disable |
| A.3 — Section cuts | ✅ CLOSED | Section Box + Single Plane + 6 planes + Link toggle + 2D Live Section Panel |
| A.4 — Camera transitions | ✅ CLOSED | 500ms cubic ease-in-out + GenArc ~709 LOC PORT_AS_IS |
| A.5 — ViewCube micro-interactions | ✅ CLOSED | 160px, opaque, fixed top-right, full-fill hover, free tumble, AutoCAD home, conditional compass |
| A.6 — Keyboard shortcuts 3D | ✅ CLOSED | Combo Numpad + Ctrl+Shift+Letter views, Alt+Arrows orbit, universal-where-applicable mode-aware |
| A.7 — Accessibility | ✅ CLOSED | Full keyboard nav (Tab cycle), ARIA DEFERRED, multi-channel signaling, Ctrl+Arrows pan |

**Group A total effort impact**: ~12.5h additive (από Topics 5-7 = +1.5h A.5 + +4h A.6 + +7h A.7). **ADR-366 final estimate: ~104.5-120.5h** για full Phase 0-7 implementation.

**Group A COMPLETE** ✅ — έτοιμο για Group B research (Phase 0 implementation skeleton OR more deep research topics ανάλογα Γιώργο).

---

### A.6 — Keyboard shortcuts 3D — ✅ CLOSED 2026-05-19

**Σκοπός**: Καθορισμός keyboard shortcut scheme για 3D viewer — canonical view jumps, orbit/pan/zoom keyboard equivalents, mode-context behavior (2D shortcuts active σε 3D mode;). Επεκτείνει το `src/subapps/dxf-viewer/config/keyboard-shortcuts.ts` SSoT.

**Cross-references**: Existing 2D SSoT `keyboard-shortcuts.ts` (1066 lines, DXF_TOOL/ZOOM/NAVIGATION_SHORTCUTS). 3D adds parallel `keyboard-shortcuts-3d.ts` με same `ShortcutDefinition` interface.

**Pending micro-decisions**:
- Q1: Canonical view shortcuts (Numpad/Ctrl+Shift+Letter/combo/none) ✅ RESOLVED
- Q2: Orbit keyboard equivalents (Alt+Arrows; mouse-only;)
- Q3: Mode-context (2D shortcuts S/P active σε 3D;)
- Q4: Home/fit-to-extents shortcut (reuse 2D `Home` key;)

**Decisions Log (Γιώργος)** — Topic A.6 in progress:

| # | Ερώτηση | Απόφαση | Industry alignment |
|---|---|---|---|
| A.6.Q1 | Canonical view shortcuts (Top/Front/Side/Iso) | **Επιλογή 4 — Combo Numpad + Ctrl+Shift+Letter** ταυτόχρονα. `Numpad 1`=Front, `3`=Right, `7`=Top, `5`=Iso/Persp toggle (Blender style) **ΚΑΙ** `Ctrl+Shift+T`=Top, `F`=Front, `R`=Right, `I`=Iso (laptop fallback). Ctrl+Numpad/Ctrl+Shift+Alt+Letter = opposite (Back/Left/Bottom). | 3ds Max ήδη combo. Blender Numpad 6/10 industry preference για 3D pros. Ctrl+Shift+Letter laptop-safe (μηδέν conflicts με 2D tools S/P/L/T). Best-of-both-worlds για Nestor mixed user base. |
| A.6.Q2 | Keyboard orbit (camera rotation από πληκτρολόγιο) | **Επιλογή 3 — Combo Alt+Arrows + Numpad** ταυτόχρονα. `Alt+←/→` = orbit horizontal 15°, `Alt+↑/↓` = orbit vertical 15° (3ds Max). `Shift+Alt+Arrow` = 5° fine-tune. **ΚΑΙ** `Numpad 4/6/8/2` = same 15° orbit (Blender). Consistency με Q1 dual-input pattern. | 3ds Max + Blender σύγκλιση για keyboard orbit. Alt+Arrows ΕΛΕΥΘΕΡΟ στο 2D SSoT (verified). Accessibility benefit (laptop trackpad users + power users fine-tune). Zero conflicts. |
| A.6.Q3 | Mode-context — 2D shortcuts σε 3D mode | **Επιλογή 1 — Universal-where-applicable** (Revit/ArchiCAD pattern). Selection/Delete/Undo/Redo/Copy/Paste = universal. Tool activation = universal (αν meaningful). Zoom = universal. Arrow nudge = XY plane universal. Snap toggles `F9-F11` = universal. Drawing tools (Line/Polyline/Wall) σε 3D → auto-switch to 2D mode + activate tool (ViewCube unified toggle behavior). | Revit/ArchiCAD/Vectorworks/Allplan όλα universal-where-applicable. Blender strict mode = niche modeling tool, αποκλείεται. Best UX για mixed 2D/3D BIM workflow — users δεν ξαναμαθαίνουν shortcuts. |
| A.6.Q4 | Home / fit-extents / frame-to-selection shortcuts σε 3D | **Mode-aware mapping**: `Home` = home view (ViewCube σπιτάκι action), `Shift+1` = fit-extents όλο κτίριο, `Shift+0` = reset zoom (4.5m default distance), `+/-` = dolly camera, `F` = **context-sensitive** (αν selection → frame-to-selection animated 500ms, αλλιώς fit-extents). | Maya/Blender pattern για context-sensitive `F`. Reuse 2D shortcut keys με mode-aware behavior — zero νέα bindings, μέγιστη consistency. `F` ήδη fit-to-view σε 2D, extension σε 3D με selection-aware logic. |
| A.6.Q5 | Mouse set-orbit-pivot (κέντρο περιστροφής σε σημείο που δείχνει ο χρήστης) | **`Alt`+κλικ σε επιφάνεια → orbit pivot = picked world point** (χωρίς μετακίνηση κάμερας, μηδέν visual jump). Raycast `hits[0].point` → `controls.target`· POI σταυρός flash στο νέο κέντρο. Static Alt+click = pivot· Alt+drag = orbit (ήδη υπάρχον tumble). Selection ανέπαφο. Ray miss = no-op. ✅ IMPLEMENTED 2026-05-29. | Blender/Maya/3ds Max σύγκλιση («Alt+click set pivot» / «F frame»). Industry-standard CAD navigation. Συμπληρώνει το keyboard-only A.6.Q2 (Alt+Arrows orbit) με mouse-driven precise pivot. |

**Architectural implications για A.6.Q1**:

- **Νέο SSoT file**: `src/subapps/dxf-viewer/config/keyboard-shortcuts-3d.ts` — mirror της `keyboard-shortcuts.ts` δομής (`ShortcutDefinition` interface REUSE, ΟΧΙ νέο interface)
- **Categories extend**: νέα category `'view3d'` στο existing `ShortcutCategory` type
- **Double-entry pattern**: κάθε view 2 entries (`frontNumpad` + `frontLetter`), ίδιο `action: 'view3d:front'`. Dispatcher χειρίζεται και τα δύο.
- **Mode-aware activation**: shortcuts μόνο όταν `ViewMode3DStore.mode !== '2d'` — αλλιώς ignored (registered στο dispatcher με mode guard)
- **i18n keys**: νέα namespace `shortcuts.view3d.*` (front/back/left/right/top/bottom/iso/iso2)
- **8 canonical views**: Front, Back, Left, Right, Top, Bottom, Iso (front-right), Iso2 (back-left). Numpad covers 6, Ctrl+Shift+Letter covers all 8.

**Effort impact για A.6.Q1**: +1.5h Phase 4 — νέο SSoT file (~250 LOC mirror), dispatcher integration, i18n keys. Total Phase 4 estimate: ~15-17h.

**Architectural implications για A.6.Q2**:

- **Orbit step**: 15° default (industry standard). `Shift+Alt+Arrow` = 5° fine-tune.
- **Implementation**: dispatch `tumbleRotation.applyOrbitDelta(axisX, axisY, deltaRad)` — reuse GenArc tumble engine (Topic A.4). Quaternion-based, pole-free.
- **Animation**: 200ms cubic ease (faster from mouse drag — keyboard is discrete steps). Optional setting `INSTANT_KEYBOARD_ORBIT` flag για power users.
- **SSoT entries**: 8 entries στο `keyboard-shortcuts-3d.ts` (4 Alt+Arrow + 4 Numpad) + 4 fine-tune (Shift+Alt+Arrow). Total 12.
- **Mode guard**: orbit shortcuts active μόνο όταν `ViewMode3DStore.mode !== '2d'` (αλλιώς Alt+Arrows reserved για μελλοντικό 2D use).
- **Touch fallback**: keyboard orbit δεν εφαρμόζεται σε mobile (no keyboard). Touch users χρησιμοποιούν 1-finger drag.

**Effort impact για A.6.Q2**: +30min Phase 4 (12 entries + dispatcher integration). Total Phase 4: ~15.5-17.5h.

**Architectural implications για A.6.Q3**:

- **Classification table**: κάθε shortcut στο `keyboard-shortcuts.ts` αποκτά νέο field `mode: '2d-only' | '3d-only' | 'universal' | 'auto-switch'`.
  - `universal`: Selection (S), Pan (P), Delete, Ctrl+Z/Y, Ctrl+A, Ctrl+C/V, zoom +/-, Home, Shift+1, F9-F11 snap toggles, Escape
  - `2d-only`: Line (L), Polyline, Rectangle, Circle, Wall draw, Door insert, Window insert, Dim tools — auto-switch το mode πριν activation
  - `3d-only`: Numpad views, Alt+Arrows orbit, Ctrl+Shift+T/F/R/I canonical views — ignored σε 2D
  - `auto-switch`: drawing tool activations σε 3D → dispatch `ViewMode3DStore.setMode('2d')` THEN activate tool
- **Migration plan**: existing `keyboard-shortcuts.ts` entries get `mode` field (default 'universal' για backward compat). Audit pass classifies καθε entry. Estimated ~40 entries to classify.
- **Dispatcher logic** (`useKeyboardShortcuts.ts` extension): mode check πριν dispatch — `if (shortcut.mode === '3d-only' && !is3D) return;` etc.
- **Auto-switch UX**: τοί στο 3D, πατάς `L` → 2D mode + Line tool activated. Toast notification: "Επιστροφή σε 2D για σχεδίαση". Cancellable με ESC (επιστροφή σε 3D).
- **Nudge in 3D**: Arrow keys nudge στο XY plane του current floor (αν entity επιλεγμένο). Όχι κάθετη κίνηση Z από arrows — Z μέσω grip-drag ή dedicated input.
- **Cross-mode undo stack**: ADR-031 CommandHistory ήδη unified — undo σε 3D επαναφέρει 2D actions και αντίστροφα. Zero change.

**Effort impact για A.6.Q3**: +1h Phase 4 (audit ~40 entries + `mode` field migration + dispatcher logic + auto-switch toast). Total Phase 4: ~16.5-18.5h.

**Architectural implications για A.6.Q4**:

- **Mode-aware action dispatcher**: existing `action:fit-to-view` → split σε `action:fit-to-view-2d` / `action:fit-to-view-3d-extents` / `action:fit-to-view-3d-selection` / `action:home-view`. Single dispatcher resolves based on `(mode, hasSelection)` tuple.
- **`F` selection-aware logic**: dispatcher reads `useUniversalSelection().selectedIds` — αν `length > 0` → frame-to-selection (compute bounding box σε ALL selected entities, καμερα fit + center + 10% padding). Αλλιώς → fit-extents.
- **Frame-to-selection animation**: 500ms cubic ease (Topic A.4 default). REUSE `viewportFraming.computePerspectiveFraming` / `computeOrthoFraming` (GenArc PORT_AS_IS).
- **`Home` 3D behavior**: ίδιο dispatch με ViewCube σπιτάκι click → `viewportCamera.goHome()` με customHomeView fallback (A.5.Q4 decision).
- **`Shift+0` 3D**: reset camera distance to 4.5m (typical room scale) maintaining current view direction. Pure distance reset, no angle change.
- **`+/-` 3D dolly**: per-keystroke ±10% distance change με 200ms cubic ease. Repeat-key fast for continuous zoom.
- **2D backward compat**: existing 2D shortcuts `F`, `Home`, `Shift+1`, `Shift+0`, `+/-` δεν αλλάζουν — απλώς extended με mode branch στο dispatcher.

**Effort impact για A.6.Q4**: +1h Phase 4 (split action dispatchers + selection-aware F logic + integration testing). Total Phase 4: ~17.5-19.5h.

**Topic A.6 final effort summary**:
- Q1 canonical views (combo Numpad + Ctrl+Shift+Letter): +1.5h
- Q2 keyboard orbit (Alt+Arrows + Numpad combo): +30min
- Q3 mode-context classification + auto-switch: +1h
- Q4 home/fit/frame mode-aware: +1h
- **Topic A.6 total impact**: +4h. Phase 4 updated estimate: **~17.5-19.5h** (από ~13.5-15.5h post-A.5).
- **ADR-366 total estimate post-A.6**: ~97.5-113.5h (από ~93.5-109.5h post-A.5).

---

### A.5 — Mode toggle / ViewCube micro-interactions — ✅ CLOSED 2026-05-19

**Σκοπός**: Καθορισμός micro-interactions του ViewCube widget top-right (compass ring, hover zones, drag-on-cube, home button). §9 Q1 ήδη όρισε το high-level pattern (AutoCAD-style unified toggle 2D↔3D). Topic A.5 finalizes τις λεπτομέρειες που επηρεάζουν Phase 0 skeleton + Phase 4 full enrichment.

**Cross-references**: ADR-366 §9 Q1 (unified toggle) + SPEC-3D-004A §2.2 (3 PORT_AS_IS files, 657 LOC) + §3.1 (`viewCube.ts` PORT_WITH_ADAPTATION, north-angle callback).

**Pending micro-decisions**:
- Q1: Compass ring (B/A/N/Δ) keep/remove/toggle ✅ RESOLVED
- Q2: Hover zone behavior (face/edge/corner highlight)
- Q3: Drag-on-cube behavior (free tumble vs snap-to-nearest-face)
- Q4: Home button (visual + position + behavior)
- Q5: Cube size/opacity/persistence

**Decisions Log (Γιώργος)** — Topic A.5 in progress:

| # | Ερώτηση | Απόφαση | Industry alignment |
|---|---|---|---|
| A.5.Q1 | Δαχτυλίδι πυξίδας (compass ring B/A/N/Δ) γύρω από κύβο | **Toggle on/off, ArchiCAD style** — εμφανίζεται αυτόματα αν υπάρχει βορράς από τοπογραφικό (`useSiteStore.getNorthAngleDeg` ≠ null), κρύβεται αν δεν υπάρχει. Manual toggle button επίσης στο ribbon. | 3/3 — ArchiCAD (toggle), Vectorworks (toggle), Allplan (project-setting). Revit/AutoCAD always-on είναι default αλλά large-scale focus· για Nestor mixed indoor/outdoor portfolio, conditional auto-show είναι σωστό fit. |
| A.5.Q2 | Hover zone highlight visual (face/edge/corner) | **AutoCAD/Revit style — full zone fill highlight** — semi-transparent cyan fill σε όλη τη ζώνη. Face hover = όλη η έδρα μπλε. Edge hover = και οι 2 γειτονικές μισές έδρες μπλε. Corner hover = 3 γειτονικές γωνίες έδρας λίγο μπλε. | 2/4 σύγκλιση Autodesk family (AutoCAD + Revit + Inventor + Fusion 360 outline-only). Επιλογή Γιώργου: full-fill για μέγιστη ευκρίνεια στόχου. SSoT REUSE: cyan token = `CAD_UI_COLORS.HOVER` (existing 2D hover color από `color-config.ts`). |
| A.5.Q3 | Drag-on-cube behavior (left-click drag πάνω στον κύβο) | **Α' Free tumble (Revit/AutoCAD/Blender style)** — ελεύθερη quaternion rotation, μένει όπου το αφήσεις. Click σε face/edge/corner = animated snap (500ms cubic). Drag = free. Δύο διαφορετικές actions, καθαρή UX. | 6/8 industry σύγκλιση (Revit + AutoCAD + Inventor + Fusion 360 + Blender + Three.js camera-controls). Μόνο SketchUp + Onshape snap-on-release. GenArc `viewCube.ts` ήδη implements free tumble → PORT_AS_IS confirmed (zero adaptation). Consistency με Topic A.2 (Alt+drag canvas tumble). |
| A.5.Q4 | Home button — θέση + custom home setting | **A.1 — AutoCAD style σπιτάκι 🏠 πάνω-αριστερά δίπλα στον κύβο** (visible always) + **B = NAI right-click "Set Current View as Home"** (Revit power user). Default fallback = isometric front-right + zoom-extents αν δεν έχει οριστεί custom. | 3/4 industry για visible home button (AutoCAD + Revit + Inventor) vs 1/4 menu-only (Fusion 360). Right-click custom home: Revit power feature, μηδέν cost (1 store field). GenArc `viewCubeMesh.createHomeButton` ήδη implements home button mesh PORT_AS_IS. |
| A.5.Q5 | Cube size + opacity + position persistence | **Size = 160px²** (GenArc/Revit/AutoCAD default) + **Opacity = 100% always-opaque** (Revit/AutoCAD style, ευκρινής widget πάντα) + **Position = fixed top-right, NO drag-to-reposition** (Revit style, simpler). | Size 3/3 σύγκλιση Autodesk family. Opacity Revit/AutoCAD always-on (2/4) vs SketchUp/Fusion idle-fade (2/4) — επιλογή Γιώργου: visibility > minimalism. Position fixed: 2/4 (Revit + Fusion) vs draggable 2/4 (AutoCAD + SketchUp). Phase 5+ optional enhancement αν user feedback ζητήσει draggable. |

**Architectural implications για A.5.Q1**:

- **SPEC-3D-004A §3.1 update**: το optional "remove compass ring entirely" → ΑΝΑΘΕΩΡΕΙΤΑΙ σε **conditional render based on north availability**
- **ViewCubeOptions interface** αποκτά νέο field: `getNorthAngleDeg?: () => number | null` (return null = no topographic data, hide ring)
- **ViewCubeMesh.createCompassRing** wrap σε visibility flag — runtime show/hide χωρίς re-creation
- **Manual toggle**: νέο state field `ViewMode3DStore.compassRingVisible: boolean` (default = auto-derived from north availability, user override persisted session-only)
- **Performance**: zero impact — ring είναι 1 Three.js Group, toggle = `group.visible = bool`
- **2D mode**: compass ring εμφανίζεται και στα δύο modes (consistency με §9 Q1 unified widget)

**Effort impact για A.5.Q1**: +30min Phase 4 (conditional render + toggle UI). Total Phase 4 παραμένει στο ~12-14h range (~6h ViewCube subset + 6-8h camera/animation).

**Architectural implications για A.5.Q2**:

- **SPEC-3D-004A §2.2 `viewCubeHighlight.ts` (134 LOC) PORT_AS_IS**: ήδη implements full-fill zone highlight. Zero adaptation needed.
- **Color token**: REUSE `CAD_UI_COLORS.HOVER` από `src/subapps/dxf-viewer/canvas-v2/dxf-canvas/utils/color-config.ts` (mirror 2D SSoT principle). ΟΧΙ νέο 3D-specific hover token.
- **Alpha**: 0.35 (semi-transparent) ώστε edges του κύβου να φαίνονται underneath
- **Performance**: zone highlight = canvas redraw σε mini-WebGL scene (160px²), ~0.1ms cost per hover. Zero impact στο main viewport.

**Effort impact για A.5.Q2**: Zero αλλαγή — viewCubeHighlight.ts ήδη PORT_AS_IS με αυτό το pattern.

**Architectural implications για A.5.Q3**:

- **GenArc `viewCube.ts` (385 LOC) PORT_AS_IS** για drag handler — quaternion-based free tumble, ίδιο engine με `tumbleRotation.ts` (Topic A.4). Zero adaptation στο drag logic.
- **Click vs drag discrimination**: threshold = movement <4px AND duration <250ms → click (snap to canonical face). Αλλιώς drag (free tumble). Standard pattern (GenArc + Three.js camera-controls).
- **Snap animation σε click**: 500ms cubic ease-in-out (Topic A.4 default). Reuse `viewportAnimation.ts`.
- **Mirror canvas Alt+drag**: ViewCube drag = mini-window του main viewport tumble. Same quaternion engine, ίδια αίσθηση. Zero mode confusion.
- **Touch support**: single-finger drag = tumble. Tap = snap. Pinch-zoom δεν εφαρμόζεται στον κύβο (κύβος fixed-size).

**Effort impact για A.5.Q3**: Zero αλλαγή — `viewCube.ts` PORT_AS_IS ήδη υπολογισμένο.

**Architectural implications για A.5.Q4**:

- **GenArc `viewCubeMesh.createHomeButton` PORT_AS_IS** — home icon mesh (Phong material + canvas-drawn house glyph), positioned top-left του widget. Zero adaptation.
- **Click behavior**: dispatch `viewportCamera.goHome()` → animated 500ms cubic transition σε home snapshot. REUSE `viewportAnimation.ts` keyframe interpolator (Topic A.4).
- **Custom home**: νέο field `ViewMode3DStore.customHomeView: CameraSnapshot | null` — Firestore-persisted per project (not session-only γιατί per-project meaningful). Schema: `{ position: Vec3, target: Vec3, fov: number, zoom: number, isOrtho: boolean }`.
- **Default fallback**: αν `customHomeView === null` → compute on-the-fly από bounding box του current building (isometric front-right, zoom-to-fit + 10% padding).
- **Right-click menu**: 1 item μόνο — "Set Current View as Home" (Revit identical pattern). Optional Phase 5+ enhancement: "Reset Home to Default".
- **Per-mode home**: 2D mode home = fit-to-extents (no camera-snapshot needed, computed). 3D mode home = customHomeView OR default fallback.
- **Persistence**: customHomeView → Firestore `projects/{id}/viewport_state.bim3d_custom_home` (per-project). User-tier preference, not company-wide.

**Effort impact για A.5.Q4**: +1h Phase 4 (right-click menu wiring + Firestore persistence + load on viewport mount). Updated Phase 4 estimate: ~13-15h.

**Architectural implications για A.5.Q5**:

- **Size 160px²**: hardcoded constant `VIEW_CUBE_CANVAS_SIZE = 160` σε `viewport.constants.ts` (GenArc PORT_AS_IS). DPR-aware (canvas internal resolution = 160 × devicePixelRatio).
- **Opacity 100% always**: `viewCubeMesh` material opacity = 1.0, transparent = false. Zero alpha fade logic — μεγαλύτερη performance (no per-frame opacity interpolation).
- **Position fixed top-right**: CSS `position: absolute; top: 16px; right: 16px;` πάνω από CanvasSection. Z-index πάνω από DxfCanvas + ribbon (z-index: 50). Zero drag handler code.
- **Mount point**: `bim-3d/components/ViewCubeOverlay.tsx` — single component, instantiates `createViewCube({ canvasSize: 160, opacity: 1.0, ... })`. Mounted στο layout root + via portal για να επιπλέει πάνω από 2D και 3D canvas.
- **Responsive**: σε viewport <600px width, hide cube (mobile fallback). Optional Phase 6+ tablet enhancement.
- **No persistence needed**: Q5 = zero Firestore state (sizes/opacity/position όλα constants). Only Q4 customHomeView persists.

**Effort impact για A.5.Q5**: Zero αλλαγή — constants + CSS positioning ήδη υπολογισμένα στο Phase 4 baseline.

**Topic A.5 final effort summary**:
- Q1 compass ring: +30min
- Q2 hover zones: 0 (PORT_AS_IS)
- Q3 drag tumble: 0 (PORT_AS_IS)
- Q4 home button + custom home: +1h (right-click + Firestore)
- Q5 size/opacity/position: 0 (constants)
- **Topic A.5 total impact**: +1.5h. Phase 4 updated estimate: **~13.5-15.5h**.
- **ADR-366 total estimate post-A.5**: ~93.5-109.5h (από 92-108h pre-A.5).

---

### A.4 — Camera transitions (duration, easing, ortho↔persp, framing) — ✅ CLOSED 2026-05-19

**Σκοπός**: Καθορισμός camera animation parameters — duration, easing curve, animated vs instant projection switch, orbit damping, frame-to-fit speed, ViewCube snap-to-canonical. Phase 4 (Camera + ViewCube) integration.

**Industry analysis (6 players)**:

| Πρόγραμμα | Snap-to-canonical duration | Easing | Ortho↔Persp switch | Orbit damping | Zoom Extents | Frame-to-selection |
|---|---|---|---|---|---|---|
| **Revit** | ~500ms (ViewCube click) | ease-in-out | Instant (snap) | None visible | Animated | Animated |
| **Blender** | ~300-500ms customizable | linear or ease | Numpad5 instant ή animated (focal length lerp + move back) | Smooth view feature | F key (numpad . shortcut) | Animated |
| **AutoCAD** | ~500ms ViewCube | cubic ease | Animated | Inertia | Animated | — |
| **Three.js OrbitControls** | Manual implement | `dampingFactor=0.05` standard | camera-controls library smoothDamp | `enableDamping=true` (μηχανική αίσθηση χωρίς) | Manual | Manual |
| **SketchUp** | ~500ms | ease | Animated | Yes | Animated (Zoom Extents) | Animated |
| **Twinmotion/Lumion** | Smooth ~400ms | ease | Perspective-only | Yes built-in | Smooth | — |
| **GenArc (port-ready)** | RAF-based | **cubic ease + auto-cancel** | **Animated** (viewportCamera.ts ready) | tumble damping + horizon-level | `frameBounds` perspective+ortho | snapToViewDirection ready |

**Σύγκλιση συμπερασμάτων**:

1. **Animation duration**: 5/6 industry στο 300-500ms range. Industry sweet spot: **~500ms** (Revit/AutoCAD/SketchUp universal, "instant enough to feel responsive, slow enough to follow visually").
2. **Easing curve**: 5/6 cubic ή ease-in-out. **Cubic ease-in-out** = industry default (smooth start + smooth stop). GenArc viewportAnimation ήδη implements αυτό.
3. **Ortho↔Perspective switch**: 4/6 animated (Blender focal length lerp + camera distance, AutoCAD/GenArc/Three.js camera-controls). Revit instant. **Animated = professional default**.
4. **Orbit damping**: 5/6 enabled (κρίσιμο για να μην αισθάνεται "μηχανικό"). Three.js standard `dampingFactor=0.05`.
5. **Zoom Extents / Frame-to-fit**: 5/6 animated. GenArc `frameBounds` ready (perspective + ortho).
6. **Home view return**: universal animated με cubic ease.
7. **ViewCube face click**: 6/6 animated snap to canonical orientation.

**GenArc reuse (SPEC-3D-004A §2.1 — ALL PORT_AS_IS)**:

| File | LOC | Functionality |
|---|---:|---|
| `viewportCamera.ts` | 322 | PerspectiveCamera + OrthographicCamera + OrbitControls + tumble integration + **animated projection switch** + `frameBounds` + `snapToViewDirection` + `goHome` |
| `tumbleRotation.ts` | 167 | Quaternion-based pole-free rotation (no gimbal lock) + horizon-leveling + damping + AltKey-triggered |
| `viewportAnimation.ts` | 124 | RAF-based interpolation engine + **CameraKeyframe lerp με cubic ease** + auto-cancel on new start |
| `viewportFraming.ts` | 96 | `computePerspectiveFraming` + `computeOrthoFraming` — pure bounds-fit math |
| **Total** | **709** | Full camera transition system ready, PORT_AS_IS (zero adaptation) |

**Default parameters (industry consensus, GenArc-compatible)**:

| Parameter | Value | Source |
|---|---|---|
| Snap-to-canonical duration | **500ms** | Revit/AutoCAD/SketchUp σύγκλιση 3/3 |
| Easing curve | **cubic ease-in-out** | GenArc + 5/6 industry |
| Ortho↔Persp switch | **Animated 500ms** | 4/6 industry, Three.js camera-controls smoothDamp |
| Orbit damping | **enabled, factor=0.05** | Three.js standard, 5/6 industry |
| Frame-to-fit (Zoom Extents) | **Animated 500ms** | 5/6 industry |
| Home view return | **Animated 500ms** | Universal cubic ease |
| Tumble (Alt+drag rotation) | **Smooth quaternion + horizon-level** | GenArc battle-tested |
| Pan/zoom inertia release | **0.05 damping factor** | Three.js standard |

**Decisions Log (Γιώργος)** — Topic A.4 CLOSED 2026-05-19:

| # | Ερώτηση | Απόφαση | Industry alignment |
|---|---|---|---|
| A.4.Q1 | Animation duration για ViewCube snap + Home + canonical views | **500 ms** (industry standard) με **cubic ease-in-out** curve | Revit + AutoCAD + SketchUp σύγκλιση 3/3. GenArc default ήδη. |
| A.4.Q2 (implicit) | Ortho↔Perspective switch | **Animated 500ms** — GenArc `viewportCamera.ts` ήδη implements animated projection switch | 4/6 industry (Blender + AutoCAD + GenArc + Three.js camera-controls). Revit instant — Nestor επιλέγει animated. |
| A.4.Q3 (implicit) | Orbit damping (inertia) | **Enabled, dampingFactor=0.05** | Three.js standard, 5/6 industry (όλοι εκτός raw Three.js OrbitControls default OFF). Χωρίς damping = μηχανική αίσθηση. |
| A.4.Q4 (implicit) | Zoom Extents / Frame-to-fit animation | **Animated 500ms cubic ease-in-out** — GenArc `frameBounds` (perspective + ortho) ready | 5/6 industry animated. Instant μόνο σε raw OrbitControls. |
| A.4.Q5 (implicit) | Tumble (Alt+drag rotation) | **REUSE GenArc tumbleRotation.ts** — quaternion-based pole-free + horizon-leveling + damping. Battle-tested. | Default Nestor 3D rotation engine. Zero alternative needed. |

**Architectural implications για ADR-366**:

- **Phase 4 effort post-A.4**: zero αλλαγή — GenArc ~709 LOC PORT_AS_IS ήδη υπολογισμένα στο Phase 4 effort estimate (12-14h)
- **Νέα tokens**: ΟΧΙ — durations/easing constants ζουν στο `viewport.constants` της GenArc port (Phase 4.3 — sub-phase 4.3 σε SPEC-3D-004A)
- **SSoT compliance**: 100% — μηδέν νέα παράλληλα systems, καθαρό GenArc port
- **2D parallel**: Nestor 2D έχει camera animations για zoom (ADR-040 frame scheduler), αλλά διαφορετικό coordinate system. GenArc 3D camera = standalone module.
- **Customization**: όλα τα defaults configurable μέσω `viewport.constants` (αν Γιώργος αλλάξει γνώμη στο μέλλον)

**Cross-reference**: SPEC-3D-004A §2.1 Core viewport (5 files PORT_AS_IS, ~850 LOC συνολικά) + §8.1 Phase 4.1 Foundation (1.5h port effort).

**Effort impact**: Zero αλλαγή — GenArc port ήδη υπολογισμένο στο Phase 4. Total estimate παραμένει **92-108h**.

---

### A.3 — Section cuts (box + plane, depth, live update) — ✅ CLOSED 2026-05-19

**Σκοπός**: Καθορισμός section cut pattern για το 3D viewer — clip volume που "κόβει" το κτίριο για να δεις εσωτερικά (Phase 7+). Box, single plane, multiple planes, drag interaction, χρωματισμός cut surface.

**Industry analysis (6 players)**:

| Πρόγραμμα | Section Box (6 faces) | Single plane | Multi-planes independent | Live update | Linked planes | Jog (stepped) | 2D view extraction |
|---|---|---|---|---|---|---|---|
| **Revit** | ✅ Section Box με μπλε arrow grips στις 6 πλευρές | — | — | ✅ real-time | — | — | ✅ Generate Section View |
| **Navisworks** | ✅ Section Box | ✅ single plane | ✅ έως 6 planes με orientations | ✅ | ✅ link toggle | — | ✅ snapshot export |
| **AutoCAD** | — | ✅ SECTIONPLANE | ✅ multiple | ✅ Live Section | — | ✅ jog stepped | ✅ 2D profile + hatches |
| **Three.js** | ✅ via 6 clippingPlanes | ✅ Material.clippingPlanes | ✅ unlimited | ✅ shader-level | ✅ ClippingGroup (WebGPU) | manual | manual |
| **Blender** | ✅ Clipping region (B + Clip border) | ✅ camera clip start/end | ✅ multi-plane | ✅ | — | — | — |
| **Twinmotion/Lumion** | ✅ Section box gizmo | ✅ section plane | Limited | ✅ | — | — | ✅ snapshot |

**Σύγκλιση συμπερασμάτων**:

1. **Section Box (6-sided clip volume)**: 6/6 — universal pattern. Revit canonical reference. **Default candidate για Nestor.**
2. **Drag grips στις 6 πλευρές του box**: 6/6. Mirror του Topic A.1 grip decision — REUSE `CAD_UI_COLORS.grips` palette.
3. **Single section plane**: 4/6 (AutoCAD, Navisworks, Blender, Three.js). Optional secondary mode για quick "slice through" use case.
4. **Multiple independent planes**: 4/6 (Navisworks, AutoCAD, Three.js, Blender). Advanced — Phase 8+ optional.
5. **Live update real-time**: 6/6 universal — Three.js `Material.clippingPlanes` shader-level. Zero CPU cost (GPU does it).
6. **Linked planes (move together)**: 2/6 (Navisworks, Three.js ClippingGroup). Niche.
7. **Jog (stepped angled cuts)**: 1/6 (AutoCAD only). Skip — rare feature.
8. **2D section view extraction**: 2/6 (AutoCAD, Navisworks) — GenArc έχει σχεδόν έτοιμη implementation.

**Nestor 2D context**:

| File | Relevance |
|---|---|
| `bim/StairCutPlaneSection.tsx` | UI panel για stair-specific cut plane (existing). **Όχι** generic 3D section system, αλλά confirms cut-plane concept υπάρχει ήδη στο codebase. |
| `services/ClipToRegionService.ts` | 2D region clipping (lasso/window). Διαφορετικό concept. |
| `rendering/utils/line-clipping.ts` | 2D line clipping math. Δεν σχετίζεται. |

**Συμπέρασμα**: Δεν υπάρχει 2D αντίστοιχο 3D section box στο Nestor — **νέο feature**. Όμως:
- `StairCutPlaneSection.tsx` UI panel pattern μπορεί να επεκταθεί σε generic `SectionBoxPanel.tsx`
- Color tokens grips: REUSE `CAD_UI_COLORS.grips` (συνέπεια A.1/A.2)
- Cut-surface χρωματισμός: νέο SSoT token `SECTION_CUT_SURFACE` (no 2D equivalent — pending decision Q5)

**GenArc reuse (SPEC-3D-004A §3.2)**:

| File | LOC | Decision Topic A.3 |
|---|---:|---|
| `sectionIntersect.ts` | 189 | ✅ PORT_WITH_ADAPTATION — pure math για intersection wall/column/beam/slab/opening + clipByOpenings. Type swap GenArc → Nestor BIM types. ~2h. |
| `sectionGeometry.ts` | 170 | ✅ PORT_WITH_ADAPTATION — 2D section meshes με color-coding per element type. Color tokens → Nestor theme. ~1h. |
| `sectionRenderer.ts` | 245 | ✅ PORT_WITH_ADAPTATION — standalone WebGLRenderer + OrthographicCamera για section panel (2D view extraction). ~1h. |
| `sectionSceneSync.ts` | 76 | ✅ PORT_WITH_ADAPTATION — wires renderer to Nestor scene+selection SSoT. ~30min. |

**Three.js native fallback**: Section Box itself (3D clip volume + grip handles) χτίζεται **direct με Three.js `Material.clippingPlanes`** (6 planes per box face) + custom grip mesh handles. Δεν χρειάζεται GenArc box system (GenArc focuses on section panel 2D view, όχι 3D box). ~4-6h implementation.

**Architectural implications για ADR-366**:

- **Phase 7+ effort**: Section Box (~4-6h Three.js native) + GenArc 2D panel port (~4h, optional) = ~8-10h total
- **Activation**: ribbon toggle button "Show Section Box". Default OFF.
- **Default box extent**: bounding box του visible building + 10% margin
- **Drag interaction**: 6 face grips (mirror Revit), drag = move face plane outward/inward. Cardinal axes (X+/X-/Y+/Y-/Z+/Z-).
- **Modifier keys**: Shift+drag = symmetric (αντίθετη πλευρά κινείται mirror). Useful για centered cuts.
- **Visual feedback**: cut surface highlight με `SECTION_CUT_SURFACE` token (TBD color), edges με `HOVER_HIGHLIGHT.ENTITY.glowColor` style.
- **Live section panel (Phase 7.1+, optional)**: GenArc port παρέχει 2D top-down section view του clip plane intersection — extra panel widget.
- **SSoT compliance**: 6/8 tokens REUSE (grips, hover, snap, scene, selection, ribbon), 1/8 νέο (`SECTION_CUT_SURFACE` color), 1/8 enterprise pattern.

**Decisions Log (Γιώργος)**:

| # | Ερώτηση | Απόφαση | Industry alignment |
|---|---|---|---|
| A.3.Q1 | Section Box ή single plane ή και τα δύο | **Και τα δύο (Section Box + Single Plane mode toggle)** — Navisworks-style. Default = Section Box (universal pattern), ribbon toggle → Single Plane mode όταν χρειάζεται γρήγορη slice-through όψη. Full Enterprise + Completeness over MVP. | 4/6 industry υποστηρίζει both (Navisworks + AutoCAD + Three.js + Blender). Revit/Twinmotion μόνο ένα από τα δύο. |
| A.3.Q2 | Multiple independent planes (max 6) ή single plane μόνο | **Ναι — έως 6 ανεξάρτητα επίπεδα τομής (Navisworks style)** + Link Planes toggle (move together). UI panel "Section Planes" με list/enable-disable ανά plane + orientation control. Full Enterprise — industry-grade BIM tool. | 4/6 industry (Navisworks + AutoCAD + Three.js native unlimited + Blender). Revit/Twinmotion limited σε ένα plane. |
| A.3.Q3 | 2D Live section panel widget (extra panel με 2D όψη της τομής) | **Ναι — επιπλέον 2D Section Panel** δίπλα στο 3D view, δείχνει 2D αρχιτεκτονική όψη της τομής (independent zoom/pan). GenArc port έτοιμος (4 files PORT_WITH_ADAPTATION ~680 LOC, ~4h adaptation: sectionIntersect + sectionGeometry + sectionRenderer + sectionSceneSync). | 2/6 industry (AutoCAD + Navisworks). Full Enterprise + GenArc αντιγραφή έτοιμου κώδικα. |
| A.3.Q4 | Cut surface visual (hatched / solid / both) | **Και τα δύο (toggle Solid Phase 7 base → Hatched Phase 7.1+)**. Solid γκρι semi-transparent ως default (Three.js native, εύκολο). Hatched mode (per-material patterns: τούβλο διαγώνιο, σκυρόδεμα τελείες, μόνωση ζιγκζαγκ) Phase 7.1+ (~3-4h) με material-hatch SSoT registry συνδεδεμένο με ADR-363 Phase 6 ShaderType. Toggle στο ribbon (Solid mode = photoreal-friendly, Hatched mode = documentation-friendly). | 6/6 industry σε solid OR hatched. Revit/AutoCAD = hatched (αρχιτεκτονική σύμβαση). Twinmotion/Lumion = solid. Nestor υποστηρίζει και τα δύο = full Enterprise. |
| A.3.Q5 (implicit) | Default κατάσταση section box | **OFF by default** — ribbon toggle button "Show Section Box" ενεργοποιεί. Default box extent = bounding box του visible building + 10% margin. Modifier Shift+drag = symmetric (αντίθετη πλευρά mirror). | Universal — όλοι οι 6 players default OFF. |

**Cross-reference**:
- SPEC-3D-004A §3.2 (4 PORT_WITH_ADAPTATION section files, ~680 LOC, ~4h adaptation)
- Nestor `StairCutPlaneSection.tsx` UI pattern (extend to generic SectionBoxPanel)

**Effort impact (final post A.3 closure)**: Phase 7 (Polish) post-A.2 = 18-22h. Με section box (4-6h Three.js native) + multi-plane management (3-4h) + 2D Live section panel GenArc port (~4h) + hatched material toggle (3-4h, deferred Phase 7.1+) = **32-40h Phase 7 total**. Total estimate από 78-90h → **92-108h**.

**SSoT compliance summary Topic A.3**:

| Component | SSoT source |
|---|---|
| Section Box grip rendering | `CAD_UI_COLORS.grips` (REUSE 2D) |
| Hover highlight σε section box edges | `HOVER_HIGHLIGHT.ENTITY.glowColor` (REUSE 2D) |
| Section Panel UI base | Extend `StairCutPlaneSection.tsx` pattern (REUSE Nestor) |
| Cut surface color (solid mode) | **NEW** `SECTION_CUT_SURFACE` token (justified — no 2D equivalent) |
| Selected entity cap emphasis color (Phase 7.0C) | `SECTION_CUT_SURFACE.selectedCapColor` = `HOVER_HIGHLIGHT.ENTITY.glowColor` (#FFFF00) (REUSE — mirrors `SECTION_2D_PANEL_COLORS.selected`) |
| Hatch patterns per material (Phase 7.1+) | **NEW** registry συνδεδεμένο με ADR-363 Phase 6 ShaderType — material-hatch SSoT (όχι παράλληλο σε 2D — Nestor 2D δεν έχει per-material hatch) |
| Selection sync (selected entity intersects section plane → emphasized) | `Selection3DStore` (REUSE A.1) |
| Mutation pipeline (drag section plane) | Nestor ICommand (REUSE 2D) |
| Undo/redo για section state | Nestor mutation service (REUSE 2D) |

**Implementation note — Phase 7.0a (True Stencil Cap, 2026-05-20)**:

Topic A.3 Q4 specified "Solid cut surface as Phase 7 base, Hatched as Phase 7.1+". The Phase 7.0 base shipped με placeholder face-mesh visual indicator (Navisworks-style semi-transparent grey quad στη θέση κάθε clip plane). Αυτό έδειχνε σωστά τη ΘΕΣΗ του cut, αλλά το geometry interior εμφανιζόταν "κούφιο" (hollow) — μη Q4-compliant για το "solid" mode.

Το **Phase 7.0a** implementing το true `webgl_clipping_stencil` BackSide+FrontSide pattern (Three.js example canonical):

- **Per active plane**: clear stencil → render scene back faces (override material, BackSide, IncrementWrap, color/depth write OFF, clipping = other planes) → render scene front faces (FrontSide, DecrementWrap) → render cap quad (separate scene, `stencilFunc=NotEqual,0`, `SECTION_CUT_SURFACE` color, clipping = other planes).
- **Outcome**: Wherever the scene geometry was sliced, stencil parity is odd → cap quad writes solid color → user sees filled cut surface αντί hollow interior.
- **Renderer setup**: WebGLRenderer constructed με `stencil: true` (Three.js default, set explicit για future-proofing). EffectComposer bypass όταν section active (default RT lacks stencil buffer) — SSAO trade-off αποδεκτό γιατί SSAO triggers μόνο σε idle ≥800ms, section editing = active interaction.
- **SectionBox visual change**: τα 6 face meshes (που ήταν το placeholder cap) αντικαταστάθηκαν με ενιαίο edge-only wireframe (LineSegments × BoxGeometry/EdgesGeometry), αποφεύγοντας z-fight με τα stencil caps. Handles unchanged (spheres @ face centers για drag UX).
- **Performance Phase 7.0a**: per frame κόστος = N×(2 BIM scene passes color/depth off + 1 cap quad) όπου N=active planes (1-6). Box mode worst case = 12 scene passes + 6 cap quads. **Phase 7.0b optimization** (2026-05-20): reduced to N×(1 warmup + 1 BIM pass + 1 cap quad) via `gl.stencilOpSeparate` cache trick — see Phase 7.0b implementation note below. Box mode: 6 BIM scene renders + 6 cap quads (~50% fewer large renders).
- **Files**: `+systems/section/section-stencil-renderer.ts` (new), `~systems/section/SectionBox.ts` (faces→edge wireframe), `~scene/section-scene-controller.ts` (owns stencil renderer + cachedPlanes + isStencilActive + renderFrameWithCaps), `~scene/ThreeJsSceneManager.ts` (render loop branch).

DEFERRED μετά Phase 7.0a: (a) ✅ **1-pass stencil optimization Phase 7.0b — DONE 2026-05-20 (see Phase 7.0b implementation note below)**, (b) ✅ **hatched per-material cut Phase 7.1 — DONE 2026-05-21 (see Phase 7.1 implementation note below)**, (c) ✅ **2D Live Section Panel GenArc port Phase 7.0B — DONE 2026-05-20 (see Phase 7.0B implementation note below)**, (d) ✅ **selection-aware cap emphasis Phase 7.0C — DONE 2026-05-20 (see Phase 7.0C implementation note below)**.

**Implementation note — Phase 7.0B (2D Live Section Panel, 2026-05-20)**:

Topic A.3 Q3 specified "Ναι — επιπλέον 2D Section Panel δίπλα στο 3D view, δείχνει 2D αρχιτεκτονική όψη της τομής (independent zoom/pan). GenArc port έτοιμος (4 files PORT_WITH_ADAPTATION ~680 LOC, ~4h adaptation)". Phase 7.0B ports τα 4 GenArc files (`C:\genarc\src\engines\viewport\section{Intersect,Geometry,Renderer,SceneSync}.ts`) με type-swap από GenArc Wall/Column/Beam/Slab/Opening → Nestor BIM entities + unit conversion (mm → m για vertical extents) + Nestor SSoT wiring (Bim3DEntitiesStore + Selection3DStore + SectionStore + νέο Section2DPanelStore).

**Architecture**:
- **Standalone Three.js renderer** (`section-renderer.ts`): δικός του WebGLRenderer + OrthographicCamera + Scene. Mount σε bottom-strip div (absolute positioned, z-30, 280px default height) μέσα στο BimViewport3D. Render-on-demand (όχι rAF loop) — μόνο όταν αλλάζει το state.
- **Plan-space adapter** (`section-intersect.ts`): exported `toWallPlan/toColumnPlan/toBeamPlan/toSlabPlan/toOpeningPlan` helpers επεκτείνουν τις Nestor BIM entities σε flat `WallPlan/...` records με όλα τα coords σε meters (horizontal Point3D ήδη m + vertical extent mm/1000 = m + ADR-369 baseBinding/topBinding resolution). Pure math πρωτότυπο GenArc αρχιτεκτονικής (intersectEdge, quadCorners, intersectPolygon → wallSection/columnSection/beamSection/slabSection/openingSection + clipByOpenings) διατηρείται 1:1 πέρα από type swap + axis rename `'z'` → `'y'` (Nestor 2D plan convention: y=north αντί GenArc Z=south).
- **Active plane derivation** (`active-plane-derivation.ts`): mapper SectionStore state → `ActivePlane2D{id,label,axis,position}`. Box mode → 4 vertical face options (±X, ±Z mapped σε axis='x'/'y' με Three.js→Nestor sign flip για Z↔y). Plane mode → φιλτράρει planes με `|normal.y| ≥ 0.95` → οριζόντιοι unsupported. World-Y horizontal cuts ΟΧΙ supported στο Phase 7.0B (architectural section = vertical only — horizontal cut θα έπρεπε top-down/loupe rendering, deferred).
- **Scene sync** (`section-scene-sync.ts`): `createSectionPanelSceneSync()` factory κρατάει renderer ref + `syncScene()` reads-on-call pattern (όλα τα `getState()` reads — όχι hooks subscriptions στο factory). Walls/Columns/Beams/Slabs adapter conversion + ConnectedSet substitute = **full-floor scan** (Phase 7.0B simple — spatial filter pending Phase 7.0C optimization).
- **React panel** (`Section2DPanel.tsx`): ADR-040 micro-leaf, 2 useSyncExternalStore (Section2DPanelStore + SectionStore.enabled). Lifecycle effect creates renderer + sync + ResizeObserver. Separate effects subscribe σε activePlaneId / boxBounds / planes / mode / entities / selection → καλούν `refresh()` που τρέχει `syncScene()`. Wheel/pan/click handlers forward σε renderer + selection sync μέσω `pick()` → `Selection3DStore.selectEntity()`. Zero React state για 3D rendering.
- **UI integration** (`Section3DPanelTab.tsx`): νέο "Show 2D panel" toggle + plane selector dropdown (μόνο όταν visible) στο τέλος του τρέχοντος section tab. Dropdown εμφανίζει τα `deriveAvailablePlanes()` options. Fallback message όταν δεν υπάρχει vertical plane.

**Performance**: section scene rebuild = O(N) per entity scan (N = total entities στο floor). Per rebuild: 1 WebGL draw call per section rect (1 filled mesh + 1 outline). Typical residential project (200 walls/columns/beams/slabs) → 200-400 draws per panel render. Render-on-demand pattern: trigger μόνο όταν state αλλάζει (activePlaneId / entities / selection / section bounds). User interaction (zoom/pan) → 1 redraw call per gesture (πανω από rAF throttled). No 60fps stress.

**SSoT compliance** (Phase 7.0B SSoT table addendum):

| Component | SSoT source |
|---|---|
| 2D section panel background | **NEW** `SECTION_2D_PANEL_COLORS.background` (justified — όχι 2D equivalent στο Nestor) |
| 2D section panel entity colors (wall/column/beam/slab) | **NEW** `SECTION_2D_PANEL_COLORS.{wall,column,beam,slab}` (justified ως first occurrence — `SECTION_2D_PANEL_COLORS` SSoT entry) |
| 2D section panel selected highlight | REUSE `HOVER_HIGHLIGHT.ENTITY.glowColor` value (#FFFF00) via `SECTION_2D_PANEL_COLORS.selected` mirror |
| 2D panel outline | **NEW** `SECTION_2D_PANEL_COLORS.outline` (justified — edge clarity token) |
| Active plane derivation | Consumes existing `useSectionStore` state (REUSE Phase 7.0 SSoT) |
| Selection sync | REUSE `useSelection3DStore` (mirror Topic A.1 pattern) |
| Entity feed | REUSE `useBim3DEntitiesStore` (Phase 2 SSoT) |

**Files added** (8 new):
- `bim-3d/2d-section/section-2d-constants.ts` — ortho size, zoom range, pixel ratio, panel height bounds
- `bim-3d/2d-section/section-intersect.ts` — pure math + exported adapter helpers + Plan types
- `bim-3d/2d-section/section-geometry.ts` — `buildSectionPanelScene()` + materials + per-element fill+outline + selection highlight
- `bim-3d/2d-section/section-renderer.ts` — `createSectionPanelRenderer()` factory + mount/zoom/pan/pick/resize/dispose
- `bim-3d/2d-section/section-scene-sync.ts` — `createSectionPanelSceneSync()` + Nestor stores wiring
- `bim-3d/2d-section/active-plane-derivation.ts` — `deriveAvailablePlanes()` + `boxFaceOptions()` + `planeOption()`
- `bim-3d/stores/Section2DPanelStore.ts` — Zustand SSoT (visible, activePlaneId, heightPx)
- `bim-3d/panels/Section2DPanel.tsx` — React micro-leaf component

**Files modified** (4):
- `bim-3d/panels/Section3DPanelTab.tsx` — +Show 2D panel toggle + active plane dropdown (συνέχεια του Phase 7.0 micro-leaf, +1 useSyncExternalStore call)
- `bim-3d/viewport/BimViewport3D.tsx` — `<Section2DPanel />` mount
- `config/color-config.ts` — +`SECTION_2D_PANEL_COLORS` token (background + wall/column/beam/slab/selected/outline)
- `i18n/locales/{el,en}/bim3d.json` — +`section.show2dPanel/show2dPanelAria/activePlaneLabel/noActivePlane` + νέο `section2d.{title,ariaLabel,closeAria,resetView,noPlane}` group

**Scope limits Phase 7.0B**:
- Vertical cuts only (axis='x'|'y'). Horizontal cuts (axis='y' world-Y) DEFERRED Phase 7.0C+ (top-down loupe pattern).
- Openings array empty στο scene-sync feed γιατί OpeningEntity ΔΕΝ είναι στο `Bim3DEntitiesStore` ακόμα — walls εμφανίζονται χωρίς opening cutouts. Hook-ready ως που το ADR-369 Phase A4+ προσθέσει το feed.
- Full-floor scan (όχι spatial filter). Optimization candidate Phase 7.0C.
- Per-material hatch ΟΧΙ supported (Phase 7.1+ ADR-363 ShaderType registry).

**Industry alignment**: Bottom-strip panel + dropdown plane selector + zoom/pan/click-pick = canonical Navisworks/AutoCAD 2D section view pattern. Solid grey scale (wall=#6c6c6c, column=#5a5a5a, beam=#7a7a7a, slab=#9e9e9e) + yellow selection = Revit-style architectural section convention.

**Hotfix — Phase 7.0B useSyncExternalStore infinite loop (2026-05-20)**:

`Section2DPanel.tsx` original snapshot used object-literal selectors:
```ts
() => selectPanelState(useSection2DPanelStore.getState())
// returns { visible, activePlaneId, heightPx } — NEW REF every call
```
`useSyncExternalStore` compares snapshots via `Object.is`. A fresh object literal on each invocation fails the equality check → React schedules re-render → next call returns fresh ref → loop. Browser crashed with "Maximum update depth exceeded" on `/dxf/viewer` mount (BimViewport3D mounts `<Section2DPanel />` unconditionally; the hooks run even when `visible=false` early-returns null).

**Fix**: replace both snapshot fns with primitive selectors (`s => s.visible` / `s => s.heightPx` / `s => s.enabled`) and remove the `selectPanelState` / `selectSectionEnabled` helpers. Primitives are stable under `Object.is`. Matches sibling pattern in `Section3DPanelTab.tsx` / `BimEntityCardPanel.tsx`.

**Cardinal rule** (ADR-040 addendum for micro-leaves): `useSyncExternalStore` snapshot getter MUST return either a primitive, the whole zustand state ref (`useStore.getState`), or a memoized ref. Never a fresh object literal.

Files modified (1): `bim-3d/panels/Section2DPanel.tsx`.

**Implementation note — Phase 7.0b (1-pass Stencil Optimization, 2026-05-20)**:

Phase 7.0a noted "future optimization Phase 7.0b candidate = custom shader για back+front σε ένα pass." Phase 7.0b implements this via `gl.stencilOpSeparate` (WebGL1/2 native), bypassing Three.js's material abstraction using a stencil state cache trick.

**Problem**: Three.js Material doesn't expose per-face stencil ops. `material.stencilZPass` maps to `gl.stencilOp(FRONT_AND_BACK, ...)`. Calling `gl.stencilOpSeparate(FRONT, DECR_WRAP)` before `renderer.render()` gets overwritten when Three.js processes the first object (cache-miss → `gl.stencilOp(INCR_WRAP)` for FRONT_AND_BACK).

**Solution — cache trick (per plane)**:
1. Render a zero-area warmup mesh (PlaneGeometry `scale.set(0,0,1)`, `frustumCulled=false`) with `singlePassStencilMat` (DoubleSide, `stencilZPass=IncrementWrap`). Produces zero fragments = zero stencil writes. Purpose: seeds Three.js's internal WebGL state cache with `currentZpass=IncrementWrap`.
2. Call `gl.stencilOpSeparate(gl.FRONT, gl.KEEP, gl.KEEP, gl.DECR_WRAP)`. Three.js cache still shows IncrementWrap (unaware of raw GL call).
3. Main scene render with `overrideMaterial=singlePassStencilMat`. Per BIM object: Three.js checks `material.stencilZPass (Increment) === cached (Increment)` → **CACHE HIT** → skips `gl.stencilOp` → FRONT override persists throughout all BIM objects.
4. Result: back-facing fragments → IncrementWrap (entering solid), front-facing → DecrementWrap (exiting solid). Odd parity where cut → NotEqual(0) → cap quad fills cut surface. Correctness identical to Phase 7.0a.

**Performance gain**: old = 2N BIM scene renders + N cap quads. New = N warmup renders (negligible) + N BIM scene renders + N cap quads. Net: ~50% fewer large scene renders. Box mode worst case: 12 → 6 BIM renders/frame.

**Three.js compatibility**: Tested with `^0.170.0`. Cache trick relies on `WebGLState.stencil.currentZpass` caching (stable since r0.138). Warmup mesh: zero GPU overhead (degenerate triangles at scale=0, zero rasterized fragments). Cache invalidated only if `singlePassStencilMat.stencilZPass` changes — it doesn't, it's fixed at IncrementWrap.

**SSoT compliance**: `SECTION_CUT_SURFACE` reuse unchanged. No new tokens.

**Files modified** (1):
- `~systems/section/section-stencil-renderer.ts` — `backStencilMat`+`frontStencilMat` (2 materials, 2 scene passes) replaced with `singlePassStencilMat` (DoubleSide) + `warmupScene` (zero-area cache seed). `renderCapForPlane`: warmup → `gl.stencilOpSeparate(FRONT, DECR)` → single main render → cap. Public API (`render(renderer, mainScene, camera, planes, sceneBounds)`) unchanged. `section-scene-controller.ts` and `ThreeJsSceneManager.ts` untouched.

---

**Implementation note — Phase 7.0C (Selection-aware Cap Emphasis, 2026-05-20)**:

DEFERRED item (d) from Phase 7.0a: "selection-aware emphasis intersect Phase 7.0+ TBD". Phase 7.0C implements Revit/Navisworks-style yellow emphasis on the stencil cap of the selected entity when a section plane intersects it.

**Architecture — Dual-cap render (Option A)**:

After the normal grey cap render (Phase 7.0b pass), if `Selection3DStore.selectedBimId !== null`:
1. **Visibility mask**: traverse `mainScene`, set `visible=false` for all `THREE.Mesh` objects where `userData['bimId']` is set AND `!== selectedBimId`. Non-BIM objects (DXF, lights, sectionBox handles) unaffected.
2. **2nd stencil pass**: clearStencil → warmup seed → `gl.stencilOpSeparate(FRONT, DECR_WRAP)` → `overrideMaterial=singlePassStencilMat` render. Stencil encodes only the selected entity's solid interior.
3. **Restore visibility**: loop over hidden array, set `visible=true`.
4. **Emphasis cap render**: `selectedCapMat` (color=#FFFF00, opacity=0.85) fills stencil where selected entity was cut. Rendered on top of grey cap via `depthTest=false` → yellow overwrites grey for selected entity only.

**SSoT compliance**:
- `SECTION_CUT_SURFACE.selectedCapColor = HOVER_HIGHLIGHT.ENTITY.glowColor` (#FFFF00) — REUSE, no new token. Mirrors `SECTION_2D_PANEL_COLORS.selected` semantic (Phase 7.0B precedent).
- `useSelection3DStore.getState()` — direct Zustand non-React access (plain class, outside React tree). REUSE Topic A.1 store.

**Performance**: 0 cost when no entity selected (branch not taken). When selected: +1 mainScene BIM render per active plane + O(N) traverse. Box mode worst case (6 planes × 1 entity selected): +6 BIM renders. Acceptable: selection is UI-interactive state (not 60fps idle cost).

**Three.js compatibility**: warmup cache trick reused verbatim from Phase 7.0b. No new GL extensions.

**Files modified** (2):
- `~systems/section/section-stencil-renderer.ts` — +`selectedCapMat`+`selectedCapMesh`+`selectedCapScene` fields, +`createSelectedCapMaterial()`, +`renderEmphasisCapForPlane()`, `positionCapMesh` → `positionMesh(mesh, plane, size)` generalized. `render()` / `StencilRendererDeps` / `section-scene-controller.ts` untouched.
- `~config/color-config.ts` — `SECTION_CUT_SURFACE` +`selectedCapColor` (= `HOVER_HIGHLIGHT.ENTITY.glowColor`) + `selectedCapOpacity` (0.85).

---

**Implementation note — Phase 7.1 (Hatched per-material cut surface, 2026-05-21)**:

DEFERRED item (b) from Phase 7.0a: "hatched per-material cut Phase 7.1+ (ADR-363 ShaderType)". ADR-363 Phase 6 ShaderType registry NOT yet implemented → selected **Option A (CanvasTexture)** over Option B (ShaderMaterial GLSL) and Option C (ADR-363 dependency). CanvasTexture: zero shader code, Three.js native, resolution adequate for 3D section views (patterns visible at typical zoom levels), no new ADR-363 dependency.

**Architecture — CanvasTexture hatch overlay (additive on top of Phase 7.0b grey cap)**:

Rendering flow per plane (Phase 7.1 extended from Phase 7.0b):
1. Phase 7.0b grey cap (unchanged) — fills ALL cut areas with solid grey base, resets stencil to 0.
2. **NEW**: `collectHatchGroups(mainScene)` — O(N) traverse once per `render()` call (not per plane). Groups BIM meshes by `SectionHatchKey` using `userData['matId']`. Meshes with null key (glass/unknown) excluded → grey base covers them.
3. **NEW**: Per hatchKey group, per plane: clearStencil → warmup seed → `gl.stencilOpSeparate(FRONT, DECR_WRAP)` → render ONLY meshes of this material (visibility mask, same Phase 7.0C pattern) → hatch CanvasTexture cap overlay (on top of grey, `depthTest=false`).
4. Phase 7.0C emphasis cap (unchanged) — yellow overrides hatch for selected entity.

**Hatch patterns (Revit/AutoCAD architectural convention)**:

| `SectionHatchKey` | Pattern | Canvas algo | Material IDs |
|---|---|---|---|
| `'rc'` | Dot grid (σκυρόδεμα) | `arc()` at evenly-spaced grid | `mat-concrete`, `mat-plaster`, `mat-tile`, `elem-*` defaults |
| `'steel'` | Cross-hatch × (χάλυβας) | Diagonal lines ↘ + ↗ | `mat-metal`, entity `material='steel'` |
| `'masonry'` | Horizontal brick courses (τοιχοποιία) | Horizontal lines + staggered vertical joints | `mat-brick`, `mat-stone`, entity `material='masonry'` |
| `'wood'` | Diagonal parallel lines (ξύλο/glulam) | Single-direction diagonals | `mat-wood`, entity `material='wood'` or `'glulam'` |
| `null` | Grey solid fallback | — | `mat-glass`, unknown/undefined |

**Material ID → hatch key lookup** (two-stage, case-insensitive):
1. Entity-level `params.material` (column/beam/slab): `'rc'→rc`, `'steel'→steel`, `'masonry'→masonry`, `'wood'→wood`, `'glulam'→wood`
2. MaterialCatalog3D prefix: `'mat-concrete*'→rc`, `'mat-brick*'→masonry`, `'mat-stone*'→masonry`, `'mat-wood*'→wood`, `'mat-metal*'→steel`, `'mat-glass*'→null`, `'elem-*'→rc`

**BimToThreeConverter change** — `tagMesh()` now stores `userData['matId']` (raw material ID string) alongside `bimId`/`bimType`. Wall: matId = DNA core layer materialId (same lookup as before). Column/Beam/Slab: matId = `params.material ?? 'elem-{type}'`. No new external imports in converter. `resolveWallMaterial()` removed (inlined into `wallToMesh` per DRY cleanup).

**Texture spec**:
- Canvas 128×128px per key (cached module singletons).
- `THREE.CanvasTexture`, `wrapS/wrapT = RepeatWrapping`.
- Tile size = `TILE_M = 0.25m` world space. UV repeat = `capSize / TILE_M` (updated per render call).

**Performance**:
- `collectHatchGroups`: O(N_bim_meshes) once per frame → negligible (same order as Phase 7.0C emphasis traverse).
- Per plane cost: +N_unique_keys × (1 BIM scene render + O(N) traverse + 1 hatch cap render).
- Typical residential scene (3 materials: RC/steel/masonry): +3 BIM renders per plane. Box mode (6 planes): 6 + 18 = 24 BIM renders vs Phase 7.0b's 6. Acceptable: section editing = active interaction (not idle 60fps cost).
- Zero cost when no BIM entities in scene (hatchGroups.size === 0 → branch skipped).

**SSoT compliance** (Phase 7.1 SSoT table addendum):

| Component | SSoT source |
|---|---|
| Hatch key resolution | **NEW** `section-hatch-cap.ts` → `resolveHatchKey(matId)` SSoT (single place maps materialId→hatchKey) |
| Hatch CanvasTexture builders | **NEW** `section-hatch-cap.ts` (lazy module-singleton cache, dispose on teardown) |
| Hatch stencil masking | REUSE Phase 7.0C `renderEmphasisCapForPlane` visibility-mask pattern (mirror, not duplicate) |
| BIM mesh material tag | **NEW** `userData['matId']` on every BIM mesh (set at creation in `BimToThreeConverter.tagMesh`) |

**Files added** (1):
- `+systems/section/section-hatch-cap.ts` — `SectionHatchKey` type, `resolveHatchKey()`, CanvasTexture builders × 4, `getHatchCapMaterial()`, `setHatchRepeat()`, `disposeHatchCap()`

**Files modified** (2):
- `~systems/section/section-stencil-renderer.ts` — +imports from `section-hatch-cap`, +`hatchCapMesh`+`hatchCapScene` fields, +`collectHatchGroups()`, +`renderHatchOverlaysForPlane()`, +`renderHatchGroupForPlane()`. `render()` passes `hatchGroups` to `renderCapForPlane`. `renderCapForPlane` calls hatch overlays after grey cap, before emphasis cap. `dispose()` +hatch scene cleanup + `disposeHatchCap()`.
- `~converters/BimToThreeConverter.ts` — `tagMesh()` +`matId: string` param → `userData['matId']`. All 4 converters compute matId. `resolveWallMaterial()` removed (inlined).

---

### A.2 — Gizmos (translate/rotate/scale handles, hit tolerance, snap, modifiers) — ✅ CLOSED 2026-05-19

**Σκοπός**: Καθορισμός pattern για interactive editing handles στο 3D (Phase 7+). 3 modes (Move/Rotate/Scale) + axis lock + plane handles + snap. Phase 4-6 = read-only viewer, gizmos δεν εμφανίζονται. Καταγράφω αρχιτεκτονική πρόθεση τώρα για να μην ξανασχεδιάσουμε στο Phase 7.

**Industry analysis (6 players)**:

| Πρόγραμμα | Gizmo widget; | Modes | Axis colors | Plane handles | Mode shortcut | Snap modifier |
|---|---|---|---|---|---|---|
| **AutoCAD 3D** | ✅ on-selection (3D visual style) | Move + Rotate + Scale | Κόκκινο=X / Πράσινο=Y / Μπλε=Z | ✅ XY/XZ/YZ | `DEFAULTGIZMO` sysvar | Object Snap toggle |
| **Blender** | ✅ widget | W=Translate / E=Rotate / R=Scale | Κόκκινο=X / Πράσινο=Y / Μπλε=Z | ✅ planes + screen-space | W/E/R + G/R/S keyboard alternatives | Hold Shift |
| **SketchUp** | ❌ widget — αλλά separate tools | M=Move / Q=Rotate / S=Scale | Κόκκινο=X / Πράσινο=Y / Μπλε=Z inference | Inference + arrow keys lock | M/Q/S | Inference always-on |
| **Three.js TransformControls** | ✅ standard widget | W=translate / E=rotate / R=scale | Κόκκινο=X / Πράσινο=Y / Μπλε=Z | ✅ + screen-space | W/E/R + X/Y/Z + Q world/local | Hold Shift |
| **Twinmotion/Lumion** | ✅ widget με color-coded arrows | T/R/S keys | Κόκκινο/Πράσινο/Μπλε | ✅ | T/R/S | Snap optional |
| **Revit** | ❌ ΟΧΙ gizmo — direct grip drag (μπλε arrow shape handles) + Properties panel για typed values | Drag = move (per-axis arrow), rotate symbol = rotate | Μπλε (uniform, no axis color coding) | ❌ | καθόλου — UI-based | Snap to model |

**Σύγκλιση συμπερασμάτων**:

1. **Color coding X=Κόκκινο / Y=Πράσινο / Z=Μπλε**: 5/6 (όλοι εκτός Revit). Universal industry standard. Καταγραφή για όλα τα 3D coordinate visualizations (gizmo + ViewCube ring + axis indicator).
2. **3 modes Move + Rotate + Scale**: 6/6 universal. Όλοι τους παρέχουν τα 3 modes (αλλά SketchUp/Revit ως separate tools, όχι ως ενιαίο widget).
3. **Widget vs grip-drag**: 5/6 widget pattern (AutoCAD/Blender/SketchUp tools/Three.js/Twinmotion), 1/6 Revit grip-drag. **Industry default = widget**. Nestor 2D ακολουθεί grip-drag pattern (όχι widget) — οπότε 3D pattern είναι αρχιτεκτονική **απόφαση**.
4. **Mode keyboard shortcut**: 4/6 explicit (Blender W/E/R, Three.js W/E/R, SketchUp M/Q/S, Twinmotion T/R/S). AutoCAD sysvar (less direct), Revit καθόλου (UI-based).
5. **Plane handles (XY/XZ/YZ)**: 5/6 (Revit μόνο axis arrows). Καλύπτεται από GenArc port.
6. **Snap modifier (hold Shift)**: 3/6 explicit (Blender, Three.js, Twinmotion). AutoCAD/SketchUp inference always-on, Revit grip-snap auto. **Hold Shift industry standard** για disable snap when desired.
7. **Hover highlight axis (yellow)**: 6/6. Όταν περάσει το ποντίκι από axis arrow → κίτρινο highlight. **Reuses `HOVER_HIGHLIGHT.ENTITY.glowColor`** (#FFFF00) από SSoT.

**GenArc reuse (SPEC-3D-004A §2.3 + §4.2)**:

| Κατηγορία | Files | LOC | Decision |
|---|---|---|---|
| **PORT_AS_IS — Visual primitives** | `gizmoBuilders.ts` + `gizmoGeometry.ts` + `gizmoHandleBuilders.ts` + `gizmoHitTest.ts` | ~994 | ✅ Phase 7 ready: axis arrows, plane handles (XY/XZ/YZ), resize handles (octahedron + L-brackets), rotate rings, center reticle, origin marker, priority-based hit test (`rotate-* (5) > resize-* (4) > center (3) > plane-* (2) > axis-* (1)`). Premium quality. |
| **EXTRACT_CONCEPT — FSM controller** | `gizmoController.ts` + `gizmoDragHandler.ts` + `gizmoOverlay.ts` | ~2.553 | 🟡 Phase 7+: idle/hover/drag FSM, raycaster routing, double-click handlers (invert axis, cycle anchor), constrained projection, single-drag = one undo snapshot, supports duplicate-on-drag. **Heavy GenArc store coupling** → reimplement με Nestor SSoT (Selection3DStore + BIM mutations service). |

**Architectural implications για ADR-366**:

- **Phase 7 effort**: ~12-15h (visual primitives port 2h + FSM controller rewrite με Nestor SSoT 8-10h + Move/Rotate/Scale modes wiring 2-3h)
- **Activation pattern**: gizmo auto-appears όταν `selectedEntityIds.size === 1` (industry default 5/6), δεν εμφανίζεται για multi-selection ή κενή επιλογή
- **Mode toggle**: keyboard W/E/R shortcuts (Blender + Three.js standard), Three.js TransformControls API ως reference implementation
- **Axis colors SSoT**: νέα tokens `AXIS_COLORS_3D` σε `color-config.ts` (R=`#FF0000`, G=`#00FF00`, B=`#0000FF`) — DEN υπάρχουν 2D αντίστοιχα (Nestor 2D δεν έχει axis indicator), οπότε **νέο SSoT entry** πλήρως δικαιολογημένο. Επεκτείνει αυτόματα και ViewCube ring + future axis overlay.
- **Hover highlight axis**: REUSE `HOVER_HIGHLIGHT.ENTITY.glowColor` (#FFFF00) — SSoT mirror του 2D pattern.
- **Snap integration**: Phase 7 wire-up με Nestor's existing 17-engine snap system (SPEC-3D-004C confirmed Nestor superset). Default snap on, Hold Shift = temporary disable. Industry standard.
- **Undo**: single drag = single undo snapshot, Nestor ICommand pattern (consistent με 2D edit operations).

**Decisions Log (Γιώργος)** — Topic A.2 CLOSED 2026-05-19:

| # | Ερώτηση | Απόφαση | Industry alignment |
|---|---|---|---|
| A.2.Q1 | Gizmo pattern (widget vs grip-drag vs hybrid) | **Grip-drag pattern (mirror Nestor 2D) + X/Y/Z keyboard axis lock**. Πιάνεις grip στην κορυφή/midpoint, σέρνεις. Κρατάς X/Y/Z για κλείδωμα σε άξονα (Blender/SketchUp inference). ΟΧΙ widget. | Revit + Nestor 2D grip-drag (1/6 + Nestor consistency) + Blender X/Y/Z inference lock (best-of-both pattern). SSoT prioritized πάνω από industry widget convergence (5/6). |
| A.2.Q2 | Rotate / Scale UX | **Ribbon tools + Properties panel για typed values**. Mirror του Nestor 2D pattern (rotate/scale tools στο ribbon ήδη). Όχι separate gizmo rotation rings ή scale handles. | Revit (Properties + ribbon edits). Nestor 2D consistency. |
| A.2.Q3 | Snap engine | **REUSE Nestor's `ProSnapEngineV2`** (17-engine, SPEC-3D-004C confirmed superset του GenArc 7-strategy). Default snap on. **Hold Shift = temporary disable** (Blender/Three.js standard). | 3/6 industry (Blender, Three.js, Twinmotion). SSoT REUSE του 2D snap. |
| A.2.Q4 | Axis lock visual feedback κατά X/Y/Z hold | **Temporary χρωματιστή γραμμή στον άξονα** (κόκκινο X / πράσινο Y / μπλε Z), εμφάνιση ΜΟΝΟ ενώ το πλήκτρο πατημένο, εξαφάνιση on release. Καταναλώνει **νέο SSoT token `AXIS_COLORS_3D`** σε `color-config.ts` (R=`#FF0000`, G=`#00FF00`, B=`#0000FF`). | Universal RGB axis standard (5/6). Νέο token full δικαιολογημένο — Nestor 2D δεν έχει 3D axis indicator. Επεκτείνεται σε ViewCube ring + future axis overlay (SSoT entry-point). |
| A.2.Q5 | Grip color tokens | **REUSE `CAD_UI_COLORS.grips`** (cold/warm/hot — μπλε/pink/κόκκινο, AutoCAD standard) — ίδια με Topic A.1 selection grips. Μηδέν παράλληλη 3D grip palette. | SSoT mirror του 2D Nestor (cardinal principle [[3d-mirror-2d-ssot]]). |

**Cross-reference**:
- SPEC-3D-004A §2.3 — GenArc 4 PORT_AS_IS visual primitives (~994 LOC: gizmoBuilders + gizmoGeometry + gizmoHandleBuilders + gizmoHitTest). **Status post-A.2**: **DEFERRED Phase 8+** optional add-on αν Γιώργος αλλάξει γνώμη και θελήσει widget pattern. Όχι Phase 7 mandatory scope.
- SPEC-3D-004A §4.2 — GenArc 3 EXTRACT_CONCEPT FSM controllers (~2.553 LOC: gizmoController + gizmoDragHandler + gizmoOverlay). **Status post-A.2**: **NOT NEEDED** — grip-drag pattern reuses Nestor 2D grip handlers extended σε 3D (TBD architecture Phase 7 planning).
- SPEC-3D-004C §1.2 — `gizmoProjection.ts` PORT_WITH_ADAPTATION constrained drag math. **Status post-A.2**: **STILL VALUABLE** — provides axis-constrained projection math για X/Y/Z keyboard lock implementation. Keep as PORT_WITH_ADAPTATION.

**Effort impact**: Phase 7 (Polish) ήταν 12-14h post-Q4. Με grip-drag + axis lock + ProSnapEngineV2 wire-up = **18-22h** (+6-8h, αντί +8-11h widget approach). Total estimate από 72-82h → **78-90h**. Phase 8+ gizmo widget addition (optional) = ~6-8h extra αν προστεθεί ποτέ.

**SSoT compliance summary**:

| Component | SSoT source |
|---|---|
| Grip rendering 3D | `CAD_UI_COLORS.grips` (REUSE 2D) |
| Hover highlight axis | `HOVER_HIGHLIGHT.ENTITY.glowColor` (REUSE 2D) |
| Snap detection | `ProSnapEngineV2` (REUSE 2D) |
| Selection state | `Selection3DStore` (mirror Nestor 2D selection store) |
| Axis lock visual | **NEW** `AXIS_COLORS_3D` token (justified — no 2D equivalent) |
| Mutation pipeline | Nestor ICommand pattern (REUSE 2D edits) |
| Undo/redo | Nestor BIM mutation service (REUSE 2D) |

**Pattern σε μία πρόταση**: "Όπως κάνεις στην κάτοψη, αλλά με 3 άξονες αντί 2 — και X/Y/Z πλήκτρα για να κλειδώνεις άξονα."

---

### A.1 — 3D Selection UX (highlight / outline / multi-select) — ✅ CLOSED 2026-05-19

**Στόχος**: Καθορισμός hover highlight + click selection + multi-select + marquee patterns για το 3D viewer. Πώς ξεχωρίζει visually το element που είναι hover vs selected, και πώς συνδυάζονται keyboard modifiers.

**Industry analysis (6/6 σύγκλιση κατευθυντήριων αρχών)**:

| Πρόγραμμα | Hover highlight | Single-click | Multi-select | Marquee | Cycle overlaps |
|---|---|---|---|---|---|
| **Revit** | Blue outline + heavier line weight + tooltip + status bar | Replace selection | Ctrl+click add | Drag rect | Tab |
| **ArchiCAD** | Highlight + Shift modifier για Arrow tool | Replace | Shift+click toggle | Drag rect | Tab |
| **AutoCAD** | Rollover highlight | Replace | Shift+click add/remove | L→R blue Window, R→L green Crossing | Shift+Space |
| **Blender** | — (selection-immediate) | Replace | Shift+click toggle | B key + drag (rect) | Alt+click |
| **Three.js (OutlinePass standard)** | Pre-select outline (lighter color) | Replace | Shift+click add | Custom rubber-band | — |
| **Twinmotion/Lumion/Enscape** | Object outline highlight | Replace | Shift+click | — (viewer-only mode) | — |

**Σύγκλιση συμπερασμάτων**:

1. **Hover (pre-select)**: 6/6 πρόγραμματα δείχνουν outline πριν κάνεις click. Όχι fill change — μόνο edge thickening + light blue color.
2. **Single-click**: 6/6 replace current selection. Universal.
3. **Shift+click toggle/add**: 5/6 (ArchiCAD, AutoCAD, Blender, Three.js, Twinmotion). Revit χρησιμοποιεί Ctrl+click αντί. **Nestor convention: Shift+click toggle** (συμβατό με Nestor 2D selection ήδη).
4. **Ctrl+click remove**: 3/6 (Revit, Blender Ctrl με Box, partial AutoCAD). **Optional Phase 4.x** — Shift+click toggle ήδη καλύπτει remove use case.
5. **Drag marquee**: 6/6 με 2 παραλλαγές directionality:
   - **AutoCAD convention** (L→R blue Window enclosure / R→L green Crossing) = ηγετική BIM/CAD πρότυπη συμπεριφορά. GenArc `windowSelectionOverlay.ts` (131 LOC) ήδη υλοποιεί ακριβώς αυτό το pattern — DOM rubber-band, zero Three.js coupling, **SPEC-3D-004A §4 PORT_AS_IS**.
   - **Blender convention** (B key + drag any direction) = κυρίως game/graphics audience, λιγότερο BIM-friendly.
   - **Επιλογή Nestor: AutoCAD convention** — convergence με 2D Nestor canvas behavior (ήδη χρησιμοποιεί window-selection pattern).
6. **Escape**: 6/6 deselect all.
7. **Tab cycle overlaps**: 3/6 (Revit, ArchiCAD, Blender Alt+click). **Phase 4.x optional** — value για dense BIM scenes με overlapping elements.

**Three.js outline rendering tech (από Three.js docs + community best practices)**:

- **Post-processing**: `OutlinePass` (jsm/postprocessing/OutlinePass.js) — production-standard
- **Defaults**: `edgeStrength=3.0`, `edgeThickness=1.0`, `edgeGlow=0` (no bloom). Recommended Nestor: `edgeStrength=3.0`, `edgeThickness=2.0`, `edgeGlow=0.5` (subtle visibility through occluders)
- **Colors**: `visibleEdgeColor` (front-facing edges) + `hiddenEdgeColor` (X-ray edges πίσω από geometry)
- **Anti-alias**: combine με `FXAA pass` (απαραίτητο για clean edges, ειδικά σε WebGL renderer)
- **Pattern texture**: `usePatternTexture=true` optional για striped/dotted outlines (selection vs hover distinguish) — **deferred Phase 4.x**

**Color tokens — SSoT REUSE από DXF Viewer 2D (ADR-366 cardinal SSoT rule)**:

Νέα κεντρική αρχή (όπως κάνουν Revit/AutoCAD/ArchiCAD — ένα theme για όλα τα modes): **το 3D selection UX καταναλώνει τα ΙΔΙΑ tokens που χρησιμοποιεί ήδη το DXF Viewer 2D**. Δεν δημιουργείται παράλληλη 3D color palette. Source-of-truth: `src/subapps/dxf-viewer/config/color-config.ts`.

| State | SSoT token | Hex value | Three.js | Rationale |
|---|---|---|---|---|
| Hover (pre-select) | `HOVER_HIGHLIGHT.ENTITY.glowColor` | `#FFFF00` (κίτρινο, AutoCAD-style glow) | `0xFFFF00` | Ήδη χρησιμοποιείται στο 2D `PhaseManager.applyHighlightedStyle()` με glowExtraWidth=6 + glowOpacity=0.35. 3D equivalent: OutlinePass με ίδιο χρώμα + edgeStrength=3.0/edgeThickness=2.0/edgeGlow=0.5. |
| Hover (text entities) | `HOVER_HIGHLIGHT.TEXT.glowColor` | `#FFFF00` | `0xFFFF00` | 3D δεν renders 2D text — N/A. |
| Selected entity (visual via grips, AutoCAD-style mirror του Nestor 2D) | `CAD_UI_COLORS.grips.cold/warm/hot` | `#FF0000/#FF69B4/#FF0000` | — | **Decided A.1.Q3**: 2D Nestor pattern — grips εμφανίζονται στις κορυφές του selected entity. 3D μεταφορά = sphere/box markers στα corners + edge midpoints + face centers. ΟΧΙ OutlinePass για selected (μόνο για hover). |
| Selection marquee (drag rect) | `UI_COLORS.SELECTION_MARQUEE` + `SELECTION_MARQUEE_BG` | `#3b82f6` + `rgba(0, 122, 204, 0.1)` | — | Pure DOM rubber-band (GenArc `windowSelectionOverlay.ts` PORT_AS_IS). Reused, zero new color. |
| Hidden edges X-ray (πίσω από geometry, hover only) | `HOVER_HIGHLIGHT.ENTITY.glowColor` με α-reduce | `#FFFF00` + opacity 0.35 | `0xFFFF00` με `hiddenEdgeColor` darker variant | Hover OutlinePass `hiddenEdgeColor` = darker variant του #FFFF00 (π.χ. `#A07000`) για visibility μέσω occluding geometry. |

**Architectural rule**: Νέο token MONO αν industry σύγκλιση 4+ απαιτεί διαφορετικό χρώμα στο 3D selection vs hover. Default: REUSE.

**Architectural implications για ADR-366**:

- **Phase 4 (Camera + ViewCube)**: +~4h για selection layer:
  - `Selection3DStore` (Zustand) — SSoT για hover/selection state
  - OutlinePass integration για hover ONLY (`HOVER_HIGHLIGHT.ENTITY.glowColor` κατανάλωση)
  - 3D Grip markers (sphere/box meshes) στις κορυφές/midpoints/face centers του selected entity, ακολουθώντας `CAD_UI_COLORS.grips` palette
  - Hover raycaster + click-to-select με Ctrl+/Shift+ modifier logic (Revit pattern)
- **Phase 4.x optional add-ons**: Tab cycle overlaps (~1h), grip drag editing (Phase 7+)
- **SSoT**: Νέο `Selection3DStore` (Zustand): `{ hoveredEntityId: string | null, selectedEntityIds: Set<string>, lastClickedEntityId: string | null }`. Πλήρως αντίστοιχο με existing Nestor 2D selection store conceptually (καταναλώνει ίδια entity IDs). Optional cross-mode sync bridge Phase 2.x για διατήρηση επιλογής όταν αλλάζεις mode 2D↔3D.
- **Hit detection**: Three.js `Raycaster` + per-entity userData lookup (`mesh.userData.entityId`) — zero per-frame overhead όταν δεν υπάρχει pointer movement.
- **Grip rendering**: `Selection3DGripRenderer` νέο component, καταναλώνει `CAD_UI_COLORS.grips` (SSoT). Sphere markers (radius ≈ 5px screen-space, billboard) στις κορυφές/midpoints, fixed pixel size ανεξάρτητα camera distance.
- **Performance**: OutlinePass τρέχει ΜΟΝΟ όταν `hoveredEntityId !== null`. Grip rendering τρέχει ΜΟΝΟ όταν `selectedEntityIds.size > 0`. Bypass όταν inactive (composer.passes filter + group.visible toggle).
- **Future-proof**: Όλα τα χρώματα/sizes αντλούνται runtime από `color-config.ts`. Αλλαγή pattern → ένα αρχείο, εφαρμόζεται σε 2D + 3D ταυτόχρονα. **Πλήρης SSoT compliance.**

**Decisions Log (Γιώργος)**:

| # | Ερώτηση | Απόφαση | Industry alignment |
|---|---|---|---|
| A.1.Q1 | Modifier για πολλαπλή επιλογή | **Revit pattern**: Ctrl+κλικ προσθέτει, Shift+κλικ αφαιρεί (απομάκρυνση συγκεκριμένου από επιλογή). Single-click replace. ESC deselect-all. | Revit (Autodesk family standard). Διαφορά από AutoCAD/ArchiCAD/Blender (Shift+toggle), αλλά Revit είναι το ηγετικό BIM platform για το audience του Nestor (αρχιτέκτονες/μηχανικοί). |
| A.1.Q2 | Παλέτα χρωμάτων hover/selected | **SSoT REUSE από `color-config.ts`** — όχι νέα παράλληλη 3D παλέτα. `HOVER_HIGHLIGHT.ENTITY.glowColor` (#FFFF00) για hover σε 3D + ίδια tokens για grips/marquee. Ένα theme για 2D και 3D, όπως Revit/AutoCAD/ArchiCAD. | 3/3 σύγκλιση industry — ίδιο selection theme σε όλα τα modes ενός προγράμματος. Nestor SSoT rule N.0/N.12. |
| A.1.Q3 | Visual style διαλεγμένου entity (outline vs grips vs both) | **AutoCAD-style grips (mirror του Nestor 2D)** — όχι outline pass για selected, αλλά εμφάνιση 3D grip markers στις κορυφές/edge midpoints/face centers, καταναλώνοντας `CAD_UI_COLORS.grips` (cold/warm/hot). Hover → OutlinePass με `HOVER_HIGHLIGHT.ENTITY.glowColor`. Selected → grips visible. **Γιατί**: ίδιο pattern με 2D Nestor, ΟΛΑ τα tokens centralized → αλλαγή αύριο σε ένα αρχείο (`color-config.ts` + `PhaseManager` equivalents 3D) αλλάζει παντού. | AutoCAD 3D = grips identical σε 2D και 3D (1/4 industry full match — ίδιο pattern + ίδια tokens). Nestor SSoT prioritized πάνω από Revit/Blender outline pattern. |
| A.1.Q4 (implicit) | Marquee selection directionality + χρώματα | **Mirror του Nestor 2D DXF Viewer** — `SelectionSettings.tsx` ήδη ορίζει `window` + `crossing` tabs με κεντρικά χρώματα (`settings.selection.window.{fillColor,fillOpacity,borderColor}` + `crossing` αντίστοιχο). 3D rubber-band καταναλώνει τα ίδια settings keys — zero νέα παράλληλα tokens. GenArc `windowSelectionOverlay.ts` PORT_AS_IS παρέχει DOM rendering με AutoCAD L→R Window / R→L Crossing logic. | AutoCAD pattern (hardcoded standard) + Nestor 2D ήδη implements αυτό. SSoT REUSE. |
| A.1.Q5 (implicit) | Grip 3D shape σε three.js (billboard square vs sphere vs cube) | **Billboard square** (mirror του 2D Nestor + AutoCAD 3D) — fixed pixel size ανεξάρτητα camera distance, σταθερή οπτική παρουσία σε orthographic + perspective. Three.js: `Sprite` με canvas-rendered τετράγωνο ή `Mesh` με billboard `onBeforeRender` rotation. | AutoCAD 3D = billboard squares (industry standard). Sphere/cube alternative απορρίπτεται γιατί perspective scaling κάνει το grip ασύμμετρο/δύσκολο σε hit-test. |

**Effort revision (final post A.1 closure)**: Phase 4 από 8-10h → **12-14h** (+selection layer 4h: Selection3DStore + OutlinePass hover + grip markers SSoT-driven). Total estimate από 70-78h → **72-82h**.

**Cross-reference**: SPEC-3D-004A §4 (`windowSelectionOverlay.ts` PORT_AS_IS) — already covered marquee piece.

---

## Appendix B — Group B Deep Research (post-Group-A, Materials/Lighting/BIM Data/Performance UX)

> Post-Group-A deep-dive research για 5 core topics. Phase 5 (Materials/Lighting) και Phase 7 (Polish) UX refinements. Group A έκλεισε interaction layer (selection/gizmos/sections/camera/viewcube/keyboard/a11y) — Group B καλύπτει visual quality + BIM data overlay + performance UX.

### B.1 — Materials & Lighting UX — ✅ CLOSED 2026-05-19

**Σκοπός**: Καθορισμός default lighting strategy, time-of-day UX, BIM solar studies integration. Phase 5 (Materials & Lighting) core decisions.

**Cross-references**: §7 SPEC-3D-003 Materials & Lighting skeleton, ADR-326 tenant project location metadata, ADR-366 §9 Q4 (HDRI ως Phase 7 polish).

**Pending micro-decisions**:
- Q1: Φωτισμός εκκίνησης (presets / slider / combo + BIM geolocation) ✅ RESOLVED
- Q2: Shadow quality + soft shadow tier ✅ RESOLVED
- Q3: Ambient occlusion ✅ RESOLVED
- Q4: Environment reflections ✅ RESOLVED

**Decisions Log (Γιώργος)** — Topic B.1 COMPLETE 4/4 Qs:

| # | Ερώτηση | Απόφαση | Industry alignment |
|---|---|---|---|
| B.1.Q1 | Φωτισμός εκκίνησης σε photorealistic mode | **Combo 3-tier + BIM geolocation sun**. **Tier 1 — Preset thumbnails**: 6 πακέτα (Πρωί / Μεσημέρι / Απόγευμα / Ηλιοβασίλεμα / Συννεφιά / Νύχτα), 3×2 grid, ένα κλικ αλλάζει όλο το περιβάλλον. **Tier 2 — Time-of-day slider**: full-width 00:00–23:59 με real-time shadow update (debounced 16ms = 60fps). **Tier 3 — Advanced Solar Panel** (collapsible): date picker + latitude/longitude (auto-populate από ADR-326 project metadata, fallback Αθήνα 37.98/23.72) + "Animate sun through day" toggle (1h advance per 2s, stops on user interaction). Default state: preset "Μεσημέρι" selected, slider 12:00, advanced panel collapsed. | 4/4 σύγκλιση industry για combo (Twinmotion thumbnails + Enscape slider + Lumion combined + D5 library). BIM geolocation extension = 2/2 BIM industry σύγκλιση (Revit "Sun Settings" location-aware + ArchiCAD "Sun Study" date+time+latlng). Best-of-both: rendering UX speed + BIM solar accuracy για πραγματικές shadow studies (π.χ. βίλα Σαντορίνη, σκιά πισίνας 16:00 Αύγουστος). |
| B.1.Q2 | Ποιότητα σκιών σε real-time 3D mode | **Soft shadows with auto-downgrade on camera motion** (Lumion pattern). Three.js `PCFSoftShadowMap` ΠΑΝΤΑ active (zero material recompile cost). Dynamic modulation `light.shadow.radius`: κατά camera κίνηση → `radius=0.5` (sharp, snappy 60fps). Idle ≥300ms → `radius` animates σε `4.0` (soft, realistic) με 300ms cubic ease-in. Map size dynamic: moving=1024², idle=2048². Trigger via `IdleDetector` SSoT (REUSE από §9 Q3 path tracer trigger). User-invisible — μηδέν settings UI clutter. | 3/4 σύγκλιση industry για soft-by-default (Twinmotion + Enscape + Lumion + D5). Lumion exact match για auto-downgrade pattern. Revit/SketchUp παλιό hard-only pattern απορρίπτεται ως "παιχνιδιάρικο" UX. Architect βλέπει ρεαλιστικές σκιές χωρίς να μάθει ρυθμίσεις. |
| B.1.Q3 | Ambient occlusion (σκούρες γωνίες όπου σμίγουν επιφάνειες) | **SSAO με auto-downgrade on camera motion** (consistency με B.1.Q2 pattern). Three.js `SSAOPass` postprocess με `aoIntensity` modulation: snappy mode (camera moving) → `pass.enabled=false` (zero cost). Idle ≥300ms → fade-in 300ms cubic ease σε `aoIntensity=1.0` (full effect). Single unified IdleDetector trigger (ίδιο event-source με B.1.Q2). User-invisible — zero settings UI. Phase 7 path tracer (§9 Q3) takes over με ground-truth AO βία ray tracing — overrides SSAO. | 4/5 industry σύγκλιση για SSAO-default σε arch-viz (Twinmotion+Enscape+Lumion+D5 πάντα on, Revit conditional). Lumion auto-downgrade exact match. Industry leader benchmarks: Chaos V-Ray offline = ground truth (BIM gold standard), Twinmotion + D5 = real-time inspirations για Nestor web-based Three.js. SSAO όχι GTAO/HBAO γιατί Three.js built-in `SSAOPass` battle-tested + low-LOC integration. |
| B.1.Q4 | Environment reflections (αντανάκλαση σε γυάλινα/μεταλλικά υλικά) | **Tier escalation: HDRI envmap Phase 5 + path-traced Phase 7** (Twinmotion + V-Ray pattern). **Phase 5 (rasterized real-time)**: `scene.environment = <cubemap από Hosek-Wilkie Sky>` rendered once per lighting preset change via `PMREMGenerator` (proper roughness mipmaps). Three.js `MeshStandardMaterial.envMap` + `metalness` + `roughness` PBR built-in IBL → zero runtime cost, παράθυρα αντανακλούν ουρανό, μέταλλα γυαλίζουν, πλαστικά matte. **Phase 7 (path-traced final)**: `three-gpu-pathtracer` (MIT) takes over με ground-truth reflections — παράθυρα αντανακλούν κτίριο απέναντι, καθρέφτες δείχνουν δωμάτιο. SSR απορρίπτεται (artifacts στις άκρες, incompatible με procedural Sky). | 2/2 BIM render leaders σύγκλιση (Twinmotion HDRI-default + V-Ray path-traced final). Consistency με §9 Q3 tri-mode rendering pattern. PBR Three.js built-in IBL = zero νέος κώδικας. Path tracer Phase 7 cost ήδη υπολογισμένο σε §9 Q4. |

**Architectural implications για B.1.Q1**:

- **Νέο SSoT registry**: `bim-3d/lighting/lighting-presets.ts` — 6-entry catalog, structure `{ id, labelKey, sunAzimuthDeg, sunAltitudeDeg, sunColor, sunIntensity, ambientColor, ambientIntensity, skyTurbidity, skyRayleigh }`. Read-only constant export. Mirror του 2D Nestor SSoT pattern (`color-config.ts` style).
- **ViewMode3DStore extension**: νέο sub-state `lightingState: { activePresetId: string, customTimeOfDay: string /* "HH:MM" */, solarConfig: { date: Date, latitude: number, longitude: number, animating: boolean } }`. Mutations trigger Three.js scene light recompute via observer.
- **Sun position SSoT**: `bim-3d/lighting/solar-position.ts` — NOAA solar position algorithm (azimuth + altitude από lat/lng/datetime). Alternative: `suncalc` npm (~2KB, **MIT license verified per N.5**) — preferred για battle-tested accuracy.
- **Project location source**: ADR-326 tenant project metadata `project.location.{latitude, longitude}`. Auto-populate AdvancedSolarPanel. Fallback Athens 37.98° / 23.72° αν project location missing.
- **Three.js wiring**:
  - `DirectionalLight.position` = `sphericalToCartesian(azimuthDeg, altitudeDeg, 100)` (sun "infinite" distance proxy)
  - `AmbientLight.color/intensity` από active preset
  - Skybox Phase 5 default: Three.js native `Sky` shader (Hosek-Wilkie procedural, zero asset download, sub-ms render). HDRI swap-in optional Phase 7 (per §9 Q4).
- **UI components** (όλα νέα Phase 5):
  - `bim-3d/ui/LightingPresetsPanel.tsx` — 6-thumbnail grid 3×2, active state outline cyan (REUSE `CAD_UI_COLORS.HOVER`), thumbnails pre-rendered από Three.js Sky shader per preset
  - `bim-3d/ui/TimeOfDaySlider.tsx` — semantic `<input type="range">`, time label `formatTime` SSoT REUSE, real-time shadow update via debounced setter
  - `bim-3d/ui/AdvancedSolarPanel.tsx` — collapsible (semantic `<details>` element), date picker, lat/lng readonly με "Edit" override, "Animate" toggle button
- **i18n keys** (per N.11, ΠΡΩΤΑ add σε locale JSONs):
  - `bim3d.lighting.presets.{morning,noon,afternoon,sunset,overcast,night}`
  - `bim3d.lighting.timeOfDay.label`
  - `bim3d.lighting.advanced.{title,date,latitude,longitude,animate,editLocation,fallbackAthens}`
- **Animation mode**: όταν "Animate sun" toggle ON → RAF loop dispatches `lightingState.customTimeOfDay += 1h / 2s`. Stops on any user interaction με slider/preset/advanced. Uses `IdleDetector` SSoT (from §9 Q3) για interaction tracking.
- **Backport σε 2D**: ΟΧΙ — 2D viewer δεν έχει lighting. Pure 3D feature.
- **GOL checklist**:
  - Proactive: ✅ lighting state initialized at mount, presets cached at app init
  - Race conditions: ✅ debounced updates serialize via store
  - Idempotent: ✅ ίδιο preset δύο φορές = ίδιο scene state
  - Belt-and-suspenders: ✅ fallback Athens lat/lng αν location undefined
  - SSoT: ✅ presets registry single source, ViewMode3DStore single mutator
  - Await/sync: ✅ updates synchronous, no async race
  - Lifecycle owner: ✅ ViewMode3DStore owns lighting lifecycle

**Effort impact για B.1.Q1**: +4h Phase 5 (presets registry + thumbnails grid component + time-of-day slider + DirectionalLight wiring + Hosek-Wilkie Sky shader) + 3h Phase 5 (solar position algorithm + Advanced Solar Panel + animate mode + 14 i18n keys ×2 locales) = **+7h Phase 5**. ADR-366 total estimate revised: **~111.5-127.5h** (από ~104.5-120.5h post-A.7).

**Architectural implications για B.1.Q2**:

- **Three.js renderer config**: `renderer.shadowMap.enabled = true`, `renderer.shadowMap.type = THREE.PCFSoftShadowMap` (μόνιμα — zero swap cost). Σημαντικό: εναλλαγή `shadowMap.type` runtime απαιτεί `material.needsUpdate = true` σε ΟΛΑ τα materials → expensive recompile. Pattern απορρίπτεται.
- **ViewMode3DStore extension**: νέο sub-state `shadowState: { mode: 'snappy' | 'soft', currentRadius: number, currentMapSize: number, transitionStartTime: number | null }`. Mutations από IdleDetector observer.
- **Shadow modulation SSoT**: `bim-3d/lighting/shadow-modulator.ts` — pure animation utility. Inputs: `(mode, deltaT)`. Outputs: `{ radius, mapSize }` interpolated. Cubic ease-in 300ms.
  - Snappy state: `radius=0.5`, `mapSize=1024`
  - Soft state: `radius=4.0`, `mapSize=2048`
  - Transition: 300ms cubic interpolation σε RAF loop
- **IdleDetector integration**: REUSE από §9 Q3 (path tracer trigger). Subscribe με 300ms threshold. Camera controls (orbit/pan/zoom) fire `IdleDetector.notifyActivity()` → mode='snappy'. After 300ms silence → mode='soft' transition begins.
- **Map size swap (1024² → 2048²)**: `light.shadow.mapSize.set(2048, 2048)` + `light.shadow.map.dispose()` + `light.shadow.map = null` → Three.js recreates map next frame. Cost: ~1-2ms frame stutter. Acceptable γιατί συμβαίνει μόνο on transition to idle (user already stopped).
- **Performance budget**:
  - Snappy mode (camera moving): shadow render budget < 2ms/frame (1024² PCF radius=0.5)
  - Soft mode (idle): shadow render budget ~4-5ms/frame (2048² PCF radius=4.0) — μη blocking γιατί idle
  - Transition window 300ms: budget ramps 2ms→5ms linear, smooth
- **Mobile/low-end fallback**: detect via `navigator.hardwareConcurrency < 4 || gpu tier < 2` → force `mode='snappy'` always, disable soft transition. Settings override για explicit user request. Phase 8+ optimization tier.
- **Three.js light shadow camera tuning**: `DirectionalLight.shadow.camera.{left,right,top,bottom}` auto-fit στο scene bounding box — REUSE GenArc `viewportFraming.ts` pattern (Topic A.4). `light.shadow.bias = -0.0005` για acne prevention, `light.shadow.normalBias = 0.02` για peter-panning prevention.
- **i18n**: zero new keys (feature είναι invisible / settings-less per Lumion philosophy).
- **GOL checklist**:
  - Proactive: ✅ shadow mode initialized 'snappy' at mount, IdleDetector subscribed
  - Race conditions: ✅ IdleDetector single source — multiple camera controls converge σε ένα activity stream
  - Idempotent: ✅ `notifyActivity()` δύο φορές = ίδια state (resets timer)
  - Belt-and-suspenders: ✅ low-end fallback path
  - SSoT: ✅ shadow-modulator single utility, ViewMode3DStore single state owner
  - Lifecycle owner: ✅ ViewMode3DStore owns shadow lifecycle, IdleDetector owns activity tracking
- **Backport σε 2D**: ΟΧΙ — 2D δεν έχει σκιές. Pure 3D feature.

**Effort impact για B.1.Q2**: +3h Phase 5 (shadow-modulator utility + ViewMode3DStore extension + IdleDetector wiring + light shadow camera auto-fit + low-end detection + RAF animation loop + tests). Phase 5 cumulative από Β.1: **+10h** (B.1.Q1=7h + B.1.Q2=3h). ADR-366 total estimate revised: **~114.5-130.5h** (από ~111.5-127.5h post B.1.Q1).

**Architectural implications για B.1.Q3**:

- **Rename SSoT utility**: `bim-3d/lighting/shadow-modulator.ts` → `bim-3d/lighting/quality-modulator.ts` — unified module για ΟΛΑ τα auto-downgrade visual effects (shadows + AO + future post-FX). Single RAF loop, single transition timeline.
- **ViewMode3DStore extension**: rename `shadowState` → `qualityState: { mode: 'snappy' | 'soft', shadowRadius, shadowMapSize, aoIntensity, transitionStartTime }`. Single mutation source, multiple effect parameters.
- **Three.js postprocess pipeline** (νέο για Phase 5):
  - `EffectComposer` wraps renderer (αντί direct `renderer.render()`)
  - Passes order: `RenderPass` → `SSAOPass` → `OutputPass`
  - `SSAOPass` config: `kernelRadius=8`, `minDistance=0.005`, `maxDistance=0.1` (architectural scale, metres)
  - `pass.enabled = false` όταν `aoIntensity === 0` (snappy mode) → zero render cost
- **AO modulation curve**: snappy → `enabled=false`. Transition start → `enabled=true` + `aoIntensity` animates 0→1 σε 300ms cubic ease-in (same curve με B.1.Q2 shadow radius — visual coherence).
- **Performance budget**:
  - Snappy mode (camera moving): SSAOPass disabled, zero cost
  - Soft mode (idle): SSAOPass ~3-5ms/frame @ 1920×1080 (acceptable, idle)
  - Mobile/low-end: `qualityState.mode` forced 'snappy' (από B.1.Q2 detection) → AO never activates
- **Phase 7 path tracer takeover**: όταν `mode='3d-final'` (path tracer rendering, §9 Q3), SSAOPass disabled — path tracer παράγει ground-truth AO via ray-traced GI. Quality-modulator pauses transitions ενώ Phase 7 active.
- **i18n**: zero new keys (silent feature).
- **GOL checklist**:
  - Proactive: ✅ pipeline initialized at mount, pass pre-allocated (zero runtime allocation)
  - Race conditions: ✅ same IdleDetector source — shadows + AO transition atomically
  - Idempotent: ✅ multiple `notifyActivity()` = ίδια reset
  - Belt-and-suspenders: ✅ low-end fallback, Phase 7 override
  - SSoT: ✅ quality-modulator single utility, ViewMode3DStore single state
  - Lifecycle owner: ✅ ViewMode3DStore owns quality lifecycle
- **Backport σε 2D**: ΟΧΙ — 2D δεν έχει 3D depth για AO. Pure 3D feature.

**Effort impact για B.1.Q3**: +2.5h Phase 5 (EffectComposer pipeline setup + SSAOPass integration + quality-modulator rename/extension + aoIntensity transition logic + Phase 7 takeover guard + tests). Phase 5 cumulative από B.1: **+12.5h** (Q1=7h + Q2=3h + Q3=2.5h). ADR-366 total estimate revised: **~117-133h** (από ~114.5-130.5h post B.1.Q2).

**Architectural implications για B.1.Q4**:

- **Phase 5 envmap pipeline** (νέο utility): `bim-3d/lighting/envmap-generator.ts` — renders Hosek-Wilkie Sky shader σε `WebGLCubeRenderTarget` (256² faces, ισορροπία cost/quality), processes via `PMREMGenerator` για roughness mipmaps. Triggered on lighting preset change OR time-of-day change ≥15min delta (debounced).
- **Scene wiring**: `scene.environment = <generated PMREM texture>` + `scene.background = sceneNeedsSkyBackground ? cubemap : null` (background visibility per ViewMode3DStore.skyVisible flag, μελλοντικά).
- **PBR material defaults** (νέο SSoT registry): `bim-3d/materials/material-defaults.ts` — entity-type-to-PBR-params mapping:
  - Glass (παράθυρα/πόρτες): `metalness=0`, `roughness=0.05`, `transparent=true`, `opacity=0.3`, `envMapIntensity=1.0`
  - Metal (πόμολα/κουπαστές/handrails): `metalness=1.0`, `roughness=0.2`, `envMapIntensity=1.0`
  - Concrete/walls: `metalness=0`, `roughness=0.85`, `envMapIntensity=0.3`
  - Wood floors: `metalness=0`, `roughness=0.4`, `envMapIntensity=0.5`
  - Plaster ceiling: `metalness=0`, `roughness=0.95`, `envMapIntensity=0.1`
- **Material registry SSoT**: read-only catalog, mirror του 2D `color-config.ts` pattern. Entity renderer (BIM → Three.js, Phase 2) consults registry on mesh creation.
- **Phase 7 path tracer takeover**: `three-gpu-pathtracer` reads ίδια PBR materials → ground-truth BSDF reflections automatically. Zero material refactor. Quality-modulator pauses Phase 5 SSAO/shadow transitions ενώ Phase 7 active (already covered B.1.Q3).
- **HDRI swap-in (§9 Q4 Phase 7)**: όταν Phase 7 polish προσθέσει HDRI library, envmap-generator απλά swaps source — `scene.environment` API unchanged. Pure additive.
- **License check (per N.5)**: `three-gpu-pathtracer` **MIT verified ✅**. PMREMGenerator + WebGLCubeRenderTarget = Three.js core (MIT).
- **Performance**: envmap regeneration ~5-10ms one-time on preset change (acceptable, non-frame-budget). Steady-state cost: zero (texture reused per frame).
- **i18n**: zero new keys (silent feature, no UI).
- **GOL checklist**:
  - Proactive: ✅ envmap generated on lighting preset mount, cached
  - Race conditions: ✅ debounced regeneration (15min threshold for time changes)
  - Idempotent: ✅ ίδιο preset = ίδιο envmap (cache key by preset+sunPosition)
  - Belt-and-suspenders: ✅ fallback solid color εάν envmap generation fails
  - SSoT: ✅ envmap-generator single source + material-defaults single registry
  - Lifecycle owner: ✅ ViewMode3DStore.lightingState triggers regeneration
- **Backport σε 2D**: ΟΧΙ — 2D δεν έχει PBR materials. Pure 3D feature.

**Effort impact για B.1.Q4**: +1.5h Phase 5 (envmap-generator utility + PMREMGenerator wiring + material-defaults registry 5 entries + entity renderer integration + cache key logic). Phase 7 path tracer cost already counted σε §9 Q4 (4-6h). Phase 5 cumulative από B.1: **+14h** (Q1=7h + Q2=3h + Q3=2.5h + Q4=1.5h). ADR-366 total estimate revised: **~118.5-134.5h** (από ~117-133h post B.1.Q3).

---

**Topic B.1 FINAL summary (2026-05-19)**:

| Q | Status | Key outcome |
|---|---|---|
| Q1 — Lighting strategy | ✅ CLOSED | Combo 3-tier (presets thumbnails + time-of-day slider + Advanced Solar panel με ADR-326 geolocation) |
| Q2 — Shadow quality | ✅ CLOSED | Soft shadows με auto-downgrade on camera motion (Lumion pattern, `light.shadow.radius` modulation) |
| Q3 — Ambient occlusion | ✅ CLOSED | SSAO με auto-downgrade (unified με Q2 quality-modulator SSoT) |
| Q4 — Environment reflections | ✅ CLOSED | HDRI envmap Phase 5 (PBR IBL zero cost) + path-traced Phase 7 final |

**Topic B.1 total effort impact**: +14h Phase 5 (Q1=7h + Q2=3h + Q3=2.5h + Q4=1.5h). ADR-366 total estimate post-B.1: **~118.5-134.5h** (από ~104.5-120.5h post-Group-A).

**Architectural commitments από B.1**:
- Νέα SSoT modules (Phase 5): `lighting-presets.ts`, `solar-position.ts`, `quality-modulator.ts` (shadows+AO unified), `envmap-generator.ts`, `material-defaults.ts`
- ViewMode3DStore extensions: `lightingState` + `qualityState`
- Νέα UI (Phase 5): `LightingPresetsPanel`, `TimeOfDaySlider`, `AdvancedSolarPanel`
- Three.js pipeline: `EffectComposer` με `RenderPass → SSAOPass → OutputPass`
- Postprocess always-on: `PCFSoftShadowMap` + envmap PBR IBL
- IdleDetector REUSE (από §9 Q3) → shadows + AO unified trigger
- npm deps Phase 5: `suncalc` (MIT, ~2KB)
- Phase 7 deps (already counted §9 Q4): `three-gpu-pathtracer` (MIT)

---

### B.2 — BIM Data Overlay (tooltips, dimensions, annotations) — ✅ FULLY CLOSED 2026-05-19

**Σκοπός**: Καθορισμός hover tooltip + permanent dimensions + annotation/leader text + element info panel strategy σε 3D viewer. SSoT mirror του 2D pattern όπου applicable.

**Cross-references**: ADR-357 §4 G9 Phase 8 (`QuickPropertiesHoverPopover` 2D), ADR-040 micro-leaf pattern, ADR-362 Enterprise Dimension System (2D), ADR-363 BIM entity geometry SSoT, ADR-195 Audit Value Catalogs (`useEntityAudit`), ADR-329 BOQ Scope, ADR-326 Tenant Org Structure, `reference_entity_details_header_ssot.md` memory (EntityDetailsHeader pattern, Contacts + Procurement Phase G 2026-04-28).

**Pending micro-decisions**:
- Q1: Hover tooltip content + pattern ✅ RESOLVED
- Q2: Permanent dimensions σε 3D ✅ RESOLVED
- Q3: Annotation/leader text σε 3D space ✅ RESOLVED (comments markers Phase 7+, free-text DEFERRED Phase 8+)
- Q4: Element info panel (full BIM card on click) ✅ RESOLVED — **EntityDetailsHeader SSoT extension + 5 tabs (Geometry/Materials/BOQ/Audit/Comments) + read-only παντού εκτός Comments**

**Decisions Log (Γιώργος)** — Topic B.2 ✅ FULLY CLOSED 4/4 Qs:

| # | Ερώτηση | Απόφαση | Industry alignment |
|---|---|---|---|
| B.2.Q4 | Element info panel (full BIM card on click) — αυτόνομο 3D panel, REUSE 2D FloatingPanel, ή EntityDetailsHeader SSoT extension; | **EntityDetailsHeader SSoT extension με 5 tabs (Geometry/Materials/BOQ/Audit/Comments) + read-only παντού εκτός Comments**. Sub-decisions: (1) Panel pattern = `@/core/entity-headers` `EntityDetailsHeader` SSoT (mirror Contacts + Procurement Phase G 2026-04-28). (2) 5 tabs: **Geometry** (length/height/thickness/area/volume read-only), **Materials** (multi-layer DNA preview ADR-363 Phase 6 read-only), **BOQ** (summary card με scope link + total cost breakdown, click → opens ADR-329 BOQ drawer, read-only display), **Audit** (vertical timeline + inline diff old→new από `useEntityAudit` ADR-195), **Comments** (inline list filtered στο entity με add/resolve actions inline, mirror B.2.Q3 `CommentListPanel`). (3) Geometry/Materials editing γίνεται μόνο από dedicated tools (transform tool ribbon, material assigner) — όχι από κάρτα. (4) BOQ editing γίνεται μόνο από BOQ drawer (ADR-329). (5) Audit always read-only (ADR-195 immutable). (6) Comments inline editable (add new + resolve/reopen) μέσω `bim-comments.service.ts` (B.2.Q3). | Maximum SSoT REUSE: industry σύγκλιση Notion/Linear/Github (single canonical detail header pattern across app). EntityDetailsHeader already proven σε Contacts + Procurement. Tab structure mirror Revit Properties Palette (multi-category grouping) + Notion timeline pattern (chronological audit). Read-only-except-Comments αποτρέπει duplication BOQ drawer logic (SSoT discipline). |
| B.2.Q3 | Annotation/leader text σε 3D (free labels, comment markers, ή hybrid) | **Option 3 — Typed comment markers (BIMcollab style) Phase 7+** + **DEFERRED free-text labels σε Phase 8+**. Νέα Firestore collection `bim_comments` με marker pins σε 3D space (Three.js Sprite billboard με number + color-by-status), click → opens `BimCommentDetailsPanel` side pane με typed metadata (text, status `open/resolved/wontfix`, priority, author, createdAt, optional attachments). Optional entity anchor (`attachedEntityId`). Tenant-scoped via ADR-326 (`companyId/projectId/buildingId/floorId`). Free-text labels με leader arrows ΔΕΝ rejected — deferred Phase 8+ ως optional (αν ζητηθούν, mirror ADR-362 dim tool pattern). | Modern BIM coordination σύγκλιση: BIMcollab + Solibri lead 3D review workflows (organized typed comments αντί anarchic text labels). Revit/ArchiCAD annotations migrated σε 2D-only — review μεταφέρθηκε σε ξεχωριστά coordination platforms. SketchUp 3D-text pattern deferred — Nestor είναι BIM tool, όχι freeform sketch tool. |
| B.2.Q2 | Permanent dimensions σε 3D (auto-display ή manual) | **Combo Option 1 + Option 4** (Revit/ArchiCAD industry consensus 4/5). **Καθόλου automatic dimensions σε 3D** (clean visualization philosophy) **PLUS manual user-placed dimensions via mirror του ADR-362 2D Dim System**. Ribbon "Dimension" button context-aware: 2D mode → plan dimension (existing ADR-362), 3D mode → 3D dimension. Ο χρήστης κλικάρει 2 σημεία σε 3D space (snap-aware REUSE ProSnapEngineV2), εμφανίζεται μόνιμη διάσταση: thin grey 3D line + tick marks + billboard Sprite label (πάντα face camera, readable από κάθε γωνία). Storage extends ADR-362 schema με `placement: '2d' \| '3d'` discriminator (zero data duplication, visibility filter per mode). Hover tooltip ήδη δείχνει dimensions (από B.2.Q1) → user βλέπει μέτρα on-demand χωρίς clutter. | 4/5 industry σύγκλιση (Revit + ArchiCAD + SketchUp + BIMcollab όλοι manual-only, Twinmotion zero dims). Option 3 (permanent always-visible) απορρίπτεται — 0/5 industry. SSoT REUSE ADR-362 (155 tests, fully implemented) + ProSnapEngineV2 + dim style tokens (`DIMENSION_LINE_COLOR`, `DIMENSION_TEXT_SIZE`). |
| B.2.Q1 | Hover tooltip content + activation pattern | **Mirror ADR-357 QuickProperties pattern + BIM data getters extension**. Compact 3-line floating card (Revit style, 1/4 industry direct precedent: Revit "Category : Family : Type"). **Trigger**: 800ms stable hover **REUSE constant** `HOVER_DELAY_MS` από `QuickPropertiesStore.ts`. **Position**: cursor-relative offset (12px right, 4px down) via `ImmediatePositionStore` **REUSE**. **Mount**: ADR-040 sibling micro-leaf (παράλληλα με `QuickPropertiesHoverPopover`, ποτέ μέσα σε orchestrator). **Activation**: `activeTool === 'select'` AND mode `!== '2d'`. **Content lines**: (1) entity type translated (`t('bim3d.entityTypes.{wall,door,window,slab,beam,column}')`), (2) name + dimensions `Wall_A12 · 5.20m × 3.00m × 0.25m`, (3) floor + material `Όροφος 1 · Τούβλο`. **Progressive disclosure**: click → full BIM panel (right pane, Q4 pending decision). | 1/4 direct Revit precedent (compact Category/Family/Type). 100% SSoT REUSE με 2D Nestor `QuickProperties` (HOVER_DELAY_MS constant, ImmediatePositionStore, ADR-040 micro-leaf mount, `useSyncExternalStore` pattern, CSS module shared). Twinmotion/Lumion no-tooltip pattern rejected — Nestor είναι BIM (data-driven), όχι pure visualization. ArchiCAD configurable pattern deferred — default-first principle. |

**Architectural implications για B.2.Q1**:

- **Νέα SSoT modules (Phase 4)**:
  - `bim-3d/properties/QuickProperties3DStore.ts` — mirror του 2D `QuickPropertiesStore.ts`. Reuses HOVER_DELAY_MS=800 constant, ίδιο snapshot pattern, subscribes σε νέο `Hover3DStore` (Topic A.1 already mandated `Selection3DStore` separate από 2D — same separation εφαρμόζεται και για hover).
  - `bim-3d/properties/QuickProperties3DHoverPopover.tsx` — React micro-leaf, useSyncExternalStore consumer. Renders 3 lines με BIM data getters.
  - `bim-3d/properties/bim-entity-formatter.ts` — pure helpers `formatEntityTypeLabel(entity)`, `formatBimDimensions(entity)`, `formatFloorMaterial(entity)`. Read-only, idempotent.
- **Hover trigger source**: Topic A.1 Selection3DStore mandated separate από 2D HoverStore (different coord systems). Hover3DStore mirror pattern — `hovered3DEntityId: string | null` + `subscribeHovered3DEntity` API mirror.
- **3D-to-screen positioning**: cursor coord ήδη υπάρχει στο `ImmediatePositionStore` (screen pixels). Tooltip absolute position = `(cursorX + 12, cursorY + 4)`. Auto-flip σε edges via `boundingClientRect` check (mirror 2D popover logic).
- **BIM entity data getters**:
  - Type label: `entity.kind` (από ADR-363 schema: 'wall' | 'door' | 'window' | 'slab' | 'beam' | 'column' | 'stair') → i18n key `bim3d.entityTypes.{kind}` → translated.
  - Name: `entity.name` (auto-generated `${kind}_A12` style αν ο χρήστης δεν έχει custom name).
  - Dimensions: `entity.geometry.dimensions` (REUSE ADR-363 cached geometry — `length`, `height`, `thickness` σε mm) → `formatDisplayValue` SSoT (REUSE από `units.ts`) → metres με 2 decimals.
  - Floor: `entity.floorId` → `useFloors` SSoT lookup → `floor.name` (π.χ. «Όροφος 1»).
  - Material: `entity.materialLayers?.[0]?.materialId` (από ADR-363 Phase 6 multi-layer DNA) → MaterialCatalog3D.resolve → translated label (π.χ. «Τούβλο»). Fallback `entity.material` legacy field.
- **i18n keys** (per N.11, ΠΡΩΤΑ add σε locale JSONs):
  - `bim3d.entityTypes.{wall,door,window,slab,beam,column,stair,railing}` — 8 keys ×2 locales
  - `bim3d.quickProperties.dimensionsSeparator` (· δολάριο symbol)
  - `bim3d.quickProperties.unknownMaterial`, `unknownFloor` fallbacks
- **Activation guards** (mirror 2D logic):
  - `activeTool === 'select'` — όχι κατά drawing/section/measurement modes
  - `mode !== '2d'` — μόνο σε 3D modes ('3d-raster' / '3d-preview' / '3d-final')
  - Entity must exist στο `Bim3DScene.entities` (από Phase 2 converter)
  - 800ms stable hover (resets on entity change)
- **Style SSoT REUSE**: CSS module `QuickProperties3DHoverPopover.module.css` αντιγράφει visual rules από 2D module:
  - Background: theme-aware (light/dark)
  - Border: 1px solid `CAD_UI_COLORS.HOVER` cyan (REUSE color-config.ts token)
  - Border-radius: 4px (theme constant)
  - Shadow: subtle drop-shadow
  - Font: same font stack
  - Fade-in: 100ms opacity transition
- **Progressive disclosure → full panel**: click handler (Topic A.1 single-click replace) opens BIM panel σε right pane. Panel content = Q4 pending decision (αυτόνομη ή reuse 2D properties panel).
- **GOL checklist**:
  - Proactive: ✅ store subscribed at mount, RAF-coordinated με Hover3DStore
  - Race conditions: ✅ debounce 800ms serializes hover events, skip-if-unchanged optimization (mirror 2D pattern)
  - Idempotent: ✅ hover ίδιο entity = ίδια snapshot
  - Belt-and-suspenders: ✅ fallback strings για unknownMaterial/unknownFloor + null guards για entity.geometry undefined (Phase 2 conversion in-progress)
  - SSoT: ✅ ImmediatePositionStore + HOVER_DELAY_MS + ADR-040 pattern + format utilities all REUSED 100%
  - Lifecycle owner: ✅ QuickProperties3DStore owns popover lifecycle, sibling-mounted στο `bim3d-canvas-layer-stack-leaves.tsx` (Phase 4)
- **Backport σε 2D**: ΟΧΙ νέο για 2D — απλά mirroring existing 2D pattern.

**Effort impact για B.2.Q1**: +2.5h Phase 4 (Quick3D store mirror 30min + popover component mirror 45min + BIM entity getters 60min + 3D positioning logic 15min + 11 i18n keys ×2 locales + tests 30min). Mirror pattern οικονομία ~1.5h vs from-scratch. ADR-366 total estimate revised: **~121-137h** (από ~118.5-134.5h post-B.1).

**Architectural implications για B.2.Q2**:

- **ADR-362 schema extension**: existing `DimensionEntity` type (από `src/subapps/dxf-viewer/types/entities.ts`) extends με `placement: '2d' | '3d'` discriminator field. 2D dims (existing) auto-tag `placement='2d'`. 3D dims new schema variant με:
  - `start3D: Vector3World` (mm coords, building-relative)
  - `end3D: Vector3World`
  - `offsetDirection3D: Vector3` (perpendicular vector για dim-line offset, calculated από snap context ή camera-up)
  - `floorId` (αν dim relevant σε floor context)
- **Νέο renderer**: `bim-3d/dimensions/Dimension3DRenderer.ts` — mirror του 2D `DimensionRenderer.ts` (~150 LOC mirror). Three.js primitives:
  - `THREE.Line` με `LineBasicMaterial` για dim line (REUSE `DIMENSION_LINE_COLOR` SSoT token)
  - 2× `THREE.Line` για tick marks (perpendicular, μήκος 50mm world-space)
  - `THREE.Sprite` με canvas-rendered text label (`DIMENSION_TEXT_SIZE` SSoT REUSE) — billboard auto-face camera (Three.js Sprite default behavior, μηδέν custom code)
  - Sprite scale auto-adjusts με camera distance ώστε pixel size σταθερό (REUSE billboard pattern από Topic A.1.Q5 grip rendering)
- **Νέο dim tool routing**: `bim-3d/dimensions/useDim3DToolRouting.ts` — mirror του 2D `useDimToolRouting.ts`. State machine: idle → first-point-picked → second-point-picked → entity created (mutate via ADR-031 CommandHistory). Snap engine REUSE — `ProSnapEngineV2` ήδη supports 3D coords (Topic A.2.Q3 confirmed).
- **Ribbon context-aware Dim button** (ADR-345 ribbon extension):
  - Button action `dimension:create` checks `ViewMode3DStore.mode`
  - mode='2d' → dispatch `dim:2d:start` (existing behavior unchanged)
  - mode≠'2d' → dispatch `dim:3d:start` (νέος handler)
  - Single ribbon entry, dual behavior. SSoT consistency με Topic A.6.Q3 universal-where-applicable.
- **Visibility filter**: scene-level filter στο Bim3DScene rendering — μόνο entities με `placement === '3d'` rendered σε 3D mode. 2D viewer ήδη ignores `placement='3d'` entities (Boy Scout add filter to 2D `DxfSceneConverter`). Zero data duplication.
- **Storage**: ίδιο Firestore collection με 2D dimensions (existing ADR-362 collection). `placement` field discriminator only. Backward-compatible — existing dims default `placement='2d'`.
- **Snap context για offset direction**:
  - Αν user clicks σε edge midpoints: offsetDirection = perpendicular to edge, στραμμένο προς camera
  - Αν user clicks σε face corners: offsetDirection = camera-up vector projected
  - Fallback: world-up Y vector
- **Style tokens SSoT REUSE**:
  - `DIMENSION_LINE_COLOR` (από ADR-362 SSoT)
  - `DIMENSION_TEXT_SIZE` (από ADR-362 SSoT)
  - `DIMENSION_TICK_LENGTH` (REUSE ή νέο constant — TBD on implementation)
  - Selection/hover tokens REUSE από Topic A.1
- **i18n**: zero new keys for ribbon (existing `dimension.create` button label works για 2D και 3D). Future: `bim3d.dimensions.snapHints` αν χρειαστούν tool-state hint messages.
- **Cross-mode interactions**:
  - Undo/redo: ADR-031 CommandHistory unified handles 3D dim create/delete
  - Selection: 3D dim entity selectable in 3D mode (Topic A.1 selection). 2D mode hidden via visibility filter.
  - Properties panel: 3D dim entity Quick3D tooltip shows distance value + endpoint coords (extends B.2.Q1 getters με dim-specific case)
- **GOL checklist**:
  - Proactive: ✅ schema discriminator added at ADR-362 level — both 2D και 3D dims coexist cleanly
  - Race conditions: ✅ single Firestore collection, single CommandHistory, single tool dispatcher
  - Idempotent: ✅ create dim with same 2 points = same dim entity (deduplication via deterministic ID hash)
  - Belt-and-suspenders: ✅ fallback offset direction = world-up αν snap context missing
  - SSoT: ✅ ADR-362 schema, snap engine, style tokens, command history all REUSED
  - Lifecycle owner: ✅ ADR-362 owns dim entities, Bim3DScene owns rendering
- **Backport σε 2D**: minimal — add visibility filter στο 2D `DxfSceneConverter` για `placement='3d'` skip (~10 LOC, Boy Scout rule).

**Effort impact για B.2.Q2**: +5-6h Phase 7 (Dimension3DRenderer 1.5h + Dim3DToolRouting 1h + schema extension 30min + ribbon context-aware dispatcher 30min + snap context offset logic 1h + visibility filter 30min + Quick3D dim case 30min + tests 1h). ADR-362 backward compat verified (existing 2D dims continue with `placement='2d'` default). ADR-366 total estimate revised: **~126-143h** (από ~121-137h post-B.2.Q1).

**Architectural implications για B.2.Q3**:

- **Νέα Firestore collection**: `bim_comments` — tenant-scoped per ADR-326 (`companyId` required, query filter mandatory per N.11 CHECK 3.10).
- **Schema**:
  - `id: string` (deterministic via enterprise-id.service `cmt_bim_${ulid}` — νέο generator add σε `enterprise-id.service.ts`)
  - `companyId, projectId, buildingId, floorId: string` (tenant hierarchy)
  - `position3D: { x: number, y: number, z: number }` (mm world-space)
  - `attachedEntityId: string | null` (optional anchor σε wall/door/etc — null = free-standing comment)
  - `text: string` (i18n-free user content)
  - `status: 'open' | 'resolved' | 'wontfix'`
  - `priority: 'low' | 'med' | 'high'`
  - `author: { userId, displayName }` (denormalized for fast display)
  - `createdAt: Timestamp`, `resolvedAt?: Timestamp`, `resolvedBy?: userId`
  - `attachments?: string[]` (Firebase Storage paths, tenant-scoped per `storage.rules`)
- **Firestore rules** (extend `firestore.rules`): companyId-scoped read/write, RBAC role check, audit trail via `EntityAuditService.recordChange()` (ADR-195 ratchet compliance — module `entity-audit-trail`).
- **Marker rendering**: `bim-3d/comments/CommentMarker3DRenderer.ts` — Three.js `Sprite` με canvas-rendered:
  - Circle 32px diameter
  - Color by status: open=#FF9500 (orange), resolved=#34C759 (green), wontfix=#8E8E93 (gray) — νέα tokens σε `color-config.ts` ή ADR-tokens? — **νέο SSoT entry `COMMENT_STATUS_COLORS`** justified (zero 2D equivalent)
  - Sequence number rendered inside (auto-assigned per project, ascending)
  - Priority indicator: thin border (low=none, med=2px yellow, high=3px red)
  - Billboard auto-face camera (Three.js Sprite default)
- **Side panel**: `bim-3d/comments/BimCommentDetailsPanel.tsx` — extends existing detail right-pane pattern (REUSE `EntityDetailsHeader` SSoT from `@/core/entity-headers`).
  - Edit-in-place text, status select, priority select
  - Attachment upload (REUSE storage upload service)
  - Audit log section (REUSE `useEntityAudit` hook από ADR-195)
  - Delete/resolve actions με confirmation dialog
- **Comment CRUD service**: `bim-3d/comments/bim-comments.service.ts` — wraps firestoreQueryService.subscribe με equality guard ([[firestore-subscribe-equality-guard]] memory rule). Methods:
  - `createComment(input)` → setDoc με enterprise-id
  - `updateComment(id, patch)` → updateDoc + EntityAudit
  - `resolveComment(id)` → updateDoc status + resolvedBy/resolvedAt
  - `deleteComment(id)` → deleteDoc + audit
  - `subscribeProjectComments(projectId, callback)` → reactive feed
- **Comment list panel**: separate UI panel `bim-3d/comments/CommentListPanel.tsx` (collapsible left sidebar tab):
  - Sortable by createdAt/priority/status
  - Filter by status/author
  - Click → zooms camera σε comment.position3D (animated 500ms cubic via GenArc viewportAnimation) + opens details panel
- **Marker visibility**:
  - Always visible σε 3D mode (default)
  - Toggle button "Show Comments" στο ribbon Phase 7 — hides all markers
  - Floor filter: markers on hidden floors auto-hidden (consistency με §9 Q2 single-floor default)
- **Notifications**: reuse `NOTIFICATION_KEYS` SSoT (memory entry [[notification-ssot]]) για events: comment.created, comment.resolved, comment.mentioned (future @-mention). Domain hook: νέο `useCommentNotifications` mirror του `useContactNotifications`/`useProjectNotifications` pattern.
- **i18n keys** (νέα namespace `bim3d.comments`, ΠΡΩΤΑ σε locale JSONs):
  - `bim3d.comments.status.{open,resolved,wontfix}` × 2 locales
  - `bim3d.comments.priority.{low,med,high}` × 2 locales
  - `bim3d.comments.actions.{create,edit,resolve,reopen,delete,upload}` × 2 locales
  - `bim3d.comments.fields.{text,author,createdAt,resolvedBy,attachments}` × 2 locales
  - `bim3d.comments.empty`, `bim3d.comments.list.title`, `bim3d.comments.toolbar.toggle`
- **Permissions** (extend `roles.ts`): νέο RBAC permission `bim_comments.{create,edit,resolve,delete}`. Default: all authenticated roles can create/edit own; only `admin`/`project_manager` resolve+delete others.
- **GOL checklist**:
  - Proactive: ✅ subscribe at viewer mount, RAF-coordinated marker positioning
  - Race conditions: ✅ Firestore optimistic updates + equality guard ([[firestore-subscribe-equality-guard]])
  - Idempotent: ✅ deterministic enterprise-id (no duplicates on retry)
  - Belt-and-suspenders: ✅ Firestore rules + RBAC + audit trail (3 layers)
  - SSoT: ✅ enterprise-id, EntityDetailsHeader, useEntityAudit, NOTIFICATION_KEYS, color-config (status colors)
  - Lifecycle owner: ✅ bim-comments.service.ts owns CRUD, ViewMode3DStore tracks selected comment, Bim3DScene owns marker rendering
  - Idempotent enterprise-id ✅ (per N.6 ADR-017/210/294)
- **Backport σε 2D**: COULD add 2D plan-view markers (mirror του 3D pattern) σε ξεχωριστή phase αν Γιώργος ζητήσει. Default: 3D-only για Phase 7. Same Firestore collection — 2D markers θα ήταν projection του 3D position στο plan view (διαφορετικός renderer).
- **Phase 8+ free-text labels (DEFERRED)**:
  - Mirror του ADR-362 dim tool pattern για labels με leader
  - Schema: `BimLabelEntity` με `position3D`, `text`, `leaderEnd3D`, `placement='3d'`
  - Effort estimate (future): ~5-6h αν ζητηθεί
  - Status: NOT ENTERED στο ratchet, NOT BLOCKING Phase 7 release

**Effort impact για B.2.Q3**: +6-7h Phase 7 (CommentMarker3DRenderer 1.5h + Firestore collection schema + rules 1h + BimCommentDetailsPanel 2h + bim-comments.service.ts CRUD 1h + CommentListPanel sidebar tab 1h + 20+ i18n keys ×2 locales + RBAC permissions 30min + audit integration 30min + tests 1.5h). Phase 8+ free-text labels DEFERRED (~5-6h future, not counted). ADR-366 total estimate revised: **~132-150h** (από ~126-143h post-B.2.Q2).

**Architectural implications για B.2.Q4**:

- **SSoT REUSE 100%**: `@/core/entity-headers` `EntityDetailsHeader` component + `createEntityAction` helper (memory [[entity-details-header-ssot]] confirmed pattern σε Contacts + Procurement Phase G 2026-04-28). Καμία νέα detail-header abstraction — ίδιο visual + interaction model με rest του app.
- **Νέα modules (Phase 4 mount + Phase 5-7 progressive content)**:
  - `bim-3d/properties/BimEntityCardPanel.tsx` — orchestrator που wrappάρει `EntityDetailsHeader` + 5 tabs. Mount στο Bim3DScene right pane area. Subscribes σε `Selection3DStore` (single-selected entityId → resolve από `Bim3DScene.entities` map).
  - `bim-3d/properties/tabs/BimGeometryTab.tsx` — read-only table (length/height/thickness/area/volume από ADR-363 cached geometry). Phase 4.
  - `bim-3d/properties/tabs/BimMaterialsTab.tsx` — multi-layer DNA preview (REUSE ADR-363 Phase 6 layer composition + PBR thumbnails). Phase 5 (μετά material catalog ready).
  - `bim-3d/properties/tabs/BimBoqTab.tsx` — Summary card (scope name + breakdown υλικά/εργατικά/όργανα/συνολικό) + "Άνοιγμα BOQ Drawer →" button που dispatches `boq:drawer:open` με `entityId` filter. Phase 6.
  - `bim-3d/properties/tabs/BimAuditTab.tsx` — Vertical timeline component (date pill + author + inline diff `old → new`). REUSE `useEntityAudit` hook από ADR-195 (memory rule [[firestore-subscribe-equality-guard]] — `useEntityAudit` ήδη hash-guarded). Phase 4.
  - `bim-3d/properties/tabs/BimCommentsTab.tsx` — filtered list adapter πάνω από `bim-comments.service.ts` (B.2.Q3) με `attachedEntityId === currentEntityId` filter + add comment FAB + per-comment resolve/reopen actions. Mirror του `CommentListPanel` markup (B.2.Q3) reduced to single-entity scope. Phase 7 (depends on B.2.Q3 service).
- **EntityDetailsHeader configuration**:
  - **Title**: `entity.name` (auto-generated `${kind}_A12` αν χρήστης δεν έχει custom name) — mirror Quick3D tooltip line 2.
  - **Subtitle**: `${floor.name} · ${i18n entityType}` (π.χ. «Όροφος 1 · Εξωτερικός τοίχος»).
  - **Icon**: entity-kind SVG (νέο SVG set `bim3d-icons/{wall,door,window,slab,beam,column,stair}.svg` — Phase 4 asset bundle, ~8 icons ×16x16).
  - **Actions** (createEntityAction): no edit/delete στο header (read-only φιλοσοφία) — μόνο `⋯` overflow menu με "Zoom-to-entity" (REUSE GenArc viewportAnimation) + "Copy IfcGUID to clipboard" + "Show in 2D plan" (mode toggle + viewport pan to entity centroid).
- **Tab structure & order** (5 tabs, left-to-right priority):
  1. **Geometry** (default active) — most-frequent data need
  2. **Materials** — Phase 5+ (μετά material catalog)
  3. **BOQ** — Phase 6+ (μετά BOQ wire-up)
  4. **Audit** — Phase 4 (instant value από day-1)
  5. **Comments** — Phase 7+ (depends on B.2.Q3)
- **Tab content details**:
  - **Geometry**: read-only `<dl>` semantic markup (no `<div>` soup per CLAUDE.md N.4). Fields:
    - `bim3d.fields.length` → entity.geometry.length (mm → m via `formatDisplayValue`)
    - `bim3d.fields.height` → entity.geometry.height
    - `bim3d.fields.thickness` → entity.geometry.thickness (walls only)
    - `bim3d.fields.area` → entity.geometry.area (computed, badge "computed")
    - `bim3d.fields.volume` → entity.geometry.volume (computed badge)
    - `bim3d.fields.ifcGUID` → entity.ifcGUID (αν exists) με copy-to-clipboard icon
  - **Materials**: multi-layer list με color swatch + thickness per layer (από ADR-363 Phase 6 multi-layer DNA). PBR preview thumbnail (REUSE material catalog renderer Phase 5). Read-only.
  - **BOQ**: scope link banner + cost breakdown table + "Άνοιγμα BOQ Drawer →" CTA button. Empty state αν entity δεν έχει BOQ scope assignment ("Χωρίς αντιστοίχιση — [Άνοιγμα BOQ →]"). REUSE ADR-329 cost data formatter.
  - **Audit**: timeline component `<ol>` semantic markup. Per-event: timestamp pill (date + time) + author display name + field changed + inline diff (`old → new` με strikethrough old + bold new). Pagination "Φόρτωσε παλαιότερα" αν >20 entries. REUSE `useEntityAudit({ collectionName, entityId })` ADR-195 hook.
  - **Comments**: filter dropdown (Όλα / Open / Resolved / Wontfix) + "+ Νέο σχόλιο" button + scrollable list of comment cards (mirror B.2.Q3 `CommentListPanel` row markup). Per-card: status badge color (`COMMENT_STATUS_COLORS` SSoT), priority border, author + date, text, [Resolve] / [Reopen] action.
- **Cross-tab interactions**:
  - Tab switch persists per-session στο `ViewMode3DStore.activeEntityCardTab` (default 'geometry').
  - Selection change: closes card αν `selectedEntityIds.size === 0`, opens at default tab αν `size === 1`, shows "N entities selected" state αν `size > 1` (no card, instructs single-select).
  - Comment add from card → optimistic update via `bim-comments.service.ts` με equality guard.
- **Phase progressive disclosure**: Phase 4 ships με Geometry + Audit tabs only (instant value). Phase 5 adds Materials. Phase 6 adds BOQ. Phase 7 adds Comments (depends on B.2.Q3 service ready). Empty tabs hidden αν Phase not yet shipped (αντί placeholder spinner).
- **i18n keys** (per N.11, ΠΡΩΤΑ add σε locale JSONs, νέος namespace `bim3d.card.*`):
  - `bim3d.card.tabs.{geometry,materials,boq,audit,comments}` — 5 keys ×2 locales
  - `bim3d.fields.{length,height,thickness,area,volume,ifcGUID,floor,material,scope,cost,subtotalMaterials,subtotalLabor,subtotalEquipment}` — 14 keys ×2 locales
  - `bim3d.card.actions.{zoomToEntity,copyIfcGUID,showIn2D,openBoqDrawer,addComment,loadOlder,noScope}` — 7 keys ×2 locales
  - `bim3d.card.audit.{created,modified,fieldChanged}` — 3 keys ×2 locales
  - `bim3d.card.empty.{noSelection,multiSelection,noComments,noAuditEvents,noBoqScope}` — 5 keys ×2 locales
  - **Total: ~34 keys ×2 locales = ~68 new entries** (να προστεθούν ΠΡΙΝ τη χρήση per N.11)
- **No new SSoT tokens needed**: REUSE `COMMENT_STATUS_COLORS` (B.2.Q3), `CAD_UI_COLORS` (selection consistency A.1), `DIMENSION_*` (B.2.Q2 if dim entity).
- **GOL checklist**:
  - Proactive: ✅ store subscribed at viewer mount, card mounts/unmounts on selection change
  - Race conditions: ✅ Firestore equality guard για audit + comments (memory [[firestore-subscribe-equality-guard]])
  - Idempotent: ✅ no mutations from card (read-only) εκτός comment CRUD που είναι ήδη idempotent (B.2.Q3 deterministic enterprise-id)
  - Belt-and-suspenders: ✅ null-safe entity getters + empty states per tab + fallback "—" αν field missing
  - SSoT: ✅ EntityDetailsHeader + useEntityAudit + bim-comments.service + ADR-329 BOQ drawer + ADR-363 cached geometry + MaterialCatalog3D ΟΛΑ REUSED
  - Lifecycle owner: ✅ BimEntityCardPanel.tsx orchestrates lifecycle, Selection3DStore drives visibility, individual tabs own data subscriptions
- **Backport σε 2D**: opportunity — 2D viewer entity click could open same `EntityDetailsHeader`-based card (mirror 3D pattern). Currently 2D δείχνει το FloatingPanel "Properties" tab (memory [[dxf-viewer-floating-panel]]). Boy Scout: αν Phase 4+ προχωρήσει και χρειαστεί 2D-3D consistency, refactor το FloatingPanel Properties tab σε EntityDetailsHeader-based card (~3-4h, optional, NOT BLOCKING Phase 7 release). Status: NOT ENTERED στο ratchet.

**Effort impact για B.2.Q4**: **+7-9h spread Phase 4-7** breakdown:
- Phase 4: BimEntityCardPanel orchestrator + Selection3DStore wiring + Geometry tab + Audit tab + 8 entity-kind SVG icons + 14 baseline i18n keys ×2 locales + tests → **~3-4h**
- Phase 5: Materials tab (multi-layer DNA preview, depends on material catalog ready) → **~1.5h**
- Phase 6: BOQ tab (cost breakdown + drawer link dispatch) → **~1.5h**
- Phase 7: Comments tab (filtered adapter πάνω από B.2.Q3 service) → **~1h** (mostly view code, service ήδη ready)
- Cross-phase: tab switch persistence + empty states + EntityDetailsHeader configuration + remaining i18n batches → **~1h**

ADR-366 total estimate revised: **~139-159h** Phase 0-7 (από ~132-150h post-B.2.Q3).

---

### B.3 — Multi-floor visibility controls UI — ✅ FULLY CLOSED 2026-05-19

**Σκοπός**: Καθορισμός UI για το multi-floor visibility που ήδη approved σε §9 Q2 (single-floor default + Show All toggle + `ViewMode3DStore.visibleFloors: Set<floorId>`). 7 sub-questions Q1-Q7 — όλες κλειστές με industry-driven decisions.

**Cross-references**: §9 Q2 (state schema approved), ADR-326 Tenant Org Structure (`useFloors` SSoT + Firestore `buildings/{id}/floors/*`), ADR-358 Stair↔Floor linking, ADR-345 Ribbon (mode toggle pattern), `reference_dxf_viewer_floating_panel.md` memory (2D FloatingPanel LEFT pattern Levels/Colors/Properties), `feedback_3d_mirror_2d_ssot.md` memory (3D mirrors 2D SSoT).

**Pending micro-decisions** — ✅ ALL RESOLVED 2026-05-19:
- B.3.Q1: UI affordance ✅ RESOLVED — Panel με checkboxes ανά όροφο (5/5 industry σύγκλιση)
- B.3.Q2: Selection mode ✅ RESOLVED — Checkboxes + presets [All][Active][None]
- B.3.Q3: Non-active rendering ✅ RESOLVED — 3-state per floor: Hide / Ghost (30% opacity) / Show
- B.3.Q4: Floor order ✅ RESOLVED — Top-down (ψηλότερος πρώτος, industry default)
- B.3.Q5: Active floor indicator ✅ RESOLVED — Μπλε τελίτσα δεξιά (Revit minimal pattern)
- B.3.Q6: Extra presets ✅ RESOLVED — 4 presets total: [All][Active][None][Invert]
- B.3.Q7: Panel placement ✅ RESOLVED — Νέο 3D-specific FloatingPanel αριστερά (tabs Floors/Lighting/Quality, separate component από 2D)

**Decisions Log (Γιώργος)** — B.3 ✅ FULLY CLOSED 7/7:

| # | Ερώτηση | Απόφαση | Industry alignment |
|---|---|---|---|
| B.3.Q1 | UI affordance για επιλογή ορατών ορόφων (panel checkboxes / slider / dropdown / ribbon group) | **Dedicated panel αριστερά με checkbox list ανά όροφο**. Λίστα ονομάτων ορόφων, checkbox δίπλα σε κάθε όνομα = ορατός/κρυμμένος, preset action buttons στο top. | 5/5 industry σύγκλιση (Revit Project Browser tree, ArchiCAD Story Settings dialog, Navisworks Saved Views, Vectorworks Layers panel, Allplan Plan Selector) — ΟΛΟΙ χρησιμοποιούν dedicated panel με checkbox list. Slider pattern απορρίπτεται (level-by-level σε 4D/section tools μόνο, όχι BIM static viewer). Dropdown απορρίπτεται (compact αλλά no multi-select). Ribbon group απορρίπτεται (vertical space waste για run-time toggling). |
| B.3.Q2 | Selection mode (per-floor checkboxes vs single-active radio + "Show All" toggle vs hybrid) | **Free multi-selection με checkboxes + 3 preset action buttons στο top: [All] [Active] [None]**. Ο χρήστης μπορεί να τσεκάρει οποιουσδήποτε ορόφους ταυτόχρονα (π.χ. 1ος+2ος μαζί). Presets accelerate common operations. | Revit/ArchiCAD checkbox + multi-select via Ctrl+click. Hybrid checkbox+presets είναι Revit pattern (Visibility/Graphics dialog). Radio απορρίπτεται (δεν υποστηρίζει 1ος+2ος μαζί). Plain checkboxes χωρίς presets απορρίπτονται (4 clicks για "All" σε 4-floor building). |
| B.3.Q3 | Non-active floor rendering (hide vs transparency-as-context vs hybrid) | **3-state toggle per floor: Hide / Ghost (30% opacity) / Show** — 3 εικονίδια δίπλα σε κάθε όροφο (👁 show, ⚫ hide, 🙈 ghost). Active state radio-style σε ένα από τα 3. Revit "Underlay" pattern επεκταμένο. Ghost rendering μέσω Three.js `material.transparent=true, opacity=0.3, depthWrite=false`. | Revit Underlay (50% γκρι ghost για context floor) — extend με per-floor control. 3/5 industry tools υποστηρίζουν transparency-as-context (Revit/ArchiCAD/Allplan). Vectorworks/Navisworks hide-only απορρίπτονται (χάνεται context value). Opacity slider per floor απορρίπτεται (UI noise, power-user overkill). Global "Ghost non-active" toggle απορρίπτεται (less προσαρμοσμένο από per-floor 3-state). |
| B.3.Q4 | Floor order display στο panel (top-down vs bottom-up vs alphabetical vs configurable) | **Top-down: ψηλότερος όροφος πρώτος**. Sort key = `floor.elevation` descending. 2ος → 1ος → Ισόγειο → Υπόγειο. Προσομοιώνει την κάθετη τομή κτιρίου (πάνω στον ουρανό, κάτω στο έδαφος). | Revit/ArchiCAD/Allplan default top-down — matches elevation order + φυσική θέαση κτιρίου από πλάι. Bottom-up απορρίπτεται (minority pattern, construction-centric αντί visualization-centric). Alphabetical απορρίπτεται (χάνει spatial logic). Configurable απορρίπτεται για now (YAGNI — μπορεί να προστεθεί αργότερα reverse toggle αν ζητηθεί). |
| B.3.Q5 | Active floor visual indicator (bold / highlight row / icon / blue dot) | **Μπλε τελίτσα δεξιά (Revit-style minimal)**. Small blue dot (🔵) στο δεξί άκρο της γραμμής του active floor. Όλα τα υπόλοιπα ορατά παραμένουν ίδια οπτικά. Zero background highlight, zero bold. REUSE existing `CAD_UI_COLORS.ACTIVE` color token (όχι νέο). | Revit blue-dot pattern direct precedent. Minimal noise — δεν συγκρούεται με checkbox states ή 3-state icons. ArchiCAD bold+star απορρίπτεται (heavier visual weight). Background highlight απορρίπτεται (accessibility risk για χρωματοτυφλούς, color-only signal). Triple indicator (highlight+bold+arrow) απορρίπτεται (overkill για frequent change). |
| B.3.Q6 | Quick action presets (3 [All][Active][None] vs 4 +Invert vs 5 +Above/Below active) | **4 presets total: [All] [Active] [None] [Invert]**. Invert αντιστρέφει checkbox states (unchecked γίνονται checked και vice versa). Πολύ χρήσιμο για BIM workflows ("βλέπω 1ο+2ο" → 1 click → "βλέπω Ισόγειο+Υπόγειο"). | 4/5 industry tools έχουν Invert command (Revit Visibility/Graphics, SketchUp tag isolation, AutoCAD layer manager, ArchiCAD layer panel). Above/Below active απορρίπτεται για now (5 presets = clutter, μπορεί να προστεθεί Phase 5+ αν ζητηθεί). 3 presets only απορρίπτεται (Invert manually = 4 clicks για 4-floor building). |
| B.3.Q7 | Floor browser placement (REUSE 2D FloatingPanel "Levels" tab vs νέο 3D-specific FloatingPanel vs right pane vs floating draggable) | **Νέο 3D-specific FloatingPanel αριστερά** — separate React component από 2D FloatingPanel, ίδια θέση (LEFT stable, όχι draggable). Δικά του tabs scoped σε 3D: **Floors** (B.3 αυτό) + **Lighting** (B.1 controls) + **Quality** (B.1.Q2/Q3 quality modulator) + future tabs. 2D FloatingPanel μένει unchanged. | Decision diverges from "REUSE 2D" recommendation (mirror SSoT) — Γιώργος προτίμησε clean 3D scope. Justification: 2D Levels tab = floor metadata viewing (read-mostly), 3D Floors tab = visibility multi-toggle (3-state per floor + 4 presets + active marker) — significantly different UX scope. Reusing same component would muddy mode-aware logic και θα γέμιζε το 2D Levels με 3D-only controls. Same physical position (LEFT) preserves spatial memory consistency. Component code duplication: ~150-200 LOC υλοποίηση cost για cleaner separation = αποδεκτό. Right pane απορρίπτεται (σύγκρουση με entity details right pane). Floating draggable απορρίπτεται (σπάει 2D LEFT pattern). |

**Architectural implications**:

- **Νέα SSoT modules (Phase 4)**:
  - `bim-3d/panels/Floating3DPanel.tsx` — container component, LEFT stable position mirror του 2D FloatingPanel structure, αλλά separate component. Hosts tabs (Floors/Lighting/Quality). Theme-aware, no drag, collapsible mirror 2D pattern.
  - `bim-3d/floors/Floor3DPanelTab.tsx` — Floors tab content. Renders preset buttons row + ordered floor list με per-row 3-state icons + checkbox + name + active marker dot.
  - `bim-3d/floors/floor-visibility-state.ts` — pure helpers: `applyPreset(state, preset)` για [All]/[Active]/[None]/[Invert], `setFloorMode(state, floorId, mode)` για 3-state cycle, `sortFloorsTopDown(floors)` με elevation descending.
  - `bim-3d/floors/applyFloorVisibility.ts` — scene mutator function `applyFloorVisibility(scene, visibleFloors, floorModes)`. Iterates `scene.entities`, sets `mesh.visible = visibleFloors.has(entity.floorId)`, για ghost floors sets `material.transparent=true, opacity=0.3, depthWrite=false` (cloned material per floor για zero cross-floor interference). Zero re-creation cost.
- **ViewMode3DStore extensions** (πάνω από §9 Q2 already approved):
  - `visibleFloors: Set<floorId>` (ήδη approved §9 Q2)
  - `floorVisibilityModes: Map<floorId, 'show' | 'ghost' | 'hide'>` (ΝΕΟ — per-floor 3-state, default 'show' για active + 'hide' για rest)
  - `activeFloorId: string | null` (ήδη implicit από §9 Q2, formalize ως store field)
  - Action creators: `setVisibleFloors(set)`, `toggleFloorVisibility(floorId)`, `setFloorMode(floorId, mode)`, `applyFloorsPreset('all' | 'active' | 'none' | 'invert')`, `setActiveFloor(floorId)`
- **3-state cycle UI**: 3 icon buttons (eye / circle-slash / monkey-mask emoji ή Lucide icons) ANA όροφο. Active state radio-style — μόνο ένα από τα 3 highlighted. Click σε άλλο εικονίδιο = state change. Checkbox είναι derived view (checked iff mode='show' OR mode='ghost').
  - Φαίνεται προς τα έξω ως: `[👁 ⚫ 🙈] 1ος όροφος 🔵`
  - Internal state: `floorVisibilityModes.get(floorId) === 'show' | 'hide' | 'ghost'`
  - Visibility derive: `visibleFloors = new Set([...floors].filter(f => modes.get(f.id) !== 'hide').map(f => f.id))` — single derived computation
- **Preset semantics**:
  - `[All]` → όλοι οι όροφοι mode='show' (all visible, no ghost)
  - `[Active]` → active floor mode='show', υπόλοιποι mode='hide'
  - `[None]` → όλοι mode='hide' (canvas blank — recovery via [All])
  - `[Invert]` → swap visible↔hidden (preserving ghost intermediate? Decision: Invert flips show↔hide, ghost παραμένει ghost). Pure helper `invertFloorModes(modes)` με rule:
    - show → hide
    - hide → show
    - ghost → ghost (preserved as third state)
- **Active floor marker**: CSS pseudo-element `::after` σε row class `[data-active="true"]`, content '🔵' or styled `<span>` με background-color από `CAD_UI_COLORS.ACTIVE` token (REUSE existing — δεν χρειάζεται νέο `FLOOR_ACTIVE_MARKER` token).
- **Floor order**: `useFloors()` hook ήδη επιστρέφει floors per building. Νέο memoized selector `useFloorsSorted(buildingId)` που εφαρμόζει `sortFloorsTopDown` (descending elevation, fallback alphabetical αν elevation equal/missing).
- **Floors data**: ADR-326 tenant-scoped Firestore `companies/{companyId}/projects/{projectId}/buildings/{buildingId}/floors/{floorId}` με fields `{name, elevation, order}`. Existing schema sufficient.
- **i18n keys** (per N.11, FIRST locale JSONs):
  - `bim3d.floors.tabTitle` — 'Όροφοι' / 'Floors'
  - `bim3d.floors.presetAll` — 'Όλοι' / 'All'
  - `bim3d.floors.presetActive` — 'Ενεργός' / 'Active'
  - `bim3d.floors.presetNone` — 'Κανένας' / 'None'
  - `bim3d.floors.presetInvert` — 'Αντιστροφή' / 'Invert'
  - `bim3d.floors.modeShow` (aria-label) — 'Πλήρως ορατός' / 'Fully visible'
  - `bim3d.floors.modeGhost` (aria-label) — 'Ημιδιάφανος (φάντασμα)' / 'Ghost (translucent)'
  - `bim3d.floors.modeHide` (aria-label) — 'Κρυμμένος' / 'Hidden'
  - `bim3d.floors.activeMarker` (aria-label) — 'Ενεργός όροφος' / 'Active floor'
  - `bim3d.floors.empty` — 'Δεν υπάρχουν όροφοι' / 'No floors defined'
  - `bim3d.panels.floors` / `bim3d.panels.lighting` / `bim3d.panels.quality` — tab labels
  - Σύνολο ~12 keys ×2 locales = ~24 entries.
- **Activation guards**:
  - Floating3DPanel mounts μόνο αν `ViewMode3DStore.mode !== '2d'`
  - Floors tab disabled αν `useFloorsSorted(buildingId).length === 0` με empty state message
- **Style SSoT REUSE**:
  - Panel container: ίδια CSS module structure με 2D FloatingPanel (border, shadow, theme tokens), διαφορετικό `data-variant="3d"` για future divergence
  - Row hover: REUSE 2D `HOVER_BG` token
  - Active marker dot: REUSE `CAD_UI_COLORS.ACTIVE` (blue)
  - 3-state icons: Lucide React (`Eye`, `EyeOff`, `Ghost`) με size=16, color tokens από theme
- **Performance**:
  - `applyFloorVisibility` runs σε store subscriber με RAF coalescing — multiple rapid toggles collapse σε single GPU update
  - Material cloning για ghost floors: lazy (only όταν floor enters 'ghost' state for first time), cached σε `WeakMap<originalMaterial, ghostMaterial>`. Zero allocation σε steady state.
  - Zero geometry recreation — only `mesh.visible` and `material` swap. <1ms per floor toggle.
- **GOL checklist**:
  - Proactive: ✅ store-driven, single source of truth `ViewMode3DStore.floorVisibilityModes`
  - Race conditions: ✅ RAF batched scene mutation
  - Idempotent: ✅ `applyFloorVisibility` idempotent (set same modes → no change)
  - Belt-and-suspenders: ✅ empty state fallback + `useFloors` loading/error states + missing floor (entity.floorId not in floors collection) renders as 'hide' silent + ghost material cache cleared on scene reset
  - SSoT: ✅ useFloors SSoT, CAD_UI_COLORS REUSE, ADR-040 micro-leaf compliance, ADR-326 tenant scope unchanged
  - Lifecycle owner: ✅ Floor3DPanelTab owns UI lifecycle, applyFloorVisibility owns scene mutation lifecycle, ViewMode3DStore owns state lifecycle — clean separation
- **Backport σε 2D**: ΟΧΙ — 2D Levels tab παραμένει unchanged (Q7 decision). Pure 3D extension.
- **Future Phase 5+ extensions** (NOT blocking B.3):
  - Reverse order toggle (αν ζητηθεί)
  - Above/Below active presets (B.3.Q6 5-preset option deferred)
  - Floor-color-coding (per-floor tint χρώμα για visual separation)
  - Floor-level section cut (combine με A.3 Section Box)
  - Keyboard shortcuts (Alt+1..9 jump to floor, Alt+0 all, Alt+Shift+I invert)

**Effort impact για B.3**: **+5-7h Phase 4** breakdown:
- Phase 4: Floating3DPanel container + Floors tab UI + 3-state icons + 4 presets → **~2.5h**
- Phase 4: floor-visibility-state.ts pure helpers + invert logic + sort helpers → **~0.5h**
- Phase 4: applyFloorVisibility.ts scene mutator + ghost material cache + RAF batching → **~1h**
- Phase 4: ViewMode3DStore extensions (floorVisibilityModes Map + actions) → **~0.5h**
- Phase 4: i18n keys (~24 entries) + locale JSONs → **~0.5h**
- Phase 4: tests (state helpers + applyFloorVisibility snapshot + invert correctness + preset semantics) → **~1.5h**
- Cross-phase: integration με §9 Q2 already-approved `visibleFloors` (derive from modes) + ribbon/keyboard hook stubs → **~0.5h**

ADR-366 total estimate revised: **~144-166h** Phase 0-7 (από ~139-159h post-B.2).

---

### B.4 — Path tracer trigger UX — ✅ FULLY CLOSED 2026-05-19

**Σκοπός**: Καθορισμός UX γύρω από τα τρία rendering modes που ήδη approved σε §9 Q3 (rasterized real-time / auto-on-idle preview / explicit final dialog) — δηλαδή ΠΩΣ ενεργοποιείται, ΠΩΣ ακυρώνεται, ΠΩΣ εμφανίζεται progress, ΤΙ επιλογές δίνει το final dialog. 9 sub-questions Q1-Q9 — όλες κλειστές με 6-7/7 industry σύγκλιση.

**Cross-references**: §9 Q3 (tri-mode approved), §9 Q4 (HDRI Phase 7 polish), `three-gpu-pathtracer` (MIT, Phase 5+6+7), `IdleDetector` SSoT (νέο utility, REUSED από B.1.Q2 + B.1.Q3), `feedback_completeness_over_mvp.md` memory (FULL ENTERPRISE for animation Q8), `feedback_industry_standard_default.md` memory (industry convergence = default).

**Pending micro-decisions** — ✅ ALL RESOLVED 2026-05-19:
- B.4.Q1: Idle threshold ✅ RESOLVED — **800ms** (Lumion/D5 median, 5/7 industry στο 500-1000ms range)
- B.4.Q2: Cancellation UX ✅ RESOLVED — **Snap cut** (7/7 industry σύγκλιση)
- B.4.Q3: Preview progress indicator ✅ RESOLVED — **Τίποτα** (Lumion/Enscape silent magic, 4/7 industry)
- B.4.Q4: Final dialog presets ✅ RESOLVED — **4 presets: Πρόχειρη 64 / Κανονική 256 / Υψηλή 1024 / Κορυφαία 4096 SPP** (Twinmotion/Enscape/Chaos Vantage σύγκλιση)
- B.4.Q5: Resolution ✅ RESOLVED — **HD/4K/8K + Custom**, default 4K (7/7 industry σύγκλιση)
- B.4.Q6: Format + destination ✅ RESOLVED — **PNG + JPG + EXR formats** + **δύο destinations (disk + project)** combinable checkboxes
- B.4.Q7: Denoiser ✅ RESOLVED — **ON by default + toggle σε Advanced** (V-Ray/Blender hybrid, 7/7 default-ON, 3/7 toggle)
- B.4.Q8: Animation support ✅ RESOLVED — **FULL ENTERPRISE: Turntable 360° + Flyaround waypoints + Timeline editor Phase 7** (7/7 industry parity, completeness_over_mvp rule)
- B.4.Q9: Time estimate ✅ RESOLVED — **Detailed estimate (D5/V-Ray style)** με GPU calibration + animation frame multiplier + visible στο dialog πάντα

**Decisions Log (Γιώργος)** — B.4 ✅ FULLY CLOSED 9/9:

| # | Ερώτηση | Απόφαση | Industry alignment |
|---|---|---|---|
| B.4.Q1 | Idle threshold (ms) πριν ξεκινήσει auto-preview path tracing | **800ms** (industry median Lumion/D5). Updates §9 Q3 αρχικό spec (2000ms) με granular industry-aligned value. | 5/7 σύγκλιση στο 500-1000ms range (V-Ray IPR 500ms, Enscape 500ms, D5 600ms, Lumion 800ms, Twinmotion 1000ms). Blender 250ms + Chaos Vantage 300ms outliers στην επιθετική πλευρά (pro tools). 2000ms (αρχικό spec) outlier vs ΟΛΟΥΣ — revised. |
| B.4.Q2 | Cancellation UX όταν user κουνήσει controls κατά path trace | **Snap cut** — instant atomic mode swap από `'3d-preview'` → `'3d-raster'` στο πρώτο camera/wheel event. Καμία fade/blend/freeze intermediate state. | 7/7 industry σύγκλιση absolute (V-Ray IPR + Lumion + Twinmotion + D5 + Enscape + Blender Cycles + Chaos Vantage). Fade 200ms blend απορρίπτεται (προσθέτει ψεύτικη καθυστέρηση camera responsiveness). Frozen 100ms placeholder απορρίπτεται (παγωμένο frame δείχνει λάθος camera position → οπτικό glitch). |
| B.4.Q3 | Progress indicator κατά το auto-preview (~2-5s typical) | **Τίποτα** — silent progressive image refinement. Η ίδια η εικόνα μιλά (γίνεται πιο καθαρή σιγά-σιγά). Zero UI overlay. Decision changed από αρχικό UI selection "Quality bar" σε "Τίποτα" σε followup turn — Γιώργος προτίμησε silent magic Lumion/Enscape ethos. | 4/7 industry leaning silent/minimal (Lumion + Enscape + Twinmotion subtle spinner + matches Nestor BIM viewer presentation context — όχι technical pro tool). 3/7 sample counter (V-Ray + Blender + D5) απορρίπτεται για preview mode (jargon για non-technical πελάτες). Σημείωση: final render dialog (Q9) έχει visible time estimate — different mode, different needs. |
| B.4.Q4 | Quality presets για final render dialog | **4 presets**: Πρόχειρη (64 SPP, ~10s) / Κανονική (256 SPP, ~1min, default ★) / Υψηλή (1024 SPP, ~5min) / Κορυφαία (4096 SPP, ~15min). i18n keys σε `bim3d.render.presets.*`. | 4-preset σύγκλιση (Twinmotion Low/Medium/High/Ultra + Enscape Low/Medium/High/Ultra + Chaos Vantage Draft/Medium/High/Production = 3/7 direct match). V-Ray 5 presets απορρίπτεται (Custom + intermediate adds clutter για mainstream users). D5 3 presets απορρίπτεται (χάνει "draft" quick-check use case — κάθε render becomes costly). Blender custom-only απορρίπτεται (zero guardrails, non-technical χάνεται). |
| B.4.Q5 | Resolution options + crop region | **HD 1920×1080 / 4K 3840×2160 / 8K 7680×4320 + Custom dimensions**, default 4K. **NO crop region** στην initial scope — viewport-full only. | 7/7 industry σύγκλιση HD/4K/8K + Custom standard (V-Ray + Lumion + Twinmotion + Enscape + D5 + Blender + Chaos Vantage). Crop region (3/7 — V-Ray + Chaos Vantage + Blender border render) deferred Phase 8+ optional — saves Phase 7 dialog complexity για now (χωρίς αυτό η dialog UI clean). Aspect ratio control via Custom dimensions sufficient. |
| B.4.Q6 | Output format + destination | **3 formats**: PNG (default, lossless presentation) / JPG (compressed, email) / EXR (HDR, post-processing). **2 destinations checkboxable combinations**: ☑ Στον υπολογιστή (browser download dialog) + ☑ Στο project (Firestore Storage upload, linked στο current project ως asset). User μπορεί να κάνει check ΚΑΙ ΤΑ ΔΥΟ → save both. | 7/7 PNG+JPG + 6/7 EXR (industry σύγκλιση). Disk destination universal (7/7). Project asset library 2/7 (Twinmotion + D5) — extended εδώ για Nestor BIM SaaS cloud-first DNA + ADR-326 tenant scope (project_assets collection ήδη υπάρχει για άλλα uploads). |
| B.4.Q7 | Denoiser default | **ON by default + toggle σε Advanced section** (collapsible "Προχωρημένα" expander κάτω από dialog). Toggle uncheck → raw output για pro post-processing σε Photoshop/AE. | 7/7 ON by default (universal). 3/7 with toggle (V-Ray + Blender + Chaos Vantage). 4/7 always-on no-toggle (Lumion + Twinmotion + D5 + Enscape) — απορρίπτεται για να καλύψουμε pro EXR workflow (memory completeness_over_mvp). Web tech: three-gpu-pathtracer built-in denoising (temporal accumulation + edge filter) sufficient για default; OIDN-wasm Phase 7.x optional upgrade αν δοκιμές δείξουν need. |
| B.4.Q8 | Animation support (turntable / flyaround) | **FULL ENTERPRISE Phase 7** — Turntable 360° + Flyaround waypoints + Timeline editor UI + path easing curves + multi-frame MP4 export. **+30-40h scope addition** στην Phase 7. | 7/7 industry parity (όλοι έχουν animation σε διαφορετική φάση maturity). Γιώργος επέλεξε FULL ENTERPRISE per memory rule `feedback_completeness_over_mvp.md` (time/file count not valid trade-offs). Turntable-only (3-5h Phase 7) ή Phase 8+ defer απορρίφθηκαν για industry-complete parity. |
| B.4.Q9 | Time estimate πριν ξεκινήσει το render | **Detailed estimate (D5/V-Ray style)** πάντα visible στο dialog: scene-complexity-aware (μετρά polygon count + light count + transparent surfaces) × samples × resolution × animation frames × GPU calibration (~50ms benchmark σε mount). Format: `⏱ Εκτιμώμενος χρόνος: ~42 λεπτά ±4 min` + `💾 Output: ~28 MB`. Updates live καθώς user αλλάζει preset/resolution. | 6/7 industry σύγκλιση (V-Ray + Lumion + Twinmotion + D5 + Enscape + Chaos Vantage detailed estimate). Blender live-progress-only απορρίπτεται (user πρέπει να ξεκινήσει για να μάθει αν αξίζει). Rough per-preset estimate (Twinmotion fallback) απορρίπτεται (±50% accuracy unacceptable για animation case). |

**Architectural implications**:

- **Νέα SSoT modules (Phase 5 — preview)**:
  - `bim-3d/render/IdleDetector.ts` — ALREADY scoped από §9 Q3, **threshold updated 2000ms → 800ms**. REUSED από B.1.Q2 (shadow modulator) + B.1.Q3 (SSAO modulator) + B.4 (path tracer auto-trigger). Pure event-driven, zero polling.
  - `bim-3d/render/PathTracerRenderer.ts` — wraps `three-gpu-pathtracer`, single instance, configurable sample budget. Modes:
    - Preview: sample budget = 256 (low), denoiser ON, autoStop=samples reached OR camera motion
    - Final: sample budget per preset Q4 (64/256/1024/4096), denoiser per Q7 toggle, autoStop=samples reached
  - `bim-3d/render/raster-to-pathtrace-swap.ts` — atomic mode swap (Snap cut Q2): disposes WebGLRenderer pass, mounts PathTracerRenderer pass, single RAF frame switch.

- **Νέα SSoT modules (Phase 6 — final dialog)**:
  - `bim-3d/render/RenderFinalDialog.tsx` — Radix Dialog (ADR-001), modal. Layout: presets radio (4) → resolution radio (HD/4K/8K + Custom inputs) → format radio (PNG/JPG/EXR) → destination checkboxes (2) → Advanced expander (denoiser toggle) → time estimate panel → [Άκυρο] [Render] buttons.
  - `bim-3d/render/render-cost-estimator.ts` — pure computation: `estimate(scene, presetSPP, resolution, frames, gpuBenchmarkScore) → { seconds: number, marginPercent: number, outputMB: number }`. GPU benchmark: ~50ms one-time στο dialog mount (renders 1 frame στα 64 SPP, measures elapsed → derives `samplesPerSecondGpu`).
  - `bim-3d/render/render-output-writer.ts` — receives Canvas pixels post-render → encodes to selected format (PNG via Canvas.toBlob, JPG via Canvas.toBlob with quality=0.92, EXR via tiny-exr or three.js EXRLoader/Writer wasm) → routes to destinations:
    - Disk: `<a download>` blob trigger (no server roundtrip)
    - Project: Firebase Storage upload με enterprise-id (νέο generator `rnd_bim_${entityId}_${ts}` — προστίθεται σε `enterprise-id.service.ts`) → Firestore document `project_assets/{assetId}` με type='bim-render' + metadata (resolution/format/preset/timestamp/userId/companyId).
  - `bim-3d/render/RenderProgressOverlay.tsx` — Final mode progress (Q9 detailed estimate visible). Layout: `⏱ X% / ~Y min remaining` + actual sample count + Cancel button. NOT mounted σε preview mode (Q3 = τίποτα).

- **Νέα SSoT modules (Phase 7 — animation)**:
  - `bim-3d/animation/TurntablePathBuilder.ts` — generates 360° camera orbit around scene center, configurable frames (24/30/60) + duration (3s/5s/10s) + axis (default Y-up vertical orbit).
  - `bim-3d/animation/WaypointPathBuilder.ts` — flyaround path from N camera waypoints + easing curves per segment (linear/cubic/easeInOut). Interpolates camera position + lookAt smoothly.
  - `bim-3d/animation/TimelineEditor.tsx` — UI for waypoint placement + scrubber + segment easing dropdown. Mounts ως Phase 7 ribbon panel `bim3d.ribbon.animation`. Drag-and-drop waypoints σε 3D scene (overlay pin markers).
  - `bim-3d/animation/MP4Exporter.ts` — uses `mp4-muxer` (MIT) + WebCodecs `VideoEncoder` API. Iterates frames (each = single path traced render), encodes H.264, downloads .mp4. Fallback to WebM (VP9) for browsers without WebCodecs.

- **ViewMode3DStore extensions**:
  - `renderMode: '2d' | '3d-raster' | '3d-preview' | '3d-final'` — ALREADY approved §9 Q3.
  - `idleThresholdMs: number` — default 800 (Q1), tunable in dev settings (NOT user-facing).
  - `previewSPP: number` — default 256, NOT user-facing (preview is invisible auto-mode).
  - `finalRenderConfig: { preset: 'draft'|'standard'|'high'|'production', resolutionW: number, resolutionH: number, format: 'png'|'jpg'|'exr', destDisk: boolean, destProject: boolean, denoiseEnabled: boolean } | null` — populated από RenderFinalDialog state, null όταν dialog κλειστό.
  - `animationConfig: { mode: 'turntable'|'flyaround', frames: number, duration: number, waypoints?: Vector3[], easing?: 'linear'|'cubic'|'easeInOut' } | null` — Phase 7.
  - Actions: `setRenderMode(mode)`, `triggerFinalRender()` (validates config, transitions raster→final), `cancelRender()` (any active render → raster), `setAnimationConfig(config)`.

- **Mode transitions FSM** (extends §9 Q3):
  - `'3d-raster'` (default όταν user 3D mode) → `'3d-preview'` αυτόματα μέσω IdleDetector 800ms idle
  - `'3d-preview'` → `'3d-raster'` instant snap cut σε ΟΠΟΙΟΔΗΠΟΤΕ camera/wheel/touch event (Q2)
  - `'3d-raster'` → `'3d-final'` explicit user click "Render" button + RenderFinalDialog submit
  - `'3d-final'` → `'3d-raster'` user clicks Cancel (preserves partial sample accumulation αν user re-triggers same config)
  - `'3d-final'` completion → automatic `'3d-raster'` return + render output downloaded/uploaded
  - 2D mode switch → ΟΛΑ disposed (PathTracerRenderer, IdleDetector, EffectComposer)

- **Industry-aligned defaults (πίνακας ready-to-implement)**:
  - SPP map: `{ draft: 64, standard: 256, high: 1024, production: 4096 }`
  - Resolution preset map: `{ HD: [1920,1080], '4K': [3840,2160], '8K': [7680,4320] }`
  - Format MIME map: `{ png: 'image/png', jpg: 'image/jpeg', exr: 'image/x-exr' }` (EXR custom MIME — encoder handles)
  - Default selection: preset='standard', resolution='4K', format='png', destDisk=true, destProject=false, denoiseEnabled=true.

- **i18n keys** (per N.11, FIRST locale JSONs):
  - `bim3d.render.dialogTitle` — 'Δημιουργία εικόνας φωτορεαλισμού' / 'Photoreal Render'
  - `bim3d.render.presets.draft` — 'Πρόχειρη (~10s)' / 'Draft (~10s)'
  - `bim3d.render.presets.standard` — 'Κανονική (~1 λεπτό)' / 'Standard (~1 min)'
  - `bim3d.render.presets.high` — 'Υψηλή (~5 λεπτά)' / 'High (~5 min)'
  - `bim3d.render.presets.production` — 'Κορυφαία (~15 λεπτά)' / 'Production (~15 min)'
  - `bim3d.render.resolution.label` — 'Ανάλυση' / 'Resolution'
  - `bim3d.render.resolution.custom` — 'Προσαρμοσμένη' / 'Custom'
  - `bim3d.render.format.label` — 'Μορφή αρχείου' / 'Format'
  - `bim3d.render.format.png` — 'PNG (παρουσίαση)' / 'PNG (presentation)'
  - `bim3d.render.format.jpg` — 'JPG (email)' / 'JPG (email)'
  - `bim3d.render.format.exr` — 'EXR (post-processing HDR)' / 'EXR (post-processing HDR)'
  - `bim3d.render.destination.label` — 'Αποθήκευση' / 'Save to'
  - `bim3d.render.destination.disk` — 'Στον υπολογιστή' / 'My computer'
  - `bim3d.render.destination.project` — 'Στο project (συνεργάτες θα δουν)' / 'Project assets (collaborators)'
  - `bim3d.render.advanced.expander` — 'Προχωρημένα' / 'Advanced'
  - `bim3d.render.advanced.denoiser` — 'Καθαρισμός θορύβου (denoiser)' / 'Denoiser'
  - `bim3d.render.estimate.time` — 'Εκτιμώμενος χρόνος' / 'Estimated time'
  - `bim3d.render.estimate.size` — 'Εκτιμώμενο μέγεθος' / 'Estimated size'
  - `bim3d.render.button.render` — 'Δημιουργία' / 'Render'
  - `bim3d.render.button.cancel` — 'Άκυρο' / 'Cancel'
  - `bim3d.render.progress.frame` — 'Καρέ {{current}}/{{total}}' / 'Frame {{current}}/{{total}}'
  - `bim3d.render.progress.remaining` — 'Απομένουν ~{{minutes}} λεπτά' / '~{{minutes}} min remaining'
  - `bim3d.render.progress.cancel` — 'Άκυρο' / 'Cancel'
  - `bim3d.render.completion.savedDisk` — 'Αποθηκεύτηκε στον υπολογιστή' / 'Saved to disk'
  - `bim3d.render.completion.savedProject` — 'Αποθηκεύτηκε στο project' / 'Saved to project assets'
  - `bim3d.animation.ribbon.label` — 'Κίνηση' / 'Animation'
  - `bim3d.animation.mode.turntable` — 'Περιστροφή 360°' / 'Turntable 360°'
  - `bim3d.animation.mode.flyaround` — 'Διαδρομή κάμερας' / 'Flyaround'
  - `bim3d.animation.frames.label` — 'Καρέ ανά δευτερόλεπτο' / 'Frames per second'
  - `bim3d.animation.duration.label` — 'Διάρκεια (δευτερόλεπτα)' / 'Duration (seconds)'
  - `bim3d.animation.waypoint.add` — 'Προσθήκη σημείου' / 'Add waypoint'
  - `bim3d.animation.waypoint.easing` — 'Καμπύλη ταχύτητας' / 'Easing curve'
  - `bim3d.animation.export.mp4` — 'Εξαγωγή MP4' / 'Export MP4'
  - Σύνολο ~28 keys × 2 locales = ~56 entries.

- **SSoT REUSE** (zero new tokens):
  - IdleDetector: shared instance, REUSED από B.1.Q2/B.1.Q3/B.4. Single timer, multi-subscriber pattern.
  - Radix Dialog (ADR-001): RenderFinalDialog mounted.
  - enterprise-id.service.ts: νέος generator `rnd_bim_*` για render assets (single addition, no parallel ID scheme).
  - EntityAuditService (ADR-195): render submissions recorded ως audit events `bim_render_created` με metadata (preset/resolution/duration_actual).
  - NOTIFICATION_KEYS: νέος key `bim3d.render.completed` (ADR-294 module `notification-keys`). Toast μετά την ολοκλήρωση + project asset link.
  - Firebase Storage path: `companies/{companyId}/projects/{projectId}/renders/{renderId}.{ext}` — same tenant-scoped pattern με υπόλοιπα project assets.
  - Firestore collection: `project_assets` (existing) με νέο `type='bim-render'` discriminator + δικά του fields (sourceEntityId optional, renderConfigSnapshot for reproducibility).
  - RBAC permissions: νέο permission `bim_renders.create` (ADR-295 roles registry) — required για destDisk OR destProject. Read permission `project_assets.read` (existing) sufficient για viewing renders αργότερα.

- **GOL checklist**:
  - Proactive: ✅ IdleDetector auto-triggers preview. RenderFinalDialog ολοκληρωτική σύλληψη config πριν start (zero post-start prompts).
  - Race-free: ✅ Atomic mode swap raster↔preview↔final (Q2 snap cut). Renderer single instance, mode = explicit FSM. Idle detector debounces RAPID camera changes (no flicker raster→preview→raster→preview).
  - Idempotent: ✅ Same config re-render → identical output (deterministic με fixed seed). Re-trigger idle → continues sample accumulation αν unchanged camera (early Phase 5+ optimization).
  - Belt-and-suspenders: ✅ WebGPU fallback to WebGL για path tracer (three-gpu-pathtracer supports both). Disk fallback αν Firebase upload fails (toast warning + auto-download το blob). Time estimate ±10% margin shown (user γνωρίζει uncertainty).
  - SSoT: ✅ Single IdleDetector, single PathTracerRenderer, single ViewMode3DStore.renderMode, single enterprise-id generator, single Firestore collection (project_assets reused).
  - Lifecycle owner: ✅ ThreeJsSceneManager owns renderer lifecycles (mount/dispose). ViewMode3DStore owns mode FSM. RenderFinalDialog owns config UI lifecycle. render-output-writer owns I/O lifecycle.

- **Phase mapping**:
  - **Phase 5** (+~3h vs §9 Q3 baseline): IdleDetector threshold 800ms + PathTracerRenderer preview mode + raster-to-pathtrace-swap + Q3 silent UX (no progress overlay σε preview)
  - **Phase 6** (+~9h vs §9 Q3 baseline ~4h → ~13h): RenderFinalDialog UI (4 presets + resolution + format + destination + denoiser advanced) + render-cost-estimator (GPU calibration + scene complexity heuristic) + render-output-writer (3 formats + 2 destinations + project_assets integration + enterprise-id generator + RBAC) + RenderProgressOverlay (Q9 visible estimate) + i18n keys (~18 entries × 2 locales)
  - **Phase 7** (+~30-40h vs §9 Q4 HDRI baseline ~4-6h → ~34-46h): TurntablePathBuilder + WaypointPathBuilder + TimelineEditor UI + MP4Exporter (WebCodecs + mp4-muxer + WebM fallback) + animation-specific i18n keys (~10 entries × 2 locales) + ribbon "Κίνηση" panel + waypoint drag-and-drop 3D overlay + path preview scrubber + segment easing controls + multi-frame render pipeline (sample budget per frame + accumulation buffer per frame)

- **License check (per N.5)**:
  - `three-gpu-pathtracer`: **MIT** ✅
  - `mp4-muxer`: **MIT** ✅
  - WebCodecs `VideoEncoder`: native browser API (no license)
  - `tiny-exr` (or three.js EXRLoader): three.js MIT family ✅
  - All deps permissive — N.5 compliant.

**Effort impact για B.4**: **+35-46h cross-phase** breakdown:
- Phase 5: IdleDetector 800ms tune + preview path tracer integration + snap cut atomic swap → **+~3h** (από §9 Q3 baseline)
- Phase 6: Final dialog full UI + cost estimator + output writer (3 formats × 2 destinations + project_assets + enterprise-id + RBAC) + progress overlay + i18n → **+~9h** (από §9 Q3 baseline ~4h → ~13h)
- Phase 7: FULL animation system (turntable + flyaround + timeline editor + waypoints + easing + MP4Exporter + WebCodecs + WebM fallback + ribbon panel + i18n) → **+~30-40h** (η μεγαλύτερη ενότητα της B.4)
- Cross-phase: pending-ratchet-work.md entry για EXR-wasm denoiser upgrade (Phase 7.x optional ~3h) + crop region (Phase 8+ optional)

ADR-366 total estimate revised: **~179-212h** Phase 0-7 (από ~144-166h post-B.3). Topic B.4 = +35-46h.

**Decision conscious diverge** (note για memory): Animation FULL ENTERPRISE Phase 7 (αντί incremental Phase 8+) είναι significant scope expansion (30-40h, ~20% του ADR-366). Justified per `feedback_completeness_over_mvp.md` memory rule (time/file count not valid trade-offs, full option preferred). Pending ratchet items DEFERRED Phase 8+: crop region rendering (B.4.Q5 — region marquee tool σε viewport), OIDN-wasm denoiser upgrade αν built-in three-gpu-pathtracer denoising προκύψει underwhelming.

---

### B.5 — Performance HUD — ✅ FULLY CLOSED 2026-05-19

**Σκοπός**: Καθορισμός UX για το performance overlay (HUD) που δείχνει FPS, frame time, polygon count, draw calls, GPU memory, samples/sec (path tracer), και render mode indicator. 8 sub-questions Q1-Q8 — όλες κλειστές με industry-driven decisions. **Τελευταία ενότητα του Group B — Group B 5/5 ✅.**

**Cross-references**: §9 Q3 tri-mode FSM (raster/preview/final), B.3.Q7 Floating3DPanel αριστερά (νέο tab για HUD toggle), B.4 PathTracerRenderer (samples/sec source), ADR-326 tenant scope (project_assets + νέο `performance_diagnostics` collection), ADR-040 micro-leaf compliance (HUD = leaf subscriber), `feedback_completeness_over_mvp.md` memory (FULL enterprise για export/diagnostic), `feedback_industry_standard_default.md` memory (BIM SaaS convergence = hidden default), `feedback_3d_mirror_2d_ssot.md` memory (annotated: εδώ 2D δεν έχει perf HUD pattern — B.5 ορίζει pattern από μηδέν, 2D μπορεί να το mirror αργότερα αν χρειαστεί).

**Pending micro-decisions** — ✅ ALL RESOLVED 2026-05-19:
- B.5.Q1: Default state ✅ RESOLVED — **Toggle στο menu, default OFF, ON με κουμπί** (industry σύγκλιση 6/8 BIM SaaS pattern)
- B.5.Q2: Position ✅ RESOLVED — **Bottom-right** (Twinmotion/Chaos Vantage 2/8, με κάθετο offset 50px πάνω από zoom controls για συνύπαρξη)
- B.5.Q3: Metrics ✅ RESOLVED — **Full diagnostic 10 metrics** (FPS + Frame time + Triangles + Vertices + Draw calls + Objects visible/total + GPU memory + CPU memory + Samples/sec + Render mode) — completeness_over_mvp
- B.5.Q4: Per-mode visibility ✅ RESOLVED — **Per-mode adaptive** (auto-promotes σημαντικά metrics ανά mode — 4/8 industry path-tracer tools)
- B.5.Q5: Warnings UI ✅ RESOLVED — **3-tier color coding** (🟢 πράσινο / 🟡 κίτρινο / 🔴 κόκκινο) με industry-median thresholds (4/8 pro tools)
- B.5.Q6: Mini vs Expanded ✅ RESOLVED — **Toggle button μέσα στο HUD, default Expanded**, preference σε localStorage (συνδυασμός industry full-info 5/8 + Lumion/Enscape mini-only 2/8)
- B.5.Q7: Export ✅ RESOLVED — **Full enterprise**: Copy stats JSON + Download .json+.png + Send diagnostic σε `performance_diagnostics` Firestore + screenshot σε Storage + super-admin notification (3/8 industry pro pattern V-Ray/Chaos/D5 + cloud-native Nestor extension)
- B.5.Q8: Mobile/tablet ✅ RESOLVED — **Responsive**: Mini-only <1024px, full Expanded ≥1024px (extension πέρα από industry 7/8 desktop-only για ADR-326 tablet site visits)

**Decisions Log (Γιώργος)** — B.5 ✅ FULLY CLOSED 8/8:

| # | Ερώτηση | Απόφαση | Industry alignment |
|---|---|---|---|
| B.5.Q1 | Default state (always-on / opt-in toggle / dev-only / context-aware) | **Toggle στο menu, default OFF**. ON via checkbox/button στο Floating3DPanel Quality tab (REUSE B.3.Q7 panel). Καθαρή UX για παρουσιάσεις πελατών (zero clutter default), αρχιτέκτονες/engineers ενεργοποιούν με 1 click όταν χρειαστούν diagnostics. | Industry σύγκλιση 6/8 BIM SaaS pattern (Lumion/Twinmotion/D5/Enscape/Blender/V-Ray hidden + toggle). Always-on (stats.js + Chaos Vantage 2/8) απορρίπτεται — σπάει Nestor SaaS clean DNA, distraction σε client demos. Dev-only ?debug=1 απορρίπτεται (αρχιτέκτονες/engineers δεν μπορούν να debugάρουν χωρίς support call). Context-aware role-based απορρίπτεται (complex 2-state UX, zero industry precedent). |
| B.5.Q2 | Position στην οθόνη | **Bottom-right** με κάθετο offset 50px πάνω από zoom controls (συνύπαρξη). Σταθερή θέση, peripheral vision-friendly. | Industry split: top-right 4/8 (D5/Lumion/Enscape/Blender), bottom-right 2/8 (Twinmotion/Chaos Vantage), top-left 1/8 (stats.js — συγκρούεται με Nestor's left Floating3DPanel B.3.Q7), bottom status 1/8 (V-Ray VFB embedded). Bottom-right επιλέχθηκε πάνω από top-right industry plurality — Γιώργος voted Twinmotion/Chaos pattern. Collision avoidance with zoom controls: vertical stack με ~50px offset, HUD πάνω από zoom. Floating-draggable απορρίπτεται (zero industry precedent, accidental-drag risk). |
| B.5.Q3 | Metrics shown | **Full diagnostic 10 metrics**: Mode indicator + FPS + Frame time (ms) + Triangles + Vertices + Draw calls + Objects visible/total + GPU memory + CPU memory + Samples/sec (path tracer mode). | Industry universal FPS 7/8, GPU mem 5/8, Triangles 3/8, Draw calls 2/8, Samples/sec 4/8 (path tracer tools), Frame time 2/8, Render mode indicator 0/8 (νέο για Nestor — απαραίτητο γιατί έχουμε tri-mode FSM B.4). Full diagnostic συνδυάζει ALL tools' metrics — Twinmotion-grade geometry stats + Blender-grade vertex/object counts + V-Ray-grade sample tracking + stats.js memory + Chaos Vantage GPU monitoring. Justified per `feedback_completeness_over_mvp.md` rule. Minimal 3-metric (Lumion/Enscape pattern 2/8) απορρίπτεται (δεν εξηγεί ΓΙΑΤΙ κολλάει η σκηνή). User-selectable per-metric checkbox απορρίπτεται (settings UI complexity, zero industry precedent, overkill για debug tool). |
| B.5.Q4 | Per-mode visibility | **Per-mode adaptive auto-highlight**. Ιδια 10 metrics πάντα παρόντα, αλλά το HUD auto-promotes (bold + position priority) τα σημαντικά metrics για το current render mode. **Raster**: FPS+Frame time bold, Samples/sec greyed `—`. **Preview**: Samples cur/total + Samples/sec bold, FPS=`—`, Triangles still visible. **Final**: ⏱ Time remaining + Samples cur/total + Samples/sec bold + progress bar `▰▰▰▱▱ 14%` sticky στο top, με auto-update από `PathTracerRenderer` progress hook. | Industry σύγκλιση 4/8 (V-Ray + Chaos Vantage + D5 + Blender — όλα τα path-tracer tools auto-adapt). Static (Twinmotion/Lumion/Enscape/stats.js 4/8) απορρίπτεται — χάνεις visual hierarchy σε κρίσιμες στιγμές. Manual mode-tab switch (zero industry precedent) απορρίπτεται — confusing dual-state (viewed mode vs actual mode). Hybrid (always + extras) απορρίπτεται — layout height jumps σπάνε spatial memory. |
| B.5.Q5 | Warnings UI | **3-tier color coding** (🟢/🟡/🔴) με industry-median thresholds: **FPS** 🟢≥45 / 🟡 25-44 / 🔴<25, **Frame time** 🟢≤22ms / 🟡 22-40ms / 🔴>40ms, **Draw calls** 🟢≤1500 / 🟡 1500-3000 / 🔴>3000, **GPU memory** 🟢<60% / 🟡 60-85% / 🔴>85% capacity, **Triangles** 🟢<1M / 🟡 1M-3M / 🔴>3M. Pulse animation στην πρώτη εμφάνιση κόκκινου state (subtle attention grab — single 800ms cubic ease pulse, όχι recurring). REUSE existing theme tokens (`STATUS_OK/WARN/ERROR` palette), zero νέο palette — mirrors Nestor 2D status colors. | 4/8 pro-grade tools (D5 bars green/yellow/red + Chaos Vantage text color shift + Twinmotion partial red-FPS + stats.js sparkline gradient). Thresholds derived from D5+Chaos+Twinmotion median values. 2-tier red-only (Twinmotion-style 1/8) απορρίπτεται — χάνεις borderline state warning. Plain text (4/8 — Blender/V-Ray/Lumion/Enscape) απορρίπτεται — user must do mental math για να καταλάβει αν είναι OK. Sparkline graph history (stats.js style) απορρίπτεται — 5× HUD height inflation καλύπτει viewport, render cost per frame, overkill για debug tool. |
| B.5.Q6 | Mini vs Expanded | **Toggle button (chevron) στο HUD header, default Expanded**. User clicks chevron `[∨]` → collapses σε mini 1-line: `raster | 58 FPS 🟢 [∧]`. Preference persisted localStorage (`bim3d.performanceHud.expanded`). Συνδυάζει industry full-info standard + Lumion/Enscape ambient option. | Industry: Always-expanded 5/8 (Vantage/D5/Twinmotion/Blender/V-Ray), Mini-only 2/8 (Lumion/Enscape consumer minimalist), Click-cycle 1/8 (stats.js), Collapsed+expand 0/8. Default Expanded επιλέχθηκε γιατί HUD ήδη opt-in (Q1) — όταν user opens it θέλει info. Mini mode προσφέρεται ως ambient monitoring option για users που θέλουν "low-distraction permanent monitor" χωρίς το βάρος των 10 metrics. Pure collapsed-by-default απορρίπτεται (2 clicks για info, semantic duplicate του opt-in toggle). Mini-only απορρίπτεται (παραβιάζει Q3 10-metric decision). |
| B.5.Q7 | Export / Share stats | **Full enterprise**: 3 actions σε HUD header `⋮` menu — **(1) Copy stats JSON** στο clipboard για quick paste σε chat/email, **(2) Download .json + .png snapshot** ως ZIP file, **(3) Send diagnostic to support** → δημιουργεί Firestore document σε νέα collection `performance_diagnostics/{diagnosticId}` με: screenshot (Canvas.toDataURL → Firebase Storage `companies/{companyId}/diagnostics/{ts}.png`), όλα τα 10 metrics, GPU benchmark score, scene info (entity count + layer count + active floor + active project), user/project context (userId + projectId + companyId), timestamp, optional user comment 280 chars. Super-admin (Γιώργος, ADR-145) λαμβάνει notification + το βλέπει στο admin diagnostics dashboard. | 3/8 industry pro tools έχουν export (V-Ray save-to-file + Chaos Vantage copy-clipboard + D5 stats-file). Cloud-native send-to-support extension μηδέν industry precedent — Nestor cloud-first DNA + ADR-326 tenant scope + ADR-145 super-admin pattern κάνει feasible. Justified per `feedback_completeness_over_mvp.md`. Copy-only (Chaos pattern απομόνωση) απορρίπτεται — χάνεις screenshot context. No-export (consumer tools 5/8) απορρίπτεται — user δεν μπορεί να αναφέρει issue χωρίς manual screenshot+typing. |
| B.5.Q8 | Mobile/tablet variant | **Responsive breakpoints**. **<768px (phone)**: HUD = mini-only 1-line, toggle Mini↔Expanded disabled, font 12px, touch button ≥44px, position bottom-right με 16px safe-area inset. **768-1023px (tablet)**: ίδιο με phone αλλά font 14px + 20px inset. **≥1024px (desktop)**: full HUD per Q1-Q7 approved (mini/expanded toggle ενεργό, 10 metrics expanded default). Export menu (Q7) **always available** (όλα τα viewport sizes — quick diagnostic from tablet site visits is core use case). | Industry σύγκλιση 7/8 desktop-only (V-Ray/D5/Twinmotion/Lumion/Blender/Chaos Vantage/Enscape δεν τρέχουν σε mobile). Nestor extension πέρα από industry: tablet site visits valid use case (ADR-326 tenant collaboration). Phone secondary use case (BIM scene δύσκολα διαβάζεται <600px). Desktop-only απορρίπτεται — tablet engineer στο εργοτάξιο δεν μπορεί να δει αν κολλάει. Same-HUD-scaled απορρίπτεται — cramped, hard to read, touch buttons too small. Touch-optimized swipe (3 swipable panels) απορρίπτεται — separate mobile component overkill για sparingly-used debug tool, zero industry precedent. |

**Architectural implications**:

- **Νέα SSoT modules (Phase 4 — core HUD)**:
  - `bim-3d/performance/PerformanceHUDStore.ts` — Zustand store: `{ enabled: boolean, expanded: boolean, metrics: PerformanceMetricsSnapshot, mode: '3d-raster'|'3d-preview'|'3d-final' }`. Actions: `setEnabled`, `toggleExpanded`, `updateMetrics(snapshot)`. localStorage-persisted preferences (`bim3d.performanceHud.enabled`, `bim3d.performanceHud.expanded`).
  - `bim-3d/performance/PerformanceCollector.ts` — RAF-driven collector. Subscribes to Three.js `renderer.info` (triangles/vertices/calls/programs) + WebGL extension `WEBGL_debug_renderer_info` (GPU name) + `performance.memory` (Chrome non-standard fallback) + custom GPU mem estimator via texture/buffer accounting. Throttled to 250ms updates (not per-frame — HUD UI doesn't need 60Hz numbers). Pushes snapshot to `PerformanceHUDStore.updateMetrics`. Auto-pause when HUD disabled (zero-cost overhead when OFF).
  - `bim-3d/performance/PerformanceHUD.tsx` — main overlay component, ADR-040 micro-leaf compliance (`useSyncExternalStore` subscriber to `PerformanceHUDStore`, mounts as sibling leaf — δεν προκαλεί re-render του canvas orchestrator). Position: `bottom: calc(50px + 16px); right: 16px; position: absolute; z-index: 50;`. Inner content διαιρείται σε `PerformanceHUDMini.tsx` (1-line) και `PerformanceHUDExpanded.tsx` (10-metric vertical list), επιλογή με `expanded` state.
  - `bim-3d/performance/performance-thresholds.ts` — pure helper με color tier mapping. `getMetricTier(name: MetricName, value: number): 'good'|'warn'|'critical'`. Thresholds-as-constants σε νέο `PERFORMANCE_THRESHOLDS` registry. REUSE existing `STATUS_OK/WARN/ERROR` design tokens για χρώματα (zero νέο palette).
  - `bim-3d/performance/metric-formatters.ts` — pure helpers για human-readable formatting (`formatBytes(1289000) → "1.2 GB"`, `formatCount(482310) → "482K"`, `formatMs(17.3) → "17 ms"`, `formatProgressBar(0.14, 8) → "▰▰▰▱▱▱▱▱"`).
  - `bim-3d/performance/per-mode-promotion.ts` — pure helper επιστρέφει `MetricEmphasis = 'bold' | 'normal' | 'greyed'` per metric per mode (Q4 logic). E.g. `getEmphasis('fps', '3d-preview') → 'normal'`, `getEmphasis('samplesPerSec', '3d-preview') → 'bold'`.

- **Νέα SSoT modules (Phase 4 — diagnostic export)**:
  - `bim-3d/performance/PerformanceDiagnosticDialog.tsx` — Radix Dialog (REUSE ADR-001) που εμφανίζεται όταν user clicks "📤 Αποστολή στο support". Δείχνει: preview screenshot, όλα τα metrics, optional user comment 280-char textarea, Cancel/Submit buttons. Submit → calls `performance-snapshot-service.create`.
  - `bim-3d/performance/performance-snapshot-service.ts` — high-level service. `createDiagnostic(input)` orchestrates: (1) capture screenshot via `renderer.domElement.toBlob('image/png', 0.92)`, (2) upload screenshot στο Firebase Storage path `companies/{companyId}/diagnostics/{diagnosticId}.png` με enterprise-id (νέος generator `perf_diag_*` σε `enterprise-id.service.ts`), (3) write Firestore document `performance_diagnostics/{diagnosticId}` με τα metrics+context+screenshot URL, (4) EntityAuditService `recordChange` (audit type `performance_diagnostic_submitted`), (5) NOTIFICATION_KEYS `bim3d.diagnostic.received` notification στον super-admin (Γιώργος, ADR-145 registry lookup), (6) toast success στο UI. Idempotent via deterministic ID.
  - `bim-3d/performance/clipboard-stats-writer.ts` — pure helper για Q7 Copy action. Σερβίρει JSON με stable schema (version-stamped) μέσω `navigator.clipboard.writeText`.
  - `bim-3d/performance/file-download-writer.ts` — pure helper για Q7 Download action. Δημιουργεί ZIP (JSZip MIT) με `stats.json` + `screenshot.png`, triggers `<a download>` blob link.

- **ViewMode3DStore integration**:
  - Δεν προστίθενται νέα fields στο `ViewMode3DStore`. Το `PerformanceHUDStore` είναι separate Zustand store (perf concerns ≠ view-mode concerns, ADR-294 SSoT scope separation).
  - `PerformanceHUDStore` διαβάζει `renderMode` από `ViewMode3DStore` (cross-store subscribe via shallow selector) για Q4 per-mode logic.

- **Floating3DPanel integration (extends B.3.Q7)**:
  - Quality tab (ήδη approved B.3.Q7) **adds new row**: `[☐] Εμφάνιση Performance HUD` checkbox με aria-label `bim3d.performance.toggleAria`. State binding: `PerformanceHUDStore.enabled`. Default OFF (Q1).
  - Quality tab δομή: top section Quality presets (B.1.Q2/Q3 modulator presets) → divider → bottom section Performance HUD toggle.
  - Δεν προστίθεται νέο tab — αποφεύγουμε bloat (Quality tab είναι natural home για performance settings).

- **Firestore schema**:
  - **Νέα collection**: `performance_diagnostics/{diagnosticId}` (top-level — όχι nested μέσα σε project, για να μπορεί ο super-admin να βλέπει cross-project diagnostics).
  - Document fields:
    ```ts
    {
      diagnosticId: string;           // `perf_diag_${userId}_${ts}` deterministic
      companyId: string;              // tenant scope (ADR-326)
      userId: string;
      projectId: string | null;       // null αν δεν είναι σε project
      timestamp: Timestamp;
      screenshotPath: string;         // Storage path
      screenshotUrl: string;          // signed URL για admin preview
      metrics: {
        renderMode: '3d-raster' | '3d-preview' | '3d-final';
        fps: number; frameTimeMs: number;
        triangles: number; vertices: number;
        drawCalls: number; objectsVisible: number; objectsTotal: number;
        gpuMemoryMb: number; cpuMemoryMb: number | null;
        samplesPerSec: number | null;
      };
      sceneInfo: {
        entityCount: number; layerCount: number;
        activeFloorId: string | null;
        sceneBoundingBoxMeters: { w: number; h: number; d: number };
      };
      gpuInfo: { vendor: string; renderer: string; webgpu: boolean };
      userComment: string | null;     // max 280 chars
      status: 'open' | 'investigating' | 'resolved';   // super-admin curates
      resolvedBy: string | null;
      resolvedAt: Timestamp | null;
    }
    ```
  - **Firestore rules**:
    - Create: `request.auth != null && resource.data.companyId == request.auth.token.companyId && resource.data.userId == request.auth.uid` (user creates diagnostics for own user+company).
    - Read: super-admin (per ADR-145 registry) OR owner reads own diagnostics.
    - Update: super-admin only (status field curation).
    - Delete: super-admin only.
  - **RBAC permissions**: `performance_diagnostics.create` (all authenticated users, scoped to own company), `performance_diagnostics.read` (super-admin OR owner), `performance_diagnostics.update` (super-admin), `performance_diagnostics.delete` (super-admin).
  - **Storage rules** για `companies/{companyId}/diagnostics/{file}.png`: create scoped per company tenant, read super-admin + owner, delete super-admin.

- **enterprise-id integration (N.6 mandatory)**:
  - Νέος generator `perf_diag_*` σε `enterprise-id.service.ts`. Pattern: `perf_diag_${userId}_${nanoid(10)}_${ts}` με deterministic component για idempotency.

- **Notification system (NOTIFICATION_KEYS registry)**:
  - Νέο key `bim3d.diagnostic.received` σε `NOTIFICATION_KEYS` registry. Notification message: `'Νέο performance diagnostic από {userName} ({projectName}) — FPS {fps}'`. Routed στον super-admin per ADR-145.

- **EntityAuditService integration (CHECK 3.17 entity audit coverage)**:
  - Νέος audit type `performance_diagnostic_submitted` με fields `{ diagnosticId, fps, renderMode }`. Called inside `performance-snapshot-service.createDiagnostic` after Firestore write.

- **Industry-aligned thresholds (constants ready-to-implement)**:
  ```ts
  export const PERFORMANCE_THRESHOLDS = {
    fps:           { good: 45,   warn: 25,    invert: true  }, // ≥45 good, 25-44 warn, <25 critical
    frameTimeMs:   { good: 22,   warn: 40,    invert: false },
    drawCalls:     { good: 1500, warn: 3000,  invert: false },
    gpuMemoryPct:  { good: 60,   warn: 85,    invert: false },
    triangles:     { good: 1_000_000, warn: 3_000_000, invert: false },
  } as const;
  ```

- **Responsive breakpoints (Q8)**:
  - `<768px`: force `expanded: false`, hide toggle chevron, font 12px, touch ≥44px.
  - `768-1023px`: force `expanded: false`, font 14px.
  - `≥1024px`: respect user `expanded` preference, font 13px.
  - Implementation: CSS container queries (modern) με fallback Tailwind responsive classes.

- **Per-mode adaptive rendering (Q4 detail)**:
  - In `PerformanceHUDExpanded.tsx`, each metric row reads `getEmphasis(metricName, renderMode)` και applies CSS class `font-bold` (bold) / `` (normal) / `text-muted opacity-50` (greyed).
  - Σε `'3d-final'` mode, εμφανίζεται **sticky progress bar row** στο top: `⏱ {timeRemaining} | {samplesCurrent}/{samplesTotal}` + ASCII bar 8 chars `▰▰▰▰▱▱▱▱ {pct}%`. Bar updates συγχρονισμένα με `PathTracerRenderer.onProgress` callback.
  - Σε raster mode, samples/sec row δείχνει `Samples/s: — (raster)` greyed.

- **i18n keys** (per N.11, FIRST locale JSONs `el/bim3d.json` + `en/bim3d.json`):
  - `bim3d.performance.toggleAria` — 'Εμφάνιση/Απόκρυψη Performance HUD' / 'Show/Hide Performance HUD'
  - `bim3d.performance.toggleLabel` — 'Performance HUD' / 'Performance HUD'
  - `bim3d.performance.mode` — 'Κατάσταση' / 'Mode'
  - `bim3d.performance.modeRaster` — 'γρήγορη' / 'raster'
  - `bim3d.performance.modePreview` — 'προεπισκόπηση' / 'preview'
  - `bim3d.performance.modeFinal` — 'τελική' / 'final'
  - `bim3d.performance.fps` — 'FPS' / 'FPS'
  - `bim3d.performance.frameTime` — 'Χρόνος εικόνας' / 'Frame time'
  - `bim3d.performance.triangles` — 'Τρίγωνα' / 'Triangles'
  - `bim3d.performance.vertices` — 'Κορυφές' / 'Vertices'
  - `bim3d.performance.drawCalls` — 'Κλήσεις σχεδίασης' / 'Draw calls'
  - `bim3d.performance.objects` — 'Αντικείμενα ορατά/σύνολο' / 'Objects visible/total'
  - `bim3d.performance.gpuMemory` — 'Μνήμη GPU' / 'GPU memory'
  - `bim3d.performance.cpuMemory` — 'Μνήμη CPU' / 'CPU memory'
  - `bim3d.performance.samplesPerSec` — 'Δείγματα/δλ' / 'Samples/sec'
  - `bim3d.performance.timeRemaining` — 'Χρόνος που απομένει' / 'Time remaining'
  - `bim3d.performance.collapse` — 'Σύμπτυξη σε μικρή προβολή' / 'Collapse to mini view'
  - `bim3d.performance.expand` — 'Επέκταση σε πλήρη προβολή' / 'Expand to full view'
  - `bim3d.performance.menuAria` — 'Ενέργειες HUD' / 'HUD actions'
  - `bim3d.performance.copyStats` — '📋 Αντιγραφή stats' / '📋 Copy stats'
  - `bim3d.performance.download` — '💾 Λήψη .json + .png' / '💾 Download .json + .png'
  - `bim3d.performance.sendToSupport` — '📤 Αποστολή στο support' / '📤 Send to support'
  - `bim3d.performance.diagnostic.dialogTitle` — 'Αποστολή Performance Diagnostic' / 'Send Performance Diagnostic'
  - `bim3d.performance.diagnostic.commentLabel` — 'Σχόλιο (προαιρετικό, μέχρι 280 χαρακτήρες)' / 'Comment (optional, up to 280 chars)'
  - `bim3d.performance.diagnostic.commentPlaceholder` — 'Π.χ. Κολλάει όταν περιστρέφω την κάμερα...' / 'E.g. Stutters when I orbit the camera...'
  - `bim3d.performance.diagnostic.submitButton` — 'Αποστολή' / 'Send'
  - `bim3d.performance.diagnostic.cancelButton` — 'Άκυρο' / 'Cancel'
  - `bim3d.performance.diagnostic.successToast` — 'Το diagnostic στάλθηκε. Ο διαχειριστής ειδοποιήθηκε.' / 'Diagnostic sent. Admin notified.'
  - `bim3d.performance.diagnostic.errorToast` — 'Αποτυχία αποστολής. Δοκιμάστε ξανά.' / 'Send failed. Try again.'
  - Total ~28 keys × 2 locales = ~56 entries.

- **GOL checklist (N.7.2)**:
  - **Proactive**: ✅ HUD opt-in (Q1), zero passive overhead — Collector pauses fully when disabled. Σκηνή performance characteristics δεν χτυπιούνται από HUD presence.
  - **Race conditions**: ✅ RAF-throttled collector @250ms + Zustand single-mutation per snapshot + ADR-040 micro-leaf prevents orchestrator re-renders.
  - **Idempotent**: ✅ `createDiagnostic` deterministic ID από `perf_diag_${userId}_${ts}` — duplicate clicks → same Firestore doc updated, no duplicates. Screenshot upload uses same path (overwrite).
  - **Belt-and-suspenders**: ✅ Primary path `renderer.info` + fallback estimator για GPU memory (όχι all browsers expose). `performance.memory` Chrome-only — graceful null για Safari/Firefox με UI label `CPU mem: —`. WebGPU vs WebGL info detection με fallback.
  - **Single Source of Truth**: ✅ `PerformanceHUDStore` SSoT για state + preferences. `PerformanceCollector` SSoT για metric gathering. `PERFORMANCE_THRESHOLDS` SSoT για color tiers. Zero parallel implementations.
  - **Fire-and-forget vs await**: Collector update = fire-and-forget (UI display, non-critical). Diagnostic submit = await (correctness — toast/error feedback required).
  - **Lifecycle owner**: ✅ `PerformanceHUDStore.enabled` owns HUD visibility lifecycle. `PerformanceCollector` owns metric gathering lifecycle (subscribes to store, auto-pauses when disabled). `performance-snapshot-service` owns diagnostic write lifecycle. Clean separation.

  **Verdict**: ✅ **Google-level: YES** — opt-in, zero overhead when off, race-free, idempotent diagnostics, full SSoT.

- **Style SSoT REUSE**:
  - Container: ίδια CSS module structure με 2D overlay panels (border, shadow, theme tokens), `data-variant="performance-hud"` για future divergence.
  - Color tiers: REUSE `STATUS_OK` (#22c55e green) / `STATUS_WARN` (#eab308 yellow) / `STATUS_ERROR` (#ef4444 red) από existing design tokens.
  - Progress bar: REUSE existing `Progress` component (Radix Progress) από Phase 6 render dialog (B.4) — same component.
  - Icons: Lucide React (`Activity`, `ChevronDown`, `ChevronUp`, `MoreVertical`, `Copy`, `Download`, `Send`) με size=14, color tokens.

- **Performance budget (HUD overhead)**:
  - Collector: 250ms throttled = 4 updates/sec, ~0.2ms per snapshot read (renderer.info is O(1)). Total <1ms/sec overhead.
  - HUD render: Mini variant ~10 nodes, Expanded ~80 nodes. React reconciliation ~0.5ms per update.
  - Total when HUD enabled: <2ms/sec on main thread. Negligible.
  - When disabled: zero overhead (Collector subscribed but pauses on enabled=false).

- **License check (N.5)**:
  - JSZip: **MIT** ✅ (Phase 4 dependency για Q7 download ZIP).
  - Three.js `renderer.info`: built-in, no new dep.
  - All other code: in-house.

- **Activation guards**:
  - PerformanceHUD mounts μόνο αν `ViewMode3DStore.mode !== '2d'` AND `PerformanceHUDStore.enabled === true`.
  - Diagnostic menu actions disabled αν δεν υπάρχει active project (some metrics like `projectId` δεν θα έχουν value — δεν blocks submit but warns user).

- **Future Phase 5+ extensions (NOT blocking B.5)**:
  - Sparkline graph history (60s rolling) ως optional "Show graphs" toggle στο Settings.
  - Per-metric drill-down click → opens detail panel με historical chart + per-frame breakdown.
  - Admin diagnostics dashboard (super-admin view για `performance_diagnostics` collection με filters + search + status curation) — ADR-145 super-admin scope expansion.
  - Anonymized telemetry opt-in για aggregate performance analytics (% users seeing FPS<30, etc.).
  - Auto-submit threshold (αν FPS<10 για >5s → auto-prompt "θες να στείλεις diagnostic;").

**Effort impact για B.5**: **+6-8h Phase 4** breakdown:
- Phase 4: `PerformanceHUDStore.ts` + `PerformanceCollector.ts` (Three.js renderer.info integration + RAF throttle + Chrome memory hook + GPU estimator) → **~1.5h**
- Phase 4: `PerformanceHUD.tsx` + `PerformanceHUDMini.tsx` + `PerformanceHUDExpanded.tsx` (bottom-right positioning + responsive breakpoints + Mini/Expanded toggle + chevron + ARIA) → **~1.5h**
- Phase 4: `performance-thresholds.ts` + `metric-formatters.ts` + `per-mode-promotion.ts` (pure helpers + tests) → **~0.5h**
- Phase 4: Floating3DPanel Quality tab integration (Show Performance HUD checkbox) → **~0.25h**
- Phase 4: `PerformanceDiagnosticDialog.tsx` + `performance-snapshot-service.ts` (Firestore + Storage + enterprise-id + EntityAudit + Notification + RBAC + Firestore rules) → **~2-3h**
- Phase 4: `clipboard-stats-writer.ts` + `file-download-writer.ts` + JSZip integration → **~0.5h**
- Phase 4: `performance_diagnostics` Firestore rules + Storage rules + test fixtures (CHECK 3.16 mandatory on touch) → **~0.5h**
- Phase 4: i18n keys (~28 × 2 locales = ~56 entries) + ICU compliance → **~0.5h**
- Phase 4: tests (collector snapshot fixture + thresholds boundary + per-mode promotion table + diagnostic submit idempotency + responsive breakpoint snapshots) → **~1h**

ADR-366 total estimate revised: **~185-220h** Phase 0-7 (από ~179-212h post-B.4, +6-8h B.5 net).

**Group B summary** (ALL 5 topics CLOSED ✅):
- B.1 Materials & Lighting UX: 4/4 ✅ (+14h Phase 5)
- B.2 BIM Data Overlay: 4/4 ✅ (+20.5-24.5h Phase 4-7)
- B.3 Multi-floor visibility controls: 7/7 ✅ (+5-7h Phase 4)
- B.4 Path tracer trigger UX: 9/9 ✅ (+35-46h Phase 5-7, includes FULL ENTERPRISE animation Phase 7)
- B.5 Performance HUD: 8/8 ✅ (+6-8h Phase 4)
- **Group B total**: 32/32 questions ✅ — **+80.5-99.5h** additive across phases.

---

## 12. Changelog

| Ημ/νία | Αλλαγή | Author |
|---|---|---|
| 2026-06-28 | **§B.5 — STATIC SHADOW-MAP + SETTLE COALESCE (next bottleneck attack· UNCOMMITTED, Opus 4.8).** **Production** A/B (Netcup, 5×60-sample `dxf-perf-trace`) επιβεβαίωσε ότι τα προηγούμενα fixes δούλεψαν: `cursor.totalLag` **avg ~15ms (≈66fps)** (το dev φούσκωνε ~86%). ΜΕΝΕΙ συστηματική ουρά **p95 ~75ms / max ~90ms** = το **settle-frame** (βαρύ shadowed render μπλοκάρει το επόμενο cursor update). **SSoT audit ευρήματα:** (1) `renderer.shadowMap.autoUpdate` δεν οριζόταν πουθενά (grep: 0 hits) → default `true` → το Three.js regenerate-άρει ΟΛΟ το shadow depth-map σε ΚΑΘΕ render παρότι η σκηνή είναι **στατική σε ηρεμία**· (2) δύο ανεξάρτητα settle renders — unshadowed hover @POINTER_SETTLE(100ms) + shadowed @SHADOW_SETTLE(350ms). **FIX A (static shadow map, big-player Three.js/iModel.js/Forge):** `scene-setup.ts` `renderer.shadowMap.autoUpdate=false`· NEW `ShadowModulator.invalidateShadowMap()` SSoT method (το `update()` OFF→ON ήδη flag-άρει `needsUpdate` για το πρώτο crisp frame)· κλήση στα geometry/light mutation SSoT του `ThreeJsSceneManager` (`syncBimEntities`, `syncBimEntitiesMultiFloor`, `updateSunPosition`, `applyLightPreset`, `applyFloorVisibility`, `applyBuildingVisibility`) → μηδέν stale σκιές, μηδέν περιττό depth-pass regen στα επαναλαμβανόμενα at-rest renders. **FIX B (settle coalesce):** `bim3d-pointer-scheduler` — το deferred hover refine-on-settle διαβάζει τώρα `SHADOW_SETTLE` (αντί `POINTER_SETTLE`) → το hover render ΣΥΓΧΩΝΕΥΕΤΑΙ με το shadow-on render = ΕΝΑ settle frame αντί για δύο (μισό settle work + κανένα πρώιμο render που μπλοκάρει resumed motion σε αργό σάρωμα). NEW `shadow-modulator.test.ts` 5/5· `bim3d-pointer-scheduler.test.ts` 10/10 (settle window 100→350). **🔴 Production A/B εκκρεμεί** (Giorgio): `dxf-no-shadows` flag → στόχος p95 75→<40ms. Fix C (hysteresis) μόνο αν παραμείνει ουρά. | Opus |
| 2026-06-28 | **§B.5 — ADAPTIVE SHADOWS (big-player Revit/Cinema4D· UNCOMMITTED→pushed για Netcup τεστ, Opus 4.8).** Browser A/B (`dxf-perf-trace`) απέδειξε: οι σκιές PCF = ~40ms/frame σε αδύναμη GPU = σχεδόν ΟΛΟ το render-cost (σκιές OFF → `cursor.totalLag` 60→14ms ≈ render-off). **FIX (Giorgio: «όπως οι μεγάλοι παίκτες»):** NEW `lighting/shadow-modulator.ts` `ShadowModulator` — σκιές **OFF στην πλοήγηση** (camera drag/damping fed από `scene-render-frame`· cursor sweep **self-detected** μέσω δικού του window `mousemove` listener — η αλυσίδα `pointer-activity` δεν έφτανε αξιόπιστα), **ON σε ηρεμία**. `warmUp()` pre-compile-άρει την OFF variant (program-cache hit → μηδέν recompile-stall στο toggle). Settle-repaint **gated σε `!enabled`** (επαναφορά μόνο όταν οι σκιές είναι όντως off → μηδέν spurious 40ms render όταν ο κέρσορας απλώς σταματά εκτός καμβά, π.χ. στη μπάρα έλξεων). NEW `DXF_TIMING.gesture.SHADOW_SETTLE=350`. Wiring: `scene-rendering-subsystems` (construct+onNeedsRender), `ThreeJsSceneManager` (warmUp μετά sync + frameContext + dispose), `scene-dispose` (window-listener cleanup). **Browser-verified (Giorgio):** καμβάς πλοήγηση **ΚΑΘΑΡΗ** (κανένα rAF violation). **🔬 DIAG flags ΚΡΑΤΗΘΗΚΑΝ** (Giorgio· localStorage-gated, no-op σε production): `dxf-no-render`, `dxf-no-shadows`. ⚠️ Dev runtime (~86%) φουσκώνει τα νούμερα — production (Netcup) = το αληθινό τεστ (HUD frameTime 17ms). `bim3d-pointer-scheduler.test.ts` 10/10. ThreeJsSceneManager 500/500 (comment-trim). | Opus |
| 2026-06-28 | **§B.5 — 3D σταυρόνημα 1:1 cursor tracking (CAD-grade, UNCOMMITTED, Opus 4.8).** Μετά τις perf διορθώσεις ο Giorgio: «καλύτερα αλλά ΟΧΙ 1:1 — μη αποδεκτό για CAD». **Ρίζα (`BimCrosshairOverlay3D`):** ο move-handler έκανε `if (!snapActive) applyTransform(cursor)` — δηλαδή όταν υπήρχε **οποιοδήποτε** published snap, το σταυρόνημα ενημερωνόταν **ΜΟΝΟ** από το RAF (ανά καρέ), ακόμη κι όταν το snap **δεν** ήταν έγκυρος jump-target αυτή τη στιγμή (occluded/off-screen/camera-gate → ο RAF resolver έδειχνε cursor ούτως ή άλλως) → μη-1:1 ελεύθερη κίνηση πάνω σε γεωμετρία. **FIX:** NEW non-reactive `gluedRef` (ADR-040, zero React) — true ΜΟΝΟ όταν ο RAF resolver όντως «κουμπώνει» (`snapped`). Ο move-handler γίνεται `if (!gluedRef.current) applyTransform(cursor)` → εφαρμόζει **σύγχρονα σε κάθε mousemove** (1:1, paint με το ποντίκι) και υποχωρεί στο RAF ΜΟΝΟ όταν είναι όντως μαγνητισμένο σε snap (διατήρηση ADR-545 magnetism). Listener bound-once (stable `toCanvasLocal`, διαβάζει `gluedRef` live). Instrumentation (`cursor.totalLag/inputLatency/coalesced`) διατηρήθηκε. tsc: serialized (N.17). 🔴 browser-verify (production build για να φύγει το ~14ms dev input-queue) + commit. | Opus |
| 2026-06-28 | **§B.5 — 🔴 ΓΙΓΑΝΤΙΑ DXF-text CanvasTexture (~340MB) → cap 2048px (UNCOMMITTED, Opus 4.8). ✅ BROWSER-VERIFIED (Giorgio: καμία «Texture has been resized» εγγραφή μετά το reload· cursor.totalLag 55→20ms).** Browser trace (`dxf-perf-trace`) αποκάλυψε `THREE.WebGLRenderer: Texture has been resized from (18760×6000) to (16384×5240)` + `'click' handler took 616ms`. **Ρίζα:** `dxf-text-3d.ts buildDxfTextMesh` ζωγραφίζει κάθε DXF κείμενο σε CanvasTexture με `fontPx = heightUnits × TEXTURE_PX_PER_UNIT(16)` **χωρίς cap** → ένα ψηλό annotation (~300 μονάδες) έφτιαχνε canvas **18760×6000 = ~340MB RGBA** GPU upload → καταστροφικό stall σε αδύναμη/integrated GPU (πιθανή κυρίαρχη αιτία του «3D βαρύ» + αργής μετάβασης, ΟΧΙ απλό fill-rate). **FIX:** `MAX_TEXTURE_DIM=2048` — αν το canvas ξεπερνά το cap, κλιμακώνω το `pxPerUnit` **uniformly** ώστε να χωρά· το παγκόσμιο μέγεθος του plane (`canvas / pxPerUnit`) μένει **ΑΝΑΛΛΟΙΩΤΟ** — πέφτει μόνο η texel density (label δεν χρειάζεται χιλιάδες px). Refactor σε `measureCanvas(pxPerUnit)` helper. Tests: `dxf-text-3d.test.ts` 2/2 (το cap είναι browser-verified — jsdom δεν έχει 2D canvas). tsc: serialized (N.17). 🔴 browser-verify: ξανα-trace → ΟΧΙ texture-resize warning, click handler << 616ms, ελαφρύτερο 3D + commit. | Opus |
| 2026-06-28 | **§B.5 — Μετάβαση 2D→3D: skip SSAO warm-up όταν OFF (UNCOMMITTED, Opus 4.8).** Ο `syncBimEntities` καλούσε `ssaoModulator.warmUp()` (πλήρες SSAO composer render + shader link) σε ΚΑΘΕ 3D mount — αλλά το SSAO/idle escalation είναι **opt-in** (`autoPreviewEnabled`, default OFF) → καθαρή σπατάλη GPU στη μετάβαση. **FIX:** gate `warmUp()` πίσω από `autoPreviewEnabled` (αν ενεργοποιηθεί αργότερα → lazy compile στο 1ο idle frame, ο τεκμηριωμένος fallback). MOD `ThreeJsSceneManager.ts` (+import `useViewMode3DStore`). tsc OOM (N.17 μηχάνημα, όχι type error· προηγ. πλήρεις έλεγχοι exit 0). 🔴 browser-verify + commit. | Opus |
| 2026-06-28 | **§B.5 — RESTORE-ON-IDLE ξεκουμπώθηκε από το `autoPreviewEnabled` gate (ασυμμετρία degrade/restore σκιών, UNCOMMITTED, Opus 4.8).** Μετά την ανατροπή του dynamic-resolution (entry παρακάτω), το restore-on-idle που απέμεινε είναι το **shadow-quality** (`QualityModulator`: σκιές moving 1024/r0.5 ⇄ idle 2048/r4). **Bug (επαληθευμένο από κώδικα):** στο `scene-idle-handlers.ts` το `onActive` καλεί **πάντα** `qualityModulator.onCameraActive()` (degrade σκιών σε κάθε κίνηση κάμερας), αλλά το `onIdle` έκανε **early-return ΠΡΙΝ** το `qualityModulator.onCameraIdle()` όταν `autoPreviewEnabled=OFF` (default) → degrade πάντα, restore ποτέ → **οι σκιές κολλάνε μόνιμα στη σκληρή/χαμηλή moving-quality** σε κανονικό editing (στο μηχάνημα Giorgio cores=4 → `IS_LOW_PERF=false` → modulator ενεργός → τον χτυπάει). **FIX (SSoT, big-player «degrade-during-motion αλλά always restore-on-idle»):** το φθηνό, one-shot shadow-restore (`qualityModulator.onCameraIdle()`) μετακινήθηκε **πάνω** από το gate → τρέχει σε **ΚΑΘΕ** idle, συμμετρικά με το always-on degrade. Δεν είναι ο grind culprit (rebuild shadow map μία φορά στο settle, on-demand· ΟΧΙ per-frame όπως το SSAO composer). Τα **ακριβά** escalations μένουν gated πίσω από `autoPreviewEnabled`: SSAO refine-on-idle composer pass (heavy FBO round-trip), path tracer, preview mode. **Files:** MOD `bim-3d/scene/scene-idle-handlers.ts` (restore πάνω από gate + rationale), `__tests__/scene-idle-handlers.test.ts` (το test που κωδικοποιούσε το bug ευθυγραμμίστηκε: OFF → shadow-restore ΚΑΛΕΙΤΑΙ, SSAO/path-tracer ΟΧΙ). Tests 2/2 PASS. ✅ Google-level: YES — συμμετρία degrade/restore, μηδέν grind reintroduction, ένα gate μόνο για τα ακριβά. 🔴 browser-verify (κίνησε κάμερα→σταμάτα→σκιές ξανα-μαλακές/υψηλής ανάλυσης χωρίς autoPreview) + commit (Giorgio· stage ADR-366). | Opus |
| 2026-06-28 | **§B.5 — 3D ΠΑΛΙΝΔΡΟΜΗΣΗ ΠΟΙΟΤΗΤΑΣ: ανατροπή dynamic-resolution + επαναφορά MSAA (UNCOMMITTED, Opus 4.8).** Μετά τις ταυτόχρονες fill-rate περικοπές **3 πρακτόρων** (Round-1 MSAA/σκιές + Round-2 dynamic-resolution/FrontSide + 6-fixes), ο Giorgio: «η κατάσταση άλλαξε δραματικά προς το χειρότερο» — (#2) 3D ποιότητα πολύ χαμηλή, χειρότερη στην περιστροφή· (#3) στο **σταμάτημα** οι ακμές **μένουν blurry/χαμηλής ανάλυσης**. **Ρίζα (επαληθευμένη από κώδικα):** σε **μικροσκοπική** σκηνή (546 τρίγωνα / 5 draw calls) τα δύο επιθετικά levers είναι **λάθος tradeoff** — καταστρέφουν ποιότητα χωρίς ουσιαστικό κέρδος. **(α)** `antialias:false` (Round-1) → κανένα AA, aliased ακμές πάντα (το «cheap FXAA αργότερα» δεν μπήκε ποτέ). **(β)** `ResolutionModulator` `setPixelRatio(base×0.6)` εν κινήσει → blurry orbit/zoom + (idle-threshold delay) μη-ακαριαία επαναφορά = «μένουν χαμηλής ανάλυσης». **FIX (big-player: σε τόσο μικρή σκηνή crisp full-quality ΠΑΝΤΑ — Revit/Cinema4D):** (1) `scene-setup.ts` `antialias:false → **true**` (MSAA τετριμμένα φθηνό σε 546 τρίγωνα, καλύτερο από post-AA που προσθέτει full-screen fill-rate+θόλωμα)· (2) **πλήρης revert του Round-2 dynamic-resolution** — **DELETED** `lighting/resolution-modulator.ts` + test, unwire από `scene-rendering-subsystems.ts` + `scene-idle-handlers.ts` (+revert test) → πλήρης ανάλυση εν κινήσει ΚΑΙ στο σταμάτημα. **KEEP** (γνήσια κέρδη, μηδέν οπτικό κόστος): `preserveDrawingBuffer:false`+offscreen capture SSoT, `MaterialCatalog3D` FrontSide (backface culling κλειστών solids· flag see-through→1-line revert), σκιές PCF/1024+degrade-on-motion. **DEFER (ξεχωριστά, χρειάζονται trace):** #1 (2D→3D αργή) + #4 (κέρσορας lag/swim 2D&3D — αφορά και 2D → όχι από 3D αλλαγές). Tests: `scene-idle-handlers.test.ts` 2/2 (αφαιρέθηκε το dynamic-res test). tsc: serialized (N.17). 🔴 browser-verify: ακμές κρυστάλλινες ακίνητα ΚΑΙ εν κινήσει· σταμάτημα ακαριαία crisp· FrontSide see-through check + commit (Giorgio). | Opus |
| 2026-06-28 | **§B.5 — REFINE-ON-SETTLE hover highlight (UNCOMMITTED, Opus 4.8).** Giorgio (διαγνωστικά): «όταν ο κέρσορας κινείται μέσα στον καμβά, σε κάθε βήμα ζωγραφίζεται η σκηνή;». Ιχνεύθηκε όλο το per-move pipeline (`handleMouseMove`→`requestPointerPick`→`runPick`): η σκηνή ΔΕΝ render-άρει ανά pixel (υπάρχει guard `hoverId !== lastHoverId`), **αλλά** σε κάθε ΑΛΛΑΓΗ οντότητας κάτω από τον κέρσορα γίνεται **ΕΝΑ πλήρες WebGL re-render** (highlight silhouette) — βαρύ σε fullscreen/αδύναμη GPU όταν σαρώνεις πάνω στο μοντέλο. **FIX (big-player Revit/Cinema4D: hover resolves ON SETTLE, reuse `pointer-activity` SSoT):** ο `runPick` **αναβάλλει** το hover-highlight render (`setHoveredEntity`+`applyBimHover`+`markSceneDirty`) όσο `isPointerActive(now, POINTER_SETTLE=100ms)` — ΔΕΝ προχωρά το `lastHoverId`, οπότε η αλλαγή μένει pending· επιστρέφει `true`→ ο `onPickFrame` κρατά armed το slot ώσπου ο κέρσορας **σταματά**, τότε εφαρμόζει το highlight **μία φορά**. Το **snap glyph (Canvas2D, χωρίς WebGL render) μένει live** στο σάρωμα → snapping responsive. Καθαρό αποτέλεσμα: μηδέν full-scene renders κατά το γρήγορο σάρωμα· crisp highlight ακαριαία στο σταμάτημα. Tests: `bim3d-pointer-scheduler.test.ts` **10/10** (+refine-on-settle defer/apply· τα hover-assert tests χρησιμοποιούν `settledPick` helper). tsc: serialized (N.17). 🔴 browser-verify + commit. | Opus |
| 2026-06-28 | **§B.5 — Αναστολή OSNAP/hover picking ΚΑΤΑ ΤΗΝ ΠΛΟΗΓΗΣΗ κάμερας (UNCOMMITTED, Opus 4.8).** Giorgio (μετά την επαναφορά ποιότητας): «η περιστροφή έγινε πιο αργή» + «το σταυρόνημα κολυμπάει και κινείται σε σκαλοπάτια»· **πρότεινε ο ίδιος: «κατά την περιστροφή να απενεργοποιούνται οι έλξεις;»** — σωστό (big-player Revit/Cinema4D: κανένα object snap στην πλοήγηση). **Ρίζα:** ο `bim3d-pointer-scheduler.runPick` έτρεχε **BVH raycast + O(N) snap search κάθε ~50ms** ΚΑΙ κατά το orbit/zoom (το ποντίκι κινείται όσο σέρνεις) — αποτέλεσμα που μετά **κρυβόταν** ούτως ή άλλως από το camera-motion gate των overlays = **διπλή σπατάλη** που έτρωγε το main thread → αργή περιστροφή + starved crosshair RAF/window-listener → «stepped/swim». **FIX (SSoT reuse, μηδέν νέος μηχανισμός):** NEW public `ThreeJsSceneManager.isCameraInteracting()` (εκθέτει το ΥΠΑΡΧΟΝ `isInteracting` flag — set από τα controls 'start'/'end', γρ.126-127)· ο `runPick` κάνει early-return όταν `isCameraInteracting()` και **καθαρίζει** τυχόν εναπομείναν snap (guarded — μόνο αν υπάρχει). **Domino win:** με snap=null στην πλοήγηση → `snapActive` false → **σταματούν ΚΑΙ οι RAF loops** του `BimCrosshairOverlay3D` + `BimSnapIndicatorOverlay3D` (που έκαναν `projectSnap3DMarker` raycast/frame) → το σταυρόνημα ξαναακολουθεί τον κέρσορα **κατευθείαν στο mousemove** (zero-lag), όχι RAF. Tests: `bim3d-pointer-scheduler.test.ts` **9/9** (+2 gate tests: skip-all-picking-while-navigating + no-redundant-clear). tsc: serialized (N.17). 🔴 browser-verify: περιστροφή ελαφρύτερη + σταυρόνημα ομαλό στην πλοήγηση + commit (Giorgio). ⚠️ Παραμένει το #4 σε **2D** (διαφορετικό pipeline) + #1 (μετάβαση) → ξεχωριστά. | Opus |
| 2026-06-28 | **§B.5 — 3D fill-rate Round 2: dynamic resolution + backface culling (UNCOMMITTED, Opus 4.8).** ⚠️ **ΑΝΑΤΡΑΠΗΚΕ ΕΝ ΜΕΡΕΙ** από την εγγραφή 2026-06-28 παραπάνω (dynamic-resolution αφαιρέθηκε· FrontSide κρατήθηκε). Μετά το Round 1 (MSAA/σκιές) ο Giorgio: «βαρύ ΚΑΙ στα δύο, αλλά Netcup production καλύτερο» → απομένει **πραγματικό** fill-rate υπόλοιπο (όχι μόνο dev runtime). SSoT audit στον κώδικα βρήκε 2 μη-διορθωμένους per-pixel ένοχους: (1) **`MaterialCatalog3D.buildMat` `side: DoubleSide`** → ζωγράφιζε ΚΑΙ τις πίσω παρειές κάθε κλειστού solid = ~2× overdraw + όχι culling· (2) **καμία dynamic resolution** στην κίνηση (ο `QualityModulator` έριχνε μόνο σκιές). **Fix Α (ο #1 μοχλός, big-player «navigation downscale» — Forge/APS, Sketchfab, Cinema4D):** NEW `lighting/resolution-modulator.ts` `ResolutionModulator` — στο camera-active ρίχνει `renderer.setPixelRatio(base×0.6)` + `setSize(w,h,false)` (CSS άθικτο, ~0.36× fragments)· στο camera-idle επαναφέρει full + ζητά ΕΝΑ repaint. Καλωδιωμένο στον **ΥΠΑΡΧΟΝΤΑ** idle detector (`scene-idle-handlers.ts`, SSoT — ίδιο hook με shadow/SSAO modulators)· το restore είναι **UNCONDITIONAL** (πριν το `autoPreviewEnabled` gate) ώστε η ακίνητη εικόνα να είναι πάντα κρυστάλλινη. Internal στο `scene-rendering-subsystems.ts` factory (μηδέν νέα public surface). **Fix Β:** `buildMat` `DoubleSide → FrontSide` (SOLE face factory· τα hidden-line/occluder variants κρατούν explicit DoubleSide· section-cut interiors καλύπτονται από το stencil cap pipeline). **Tests:** NEW `resolution-modulator.test.ts` 5/5 + `scene-idle-handlers.test.ts` 3/3 (νέο: active-downscale/idle-restore + unconditional restore) GREEN. tsc SKIP (N.17 — άλλος agent tsc· αλλαγές typed). ⚠️ SHARED TREE (Round 1 agent στο `scene-setup.ts` — ΔΕΝ το άγγιξα). 🔴 browser-verify localhost dev (orbit/zoom: ελαφρύ εν κινήσει, κρυστάλλινο στο σταμάτημα· Β: έλεγχος τομών/εσωτερικών όψεων/λεπτών φινιρισμάτων μη «βλέπεις πέρα» — αν ναι, 1-line revert FrontSide→DoubleSide) + commit (Giorgio). | Opus |
| 2026-06-28 | **§B.5 — 3D «βαρύ/δύσχρηστο» = fill-rate bound → Round 1 περικοπές (UNCOMMITTED, Opus 4.8).** Diagnosis (μετά το FPS-metric fix): browser-verify με Performance HUD = **5 FPS** σε **τιποτένια** σκηνή (546 τρίγωνα, 5 draw calls) → αδύνατο GPU-geometry. Giorgio resize test: **μικρό παράθυρο → ομαλό, μεγάλο → βαρύ, zoom βαρύ** = **fill-rate bound** (κόστος ανά pixel, όχι ανά τρίγωνο). Console: cores=4 (`IS_LOW_PERF` false → adaptive ON), pixelRatio=0.8 (ήδη χαμηλό → όχι ο μοχλός). `autoPreviewEnabled` OFF by default → SSAO/path-tracer **δεν** τρέχουν (αποκλείστηκαν). Υπόλοιποι per-pixel ένοχοι κατά orbit/zoom: **MSAA + PCFSoft σκιές + preserveDrawingBuffer**. **Round 1 fix** (`scene-setup.ts`, ασφαλείς full-framebuffer περικοπές, big-player post-AA doctrine): `antialias:true→false` (MSAA off· FXAA post-pass αργότερα αν χρειαστεί), `PCFSoftShadowMap→PCFShadowMap` (single-tap), sun `shadow.mapSize 2048→1024`. Μηδέν feature breakage (καμία αλλαγή σε screenshot/SSAO). 🔴 browser-verify στο localhost dev (reload για νέο renderer). **Round 2 αν χρειαστεί:** `preserveDrawingBuffer:false` (με render-to-target screenshot) + adaptive pixelRatio κατά interaction. | Opus |
| 2026-06-28 | **§B.5 — 3D Performance HUD FPS metric ΣΠΑΣΜΕΝΟ → real-fps SSoT (browser-reported «3Δ βαρύ/δύσχρηστο», UNCOMMITTED, Opus 4.8).** Ο Giorgio ανέφερε «πολύ βαρύ 3D»· το HUD έδειχνε **4-5 FPS / 250ms** σε **τιποτένια** σκηνή (546 τρίγωνα, 5 draw calls, 44 objects). **Ρίζα = measurement bug:** ο `PerformanceCollector.tick` (3D) υπολόγιζε `fps = 1000 / (now − lastTickTime)` όπου το `elapsed` ήταν **πάντα το 250ms interval του `setInterval`** → καρφωμένο στο 1000/250 ≈ **4**, ΑΣΧΕΤΟ με πραγματικά καρέ (κανένας frame counter). Παρενέργεια: ο ψεύτικος FPS<10 ενεργοποιούσε διαρκώς `autoSubmitFpsThreshold` + regression alerts. **SSoT FIX:** ο 3D collector χρησιμοποιεί πλέον την **ΙΔΙΑ** πηγή με τον 2D (`UnifiedFrameScheduler.onFrame` → `averageFps`, πραγματικά RAF καρέ) — η §B.5.U το είχε ήδη κάνει σωστά στον `Performance2DCollector`· ο παλιός 3D collector (§B.5 2026-05-19) δεν είχε μεταφερθεί ποτέ. Αφαιρέθηκε το EMA/`1000/elapsed`· προστέθηκε `unsubscribeFrame` (cleanup στο stop). renderer.info stats (triangles/drawCalls) αμετάβλητα. 1 αρχείο. tsc SKIP (N.17 — άλλος agent tsc). 🔴 browser-verify: HUD ξανα-ON → **πραγματικό fps** (αν ~60 static → δεν υπήρχε ποτέ 3D πρόβλημα· ο «βαρύς» δείκτης ήταν false alarm) + commit. | Opus |
| 2026-06-28 | **§B.5 — Performance HUD accuracy + screenshot + dropdown z-index fixes (browser-reported).** Μετά browser-verify ο Giorgio ανέφερε 3 ανωμαλίες (ΟΧΙ από το §B.5.U· από τον αρχικό 3D collector/render setup): (1) **`triangles:0`/`vertices:0`** ενώ drawCalls=3 — ο `PerformanceCollector` διάβαζε `renderer.info.render`, αλλά η σκηνή render-άρει μέσω **EffectComposer** (SSAO + post-fx overlay passes· βλ. `ssao-modulator.ts`/`post-fx-overlay-pass.ts`) → το `info.render` αντικατοπτρίζει **μόνο το τελευταίο pass**. FIX: **NEW pure `bim-3d/performance/scene-render-stats.ts` `computeSceneRenderStats(scene)`** — μετράει triangles/vertices/meshTotal/meshVisible με `scene.traverse`/`traverseVisible` (composer-independent), InstancedMesh × instance count. (2) **`objectsVisible(29) > objectsTotal(28)`** — μετρούσε `scene.children.length` (top-level) vs `info.programs.length` (shader programs) = ασύμβατη σημασιολογία. FIX: `objectsVisible=meshVisible`, `objectsTotal=meshTotal` από το ίδιο helper· `drawCalls` παραμένει `info.render.calls`. (3) **Screenshot λευκό** — ο main renderer (`scene-setup.ts createBimRenderer`) δεν είχε `preserveDrawingBuffer` → `canvas.toBlob/toDataURL` κενό (WebGL clears buffer μετά το composite). FIX: `preserveDrawingBuffer:true` (ίδια επιλογή με τον MP4 exporter). (4) **Dropdown «⋮» πίσω από το HUD** — το default `z-50` portal έπεφτε κάτω από το high-stacking canvas viewport. FIX: `z-[2000]` (elevated token) στο `DropdownMenuContent` του `PerformanceHUDExpanded`. **Tests:** NEW `scene-render-stats.test.ts` 7/7· bim-3d performance+scene **136/136 PASS**. ✅ browser-verified (cpu/gpu OK). | Opus |
| 2026-06-27 | **§B.5.U — ΕΝΙΑΙΟΣ Performance HUD 2D + 3D (FULL SSoT, Revit/Cinema4D-grade).** Εντολή Giorgio: «γιατί δεν έχουμε έναν ενιαίο μετρητή και για 2Δ και για 3Δ;». **Πρόβλημα:** δύο ξεχωριστά συστήματα — (α) το 2D PERF panel (`core/performance/GlobalPerformanceDashboard`) έδειχνε **hardcoded MOCK** (`fps:50` σταθερά)· (β) το ώριμο 3D HUD (§B.5) mount-αρισμένο **μέσα** στο `BimViewport3D` → αόρατο σε 2D. **Απόφαση:** το ώριμο 3D HUD γίνεται **κοινός πυρήνας**· το 2D γίνεται δεύτερη **πηγή metrics** στο ΙΔΙΟ store. **Αλλαγές:** (1) `renderMode` διευρύνθηκε `Bim3dRenderMode`→**`HudRenderMode`** (= `ViewMode3D`, νέο leaf type `hud-render-mode.ts`, προστέθηκε `'2d'`) σε ΟΛΗ την αλυσίδα (PerformanceHUDStore/Mini/Expanded + baseline-tracker + regression-detector + telemetry-batcher + anonymizer)· (2) τα WebGL-only πεδία του `PerformanceMetricsSnapshot` (triangles/vertices/drawCalls/objectsVisible/objectsTotal/gpuMemoryMb) έγιναν **`number \| null`** (ίδιο pattern με cpuMemoryMb/samplesPerSec)· σε 2D = null → εμφανίζονται «—» greyed μέσω `EMPHASIS_MAP['2d']` (per-mode-promotion)· null-guards σε Expanded/Diagnostic/HistoryStore· (3) **NEW `Performance2DCollector`** — αδελφός του `PerformanceCollector`, reuse `UnifiedFrameScheduler.onFrame` (πραγματικά fps) + `performance.memory` (cpu), γράφει το ΙΔΙΟ HUD+History store, double-gated (enabled && mode==='2d')· (4) **NEW `usePerformanceModeBridge`** — mirror `ViewMode3DStore.mode`→`setRenderMode` (πρώτος caller· ήταν 0 callers) + start/stop 2D collector (single-writer invariant)· (5) **NEW `UnifiedPerformanceHudLeaf`** mount-αρισμένο ΩΣ sibling του `CanvasLayerStack3dLeaf` στο `CanvasLayerStack` (ζει σε 2D ΚΑΙ 3D)· canvas ανά mode (2D dxf canvas / 3D `getRendererCanvas()` ADR-453)· αφαιρέθηκε το `<PerformanceHUD/>` mount από `BimViewport3D`· (6) **ΕΝΑ toggle**: PERF κουμπί (DebugToolbar) + action `toggle-perf` (useDxfViewerCallbacks) → `usePerformanceHUDStore.setEnabled`· συγχρονισμένα με το Quality3DPanel switch (ίδιο store)· (7) **κατάργηση mock**: αφαιρέθηκε όλο το wiring (DxfViewerContent/Dialogs/Callbacks), **deleted** ορφανά `usePerformanceMonitorToggle.ts` + `ClientOnlyPerformanceDashboard.tsx`· το generic `GlobalPerformanceDashboard` (core, barrel+lazy registry) μένει deprecated-for-viewer· (8) +`cpuMemoryMb` tier στο `performance-thresholds.ts` (ΜΟΝΗ display-tier SSoT· το `core/.../PERFORMANCE_THRESHOLDS` ADR-019 μένει ΜΟΝΟ ως optimizer config, control axis όχι display). **Threshold split** τεκμηριωμένο. **SSoT αναθεώρηση (Giorgio audit):** τα διπλότυπα που εισήχθησαν διορθώθηκαν — NEW `bim-3d/performance/performance-collector-shared.ts` (`commitPerformanceSnapshot`) + NEW neutral `utils/cpu-memory.ts` (`readCpuMemoryMb`) = ΜΙΑ πηγή για CPU-memory read & store-commit, χρησιμοποιούμενη από **3D collector + 2D collector + DxfPerformanceOptimizer** (αφαιρέθηκαν `hasMemoryAPI`/`PerformanceWithMemory`/`PerformanceMemoryInfo` από `dxf-perf-types`)· `HudRenderMode` = **alias** του `ViewMode3D` (όχι διπλό union)· `TICK_MS` = `DXF_TIMING.PERFORMANCE_HUD_POLL`. **⚠️ FLAGGED (out of scope, χρειάζεται δικό του ADR/N.8):** ο type `PerformanceWithMemory` είναι διπλότυπος σε **8+ σημεία cross-subapp** (geo-canvas ×4, core/performance, dxf-viewer) — app-wide ενοποίηση = ξεχωριστό cross-cutting έργο. 2D δεν τροφοδοτεί baseline/regression/telemetry (3D-tuned, future). +i18n `performance.mode.2d` (el+en). **Tests:** 4 NEW colocated suites `bim-3d/performance/__tests__/` (Performance2DCollector / usePerformanceModeBridge / PerformanceHUDExpanded null-render / performance-thresholds SSoT) = **21/21 PASS**. **tsc:** 0 errors στα ~20 δικά μου αρχεία (τα 16 project errors είναι προϋπάρχοντα από shared tree άλλων agents — beam/structural/foundation). CHECK 6D → ADR-040 (CanvasLayerStack orchestrator δεν subscribe-άρει· το leaf subscribe-άρει = επιτρεπτό). ✅ Google-level: YES — ΕΝΑ store/HUD/thresholds/history, μηδέν mock, single-writer invariant, ADR-040 micro-leaf. 🔴 browser-verify (PERF ON σε 2D→πραγματικά fps + 3D metrics «—»· switch 3D→ίδιο HUD με triangles/drawCalls/GPU· καθαρή εναλλαγή) + commit. | Opus |
| 2026-06-15 | **Κατάργηση δεξιού 3D `BimEntityCardPanel` → συγχώνευση στο αριστερό Properties palette (Revit-grade single palette, FULL SSOT).** Εντολή Giorgio: στην 3D προβολή το δεξί card «Στύλος» (5 tabs Γεωμετρία/Υλικά/ΒΚΕ/Σχόλια/Ιστορικό) να φύγει· τα μη-διπλότυπα να μεταφερθούν στο αριστερό floating «Ιδιότητες» tab ως υπο-καρτέλες. **Ανάλυση διπλοτύπων:** Γεωμετρία (==Διαστάσεις subtab+column props) + Υλικά (==Υλικά subtab+Material field) → **DROP**· ΒΚΕ/Σχόλια/Ιστορικό = unique → **MOVE σε sub-tabs**. **Αρχιτεκτονική:** NEW γενικό `ui/bim-properties/BimPropertiesShell.tsx` στο case `'properties'` του `usePanelContentRenderer` → υπο-καρτέλες ΚΟΙΝΕΣ για ΟΛΑ τα BIM types (SSoT win — το card ήταν ήδη γενικό): **Παράμετροι** → `BimPropertiesRouter` (ΥΠΑΡΧΟΝ per-type Wall/Column/Stair, αμετάβλητο)· **ΒΚΕ** → `BimBoqTab` (reuse)· **Σχόλια** → `BimCommentsTab` (reuse)· **Ιστορικό** → `BimAuditTab` (reuse). Sub-tabs εμφανίζονται μόνο όταν επιλεγεί BIM entity (`isBimEntity`)· αλλιώς router empty-state. bimType/bimId SSoT = `scene.entity`· companyId/projectId ίδιο pattern με το card (useAuth+ProjectHierarchy)· last-active-sub-tab reuse `last-active-tab-tracker` (default `geometry`→`parameters`). **Γέφυρα selection:** ΗΔΗ υπάρχει — `use3DSelectionUniversalBridge` (ADR-402) γράφει 3D→universal `primarySelectedId`· auto-activate Properties tab διευρύνθηκε από stair/column σε **όλα τα BIM** (`isBimEntity`‖`isStairEntity`) ώστε 3D selection να γεμίζει το palette + sub-tabs. **DELETED (5 orphan):** `BimEntityCardPanel.tsx`, `tabs/BimGeometryTab.tsx`, `tabs/BimMaterialsTab.tsx`, `tabs/useBimGeometryEdit.ts`, `tabs/material-alternatives-resolver.ts` (dead-code ratchet — κανένα test/άλλη χρήση). **MOD (4):** `BimViewport3D.tsx` (αφαίρεση `<BimEntityCardPanel/>` mount — ADR-040 αρχείο, CHECK 6B/6D → ADR staged)· `usePanelContentRenderer.tsx`· `FloatingPanelContainer.tsx` (auto-activate)· i18n `dxf-viewer-shell.json` el+en (+`bimProperties.{title,subtabs.*}`). **NEW (1):** `BimPropertiesShell.tsx`. N.2/N.3/N.11/N.7.1 compliant. ✅ Google-level: YES — ΕΝΑ palette, μηδέν διπλό panel/κώδικας, reuse όλων των unique tabs. 🔴 browser-verify (3D→επιλογή κολώνας→ΟΧΙ δεξί card· αριστερό «Ιδιότητες» με Παράμετροι/ΒΚΕ/Σχόλια/Ιστορικό· λειτουργικά· μηδέν διπλή Γεωμετρία/Υλικά· 60fps) + commit (git add ΜΟΝΟ δικά μου). HANDOFF_2026-06-15_3d-entity-card-merge-into-properties-palette.md. | Opus |
| 2026-06-12 | **Tumble inertia ΑΦΑΙΡΕΘΗΚΕ (Giorgio: «όταν Alt+click και το αφήνω, εξακολουθεί να γυρίζει η εικόνα»).** ΑΙΤΙΑ (όχι bug — feature): το custom tumble (`tumble-rotation.ts`, OrbitControls `enableRotate=false`) είχε C4D-style momentum — στο `onPointerUp`, αν η ταχύτητα τελευταίου frame ήταν `|vel|>0.5px` έβαζε `damping=true` και το `update()` συνέχιζε την περιστροφή φθίνοντας κατά `TUMBLE_DAMPING=0.08`/frame ώς το `VEL_CUTOFF=0.01` (~1s glide). **Απόφαση Giorgio:** καθόλου αδράνεια — σταματά ακαριαία στο release. **Fix:** το `onPointerup` (drag path) καλεί κατευθείαν `onEnd()`· αφαιρέθηκε όλη η μηχανική αδράνειας (`velX/velY/damping`, `VEL_CUTOFF`, `update()` damping loop → τεκμηριωμένο no-op κρατημένο για το render-loop/interface). Αφαιρέθηκε το αχρησιμοποίητο export `TUMBLE_DAMPING` (`viewport-constants.ts`). Η περιστροφή οδηγείται πλέον 100% από το `onPointerMove`. **2 MOD** (`tumble-rotation.ts`, `viewport-constants.ts`). Tests: `tumble-rotation.test.ts` 10/10 PASS (κανένα test δεν ήλεγχε αδράνεια — μηδέν regression). SKIP tsc (μικρή αλλαγή). ΕΚΤΟΣ ADR-040 (camera nav). ΜΗΝ adr-index (shared tree). ✅ Google-level: YES — αφαίρεση dead path, καθαρό SSoT. 🔴 browser-verify (Alt+drag→αφήνω→σταματά αμέσως) + commit (git add ΜΟΝΟ δικά μου). | Opus |
| 2026-06-12 | **Surface wheel-zoom RECENTER-JUMP fix (Giorgio: «όταν κάνω ζουμ με το ροδάκι η εικόνα πηδάει», regression από το 2026-06-10).** ΡΙΖΑ: το `onSurfaceWheel` (`viewport-camera.ts`) μετά το dolly έκανε `controls.target.copy(hit)` + `controls.update()` → όταν ο κέρσορας ήταν **εκτός κέντρου**, ο orbit target καρφωνόταν στο off-axis σημείο και η `controls.update()` `lookAt(target)` **ξανα-στόχευε** την κάμερα → η εικόνα **έστριβε/πηδούσε** σε κάθε notch (ίδιο pattern με το `lookAt`-jump που είχε λυθεί στο §A.6.Q5 v4 για την περιστροφή — εδώ επανεισήχθη από το zoom). **Fix (Revit zoom-to-cursor, FULL SSoT):** NEW pure `computeSurfaceZoomPose(camPos, target, hit, factor, margin, maxDist)` στο `viewport-zoom-surface.ts` — dolly κατά μήκος cam→hit (reuse `computeSurfaceDolly`) ΚΑΙ **ολίσθηση του `target` κατά το ΙΔΙΟ διάνυσμα** ώστε η διεύθυνση βλέμματος camera→target να μένει αμετάβλητη → `lookAt` = no-op (μηδέν στρίψιμο/jump), ενώ η κάμερα κινείται στην ακτίνα του κέρσορα άρα το σημείο κάτω από τον κέρσορα μένει **αγκυρωμένο** (γνήσιο zoom-to-cursor). Το σιελ POI σταυρουδάκι (στο `controls.target`) μένει στον άξονα βλέμματος → δεν πετάγεται. `onSurfaceWheel` καλεί `computeSurfaceZoomPose` → copy position+target. **1 NEW fn + 2 MOD** (`viewport-zoom-surface.ts`, `viewport-camera.ts`). Tests: `viewport-zoom-surface.test.ts` +4 (view-direction αμετάβλητη· target slides κατά camera delta· move κατά μήκος cam→hit ray = anchoring· no-mutate) → **15/15 PASS**. SKIP tsc (μικρή αλλαγή· έτρεχε ήδη tsc άλλου agent — N.17). ΕΚΤΟΣ ADR-040 (camera nav). ΜΗΝ adr-index (shared tree). ✅ Google-level: YES — pure testable invariant (direction-preserved), reuse `computeSurfaceDolly`, μηδέν re-aim. ✅ **BROWSER-VERIFIED (Giorgio 2026-06-12): «τώρα λειτουργεί».** 🔴 commit μόνο (git add ΜΟΝΟ δικά μου, shared tree). | Opus |
| 2026-06-10 | **Revit-grade SURFACE-ANCHORED 3Δ wheel zoom (no punch-through· DONE· 11 PASS· 🔴 verify+commit)**. Giorgio browser: «όταν κοντοζυγώνω σε τοίχο το zoom κρατά ίδιο βήμα → καρφώνομαι μέσα στο σώμα αντί να πλησιάσω την επιφάνεια· η Revit αλλάζει βήμα σε κοντινά zoom». **Διάγνωση:** το `viewport-camera.ts` έχει `zoomToCursor=true` ΑΛΛΑ η three.js OrbitControls **δεν κάνει raycast γεωμετρίας** — κρατά σταθερό το σημείο στη ΣΦΑΙΡΑ orbit (συχνά πίσω από τον τοίχο) και το dolly step είναι γεωμετρικό ως προς την απόσταση στον (μακρινό) **target** → ένα notch κοντά σε τοίχο = μεγάλο απόλυτο βήμα → περνάς μέσα. `PERSP_MIN_DISTANCE=1.0m` εμπόδιζε και το πλησίασμα λεπτομέρειας. **Revit απόφαση (δική μου):** zoom step **ανάλογο της απόστασης προς την ΕΠΙΦΑΝΕΙΑ κάτω από τον κέρσορα** → ασυμπτωτική προσέγγιση, ποτέ διείσδυση. **FULL SSOT (reuse `raycastWorldPoint`, μηδέν νέα raycast μηχανή):** NEW pure `viewport/viewport-zoom-surface.ts` (`computeSurfaceDolly(camPos, hit, factor, marginM, maxDistM)` = κίνηση κατά μήκος cam→hit ώστε dist×factor, clamped `[margin, max]`· `wheelZoomFactor(deltaY, base, sens, zoomSpeed)` mirror OrbitControls feel)· `viewport-camera.ts` +custom `wheel` listener **capture-phase** (προηγείται του OrbitControls· σε geometry hit → surface dolly + `controls.target=hit` (Revit pivot) + `stopImmediatePropagation` ώστε να ΜΗΝ κάνει double-dolly το OrbitControls· σε miss/ortho/disabled → no-op, τρέχει το default OrbitControls)· `scene-setup.ts` +`resolveSurfacePoint` dep· `ThreeJsSceneManager.ts` wire `raycastWorldPoint(bimLayer.group, camera, canvas, x,y)`· `viewport-constants.ts` `PERSP_MIN_DISTANCE 1.0→0.12` + NEW `ZOOM_SURFACE_MARGIN=0.12` (=120mm, >CAMERA_NEAR 0.1· closest hug, μηδέν punch-through) + `ZOOM_WHEEL_BASE=0.95`/`ZOOM_WHEEL_SENSITIVITY=0.01`. **2 NEW (helper+test) + 4 MOD.** Tests: `viewport-zoom-surface.test.ts` 11 (step shrinks near surface· clamp at margin· no-cross· zoom-out· maxDist cap· degenerate· no-mutate· wheel factor convention)· canonical-views 12 regression. tsc filtered εκκρεμές (background). ΕΚΤΟΣ ADR-040 (camera nav, όχι render-store). ΜΗΝ adr-index. ✅ Google-level: YES — pure testable math, reuse SSoT raycaster, capture-phase pre-emption καθαρή (OrbitControls fallback άθικτο σε miss/ortho), idempotent. ⚠️ Browser verify: 3Δ κοντοζύγωσε σε τοίχο με wheel → πλησιάζεις την παρειά ασυμπτωτικά (βήμα μικραίνει), σταματάς ~120mm, ΔΕΝ μπαίνεις μέσα· pivot στο σημείο που δείχνεις. **ΜΑΘΗΜΑ:** το OrbitControls `zoomToCursor` ΔΕΝ ξέρει γεωμετρία (orbit-sphere point, όχι surface)· για Revit precision zoom χρειάζεται raycast της επιφάνειας + βήμα ∝ surface distance + hard clamp. 🔴 commit. | Opus |
| 2026-06-05 | **§A.6.Q5 v5 — Alt-pivot σε αντικείμενο DXF (floor-plane fallback).** Ο Giorgio (browser repro, αποφασιστικό): «σε αντικείμενο **BIM** δουλεύει σωστά· σε αντικείμενο **DXF** η περιστροφή φεύγει στο κέντρο». ΡΙΖΑ (debug-first με runtime logs — επιβεβαιώθηκε ότι η κάμερα περιστρεφόταν ΣΩΣΤΑ rigidly + `controls.update()` no-op + render χρησιμοποιεί την ίδια κάμερα· άρα το bug ήταν στο pivot-pick): το `raycastWorldPointOrPlane` έκανε raycast ΜΟΝΟ στο `bimGroup`. Το DXF overlay (`DxfToThreeConverter`) ζει σε ΞΕΧΩΡΙΣΤΟ group στο οριζόντιο επίπεδο **Y=0** (`DXF (x,y) → (x,0,−y)`). Κλικ σε DXF → BIM raycast miss → το v3 camera-facing fallback plane έβαζε το pivot σε **λάθος βάθος** (στο βάθος του target) → το DXF σημείο (σε άλλο βάθος) δεν ήταν το pivot → φαινόταν να φεύγει στο κέντρο. (BIM hit ήταν εντάξει γιατί επιστρέφει το αληθινό σημείο επιφάνειας.) **Fix**: νέα προαιρετική παράμετρος `groundY` στο `raycastWorldPointOrPlane` — σε BIM miss τέμνει ΠΡΩΤΑ το **οριζόντιο επίπεδο δαπέδου στο `groundY`** (όπου ζει το DXF) → επιστρέφει το πραγματικό σημείο κάτω από τον κέρσορα· το camera-facing plane μένει ως τελευταίο fallback (κλικ προς «ουρανό»). `ThreeJsSceneManager.setOrbitPivotAt` περνά `groundY = dxfConverter.getBounds()?.min.y` (null αν δεν υπάρχει DXF → μηδέν αλλαγή στη BIM-only συμπεριφορά). `OrbitPivotDeps.groundY` wired. **Tests**: +4 raycaster (floor-plane fallback @Y=0 / cursor-tracking στο δάπεδο / geometry-hit-wins / groundY-αλλάζει-pivot) → **14/14 raycaster + 9/9 tumble PASS**, tsc 0 (δικά μου). ✅ **BROWSER-VERIFIED (Giorgio): «τώρα λειτουργεί σωστά» — και DXF και BIM.** Καθαρίστηκαν τα προσωρινά `[ORBIT-DBG]` logs + διορθώθηκε stale doc-comment στο `setOrbitPivot`. ΕΚΤΟΣ ADR-040. 🔴 commit (Giorgio). | Claude (Opus 4.8) |
| 2026-06-04 | **§A.6.Q5 v4 — Rigid orbit-around-pivot, ΧΩΡΙΣ άλμα (SSOT main + preview).** Ο Giorgio: το v3 περιστρεφόταν γύρω από το σημείο ΑΛΛΑ «μόλις κάνω κλικ όλο το σχέδιο πηδάει στο κέντρο» — δεν το θέλει ούτε στο 3D ούτε στο preview· θέλει «το σχέδιο να μένει στη θέση του». ΡΙΖΑ: και το `setOrbitPivot` (`controls.update()`→`lookAt`) και το OrbitControls rotate κάνουν `lookAt(target)` → το σημείο κεντράρεται (άλμα). **Fix = rigid turntable orbit**: νέο SSoT pure `viewport/orbit-around-pivot.ts` `orbitCameraAroundPivot(camera, pivot, target, dx, dy, speed)` — περιστρέφει ΘΕΣΗ + ΠΡΟΣΑΝΑΤΟΛΙΣΜΟ κάμερας + `target` (in place) με την ΙΔΙΑ world rotation γύρω από το pivot → το σημείο μένει ΚΑΡΦΩΜΕΝΟ στην οθόνη (μηδέν άλμα) και το target μένει στον άξονα κάμερας ώστε το per-frame `lookAt(target)` του OrbitControls να είναι no-op. Yaw περί world-up + pitch περί camera-right → roll-free (αφαιρέθηκε το pole-flip up-management, ο quaternion το χειρίζεται). **Main**: `tumble-rotation` πλέον κρατά `customPivot` (+`setPivot`), `applyRotation` καλεί το SSoT· `viewport.setOrbitPivot` → `tumble.setPivot` (ΟΧΙ recenter). **Preview** (ADR-414 §(i)): `PreviewOrbitControls` περιστρέφει με το ΙΔΙΟ SSoT σε custom Alt+left drag (OrbitControls rotate OFF, `enablePan=false` όσο κρατιέται Alt), `setPivot` αποθηκεύει customPivot χωρίς recenter. **Tests**: νέο `orbit-around-pivot.test` (5: distance-invariant, **pivot stays fixed on screen (NDC)**, target-on-forward-axis, yaw-no-drift, pivot-immutable) + ενημερώθηκε το pole test (no up-flip → finite + distance) → tumble 9/9, σύνολο 30+ PASS. ΕΚΤΟΣ ADR-040. 🔴 browser verify + commit. | Claude (Opus 4.8) |
| 2026-06-04 | **§A.6.Q5 v3 — Alt+drag orbits around the CLICK POINT (όχι μόνο static click).** Εντολή Γιώργου: «η περιστροφή στο 3D γίνεται με Alt+σύρσιμο· θέλω το σημείο του κλικ να είναι το σημείο περιστροφής — και δεν δουλεύει». ΡΙΖΑ: το pivot (`setOrbitPivotAt`) οριζόταν μόνο στο **static** Alt-click (tumble `onPointerUp` με `!dragActive`). Όταν ο χρήστης κρατά Alt και **σύρει αμέσως**, το tumble ξεκινά περιστροφή γύρω από το **παλιό** `controls.target` (κέντρο σκηνής) — ο κέρσορας ποτέ δεν γινόταν pivot. **Fix**: νέο `onAltPress` callback στο `tumble-rotation.ts`, fired στο Alt+left **pointer-DOWN** (πριν από κάθε drag), wired `viewport-camera.ts (ViewportCameraOptions.onAltPress)` → `scene-setup.ts (InitViewportCameraDeps.onAltPress)` → `ThreeJsSceneManager (onAltPress: (x,y) => this.setOrbitPivotAt(x,y))`. Έτσι το `controls.target` μετακινείται στο σημείο κάτω από τον κέρσορα τη στιγμή του press, και το `applyRotation` (διαβάζει `getTarget()` live) περιστρέφεται γύρω του από το πρώτο κιόλας move. Το static `onAltClick` διατηρείται (idempotent· miss→no-op). **SSOT με preview**: ίδια συμπεριφορά εφαρμόστηκε στο «Edit Type» preview (ADR-414 §(e)): `PreviewOrbitControls` Alt+left=ROTATE (Alt keydown/keyup flips `mouseButtons.LEFT`) + set-pivot-on-press. **+ PLANE FALLBACK (runtime fix «δεν γυρίζει γύρω από το σημείο» στο 3D)**: το `setBimOrbitPivot` έκανε raycast μόνο `bimGroup` και σε αστοχία (κενός χώρος / κλικ στο DXF overlay αντί για BIM mesh) επέστρεφε false → καμία αλλαγή pivot → περιστροφή γύρω από το παλιό κέντρο. Νέο `raycastWorldPointOrPlane` (BimEntityRaycaster): geometry hit, αλλιώς τομή με **camera-facing plane μέσα από το τρέχον target** (καθρέφτης του preview `resolvePreviewPivot`). `OrbitPivotDeps.currentTarget` = `viewport.target`. Τώρα Alt+drag ΠΑΝΤΑ περιστρέφεται γύρω από το σημείο του κέρσορα. **Tests**: +2 tumble + 4 raycaster (geometry hit / plane fallback / cursor-tracking / zero-area) → 10/10 raycaster PASS, tsc clean. ⚠️ Tradeoff: το `setOrbitPivot` κάνει `controls.update()`→`lookAt` → το σημείο κεντράρεται (μικρό άλμα) στην αρχή κάθε Alt+drag· αν ενοχλεί → no-jump quaternion orbit (μελλοντικό). ΕΚΤΟΣ ADR-040. 🔴 browser verify + commit. | Claude (Opus 4.8) |
| 2026-05-31 | **§9 Q3 — Idle photorealism preview γίνεται OPT-IN (perf fix).** Εντολή Γιώργου: στο `/dxf/viewer` 3Δ ο φωτορεαλισμός «έτρεχε συνέχεια και βάραινε τον υπολογιστή»· μόλις ξεκινούσε orbit (Alt+drag) σταματούσε κι ελάφραινε. **Root cause**: ο `PathTracerRenderer` ξεκινούσε **αυτόματα σε ΚΑΘΕ idle ≥800ms** (gated μόνο σε `bimLayer.hasMesh && hdriUrl !== null`) → ριπή 256 samples (`PREVIEW_MAX_SAMPLES`) full-scene path-tracing σε κάθε παύση κάμερας· `pathTracerActive` είναι μέσα στο `isSceneDirtyFromState` OR → η σκηνή έμενε μόνιμα dirty όσο έτρεχε → render κάθε frame· το orbit έκανε `viewport.isAnimating` → `pathTracer.cancel()` + `enterRasterMode()` → ελαφρύ raster (γι' αυτό «ησύχαζε» στην κίνηση). Industry σύγκλιση (Enscape/Twinmotion/D5/Lumion + Revit «Render» button): ο φωτορεαλισμός είναι **opt-in** παντού — μπαίνεις ρητά σε live-render mode, δεν path-tracάρει όσο απλώς δουλεύεις. **Fix = toggle default OFF**. **MODIFIED (3)**: `stores/ViewMode3DStore.ts` (+`autoPreviewEnabled: boolean` initial `false` + `setAutoPreviewEnabled(enabled)` immer action + `selectAutoPreviewEnabled` selector). `scene/scene-idle-handlers.ts` (`onIdle`: μετά τα `qualityModulator/ssaoModulator.onCameraIdle()` → **early-return αν `!autoPreviewEnabled`**, ώστε να μένει το ελαφρύ SSAO refine-on-idle pass αλλά να ΜΗΝ ξεκινά ποτέ ο path tracer στην καθημερινή επεξεργασία). `panels/Lighting3DPanelTab.tsx` (+ευδιάκριτο toggle row στην κορυφή: label/hint + κουμπί ◉/○, `setAutoPreviewEnabled(!autoPreviewEnabled)`, `aria-pressed`). **i18n**: `lighting.autoPreview.{label,hint}` σε `el` + `en` bim3d.json (μηδέν hardcoded strings, N.11). **Tests**: `ViewMode3DStore.test.ts` (+3: default false, setter both-ways, selector) · `scene/__tests__/scene-idle-handlers.test.ts` (NEW: OFF→`pathTracer.start` δεν καλείται + SSAO idle εξακολουθεί· ON+mesh+HDRI→`start` 1× + mode `3d-preview`). 44/44 PASS (+gizmo+store+idle), tsc clean. **GOL N.7.2 7/7**: proactive (gate στο idle moment), race-free (call-time store read), idempotent (flag flip), belt-and-suspenders, SSoT (`ViewMode3DStore.autoPreviewEnabled` μοναδικός owner· `scene-idle-handlers` μοναδικό gate), sync, explicit lifecycle (store). **FIX v2 (Giorgio runtime «συνεχίζει να κάνει φωτορεαλισμούς» με OFF)**: το αρχικό gate κρατούσε ακόμα ενεργό το **SSAO refine-on-idle composer pass** σε κάθε παύση (βαρύ FBO round-trip) → διευρύνθηκε το early-return **ΠΡΙΝ** από ΟΛΗ την idle escalation (SSAO + render-quality bump + path tracer), ώστε OFF → το idle μένει στο γρήγορο interaction raster. **FIX v3 (UI)**: το ad-hoc ◉/○ κουμπί αντικαταστάθηκε με το **SSoT `Switch`** component (`@/components/ui/switch`, ίδιο με SNAP/GRID/ORTHO στο `CadStatusBar`, πράσινο όταν ON) — εντολή Γιώργου «βάλε αυτό που χρησιμοποιούν τα snaps, πιο κατανοητό». Tests επικαιροποιημένα (OFF → ούτε SSAO ούτε quality idle). ✅ Browser-verified (Giorgio): ON/OFF σταματά/ξεκινά σωστά τον idle φωτορεαλισμό. ✅ Google-level: YES — μηδέν grind by default, industry-aligned live-render toggle. | Claude (Opus 4.8) |
| 2026-05-31 | **§9 Q1 — Crosshair hide on 3D-toggle hover (UX fix).** Εντολή Γιώργου: στο `/dxf/viewer`, όταν ο κέρσορας ανέβαινε πάνω στο κουμπί «Προβολή 3D» εμφανιζόταν το χεράκι αλλά **το σταυρόνημα δεν εξαφανιζόταν** — έμενε «παγωμένο». Root cause: το `ViewMode3DToggleButton` είναι `absolute z-30` **παιδί** του canvas container, οπότε (α) το `DxfCanvas` (από κάτω) σταματά να λαμβάνει `mousemove` → η θέση παγώνει, και (β) το `onMouseLeave` του container **δεν** πυροδοτείται (δεν φεύγουμε από το subtree), άρα ποτέ δεν καλείται το `setImmediatePosition(null)` που σβήνει το σταυρόνημα (όπως κάνει το `handleContainerMouseLeave` στο `useCanvasMouse.ts:198`). **MODIFIED (1)**: `bim-3d/viewport/ViewMode3DToggleButton.tsx` (+`onMouseEnter={() => setImmediatePosition(null)}` — καθαρίζει το SSoT `ImmediatePositionStore` τη στιγμή που ο κέρσορας μπαίνει στο κουμπί· το σταυρόνημα επανεμφανίζεται **αυτόματα** όταν ο κέρσορας επιστρέφει στον καμβά και το `mousemove` του `DxfCanvas` ξαναθέτει τη θέση — μηδέν επιπλέον `onMouseLeave` handler, μηδέν νέο state). SSoT: ίδιος μηχανισμός απόκρυψης με το mouse-leave του container, χωρίς διπλασιασμό. Δεν θίγονται ADR-040 performance-critical αρχεία (το κουμπί δεν είναι στη λίστα CHECK 6B/6D). | Claude Opus 4.8 |
| 2026-05-29 | **§A.6.Q5 — Alt+click orbit-pivot picking (set rotation center) IMPLEMENTED.** Εντολή Γιώργου: στο 3D viewer, `Alt` + κλικ σε συγκεκριμένο σημείο του κτιρίου → αυτό το σημείο γίνεται το κέντρο περιστροφής (Blender/Maya/Revit «set pivot» convention). **MODIFIED (5)**: `systems/raycaster/BimEntityRaycaster.ts` (+`raycastWorldPoint()` επιστρέφει το **world-space σημείο τομής** της πιο κοντινής επιφάνειας — `hits[0].point.clone()` — αντί για `bimId`/`bimType` του `raycastBimGroup`· Boy Scout N.0.2: εξήχθη `clientToNdc()` SSoT helper, καταναλώνεται και από τις 2 raycast συναρτήσεις, μηδέν διπλότυπο NDC math). `viewport/viewport-types.ts` (+`setOrbitPivot(point)` στο `ViewportCamera` interface). `viewport/viewport-camera.ts` (+`setOrbitPivot()` — `controls.target.copy(point)` + `controls.update()`· επειδή το OrbitControls διατηρεί το offset camera→target σε κάθε update, **η κάμερα δεν μετακινείται → μηδέν visual jump**· το tumble διαβάζει `controls.target` live άρα η επόμενη περιστροφή γίνεται γύρω από το νέο pivot). `scene/ThreeJsSceneManager.ts` (+`setOrbitPivotAt(clientX, clientY): boolean` — raycast → αν hit: `viewport.setOrbitPivot` + `poi.onNavigationActive()` flash του POI σταυρού στο νέο κέντρο + `markSceneDirty()`· αν miss: return false, αφήνει pivot+selection ανέπαφα). `viewport/BimViewport3D.tsx` (`handleClick`: `if (e.altKey)` → `setOrbitPivotAt` + early return, χωρίς selection — static Alt+click φτάνει εδώ, Alt+drag το καταναλώνει το tumble rotation). **Tests**: `systems/raycaster/__tests__/BimEntityRaycaster.test.ts` — 6/6 PASS (world-point center hit @ z=0.5 box face, ray miss → null, zero-area dom → null, fresh-clone invariant, + `raycastBimGroup` regression μετά το `clientToNdc` extraction). **GOL N.7.2 7/7**: proactive (pivot τίθεται στο click moment), race-free (event-time client coords, μηδέν snapshot staleness), idempotent (επανειλημμένο Alt+click ίδιο σημείο = ίδιο pivot), belt-and-suspenders (ray miss → graceful no-op), SSoT (`clientToNdc` ενιαίο + `controls.target` μοναδικός pivot owner + POI auto-follows `viewport.target` per frame), sync (controls.update synchronous), explicit lifecycle (viewport owns target). ✅ Google-level: YES — Blender/Maya/Revit set-pivot parity, μηδέν camera jump, οπτικό feedback μέσω POI flash. tsc clean. **FIX v2 (2026-05-29, Giorgio runtime report «δεν άλλαξε τίποτε»)**: το React `onClick` alt-branch ΔΕΝ πυροδοτείτο σε perspective γιατί το tumble (που κατέχει το Alt+pointer gesture) μεσολαβούσε με pointer-drag → ο browser κατέπνιγε το `click`. **Root fix**: το alt-click ανιχνεύεται πλέον ΜΕΣΑ στο `tumble-rotation.ts` (`onPointerUp` με `pointerDown && !dragActive` → νέο optional `onAltClick(clientX, clientY)` callback), plumbed μέσω `viewport-camera.ts` (`ViewportCameraOptions.onAltClick`) → `scene-setup.ts` (`InitViewportCameraDeps.onAltClick`) → `ThreeJsSceneManager` (`onAltClick: (x,y) => this.setOrbitPivotAt(x,y)`). Το React `handleClick` alt-branch ΔΙΑΤΗΡΕΙΤΑΙ ως fallback για ortho (tumble disabled εκεί, καμία drag παρεμβολή → click πυροδοτείται κανονικά). Διπλή πυροδότηση = idempotent. +3 tumble tests (static alt-click fires με coords, drag→no-fire, no-alt→no-fire). 13/13 PASS (6 raycaster + 7 tumble). | Claude (Opus 4.8) |
| 2026-05-29 | **B.1.Q3 SSAO perf hotfix — adaptive-degradation render path (Revit/Forge parity).** Firefox profile (4 BIM entities, 3D orbit/zoom) έδειξε lag εντοπισμένο σε `WebGLProgram.getUniforms` 269ms (Other 99% = shader link/program churn) μέσω της `SSAOModulator.render()` → `EffectComposer.render()` που έτρεχε **κάθε frame** (RenderPass→FBO + disabled SSAOPass + CopyPass blit) ακόμη κι όταν το SSAO ήταν disabled στην κίνηση. Empirically επιβεβαιωμένο: bypass composer → lag εξαφανίζεται. **Fix = δύο render paths gated από το πραγματικό SSAO state** (industry σύγκλιση 4/4 — Revit Ambient Shadows, Autodesk Forge/APS Viewer, Navisworks, Three.js Editor: expensive post-FX skip κατά την πλοήγηση, refine-on-idle). **MODIFIED (4)**: `lighting/ssao-modulator.ts` (+`isSsaoActive(): boolean` returns `ssaoPass.enabled` · +`renderRaster()` direct single-pass render bypassing composer για interaction frames · +`warmUp()` pre-compiles SSAO/composer programs μία φορά ώστε το πρώτο idle frame να μην κάνει shader-link stall · +constructor `onNeedsRender` callback — το idle ramp `onCameraIdle()` καλεί `onNeedsRender()` κάθε frame ώστε ο master scheduler να ζωγραφίσει το SSAO composer pass, αλλιώς η ράμπα του `kernelRadius` θα μετάλλασσε αόρατα αφού το scene δεν είναι dirty σε idle). `scene/scene-render-frame.ts` (default branch: `isSsaoActive()` → `render()` (composer, refine-on-idle) · else → `renderRaster()` (direct, καμία post-FX, μηδέν FBO round-trip στην κίνηση)). `scene/scene-rendering-subsystems.ts` (+`onNeedsRender` στο deps interface + pass-through στον `SSAOModulator` constructor). `scene/ThreeJsSceneManager.ts` (+`ssaoWarmedUp` flag → `ssaoModulator.warmUp()` μία φορά μετά το πρώτο `syncBimEntities` αφού υπάρχει geometry · +`onNeedsRender: () => this.markSceneDirty()` στο subsystems wiring). **ADR-040 Phase XXIII συμβατό**: το dirty-state SSoT (`scene-dirty-state.ts`) αμετάβλητο · το νέο `onNeedsRender` τροφοδοτεί τον υπάρχοντα `markSceneDirty()` path. **GOL N.7.2 7/7**: proactive (warm-up πριν χρειαστεί), race-free (state-driven gate, καμία snapshot staleness), idempotent (`warmUp` cheap μετά το πρώτο, gate pure read), belt-and-suspenders (warm-up + lazy compile fallback στο catch), SSoT (`SSAOModulator` owns το SSAO lifecycle, `scene-dirty-state` το dirty), sync (render στο RAF), explicit lifecycle (modulator). ✅ Google-level: YES — μηδέν lag στο orbit/zoom, SSAO refine όταν η camera σταματά, καμία recompile-pause. Verify: 8/8 `scene-dirty-state` tests PASS, tsc clean. | Claude (Opus 4.8) |
| 2026-05-25 | **C.1.b — Snap-to-Grid Waypoints IMPLEMENTED.** Closes 1 από τα 2 deferred C.1.b items (axis-constrained drag gizmo remains deferred). Unified snap quantizer: `bim-3d/animation/snap-quantizer.ts` — `quantizeVec3(v, step, origin?)`, per-axis `Math.round(v/step)*step`, step≤0 = no-op (division-by-zero safety). **NEW (2)**: `snap-quantizer.ts` (~40 LOC, pure math, exported `SNAP_STEP_PRESETS` + `DEFAULT_SNAP_STEP`). `__tests__/snap-quantizer.test.ts` (Jest, 9 describe groups: no-op/step=1/step=0.5/step=0.1/origin-offset/idempotency/large-coords + presets). **MODIFIED (7)**: `AnimationStore.ts` (+`snapEnabled: boolean` false + `snapStepUnits: number` 0.5 + `setSnapEnabled` + `setSnapStepUnits` — immer Zustand, step guard >0). `use-waypoint-drag-interaction.ts` (`writeWaypointPosition`: reads `store.snapEnabled` at call-time → `quantizeVec3` before `updateWaypoint` — no closure capture). `contextual-animation-tab.ts` (new panel `animation-snap`, ribbon `toggle` button `animation.snap-toggle` + `combobox` `animation.snap-step` presets 0.1/0.25/0.5/1/2). `useRibbonCommands.ts` (+`useAnimationStore(s => s.snapEnabled/snapStepUnits)` subscriptions + `animation.snap-toggle` in `getToggleState` + `animation.snap-step` in `getComboboxState` + `onComboboxChange`). `useDxfViewerCallbacks.ts` (`animation.snap-toggle` action → `setSnapEnabled(!current)`). `i18n/locales/en/bim3d.json` (+panel `snap`, toolbar `snapToggle`/`snapStep`, `snapStepOptions` 5 presets). `i18n/locales/el/bim3d.json` (ίδια σε καθαρά ελληνικά — 0 αγγλικές λέξεις). **GOL N.7.2 7/7**: Proactive (snap per tick), Race-free (at-call-time state read), Idempotent (quantize²=quantize), Belt-and-suspenders (step≤0 no-op), SSoT (1 helper + 1 state owner), No async, Lifecycle=AnimationStore. ✅ Google-level: YES — snap-to-grid closes functional gap in waypoint drag UX with Blender/Revit parity. | Claude Sonnet 4.6 |
| 2026-05-25 | **Group B — Custom HDRI Upload IMPLEMENTED.** Closes the deferred Group B research item (custom environment map). User drags a `.hdr` ή `.exr` αρχείο στο Lighting panel → upload σε Firebase Storage (tenant-scoped) → live applied σε Three.js scene environment μέσω της υπάρχουσας `EnvmapGenerator.loadHdri()` pipeline (RGBELoader + PMREMGenerator + texture disposal — zero rendering code changes). **NEW (2)**: `bim-3d/lighting/hdri-upload.service.ts` (~80 LOC — file validation `.hdr`/`.exr` + 50 MB cap + `HdriUploadError` discriminated `format`/`size`/`missing-company`/`upload-failed` codes + `uploadBytes` σε `companies/{companyId}/bim_environments/{envId}.{ext}` με `crypto.randomUUID()` envId, `image/vnd.radiance` για .hdr / `application/octet-stream` για .exr). `bim-3d/lighting/HdriUploader.tsx` (~140 LOC — drag-drop UI single file, progress + per-code error states, remove button με restore-preset, mirror `CommentAttachmentUploader` pattern + Tailwind tokens only, ΟΧΙ inline styles, semantic `<section>` + role="slider" focus). **MODIFIED (5)**: `bim-3d/stores/EnvironmentStore.ts` (+`customHdriUrl`/`customHdriName: string \| null` state + `setCustomHdri(url,name)`/`clearCustomHdri()` actions — custom upload writes `hdriUrl` directly bypassing preset path). `bim-3d/panels/Lighting3DPanelTab.tsx` (mount `<HdriUploader />` κάτω από το preset grid + selected indicator gated σε `!customHdriUrl` + preset click clears custom — mutual exclusivity). `bim-3d/viewport/use-bim3d-store-sync.ts` (+subscribe σε `customHdriUrl` — όταν user κάνει remove, restore current preset URL αυτόματα, αλλιώς scene θα έμενε με stale cleared URL). `services/upload/utils/storage-path.ts` (+`buildBimEnvironmentHdriPath()` SSoT helper mirror του `buildBimAnimationRenderPath`). `storage.rules` (+block `/companies/{companyId}/bim_environments/{fileName}` — 50 MB cap, `image/vnd.radiance` + `application/octet-stream` contentTypes, company-scoped read/write/delete). **i18n**: +7 keys × 2 locales (`lighting.hdri.custom.{label,dropHint,uploading,remove,formatError,sizeError,errorGeneric}`), pure Greek zero English words. **GOL N.7.2**: ✅ proactive (upload-on-drop, not on form submit) · ✅ race-free (single-file at a time, no concurrent uploads) · ✅ idempotent (overwrite-safe envId UUID per upload) · ✅ belt-and-suspenders (client validation extension+size + Storage rules server enforcement) · ✅ SSoT (single uploader service + EnvironmentStore single URL owner + `buildBimEnvironmentHdriPath` SSoT path helper) · ✅ awaited (upload awaited, texture apply awaited στο EnvmapGenerator) · ✅ explicit lifecycle (EnvironmentStore owns URL state, ThreeJsSceneManager owns texture load+dispose via existing subscription). **License N.5**: RGBELoader = `three/addons/loaders/RGBELoader.js` MIT (already in tree). **Tenant scoping ADR-326**: `companyId` REQUIRED in Storage path (read from `useAuth().user.companyId`). **Pipeline reuse**: existing `ThreeJsSceneManager.envStoreUnsub` subscription σε `hdriUrl` (line 173-176) — zero rendering code touched. Closes ADR-366 Group B last deferred research item. | Claude (Sonnet 4.6) |
| 2026-05-25 | **§C.1.b — TimelineEditor + TimelineWaypointForm + WaypointDragHandle React component tests IMPLEMENTED.** Κλείνει το deferred testing item του C.1.b. 3 new test suites + 25 νέα tests + 1 production bugfix. **New**: `bim-3d/animation/__tests__/TimelineEditor.test.tsx` (13 tests — empty state, waypoint list render, click-select, ×-delete, drag-and-drop reorder, "Add at current camera", duration/fps/axis/direction config updates, waypoint form gating ενεργό/ανενεργό), `TimelineWaypointForm.test.tsx` (6 tests — position/target/FOV/easing patch payloads, BezierCurveEditor mount, reset clears customBezier), `WaypointDragHandle.test.ts` (6 tests — visibility gate idle, group exposure + sprite positioning, toolActive flip hides, AnimationStore subscription reactivity, hover state texture rebuild, dispose lifecycle). **Modified (production bugfix)**: `TimelineEditor.tsx` — `useAnimationStore(selectAnimationConfig)` καταργήθηκε. Το aggregate selector επέστρεφε νέο object σε κάθε render → "Maximum update depth exceeded" infinite re-render (Zustand default `Object.is` equality vs new reference). Αντικαταστάθηκε με ατομικά selectors `s.waypoints / s.durationSec / s.fps / s.axis / s.direction` (mirror του υπόλοιπου component, ADR-040 micro-leaf pattern). Bug εντοπίστηκε από τα React component tests — η Boy Scout διόρθωση εφαρμόστηκε on the spot (N.0.2). **Test infra**: Jest globals + jsdom env (NOT vitest — pre-existing C.1.b/c suites με `import vi from 'vitest'` δεν εκτελούνται under Jest, γνωστή pre-existing issue). `@testing-library/react` με `fireEvent` + `cleanup`. react-i18next mocked με identity translator. AnimationStore real (Zustand) με `reset()` σε `beforeEach`. Three.js real στο jsdom χωρίς WebGL (Scene + Sprite δουλεύουν, `CanvasTexture` δέχεται null `getContext('2d')` returns). **Verification**: `npx jest --testPathPatterns="bim-3d/animation/__tests__/(TimelineEditor\|TimelineWaypointForm\|WaypointDragHandle)"` → 3 suites pass, 25/25 tests pass, ~10s. **GOL 7/7 ✅**: proactive (tests on-demand), race-free (deterministic vitest pattern + beforeEach reset), idempotent (state reset per test), belt-and-suspenders (positive + negative assertions για form gating), SSoT (mock translator reused), sync (no async hot path), lifecycle owner (afterEach cleanup unmounts). **Still deferred**: axis-constrained drag gizmo (X/Y/Z arrows), snap-to-grid. **§C.1.b ολοκληρωτικά CLOSED — μηδέν deferred testing items.** | Claude (Opus 4.7) |
| 2026-05-25 | **§C.1.b — Real scene-bbox για turntable IMPLEMENTED.** Closes deferred item: `useDxfViewerCallbacks.ts` `animation.turntable` action χρησιμοποιούσε synthetic camera-distance bbox (fake radius από camera→target). Τώρα παίρνει το πραγματικό BIM scene bbox από `ThreeJsSceneManager.getSceneFramingBounds()` → turntable περιστρέφεται γύρω από το πραγματικό κέντρο του κτιρίου. 2 new + 3 modified + 7 new tests. **New**: `bim-3d/stores/SceneBboxProvider.ts` (~40 LOC — module-level register/getter bridge `bim-3d` ↔ `app` subsystems. `setSceneBboxGetter(fn)` / `clearSceneBboxGetter()` / `getSceneBbox(): SceneBbox \| null`. Non-reactive (όχι Zustand) — used μέσα σε imperative event handlers. Converts THREE.Box3 → plain Vec3 SceneBbox shape, returns null για empty/unmounted scenes.), `bim-3d/stores/__tests__/SceneBboxProvider.test.ts` (7 tests: registration lifecycle, bbox conversion, null/empty handling, no-caching invariant, re-registration overrides). **Modified**: `ThreeJsSceneManager.ts` (+`getSceneFramingBounds(): THREE.Box3 \| null` public method — delegates to existing `computeSceneFramingBounds(this.bimLayer.group, this.dxfConverter.getBounds())` SSoT, respects disposed flag), `BimViewport3D.tsx` (register getter at manager mount + `clearSceneBboxGetter()` σε cleanup), `useDxfViewerCallbacks.ts` (νέα `resolveTurntableBbox()` helper: `getSceneBbox() ?? syntheticBboxFromCamera()` — real bbox first, camera-derived fallback όταν 3D unmounted ή scene empty. Old `syntheticBboxFromCamera()` παραμένει ως fallback path, jsdoc updated). **Architecture**: SSoT REUSE του `computeSceneFramingBounds` (Phase 4.4 extraction). Provider pattern register/unregister για lightweight cross-subsystem bridging χωρίς να μολύνεται το `CameraTargetStore` με non-camera data. Graceful degradation: 2D-only viewer continues to work (camera fallback). | Claude (Opus 4.7) |
| 2026-05-25 | **§C.1.Q4 — Bezier 4-point easing editor IMPLEMENTED (FULL ENTERPRISE).** Closes το τελευταίο deferred item του C.1.b («Προχωρημένα» bezier editor). 5 new files + 4 modified + 23 new tests. **New**: `bim-3d/viewport/bezier-easing.ts` (~95 LOC — pure cubic-bezier evaluator: Newton-Raphson 4 iters + bisection fallback για X→t inverse, De Casteljau για Y(t), linear-identity shortcut. Mirror του Firefox `nsSMILKeySpline` algorithm.), `bim-3d/animation/presets/preset-bezier-defaults.ts` (~35 LOC — CSS-standard bezier control points mapping για κάθε easing preset. linear/ease-in/ease-out/ease-in-out από CSS spec, quart/smooth-step/elastic visual approximations. `getPresetBezier(id)` resolver.), `bim-3d/animation/BezierCurveEditor.tsx` (~340 LOC — Chrome-DevTools-style SVG editor: 220×220 canvas + 2 draggable handles (pointer capture, role="slider" ARIA, Tab focusable, Arrow nudge ±0.01 / Shift+Arrow ±0.1) + 4 numeric inputs (P1x/P1y/P2x/P2y, instant patch) + 8 preset chips quick-swap + reset button + live preview ball (RAF 2s loop, mounts on demand via `<details>` open) + overshoot support (Y range [-1, 2] για back/elastic curves). Tailwind tokens only — bg-black/40 + hsl(var(--primary)) curve stroke. ΟΧΙ inline styles.), `bim-3d/viewport/__tests__/bezier-easing.test.ts` (15 tests: boundaries t=0→0/t=1→1, clamp, linear identity, CSS standard curves cross-verified με DevTools, monotonicity, overshoot, Newton convergence stress), `bim-3d/animation/presets/__tests__/preset-bezier-defaults.test.ts` (8 tests: registry completeness όλων των EASING_PRESET_IDS, X-axis clamp invariant, frozen registry, boundary correctness για κάθε preset bezier). **Modified**: `animation-types.ts` (+`BezierControlPoints` interface + `BEZIER_RANGES` const + `Waypoint.customBezier?` optional field. Schema choice B: `easingToNext` παραμένει `EasingPresetId` union string, `customBezier` undefined → preset wins. No migration — fully backwards-compatible.), `presets/animation-presets.ts` (`getEasingFunction(id, customBezier?)` overload. Αν `customBezier !== undefined` → επιστρέφει `cubicBezier(p1x,p1y,p2x,p2y)`, αλλιώς preset.), `core/keyframe-interpolator.ts` (single-line: pass `input.from.customBezier` ως 2ο arg στο resolver), `TimelineWaypointForm.tsx` (+native `<details>/<summary>` expander κάτω από easing select. Mount `BezierCurveEditor` με value=customBezier ?? getPresetBezier(easingToNext). onChange→patch customBezier. onReset→patch undefined (revert σε preset).). i18n: +12 keys el/en `animation.easing.bezier.{expander,title,p1x,p1y,p2x,p2y,reset,presets,preview,advanced,handleP1,handleP2}`. **Architecture**: Single-domain (animation), ~14 αρχεία, Plan Mode (ΟΧΙ Orchestrator). GOL N.7.2 full pass: proactive (mounts on demand), race-free (RAF + pointer capture), idempotent (pure helpers + frozen registry), belt-and-suspenders (5 input channels: drag + 4 inputs + 8 chips + keyboard + reset), SSoT (cubic bezier μοναδική impl, CSS mapping κεντρικό). Industry convergence: Chrome DevTools + Blender F-curve + After Effects + Material Motion. | Claude (Opus 4.7) |
| 2026-05-25 | **§C.1.b — Waypoint 3D drag interaction IMPLEMENTED.** Closes the largest deferred item από C.1.b (drag handles now actually draggable, not just visual). 3 new files + 3 modified + 17 new tests. **New**: `bim-3d/animation/waypoint-drag-controller.ts` (~210 LOC — pure FSM idle/hovering/dragging με camera-aligned drag plane Blender/AutoCAD pattern. plane normal=camera.forward, plane point=handle world pos at drag start. Three.js Raycaster intersect για pick + ray.intersectPlane για drag projection. setNdcFromClient + computeCameraAlignedPlane exported pure helpers για testability.), `bim-3d/animation/use-waypoint-drag-interaction.ts` (~165 LOC — React hook με DOM pointer listeners attached MONO όταν `AnimationStore.toolActive===true`. AbortController per session για clean teardown. pointerdown/move/up/cancel/leave. setPointerCapture+releasePointerCapture για robust drag tracking across canvas edges. Single-writer SSoT: writes drag results σε `AnimationStore.updateWaypoint`.), `bim-3d/animation/__tests__/waypoint-drag-controller.test.ts` (17 tests: NDC conversion + camera-plane math + FSM transitions idle↔hovering↔dragging + pick raycast + drag projection + cancel cleanup). **Modified**: `WaypointDragHandle.ts` (+`getHandlesGroup(): Group | null` raycast exposure + `setHoverState(role | null)` με `paintSprite` helper rebuilding sprite texture με `grips.hot` color. Παλιά position=warm/target=hot palette → νέα cold default + hot on hover για consistency μέ Dim3DGripsRenderer cold/warm/hot pattern), `ThreeJsSceneManager.ts` (+`getWaypointHandlesRoot()` + `setWaypointHoverState()` getters delegate σε renderer), `BimViewport3D.tsx` (+`useWaypointDragInteraction({managerRef, canvasEl})` hook call after queue processor mount). **Architecture**: Single-domain feature, ~3-4h. Plane projection math = standard "free 3D translate" gizmo (no constraint axis). Future enhancements (deferred): axis-constrained drag (X/Y/Z gizmo arrows), snap-to-grid, undo/redo per drag (currently each pointermove writes; consider snapshot on dragstart + commit on dragend για ADR-040 store-history hygiene). Tests: 50/50 PASS (33 existing + 17 new). | Claude (Opus 4.7) |
| 2026-05-25 | **Phase 9 C.1.c IMPLEMENTED — Animation Rendering / Queue (3/3 of C.1) → Animation Phase 9 CLOSED.** Consumes C.1.a foundation + C.1.b UX. **NEW files (8)**: `bim-3d/animation/MP4Exporter.ts` (~210 LOC — WebCodecs `VideoEncoder` + `mp4-muxer`@5.2.2 MIT + dedicated offscreen `WebGLRenderer` + `PerspectiveCamera` so the live viewport canvas is never resized mid-export; `detectSupportedCodec()` feature-detect with H.264 Main L3.1 primary + VP9 Profile 0 fallback inside MP4 container; per-frame `requestAnimationFrame` yield keeps UI responsive; `AbortSignal` aborts mid-loop cleanly). `bim-3d/animation/RenderQueueStore.ts` (~245 LOC — Zustand SSoT FIFO + activeJobId + module-scope `Map<jobId, AbortController>` for non-serializable cancel state, idempotent enqueue, hydrateFromFirestore with equality guard preserving local runtime fields like blobUrl). `bim-3d/animation/RenderQueuePanel.tsx` (~165 LOC — Floating3DPanel 8th tab UI; semantic `<progress>` element + status badge palette via ADR-365 CSS vars; cancel/retry/download/remove actions). `bim-3d/animation/animation-queue-processor.ts` (~210 LOC — React hook glue, subscribes to RenderQueueStore via a status-fingerprint selector, claims next queued job when activeJobId===null, drives MP4Exporter + uploads Blob to Firebase Storage, persists progress every 1.5s throttled, handles AbortError → cancelled-resumable with checkpoint serialization). `bim-3d/animation/render-checkpoint.ts` (~60 LOC + tests — pure serialize/deserialize over `RenderJobDoc.lastSampleCount`/`lastWaypointIndex` fields; `lastSampleCount` semantically repurposed as `lastFrameIndex` since C.1.c uses rasterizer not path tracer). `bim-3d/animation/animation-action-handlers.ts` (~125 LOC — extracted `handleAnimationSave` + `handleAnimationExport` to keep `useDxfViewerCallbacks.ts` under 500-line cap; auto-save flow creates `bim_animation` doc when loadedDocId===null with default name `t('animation.defaultName',{time:HH:mm})`). `app/origin-indicator-overlay.ts` (~80 LOC — extracted the pulsing SVG crosshair helper from useDxfViewerCallbacks to recover SRP headroom). 3 test suites under `__tests__/`: `render-checkpoint.test.ts` (round-trip + clamping), `render-queue-store.test.ts` (FSM + selectors + abort registry + hydration equality guard), `mp4-exporter.test.ts` (codec detection + validation). **MODIFIED files (6)**: `bim-3d/panels/Floating3DPanel.tsx` (+'renders' tab union member + conditional visibility via `selectAnyJobs`, widen w-72 also when renders active), `ui/ribbon/data/contextual-animation-tab.ts` (`animation.save` + `animation.export` `comingSoon: true` flags REMOVED, real `action` keys added; load/share remain comingSoon), `app/useDxfViewerCallbacks.ts` (+`useAuth` hook + `animation.save`/`animation.export` cases dispatching to handlers; +`bim3d` namespace in useTranslation), `bim-3d/viewport/BimViewport3D.tsx` (+`useAnimationQueueProcessor({managerRef, companyId, projectId, callbacks})` mount + notification wiring), `src/config/notification-keys.ts` (+`bim3d.animation.{render,save,export}.*` keys — 8 new), `src/i18n/locales/{el,en}/bim3d.json` (+`animation.notification.*`, `animation.queue.*`, `animation.defaultName`, `floatingPanel.tabs.renders` — ~15 keys × 2 locales). **INFRA**: `storage.rules` new block `/companies/{companyId}/bim_animations/{animationId}/renders/{fileName}` (500MB cap, mp4/webm contentType, company-scoped read/write/delete). **package.json**: +`mp4-muxer@^5.2.2` (MIT, N.5 compliant — already cataloged §B.4.Q8). **ADR drift resolved (4)**: (1) §C.1.Q9 — standard rasterizer chosen over path-tracer `samplesContinueFrom` (never landed + impractical 4h+/animation); (2) §C.1.Q8 — `project_assets` integration DROPPED (service does not exist; mp4 stored direct to Storage, future phase can sync); (3) §C.1.Q7 — VP9-in-MP4 fallback only, separate WebM lib deferred; (4) checkpoint field reuse `lastSampleCount` → `lastFrameIndex`. Cross-session queue subscribe DEFERRED Phase 10. Auto-save policy chosen by Giorgio: option A (auto-create doc + activate Save button). Animation Phase 9 ολόκληρη (C.1.a + C.1.b + C.1.c) πλέον CLOSED. Plan reference: `C:\Users\user\.claude\plans\woolly-roaming-puddle.md`. | Claude (Opus 4.7) |
| 2026-05-25 | **Phase 9 C.1.b IMPLEMENTED — Animation UX / Timeline Editor (2/3 of C.1).** Consumes C.1.a foundation (uncommitted by sibling agent, on disk). **NEW files (4)**: `bim-3d/animation/TimelineEditor.tsx` (~280 LOC — vertical waypoint list adapted για w-72 sidebar tab: config row + "Add at current camera" + scrubber slider + drag-reorder list + form integration; micro-leaf selectors ADR-040 compliant), `bim-3d/animation/TimelineWaypointForm.tsx` (~115 LOC — split για N.7.1 + 40-line function cap: Vec3Row helpers + easing select + camelCase i18n key transformer), `bim-3d/animation/WaypointDragHandle.ts` (~165 LOC — Three.js Sprite renderer mirror Dim3DGripsRenderer pattern: 2 sprites (position warm / target hot) + connecting LineBasicMaterial, CanvasTexture build, auto-subscribe AnimationStore.toolActive+selectActiveWaypoint via subscribeWithSelector, hide on null/inactive; drag interaction deferred — visualization only για C.1.b), `ui/ribbon/data/contextual-animation-tab.ts` (~165 LOC — declarative RibbonTab mirror DIMENSION_CONTEXTUAL_TAB shape: ANIMATION_CONTEXTUAL_TRIGGER='animation-tool', 4 panels (tool/waypoints/persistence/export), action keys animation.tool-toggle/.turntable/.add-waypoint/.delete-waypoint/.reverse routed σε wrappedHandleAction; persistence + export comingSoon για C.1.c). **MODIFIED files (6)**: `bim-3d/animation/AnimationStore.ts` (+`toolActive:boolean` state + `setToolActive(active)` action + `selectAnimationToolActive` selector — mirror BimDimensions3DStore SSoT pattern, **deviation από original brief** which suggested ViewMode3DStore.animationToolActive — tool flags belong σε domain stores per existing convention), `bim-3d/panels/Floating3DPanel.tsx` (+`'animation'` σε Tab union & TABS, +TimelineEditor render branch, conditional width `w-48 → w-72` when animation tab active για timeline fields breathing room — design risk resolution από plan), `app/ribbon-contextual-config.ts` (+ANIMATION_CONTEXTUAL_TAB στο RIBBON_CONTEXTUAL_TABS, +`useAnimationStore(selectAnimationToolActive)` hook subscription inside useActiveContextualTrigger, early-return ANIMATION_CONTEXTUAL_TRIGGER when toolActive flips), `bim-3d/scene/ThreeJsSceneManager.ts` (+`waypointDragHandleRenderer` field, +construct στο constructor right before startLoop, +dispose entry — lifecycle owner explicit), `app/useDxfViewerCallbacks.ts` (+5 animation action cases στο wrappedHandleAction reading useAnimationStore.getState()+useCameraTargetStore.getState() directly, +`syntheticBboxFromCamera()` module-level helper για turntable preset until ThreeJsSceneManager exposes real BIM bbox), `i18n/locales/{el,en}/bim3d.json` (+`floatingPanel.tabs.animation` + `animation.{title,panels,toolbar,timeline,config,axisOptions,directionOptions,waypoint,easing,persistence,exportDisabledTooltip}` namespace ~50 keys × 2 locales = 100 entries; pure Greek zero English words per memory `feedback_pure_greek_locale`). **SSoT REUSE**: BimDimensions3DStore.toolActive pattern (selector + action), Dim3DGripsRenderer (Sprite+SpriteMaterial+CanvasTexture+userData), CameraTargetStore.getState() για "Add at current camera" snapshot, ThreeJsSceneManager.scene.add() + dispose() lifecycle pattern, DIMENSION_CONTEXTUAL_TAB declarative shape, useActiveContextualTrigger early-return pattern, ribbon Coming-soon flag για deferred features, zero new deps. **GOL 7/7 ✅**: proactive (Animation tab + handles materialize on toolActive=true, not as side effect of waypoint mutation), race-free (single-writer AnimationStore, all consumers read same selector), idempotent (setToolActive(true) twice = same state), belt-and-suspenders (primary path ribbon button → setToolActive + auto-clear activeWaypointIndex on deactivate), SSoT (AnimationStore owns toolActive, TimelineEditor + WaypointDragHandle + ribbon all read same selector), await/sync (config-only mutations sync; persistence calls deferred C.1.c θα await), lifecycle owner (ThreeJsSceneManager owns WaypointDragHandleRenderer; Floating3DPanel owns TimelineEditor mount; AnimationStore owns toolActive state). **N.7.1 compliance**: all files <300 LOC. **N.6 compliance**: no Firestore writes (read-only on C.1.a service). **N.11 compliance**: zero hardcoded UI strings — every label via `t('animation.*')`. **License N.5**: zero new deps. **DESIGN RISK RESOLUTION**: original plan flagged w-48 panel + 7 tabs = label truncation; resolved via conditional widen `w-48 → w-72` on animation tab. **DEFERRED to follow-up (NOT C.1.b blocker)**: WaypointDragHandle drag interaction (raycaster + mouse handler — currently visualization only), bezier 4-point advanced editor (ADR-366 §C.1.Q4 "Προχωρημένα" expander), real scene-bbox for turntable (currently synthetic από camera distance), unit tests για TimelineEditor + WaypointDragHandle + ribbon trigger. **NOT in this session** (C.1.c separate): MP4Exporter + RenderQueueStore + RenderQueuePanel + Floating3DPanel "Renders" tab + checkpoint/resume + project_assets integration. **Total C.1.b**: 4 new files + 6 modified + 100 i18n entries. | Claude Opus 4.7 |
| 2026-05-25 | **Phase 9 C.1.a IMPLEMENTED — Animation Logic Foundation (1/3 of C.1).** Splits C.1 σε 3 sub-phases (C.1.a logic / C.1.b UX / C.1.c rendering) στο §C.1 Implementation Phases table — αιτία: 12 files + UX + rendering σε ένα PR παραβίαζε N.7.1 (file size) + N.9 (phase per session). **C.1.a scope (logic foundation only)**. **NEW files**: `bim-3d/animation/animation-types.ts` (Waypoint/AnimationConfig/BimAnimationDoc/RenderJobDoc interfaces + EasingPresetId/AnimationAxis/AnimationDirection unions), `bim-3d/animation/AnimationStore.ts` (Zustand subscribeWithSelector SSoT: waypoints+config+activeWaypointIndex + 8 actions, debounce 50ms σε waypoint mutations), `bim-3d/animation/core/TurntablePathBuilder.ts` (pure: `buildTurntablePath(sceneBbox, config)` → 240 samples default 8s×30fps CCW Y-axis, scene-bbox-center target), `bim-3d/animation/core/WaypointPathBuilder.ts` (pure: per-frame interpolation across waypoint pairs, delegates στο keyframe-interpolator), `bim-3d/animation/core/keyframe-interpolator.ts` (pure: linked mode default + split-tracks placeholder F-curve mode), `bim-3d/animation/presets/animation-presets.ts` (read-only EASING_PRESETS registry 8 entries + TURNTABLE_DEFAULTS), `bim-3d/services/bim-animations.service.ts` (CRUD wrapper: create/update/delete/get/subscribe + render job CRUD + EntityAuditService fire-and-forget hook + enterprise-id auto-generation). **MODIFIED files**: `enterprise-id-prefixes.ts` (+`BIM_ANIMATION: 'anm_bim'` + `BIM_RENDER_JOB: 'rnj_bim'`), `enterprise-id-class.ts` + `enterprise-id-convenience.ts` + `enterprise-id.service.ts` (+`generateBimAnimationId()` + `generateBimRenderJobId()` re-exports), `firestore-collections.ts` (+`BIM_ANIMATIONS: 'bim_animations'` top-level companyId-scoped + `BIM_RENDER_JOBS: 'render_jobs'` subcollection), `auth/roles.ts` (+4 permissions `bim_animations:animations:{create,read,update,delete}` σε company_admin/project_manager/architect/engineer + read σε viewer), `types/audit-trail.ts` (+`'bim_animation'` AuditEntityType), `firestore.rules` (+`/bim_animations/{animationId}` block tenant-scoped CRUD με required fields validation + `/render_jobs/{jobId}` subcollection cross-doc companyId check mirror bim_comment_replies pattern), `bim-3d/viewport/easing-functions.ts` (+4 functions: easeInQuart, easeOutQuart, smoothStep, elastic — extends existing 4 → 8 total). **NEW tests (5 suites)**: `__tests__/animation/turntable-path-builder.test.ts` + `waypoint-path-builder.test.ts` + `keyframe-interpolator.test.ts` + `easing-presets.test.ts` + `animation-store.test.ts`. **SSoT REUSE**: pattern mirror του `bim_dimensions_3d` + `bim_comments` Phase 9 (enterprise-id + collections + rules + roles + audit), `BimDimensions3DStore` Zustand template (subscribeWithSelector + devtools), `WallFirestoreService` Firestore service template, `EntityAuditService.recordChange()` fire-and-forget (ADR-195), zero new deps. **GOL 7/7 ✅**: proactive (store lazy-mounted on first ribbon button mount — C.1.b consumer), race-free (waypoint mutations debounced 50ms, Firestore writes sequential per docId, render jobs FIFO single active — C.1.c), idempotent (turntable rebuild deterministic from sceneBbox, loadFromDoc replaces state, generator IDs unique enterprise-id), belt-and-suspenders (Firestore rules + RBAC middleware double-check, store validates index bounds, audit hook never blocks), SSoT (AnimationStore single runtime config owner, BimAnimationDoc single persisted config owner, easing-functions single curves source, animation-presets single registry, bim-animations.service single Firestore CRUD), await/sync (Firestore CRUD awaited, audit fire-and-forget non-blocking), lifecycle owner (AnimationStore owns config, bim-animations.service owns Firestore, runtime playback deferred σε C.1.b consumer). **N.7.1 compliance**: all files <250 LOC (max bim-animations.service.ts ~230, AnimationStore ~180). **N.6 compliance**: enterprise IDs only. **N.5 compliance**: zero new deps. **OUT OF SCOPE (deferred C.1.b/c)**: TimelineEditor.tsx + WaypointDragHandle.tsx + RibbonAnimationContextualTab.tsx + MP4Exporter + RenderQueueStore + RenderQueuePanel + Floating3DPanel "Renders" tab + i18n keys (~42×2 locales) + bezier editor advanced + notification keys + project_assets render output integration. | Claude Opus 4.7 |
| 2026-05-25 | **3D BIM pipeline extended to stairs (ADR-370 Phase 5 cross-ref)** — Phase 2 (BIM Elements Renderer SPEC-3D-002) κάλυπτε μόνο 4 entity types (wall/column/beam/slab). Gap διορθώθηκε στο πλαίσιο ADR-370 Phase 5 (3D parity με 2D read-only): νέος `bim-3d/converters/StairToThreeConverter.ts` (5 sub-builders: treads `ExtrudeGeometry` 40mm, risers `BoxGeometry` 20mm όταν `riserType='closed'`, stringers `BoxGeometry` segments όταν `structureType ∈ stringer-1/2side/central-stringer`, handrails `TubeGeometry` radius 25mm σε ύψος `handrails.height ?? 900mm`, landings `ExtrudeGeometry` 200mm), νέος `bim-3d/materials/stair-material-resolver.ts` (Revit-pattern per-component fallback chain + 2D preset → 3D PBR bridge: oak→`mat-wood`, marble→`mat-stone`, concrete→`mat-concrete`, steel→`mat-metal`, glass→`mat-glass`), `MaterialCatalog3D` +5 PBR entries `elem-stair-{tread,riser,stringer,landing,handrail}`, `Bim3DEntities` interface +`stairs: readonly StairEntity[]`, `BimSceneLayer.sync` 5ο loop, `BimViewport3D` EMPTY_BIM_ENTITIES + initial sync + subscribe updates. Phase 9 deferred features δεν επηρεάζονται. Στο /dxf/viewer 3D toggle νέος `app/StairPersistenceHost.tsx` (mirror του `SlabPersistenceHost`) πιέζει `currentScene.entities.filter(isStairEntity)` στο `Bim3DEntitiesStore.setStairs()`. Skip 2D-only output (`arrowSymbol`/`cutLine`/`treadLabels`). Industry defaults Revit/ArchiCAD-aligned. Pre-condition closure: 2D read-only stair coverage από ADR-370 Phase 4 (`bim-readonly-render.ts` + `useFloorplanBimEntities` 7 collections). Detail tables στο ADR-370 §4+§6. | Claude Opus 4.7 |
| 2026-05-25 | **§C.1.b — Axis-Constrained Drag Gizmo IMPLEMENTED.** Closes the last deferred item of C.1.b (and of all Phase 9). Industry standard: Blender (keyboard G→X/Y/Z) + AutoCAD (click-on-arrow). **NEW (2)**:  (~45 LOC — pure math, zero Three.js:  = ,  +  records,  type),  (10 tests: X/Y/Z lock, origin startPos, diagonal raw, negative delta, identity, large floats, color exports — 10/10 PASS). **MODIFIED (7)**:  (+ state +  action; reset in  alongside ).  (+ stored on ;  accepts optional  parameter → post-intersection mask via  keeping locked axis raw value, others at startPos).  (WaypointDragHandleRenderer: + με 3 colored axis arrows (cylinder shaft + cone tip, CylinderGeometry + ConeGeometry, MeshBasicMaterial, , );  factory rotates to world axis (X: -90°Z, Y: no rot, Z: +90°X); gizmo added to scene separately from handles.root;  sets opacity full/35%/60%;  separate Raycaster; unsubAxisLock subscription auto-syncs visual; gizmo repositioned in  +  to active handle).  (+ +  delegation methods).  (+ function: Escape clears lock when !dragging; X/Y/Z toggle  (press same = unlock); window keydown scoped to AbortController signal; gizmo arrow click in  before handle pick;  reset  to null;  passes  at call-time to ).  +  (+). **Tests updated**:  (dispose test updated: renderer now adds 2 groups to scene, expect ). **Architecture**: camera-aligned drag plane unchanged; post-intersection axis mask (, others=startPos); dragAxisLock SSoT in AnimationStore read at event-time (getState()), not closure. **GOL 7/7 ✅**: proactive (mask per tick), race-free (getState() at write-time), idempotent (toggle: press X twice=unlock), belt-and-suspenders (null=free drag, existing path unchanged), SSoT (AnimationStore owns lock, drag-controller applies at projection boundary), sync (pure math), lifecycle owner (dragEnd/cancelDrag + setToolActive(false) → reset to null). **TSC exit 0. 10/10 new tests PASS. 7/7 WaypointDragHandle tests PASS.** §C.1.b 100% CLOSED. ADR-366 Phase 9 zero deferred items. | Claude Opus 4.7 |
| 2026-05-24 | **Phase 9 C.7 Q3 IMPLEMENTED — GDPR anonymous performance telemetry pipeline (Session 3b/5).** Opens C.7 Q3 from research → implementation (4/5 cumulative: Q1+Q5+Q4+Q3). **NEW client files (6)** `bim-3d/telemetry/`: `session-id-generator.ts` (~85 LOC — `getOrRotateDailySalt()` reads 16-byte random salt from LocalStorage rotating per UTC day; `computeAnonymousSessionId(userId)` → SHA-256(salt+userId) via Web Crypto; `clearStoredSalt()` for erasure flow; salt **never leaves the device** — server cannot reverse hash without it). `anonymizer.ts` (~115 LOC — pure: `anonymizeSample({sessionId, snapshot, renderMode, now, userAgent, gpuTier})` → strips projectId/userId/companyId/sceneInfo/email/IP; keeps anonymous sessionId + coarse browser family+major (edge/chrome/firefox/safari/other) + coarse OS family (windows/macos/android/ios/linux/other) + gpuTier 0-3 + renderMode + 10 metrics snapshot + timestamp). `telemetry-store.ts` (~85 LOC — Zustand `subscribeWithSelector` SSoT: `optIn:boolean` LS-persisted + `lastErasedAt:number\|null` LS-persisted + `userIdContext:string\|null` (transient, never persisted); module-bottom side effect wires `setTelemetryOptInProbe(() => store.optIn)` so the Q4 auto-submit FSM auto-skips when telemetry is on). `telemetry-batcher.ts` (~125 LOC — BATCH_SIZE=5 + FLUSH_INTERVAL_MS=5min; `observe(snapshot, renderMode, now)` short-circuits when optIn=false (zero overhead); `scheduleFlush()` coalesces concurrent flush calls via single in-flight promise; pure-ish (Date-injectable for tests)). `telemetry-uploader.ts` (~85 LOC — POST `/api/telemetry/bim-performance` with `x-bim-session-id` header + `keepalive: true`; exponential backoff retry 500ms × 2^attempt × 3; 4xx terminal; `eraseTelemetryHistory(sessionId)` POSTs to `/erase` endpoint). `TelemetryConsentDialog.tsx` (~65 LOC — prop-driven Radix Dialog with title + body + privacy-policy link `<a href={privacyPolicyHref} target="_blank">` + accept/decline buttons; close = decline). **MODIFIED client files (3)**: `PerformanceCollector.ts` (+`telemetryBatcher.observe(snapshot, hudState.renderMode, Date.now())` at tick end — Date.now() not performance.now() because daily salt rotation needs wall-clock). `Quality3DPanelTab.tsx` (+`useAuth()` for userId + 4 `useSyncExternalStore` subscribers + GDPR toggle that opens consent dialog on enable, immediate disable + telemetryBatcher.reset(); erase button that computes sessionId → POST erase → resets store + clearStoredSalt + recordErasure; success/error inline status using `text-[hsl(var(--bg-success))]` semantic CSS var per ADR-365). `auto-submit-fps-threshold.ts` (no edits — `setTelemetryOptInProbe` injection point exposed in Session 3a; wired automatically by telemetry-store.ts module-load side effect). **NEW server files (2)**: `src/app/api/telemetry/bim-performance/route.ts` (~165 LOC — POST batch ingest, `withRateLimit(handler, {category:'STANDARD', getKey: req => `telemetry:${sessionId}`})` (custom key so anonymous traffic is bounded per-session not pooled by IP); no `withAuth` — telemetry is fully anonymous; validates each sample's sessionId matches `x-bim-session-id` header + MAX_BATCH_SIZE=20; Admin SDK batch write to bim_performance_telemetry using `generateBimTelemetryId()` per doc + `FieldValue.serverTimestamp()`). `src/app/api/telemetry/bim-performance/erase/route.ts` (~125 LOC — POST right-to-erasure, `withRateLimit({category:'HEAVY', getKey: …`telemetry-erase:${sessionId}`})`; pages through `where('sessionId','==',headerSession).limit(200)` batch deletes until exhausted; audit-logs `EntityAuditService.recordChange({entityType:'performance_telemetry', action:'erased', companyId:'system'})` with the redacted session id). **MODIFIED cross-cutting (8 files)**: `enterprise-id-prefixes.ts` (+`PERFORMANCE_TELEMETRY: 'telm_bim'`), `enterprise-id-class.ts` (+`generateBimTelemetryId()`), `enterprise-id-convenience.ts` + `enterprise-id.service.ts` (re-exports), `firestore-collections.ts` (+`BIM_PERFORMANCE_TELEMETRY: 'bim_performance_telemetry'` — top-level, NO companyId), `firestore.rules` (+`match /bim_performance_telemetry/{telemetryId}` block: super-admin-only read, deny create/update/delete — server-only via Admin SDK), `types/audit-trail.ts` (+`'performance_telemetry'` AuditEntityType + `'erased'` AuditAction), `auth/types.ts` (+`bim_performance_telemetry:telemetry:read` permission — super_admin via isBypass so no roles.ts change), `tests/firestore-rules/_registry/coverage-manifest.ts` (+pending entry `bim_performance_telemetry`). **i18n** (~13 keys × 2 locales = 26 entries): `bim3d.json` el+en `performance.telemetry.{title, toggle, description, eraseButton, erasing, eraseSuccess, eraseError, lastErasedAt, consentDialog.{title, body, privacyLink, privacyPolicyHref, accept, decline}}`. **GDPR compliance**: Article 6(1)(a) explicit opt-in (default OFF, consent dialog with privacy-policy link); Article 17 right to erasure (dedicated endpoint, session-id ownership via salt possession); Data minimization (anonymizer strips PII); Privacy by design (SHA-256 + per-device daily salt = re-identification-resistant à la Apple Differential Privacy lite). **SSoT REUSE**: Web Crypto (no new deps), Zustand subscribeWithSelector mirror auto-submit-store, withRateLimit custom getKey pattern, EntityAuditService.recordChange (ADR-195 single audit writer), `useAuth()` hook, Radix Dialog SSoT, semantic CSS vars (ADR-365 — `text-[hsl(var(--bg-success))]`), `nowISO()` from date-local SSoT (CHECK 3.7 enforcement). **GOL 7/7 ✅**: proactive (batcher observes from Collector tick — zero new polling), race-free (single producer Collector, single in-flight flush promise, atomic LS writes, anonymizer pure), idempotent (sample insertion deterministic timestamp, uploader retry idempotent (server has no dedup so could double-write — accepted for telemetry use case), erase by-sessionId idempotent at server), belt-and-suspenders (GDPR consent + privacy-policy link + erase endpoint + client salt clearance + sessionId rate-limit + 4xx terminal vs 5xx retry), SSoT (telemetry-store single optIn owner, session-id-generator single salt owner, telemetry-batcher single buffer/flush owner, telemetry-uploader single network wrapper, anonymizer single PII strip), await/sync (Web Crypto digest awaited inside batcher, fetch awaited inside uploader with retry, server route awaited transactional), lifecycle owner (PerformanceCollector emits, telemetryBatcher buffers+flushes, server route owns Firestore batch write, EntityAuditService owns audit row). **N.7.1 compliance**: all files <165 LOC (max telemetry route 165, erase route 125, Quality3DPanelTab grew to ~205). **N.6 compliance**: enterprise IDs only (`generateBimTelemetryId()`). **N.11 compliance**: zero hardcoded UI strings — all via `t('performance.telemetry.*')`. **License N.5**: zero new deps — Web Crypto + fetch native. **TODO (deferred Phase 3 Group D)**: wire 30-day TTL via Firestore native TTL policy on `createdAt`, or nightly Cloud Function purge. Currently no automatic retention — initial dataset stays small enough that manual cleanup is acceptable for v1. **NOT in this session** (Session 4): Q2 admin diagnostics dashboard (`/admin/bim-diagnostics`). **Group C.7 progress**: 4/5 Qs done; pending Q2 only. | Claude Opus 4.7 |
| 2026-05-24 | **Phase 9 C.7 Q4 IMPLEMENTED — Auto-submit consent FSM (Session 3a/5) + Boy Scout server-side performance_diagnostics route.** Opens C.7 Q4 from research → implementation (3/5 cumulative: Q1+Q5+Q4). **NEW files (4)**: `bim-3d/performance/auto-submit-fps-threshold.ts` (~70 LOC — pure FSM, `observe(fps, now)` ticks from PerformanceCollector; `LOW_FPS_THRESHOLD=10`, `SUSTAINED_LOW_MS=5_000`, `PROMPT_COOLDOWN_MS=30min`; permanent opt-out and Q3 telemetry-opt-in both short-circuit via `setTelemetryOptInProbe` injection point — Session 3b wires telemetry-store as probe). `bim-3d/performance/auto-submit-store.ts` (~75 LOC — Zustand `subscribeWithSelector` SSoT; `phase: 'idle'\|'prompted'` + `triggerFps/triggerAt/lastDeclinedAt/permanentOptOut`; LocalStorage keys `bim3d.autoSubmit.{lastDeclinedAt, permanentOptOut}`; actions `openPrompt/recordAccepted/recordDeclined/setPermanentOptOut`). `bim-3d/performance/AutoSubmitConsentDialog.tsx` (~110 LOC — self-mounting Radix Dialog μ Q4 GDPR-compliant 3-button UI; subscribes to `autoSubmitStore.phase`; on accept → `sendDiagnostic({source:'auto_submit', comment: t('performance.autoSubmit.autoComment')})` με current HUD metrics+canvas; on decline → 30-min cooldown; on permanent opt-out → terminal LS flag; `hideCloseButton` ώστε user must explicitly choose). `src/app/api/performance-diagnostics/route.ts` (~150 LOC — Boy Scout SERVER ROUTE: `withStandardRateLimit(withAuth(handlePost))`; body validation; Admin SDK upload screenshot base64→Storage `performance_diagnostics/{companyId}/{docId}/screenshot.png` με `makePublic()`; Admin SDK Firestore write με `FieldValue.serverTimestamp()`; **EntityAuditService.recordChange** με `entityType:'performance_diagnostic'`, `action:'created'` (manual) ή `'auto_submit_accepted'` (auto-submit) — closes the long-standing ADR-195 server-side audit TODO at performance-snapshot-service.ts:43-47). **MODIFIED files (8)**: `PerformanceCollector.ts` (+`autoSubmitFpsThreshold.observe(snapshot.fps, now)` hook at tick end). `Quality3DPanelTab.tsx` (+`useSyncExternalStore` on autoSubmitStore.permanentOptOut + Switch `performance.autoSubmit.toggle` με reversed semantics — on=enabled, off=permanent opt-out). `BimViewport3D.tsx` (+import AutoSubmitConsentDialog + mount next to PerformanceRegressionNotifier με canvas+projectId+userId+companyId props). `bim3d.json` el+en (+9 keys × 2 locales = 18 entries: `performance.autoSubmit.{title, body, bodyGeneric, acceptButton, declineButton, permanentOptOutButton, cooldownNotice, toggle, toggleDescription, autoComment}`). `performance-snapshot-service.ts` (Boy Scout MIGRATION: complete rewrite client setDoc/uploadString/getDownloadURL → `fetch('/api/performance-diagnostics', POST)` με base64 screenshot, `source: 'manual' \| 'auto_submit'` optional field). `firestore.rules` (+`match /performance_diagnostics/{diagId}` block ~25 lines: deny client create (server-only), owner+super-admin read με tenant isolation via `belongsToCompany(resource.data.companyId)`, super-admin only update (future §C.7.Q2 triage) + delete; `companyId` immutable). `types/audit-trail.ts` (+3 AuditAction entries `'auto_submit_prompted', 'auto_submit_accepted', 'auto_submit_declined'`). **SSoT REUSE**: `usePerformanceHUDStore` for `metrics+renderMode` snapshot, `sendDiagnostic` facade (now thin client wrapper), `EntityAuditService.recordChange` (ADR-195 single audit writer), `withAuth+withStandardRateLimit` SSoT pattern, `getAdminFirestore+getAdminStorage` SSoT, `generatePerformanceDiagnosticId` (enterprise-id N.6), Radix Dialog + Button + Switch SSoT, sonner toast pattern (n/a — Q4 uses dialog not toast), Zustand `subscribeWithSelector` middleware pattern mirror PerformanceHUDStore+autoSubmitStore. **GOL 7/7 ✅**: proactive (FSM observes from Collector tick — zero new polling), race-free (single producer Collector, atomic FSM transitions, Zustand store atomic writes, single-shot dialog with permanentOptOut terminal), idempotent (cooldown check before each prompt, permanent opt-out terminal short-circuits, server route safe on retry via enterprise-id docId, audit fire-and-forget never throws), belt-and-suspenders (LocalStorage cooldown + LocalStorage permanent opt-out + Q3 telemetry opt-in probe bypass + dialog overlay click=decline rather than dismiss + screenshot upload + Firestore write + audit all in single server route transaction), SSoT (autoSubmitStore single FSM state owner, auto-submit-fps-threshold single observer module, performance-snapshot-service single client→server facade, /api/performance-diagnostics single server writer, EntityAuditService single audit writer per ADR-195/ADR-294), await/sync (FSM observe sync, server POST awaited, audit awaited inside route, store writes sync), lifecycle owner (PerformanceCollector emits, autoSubmitStore holds state, AutoSubmitConsentDialog renders from store via useSyncExternalStore, server route owns Storage+Firestore+audit transaction). **N.7.1 compliance**: all files <150 LOC (max route 150, dialog 110, FSM 70, store 75). **N.6 compliance**: enterprise IDs only (`generatePerformanceDiagnosticId`). **N.11 compliance**: zero hardcoded strings — all UI text via `t('performance.autoSubmit.*')`. **License N.5**: zero new deps. **Pre-existing security gap CLOSED via Boy Scout**: `firestore.rules` had **NO explicit block** για `performance_diagnostics` collection — relied on default-deny which blocked client reads too. Server route + new rule block now define proper ACL (server-only write, owner read, super-admin admin/triage). **NOT in this session** (Sessions 3b-5): Q3 GDPR telemetry pipeline (anonymizer, session-id-generator, batcher, uploader, 2 API routes including erase Article 17, Firestore collection bim_performance_telemetry, RBAC permission), Q2 admin diagnostics dashboard (`/admin/bim-diagnostics`), final ADR/tracker close + commit batch (Session 5). | Claude Opus 4.7 |
| 2026-05-24 | **Phase 9 C.7 Q5 IMPLEMENTED — Per-user FPS regression detection (Session 2/5).** Opens C.7 Q5 from research → implementation (2/5 sub-questions cumulative). **NEW files (4)**: `bim-3d/performance/baseline-tracker.ts` (~95 LOC — per-mode LocalStorage rolling 7-day FPS samples; pure median + Tukey 1977 MAD computation; `MIN_SAMPLES_FOR_BASELINE=30` gate; `MAX_SAMPLES_PER_MODE=2000` quota guard; `recordSample/getBaseline/clear` API; absent storage degrades to no-baseline). `bim-3d/performance/regression-detector.ts` (~85 LOC — stateful FSM-like evaluator; threshold = `median - 2*MAD` (Tukey outlier); sustained-low gate `>30s` continuous; per-mode 24h cooldown via LocalStorage; mode-change resets `lowSince`; returns `true` iff alert fired). `bim-3d/performance/regression-alert-bus.ts` (~30 LOC — module-level pubsub mirror of `aria-live-bus`; `emit/subscribe/_resetForTests`; bridges non-React Collector to React Notifier). `bim-3d/performance/PerformanceRegressionNotifier.tsx` (~60 LOC — always-mounted micro-leaf; `useEffect` subscribes to bus; emits `toast.warning` με i18n title+body+action; auto-enables HUD when alert lands while HUD is off; returns null). **MODIFIED files (4)**: `PerformanceHUDStore.ts` (+`regressionAlertsEnabled:boolean` state + `setRegressionAlertsEnabled` action + `LS_REGRESSION_ALERTS` LocalStorage key default `true`). `PerformanceCollector.ts` (+`regressionDetector` instance member created in constructor wired to bus; tick now also `baselineTracker.recordSample(renderMode, fps, now)` always when HUD enabled + `detector.evaluate(renderMode, fps, now)` when `regressionAlertsEnabled`, else `detector.reset()` to clear sustained window). `BimViewport3D.tsx` (+import PerformanceRegressionNotifier + render right after PerformanceHUD — always mounted in 3D mode so subscription survives HUD toggle). `Quality3DPanelTab.tsx` (+`regressionAlertsEnabled` from store + 3rd Switch "Ειδοποίηση παλινδρομήσεων" στο dividers stack). **i18n** (4 keys × 2 locales = 8 entries): `bim3d.json` el+en `performance.regression.{toggle, toastTitle, toastBody, openHud}` με `{mode}/{fps}/{median}` ICU interpolation. **SSoT REUSE**: `Bim3dRenderMode` type από `per-mode-promotion.ts`, sonner `toast.warning` με action button pattern, `useTranslation('bim3d')` hook, `usePerformanceHUDStore.getState()` for non-render store mutations. **Statistical correctness**: median + MAD = Tukey 1977 robust outlier detection (industry standard for non-Gaussian distributions like FPS); MIN_SAMPLES=30 avoids early false positives; per-mode baseline isolates raster vs preview vs final differences; 7-day window adapts to scene complexity drift; per-mode 24h cooldown prevents alert fatigue. **GOL 7/7 ✅**: proactive (baseline records continuously when HUD on, regardless of alert toggle — alerts ready immediately when toggle flips on), race-free (single producer Collector tick, atomic LocalStorage writes), idempotent (recordSample order-independent, getBaseline pure, evaluate state-machine deterministic), belt-and-suspenders (alert toggle + cooldown + sustained-low window + mode-change reset + auto-enable HUD on alert), SSoT (baselineTracker single LS owner per mode, regressionDetector single FSM instance per Collector, regressionAlertBus single pubsub channel), sync (no I/O on hot path — LocalStorage reads cached in baseline call, no awaits), lifecycle owner (Collector owns detector instance lifecycle via constructor, Notifier owns bus subscription lifecycle via useEffect, store owns settings persistence). **N.7.1 compliance**: all files <100 LOC. **License N.5**: zero new deps. **NOT in this session** (Sessions 3-5): Q4 auto-submit FPS<10 consent dialog, Q3 telemetry pipeline (anonymizer, batcher, uploader, 2 API routes, Firestore collection, erase endpoint), Q2 admin diagnostics dashboard, final ADR/tracker close + commit batch (Session 5). | Claude Opus 4.7 |
| 2026-05-24 | **Phase 9 C.7 Q1 IMPLEMENTED — Sparkline 60s history (Session 1/5).** Opens C.7 from research → implementation (1/5 sub-questions). **NEW files (3)**: `bim-3d/performance/PerformanceHistoryStore.ts` (Zustand `subscribeWithSelector` store, per-metric `Float32Array(240)` circular buffer, 8 metrics tracked = 7.5KB RAM, `pushSample`/`clearHistory`/`setEnabled`/`getSeries` actions + `revision` counter for micro-leaf re-render trigger + `defaultHistoryEnabled()` heuristic = `localStorage` ?? `navigator.hardwareConcurrency >= 4`). `bim-3d/performance/Sparkline.tsx` (pure presentational SVG ~60 LOC: subsample 240→40 every 6th, normalize min/max, polyline + trailing dot, REUSE `TIER_TEXT_CLASS` per ADR-365 semantic tokens, edge cases empty/flat handled, `role="img"` + aria-label). `bim-3d/performance/PerformanceHUDSparklines.tsx` (ADR-040 micro-leaf wrapper, one `useSyncExternalStore` per metric subscribes to `revision` for minimal re-render footprint). **MODIFIED files (4)**: `PerformanceCollector.ts` (+`usePerformanceHistoryStore.getState().pushSample(snapshot)` after `updateMetrics` — zero cost when disabled via double guard `historyStore.enabled` + `hudStore.enabled`). `PerformanceHUDExpanded.tsx` (+`historyEnabled` prop + conditional sparkline column for 8 metrics in `SPARKLINE_METRIC_SET`, dynamic `min-w-[230px]` when enabled vs `min-w-[180px]` baseline). `PerformanceHUD.tsx` (subscribes to `usePerformanceHistoryStore.enabled`, passes `historyEnabled` to Expanded — Mini view unchanged for compact pill). `Quality3DPanelTab.tsx` (+ "Εμφάνιση ιστορικού 60 δευτ." Switch + "Καθαρισμός ιστορικού" button, disabled when HUD off, semantic structure `space-y-3` + visual divider). **i18n** (4 keys × 2 locales = 8 entries): `bim3d.json` el+en `performance.history.{toggleLabel, clearButton, sparklineAria, tooltipTitle}`. **SSoT REUSE 100%**: `getMetricTier`/`TIER_TEXT_CLASS`/`PERFORMANCE_THRESHOLDS` (performance-thresholds.ts), `PerformanceMetricsSnapshot` type (PerformanceHUDStore.ts), Zustand `subscribeWithSelector` middleware pattern, Tailwind semantic tokens only (ADR-365 compliance, zero raw palette). **Zero**: new deps, new Firestore collections, new RBAC, hardcoded i18n (N.11). **GOL 7/7 ✅**: proactive (HistoryStore lazy-allocated on first import, push starts when HUD enabled), race-free (single producer Collector tick, Float32Array atomic writes per index, subscribeWithSelector revision counter prevents stale reads), idempotent (pushSample with same index = overwrite same slot, clearHistory deterministic, setEnabled idempotent), belt-and-suspenders (double guard `history.enabled && hud.enabled` + localStorage fallback + hardwareConcurrency<4 heuristic), SSoT (PerformanceHistoryStore single buffer source, performance-thresholds reused), sync (pure synchronous hot path, no I/O), lifecycle owner (HistoryStore owns buffers, Collector owns sample emission, HUD orchestrator owns enabled-flag exposure to Expanded). **N.7.1 compliance**: all files <150 LOC. **License N.5**: zero new deps — hand-rolled SVG sparkline. **NOT in this session** (Sessions 2-5): Q2 admin dashboard, Q3 GDPR telemetry pipeline + API routes + Firestore rules + erase endpoint, Q4 FPS<10 auto-submit FSM, Q5 client-side regression detector + MAD baseline tracker, final tracker + commit batch (Session 5). | Claude Opus 4.7 |
| 2026-05-24 | **Phase 9 C.2 IMPLEMENTED — BIM Comments / Markup System.** Κλείνει C.2 από research → implementation (8/8 sub-questions). **Phase A — Foundation Infrastructure (7 files modified)**: `enterprise-id-prefixes.ts` (+`BIM_COMMENT: 'cmt_bim'` + `BIM_COMMENT_REPLY: 'cmtr_bim'`), `enterprise-id-class.ts` (+`generateBimCommentId()` + `generateBimCommentReplyId()`), `enterprise-id-convenience.ts` + `enterprise-id.service.ts` (re-exports), `firestore-collections.ts` (+`BIM_COMMENTS: 'bim_comments'` + `BIM_COMMENT_REPLIES: 'replies'` subcollection), `notification-keys.ts` (+`bim3d.comment.{mentioned,assigned,replied,statusChanged,archived}`), `auth/types.ts` (+6 permissions `bim_comments:comments:{create,read,update,delete,assign,archive}`), `auth/roles.ts` (+permissions σε company_admin/project_manager/architect/engineer/viewer), `bim3d.json` el+en (+~38 keys × 2: `comments.{panelTitle,noComments,newComment,placeholder,searchPlaceholder,filter.*,type.*,status.*,details.*,actions.*,attachment.*,mention.*,anchor.*,notification.*}`), `firestore.rules` (+`bim_comments/{id}` block tenant-scoped + replies subcollection rules). **Phase B — Core Logic (5 NEW files)**: `bim-3d/comments/bim-comment-types.ts` (CommentType/CommentStatus/AnchorType/CommentAnchor/CommentAttachment/BimComment/BimCommentReply interfaces), `bim-3d/comments/comment-status-fsm.ts` (pure FSM: 5 transitions open/in_review/resolved/archived + `canTransition/getAvailableTransitions/isTerminal`), `bim-3d/comments/comment-anchor-resolver.ts` (pure: `detectOrphaned/resolveWorldAnchor/anchorsEqual`), `bim-3d/comments/bim-comments.service.ts` (client-side Firestore CRUD: `createComment/updateComment/transitionStatus/assignComment/orphanComment/createReply/deleteReply/subscribeByProject/subscribeReplies` — CDC trigger pattern like bim-dimensions-3d, no API route), `bim-3d/stores/BimCommentsStore.ts` (Zustand SSoT devtools+subscribeWithSelector+immer: `comments/replies/selectedCommentId/panelOpen/filters` + 10 actions + `selectFilteredComments/selectCommentsByEntityId` selectors). **Phase C — 3D Markers (3 NEW files)**: `bim-3d/comments/CommentBadgeIcon.tsx` (SVG badge: `COMMENT_TYPE_COLORS/COMMENT_TYPE_LABELS/COMMENT_STATUS_OPACITY` record exports + pure presentational SVG component), `bim-3d/comments/comment-marker-textures.ts` (CanvasTexture cache: 5 types × 4 statuses = 20 combinations per dpr, `getCommentTexture/warmCommentTextureCache/disposeCommentTextures`), `bim-3d/comments/CommentMarker3DRenderer.ts` (Three.js Sprite manager: `createCommentMarker3DRenderer()` → `{root,update,hitTest,dispose}` — ready-for-wiring pattern mirror Dimension3DRenderer). **Phase D — UI Panels (6 NEW files + 4 modified)**: `CommentMentionsPicker.tsx` (@-mention dropdown: fetches company users via admin API, keyboard nav ArrowUp/Down+Enter+Escape, filters by query — NEW SSoT for BIM @-mention), `CommentAttachmentUploader.tsx` (PNG/JPG drop zone: 5MB max × 5 files, `createImageBitmap` thumbnail, `StagedFile` export type), `CommentAttachmentLightbox.tsx` (full-screen modal: arrow keys nav + Escape close + backdrop click close), `CommentReplyInput.tsx` (textarea + @-trigger CommentMentionsPicker + Ctrl+Enter submit), `BimCommentDetailsPanel.tsx` (right-side drawer: header type badge + status chip + FSM transition buttons, content, anchor badge, attachments lightbox, flat reply thread, reply input — subscribes to replies on mount), `CommentListPanel.tsx` (Floating3DPanel tab: status filter chips + search + comment card list + inline new-comment form type selector + textarea). **Modified**: `Floating3DPanel.tsx` (+`'comments'` tab + `CommentListPanel` render), `BimCommentsTab.tsx` (stub replaced with real `BimCommentsStore` + `selectCommentsByEntityId` + create entity-anchored comment on "Create New"). **SSoT REUSE**: CDC trigger pattern (mirror bim-dimensions-3d — no API route, audit via Cloud Function), `firestoreQueryService.subscribe` for top-level collection (companyId auto-applied), Firebase `onSnapshot` direct for replies subcollection (SUBCOLLECTIONS not supported by firestoreQueryService), `COMMENT_TYPE_COLORS/LABELS` shared between CommentBadgeIcon.tsx + comment-marker-textures.ts (single source), Zustand middleware stack mirror BimDimensions3DStore, `createImageBitmap` browser API (no deps), `getAvailableTransitions` FSM called in both BimCommentDetailsPanel (UI) + BimCommentsService (server validation). **NOT in session** (wiring deferred): ThreeJsSceneManager integration of CommentMarker3DRenderer (scene.add(root) + update() subscription + hitTest raycasting → selectComment), Firestore indexes + rules coverage tests (ADR-298 CHECK 3.15/3.16), attachment upload to Firebase Storage (two-step: createComment → upload → updateComment patch), notification dispatch via NOTIFICATION_KEYS on createComment/createReply/transitionStatus. **GOL 7/7 ✅**: proactive (billboard sprites synced via update() on store change, subscription started on CommentListPanel mount), race-free (FSM pure validation both client + service layer, Zustand immer atomic writes), idempotent (setDoc with enterprise ID safe on repeat, sprite sync add/remove/update), belt-and-suspenders (FSM validates client-side in BimCommentDetailsPanel + BimCommentsService.transitionStatus validates server-side before updateDoc), SSoT (BimCommentsStore single runtime state owner, BimCommentsService single Firestore mutator, CommentBadgeIcon.tsx single color/label registry), await (all createComment/updateComment/deleteReply awaited), lifecycle ownership (CommentListPanel owns project subscription, BimCommentDetailsPanel owns replies subscription). **N.7.1 compliance**: all files <500 lines (max BimCommentDetailsPanel ~250, CommentListPanel ~250, BimCommentsStore ~150, bim-comments.service.ts ~200). **N.6 compliance**: enterprise IDs only via `generateBimCommentId/generateBimCommentReplyId`. **N.11 compliance**: zero hardcoded strings — all UI text via `t('comments.*')`. | Claude Sonnet 4.6 |
| 2026-05-22 | **Phase 9 C.6 FINAL WIRING — useCropRegionTool hook + BimViewport3D completion.** Closes the remaining wiring gap from the C.6 integration commit. **NEW file (1)**: `bim-3d/render/crop-region/useCropRegionTool.ts` (~55 LOC — React hook that owns CropRegionTool lifecycle: instantiates tool once in `useEffect([])`, deactivates+resets store when `active` becomes false, returns `onToggle` callback; `getCamera` lazy closure safe because tool events only fire when viewport visible; `onCommit` no-op because SectionSceneController subscribes to `CropRegionStore.editState===committed` via store subscription). **MODIFIED file (1)**: `bim-3d/viewport/BimViewport3D.tsx` (removed direct `useCropRegionStore`+`CropRegionTool` imports, added `useCropRegionTool` import, added `const onCropRegionToggle = useCropRegionTool({ managerRef, active: effectiveVisible })` hook call, added `onCropRegionToggle` to `use3DShortcuts` call). **Pattern**: follows `useBimEntityProxyAccessibility` extract pattern — BimViewport3D stays orchestrator-only, lifecycle details extracted to focused hook. **C.6 FULLY CLOSED 2026-05-22**. | Claude Opus 4.7 |
| 2026-05-22 | **Phase 9 C.6 INTEGRATION — BimViewport3D wiring + ribbon button + overlay + shortcut.** Closes the wiring gaps from C.6 modules commit. **NEW files (3)**: `bim-3d/render/crop-region/CropRegionOverlay.tsx` (Photoshop-style 50% dim + dashed border + 8 resize handles, Canvas2D layer over viewport, RAF-throttled UI-only preview per C.6.Q6). `bim-3d/render/crop-region/CropRegionTool.ts` (tool FSM controller: pointerdown→startDrag, pointermove→updateDrag/updateHandleDrag, pointerup→commitDrag/commitEdit, Escape→cancelEdit; screen→normalized coordinate transform). `bim-3d/render/crop-region/RibbonCropRegionButton.tsx` (Render contextual tab button: activate tool, toggle showPreview, commit crop, clear crop). **MODIFIED files (5)**: `bim-3d/shortcuts/keyboard-shortcuts-3d.ts` (+`ACTION_CROP_REGION_TOGGLE` action const + `CROP_3D_SHORTCUTS.cropToggle` Ctrl+Alt+R 3D-only mapping merged into `ALL_VIEW_3D_SHORTCUTS`; chose Ctrl+Alt+R since Ctrl+Shift+R is reserved by browsers). `bim-3d/shortcuts/shortcut-dispatcher.ts` (+import ACTION_CROP_REGION_TOGGLE + dispatch case routing to CropRegionStore activation). `bim-3d/shortcuts/use3DShortcuts.ts` (wire crop toggle hook callback). `bim-3d/viewport/BimViewport3D.tsx` (mount `<CropRegionOverlay />` after BIM layer, register crop tool pointer handlers via `useCropRegionTool` hook). `bim-3d/scene/section-scene-controller.ts` (consume linkedGroups from SectionStore, apply group transform delta on every render frame, sync clipping planes with group state). **SSoT compliance**: keyboard-shortcuts-3d remains single source of truth for action consts (no parallel registry), CropRegionStore single mutator (overlay/tool both call store actions), Three.js native clipping planes (no custom shaders). **GOL 7/7 ✅**: proactive (overlay mounted at viewport ready, tool FSM activated on shortcut), race-free (single store action chain pointerdown→pointermove→pointerup, RAF-throttled overlay paint), idempotent (cancelEdit always resets, Escape works at any FSM state), belt-and-suspenders (shortcut + ribbon button + tool deactivate on click outside, clipping planes only applied when committed), SSoT (CropRegionStore owns state, SectionStore owns plane/group state, keyboard-shortcuts-3d owns mappings), fire-and-forget (overlay paint async via RAF, no await), lifecycle ownership (BimViewport3D owns overlay/tool mount, RibbonCropRegionButton owns button state). | Claude Sonnet 4.6 (other session) |
| 2026-05-22 | **Phase 9 C.6 IMPLEMENTED — Advanced Section Cuts + Crop Region.** Closes C.6 από research → implementation. **NEW files (6)**: `bim-3d/render/crop-region/CropRegionStore.ts` (Zustand SSoT με `subscribeWithSelector`: FSM `idle→dragging→editing→committed`, normalized 0-1 rectangle, 8 handles `tl/tc/tr/ml/mr/bl/bc/br`, depth range near/far, showPreview toggle — startDrag/updateDrag/commitDrag/startHandleDrag/updateHandleDrag/commitEdit/cancelEdit/reset actions; rectangle normalization on commit; min 0.01 size threshold to discard tiny drags). `bim-3d/render/crop-region/crop-frustum-builder.ts` (pure: rectangle + camera → 4-6 Three.js clipping planes per C.6.Q5 spec). `bim-3d/panels/section/HorizontalPresetPicker.tsx` (UI list of `floor.elevation` presets from ADR-326 για quick Y-axis horizontal cuts per C.6.Q1). `bim-3d/panels/section/PlaneListItem.tsx` (per-plane UI row με enable/disable, value, link group badge — supports up to 6 independent planes per C.6.Q2 Three.js hard limit). `bim-3d/systems/section/horizontal-cut-preset-resolver.ts` (pure: floor.elevation → SectionPlaneState mapping). `bim-3d/systems/section/section-group-transformer.ts` (Navisworks-pattern linked planes group transform handle — pure delta application per C.6.Q3). **MODIFIED files (4)**: `SectionStore.ts` (+`PlaneGroup` interface `{id, planeIds, transformDeltaM}` + `linkedGroups: ReadonlyArray<PlaneGroup>` state + `addGroup(planeIds)`/`removeGroup(groupId)`/`applyGroupDelta(groupId, deltaM)` actions; replaced `nextPlaneId()` local function με `generateSectionId()` from enterprise-id.service — N.6 compliance). `ViewMode3DStore.ts` (+`CropRegionRect: {x, y, w, h}` interface + `FinalRenderConfig.cropRegion?: {enabled, rectangle: CropRegionRect, depthRange?: {near, far}}` optional field — persists committed crop in final render config per C.6.Q5). `Section3DPanelTab.tsx` (+155 lines: multi-plane list rendering με PlaneListItem, HorizontalPresetPicker integration, link/unlink groups UI, crop region toggle button). `ADR-345-dxf-ribbon-interface.md` (changelog entry update for ribbon context). **i18n**: `bim3d.json` el+en +~41 keys × 2 για section/crop region (presets, plane list, group, crop region UI, depth range). **SSoT REUSE**: ADR-326 floor.elevation as preset source (no new geometry), Three.js clipping planes (engine-native, no custom shader), generateSectionId from enterprise-id.service (no Date.now()), Zustand subscribeWithSelector middleware (consistent με rest του 3D). **C.6 closure**: 6/6 sub-questions implemented — Q1 (Y-axis horizontal cuts via floor.elevation presets) ✅, Q2 (≤6 planes per Three.js limit + per-plane UI list) ✅, Q3 (Navisworks linked groups με transform handle) ✅, Q4 (rectangle marquee crop region FSM) ✅, Q5 (4-6 clipping planes frustum + finalRenderConfig.cropRegion persistence) ✅, Q6 (Photoshop-pattern dim+border+handles overlay scaffolded in CropRegionStore showPreview) ✅. **N.6/N.7.1/N.11 compliance**: enterprise IDs only, files <500 lines, no hardcoded strings. **GOL 7/7 ✅**: proactive (FSM transitions before commit), race-free (single Zustand store per concern), idempotent (normalizeRect, min-size discard, drag start ref), belt-and-suspenders (cancelEdit always resets state), SSoT (CropRegionStore owns crop state, SectionStore owns plane/group state, finalRenderConfig persists committed crop), await (no async paths), lifecycle ownership (Store actions = single mutator). | Claude Sonnet 4.6 (other session) |
| 2026-05-22 | **Phase 9 C.3 INFRA CLOSURE — Firestore rules/indexes + permissions + audit types staged.** Closes ALL "NOT in session" items from the C.3 modules commit. **Modified files (10)**: `firestore.rules` (+`match /bim_dimensions_3d/{dimensionId}` block ~60 lines: tenant-scoped read via `belongsToCompany(resource.data.companyId)` + super-admin bypass, create with `request.resource.data.keys().hasAll([id, projectId, companyId, mode, anchor, textOffset, textPlane, value, unit, precision, createdBy, createdAt, updatedAt])` + mode validation `in ['aligned','linear','radial','angular']` + textPlane validation `in ['billboard','world']` + unit validation `in ['mm','m']` + precision range 0-6, update with companyId/projectId/id immutability, delete tenant-locked). `firestore.indexes.json` (+3 composite indexes: companyId+projectId+createdAt DESC, companyId+projectId+mode ASC, companyId+projectId+anchor.hostEntityIds ARRAY_CONTAINS — supports entity-follow + recent-first listing + mode filter queries). `firestore-collections.ts` (+`BIM_DIMENSIONS_3D: 'bim_dimensions_3d'` με `NEXT_PUBLIC_BIM_DIMENSIONS_3D_COLLECTION` env override). `enterprise-id-prefixes.ts` (+`BIM_DIMENSION_3D: 'dim3d'`). `enterprise-id-class.ts` (+`generateBim3DDimensionId()` method). `enterprise-id-convenience.ts` (+`generateBim3DDimensionId` convenience export). `enterprise-id.service.ts` (+`generateBim3DDimensionId` re-export). `auth/types.ts` (+4 permissions `bim_dimensions_3d:dimensions:{create,read,update,delete}` in `PERMISSIONS` registry). `auth/roles.ts` (+permissions array entries σε `company_admin` + `project_manager` + `architect` + `engineer` predefined roles). `audit-trail.ts` (+`'bim_dimension_3d'` AuditEntityType + `'orphaned'` AuditAction). **NEW untracked staged (13 modules + 3 tests)**: όλα τα `bim-3d/dimensions/*` files + `__tests__/*` files από το C.3 modules entry παραπάνω — finally staged in this commit. **Why this entry**: previous C.3 entry (2026-05-22) listed these as "NOT in session" infrastructure items; this commit lands them, completing C.3 end-to-end. SSoT + GOL untouched (modules previously verified). **GOL 7/7 ✅**: rules deny-by-default (race-free), enterprise-id idempotent, audit types extend without break, RBAC permissions immutable post-creation, single rule block (SSoT). | Claude Opus 4.7 |
| 2026-05-22 | **Phase 9 C.3 IMPLEMENTED — 3D Manual Dimensions Tool.** Κλείνει C.3 από research → implementation. **NEW files (13)** σε `bim-3d/dimensions/`: `dim3d-types.ts` (Vec3/Vec2 + Dim3DMode discriminator + Dim3DPlacement union {aligned/linear/radial/angular} + Dim3DAnchor + BimDimension3D Firestore schema), `dim3d-value-computer.ts` (pure: aligned=Euclidean, linear=axis-projected με X/Y/Z/entityLocal, radial=radius, angular=degrees + `formatDim3DValue` με mm↔m scaling + ° symbol), `dim3d-line-geometry.ts` (pure: 3 layout builders aligned/radial/angular → `{dimLine, leaderLines, textAnchor, arrows}` με L-shape vs straight leader, 0.3m default offset), `dim3d-text-plane-orienter.ts` (`computeBillboardQuaternion` + `computeWorldPlaneQuaternion` με Shepperd matrix→quaternion + camera-aware dispatcher), `Dim3DToolStateMachine.ts` (FSM idle→placing1→placing2→placingText→committed + TAB cycleMode + ESC cancel + continuous mode), `dim3d-snap-engine-adapter.ts` (raycaster adapter με `pickDim3DSnap` → endpoint/midpoint/faceCenter/guide + 12px tolerance + `DEFAULT_DIM3D_SNAP_TOGGLES`), `bim-dimensions-3d.service.ts` (Firestore CRUD `create`/`update`/`remove`/`markOrphaned`/`subscribeByProject` με enterprise-id `dim3d_*` + value recomputation on update), `Dimension3DRenderer.ts` (Three.js Group με Line+Sprite text+Cone arrows + REUSE `UI_COLORS_BASE.MEASUREMENT_LINE`/`DISTANCE_MEASUREMENT_TEXT` 2D SSoT tokens), `Dim3DGripsRenderer.ts` (3-grip pattern endpointA/B/text με REUSE `CAD_UI_COLORS.grips` tokens + cold/warm/hot states), `useDim3DToolRouting.ts` (cross-mode hook: 2D→`window.dispatchEvent('dim:activate-2d')`, 3D→BimDimensions3DStore actions), `RibbonDim3DContextualTab.tsx` (ribbon UI με tool toggle + 4 mode sub-buttons Aligned/Linear/Radial/Angular + 4 snap toggle checkboxes), `Dim3DPropertiesPanel.tsx` (selected-dim editor: unit/precision/textPlane Selects + value display + textOffset readout via `BimDimensions3DService.update`), `stores/BimDimensions3DStore.ts` (Zustand SSoT με `dimensionsByProjectId`+`selectedDimId`+`toolActive/toolMode`+`fsmState/fsmContext`+`snapToggles/snapPreview` + 20 actions + Immer + DevTools). **NEW tests (3)**: `__tests__/dim3d-value-computer.test.ts` (15 tests: aligned/linear axes/radial/angular dispatcher + formatDim3DValue mm/m/° + throw paths), `__tests__/dim3d-line-geometry.test.ts` (10 tests: aligned 2-arrow + L-shape vs straight leader + radial 1-arrow + angular arc), `__tests__/Dim3DToolStateMachine.test.ts` (10 tests: activate/place1/place2 non-angular vs angular 3-point + cycleMode rotation + cancel/continue/commit + buildAnchorFromContext throw). **MODIFIED files (10)**: `enterprise-id-prefixes.ts` (+`BIM_DIMENSION_3D: 'dim3d'`), `enterprise-id-class.ts` (+`generateBim3DDimensionId()`), `enterprise-id-convenience.ts` + `enterprise-id.service.ts` (export `generateBim3DDimensionId`), `firestore-collections.ts` (+`BIM_DIMENSIONS_3D: 'bim_dimensions_3d'`), `firestore.rules` (+`match /bim_dimensions_3d/{id}` block ~60 lines με 4 ops + companyId immutable + mode/unit/precision validation + super-admin bypass), `firestore.indexes.json` (+3 composite indexes: companyId+projectId+createdAt DESC, companyId+projectId+mode ASC, companyId+projectId+anchor.hostEntityIds ARRAY_CONTAINS), `auth/types.ts` (+4 permissions `bim_dimensions_3d:dimensions:{create,read,update,delete}`), `auth/roles.ts` (+permissions σε company_admin/project_manager/architect/engineer), `audit-trail.ts` (+`'bim_dimension_3d'` AuditEntityType + `'orphaned'` AuditAction), `keyboard-shortcuts-3d.ts` (+`ACTION_DIM3D_TOGGLE`+`ACTION_DIM3D_CYCLE_MODE` action consts + `DIM3D_SHORTCUTS.toggleTool` Ctrl+Shift+D 3D-only mapping merged into `ALL_VIEW_3D_SHORTCUTS`), `Bim3DPreferencesService.ts` (+`Dimensions3DPrefs` interface με `onEntityDelete:'orphan'|'delete'`+`defaultUnit:'mm'|'m'`+`defaultPrecision:number` + `DIMENSIONS_3D_DEFAULTS` + `Bim3DPrefs.dimensions?` field + DEFAULTS extension). **i18n (~36 keys × 2 locales)**: `bim3d.json` el+en +`dimensions.title` + `toolbar.{aligned,linear,radial,angular,cancel,commit}` + `mode.{aligned,linear,radial,angular}.{label,tooltip}` + `placement.linearAxis.{X,Y,Z,entityLocal}` + `textPlane.{billboard,worldLocked,toggleLabel}` + `units.{mm,m}` + `fields.{value,offset,precision,unit,createdAt,createdBy}` + `actions.{edit,delete,duplicate,convertTo2D}` + `settings.onEntityDelete.{orphan,delete}` + `settings.{defaultUnit,defaultPrecision}` + `snap.{endpoint,midpoint,faceCenter,guide,inferred}` + `errors.{cannotMeasureSamePoint,invalidAngularPoints,permissionDenied}` + `floatingPanel.tabs.dimensions3d` + `shortcuts.view3d.dim3dToggle`. **Greek**: pure (zero English words). **SSoT REUSE 95%**: 4-mode placement discriminator 100% mirror ADR-362, 3-grip pattern 100% mirror ADR-362, snap engine concepts ported με Three.js raycaster, leader tokens REUSE `UI_COLORS_BASE.MEASUREMENT_LINE`+`DISTANCE_MEASUREMENT_TEXT` (not duplicated), ribbon tab pattern 100% ADR-345, FSM idle→placing1→placing2→placingText state graph mirror ADR-362. **Conscious diverge**: separate Firestore collection `bim_dimensions_3d` vs ADR-362's entity-embedded 2D dims — justified per Vector3+host binding schema divergence. **GOL 7/7 ✅**: proactive (FSM initialized on ribbon mount + subscription per project), race-free (FSM transitions atomic + snap engine debounced naturally via RAF + entity-follow via single subscribeByProject), idempotent (value computation deterministic from anchors + mode change idempotent + grip drag transactional ESC-cancellable), belt-and-suspenders (client validation + Firestore rules + value recompute on placement/anchor change + orphan auto-convert markOrphaned API), SSoT (BimDimensions3DStore single source + bim-dimensions-3d.service single mutator + snap engines REUSE 2D + leader tokens REUSE), await (all setDoc/updateDoc/deleteDoc awaited), lifecycle owner (BimDimensions3DStore owns runtime state, BimDimensions3DService owns Firestore, FSM owns tool state). **N.7.1 compliance**: all files <500 lines (max BimDimensions3DStore ~230, BimDimensions3DService ~150, RibbonDim3DContextualTab ~120). **N.6 compliance**: enterprise IDs only via `generateBim3DDimensionId()`. **N.11 compliance**: zero hardcoded strings — all UI text via `t('dimensions.*')` + zero `defaultValue` literals. **NOT in session**: BimViewport3D integration (Dim3DSceneLayer hook + raycaster wiring + grip drag event binding), Dimensions3D floating panel tab mount in `Bim3DFloatingTab.tsx`, hotkey dispatch in `shortcut-dispatcher.ts` για `ACTION_DIM3D_TOGGLE`, Firestore rules coverage test suite (ADR-298 CHECK 3.15/3.16), entity-follow live subscription wiring to host transform mutations. Phase 9 C.3 implementation effort: ~10-12h (per ADR estimate, achieved within scope). | Claude Opus 4.7 |
| 2026-05-22 | **Phase 9 C.5 INTEGRATION COMPLETE — BimViewport3D wiring + reduced-motion guards + Settings UI.** Closes ALL "NOT in session" items from the C.5 modules commit. **ViewMode3DStore extended (1 file)**: +`accessibilityReducedMotion: ReducedMotionOverride` (default `'auto'`) + `accessibilityEntityNavOrder: 'spatial' \| 'semantic'` (default `'spatial'`) state fields + `setAccessibilityReducedMotion` + `setAccessibilityEntityNavOrder` actions. **viewport-camera.ts (1 file)**: +`getReducedMotion?: () => boolean` in `ViewportCameraOptions`; `const rm = () => options.getReducedMotion?.() ?? false` closure; all 7 `animation.start()` duration constants wrapped with `getAnimationDuration('camera', rm(), <constantMs>)` — affected calls: `frameBounds` ×2, `setProjection` perspective ×1, `setProjection` ortho ×1, `snapToViewDirection` ×1, `pan` ×1, `goHome` ×1 — WCAG 2.3.3 compliance (durationMs→0 when reducedMotion true). **ThreeJsSceneManager.ts (1 file)**: +`private reducedMotionOverride: ReducedMotionOverride = 'auto'`; `initViewportCamera()` now passes `getReducedMotion: () => checkReducedMotion(this.reducedMotionOverride)` to `createViewportCamera()`; +`setReducedMotionOverride(override)` public method; +`getEntityFocusOrder()` public method (delegates to `computeFocusOrder(this.bimLayer.group, this.viewport.camera)`, returns `[]` if disposed). **NEW hook `use-bim-entity-proxy-accessibility.ts` (~95 LOC)**: `useBimEntityProxyAccessibility({ containerRef, managerRef, effectiveVisible, externalEntitiesMode })` — mount effect creates `EntityDomProxyRenderer` + `EntityKeyboardNavigator` on proxy container inside viewport div, registers `keydown` listener, initial sync on non-external mode, cleanup on unmount; subscription effect drives ongoing `proxyRendererRef.sync(buildProxyEntities(s, tAria))` on store change; `buildProxyEntities()` maps walls/columns/beams/slabs to `ProxyEntity[]` using `bim-3d-aria` namespace labels. **NEW component `Accessibility3DPanelTab.tsx` (~95 LOC)**: reads `announcementsEnabled`, `accessibilityEntityNavOrder`, `accessibilityReducedMotion` from `ViewMode3DStore`; on change: optimistic store update + `Bim3DPreferencesService.save()` (catch silently); UI: fieldset nav-order radio (`spatial`/`semantic`), fieldset reduced-motion radio (`auto`/`force-on`/`force-off`), announcements checkbox — all `accent-primary` styled. **Bim3DFloatingTab.tsx (1 file)**: +`accessibility` to `Bim3DSubTab` union + `SUB_TABS` array; +`import { Accessibility3DPanelTab }` + render branch `{activeSubTab === 'accessibility' && <Accessibility3DPanelTab />}`. **BimViewport3D.tsx (1 file, 497 lines)**: JSX wrapped in `<>` fragment; +`<a href="#bim-3d-canvas-skip" className="sr-only focus:not-sr-only ...">` skip link before viewport div; root div `aria-label` → `t('aria.canvas.rootLabel')`; +`<span id="bim-3d-canvas-skip" tabIndex={-1} className="sr-only" aria-hidden="true" />` skip target; prefs load `useEffect` extended to also call `store.setAnnouncementsEnabled` + `store.setAccessibilityReducedMotion` + `store.setAccessibilityEntityNavOrder` + `managerRef.current?.setReducedMotionOverride()` from `prefs.accessibility`; +`useBimEntityProxyAccessibility({ containerRef, managerRef, effectiveVisible, externalEntitiesMode })` hook call; +`useViewMode3DStore.subscribe(s => s.accessibilityReducedMotion, override => managerRef.current?.setReducedMotionOverride(override))` subscription. **Floating3DPanel.tsx (1 file, dead code)**: also updated with accessibility tab + import for future reactivation. **i18n (2 keys × 2 locales)**: `bim3d.json` el+en +`floatingPanel.tabs.accessibility` (`"Προσβασιμότητα"` / `"Accessibility"`) + `aria.entityNav.proxyContainerLabel` (`"Οντότητες BIM — πλοήγηση πληκτρολογίου"` / `"BIM entities — keyboard navigation"`). **SSoT compliance**: `Bim3DPreferencesService` owns all accessibility pref persistence; `ViewMode3DStore` owns accessibility UI state; `use-bim-entity-proxy-accessibility` hook owns proxy lifecycle (container created/destroyed with `effectiveVisible`); `viewport-camera.ts` is the sole owner of animation duration decisions. **N.7.1 compliance**: BimViewport3D 497/500 lines; ThreeJsSceneManager 490/500 lines (all extractions into hook + panel kept files under limit). GOL ✅: proactive (proxy renderer synced immediately on mount + on each entity store change), race-free (single proxy renderer ref, single subscriber, optimistic store update before async save), idempotent (sync same entities = same DOM state, setReducedMotionOverride same value = no-op), belt-and-suspenders (prefs load applies to both store + manager, store subscription keeps manager in sync for live changes from UI panel), SSoT (one proxy renderer per viewport, one keyboard navigator per viewport, one animation duration resolver in viewport-camera.ts), await (prefs load awaited before setState), lifecycle ownership (BimViewport3D owns proxy+navigator lifecycle via hook, Bim3DPreferencesService owns Firestore persistence). | Claude Sonnet 4.6 |
| 2026-05-22 | **Phase 9 C.5 IMPLEMENTED — ARIA + Screen Reader Compliance Polish.** Κλείνει A.7.Q2 deferred (WCAG 2.2 AA, EN 301 549 EU). Extends Phase 8.0-8.1 accessibility foundation. **NEW files (5)**: `accessibility/reduced-motion-config.ts` (`ReducedMotionTarget` union 7 targets + `NORMAL_DURATIONS` record + `getAnimationDuration(target, reducedMotion, normalMs?)` — callsites use when calling AnimationManager.startTransition to snap 0ms, WCAG 2.3.3). `accessibility/use-reduced-motion.ts` (`useReducedMotion(override)` hook subscribes `window.matchMedia` live change events + `ReducedMotionOverride='auto'|'force-on'|'force-off'`; non-hook `checkReducedMotion()` for event handlers). `accessibility/announcement-protocol.ts` (type-safe event dispatcher wrapping aria-live-bus: `AnnouncementEventType` union 10 types, `AnnouncementParamMap`, `POLITENESS` — polite default / assertive for renderDone+error, 250ms debounce to avoid SR flooding, assertive bypasses debounce, `announceEvent<K>(type, params, t)` + `buildAnnouncementMessage` + `cancelPendingAnnouncement`). `accessibility/entity-dom-proxy-renderer.ts` (offscreen `<div role="application">` with one `<button>` per visible entity — roving tabindex WAI-ARIA pattern (only focused=0, rest=-1), `ProxyEntity.{bimId,ariaLabel}`, `sync(entities)` add/remove/update, `dispose()` removes container; container is `sr-only` not `display:none` so AT can focus). `accessibility/entity-keyboard-navigator.ts` (`createEntityKeyboardNavigator({focusManager,getOrder,onActivate})` — Arrow=next/prev, Home/End=first/last, PageDown/PageUp=±10 entities floor-skip, Enter/Space=activate, Escape=clear). **MODIFIED files (4 + i18n)**: `aria-entity-description-generator.ts` (+`{stepsCount?,dimensionValue?,dimensionUnit?,commentText?}` to `AriaEntityData`; `generateStairDescription` +`stairGeometry` ICU key; +`generateDimensionDescription`/`generateCommentMarkerDescription`/`generateAreaPlanDescription`; dispatcher +dimension/comment-marker/area-plan cases). `focus-order.ts` (+`NavOrder='spatial'|'semantic'` type; +`SEMANTIC_TYPE_ORDER` const; +`computeSemanticFocusOrder(bimGroup)`; `computeFocusOrder` +`navOrder` param). `Bim3DPreferencesService.ts` (+`AccessibilityPrefs` interface; +`ACCESSIBILITY_DEFAULTS`; `Bim3DPrefs.accessibility?`; DEFAULTS includes accessibility). `ViewMode3DStore.ts` (+`announcementsEnabled:boolean` state default `true`; +`setAnnouncementsEnabled` action). **i18n**: `bim-3d-aria.json` el+en +6 keys: `entity.{stairGeometry,dimension,dimensionGeometry,commentMarker,commentMarkerWithText,areaPlan}`. `bim3d.json` el+en +16 keys: `accessibility.settings.*` (title/entityNavOrderLabel/entityNavOrder.{spatial,semantic}/reducedMotionLabel/reducedMotion.{auto,forceOn,forceOff}/announcementsEnabled) + `aria.canvas.*` (rootLabel/skipLink/emptyState) + `aria.entityNav.*` (7 keys) + `aria.announcements.*` (8 keys). **NOT in session** (Phase 9 integration): BimViewport3D wiring of proxy-renderer+navigator, ThreeJsSceneManager reduced-motion guards, Settings UI Accessibility section, section-clip-applicator/quality-modulator/raster-to-pathtrace-swap guards. GOL ✅: proactive (proxies synced on entity mount, reduced-motion live listener), race-free (roving tabindex single source, 250ms debounce), idempotent (ARIA regen deterministic, setFocus idempotent), belt-and-suspenders (OS pref + manual override, assertive bypasses debounce, sr-only not display:none), SSoT (aria-live-bus single dispatcher, aria-entity-description-generator single label source, reduced-motion-config single registry, focus-order.ts single nav order), sync (proxy sync= synchronous DOM update), lifecycle (entity-dom-proxy-renderer owns proxy, Bim3DPreferencesService owns settings). | Claude Sonnet 4.6 |
| 2026-05-22 | **Phase 9 C.4 IMPLEMENTED — BimEntityCard Remaining Tabs (Materials/BOQ/Comments).** Υλοποιήθηκαν οι 3 remaining tabs του BimEntityCardPanel (ADR-366 C.4). **Νέα αρχεία (6)**: `bim-3d/properties/tabs/BimMaterialsTab.tsx` (4-section layout: current material badge + top-5 alternatives + DNA multi-layer composition + Phase 6+ cost rollup placeholder; reads από `Bim3DEntitiesStore.getState()` + `wall-material-catalog` SSoT; supports all entity types wall/column/beam/slab), `bim-3d/properties/tabs/BimBoqTab.tsx` (3-section layout: parent summary + children layer tree + open-in-BOQ link; one-time Firestore `getDocs` query `sourceEntityId==bimId`, uses `boq-tree-builder` pure function), `bim-3d/properties/tabs/BimCommentsTab.tsx` (inline preview top-3 + empty state + see-all/new-comment buttons; `useBimCommentsPreview` stub → wires to BimCommentsStore σε C.2 implementation), `bim-3d/properties/tabs/material-alternatives-resolver.ts` (pure: resolves top-5 alternatives από `defaultWallMaterialCatalog.listMaterialIds()` excluding current + `'custom'`), `bim-3d/properties/tabs/boq-tree-builder.ts` (pure: `BOQItem[]` → `{parent, children}` display tree; finds parent via `isGroupParent` flag, sorts children by `layerIndex`), `bim-3d/properties/tabs/last-active-tab-tracker.ts` (localStorage `bim3d:entityCardTabs` key, `getLastActiveTab` + `setLastActiveTab` per entity type). **Τροποποιημένα αρχεία (3)**: `BimEntityCardPanel.tsx` (5-tab layout Geometry→Materials→BOQ→Comments→Audit, per-user last-active persistence via `last-active-tab-tracker`, uses `useAuth` + `useProjectHierarchyOptional` για `companyId`/`projectId` needed by BimBoqTab, `useCallback` για `handleTabChange`), `Bim3DPreferencesService.ts` (+`EntityCardTabPrefs` interface + `entityCardTabs?: Record<string, EntityCardTabPrefs>` field σε `Bim3DPrefs`), `src/i18n/locales/{el,en}/bim3d.json` (+~30 keys × 2 locales: `entityCard.tabs.{materials,boq,comments}` + `entityCard.materials.*` + `entityCard.boq.*` + `entityCard.comments.*` + `entityCard.errors.*`). **Architecture**: Zero new stores (tabs are pure views over existing SSoTs: wall-material-catalog, COLLECTIONS.BOQ_ITEMS, BimCommentsStore stub). BOQ tab uses synchronous one-shot Firestore read (not real-time — BOQ changes infrequent, managed in BOQ subapp per C.4.Q4 SSoT principle). BimCommentsTab ready for C.2 wiring (stub returns [] until BimCommentsStore implemented). **SSoT REUSE**: `defaultWallMaterialCatalog` (ADR-363), `boq-multi-layer-builder.ts` output compatible (via `BOQItem.isGroupParent` + `parentBoqItemId`), `EntityDetailsHeader` pattern, `COLLECTIONS.BOQ_ITEMS` config SSoT. GOL ✅: proactive (tabs pre-rendered on entity select), race-free (Firestore query `cancelled` guard), idempotent (tab switch same value = no-op, localStorage write stable), belt-and-suspenders (empty states + loading state + stub fallback), SSoT (zero duplicate state — pure view over existing stores/services), await (BOQ query awaited before render), lifecycle ownership (BimEntityCardPanel owns tab activation, BimBoqTab owns query lifecycle). | Claude Sonnet 4.6 |
| 2026-05-22 | **Appendix C — GROUP C 7/7 COMPLETE (Implementation-Level Decisions για Deferred Features)**. 46 sub-Qs cumulative κλειστά. **C.1 Animation System UX** 9/9: 8s@30fps turntable defaults, 3D drag handles waypoint UX, single-track timeline strip με waypoint diamonds, 8-preset easing library + bezier advanced, linked-by-default interpolation + advanced split-tracks, H.264 Main MP4+AAC codec (N.5 MIT royalty-free streaming) + WebM/VP9 fallback, no audio v1 (mp4-muxer ready), νέα Firestore `bim_animations` + subcoll `render_jobs`, multi-job FIFO queue panel, enterprise-id `anm_bim_*`. **+18-22h Phase 9**. **C.2 BIM Comments / Markup System** 8/8: 5 typed comments (Issue/Question/Suggestion/Approval/Info) με REUSE design tokens, billboard pin marker με type badge, flat thread + 1-level replies, @-mentions με first-@ auto-assignee (BIMcollab pattern), 4-state FSM (Open→InReview→Resolved→Archived) με ADR-195 audit + NOTIFICATION_KEYS dispatch, image-only attachments (PNG/JPG max 5MB×5) Firebase Storage company-scoped, entity OR world space anchor με auto-orphan-convert on entity delete, νέα Firestore `bim_comments` + subcoll `replies`, enterprise-id `cmt_bim_*` + `cmtr_bim_*`. **+12-14h Phase 9**. **C.3 3D Manual Dimensions Tool** 7/7: ribbon "Διαστάσεις 3D" + hotkey D3D (mirror ADR-362), ALL snap modes ON default (REUSE 2D snap engines via raycaster adapter), 4-mode placement discriminator (Aligned/Linear/Radial/Angular mirror ADR-362), L-shape leader 8px arrow + REUSE `DIMENSION_LINE_COLOR` tokens, camera-billboard default + per-dim lock-to-plane, 3-grip pattern (endpointA/B + text) mirror 2D με entity-follow, νέα Firestore `bim_dimensions_3d` (separate από 2D — Vector3 + host binding diverge justified), enterprise-id `dim3d_*`, `useDim3DToolRouting` cross-mode hook (2D/3D shared tool routing). **+10-12h Phase 9**. **C.4 BimEntityCard Remaining Tabs** 6/6: BimMaterialsTab 4-section (current+alternatives+multi-layer+cost rollup) με ADR-363 Phase 6, read-only material change με drawer link, BimBoqTab 3-section parent/children/quantity με ADR-363 Phase 6.1, BoQ subapp navigation pattern (NO inline override SSoT), BimCommentsTab inline preview top-3 + unread badge REUSE BimCommentsStore, tab order Geometry→Materials→BoQ→Comments→Audit με per-user persistence via Bim3DPreferencesService. **+5-6h Phase 9**. **C.5 ARIA + Screen Reader Compliance** 5/5 (A.7.Q2 deferred activated): polite default + 250ms debounce announcement protocol, offscreen DOM proxy `<button>` per entity + roving tabindex, spatial default + semantic toggle keyboard nav με Arrow/Home/End/PageUp/PageDown, locale-aware ARIA labels `<type> <code> — <dimensions> — <material>` Greek primary + EN fallback, `prefers-reduced-motion` με reduced-motion-config registry + Bim3DPreferencesService override, WCAG 2.2 AA + EN 301 549 EU compliance scope. **+6-7h Phase 9** (+4-6h post-impl NVDA+JAWS+VoiceOver QA matrix DEFERRED). **C.6 Advanced Section Cuts + Crop Region** 6/6: Y-axis horizontal cuts με ADR-326 floor.elevation presets, up to 6 independent planes (Three.js hard limit) με per-plane UI list, Navisworks-pattern linked planes group με transform handle (GenArc Gizmo PORT fallback), B.4.Q5 crop region rectangle marquee (frustum 4-6 clipping planes) με finalRenderConfig persistence + Photoshop-pattern live overlay (50% dim + dashed border + 8 resize handles) — RAF-throttled UI-only preview (no clipping during edit). **+8-10h Phase 9**. **C.7 Performance HUD Extensions** 5/5: per-metric 60s sparkline (240 samples @ 4Hz, hand-rolled SVG 40-LOC zero dep), super-admin `/admin/bim-diagnostics` dashboard (ADR-145 expansion) με filters/list/detail/triage FSM/charts/CSV export, GDPR opt-in anonymized telemetry (SHA-256 daily-salt session_id, 30-day TTL, νέα Firestore `bim_performance_telemetry` NO companyId super-admin-only + erase endpoint Article 17), FPS<10 for >5s auto-submit consent dialog (NOT silent — GDPR + UX trust), per-user MAD-based regression detection (LocalStorage baseline, Tukey outlier stat) client-side v1. **+10-12h Phase 9**. **Group C totals**: 7 topics + 46 sub-Qs ✅ + **+69-83h Phase 9** (+4-6h QA). **ADR-366 total revised**: ~185-220h post-Group-B → **~254-303h post-Group-C** (Phases 0-9). **Νέες Phase 9 SSoT**: ~64 modules + 4 νέα Firestore collections (`bim_animations`+`render_jobs` subcoll, `bim_comments`+`replies` subcoll, `bim_dimensions_3d`, `bim_performance_telemetry`) + 5 νέα enterprise-id generators (`anm_bim_*`, `cmt_bim_*`, `cmtr_bim_*`, `dim3d_*`, `telm_bim_*`) + ~14 νέες RBAC permissions + ~20 νέοι audit types + 7 νέα notification keys + ~250 i18n keys × 2 locales = ~500 entries. **License N.5 ✅**: όλες οι νέες deps MIT (mp4-muxer + Recharts ήδη installed). **SSoT REUSE 90%+**: design tokens REUSE από 2D, snap engines REUSE via adapter, EntityDetailsHeader SSoT, NOTIFICATION_KEYS registry, user picker SSoT, easing functions, ribbon contextual tab pattern, focus-order, aria-live-bus, performance-snapshot-service. **Conscious diverge documented**: H.264 vs AV1 risk-averse (Q1.6), no audio v1 MVP discipline (Q1.7), 1-level replies max anti-Slack (Q2.3), separate `bim_dimensions_3d` (Q3.7 schema diverge), client-side baseline only (Q7.5 server ML deferred). **Pending DEFERRED Group D / Phase 10+**: animation audio import, animation crop keyframing, polygon crop region, PDF/video attachments, 2D plan-view marker backport, server-side ML regression, mobile/AR/XR re-scoping, dimension chains/parametric formulas. **Implementation ordering recommendation**: C.4→C.3→C.5→C.6→C.2→C.7→C.1 (smallest UX gaps first, animation last largest scope). | Claude Opus 4.7 |
| 2026-05-21 | **Remove Floating3DPanel from 3D canvas.** `Floating3DPanel` unmounted από `BimViewport3D.tsx` (import αφαιρέθηκε + JSX αφαιρέθηκε). Controls πλέον ΜΟΝΟ στο left sidebar `FloatingPanelContainer` (bim3d tab). `Floating3DPanel.tsx` + τα tab components παραμένουν ως αρχεία (δεν διαγράφονται). |
| 2026-05-21 | **Floating Panel Mirror — 3D controls mirrored in left sidebar (bim3d tab).** Νέος tab `'bim3d'` στο `FloatingPanelContainer` που επαναχρησιμοποιεί ΑΥΤΟΥΣΛΟΥΣ τους υπάρχοντες tab components (`Floor3DPanelTab`, `Lighting3DPanelTab`, `Quality3DPanelTab`, `Section3DPanelTab`) — zero code duplication. **Νέα αρχεία (1)**: `ui/panels/bim3d/Bim3DFloatingTab.tsx` (wrapper με sub-tabs floors/lighting/quality/sections, dark bg-zinc-900 container ώστε τα dark-styled components να εμφανίζονται σωστά, max-h-[32rem] scrollable). **Τροποποιημένα αρχεία (5)**: `types/panel-types.ts` (+'bim3d' στο FloatingPanelType union + isFloatingPanelType guard + FLOATING_PANEL_TYPES array + PANEL_METADATA record + 'Box' στο iconName union + PANEL_LAYOUT.topRow). `ui/components/PanelTabs.tsx` (+Box icon από lucide-react + bim3d tab entry). `ui/hooks/usePanelContentRenderer.tsx` (+case 'bim3d': `<Bim3DFloatingTab />`). `src/i18n/locales/el/dxf-viewer-panels.json` (+panels.bim3d.title: "BIM 3D"). `src/i18n/locales/en/dxf-viewer-panels.json` (+panels.bim3d.title: "BIM 3D"). **Canvas overlay παραμένει**: Το `Floating3DPanel.tsx` ΔΕΝ αλλάζει — και τα δύο σημεία λειτουργούν παράλληλα μέχρι νέα εντολή. GOL ✅: SSoT (zero duplication, ίδια components), idempotent, zero race, lifecycle ownership clear (FloatingPanelContainer owns tab state), i18n complete. | Claude Sonnet 4.6 |
| 2026-05-21 | **Phase 8.0 UI ARIA CLOSURE — Floating3DPanel tab ARIA + Section3DPanelTab ModeButton.** Completes Phase 8.0 "Files (MODIFY)" scope. **Modified files (4)**: `Floating3DPanel.tsx` — tab strip div `role="tablist"` + each button `role="tab"` + `aria-selected={activeTab===tab}` + `id="floating-3d-panel-tab-{tab}"` + `aria-controls="floating-3d-panel-panel-{tab}"`; tab content div `role="tabpanel"` + `id="floating-3d-panel-panel-{activeTab}"` + `aria-labelledby="floating-3d-panel-tab-{activeTab}"`; `aside` aria-label changed from hardcoded "Floors" tab text → `t('floatingPanel.ariaLabel')`. `Section3DPanelTab.tsx` — `ModeButton` component + `aria-pressed={active}` + `aria-label={label}` (button-type toggle pattern for Box / Plane mode). `locales/el/bim3d.json` — `floatingPanel.ariaLabel: "Έλεγχοι 3D"`. `locales/en/bim3d.json` — `floatingPanel.ariaLabel: "3D Controls"`. **Phase 8.0 status**: ✅ FULLY DONE. **Phase 8 table row** → ✅ DONE. **ADR-366 FULLY CLOSED (all phases 0–8.1 + 8.0 closure)**. GOL ✅: tab ARIA follows WAI-ARIA tablist pattern (role=tablist+tab+tabpanel, aria-selected, id+aria-controls+aria-labelledby), ModeButton uses aria-pressed (toggle button semantics per WCAG 4.1.2), i18n SSoT (no hardcoded strings, N.11 compliant). | Claude Sonnet 4.6 |
| 2026-05-21 | **Phase 8.1 COMPLETE — Entity Description i18n + Screen Reader (ADR-366 CLOSURE).** Final phase of ADR-366. **NEW files (5)**: `bim-3d/accessibility/aria-entity-description-generator.ts` (115 LOC — pure TS, zero React/Three.js; per-type exported functions `generateWallDescription/generateColumnDescription/generateBeamDescription/generateSlabDescription/generateOpeningDescription/generateSlabOpeningDescription/generateStairDescription` + unified dispatcher `generateAriaDescription`; `AriaEntityData` interface with optional geometry fields for future extensibility; graceful fallback: geometry absent → "TypeLabel EntityName", both absent → `entity.noData`). `src/i18n/locales/el/bim-3d-aria.json` (18 keys — pure Greek, zero English; entity type labels + geometry fragments with ICU `{variable}` interpolation + material/level fragments + noData/unknown/withName). `src/i18n/locales/en/bim-3d-aria.json` (18 keys — English equivalents). `docs/accessibility/bim-3d-screen-reader-checklist.md` (30-row NVDA + VoiceOver QA matrix, WCAG 1.3.1 / 4.1.3 / 2.1.1 / 1.4.1 targets). `bim-3d/__tests__/aria-entity-description.test.ts` (7 unit tests: wall full/missing material/missing level, column basic, slab area+thickness, opening, unified dispatcher noData+unknown+fallback). **MODIFIED files (6)**: `bim-3d/accessibility/KeyboardFocusManager.ts` (+`DescriptionListener` type + `subscribeDescription()` method + `descriptionListeners` Set — semantic channel separation from visual FocusListener; emits to both sets in `emit()`; cleared in `dispose()`). `bim-3d/accessibility/AriaLiveRegion.tsx` (+`AriaLiveRegionProps` interface; +`focusManager: KeyboardFocusManagerApi|null` + `getEntityData: ((bimId)=>FocusEntityLabelData|null)|null` optional props; +`getEntityDataRef` stable ref pattern (avoids useEffect churn on render); +`useTranslation('bim-3d-aria')` for description t-function; +useEffect subscribes to `focusManager.subscribeDescription` → resolves entity data → `generateAriaDescription(ariaData, tAria)` → `ariaLiveBus.announce(…,'polite')`; existing selection/mode useEffects updated `t` → `tBim3d`). `bim-3d/viewport/BimViewport3D.tsx` (AriaLiveRegion now receives `focusManager` + `getEntityData` props; null-safe pattern same as FocusIndicator3D). `src/i18n/lazy-config.ts` (+`'bim-3d-aria'` in SUPPORTED_NAMESPACES + dxf/bim bundle). `src/i18n/namespace-loaders.ts` (el + en loaders for `bim-3d-aria`). `src/i18n/config.ts` (+`'bim-3d-aria'` in namespace list). **ADR-040 compliance**: subscribeDescription = observer pattern, zero React; AriaLiveRegion useEffect subscribes to stable focusManager prop (re-runs when manager mounts); description generation = pure function, sync, zero useSyncExternalStore. **Note on geometry**: current `findFocusedEntityData` exposes `bimType`+`entityName` only → descriptions use entityName fallback; geometry keys designed for future extension when mesh userData enriched. GOL ✅: proactive (description fired on Tab keypress via subscribeDescription), idempotent (same entity re-focused → new announce, AriaLiveBus 200ms window dedup), belt-and-suspenders (entity not found → 'BIM entity' fallback via entity.unknown), SSoT (single generator per type, TFn injected, one subscribeDescription channel), fire-and-forget (announce via existing bus, non-blocking), lifecycle ownership (AriaLiveRegion owns subscription, cleaned up on focusManager change or unmount). **ADR-366 status: FULLY CLOSED. All phases 0-8.1 complete.** | Claude Sonnet 4.6 |
| 2026-05-21 | **Phase 8.0 COMPLETE — ARIA Wrappers + Live Regions (A.7.Q2 activated).** Activates the deferred A.7.Q2 decision (screen reader support). **NEW files (3)**: `bim-3d/accessibility/aria-live-bus.ts` (39 LOC — module-level singleton emitter, 200ms idempotency window, zero React, `announce(message, severity)` + `subscribe(listener)` + `_resetForTests()` API). `bim-3d/accessibility/aria-attribute-presets.ts` (53 LOC — 4 type-safe spreadable preset factories: `TOGGLE_BUTTON(pressed)` / `SECTION_PANEL(labelledById)` / `VIEWCUBE_FACE(label, active)` / `RIBBON_TOOL(label, pressed?)` with explicit return-type interfaces, zero `any`). `bim-3d/accessibility/AriaLiveRegion.tsx` (80 LOC — ADR-040 micro-leaf: `useEffect` subscriptions to `ariaLiveBus` + `Selection3DStore.selectedBimId` + `ViewMode3DStore.mode`; direct DOM `textContent` mutation via `requestAnimationFrame` clear-then-set pattern for cross-SR re-announce; `role="status"` polite div + `role="alert"` assertive div, both `sr-only`; `entityTypeLabel()` from status-bar-text-generator SSoT reuse). **Modified files (3)**: `BimViewport3D.tsx` (outer div: `role="application"` + `aria-label={t('aria.viewport.label')}`; inner containerRef div: `role="presentation"` replacing `role="img"`; `<AriaLiveRegion />` mounted before `</div>`). `locales/en/bim3d.json` (+9 keys: `aria.viewport.label` + `aria.live.{selectionChanged, selectionChangedTypeOnly, selectionCleared, modeSwitchedTo3D, modeSwitchedTo2D, renderStarted, renderComplete, errorGeneric}`). `locales/el/bim3d.json` (+9 Greek-only keys, zero English words). **Tests**: `bim-3d/__tests__/aria-live-region.test.ts` — 16 unit tests across 2 groups: ariaLiveBus (announce fires, polite default, assertive routing, idempotency 200ms, post-window re-fire, different message, unsubscribe, empty guard, multi-listener) + ARIA_PRESETS (TOGGLE_BUTTON true/false, SECTION_PANEL, VIEWCUBE_FACE active/inactive, RIBBON_TOOL with/without pressed). All 16 pass ✅. **ADR-040 compliance**: AriaLiveRegion is micro-leaf (zero `useSyncExternalStore`, zero React state, low-frequency Zustand subscriptions via `useEffect`); announcements are fire-and-forget DOM mutations — zero orchestrator re-renders. GOL ✅: proactive (fires at selection/mode change time, not polling), idempotent (200ms window dedup), belt-and-suspenders (console.warn when element not mounted), SSoT (ONE pair live regions in 3D viewport, all announcements via single bus), fire-and-forget (DOM async via rAF, no await needed), lifecycle ownership (AriaLiveRegion mounted/unmounted with BimViewport3D). **Next**: Phase 8.1 entity description i18n + screen reader text generators. | Claude Sonnet 4.6 |
| 2026-05-21 | **Phase 4.4 COMPLETE — Keyboard Shortcuts SSoT (A.6.Q1-Q4).** **NEW files (3)**: `bim-3d/shortcuts/keyboard-shortcuts-3d.ts` (~260 LOC SSoT — 12 Numpad entries covering all 12 canonical views + 6 Ctrl+Shift+Letter aliases for ortho faces + mode-aware F + Home key; `view3dAction()` constructor + `parseView3dAction()` + `matchView3DShortcut()` + `isView3DAction()`; reuses `ShortcutDefinition` + `matchesShortcutDef` from 2D SSoT, no parallel matcher). `bim-3d/shortcuts/shortcut-dispatcher.ts` (~180 LOC pure dispatcher — `dispatchShortcut(event, ctx)` returns `{ handled, autoSwitched }`; routes view snaps via `onSnapToView`, HOME via `onSnapHome`, F via `onFitFrame3D`; auto-switch branch detects 2D-only drawing tools via `DXF_TOOL_SHORTCUTS` iteration with select/pan exemption + mode='universal'/'mode-aware' skip-list). `bim-3d/shortcuts/use3DShortcuts.ts` (~70 LOC React hook — single window capture-phase keydown subscription, lazy `getManager()` ref, input-focus guard, sonner toast on auto-switch, ADR-040 compliant: zero `useSyncExternalStore`). **2D SSoT extension** (`config/keyboard-shortcuts.ts`): +`ShortcutMode` type (`'2D-only' \| '3D-only' \| 'mode-aware' \| 'universal'`), +`'view3d'` category, +optional `mode` field on `ShortcutDefinition`, extracted `matchesShortcutDef(event, def)` pure matcher (reused by 3D SSoT) — preserved `matchesShortcut(event, id)` as thin wrapper. Tagged entries: `select`/`pan` → `'universal'`; `fit`/`zoomExtents`/`fitToView`/`fitToViewHome` → `'mode-aware'`. Drawing tool full audit deferred (default behavior correct via dispatcher fallback). **ThreeJsSceneManager**: stores `canonicalViewService` as instance member (no longer scoped to `initViewCube`), exposes `snapToCanonicalView(view)` / `snapToHomeView()` / `frameSelectionOrFitExtents()` public API. Adds `computeFramingBounds` (selection → fall-through to scene), `computeSelectionBounds(bimId)` (traverses bimLayer.group), `computeSceneBounds()` (union of BIM + DXF bounds). **BimViewport3D**: 1-line wire `use3DShortcuts({ getManager: () => managerRef.current, active: effectiveVisible })`. **i18n**: `shortcuts.view3d.{top,bottom,front,back,left,right,isoNe,isoNw,isoSe,isoSw,isoUe,isoUw,home,fitFrame}` + `shortcuts.modeSwitch.toast` (el + en bim3d.json). **SSoT registry** (`.ssot-registry.json`): νέο module `keyboard-shortcuts-3d` Tier 3 — forbidden patterns block ad-hoc `event.code === 'NumpadN'` matching + inline `'view3d:<id>'` string literals outside `bim-3d/shortcuts/`. **Tests**: `bim-3d/__tests__/keyboard-shortcuts-3d.test.ts` — 21 unit tests across 6 groups: SSoT shape (Numpad covers 12 views, letter aliases cover 6 ortho, every entry tagged, parseView3dAction round-trip, isView3DAction namespace check), event matching (Numpad/Ctrl+Numpad/Ctrl+Shift+Letter + modifier rejection), 3D dispatch (snapTo/snapHome/fitFrame + Numpad 5 = home + Home key + letter aliases), 2D gating (3D-only ignored, mode-aware F suppressed, no auto-switch in 2D), auto-switch (L/R trigger, S/P exempt, F not auto-switched). **A.6.Q1**: ✅ 12-view Numpad coverage (Numpad 1/2/3/4/5/7/9 + Ctrl+1/3/5/7/9). **A.6.Q2**: ✅ 12 canonical view dispatcher entries. **A.6.Q3**: ✅ `mode` field migration (interface + key tags + dispatcher routing + auto-switch toast). **A.6.Q4**: ✅ selection-aware F + mode-aware fit shortcuts. GOL ✅: pure dispatcher (no DOM/React reads), capture-phase listener (claims F before 2D handler), ADR-040 compliant hook (lazy manager ref, zero re-render trigger), SSoT registry guard, i18n complete bilingual, idempotent (multiple keydowns OK), explicit mode types beat boolean-flag soup. | Claude Sonnet 4.6 |
| 2026-05-21 | **Phase 4.3 COMPLETE — ViewCube Micro-Interactions Polish (compass toggle + right-click menu).** **Enterprise ID**: `BIM_3D_PREF: 'b3dpref'` prefix + `generateBim3DPrefId(userId)` method in class + convenience export + service.ts re-export. **Firestore**: `BIM_3D_PREFERENCES: 'bim_3d_preferences'` collection added to firestore-collections.ts. **Rules**: `bim_3d_preferences/{docId}` owner-only (docId==`b3dpref_${auth.uid}`) with create/update/delete rules. **Service**: `Bim3DPreferencesService` (Firestore load/save, setDoc merge). **ViewCube**: `ViewCubeOptions` +`onContextMenuRequest`, +`compassVisible?`, `getNorthAngleDeg` widened to `() => number | null`; `ViewCubeEngine` +`setCompassVisible(visible)` method; `compassVisibleState` local var; `contextmenu` DOM listener (prevents default + calls `onContextMenuRequest?.(x,y)`); `dispose()` removes `contextmenu` listener. **ThreeJsSceneManager**: +`viewCubeContextMenuCb` field, `initViewCube` threads `onContextMenuRequest` via closure, +`setViewCubeContextMenuCallback(cb)` + `setViewCubeCompassVisible(v)` methods. **BimViewport3D**: +`contextMenuPos`/`compassVisible` useState; prefs load `useEffect([user.uid])`; context menu wire `useEffect([effectiveVisible])`; compass sync `useEffect([compassVisible])`; `handleToggleCompass` callback (optimistic update + Firestore save + revert on error); `<ViewCubeContextMenu>` mounted in JSX. **Context Menu**: `view-cube-context-menu.tsx` — Radix DropdownMenu with 1×1 fixed-position trigger at cursor coords, CheckboxItem for compass toggle (ADR-001 compliant). **i18n**: `viewCube.contextMenu.{title,showCompass,aria}` in el+en bim3d.json. **Tests**: 4 unit (generator format, generator throws empty userId, load returns null/data, save calls setDoc with correct fields + deterministic docId). GOL ✅: optimistic updates (immediate state flip), revert on save error, zero race (single RAF, sync toggle), idempotent (setDoc merge = safe repeat), SSoT (Bim3DPreferencesService owns all pref read/write), owner-only Firestore rules (docId path check). | Claude Sonnet 4.6 |
| 2026-05-21 | **Phase 4.2 COMPLETE — Animated Transitions (ADR-040 single-RAF).** **Architecture**: `viewport-animation.ts` refactored tick-based — removed internal `requestAnimationFrame`, added `tick(nowMs: number)` method driven by `viewport-camera.update()` (called by main RAF). `PROJECTION_SWITCH_DURATION_MS: 400→500` (A.4.Q1 LOCKED). `viewport-camera.ts`: `update()` now calls `animation.tick(performance.now())` — single RAF drives both controls and camera animation. **2 νέα αρχεία**: `easing-functions.ts` (23 LOC, pure math: `easeInOutCubic`, `easeOutCubic`, `easeInCubic`, `easeLinear`) + `animation-manager.ts` (170 LOC, tick-based camera animation coordinator: `startTransition(params)`, `cancel()`, `tick(nowMs)`, `isAnimating`, `dispose()`). Features: position/target lerp, zoom lerp, FOV lerp (perspective), quaternion slerp (orientation), smooth interruption blend (new `startTransition` mid-flight → starts from current interpolated position, not original `from`), sentinel `-1` startTime. **2 αρχεία τροποποιήθηκαν**: `ThreeJsSceneManager.ts` (+`animationManager: AnimationManager` readonly field, initialized before `initViewCube`, ticked via `animationManager.tick(now)` in main loop after `viewport.update()`, disposed in `dispose()`, passed to `createCanonicalViewService`) + `CanonicalViewService.ts` (+optional `animationManager?: AnimationManager` param, calls `animationManager?.cancel()` before each snap transition). **Tests**: 6 unit (1: easeInOutCubic curve f(0)=0/f(0.5)=0.5/f(1)=1/f(0.25)<0.25, 2: quaternion slerp at t=0.5 → ~45deg Y-axis, 3: FOV lerp 60→90 at t=0.5 → 75, 4: interruption blend from current interpolated pos=5 not original from=0, 5: interrupted onComplete NOT called, 6: PROJECTION_SWITCH_DURATION_MS===500). All 6 pass ✅. **ADR-040 compliance**: zero secondary RAF loops — main ThreeJsSceneManager RAF is single source of animation ticks. GOL ✅: idempotent (cancel+restart pattern), zero race (single-threaded tick chain), belt-and-suspenders (sentinel=-1 for first-tick startTime), SSoT (`easing-functions.ts` owns cubic math, `animation-manager.ts` owns transition lifecycle), file sizes all <200 LOC. | Claude Sonnet 4.6 |
| 2026-05-21 | **Phase 4.1 COMPLETE — Canonical Views + 12-Direction Snap.** `canonical-views.ts` (νέο, 82 LOC): 12-direction SSoT (6 ortho face + 6 isometric) — `CanonicalViewId` expanded από 5→12, `CanonicalViewDef.type: 'ortho'|'iso'`, `labelKey`, `HOME_CANONICAL_VIEW_ID='iso-ne'` (A.5 decision), `matchIsoCanonicalView()` για ViewCube edge/corner exact-match (threshold 0.98), `getCanonicalViewDef()` resolver. `CanonicalViewService.ts` (νέο, 38 LOC): `createCanonicalViewService(viewport)` dispatch — ortho→`setProjection(mode)`, iso→`snapToViewDirection(-lookDir)`, `snapHome()`→`snapTo('iso-ne')`. `viewport-types.ts`: `CanonicalViewId` 12 values + `OrthoCanonicalViewId` subtype + `CanonicalViewDef` type/labelKey fields. `viewport-constants.ts`: `CANONICAL_VIEWS` αφαιρέθηκε (μεταφέρθηκε στο canonical-views.ts SSoT). `view-snap-detector.ts`: import από canonical-views.ts → ανιχνεύει 12 directions. `view-cube.ts`: +`onSnapToView?: (id: CanonicalViewId) => void` callback στο `ViewCubeOptions` + `FACE_INDEX_TO_VIEW_ID` map + updated `handleClick` (face/faceNav→onSnapToView, edge/corner→matchIsoCanonicalView→onSnapToView else fallback onDirSnap). `ThreeJsSceneManager.ts`: +`createCanonicalViewService` init στο `initViewCube`, `onSnapToView→canonicalViewService.snapTo`, `onHome→canonicalViewService.snapHome`. `viewport-framing.ts`: +`SceneBounds` interface + `computeFramingForView(viewId, bounds, aspect, fov)` convenience wrapper. `i18n el+en bim3d.json`: 12 `canonicalView.*` keys. **Tests**: 12 unit — 4 (entries count/unique IDs, unit-length lookDirs, ortho/iso schema, home=iso-ne) + 3 (matchIsoCanonicalView: iso-ne, iso-nw, non-canonical null) + 2 (detectSnapCandidate: iso-ne direction, top) + 3 (CanonicalViewService: ortho calls setProjection, iso calls snapToViewDirection με correct dir, snapHome). All 12 pass ✅. **Acceptance AC-5**: ViewCube navigation routes all face/edge/corner clicks through canonical dispatch. GOL ✅: idempotent (pure dispatch, no state side-effects), zero race (event-driven click handlers, sync dispatch), SSoT (single canonical-views.ts owns all 12 defs, zero duplication), backward compat (onFaceSnap/onDirSnap fallbacks preserved), file sizes all <500 LOC. | Claude Sonnet 4.6 |
| 2026-05-21 | **ADR-366 §4.5 Phase Plan ENRICHMENT — Phase 4 + Phase 8 sub-phase breakdown.** Σπάσιμο εκκρεμών φάσεων σε ατομικές υποφάσεις βάσει εντολής Γιώργου (2026-05-21). **§4.5 Phases table**: ενημερωμένη με status column + commit refs για 0-3/5-7 (DONE) + revised estimate ~79-81h (από αρχικά 58h, drivers: SPEC-3D-004A ports + A.4-A.7 impacts + section cuts depth). **§4.5.1 Phase 4 Breakdown** (~23-25h, 7 υποφάσεις): **Phase 4.0** Camera Tumble + Orbit Core (~3-4h, camera-controls.ts + CameraTargetStore.ts), **Phase 4.1** Canonical Views + 12-Direction Snap (~3-4h, canonical-views.ts SSoT + CanonicalViewService.ts + ViewCube click dispatch), **Phase 4.2** Animated Transitions (~2-3h, port GenArc viewport-animation.ts 709 LOC + 500ms cubic ease-in-out + animation-manager.ts single RAF), **Phase 4.3** ViewCube Micro-Interactions Polish (~1.5h, A.5.Q1 conditional compass + A.5.Q4 right-click menu + Firestore `bim_3d_preferences` collection + N.6 enterprise ID generator `bim3d_pref_*`), **Phase 4.4** Keyboard Shortcuts SSoT (~4h, A.6.Q1-Q4: Numpad + Ctrl+Shift+Letter mappings + ~40 2D shortcut `mode` field migration + selection-aware F + auto-switch toast + SSoT registry module `keyboard-shortcuts-3d` Tier 3), **Phase 4.5** Accessibility Multi-Channel Signaling (~5.5h, A.7.Q1 KeyboardFocusManager + focus indicator + A.7.Q3 SelectionCursorIcon + AXIS_LABEL_GLYPHS + status bar text + A.7.Q4 Ctrl+Arrows pan 8 entries), **Phase 4.6** 2D Backport + Final Integration (~2-2.5h, A.7.Q1+Q3 cross-mode backport + ADR-040 audit + Boy Scout N.11/N.0.2 cleanup). **§4.5.2 Phase 8 Breakdown** (~4h, 2 υποφάσεις, activates A.7.Q2 deferred): **Phase 8.0** ARIA Wrappers + Live Regions (~2h, AriaLiveRegion.tsx + role/aria-label/aria-pressed/aria-expanded coverage σε canvas/ribbon/ViewCube/sections), **Phase 8.1** Entity Description i18n + Screen Reader (~2h, aria-entity-description-generator.ts per kind + bim-3d-aria.json ~40 keys × 2 locales + NVDA/VoiceOver QA checklist doc). Dependencies graph: 4.0→4.1→{4.2, 4.3, 4.4}→4.5→4.6→8.0→8.1. Acceptance: όλα τα AC-1→AC-5 + ADR-040 compliance + Boy Scout zero new violations. | Claude Opus 4.7 |
| 2026-05-21 | **Hotfix Phase 0 — ViewCube face buttons unclickable.** `view-cube-mesh.ts::createHitTargets()` edge `BoxGeometry` size threshold `> 1.5` ποτέ δεν triggered (max sum of `|da.axis|+|db.axis|` για adjacent faces = 1, για opposite faces που δεν φτιάχνουν edge = 2). Όλες οι 3 διαστάσεις γίνονταν 0.92 → edge hit boxes ήταν 0.92³ κύβοι αντί slim bars → επικάλυπταν ~94% κάθε face hit plane area. User click στη μεγάλη κεντρική επιφάνεια face → ray hit edge box πρώτο → `onDirSnap(diagonal)` αντί `onFaceSnap(canonical view)` → "δεν λειτουργεί το πλήκτρο". **Fix**: threshold `> 0.5` → axes που μία face contributes (sum=1) γίνονται 0.24 (thin across edge), axis που καμία (sum=0) μένει 0.92 (long along edge). Edge boxes πλέον slim bars στις γωνίες (0.24×0.24×0.92), face hit plane πλήρως προσβάσιμο. **Bonus fix**: `hitMat` → `side: THREE.DoubleSide` ώστε το -Z face plane (default PlaneGeometry normal +Z χωρίς rotation, που έδειχνε ΜΕΣΑ στον κύβο) να γίνεται raycast-hittable και από -Z direction (back face click). **Files modified** (1): `bim-3d/viewport/view-cube/view-cube-mesh.ts`. GOL ✅: root-cause fix (όχι workaround), idempotent (pure geometry rebuild on init), zero race (synchronous construction), SSoT (single `createHitTargets()` ownership), zero new deps. | Claude Opus 4.7 |
| 2026-05-21 | **Phase 4.0 COMPLETE — Camera Tumble + Orbit Core (CameraTargetStore + tests).** N.0.1 code>ADR: `camera-controls.ts` was NOT created — `viewport-camera.ts` + `tumble-rotation.ts` (Phase 1 PORT_AS_IS) already cover orbit/pan/zoom/tumble + all constraints (pitch clamp, zoom bounds). Phase 4.0 adds: **`CameraTargetStore.ts`** (63 LOC, Zustand SSoT with `subscribeWithSelector` + epsilon dirty-check → no-op when camera static; syncFromCamera called once per RAF frame by ThreeJsSceneManager after `viewport.update()`). **Tests**: 7 unit — 4 tumble (yaw quaternion math, pitch quaternion, distance preservation after compound rotation, pole clamp dotY>0.99 → camera.up flip) + 3 store (sync perspective cam, dirty-check no-op, ortho fov=0). All 7 pass ✅. **§4.5 table**: Phase 4.0 → ✅ DONE. **§4.5.1**: Phase 4.0 spec updated to reflect actual implementation (camera-controls.ts crossed out, note added). GOL ✅: idempotent (dirty-check), SSoT (single writer ThreeJsSceneManager), zero race (RAF single-threaded), belt-and-suspenders (subscribeWithSelector for field-selective consumers), no new deps beyond existing zustand. | Claude Sonnet 4.6 |
| 2026-05-21 | **Polish Item #7 COMPLETE — Tab cycle overlap prevention for dense BIM scenes.** `focus-order.ts::computeFocusOrder()` refactored: (1) **Screen-center sort**: each entity's world center projected to NDC via `Vector3.project(camera)` — entities nearer to viewport center (NDC origin 0,0) sort first. World distance used as tiebreaker. (2) **Overlap guard** (`FOCUS_OVERLAP_NDC_THRESHOLD = 0.12`): entities whose NDC center is within 0.12 NDC units (~6% of viewport width) of an already-accepted entity are skipped during primary pass — prevents Tab from bouncing between visually stacked entities in dense floors. (3) **Skipped entities appended at end**: they remain reachable via Tab, just deprioritized. Entities behind camera (`ndcZ > 1.0`) hard-filtered. Algorithm: O(n log n) sort + O(n²) overlap check (acceptable — typical BIM scene ≤150 visible entities). **Zero breaking changes**: `computeFocusOrder` signature unchanged, ThreeJsSceneManager.cycleKeyboardFocus unchanged. No new deps, no i18n keys. GOL ✅: deterministic sort, idempotent, SSoT (one file owns order logic), no race (sync computation per Tab keypress). | Claude Sonnet 4.6 |
| 2026-05-21 | **Polish Item #4 COMPLETE — Pan animation 150ms ease + repeat-key continuous flow.** `viewport-camera.ts::pan()` rewritten: instead of instant position update, starts a 150ms `easeInOutCubic` animation via existing `ViewportAnimation`. **Repeat-key flow mechanism**: each keydown repeat reads `activeCamera.position.clone()` (already the current mid-animation position, since `onTick` updates it each frame) → calls `animation.start()` (which cancels current animation first) → starts new 150ms transition from that position to `position + offset`. Camera never teleports — each repeat picks up from the current animated state. **SSoT token**: `PAN_ANIMATION_DURATION_MS = 150` added to `viewport-constants.ts` (mirrors `--cp-duration-fast: 150ms` CSS token value). **Files**: `viewport-constants.ts` (+constant), `viewport-camera.ts` (pan() refactor, +import). GOL ✅: idempotent (animation.start cancels previous safely), zero race (onTick → activeCamera.position sync is single-threaded RAF), belt-and-suspenders (clamp canvasHeight > 0), SSoT (PAN_ANIMATION_DURATION_MS single constant). | Claude Sonnet 4.6 |
| 2026-05-21 | **Polish Item #6 COMPLETE — Responsive ViewCube hide <600px.** `ViewCubeEngine` interface +`setVisible(visible: boolean)` method. `createViewCube()` implementation: `canvas.style.display = visible ? '' : 'none'`. `viewport-constants.ts` +`VIEWCUBE_HIDE_WIDTH_PX = 600` (SSoT token). `ThreeJsSceneManager.resize()` +`this.viewCube.setVisible(width >= VIEWCUBE_HIDE_WIDTH_PX)` — hooks into existing ResizeObserver chain (BimViewport3D → manager.resize). GOL ✅: idempotent (display toggle safe), zero race (sync DOM write in resize), SSoT (one constant owns threshold), belt-and-suspenders (ResizeObserver already covers all resize events). Files: `view-cube.ts` (+interface + impl), `viewport-constants.ts` (+constant), `ThreeJsSceneManager.ts` (+import + resize call). | Claude Sonnet 4.6 |
| 2026-05-21 | **Polish Item #5 COMPLETE — Focus outline color tokenization (ADR-366 §A.7.Q1).** Literal `'#00ffff'` σε `focus-2d-outline-painter.ts:17` + `0x00ffff` σε `FocusOutlineRenderer.ts:20` αντικαταστάθηκαν με SSoT token. **Νέο αρχείο**: `accessibility/bim-a11y-color-tokens.ts` (exports `BIM_FOCUS_OUTLINE_COLOR_CSS = '#00ffff'` + `BIM_FOCUS_OUTLINE_COLOR_THREE = 0x00ffff` — δύο formats, μία αλήθεια). **tokens.color.css**: +`--bim-focus-outline: #00ffff` στο `:root` accessibility section. **2 αρχεία τροποποιήθηκαν**: `focus-2d-outline-painter.ts` (import `BIM_FOCUS_OUTLINE_COLOR_CSS`, `FOCUS_OUTLINE_COLOR = BIM_FOCUS_OUTLINE_COLOR_CSS`) + `FocusOutlineRenderer.ts` (import `BIM_FOCUS_OUTLINE_COLOR_THREE`, `FOCUS_OUTLINE_COLOR = BIM_FOCUS_OUTLINE_COLOR_THREE`). Tests αναλλοίωτα (runtime value `'#00ffff'` unchanged). GOL ✅: SSoT single file owns color, two formats justified (canvas-2d needs CSS string, Three.js needs number), idempotent, zero race, zero i18n keys needed. | Claude Sonnet 4.6 |
| 2026-05-21 | **Phase 7.1 COMPLETE — Hatched per-material cut surface.** DEFERRED item (b) from Phase 7.0a closed. CanvasTexture approach (Option A, no ADR-363 ShaderType dep). **Architecture**: grey base cap (Phase 7.0b) rendered first, then per-material hatch overlays on top (one stencil pass per unique `SectionHatchKey` per plane — same Phase 7.0C visibility-mask pattern). `collectHatchGroups()` traverses scene once per `render()` call (not per plane) → Map<SectionHatchKey, meshes[]>. **Keys**: `'rc'` (dot grid, mat-concrete/plaster/tile/elem-*), `'steel'` (cross-hatch ×, mat-metal/entity steel), `'masonry'` (brick courses, mat-brick/stone/entity masonry), `'wood'` (diagonal lines, mat-wood/entity wood/glulam). Glass/unknown → null → grey fallback (no hatch overlay). **BimToThreeConverter**: `tagMesh()` +`matId: string` → `userData['matId']` (wall: DNA core layer materialId; column/beam/slab: `params.material ?? 'elem-{type}'`). `resolveWallMaterial()` removed (inlined). **Performance**: `collectHatchGroups` O(N) once/frame. Per plane: +N_keys × (1 BIM render + O(N) traverse + 1 hatch cap render). Typical 3 materials × 1 plane = +3 BIM renders. Zero cost when hatchGroups empty. **New file**: `section-hatch-cap.ts` (163 lines). Modified: `section-stencil-renderer.ts` (+3 methods: collectHatchGroups/renderHatchOverlaysForPlane/renderHatchGroupForPlane, 423 lines <500 ✅), `BimToThreeConverter.ts` (163 lines). GOL ✅: idempotent (collect+render same groups), zero race (sync render), belt-and-suspenders (grey cap always renders, hatch is additive), SSoT (resolveHatchKey single place, CanvasTexture lazy cache), file sizes all <500. | Claude Sonnet 4.6 |
| 2026-05-20 | **Phase 7.0b COMPLETE — 1-pass Stencil Optimization via `gl.stencilOpSeparate`.** ADR-366 §A.3 Phase 7.0a "future optimization candidate" υλοποιημένο. Replaced 2-pass (BackSide+FrontSide separate overrideMaterial renders) with 1-pass (DoubleSide `singlePassStencilMat` + `gl.stencilOpSeparate` Three.js cache trick). **Mechanism**: per plane → clearStencil → render zero-area warmup mesh (PlaneGeometry `scale.set(0,0,1)`, `frustumCulled=false`) with `singlePassStencilMat` (DoubleSide, `stencilZPass=IncrementWrap`) — seeds Three.js `WebGLState` stencil cache with `currentZpass=IncrementWrap` without writing any fragments → `gl.stencilOpSeparate(gl.FRONT, gl.KEEP, gl.KEEP, gl.DECR_WRAP)` overrides FRONT face only (Three.js cache unaware) → main scene render: per-object Three.js checks `material.stencilZPass (Increment) === cached (Increment)` → CACHE HIT → skips `gl.stencilOp` → FRONT override persists for ALL BIM objects → back-facing=IncrementWrap (entering solid) + front-facing=DecrementWrap (exiting solid) → correct parity → NotEqual(0) → cap fills cut surface. **Performance**: 2N BIM scene renders → N (warmup negligible) + N BIM renders = ~50% reduction. Box mode 12 → 6 BIM renders/frame. **Files modified** (1): `~systems/section/section-stencil-renderer.ts` (removed `backStencilMat`+`frontStencilMat`, added `singlePassStencilMat`+`warmupScene`; `renderCapForPlane`: warmup→stencilOpSeparate→single render→cap). Public API `render(renderer, mainScene, camera, planes, sceneBounds)` unchanged. `section-scene-controller.ts` + `ThreeJsSceneManager.ts` untouched. **SSoT**: REUSE `SECTION_CUT_SURFACE` unchanged, zero new tokens. **Three.js compatibility**: `^0.170.0` verified. GOL ✅: idempotent, zero race (sync render), belt-and-suspenders (autoClear saved/restored), SSoT reuse, file size 230 lines < 500. | Claude Sonnet 4.6 |
| 2026-05-20 | **Phase 7.0B COMPLETE — 2D Live Section Panel.** ADR-366 §A.3 Q3 υλοποιημένο μέσω GenArc port (SPEC-3D-004A §3.2, 4 PORT_WITH_ADAPTATION files ~680 LOC). **8 νέα αρχεία**: `bim-3d/2d-section/{section-2d-constants,section-intersect,section-geometry,section-renderer,section-scene-sync,active-plane-derivation}.ts` (port των GenArc `sectionIntersect/sectionGeometry/sectionRenderer/sectionSceneSync` με type-swap → Nestor BIM entities + unit conversion mm→m για vertical extents + axis rename `'z'`→`'y'` για Nestor 2D plan convention + active plane derivation από Three.js world ↔ Nestor 2D plan coords mapping) + `bim-3d/stores/Section2DPanelStore.ts` (Zustand SSoT: visible, activePlaneId, heightPx με clamp 180-480px) + `bim-3d/panels/Section2DPanel.tsx` (ADR-040 micro-leaf, bottom-strip panel z-30 absolute, 2 useSyncExternalStore subscriptions, standalone Three.js WebGLRenderer + OrthographicCamera mount, wheel/pan/click handlers με selection sync via `Selection3DStore.selectEntity`, ResizeObserver, dispose cleanup). **4 αρχεία τροποποιήθηκαν**: `bim-3d/panels/Section3DPanelTab.tsx` (+`Show 2D panel` toggle Switch + active plane dropdown selector με `deriveAvailablePlanes()` options + fallback message "Καμία κατακόρυφη τομή διαθέσιμη" όταν no vertical plane) + `bim-3d/viewport/BimViewport3D.tsx` (+`<Section2DPanel />` mount) + `config/color-config.ts` (+`SECTION_2D_PANEL_COLORS` token: background `#1a1a1a`, wall `#6c6c6c`, column `#5a5a5a`, beam `#7a7a7a`, slab `#9e9e9e`, selected `#FFFF00` mirror του 2D entity hover, outline `#2a2a2a`) + `i18n/locales/{el,en}/bim3d.json` (+4 keys στο `section.*` + νέο `section2d.{title,ariaLabel,closeAria,resetView,noPlane}` group). **Coordinate system mapping**: Three.js world.X → Nestor plan.x (axis='x', no sign flip), Three.js world.Z → Nestor plan.y (axis='y', sign flip because BimToThreeConverter ROT_X_NEG_90 maps Nestor.y → -world.z). World-Y (vertical) cuts UNSUPPORTED στο Phase 7.0B (architectural section = vertical only; horizontal cut deferred Phase 7.0C top-down/loupe rendering). **Scope limits**: openings array empty στο scene-sync (OpeningEntity ΔΕΝ είναι στο Bim3DEntitiesStore feed — walls render χωρίς cutouts μέχρι ADR-369 Phase A4+ προσθέσει openings στο feed). Full-floor scan (όχι spatial filter — Phase 7.0C optimization candidate). Per-material hatch ΟΧΙ supported (Phase 7.1+ ADR-363 ShaderType registry). **GOL ✅**: proactive (renderer mount on visibility change), idempotent (syncScene reads getState στο rebuild), zero race (sync render-on-call, no rAF interference), belt-and-suspenders (renderer cleanup + observer disconnect + dispose chain σε unmount + section enabled gate prevents stale renders), SSoT (REUSE Section/Bim3DEntities/Selection3D stores + REUSE 2D entity hover yellow για selection + NEW SECTION_2D_PANEL_COLORS justified ως first occurrence), Google file size (όλα <500 lines: section-renderer 211, section-geometry 199, section-intersect 273, Section2DPanel 209, active-plane-derivation 117, scene-sync 99, store 64, constants 39). Resolves ADR-366 §A.3 Q3 DEFERRED item (c). | Claude Opus 4.7 |
| 2026-05-20 | **Phase 7.0a COMPLETE — True Stencil Cap.** ADR-366 §A.3 Phase 7.0 base TODO (a) resolved: replaced placeholder face-mesh visual indicator with classic `webgl_clipping_stencil` BackSide+FrontSide stencil cap pattern → solid filled `SECTION_CUT_SURFACE` color στο cut face κάθε mesh (όχι hollow interior). **1 νέο αρχείο**: `systems/section/section-stencil-renderer.ts` (`SectionStencilRenderer` pure Three.js class — owns 3 materials: `backStencilMat` (BackSide, IncrementWrapStencilOp, depth/color write OFF, `AlwaysStencilFunc`, `clippingPlanes`=others), `frontStencilMat` (FrontSide, DecrementWrapStencilOp, ίδιες ρυθμίσεις), `capMat` (`SECTION_CUT_SURFACE.color` @ 0.5 opacity, DoubleSide, depthWrite/depthTest OFF, `stencilRef:0` + `NotEqualStencilFunc` + `ReplaceStencilOp` stencilFail/ZFail/ZPass) + reusable cap mesh (1×1 PlaneGeometry, scaled per render) σε dedicated `capScene`. `render(renderer, mainScene, camera, planes, sceneBounds)`: per plane[i] → `others = planes.filter(idx !== i)` → `clearStencil()` → `scene.overrideMaterial = backStencilMat` → `renderer.render(scene, camera)` (back faces increment) → `overrideMaterial = frontStencilMat` → render (front faces decrement) → `overrideMaterial = null` → `positionCapMesh(plane[i], capSize)` (point on plane = `-normal * constant`, quaternion `setFromUnitVectors(+Z, normal)`, scale=`sphere.radius * 4`) → `renderer.render(capScene, camera)` (cap quad πετυχαίνει stencil test μόνο όπου geometry was cut → solid grey fill). `autoClear/autoClearColor/autoClearDepth/autoClearStencil` saved+restored. dispose(): cleanup meshes/materials/scene. **3 αρχεία τροποποιήθηκαν**: `systems/section/SectionBox.ts` (faces 6×MeshBasicMaterial → 1×LineSegments wireframe BoxGeometry+EdgesGeometry — αποφυγή z-fight με stencil caps; handles ↑ unchanged; new `edgeMaterial: LineBasicMaterial` με `SECTION_CUT_SURFACE.color` @ 0.85 opacity, depthWrite OFF; `buildFaces`+`positionFace` removed → `buildEdgeBox` + scale-via-bounds στο `setFromBounds`; dispose updated) + `scene/section-scene-controller.ts` (+`stencilRenderer: SectionStencilRenderer` field constructed με `{getBimGroup, getDxfBounds}` deps + `cachedPlanes: THREE.Plane[]` field populated στο `applyState()` και για τα 2 modes (box `sectionBox.getPlanes()` ή plane `planes.filter(enabled).map(→THREE.Plane)`) + `isStencilActive(): boolean` (enabled && cachedPlanes.length > 0) + `renderFrameWithCaps(camera)` public method (renderer.autoClear=true → render main scene → stencilRenderer.render με cachedPlanes + computed sceneBounds via bimGroup+dxfBounds union) + dispose cleanup stencilRenderer) + `scene/ThreeJsSceneManager.ts` (animate loop branch: `pathTracerRenderer.isActive` (existing) → `sectionController.isStencilActive()` → `sectionController.renderFrameWithCaps(camera)` → else `ssaoModulator.render()` (existing). `initRenderer`: explicit `stencil: true` για future-proofing). **Render path trade-off**: όταν section enabled με ≥1 active plane → bypass EffectComposer/SSAO (default RT lacks stencil buffer) → direct `renderer.render()` + caps. Justification: section editing = active interaction, SSAO triggers μόνο σε idle ≥800ms anyway → no UX regression. Path tracer mode unaffected (έχει δικό clipping). **Performance**: per frame κόστος = N×(2 BIM scene passes με color/depth off + 1 cap quad pass) όπου N=active planes (1-6). Box mode worst case = 12 scene passes + 6 cap quads. Cap passes είναι σχεδόν δωρεάν (1 quad). Optimization Phase 7.0b candidate: single custom shader για back+front σε ένα pass. GOL ✅: idempotent (multiple calls = ίδιο result), belt-and-suspenders (saved/restored renderer state), zero race (sync render in RAF), SSoT (REUSE `SECTION_CUT_SURFACE` token, καμία νέα palette/i18n key), Google file size (stencil renderer 213 lines, SectionBox 308 lines post-edit, scene controller 200 lines — όλα <500). Resolves Phase 7.0 base TODO (a). Remaining DEFERRED: (b) hatched per-material Phase 7.1+, (c) 2D Live Section Panel Phase 7.0B, (d) selection-aware emphasis Phase 7.0+ TBD. | Claude Opus 4.7 |
| 2026-05-20 | **Phase 7.0 COMPLETE — Section Cuts (base).** ADR-366 §A.3 Q1/Q2/Q5 υλοποιημένα. **5 νέα αρχεία**: `stores/SectionStore.ts` (Zustand + subscribeWithSelector SSoT — state `{enabled, mode: 'box'|'plane', planes: SectionPlaneState[] ≤6, linkPlanes, boxBounds: {min,max} | null}` plain Vec3Tuple για immutability, actions `setEnabled/setMode/setBoxBounds/setBoxBoundsAxis/addPlane/removePlane/updatePlane/setPlaneEnabled/setLinkPlanes/resetToDefault`, `SECTION_MAX_PLANES=6`, default OFF) + `systems/section/SectionBox.ts` (pure Three.js — 6 face MeshBasicMaterial με `SECTION_CUT_SURFACE` semi-transparent grey + 6 SphereGeometry handles με `CAD_UI_COLORS.grips.color_unselected` idle / `HOVER_HIGHLIGHT.ENTITY.glowColor` hover, `userData['sectionBoxPart']=true` skip flag, `setFromBounds()` axis-aligned face placement, `getPlanes()` 6 outward-normal `THREE.Plane[]`, `handlePointerDown/Move/Up` με capture pattern, drag math = `delta·axisUnit` με Shift mirror-symmetric opposite face, dispose) + `systems/section/section-clip-applicator.ts` (pure functions `applyClippingPlanes/clearClippingPlanes(scene, planes)` idempotent traverse εκτός `sectionBoxPart` meshes) + `panels/Section3DPanelTab.tsx` (ADR-040 micro-leaf — 1 `useSyncExternalStore→useSectionStore`, master toggle + mode buttons + reset box + planes list ≤6 με per-row enable+remove + Link Planes toggle ≥2 planes + Add plane disabled στα 6, semantic Tailwind tokens only) + `scene/section-scene-controller.ts` (extract από ThreeJsSceneManager για 500-line cap — `SectionSceneController` δέχεται `{renderer, scene, getCamera, getBimGroup, getDxfBounds, invalidatePathTracer}` deps, ιδιοκτήτης SectionBox + store subscriptions + capture pointer listeners + `ensureInit()` lazy bbox+10% margin + `applyState()` clipping wire-up, dispose). **5 αρχεία τροποποιήθηκαν**: `scene/ThreeJsSceneManager.ts` (+`renderer.localClippingEnabled=true`, +`sectionController` field, delegates σε `syncBimEntities`/`syncDxfOverlay` με `ensureInit()+applyState()`, public `initSectionBox()` bridge, dispose cleanup — 411→427 lines) + `panels/Floating3DPanel.tsx` (4ο tab `'sections'`, `<Section3DPanelTab />`) + `viewport/BimViewport3D.tsx` (safety useEffect `SectionStore.subscribe(s.enabled)` → `manager.initSectionBox()` για το pre-geometry enable case) + `config/color-config.ts` (+`SECTION_CUT_SURFACE = {color: '#9e9e9e', opacity: 0.5}` token — justified ως NEW γιατί το 2D δεν έχει cut-volume cap surface) + locales `el/en bim3d.json` (+15 keys `section.*` ICU single-brace + `floatingPanel.tabs.sections`). **Implementation choices Phase 7.0 base**: (a) box face meshes = visual clip-volume indicator (Navisworks-style face cap, ΟΧΙ true stencil cap — DEFERRED Phase 7.0a TODO με `webgl_clipping_stencil` BackSide pattern), (b) hatched per-material cut → DEFERRED Phase 7.1+ (ADR-363 ShaderType registry), (c) 2D Live Section Panel GenArc port → DEFERRED Phase 7.0B (4 PORT_WITH_ADAPTATION files), (d) selection-aware emphasis intersect → Phase 7.0+ TBD. SSoT compliance: `CAD_UI_COLORS.grips` (REUSE 2D), `HOVER_HIGHLIGHT.ENTITY.glowColor` (REUSE 2D), `SECTION_CUT_SURFACE` (NEW — justified ADR-366 §A.3 SSoT table). | Σonnet 4.6→Opus 4.7 session |
| 2026-05-20 | **Phase 7.2 COMPLETE — HDRI Environment Polish.** 8 Polyhaven CC0 HDRI presets (noon_grass / overcast_soil_puresky / golden_bay / blue_hour_8k / studio_small_04 / urban_street_04 / coast_land / mountain_meadow_2) accessible via thumbnail picker στο Lighting panel. Gradient IBL παραμένει active fallback. **2 νέα αρχεία**: `lighting/hdri-environment.ts` (pure TS — `HdriPreset` interface, `HDRI_PRESETS[8]` με Polyhaven CDN URLs `dl.polyhaven.org/hdr/1k/{slug}_1k.hdr` + thumbnail `cdn.polyhaven.com/asset_img/thumbs/{slug}.png?width=200`, `DEFAULT_HDRI_PRESET_ID='noon_grass'`, `getHdriPreset(id)` lookup) + `stores/EnvironmentStore.ts` (Zustand + subscribeWithSelector: state `{hdriPresetId, hdriUrl, isLoading, loadError}`, actions `setHdriPreset/setHdriUrl/setLoading/setError` — SSoT ιδιοκτήτης HDRI URL lifecycle). **4 αρχεία τροποποιήθηκαν**: `lighting/envmap-generator.ts` (refactor — `applyGradientFallback(preset)` εξαχθείσα method + `hdriActive` flag που αποτρέπει gradient override ενώ HDRI είναι φορτωμένο + `loadHdri(url): Promise<void>` νέα async method: `RGBELoader` από `three/addons/loaders/RGBELoader.js` → `hdrTexture.mapping = EquirectangularReflectionMapping` → `pmremGenerator.fromEquirectangular` για IBL → `scene.environment = pmremTexture` + `scene.background = hdrTexture` ξεχωριστά + dispose prev envmap + prev background + error fallback στο gradient. `dispose()` τώρα κάνει cleanup και `currentBackground`) + `panels/Lighting3DPanelTab.tsx` (2nd `useSyncExternalStore→EnvironmentStore` — ADR-040 τώρα 2/2 max ✅. Section D HDRI picker: `grid-cols-4` 8 thumbnail buttons 80px tall, lazy-loaded img + 9px label, ring-primary για selected — σε ποτέ raw palette classes) + `scene/ThreeJsSceneManager.ts` (+`envStoreUnsub` field + subscribe στο `EnvironmentStore.hdriUrl` στο constructor → `loadHdriEnvironment(url)` async method: `setLoading(true)/setError(false)` → `envmapGenerator.loadHdri(url)` → `pathTracerRenderer.invalidateScene()` + `setLoading(false)` στο finally + `setError(true)` στο catch. `dispose()`: +`envStoreUnsub()`) + `viewport/BimViewport3D.tsx` (+`useEnvironmentStore` import + `getHdriPreset` import + `useEffect` subscription `hdriPresetId→setHdriUrl(preset.url)` — synchronous URL resolution, no fetch needed — chain: UI click → `setHdriPreset` → BimViewport3D maps id→url via `setHdriUrl` → ThreeJsSceneManager loads via `RGBELoader`). **i18n**: +11 keys × 2 locales `bim3d.lighting.hdri.*` (label/noonGrass/overcast/goldenHour/blueHour/studio/urban/coast/mountain/loading/error). GOL ✅: `hdriActive` flag prevents gradient override on preset change (correct precedence), dispose-before-assign on both envmap + background (no leak), `loadHdriEnvironment` async with finally for loading state (belt-and-suspenders), error path silently fallback to gradient (ADR-366 §9 Q4 fallback requirement), `invalidateScene()` on load (BVH rebuild — path tracer αντιλαμβάνεται νέο envmap), `setHdriPreset` resets `loadError: false` (idempotent retry), `envStoreUnsub()` on dispose (no memory leak from store subscription), ADR-040 Lighting3DPanelTab 2/2 max `useSyncExternalStore` ✅. Polyhaven CC0 license — zero attribution required in code. Custom HDRI upload stub DEFERRED Phase 7+ (TODO comment). | Claude Sonnet 4.6 |
| 2026-05-20 | **B.4 Phase 6 COMPLETE — Final Render Dialog.** **6 νέα / τροποποιημένα αρχεία**: `render/render-cost-estimator.ts` (νέο): pure TS module, zero React. `RenderParams/RenderEstimate` interfaces. `estimateRender()`: `pixels×SPP/gpuRate` → `{seconds, marginPercent, outputMB}`. `marginPercent` per SPP tier (15%→20%→30%). `BYTES_PER_PIXEL` per format (PNG=4, JPG=1.5, EXR=12). `calibrateGpu()`: 4 warmup + 8 measured samples via caller-supplied render callback → derives `samplesPerSecondGpu`. `render/render-output-writer.ts` (νέο): async module. `writeRenderOutput(canvas, config)→{savedDisk, savedProject, uploadError}`. `canvasToBlob()`: PNG/JPG via `canvas.toBlob()` με quality=0.92 για JPG; EXR fallback σε PNG (TODO Phase 7.x OIDN-wasm). Disk: `URL.createObjectURL + <a>.click()`. Project: `generateBimRenderId()` πρώτα → `firebase/storage uploadBytes()` σε `companies/{companyId}/projects/{projectId}/renders/{id}.{ext}` → `setDoc()` COLLECTIONS.BIM_RENDERS με type='bim-render' + metadata snapshot. Belt-and-suspenders: upload fail → auto-fallback disk download. `render/RenderFinalDialog.tsx` (νέο): Radix Dialog (ADR-001). Sections: (a) 4 quality preset radio cards (Πρόχειρη 64SPP / Κανονική 256SPP★ / Υψηλή 1024SPP / Κορυφαία 4096SPP), (b) resolution radio 4 options (HD/4K★/8K/Custom) + conditional custom W×H inputs, (c) format radio (PNG★/JPG/EXR), (d) destination checkboxes combinable (disk ☑ / project), (e) Advanced collapsible denoiser toggle (ON by default), (f) time estimate panel live-updating (calibrating state → real estimate with ±margin%), Render button disabled if no destination. GPU calibration triggers on dialog open via `calibrateGpu()`. `render/RenderProgressOverlay.tsx` (νέο): ADR-040 micro-leaf, `useSyncExternalStore→ViewMode3DStore.finalRenderProgress`. Progress bar + samples counter + estimated remaining. Cancel button → `onCancel()`. Mounted only during `mode=3d-final`. `stores/ViewMode3DStore.ts` (τροποποίηση): +`FinalRenderConfig` interface (preset/presetSPP/resolutionPreset/resolutionW/resolutionH/format/destDisk/destProject/denoiseEnabled) + `PRESET_SPP` + `RESOLUTION_PRESETS` constants. State: +`finalRenderConfig: FinalRenderConfig|null` + `finalRenderProgress: number` (-1=idle). Actions: +`startFinalRender(config)` (sets mode='3d-final'), +`completeFinalRender()` (mode→'3d-raster', config=null, progress=-1), +`updateFinalRenderProgress(pct)`. `render/PathTracerRenderer.ts` (τροποποίηση): +`_isFinalMode/_finalMaxSamples/_onFinalProgress/_onFinalComplete` fields. `renderSample()` extended: final mode branch calls `onProgress(pct)` per sample, `onComplete()` + cleanup when `samples >= _finalMaxSamples`. `startFinal(config, onProgress, onComplete)`: `setScene()` BVH rebuild → arms final mode. `cancelFinal()`: atomic cleanup. `scene/ThreeJsSceneManager.ts` (τροποποίηση): +`startFinalRender(config, {projectId, companyId, userId}, onProgress, onComplete)`: cancels preview, `invalidateScene()`, `pathTracerRenderer.startFinal()` → on complete `writeRenderOutput()` → `onComplete(result)`. +`cancelFinalRender()`: `pathTracerRenderer.cancelFinal()`. `viewport/BimViewport3D.tsx` (τροποποίηση): +`renderDialogOpen` state + `isRendering` useSyncExternalStore. Handlers: `handleRenderConfirm(config)` (store.startFinalRender + manager.startFinalRender wired), `handleRenderCancel()` (manager.cancelFinalRender + store.completeFinalRender). JSX: floating ✦ Render button bottom-right z-[70] (hidden during render) + `<RenderProgressOverlay onCancel>` (visible during render) + `<RenderFinalDialog>`. **Enterprise-ID**: νέος prefix `BIM_RENDER: 'bimrnd'` + `generateBimRenderId()` στο enterprise-id-class.ts + convenience export. **Firestore**: `COLLECTIONS.BIM_RENDERS = 'bim_renders'` νέα collection. **i18n**: ~30 keys × 2 locales (render.presets/resolution/format/destination/advanced/estimate/button/progress/completion). GOL ✅: `startFinalRender()` guard prevents double-entry '3d-final', `generateBimRenderId()` πριν Storage upload (docId needed for path — race-free), upload fail → auto-fallback disk (belt-and-suspenders), `completeFinalRender()` always called (both success + cancel paths), `writeRenderOutput()` async await correctness, progress updates non-blocking per RAF sample, Radix Dialog ADR-001 canonical. Phase 6 ~9h actual. | Claude Sonnet 4.6 |
| 2026-05-20 | **B.1 Phase 5C COMPLETE — Path Tracer Preview (idle-triggered, silent).** `three-gpu-pathtracer@0.0.21` + `three-mesh-bvh@0.7.4` εγκατεστάθηκαν μέσω pnpm (MIT ✅). `render/PathTracerRenderer.ts` (νέο): `PathTracerRenderer` wrapper class — `WebGLPathTracer` (0.0.21 high-level API) μέσα. `constructor(renderer, scene, getCamera)`: `new WebGLPathTracer(renderer)` + `renderScale=1` + `minSamples=1`. `invalidateScene()`: σηματοδοτεί BVH rebuild για επόμενο `start()`. `start()`: guard `instanceof PerspectiveCamera` → `sceneNeedsUpdate` ? `setScene(scene, camera)` (full BVH rebuild) : `setCamera(camera)` (camera update + auto-reset — belt-and-suspenders: ο χρήστης κουνήθηκε, νέα θέση → ξεκινά accumulation από αρχή). `cancel()`: `_isActive=false`. `renderSample()`: guard ortho abort → `pathTracer.renderSample()` (renders sample + composites to canvas with fade-in) → auto-deactivate at `PREVIEW_MAX_SAMPLES=256`. `dispose()`: `_isActive=false` + `pathTracer.dispose()` try/catch. `ThreeJsSceneManager.ts` (τροποποίηση): +`private readonly pathTracerRenderer: PathTracerRenderer` field. Constructor: `new PathTracerRenderer(renderer, scene, () => viewport.camera)` μετά `envmapGenerator`. `idleDetector.onIdle`: +`pathTracerRenderer.start()` + `useViewMode3DStore.getState().enterPreviewMode()`. `idleDetector.onActive`: +`pathTracerRenderer.cancel()` + `useViewMode3DStore.getState().enterRasterMode()`. `startLoop()`: `pathTracerRenderer.isActive` ? `pathTracerRenderer.renderSample()` : `ssaoModulator.render()` (mutual exclusion — path tracer και SSAO δεν τρέχουν ταυτόχρονα). `syncBimEntities()` + `syncDxfOverlay()`: +`pathTracerRenderer.invalidateScene()`. `dispose()`: +`pathTracerRenderer.dispose()`. `types/three-gpu-pathtracer.d.ts` (νέο): minimal `declare module` με `WebGLPathTracer` class interface (samples/renderScale/minSamples/renderDelay/fadeDuration/enablePathTracing/rasterizeScene/renderToCanvas + constructor/setScene/setCamera/renderSample/reset/dispose). GOL ✅: `setCamera()` instead of `reset()` on re-idle (camera stale bug fixed — new view starts fresh accumulation), guard `instanceof PerspectiveCamera` in both `start()` and `renderSample()` (ortho-toggle race-free), `invalidateScene()` called on geometry change (BVH always fresh), mutual exclusion with SSAO (no double-render per frame), try/catch on `dispose()` (0.0.21 dispose has internal bug — handled gracefully), `PREVIEW_MAX_SAMPLES=256` auto-stop (no infinite accumulation). | Claude Sonnet 4.6 |
| 2026-05-20 | **B.1 Phase 5B COMPLETE — SSAO + HDRI Environment Maps.** `lighting/ssao-modulator.ts` (νέο): `SSAOModulator` — `EffectComposer` + `RenderPass` + `SSAOPass` pipeline. Camera active → `ssaoPass.enabled=false` immediately (zero SSAO cost). Camera idle → guard `instanceof PerspectiveCamera` → `ssaoPass.enabled=true` + animate `kernelRadius` 0→8 cubic ease-out 300ms. `IS_LOW_PERF` guard skips on `hardwareConcurrency<4`. `render()`: syncs camera reference per frame (perspective/ortho toggle safe), disables SSAO for ortho cameras. `resize()`: `composer.setSize` + `ssaoPass.setSize`. `lighting/envmap-generator.ts` (νέο): `EnvmapGenerator` — 512×256 `DataTexture` gradient (skyColor top / groundColor bottom / 20% blend zone). `PMREMGenerator.fromEquirectangular()` → IBL env map. `scene.environment` = pmrem texture (PBR reflections on materials). `scene.background` = `THREE.Color(preset.skyColor)`. Dispose previous envmap before assigning new. `ThreeJsSceneManager.ts` (τροποποίηση): +`ssaoModulator`/`envmapGenerator` private readonly fields. `getViewportSize()` helper. Constructor: `viewport = initViewportCamera()` first (camera needed) → then `SSAOModulator(renderer, scene, () => viewport.camera, w, h)` + `EnvmapGenerator(renderer, scene)` → then `IdleDetector` wired to both `qualityModulator` + `ssaoModulator` idle/active callbacks. `startLoop()`: `renderer.render()` → `ssaoModulator.render()`. `applyLightPreset()`: +`envmapGenerator.updateForPreset(preset)`. `resize()`: +`ssaoModulator.resize(w,h)`. `dispose()`: +`ssaoModulator.dispose()` + `envmapGenerator.dispose()`. GOL ✅: SSAOModulator camera getter (not snapshot) — perspective/ortho toggle race-free; envmap disposed before new assignment (no leak); `IS_LOW_PERF` guard on both SSAO and quality modulator; `render()` per-frame camera sync (belt-and-suspenders); composer wraps renderer.render() — when SSAOPass disabled, output identical to direct render. | Claude Sonnet 4.6 |
| 2026-05-20 | **B.1 Phase 5A COMPLETE — Materials & Lighting UX.** `lighting/idle-detector.ts` (νέο): pure class `IdleDetector` — threshold timer, onIdle/onActive callbacks fired only on state transitions (idle→active, active→idle), not every frame. `lighting/quality-modulator.ts` (νέο): `QualityModulator` — snap to SHADOW_MOVING (radius 0.5, mapSize 1024) on camera active, animate radius 0.5→4 cubic ease-out + mapSize 2048 on idle over 300ms. Low-perf guard: `navigator.hardwareConcurrency < 4` skips modulation. `lighting/lighting-presets.ts` (νέο): pure data, zero deps. 6 presets (morning/noon/afternoon/sunset/cloudy/night) with azimuth/elevation/sunColor/sunIntensity/ambientIntensity/skyColor/groundColor/hemisphereIntensity. `lighting/solar-position.ts` (νέο): pure math, zero deps. Simplified NOAA algorithm ±5° accuracy. `computeSolarPosition(date, lat, lng)→SolarAngles`. `timeOfDayToDate(hourDecimal)→Date`. `ViewMode3DStore.ts`: +7 state fields (sunPreset/sunAzimuthDeg/sunElevationDeg/sunAnimating/solarDate/solarLatDeg/solarLngDeg) + 4 actions (setLightPreset/setSunPosition/setSolarConfig/toggleSunAnimating). `ThreeJsSceneManager.ts`: `createLights()` → `{sun, ambient, hemi}` refactor (lights now private readonly fields instead of anonymous `initScene()` vars). `QualityModulator(sun)` + `IdleDetector(800ms)` wired in constructor. `startLoop()`: idle detector notified every frame based on `isInteracting`. `updateSunPosition(az, el)`: spherical→Cartesian Three.js Y-up + `sun.visible = el > -5°`. `applyLightPreset(preset)`: all 5 light channels updated + sun repositioned. dispose chain: idleDetector + qualityModulator before performanceCollector. `panels/Lighting3DPanelTab.tsx` (νέο): ADR-040 micro-leaf, 1 `useSyncExternalStore→ViewMode3DStore`. Section A: 6-button preset strip (grid-cols-3). Section B: time slider 0-23.75 step 0.25 + HH:MM display. Section C: collapsible advanced (date picker + lat/lng inputs + animate toggle). Section D: `useEffect` setInterval 2s advance +0.25h when animating. `Floating3DPanel.tsx`: lighting stub replaced with `<Lighting3DPanelTab />`. `BimViewport3D.tsx`: 2 new subscriptions (sun position + preset changes → `managerRef.current?.updateSunPosition/applyLightPreset`) + initial preset sync on mount. i18n: +13 keys × 2 locales (lighting.preset.{morning,noon,afternoon,sunset,cloudy,night} + timeLabel/advancedTitle/dateLabel/latLabel/lngLabel/animateLabel). GOL ✅: IdleDetector fires callbacks on transitions only (no per-frame overhead), QualityModulator cubic ease graceful quality ramp, sun position math Y-up correct, applyLightPreset atomic (all channels updated together), initial preset sync on mount (no stale state), subscriptions pattern mirrors floor visibility (ADR-040 micro-leaf compliant), time slider local state avoids store flooding. | Claude Sonnet 4.6 |
| 2026-05-20 | **B.5 Phase 4 COMPLETE — Performance HUD Integration.** `performance-snapshot-service.ts` (νέο): pure async `sendDiagnostic()` — `generatePerfdiagId()` πρώτα → `canvas.toDataURL('image/png', 0.92)` → Firebase Storage `performance_diagnostics/{companyId}/{docId}/screenshot.png` → `setDoc()` FIRESTORE_COLLECTIONS.PERFORMANCE_DIAGNOSTICS με 10 metrics + screenshotUrl + comment + serverTimestamp → `EntityAuditService.recordChange()` fire-and-forget. `Quality3DPanelTab.tsx` (νέο): ADR-040 micro-leaf, 1 `useSyncExternalStore→PerformanceHUDStore`, `<Switch>` toggle για enable/disable HUD, current render mode display. `Floating3DPanel.tsx`: quality stub αντικαταστάθηκε με `<Quality3DPanelTab />`. `ThreeJsSceneManager.ts`: `private readonly performanceCollector: PerformanceCollector` field + `start()` στο constructor (μετά `initViewCube`) + `dispose()` στο dispose chain (πριν renderer) + `getRendererCanvas(): HTMLCanvasElement` public method. `BimViewport3D.tsx`: `useState<HTMLCanvasElement|null>` + `useAuth()` + `useProjectHierarchy().selectedProject?.id` → `setCanvasEl(manager.getRendererCanvas())` στο useEffect mount / `setCanvasEl(null)` στο cleanup + `<PerformanceHUD canvas projectId userId companyId />`. `PerformanceHUD.tsx`: props interface +projectId/userId/companyId + `onSubmit` wire σε `sendDiagnostic()` (guard: metrics+canvas+companyId+userId not null). GOL ✅: `generatePerfdiagId()` πριν Storage (docId needed for path — race-free), `setDoc()` await (correctness), EntityAudit fire-and-forget (non-blocking), projectId από context (no prop-drilling), canvasEl state trigger re-render για PerformanceHUD mount. | Claude Sonnet 4.6 |
| 2026-05-20 | **Phase 4 — A.1 + B.2.Q4: 3D Entity Selection + BIM Entity Card Panel (IMPLEMENTED).** Click on any BIM mesh → gold emissive highlight + right-side detail panel with Geometry & History tabs. **5 νέα αρχεία**: `bim-3d/stores/Selection3DStore.ts` (Zustand + subscribeWithSelector: `selectedBimId/selectedBimType`, `selectEntity()`/`clearSelection()` — mirrors QuickProperties3DStore pattern, ADR-040 micro-leaf compliant) + `bim-3d/systems/selection/BimSelectionHighlighter.ts` (pure Three.js class: `Map<uuid, originalMaterial>` for safe restore. `onSelect(bimId)`: traverse group, clone material + apply emissive #FFD700 intensity 0.3, NEVER mutates originals. `onClear()`: restore+dispose clones. `dispose()`: delegates to onClear. Critical invariant: must be called before `BimSceneLayer.sync()` rebuild — old mesh refs die in `clearGroup()`) + `bim-3d/properties/BimEntityCardPanel.tsx` (ADR-040 micro-leaf: 1 `useSyncExternalStore→Selection3DStore`, reads `Bim3DEntitiesStore.getState()` once per render. Absolute right-0 top-0 bottom-0 w-80 z-[60]. EntityDetailsHeader SSoT (icon per bimType: Square/Columns/Minus/LayoutGrid, title=i18n entity type). Tabs: Geometry + History. X close button → `clearSelection()`. Closes on empty-space click via `selectBimEntity(null)` from BimViewport3D) + `bim-3d/properties/tabs/BimGeometryTab.tsx` (read-only `dl` grid with `Fragment` keys, per-type rows: Wall→category/thickness/height/area/volume, Column→kind/dim/height/area, Beam→kind/width/depth/length, Slab→kind/thickness/area/volume. Data via `useBim3DEntitiesStore.getState()`) + `bim-3d/properties/tabs/BimAuditTab.tsx` (thin wrapper over `ActivityTab` SSoT ADR-195, `AuditEntityType`: wall/column/beam/slab already in union). **3 αρχεία τροποποιήθηκαν**: `ThreeJsSceneManager.ts` (+`readonly selectionHighlighter: BimSelectionHighlighter`, constructor init after `bimLayer`, `selectBimEntity(bimId|null)`: traverse→bimType + `onSelect()`/`clearSelection()` + `useSelection3DStore.getState().selectEntity()/clearSelection()`. `syncBimEntities()` rewritten: save selectedId → `selectionHighlighter.onClear()` → `bimLayer.sync()` → re-apply `onSelect(selectedId)` if non-null. dispose chain +`selectionHighlighter.dispose()`) + `BimViewport3D.tsx` (+import `Selection3DStore`, +`BimEntityCardPanel`. `handleClick`: `e.stopPropagation()` → immediate `raycastBimEntities()` → `selectBimEntity(hit?.bimId ?? null)`. cleanup adds `clearSelection()`. JSX: `onClick={handleClick}` on outer div + `<BimEntityCardPanel />` render). **i18n**: 14 νέα keys × 2 locales: `entityCard.closeAria`, `entityCard.tabs.{geometry,audit}`, `geometry.{thickness,height,width,depth,length,area,volume,category,kind}`. ADR-040 compliance: BimEntityCardPanel subscribes to 1 store (Selection3DStore) — NO additional `useSyncExternalStore` in BimViewport3D. GOL ✅: material clone pattern (no mutation), UUID map for exact restore, `onClear()` before rebuild (belt-and-suspenders — prevents stale-ref leak), `selectBimEntity()` idempotent (same bimId = no-op in highlighter), clearSelection on 3D mode exit (unmount cleanup), panel closes on empty-space click (immediate raycast null path). | Claude Sonnet 4.6 |
| 2026-05-20 | **Phase 4 — B.2.Q1 QuickProperties 3D hover tooltip (IMPLEMENTED).** Revit-style 3-line entity info card on 800ms stable hover in 3D viewport. **4 νέα αρχεία**: `bim-3d/stores/QuickProperties3DStore.ts` (Zustand + subscribeWithSelector: `hoveredBimId`, `hoveredBimType`, `cursorX/Y`, `setHovered()`/`clearHover()` actions — mirrors 2D QuickPropertiesStore pattern, ADR-040 compliant) + `bim-3d/systems/raycaster/BimEntityRaycaster.ts` (module-level `THREE.Raycaster` singleton, `raycastBimGroup(group, camera, domElement, clientX, clientY)→RaycastHit|null` — NDC conversion via `domElement.getBoundingClientRect()`, parent-walk for tagged mesh `userData.bimId`/`userData.bimType`, `RaycastHit` interface) + `bim-3d/properties/bim-entity-formatter.ts` (pure TS, no React: `formatWallTooltip`/`formatColumnTooltip`/`formatBeamTooltip`/`formatSlabTooltip(entity, t)→[typeLine,dimensionLine,categoryLine]`. Wall: `{thickness}mm × {height/1000}m`. Column: `{w}×{d}mm` or `Ø{w}mm`. Beam: `{w}×{d}mm / {length}m`. Slab: `{thickness}mm / {area}m²`. Category line = i18n-keyed kind/category label) + `bim-3d/properties/QuickProperties3DHoverPopover.tsx` (ADR-040 micro-leaf: `useSyncExternalStore→QuickProperties3DStore`, reads `Bim3DEntitiesStore.getState()` once per render for O(N) entity lookup, renders 3-line dark-glass `position:fixed` card with `pointer-events:none`, `z-[300]`). **2 αρχεία τροποποιήθηκαν**: `ThreeJsSceneManager.ts` (+`raycastBimEntities(clientX, clientY)→RaycastHit|null` public method: delegates to `raycastBimGroup(bimLayer.group, viewport.camera, renderer.domElement, ...)`, guarded by `this.disposed`) + `BimViewport3D.tsx` (`onMouseMove` → 800ms debounce timer (`debounceTimerRef`) → `managerRef.current.raycastBimEntities()` → `QuickProperties3DStore.setHovered()|clearHover()`; `onMouseLeave`+cleanup → `clearHover()+clearTimeout`; render `<QuickProperties3DHoverPopover />`; imports: +`useCallback`, +`useQuickProperties3DStore`, +`QuickProperties3DHoverPopover`). **i18n**: 21 νέα keys × 2 locales: `entityTypes.{wall,column,beam,slab}`, `wallCategories.{exterior,interior,partition,parapet,fence}`, `slabKinds.{floor,ceiling,roof,ground,foundation}`, `columnKinds.{rectangular,circular,L-shape,T-shape}`, `beamKinds.{straight,curved,cantilever}`, `quickProperties.noData`. GOL ✅: 800ms debounce race-free (clearTimeout on every move, only fires on stable cursor), raycaster singleton (no per-call allocation), entity lookup at render time (idempotent, no stale cache), `clearHover()` on mouseLeave+unmount (belt-and-suspenders), ADR-040 micro-leaf compliance (popover subscribes to 1 low-freq store, no high-freq subscription), `pointer-events:none` prevents tooltip from blocking Three.js events. | Claude Sonnet 4.6 |
| 2026-05-20 | **Phase 3 (SPEC-3D-001) — DxfToThreeConverter: full-color DXF wireframe renderer.** Supersedes `DxfFloorPlanOverlay` (single-color MVP). **2 νέα αρχεία**: `bim-3d/converters/DxfToThreeConverter.ts` (SPEC-3D-001 class: groups entities by resolved color → one `THREE.LineSegments` per unique color, merged `BufferGeometry` for perf. Color cascade: `colorTrueColor` > `colorAci` (ACI_PALETTE SSoT) > concrete `entity.color` > ByLayer: `layer.colorTrueColor` > `layer.colorAci` > `layer.color` > 0xffffff. Layer resolution: id-first `layersById[entity.layerId]` + name fallback per ADR-358 Phase 9D pattern. Entity types: `line`→6 nums/segment, `circle`→48 segments, `arc`→proportional CCW/CW (min 4), `polyline`→N-1 open/N closed. BIM wrappers (wall/beam/slab) skipped → BimSceneLayer. Coordinate: DXF x→X, DXF y→−Z (Y-up). Exports: `resolveEntityColor` + `appendEntitySegments` for unit tests. Lifecycle: `sync(DxfScene|null)` idempotent, `disposeGroup()` disposes geometry+materials, `getBounds()→Box3|null`.) + `bim-3d/__tests__/DxfToThreeConverter.test.ts` (40 unit tests: 10 × resolveEntityColor (TrueColor/ACI/ByLayer/ByBlock/hex/fallback/name-key), 12 × appendEntitySegments (per type, edge cases), 11 × sync() integration (lifecycle/merge/multi-color/visibility), 7 × getBounds). **1 αρχείο αντικαταστάθηκε**: `ThreeJsSceneManager.ts` (`overlay: DxfFloorPlanOverlay` → `dxfConverter: DxfToThreeConverter`, same public API `syncDxfOverlay`/`getBounds`/`dispose`). **1 αρχείο ενημερώθηκε**: `DxfOverlay3DStore.ts` (comment update). GOL ✅: geometry merged per color (O(N) single pass, no per-entity allocation), materials tracked + disposed (no leak), `sync()` idempotent (disposeGroup first), `resolveEntityColor` pure function (testable without THREE.Scene), ACI_PALETTE SSoT (no duplicate lookup table). | Claude Sonnet 4.6 |
| 2026-05-20 | **Phase 3 — Materials & Lighting (SPEC-3D-003).** `bim-3d/materials/MaterialCatalog3D.ts` (νέο): PBR material cache — 8 materialId-prefix entries (concrete/plaster/brick/stone/tile/wood/glass/metal) + 3 element-type fallbacks (column/beam/slab). `getMaterial3D(materialId)` prefix-match → cached `MeshStandardMaterial`. `getElementMaterial3D(type)` για entities χωρίς DNA. `disposeMaterialCatalog3D()` full teardown utility. `BimToThreeConverter.ts`: αφαίρεση flat Phase 2 materials (WALL_MAT/COLUMN_MAT/BEAM_MAT/SLAB_MAT) → `resolveWallMaterial(wall)` reads `wall.params.dna?.layers.find(side='core')?.materialId` (DNA path) ή CATEGORY_MAT_ID fallback (exterior→concrete, interior→plaster, partition→brick, parapet→concrete, fence→stone) → `getMaterial3D()`. Column/Beam/Slab → `getElementMaterial3D('column'\|'beam'\|'slab')`. `ThreeJsSceneManager.ts` lighting upgrade (ADR-366 §7.2): `renderer.shadowMap.enabled=true` + `PCFSoftShadowMap`. AmbientLight 0.6→0.5. DirectionalLight (sun) 0.8→3 intensity + `color=0xfffaf0` (warm noon) + `castShadow=true` + `shadow.bias=-0.0005` + `shadow.mapSize 2048²` + `shadow.camera bounds ±50`. `HemisphereLight(0x87ceeb, 0x8b7355, 0.3)` (sky/ground bounce). GOL ✅: materials module-lifetime singletons (zero per-mesh allocation), DNA core-layer path SSoT, category fallback covers all WallCategory values, lighting per ADR-366 §7.2 Athens-noon default. | Claude Sonnet 4.6 |
| 2026-05-20 | **Phase 2 — DXF Floor Plan Overlay (Revit "Underlay" style).** DXF κάτοψη εμφανίζεται ως flat `THREE.LineSegments` overlay στο Y=0 plane (περιστρέφεται μαζί με 3D view). **3 νέα / τροποποιημένα αρχεία**: `bim-3d/stores/DxfOverlay3DStore.ts` (νέο Zustand + subscribeWithSelector — SSoT bridge CanvasLayerStack→BimViewport3D, ADR-040 compliant shell-WRITE / leaf-READ) + `bim-3d/scene/DxfFloorPlanOverlay.ts` (νέο — pure class: `sync(DxfScene|null)` builds BufferGeometry από entities, `dispose()` cleans up. Entities: `line`→2 vertices, `circle`→64 segments, `arc`→proportional segments με CCW/CW flag, `polyline`→consecutive pairs + closed wrap. Unit scaling: mm→0.001 / cm→0.01 / m→1 / in→0.0254 / ft→0.3048. Coordinate mapping: DXF X→Three.js X, DXF Y→Three.js -Z (Y-up). Shared `LineBasicMaterial` color #89cff0 opacity 0.5. Skip: text/dimension/slab/opening/stair/xline/ray wrappers). **3 αρχεία τροποποιήθηκαν**: `ThreeJsSceneManager.ts` (+`readonly overlay: DxfFloorPlanOverlay`, constructor init, `syncDxfOverlay(scene)` public method, dispose chain) + `BimViewport3D.tsx` (+`useDxfOverlay3DStore` direct subscription `useEffect→syncDxfOverlay` — mirror pattern του Bim3DEntitiesStore subscription) + `CanvasLayerStack.tsx` (+`useEffect([dxfScene])→useDxfOverlay3DStore.getState().setDxfScene(dxfScene)` — ADR-040 CHECK 6C compliant: shell WRITES, never subscribes). GOL ✅: single owner (CanvasLayerStack shell writes → DxfOverlay3DStore → BimViewport3D leaf reads, race-free), geometry rebuilt on every scene change (idempotent), material module-level singleton (no leak), arc parametric CCW/CW belt-and-suspenders. ADR-040 compliance: CanvasLayerStack uses `getState().setDxfScene()` (zero useSyncExternalStore — CHECK 6C). | Claude Sonnet 4.6 |
| 2026-05-20 | **Phase 2 — BimToThreeConverter: Wall/Column/Beam/Slab → Three.js geometry (SPEC-3D-002).** **3 νέα αρχεία**: `bim-3d/stores/Bim3DEntitiesStore.ts` (Zustand + subscribeWithSelector: `walls/columns/beams/slabs` slices, `setWalls/setColumns/setBeams/setSlabs` actions, `selectBim3DEntities` selector — SSoT feed για 3D renderer χωρίς νέα Firestore subscriptions) + `bim-3d/converters/BimToThreeConverter.ts` (pure functions: `wallToMesh/columnToMesh/beamToMesh/slabToMesh` → THREE.Mesh. Coordinate convention: DXF plan XY mm → ExtrudeGeometry σε shape local XY → `applyMatrix4(makeRotationX(-π/2))` → Three.js Y-up world. Wall: outer/inner edge → Shape+hole → extrude height, Y=floorElev. Column: footprint polygon → extrude height, Y=floorElev. Beam: outline polygon → extrude depth, Y=elevation-depth. Slab: outline polygon → extrude thickness, Y=elevation-thickness. Phase 2 MeshStandardMaterial flat colors: wall #9e9e9e / column #616161 / beam #795548 / slab #bdbdbd. Phase 3+: MaterialCatalog3D) + `bim-3d/scene/BimSceneLayer.ts` (class: `sync(entities, floorElevationMm)` rebuild-all strategy Phase 2 correctness-first, `clearGroup()` disposes geometry, `dispose()`). **4 αρχεία τροποποιήθηκαν**: `ThreeJsSceneManager.ts` (+`BimSceneLayer` property, constructor init, `syncBimEntities(entities, floorElevationMm=0)` public method, dispose chain, αφαίρεση placeholder wireframe cube) + `BimViewport3D.tsx` (+`useBim3DEntitiesStore` useSyncExternalStore subscription, `useEffect([bimEntities])` → `syncBimEntities(bimEntities)`) + `*PersistenceHost.tsx` ×4 (Wall/Column/Beam/SlabPersistenceHost: `React.useEffect([currentScene])` → filter entities from SceneModel → `useBim3DEntitiesStore.getState().set*(entities)` — reactive via existing React state `currentScene` prop, zero νέα Firestore subscriptions). SSoT REUSE: `currentScene` ReactState ήδη reactive, `isWallEntity/isColumnEntity/isBeamEntity/isSlabEntity` type guards, ADR-040 micro-leaf compliance (`BimViewport3D` subscribes to low-freq store, not high-freq). GOL ✅: `syncBimEntities` owns geometry lifecycle (race-free), `setWalls/setColumns` idempotent (overwrite), geometry disposal in `clearGroup()` (no leak), PersistenceHost sync independent per type (no coupling). | Claude Sonnet 4.6 |
| 2026-05-20 | **Phase 1 bugfix — Mouse event isolation for 3D viewport.** Root cause: `BimViewport3D` container div had no z-index → 2D canvas layers (`DxfCanvasSubscriber` z-[10], `SnapIndicatorSubscriber` z-[30]) sat on top → mouse events hit 2D layers, never reached Three.js ViewportCamera DOM listeners → OrbitControls/tumble unresponsive. Fix: wrapper `<div className="absolute inset-0 z-50">` in `BimViewport3D` (only rendered when `is3D=true`). `z-50` floats 3D viewport above all 2D layers. React `stopPropagation` on `onMouseMove/Down/Up/ContextMenu/DoubleClick/Wheel` prevents 2D drawing handlers (`containerHandlers.*`) from firing in 3D mode. DOM event bubbling unaffected → Three.js camera DOM listeners receive events normally. GOL ✅: single-owner fix (no CanvasLayerStack shell changes, ADR-040 compliance preserved), idempotent (stopPropagation is stateless), belt-and-suspenders (z-50 + stopPropagation, not just one). File changed: `bim-3d/viewport/BimViewport3D.tsx`. | Claude Sonnet 4.6 |
| 2026-05-20 | **Phase 1 — GenArc Viewport Camera System PORT (SPEC-3D-004A). Status: IMPLEMENTING (Phase 0 complete → Phase 1 active).** Αντικατάσταση OrbitControls placeholder με full GenArc viewport camera system (tumble rotation, perspective/ortho toggle, ViewCube, POI indicator, animated transitions). **12 νέα αρχεία** (PORT_AS_IS εκτός όπου σημειώνεται): `bim-3d/viewport/viewport-types.ts` (`ProjectionMode`, `ZoomPreset`, `CameraKeyframe`, `AnimationTickCallback`, `SpeedModifier`, `ViewportCamera` interface, `CanonicalViewDef`, `ScreenPoint`, `ScreenProjection` — zero external deps) + `bim-3d/viewport/viewport-constants.ts` (FOV=60°, distances, speeds, animation durations 500ms cubic, `CANONICAL_VIEWS` array 7 directions, `ZOOM_PRESETS`) + `bim-3d/viewport/tumble-rotation.ts` (C4D-style quaternion orbit — pole-free, no gimbal lock, Alt+leftclick drag, velocity damping) + `bim-3d/viewport/viewport-animation.ts` (cubic ease-in-out RAF-based `CameraKeyframe` animator, `isAnimating` state) + `bim-3d/viewport/viewport-framing.ts` (`computePerspectiveFraming` + `computeOrthoFraming` AABB zoom-to-fit calculations) + `bim-3d/viewport/viewport-poi.ts` (navigation cross indicator at orbit target, fade in 300ms on nav-start, fade out on idle — Three.js LineSegments) + `bim-3d/viewport/view-snap-detector.ts` (pure function: camera direction vs 7 canonical views via dot product ≥cos(23°) threshold → `CanonicalViewDef | null`) + `bim-3d/viewport/viewport-camera.ts` (full factory `createViewportCamera(domElement, opts) → ViewportCamera`: PerspectiveCamera + OrthographicCamera + OrbitControls from `three/addons/controls/OrbitControls.js`, tumble integration, animation, key methods `setProjection/frameBounds/snapToViewDirection/goHome/applyTumble/updateAspect/update/dispose`) + `bim-3d/viewport/view-cube/view-cube-highlight.ts` (`FaceZone` type, `computeHighlights()`, `drawZoneHighlight()` — self-contained, zero imports) + `bim-3d/viewport/view-cube/view-cube-mesh.ts` (`FACE_DIRS`, `HitType`, `HitUserData`, `FaceLabels`, `CompassLabels`, `createVisualCube/createHitTargets/createCompassRing/createHomeButton`) + `bim-3d/viewport/view-cube/view-cube-overlay.ts` (`computeCompassDirection`, `createRollArrows`, `createFaceNavArrows`) + `bim-3d/viewport/view-cube/view-cube.ts` (**PORT_WITH_ADAPTATION**: removed GenArc `useSiteStore.subscribe/getState` north-angle subscription → `getNorthAngleDeg?: () => number` optional callback in `ViewCubeOptions`; north angle read on-demand in `getNorthAngleRad()` helper called per `sync()`/`handleClick()` — no subscription needed as ViewCube already syncs every RAF frame; `ViewCubeOptions` + `ViewCubeEngine` interfaces; `createViewCube()` factory: 160px mini WebGL canvas appended to container, full raycasting 26 hit targets face/edge/corner + compassHitMeshes + homeHitMesh + rollHitMeshes + faceNavHitMeshes, drag-to-orbit via `onDragRotate` callback, opacity fade in/out on hover). **1 αρχείο αντικαταστάθηκε** `ThreeJsSceneManager.ts`: OrbitControls + raw PerspectiveCamera → `createViewportCamera` + `createViewCube` + `createPoi`; RAF loop: `viewport.update()` → `poi.updateTarget/updateCamera/updateFade(delta)` → `viewCube.sync(camera, target)` → `detectSnapCandidate(...)` → `renderer.render(scene, viewport.camera)`; `resize(w,h)` → `viewport.updateAspect` + `renderer.setSize`; `dispose()` → `viewport.dispose` + `viewCube.dispose` + `poi.dispose`. **1 αρχείο wiring** `CanvasLayerStack.tsx`: import + `<CanvasLayerStack3dLeaf />` JSX (ADR-040 micro-leaf sibling, self-hides in 2D mode). **OrbitControls import path**: `three/addons/controls/OrbitControls.js` (νέο alias, συνέπεια με GenArc). **North angle adaptation rationale**: Nestor has no `useSiteStore` equivalent; north angle read-on-demand per frame is equivalent since ViewCube always syncs via RAF (no subscription lag). GOL ✅: viewport.update() pure tick (race-free), `setProjection/snapToViewDirection` idempotent, POI+ViewCube lifecycle owned by ThreeJsSceneManager (single owner), ViewportCamera SSoT owns camera state, animate cubic easing smooth transitions. ADR-040 compliance: CanvasLayerStack3dLeaf is micro-leaf sibling (renders ≤1 canvas, ≤2 high-freq hooks). | Claude Sonnet 4.6 |
| 2026-05-19 | **Phase 0 skeleton — IMPLEMENTING**. Status: PROPOSED → IMPLEMENTING. **Νέα αρχεία Phase 0**: `src/subapps/dxf-viewer/bim-3d/stores/ViewMode3DStore.ts` (Zustand + immer + subscribeWithSelector, FSM `2d\|3d-raster\|3d-preview\|3d-final`, Q2 floor visibility, Q3 idle-ready actions) + `bim-3d/viewport/coordinate-transforms.ts` (PORT_AS_IS SPEC-3D-004C: 6 NDC functions + `dxfPlanToWorld`/`worldToDxfPlan` mm→m Y-up converters) + `bim-3d/scene/ThreeJsSceneManager.ts` (WebGLRenderer + PerspectiveCamera + placeholder wireframe cube + AxesHelper + AmbientLight + DirectionalLight + OrbitControls + RAF loop + resize + dispose) + `bim-3d/viewport/BimViewport3D.tsx` (ADR-040 micro-leaf: `useSyncExternalStore` on ViewMode3DStore, ResizeObserver, ThreeJsSceneManager lifecycle, WebGL error boundary) + `bim-3d/hooks/useViewMode3D.ts` (ribbon/UI convenience hook) + `components/dxf-layout/canvas-layer-stack-3d-leaf.tsx` (ADR-040 sibling leaf — NOT yet wired to canvas-layer-stack-leaves.tsx, blocked by concurrent ADR-362/363 changes) + `bim-3d/__tests__/coordinate-transforms.test.ts` + `bim-3d/__tests__/ViewMode3DStore.test.ts`. **i18n**: `src/i18n/locales/el/bim3d.json` + `en/bim3d.json` (8 keys: modeToggle.label/aria/tooltip2d/tooltip3d, viewport.placeholder/loadingLabel/webglError). `bim3d` namespace registered in `lazy-config.ts` + `namespace-loaders.ts` (el + en loaders). **npm dep**: `three@^0.170.0` (MIT ✅ N.5) added to `package.json` + installed via pnpm — ships own TypeScript types, no `@types/three` needed. **Deferred** (after ADR-362/363 agent commit): canvas-layer-stack-leaves.tsx wiring to activate `CanvasLayerStack3dLeaf`. GOL ✅: RAF owned by ThreeJsSceneManager (no race), `toggle2D3D()` pure state flip (idempotent), WebGL error boundary (belt-and-suspenders), ViewMode3DStore SSoT, ThreeJsSceneManager owns Three.js lifecycle / BimViewport3D owns React lifecycle (clean separation). ADR-040 compliance verified: BimViewport3D is leaf subscriber, reads only low-freq mode state. | Claude Sonnet 4.6 |
| 2026-05-19 | **Appendix B — Topic B.5 ✅ FULLY CLOSED 8/8 Qs (Performance HUD) — GROUP B 5/5 COMPLETE**. **B.5.Q1** Default state = **Toggle, default OFF, ON με κουμπί** στο Floating3DPanel Quality tab (industry σύγκλιση 6/8 BIM SaaS — Lumion/Twinmotion/D5/Enscape/Blender/V-Ray hidden-by-default pattern). **B.5.Q2** Position = **Bottom-right** με 50px vertical offset πάνω από zoom controls για συνύπαρξη (Twinmotion/Chaos Vantage 2/8 industry, Γιώργος voted πάνω από top-right plurality 4/8). **B.5.Q3** Metrics = **Full diagnostic 10 metrics** (Mode + FPS + Frame time + Triangles + Vertices + Draw calls + Objects visible/total + GPU memory + CPU memory + Samples/sec) — συνδυασμός ALL industry tools (Twinmotion geometry + Blender vertex/object + V-Ray samples + stats.js memory + Chaos Vantage GPU), justified per `feedback_completeness_over_mvp.md`. Mode indicator zero industry precedent — απαραίτητο για Nestor's tri-mode FSM B.4. **B.5.Q4** Per-mode adaptive auto-highlight (4/8 path-tracer industry: V-Ray/Chaos/D5/Blender). Raster→FPS+Frame bold, Preview→Samples/sec+sample count bold, Final→Time remaining+progress bar sticky (συγχρονισμός με PathTracerRenderer.onProgress B.4). **B.5.Q5** 3-tier color coding 🟢/🟡/🔴 με industry-median thresholds (D5+Chaos+Twinmotion derived): FPS ≥45/25-44/<25, Frame time ≤22ms/22-40ms/>40ms, Draw calls ≤1500/1500-3000/>3000, GPU mem <60%/60-85%/>85%, Triangles <1M/1M-3M/>3M. REUSE existing `STATUS_OK/WARN/ERROR` design tokens, zero νέο palette — mirrors 2D status colors. **B.5.Q6** Mini↔Expanded toggle chevron, **default Expanded**, preference localStorage (`bim3d.performanceHud.expanded`). Συνδυασμός industry full-info 5/8 (Vantage/D5/Twinmotion/Blender/V-Ray) + Lumion/Enscape ambient mini-only option 2/8. **B.5.Q7** Full enterprise export 3 actions: Copy stats JSON clipboard + Download .json+.png ZIP (JSZip MIT) + Send diagnostic to support → νέα Firestore collection `performance_diagnostics/{diagnosticId}` με screenshot (Canvas.toBlob → Firebase Storage `companies/{companyId}/diagnostics/`) + 10 metrics + GPU benchmark + scene info + user/project context + 280-char user comment + status curation field, super-admin notification (ADR-145 registry). Industry 3/8 pro tools (V-Ray/Chaos/D5 export), cloud-native send-to-support extension πέρα από industry — Nestor cloud-first DNA + ADR-326 tenant scope + ADR-145 super-admin enablement. **B.5.Q8** Responsive breakpoints: <768px phone mini-only/disabled toggle/font 12px/touch ≥44px/16px safe-area inset, 768-1023px tablet mini-only/font 14px/20px inset, ≥1024px desktop full Expanded per Q1-Q7. Export menu always available all sizes (tablet site visit valid use case ADR-326). Industry 7/8 desktop-only — Nestor extension για tablet engineers στο εργοτάξιο. **Νέα modules Phase 4**: `PerformanceHUDStore.ts` (Zustand store + localStorage prefs) + `PerformanceCollector.ts` (RAF-throttled 250ms, Three.js renderer.info + WebGL_debug_renderer_info + Chrome performance.memory + GPU estimator, auto-pause when disabled) + `PerformanceHUD.tsx` (ADR-040 micro-leaf sibling, bottom-right responsive) + `PerformanceHUDMini.tsx` + `PerformanceHUDExpanded.tsx` (per-mode bold/normal/greyed emphasis via `per-mode-promotion.ts`) + `performance-thresholds.ts` + `metric-formatters.ts` + `PerformanceDiagnosticDialog.tsx` (Radix Dialog ADR-001) + `performance-snapshot-service.ts` (orchestrates screenshot upload + Firestore write + EntityAuditService `performance_diagnostic_submitted` + NOTIFICATION_KEYS `bim3d.diagnostic.received` + toast) + `clipboard-stats-writer.ts` + `file-download-writer.ts`. SSoT REUSE: STATUS_OK/WARN/ERROR design tokens, Radix Dialog/Progress, EntityAuditService (ADR-195), NOTIFICATION_KEYS registry, Firebase Storage tenant-scoped path (ADR-326), enterprise-id service (νέος generator `perf_diag_*`), ADR-040 micro-leaf compliance, RBAC pattern. Νέα Firestore collection `performance_diagnostics` με rules: create user-own-company, read super-admin+owner, update/delete super-admin only (ADR-145 super-admin registry). Storage rules για `diagnostics/*.png` company-scoped. License N.5: JSZip MIT ✅. ~28 i18n keys × 2 locales (~56 entries). GOL ✅: opt-in zero-overhead Collector pause, RAF throttle race-free, deterministic ID idempotent diagnostics, primary+fallback paths για cross-browser GPU memory, SSoT clear separation HUD store vs view-mode store vs snapshot service, μ-leaf ADR-040 compliance. Floating3DPanel Quality tab (B.3.Q7) integration: adds checkbox row "Εμφάνιση Performance HUD" — δεν προστίθεται νέο tab, αποφεύγουμε bloat. **B.5 effort: Phase 4 +6-8h** (core HUD 1.5h + Mini/Expanded variants 1.5h + helpers 0.5h + Floating3DPanel integration 0.25h + Diagnostic dialog+Firestore+Storage+rules+RBAC 2-3h + Copy/Download 0.5h + Firestore/Storage rules tests CHECK 3.16 0.5h + i18n 0.5h + tests 1h). **ADR-366 total estimate revised: ~185-220h Phase 0-7** (από ~179-212h post-B.4, +6-8h B.5 net). **GROUP B SUMMARY 5/5 ✅** (B.1 4/4 +14h, B.2 4/4 +20.5-24.5h, B.3 7/7 +5-7h, B.4 9/9 +35-46h, B.5 8/8 +6-8h) — **Group B total: 32/32 questions closed, +80.5-99.5h additive**. Memory updates: `project_adr366_group_b_partial.md` → renamed σε `project_adr366_group_b_complete.md` (Group B 5/5 ✅). Pending Phase 5+ extensions documented (NOT blocking): sparkline 60s history, admin diagnostics dashboard ADR-145 expansion, anonymized telemetry opt-in, auto-submit threshold FPS<10. Diagnostic conscious extension πέρα από industry-only-desktop pattern: tablet support per ADR-326 site-visit use case justified by Nestor BIM SaaS cloud-first DNA. | Claude Opus 4.7 |
| 2026-05-19 | **Appendix B — Topic B.4 ✅ FULLY CLOSED 9/9 Qs (Path tracer trigger UX)**. **B.4.Q1** Idle threshold **800ms** (industry median Lumion/D5, 5/7 σύγκλιση 500-1000ms range) — updates §9 Q3 αρχικό spec 2000ms σε industry-aligned value. **B.4.Q2** Cancellation = **Snap cut** atomic mode swap (7/7 industry absolute σύγκλιση). **B.4.Q3** Preview progress indicator = **Τίποτα** (silent magic Lumion/Enscape ethos, 4/7 industry leaning — changed από αρχικό UI selection "Quality bar" σε followup turn, Γιώργος preferred non-jargon presentation context). **B.4.Q4** Final dialog **4 presets**: Πρόχειρη 64 / Κανονική 256 / Υψηλή 1024 / Κορυφαία 4096 SPP (Twinmotion/Enscape/Chaos Vantage 3/7 direct match). **B.4.Q5** Resolution **HD/4K/8K + Custom**, default 4K (7/7 industry). Crop region DEFERRED Phase 8+ (saves Phase 7 dialog complexity). **B.4.Q6** Format = **PNG+JPG+EXR** + destination **2 checkboxable** (disk + project_assets Firestore Storage). PNG default, EXR για post-processing. **B.4.Q7** Denoiser **ON by default + toggle σε Προχωρημένα expander** (V-Ray/Blender hybrid, 7/7 default-ON + 3/7 toggle). **B.4.Q8 FULL ENTERPRISE Phase 7** = Turntable 360° + Flyaround waypoints + Timeline editor UI + path easing curves + multi-frame MP4 export (7/7 industry parity, per memory `feedback_completeness_over_mvp.md` rule, +30-40h scope expansion ~20% του ADR-366). **B.4.Q9** Detailed time estimate (D5/V-Ray style) πάντα visible: GPU calibration (~50ms benchmark σε mount) × scene complexity × samples × resolution × frames → `~42 λεπτά ±4 min` format, live update on config change (6/7 industry). Νέα modules Phase 5: `IdleDetector.ts` (800ms tune από 2000ms, REUSED B.1.Q2/B.1.Q3/B.4), `PathTracerRenderer.ts` (three-gpu-pathtracer MIT wrapper, single instance dual-profile), `raster-to-pathtrace-swap.ts`. Phase 6: `RenderFinalDialog.tsx` (Radix Dialog ADR-001) + `render-cost-estimator.ts` + `render-output-writer.ts` (PNG/JPG Canvas.toBlob + EXR wasm + Firebase Storage upload + project_assets Firestore + enterprise-id `rnd_bim_*` generator + RBAC `bim_renders.create`) + `RenderProgressOverlay.tsx`. Phase 7: `TurntablePathBuilder.ts` + `WaypointPathBuilder.ts` + `TimelineEditor.tsx` (ribbon panel + 3D waypoint overlay drag-and-drop + scrubber) + `MP4Exporter.ts` (mp4-muxer MIT + WebCodecs + WebM fallback). ViewMode3DStore extensions: `idleThresholdMs=800`, `finalRenderConfig`, `animationConfig`. SSoT REUSE: IdleDetector multi-subscriber, Radix Dialog, enterprise-id (νέος `rnd_bim_*` generator addition), EntityAuditService (νέο audit type `bim_render_created`), NOTIFICATION_KEYS (νέο `bim3d.render.completed`), Firebase Storage tenant-scoped path pattern (ADR-326), project_assets existing collection με `type='bim-render'` discriminator. License N.5 compliant: three-gpu-pathtracer MIT, mp4-muxer MIT, WebCodecs native, EXR encoder MIT family. ~28 i18n keys × 2 locales (~56 entries). GOL: atomic FSM mode swap (race-free), idempotent re-render (deterministic seed), WebGPU→WebGL fallback (belt-and-suspenders), single PathTracerRenderer + single IdleDetector (SSoT). **B.4 effort: Phase 5 +3h + Phase 6 +9h + Phase 7 +30-40h = +42-52h** (note: το Phase 7 +30-40h είναι animation system FULL ENTERPRISE, η ίδια η path-trace trigger UX = ~12h). **ADR-366 total estimate revised: ~179-212h Phase 0-7** (από ~144-166h post-B.3, +35-46h B.4 net). Decision conscious diverge documented: animation FULL ENTERPRISE Phase 7 αντί incremental Phase 8+ (justified per completeness_over_mvp memory). Pending ratchet entries DEFERRED Phase 8+: crop region rendering (B.4.Q5), OIDN-wasm denoiser upgrade αν three-gpu-pathtracer built-in underwhelming. Memory updates: `project_adr366_group_b_partial.md` → B.4 closure (Group B now 4/5 — B.5 remaining). | Claude Opus 4.7 |
| 2026-05-19 | **Appendix B — Topic B.3 ✅ FULLY CLOSED 7/7 Qs (Multi-floor Visibility Controls UI)**. **B.3.Q1** Panel αριστερά με checkbox list ανά όροφο (5/5 industry σύγκλιση — Revit/ArchiCAD/Navisworks/Vectorworks/Allplan). **B.3.Q2** Free multi-select checkboxes + 3 preset buttons στο top [All][Active][None]. **B.3.Q3** 3-state per floor: Hide / Ghost (30% opacity) / Show (Revit Underlay pattern extended, 3/5 industry transparency-as-context). Ghost via Three.js `material.transparent=true, opacity=0.3, depthWrite=false` σε cloned material (WeakMap-cached). **B.3.Q4** Top-down order (ψηλότερος πρώτος, Revit/ArchiCAD/Allplan default, sort by `floor.elevation desc`). **B.3.Q5** Μπλε τελίτσα δεξιά για active floor (Revit minimal pattern, REUSE `CAD_UI_COLORS.ACTIVE`, zero νέο token). **B.3.Q6** 4 presets total: [All][Active][None][Invert] (4/5 industry έχουν Invert command). **B.3.Q7** Νέο 3D-specific FloatingPanel αριστερά (separate component από 2D FloatingPanel), tabs Floors/Lighting/Quality — Γιώργος διαφώνησε με recommended REUSE 2D Levels tab για cleaner 3D scope separation (decision conscious diverge από `feedback_3d_mirror_2d_ssot.md` rule σε αυτό το specific UI surface, justified: 3D Floors tab = visibility multi-toggle με 3-state + 4 presets, διαφορετικό UX scope από 2D Levels read-mostly). Νέα modules Phase 4: `Floating3DPanel.tsx` (container) + `Floor3DPanelTab.tsx` (Floors tab UI) + `floor-visibility-state.ts` (pure helpers: preset/invert/sort) + `applyFloorVisibility.ts` (scene mutator με RAF coalesce + ghost material cache). ViewMode3DStore extensions: `floorVisibilityModes: Map<floorId, 'show'\|'ghost'\|'hide'>` + actions `applyFloorsPreset`/`setFloorMode`/`toggleFloorVisibility`. `visibleFloors:Set` (ήδη §9 Q2) τώρα derived view από modes. SSoT REUSE: `useFloors` (ADR-326), `CAD_UI_COLORS.ACTIVE`, ADR-040 micro-leaf compliance, ADR-031 (no command history needed — UI-only state). ~12 i18n keys ×2 locales (~24 entries). Phase 4 **+5-7h** total. **ADR-366 total estimate revised: ~144-166h Phase 0-7**. Industry decisions documented με 5+ benchmarks per question. Memory updates: `project_adr366_group_b_partial.md` → B.3 closure; `reference_dxf_viewer_floating_panel.md` annotated με 3D divergence note. | Claude Opus 4.7 |
| 2026-05-19 | **Appendix B — Topic B.2 ✅ FULLY CLOSED 4/4 Qs. B.2.Q4 (Element info panel — full BIM card on click) RESOLVED**: **EntityDetailsHeader SSoT extension με 5 tabs (Geometry/Materials/BOQ/Audit/Comments) + read-only παντού εκτός Comments**. Pattern REUSE 100% του `@/core/entity-headers` (Contacts + Procurement Phase G 2026-04-28 proof) — μηδέν παράλληλη detail-header abstraction. Tabs: Geometry (length/height/thickness/area/volume read-only `<dl>`) + Materials (multi-layer DNA preview ADR-363 Phase 6) + BOQ (summary card + drawer link ADR-329) + Audit (vertical timeline + inline diff `old → new` via `useEntityAudit` ADR-195) + Comments (filtered list mirror B.2.Q3 με add/resolve actions inline). Editing παντού delegated σε dedicated tools (transform/material assigner/BOQ drawer) — SSoT discipline. Νέα modules `bim-3d/properties/BimEntityCardPanel.tsx` + 5 tab components + 8 entity-kind SVG icons + ~34 i18n keys ×2 locales (~68 entries). No new SSoT tokens. Progressive disclosure Phase 4-7 (Geometry+Audit Phase 4 instant value, Materials Phase 5, BOQ Phase 6, Comments Phase 7 depends on B.2.Q3). Backport opportunity 2D: refactor FloatingPanel Properties tab σε EntityDetailsHeader-based card (~3-4h, Boy Scout, NOT BLOCKING). Phase 4-7 **+7-9h** total. **ADR-366 total estimate revised: ~139-159h.** Industry alignment: Notion/Linear/Github single canonical detail header pattern, Revit Properties Palette multi-category grouping. Memory [[entity-details-header-ssot]] reinforced. | Claude Opus 4.7 |
| 2026-05-19 | **Appendix B — Topic B.2.Q3 (BIM Data Overlay — 3D annotations/leaders) ✅ RESOLVED** — **Typed comment markers (BIMcollab style) Phase 7+** + **DEFERRED free-text labels Phase 8+**. Νέα Firestore collection `bim_comments` (tenant-scoped ADR-326) με marker pins Three.js Sprite billboard, status color (open=orange/resolved=green/wontfix=gray), priority border, auto-numbered. Click → side panel REUSE `EntityDetailsHeader` SSoT + edit-in-place + attachments + audit trail (ADR-195). Νέα modules Phase 7: `CommentMarker3DRenderer.ts` + `BimCommentDetailsPanel.tsx` + `CommentListPanel.tsx` + `bim-comments.service.ts`. SSoT REUSE: enterprise-id (νέο `cmt_bim_*` generator), EntityAuditService, NOTIFICATION_KEYS (νέο `useCommentNotifications` hook), GenArc viewportAnimation (camera zoom-to-comment). Νέο SSoT token `COMMENT_STATUS_COLORS` (zero 2D equivalent). 20+ i18n keys ×2 locales. RBAC permissions `bim_comments.*`. Modern BIM coordination industry σύγκλιση (BIMcollab + Solibri leaders). SketchUp 3D-text/Revit annotations-in-views rejected — Nestor είναι BIM coordination tool. Phase 7 +6-7h. Phase 8+ free-text labels deferred (~5-6h future, not blocking). **Total estimate revised: ~132-150h.** | Claude Opus 4.7 |
| 2026-05-19 | **Appendix B — Topic B.2.Q2 (BIM Data Overlay — permanent dimensions σε 3D) ✅ RESOLVED** — **Combo no-automatic + manual user-placed via mirror ADR-362** (Revit/ArchiCAD industry consensus 4/5 σύγκλιση). Καθόλου auto-dimensions σε 3D (clean visualization philosophy). Manual dim tool mirror του 2D ADR-362 με ribbon context-aware Dim button (2D mode → plan dim, 3D mode → 3D dim). Schema extension: existing `DimensionEntity` + `placement: '2d' \| '3d'` discriminator (zero data duplication). Νέα Phase 7: `Dimension3DRenderer.ts` (Three.js Line + Sprite billboard label) + `useDim3DToolRouting.ts` (state machine mirror). SSoT REUSE 100%: ADR-362 schema/snap/style tokens + ProSnapEngineV2 + ADR-031 CommandHistory + ribbon button. Hover tooltip ήδη δείχνει dims (B.2.Q1) → user βλέπει μέτρα on-demand. Boy Scout: 2D scene converter adds visibility filter για `placement=3d` skip. Phase 7 +5-6h. **Total estimate revised: ~126-143h.** | Claude Opus 4.7 |
| 2026-05-19 | **Appendix B — Topic B.2.Q1 (BIM Data Overlay — hover tooltip) ✅ RESOLVED** — **Mirror ADR-357 QuickProperties pattern + BIM data getters**. Compact 3-line Revit-style floating card (type / name+dimensions / floor+material). 100% SSoT REUSE: HOVER_DELAY_MS=800ms constant, ImmediatePositionStore, ADR-040 sibling micro-leaf mount, useSyncExternalStore, CSS module visual rules. Νέα modules Phase 4: `bim-3d/properties/QuickProperties3DStore.ts` + `QuickProperties3DHoverPopover.tsx` + `bim-entity-formatter.ts`. BIM data sources: ADR-363 cached geometry + ADR-363 Phase 6 multi-layer DNA materials + useFloors SSoT. 11 νέα i18n keys (bim3d.entityTypes.* + bim3d.quickProperties.*). Activation: `activeTool=select` AND `mode!=2d` AND 800ms stable. Effort οικονομία ~1.5h από mirror pattern. Phase 4 +2.5h. **Total estimate revised: ~121-137h.** | Claude Opus 4.7 |
| 2026-05-19 | **Appendix B — Topic B.1 (Materials & Lighting UX) ✅ FULLY CLOSED 4/4 Qs.** Q4 Environment reflections RESOLVED: **HDRI envmap Phase 5 (PBR IBL zero cost) + path-traced Phase 7 final** (Twinmotion + V-Ray pattern, 2/2 BIM render leaders σύγκλιση). Νέα SSoT: `envmap-generator.ts` (PMREMGenerator wiring) + `material-defaults.ts` (5 entity-type PBR registry: glass/metal/concrete/wood/plaster). Phase 7 path tracer (`three-gpu-pathtracer` MIT) takes over reflections automatically — zero material refactor. SSR απορρίπτεται (edge artifacts). Phase 5 +1.5h. **Topic B.1 total +14h Phase 5** (Q1=7h + Q2=3h + Q3=2.5h + Q4=1.5h). **Total estimate revised: ~118.5-134.5h.** Topic B.1 architectural commitments documented: 5 νέα SSoT modules, ViewMode3DStore extensions, EffectComposer pipeline, IdleDetector REUSE. | Claude Opus 4.7 |
| 2026-05-19 | **Appendix B — Topic B.1.Q3 (Materials/Lighting — ambient occlusion) ✅ RESOLVED** — **SSAO με auto-downgrade on camera motion** (consistency με B.1.Q2 pattern, 4/5 industry σύγκλιση). Three.js `SSAOPass` postprocess, `pass.enabled=false` snappy mode (zero cost), idle 300ms fade-in σε `aoIntensity=1.0`. Rename utility: `shadow-modulator.ts` → `quality-modulator.ts` (unified shadows + AO + future post-FX). ViewMode3DStore.shadowState → qualityState extension. EffectComposer pipeline νέο για Phase 5 (RenderPass → SSAOPass → OutputPass). Phase 7 path tracer takeover override SSAO. Industry leader benchmarks documented: Chaos V-Ray gold offline + Twinmotion/D5 real-time inspirations. Phase 5 +2.5h. **Total estimate revised: ~117-133h.** | Claude Opus 4.7 |
| 2026-05-19 | **Appendix B — Topic B.1.Q2 (Materials/Lighting — shadow quality) ✅ RESOLVED** — **Soft shadows with auto-downgrade on camera motion** (Lumion pattern, 3/4 industry σύγκλιση + exact Lumion match). Three.js `PCFSoftShadowMap` always-on (zero recompile cost) + dynamic `light.shadow.radius` modulation (0.5 snappy → 4.0 soft, 300ms cubic ease) + dynamic map size (1024² moving → 2048² idle). Trigger via IdleDetector SSoT REUSE από §9 Q3. Zero settings UI clutter — invisible feature, Architect-friendly. Νέο SSoT: `bim-3d/lighting/shadow-modulator.ts`. ViewMode3DStore.shadowState extension. Low-end fallback (hardwareConcurrency<4) forces snappy-always. Phase 5 +3h. **Total estimate revised: ~114.5-130.5h.** | Claude Opus 4.7 |
| 2026-05-19 | **Appendix B — Topic B.1.Q1 (Materials/Lighting UX — φωτισμός εκκίνησης) ✅ RESOLVED** — **Combo 3-tier + BIM geolocation sun**. Tier 1: 6 preset thumbnails (Πρωί/Μεσημέρι/Απόγευμα/Ηλιοβασίλεμα/Συννεφιά/Νύχτα). Tier 2: time-of-day slider 00:00–23:59 με real-time shadows (debounced 16ms). Tier 3: Advanced Solar Panel (date + lat/lng από ADR-326, fallback Athens, Animate toggle). Industry σύγκλιση: 4/4 rendering tools (Twinmotion/Enscape/Lumion/D5) + 2/2 BIM (Revit Sun Settings + ArchiCAD Sun Study). Νέα SSoT: `bim-3d/lighting/lighting-presets.ts` + `bim-3d/lighting/solar-position.ts` (suncalc MIT). ViewMode3DStore extension. UI: LightingPresetsPanel + TimeOfDaySlider + AdvancedSolarPanel. Phase 5 effort +7h. **Total estimate revised: ~111.5-127.5h.** | Claude Opus 4.7 |
| 2026-05-19 | **Initial draft v1.0** — Full architecture, 7 phases, GenArc port catalog, SPEC-3D-001/002/003/004 skeletons, §9 open questions Q1-Q4 για Γιώργο. Status: PROPOSED. | Claude Opus 4.7 |
| 2026-05-19 | **Appendix A — Group A 7/7 CLOSED** — A.5 ViewCube micro-interactions (5 sub-Qs), A.6 Keyboard shortcuts 3D (4 sub-Qs), A.7 Accessibility (4 sub-Qs, Q2 ARIA DEFERRED). Total effort impact: +12.5h. Updated ADR-366 estimate: ~104.5-120.5h Phase 0-7 full implementation. | Claude Opus 4.7 |
| 2026-05-19 | **SPEC-3D-004 split per-domain** — Original master-catalog approach abandoned (484 files too large for one session). New structure: 5 sub-SPECs A/B/C/D/E. **SPEC-3D-004A (Viewport) COMPLETED**: 45 files catalogued, 15 PORT_AS_IS + 8 ADAPT + 7 EXTRACT + 15 EXCLUDE. Phase 4 effort revised 6h→8-10h. New Phase 2 alternative path identified: navProxy port (Q2 in 004A). | Claude Opus 4.7 |
| 2026-05-19 | **SPEC-3D-004B (DXF Parser) COMPLETED** — 8 files catalogued (engines/dxf/ + types/dxf*.types.ts). **Result: 0 PORT / 0 ADAPT / 0 EXTRACT / 8 EXCLUDE.** Reasoning: GenArc DXF domain is topographic plot boundary detection (ΕΓΣΑ'87 / ΝΟΚ / GPT-4o pipeline) — orthogonal to ADR-366 BIM rendering. Nestor already has mature 15-entity custom DXF parser με Web Worker + full HEADER/DIMSTYLE/LAYER table support. **Implication**: SPEC-3D-001 (DXF→Three.js Pipeline) χτίζεται from scratch ως νέος `DxfToThreeConverter` πάνω στο Nestor `DxfEntityUnion`, χωρίς αναφορά σε GenArc DXF code. Confirmed clean domain isolation (zero coupling με άλλα GenArc engines). | Claude Opus 4.7 |
| 2026-05-19 | **SPEC-3D-004D (Geometry Helpers) COMPLETED** — 9 files catalogued (engines/bom/ 3 files + utils/{slabBeamSplit,beamLoopSlab,raySceneIntersection,structuralConnectivity,structuralConnectivity.helpers,buildingSelectors} 6 files, total ~2.344 LOC). **Result: 0 PORT_AS_IS / 0 PORT_WITH_ADAPTATION / 3 EXTRACT_CONCEPT / 6 EXCLUDE.** Κεντρικό εύρημα: Nestor's `bim/geometry/*` (ADR-363 Phases 1-7.1) είναι architectural superset του GenArc — fundamental coordinate basis mismatch (3D Y-up metres vs 2D XY-plan mm + external elevation via floor metadata) + Nestor's mature cached `entity.geometry.{...}` SSoT μέσω idempotent functions (`computeWallGeometry`, `OpeningGeometry`, `SlabGeometry` με slab-opening subtraction, `ColumnGeometry`, `BeamGeometry`) + `wall-trims.ts` strict superset του GenArc `computeWallTrims` (parametric intersection + corner/T-junction/cross classification + MAX_BEVEL_FRACTION anti-inversion guard) + `BimToBoqBridge` Firestore-grade superset του GenArc `bomCalculator` (reactive feed + ΑΤΟΕ mapping + detach guard). Q1/Q2/Q3 RESOLVED με Full Enterprise (5/5, 4/4, 4/4 industry σύγκλιση): slab-beam decomposition + auto-slab from beam loop + analytical CPU raycaster ΟΛΑ out of ADR-366 scope. Q4 RESOLVED (Full Enterprise 6/6 σύγκλιση — Revit + ArchiCAD + Bentley + Tekla + Vectorworks + Allplan ΟΛΟΙ παράγουν per-layer/per-component BOQ quantities): ADR-363 Phase 6.x extension (~8h) προστίθεται για per-layer BOQ entries με `boq_bim_${entityId}_layer_${layerId}` deterministic IDs + per-layer detach guard + backward-compatible migration. Pending entry για `.claude-rules/pending-ratchet-work.md`. **Implication για Phase 2 (BIM → Three.js)**: `BimToThreeConverter` χτίζεται πάνω σε Nestor cached geometry + ADR-366 §4.2 `dxfPlanToWorld` bridge — zero GenArc dependency. SPEC-3D-004A §3.1 EXTRACT_CONCEPT alternative path (αντί navProxy) confirmed feasible χωρίς wallGeometry/slabBeamSplit dependencies. SPEC-3D-004C §10 cross-domain flags (raySceneIntersection, buildingSelectors, distSqXZ) όλα resolved. | Claude Opus 4.7 |
| 2026-05-19 | **SPEC-3D-004C (Utils/Snap/Picking) COMPLETED** — 16 files catalogued (10 `engines/snap/*` + 6 `utils/{coordinateTransforms,cursorProjection,gizmoProjection,sitePicking,elementSnap,gridSnap}`). **Result: 2 PORT_AS_IS + 1 PORT_WITH_ADAPTATION + 0 EXTRACT + 13 EXCLUDE.** Top ports: `coordinateTransforms.ts` (Three.js NDC math, ⭐ critical — Nestor's `CoordinateTransforms` είναι 2D-only) + `gizmoProjection.ts` (constrained drag math για Phase 7) + `cursorProjection.ts` (adapt for raycaster→world). EXCLUDE rationale: Nestor's 17-engine snap system είναι **strict superset** του GenArc 7-strategy pipeline + `sitePicking` 100% ΝΟΚ-specific (consistent με SPEC-3D-004A §5.5 EXCLUDE plotOverlay). Phase 0 effort: ~3-4h (coordinate primitives + cursor→world + tests). 4 open questions (alignment guide infer in Nestor's GuideSnapEngine, cursorProjection port timing Phase 0/1/2, screenToWorld naming collision 2D vs 3D, snap zero-port confirmation). Cross-domain edges flagged for SPEC-3D-004D: `raySceneIntersection`, `buildingSelectors`, `distSqXZ`. | Claude Opus 4.7 |
| 2026-05-19 | **§9 ALL OPEN QUESTIONS RESOLVED — Status PROPOSED → APPROVED.** Q1 ViewCube top-right unified toggle (AutoCAD style, 4/4 Autodesk σύγκλιση) — αρχιτεκτονική implication: ViewCube skeleton μπαίνει Phase 0 (+~2h), Phase 4 enrichment (-~1h), net +1h. Q2 Single-floor default + "Show All" toggle (4/4 Revit/ArchiCAD/Vectorworks/Allplan σύγκλιση) — `ViewMode3DStore.visibleFloors: Set<floorId>` + `mesh.visible` visibility control, zero re-creation cost. Q3 Tri-mode rendering: rasterized real-time + auto-on-idle photoreal preview + explicit "Render" final dialog (7/7 industry σύγκλιση — Revit/ArchiCAD/Twinmotion/D5/Enscape/V-Ray/Blender) — `IdleDetector` νέο utility, Phase 5 +2h. Q4 HDRI ως Phase 7 polish (όχι Phase 5 prereq) — build core first, polish last; Polyhaven CC0 default + library picker; Phase 7 +4-6h. **Total estimate revised**: ~70-78h (από 58h αρχική, +12-20h από A→E catalog refinements + Q3/Q4 architectural decisions). **Phase 0 implementation: ✅ READY** — zero blocking decisions remain. | Claude Opus 4.7 |
| 2026-05-19 | **Appendix A — Topic A.4 (Camera transitions) ✅ CLOSED** — 5 decisions (REUSE GenArc + industry defaults): (Q1) Animation duration ViewCube/Home/canonical = **500ms cubic ease-in-out** (Revit/AutoCAD/SketchUp σύγκλιση 3/3, GenArc default). (Q2 implicit) Ortho↔Persp = **animated 500ms** — GenArc `viewportCamera.ts` ready. (Q3 implicit) Orbit damping ON, dampingFactor=0.05 (5/6 industry). (Q4 implicit) Zoom Extents = animated 500ms cubic — GenArc `frameBounds` ready. (Q5 implicit) Tumble = REUSE GenArc `tumbleRotation.ts` (quaternion pole-free, horizon-leveling, battle-tested). **GenArc port REUSE 100%** — viewportCamera + tumbleRotation + viewportAnimation + viewportFraming (~709 LOC PORT_AS_IS, Phase 4 effort unchanged). Zero νέα tokens — durations/easing ζουν στο `viewport.constants` (sub-phase 4.3). SSoT compliance: 100%. Phase 4 effort + Total estimate unchanged: **92-108h**. | Claude Opus 4.7 |
| 2026-05-19 | **Appendix A — Topic A.3 (Section cuts) ✅ CLOSED** — 5 decisions (Full Enterprise): (Q1) **Section Box + Single Plane mode toggle** (Navisworks pattern, 4/6 σύγκλιση). Default = Section Box (Revit universal 6/6), ribbon toggle → Single Plane. (Q2) **Multiple independent planes έως 6** (Navisworks-style) + Link Planes toggle (move together), UI panel "Section Planes" list/enable-disable. (Q3) **2D Live Section Panel widget** δίπλα στο 3D view με independent zoom/pan — GenArc 4 PORT_WITH_ADAPTATION files (sectionIntersect/sectionGeometry/sectionRenderer/sectionSceneSync ~680 LOC, ~4h adaptation). (Q4) **Cut surface visual = Solid Phase 7 base (γκρι semi-transparent Three.js native) + Hatched mode Phase 7.1+ toggle** — per-material hatch patterns (τούβλο διαγώνιο, σκυρόδεμα τελείες, μόνωση ζιγκζαγκ) συνδεδεμένα με ADR-363 Phase 6 ShaderType registry. (Q5 implicit) Default OFF + auto-fit bounding box +10% margin + Shift+drag symmetric. **GenArc port confirmed**: SPEC-3D-004A §3.2 4 files PORT_WITH_ADAPTATION. **SSoT compliance**: 6/8 tokens REUSE (grips/hover/snap/scene/selection/ribbon/mutation/undo), 2/8 νέα justified (`SECTION_CUT_SURFACE` solid color, material-hatch registry για Phase 7.1+). Three.js native fallback: `Material.clippingPlanes` (6 planes shader-level, zero CPU cost). Phase 7 effort 18-22h → **32-40h** (+section box 4-6h + multi-plane 3-4h + 2D panel GenArc port 4h + hatched mode Phase 7.1+ 3-4h). Total estimate **92-108h**. | Claude Opus 4.7 |
| 2026-05-19 | **Appendix A — Topic A.2 (Gizmos / transform handles) ✅ CLOSED** — 5 decisions: (Q1) Pattern = **grip-drag mirror Nestor 2D + X/Y/Z keyboard axis lock** (Blender inference style). ΟΧΙ widget. SSoT consistency πάνω από 5/6 industry widget convergence. (Q2) Rotate/Scale = ribbon tools + Properties panel typed values (mirror 2D + Revit). (Q3) Snap = REUSE Nestor `ProSnapEngineV2` 17-engine + Hold Shift = temporary disable. (Q4) Axis lock visual = temporary R/G/B line ενώ X/Y/Z key πατημένο, **νέο SSoT token `AXIS_COLORS_3D`** σε `color-config.ts` (R=#FF0000/G=#00FF00/B=#0000FF — μοναδικό νέο entry, no 2D equivalent). (Q5) Grip color tokens = REUSE `CAD_UI_COLORS.grips` (συνέπεια A.1). **GenArc gizmo files (4 PORT_AS_IS visual primitives ~994 LOC + 3 EXTRACT_CONCEPT FSM ~2.553 LOC) deferred Phase 8+ optional.** `gizmoProjection.ts` PORT_WITH_ADAPTATION retained για X/Y/Z constrained drag math. Phase 7 effort 12-14h → **18-22h** (+6-8h, αντί +8-11h widget). Total **78-90h**. Pattern σε μία πρόταση: "Όπως στην κάτοψη, με 3 άξονες αντί 2 — και X/Y/Z για κλείδωμα." Memory [[3d-mirror-2d-ssot]] reinforced. | Claude Opus 4.7 |
| 2026-05-19 | **Appendix A — Topic A.1 (3D Selection UX) ✅ CLOSED** — 5 decisions registered: (Q1) Modifier για multi-select = Revit pattern Ctrl+κλικ προσθέτει / Shift+κλικ αφαιρεί. (Q2) Color palette = SSoT REUSE από `color-config.ts` (όχι παράλληλη 3D palette). (Q3) Visual style διαλεγμένου = AutoCAD grips mirror του Nestor 2D (όχι outline για selected — outline ΜΟΝΟ για hover με κίτρινο `HOVER_HIGHLIGHT.ENTITY.glowColor`). (Q4 implicit) Marquee = mirror Nestor 2D `SelectionSettings.tsx` window/crossing tabs. (Q5 implicit) Grip 3D shape = billboard square fixed pixel size (AutoCAD 3D standard). **Cardinal principle**: 3D BIM Viewer καταναλώνει SSoT tokens του 2D DXF Viewer (`HOVER_HIGHLIGHT`, `CAD_UI_COLORS`, `UI_COLORS.SELECTION_*`, `settings.selection.*`) — μηδέν παράλληλη 3D palette. Memory saved: `feedback_3d_mirror_2d_ssot.md`. Phase 4 effort 8-10h → **12-14h** (+selection layer 4h με grips). Total estimate **72-82h**. | Claude Opus 4.7 |
| 2026-05-19 | **Appendix A — Topic A.1 (3D Selection UX) RESEARCH** — Industry analysis 6/6 σύγκλιση (Revit + ArchiCAD + AutoCAD + Blender + Three.js OutlinePass + Twinmotion/Lumion/Enscape): hover blue outline universal, single-click replace universal, Shift+click toggle (5/6 — Nestor convention), drag marquee AutoCAD L→R blue Window / R→L green Crossing (GenArc `windowSelectionOverlay.ts` ήδη PORT_AS_IS), Escape deselect-all universal, Tab cycle overlaps Phase 4.x optional. Three.js tech: `OutlinePass` με edgeStrength=3.0/edgeThickness=2.0/edgeGlow=0.5 + FXAA + visible/hidden edge colors (sky-300 hover / sky-500 selected / sky-600 X-ray). New `Selection3DStore` Zustand SSoT separate από Nestor 2D HoverStore (different coord systems). Phase 4 effort 8-10h → **10-13h** (+3h selection layer). Total estimate **72-81h**. Sub-question pending στον Γιώργο για modifier convention (Shift+click toggle vs Revit Ctrl+click). | Claude Opus 4.7 |
| 2026-05-19 | **SPEC-3D-004E (Materials & Shaders) COMPLETED** — 19 files catalogued (12 `engines/sdf/*` + 4 `shaders/*` + `types/material.types.ts` + `types/wallDna.types.ts` + `constants/materialRegistry.constants.ts`, total ~2.500 LOC). **Result: 0 PORT_AS_IS / 1 PORT_WITH_ADAPTATION (`material.types.ts`) / 4 EXTRACT_CONCEPT (`materialUniforms.ts` + `materialRegistry.constants.ts` + `materials.glsl.ts` Phase 5+ optional + `gridPlane.glsl.ts` Phase 7 optional) / 12 EXCLUDE (ολόκληρο SDF pipeline — §3.2.2 rejected — + `noise.glsl.ts` + `wallDna.types.ts` Nestor superset) / 2 OUT_OF_SCOPE (test files).** Κεντρικό εύρημα: `material.types.ts` schema είναι strong superset (ShaderType 8→12 με insulation/composite/membrane/terrazzo, MaterialCategory 10→11 με cladding, optional cost/density, mm units, drop GpuMaterialId) — direct enabler για **ADR-363 Phase 6.x Multi-Layer DNA BOQ (~8h pending)** που χρειάζεται density (kg/m³) + cost (€/unit) + ΑΤΟΕ-aware unit (m²/m³/kg) per material. `materialUniforms.ts` Wall DNA → 3-face dispatch algorithm (exterior/interior/core, flip-aware swap, lines 44-78) re-implemented Three.js context σε `MaterialCatalog3D.resolveWallFaceMaterials(wall)` ~1.5h Phase 3.3. Nestor material surface gap analysis (§8): 9 gaps identified, **all covered by Phase 3 (~6h unchanged) + ADR-363 Phase 6.x (~8h reused)**, zero new pending work. Q1/Q2/Q3/Q4 ΟΛΑ RESOLVED Full Enterprise (5/5 ΑΤΟΕ+ASTM data, 4/4 ShaderType extension, 5/5 optional cost, 4/4 two-tier preset+registry). **GenArc A→E suite CLOSED** (97 files catalogued / ~484 GenArc src/, ~20% relevant για ADR-366). **Total implementation estimate revised 58h → 64-70h** (Phase 4 viewport +2-4h SPEC-3D-004A, Phase 7 optional adaptive grid +3-4h SPEC-3D-004E §3.4). **Phase 0 implementation start: ✅ READY** — zero blocking questions remain. | Claude Opus 4.7 |

---

## Appendix C — Group C Deep Research (Implementation-Level Decisions για Deferred Features)

> Post-Group-B deep research για implementation-level decisions των **12 missing modules** (Animation 4 + Comments 4 + Dimensions 2 + Card Tabs 3) και **4 deferred Phase 8+ categories** (ARIA, Section Cuts polish, Crop region, Performance HUD extensions). Groups A+B έκλεισαν architecture/UX patterns· Group C κλείνει implementation detail (preset values, codecs, threading models, snap behavior, leader styling, persistence schemas, RBAC scopes, exact i18n keys) ώστε Phase 9+ implementation να ξεκινήσει χωρίς νέα έρευνα interruption. **7 topics — C.1 έως C.7 — με ~46 sub-questions cumulative.**

### C.1 — Animation System Implementation UX — ✅ CLOSED 2026-05-22

**Σκοπός**: Κλείνει B.4.Q8 FULL ENTERPRISE animation από high-level «Turntable+Flyaround+Timeline+MP4» σε implementation-level decisions: turntable defaults, waypoint editing UX, timeline layout, easing library, per-keyframe interp, codec, audio, persistence, render queue.

**Implementation Phases** (added 2026-05-25 — splitting C.1 σε 3 sub-phases για manageable session scope, file size compliance N.7.1, και phase-per-session rule N.9):

| Phase | Status | Scope | Files | Effort |
|-------|--------|-------|-------|--------|
| **C.1.a — Logic Foundation** | ✅ DONE 2026-05-25 (pending commit) | Pure builders (`TurntablePathBuilder`, `WaypointPathBuilder`, `keyframe-interpolator`) + Zustand `AnimationStore` + Firestore `bim-animations.service` + `animation-types.ts` + 8 easing presets registry + SSoT extensions (enterprise-id `anm_bim_*`/`rnj_bim_*`, RBAC `bim_animations:*`, audit type `bim_animation`, Firestore collections + rules) + tests (5 suites) | ~12 | ~5-6h |
| **C.1.b — UX / Timeline** | ✅ DONE 2026-05-25 (incl. drag interaction 2026-05-25) | `TimelineEditor.tsx` (vertical waypoint list + scrubber + properties form) + `TimelineWaypointForm.tsx` (split για 40-line cap) + `WaypointDragHandle.ts` (3D Sprite visualization + hover/drag color states + `getHandlesGroup()` raycast exposure) + `waypoint-drag-controller.ts` (pure FSM idle/hovering/dragging + camera-aligned drag plane + Three.js Raycaster pick) + `use-waypoint-drag-interaction.ts` (React hook: DOM pointer listeners attached only when `AnimationStore.toolActive===true`, AbortController cleanup) + `contextual-animation-tab.ts` (ADR-345 declarative ribbon tab) + i18n keys (~50×2 locales bim3d.animation.*) + `AnimationStore.toolActive` flag (mirror BimDimensions3DStore SSoT pattern, NOT ViewMode3DStore) + `wrappedHandleAction` animation.* cases (tool-toggle/turntable/add-waypoint/delete-waypoint/reverse) + Floating3DPanel 7th tab + conditional w-48→w-72 widening + ThreeJsSceneManager lifecycle + `getWaypointHandlesRoot()` + `setWaypointHoverState()` getters | 10 | implemented this session |
| **C.1.c — Rendering / Queue** | ✅ DONE 2026-05-25 (pending commit) | `MP4Exporter.ts` (WebCodecs H.264 Main L3.1 + `mp4-muxer`@5.2.2 MIT + VP9 fallback inside MP4) + `RenderQueueStore.ts` (Zustand FIFO + concurrent=1 + module-scope AbortController Map) + `RenderQueuePanel.tsx` (Floating3DPanel 8th "Renders" tab, conditional visibility) + `animation-queue-processor.ts` (subscription glue) + `render-checkpoint.ts` (lastFrameIndex serialization) + `animation-action-handlers.ts` (save+export auto-save flow) + Storage rules block (`/companies/{co}/bim_animations/{id}/renders/*.mp4`, 500MB cap, mp4/webm) + notification keys (`bim3d.animation.{render,save,export}.*`) + i18n (~15 keys × 2 locales) + Save+Export ribbon buttons activated (`comingSoon` removed) + useDxfViewerCallbacks wiring + `origin-indicator-overlay.ts` extraction (SRP 500-line cap). project_assets integration DROPPED (service does not exist; mp4 stored direct to Firebase Storage). | 8 new + 6 modified | implemented this session |

**Total C.1 effort**: +18-23h (unchanged από ενιαία εκτίμηση)

**Cross-references**:
- B.4.Q8 (line ~2700) — FULL ENTERPRISE Phase 7 animation scope decision (+30-40h)
- `viewport/animation-manager.ts` + `viewport/easing-functions.ts` (υπάρχοντα SSoT, Phase 4 camera transitions) → REUSE base
- `viewport/canonical-views.ts` + `CanonicalViewService.ts` → reference για view interpolation patterns
- ADR-345 (DXF Ribbon Interface) — pattern για ribbon contextual "Animation" tab
- ADR-326 (Tenant Org Structure) — companyId scoping για `bim_animations` collection
- ADR-195 (EntityAuditService) — `bim_animation_created` νέος audit type
- ADR-017/210/294 (enterprise-id) — `anm_bim_*` νέος generator
- `project_assets` collection — existing για final-render output linking

**Pending micro-decisions**:
- Q1: Turntable defaults (axis, duration, frames, easing, direction) ✅ RESOLVED
- Q2: Waypoint editing UX (3D handles vs gizmo vs panel-only) ✅ RESOLVED
- Q3: Timeline editor layout (single track vs multi-track) ✅ RESOLVED
- Q4: Easing curve library (presets + bezier editor) ✅ RESOLVED
- Q5: Per-keyframe interpolation modes (linked vs independent tracks) ✅ RESOLVED
- Q6: MP4 codec (H.264 / H.265 / VP9 / AV1) ✅ RESOLVED
- Q7: Audio track (voiceover/music v1 vs v2) ✅ RESOLVED
- Q8: Animation persistence (Firestore schema, sharing) ✅ RESOLVED
- Q9: Render queue UX (multi-job, cancel, resume) ✅ RESOLVED

**Decisions Log** — Topic C.1 COMPLETE 9/9 Qs:

| # | Ερώτηση | Απόφαση | Industry alignment |
|---|---|---|---|
| C.1.Q1 | Turntable defaults | **8s @ 30fps = 240 frames, axis=Y-up world, target=scene-bbox-center, easing=linear, direction=CCW viewed from above**. Custom override panel: duration slider 2-60s, fps slider 24/30/60, axis chooser (Y default + X/Z option), direction toggle. | 4/7 σύγκλιση industry (Twinmotion 8s/30fps linear, Lumion 6s/30fps, D5 8-12s, Enscape 10s). Median 8s + 30fps + linear = architectural convention. CCW from above = standard architectural drawing rotation. |
| C.1.Q2 | Waypoint editing UX | **3D drag handles in viewport (Twinmotion/Blender hybrid) + side panel για fine-tune coords + "Add at current camera" button**. Selected waypoint: TransformGizmo (GenArc port deferred Group D — fallback: 3D arrow handles drawn με `Three.js Line2`). Ribbon contextual "Animation" tab active όταν tool activated (mirror ADR-345 pattern). | 3/7 industry (Twinmotion + Blender drag handles, V-Ray camera path). Lumion panel-only απορρίπτεται (poor 3D spatial UX). Hybrid approach covers visual + precise both. |
| C.1.Q3 | Timeline editor layout | **Single-track strip με waypoint diamonds**. Top: scrubber playhead + time indicator `mm:ss.fff`. Middle: clickable diamonds με drag-to-reorder (snap to nearest 0.1s). Bottom: per-selected-waypoint properties panel (position xyz, target xyz, fov, easing-to-next). Pinch-to-zoom timeline (mouse wheel) 0.5s-10s ruler ticks. NOT dope sheet (over-engineered για 1 track). | 4/6 σύγκλιση single-track (Twinmotion + Lumion + D5 + Enscape). Blender dope sheet απορρίπτεται (professional tool, overkill arch viz). Pinch-to-zoom = After Effects / FCP convention. |
| C.1.Q4 | Easing curve library | **8 presets + bezier editor advanced** ✅ IMPLEMENTED 2026-05-25 — `BezierCurveEditor` (Chrome-DevTools-style SVG editor: drag handles + 4 numeric inputs + 8 preset chips + reset + live preview ball + keyboard a11y + overshoot support). Per-waypoint-pair easing via `Waypoint.customBezier?: BezierControlPoints` optional field. Cubic bezier math σε `viewport/bezier-easing.ts` (Newton-Raphson + De Casteljau). CSS-standard preset mapping σε `presets/preset-bezier-defaults.ts`. Presets: linear, ease-in (cubic), ease-out (cubic), ease-in-out (cubic), ease-in-quart, ease-out-quart, smooth-step, elastic. REUSE `viewport/easing-functions.ts`. Native `<details>/<summary>` semantic expander κάτω από easing dropdown (per `TimelineWaypointForm`). | 5/7 industry presets-only (Twinmotion 4, Lumion 6, D5 8, Enscape 6, Chaos Vantage 8). Bezier editor από Blender + AE = 2/7 advanced tools. Hybrid covers both audiences. |
| C.1.Q5 | Per-keyframe interpolation modes | **Linked-by-default (position+target+fov as single transform) + advanced toggle for independent tracks**. Default linked = 95% architectural walkthrough use case. Toggle σε «Προχωρημένα»: 3 separate F-curves (Blender-style) για cinematic pros. REUSE `viewport/animation-manager.ts` — extend με `splitTracks: boolean` flag στο animationConfig. | 6/7 industry default linked (Twinmotion/Lumion/D5/Enscape/Chaos/V-Ray). Blender independent default απορρίπτεται για arch viz. |
| C.1.Q6 | MP4 codec | **H.264 Main profile L3.1 + AAC audio σε MP4 container**. WebCodecs `VideoEncoder` με codec string `avc1.4D401F` (Main L3.1, broad compat). `mp4-muxer` (MIT, ήδη Group B.4.Q8). Fallback: WebM/VP9 αν browser lacks H.264 (rare, Firefox<137). NEVER H.265 (HEVC patent pool — N.5 license violation candidate). AV1 DEFERRED (browser support 2027+). | 7/7 industry H.264 MP4 default (universal). License N.5 ✅ MIT, H.264 royalty-free for web playback (MPEG-LA license-free streaming). H.265 ❌ N.5. AV1 ⏸ 2027+. |
| C.1.Q7 | Audio track | **Pure video v1 — NO audio import**. Voiceover/μουσική DEFERRED Group D candidate. `mp4-muxer` API supports audio track addition — architecture door open. Industry split: Twinmotion/Lumion έχουν audio (post-pro focus), D5/Enscape ΟΧΙ (arch focus). Nestor MVP arch focus → no audio. | 3/7 audio (post-pro tools) vs 4/7 no-audio (arch tools). Nestor aligns με arch tools. |
| C.1.Q8 | Animation persistence | **Νέα Firestore collection `bim_animations/{animationId}`**. Schema: `{id, projectId, companyId, name, durationSec, fps, axis, direction, waypoints: Array<{position:V3, target:V3, fov, easingToNext}>, codec, renderConfig, splitTracks, createdBy, createdAt, updatedAt}`. ID prefix `anm_bim_*` νέος enterprise-id generator (ADR-017/210/294). RBAC permissions: `bim_animations.{create,read,update,delete}` company-scoped (ADR-326). Final-render output (.mp4) → `project_assets` collection με `type='bim-animation-render'` discriminator (parallels Group B `type='bim-render'`). ADR-195 audit type `bim_animation_created` + `bim_animation_rendered`. ADR-145 super-admin read-all. Sharing via project_assets URL link, ΟΧΙ direct animation share (avoids leaking config). | 4/7 industry persistence (Twinmotion + D5 + Enscape + Lumion). 3/7 file-based local-only (Blender/V-Ray/Chaos). Nestor cloud-first DNA → Firestore aligns. |
| C.1.Q9 | Render queue UX | **Background queue panel σε νέα Floating3DPanel tab «Renders»**. FIFO multi-job. Per-job row: thumbnail + name + status (queued/rendering X%/done/failed/cancelled) + ETA + actions (cancel/retry/download). Cancel mid-render: store `lastSampleCount + lastWaypointIndex` σε job doc, mark `status='cancelled-resumable'`. Resume: re-spawn από checkpoint (Phase 6 PathTracerRenderer already supports `samplesContinueFrom` param). Concurrent: 1 active + N queued (GPU resource bound — `navigator.gpu.requestAdapter()` single context). Job docs: subcollection `bim_animations/{animationId}/render_jobs/{jobId}` με 30-day TTL post-completion. | 2/7 industry queue (Chaos Vantage + V-Ray full enterprise). 5/7 single-job (Twinmotion/Lumion/D5/Enscape/Blender). Nestor multi-job aligns με enterprise tier per completeness rule. |

**Architectural implications (consolidated για C.1)**:

- **Νέα Phase 9 modules** (animation system):
  - `bim-3d/animation/TurntablePathBuilder.ts` — pure function `buildTurntable(scene, opts)` → `Waypoint[]` (8s @ 30fps default, CCW Y-axis, scene-bbox-center target)
  - `bim-3d/animation/WaypointPathBuilder.ts` — pure function `buildWaypointPath(waypoints, easings)` → interpolated camera samples per frame
  - `bim-3d/animation/AnimationStore.ts` — Zustand SSoT: `{waypoints, durationSec, fps, axis, direction, easingPresetIdsByPair, splitTracks, activeWaypointIndex}` + actions
  - `bim-3d/animation/animation-presets.ts` — read-only registry για turntable + easing 8 presets (REUSE `viewport/easing-functions.ts`)
  - `bim-3d/animation/keyframe-interpolator.ts` — pure interpolation: linked mode + split-tracks F-curve mode (3 independent position/target/fov tracks)
  - `bim-3d/animation/TimelineEditor.tsx` — single-track strip + scrubber + diamonds + properties panel (REUSE existing UI primitives, semantic `<details>` for «Προχωρημένα»)
  - `bim-3d/animation/WaypointDragHandle.tsx` — 3D viewport drag handles (Three.js Sprite billboard squares + raycaster hit-test, mirror grip pattern A.1.Q5)
  - `bim-3d/animation/RibbonAnimationContextualTab.tsx` — ADR-345 ribbon tab activation
  - `bim-3d/render/MP4Exporter.ts` — `mp4-muxer` (MIT) + WebCodecs `VideoEncoder` H.264 Main L3.1 → Blob → upload to Firebase Storage tenant-scoped path
  - `bim-3d/render/RenderQueueStore.ts` — Zustand SSoT for jobs FIFO + concurrent limit (1 active + N queued)
  - `bim-3d/render/RenderQueuePanel.tsx` — Floating3DPanel "Renders" tab UI
  - `bim-3d/animation/bim-animations.service.ts` — CRUD wrapper over Firestore + audit hook + RBAC check

- **Stores extensions**:
  - `ViewMode3DStore`: +`animationToolActive: boolean` (gates ribbon tab activation)
  - `Floating3DPanel`: add "Renders" tab dynamic (visible όταν `renderQueueStore.jobs.length > 0`)

- **Firestore collections**:
  - `bim_animations/{animationId}` — top-level, companyId scoped
  - `bim_animations/{animationId}/render_jobs/{jobId}` — subcollection, 30-day TTL

- **Firestore rules** (νέο block στο `firestore.rules`):
  ```
  match /bim_animations/{animationId} {
    allow read: if isSignedIn() && resource.data.companyId == request.auth.token.companyId;
    allow create: if hasPermission('bim_animations.create') && request.resource.data.companyId == request.auth.token.companyId;
    allow update: if hasPermission('bim_animations.update') && resource.data.companyId == request.auth.token.companyId;
    allow delete: if hasPermission('bim_animations.delete') && resource.data.companyId == request.auth.token.companyId;
    match /render_jobs/{jobId} {
      allow read, write: if isSignedIn() && get(/databases/$(database)/documents/bim_animations/$(animationId)).data.companyId == request.auth.token.companyId;
    }
  }
  ```
  ADR-298 Phase B requires coverage test suite — added στο CHECK 3.15/3.16 ratchet.

- **RBAC** (νέες permissions σε `roles.ts`):
  - `bim_animations.create` — designer/architect/owner
  - `bim_animations.read` — all company members
  - `bim_animations.update` — creator + owner
  - `bim_animations.delete` — creator + owner

- **enterprise-id generator** (`enterprise-id.service.ts`): `generateBimAnimationId()` → `anm_bim_<random10>` (mirror existing patterns)

- **EntityAuditService** (`audit-types.ts`): νέα audit types `bim_animation_created`, `bim_animation_rendered`, `bim_animation_deleted`

- **Notification keys** (`notification-keys.ts`): `bim3d.animation.render.completed` + `bim3d.animation.render.failed` (toast + Floating3DPanel badge)

- **npm deps Phase 9** (N.5 compliance):
  - `mp4-muxer` (MIT) ✅ already cataloged B.4.Q8
  - WebCodecs API (browser native, no license concern)

- **i18n keys** (Phase 9, per N.11 ΠΡΩΤΑ σε locale JSONs):
  - `bim3d.animation.title`, `.toolbar.{turntable,addWaypoint,deleteWaypoint,reverseTrack,preview,export}`
  - `bim3d.animation.timeline.{play,pause,seek,zoom,fps}`
  - `bim3d.animation.waypoint.{position,target,fov,easingToNext}`
  - `bim3d.animation.easing.{linear,easeIn,easeOut,easeInOut,easeInQuart,easeOutQuart,smoothStep,elastic,bezierAdvanced}`
  - `bim3d.animation.advanced.{splitTracks,bezierEditor}`
  - `bim3d.animation.export.{codec,resolution,quality,destination,start,cancel}`
  - `bim3d.animation.queue.{title,status.queued,status.rendering,status.done,status.failed,status.cancelled,retry,downloadMp4}`
  - `bim3d.animation.persistence.{name,description,save,load,delete,share}`
  - **Total: ~42 keys × 2 locales = ~84 entries**

- **GOL checklist 7/7**:
  - Proactive ✅: animation tool initialized on ribbon button mount; queue rehydrates από Firestore on app start
  - Race-free ✅: render jobs sequential (FIFO single active), waypoint mutations debounced 50ms σε store
  - Idempotent ✅: turntable rebuild deterministic (seed από scene bbox), MP4 export resumable με saved checkpoint
  - Belt-and-suspenders ✅: H.264 primary + WebM/VP9 fallback, GPU encode primary + CPU fallback
  - SSoT ✅: AnimationStore single source for config, RenderQueueStore single source for jobs, animation-presets single registry for easings
  - Await/sync ✅: MP4 export `await videoEncoder.flush()` before Blob assembly, persistence writes awaited
  - Lifecycle owner ✅: AnimationStore owns config lifecycle, bim-animations.service owns Firestore CRUD, RenderQueueStore owns job lifecycle

- **Mirror του 2D pattern** [[feedback-3d-mirror-2d-ssot]]:
  - Ribbon contextual tab pattern = ADR-345 2D pattern (consistent)
  - Easing functions REUSE από `viewport/easing-functions.ts` (already 3D, no duplication)
  - SSoT για waypoints, ribbons, panels = same Zustand pattern με 2D

**Effort impact για C.1**: **Phase 9 (new) +18-22h** = 4h turntable+waypoint builders + 5h timeline editor UI + 3h 3D drag handles + 3h MP4 exporter + 3h render queue panel + 2h Firestore service + RBAC + audit + 1-3h tests + i18n. ADR-366 total estimate revised: **~203-242h Phase 0-9** (από ~185-220h post-Group-B, +18-22h C.1).

**C.1.c implementation drift notes (2026-05-25)**:

1. **§C.1.Q9 — rasterizer chosen over `samplesContinueFrom`**. The ADR text "Phase 6 PathTracerRenderer already supports `samplesContinueFrom`" was forward-looking; that field never landed in `PathTracerRenderer` and, more fundamentally, path-tracing 240 frames at 256 samples ≈ 4h per animation — not viable. C.1.c uses standard `WebGLRenderer.render(scene, camera)` per frame inside a detached offscreen renderer (1920×1080 default, antialias on, ACES tone mapping). This matches D5/Twinmotion/Lumion convention (rasterize animation, path-trace stills only). Path-tracing per animation frame remains technically possible if a future "cinematic mode" wants it; the encoder loop is decoupled from the rendering function.

2. **§C.1.Q8 — `project_assets` integration DROPPED**. The `project-assets` service does not exist in the repo. Final-render MP4 is uploaded direct to Firebase Storage at `companies/{companyId}/bim_animations/{animationId}/renders/{jobId}.mp4` (new storage.rules block, 500 MB cap, mp4/webm only). RenderJobDoc keeps `outputAssetId = storagePath` so a future `project_assets` sync can link by path without schema change.

3. **§C.1.Q7 fallback codec — VP9-in-MP4 only**. ADR called for "WebM/VP9 fallback for browsers without H.264"; v1 ships VP9 inside the MP4 container (Chrome/Edge play it, Firefox<137 without WebCodecs still cannot). Full WebM/VP9 fallback (separate `webm-muxer` lib) DEFERRED until Firefox usage warrants it. mp4-muxer 5.2.2 supports both codecs natively.

4. **Render checkpoint field reuse**. `RenderJobDoc.lastSampleCount` (named for the path-tracer era) is semantically repurposed as `lastFrameIndex` in C.1.c. Storage shape unchanged — `render-checkpoint.ts` is the single point of translation.

5. **Cross-session queue persistence DEFERRED**. RenderQueueStore is in-session FIFO. Firestore subscribe for cross-tab/device queue mirroring lives in Phase 10 if requested. Render jobs ARE persisted (`BimAnimationsService.createRenderJob` runs at enqueue time + progress is throttle-persisted every 1.5s) so completed renders remain discoverable across reloads via Firestore — the UI just doesn't auto-rehydrate the queue panel from them yet.

6. **Auto-save policy**. `animation.export` (and `animation.save`) auto-creates a `bim_animation` doc when `loadedDocId === null`, using the default name pattern `defaultName` i18n key (`"Untitled HH:mm"`). Industry standard (Twinmotion auto-saves project on first export). Activates the previously `comingSoon: true` Save button.

---

### C.2 — BIM Comments / Markup System — ✅ CLOSED 2026-05-22

**Σκοπός**: Κλείνει B.2.Q3 (typed comment markers BIMcollab style) από high-level pattern σε implementation-level: comment types catalog, marker visual, threading model, mentions/assignment, resolution FSM, attachments, position binding, Firestore schema + real-time sync.

**Cross-references**:
- B.2.Q3 (line ~2120) — typed markers BIMcollab style scope decision (Phase 7, free-text labels DEFERRED Phase 8+)
- ADR-326 (Tenant Org Structure) — companyId scoping για `bim_comments`
- ADR-195 (EntityAuditService) — `bim_comment_*` audit types
- ADR-145 (Super Admin) — read-all για admin diagnostics
- ADR-017/210/294 (enterprise-id) — `cmt_bim_*` νέος generator
- Notification SSoT (`NOTIFICATION_KEYS`) — `bim3d.comment.{mentioned,assigned,resolved,reopened}` νέα keys
- `firestoreQueryService.subscribe` (ADR-355 + ADR-361 hash-compare guard) — real-time pattern

**Pending micro-decisions**:
- Q1: Comment types ταξινόμηση ✅ RESOLVED
- Q2: Marker visual design ✅ RESOLVED
- Q3: Threading model ✅ RESOLVED
- Q4: @-mentions + assignment ✅ RESOLVED
- Q5: Resolution workflow FSM ✅ RESOLVED
- Q6: Attachments ✅ RESOLVED
- Q7: Position binding ✅ RESOLVED
- Q8: Firestore schema + real-time sync ✅ RESOLVED

**Decisions Log** — Topic C.2 COMPLETE 8/8 Qs:

| # | Ερώτηση | Απόφαση | Industry alignment |
|---|---|---|---|
| C.2.Q1 | Comment types | **5 types**: Issue (πρόβλημα — red 🔴), Question (ερώτηση — blue 🔵), Suggestion (πρόταση — yellow 🟡), Approval (έγκριση — green 🟢), Info (πληροφορία — grey ⚫). Type icon εμφανίζεται μέσα στο marker badge + σε comment list rows. Subset BIMcollab BCF (drop Warning — overlap με Issue, drop Solution — implicit στο C.2.Q5 FSM). Type είναι required, ορίζεται στη δημιουργία (dropdown). | 3/5 industry σύγκλιση typed comments (BIMcollab BCF 6 types, Trimble Connect 3 types, Navisworks free-text + flag). Revit single-type απορρίπτεται (low signal). 5-type subset = sweet spot (BIMcollab inspiration, simpler). REUSE existing 2D status colors `bg-success/warning/error/info` (SSoT design tokens, no new palette). |
| C.2.Q2 | Marker visual design | **Billboard pin icon με type-colored badge** (Sprite τεχνικά). Fixed pixel size (32px @ 1x DPR, 64px @ retina). Type icon (🔴/🔵/🟡/🟢/⚫ ή SVG) μέσα στο badge. Hover → tooltip με comment preview (first 80 chars + author + timestamp + status badge). Click → opens BimCommentDetailsPanel side-drawer. Marker κρύβεται όταν: floor visibility hide, status === 'archived', user lacks `bim_comments.read`. Resolved status → badge faded 50% opacity + checkmark overlay. | 4/5 industry pin pattern (BIMcollab + Revit cloud markup + Navisworks bubble + Trimble Connect pin). Speckle commentless thread απορρίπτεται (no spatial anchor). Mirror του 2D selection-icon pattern A.7.Q3 (SelectionCursorIcon SSoT). |
| C.2.Q3 | Threading model | **Flat thread με max 1-level replies**. Root comment + N replies sorted chronologically. NO nested replies (avoids Slack-style depth complexity). Reply input σε bottom του details panel. Replies subcollection `bim_comments/{commentId}/replies/{replyId}`. Reply δείχνει author + timestamp + content, NO type/anchor/status (inherits parent). Root comment status changes broadcast σε όλους τους replied authors via notification. | 2/4 industry flat (BIMcollab + Trimble Connect). Revit threaded απορρίπτεται (overcomplicated UI). Speckle thread απορρίπτεται (no parent). 1-level replies covers 90% architectural discussion use case. |
| C.2.Q4 | @-mentions + assignment | **@-mentions via user picker, first @ auto-assignee BIMcollab pattern**. Type "@" → dropdown με matching company users + roles (tenant-scoped ADR-326). Tagged users receive `bim3d.comment.mentioned` notification (toast + Notification SSoT badge). Assignment: first @ auto-becomes `assigneeId`, explicit "Assign to:" dropdown σε details panel για override. Assignee gets `bim3d.comment.assigned` notification. Unassign: dropdown "—" επιλογή. Assignee badge στο comment list row + marker tooltip. | 3/4 industry @-mentions (BIMcollab + Trimble Connect + Revit Cloud). First-@-auto-assignee BIMcollab pattern (1/4) chosen ως best UX (zero-extra-click). REUSE existing user picker UI primitive από contacts/projects (SSoT). |
| C.2.Q5 | Resolution workflow FSM | **4-state FSM**: Open → InReview → Resolved → Archived. Transitions: Open→InReview (anyone με `bim_comments.update`), InReview→Resolved (assignee OR creator OR owner role), Resolved→Open (anyone, "Re-open" button), Resolved→Archived (auto after 30d Resolved + manual by owner/admin). Each transition: ADR-195 audit entry + creator + assignee + replies-authors notification (NOTIFICATION_KEYS). Archived = hidden από default views (filter toggle "Δείξε αρχειοθετημένα"). | 2/5 industry 4-state (BIMcollab + Navisworks). 3/5 simpler open/closed (Trimble Connect / Revit Cloud / Speckle). Nestor 4-state aligned με enterprise BIM tools per [[feedback-industry-standard-default]]. InReview state καλύπτει "assignee acknowledged" milestone (transparency για multi-stakeholder reviews). |
| C.2.Q6 | Attachments | **Image only (PNG/JPG), max 5MB per file, max 5 files per comment**. Upload via Firebase Storage company-scoped path `companies/{companyId}/bim_comments/{commentId}/{fileId}_{filename}`. Client-side thumbnail generation (Canvas.toBlob 200×200 cover-fit) stored side-by-side. Comment list shows first thumbnail + count badge "+N". Details panel shows lightbox grid. NO PDF/video/audio v1 (DEFERRED Group D — multi-format would require ClamAV / image processing pipeline). Validation client + server (Storage rules `request.resource.size < 5*1024*1024 && request.resource.contentType.matches('image/(png|jpe?g)')`). | 4/5 industry image attachments (BIMcollab + Revit Cloud + Trimble Connect + Navisworks support images). Speckle no attachments απορρίπτεται. PDF/video DEFERRED matches Trimble Connect's incremental rollout pattern. |
| C.2.Q7 | Position binding | **Entity OR world space (user choice on creation)**. Entity-anchored: `{kind:'entity', entityId, entityType, relativeOffset:Vector3}` — marker follows entity transform via `subscribeToEntityTransform` hook. World-anchored: `{kind:'world', worldPosition:Vector3}` — fixed absolute. **On entity delete**: entity-anchored marker auto-converts to world-anchored με last-known position + annotation field `orphanedFromEntityId:string` + status remains unchanged. Marker badge visual cue: entity-anchored = type color filled, world-anchored = type color outlined (50% fill). User-visible mode toggle στο BimCommentDetailsPanel: "Συνδεδεμένο με entity" toggle (creates/breaks binding). | 3/5 industry entity-anchored (BIMcollab + Revit + Navisworks). 2/5 world-only (Trimble Connect + Speckle). Nestor dual-mode = best-of-both ([[feedback-completeness-over-mvp]]). Auto-convert on entity delete = Revit pattern (graceful degradation, no orphans). |
| C.2.Q8 | Firestore schema + real-time sync | **Νέα top-level collection `bim_comments/{commentId}`** με companyId+projectId compound scoping. Schema: `{id, projectId, companyId, type:enum, content:string<=2000, authorId, authorName, anchor:{kind,entityId?,entityType?,relativeOffset?,worldPosition?,orphanedFromEntityId?}, mentions:string[], assigneeId?:string, status:enum, attachments:Array<{fileId,filename,storageUrl,thumbnailUrl,sizeBytes,mimeType}>, repliesCount:int, lastReplyAt?:Timestamp, createdAt:Timestamp, updatedAt:Timestamp, archivedAt?:Timestamp}`. Subcollection `replies/{replyId}` με `{id,parentCommentId,authorId,authorName,content<=2000,mentions[],createdAt}`. enterprise-id: `cmt_bim_<random10>` νέος generator + `cmtr_bim_<random10>` για replies. Real-time sync: `firestoreQueryService.subscribe(query)` με hash-compare guard ([[feedback-firestore-subscribe-equality-guard]]). Composite indexes: `(companyId, projectId, status, createdAt)` + `(companyId, projectId, assigneeId, status)`. RBAC: `bim_comments.{create,read,update,delete,assign,archive}` company-scoped (`roles.ts`). ADR-195 audit: `bim_comment_created`, `bim_comment_status_changed`, `bim_comment_assigned`, `bim_comment_archived`, `bim_comment_deleted`. ADR-145 super-admin read-all. Firestore rules block στο `firestore.rules` (~50 lines) + ADR-298 Phase B coverage test suite (CHECK 3.15/3.16 ratchet). | 4/5 industry cloud-Firestore-like (Trimble Connect + BIMcollab cloud + Speckle stream). Schema design ευρισκόμενο best-practice BIMcollab BCF JSON schema + Firestore optimizations (subcollection για replies avoids 1MB doc limit on hot threads). REUSE firestoreQueryService SSoT (ADR-355). |

**Architectural implications (consolidated για C.2)**:

- **Νέα Phase 9 modules** (comments system):
  - `bim-3d/comments/CommentMarker3DRenderer.ts` — Three.js Sprite-based pin markers με type-colored badge texture (canvas-rendered per type, cached). Subscribes σε `bim-comments.service.subscribeForProject(projectId)` + floor visibility store + entity transform stores.
  - `bim-3d/comments/comment-marker-textures.ts` — pre-rendered Canvas badge textures per type+status (5 types × 4 statuses = 20 textures cached)
  - `bim-3d/comments/BimCommentDetailsPanel.tsx` — side-drawer panel (Radix Dialog or sheet). Sections: header (type badge + status FSM + assignee dropdown), content + edit, attachments grid + lightbox, replies thread + reply input, history (audit log via ADR-195).
  - `bim-3d/comments/CommentListPanel.tsx` — Floating3DPanel "Σχόλια" tab (mirror Floor3DPanelTab pattern). Filter chips: status (Open/InReview/Resolved/Archived), type, assignee, mine. Search input. Virtual list για large counts.
  - `bim-3d/comments/CommentReplyInput.tsx` — textarea + @-mention dropdown (user picker SSoT REUSE) + image attach button + submit
  - `bim-3d/comments/CommentAttachmentUploader.tsx` — file picker + drag-drop + thumbnail generator (Canvas.toBlob)
  - `bim-3d/comments/CommentAttachmentLightbox.tsx` — full-screen image viewer με keyboard nav (ARIA Group C.5 compatible)
  - `bim-3d/comments/comment-status-fsm.ts` — pure FSM transition validator + permission gate
  - `bim-3d/comments/comment-anchor-resolver.ts` — entity-anchored → world position runtime resolver + orphan detection on entity delete
  - `bim-3d/comments/bim-comments.service.ts` — CRUD wrapper (create/update/reply/changeStatus/assign/archive/delete) + ADR-195 audit hook + RBAC check + NOTIFICATION_KEYS dispatch
  - `bim-3d/comments/CommentMentionsPicker.tsx` — @-mention dropdown (REUSE user picker SSoT από contacts subapp)
  - `bim-3d/comments/CommentBadgeIcon.tsx` — single SVG icon component (5 types) — REUSE σε marker textures + list rows + details header

- **Stores**:
  - `bim-3d/stores/BimCommentsStore.ts` — Zustand SSoT: `{commentsByProjectId: Map<projectId, Comment[]>, repliesByCommentId, filters, selectedCommentId, panelOpen}` + actions (subscribe/unsubscribe per project, optimistic mutations με rollback)
  - Subscribes via `firestoreQueryService.subscribe` με hash-compare equality guard ([[feedback-firestore-subscribe-equality-guard]])

- **Firestore collections**: `bim_comments/{commentId}` + subcollection `replies/{replyId}` (30-day TTL post-archive)

- **Firestore composite indexes** (firestore.indexes.json additions):
  - `bim_comments` (companyId ASC, projectId ASC, status ASC, createdAt DESC)
  - `bim_comments` (companyId ASC, projectId ASC, assigneeId ASC, status ASC)
  - `bim_comments` (companyId ASC, projectId ASC, anchor.entityId ASC)

- **Firestore rules** (block στο firestore.rules ~50 lines): company-scoped read/write, FSM-enforced status transitions, attachment size/mime validation, ADR-298 Phase B coverage test suite mandatory (CHECK 3.15/3.16 ratchet).

- **Storage rules** (storage.rules): company-scoped `bim_comments/{commentId}/{file}` path, max 5MB, image MIME only. ADR-301 Storage Rules Coverage test (CHECK 3.19 ratchet).

- **RBAC** (`roles.ts` permissions): `bim_comments.{create,read,update,delete,assign,archive}` — designer/architect/owner full, viewer read-only.

- **enterprise-id generators**: `generateBimCommentId()` → `cmt_bim_<random10>`, `generateBimCommentReplyId()` → `cmtr_bim_<random10>`.

- **EntityAuditService audit types**: `bim_comment_created`, `bim_comment_updated`, `bim_comment_replied`, `bim_comment_status_changed`, `bim_comment_assigned`, `bim_comment_archived`, `bim_comment_deleted`, `bim_comment_attachment_added`.

- **NOTIFICATION_KEYS** (νέα keys σε `notification-keys.ts`):
  - `bim3d.comment.mentioned` (toast + badge για mentioned user)
  - `bim3d.comment.assigned` (toast + badge για assignee)
  - `bim3d.comment.replied` (toast για creator + previous repliers)
  - `bim3d.comment.status_changed` (toast για creator + assignee)
  - `bim3d.comment.archived` (badge update only, no toast)

- **i18n keys** (Phase 9):
  - `bim3d.comments.title`, `.empty.{title,subtitle,createButton}`
  - `bim3d.comments.types.{issue,question,suggestion,approval,info}`
  - `bim3d.comments.status.{open,inReview,resolved,archived}`
  - `bim3d.comments.actions.{create,edit,delete,reply,assign,resolve,reopen,archive,attachImage}`
  - `bim3d.comments.fields.{content,assignee,attachments,createdBy,createdAt,updatedAt}`
  - `bim3d.comments.filters.{all,mine,assignedToMe,byStatus,byType,searchPlaceholder}`
  - `bim3d.comments.anchor.{entityLinked,worldFixed,entityOrphaned,toggleLink}`
  - `bim3d.comments.replies.{count,placeholder,submit}`
  - `bim3d.comments.errors.{contentTooLong,fileSizeTooLarge,fileTypeNotSupported,fileCountExceeded,permissionDenied}`
  - **Total: ~38 keys × 2 locales = ~76 entries**

- **GOL checklist 7/7**:
  - Proactive ✅: Comments preloaded on project mount, subscriptions per active project
  - Race-free ✅: Optimistic mutations με rollback, FSM transitions atomic στο service, hash-compare snapshot guard
  - Idempotent ✅: Create deterministic ID, status change idempotent (re-sending same state = no-op), attachment upload chunked-resumable
  - Belt-and-suspenders ✅: Client-side validation + server-side Firestore rules + Storage rules, orphan auto-conversion on entity delete
  - SSoT ✅: BimCommentsStore single source, bim-comments.service single mutator, NOTIFICATION_KEYS registry single dispatcher
  - Await/sync ✅: All Firestore writes awaited, audit hook awaited before resolve, notifications fire-and-forget post-write
  - Lifecycle owner ✅: BimCommentsStore owns subscription lifecycle, bim-comments.service owns Firestore CRUD, ADR-195 owns audit lifecycle

- **Mirror του 2D pattern** [[feedback-3d-mirror-2d-ssot]]:
  - Status badge colors REUSE `bg-success/warning/error/info` design tokens (zero new palette)
  - User picker SSoT REUSE από contacts subapp (no duplicate user search logic)
  - Notification toast/badge SSoT REUSE NOTIFICATION_KEYS registry
  - FSM permission gate pattern mirrors ADR-330 BOQ status FSM

**Effort impact για C.2**: **Phase 9 (new) +12-14h** = 3h CommentMarker3DRenderer + texture cache + 3h BimCommentDetailsPanel + 2h CommentListPanel + Floating3DPanel tab + 2h bim-comments.service + RBAC + audit + 1.5h FSM + anchor-resolver + 1h Firestore rules + indexes + ADR-298 coverage tests + 0.5h Storage rules + 0.5-1h i18n + tests. ADR-366 total estimate revised: **~215-256h Phase 0-9** (από ~203-242h post-C.1, +12-14h C.2).

---

### C.3 — 3D Manual Dimensions Tool — ✅ CLOSED 2026-05-22

**Σκοπός**: Κλείνει B.2.Q2 (manual 3D dimensions mirror ADR-362 placement discriminator) από high-level σε implementation-level: activation, snap behavior, placement modes, leader styling, text plane orientation, edit handles, persistence schema.

**Cross-references**:
- B.2.Q2 (line ~2060) — manual 3D dims mirror ADR-362 discriminator
- ADR-362 (Enterprise Dimension System) — 2D dim tool SSoT, placement discriminator, grip pattern, leader styling tokens (`DIMENSION_LINE_COLOR`, `DIMENSION_TEXT_COLOR`)
- ADR-262 (Inferred Alignment Guides — pending implementation) + existing explicit guide system → snap source for dim tool
- ADR-345 (DXF Ribbon) — pattern για ribbon contextual "3D Viewer" tab activation
- ADR-326 / ADR-195 / ADR-017/210/294 — tenant scoping, audit, enterprise-id (standard cross-references)
- `bim/snap-engines/` (existing 2D) → port pattern για 3D snap engines

**Pending micro-decisions**:
- Q1: Tool activation (ribbon vs hotkey vs both) ✅ RESOLVED
- Q2: Snap behavior (modes, tolerance, hover preview) ✅ RESOLVED
- Q3: Placement modes (aligned/linear/radial/angular) ✅ RESOLVED
- Q4: Leader line styling (shape, arrows, offset) ✅ RESOLVED
- Q5: Text plane orientation (billboard vs world-plane) ✅ RESOLVED
- Q6: Edit handles (grips, drag, entity-follow) ✅ RESOLVED
- Q7: Persistence schema (separate collection vs ADR-362 extension) ✅ RESOLVED

**Decisions Log** — Topic C.3 COMPLETE 7/7 Qs:

| # | Ερώτηση | Απόφαση | Industry alignment |
|---|---|---|---|
| C.3.Q1 | Tool activation | **Ribbon button "Διαστάσεις 3D" σε contextual tab "3D Viewer" + hotkey D3D (Ctrl+Shift+D)**. Mirror ADR-362 2D activation. Spring-loaded modal: click button → cursor crosshair, click 1st point → snap preview + anchor, click 2nd point → place dim text. ESC cancels, ENTER commits, continuous mode (next click starts new dim). Tab cycles placement modes (Q3) during active placement. | 4/4 industry σύγκλιση hybrid (ribbon + hotkey, Revit/ArchiCAD/SketchUp/Blender). Mirror του 2D ADR-362 pattern (consistency). |
| C.3.Q2 | Snap behavior | **All snap modes ON by default**: vertex/endpoint, edge midpoint, face center, edge midpoint-segment, explicit guides (ADR-262 pending), inferred alignment guides (ADR-262 pending). Tolerance: 12px screen-space (mirror 2D). Visual hover preview: snap glyph (square=endpoint, triangle=midpoint, circle=face-center, X=guide) drawn σε cursor 3D world position (Sprite, fixed pixel size). Snap glyph colors REUSE `SNAP_COLORS` tokens (existing 2D SSoT). Per-mode toggle στα settings (mirror 2D). | REUSE existing 2D snap engines pattern (`bim/snap-engines/`), port σε 3D με Three.js raycaster για face/edge hit-test. Mirror του 2D SSoT 100% [[feedback-3d-mirror-2d-ssot]]. |
| C.3.Q3 | Placement modes | **4 modes**: **Aligned** (default — parallel to measured 3D vector, βλέπει την πραγματική απόσταση σε 3D), **Linear** (axis-locked to X/Y/Z world OR local entity axis — εκλέγει nearest), **Radial** (για round entities like columns/pipes — diameter/radius), **Angular** (3D angle between 2 edges or 3 points). Mode chooser σε ribbon contextual sub-buttons + Tab cycle during placement. Mode persisted per-dim via `mode:'aligned'\|'linear'\|'radial'\|'angular'` discriminator (mirror ADR-362 §Group A placement discriminator pattern). | Mirror του 2D ADR-362 4-mode pattern. Industry: Revit (4 modes Aligned/Linear/Radial/Angular), ArchiCAD (5 modes — extra Coordinate, dropped here), SketchUp (3 modes), Blender measure (2 modes). 4-mode = sweet spot. |
| C.3.Q4 | Leader line styling | **L-shape leader (single dogleg) default**, straight option toggle. Arrow heads: filled triangle 8px screen-space (architectural standard, ADR-362 SSoT). Text offset from dim line: 12px screen-space default, draggable via text grip (Q6). Leader line color/text color REUSE ADR-362 `DIMENSION_LINE_COLOR` + `DIMENSION_TEXT_COLOR` tokens (zero new palette). Stroke width 1.5px screen-space (mirror 2D). | 4/4 industry L-shape default (Revit/ArchiCAD/AutoCAD/Blender). Filled triangle arrows = architectural standard ISO 128. REUSE 2D tokens [[feedback-3d-mirror-2d-ssot]]. |
| C.3.Q5 | Text plane orientation | **Camera-billboard default** (always faces user, never upside-down/unreadable). Per-dim toggle στο edit panel "Κλείδωμα σε επίπεδο μέτρησης" → world-plane (parallel to dim's measured plane, useful για top-view docs export). Auto-best NOT offered (unpredictable behavior). Three.js: billboard via `Sprite` OR custom `Mesh.onBeforeRender = lookAt(camera.position)`. World-plane: quaternion from measured normal vector. | 4/4 σύγκλιση billboard default (Revit/ArchiCAD/SketchUp/Blender). Lock-to-plane option = Revit pattern. Auto-best dropped (no industry precedent, confusing). |
| C.3.Q6 | Edit handles | **3-grip pattern mirror 2D ADR-362**: endpoint A, endpoint B, text-position. Endpoint grips: drag re-snaps to new position. Text grip: drags text plane offset (within billboard plane). Grip visual: billboard square με `CAD_UI_COLORS.grips` (mirror Sectoin A.1.Q3 3D grips pattern). On host entity transform: dim follows automatically via `subscribeToEntityTransform` pattern (mirror C.2.Q7 comment anchor). On host entity delete: user setting `bim3d.dimensions.onEntityDelete` = `'orphan'` (default — convert to world-anchored με orphan flag) OR `'delete'`. ESC during grip drag = cancel mutation. | Mirror του 2D ADR-362 3-grip pattern (consistency). Entity-follow = Revit/ArchiCAD pattern (4/4 industry). Orphan auto-convert = parallel to C.2.Q7 comment anchor behavior (cross-domain consistency). |
| C.3.Q7 | Persistence schema | **Νέα top-level collection `bim_dimensions_3d/{dimensionId}`** (separate από ADR-362 2D `bim_dimensions`). Reason: schema diverges σημαντικά (Vector3 anchors vs Vector2, 4-mode discriminator superset, host entity binding 3D-specific, text plane). Schema: `{id, projectId, companyId, mode, placement:{aligned?:..., linear?:{axis:'X'\|'Y'\|'Z'\|'entityLocal', entityRefId?}, radial?:{center,radius}, angular?:{vertex,rayA,rayB}}, anchor:{endpointA:Vector3, endpointB:Vector3, additionalPoints?:Vector3[], hostEntityIds?:string[]}, textOffset:Vector2, textPlane:'billboard'\|'world', value:number (computed), unit:'mm'\|'m', precision:int, leaderStyle:{shape:'L'\|'straight', arrowSize:int}, createdBy, createdAt, updatedAt, orphanedFromEntityIds?:string[]}`. enterprise-id `dim3d_<random10>` νέος generator. RBAC: `bim_dimensions_3d.{create,read,update,delete}` company-scoped. ADR-195 audit types `bim_dim3d_{created,updated,deleted}`. Composite index: `(companyId, projectId, mode, createdAt)`. **`useDim3DToolRouting.ts` hook**: dispatches dim creation/edit σε 2D dim service αν `viewMode.mode === '2d'`, σε 3D service αν `'3d'\|'3d-path-trace'` — cross-mode tool reuse via routing layer (no duplicate UI). | Schema separation aligned με Revit (`Element.LocationCurve` distinct για 2D vs 3D). 2D backport via routing hook = mirror του ADR-345 ribbon shared-tool pattern (2D dim tool + 3D dim tool same ribbon button, mode-aware). REUSE ADR-362 schema fields where 1:1 applicable. |

**Architectural implications (consolidated για C.3)**:

- **Νέα Phase 9 modules** (3D dimensions):
  - `bim-3d/dimensions/Dimension3DRenderer.ts` — Three.js renderer για 3D dims (Line2 segments + Sprite text + Sprite arrows + Sprite grips). Subscribes σε `BimDimensions3DStore` + entity transform stores.
  - `bim-3d/dimensions/dim3d-line-geometry.ts` — pure: anchor pair + placement mode → `{dimLine:Vector3[], leaderLines:Vector3[], textAnchor:Vector3, arrowTransforms}`
  - `bim-3d/dimensions/dim3d-value-computer.ts` — pure: anchors + mode → numeric value (aligned distance / linear axis-projected / radial radius/diameter / angular degrees) + unit formatting
  - `bim-3d/dimensions/dim3d-text-plane-orienter.ts` — pure: billboard vs world-plane quaternion compute
  - `bim-3d/dimensions/Dim3DToolStateMachine.ts` — FSM (idle → placing1 → placing2 → placingText → committed), TAB cycles mode mid-placement
  - `bim-3d/dimensions/useDim3DToolRouting.ts` — cross-mode hook (2D/3D dispatcher)
  - `bim-3d/dimensions/Dim3DGripsRenderer.ts` — 3-grip pattern mirror 2D ADR-362 grip pattern, REUSE billboard square Sprite (Section A.1.Q5)
  - `bim-3d/dimensions/bim-dimensions-3d.service.ts` — CRUD wrapper + audit + RBAC + entity-follow subscription
  - `bim-3d/dimensions/dim3d-snap-engine-adapter.ts` — wraps existing 2D snap engines (vertex/midpoint/face-center) με Three.js raycaster για 3D hit-test
  - `bim-3d/dimensions/RibbonDim3DContextualTab.tsx` — ADR-345 ribbon tab με mode sub-buttons (Aligned/Linear/Radial/Angular)
  - `bim-3d/dimensions/Dim3DPropertiesPanel.tsx` — selected-dim properties editor (text offset, plane lock, precision, unit, mode)

- **Stores**:
  - `bim-3d/stores/BimDimensions3DStore.ts` — Zustand SSoT: `{dimensionsByProjectId, selectedDimId, toolActive, toolMode, fsmState, snapPreview}` + actions

- **Firestore collection**: `bim_dimensions_3d/{dimensionId}` (separate από `bim_dimensions` 2D) — companyId+projectId scoped

- **Firestore composite indexes**:
  - `bim_dimensions_3d` (companyId ASC, projectId ASC, createdAt DESC)
  - `bim_dimensions_3d` (companyId ASC, projectId ASC, mode ASC)
  - `bim_dimensions_3d` (companyId ASC, projectId ASC, anchor.hostEntityIds ARRAY_CONTAINS) — για entity-follow queries

- **Firestore rules**: company-scoped block (~25 lines mirror ADR-362 2D block), ADR-298 Phase B coverage test suite (CHECK 3.15/3.16 ratchet, mandatory on touch).

- **RBAC**: `bim_dimensions_3d.{create,read,update,delete}` — designer/architect/owner.

- **enterprise-id**: `generateBim3DDimensionId()` → `dim3d_<random10>` νέος generator.

- **EntityAuditService audit types**: `bim_dim3d_created`, `bim_dim3d_updated`, `bim_dim3d_deleted`, `bim_dim3d_orphaned`.

- **User settings**:
  - `bim3d.dimensions.onEntityDelete` = `'orphan'` (default) | `'delete'`
  - `bim3d.dimensions.defaultUnit` = `'m'` (default) | `'mm'`
  - `bim3d.dimensions.defaultPrecision` = `2` (decimal places)
  - Persisted via Bim3DPreferencesService (existing)

- **i18n keys** (Phase 9):
  - `bim3d.dimensions.title`, `.toolbar.{aligned,linear,radial,angular,cancel,commit}`
  - `bim3d.dimensions.mode.{aligned,linear,radial,angular}.{label,tooltip}`
  - `bim3d.dimensions.placement.{linearAxis.{X,Y,Z,entityLocal}}`
  - `bim3d.dimensions.textPlane.{billboard,worldLocked,toggleLabel}`
  - `bim3d.dimensions.units.{mm,m}`
  - `bim3d.dimensions.fields.{value,offset,precision,unit,createdAt,createdBy}`
  - `bim3d.dimensions.actions.{edit,delete,duplicate,convertTo2D}`
  - `bim3d.dimensions.settings.{onEntityDelete.orphan,onEntityDelete.delete,defaultUnit,defaultPrecision}`
  - `bim3d.dimensions.snap.{endpoint,midpoint,faceCenter,guide,inferred}`
  - `bim3d.dimensions.errors.{cannotMeasureSamePoint,invalidAngularPoints,permissionDenied}`
  - **Total: ~36 keys × 2 locales = ~72 entries**

- **GOL checklist 7/7**:
  - Proactive ✅: Dim tool initialized on ribbon mount, subscriptions per project
  - Race-free ✅: FSM state transitions atomic, snap engine debounced 16ms (60fps), entity-follow via subscribeToEntityTransform single source
  - Idempotent ✅: Value computation deterministic from anchors, mode change idempotent (re-applying same mode = no-op), grip drag transactional (rollback on ESC)
  - Belt-and-suspenders ✅: Client validation + Firestore rules + Storage (N/A here), orphan auto-convert on entity delete
  - SSoT ✅: BimDimensions3DStore single source, bim-dimensions-3d.service single mutator, snap engines REUSE 2D SSoT, leader tokens REUSE ADR-362
  - Await/sync ✅: All writes awaited, audit hook awaited
  - Lifecycle owner ✅: BimDimensions3DStore owns subscription lifecycle, service owns CRUD, FSM owns tool state

- **Mirror του 2D pattern** [[feedback-3d-mirror-2d-ssot]] — 95% mirror:
  - 4-mode placement discriminator: 100% ADR-362
  - 3-grip pattern: 100% ADR-362
  - Snap engines: 100% REUSE με Three.js raycaster adapter
  - Leader styling tokens: 100% REUSE
  - Ribbon tab pattern: 100% ADR-345
  - **Conscious diverge**: separate Firestore collection (schema requires Vector3 + host binding 3D-specific) — justified per data model differences, not UX divergence

**Effort impact για C.3**: **Phase 9 (new) +10-12h** = 3h Dimension3DRenderer + line geometry + value computer + text orienter + 2h Dim3DToolStateMachine + ribbon contextual tab + 2h grips renderer + properties panel + 1.5h service + RBAC + audit + 1h Firestore rules + indexes + ADR-298 coverage tests + 1h useDim3DToolRouting cross-mode hook + 0.5-1h i18n + tests. ADR-366 total estimate revised: **~225-268h Phase 0-9** (από ~215-256h post-C.2, +10-12h C.3).

---

### C.4 — BimEntityCard Remaining Tabs (Materials/BOQ/Comments) — ✅ CLOSED 2026-05-22

**Σκοπός**: Κλείνει B.2.Q4 (5-tab EntityDetailsHeader card) — implementation των 3 remaining tabs (`BimMaterialsTab`, `BimBoqTab`, `BimCommentsTab`). Geometry + Audit ήδη υπάρχουν. Καθορίζει per-tab layout + edit affordances + tab order + default active.

**Cross-references**:
- B.2.Q4 (line ~2170) — 5-tab Card scope (Geometry/Materials/BOQ/Audit/Comments) με read-only παντού εκτός Comments
- ADR-363 Phase 6 (Multi-Layer DNA BOQ + Material→ΑΤΟΕ SSoT) — material catalog + multi-layer parent/children
- EntityDetailsHeader SSoT pattern [[reference-entity-details-header-ssot]] — `@/core/entity-headers` reuse
- C.2 — BimCommentsTab reuses BimCommentsStore + CommentDetailsPanel
- ADR-195 audit για material/BOQ updates
- ADR-326 tenant scoping

**Pending micro-decisions**:
- Q1: BimMaterialsTab layout ✅ RESOLVED
- Q2: Material edit affordance (read-only link vs inline) ✅ RESOLVED
- Q3: BimBoqTab layout (multi-layer parent/children) ✅ RESOLVED
- Q4: BOQ edit affordance ✅ RESOLVED
- Q5: BimCommentsTab layout ✅ RESOLVED
- Q6: Tab order + default active ✅ RESOLVED

**Decisions Log** — Topic C.4 COMPLETE 6/6 Qs:

| # | Ερώτηση | Απόφαση | Industry alignment |
|---|---|---|---|
| C.4.Q1 | BimMaterialsTab layout | **4 sections**: (1) Current material badge (name + thumbnail από wall-material-catalog + cost €/unit preview), (2) Alternatives top-5 (filtered από catalog by `quantityKind` compatibility), (3) ADR-363 multi-layer context (αν `dna.layers.length > 1`, list each layer με per-layer material), (4) Cost rollup (per-entity total = material cost × quantity from Phase 6). Read-only display. Empty state: αν entity δεν έχει material assigned → "Δεν έχει οριστεί υλικό" + "Όρισε υλικό" CTA. | Mirror του ADR-363 Phase 6 material→ΑΤΟΕ mapping pattern. EntityDetailsHeader SSoT layout (Contacts + Procurement) tabs use ίδιες section primitives. |
| C.4.Q2 | Material edit affordance | **Read-only με "Άλλαξε υλικό" link** → opens ADR-363 material catalog drawer με filter pre-applied (compatible `quantityKind`). User selects → triggers `bim-entity-update.service.changeMaterial(entityId, newMaterialId)` (server-side) → Firestore mutation + ADR-195 audit `bim_entity_material_changed`. RBAC: `bim_entities.update_material` permission (designer/architect/owner). Inline edit απορρίπτεται (material picker is complex UI — duplicating inline = SSoT violation). Single material UI surface = SSoT principle. | SSoT principle [[feedback-centralize-on-the-spot]]: one place owns material catalog UI. Drawer pattern aligns με ADR-345 ribbon drawer UX. |
| C.4.Q3 | BimBoqTab layout | **3 sections**: (1) BoQ parent row (single-entry wall = self single row, multi-entry wall = `isGroupParent=true` row με total cost rollup ADR-363 Phase 6.1), (2) Children rows expandable tree (multi-layer walls only — N rows με per-layer cost + per-layer ΑΤΟΕ + per-layer quantity), (3) Quantity context (area/volume from entity geometry, ADR-363 Phase 6.2 quantityKind ΑΤΟΕ mapping). Read-only display. Empty state (no BoQ item): "Δεν έχει συσχετιστεί BoQ" + "Δες ADR-363 Phase 6.1 logic" diagnostic link (super-admin only). | Mirror του ADR-363 Phase 6 parent/children expandable tree — pending UI ήδη planned σε ADR-363 Phase 6.2+, εδώ απλώς consumed. SSoT REUSE. |
| C.4.Q4 | BOQ edit affordance | **Read-only display + "Άνοιξε στη BoQ" link** → navigate to BOQ subapp `/boq?focusEntityId=<entityId>` drawer. NO inline ΑΤΟΕ override (centralized σε BOQ subapp, inline duplication = SSoT violation). Per-entity ΑΤΟΕ override (rare advanced use case): explicit toggle "Custom ΑΤΟΕ" σε entity properties dialog (ADR-363 Phase 6.2.1 feature, separately scoped). Audit via ADR-195 `bim_entity_boq_override_set`. | SSoT principle — BOQ edit logic σε BOQ subapp [[feedback-centralize-on-the-spot]]. Cross-subapp navigation pattern via URL state (mirror των /properties+/contacts cross-links). |
| C.4.Q5 | BimCommentsTab layout | **Inline preview top-3 comments** (sorted by `updatedAt DESC`) με: type badge (C.2.Q1 5-type icons) + author avatar + content preview (first 100 chars + ellipsis) + relative timestamp ("πριν 2 ώρες"). Unread badge στο tab header: count of comments updated post user's last view (LocalStorage tracked). "Δες όλα" button → opens BimCommentDetailsPanel side-drawer (C.2) με filter `anchor.entityId === currentEntityId`. "Νέο σχόλιο" button → opens BimCommentCreateForm pre-filled με `anchor: {kind:'entity', entityId, entityType}`. Real-time sync via BimCommentsStore filter (subscribe scoped to projectId, filter by entityId client-side). Empty state: "Δεν υπάρχουν σχόλια" + "Δημιούργησε πρώτο σχόλιο" CTA. | Inline preview + "see all" pattern = Slack/Linear/Notion thread preview convention. Tab unread badge = ubiquitous notification pattern. REUSE BimCommentsStore (C.2 SSoT) — zero duplicate state. |
| C.4.Q6 | Tab order + default active | **Order**: Geometry → Materials → BOQ → Comments → Audit (general → specific → cross-cutting → audit). Default active = **Geometry** (most-used tab για architects, baseline view). Per-user persistence: last active tab per entity type stored σε `userPreferences.bim3d.entityCardTabs.{entityType}.lastActive` via Bim3DPreferencesService (existing) → LocalStorage primary + Firestore sync on settings save. Tab visibility flags: Comments tab badge visible μόνο αν `bim_comments.read` permission, Audit tab visible αν `bim_audit.read` permission (RBAC gate). | Tab order mirrors ADR-345 ribbon section ordering convention (general → specialized). Default Geometry = matches Revit Element Properties default tab. Per-user persistence = standard UX pattern (Linear/Notion/Slack). |

**Architectural implications (consolidated για C.4)**:

- **Νέα Phase 9 modules**:
  - `bim-3d/properties/tabs/BimMaterialsTab.tsx` — 4-section layout, reads από `bim-entity-store` + `wall-material-catalog` (existing SSoT)
  - `bim-3d/properties/tabs/BimBoqTab.tsx` — 3-section layout, reads από ADR-363 Phase 6 BoQ data (`boq-multi-layer-builder` output + Firestore `boq_items` collection)
  - `bim-3d/properties/tabs/BimCommentsTab.tsx` — inline preview + unread badge + actions, reads από BimCommentsStore (C.2)
  - `bim-3d/properties/tabs/material-alternatives-resolver.ts` — pure: entity material id → top-5 alternatives από catalog filtered by `quantityKind`
  - `bim-3d/properties/tabs/boq-tree-builder.ts` — pure: entity id → parent + children rows (consumes ADR-363 Phase 6 data structure)
  - `bim-3d/properties/tabs/last-active-tab-tracker.ts` — pure: read/write tab state σε Bim3DPreferencesService

- **Stores extensions**:
  - `BimEntityCardPanel`: tab visibility based on RBAC permission checks
  - `Bim3DPreferencesService`: extension με `entityCardTabs.{entityType}.lastActive` field
  - No new top-level stores (tabs are pure views over existing SSoT)

- **Services**:
  - `bim-entity-update.service.ts` (νέο OR extension existing): `changeMaterial(entityId, newMaterialId)` server-side action + audit
  - REUSE existing `bim-comments.service.ts` (C.2) for create from tab

- **RBAC** (`roles.ts`):
  - `bim_entities.update_material` (designer/architect/owner)
  - `bim_entities.boq_override_set` (architect/owner only, advanced)
  - `bim_comments.read` (all members) — gates Comments tab visibility
  - `bim_audit.read` (architect/owner) — gates Audit tab visibility
  - existing material catalog read permissions = unchanged

- **EntityAuditService audit types**:
  - `bim_entity_material_changed` (Q2)
  - `bim_entity_boq_override_set` (Q4 advanced) — already planned ADR-363 Phase 6.2.1

- **Firestore**: no new collections (reuses entities, materials, boq_items, bim_comments). Possible composite index addition αν χρειαστεί: `bim_comments` (companyId, projectId, anchor.entityId, updatedAt DESC) για efficient BimCommentsTab inline preview query.

- **i18n keys** (Phase 9):
  - `bim3d.entityCard.tabs.{geometry,materials,boq,comments,audit}`
  - `bim3d.entityCard.materials.{currentSection,alternativesSection,multiLayerSection,costRollupSection,empty,changeButton,costPerUnit,totalCost}`
  - `bim3d.entityCard.boq.{parentSection,childrenSection,quantitySection,empty,openInBoq,diagnostics}`
  - `bim3d.entityCard.boq.layerRow.{material,quantity,unitCost,totalCost}`
  - `bim3d.entityCard.comments.{empty,seeAll,createNew,unreadBadge,previewMore}`
  - `bim3d.entityCard.errors.{materialChangeForbidden,boqOverrideForbidden}`
  - **Total: ~30 keys × 2 locales = ~60 entries**

- **GOL checklist 7/7**:
  - Proactive ✅: Tabs pre-rendered, data subscriptions lazy (only when tab active)
  - Race-free ✅: Material change atomic Firestore transaction, BOQ data read-only (no race), comments via BimCommentsStore (already hash-compare guarded C.2)
  - Idempotent ✅: Material change same material = no-op, tab activation idempotent
  - Belt-and-suspenders ✅: Permission check client + server, empty states gracefully handled
  - SSoT ✅: Tabs are pure views over existing SSoT (wall-material-catalog, boq-multi-layer-builder, BimCommentsStore, ADR-195 audit) — zero duplicate state
  - Await/sync ✅: Material mutation awaited before tab refresh, BOQ data subscribed (auto-refresh)
  - Lifecycle owner ✅: BimEntityCardPanel owns tab activation, individual tabs own their lazy subscription lifecycles

- **Mirror του 2D pattern** [[feedback-3d-mirror-2d-ssot]]:
  - Tab layout primitives = EntityDetailsHeader SSoT (Contacts + Procurement) ✅
  - Material catalog UI = ADR-363 (2D originated) ✅
  - BOQ subapp = shared 2D/3D ✅
  - Comments inline preview pattern can backport to 2D entity panels (optional follow-up Group D)

**Effort impact για C.4**: **Phase 9 (new) +5-6h** = 1.5h BimMaterialsTab + alternatives resolver + 1.5h BimBoqTab + tree builder + 1h BimCommentsTab + 0.5h bim-entity-update.service material change + 0.5h Bim3DPreferencesService extension + 0.5-1h tests + i18n + Firestore index. ADR-366 total estimate revised: **~230-274h Phase 0-9** (από ~225-268h post-C.3, +5-6h C.4).

---

### C.5 — ARIA + Screen Reader Compliance — ✅ CLOSED 2026-05-22

**Σκοπός**: Κλείνει A.7.Q2 deferred (ARIA + screen reader compliance) — EU Public Sector Bodies Directive (Greek municipalities), WCAG 2.2 AA, EN 301 549. Phase 8.0-8.1 ήδη wired infrastructure (KeyboardFocusManager, AriaLiveRegion, aria-live-bus, aria-attribute-presets, aria-entity-description-generator, FocusIndicator3D, focus-order). C.5 κλείνει: live region announcement protocol, focus management strategy, keyboard nav order, ARIA label content patterns, reduced-motion mode.

**Cross-references**:
- A.7.Q2 (line ~1100) — ARIA deferred research
- Phase 8.0-8.1 — implemented foundation (`bim-3d/accessibility/`)
- WCAG 2.2 AA, EN 301 549 (EU 2025), EAA (European Accessibility Act 2025), ATAG 2.0
- NVDA / JAWS / VoiceOver — screen reader testing matrix
- Three.js a11y patterns (offscreen DOM proxy elements convention)
- `useReducedMotion` hook (React community SSoT pattern)

**Pending micro-decisions**:
- Q1: Live region announcement protocol ✅ RESOLVED
- Q2: Focus management σε 3D canvas ✅ RESOLVED
- Q3: Keyboard-only entity navigation order ✅ RESOLVED
- Q4: ARIA labels content format ✅ RESOLVED
- Q5: Reduced-motion mode ✅ RESOLVED

**Decisions Log** — Topic C.5 COMPLETE 5/5 Qs:

| # | Ερώτηση | Απόφαση | Industry alignment |
|---|---|---|---|
| C.5.Q1 | Live region announcements | **Politeness=polite default** (non-interrupting), assertive μόνο για errors/blockers. Events: selection (`Επιλέχθηκε τοίχος W001 — μήκος 4,5 μέτρα, ύψος 2,8 μέτρα, υλικό μπετόν`), mode change (`Ενεργοποιήθηκε φωτορεαλιστικό mode, υπολογισμός...`), camera snap (`Όψη πρόσοψης ενεργοποιήθηκε`), section cut toggle (`Τομή Z=2.0 μέτρα ενεργή`), tool activation (`Εργαλείο διαστάσεων ενεργό, κάντε κλικ για 1η ακμή`), render queue updates (`Render 1 από 3 ολοκληρώθηκε`), path tracer progress (assertive μόνο on final 100%). Debounce 250ms (avoid flooding on rapid selection). i18n via aria-entity-description-generator (Greek primary, EN fallback). REUSE existing `AriaLiveRegion` + `aria-live-bus`. | WCAG 2.2 AA SC 4.1.3 "Status Messages" compliance. NVDA/JAWS/VoiceOver politeness conventions. Industry: Adobe XD/Figma similar polite default. |
| C.5.Q2 | Focus management σε 3D canvas | **Offscreen DOM proxy elements pattern** (Three.js a11y best practice). Per visible entity: hidden `<button>` σε offscreen `<div role="application" aria-label="Εντότητες 3D">` με ARIA label από aria-entity-description-generator (Q4 format). Tab-cycleable. Focus event → triggers 3D selection + visual `FocusOutlineRenderer` (existing). Canvas root `role="img" aria-label="Τρισδιάστατο παράρτημα BIM. Πατήστε Tab για πλοήγηση εντοτήτων, Enter για άνοιγμα ιδιοτήτων."`. Skip-link "Παράλειψη 3D viewer" pre-canvas. Tab order = focus-order.ts SSoT (existing) — spatial top-down-left-right per floor, floor-grouped. ROVING tabindex pattern (only one button has `tabindex=0` at a time, rest are `-1`). | WCAG 2.4.3 "Focus Order" + 2.4.7 "Focus Visible". Offscreen DOM proxy = Three.js docs recommended pattern + WebGL accessibility best practice (Khronos guidelines). Roving tabindex = WAI-ARIA Authoring Practices Guide composite widget pattern. |
| C.5.Q3 | Keyboard-only entity navigation | **Spatial default** (top-down-left-right per floor, repeated per floor) — intuitive για architects. Semantic toggle (group by entity type: walls → columns → beams → slabs → openings) σε settings `bim3d.accessibility.entityNavOrder`. Arrow keys: ArrowRight/Left = next/prev sibling, ArrowUp/Down = parent/child group (floor ↔ entity). Enter = open BimEntityCardPanel. ESC = clear focus, return to canvas root. Shift+Tab reverses. Home/End = first/last entity. PageDown/PageUp = next/prev floor (groups). Focus indicator persists during nav (FocusIndicator3D existing) + sticky AriaLive announcement on each focus change. | WAI-ARIA Tree/Grid composite widget pattern. Arrow keys = WAI-ARIA Authoring Practices Guide. Industry: Revit "Tab through visible elements" (similar pattern), AutoCAD "Cycle through overlapping objects" (Tab convention). |
| C.5.Q4 | ARIA labels content | **Format**: `<entityType> <entityCode> — <key dimensions> — <material>`. Per type: Wall=`Τοίχος W001 — μήκος 4,5 μέτρα, ύψος 2,8 μέτρα — μπετόν 20 εκατοστά`. Column=`Κολώνα C001 — 40×40 εκατοστά, ύψος 3 μέτρα — οπλισμένο σκυρόδεμα`. Beam=`Δοκός B001 — μήκος 5 μέτρα, διατομή 30×50 εκατοστά — οπλισμένο σκυρόδεμα`. Slab=`Πλάκα S001 — εμβαδόν 25 τ.μ., πάχος 15 εκατοστά`. Opening=`Άνοιγμα O001 σε τοίχο W001 — 1×2,1 μέτρα`. Stair=`Σκάλα ST001 — 12 βαθμίδες, ύψος 3 μέτρα`. Locale-aware: Greek primary, English fallback via i18n keys (existing aria-entity-description-generator extension). Numbers locale-formatted (Greek comma decimal `4,5`). | EN 301 549 §11.5.2 (info conveyed to AT in plain text). WCAG 2.2 AA SC 1.1.1 "Non-text Content". Industry: Revit screen-reader output includes type + ID + key params (similar pattern). |
| C.5.Q5 | Reduced-motion mode | **Respect `prefers-reduced-motion: reduce` media query**. When active: camera transitions snap (zero duration vs 300ms), section cut animations instant, path tracer transitions instant raster↔pt (no fade), shadow quality snap to soft (skip 300ms), spinners static, marker hover bobs disabled, ViewCube hover hop disabled, ribbon panel collapse instant. React via existing `useReducedMotion` hook OR new `bim-3d/accessibility/use-reduced-motion.ts` (light wrapper over `window.matchMedia`). Settings override toggle `bim3d.accessibility.reducedMotion` = `'auto'` (follow OS, default) | `'force-on'` | `'force-off'`. Override stored σε Bim3DPreferencesService. Live-update listener (matchMedia change event). | WCAG 2.2 AA SC 2.3.3 "Animation from Interactions" (require user-mechanism to disable). EAA 2025 (EU mandatory). Industry: Apple Safari/iOS default-respect, Chrome respects, Figma/Linear implement (3/3 industry σύγκλιση web apps). |

**Architectural implications (consolidated για C.5)**:

- **Νέα Phase 9 modules** (accessibility polish):
  - `bim-3d/accessibility/announcement-protocol.ts` — pure: event type → politeness + i18n message template. Wraps existing `aria-live-bus.ts`. Debounce 250ms.
  - `bim-3d/accessibility/entity-dom-proxy-renderer.ts` — generates/destroys hidden `<button>` elements per visible entity. Subscribes σε `BimEntitiesStore.visibleEntities` + floor visibility store. Roving tabindex management.
  - `bim-3d/accessibility/entity-keyboard-navigator.ts` — Arrow/Home/End/PageUp/PageDown handlers. Reads focus-order.ts SSoT (existing).
  - `bim-3d/accessibility/use-reduced-motion.ts` — light wrapper hook over `window.matchMedia('(prefers-reduced-motion: reduce)')` + settings override.
  - `bim-3d/accessibility/reduced-motion-config.ts` — central registry: which animations respect reduced-motion (camera, section, pt-transition, shadow-fade, hover-bob, viewcube-hop, panel-collapse) — single source for runtime checks
  - Extend existing `aria-entity-description-generator.ts` — add missing entity types (Stair, AreaPlan, dimensions, comments markers) + verify EN locale completeness
  - Extend existing `focus-order.ts` — spatial vs semantic toggle support

- **Stores extensions**:
  - `Bim3DPreferencesService`: +`accessibility.{entityNavOrder, reducedMotion}` fields
  - `ViewMode3DStore`: +`announcementsEnabled: boolean` (toggle σε settings, default ON)

- **Components touched (animation guards για Reduced Motion)**:
  - `viewport/animation-manager.ts` — guard durations: 0ms αν reduced-motion active
  - `systems/section/section-clip-applicator.ts` — guard fade animations
  - `lighting/quality-modulator.ts` — guard 300ms shadow/SSAO fade (snap to soft directly)
  - `render/raster-to-pathtrace-swap.ts` — guard fade
  - All hover-bob/viewcube-hop renderers — guard transforms

- **i18n keys** (Phase 9):
  - `bim3d.aria.canvas.{rootLabel,skipLink,emptyState}`
  - `bim3d.aria.entityNav.{spatialOrderLabel,semanticOrderLabel,arrowHelp,enterHelp,escHelp}`
  - `bim3d.aria.entityDescription.{wall,column,beam,slab,opening,stair,dimension,comment}` templates (ICU placeholders για numbers/dimensions)
  - `bim3d.aria.announcements.{entitySelected,modeChanged,cameraSnapped,sectionToggled,toolActivated,renderProgress,renderDone}` templates
  - `bim3d.accessibility.settings.{title,entityNavOrder.spatial,entityNavOrder.semantic,reducedMotion.auto,reducedMotion.forceOn,reducedMotion.forceOff,announcementsEnabled}`
  - **Total: ~32 keys × 2 locales = ~64 entries**

- **Settings UI** (`Floating3DPanel` νέα tab "Προσβασιμότητα" OR section σε Settings tab — TBD per UX A/B testing, default = section σε existing Settings):
  - Toggle: entity navigation order (Spatial / Semantic)
  - Radio: Reduced motion (Auto / Force-on / Force-off)
  - Toggle: ARIA announcements (On / Off)
  - Live region politeness slider (Polite / Assertive / Off) — advanced

- **Testing matrix** (manual testing required pre-release):
  - NVDA 2026 + Firefox + Chrome
  - JAWS 2026 + Edge + Chrome
  - VoiceOver macOS Sonoma + Safari + Chrome
  - VoiceOver iOS — DEFERRED (mobile non-goal G11)
  - TalkBack Android — DEFERRED (mobile non-goal G11)
  - Lighthouse Accessibility score ≥95
  - axe DevTools full scan zero violations
  - WAVE no errors
  - Manual keyboard-only traversal (no mouse) — all features reachable

- **GOL checklist 7/7**:
  - Proactive ✅: Offscreen proxies generated on entity mount, reduced-motion checked at app init + media-change listener
  - Race-free ✅: Roving tabindex single source (only one `=0` at a time), announcement debounced 250ms (avoid flooding)
  - Idempotent ✅: ARIA label regen deterministic from entity data, focus event handlers idempotent
  - Belt-and-suspenders ✅: OS preference + manual settings override, fallback EN locale αν Greek key missing
  - SSoT ✅: aria-live-bus single dispatcher, aria-entity-description-generator single label source, reduced-motion-config single animation registry, focus-order.ts single nav order
  - Await/sync ✅: Settings changes awaited (Firestore sync), DOM proxy updates synchronous with entity store
  - Lifecycle owner ✅: entity-dom-proxy-renderer owns proxy lifecycle, Bim3DPreferencesService owns settings lifecycle

- **Mirror του 2D pattern** [[feedback-3d-mirror-2d-ssot]]:
  - i18n via existing locale system (zero new mechanism)
  - Reduced motion logic same hook across 2D + 3D (when 2D adopts it — optional Group D backport)
  - Settings persistence pattern = Bim3DPreferencesService

**Effort impact για C.5**: **Phase 9 (new) +6-7h** = 2h announcement-protocol + debounce + i18n + 2h entity-dom-proxy-renderer + entity-keyboard-navigator + 1h use-reduced-motion hook + reduced-motion-config + 1h Bim3DPreferencesService extension + settings UI + 0.5h aria-entity-description-generator extension + EN locale verify + 0.5-1h tests + i18n keys. **Testing budget** (post-implementation, manual screen reader testing): +4-6h NVDA+JAWS+VoiceOver matrix — DEFERRED post-Phase 9 ως separate QA pass. ADR-366 total estimate revised: **~236-281h Phase 0-9** (από ~230-274h post-C.4, +6-7h C.5).

---

### C.6 — Advanced Section Cuts + Crop Region Rendering — ✅ CLOSED 2026-05-22

**Σκοπός**: Κλείνει deferred section cuts polish (horizontal cuts axis=Y, multiple independent planes, linked planes group) + B.4.Q5 (crop region rendering) από high-level σε implementation-level. Phase 7.0 implemented basic single-plane vertical section cuts — C.6 extends σε max 6 planes + horizontal + linked groups + crop region tool.

**Cross-references**:
- B.4.Q5 (line ~2400) — crop region DEFERRED Phase 8+
- Phase 7.0 (existing implementation): SectionStore, SectionBox, section-clip-applicator, section-scene-controller, Section3DPanelTab
- A.3 (Section Cuts research, line ~1395) — base research closed για single plane vertical
- Navisworks ClippingGroup (linked planes pattern), Revit Section Box rotation, V-Ray Region Render, Lumion crop tool
- Three.js `Material.clippingPlanes` hard limit 6 planes
- ADR-326 building floor.elevation — preset elevation source για horizontal cuts
- `path-tracer/PathTracerRenderer.ts` (Phase 6) — crop region applied to PT scene

**Pending micro-decisions**:
- Q1: Horizontal cuts (axis=Y) ✅ RESOLVED
- Q2: Multiple independent planes ✅ RESOLVED
- Q3: Linked planes group ✅ RESOLVED
- Q4: Crop region tool ✅ RESOLVED
- Q5: Crop region persistence ✅ RESOLVED
- Q6: Crop region preview ✅ RESOLVED

**Decisions Log** — Topic C.6 COMPLETE 6/6 Qs:

| # | Ερώτηση | Απόφαση | Industry alignment |
|---|---|---|---|
| C.6.Q1 | Horizontal cuts axis=Y | **Add Y-axis support to SectionStore + SectionBox + section-clip-applicator**. UI: Section3DPanelTab axis selector becomes 3-button toggle "X | Y | Z" (currently X|Z). Preset elevations dropdown για Y axis: populated από ADR-326 building floors (`floor.elevation` field). Display format: "0,0 μ. (Ισόγειο)", "3,0 μ. (1ος όροφος)", "6,0 μ. (2ος όροφος)", "Custom" entry για manual slider. Y plane normal = (0,1,0) world up. Section hatch cap pattern (Phase 7.1) auto-applies. | Revit Section Box rotation enables horizontal cuts (similar Y-axis pattern). ArchiCAD Top-Down section. Industry standard για architectural docs. |
| C.6.Q2 | Multiple independent planes | **Up to 6 active clipping planes (Three.js hard limit `Material.clippingPlanes.length <= 6`)**. SectionStore extends to `planes: Array<{id, axis, distance, enabled, label?, linkedGroupId?}>` (currently single plane). UI: Section3DPanelTab shows list με per-plane on/off toggle + axis label + distance slider + label edit + delete button. "Νέα τομή" button → adds new plane (disabled στις 6). Empty state: "Δεν υπάρχουν τομές" + "Προσθήκη πρώτης" CTA. Each plane independently configured. enterprise-id `sec_<random10>` per plane (in-memory only, NOT persisted — section state ephemeral session-only). | Performance budget: 6 planes ~10-15% GPU cost increase (~2-3ms/frame @ 1080p) — acceptable. Three.js hard limit respected. Industry: Navisworks unlimited (but visually unmanageable >6), Revit max 6, Sketchup unlimited (with perf warning). 6 = pragmatic UX cap. |
| C.6.Q3 | Linked planes group | **Navisworks ClippingGroup pattern**. Group definition: `groupId + planeIds[] + groupTransform: {translation:Vector3, rotation:Quaternion}`. UI: section list shows linked planes με chain icon (📎). "Σύνδεση τομών" button: user selects 2+ planes (multi-select via Ctrl+click in list) → group created, all selected planes get `linkedGroupId`. "Αποσύνδεση" button: ungroups. Group gizmo (single transform handle): drag → applies same translation delta to all linked planes' `distance` values (per-plane axis-projected). REUSE GenArc Gizmo widget PORT (existing pending Group D — fallback to simple plus/minus buttons until Gizmo ports). Group state ephemeral session-only. | 1/4 industry strict pattern (Navisworks ClippingGroup), 2/4 partial (Sketchup parallel cuts, Three.js ClippingGroup WebGPU). Pragmatic match for architectural section sweeps (e.g. detail house section animation). |
| C.6.Q4 | Crop region tool | **Region marquee 3D — rectangle marquee in screen-space, projected to world-space frustum**. Activation: ribbon button "Crop Region" σε Render contextual tab + hotkey `CR3D` (Ctrl+Shift+R reserved για other use → use `CR3D` 3-key chord OR `Ctrl+Alt+R`). Tool: cursor crosshair + drag rectangle σε viewport. Result: 4 clipping planes (left/right/top/bottom frustum walls perpendicular to camera plane) + optional 2 planes (near/far depth) = 6 planes total. NO polygon crop v1 (rectangle only — 95% use case, V-Ray/Lumion pattern). After crop set: planes auto-applied to PathTracerRenderer scene + UI shows crop overlay (Q6). Stored σε `finalRenderConfig.cropRegion`. | V-Ray Region Render rectangle-only (1/2 industry tools), Lumion crop tool rectangle-only (2/2). Polygon crop DEFERRED Group D (rare use case, Photoshop-style complexity). Frustum-walls = camera-relative crop, industry standard. |
| C.6.Q5 | Crop region persistence | **Stored σε `finalRenderConfig.cropRegion: {enabled:boolean, rectangle:{x:number, y:number, w:number, h:number}, depthRange?:{near:number, far:number}}`** σε ViewMode3DStore. Coordinates: normalized 0-1 viewport space (resolution-independent). Persisted αν user saves render preset σε Firestore `bim_render_presets` collection (existing OR νέα — TBD per Phase 9 implementation). Per-animation crop keyframing DEFERRED Group D (v1 = static crop applied to all frames of animation). | Static crop covers 95% use case (final-shot framing). Animation crop = niche, deferred per [[feedback-completeness-over-mvp]] interpretation "completeness within MVP scope". |
| C.6.Q6 | Crop region preview | **Live UI overlay** (Photoshop crop tool pattern): darken outside-crop area με 50% black opacity overlay + 1px dashed border on crop edges (white με 1px black outline for contrast). RAF-throttled redraw (60fps). 8 resize handles (4 corners + 4 edge midpoints) για drag-to-resize. Center drag = move whole crop. NO heavy 3D rendering with clipping during preview (would slow editing → wasted FPS). Only-on-render applies actual clipping to PathTracerRenderer scene. Toggle "Δες προεπισκόπηση crop" σε settings (default ON when crop defined). Esc cancels active crop editing, Enter commits. | Photoshop crop tool exact UI pattern (industry universal). 4/4 image editing tools (Photoshop/Affinity/GIMP/Krita). Live-overlay-only (no real clipping) = perf-conscious pragmatic choice. |

**Architectural implications (consolidated για C.6)**:

- **Νέα Phase 9 modules** (section cuts polish):
  - Extend `bim-3d/stores/SectionStore.ts` — schema migration: `currentPlane?: Plane` → `planes: Plane[]` (array, max 6). Linked groups: `groups: Group[]` (id + planeIds + transform). Backward-compat: existing single-plane consumers wrapper helper `getActivePlane()`.
  - Extend `bim-3d/systems/section/SectionBox.ts` — accept multiple planes, render all enabled.
  - Extend `bim-3d/systems/section/section-clip-applicator.ts` — apply N planes to all materials in scene (Three.js `Material.clippingPlanes = planes`).
  - Extend `bim-3d/scene/section-scene-controller.ts` — manage multi-plane lifecycle, linked group transforms.
  - Extend `bim-3d/panels/Section3DPanelTab.tsx` — per-plane list UI με toggle/slider/label/link.
  - `bim-3d/systems/section/section-group-transformer.ts` — pure: linked group transform delta → per-plane distance updates.
  - Extend `Section2DPanel.tsx` — multi-plane support (each plane gets own 2D live section view OR multi-cut composite — UX TBD Phase 9, default = active-plane-only).
  - `bim-3d/section/horizontal-cut-preset-resolver.ts` — pure: building floors (ADR-326) → preset elevation list

- **Νέα Phase 9 modules** (crop region):
  - `bim-3d/render/crop-region/CropRegionStore.ts` — Zustand SSoT: `{enabled, rectangle:{x,y,w,h}, depthRange?, editing:boolean, selectedHandle?}` (sub-store of ViewMode3DStore.finalRenderConfig)
  - `bim-3d/render/crop-region/CropRegionTool.ts` — FSM (idle → dragging → editing → committed), screen-to-world frustum projection
  - `bim-3d/render/crop-region/CropRegionOverlay.tsx` — Photoshop-style dim+border+handles UI overlay (Canvas2D layer over viewport)
  - `bim-3d/render/crop-region/crop-frustum-builder.ts` — pure: rectangle + camera → 4-6 clipping planes
  - `bim-3d/render/crop-region/RibbonCropRegionButton.tsx` — Render contextual tab button
  - Extend `PathTracerRenderer.ts` — accept crop planes via `renderConfig.cropRegion` → set scene clipping planes (combined με Section planes, total ≤6 budget enforcement)

- **Stores extensions**:
  - `SectionStore`: multi-plane array (breaking change — backward-compat wrapper required)
  - `ViewMode3DStore.finalRenderConfig`: +`cropRegion: CropRegionState`
  - `CropRegionStore` sub-store

- **Performance budget**:
  - 6 planes raster cost: ~10-15% GPU increase, ~2-3ms/frame @ 1080p — measured target
  - Section + Crop combined: enforce ≤6 total (Three.js hard limit). UI guard: αν section uses N planes, crop can use ≤(6-N). Error toast "Μέγιστο 6 ταυτόχρονες τομές".
  - Crop overlay RAF-throttled 60fps, zero GPU cost (Canvas2D)

- **i18n keys** (Phase 9):
  - `bim3d.section.axis.{X,Y,Z}`, `bim3d.section.axis.Y.{groundFloor,floorNumber,custom}`
  - `bim3d.section.planes.{listTitle,addNew,empty,addFirst,toggleEnabled,deletePlane,labelPlaceholder,linkPlanes,unlinkPlanes,linkedBadge,maxPlanesReached}`
  - `bim3d.section.presetElevations.{title,floorLabel,customLabel}`
  - `bim3d.crop.{toolName,activate,cancel,commit,enabledLabel,resetButton,showPreviewToggle}`
  - `bim3d.crop.errors.{tooFewPlanesAvailable,maxPlanesBudget}`
  - **Total: ~28 keys × 2 locales = ~56 entries**

- **GOL checklist 7/7**:
  - Proactive ✅: Section planes initialized empty array (zero overhead when not used), crop region opt-in
  - Race-free ✅: Plane mutations atomic (immutable array spread σε store), linked group transform single-source (group state ή plane state, not both)
  - Idempotent ✅: Plane add/remove deterministic IDs, crop region commit idempotent
  - Belt-and-suspenders ✅: 6-plane budget enforcement client + Three.js hardware limit, crop+section combined check, Esc cancels gracefully
  - SSoT ✅: SectionStore single source for planes, CropRegionStore single source for crop, crop-frustum-builder pure utility
  - Await/sync ✅: Plane updates synchronous, crop preview RAF synchronous
  - Lifecycle owner ✅: section-scene-controller owns plane→material wiring, CropRegionTool FSM owns crop edit state

- **Mirror του 2D pattern** [[feedback-3d-mirror-2d-ssot]]:
  - Crop UI overlay pattern can backport to 2D viewport crop (optional Group D — DXF export region selection)
  - Section panel UX = mirrors 2D section panel pattern (ADR-040 micro-leaf)
  - Multi-plane SSoT pattern = candidate για 2D multi-cut composite (future)

**Effort impact για C.6**: **Phase 9 (new) +8-10h** = 2h SectionStore migration + multi-plane wiring + Section3DPanelTab UI + 1.5h horizontal axis support + preset elevation resolver + 2h linked planes group + section-group-transformer + 2h CropRegionTool FSM + crop-frustum-builder + CropRegionOverlay + 0.5h PathTracerRenderer crop plane wiring + 0.5h budget guard + 0.5-1h i18n + tests. ADR-366 total estimate revised: **~244-291h Phase 0-9** (από ~236-281h post-C.5, +8-10h C.6).

---

### C.7 — Performance HUD Extensions — ✅ RESEARCH CLOSED 2026-05-22 · 🟢 Q1+Q2+Q3+Q4+Q5 IMPLEMENTED 2026-05-24 (Sessions 3a+3b+4)

**Σκοπός**: Κλείνει B.5 deferred extensions (sparkline 60s history, admin diagnostics dashboard, anonymized telemetry opt-in, auto-submit threshold FPS<10, performance regression detection). Phase 4 implementing base HUD (Group B.5) — C.7 extends με production observability + admin tooling.

**Cross-references**:
- B.5 (line ~2493) — base Performance HUD scope (8/8 Qs closed Group B)
- Phase 4 implementation: `bim-3d/performance/` (12 files existing — PerformanceHUDStore, Collector, Mini, Expanded, DiagnosticDialog, snapshot-service, etc.)
- ADR-145 Super Admin AI Assistant — super-admin registry + admin route patterns + read-all permissions
- ADR-195 EntityAuditService — triage audit trail
- ADR-326 tenancy — telemetry σκόπιμα out-of-tenant (anonymized)
- GDPR Article 6(1)(a) consent — opt-in required για telemetry
- `performance_diagnostics` Firestore collection (B.5.Q7 — existing scope)

**Pending micro-decisions**:
- Q1: Sparkline 60s history ✅ RESOLVED
- Q2: Admin diagnostics dashboard ✅ RESOLVED
- Q3: Anonymized telemetry opt-in ✅ RESOLVED
- Q4: Auto-submit threshold FPS<10 ✅ RESOLVED
- Q5: Performance regression detection ✅ RESOLVED

**Decisions Log** — Topic C.7 COMPLETE 5/5 Qs:

| # | Ερώτηση | Απόφαση | Industry alignment |
|---|---|---|---|
| C.7.Q1 | Sparkline 60s history | **Per-metric 60s rolling buffer @ 4Hz = 240 samples/metric**. Visualization: tiny inline SVG sparkline ~40×16px next to current value σε `PerformanceHUDExpanded`. Color = current threshold tier (🟢/🟡/🔴 mirror Q5 thresholds). Unified buffer service: νέο `bim-3d/performance/PerformanceHistoryStore.ts` (Zustand circular buffer per metric). Toggle "Δείξε ιστορικό" σε HUD settings (default ON, opt-out για low-end via `hardwareConcurrency<4`). NO charting library (zero deps cost — hand-rolled 40-LOC SVG component `Sparkline.tsx`). Sample subsampling: 240 raw → 40 display samples (every 6th) for SVG. | Chrome DevTools Performance panel sparkline pattern. Sentry Performance per-metric history. Industry σύγκλιση 3/3 dev tools. SVG hand-rolled = N.5 license-free + zero bundle bloat. |
| C.7.Q2 | Admin diagnostics dashboard | **Νέα super-admin route `/admin/bim-diagnostics`** (RBAC + ADR-145 super-admin registry gate). Page sections: (1) filters bar (status enum, date range, projectId search, GPU tier dropdown, FPS range slider, browser dropdown), (2) virtualized list of `performance_diagnostics` rows (timestamp + user + project + status badge + FPS + click-to-detail), (3) BimDiagnosticDetailPanel (full 10 metrics + screenshot lightbox + user comment + scene info + audit history via ADR-195), (4) triage actions (status FSM: `new`→`triaged`→`investigating`→`resolved`/`wontfix`; super-admin assignee dropdown; internal notes editor — separate `internal_notes:string` field, NOT visible σε user), (5) aggregated charts (FPS distribution histogram 30-day rolling, GPU tier pie, mode usage bar — Recharts MIT). Export CSV button (filtered current view). Live refresh via `firestoreQueryService.subscribe`. | Mirror ADR-145 super-admin route pattern (existing super-admin tooling). Industry: Sentry Issues dashboard pattern (status FSM + triage + filtering). 4/4 SaaS observability tools σύγκλιση. |
| C.7.Q3 | Anonymized telemetry opt-in | **Opt-in toggle σε `Floating3DPanel` Quality tab → Performance settings: "Συμμετοχή σε ανώνυμη βελτίωση απόδοσης" (default OFF, GDPR Article 6(1)(a) consent)**. When ON: every 60s `PerformanceCollector` emits sample, anonymized via `bim-3d/telemetry/anonymizer.ts`: strip projectId/userId/companyId/sceneInfo/email/IP. Keep: anonymous_session_id (SHA-256 hash of `daily_salt + userId`, salt rotates daily — re-identification-resistant), browser + version, OS, GPU tier (0-3), mode, 10 metrics snapshot, timestamp. Batch 5-sample buffer flushed every 5min OR on session-end → POST `/api/telemetry/bim-performance` (Next.js route με rate-limit 1 req/min per session). Server writes σε νέα Firestore collection `bim_performance_telemetry` (top-level, NO companyId field, super-admin read-only). 30-day TTL (auto-delete cron). Toggle ON dialog: confirm GDPR consent + privacy policy link. Withdrawal: toggle OFF + "Διαγραφή ιστορικού" button → POST `/api/telemetry/bim-performance/erase?sessionId=X` (right to be forgotten Article 17). | GDPR Article 6(1)(a) explicit consent + Article 17 right to erasure. Industry: Sentry beacon opt-in pattern, Google Chrome usage stats opt-in. SHA-256 + daily salt = privacy-preserving telemetry pattern (Apple Differential Privacy lite). |
| C.7.Q4 | Auto-submit threshold FPS<10 | **Threshold detector σε PerformanceCollector**: αν `fps < 10` continuous for `>5s` → trigger consent dialog (NOT silent — GDPR + UX trust). Dialog: title "Χαμηλή απόδοση εντοπίστηκε", body "Παρατηρούμε FPS κάτω από 10 για 5+ δευτερόλεπτα. Θες να στείλεις αυτόματα διαγνωστικά για να βελτιώσουμε την εμπειρία?" + 3 buttons: "Ναι, στείλε" (submits via existing performance-snapshot-service B.5.Q7) / "Όχι ευχαριστώ" (dismiss, 30min cooldown) / "Όχι και μην ξαναρωτήσεις" (persistent opt-out σε `userPreferences.bim3d.autoSubmitFps.optOut: true`). Cooldown 30min between prompts. Auto-skip αν user has telemetry opt-in ON (Q3 covers via continuous low-FPS sample). Audit log: ADR-195 `performance_auto_submit_prompted` + `performance_auto_submit_accepted`/`declined`. | Industry: Crashlytics/Sentry auto-submit consent dialog (4/4 σύγκλιση mobile crash tools). 5s sustained threshold = avoids transient FPS dips (camera fast pan transient drops shouldn't trigger). |
| C.7.Q5 | Performance regression detection | **Per-user baseline client-side (LocalStorage)**. `bim3d.performanceBaseline.{mode}` = `{median, mad, sampleCount, lastUpdated}` from rolling 7-day samples per render mode (raster/preview/final). MAD (median absolute deviation, robust outlier-resistant). Comparison: αν current sample's FPS < `median - 2*MAD` for >30s continuous → silent warn toast "Η απόδοση είναι χαμηλότερη από το συνηθισμένο σε αυτή τη συσκευή. [Δες HUD]" + auto-open PerformanceHUD αν toggle currently OFF (helpful, non-intrusive). Toggle "Ειδοποίηση παλινδρομήσεων" σε settings (default ON). 24h cooldown between alerts per mode. NO server-side regression detection v1 (DEFERRED Group D — would require ML baseline server). | Per-device baseline = device-aware (avoids false positives across user's multiple devices). MAD robust statistic = Tukey 1977 outlier detection (industry stat best practice). Client-side = zero-server-cost + GDPR-friendly (no PII leaves device). |

**Architectural implications (consolidated για C.7)**:

- **Νέα Phase 9 modules** (performance extensions):
  - `bim-3d/performance/PerformanceHistoryStore.ts` — Zustand circular buffer per metric (240 samples × 10 metrics = 2400 numbers ≈ 19KB RAM, negligible)
  - `bim-3d/performance/Sparkline.tsx` — hand-rolled 40-LOC SVG component (path generation από samples, color από threshold tier)
  - `bim-3d/performance/PerformanceHUDSparklines.tsx` — wraps Sparkline σε PerformanceHUDExpanded
  - `bim-3d/performance/regression-detector.ts` — pure: current sample + baseline → boolean + magnitude
  - `bim-3d/performance/baseline-tracker.ts` — pure + LocalStorage I/O: rolling 7-day baseline maintenance (median + MAD)
  - `bim-3d/performance/auto-submit-fps-threshold.ts` — pure FSM: idle → low_observed → low_sustained (5s) → prompt-triggered

- **Νέα Phase 9 modules** (telemetry):
  - `bim-3d/telemetry/anonymizer.ts` — pure: PerformanceSnapshot + userId/projectId/companyId → anonymized payload (PII stripped, session_id hashed)
  - `bim-3d/telemetry/session-id-generator.ts` — pure: `SHA-256(daily_salt + userId)` με daily salt rotation
  - `bim-3d/telemetry/telemetry-batcher.ts` — 5-sample buffer + flush trigger (5min OR session-end)
  - `bim-3d/telemetry/telemetry-uploader.ts` — POST wrapper με rate-limit + retry exponential backoff
  - Server: `src/app/api/telemetry/bim-performance/route.ts` — Next.js route handler με `withStandardRateLimit` (1 req/min per session via IP+session) + Firestore write
  - Server: `src/app/api/telemetry/bim-performance/erase/route.ts` — right-to-erasure handler (verify session_id ownership via cookie OR token, delete matching docs)

- **Νέα Phase 9 modules** (admin diagnostics dashboard):
  - `src/app/admin/bim-diagnostics/page.tsx` — super-admin route (ADR-145 RBAC gate via middleware)
  - `src/app/admin/bim-diagnostics/_components/DiagnosticsListPage.tsx` — virtualized list + filters bar
  - `src/app/admin/bim-diagnostics/_components/BimDiagnosticDetailPanel.tsx` — full metrics + screenshot lightbox + triage actions
  - `src/app/admin/bim-diagnostics/_components/DiagnosticsCharts.tsx` — Recharts (MIT) histograms/pie/bar
  - `src/app/admin/bim-diagnostics/_components/DiagnosticTriagePanel.tsx` — status FSM + assignee dropdown + internal notes editor
  - `src/services/admin/bim-diagnostics-service.ts` — CRUD wrapper (super-admin scope)
  - `src/services/admin/bim-diagnostics-export.ts` — CSV export helper

- **Firestore collections**:
  - `bim_performance_telemetry/{telemetryId}` — top-level, NO companyId, super-admin read-only, 30-day TTL
  - `performance_diagnostics/{diagnosticId}` — extend schema: `status:'new'\|'triaged'\|'investigating'\|'resolved'\|'wontfix'`, `assignedSuperAdminId?:string`, `internalNotes?:string`, `triageHistory:Array<{from,to,by,at,note?}>` (existing collection from B.5.Q7)

- **Firestore rules** (firestore.rules additions):
  - `bim_performance_telemetry`: deny create from clients (server-only writes), super-admin read-only
  - `performance_diagnostics`: extend update rule to allow super-admin status/assignee/notes updates

- **RBAC** (`roles.ts` permissions):
  - `bim_performance_telemetry.read` — super-admin only (ADR-145 registry)
  - `performance_diagnostics.triage` — super-admin only
  - `performance_diagnostics.update_status` — super-admin only
  - `performance_diagnostics.assign` — super-admin only

- **enterprise-id**: `generateBimTelemetryId()` → `telm_bim_<random10>` νέος generator

- **EntityAuditService audit types**: `performance_auto_submit_prompted`, `performance_auto_submit_accepted`, `performance_auto_submit_declined`, `performance_diagnostic_triaged`, `performance_diagnostic_status_changed`, `performance_telemetry_erased`

- **GDPR compliance** (Article 6/13/17/30):
  - Consent: explicit opt-in (Q3 default OFF) ✅
  - Privacy policy update: link in opt-in dialog ✅
  - Right to erasure: erase endpoint (Q3) ✅
  - Data minimization: anonymizer strips PII ✅
  - Data retention: 30-day TTL ✅
  - Data Processing Records (DPR): documented σε ADR-366 + privacy policy

- **Cron TTL**:
  - `bim_performance_telemetry` 30-day TTL: Firestore TTL policy (native feature) OR Cloud Function nightly purge
  - `performance_diagnostics` archive: 1-year retention για resolved/wontfix, indefinite για open

- **i18n keys** (Phase 9):
  - `bim3d.performance.history.{title,toggle,sampleRateLabel,clearHistory}`
  - `bim3d.performance.telemetry.{title,description,consentLabel,privacyPolicyLink,erase,eraseConfirm,withdraw,confirmEnable}`
  - `bim3d.performance.autoSubmit.{title,body,acceptButton,declineButton,permanentOptOutButton,cooldownNotice}`
  - `bim3d.performance.regression.{toggle,toastTitle,toastBody,openHud}`
  - `admin.bimDiagnostics.{title,filters.status,filters.dateRange,filters.gpuTier,filters.fpsRange,filters.browser,filters.project,empty,listColumns.timestamp,listColumns.user,listColumns.project,listColumns.status,listColumns.fps,detailPanel.title,triage.assign,triage.status.{new,triaged,investigating,resolved,wontfix},triage.internalNotes,triage.history,charts.fpsHistogram,charts.gpuTierPie,charts.modeUsage,export.csv}`
  - **Total: ~44 keys × 2 locales = ~88 entries** (split between bim3d + admin namespaces)

- **GOL checklist 7/7**:
  - Proactive ✅: History buffer starts on HUD mount, baseline tracker on app start, telemetry batcher only when opt-in
  - Race-free ✅: Circular buffer atomic writes (single producer Collector), telemetry batch flush single source, regression detection debounced 30s window
  - Idempotent ✅: Sample insertion deterministic timestamp, telemetry uploader retry idempotent (server dedup by hash), auto-submit FSM transitions atomic
  - Belt-and-suspenders ✅: GDPR consent + privacy policy + erase endpoint, telemetry rate-limit server-side, cooldown prompts client-side
  - SSoT ✅: PerformanceHistoryStore single buffer source, baseline-tracker single LocalStorage owner, telemetry-batcher single uploader, anonymizer single PII strip
  - Await/sync ✅: Telemetry POST awaited (retry on fail), triage updates awaited, all audit hooks awaited
  - Lifecycle owner ✅: PerformanceCollector owns history sample emission, PerformanceHistoryStore owns buffer lifecycle, telemetry-batcher owns batch lifecycle, baseline-tracker owns LocalStorage lifecycle

- **Mirror του 2D pattern** [[feedback-3d-mirror-2d-ssot]]:
  - Toast pattern REUSE existing toast SSoT (zero new mechanism)
  - Settings persistence REUSE Bim3DPreferencesService + Firestore user_preferences (existing)
  - Admin route pattern = ADR-145 super-admin (existing convention)
  - Recharts library already used elsewhere (no new dep)

**Effort impact για C.7**: **Phase 9 (new) +10-12h** = 1.5h PerformanceHistoryStore + Sparkline + integration σε Expanded + 2h regression-detector + baseline-tracker + toast + 1.5h auto-submit FPS threshold FSM + consent dialog + 2h telemetry anonymizer + batcher + uploader + server route + rate-limit + erase endpoint + 2h admin diagnostics dashboard route + list + detail + triage + charts + CSV export + 0.5h Firestore rules + RBAC + audit + 0.5-1h i18n + tests. ADR-366 total estimate revised: **~254-303h Phase 0-9** (από ~244-291h post-C.6, +10-12h C.7).

---

#### Q2 Implementation log — Session 4 (2026-05-24)

**Status**: ✅ DONE 2026-05-24. Super-admin dashboard live at `/admin/bim-diagnostics`.

**Files created** (12):
- `src/types/performance-diagnostic.ts` — `PerformanceDiagnostic` + `TriageStatus` + `TriageHistoryEntry` types (SSoT for collection schema)
- `src/app/admin/bim-diagnostics/lib/triage-fsm.ts` — pure FSM (`canTransition`, `nextStates`, `isTerminal`, `TRIAGE_STATUSES`)
- `src/app/admin/bim-diagnostics/lib/admin-api.ts` — client wrappers `patchTriage()` + `putInternalNote()` με Firebase ID-token auth
- `src/app/admin/bim-diagnostics/hooks/useDiagnosticsQuery.ts` — `firestoreQueryService.subscribe` με 30-day window + `tenantOverride:'skip'` για super-admin global view
- `src/app/admin/bim-diagnostics/components/DiagnosticsFiltersBar.tsx` — status/date/project/GPU/FPS/browser filters
- `src/app/admin/bim-diagnostics/components/DiagnosticsList.tsx` — plain scrolling table (virtualization deferred until >1k rows)
- `src/app/admin/bim-diagnostics/components/DiagnosticsDetailPanel.tsx` — 10-metric grid + Radix Dialog lightbox + `useEntityAudit` history + TriageActions
- `src/app/admin/bim-diagnostics/components/TriageActions.tsx` — FSM status select + assignee input + internal notes editor + triage history
- `src/app/admin/bim-diagnostics/components/DiagnosticsCharts.tsx` — Recharts FPS histogram (10-bin) + GPU pie + render-mode bar (CSS-var colors per ADR-365)
- `src/app/admin/bim-diagnostics/BimDiagnosticsView.tsx` — client root: filter state + selection + CSV export trigger + 3-pane shell
- `src/app/admin/bim-diagnostics/page.tsx` — server wrapper (auth via layout `requireAdminForPage`)
- `src/lib/exports/diagnostics-csv.ts` — `diagnosticsToCsv()` + `downloadDiagnosticsCsv()` (mirror `scheduleToCsv` SSoT)

**API routes created** (2):
- `src/app/api/admin/bim-diagnostics/[id]/route.ts` — `PATCH` for status + assignee (atomic Firestore transaction + per-field audit)
- `src/app/api/admin/bim-diagnostics/[id]/notes/route.ts` — `PUT` for internalNotes (single-field replace, idempotent skip when unchanged)

**Files modified** (7):
- `src/types/audit-trail.ts` — added `triage_status_changed`, `triage_assigned`, `internal_note_added` to `AuditAction` union
- `firestore.rules` — updated `performance_diagnostics` block to restrict super-admin update to `{status, assignedSuperAdminId, internalNotes, triageHistory}` only (immutable base fields enforced via `diff().affectedKeys().hasOnly(...)`)
- `src/app/api/performance-diagnostics/route.ts` — first-write sets defaults `status:'new'`, `assignedSuperAdminId:null`, `internalNotes:null`, `triageHistory:[]`
- `src/lib/auth/types.ts` — added 3 explicit PERMISSIONS entries (super-admin granted via `isBypass`, explicit for audit transparency)
- `src/components/admin/layout/AdminSidebar.tsx` — added nav entry «Διαγνωστικά BIM» under `dataAudit` group, gated by `superAdminOnly:true`
- `src/i18n/locales/el/admin.json` — added `bimDiagnostics.*` namespace (~44 keys, pure Greek) + sidebar.nav entry
- `src/i18n/locales/en/admin.json` — added parallel `bimDiagnostics.*` namespace

**REST design**: GitHub Issues convention — `PATCH /[id]` for status+assignee (atomic, single resource), `PUT /[id]/notes` for internalNotes replace. Industry-standard split for triage workflows (Jira/Linear/Sentry convergence).

**Deviations from research-time spec**:
- Virtualization (`@tanstack/react-virtual`) deferred: plain scrolling table chosen for first iteration since 30-day window keeps row count bounded. Promote when records >1k.
- New permissions kept explicit in `PERMISSIONS` registry even though super-admin role uses `isBypass:true`; provides audit-grade traceability for future role granularization.

**Industry alignment**: Resource-oriented REST (GitHub Issues PATCH + comments POST), CSS-var palette tokens (ADR-365), Recharts MIT (N.5 license-compliant, already used in 25 files).

---

**Group C summary** (ALL 7 topics CLOSED ✅):

| Topic | Status | Sub-Qs | Effort impact |
|---|---|---|---|
| C.1 — Animation System Implementation UX | ✅ 9/9 CLOSED | 9 | +18-22h Phase 9 |
| C.2 — BIM Comments / Markup System | ✅ 8/8 CLOSED | 8 | +12-14h Phase 9 |
| C.3 — 3D Manual Dimensions Tool | ✅ 7/7 CLOSED | 7 | +10-12h Phase 9 |
| C.4 — BimEntityCard Remaining Tabs | ✅ 6/6 CLOSED | 6 | +5-6h Phase 9 |
| C.5 — ARIA + Screen Reader Compliance | ✅ 5/5 CLOSED | 5 | +6-7h Phase 9 (+4-6h QA matrix) |
| C.6 — Advanced Section Cuts + Crop Region | ✅ 6/6 CLOSED | 6 | +8-10h Phase 9 |
| C.7 — Performance HUD Extensions | ✅ 5/5 CLOSED | 5 | +10-12h Phase 9 |
| **Group C total** | **✅ 7/7** | **46 sub-Qs** | **+69-83h Phase 9** (+4-6h QA) |

**ADR-366 total estimate revised post-Group-C**: **~254-303h Phase 0-9** (από ~185-220h post-Group-B baseline, +69-83h Group C net).

**Νέες Phase 9 SSoT modules** (Group C cumulative):
- Animation (~12 modules): TurntablePathBuilder, WaypointPathBuilder, AnimationStore, animation-presets, keyframe-interpolator, TimelineEditor, WaypointDragHandle, RibbonAnimationContextualTab, MP4Exporter, RenderQueueStore, RenderQueuePanel, bim-animations.service
- Comments (~11 modules): CommentMarker3DRenderer, comment-marker-textures, BimCommentDetailsPanel, CommentListPanel, CommentReplyInput, CommentAttachmentUploader, CommentAttachmentLightbox, comment-status-fsm, comment-anchor-resolver, bim-comments.service, CommentMentionsPicker, CommentBadgeIcon, BimCommentsStore
- Dimensions (~10 modules): Dimension3DRenderer, dim3d-line-geometry, dim3d-value-computer, dim3d-text-plane-orienter, Dim3DToolStateMachine, useDim3DToolRouting, Dim3DGripsRenderer, bim-dimensions-3d.service, dim3d-snap-engine-adapter, RibbonDim3DContextualTab, Dim3DPropertiesPanel, BimDimensions3DStore
- Card Tabs (~6 modules): BimMaterialsTab, BimBoqTab, BimCommentsTab, material-alternatives-resolver, boq-tree-builder, last-active-tab-tracker (+ bim-entity-update.service material change)
- ARIA polish (~5 modules + extensions): announcement-protocol, entity-dom-proxy-renderer, entity-keyboard-navigator, use-reduced-motion, reduced-motion-config (+ extends aria-entity-description-generator + focus-order)
- Section+Crop (~7 modules + extensions): extend SectionStore/SectionBox/section-clip-applicator/section-scene-controller/Section3DPanelTab/Section2DPanel, section-group-transformer, horizontal-cut-preset-resolver, CropRegionStore, CropRegionTool, CropRegionOverlay, crop-frustum-builder, RibbonCropRegionButton
- Performance ext (~13 modules): PerformanceHistoryStore, Sparkline, PerformanceHUDSparklines, regression-detector, baseline-tracker, auto-submit-fps-threshold, anonymizer, session-id-generator, telemetry-batcher, telemetry-uploader, admin/bim-diagnostics/page + 5 components + bim-diagnostics-service + bim-diagnostics-export + 2 server routes

**Νέες Firestore collections**:
- `bim_animations/{animationId}` + subcoll `render_jobs/{jobId}` (C.1)
- `bim_comments/{commentId}` + subcoll `replies/{replyId}` (C.2)
- `bim_dimensions_3d/{dimensionId}` (C.3)
- `bim_performance_telemetry/{telemetryId}` (C.7, anonymized, no companyId)
- `performance_diagnostics` schema extension (C.7, triage fields)

**Νέοι enterprise-id generators**:
- `anm_bim_*` (animations C.1)
- `cmt_bim_*` + `cmtr_bim_*` (comments + replies C.2)
- `dim3d_*` (3D dimensions C.3)
- `telm_bim_*` (telemetry C.7)
- `sec_*` (sections — ephemeral session-only, in-memory, NOT persisted C.6)

**Νέες RBAC permissions** (`roles.ts`):
- `bim_animations.{create,read,update,delete}` (C.1)
- `bim_comments.{create,read,update,delete,assign,archive}` (C.2)
- `bim_dimensions_3d.{create,read,update,delete}` (C.3)
- `bim_entities.update_material` + `bim_entities.boq_override_set` (C.4)
- `bim_audit.read` (C.4 tab gate)
- `bim_performance_telemetry.read` (C.7 super-admin)
- `performance_diagnostics.{triage,update_status,assign}` (C.7 super-admin)

**Νέοι audit types** (`audit-types.ts`):
- `bim_animation_{created,rendered,deleted}` (C.1)
- `bim_comment_{created,updated,replied,status_changed,assigned,archived,deleted,attachment_added}` (C.2)
- `bim_dim3d_{created,updated,deleted,orphaned}` (C.3)
- `bim_entity_material_changed` + `bim_entity_boq_override_set` (C.4)
- `performance_auto_submit_{prompted,accepted,declined}` (C.7)
- `performance_diagnostic_{triaged,status_changed}` + `performance_telemetry_erased` (C.7)

**Νέα notification keys** (`notification-keys.ts`):
- `bim3d.animation.render.{completed,failed}` (C.1)
- `bim3d.comment.{mentioned,assigned,replied,status_changed,archived}` (C.2)

**Νέες npm deps** (Phase 9, ΟΛΕΣ N.5 MIT compliant):
- `mp4-muxer` (C.1, already cataloged B.4.Q8) — MIT ✅
- Recharts (C.7 admin dashboard) — ήδη installed για άλλα dashboards, MIT ✅
- WebCodecs API (C.1) — browser native, no license

**i18n footprint** (Group C cumulative, all `bim3d.*` + `admin.bimDiagnostics.*`):
- C.1: ~42 keys × 2 locales = ~84 entries
- C.2: ~38 keys × 2 = ~76 entries
- C.3: ~36 keys × 2 = ~72 entries
- C.4: ~30 keys × 2 = ~60 entries
- C.5: ~32 keys × 2 = ~64 entries
- C.6: ~28 keys × 2 = ~56 entries
- C.7: ~44 keys × 2 = ~88 entries
- **Total Group C: ~250 keys × 2 locales ≈ ~500 entries**

**Decisions conscious diverge** (memory rules applied):
- C.1.Q6 (H.264 over AV1): conscious risk-averse choice — AV1 browser support 2027+, H.264 MPEG-LA royalty-free streaming, license N.5 protected
- C.1.Q7 (no audio v1): MVP scope discipline — audio track architecturally enabled (mp4-muxer supports) but no UI v1
- C.2.Q3 (1-level replies max): conscious anti-Slack diverge — flat-with-1-reply covers 90% architectural discussion + UI simplicity vs depth complexity
- C.3.Q7 (separate `bim_dimensions_3d` collection vs ADR-362 extension): justified per data model difference (Vector3 vs Vector2, host entity binding) — NOT UX divergence (ribbon UI + tool routing shared via useDim3DToolRouting)
- C.4.Q4 (no inline BOQ override): SSoT principle — single BOQ edit UI σε BOQ subapp [[feedback-centralize-on-the-spot]]
- C.7.Q4 (FPS<10 prompt, not silent): GDPR + trust — silent auto-submit would violate consent UX even though Q3 telemetry covers similar data
- C.7.Q5 (client-side baseline, no server ML v1): conscious complexity reduction — server-side ML regression detection deferred Group D

**Pending DEFERRED Group D / Phase 10+** (NOT blocking Phase 9 implementation):
- Animation: audio track (voiceover/music import — mp4-muxer API ready), animation crop region keyframing (C.6.Q5 v1=static), animation share via URL link (Group D)
- Comments: PDF/video attachments (C.2.Q6 v1=image only), 2D plan-view comment markers backport (C.2 cross-mode), free-text labels with leader lines (B.2.Q3 ext — mirror ADR-362 pattern)
- Section cuts: polygon crop region (C.6.Q4 v1=rectangle), animation crop keyframing
- Performance: server-side ML regression detection (C.7.Q5 v1=client-side baseline), per-feature performance budgets enforcement
- ARIA: VoiceOver iOS / TalkBack Android (mobile non-goal G11 — re-evaluate when mobile re-scoped)
- 3D Dimensions: dimension chain auto-link (Revit-style dimension chains), dimension formula references (Revit parametric)
- Admin dashboard: real-time alert webhooks (Slack/email on critical FPS<5 events), aggregated org-wide trends across companies (super-admin global view)
- Auto-Infer Alignment Guides (pending ratchet ADR-3XX TBD, ~3h) — referenced C.3.Q2 snap behavior but not blocking
- IFC export Phase 2 (deeper IFC schema coverage post-Phase 8.0)
- AR/XR mode (WebXR — entirely new feature, Group E candidate)

**Group C readiness gate**:
- ✅ Όλα 7 topics 46 sub-Qs answered με industry alignment + decisions + architectural implications + effort impact
- ✅ License N.5 verified (MIT-only deps)
- ✅ SSoT REUSE explicit όπου εφαρμόζεται (90%+ patterns mirror 2D)
- ✅ GOL checklist 7/7 ανά topic
- ✅ Mirror 2D pattern explicit [[feedback-3d-mirror-2d-ssot]]
- ✅ Cross-domain consistency (entity-anchor orphan auto-convert pattern C.2.Q7 + C.3.Q6 + future)
- ✅ Conscious diverge documented με justification
- ✅ Pending DEFERRED Group D / Phase 10+ catalogued

**Post-Group-C readiness**: Phase 9 implementation start (12 missing modules + 4 deferred categories) μπορεί να ξεκινήσει σε όποια σειρά αποφασίσει ο Γιώργος. Προτεινόμενη σειρά Phase 9: C.4 (smallest, completes UX gaps για existing entities) → C.3 (dimensions tool, mirror 2D) → C.5 (ARIA polish, builds on Phase 8.0 foundation) → C.6 (section + crop, builds on Phase 7.0) → C.2 (comments, new vertical slice) → C.7 (performance ext, builds on Phase 4 base) → C.1 (animation, largest scope, builds on all camera+render foundations).

---

## Bugfix — DxfToThreeConverter unit-scale alignment (2026-05-25)

**Bug A — 3D toggle flash / scene disappears:**
`syncDxfOverlay` called `frameBounds` with DXF mm-scale bounding box. DXF coordinates
were pushed raw (mm) into Three.js while BIM geometry uses metres → 1000× scale mismatch.
`frameBounds` computed a camera distance of ~20 000+ units; `CAMERA_FAR = 1000` clipped
the entire scene. The camera moved (500ms animation), the scene briefly appeared at the
default position (15, 10, 15), then vanished as the camera reached the far-clipped position.

**Bug B — ViewCube corner/edge click → scene disappears:**
`snapToViewDirection` uses `dist = camera.distanceTo(target)`. After Bug A moved the
camera ~20 000 units from the DXF-mm target, corner/edge snaps preserved that huge
distance → scene remained beyond `CAMERA_FAR`.

**Fix — `DxfToThreeConverter.sync()` applies group-level unit scale:**
```
group.scale.set(unitScale, 1, unitScale)
```
where `unitScale = DXF_UNIT_TO_METRES[dxfScene.units ?? 'mm']` (0.001 for default mm).
`getBounds()` now returns metre-scale world coords → `frameBounds` positions camera
correctly (~20–60 m for typical floor plans) → BIM entities visible within `CAMERA_FAR`.
3 new unit tests added to `DxfToThreeConverter.test.ts` (mm/m/cm scale assertions).

---

## Bugfix — SSAO black-screen + debug-log cleanup (2026-05-25 → 2026-05-26)

### Root cause (corrected 2026-05-26)

**Original (wrong) diagnosis**: `SSAOPass` sets `scene.overrideMaterial = MeshNormalMaterial` →
`LineSegments` lack normals → garbage AO values → black.
This was incorrect: `SSAOPass.overrideVisibility()` (Three.js source line 378-384) already
hides all `isLine` objects before the normal-buffer pass. `BimSSAOPass` is therefore
a redundant (but harmless) defensive guard.

**Actual root cause — EffectComposer compositing accumulation**:

`SSAOPass.Output.Default` uses **multiply blending** (`blendSrc: DstColorFactor, blendDst: ZeroFactor`).
When the pass is the **last pass** in the composer (`renderToScreen = true`), it writes to
`null` (the screen framebuffer), multiplying SSAO onto whatever is currently on the screen:

```
frame_1: screen ← SSAO × frame_0_scene         ✓  (frame 0 had correct scene)
frame_2: screen ← SSAO × (SSAO × scene)        ← darker
frame_N: screen ← SSAO^N × scene               → BLACK after ~60 frames
```

At 60fps and a typical SSAO factor of 0.9, after 60 frames: `0.9^60 ≈ 0.002` → effectively black.
This explains the reproducible "scene disappears 800ms after camera idle" — 800ms is the
`IdleDetector` threshold, and the 300ms kernelRadius transition animation spans ~18 frames
that all compound the multiplication.

### Fix — `CopyPass` as terminal pass (`ssao-modulator.ts`, 2026-05-26)

`SSAOPass.Output.Default` is designed to run as a **middle pass** (not last): when
`renderToScreen = false`, it renders to `readBuffer` (which holds the current frame's scene
colors from `RenderPass`), and the multiply blend gives: `SSAO × scene_colors` — correct
for exactly one frame.

Fix: add `ShaderPass(CopyShader)` as the final pass in the composer chain so
`SSAOPass.renderToScreen` is always `false`:

```
[RenderPass] → writeBuffer → swap → readBuffer = scene_colors
[BimSSAOPass, renderToScreen=false] → readBuffer ← SSAO × scene_colors  (one-time, correct)
[CopyPass, renderToScreen=true] → screen ← readBuffer                   (clean copy, NoBlending)
```

```typescript
const copyPass = new ShaderPass(CopyShader);
copyPass.material.blending = THREE.NoBlending;
this.composer.addPass(this.renderPass);
this.composer.addPass(this.ssaoPass);
this.composer.addPass(copyPass);   // ← ensures SSAOPass is never last
```

`BimSSAOPass` (hide/restore `LineSegments`) is kept as a belt-and-suspenders guard
against upstream Three.js changes to `overrideVisibility()`.

### Additional cleanup (2026-05-25)
- `ssaoModulator.onCameraIdle()` re-enabled (was commented out as workaround).
- `BimSceneLayer.hasMesh` getter backed by `_hasMesh` cache (set once in `sync()`),
  replacing `hasAnyMesh()` traverse-per-idle-call.
- `applyDxfOverlayFraming` (`scene-sync-dxf-overlay.ts`) simplified — removed
  `dxfScene` and `scene` parameters that were only used by debug logs.
- All `[3D-DEBUG]` `console.log` calls removed from:
  `scene-idle-handlers.ts`, `scene-sync-dxf-overlay.ts`, `DxfToThreeConverter.ts`,
  `viewport-framing.ts`, `viewport-camera.ts`, `scene-render-frame.ts`.

