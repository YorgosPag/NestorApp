# ADR-366 — 3D BIM Viewer & Photorealistic Rendering

| Πεδίο | Τιμή |
|---|---|
| **Status** | 🟡 **PROPOSED** 2026-05-19 — Pending open questions §9 |
| **Date** | 2026-05-19 |
| **Category** | DXF Viewer — 3D Rendering / Photorealistic Output |
| **Location** | `docs/centralized-systems/reference/adrs/ADR-366-3d-bim-viewer-photorealistic-rendering.md` |
| **Author** | Claude Opus 4.7 + Γιώργος Παγώνης |
| **Related ADRs** | ADR-040 (Preview Canvas Perf — micro-leaf, 2D SSoT), ADR-055 (Tool State SSoT), ADR-175 (BOQ), ADR-186 (Building Code), ADR-294 (SSoT Ratchet), ADR-340 (Floorplan Background), ADR-345 (Ribbon), ADR-358 (Stair Tool), ADR-362 (Dimensions), ADR-363 (BIM Drawing Mode — **primary consumer**) |
| **Source codebase referenced** | `C:\genarc` (sibling project — port source για camera/ViewCube/snap/coordinate system) |
| **Child SPECs** | `SPEC-3D-001` (DXF→Three.js Pipeline), `SPEC-3D-002` (BIM Elements Renderer), `SPEC-3D-003` (Materials & Lighting), `SPEC-3D-004` (GenArc Reuse Catalog — **split per-domain into sub-specs A/B/C/D/E**) |
| **GenArc Sub-Catalogs** | **`SPEC-3D-004A`** ✅ (Viewport — 45 files catalogued 2026-05-19), **`SPEC-3D-004B`** ✅ (DXF Parser — 8 files, ZERO port, 2026-05-19), **`SPEC-3D-004C`** ✅ (Utils/Snap/Picking — 16 files, 2 PORT/1 ADAPT/13 EXCLUDE, 2026-05-19), `SPEC-3D-004D` (Geometry Helpers — pending), `SPEC-3D-004E` (Materials/Shaders — pending) |

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
| **SPEC-3D-004D** | Geometry helpers (BIM/BOM math) | `engines/bom/` (5 files) + `utils/{slab,column,beam,wall}*` | ⏳ pending session | TBD |
| **SPEC-3D-004E** | Materials / Shaders (concepts only για PBR mapping) | `engines/sdf/` (12 files) + `shaders/` + `material.types` | ⏳ pending session | TBD |

### 8.2 SPEC-3D-004A Summary (Viewport — completed)

Πλήρης catalog 45 αρχείων `engines/viewport/`:
- **15 PORT_AS_IS** (~2.700 LOC): viewportCamera, tumbleRotation, viewportAnimation, viewportFraming, viewportPoi, viewSnapDetector, viewCubeMesh, viewCubeOverlay, viewCubeHighlight, gizmoBuilders, gizmoGeometry, gizmoHandleBuilders, gizmoHitTest, hlrEdgeGeometry, windowSelectionOverlay
- **8 PORT_WITH_ADAPTATION** (~1.706 LOC): viewCube (north-callback), section group (4 files, type swaps), loupe group (3 files, type swaps)
- **7 EXTRACT_CONCEPT** (~3.733 LOC): gizmoController, gizmoDragHandler, gizmoOverlay, navProxy ⭐, navProxyStaircase, vertexDotsOverlay, viewportEventHandlers
- **15 EXCLUDE** (~3.284 LOC): drawing controllers (Nestor has BIM drawing), drawing previews, snapIndicator, moveController, ΝΟΚ overlays

⭐ **navProxy (508 LOC, EXTRACT_CONCEPT)** = πιθανό primary path για SPEC-3D-002 (BIM Elements Renderer). Battle-tested rasterizer με 5 render modes + HLR. Open Question Q2 στο SPEC-3D-004A.

Full details: `SPEC-3D-004A-genarc-viewport-port-catalog.md`.

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

## 9. Open Questions για Γιώργο

> Αυτές οι ερωτήσεις **block** implementation. Σε κάθε question: επιλέγεις A, B, ή C (ή δίνεις άλλο). Μία ερώτηση τη φορά.

### Q1 — Mode Toggle UI: Πού μπαίνει το 3D button;

Οι επιλογές:

**A) Ribbon tab — νέο tab "3D View"** στο ribbon bar (δίπλα στο HOME). Ribbon opens automatically on toggle. Pattern: Revit View tab.

**B) Floating toolbar button** — ένα icon button πάνω δεξιά στο canvas (πχ "3D" ή "⬡"). Δεν ανοίγει ribbon. Minimal UI.

**C) Status bar toggle** — κάτω δεξιά, δίπλα σε zoom/coordinates. Pattern: AutoCAD model/paper space toggle.

*Προτεινόμενο: **B** (floating button). Λιγότερο ribbon clutter. 3D controls μπαίνουν contextual ribbon tab όταν είναι active.*

---

### Q2 — Multi-floor: Βλέπουμε ΟΛΑ τα floors ταυτόχρονα, ή μόνο τον active floor;

