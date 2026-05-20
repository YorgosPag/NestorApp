# ADR-366 — 3D BIM Viewer & Photorealistic Rendering

| Πεδίο | Τιμή |
|---|---|
| **Status** | 🟢 **APPROVED** 2026-05-19 — All §9 open questions resolved Full Enterprise. Phase 0 implementation ready. |
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

### 4.5 Phases

| Phase | Τίτλος | Εκτίμηση | Εξαρτήσεις |
|---|---|---|---|
| **Phase 0** | Infrastructure: Three.js setup, SceneManager, ViewMode3DStore, mode toggle UI (ribbon button), coordinate system, resize handler | ~4h | — |
| **Phase 1** | DXF → 3D: LINE→LineSegments, ARC→EllipseCurve, LWPOLYLINE/POLYLINE→BufferGeometry, HATCH→ShapeGeometry, INSERT expansion, TEXT→sprite | ~8h | Phase 0 |
| **Phase 2** | BIM → 3D: Wall/Column/Beam/Slab→ExtrudeGeometry, Opening as boolean cutout (CSGEvaluator or manual), multi-floor stacking via ADR-326 floor elevation | ~10h | Phase 0, ADR-363 |
| **Phase 3** | Materials & Lighting: MeshStandardMaterial per ADR-363 material catalog, AmbientLight + DirectionalLight + optional PointLight, shadow mapping | ~6h | Phase 2 |
| **Phase 4** | Camera & ViewCube: port από GenArc, tumble, perspective/ortho toggle, canonical view snap, frame-scene, home button | ~6h | Phase 0 |
| **Phase 5** | WebGPU Path Tracer: three-gpu-pathtracer integration, progressive sampling, denoising, environment map (HDRI) | ~12h | Phase 3+4 |
| **Phase 6** | Export: PNG (rasterized + path-traced), EXR (HDR), print resolution | ~4h | Phase 5 |
| **Phase 7** | Polish: depth-of-field, bloom, multi-floor clip planes, annotation overlays in 3D, section cuts | ~8h | Phase 6 |

**Συνολική εκτίμηση: ~58h** (10-12 session phases).

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
- **User upload**: Phase 7+ allow custom HDRI upload (drag-drop equirectangular .hdr/.exr file)

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
| A.7.Q2 | ARIA / Screen reader υποστήριξη για τυφλούς χρήστες | **DEFERRED 2026-05-19** — όχι αυτή τη στιγμή. Απόφαση Γιώργου: σεβασμός για a11y users αλλά timing δεν είναι κατάλληλο, ίσως post-Phase 7. ΟΧΙ ARIA labels, ΟΧΙ live regions, ΟΧΙ entity description announcements. Sighted keyboard users καλύπτονται από Q1 (visual focus indicator + label). | Industry CAD/BIM 0/4 implement (Revit/AutoCAD/SketchUp/ArchiCAD). Web a11y standard partial — αν προστεθεί αργότερα είναι additive feature, μηδέν refactor cost. |
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

DEFERRED μετά Phase 7.0a: (a) ✅ **1-pass stencil optimization Phase 7.0b — DONE 2026-05-20 (see Phase 7.0b implementation note below)**, (b) hatched per-material cut Phase 7.1+ (ADR-363 ShaderType), (c) ✅ **2D Live Section Panel GenArc port Phase 7.0B — DONE 2026-05-20 (see Phase 7.0B implementation note below)**, (d) selection-aware emphasis intersect Phase 7.0+ TBD.

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
