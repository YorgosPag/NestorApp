# ADR-363 — BIM Drawing Mode (Parametric Building Elements)

| Πεδίο | Τιμή |
|---|---|
| **Status** | 🟡 PROPOSED — αναμένει επιβεβαίωση Γιώργου (open questions §11) |
| **Date** | 2026-05-17 |
| **Category** | DXF Viewer — BIM / Parametric Building Modeling |
| **Location** | `docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md` |
| **Author** | Claude Opus 4.7 + Γιώργος Παγώνης |
| **Related ADRs** | ADR-031 (Commands), ADR-032 (Drawing FSM), ADR-040 (Preview Canvas Perf), ADR-055 (Tool State SSoT), ADR-057 (Entity Completion), ADR-175 (BOQ), ADR-186 (Building Code Engine), ADR-195 (Entity Audit Trail), ADR-294 (SSoT Ratchet), ADR-326 (Tenant Org), ADR-340 (Floorplan Background), ADR-345 (Ribbon), ADR-355 (Firestore Subscribe SSoT), ADR-358 (Stair Tool — **TEMPLATE**), ADR-361 (Subscribe Equality Guard), ADR-362 (Dimensions) |
| **Source codebase referenced** | `C:\genarc` (sibling project, port source for typed BIM entities) |

---

## Summary

Επέκταση του DXF Viewer subapp σε **BIM Drawing Mode**: παραμετρικά building entities (τοίχοι, ανοίγματα/κουφώματα, πλάκες, κολώνες, δοκάρια) που σχεδιάζονται είτε πάνω σε υφιστάμενο DXF underlay (παλιά διδιάστατα γραμμικά σχέδια) είτε από scratch, αποθηκεύονται στο Firestore ως first-class entities, και τροφοδοτούν αυτόματα το σύστημα **Επιμετρήσεων ADR-175** (BOQ) για κοστολόγιο.

Η σκάλα (ADR-358) ήδη υλοποιεί τον πλήρη **Associative Parametric pattern** (`kind` + `params` + `geometry cached` + Firestore collection + validator + ribbon + 3D-ready). Το παρόν ADR **γενικεύει** αυτό το pattern στα υπόλοιπα 5 building entities, **χρησιμοποιώντας τον υφιστάμενο κώδικα του genarc** ως source-of-truth για τα type definitions και computed geometry.

**Δεν είναι Revit-clone**. Είναι παραγωγικό 2D BIM-on-DXF με αυτόματη τροφοδοσία κοστολογίου — η βασική γραμμή του 5D BIM (γεωμετρία + ποσότητες + κόστος), χωρίς το βάρος του 3D modeler ή του IFC interop στις πρώτες φάσεις.

---

## 1. Context

### 1.1 Η αφορμή

Ο Γιώργος έχει 2 codebases:
- **`C:\Nestor_Pagonis`** — production app (Next.js + Firestore) με DXF Viewer subapp ώριμο (ribbon, snap, command pattern, micro-leaf canvas, layer mgmt, dimensions, stair tool σε proposal stage).
- **`C:\genarc`** — sibling app (React 19 + Three.js + Vite, standalone) με ώριμα **typed BIM entities** + Eurocode structural engine + BOM calculator + ΝΟΚ engine.

**Στόχος**: ο DXF Viewer του Nestor να αποκτήσει BIM Drawing Mode ώστε ο χρήστης:
1. Να φορτώνει DWG/DXF διδιάστατο γραμμικό σχέδιο (legacy, πολλά κυκλοφορούν στην αγορά).
2. Να σχεδιάζει πάνω του παραμετρικούς **τοίχους, ανοίγματα, κουφώματα, πλάκες, κολώνες, δοκάρια, σκάλες** (η σκάλα ήδη σε ADR-358).
3. Ή να σχεδιάζει BIM entities απευθείας χωρίς underlay.
4. Τα entities να **τροφοδοτούν το BOQ** (ADR-175) → κοστολόγιο real-time.

### 1.2 Γιατί Νestor και όχι genarc

Ο Γιώργος επέλεξε **Σενάριο Β**: port των BIM entities ΜΕΣΑ στο Nestor αντί για export/import bridge.

| Κριτήριο | Bridge (genarc standalone) | Port (μέσα στο Nestor) ✅ |
|---|---|---|
| Sync overhead | Πάντα χειροκίνητος | Καμία — ένα repo |
| Firestore integration | Δύσκολη (cross-app) | Native |
| Real-time BOQ feed | Batch export | Live `useEntityAudit` triggers |
| Project context | Lost σε JSON | Άμεση σύνδεση `(companyId, projectId, buildingId, floorId)` |
| Multi-user collaboration | Αδύνατο | Firestore onSnapshot |
| Maintenance | 2 codebases | 1 |
| Genarc αξία | Standalone reference | **Source-of-truth για port** των typed entities + computed geometry |

### 1.3 Τα 2 αναφορικά templates

| Source | Τι παρέχει | Πώς το χρησιμοποιούμε |
|---|---|---|
| **ADR-358 (Stair Tool)** | Associative Parametric pattern, validator integration, ribbon, contextual panel, Firestore schema, EntityAudit, 3D-readiness, QTO | **Αρχιτεκτονικό template** — όλα τα νέα BIM entities ακολουθούν την ίδια δομή |
| **`C:\genarc\src\types\*.types.ts`** | Έτοιμα immutable typed entities + factories: Wall (+WallDna layer composition), Opening (5 types), Slab (4 types + outline), Beam, Column (rect/circular) | **Source-of-truth για port** των params + defaults. Computed geometry ports επίσης (BOM, wallGeometry) |

---

## 2. Στόχοι (Goals)

| # | Στόχος | Φάση |
|---|--------|------|
| G1 | Σχεδίαση Wall πάνω σε DXF underlay με snap | Phase 1 |
| G2 | WallDna layer composition (εξωτερικό σοβάς + φέρων + εσωτερικός σοβάς) | Phase 1 |
| G3 | Σχεδίαση Opening (door/window) host σε υφιστάμενο Wall | Phase 2 |
| G4 | Σχεδίαση Slab (πλάκα — floor/ceiling/roof/ground) με rectilinear polygon | Phase 3 |
| G5 | Σχεδίαση Column (κολώνα — rectangular + circular) με anchor | Phase 4 |
| G6 | Σχεδίαση Beam (δοκάρι) σαν linear segment + height/width | Phase 5 |
| G7 | Αυτόματη τροφοδοσία BOQ ADR-175 από BIM entities (per element: quantity + unit + ΑΤΟΕ category) | Phase 6 |
| G8 | Properties panel (contextual ribbon tab + floating panel) ανά element type | Phase 1-5 (incremental) |
| G9 | Multi-select + bulk edit BIM entities | Phase 7 |
| G10 | Schedule export (BIM entities → CSV/Excel/PDF table) | Phase 8 |
| G11 | 3D-readiness — `Point3D` με optional z παντού, για μελλοντική Phase 9+ 3D view | Phase 1+ (παντού) |

---

## 3. Background — Υφιστάμενος Κώδικας (source of truth)

### 3.1 Τι ήδη υπάρχει στο Nestor (SSoT reusable)

| SSoT | Αρχείο | Ρόλος για BIM |
|---|---|---|
| `EntityType` union | `src/subapps/dxf-viewer/types/entities.ts:73-96` | Ήδη έχει `'stair'`. Προσθήκη: `'wall' \| 'opening' \| 'slab' \| 'column' \| 'beam'` |
| `BaseEntity` | `types/entities.ts:25-70` | Layer, color, lineweight, ByLayer/ByBlock ήδη — BIM entities κληρονομούν αυτόματα |
| `ToolStateStore` + `TOOL_DEFINITIONS` | `stores/ToolStateStore.ts` + `systems/tools/ToolStateManager.ts` | Προσθήκη 5 νέων tools: `wall`, `opening`, `slab`, `column`, `beam` (category `'drawing'`) |
| `DrawingStateMachine` | `core/state-machine/DrawingStateMachine.ts` | FSM IDLE→COLLECTING→COMPLETING — επαναχρησιμοποιείται αυτούσιο |
| `useDrawingHandlers` + `useUnifiedDrawing` | `hooks/drawing/` | Wired σε snap+polar+ortho — αυτούσιο |
| `completeEntity` | `hooks/drawing/completeEntity.ts` | Unified entity creation pipeline (ADR-057) |
| `CreateEntityCommand` + `CommandHistory` | `core/commands/` | Undo/redo (ADR-031) — αυτούσιο |
| `ProSnapEngineV2` | `snapping/global-snap-engine.ts` | 17 snap engines — δουλεύει σε DXF underlay |
| `PreviewCanvas` | `canvas-v2/preview-canvas/` | Rubber-band preview zero-lag (ADR-040) |
| `RIBBON_PANELS_CONFIG` | `ui/ribbon/data/home-tab-draw.ts` | Πρόσθεση νέου panel "Δομικά" (BIM) ή νέος ribbon tab "BIM" |
| `enterprise-id-prefixes.ts` | `src/services/enterprise-id-prefixes.ts` | `STAIR='stair'` ήδη. Νέα prefixes: WALL, OPENING, SLAB, BEAM, COLUMN |
| `firestore-collections.ts` | `src/config/firestore-collections.ts:329` | `FLOORPLAN_STAIRS` ήδη. Νέες collections: `floorplan_walls`, `floorplan_openings`, `floorplan_slabs`, `floorplan_beams`, `floorplan_columns` |
| `firestoreQueryService.subscribe` | ADR-355 + ADR-361 equality guard | Επαναχρησιμοποιείται για όλα τα νέα collections |
| `EntityAuditService.recordChange()` | ADR-195 | Audit trail per BIM entity change |
| Building Code engine | `src/services/building-code/` (ADR-186) | Extension points: `gate-wall-checker`, `gate-opening-checker`, etc. |
| BOQ system | ADR-175 (Phase 1B implemented) | **Integration target** — auto-feed από BIM |
| `useEntityAudit` hook | `src/hooks/useEntityAudit.ts` | Reactive audit subscription |
| ADR-040 micro-leaf rules | `components/dxf-layout/canvas-layer-stack-leaves.tsx` | **Compliance υποχρεωτική** — νέα BIM renderers ως leaves |