**A) Όλα τα floors simultaneously** — full building 3D view (όπως Revit 3D View). Διαφορετικά materials/opacity ανά floor. Πολύ impressive.

**B) Active floor only** — μόνο ο floor που έχει ανοιχτεί στο 2D DxfCanvas. Simpler, consistent με 2D workflow.

**C) Toggle** — default active floor, button για "Show All Floors".

*Προτεινόμενο: **C** (toggle). Start simple, add power when needed.*

---

### Q3 — Path Tracer trigger: Πότε ενεργοποιείται;

**A) Explicit button "Render"** — user πατάει "Render" → path tracer starts, rasterizer pauses. Pattern: Blender Rendered view.

**B) Αυτόματα όταν ο χρήστης σταματήσει να αλληλεπιδρά** (2 δευτερόλεπτα idle) → path tracer kicks in. Επαναφέρεται σε rasterizer με πρώτη mouse move. Pattern: KeyShot live rendering.

**C) Ξεχωριστό "Render" dialog** (DPI, samples, HDRI selection) — export-only use case.

*Προτεινόμενο: **B** (auto on idle). Seamless UX. Export = επιπλέον save button.*

---

### Q4 — HDRI environment map: Τι default χρησιμοποιούμε;

**A) Solid color sky** (0x87CEEB blue) — zero assets, fast load. Phase 3 MVP.

**B) Procedural sky shader** (Rayleigh scattering, sun position) — no external files, physics-based. Three.js `Sky` addon (included, no extra deps).

**C) HDRI file** (equirectangular EXR/HDR) — gorgeous results. Requires hosting the HDRI (500KB-4MB). Option: Polyhaven free HDRI.

*Προτεινόμενο: **B** (procedural sky) για Phase 3, **C** (HDRI) ως Phase 5 enhancement.*

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

## 12. Changelog

| Ημ/νία | Αλλαγή | Author |
|---|---|---|
| 2026-05-19 | **Initial draft v1.0** — Full architecture, 7 phases, GenArc port catalog, SPEC-3D-001/002/003/004 skeletons, §9 open questions Q1-Q4 για Γιώργο. Status: PROPOSED. | Claude Opus 4.7 |
| 2026-05-19 | **SPEC-3D-004 split per-domain** — Original master-catalog approach abandoned (484 files too large for one session). New structure: 5 sub-SPECs A/B/C/D/E. **SPEC-3D-004A (Viewport) COMPLETED**: 45 files catalogued, 15 PORT_AS_IS + 8 ADAPT + 7 EXTRACT + 15 EXCLUDE. Phase 4 effort revised 6h→8-10h. New Phase 2 alternative path identified: navProxy port (Q2 in 004A). | Claude Opus 4.7 |
| 2026-05-19 | **SPEC-3D-004B (DXF Parser) COMPLETED** — 8 files catalogued (engines/dxf/ + types/dxf*.types.ts). **Result: 0 PORT / 0 ADAPT / 0 EXTRACT / 8 EXCLUDE.** Reasoning: GenArc DXF domain is topographic plot boundary detection (ΕΓΣΑ'87 / ΝΟΚ / GPT-4o pipeline) — orthogonal to ADR-366 BIM rendering. Nestor already has mature 15-entity custom DXF parser με Web Worker + full HEADER/DIMSTYLE/LAYER table support. **Implication**: SPEC-3D-001 (DXF→Three.js Pipeline) χτίζεται from scratch ως νέος `DxfToThreeConverter` πάνω στο Nestor `DxfEntityUnion`, χωρίς αναφορά σε GenArc DXF code. Confirmed clean domain isolation (zero coupling με άλλα GenArc engines). | Claude Opus 4.7 |
| 2026-05-19 | **SPEC-3D-004C (Utils/Snap/Picking) COMPLETED** — 16 files catalogued (10 `engines/snap/*` + 6 `utils/{coordinateTransforms,cursorProjection,gizmoProjection,sitePicking,elementSnap,gridSnap}`). **Result: 2 PORT_AS_IS + 1 PORT_WITH_ADAPTATION + 0 EXTRACT + 13 EXCLUDE.** Top ports: `coordinateTransforms.ts` (Three.js NDC math, ⭐ critical — Nestor's `CoordinateTransforms` είναι 2D-only) + `gizmoProjection.ts` (constrained drag math για Phase 7) + `cursorProjection.ts` (adapt for raycaster→world). EXCLUDE rationale: Nestor's 17-engine snap system είναι **strict superset** του GenArc 7-strategy pipeline + `sitePicking` 100% ΝΟΚ-specific (consistent με SPEC-3D-004A §5.5 EXCLUDE plotOverlay). Phase 0 effort: ~3-4h (coordinate primitives + cursor→world + tests). 4 open questions (alignment guide infer in Nestor's GuideSnapEngine, cursorProjection port timing Phase 0/1/2, screenToWorld naming collision 2D vs 3D, snap zero-port confirmation). Cross-domain edges flagged for SPEC-3D-004D: `raySceneIntersection`, `buildingSelectors`, `distSqXZ`. | Claude Opus 4.7 |
