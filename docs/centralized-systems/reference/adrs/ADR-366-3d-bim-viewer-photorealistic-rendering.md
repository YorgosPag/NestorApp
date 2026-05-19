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

## 12. Changelog

| Ημ/νία | Αλλαγή | Author |
|---|---|---|
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