### 3.2 Τι ήδη υπάρχει στο genarc (port source)

| Αρχείο genarc | Τι περιέχει | Port destination Nestor |
|---|---|---|
| `src/types/wall.types.ts` | `Wall`, `WallCategory`, `createWall`, defaults (height 3m) | `src/subapps/dxf-viewer/bim/types/wall-types.ts` |
| `src/types/wallDna.types.ts` | `WallDna`, `DnaLayer`, `LayerSide`, 3 defaults (exterior/interior/partition), `computeTotalThickness` | `bim/types/wall-dna-types.ts` |
| `src/types/opening.types.ts` | `Opening`, `OpeningType` (5 types), defaults (door 0.9×2.1m, window 1.2×1.4m sill 0.9m) | `bim/types/opening-types.ts` |
| `src/types/slab.types.ts` | `Slab`, `SlabType` (floor/ceiling/roof/ground), spans + outline | `bim/types/slab-types.ts` |
| `src/types/beam.types.ts` | `Beam` (start/end/height/width) | `bim/types/beam-types.ts` |
| `src/types/column.types.ts` | `Column`, `ColumnSection` (rect/circular), `ColumnAnchor` | `bim/types/column-types.ts` |
| `src/types/building.types.ts` | `Floor`, `FloorElements` (ID arrays per type) | **NOT ported** — Nestor έχει δικό του Building/Floor schema ήδη |
| `src/types/bom.types.ts` | `ConstructionPhase` (8 phases), `BomLineItem`, `BomSummary` | `bim/bom/bom-types.ts` (ή merge με ADR-175 SSoT) |
| `src/engines/bom/wallGeometry.ts` | Wall area/volume/length computations | `bim/bom/wall-quantities.ts` |
| `src/engines/bom/geometryCalculators.ts` | Slab/column/beam volume calculators | `bim/bom/geometry-quantities.ts` |
| `src/engines/bom/bomCalculator.ts` | BOM aggregation logic | **NOT ported as-is** — ενσωματώνεται στο BOQ engine ADR-175 |

### 3.3 Τι λείπει (gap analysis)

- ❌ **BIM entity types** στο `entities.ts` discriminated union (μόνο `stair` ήδη).
- ❌ **BIM tool category** (wall/opening/slab/beam/column tools).
- ❌ **WallDna editor UI** (layer composition, materials picker).
- ❌ **Opening host-wall relationship** rendering (boolean subtract).
- ❌ **Slab outline drawing** (polygon με rectilinear constraint optional).
- ❌ **Column anchor handling** στο preview/grip system.
- ❌ **BIM ↔ BOQ bridge** (event listener: BIM entity write → BOQ item upsert με ΑΤΟΕ category).
- ❌ **BIM Layer convention** (auto-create layers: `Walls`, `Walls-Exterior`, `Openings-Doors`, `Openings-Windows`, `Slabs`, `Columns`, `Beams`).
- ❌ **Material library SSoT** (concrete C25, brick masonry, plaster — Phase 6+).

---

## 4. Industry Research

### 4.1 BIM Drawing Mode — Πώς το κάνουν οι μεγάλοι

| Software | Mode toggle | Underlay DWG/DXF | Element catalog | BOQ integration |
|---|---|---|---|---|
| **Revit** | Native BIM (no toggle) | Insert as link/import | Family library — εκτενής | Schedules + Cost Codes |
| **ArchiCAD** | Native BIM | XREF DWG | GDL objects | Element ID + interactive schedules |
| **AutoCAD Architecture** | Toggle drawing/BIM | DWG native | AEC objects (Wall/Door/Window styles) | Quantity Schedules (PROPERTIES tags) |
| **BricsCAD BIM** | Toggle 2D/BIM | DWG native | BIM Components | iQuantity (built-in) |
| **Vectorworks Architect** | Mode switching | XREF | Symbol libraries | Worksheets |
| **Allplan** | BIM-first | DWG link | SmartParts | Quantity Takeoff (Allplan QTO) |

**Σύγκλιση 2026**: όλα τα παραπάνω υποστηρίζουν: (1) DWG underlay ως guide, (2) snap σε underlay geometry, (3) parametric placement με properties panel, (4) auto-quantity per element.

### 4.2 Στόχος Nestor BIM Mode

**Δεν θα ξαναγραφούμε Revit**. Στόχος είναι:
- ✅ Underlay DXF (ήδη έτοιμο, native DxfCanvas)
- ✅ Snap σε DXF entities + νέα BIM entities (ήδη ProSnapEngineV2)
- ✅ Parametric placement με ribbon contextual panel (ήδη pattern από ADR-358 + ADR-345)
- ✅ Auto-quantity → BOQ ADR-175
- ❌ NOT in scope: complex 3D viewer (Phase 9+), IFC export (Phase 10+), MEP routing (out), clash detection (out)

### 4.3 5D BIM alignment

Το ADR-175 §3.2 ήδη ορίζει τον στόχο 5D BIM:
```
3D Model (γεωμετρία) + 4D (Gantt) + 5D (BOQ + Τιμές)
```

Το παρόν ADR-363 παρέχει το **3D-ready geometry layer** (φάση 2D plan view, με Point3D types ready για 3D). Το 4D (Gantt) υπάρχει ήδη ανά κτίριο. Το 5D (BOQ + κοστολόγιο) υπάρχει ADR-175. Με το BIM Drawing Mode κλείνει ο κύκλος.

---

## 5. Decision

### 5.1 Αρχιτεκτονικό Pattern — Generic Parametric Building Element

Κάθε BIM entity ακολουθεί το **ίδιο pattern** που εγκαθίδρυσε η σκάλα (ADR-358 §5.1):

```typescript
// Generic shape
interface BimEntity<TKind, TParams, TGeometry> extends BaseEntity {
  type: 'wall' | 'opening' | 'slab' | 'column' | 'beam';
  kind: TKind;                         // sub-type discriminator
  params: TParams;                     // user-editable parameters
  geometry: TGeometry;                 // computed cache (re-derivable from params)
  validation: BimValidation;           // building-code checks
  qto: BimQuantityTakeoff;             // BOQ feed metadata (Phase 6)
  editingBy?: SoftLock;                // multi-user display-only (ADR-358 G24)
}

interface BimValidation {
  hasCodeViolations: boolean;
  violationKeys: string[];             // i18n keys
  lastValidatedAt: Timestamp;
}

interface BimQuantityTakeoff {
  primaryQuantity: number;             // π.χ. m² για wall, m³ για slab, τεμ για opening
  primaryUnit: 'm' | 'm2' | 'm3' | 'pcs' | 'kg';
  atoeCategory: AtoeCategoryCode;      // ADR-175 §3.3 (ΟΙΚ-1..ΟΙΚ-12)
  computedAt: Timestamp;
}
```

**Σημείωση**: το `geometry` είναι **re-derivable cache**. Σε corruption → recompute από `params`. Είναι load για perf (μην ξαναυπολογίζεις 60fps), ΟΧΙ source of truth.

### 5.2 EntityType union — επέκταση

```typescript
// src/subapps/dxf-viewer/types/entities.ts
export type EntityType =
  | 'line' | 'polyline' | 'lwpolyline' | 'circle' | 'arc' | 'ellipse'
  | 'text' | 'mtext' | 'spline' | 'rectangle' | 'rect' | 'point'
  | 'dimension' | 'block' | 'angle-measurement' | 'leader'
  | 'hatch' | 'xline' | 'ray' | 'array'
  | 'stair'                            // ADR-358 (ήδη)
  | 'center-mark' | 'centerline'       // ADR-362
  // ADR-363 BIM entities:
  | 'wall'
  | 'opening'
  | 'slab'
  | 'slab-opening'                     // Q3 — separate entity (elevator shaft, stair well, duct, chimney)
  | 'column'
  | 'beam';
```

### 5.3 Wall — Type Schema (port από genarc + Nestor extensions)

```typescript
// src/subapps/dxf-viewer/bim/types/wall-types.ts
export type WallKind = 'straight' | 'curved' | 'polyline';

export type WallCategory = 'exterior' | 'interior' | 'partition' | 'parapet' | 'fence';

export interface DnaLayer {
  readonly id: string;
  readonly name: string;
  readonly thickness: number;          // mm
  readonly materialId: string;         // material library ID (Phase 6+)
  readonly side: 'exterior' | 'core' | 'interior';
}

export interface WallDna {
  readonly layers: readonly DnaLayer[];
  readonly totalThickness: number;     // mm (computed)
}

export interface WallParams {
  readonly category: WallCategory;
  readonly start: Point3D;             // mm, z optional
  readonly end: Point3D;
  readonly height: number;             // mm (default 3000)
  readonly thickness: number;          // mm (computed από dna ή manual)
  readonly flip: boolean;              // exterior side
  readonly measurementLength?: number; // optional BOM override (m)
  readonly dna?: WallDna;              // layer composition
  readonly startBevel?: number;        // join cleanup
  readonly endBevel?: number;
  readonly polylineVertices?: Point3D[]; // αν kind='polyline'
  readonly curveControl?: Point3D;     // αν kind='curved' (quadratic Bezier control point)
}

export interface WallGeometry {
  readonly axisPolyline: Polyline3D;   // centerline
  readonly outerEdge: Polyline3D;
  readonly innerEdge: Polyline3D;
  readonly bbox: BoundingBox3D;
  readonly length: number;             // m
  readonly area: number;               // m² (length × height, minus openings — computed)
  readonly volume: number;             // m³
}

export interface WallEntity extends BimEntity<WallKind, WallParams, WallGeometry> {
  type: 'wall';
  hostedOpeningIds?: string[];         // back-reference για render + QTO subtraction
}
```

**Σχόλιο μετάβασης genarc → Nestor**: μονάδες αλλάζουν από **m (genarc)** σε **mm (Nestor — ίδιο με stair ADR-358 §5.0)**. Formatter SSoT `formatBimLength(mm, unit)` ίδια λογική με stair (display cm default, storage mm).

### 5.4 Opening — Type Schema

```typescript
// src/subapps/dxf-viewer/bim/types/opening-types.ts
export type OpeningKind =
  | 'door'
  | 'window'
  | 'sliding-door'
  | 'french-door'
  | 'fixed';                           // σταθερό άνοιγμα (π.χ. τζάμι)

export interface OpeningParams {
  readonly kind: OpeningKind;
  readonly wallId: string;             // foreign key — host wall (required)
  readonly offsetFromStart: number;    // mm κατά μήκος host wall
  readonly width: number;              // mm (default 900 door, 1200 window)
  readonly height: number;             // mm (default 2100 door, 1400 window)
  readonly sillHeight: number;         // mm (0 για door, 900 για window)
  readonly frameWidth?: number;        // mm κάσα
  readonly handing?: 'left' | 'right'; // door swing direction
  readonly openDirection?: 'inward' | 'outward';
  readonly material?: string;          // material library ID
  readonly glazingPanes?: 1 | 2 | 3;   // double/triple glass για window
}

export interface OpeningGeometry {
  readonly position: Point3D;          // world position (computed από host wall + offset)
  readonly rotation: number;           // matches host wall direction
  readonly outline: Polygon3D;
  readonly hingeArc?: Polyline3D;      // για door swing indicator
  readonly bbox: BoundingBox3D;
  readonly area: number;               // m² (για BOQ — κούφωμα τεμ + frame perimeter)
  readonly perimeter: number;          // m για frame
}

export interface OpeningEntity extends BimEntity<OpeningKind, OpeningParams, OpeningGeometry> {
  type: 'opening';
}
```

**Σχέση Wall ↔ Opening**: μονόδρομη foreign key (`opening.params.wallId → wall.id`). Όταν διαγραφεί wall → orphan openings: prompt χρήστη "Διαγραφή και των N κουφωμάτων;" (industry pattern, no auto-cascade).

### 5.5 Slab — Type Schema

```typescript
// src/subapps/dxf-viewer/bim/types/slab-types.ts
export type SlabKind = 'floor' | 'ceiling' | 'roof' | 'ground' | 'foundation';

export interface SlabParams {
  readonly kind: SlabKind;
  readonly outline: Polygon3D;         // closed polygon (CCW). Rectilinear OR free
  readonly elevation: number;          // mm (z από project origin)
  readonly thickness: number;          // mm (default 200)
  readonly slabOpeningIds?: string[];  // διανοίξεις (lift shaft, stair well) — Phase 3.5
  readonly material?: string;
  readonly reinforcement?: 'one-way' | 'two-way' | 'waffle' | 'flat'; // structural hint
}

export interface SlabGeometry {
  readonly polygon: Polygon3D;
  readonly bbox: BoundingBox3D;
  readonly area: number;               // m² (gross, minus slabOpenings = net)
  readonly netArea: number;            // m² (μετά τις διανοίξεις)
  readonly volume: number;             // m³ (netArea × thickness)
  readonly perimeter: number;          // m
}

export interface SlabEntity extends BimEntity<SlabKind, SlabParams, SlabGeometry> {
  type: 'slab';
}
```

### 5.6 Column — Type Schema

```typescript
// src/subapps/dxf-viewer/bim/types/column-types.ts
export type ColumnKind = 'rectangular' | 'circular' | 'L-shape' | 'T-shape';

export type ColumnAnchor = 'center' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w';

export interface ColumnParams {
  readonly kind: ColumnKind;
  readonly position: Point3D;
  readonly anchor: ColumnAnchor;       // ποιο σημείο του διατομής είναι στο position
  readonly width: number;              // mm (διάμετρος αν circular)
  readonly depth: number;              // mm (αγνοείται αν circular)
  readonly height: number;              // mm (default 3000)
  readonly rotation: number;            // deg (αγνοείται αν circular)
  readonly material?: string;
  readonly LshapeParams?: { armLength: number; armWidth: number };
  readonly TshapeParams?: { flangeLength: number; webThickness: number };
}

export interface ColumnGeometry {
  readonly footprint: Polygon3D;       // διατομή (cross-section)
  readonly bbox: BoundingBox3D;
  readonly area: number;               // m² (footprint area)
  readonly volume: number;             // m³ (area × height)
  readonly height: number;              // mm
}

export interface ColumnEntity extends BimEntity<ColumnKind, ColumnParams, ColumnGeometry> {
  type: 'column';
}
```

### 5.7 Beam — Type Schema

```typescript
// src/subapps/dxf-viewer/bim/types/beam-types.ts
export type BeamKind = 'straight' | 'curved' | 'cantilever';

export interface BeamParams {
  readonly kind: BeamKind;
  readonly start: Point3D;
  readonly end: Point3D;
  readonly width: number;              // mm (default 250)
  readonly height: number;             // mm (default 500)
  readonly elevation: number;          // mm (z του bottom-of-beam)
  readonly material?: string;
  readonly curveControl?: Point3D;     // για curved
}

export interface BeamGeometry {
  readonly axisPolyline: Polyline3D;
  readonly bbox: BoundingBox3D;
  readonly length: number;             // m (3D length)
  readonly crossSectionArea: number;   // m² (width × height)
  readonly volume: number;             // m³
}

export interface BeamEntity extends BimEntity<BeamKind, BeamParams, BeamGeometry> {
  type: 'beam';
}
```

### 5.8 Φάκελος δομής — `bim/`

```
src/subapps/dxf-viewer/bim/
├── types/
│   ├── bim-base.ts                    # BimEntity<T>, BimValidation, BimQuantityTakeoff, SoftLock
│   ├── wall-types.ts
│   ├── wall-dna-types.ts
│   ├── opening-types.ts
│   ├── slab-types.ts
│   ├── column-types.ts
│   └── beam-types.ts
├── geometry/
│   ├── wall-geometry.ts               # port από genarc/engines/bom/wallGeometry.ts
│   ├── opening-geometry.ts            # boolean subtract from host wall
│   ├── slab-geometry.ts               # polygon area/perimeter
│   ├── column-geometry.ts             # footprint
│   ├── beam-geometry.ts
│   └── shared/
│       ├── polygon-utils.ts           # area, centroid, perimeter
│       └── boolean-ops.ts             # για opening cutout στο wall outline
├── tools/
│   ├── wall-tool.ts                   # WallTool drawing logic
│   ├── opening-tool.ts                # OpeningTool — host-wall snap
│   ├── slab-tool.ts                   # SlabTool — polygon drawing
│   ├── column-tool.ts                 # ColumnTool — anchor-aware placement
│   └── beam-tool.ts
├── renderers/
│   ├── wall-renderer.ts               # leaf — ADR-040 compliant
│   ├── opening-renderer.ts
│   ├── slab-renderer.ts
│   ├── column-renderer.ts
│   └── beam-renderer.ts
├── services/
│   ├── BimEntityService.ts            # CRUD per element type, dispatch
│   ├── WallDnaService.ts              # layer composition, defaults
│   ├── MaterialLibraryService.ts      # Phase 6+
│   └── BimToBoqBridge.ts              # auto-feed BOQ (ADR-175)
├── validators/
│   ├── wall-validator.ts              # height/thickness limits, ΝΟΚ
│   ├── opening-validator.ts           # offset within wall, height ≤ wall height
│   ├── slab-validator.ts
│   ├── column-validator.ts
│   └── beam-validator.ts
├── grips/
│   ├── wall-grips.ts
│   ├── opening-grips.ts
│   ├── slab-grips.ts
│   ├── column-grips.ts
│   └── beam-grips.ts
├── presets/
│   ├── wall-dna-presets.ts            # port createDefaultExterior/Interior/Partition
│   └── element-presets.ts             # column 30×30, beam 25×50, etc.
└── index.ts                            # public exports
```

**Σημείωση**: φάκελος `bim/` (όχι `parametric/` ή `building/`) γιατί είναι ο σύντομος, διεθνής όρος, και διαχωρίζει καθαρά από `types/entities.ts` (DXF-level entities).

### 5.9 Tool Pipeline — Mode "BIM Drawing on DXF Underlay" (Revit-style, Q1 ✅)

```
DXF αρχείο φορτώνει → DxfCanvas (z-index 10) renders DXF entities ως read-only underlay
    ▼
Χρήστης κάνει click στο ribbon "Δομικά" → "Τοίχος"
    ▼
BimTypePickerDialog<'wall'> opens (modal, centered):
  Tabs: εξωτερικός (25cm) | εσωτερικός (10cm) | διαχωριστικός (10cm) | parapet | fence
  Κάθε type: preview εικόνα/icon + DNA layer composition preview + thickness
  Last-used preset προ-επιλεγμένο (localStorage `bim:wall.lastPresetId`)
  Optional: "Επεξεργασία τύπου…" button → ανοίγει WallDna editor (advanced)
  Footer: [Άκυρο] [Σχεδίαση →]
    ▼
[Σχεδίαση] → ToolStateStore.setTool('wall') + setActivePreset(presetId)
[Άκυρο / ESC] → επιστροφή σε 'select', no tool active
    ▼
ContextualPanel "Τοίχος" mounts στο ribbon (sticky, read-only-ish):
  - Ενεργός τύπος: "Εξωτερικός 25cm" + κουμπί "Αλλαγή τύπου…" (re-opens picker)
  - Ύψος: 3000 mm (editable inline για το current session)
  - Πάχος: computed από DNA (display only)
    ▼
DrawingStateMachine: IDLE → TOOL_READY
    ▼
[Click 1] start point (snap σε DXF underlay endpoint/intersection/midpoint)
[Mouse move] PreviewCanvas renders rubber-band τοίχου με preview thickness από επιλεγμένο type
[Click 2] end point — OR Dynamic Input για explicit length/angle
    ▼
completeEntity(WallEntity) [με params κληρονομημένα από preset]
  → CreateEntityCommand → CommandHistory (undo/redo)
  → BimEntityService.persistWall(entity)  → Firestore floorplan_walls/{wallId}
  → EntityAuditService.recordChange(...)
  → BimToBoqBridge.upsertBoqItem(...)     → BOQ ADR-175 auto-feed
    ▼
Tool παραμένει active με ΙΔΙΟ preset (continuous mode — batch drawing 5 εξωτερικών)
ESC → 'select'. Αλλαγή τύπου mid-session → "Αλλαγή τύπου…" button → picker
```

**Pattern επέκτασης** (ίδιο dialog flow):
- **Opening**: `BimTypePickerDialog<'opening'>` με tabs door/window/sliding-door/french-door/fixed. Μετά την επιλογή → click 1 ΠΡΕΠΕΙ να είναι πάνω σε υφιστάμενο wall (snap-to-host).
- **Slab**: `BimTypePickerDialog<'slab'>` με tabs floor/ceiling/roof/ground/foundation. Μετά → n clicks → polygon, ENTER για close.
- **Column**: `BimTypePickerDialog<'column'>` με tabs rectangular/circular/L-shape/T-shape + size presets (25×25, 30×30, 40×40, Ø30, Ø40). Μετά → 1 click με anchor preview.
- **Beam**: `BimTypePickerDialog<'beam'>` με tabs straight/curved/cantilever + section presets (25×50, 30×60). Μετά → 2 clicks.

### 5.9.1 BimTypePickerDialog — SSoT abstraction

```typescript
// src/subapps/dxf-viewer/bim/ui/BimTypePickerDialog.tsx
interface BimTypePickerDialogProps<TKind extends BimElementKind> {
  elementType: 'wall' | 'opening' | 'slab' | 'column' | 'beam';
  presets: BimPreset<TKind>[];           // From bim_presets collection
  lastUsedPresetId?: string;             // From localStorage
  onConfirm: (preset: BimPreset<TKind>) => void;
  onCancel: () => void;
}

interface BimPreset<TKind> {
  id: string;                            // bpst_<UUID>
  scope: 'system' | 'company' | 'project' | 'user';
  elementType: BimElementType;
  kind: TKind;
  label: string;                         // "Εξωτερικός 25cm"
  description?: string;
  defaultParams: Partial<BimParams<TKind>>;
  icon?: string;
  thumbnail?: string;
  builtin: boolean;                      // system-seeded = non-deletable
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Firestore: `bim_presets/{presetId}`** με composite `(companyId, elementType, scope)`. System-scope presets seeded κατά Phase 0.

**Seed system presets** (Phase 0):
- 5 walls: exterior-25cm, interior-10cm, partition-10cm, parapet-15cm, fence-stone-50cm
- 5 openings: door-standard (90×210), door-entry (100×220), window-standard (120×140 sill 90), sliding-door (180×220), fixed-glass (200×220)
- 5 slabs: floor-rc-20cm, ceiling-rc-20cm, roof-rc-25cm, ground-rc-15cm, foundation-rc-50cm
- 6 columns: rect-25×25, rect-30×30, rect-40×40, circular-Ø30, circular-Ø40, L-shape-30×60
- 4 beams: rect-25×50, rect-30×60, rect-25×40, cantilever-30×50

### 5.10 Firestore Schema

**Pattern: top-level collections με tenant isolation μέσω `companyId` field** — ίδιο pattern με ADR-358 stair (§G6, Phase 8 switch 2026-05-17).

```typescript
// src/config/firestore-collections.ts (extend)
export const COLLECTIONS = {
  // ... υφιστάμενα
  FLOORPLAN_STAIRS: process.env.NEXT_PUBLIC_FLOORPLAN_STAIRS_COLLECTION || 'floorplan_stairs', // ήδη
  // ADR-363 BIM:
  FLOORPLAN_WALLS: process.env.NEXT_PUBLIC_FLOORPLAN_WALLS_COLLECTION || 'floorplan_walls',
  FLOORPLAN_OPENINGS: process.env.NEXT_PUBLIC_FLOORPLAN_OPENINGS_COLLECTION || 'floorplan_openings',
  FLOORPLAN_SLABS: process.env.NEXT_PUBLIC_FLOORPLAN_SLABS_COLLECTION || 'floorplan_slabs',
  FLOORPLAN_COLUMNS: process.env.NEXT_PUBLIC_FLOORPLAN_COLUMNS_COLLECTION || 'floorplan_columns',
  FLOORPLAN_BEAMS: process.env.NEXT_PUBLIC_FLOORPLAN_BEAMS_COLLECTION || 'floorplan_beams',
  FLOORPLAN_SLAB_OPENINGS: process.env.NEXT_PUBLIC_FLOORPLAN_SLAB_OPENINGS_COLLECTION || 'floorplan_slab_openings', // Q3
  // Phase 6+ material library:
  BIM_MATERIALS: process.env.NEXT_PUBLIC_BIM_MATERIALS_COLLECTION || 'bim_materials',
} as const;
```

**Doc shape (e.g., `floorplan_walls/{wallId}`):**
```typescript
{
  id: string,                          // wall_<UUID-v4>
  companyId: string,                   // tenant isolation
  projectId: string,
  buildingId: string,
  floorplanId: string,                 // floorplan = DXF dwg context
  floorId: string,                     // building floor
  layerId: string,                     // DXF layer
  kind: WallKind,
  params: WallParams,                  // user-editable
  geometry: WallGeometry,              // computed cache (re-derivable)
  validation: BimValidation,
  qto: BimQuantityTakeoff,             // για BOQ feed
  hostedOpeningIds: string[],          // back-reference
  editingBy?: SoftLock,                // display-only ADR-358 G24
  createdAt: Timestamp,
  updatedAt: Timestamp,
  createdBy: string,
  updatedBy: string,
}
```

**Composite indexes** (per element type, mirror ADR-358 stair):
- `(companyId, projectId, floorplanId)` — primary subscription
- `(projectId, floorId, updatedAt)` — floor-scoped query
- `(projectId, validation.hasCodeViolations, updatedAt)` — code-violation dashboard

**Firestore rules** (`firestore.rules`):
- Default deny, read+write only `request.auth.token.companyId == resource.data.companyId`
- Server-only writes σε `geometry.computedAt` και `qto.computedAt` (επιβεβαίωση Phase 6)

### 5.11 Enterprise IDs — επέκταση `enterprise-id-prefixes.ts`

```typescript
// src/services/enterprise-id-prefixes.ts (extend)
export const ENTERPRISE_ID_PREFIXES = {
  // ... υφιστάμενα
  STAIR: 'stair',                      // ADR-358 (ήδη)
  // ADR-363 BIM:
  WALL: 'wall',
  OPENING: 'opening',
  SLAB: 'slab',
  COLUMN: 'col',
  BEAM: 'beam',
  SLAB_OPENING: 'slbopn',              // Q3
  BIM_MATERIAL: 'bmat',
} as const;
```

Convenience helpers στο `enterprise-id-convenience.ts`: `generateWallId()`, `generateOpeningId()`, etc.

### 5.12 BOQ Integration — `BimToBoqBridge`

Ο πυρήνας της σύνδεσης με ADR-175. Ένα service που ακούει BIM entity writes και upserts BOQ items.

```typescript
// src/subapps/dxf-viewer/bim/services/BimToBoqBridge.ts
export class BimToBoqBridge {
  /**
   * Καλείται μετά από successful BIM entity persistence.
   * Upserts (deterministic key) ένα BOQ item ANTOÉ-κατηγοριοποιημένο.
   */
  async upsertBoqItem(entity: BimEntity, buildingId: string): Promise<void> {
    const mapping = BIM_TO_ATOE_MAPPING[entity.type][entity.kind];
    const boqItem = {
      id: `boq_bim_${entity.id}`,      // deterministic — αν ξανα-saved entity, ίδιο boq
      buildingId,
      sourceType: 'bim-auto',
      sourceEntityId: entity.id,
      atoeCategory: mapping.atoe,      // π.χ. 'ΟΙΚ-3' για τοίχοι (τοιχοποιίες)
      atoeArticle: mapping.article,    // optional, π.χ. ΟΙΚ-3.01
      description: mapping.description,
      scope: 'building',
      estimatedQuantity: entity.qto.primaryQuantity,
      unit: entity.qto.primaryUnit,
      // Τιμή κληρονομείται από Master/Project price list (ADR-175 §4.1.3)
    };
    await boqService.upsertItem(boqItem);
  }

  /**
   * Διαγραφή BOQ item αν διαγραφεί BIM entity.
   */
  async removeOnEntityDelete(entityId: string): Promise<void> {
    await boqService.deleteItem(`boq_bim_${entityId}`);
  }
}
```

**Mapping table** (`BIM_TO_ATOE_MAPPING`):

| BIM type.kind | ΑΤΟΕ category | Παράδειγμα ΑΤΟΕ article | Unit |
|---|---|---|---|
| `wall.straight` (exterior) | ΟΙΚ-3 (Τοιχοποιίες) | ΟΙΚ-3.01 (μπατική) | m² |
| `wall.straight` (interior) | ΟΙΚ-3 | ΟΙΚ-3.02 (δρομική) | m² |
| `wall.straight` (partition) | ΟΙΚ-3 | ΟΙΚ-3.03 (διαχωριστικό) | m² |
| `opening.door` | ΟΙΚ-6 (Κουφώματα) | ΟΙΚ-6.01 (πόρτα ξύλινη) | τεμ |
| `opening.window` | ΟΙΚ-6 | ΟΙΚ-6.10 (παράθυρο αλουμινίου) | τεμ |
| `slab.floor`/`slab.roof` | ΟΙΚ-2 (Σκυροδέματα) | ΟΙΚ-2.05 (πλάκα οπλισμένη) | m³ |
| `slab.foundation` | ΟΙΚ-2 | ΟΙΚ-2.01 (θεμέλιο) | m³ |
| `column.*` | ΟΙΚ-2 | ΟΙΚ-2.03 (κολώνα) | m³ |
| `beam.*` | ΟΙΚ-2 | ΟΙΚ-2.04 (δοκός) | m³ |
| `stair.*` (ADR-358) | ΟΙΚ-12 (Μεταλλικά/ειδικές κατασκευές) ή ΟΙΚ-2 (αν RC) | ΟΙΚ-2.08 / ΟΙΚ-12.05 | τεμ ή m |

**Deterministic ID** `boq_bim_<entityId>` ώστε re-save BIM entity → idempotent BOQ update.

**Σημείωση layered DNA quantities**: για τοίχους με DNA, το `qto.primaryQuantity` είναι το συνολικό m² τοιχοποιίας. Σε Phase 6+ προστίθενται sub-items per layer (π.χ. εξωτερικός σοβάς m² → ΟΙΚ-4.01, εσωτερικός σοβάς m² → ΟΙΚ-4.02). Phase 1-5 → 1 BOQ item per wall.

### 5.13 Validators — επέκταση `building-code/`

Νέα validators στο `src/services/building-code/engines/`:
- `gate-wall-checker.ts` — ΝΟΚ ελάχιστο πάχος εξωτερικού τοίχου, max ύψος ορόφου
- `gate-opening-checker.ts` — μέγιστο πλάτος ανοίγματος ανά τοίχο, ελάχιστο διάστημα μεταξύ ανοιγμάτων
- `gate-slab-checker.ts` — ελάχιστο πάχος (15cm), max free span warning
- `gate-column-checker.ts` — ελάχιστη διατομή (25×25cm κατά Eurocode)
- `gate-beam-checker.ts` — λυγηρότητα, max span/depth ratio

**Pattern**: ίδιο με `gate-stair-checker.ts` (ADR-358 §G4). Input: `params`. Output: `ValidationResult[]` με `level: 'hard-error' | 'warning' | 'ok'` + `messageKey` i18n.

### 5.14 Ribbon — νέο tab/panel

**Επιλογή**: νέο **panel "Δομικά"** στο υφιστάμενο `HOME_DRAW_PANEL` (μετά από Stair). Όχι νέο tab BIM — διατηρεί single-tab workflow και δεν διασπά το ribbon.

```typescript
// src/subapps/dxf-viewer/ui/ribbon/data/home-tab-bim.ts (νέο)
export const HOME_BIM_PANEL: RibbonPanelDef = {
  id: 'bim',
  labelKey: 'ribbon.panels.bim',       // "Δομικά"
  rows: [
    {
      isInFlyout: false,
      buttons: [
        { type: 'simple', size: 'large',
          command: { id: 'bim.wall', labelKey: 'ribbon.commands.bim.wall',
                     icon: 'wall', commandKey: 'wall', shortcut: 'W' } },
        { type: 'split', size: 'large',
          command: { id: 'bim.opening', labelKey: 'ribbon.commands.bim.opening',
                     icon: 'opening-door', commandKey: 'opening' },
          variants: [
            { id: 'opening.door', labelKey: 'ribbon.commands.bim.openingVariants.door',
              icon: 'opening-door', commandKey: 'opening', metadata: { kind: 'door' } },
            { id: 'opening.window', labelKey: 'ribbon.commands.bim.openingVariants.window',
              icon: 'opening-window', commandKey: 'opening', metadata: { kind: 'window' } },
            { id: 'opening.sliding-door', labelKey: 'ribbon.commands.bim.openingVariants.slidingDoor',
              icon: 'opening-sliding', commandKey: 'opening', metadata: { kind: 'sliding-door' } },
            // ...
          ],
        },
        { type: 'simple', size: 'large',
          command: { id: 'bim.slab', labelKey: 'ribbon.commands.bim.slab',
                     icon: 'slab', commandKey: 'slab' } },
        { type: 'simple', size: 'large',
          command: { id: 'bim.column', labelKey: 'ribbon.commands.bim.column',
                     icon: 'column', commandKey: 'column' } },
        { type: 'simple', size: 'large',
          command: { id: 'bim.beam', labelKey: 'ribbon.commands.bim.beam',
                     icon: 'beam', commandKey: 'beam' } },
        // 'bim.stair' ήδη υπάρχει από ADR-358 — αν δεν έχει merged ακόμα,
        // μπαίνει εδώ ως simple button "Σκάλα".
      ],
    },
  ],
};
```

Νέα icons χρειάζονται: `wall`, `opening-door`, `opening-window`, `opening-sliding`, `slab`, `column`, `beam`. (lucide-react ή custom SVG, στο `components/icons/`).

### 5.15 i18n namespaces

| Namespace | Locales |
|---|---|
| `tools.bim.wall.*` | `el/tool-hints.json` + `en/tool-hints.json` |
| `tools.bim.opening.*` | ίδιο |
| `tools.bim.slab.*` | ίδιο |
| `tools.bim.column.*` | ίδιο |
| `tools.bim.beam.*` | ίδιο |
| `ribbon.commands.bim.*` | `el/ribbon.json` + `en/ribbon.json` |
| `ribbon.panels.bim` | "Δομικά" / "Building Elements" |
| `bim.wall.dna.layers.*` | `el/dxf-viewer.json` (νέο subkey `bim`) |
| `bim.materials.*` | Phase 6+ |
| `bim.validation.*` | violation messages |

### 5.16 ADR-040 Micro-Leaf Compliance

**Cardinal**: τα νέα BIM renderers θα είναι **μικρά leaf components** στο `canvas-layer-stack-leaves.tsx`, **ένα ανά element type** (`WallLeaf`, `OpeningLeaf`, `SlabLeaf`, etc.). Καθένα:
- Subscribes ΜΟΝΟ στο δικό του store slice (Wall store, Opening store, ...)
- Δεν αγγίζει high-freq stores (hover/cursor)
- Δεν προσθέτει `hoveredEntityId` / `selectedEntityIds` στο bitmap cache key
- Render synchronously, ≤16ms per frame

**Pre-commit hook CHECK 6B/6C** ήδη ελέγχει αυτές τις rules. Νέοι BIM renderers MUST stage μαζί ADR-040 changelog entry.

### 5.17 EntityAudit Integration (ADR-195)

Κάθε create/update/delete BIM entity → `EntityAuditService.recordChange()`:
```typescript
await entityAuditService.recordChange({
  entityType: 'wall',                  // ή 'opening', 'slab', ...
  entityId: wall.id,
  changeType: 'created' | 'updated' | 'deleted',
  before: oldParams,
  after: newParams,
  context: { projectId, buildingId, floorplanId, floorId },
});
```

**Pre-commit CHECK 3.17** baseline=0 από 2026-04-13 — όλα τα νέα writers πρέπει να καλούν `recordChange` αμέσως. Hard gate.

### 5.18 SSoT Registry — νέα modules

Στο `.ssot-registry.json` (per ADR-294 + ADR-314):
```json
{
  "modules": {
    "bim-entities": {
      "ssotFile": "src/subapps/dxf-viewer/bim/types/bim-base.ts",
      "description": "BIM entity types — Wall/Opening/Slab/Column/Beam must be defined via BimEntity<T> and registered in EntityType union",
      "forbiddenPatterns": [
        "type:\\s*['\"](wall|opening|slab|column|beam)['\"]\\s*;\\s*(?!.*BimEntity)"
      ],
      "allowlist": ["src/subapps/dxf-viewer/bim/", "src/subapps/dxf-viewer/types/entities.ts"]
    },
    "bim-id-prefix": {
      "ssotFile": "src/services/enterprise-id-prefixes.ts",
      "description": "BIM entity IDs MUST use generateXxxId() helpers — no inline ID generation",
      "forbiddenPatterns": [
        "`wall-\\$\\{",
        "`opening-\\$\\{",
        "`slab-\\$\\{",
        "`column-\\$\\{",
        "`beam-\\$\\{"
      ],
      "allowlist": ["src/services/enterprise-id-convenience.ts"]
    },
    "bim-to-boq-bridge": {
      "ssotFile": "src/subapps/dxf-viewer/bim/services/BimToBoqBridge.ts",
      "description": "BIM → BOQ feeding MUST go through BimToBoqBridge. No direct boq item upserts from BIM tools.",
      "forbiddenPatterns": [
        "boqService\\.(upsertItem|deleteItem|createItem).*sourceType.*bim"
      ],
      "allowlist": ["src/subapps/dxf-viewer/bim/services/BimToBoqBridge.ts"]
    }
  }
}
```

---

## 6. Implementation Phases

**Κάθε φάση = ένα vertical slice** (types → tool → renderer → grips → Firestore → audit → BOQ feed → tests → i18n → ADR changelog). Atomic, mergeable, releasable.

### Phase 0 — Bootstrap (1 session)

- [ ] Δημιουργία `src/subapps/dxf-viewer/bim/` skeleton με `index.ts` + empty subfolders.
- [ ] `bim/types/bim-base.ts` — `BimEntity<T>`, `BimValidation`, `BimQuantityTakeoff`, `SoftLock`.
- [ ] Extend `EntityType` union με 5 νέα strings.
- [ ] Extend `ENTERPRISE_ID_PREFIXES` με 5 νέα keys + convenience helpers.
- [ ] Extend `COLLECTIONS` με 5 νέα Firestore collection names.
- [ ] Composite indexes deploy: 5 × 3 = 15 indexes (per element type × `companyId+projectId+floorplanId` + `floorId+updatedAt` + `validation.hasCodeViolations+updatedAt`).
- [ ] Firestore rules: 5 νέες collection rules (default-deny + companyId match).
- [ ] i18n skeleton: `tools.bim.*` keys με empty values (να αποκτούν περιεχόμενο per phase).
- [ ] ADR-363 commit + Firestore indexes commit.

### Phase 1 — Wall (1-2 sessions)

- [ ] Port `wall-types.ts` + `wall-dna-types.ts` από genarc (mm conversion, Nestor naming).
- [ ] Port `wall-geometry.ts` (axis, edges, area, volume).
- [ ] `WallDnaService` με 3 default presets.
- [ ] `wall-tool.ts` — 2-click drawing με snap σε DXF underlay + νέα walls.
- [ ] `wall-renderer.ts` — leaf (ADR-040 compliant).
- [ ] `wall-grips.ts` — endpoint grips + thickness grip.
- [ ] `wall-validator.ts` — basic limits.
- [ ] Contextual ribbon panel "Τοίχος" (παράλληλο με ADR-345 pattern).
- [ ] Floating advanced panel "Σύνθεση Στρώσεων" (WallDna editor).
- [ ] Firestore CRUD (create/read/update/delete via `BimEntityService`).
- [ ] `EntityAuditService.recordChange()` integration.
- [ ] Hotkey: `W` (Wall).
- [ ] i18n complete `tools.bim.wall.*` (el + en).
- [ ] Unit tests (Vitest): wall geometry, DNA composition, validator (target ≥85% cov).
- [ ] ADR-363 changelog entry + ADR-175 reference (Phase 1 BIM → BOQ pending Phase 6).

### Phase 2 — Opening (1-2 sessions)

- [ ] Port `opening-types.ts` από genarc (5 kinds).
- [ ] `opening-geometry.ts` — host-wall relative positioning + boolean cutout.
- [ ] `opening-tool.ts` — click on wall → place opening με offset/width prompts.
- [ ] Wall renderer extension: render cutouts on hosted walls.
- [ ] Door swing arc indicator (`hingeArc` geometry).
- [ ] Window glazing indicator (single/double/triple line).
- [ ] Wall delete prompt "Διαγραφή και των N κουφωμάτων;".
- [ ] Move opening: drag along host wall (constrained to wall length).
- [ ] Wall split mid-opening: when wall axis updated, recompute opening positions.
- [ ] Contextual ribbon panel "Άνοιγμα" με kind selector.
- [ ] Validator: opening width ≤ wall length, opening height ≤ wall height, sill within wall.
- [ ] Hotkey: `O` (Opening) με variants `D`/`Wn` quick-shift.
- [ ] i18n complete.
- [ ] Unit tests.

### Phase 3 — Slab (1 session)

- [ ] Port `slab-types.ts` (4 kinds + foundation).
- [ ] `slab-tool.ts` — polygon drawing (multi-click + ENTER to close).
- [ ] Rectilinear constraint toggle (Shift key — 90° increments).
- [ ] `slab-renderer.ts` — fill + outline.
- [ ] `slab-grips.ts` — vertex grips για polygon edit.
- [ ] Slab openings (lift shaft, stair well) — separate type ή sub-property? **Open question §11.Q3**.
- [ ] Validator: closed polygon, min thickness 100mm, max free span warning (5m default).
- [ ] Hotkey: `SL`.
- [ ] i18n + tests.

### Phase 4 — Column (1 session)

- [ ] Port `column-types.ts` (rectangular + circular, anchor system).
- [ ] L-shape + T-shape (συνηθισμένα ΕΛ).
- [ ] `column-tool.ts` — single-click placement με anchor preview.
- [ ] Anchor cycling με keyboard (Tab).
- [ ] Rotation με dynamic input.
- [ ] `column-renderer.ts` — footprint με hatching.
- [ ] `column-grips.ts` — position + rotation + dimension grips.
- [ ] Validator: min 25×25cm (Eurocode), max slenderness.
- [ ] Hotkey: `CO`.
- [ ] i18n + tests.

### Phase 5 — Beam (1 session)

- [ ] Port `beam-types.ts`.
- [ ] `beam-tool.ts` — 2-click linear (όπως Wall).
- [ ] Curved beam variant (3-click με curve control).
- [ ] `beam-renderer.ts` — dashed line in plan view (industry convention για beam hidden above).
- [ ] `beam-grips.ts`.
- [ ] Validator: max span/depth ratio.
- [ ] Hotkey: `BM`.
- [ ] i18n + tests.

### Phase 6 — BOQ Auto-Feed (1-2 sessions)

- [ ] `BimToBoqBridge` service implementation.
- [ ] `BIM_TO_ATOE_MAPPING` config table.
- [ ] Hook into `BimEntityService.persist*` post-write triggers.
- [ ] Deterministic BOQ item ID `boq_bim_<entityId>`.
- [ ] Layer DNA breakdown sub-items (Phase 6.1) ή single item per wall (Phase 6.0) — **open question §11.Q4**.
- [ ] BOQ UI badge "Auto από BIM" σε items με `sourceType='bim-auto'`.
- [ ] Manual override allowed στο BOQ UI με flag "Detached from BIM".
- [ ] Integration tests: create wall → BOQ item εμφανίζεται με σωστή ΑΤΟΕ category και m².
- [ ] ADR-175 changelog entry.

### Phase 7 — Multi-Element Selection & Bulk Edit (1 session)

- [ ] Selection rubber-band ήδη ξέρει DXF entities — επέκταση για BIM entities.
- [ ] Multi-select panel: properties common-denominator (π.χ. 3 walls selected → height/material editable bulk).
- [ ] Mirror/rotate/copy semantics για BIM entities (matrix transforms preserve params).
- [ ] Group operations: move 5 walls + their hosted openings ως ένα unit.

### Phase 8 — Schedule Export (1 session)

- [ ] `BimScheduleExporter` — generate table per element type ή combined.
- [ ] Formats: CSV, Excel (xlsx), PDF (via existing print pipeline).
- [ ] Filterable schedule UI (per floor, per category).
- [ ] Sample: "Πίνακας Κουφωμάτων" — door schedule με id/width/height/sill/handing/material.

### Phase 9+ — Out of Scope (διατυπώνεται για documentation)

- 3D viewer (Three.js port από genarc) → ίσως `dxf-viewer-3d/` subapp.
- IFC export (IfcWall/IfcDoor/...).
- MEP entities (ducts/pipes/electrical).
- Real-time clash detection.
- Custom material library editor (Phase 6.5 ή ξεχωριστό ADR).
- AI assist για auto-detection walls από DXF underlay (genarc έχει `dxfPolygonScore` — port candidate).

---

## 7. Διασύνδεση με υπάρχοντα ADRs

| ADR | Πώς συνδέεται |
|---|---|
| **ADR-031** Command Pattern | `CreateBimEntityCommand`, `UpdateBimEntityCommand`, `DeleteBimEntityCommand` — undo/redo |
| **ADR-032** Drawing State Machine | Όλα τα BIM tools χρησιμοποιούν την υπάρχουσα FSM |
| **ADR-040** Preview Canvas Perf | Νέα BIM renderers ως micro-leaves (cardinal rule compliance) |
| **ADR-055** Tool State SSoT | 5 νέα entries στο `TOOL_DEFINITIONS` |
| **ADR-057** Entity Completion Pipeline | `completeEntity` extended per BIM type |
| **ADR-175** BOQ | Direct integration — `BimToBoqBridge` auto-feed |
| **ADR-186** Building Code Engine | 5 νέα gate-checkers |
| **ADR-195** Entity Audit Trail | Mandatory `recordChange` σε όλα τα writes |
| **ADR-294** SSoT Ratchet | 3 νέα registry modules (bim-entities, bim-id-prefix, bim-to-boq-bridge) |
| **ADR-326** Tenant Org | Όλα τα BIM docs έχουν `companyId` — tenant isolation |
| **ADR-340** Floorplan Background | DXF underlay layer ήδη υπάρχει — δεν αλλάζει |
| **ADR-345** Ribbon | Νέο panel + contextual tabs ανά BIM tool |
| **ADR-355** Firestore Subscribe SSoT | Όλες οι BIM subscriptions μέσω `firestoreQueryService.subscribe` |
| **ADR-358** Stair Tool | **Template αρχιτεκτονικό** — όλα τα BIM elements ακολουθούν τον ίδιο pattern. Όταν ADR-358 merged, ο stair πέφτει κάτω από `bim/types/stair-types.ts` (refactor) ή παραμένει αυτόνομος σε `systems/stairs/` (open question §11.Q5) |
| **ADR-361** Subscribe Equality Guard | Όλοι οι BIM subscribers MUST hash-compare snapshot |
| **ADR-362** Dimensions | Δεν τρέχουν παράλληλα — οι BIM entities δεν επηρεάζουν dimensions, μόνο γίνονται dimensionable targets |

---

## 8. Risks / Tradeoffs

| Risk | Mitigation |
|---|---|
| **Scope creep** — "let's add IFC export now" | Hard line: Phase 1-8 NO IFC, NO 3D. Documented out-of-scope §6 Phase 9+ |
| **Performance**: 100+ walls σε floorplan | ADR-040 micro-leaves + spatial index ήδη. Stress test Phase 5 με 500 entities |
| **BOQ false positives** — wall με wrong ΑΤΟΕ category | Mapping table editable per project (Phase 6.5). Manual override flag στο BOQ UI |
| **Genarc port drift** — αν αλλάξει genarc μετά το port | Port one-time, no live sync. Τα Nestor types γίνονται independent SSoT |
| **Multi-user conflicts** — 2 χρήστες edit same wall | Phase 1-8: soft-lock display-only (ADR-358 G24 pattern). CRDT Phase 9+ |
| **DXF underlay scaling mismatch** | DXF parser ήδη έχει unit detection — BIM tools διαβάζουν project units και convert |
| **Wall ↔ Opening referential integrity** | Foreign key validation στο Firestore rules: opening.wallId MUST exist OR opening soft-orphaned. Cron cleanup job (Phase 6.5) |
| **Layer composition complexity** για non-tech χρήστες | Default presets always visible. "Advanced DNA editor" hidden πίσω από button. Industry pattern (Revit Edit Type) |

---

## 9. Open Questions για Γιώργο

> **Σημείωση**: αυτές οι ερωτήσεις πρέπει να απαντηθούν **πριν** ξεκινήσει η Phase 0. Εμφανίζονται μία-μία στο επόμενο μήνυμα — όχι όλες μαζί (κανόνας `feedback_questions_simple_greek_examples`).

**Q1** ✅ **ΑΠΑΝΤΗΘΗΚΕ 2026-05-17**: **(α) Revit-style — πάχος ΠΡΙΝ**. Ribbon click "Τοίχος" → ανοίγει **Type Picker dialog** με κατηγορίες (εξωτερικός 25cm, εσωτερικός 10cm, διαχωριστικός 10cm, parapet, fence). Επιλέγει → τότε ενεργοποιείται το tool → 2 clicks σχεδίασης. Pattern επεκτείνεται σε όλα τα BIM elements (consistency): Opening Type Picker, Slab Type Picker, Column Type Picker, Beam Type Picker.

**Implementation impact**:
- Νέο component: `BimTypePickerDialog<TKind, TPreset>` (generic, SSoT — μία υλοποίηση για όλα τα BIM types)
- Νέα Firestore collection `bim_presets` (Phase 1+) — user/company/project-scoped catalog
- Default seeded presets ανά element type
- `LastUsedPresetMemory` per element type (localStorage) — auto-select τελευταίο χρησιμοποιημένο
- ESC στο dialog → cancel tool (επιστροφή σε 'select')
- §5.9 Tool Pipeline updated κατάλληλα

**Q2** ✅ **ΑΠΑΝΤΗΘΗΚΕ 2026-05-17**: **(β) Absolute mm από αριστερή γωνία** (primary input + storage). **% του τοίχου** εμφανίζεται **info-only** δίπλα στο mm value (δεν είναι editable). Pattern industry-aligned (AutoCAD Arch / ArchiCAD / Allplan default + ελληνικά σχέδια ζητούν απόλυτη μέτρηση).

**Implementation details**:
- `opening.params.offsetFromStart: number` σε **mm** (όπως ήδη §5.4)
- Tooltip preview: 2-line display (mm primary + % info-only)
- Mouse snap κάθε **50mm** (default snap increment για opening placement)
- Tab → focus typed input field για precision
- Shift+Tab → toggle "offset από δεξιά γωνία" (UX convenience, internal αποθηκεύεται πάντα από left)
- **Constraints**:
  - `min offset = frameWidth` (default 75mm) — δεν κολλάει στη γωνία
  - `max offset = wall.length − opening.width − frameWidth`
  - Out-of-bounds preview = red + tooltip "Δεν χωράει — μέγιστο XXXX mm"
- **Wall length change behavior**:
  - Default: opening μένει σταθερό σε mm (specs-preserving). Αν εκτός εύρους μετά από edit → opening marked orphan: red icon στο entity + warning στο BOQ panel "Άνοιγμα εκτός τοίχου"
  - Phase 6+ optional `anchorMode: 'absolute' | 'anchor-to-end'` flag στα opening params (out-of-scope Phase 2)

**Q3** ✅ **ΑΠΑΝΤΗΘΗΚΕ 2026-05-17**: **(α) Ξεχωριστή οντότητα `slabOpening`**. Reasons: industry pattern (Revit/ArchiCAD/Allplan all do this), multi-storey reuse (elevator shaft stacks across floors), BOQ separate items (ΟΙΚ-2.10 κατασκευή φρεατίου), independent audit trail, rich metadata (type/fireRating/reinforcement).

**Implementation details**:
- Νέο entity type στο `EntityType` union: `'slab-opening'`
- Νέο folder: `src/subapps/dxf-viewer/bim/types/slab-opening-types.ts`
- Νέα Firestore collection: `floorplan_slab_openings/{slabOpeningId}`
- Νέο Enterprise ID prefix: `SLAB_OPENING: 'slbopn'` → `generateSlabOpeningId()`
- Νέο BIM type picker preset group: 4 system presets (elevator-shaft 150×150, stair-well 250×300, duct 30×30, chimney 50×50)
- Hotkey: `SO` (SlabOpening)
- ΑΤΟΕ mapping: `slab-opening.elevator-shaft` → ΟΙΚ-2.10 (m linear depth) ή τεμ. `slab-opening.stair-well` → όμοιο ή subtraction-only (open Q post-Phase 3.5)
- Foreign key `slabOpening.params.slabId` (required). Διαγραφή slab → orphan warning, **όχι** cascade (ασφαλέστερο)
- Slab `geometry.netArea` = `geometry.area − Σ(slabOpenings[].area)` αυτόματα recomputed
- "Copy to all floors" workflow (Phase 3.5): επιλέγεις slabOpening → context menu "Στοίβαξη σε όλους τους ορόφους" → δημιουργεί N αντίγραφα ίδιο XY, διαφορετικό slabId/floorId. Optional `multiStoreyStackGroupId` για bulk-edit μαζί

**Q4** ✅ **ΑΠΑΝΤΗΘΗΚΕ 2026-05-17**: **(γ) Υβριδικό — Group με expand**. 1 parent BOQ item per wall (summary) + N child items per DNA layer (analytic). 5D BIM industry standard + ελληνική αγορά κατασκευής χρειάζεται διαχωρισμό ανά υπεργολάβο (σοβατζής/χτίστης/μονωτής) + σωστή ΑΤΟΕ κατηγοριοποίηση per layer.

**Implementation details**:
- BoqItem schema extension στο ADR-175:
  ```typescript
  interface BoqItem {
    // ... υφιστάμενα
    sourceType: 'manual' | 'bim-auto';
    sourceEntityId?: string;            // wall.id
    parentBoqItemId?: string;           // αν είναι child layer item
    layerIndex?: number;                // 0/1/2 για DNA layers
    layerSide?: 'exterior' | 'core' | 'interior';
    isGroupParent?: boolean;            // true για parent summary row
  }
  ```
- `BimToBoqBridge.upsertBoqItem(wall)` δημιουργεί **1 parent + N children** όπου N = `wall.params.dna.layers.length`
- Parent: `atoeCategory = null` (summary only, no direct cost), `description = "Τοίχος εξωτερικός 25cm"`, quantity = m² τοίχου
- Children: per layer με αντίστοιχη ΑΤΟΕ (layer.materialId → ΑΤΟΕ lookup table), ίδιο m²
- BOQ UI extension (ADR-175 §UI): collapsible group rows. Default view = collapsed (1 row per wall). Toggle "Αναλυτικό" → expand all
- Cost rollup: parent.totalCost = Σ(children[].totalCost). Master price list ισχύει per child (layer-level pricing)
- Wall edit (length change): όλα τα 4 items (1 parent + 3 children) update αυτόματα με νέο m²
- Wall delete: cascade delete και τα 4 items
- Wall χωρίς DNA (raw): 1 item only (no parent/child split)

**Phase deployment**:
- Phase 6.0 (Wall + Slab + Column + Beam + Opening): 1 item per entity (no DNA breakdown) — απλό MVP
- Phase 6.1 (DNA breakdown): activate layer children για walls/slabs/columns/beams που έχουν DNA composition. Default ON
- Phase 6.2 (Material → ΑΤΟΕ lookup table): centralized SSoT `material-to-atoe-mapping.ts` για auto-assignment ΑΤΟΕ category από materialId. User-editable per project

**Layer → ΑΤΟΕ mapping seed** (Phase 6.2):
| Layer materialId | ΑΤΟΕ category | Άρθρο |
|---|---|---|
| `mat-plaster-ext` (σοβάς εξωτ.) | ΟΙΚ-4 | ΟΙΚ-4.03 |
| `mat-plaster-int` (σοβάς εσωτ.) | ΟΙΚ-4 | ΟΙΚ-4.01 |
| `mat-concrete-c25` (φέρων μπετόν) | ΟΙΚ-2 | ΟΙΚ-2.03 (τοίχωμα) |
| `mat-brick-masonry` (οπτοπλινθοδομή) | ΟΙΚ-3 | ΟΙΚ-3.01 (μπατική) ή ΟΙΚ-3.02 (δρομική) |
| `mat-insulation-xps` (μόνωση) | ΟΙΚ-10 | ΟΙΚ-10.05 |
| `mat-waterproofing` | ΟΙΚ-10 | ΟΙΚ-10.10 |

**Q5**: Σκάλα (ADR-358) — αν δεν έχει ακόμη merged ο stair tool, θέλεις:
   - (α) ADR-358 stair να ΜΕΤΑΦΕΡΘΕΙ κάτω από `bim/types/stair-types.ts` ως ομογενοποίηση, ή
   - (β) Stair να μείνει στον δικό του `systems/stairs/` φάκελο και να είναι αυτόνομος, με BIM entities στο `bim/`;

**Q6**: Layer convention — τα νέα BIM entities θες να μπαίνουν αυτόματα σε auto-created layers:
   - π.χ. όταν σχεδιάζεις τοίχο, να δημιουργηθεί layer "Walls-Exterior" αυτόματα, ή
   - να μένουν στο current layer του χρήστη (όπως DXF entities);

**Q7**: Hotkeys — προτείνω `W` για τοίχο, `O` για άνοιγμα, `SL` για πλάκα, `CO` για κολώνα, `BM` για δοκό. Έχεις αντιπρόταση; (Conflict check: `W` δεν χρησιμοποιείται, `O` δεν χρησιμοποιείται, `SL` καθαρό, `CO` καθαρό, `BM` καθαρό.)

**Q8**: Material library — Phase 6+ θες προ-φορτωμένη ελληνική αγορά (Knauf, Hellas Tiles, AlumilΛ, etc.) ή empty-by-default που γεμίζει ο χρήστης ανά project;

---

## 10. Acceptance Criteria

Phase 1 (Wall) θεωρείται **complete** όταν:
1. Ο χρήστης φορτώνει DWG/DXF σχέδιο, πατάει `W`, κάνει 2 clicks πάνω σε υφιστάμενες γραμμές → εμφανίζεται τοίχος με preview thickness + auto-snap.
2. Ο τοίχος αποθηκεύεται στο Firestore `floorplan_walls/{wallId}` με `companyId` + `projectId` + `floorplanId`.
3. Undo/Redo λειτουργεί (Ctrl+Z / Ctrl+Y).
4. Ο τοίχος επανεμφανίζεται στο reload (subscribe ADR-355).
5. Property panel ανοίγει με click → επεξεργασία κατηγορίας/ύψους/DNA → updated στο Firestore.
6. EntityAudit records create + every update.
7. Layer toggle hides/shows wall (per DXF layer rules).
8. Multi-tab/multi-user: εκδότης Β βλέπει live update από εκδότη Α (Firestore onSnapshot).
9. Unit tests ≥85% coverage σε wall-geometry, wall-validator, BimEntityService.persistWall.
10. ADR-363 + ADR-040 staged μαζί στο commit (CHECK 6B compliance).

Παρόμοια criteria per Phase 2-5.

Phase 6 (BOQ Auto-Feed) θεωρείται **complete** όταν:
1. Create wall → BOQ item με `sourceType='bim-auto'` εμφανίζεται στο Building BOQ tab.
2. Edit wall (αλλάζει length) → BOQ item quantity updates αυτόματα.
3. Delete wall → BOQ item διαγράφεται.
4. Cost engine ADR-175 picks up το νέο item, εφαρμόζει τιμή από Master/Project price list → εμφανίζεται στο running total.
5. Integration test: 5 walls + 3 doors + 1 slab → BOQ έχει σωστά 9 items με σωστές ΑΤΟΕ categories και ποσότητες.

---

## 11. Compliance Check (CLAUDE.md rules)

- ✅ **N.0** Centralized systems: χρησιμοποιεί ADR-175 BOQ + ADR-186 Building Code + ADR-195 Audit + ADR-326 Tenant + ADR-355 Subscribe + ADR-040 Canvas Perf — δεν δημιουργεί παράλληλα συστήματα.
- ✅ **N.0.1** ADR-Driven: Phase 1 (Recognition) ολοκληρώθηκε με ανάγνωση υπάρχοντος κώδικα + ADRs. Phase 2 (Implementation) ξεκινάει μετά την έγκριση. Phase 3 (ADR Update) γίνεται per phase. Phase 4 (Commit) εκτελείται από τον Γιώργο.
- ✅ **N.2** No `any`: όλα typed με generics `BimEntity<T,P,G>`.
- ✅ **N.6** Enterprise IDs: 5 νέα prefixes + convenience generators.
- ✅ **N.7** Google-level checklist: §5 παρέχει proactive design, no race conditions (sequential `persist` → `audit` → `boq feed`), idempotent BOQ via deterministic IDs, belt-and-suspenders (validator + ΝΟΚ check), SSoT για mapping table.
- ✅ **N.7.1** File size: κάθε νέο file ≤500 lines. Schema files (types) εξαιρούνται.
- ✅ **N.8** Execution mode: orchestrator-grade (5+ files, multi-domain) — Γιώργος έδωσε explicit έγκριση πριν την υλοποίηση (αλλά για ΑΥΤΟ το ADR — single doc — Plan Mode αρκούσε).
- ✅ **N.11** No hardcoded i18n: όλα τα labels μέσω `t()` με keys σε locales JSON.
- ✅ **N.12** SSoT Ratchet: 3 νέα modules registered (§5.18). Baseline update μετά την Phase 0.
- ✅ **N.13** Pending ratchet status: ACTIVE (ADR-345 phases). Δεν επηρεάζει — διαφορετικό scope.
- ✅ **N.14** Model: Opus 4.7 (architectural ADR, cross-cutting) — επιβεβαιωμένο από Γιώργο.

**Google-level: PARTIAL** — εξαρτάται από τις απαντήσεις των §9 ερωτήσεων + actual implementation. Υπό προϋπόθεση καθαρών Q1-Q8 απαντήσεων, full Google-level εφικτό.

---

## 12. Changelog

| Ημ/νία | Αλλαγή | Author |
|---|---|---|
| 2026-05-17 | **Initial draft v1.0** — Full architecture, 8 phases, BOQ integration, port plan από genarc, §9 open questions για Γιώργο. Status: PROPOSED. | Claude Opus 4.7 |
| 2026-05-17 | **Q1 ANSWERED** — Revit-style Type Picker dialog before drawing. Added §5.9.1 BimTypePickerDialog SSoT + `bim_presets` Firestore collection + 25 system-seeded presets. Pattern επεκτείνεται consistent σε όλα 5 BIM types. | Claude Opus 4.7 |
| 2026-05-17 | **Q2 ANSWERED** — Absolute mm offset (primary) + % info-only display. Snap 50mm. Constraints: frameWidth min/max. Wall length change → opening stays absolute, orphan warning if out-of-bounds. | Claude Opus 4.7 |
| 2026-05-17 | **Q3 ANSWERED** — Separate `slab-opening` entity (NOT sub-property). Added 6th element type to EntityType union + Firestore collection `floorplan_slab_openings` + Enterprise ID prefix `SLAB_OPENING='slbopn'` + 4 system presets + "Copy to all floors" multi-storey stack workflow. Foreign key `slabId`, orphan warning on slab delete (no cascade). Slab `netArea` auto-recomputes. | Claude Opus 4.7 |
| 2026-05-17 | **Q4 ANSWERED** — Hybrid group+expand BOQ items per wall. 1 parent (summary) + N children (per DNA layer). BoqItem schema extended (parentBoqItemId, layerIndex, isGroupParent). Phase 6 split: 6.0 single-item MVP → 6.1 DNA breakdown → 6.2 material→ΑΤΟΕ centralized SSoT. Cost rollup parent = Σ(children). | Claude Opus 4.7 |
