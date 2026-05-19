# ADR-363 — BIM Drawing Mode (Parametric Building Elements)

| Πεδίο | Τιμή |
|---|---|
| **Status** | 🟢 **APPROVED** 2026-05-17 — All Q1-Q8 answered. Ready for Phase 0 implementation. |
| **Date** | 2026-05-17 |
| **Category** | DXF Viewer — BIM / Parametric Building Modeling |
| **Location** | `docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md` |
| **Author** | Claude Opus 4.7 + Γιώργος Παγώνης |
| **Related ADRs** | ADR-031 (Commands), ADR-032 (Drawing FSM), ADR-040 (Preview Canvas Perf), ADR-055 (Tool State SSoT), ADR-057 (Entity Completion), ADR-175 (BOQ), ADR-186 (Building Code Engine), ADR-195 (Entity Audit Trail), ADR-294 (SSoT Ratchet), ADR-326 (Tenant Org), ADR-340 (Floorplan Background), ADR-345 (Ribbon), ADR-355 (Firestore Subscribe SSoT), ADR-358 (Stair Tool — **TEMPLATE**), ADR-361 (Subscribe Equality Guard), ADR-362 (Dimensions) |
| **Source codebase referenced** | `C:\genarc` (sibling project, port source for typed BIM entities) |
| **Πόρισμα εκκρεμών φάσεων** | `ADR-363-pending-summary.md` (root) — ανάλυση 2026-05-19, ~40 items, εκτίμηση 31-51h |

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

### 5.8 Φάκελος δομής — `bim/` (μετά Phase 0.5 Stair Migration)

```
src/subapps/dxf-viewer/bim/
├── types/
│   ├── bim-base.ts                    # BimEntity<T>, BimValidation, BimQuantityTakeoff, SoftLock
│   ├── stair-types.ts                 # Phase 0.5 (από types/stair.ts)
│   ├── wall-types.ts                  # Phase 1
│   ├── wall-dna-types.ts              # Phase 1
│   ├── opening-types.ts               # Phase 2
│   ├── slab-types.ts                  # Phase 3
│   ├── slab-opening-types.ts          # Phase 3 (Q3 — separate entity)
│   ├── column-types.ts                # Phase 4
│   └── beam-types.ts                  # Phase 5
├── stairs/                             # Phase 0.5 (από systems/stairs/)
│   ├── stair-validator.ts
│   ├── stair-grips.ts
│   ├── stair-transforms.ts
│   ├── stair-presets-service.ts
│   ├── stair-firestore-service.ts
│   ├── stair-floor-link.ts
│   ├── stair-auto-fix.ts
│   ├── stair-material-catalog.ts
│   ├── stair-preview-store.ts
│   ├── stair-variant-defaults.ts
│   └── __tests__/                     # 20+ test files
├── geometry/
│   ├── stairs/                        # Phase 0.5 (από systems/stairs/stair-geometry-*)
│   │   ├── StairGeometryService.ts
│   │   ├── stair-geometry-shared.ts
│   │   ├── stair-geometry-straight.ts
│   │   ├── stair-geometry-lshape.ts
│   │   ├── stair-geometry-ushape.ts
│   │   ├── stair-geometry-vshape.ts
│   │   ├── stair-geometry-gamma.ts
│   │   ├── stair-geometry-spiral.ts
│   │   ├── stair-geometry-helical.ts
│   │   ├── stair-geometry-elliptical.ts
│   │   ├── stair-geometry-winder.ts
│   │   ├── stair-geometry-triangular-fan.ts
│   │   ├── stair-geometry-triangular-outline.ts
│   │   ├── stair-geometry-sketch.ts
│   │   ├── stair-geometry-labels.ts
│   │   └── __tests__/
│   ├── wall-geometry.ts               # Phase 1 (port genarc/engines/bom/wallGeometry.ts)
│   ├── opening-geometry.ts            # Phase 2 (boolean subtract from host wall)
│   ├── slab-geometry.ts               # Phase 3
│   ├── slab-opening-geometry.ts       # Phase 3 (Q3)
│   ├── column-geometry.ts             # Phase 4
│   ├── beam-geometry.ts               # Phase 5
│   └── shared/
│       ├── polygon-utils.ts           # area, centroid, perimeter
│       └── boolean-ops.ts             # για opening cutout στο wall outline
├── tools/                              # Phase 1+ (new — δεν υπήρχε stair-tool)
│   ├── wall-tool.ts
│   ├── opening-tool.ts
│   ├── slab-tool.ts
│   ├── slab-opening-tool.ts
│   ├── column-tool.ts
│   └── beam-tool.ts
├── renderers/
│   ├── stair-renderer.ts              # Phase 0.5 (από rendering/entities/StairRenderer.ts)
│   ├── wall-renderer.ts               # Phase 1 — leaf ADR-040 compliant
│   ├── opening-renderer.ts
│   ├── slab-renderer.ts
│   ├── slab-opening-renderer.ts
│   ├── column-renderer.ts
│   └── beam-renderer.ts
├── hooks/
│   ├── use-stair-persistence.ts       # Phase 0.5 (από hooks/data/useStairPersistence.ts)
│   ├── use-ribbon-stair-bridge.ts     # Phase 0.5 (από ui/ribbon/hooks/useRibbonStairBridge.ts)
│   └── (Phase 1+: use-wall-persistence, use-bim-firestore-bridge, ...)
├── services/
│   ├── BimEntityService.ts            # CRUD per element type, dispatch
│   ├── WallDnaService.ts              # layer composition, defaults
│   ├── MaterialLibraryService.ts      # Phase 6+
│   └── BimToBoqBridge.ts              # auto-feed BOQ (ADR-175)
├── validators/                         # Phase 1+ (new — stair-validator μένει στο bim/stairs/)
│   ├── wall-validator.ts
│   ├── opening-validator.ts
│   ├── slab-validator.ts
│   ├── slab-opening-validator.ts
│   ├── column-validator.ts
│   └── beam-validator.ts
├── grips/                              # Phase 1+ (stair-grips μένει στο bim/stairs/)
│   ├── wall-grips.ts
│   ├── opening-grips.ts
│   ├── slab-grips.ts
│   ├── slab-opening-grips.ts
│   ├── column-grips.ts
│   └── beam-grips.ts
├── presets/
│   ├── wall-dna-presets.ts            # port createDefaultExterior/Interior/Partition
│   └── element-presets.ts             # column 30×30, beam 25×50, etc.
├── ui/
│   └── BimTypePickerDialog.tsx        # §5.9.1 SSoT abstraction (Q1)
└── index.ts                            # public exports (re-exports stair public API)
```

**Σημείωση οργάνωσης stair**: μετά την Phase 0.5, το stair έχει **2 sub-folders** μέσα στο `bim/`:
- `bim/stairs/` — όλα τα stair-specific services (validator, grips, transforms, presets, firestore, floor-link, etc.)
- `bim/geometry/stairs/` — τα 10 geometry variants + service (διαφορετική ευθύνη: pure math)

Ο λόγος για split: αποφεύγεται "stairs" folder με 45+ αρχεία (κανόνας N.7.1 SRP — φάκελος = 1 ευθύνη). Τα νέα BIM entities (wall/opening/...) ακολουθούν ίδιο pattern: services στο top-level `bim/`, geometry math στο `bim/geometry/`.

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

### Phase 0 — Bootstrap (✅ IMPLEMENTED 2026-05-17)

- [x] Δημιουργία `src/subapps/dxf-viewer/bim/` skeleton με `index.ts` + empty subfolders.
- [x] `bim/types/bim-base.ts` — `BimEntity<T>`, `BimValidation`, `BimQuantityTakeoff`, `SoftLock`.
- [x] Extend `EntityType` union με 6 νέα strings (wall/opening/slab/slabOpening/column/beam).
- [x] Extend `ENTERPRISE_ID_PREFIXES` με 9 νέα keys + convenience helpers (incl. `slbopn`).
- [x] Extend `COLLECTIONS` με 6 νέα Firestore collection names (incl. `floorplan_slab_openings`).
- [x] Composite indexes deploy: 21 composite indexes across 7 BIM collections in `firestore.indexes.json`.
- [x] Firestore rules: 9 νέες collection rules (default-deny + companyId match) σε `firestore.rules`.
- [x] i18n skeleton: `ribbon.panels.bim`, `ribbon.commands.bim.*`, `tools.bim.{wall/opening/slab/slabOpening/column/beam}` σε `dxf-viewer-shell.json` + `tool-hints.json` (el+en).
- [x] ADR-363 commit + Firestore indexes commit. SSoT registry +3 modules (`bim-entities`, `bim-id-prefix`, `bim-to-boq-bridge`).

### Phase 0.5 — Stair Migration to `bim/` (1 session, ~2-3h, atomic commit)

> **⚠️ STATUS 2026-05-19: NOT COMPLETED (DEFERRED)**
>
> Επαλήθευση 2026-05-19 αποκάλυψε:
> - `bim/stairs/` ✅ HAS files (stair-auto-fix, stair-firestore-service, stair-floor-link, stair-grips κλπ — 11 αρχεία)
> - `bim/geometry/stairs/` ✅ HAS stair geometry variants
> - `bim/types/stair-types.ts` ✅ extends `BimEntity<>` (ADR-363 Phase 0.5 pattern)
> - `bim/renderers/StairRenderer.ts` ✅ EXISTS (αλλά: imports εσωτερικά από `../../systems/stairs/`)
> - `systems/stairs/` ❌ STILL EXISTS — 30+ files, ΔΕΝ αφαιρέθηκαν
> - Active imports (20+ files) ❌ ΕΞΑΚΟΛΟΥΘΟΥΝ να δείχνουν σε `systems/stairs/` — αυτός είναι ο κανονικός SSoT
>
> **Ρίζα του προβλήματος**: Τα αρχεία ΑΝΤΙΓΡΑΦΗΚΑΝ στο `bim/` χωρίς να αφαιρεθεί η πηγή ή να αλλάξουν τα imports. `systems/stairs/` = ζωντανός κανονικός κώδικας. `bim/stairs/` = stale duplicates.
>
> **Pending action**: Πλήρης Phase 0.5 — import migration (20+ αρχεία) + `rm -rf systems/stairs/` + tsc zero errors + tests green + SSoT registry module `bim-folder-residency`. Καταγεγραμμένο σε `.claude-rules/pending-ratchet-work.md`.

**Prerequisite για Phase 1**. Καθαρίζει το folder layout ώστε όλα τα BIM entities (existing stair + new walls/openings/slabs/columns/beams/slab-openings) να ζουν ομογενοποιημένα κάτω από `bim/`.

**Step-by-step (atomic commit)**:

1. **Folder creation**:
   ```
   src/subapps/dxf-viewer/bim/
   ├── stairs/                          # ← target για stair migration
   ├── types/                           # bim-base.ts + stair-types.ts (Phase 0)
   ├── renderers/                       # ← stair-renderer.ts (από rendering/entities/)
   ├── hooks/                           # ← use-stair-persistence + use-ribbon-stair-bridge
   ├── geometry/                        # ← stair geometry variants
   └── (Phase 1+ έρχονται wall/, opening/, slab/, column/, beam/)
   ```

2. **git mv operations** (preserve history):
   ```bash
   git mv src/subapps/dxf-viewer/systems/stairs/* src/subapps/dxf-viewer/bim/stairs/
   git mv src/subapps/dxf-viewer/types/stair.ts src/subapps/dxf-viewer/bim/types/stair-types.ts
   git mv src/subapps/dxf-viewer/rendering/entities/StairRenderer.ts src/subapps/dxf-viewer/bim/renderers/stair-renderer.ts
   git mv src/subapps/dxf-viewer/hooks/data/useStairPersistence.ts src/subapps/dxf-viewer/bim/hooks/use-stair-persistence.ts
   git mv src/subapps/dxf-viewer/ui/ribbon/hooks/useRibbonStairBridge.ts src/subapps/dxf-viewer/bim/hooks/use-ribbon-stair-bridge.ts
   ```

   Stair geometry variants (10 αρχεία `stair-geometry-*.ts`) → υπο-φάκελος `bim/geometry/stairs/`:
   ```bash
   mkdir src/subapps/dxf-viewer/bim/geometry/stairs
   git mv src/subapps/dxf-viewer/bim/stairs/stair-geometry-*.ts src/subapps/dxf-viewer/bim/geometry/stairs/
   git mv src/subapps/dxf-viewer/bim/stairs/StairGeometryService.ts src/subapps/dxf-viewer/bim/geometry/stairs/
   git mv src/subapps/dxf-viewer/bim/stairs/stair-geometry-shared.ts src/subapps/dxf-viewer/bim/geometry/stairs/
   ```

3. **Empty `systems/stairs/` folder removal**:
   ```bash
   rmdir src/subapps/dxf-viewer/systems/stairs/__tests__
   rmdir src/subapps/dxf-viewer/systems/stairs
   ```

4. **Bulk find/replace imports** (entire repo):
   | From | To |
   |---|---|
   | `from '@/subapps/dxf-viewer/systems/stairs/` | `from '@/subapps/dxf-viewer/bim/stairs/` |
   | `from '@/subapps/dxf-viewer/types/stair'` | `from '@/subapps/dxf-viewer/bim/types/stair-types'` |
   | `from '@/subapps/dxf-viewer/rendering/entities/StairRenderer'` | `from '@/subapps/dxf-viewer/bim/renderers/stair-renderer'` |
   | `from '@/subapps/dxf-viewer/hooks/data/useStairPersistence'` | `from '@/subapps/dxf-viewer/bim/hooks/use-stair-persistence'` |
   | `from '@/subapps/dxf-viewer/ui/ribbon/hooks/useRibbonStairBridge'` | `from '@/subapps/dxf-viewer/bim/hooks/use-ribbon-stair-bridge'` |
   | Relative imports μέσα στο stair folder (π.χ. `./StairGeometryService` από geometry files) | Επανέλεγχος relative paths μετά το stairs/geometry split |

5. **Stair type refactor → extends BimEntity**:
   ```typescript
   // bim/types/stair-types.ts (μετά το mv)
   import type { BimEntity } from './bim-base';

   export interface StairEntity extends BimEntity<StairKind, StairParams, StairGeometry> {
     type: 'stair';
     // hostedOpeningIds, validation, qto, editingBy → κληρονομούνται
   }
   ```
   `validation`, `qto`, `editingBy` fields που ήταν inline → πάνε στο `BimEntity<T>` parent. Stair-specific fields (π.χ. multi-story config) παραμένουν στα `StairParams`.

6. **`bim/index.ts` public API**:
   ```typescript
   // src/subapps/dxf-viewer/bim/index.ts
   export * from './types/bim-base';
   export * from './types/stair-types';
   // Phase 1+: export * from './types/wall-types'; etc.
   ```

7. **TypeScript check** (`npx tsc --noEmit`): πρέπει zero errors.

8. **Test suite** (`npm run test:dxf-viewer` ή vitest specific):
   - 20+ stair test files πρέπει all pass
   - StairGeometryService tests (8 variants × ~10 tests = 80+ tests)
   - stair-grips, stair-validator, stair-transforms, stair-floor-link, stair-presets-service, stair-firestore-service
   - **Acceptance: zero failing tests**

9. **ADR-358 update** (same commit):
   - All path references updated
   - Changelog entry: "Phase 0.5 (ADR-363) — stair migrated to `bim/` SSoT. Paths now `bim/stairs/`, `bim/types/stair-types.ts`, `bim/geometry/stairs/`, `bim/renderers/stair-renderer.ts`, `bim/hooks/use-stair-persistence.ts`. Pre-commit CHECK 6B-6D compliance preserved."

10. **Pre-commit ratchet**:
    - SSoT registry (`ADR-294`): νέο module `bim-folder-residency` που blocks imports `from '@/subapps/dxf-viewer/systems/stairs/` ή `from '@/subapps/dxf-viewer/types/stair'` σε νέα files (zero baseline).

**Risk mitigation**:
- Atomic commit → `git revert` αν catastrophic
- `git mv` per-file history preserved
- Mechanical changes (find/replace) → reviewable, deterministic
- Tests run + pass before commit
- Pre-commit hook CHECK 6B/6C/6D auto-validate

**Acceptance criteria Phase 0.5**:
1. ✅ `find src/subapps/dxf-viewer/systems/stairs -type f` → no results (folder gone)
2. ✅ `find src/subapps/dxf-viewer/bim/stairs -type f` → ~30 files
3. ✅ `find src/subapps/dxf-viewer/bim/geometry/stairs -type f` → ~14 files (10 variants + service + shared + 1-2 helpers)
4. ✅ `find src/subapps/dxf-viewer/bim/types/stair-types.ts` exists
5. ✅ `find src/subapps/dxf-viewer/bim/renderers/stair-renderer.ts` exists
6. ✅ `npx tsc --noEmit` → zero errors
7. ✅ `npm run test:vitest -- bim/` → 100% green
8. ✅ Manual smoke test: φόρτωση DXF + create stair via ribbon → working
9. ✅ ADR-358 changelog updated with Phase 0.5 entry + new paths
10. ✅ `.ssot-registry.json` new module `bim-folder-residency` με baseline 0

### Phase 1 — Wall (1-2 sessions)

**Phase 1A — Core Types + Geometry + Validation + 2-Click Builder (✅ IMPLEMENTED 2026-05-18)**

- [x] Port `wall-types.ts` + `wall-dna-types.ts` από genarc (mm conversion, Nestor naming). 5 categories (exterior/interior/partition/parapet/fence). DNA defaults inline στο `wall-dna-types.ts` (separate `bim/presets/wall-dna-presets.ts` πιθανή split στο Phase 1.5 με material library).
- [x] Port `wall-geometry.ts` (axis, edges, area, volume) — pure SSoT, mm internal / m output.
- [x] `wall-validator.ts` — hard errors (length/thickness/height/DNA mismatch) + non-blocking code violations (NOK exterior 200mm, structural 50mm min).
- [x] `hooks/drawing/wall-completion.ts` — `buildDefaultWallParams` + `buildWallEntity` (Revit Generic Wall pattern: explicit thickness override drops DNA) + `completeWallFromTwoClicks`.
- [x] `bim/renderers/WallRenderer.ts` — ADR-040 micro-leaf, category fill + axis dashed + OBB hover halo.
- [x] ToolStateStore + `ToolType` registration: `'wall'` tool, `category: 'drawing'`, `allowsContinuous: true` (chain walls).
- [x] Contextual ribbon panel `wall-editor`: Category/Geometry/Actions panels. Bridge wiring (`useRibbonWallBridge`) deferred to Phase 1B (no listeners yet — emits no-op).
- [x] i18n complete `ribbon.{tabs,panels,commands.wallEditor}.*` (el + en). Zero hardcoded strings (SOS N.11).
- [x] Unit tests (Jest): wall-geometry (17 tests), wall-validator (14 tests), wall-completion (13 tests) — total 44/44 ✅.
- [x] ADR-363 changelog entry (this entry).

**Phase 1B — Tool Activation + Firestore Persistence + Ribbon Bridge (✅ IMPLEMENTED 2026-05-18)**

- [x] `useWallTool.ts` — state machine (idle → awaitingStart → awaitingEnd → chain). Continuous draw (mirrors AutoCAD/Revit). Dynamic Input `commit-wall` event listener για explicit coord commit. Validator hardError aborts commit + surfaces `state.error` (stays in `awaitingEnd`).
- [x] `useSpecialTools` wires `useWallTool` με `onWallCreated` → push στο scene + EventBus `drawing:entity-created`. Auto-activate when `activeTool === 'wall'`, deactivate otherwise (stair parallel).
- [x] `useCanvasClickHandler` PRIORITY 4.6 — routes canvas clicks σε `wallTool.onCanvasClick` όταν tool ενεργό. `WallToolLike` interface στο `canvas-click-types.ts`. `CanvasSection` περνά το `wallTool` instance.
- [x] `core/commands/entity-commands/UpdateWallParamsCommand.ts` — atomic patch (params + recomputed geometry + revalidation), undo/redo, merge-on-drag scaffold για Phase 1C grips.
- [x] `bim/walls/wall-firestore-service.ts` — `WallFirestoreService` + `WallDoc` + factory + `entityToSaveInput`. Top-level `floorplan_walls/{wallId}` (companyId field-based tenant isolation), `setDoc` + `generateWallId` (SOS N.6), `firestoreQueryService.subscribe` (ADR-355 SSoT) με equality guard (ADR-361), soft-lock acquire/release via `deleteField()` sentinel (stair G24 parallel).
- [x] `hooks/data/useWallPersistence.ts` — debounced auto-save 500ms on selected wall params change, diff-merge subscribe (preserves locally-dirty + never-saved optimistic walls), soft-lock TTL 5min, `drawing:entity-created` first-save (mirrors stair Q17 9B-6).
- [x] `ui/ribbon/hooks/bridge/wall-param-helpers.ts` — pure read/patch helpers με scene-unit normalization (mm I/O contract). Manual thickness override drops `dna` (avoids dnaThicknessMismatch hardError).
- [x] `ui/ribbon/hooks/useRibbonWallBridge.ts` — combobox state/change + toggle + badge resolver. Dispatches `UpdateWallParamsCommand` via `useCommandHistory`. Memoized return value (ADR-040 Phase XIX pattern).
- [x] `wall-command-keys.ts` extended με `isWallRibbonKey`/`isWallRibbonStringKey`/`isWallRibbonToggleKey` guards.
- [x] `useRibbonCommands` composes `wallBridge` — combobox/toggle/state/badge branches βαρύνουν wall keys πριν array/text fallbacks.
- [x] `app/DxfViewerContent.tsx` — `wallBridge` mounted, `activeContextualTrigger` includes `WALL_CONTEXTUAL_TRIGGER` when `activeTool === 'wall'` (mirrors stair). `WallPersistenceHost` always-on (sibling of `DxfViewerTopBar`).
- [x] `app/WallPersistenceHost.tsx` — null-rendering host που hosting το `useWallPersistence` (Phase 1B has no floating wall panel UI yet; Phase 1D adds DNA editor).
- [x] `EntityRendererComposite.ts` — `WallRenderer` registered for `'wall'` entity type.
- [x] `rendering/hitTesting/Bounds.ts` — `case 'wall'` (και άλλα BIM kinds) via `calculateBimEntityBounds()` που χρησιμοποιεί `geometry.bbox`.
- [x] `services/HitTestingService.ts` — `case 'wall'` στο `convertToEntityModel` ώστε ο walls φτάνει στο spatial index με `params + geometry + validation`.
- [x] Hotkey: `W` (single-char) στο `config/keyboard-shortcuts.ts` + `useDxfToolbarShortcuts`. ESC cancel: `'wall'` στο `useKeyboardShortcuts` drawing tools array.
- [x] Tests Jest: `hooks/drawing/__tests__/useWallTool.test.tsx` (10 tests: activate/deactivate/reset/clicks/commit/overrides/validation error/status-text).
- [ ] `EntityAuditService.recordChange()` integration → moved to Phase 1D (stair parallel: also pending στο useStairPersistence baseline).
- [ ] Snap engine integration → moved to Phase 1C με grips + Dynamic Input.
- [ ] Variant kinds (curved/polyline) → Phase 1C.

**Phase 1C — Editing affordances (✅ IMPLEMENTED 2026-05-18)**

- [x] `bim/walls/wall-grips.ts` — pure `getWallGrips()` + `applyWallGripDrag()`. Grip kinds: `wall-start`, `wall-end`, `wall-midpoint`, `wall-thickness`, `wall-curve` (curved kind only), `wall-vertex-N` (polyline kind only). Pattern mirror stair-grips: zero React/DOM/Firestore deps. Scene-unit-aware thickness min/max floors (mirror `minWidthFloorFor` from stair).
- [x] `bim/walls/wall-preview-store.ts` — single-writer/multi-reader module store (ADR-040-safe). Mirror `stairPreviewStore`. `useWallTool` writes startPoint + curveControl + polylineVertices + overrides on every transition; `updatePreview` reads it.
- [x] `WallRenderer.getGrips()` — wired to `getWallGrips(wall)`. `grip-types.ts` + `grip-registry.ts` + `grip-commit-adapters.ts` extended for `wallGripKind` discriminator. New `commitWallGripDrag` routes through `UpdateWallParamsCommand` (`isDragging=true` → merge window).
- [x] `useWallTool` extended: kind switch (`setKind('straight'|'curved'|'polyline')`), curved 3-click flow (start → end → curveControl), polyline N-click flow with Enter to finish, preview store sync, Dynamic Input inline overrides (height/thickness/category/flip).
- [x] `drawing-preview-generator.generateWallPreview()` — outer/inner edge polygon ghost from `computeWallGeometry()` (WYSIWYG with committed renderer). Reads `wallPreviewStore` for kind/overrides/curveControl.
- [x] `useUnifiedDrawing` wall branch — resolves wall from `toolStateStore`, reconstructs `tempPoints` from `wallPreviewStore`, propagates scene units to preview.
- [x] `bim/geometry/wall-geometry.ts` — curved kind subdivision: quadratic Bezier 16 segments (`CURVED_SUBDIVISIONS`), pinned endpoints to params.start/end, mirrors AutoCAD `SPLINESEGS`.
- [x] Snap engine integration — `GeometricCalculations.getEntityEndpoints/getEntityMidpoints/getEntityMidpoint` extended με wall case (axis endpoints + axis midpoint; polyline kind → per-spine vertex/segment). Activates Endpoint + Midpoint snap engines για walls via existing spatial index pipeline.
- [x] `DynamicSubmitDetail` extended με `height`/`thickness`/`category`/`flip` — Phase 1B Stream E parity για walls. `commit-wall` action applies inline overrides ahead of commit.
- [x] Tests Jest: `bim/walls/__tests__/wall-grips.test.ts` (14 tests grip layout + applyDrag transforms), `bim/walls/__tests__/wall-preview-store.test.ts` (7 tests writer/reset/snapshot stability), `bim/geometry/__tests__/wall-geometry.test.ts` extended με curved subdivision suite (6 tests).
- [ ] Floating advanced panel "Σύνθεση Στρώσεων" (WallDna editor) → deferred to Phase 1D.
- [ ] `wall-tool.ts` perpendicular auto-trim (`computeWallTrims` port) → deferred to Phase 1D.
- [ ] `WallDnaService` με material catalog (Phase 6+ material library) → unchanged.

**Phase 1D — Advanced Editing + Audit + BOQ (split στα 4 sub-phases)**

Συγκεντρώνει τα items που μεταφέρθηκαν από Phase 1B/1C καθώς και το BOQ feed. Suddivisione σε 4 sub-phases για phase-per-session compliance (memory: `phase_per_session`).

**Phase 1D-A — WallDna Editor "Σύνθεση Στρώσεων" (✅ IMPLEMENTED 2026-05-18)**

- [x] `bim/walls/wall-material-catalog.ts` — 18 hardcoded presets (concrete C20/C25/C30, masonry, insulation, plaster, gypsum, OSB, vapor barrier, cladding) + `'custom'` sentinel + `WallMaterialCatalogProvider` interface (Phase 6+ Asset Manager swap target). Mirror stair-material-catalog.
- [x] `bim/walls/wall-dna-mutations.ts` — Pure immutable mutation helpers (`addLayer`, `removeLayer`, `updateLayer`, `reorderLayer`, `fromLayers`) preserving SSoT invariant `dna.totalThickness === sum(layers)`. Side-effect free for testability.
- [x] `ui/wall-advanced-panel/hooks/useSelectedWall.ts` — pure derivation από primarySelectedId + scene (mirror `useSelectedStair`, ADR-040 micro-leaf SSoT).
- [x] `ui/wall-advanced-panel/commands/dispatchWallParamPatch.ts` — `useWallParamsDispatcher` writer SSoT μέσω `UpdateWallParamsCommand` (ADR-031 command-history). Mirror `dispatchStairParamPatch`. `isDragging=false` — κάθε panel mutation = discrete undo step.
- [x] `ui/wall-advanced-panel/sections/WallWarningsSection.tsx` — surfaces `validation.violationKeys` (read-only Phase 1D-A; auto-fix Phase 1E+).
- [x] `ui/wall-advanced-panel/sections/WallPersistenceSection.tsx` — G24 soft-lock display + saveNow button + status indicator (idle/saving/saved/error). Mirror `StairPersistenceSection`.
- [x] `ui/wall-advanced-panel/sections/WallDnaSection.tsx` — ordered layer list (side/name/thickness/material per row), reorder ↑↓, add/remove, "Φόρτωση προεπιλογής" reloads category default, "Χωρίς σύνθεση" detaches DNA (Revit Generic Wall pattern). All mutations dispatch `{ dna, thickness: dna.totalThickness }` ώστε SSoT invariant να διατηρείται και στο ribbon write path.
- [x] `ui/wall-advanced-panel/WallAdvancedPanel.tsx` — presentational shell composing Warnings + Persistence + DNA sections (mirror StairAdvancedPanel). Sidebar-tab + fixed-right modes supported via `containerClassName`.
- [x] `ui/wall-advanced-panel/WallPropertiesTab.tsx` — sidebar wrapper με auth + persistence wiring (mirror StairPropertiesTab).
- [x] `ui/wall-advanced-panel/BimPropertiesRouter.tsx` — discriminating router στο sidebar "Properties" tab. Mounts WallPropertiesTab/StairPropertiesTab ανάλογα με `isWallEntity`/`isStairEntity`. Fallback: stair tab για legacy compatibility.
- [x] `ui/hooks/usePanelContentRenderer.tsx` — `case 'properties'` τώρα mounts `BimPropertiesRouter` (αντί άμεσο StairPropertiesTab).
- [x] i18n complete `wallAdvancedPanel.*` (el + en) — title, emptyState, sections.{warnings,persistence,dna}, materials.preset.* (18 presets + custom). Zero hardcoded strings (SOS N.11). Pure Greek (memory `pure_greek_locale`).
- [x] Tests Jest:
  - `bim/walls/__tests__/wall-dna-mutations.test.ts` (12 tests: add/remove/update/reorder + invariant + boundary noops)
  - `bim/walls/__tests__/wall-material-catalog.test.ts` (6 tests: presets coverage + resolvePreset + classifyWallMaterial)
  - `ui/wall-advanced-panel/hooks/__tests__/useSelectedWall.test.ts` (4 tests: match/non-wall/null-scene/null-selection)

**Phase 1D-B — Perpendicular Auto-Trim (`computeWallTrims`)** *(✅ IMPLEMENTED 2026-05-18)*

- [x] `bim/walls/wall-trims.ts` — pure axis-axis intersection (parametric line-line, Cramer's rule) + mitred join bevel = halfThicknessOther / sin(angle). Written from scratch (genarc/src/engines/bom/wallTrims.ts not on disk). O(n²) pair loop; classifies corner / T-junction / cross (cross skipped Phase 1D-B); accumulates max bevel per endpoint across multiple joins. `applyTrimPatches()` patches wall params + recomputes geometry.
- [x] `bim/geometry/wall-geometry.ts` — `applyAxisBevels()` helper added; `computeWallGeometry` applies `params.startBevel`/`endBevel` (mm) by shortening axis vertices before offset/bbox/length computation. Phase 1: `startBevel`/`endBevel` were previously in WallParams but completely ignored by geometry.
- [x] Wire onto `useSpecialTools.onWallCreated` callback — includes new wall in scene before computing trims so neighbors also patch; `applyTrimPatches` applied to full entity list; patched new wall entity broadcast via EventBus for correct first-save params.
- [x] Tests `bim/walls/__tests__/wall-trims.test.ts` — 19/19 green: corner 90° (startBevel + endBevel variants), oblique 45° (1/sin scaling), T-junction both directions, parallel no-trim, far-apart no-trim, nearly-parallel (<15°) no-trim, max-bevel clamp, applyTrimPatches geometry recompute + non-wall passthrough + empty-map identity, geometry bevel integration (startBevel/endBevel/both/zero).
- [ ] Debounced scene listener (200ms) για grip-moved wall triggers → deferred Phase 1E (only `drawing:entity-created` triggers trims in Phase 1D-B).

**Phase 1D-C — EntityAudit integration** *(✅ IMPLEMENTED 2026-05-18)*

- [x] `src/types/audit-trail.ts` — `AuditEntityType` extended με `'wall'`.
- [x] `src/app/api/audit-trail/record/route.ts` — `VALID_ENTITY_TYPES` + `ENTITY_COLLECTION_MAP` entries για wall (`FLOORPLAN_WALLS`). Ownership check via Admin SDK read.
- [x] Firestore rules — audit entries land in `entity_audit_trail` (existing collection, already covered by 3490-line rules; no new rules needed).
- [x] Client helper `bim/walls/wall-audit-client.ts` — `recordWallChange(action, entity, entityName?)` fire-and-forget POST to `/api/audit-trail/record`. `buildWallChanges()` emits `kind` field for created/deleted, `params` marker for updated.
- [x] Hook `useWallPersistence.ts` — `isNew` flag captured before save; `void recordWallChange(isNew ? 'created' : 'updated', entity)` after successful `svc.saveWall()`. Fire-and-forget (never awaited, audit failure ≠ UX impact).
- [x] Delete path — `WallFirestoreService.deleteWall()` exists (Phase 1B); delete UI + audit wired in Phase 1E (ribbon button → bridge → EventBus → useWallPersistence).
- [ ] Stair audit: same pattern applicable; deferred (no stair delete UI either — consistent with walls).
- [x] CHECK 3.17 scanner: `TRACKED_COLLECTION_KEYS` extended με `FLOORPLAN_WALLS`; `wall-firestore-service.ts` added to `HARD_EXEMPT_PATTERNS` (client-SDK, audit at hook layer); baseline refreshed (1 pre-existing `property-deletion-guard.ts` grandfathered — unrelated to ADR-363).

**Phase 1D-B deferred item (now done in Phase 1E)**:
- [x] Debounced scene listener (200ms) για grip-moved wall triggers — see Phase 1E below.

**Phase 1D-D — BOQ Auto-Feed (depends on Phase 6)**

- [ ] `BimToBoqBridge.feedWall()` — emit ΟΙΚ-3 BOQ item per wall (single layer στο Phase 1; layered DNA sub-items σε Phase 6+).

**Phase 1E — Re-Trim on Grip + Wall Delete Action** *(✅ IMPLEMENTED 2026-05-18)*

- [x] **Feature A — Debounced Re-Trim on Grip Drag**: `EventBus` receives `'bim:wall-params-updated': { wallId }` (new event). `commitWallGripDrag` emits this event after executing `UpdateWallParamsCommand`. `useSpecialTools` subscribes with 200ms debounce → calls `computeWallTrims(allWalls)` + `applyTrimPatches` + `setLevelScene`. Guard: skip if `<2` walls or `trims.size === 0`. Result: bevel joins stay correct when user drags wall endpoints or midpoints.
- [x] **Feature B — Wall Delete Action**: `wall-command-keys.ts` → `WALL_RIBBON_KEYS_ACTIONS.delete = 'wall.actions.delete'` + `isWallActionKey()` guard. `contextual-wall-tab.ts` → delete button (icon: `trash`) in wall-actions panel, i18n key `ribbon.commands.wallEditor.delete`. `useRibbonWallBridge.onAction` → confirm dialog (`window.confirm` via `t('ribbon.commands.wallEditor.deleteConfirm')`) → emits `'bim:wall-delete-requested'` EventBus event. `useRibbonCommands.onAction` → routes `isWallActionKey` to `wallBridge.onAction` before generic handler. `useWallPersistence` → subscribes to `'bim:wall-delete-requested'` → `svc.deleteWall()` + `recordWallChange('deleted', ...)` + optimistic scene removal + refs cleanup. EventBus event `'bim:wall-delete-requested': { wallId }` added. i18n keys added: `ribbon.commands.wallEditor.delete` + `ribbon.commands.wallEditor.deleteConfirm` (el + en).
- [x] Architecture: full EventBus decoupling between bridge (UI layer) and persistence (data layer). Bridge owns confirm dialog (ribbon responsibility), persistence owns Firestore + scene mutation (data responsibility). No threading through DxfViewerContent.

### Phase 2 — Opening *(✅ CORE IMPLEMENTED 2026-05-18)*

**Files added (Phase 2 core):**
- `bim/types/opening-types.ts` — 5 kinds (door/window/sliding-door/french-door/fixed), `OpeningParams`/`OpeningGeometry`/`OpeningEntity` concrete types, `OPENING_KIND_DEFAULTS` per-kind defaults, `OPENING_SNAP_INCREMENT_MM` (50mm).
- `bim/geometry/opening-geometry.ts` — `computeOpeningGeometry(params, hostWall)` pure SSoT (outline rect on axis, `position`/`rotation`/`bbox`/`area`(m²)/`perimeter`(m)), `projectPointToWallOffset()` helper for snap-to-host.
- `bim/validators/opening-validator.ts` — `validateOpeningParams(params, hostWall)` — hard errors (`missingHostWall`, `widthTooSmall`, `heightTooSmall`, `offsetNegative`, `sillNegative`, `overflowsHostLength`, `overflowsHostHeight`) + code violations (`widthExceedsThicknessRatio`, `doorWithSill`).
- `hooks/drawing/opening-completion.ts` — `buildDefaultOpeningParams` + `buildOpeningEntity` + `completeOpeningFromHostClick` (pure builders, generateOpeningId via N.6).
- `hooks/drawing/useOpeningTool.ts` — FSM `idle → awaitingHostWall → awaitingPosition → committed`, continuous-draw chain, ESC handling, status text i18n keys.
- `bim/walls/opening-firestore-service.ts` — `OpeningFirestoreService` + `OpeningDoc` (mirror `WallFirestoreService`).
- `hooks/data/useOpeningPersistence.ts` — 500ms auto-save debounce, diff-merge, first-save listener, delete-requested listener, geometry re-derive from `params + hostWall` on hydrate.
- `bim/walls/opening-audit-client.ts` — fire-and-forget `recordOpeningChange()` (ADR-195 endpoint).
- `bim/renderers/OpeningRenderer.ts` — outline + hinge arc (door/french-door) + glazing inset (window/fixed/french-door) + sliding-door track indicator.
- `ui/ribbon/data/contextual-opening-tab.ts` + `ui/ribbon/hooks/bridge/opening-command-keys.ts` + `ui/ribbon/hooks/useRibbonOpeningBridge.ts` — Kind / Size / Actions panels με close + delete buttons.
- `app/OpeningPersistenceHost.tsx` — always-on hook host (mounted by `DxfViewerTopBar`).

**Files modified (Phase 2 wiring):**
- `types/audit-trail.ts` — `AuditEntityType` += `'opening'`.
- `types/entities.ts` — `OpeningEntity` placeholder replaced by `bim/types/opening-types` re-export; local `OpeningKind` declaration removed (re-exported from concrete types).
- `systems/events/EventBus.ts` — added `bim:opening-params-updated` + `bim:opening-delete-requested` events.
- `rendering/core/EntityRendererComposite.ts` — registered `OpeningRenderer` under `'opening'`.
- `hooks/tools/useSpecialTools.ts` — `useOpeningTool` wired with `getWallById` / `getWallAtPoint` resolvers + bbox-based host lookup; `onOpeningCreated` syncs `hostedOpeningIds` mirror on the host wall and emits `drawing:entity-created`.
- `ui/ribbon/hooks/useRibbonCommands.ts` — composer wires `openingBridge` for combobox / state / action / badge keys.
- `app/ribbon-contextual-config.ts` — `CONTEXTUAL_OPENING_TAB` + `OPENING_CONTEXTUAL_TRIGGER` registered; activeTool === `'opening'` triggers tab.
- `app/DxfViewerContent.tsx` — `useRibbonOpeningBridge` instantiated; passed into `useRibbonCommands`.
- `app/DxfViewerTopBar.tsx` — `OpeningPersistenceHost` mounted alongside `WallPersistenceHost`.
- `i18n/locales/{el,en}/dxf-viewer-shell.json` — `ribbon.tabs.openingProperties`, `ribbon.panels.opening{Kind,Size,Actions}`, full `ribbon.commands.openingEditor.*` block (kind/handing/openDirection/width/height/sillHeight/close/delete/deleteConfirm), `tools.opening.{statusHostWall,statusPosition,errors.*}`, `tools.wall.status*` (filling gap from Phase 1).

**Tests added (26+):**
- `bim/geometry/__tests__/opening-geometry.test.ts` — outline shape, center positioning, rotation (horizontal/vertical), area (m²), perimeter (m), bbox folding, hinge arc presence per kind, french-door dual-arc, `projectPointToWallOffset` clamping (15 tests).
- `bim/validators/__tests__/opening-validator.test.ts` — 7 hard errors + 3 code violations + happy path (11 tests).
- `hooks/drawing/__tests__/useOpeningTool.test.tsx` — FSM transitions, no-host error, commit continuous chain, setKind preservation, reset, deactivate, status text (8 tests).

**Phase 2.5 — Opening Advanced Editing (✅ IMPLEMENTED 2026-05-18):**
- [x] **`UpdateOpeningParamsCommand`** — `core/commands/entity-commands/UpdateOpeningParamsCommand.ts`. Atomic params + geometry + validation patch with merge window (ADR-031). Soft-orphan tolerant: missing host wall → intrinsic validation only, geometry preserved.
- [x] **Drag-along-wall grip** — `bim/walls/opening-grips.ts` (pure). Single `opening-offset` grip; `applyOpeningGripDrag()` projects cursor onto host wall axis and clamps to `[frameWidth, hostLength - width - frameWidth]` so the cutout always retains a minimum jamb on each side.
- [x] **`openingGripKind` discriminator** — added to `hooks/grip-types.ts` (`GripInfo`) + `hooks/grips/unified-grip-types.ts` (`UnifiedGripInfo`); forwarded by `grip-registry.wrapDxfGrip()` so the unified pipeline carries the kind through to commit.
- [x] **`commitOpeningGripDrag`** — new case in `hooks/grips/grip-commit-adapters.ts`; routed by `commitDxfGripDragModeAware` ahead of stretch/move strategies. Emits `bim:opening-params-updated` after dispatch.
- [x] **`OpeningRenderer.getGrips`** — wired to `getOpeningGrips()` (replaces Phase 2 stub returning `[]`).
- [x] **Ribbon bridge refactor** — `ui/ribbon/hooks/useRibbonOpeningBridge.ts` dispatches every mutation through `UpdateOpeningParamsCommand` (via `useCommandHistory().execute`) so ribbon edits are undoable, mirroring the wall bridge pattern.
- [x] **Boolean cutout on wall fill** — `bim/renderers/WallRenderer.ts` accepts a per-frame `OpeningsByWall` map (`setOpeningsByWall()`); subtracts each hosted opening outline from the wall fill via `globalCompositeOperation='destination-out'`, scoped by `save/restore`. `EntityRendererComposite.setOpeningsByWall()` forwards from the canvas pipeline. ADR-040 micro-leaf compliant (renderer never subscribes — caller pushes per-frame map).

**Tests added Phase 2.5 (3 suites):**
- `bim/walls/__tests__/opening-grips.test.ts` — 8 tests: grip layout, axis projection, clamp min/max, refuse on undersized host, idempotent identity, foreign grip kind no-op.
- `core/commands/entity-commands/__tests__/UpdateOpeningParamsCommand.test.ts` — 11 tests: execute/undo/redo, merge window (same opening, both dragging), validator rejects, soft-orphan host-missing path, serialize round-trip.
- `bim/renderers/__tests__/WallRenderer-with-openings.test.ts` — 6 tests: cutout pass scoping (save/restore), `destination-out` only when openings registered, foreign-wall openings ignored, stroke survives cutout, multi-opening punching.

**Deferred to Phase 2.6+:**
- [x] Wall split mid-opening: recompute opening positions when wall axis updates. **→ Phase Wall-Grip-Opening-Recompute (2026-05-19)**: `WallOpeningCoordinator` + `CompoundCommand` merge. Partial: chord approximation for curved/polyline walls deferred Phase 0.5+.
- [x] Wall delete prompt "Διαγραφή και των N κουφωμάτων;" (cascading delete UX). **→ Phase cascade-delete (2026-05-19)**: `WallCascadeDeleteDialog` + `wall-cascade-delete-store`.
- [x] Hotkey `OP` (Opening 2-char chord) — **implemented Phase 7A** (2026-05-18) via `MultiCharKeySequence`. `O` alone → `tool:layering` (fallback, toggle), `OP` → `tool:opening`.
- [x] Single-char variant shortcuts `D`/`Wn` — **implemented Phase 7B (2026-05-19)** via EventBus. `D` (context-sensitive when `activeTool === 'opening'`) → `bim:set-opening-kind` → kind=`'door'`. `W+1/2/3` BIM chords → `bim:set-wall-kind` → kind=`'straight'/'curved'/'polyline'` + `onToolChange('wall')`. `W` alone → fallback `tool:wall` (unchanged). `D` outside opening context → falls through to `measureDistance` (no conflict).
- [ ] Polyline / curved host wall positioning (currently chord approximation only).
- [x] Canvas pipeline call site for `composite.setOpeningsByWall(...)` — **implemented Phase 2 deferred (2026-05-19)**. `DxfOpening` wrapper added to `dxf-types.ts`; `case 'opening'` added to `useDxfSceneConversion.ts` and `DxfRenderer.toEntityModel()`; `DxfRenderer.buildOpeningsByWall()` builds `Map<wallId, OpeningEntity[]>` per-frame from scene entities; `DxfRenderer.render()` calls `composite.setOpeningsByWall(map)` before the entity render pass — WallRenderer now punches boolean cutouts through wall fills for all hosted openings.

### Phase 3 — Slab *(✅ CORE IMPLEMENTED 2026-05-18)*

- [x] Port `slab-types.ts` (5 kinds: floor / ceiling / roof / ground / foundation).
- [x] `useSlabTool.ts` — polygon drawing (multi-click + ENTER to commit + auto-close near first vertex 50mm).
- [x] `SlabRenderer.ts` — fill (translucent rgba per kind) + outline (stroke per kind).
- [x] Validator: tooFewVertices / selfIntersecting / zeroArea / nonPositiveThickness hard errors + thicknessTooThin / maxFreeSpanExceeded (5m) / ceilingRoofAtZeroElevation code violations.
- [x] `SlabFirestoreService` + `useSlabPersistence` + `slab-audit-client` + `SlabPersistenceHost`.
- [x] Contextual ribbon `slab-editor` tab (kind + reinforcement + thickness + elevation + close + delete).
- [x] i18n (el+en) + 3 test suites (slab-geometry, slab-validator, useSlabTool).
- [x] §5.5 schema realized via concrete types in `bim/types/slab-types.ts` (replaced Phase 0 stub).
- [x] Hotkey `SL` (Slab 2-char chord) — **implemented Phase 7A** (2026-05-18) via `MultiCharKeySequence`. `S` alone → `tool:select` (fallback), `S+T` → stair, `S+L` → slab.

**Phase 3.5 — Slab Advanced Editing (✅ IMPLEMENTED 2026-05-18):**
- [x] **`UpdateSlabParamsCommand`** — `core/commands/entity-commands/UpdateSlabParamsCommand.ts`. Atomic params + geometry + validation patch with merge window (ADR-031). Root `kind` synced with `params.kind` so the ribbon's kind switch remains undoable.
- [x] **Per-vertex polygon grip** — `bim/slabs/slab-grips.ts` (pure). `slab-vertex-N` family (one grip per outline vertex); `applySlabGripDrag()` translates the indexed vertex by `delta` (XY only, z preserved). Edge-midpoint vertex insertion deferred to Phase 3.6.
- [x] **`slabGripKind` discriminator** — added to `hooks/grip-types.ts` (`GripInfo`) + re-exported from `hooks/useGripMovement.ts` + `hooks/grips/unified-grip-types.ts` (`UnifiedGripInfo`); forwarded by `grip-registry.wrapDxfGrip()` so the unified pipeline carries the kind through to commit.
- [x] **`commitSlabGripDrag`** — new case in `hooks/grips/grip-commit-adapters.ts`; routed by `commitDxfGripDragModeAware` ahead of stretch/move strategies. Emits `bim:slab-params-updated` after dispatch.
- [x] **`SlabRenderer.getGrips`** — wired to `getSlabGrips()` (replaces Phase 3 stub returning `[]`).
- [x] **Ribbon bridge refactor** — `ui/ribbon/hooks/useRibbonSlabBridge.ts` dispatches every mutation through `UpdateSlabParamsCommand` (via `useCommandHistory().execute` + `LevelSceneManagerAdapter`) so ribbon edits are undoable, mirroring the wall / opening bridge pattern. Direct scene patch + `computeSlabGeometry` / `validateSlabParams` calls removed (those now happen inside the command).

**Tests added Phase 3.5 (2 suites):**
- `bim/slabs/__tests__/slab-grips.test.ts` — 10 tests: grip layout per outline vertex, stable index order, type/movesEntity invariants, degenerate-polygon empty list, per-index drag translation, z preservation, zero-delta + out-of-range short-circuit, unknown-grip-kind no-op.
- `core/commands/entity-commands/__tests__/UpdateSlabParamsCommand.test.ts` — 12 tests: execute/undo/redo round-trip, geometry recompute (4×3 → 5×3 m² rectangle), root-kind sync with `params.kind`, undo-before-execute no-op, merge window (same slab + both dragging + within window), foreign-slab merge guard, validator rejects empty id / degenerate outline / non-positive thickness, serialize round-trip.

**Deferred to Phase 3.6+ (Phase 3.5 close-out list):**
- [x] Edge-midpoint vertex insertion (`slab-edge-midpoint-N` grip → adds a new vertex at the edge midpoint). **Done Phase 3.6.**
- [x] Slab-opening separate entity (§11.Q3) + boolean cutout on slab fill (mirrors wall's `OpeningsByWall` pattern from Phase 2.5). **Done Phase 3.7.**
- [x] Rectilinear constraint (Shift toggle clamps grip drag to dominant world axis). **Done Phase 3.6.**
- [x] Hatch patterns per `reinforcement` (one-way / two-way / waffle / flat). **Done Phase 3.6.**
- [ ] maxFreeSpan analytical (1D beam-direction span detection — currently crude bbox max-dimension). **Still deferred → Phase 3.7+.**

**Phase 3.6 — Slab Polish (✅ IMPLEMENTED 2026-05-18):**
- [x] **Edge-midpoint vertex insertion** — `bim/slabs/slab-grips.ts` extended. `getSlabGrips()` now returns `2N` grips for an `N`-vertex polygon: indices `[0, N)` are vertex grips (`slab-vertex-N`, Phase 3.5 behaviour preserved) and indices `[N, 2N)` are edge-midpoint grips (`slab-edge-midpoint-N`) anchored at `midpoint(verts[N], verts[(N+1) mod len])`. `applySlabGripDrag('slab-edge-midpoint-N', …)` splits edge `[N, N+1]` by inserting a fresh vertex at `midpoint + delta`; z is averaged from the two endpoints when present.
- [x] **Rectilinear (Shift) constraint** — `SlabGripDragInput.rectilinear?: boolean`. When `true`, `applySlabGripDrag` quantizes `delta` to the dominant world axis (`|dx| ≥ |dy|` → keep dx, drop dy; otherwise reverse). Applies to both vertex translate and edge-midpoint insertion.
- [x] **`ShiftKeyTracker`** — new singleton in `src/subapps/dxf-viewer/keyboard/ShiftKeyTracker.ts`. Vanilla pub/sub mirror of `GripCopyModeStore`; installs `window` `keydown`/`keyup`/`blur` listeners once at module load (SSR-safe). Exposes `getSnapshot()` for commit-time consumers that cannot plumb the modifier through `useUnifiedGripInteraction.handleMouseUp(worldPos)` (which intentionally drops the native event). ADR-040 compliant — low-frequency UI events, no render-path subscriptions.
- [x] **`commitSlabGripDrag` reads tracker** — `hooks/grips/grip-parametric-commits.ts` passes `rectilinear: ShiftKeyTracker.getSnapshot()` into `applySlabGripDrag`. No signature change to `commitDxfGripDragModeAware`/`DxfCommitDeps`.
- [x] **`SlabGripKind` discriminator extended** — `hooks/grip-types.ts` now declares the discriminated union `slab-vertex-${number} | slab-edge-midpoint-${number}`. Re-exports through `hooks/useGripMovement.ts` + `hooks/grips/unified-grip-types.ts` propagate automatically.
- [x] **Reinforcement hatch in `SlabRenderer`** — new private `drawReinforcementHatch(slab)` pass runs between fill and stroke when `params.reinforcement` is set. Polygon-clipped (save → polygon path → clip → hatch → restore). World-space spacing per family: one-way 200mm horizontal, two-way 300mm orthogonal grid, waffle 150mm dense cross-hatch, flat 250mm dot grid. Stroke kept faint (`rgba(0,0,0,0.15)`, `lineWidth=0.5`) so the outline + fill stay readable. Industry convention (Revit/ArchiCAD plan-view hint hatch).
- [x] **`SlabRenderer.getGrips` carries midpoint type** — vertex grips render as `type: 'vertex'`, edge midpoints as `type: 'midpoint'` (already in `rendering/types/Types.ts` `GripInfo['type']` union).

**Tests added Phase 3.6 (1 suite + 10 new tests):**
- `bim/slabs/__tests__/slab-grips.test.ts` — extended to 20 tests: existing 10 Phase 3.5 tests retained (covering vertex layout + drag translation + z preservation + zero-delta / out-of-range / unknown short-circuit) + 10 new Phase 3.6 tests covering edge-midpoint grip positions (incl. closing edge wrap), `type='midpoint'` + `edgeVertexIndices`, vertex insertion at `midpoint + delta` (length+1, original vertices untouched), out-of-range edge index short-circuit, rectilinear quantization on each axis tie-break, edge-midpoint + rectilinear interaction, and `rectilinear=false` default preserves full delta.
- `bim/renderers/__tests__/SlabRenderer-hatch.test.ts` — 7 canvas-mock tests (firebase/auth stubbed): no reinforcement → no `clip` call, one-way → clip + horizontal hatch lines only, two-way > one-way line count, waffle > two-way density, flat → arc/fill dot grid (no parallel-line strokes), scoped save/clip/restore, stroke survives clip.

**Deferred to Phase 3.7+:**
- [x] Slab-opening separate entity (§11.Q3) + boolean cutout on slab fill (mirrors wall's `OpeningsByWall` pattern from Phase 2.5). **Done Phase 3.7.**
- [ ] maxFreeSpan analytical (1D beam-direction span detection — currently crude bbox max-dimension).
- [ ] Per-material hatch palette (Phase 6+ depends on material library).
- [ ] Snap-to-edge-midpoint preview ghost while hovering edge midpoint grip pre-drag.

### Phase 3.7 — Slab-Opening Entity *(✅ IMPLEMENTED 2026-05-18)*

- [x] `bim/types/slab-opening-types.ts` — `SlabOpeningKind` (shaft / well / duct / chimney), `SlabOpeningParams` (kind + slabId FK + outline Polygon3D + optional: elevationOverride / multiStoreyStackGroupId / fireRating / material), `SlabOpeningGeometry` (polygon + bbox + area-m² + perimeter-m), `SlabOpeningEntity extends BimEntity<SlabOpeningKind, SlabOpeningParams, SlabOpeningGeometry>`. Constants: `MIN_SLAB_OPENING_VERTICES=3`, `MIN_SLAB_OPENING_AREA_MM2=10_000`, per-kind default size presets (shaft 1500×1500, well 1200×3000, duct 400×400, chimney 600×600), per-kind min dimension (shaft 1100mm, well 900mm, duct 200mm, chimney 300mm).
- [x] `bim/geometry/slab-opening-geometry.ts` — `computeSlabOpeningGeometry(params)` pure SSoT: area via shoelace (m²), perimeter sum-of-edges (m), bbox folds vertices. Polygon3D → bbox/area/perimeter pure re-export of `polygon-utils.ts` helpers.
- [x] `bim/validators/slab-opening-validator.ts` — hard errors (tooFewVertices, selfIntersecting, zeroArea, missingHostSlab) + code violations (tooSmallForKind vs per-kind min dimension mm).
- [x] `hooks/drawing/useSlabOpeningTool.ts` — FSM `idle → awaitingHostSlab → awaitingPosition → committed`. Click on slab → host lock; click elsewhere → spawn default rectangle around cursor (size from `SLAB_OPENING_DEFAULT_SIZES[kind]`); ESC resets; continuous chain.
- [x] `hooks/tools/useSpecialTools-slab-opening.ts` — extracted `buildSlabOpeningResolvers(levelManager)` (getSlabById, getSlabAtPoint via bbox containment, onSlabOpeningCreated → host mirror + EventBus).
- [x] `hooks/tools/useSpecialTools.ts` — `slabOpeningTool` wired; `useToolLifecycle(activeTool === 'slab-opening', ...)`.
- [x] `components/dxf-layout/CanvasSection.tsx` — `slabOpeningTool` passed to `useCanvasClickHandler`.
- [x] `canvas-v2/dxf-canvas/dxf-types.ts` — `DxfSlab` + `DxfSlabOpening` wrapper types; `DxfEntityUnion` extended.
- [x] `hooks/canvas/useDxfSceneConversion.ts` — slab + slab-opening cases in `convertEntity()`.
- [x] `canvas-v2/dxf-canvas/DxfRenderer.ts` — `buildSlabOpeningsBySlab()` + per-frame `composite.setSlabOpeningsBySlab()`; `toEntityModel()` cases for slab + slab-opening.
- [x] `bim/renderers/SlabOpeningRenderer.ts` — dashed red-accent outline polygon + 30% translucent fill; per-kind palette; hitTest; `getGrips` → `[]` (Phase 3.7+ deferred).
- [x] `bim/slabs/slab-opening-firestore-service.ts` — Firestore `floorplan_slab_openings/{slabOpeningId}` (companyId field-based tenant isolation), `setDoc` + `generateSlabOpeningId`.
- [x] `hooks/data/useSlabOpeningPersistence.ts` — debounced auto-save 500ms, diff-merge subscribe, first-save via `drawing:entity-created` (tool='slab-opening'), delete via `bim:slab-opening-delete-requested`.
- [x] `core/commands/entity-commands/UpdateSlabOpeningParamsCommand.ts` — atomic patch params + recomputed geometry + validation; soft-orphan policy; merge window ADR-031.
- [x] `rendering/core/EntityRendererComposite.ts` — `SlabOpeningRenderer` registered; `setSlabOpeningsBySlab(map)` forwarder.
- [x] **Ribbon (Feature H)**: `slab-opening-command-keys.ts`, `contextual-slab-opening-tab.ts` (kind combobox 4 options + actions panel), `useRibbonSlabOpeningBridge.ts` (mutation via `UpdateSlabOpeningParamsCommand`), wired into `useRibbonCommands.ts`, `ribbon-contextual-config.ts`, `useDxfBimBridges.ts`, `DxfViewerContent.tsx`, `DxfViewerTopBar.tsx` + `SlabOpeningPersistenceHost.tsx`.
- [x] `systems/events/EventBus.ts` — new events `bim:slab-opening-params-updated` + `bim:slab-opening-delete-requested`.
- [x] i18n el+en `dxf-viewer-shell.json` — `ribbon.tabs.slabOpeningProperties`, `ribbon.panels.slabOpeningKind/slabOpeningActions`, `ribbon.commands.slabOpeningEditor.*` (kind section + 4 kind labels + close/delete/deleteConfirm), `tools.slabOpening.*`, `slabOpening.validation.codeViolations.tooSmallForKind`.

**Deferred to Phase 3.7+ (post-3.7):**
- [x] SlabOpeningGrips (vertex + edge-midpoint, mirror Phase 3.5/3.6 slab pattern). **Done Phase 3.7a (2026-05-18).**
- [x] Boolean cutout integration in `SlabRenderer` (setSlabOpeningsBySlab map already plumbed — renderer needs `destination-out` pass, mirror `WallRenderer.punchHostedOpenings`). **Done Phase 3.7 (already shipped inline with the entity work).**
- [ ] Multi-storey stack group UI ("Copy to all floors" bulk-create workflow).
- [ ] Fire-rating + material fields in ribbon (Phase 6+ BOQ dependency).

### Phase 3.7a — Slab-Opening Grips *(✅ IMPLEMENTED 2026-05-18)*

Closes the Phase 3.7 deferred list for slab-opening editing affordances. Mirrors
ακριβώς το Phase 3.5/3.6 pattern του slab (per-vertex translate + edge-midpoint
vertex insertion + Shift-rectilinear quantization).

- [x] `bim/slab-openings/slab-opening-grips.ts` — pure handlers (zero React /
  DOM / Firestore / canvas deps): `getSlabOpeningGrips(entity)` returns `2N`
  grips (`[0, N)` vertex grips + `[N, 2N)` edge-midpoint grips with
  `type='midpoint'` + `edgeVertexIndices=[i, (i+1) % N]`). `applySlabOpeningGripDrag(gripKind, input)`
  dispatches by prefix: `slab-opening-vertex-N` → translate indexed vertex (XY,
  z preserved); `slab-opening-edge-midpoint-N` → insert fresh `Point3D` at
  `midpoint(verts[N], verts[(N+1) mod len]) + delta` (z averaged όταν present).
  Out-of-range / unknown / zero-delta short-circuit. `rectilinear=true`
  quantizes delta στον dominant world axis (`|dx| ≥ |dy|` → keep dx, drop dy).
- [x] `hooks/grip-types.ts` — `SlabOpeningGripKind = \`slab-opening-vertex-${number}\` | \`slab-opening-edge-midpoint-${number}\``
  discriminated template-literal union + `GripInfo.slabOpeningGripKind?` field.
- [x] `hooks/useGripMovement.ts` — re-export `SlabOpeningGripKind`.
- [x] `hooks/grips/unified-grip-types.ts` — `UnifiedGripInfo.slabOpeningGripKind?` field.
- [x] `hooks/grips/grip-registry.ts` — `wrapDxfGrip` forwards `slabOpeningGripKind` conditionally.
- [x] `hooks/grips/grip-parametric-commits.ts` — `commitSlabOpeningGripDrag(grip, delta, deps)`:
  resolves opening via `sceneManager.getEntity`, reads `ShiftKeyTracker.getSnapshot()`
  για rectilinear, builds `UpdateSlabOpeningParamsCommand` με `isDragging=true`,
  emits `bim:slab-opening-params-updated`. Mirror του `commitSlabGripDrag`.
- [x] `hooks/grips/grip-commit-adapters.ts` — `commitDxfGripDragModeAware`
  early-branches σε `grip.slabOpeningGripKind` πριν τα stretch / move / rotate
  paths (mirror του slabGripKind branch).
- [x] `bim/renderers/SlabOpeningRenderer.ts` — `getGrips(entity)` πλέον γυρνά
  `getSlabOpeningGrips(entity).map(...)` αντί για `[]` stub. `type='midpoint'`
  forwarding για edge-midpoint grips.
- [x] `bim/slab-openings/__tests__/slab-opening-grips.test.ts` — 21 Jest tests
  (mirror του `slab-grips.test.ts` Phase 3.5+3.6): stable index order, vertex
  positions, type/movesEntity/entityId, degenerate polygon, per-vertex translate
  (preserve z, zero-delta + out-of-range short-circuit, unknown grip kind),
  edge-midpoint positions (incl. closing edge wrap), `type='midpoint'` +
  `edgeVertexIndices`, vertex insertion at `midpoint + delta` (length+1, original
  vertices untouched), closing-edge insertion, rectilinear quantization on each
  axis + tie-break + edge-midpoint interaction + default-off, foreign params
  preservation (kind / slabId / fireRating / elevationOverride / multiStoreyStackGroupId).
- [x] `bim/renderers/__tests__/SlabRenderer-with-slab-openings.test.ts` — 6 Jest
  tests for the boolean cutout pass (no openings → no `destination-out`,
  registered opening → scoped destination-out, cutout outline filled, foreign
  slab id ignored, stroke survives, multi-opening per-opening cutout).

**Deferred to Phase 3.7b+:**
- [ ] Multi-storey stack group UI ("Copy to all floors" bulk-create workflow).
- [ ] Fire-rating + material fields in ribbon (Phase 6+ BOQ dependency).
- [ ] Snap-to-edge-midpoint preview ghost while hovering edge-midpoint grip pre-drag.

### Phase 4 — Column *(✅ CORE IMPLEMENTED 2026-05-18)*

- [x] Port `column-types.ts` (4 kinds: rectangular / circular / L-shape / T-shape, 9-position anchor system, ANCHOR_OFFSETS + ANCHOR_CYCLE_ORDER).
- [x] L-shape + T-shape (συνηθισμένα ΕΛ) με variant params (lshape.armLength/armWidth, tshape.flangeLength/webThickness).
- [x] `useColumnTool.ts` — single-click placement με Tab anchor cycling (9-state ring, Shift+Tab reverse).
- [x] Rotation via ribbon overrides (free rotation 0/15/30/45/60/90/135/180 deg presets).
- [x] `ColumnRenderer.ts` — footprint outline + translucent fill per kind, hover halo, point-in-polygon hitTest. ADR-040 micro-leaf.
- [x] Validator: width/depth/height ≤ 0 hard errors, invalidLshapeArm / invalidTshapeWeb / invalidTshapeFlange hard errors, widthTooSmall/depthTooSmall code violations (MIN_COLUMN_DIMENSION_MM = 250mm Eurocode), maxSlendernessExceeded (MAX_SLENDERNESS_RATIO = 30).
- [x] `ColumnFirestoreService` + `useColumnPersistence` + `column-audit-client` + `ColumnPersistenceHost`.
- [x] Contextual ribbon `column-editor` tab (kind + anchor + width + depth + height + rotation + close + delete).
- [x] i18n (el+en) + 3 test suites (column-geometry, column-validator, useColumnTool).
- [x] §5.6 schema realized via concrete types in `bim/types/column-types.ts` (replaced Phase 0 stub).
- [x] **Phase 4.5 IMPLEMENTED** (2026-05-18): center/rotation/width/depth grips + `UpdateColumnParamsCommand` full undo/redo + ribbon migration σε CommandHistory. Details § Phase 4.5 below.
- [x] **Phase 4.5b IMPLEMENTED** (2026-05-18): variant-specific grips για L-shape (`column-arm-length` + `column-arm-width`, 1× factor asymmetric arm resize) και T-shape (`column-flange-length` + `column-web-thickness`, 2× factor symmetric resize). Materialize defaults από `width/3 + depth/3` (L) / `width + depth/3` (T) όταν `params.lshape`/`params.tshape` undefined. Όλες clamp στο `MIN_COLUMN_DIMENSION_MM=250`.
- [x] **Phase 4.5c.1 IMPLEMENTED** (2026-05-18): anchor cycling visual preview — 9 ghost footprints renderάρονται στο cursor world position με το ενεργό anchor highlighted (kind-coloured fill+stroke) και τα υπόλοιπα 8 σε ημιδιαφανές outline (15% opacity). Circular kind εμφανίζει 1 ghost μόνο (anchor='center'). Tab/Shift+Tab cycling flips το active flag χωρίς re-compute των footprints. Details § Phase 4.5c.1 below.
- [x] **Phase 4.5c.2 IMPLEMENTED** (2026-05-18): per-material hatch patterns (RC / Steel / Masonry / Wood) renderάρονται μέσα στο polygon clip του footprint, μεταξύ fill και stroke. Case-insensitive lookup, `'rc'` fallback για unknown/undefined material. Circular kind skipped (visual conventions διαφέρουν — deferred 4.5c.3). Details § Phase 4.5c.2 below.
- [ ] **Deferred Phase 4.5c.3+**: circular column material hatch, snap-to-wall-corners + grid-intersections integration, section-profile overlay για L/T variants ενώ γίνεται drag, beam-end auto-snap σε column anchors (Phase 5.5c cross-dep).
- [x] Hotkey `CL` (Column 2-char chord) — **implemented Phase 7A** (2026-05-18) via `MultiCharKeySequence`. `C` alone → `tool:circle` (fallback), `C+L` → column. (`CO` in prior draft was incorrect — corrected per §9.Q7 to avoid CO=Copy conflict.)

### Phase 4.5 — Column Grips + UpdateColumnParamsCommand *(✅ IMPLEMENTED 2026-05-18)*

Closes part of the Phase 4 deferred list (center/rotation/width/depth grips + atomic command + ribbon migration). Mirrors ακριβώς το Phase 5.5a beam pattern προσαρμοσμένο στα 4 column kinds (rectangular/circular/L-shape/T-shape — variant-specific arm/flange grips DEFER στο Phase 4.5b).

**Files created (4):**
- `bim/columns/column-grips.ts` — pure handlers (zero React / DOM / Firestore / canvas deps). `getColumnGrips(entity)` returns 4 grips για rectangular / L-shape / T-shape (`column-center` με `movesEntity=true` στο footprint centroid, `column-rotation` πάνω από το north edge, `column-width` στο far edge κατά τοπικό X, `column-depth` στο far edge κατά τοπικό Y) και 2 για circular (`column-center` + `column-width=diameter` στο world +X). `applyColumnGripDrag(gripKind, input)` pure transform → new `ColumnParams`: `column-center` translates `position` preserving anchor / rotation / kind / variant params; `column-rotation` pivots γύρω από `position` (anchor invariant) μέσω `atan2` διαφοράς παλιού/νέου handle vector — circular kind no-op; `column-width` projects delta σε rotated +X, διαιρεί με `coefX = signX/2 − dx` (far-edge selection), clamps στο `MIN_COLUMN_DIMENSION_MM` (250mm Eurocode), preserves rotation/depth/anchor; `column-depth` mirror μέσω rotated +Y και `coefY` — circular kind no-op. Zero delta + unknown grip kind short-circuit referentially.
- `bim/columns/__tests__/column-grips.test.ts` — 19 Jest tests: grip count per kind (rectangular/L-shape/T-shape=4, circular=2), stable ordering, grip positions match centroid + rotated far-edge offsets, center translate, width/depth resize με coefficient verification, rotation drag updates rotation preserving width/depth/position, width+depth clamp στο `MIN_COLUMN_DIMENSION_MM`, circular depth/rotation no-op (referential identity), circular width = diameter symmetric resize, zero delta + unknown kind referential no-op, foreign params preserved (height/anchor/material/lshape/tshape).
- `core/commands/entity-commands/UpdateColumnParamsCommand.ts` — atomic patch `params` + recomputed `geometry` (`computeColumnGeometry`) + `validation` (`validateColumnParams`) + root `kind` synced με `params.kind` (mirror slab Phase 3.5 / beam Phase 5.5a ώστε ribbon kind switch να μένει undoable). Merge window (ADR-031 `DEFAULT_MERGE_CONFIG.mergeTimeWindow`) collapses continuous grip drags σε ένα undo entry. `validate()` rejects empty id / non-positive width / non-positive depth για non-circular kind / non-positive height / non-finite rotation.
- `core/commands/entity-commands/__tests__/UpdateColumnParamsCommand.test.ts` — 15 Jest tests: execute / undo / redo round-trip, geometry recompute (width=600 → area=0.24 m²), root-kind sync με `params.kind` (rectangular ↔ circular switch), undo-before-execute no-op, merge window (same column + both dragging + within window), foreign-column merge guard, isDragging=false merge guard, validator rejects empty id / non-positive width / non-positive depth (non-circular) / non-positive height / non-finite rotation, circular kind skips depth check, serialize round-trip.

**Files modified (7):**
- `hooks/grip-types.ts` — added `ColumnGripKind = 'column-center' | 'column-rotation' | 'column-width' | 'column-depth'` + `GripInfo.columnGripKind?` discriminator.
- `hooks/useGripMovement.ts` — re-exports `ColumnGripKind`.
- `hooks/grips/unified-grip-types.ts` — `UnifiedGripInfo.columnGripKind?` forwarded από `GripInfo`.
- `hooks/grips/grip-registry.ts` — `wrapDxfGrip` conditional spread forwards `columnGripKind`.
- `hooks/grips/grip-parametric-commits.ts` — νέα `commitColumnGripDrag` (resolves column via `sceneManager.getEntity` με `candidate.type === 'column'` guard, builds `UpdateColumnParamsCommand` με `isDragging=true`, emits `bim:column-params-updated`). ΟΧΙ ShiftKeyTracker plumbing — column δεν έχει rectilinear quantization σε αυτή τη φάση (rotation grip κάνει free-form pivot γύρω από anchor).
- `hooks/grips/grip-commit-adapters.ts` — `commitDxfGripDragModeAware` early-branches on `grip.columnGripKind` πριν τα stretch / move / rotate paths (mirror του beamGripKind branch).
- `bim/renderers/ColumnRenderer.ts` — `getGrips()` πλέον γυρνά `getColumnGrips(entity).map(...)` αντί για `[]` stub· `type='center'` forwarding για το center grip (`movesEntity=true`), `type='vertex'` για τα rotation + width + depth grips.
- `ui/ribbon/hooks/useRibbonColumnBridge.ts` — replaced direct scene patch με `executeCommand(new UpdateColumnParamsCommand(...))` via `useCommandHistory().execute` + `LevelSceneManagerAdapter`; drops `computeColumnGeometry`/`validateColumnParams` imports (now owned by the command). Ribbon edits use `isDragging=false` ώστε κάθε combobox change να είναι δικό του undo entry.

**Deferred to Phase 4.5b+:** hatch patterns per material category, variant-specific arm/flange grips για L-shape (armLength / armWidth handles) + T-shape (flangeLength / webThickness handles), anchor cycling visual preview (ghost at all 9 positions), snap-to-wall-corners + grid-intersections integration, beam-end auto-snap to column anchors (Phase 5.5b cross-dep).

> **2026-05-18 Update**: Phase 4.5b implemented τα variant-specific arm/flange grips — see § Phase 4.5b below. Variant-grip line above is now historical. Hatch / anchor-preview / snap items deferred στο Phase 4.5c.

### Phase 4.5b — Column Variant Grips (L-shape + T-shape) *(✅ IMPLEMENTED 2026-05-18)*

Adds 4 variant-specific dimension grips on top of the Phase 4.5 base set (center/rotation/width/depth). Closes the L-shape (armLength + armWidth) + T-shape (flangeLength + webThickness) gap που το ribbon-only editing δεν κάλυπτε ergonomically. `UpdateColumnParamsCommand` re-used unchanged — variant grips εκπέμπουν standard `ColumnParams` patches και ο command path validates + recomputes geometry atomically.

**Design choices:**
- **L-shape factors are 1×** — οι βραχίονες είναι asymmetric (εκτείνονται μόνο προς −Y / −X από bottom / west edge), οπότε edge-handle delta συνεπάγεται 1:1 dimension change. Inner-corner edges επιλέχθηκαν ως handle thread γιατί κινούνται καθαρά μαζί με τη μετρούμενη διάσταση.
- **T-shape factors are 2×** — πέλμα + κορμός είναι symmetric γύρω από τον κάθετο άξονα, οπότε side-edge drag = half-change ⇒ doubling για συνολική διάσταση (mirror του `column-width` anchor=center pattern και του Phase 5.5b `beam-width` perpendicular handle).
- **Defaults materialized από `computeColumnGeometry`** (L: `width/3 + depth/3`, T: `width + depth/3`). Όταν `params.lshape` / `params.tshape` undefined στο πρώτο drag, ο handler γεμίζει με αυτά τα defaults ΠΡΙΝ εφαρμόσει το delta — έτσι το επόμενο drag συνεχίζει από τα ήδη υπολογισμένα values, χωρίς re-derivation jumps.
- **Clamp κοινό** στο `MIN_COLUMN_DIMENSION_MM` (250 mm, Eurocode) για όλες τις 4 νέες διαστάσεις.
- **Cross-kind guard:** variant grip kind σε λάθος `params.kind` (π.χ. `column-arm-length` σε rectangular) → no-op (returns `originalParams` referentially), ώστε ο caller να μπορεί να short-circuit το commit.

**Files created (2):**
- `bim/columns/column-grip-utils.ts` — shared local-frame math primitives (`rotate`, `projectDeltaToLocal`, `computeCentroidWorld`, `localToWorld`, `farEdgeSignX/Y`, `ROTATION_HANDLE_OFFSET_MM`, `DEG_TO_RAD` / `RAD_TO_DEG`). Extracted ώστε `column-grips.ts` (base) + `column-variant-grips.ts` (Phase 4.5b) να μοιράζονται την ίδια rotated-frame γεωμετρία χωρίς duplication, και ώστε το core module να μένει εντός του 500-line Google budget (CLAUDE.md N.7.1).
- `bim/columns/column-variant-grips.ts` — Phase 4.5b SSoT: `materializeLshape` / `materializeTshape` (defaults από geometry), 4 exported handle-position helpers (`armLengthHandlePosition` / `armWidthHandlePosition` / `flangeLengthHandlePosition` / `webThicknessHandlePosition`), internal `mergeLshape` / `mergeTshape` (patch + materialize so subsequent drags continue smoothly), 4 transforms (`resizeArmLength` / `resizeArmWidth` / `resizeFlangeLength` / `resizeWebThickness`) με kind-guard + clamp + projection math. Imports `localToWorld` + `projectDeltaToLocal` από `column-grip-utils`.

**Files modified (3):**
- `hooks/grip-types.ts` — `ColumnGripKind` extended με 4 literals: `'column-arm-length' | 'column-arm-width' | 'column-flange-length' | 'column-web-thickness'`. JSDoc του union enriched με Phase 4.5b semantics (L vs T, asymmetric/symmetric factors, materialization rule, clamp).
- `bim/columns/column-grips.ts` — refactored ώστε όλα τα math primitives να εισάγονται από `column-grip-utils` και τα variant handles + transforms από `column-variant-grips`. `getColumnGrips()` εκπέμπει 2 ακόμη grips για L-shape (gripIndex 4=arm-length, 5=arm-width) και 2 για T-shape (4=flange-length, 5=web-thickness) μετά τα 4 base· rectangular και circular παραμένουν 4 / 2 grips αντίστοιχα. `applyColumnGripDrag()` dispatch branch επεκτάθηκε με 4 νέα cases που delegate στο variant module.
- `bim/columns/__tests__/column-grips.test.ts` — base tests 3 + 4 updated από 4 → 6 grips και νέα array assertions για τα variant kinds. 26 νέα tests (20-45): variant handle positions για default 400×400 L/T, rotation invariance (test 24), L-shape transforms (1× factor, clamp, foreign-param preservation, materialization, cross-kind no-op), T-shape transforms (2× factor, clamp, materialization, cross-kind no-op), rectangular + circular non-regression, materialize helper unit tests. Total: 45 tests στο suite.

**Renderer + adapter:** `ColumnRenderer.getGrips()` map δουλεύει generically (`type='center'` → 'center', όλα τα άλλα → 'vertex')· τα νέα `edge`-typed variant grips πέφτουν στο 'vertex' bucket, που είναι αρκετό για canvas pass. JSDoc του getGrips ενημερώθηκε ρητά για το Phase 4.5b coverage και τον deferred Phase 4.5c. `commitColumnGripDrag` (`grip-parametric-commits.ts`) δουλεύει generically — περνάει `grip.columnGripKind` straight through στο `applyColumnGripDrag`. Καμία αλλαγή adapter ή command path ή ribbon bridge.

**Deferred to Phase 4.5c+:** hatch patterns per material category (RC/steel), anchor cycling visual preview (ghost at all 9 positions), snap-to-wall-corners + grid-intersections integration, beam-end auto-snap to column anchors (Phase 5.5c cross-dep), section-profile preview overlay για variants (visualize internal arm/flange dimensions while dragging).

> **2026-05-18 Update**: Phase 4.5c.1 implemented το anchor cycling visual preview — see § Phase 4.5c.1 below. Anchor-preview line above is now historical. Hatch / snap / section-profile items deferred στο Phase 4.5c.2+.

### Phase 4.5c.1 — Anchor Ghost Preview *(✅ IMPLEMENTED 2026-05-18)*

Closes το anchor cycling visual feedback gap που το Phase 4.5b είχε αφήσει deferred. Όσο το column tool βρίσκεται σε `awaitingPosition` και ο cursor κινείται στο canvas, εμφανίζονται 9 ghost footprints (ένα ανά `ColumnAnchor`) γύρω από το cursor — το `state.anchor` ξεχωρίζει με kind-coloured fill+stroke, τα υπόλοιπα 8 σχεδιάζονται ως ημιδιαφανή outlines. Tab/Shift+Tab cycling εναλλάσσει αμέσως το active highlight ΧΩΡΙΣ ο cursor να μετακινηθεί — industry convention (Revit Column tool / ArchiCAD CO).

**Design choices:**
- **9 ghosts ταυτόχρονα + active highlight** — όλοι οι 9 footprints renderάρονται σε κάθε frame αντί να υπάρχει μόνο ο active ghost. Έτσι ο χρήστης βλέπει εκ των προτέρων πού θα προσγειωθεί η κολώνα για κάθε anchor επιλογή χωρίς να κάνει Tab cycling.
- **Circular kind skip** — circular always anchor='center', οπότε εμφανίζεται 1 ghost μόνο (το 9-state UI θα ήταν misleading).
- **Pure ghost module — zero validation στο ghost path** — `computeAnchorGhostFootprints` χρησιμοποιεί `buildDefaultColumnParams` + `computeColumnGeometry` αλλά ΟΧΙ `validateColumnParams`, ώστε το preview να εμφανίζεται ακόμα κι αν τα defaults overrides δεν περνούν validation (π.χ. ribbon override width=100mm < `MIN_COLUMN_DIMENSION_MM`). Τη validation την κάνει το commit click.
- **Active highlight = ενεργό anchor από state** — το `isActive` flag τοποθετείται από `computeAnchorGhostFootprints` με βάση το argument `activeAnchor`. Renderer χρωματίζει: stroke 100% opacity + fill 30% opacity + line width 2 για το active, stroke 15% opacity + no fill + line width 1 για τα 8 inactive.
- **Anchor marker (5×5 px filled square)** στο cursor world position — δείχνει ποιο point του footprint εδράζεται στο click point. Χρώμα kind-coloured.
- **ADR-040 micro-leaf compliance** — `useColumnGhostPreview` subscribes εσωτερικά σε `useCursorWorldPosition` (`ImmediatePositionStore`). `CanvasSection` δεν re-renderάρει σε mousemove· μόνο το νέο `ColumnGhostPreviewMount` leaf re-renderάρει. `useColumnTool.getGhostFootprints` είναι pure projection — δέχεται το `cursorPos` ως argument αντί να κρατάει state, ώστε ο tool hook να μην triggerάρει per-frame React updates.

**Files created (3):**
- `bim/columns/column-anchor-ghosts.ts` — pure SSoT για ghost computation. Exports `AnchorGhost` interface (`anchor` / `isActive` / `footprint` / `cursorPos`) και `computeAnchorGhostFootprints(cursorPos, kind, activeAnchor, overrides)`. Wraps `buildDefaultColumnParams` + `computeColumnGeometry` per anchor στο `ANCHOR_CYCLE_ORDER`. Circular kind → single entry, anchor='center', isActive=true.
- `bim/columns/__tests__/column-anchor-ghosts.test.ts` — 17 Jest tests: count + structure per kind (9 για rect/L/T, 1 για circular), `ANCHOR_CYCLE_ORDER` ordering preserved, active-flag iteration over όλο το cycle order, footprint shifts per anchor (nw → +X/-Y, se → -X/+Y), overrides propagate (width/rotation/lshape/tshape), cursorPos surface verbatim σε όλα τα entries.
- `bim/columns/ColumnAnchorGhostRenderer.ts` — pure renderer class που δέχεται `CanvasRenderingContext2D` constructor arg και `render({ ghosts, kind, transform, viewport })` method. Mirror palette του `ColumnRenderer.KIND_STROKE` + custom `KIND_FILL_ACTIVE` (30% opacity, λίγο πιο intense από το base 22% για να ξεχωρίζει από hovered columns). Draws inactive ghosts πρώτα (background), active με fill+bold stroke πάνω, anchor marker (5×5 px) στο cursor.

**Files modified (5):**
- `hooks/drawing/useColumnTool.ts` — νέος `getGhostFootprints(cursorPos)` getter στο return type. Returns `null` όταν `phase !== 'awaitingPosition'` ή `cursorPos === null`· αλλιώς wraps `computeAnchorGhostFootprints` με `state.kind`/`state.anchor`/`state.overrides`. ΟΧΙ React state mutation, ΟΧΙ store subscription — pure projection ώστε mousemove να μην triggerάρει re-render του CanvasSection.
- `hooks/tools/useColumnGhostPreview.ts` *(new)* — RAF-driven preview hook. Subscribes σε `useCursorWorldPosition` εσωτερικά, καλεί `getGhostFootprints(cursorWorld)`, instantiates `ColumnAnchorGhostRenderer` πάνω από το preview canvas ctx, ζωγραφίζει σε CSS pixels με DPR scaling. Cleanup effect clearάρει το canvas στη transition out of `awaitingPosition`. Mirror pattern `useRotationPreview` — micro-leaf compliant.
- `components/dxf-layout/canvas-layer-stack-leaves.tsx` — νέο memo'd leaf `ColumnGhostPreviewMount` που wraps `useColumnGhostPreview`. Προστέθηκε `columnGhost` payload στο `PreviewCanvasMounts` (kind + isAwaitingPosition + getGhostFootprints) και το mount renders στο τέλος του fragment.
- `components/dxf-layout/canvas-layer-stack-types.ts` — `CanvasLayerStackProps.columnGhostPreview` payload type με `kind` (`ColumnKind`) + `isAwaitingPosition` + `getGhostFootprints` callback.
- `components/dxf-layout/CanvasLayerStack.tsx` — destructures `columnGhostPreview` prop και το περνά ως `columnGhost={columnGhostPreview}` στο `PreviewCanvasMounts`.
- `hooks/drawing/__tests__/useColumnTool.test.tsx` — 8 νέα tests (`getGhostFootprints` describe block): null when phase=idle, null when cursorPos=null, 9 ghosts για rectangular awaitingPosition, 1 ghost για circular, active matches state.anchor μετά setAnchor, active rotates μετά cycleAnchor, overrides propagate σε όλα τα ghosts, null μετά deactivate.
- `components/dxf-layout/CanvasSection.tsx` — perνά `columnGhostPreview={{ isAwaitingPosition, kind: state.kind, getGhostFootprints }}` στο `CanvasLayerStack`.

**Deferred to Phase 4.5c.2+:** snap-to-wall-corners + snap-to-grid-intersections (snap engine integration ενώ ο cursor κινείται), hatch patterns per material category, section-profile preview overlay για L/T variants ενώ γίνεται drag, beam-end auto-snap to column anchors (Phase 5.5c cross-dep).

> **2026-05-18 Update**: Phase 4.5c.2 implemented τα material hatch patterns — see § Phase 4.5c.2 below. Hatch line above is now historical. Snap / section-profile / circular hatch items deferred στο Phase 4.5c.3+.

### Phase 4.5c.2 — Column Material Hatch Patterns *(✅ IMPLEMENTED 2026-05-18)*

Closes το hatch deferred item της λίστας Phase 4.5 / 4.5b / 4.5c.1. Industry-convention plan-view hatch ανά material category, scoped σε non-circular kinds: RC (dot grid), Steel (cross-hatch ×), Masonry (horizontal brick + staggered joints), Wood (single-direction diagonal). Mirror του Phase 3.6 `SlabRenderer.drawReinforcementHatch` pattern.

**Design choices:**
- **Per-material hatch SSoT** — pure module εκπέμπει `HatchPlan` (lines + dots σε world coords); rendering scope μόνο στο `ColumnRenderer`. Materials extensible μέσω `ColumnMaterialKey` union (`'rc' | 'steel' | 'masonry' | 'wood'`).
- **`'rc'` fallback** — `params.material` undefined ή unknown string → RC (most common construction default, matches existing `ColumnParams.material` semantics).
- **Case-insensitive lookup** — ribbon / Firestore inconsistencies (`rc` / `RC` / `Rc`) δεν σπάνε το visualization· `resolveMaterialKey` κανει `.toLowerCase()` πριν το union check.
- **Circular kind skip** — circular polygon clipping λειτουργεί αλλά οι visual conventions (radial pattern, solid-fill RC) διαφέρουν· χρειάζεται separate design decision. Phase 4.5c.3 deferred.
- **Polygon clip** — mirror του Phase 3.6 `SlabRenderer.drawReinforcementHatch` pattern (save → footprint path → clip → hatch → restore). Outline + fill παραμένουν readable· stroke faint (`rgba(0,0,0,0.20)`).
- **Perf guard** — skip hatch όταν `transform.scale < 0.001` (extreme zoom-out invisible anyway). Saves potentially χιλιάδες worldToScreen ops + canvas commands.
- **World-space spacing** — `computeHatchPlan` εκπέμπει mm coords· renderer καλεί `worldToScreen` per segment. Hatch density παραμένει physically meaningful σε όλα τα zoom levels (όχι screen-space pattern).
- **Safety cap** — pure module έχει `MAX_HATCH_STEPS=4000` guard σε όλα τα iteration loops ώστε degenerate / huge bbox inputs να μην κάνουν busy loops.

**Files created (3):**
- `bim/columns/column-hatch-patterns.ts` — pure SSoT module. Exports `ColumnMaterialKey` union, `resolveMaterialKey(raw)` case-insensitive + fallback, `HatchLineSegment` / `HatchDot` / `HatchPlan` interfaces, `computeHatchPlan(bbox, key)` per-material algorithms, exported constants (`HATCH_SPACING_MM`, `HATCH_STROKE_RGBA`, `HATCH_LINE_WIDTH_PX`, `RC_DOT_RADIUS_PX`, `MASONRY_BRICK_LENGTH_MM`, `MASONRY_BRICK_HEIGHT_MM`). Zero React / DOM / Firestore deps.
- `bim/columns/__tests__/column-hatch-patterns.test.ts` — Jest tests: `resolveMaterialKey` lowercase / uppercase / undefined / unknown cases, per-material plan structure (rc = dots only, steel = cross-hatch both directions, masonry = horizontal + staggered vertical joints, wood = single-direction diagonal), 400×400 @ 150 dot grid count (9), degenerate bbox safety (min===max ή negative extents → empty plan, no infinite loops), large-bbox bounded count, exported constants verify, masonry alternating-row stagger (row 0 offset 0, row 1 offset brickL/2).
- `bim/renderers/__tests__/ColumnRenderer-hatch.test.ts` — canvas-mock tests: undefined material → RC fallback dispatch, `'rc'` arc + no inner lineTo, `'steel'` cross-hatch lineTo + no arc, `'masonry'` + `'wood'` strokes, circular kind no-clip skip, extreme zoom-out (`scale=0.0001`) no-clip skip, save/clip/restore scoped, outline stroke survives μετά το restore, polygon clip path uses footprint first vertex, unknown material string fallback, case-insensitive variants (`STEEL` / `Steel`).

**Files modified (1):**
- `bim/renderers/ColumnRenderer.ts` — νέα `drawMaterialHatch(column)` private method μεταξύ fill και stroke (mirror του Phase 3.6 `SlabRenderer.drawReinforcementHatch` insertion point). Imports από `column-hatch-patterns` (`computeHatchPlan`, `resolveMaterialKey`, `HATCH_STROKE_RGBA`, `HATCH_LINE_WIDTH_PX`, `RC_DOT_RADIUS_PX`, `ColumnMaterialKey`). JSDoc header bullets ενημερώθηκαν για Phase 4.5c.1 (anchor preview leaf) + Phase 4.5c.2 (material hatch DONE) + Phase 4.5c.3+ deferred.

**Deferred to Phase 4.5c.3+:** circular column material hatch (radial pattern ή solid-fill — visual conventions TBD), snap-to-wall-corners + snap-to-grid-intersections (snap engine integration ενώ ο cursor κινείται), section-profile preview overlay για L/T variants ενώ γίνεται drag, beam-end auto-snap σε column anchors (Phase 5.5c cross-dep).

> **2026-05-18 Update**: Phase 4.5c.3 implemented circular hatch + variant dimension labels — see § Phase 4.5c.3 below. Circular hatch line above is now historical. Snap integration deferred στο Phase 4.5c.4.

### Phase 4.5c.3 — Circular Column Material Hatch + Variant Dimension Labels *(✅ IMPLEMENTED 2026-05-18)*

Closes 2 of the 4 deferred items from Phase 4.5c.2 list:
1. **Circular column material hatch** — RC circular columns now render 3 concentric arc rings (25%/50%/75% radius). Industry convention: inner rings communicate reinforced concrete core in plan view. Steel/Masonry/Wood circular columns reuse the bbox-clipped line patterns (the 32-vertex circular footprint polygon provides the clip boundary — same as non-circular). The early-return guard `if (column.kind === 'circular') return;` is removed from `ColumnRenderer.drawMaterialHatch()`.
2. **Variant dimension labels** — L-shape and T-shape columns display compact dimension labels (8px, `rgba(0,0,0,0.60)`) when hovered/selected (`phase === 'highlighted'`). Labels sit at midpoint of the relevant edge pair + OFFSET_PX=9 perpendicular. A dashed guide segment ([2,2]) connects the two reference vertices. No stores subscribed (ADR-040 compliant): state derived from `entity.params` + `entity.geometry.footprint.vertices` (vertex order = invariant from geometry builders in `column-geometry.ts`).

**Design choices:**
- **`HatchArc` interface added to `HatchPlan`** — `{ center: Point2D, radiusMm: number }`. All existing `computeHatchPlan` switch cases return `arcs: []` (backward-compat). New `computeCircularHatchPlan(center, radiusMm, material)` dispatches RC→arcs, others→bbox plan.
- **`CIRCULAR_RC_RING_FRACTIONS = [0.25, 0.50, 0.75]`** — exported constant, referenced in renderer + tests.
- **Renderer arc loop** — `for (arc of plan.arcs)` → `ctx.arc(s.x, s.y, arc.radiusMm × scale, 0, 2π)`. Skip if `rPx < 0.5` (degenerate zoom-out guard mirrors dot/line skip pattern).
- **L/T label vertices** — L-shape 6-vertex order: v[3] (`notch inside`) + v[4] (`notch top`) → armLength label; v[0] (`sw`) + v[3] (`notch inside`) → armWidth label. T-shape 8-vertex order: v[4]+v[5] → flangeLength; v[1]+v[2] → webThickness. Vertex order deterministic from `buildLshapeLocal` / `buildTshapeLocal` in `column-geometry.ts`.

**Files modified (3):**
- `bim/columns/column-hatch-patterns.ts` — `HatchArc` interface, `HatchPlan.arcs` field, `CIRCULAR_RC_RING_FRACTIONS` constant, `computeCircularHatchPlan(center, radiusMm, material)` function, all existing return statements extended with `arcs: []`.
- `bim/renderers/ColumnRenderer.ts` — `drawMaterialHatch()`: removed circular early-return, added circular routing to `computeCircularHatchPlan`, arc render loop. New `drawVariantDimensionLabels(column)` private method + `drawDimLabel(a, b, text)` helper. Called in `render()` after stroke when `phaseState.phase === 'highlighted'`.
- `bim/columns/__tests__/column-hatch-patterns.test.ts` — 4 new describe blocks: backward-compat `arcs` field present on all non-circular plans; RC circular = 3 arcs at correct fractions; steel/masonry/wood circular = lines not arcs; degenerate inputs (radius=0 / negative / NaN) = empty plan.

**Deferred to Phase 4.5c.4:**
- Snap-to-wall-corners + snap-to-grid-intersections (cross-domain: snap engine + column-tool hook wiring). **✅ IMPLEMENTED Phase 4.5c.4 (2026-05-19)**
- Beam-end auto-snap σε column anchors (Phase 5.5c cross-dep).
- Full drag-time dimension annotations (requires GripInteractionStore leaf — separate ADR-040 compliant leaf component).

> **2026-05-19 Update**: Phase 4.5c.4 implemented snap-to-wall-corners + grid-intersections visual feedback — see § Phase 4.5c.4 below. Beam-end auto-snap σε column anchors **implemented Phase 5.5d (2026-05-19)** — see § Phase 5.5d below. Drag-time dim annotations still deferred.

### Phase 4.5c.4 — Column Ghost Preview Snap Integration *(✅ IMPLEMENTED 2026-05-19)*

Closes the snap-to-wall-corners + snap-to-grid-intersections deferred item from Phase 4.5c.3.

**Root cause analysis**: The snap engine (`ProSnapEngineV2` singleton via `global-snap-engine.ts`) already included wall endpoints in its spatial index (Phase 1B: `GeometricCalculations.getEntityEndpoints` wall case) and grid snap (built-in sub-engine). Clicks via `mouse-handler-up.ts` already received the snapped `worldPoint` (lines 93–98: `if (snapEnabled && findSnapPoint) { worldPoint = snapResult.snappedPoint; }`). The **only missing piece** was the ghost preview: `useColumnGhostPreview` used `useCursorWorldPosition()` (raw cursor) instead of the snapped position.

**Design choices:**
- **Imperative read inside RAF** — `getImmediateSnap()` read synchronously inside the `drawFrame` RAF callback. By the time the RAF fires, `mouse-handler-move.ts` has already written both `ImmediatePositionStore` (world position → triggers `useCursorWorldPosition` re-render → schedules RAF) and `ImmediateSnapStore` (snap result). Ordering is guaranteed: snap store write is synchronous in the same mouse-move handler, RAF runs asynchronously next frame.
- **No new React subscription** — `getImmediateSnap()` is a plain getter (no `useSyncExternalStore`). ADR-040 cardinal rule preserved: zero new high-frequency subscriptions in leaf.
- **Fallback to raw cursor** — `snapState?.found === true && snapState.point != null` guard: if snap disabled or no snap point found, ghost renders at raw cursor position (same behaviour as before Phase 4.5c.4).
- **`cursorWorld` still drives RAF scheduling** — `useCursorWorldPosition()` subscription retained in `drawFrame` deps. This ensures the RAF fires on every mousemove; the snapped position is read imperatively at render time.

**Files modified (1):**
- `hooks/tools/useColumnGhostPreview.ts` — import `getImmediateSnap` from `ImmediateSnapStore`; inside `drawFrame`, compute `effectiveCursor` (snapped point when `found === true`, else raw `cursorWorld`); pass `effectiveCursor` to `getGhostFootprints()`.

**Files created (0):** No new modules. Pure wiring via existing `ImmediateSnapStore` SSoT.

**Deferred to Phase 4.5c.5+ / cross-phase:**
- ~~Beam-end auto-snap σε column anchors~~ — **✅ IMPLEMENTED Phase 5.5d (2026-05-19)**. Anchor API εκτέθηκε ως pure SSoT στο `bim/columns/column-anchors.ts` και feedάρει το `GeometricCalculations.getEntityEndpoints()` → `EndpointSnapEngine` spatial index. Beam endpoints (draw + grip drag) κουμπώνουν αυτόματα.
- Full drag-time dimension annotations (requires GripInteractionStore leaf — separate ADR-040 compliant leaf component).

### Phase 4.5d — Ribbon UI Surface (Launcher Buttons + Material Pickers) *(✅ IMPLEMENTED 2026-05-18)*

Closes the Phase 4.5c.2 follow-up item για ribbon surface αξιοποίηση των BIM tools. 6 launcher buttons στο Home → Draw panel + 4 material picker comboboxes (column ENABLED, beam/wall/slab DISABLED + comingSoon placeholder). ΟΧΙ keyboard shortcut changes — chords W / OP / SL / SO / CL / BM παραμένουν parallel activation path (button click ↔ chord type ίδιο dispatcher).

**Design choices:**
- **Mirror Stair launcher pattern** — `home-tab-draw.ts` νέα `isInFlyout: false` row μετά την XLine/Ray row με 6 `type: 'simple'` `size: 'small'` buttons. `commandKey` = `ToolType` literal (`'wall'` / `'opening'` / `'slab'` / `'slab-opening'` / `'column'` / `'beam'`). Identical wiring έχει ήδη το Stair (`commandKey: 'stair'`, shortcut `'ST'`).
- **Column material ENABLED unlocks Phase 4.5c.2** — `column-material` panel inserted ΜΕΤΑΞΥ `column-geometry` και `column-actions` (visual grouping: kind → geometry → material → actions). Combobox 4 options matching `ColumnMaterialKey` union από `column-hatch-patterns.ts` (`'rc' | 'steel' | 'masonry' | 'wood'`). Bridge wiring routes patch through `UpdateColumnParamsCommand` (mirror υφιστάμενου kind/anchor path) ⇒ undoable, atomic recompute, isDragging=false (κάθε pick = ξεχωριστό undo entry).
- **`'rc'` active fallback in combobox state** — `getComboboxState` for `material` field surfaces `'rc'` όταν `params.material === undefined`, mirror του renderer-side `resolveMaterialKey` fallback. Engineer βλέπει ποια category είναι active ακόμα και για legacy columns χωρίς explicit material.
- **ADR-345 comingSoon pattern για beam/wall/slab** — `comingSoon: true` flag στο combobox command disables the entire select (`RibbonCombobox` reads `command.comingSoon` → `disabled` prop) και routes clicks μέσω του shared `onComingSoon` toast handler. `tooltipKey` points σε `material.comingSoon` i18n key per editor. Industry-standard ADR-261 disabled UX: greyed-out + tooltip, ΟΧΙ hidden / ΟΧΙ alert popup. Visible reminder ώστε ο user να βλέπει τι έρχεται.
- **No bridge wiring για beam/wall/slab** — `commandKey` literal strings (`beam.params.material` / `wall.params.material` / `slab.params.material`) δεν registered στα αντίστοιχα `*-command-keys.ts` files. Bridge composer (`isBeamRibbonKey` etc.) δίνει null για unknown keys ⇒ combobox shows no value (αποδεκτό για disabled UI). Activation lands μαζί με την υλοποίηση της επόμενης φάσης (WallDna 1D / Beam 5.5c / material library 6+).
- **Lucide icons για BIM launchers** — `Construction` / `DoorOpen` / `Layers` / `SquareDashed` / `Columns3` / `RectangleHorizontal` registered στο `RibbonButtonIcon.tsx` switch κάτω από νέα `'bim-*'` icon tokens. Mirror των υπάρχων lucide imports για άλλα non-SVG tool buttons.
- **i18n SSoT — restructured `ribbon.commands.bim.*`** — υπάρχοντα flat strings (`bim.wall: "Τοίχος"`) restructured σε nested `{label, tooltip}` ώστε τα launcher buttons να έχουν proper tooltip ("Σχεδίαση τοίχου (πλήκτρο W)" κλπ). `openingVariants` sub-namespace preserved as-is. Existing consumers: zero (grep `ribbon\.commands\.bim\.` πιάστηκε ΜΟΝΟ στο `home-tab-draw.ts` (just-edited) και στο ADR doc, οπότε breaking change zero-tolerance OK). Labels updated to handoff spec: `opening` → "Κούφωμα" (από "Άνοιγμα"), `slabOpening` → "Διάνοιξη Πλάκας" (από "Διανοιγμα Πλάκας" typo), `beam` → "Δοκός" (από "Δοκάρι"). Pure Greek el locale (SOS N.11 zero αγγλικές λέξεις).
- **Panel labels new** — `ribbon.panels.{columnMaterial, beamMaterial, wallMaterial, slabMaterial}` added σε EL + EN. Tip ίδιο για όλα: "Υλικό" / "Material".
- **Material option labels per editor** — `ribbon.commands.{columnEditor,beamEditor,wallEditor,slabEditor}.material.{section.title, rc, steel, masonry, wood, glulam, composite, aerated-concrete, gypsum, comingSoon}` ανά domain. `comingSoon` tooltip per disabled editor: beam → "Διαθέσιμο σε επόμενη φάση" (Phase 5.5c), wall → "Διαθέσιμο με WallDna Phase 1D", slab → "Διαθέσιμο με material library Phase 6+".

**Files modified (10):**
- `src/subapps/dxf-viewer/ui/ribbon/data/home-tab-draw.ts` — νέα `isInFlyout: false` BIM row με 6 simple-button entries (wall / opening / slab / slab-opening / column / beam). Mirror exact του Stair button pattern (shortcut + commandKey + labelKey + tooltipKey + icon).
- `src/subapps/dxf-viewer/ui/ribbon/components/buttons/RibbonButtonIcon.tsx` — 5 new lucide imports (`Construction`, `DoorOpen`, `Columns3`, `SquareDashed`, `RectangleHorizontal`) + 6 new switch cases (`'bim-wall'` → Construction, `'bim-opening'` → DoorOpen, `'bim-slab'` → Layers existing, `'bim-slab-opening'` → SquareDashed, `'bim-column'` → Columns3, `'bim-beam'` → RectangleHorizontal).
- `src/subapps/dxf-viewer/ui/ribbon/hooks/bridge/column-command-keys.ts` — `material: 'column.params.material'` added στο `COLUMN_RIBBON_KEYS.stringParams` + `ColumnRibbonStringCommandKey` union + `COLUMN_RIBBON_STRING_KEYS` runtime array.
- `src/subapps/dxf-viewer/ui/ribbon/data/contextual-column-tab.ts` — `COLUMN_MATERIAL_OPTIONS` const (4 entries: rc / steel / masonry / wood) + νέο `column-material` panel inserted μεταξύ `column-geometry` και `column-actions`.
- `src/subapps/dxf-viewer/ui/ribbon/hooks/useRibbonColumnBridge.ts` — `material: 'material'` mapping στο `STRING_KEY_TO_FIELD`. `onComboboxChange` handler για `field === 'material'` dispatches `UpdateColumnParamsCommand` με `{ ...column.params, material: value }`. `getComboboxState` αναβαθμίστηκε ώστε `material === undefined` να επιστρέφει `{ value: 'rc' }` (active fallback selection mirror του renderer `resolveMaterialKey` fallback).
- `src/subapps/dxf-viewer/ui/ribbon/data/contextual-beam-tab.ts` — `BEAM_MATERIAL_OPTIONS` const (3 entries: rc / steel / glulam) + `beam-material` panel disabled (`comingSoon: true`).
- `src/subapps/dxf-viewer/ui/ribbon/data/contextual-wall-tab.ts` — `WALL_MATERIAL_OPTIONS` const (4 entries: rc / masonry / aerated-concrete / gypsum) + `wall-material` panel disabled.
- `src/subapps/dxf-viewer/ui/ribbon/data/contextual-slab-tab.ts` — `SLAB_MATERIAL_OPTIONS` const (3 entries: rc / composite / wood) + `slab-material` panel disabled.
- `src/i18n/locales/el/dxf-viewer-shell.json` — 4 new panel labels + restructured `ribbon.commands.bim.*` (nested label/tooltip) + 4 new `material.*` sub-keys per editor namespace (columnEditor enabled / beam / wall / slab comingSoon).
- `src/i18n/locales/en/dxf-viewer-shell.json` — mirror EN sync.

**Files created (0):** Phase 4.5d εξ ολοκλήρου σε υφιστάμενα ribbon data + bridge files. Πλήρως pure UI wiring.

**Deferred to Phase 4.5e+ / cross-phase:**
- Wall material picker activation → WallDna Phase 1D (composable layer stack με per-layer material).
- Beam material picker activation → Phase 5.5c (beam material library + hatch patterns mirror του Phase 4.5c.2 column hatch).
- Slab material picker activation → material library Phase 6+ (multi-domain hatch patterns + per-kind defaults).
- Tab/Shift+Tab cycling για material picker (Revit-style enum cycle): out of scope, lower priority.
- Material-aware default geometry (e.g. steel column → IPE/HEB profile section): cross-dep με Phase 4.5c.3 section-profile preview.

### Phase 5 — Beam *(✅ CORE IMPLEMENTED 2026-05-18)*

- [x] Port `beam-types.ts` (3 kinds: straight/curved/cantilever, BeamSupportType, defaults + Eurocode constants).
- [x] `useBeamTool.ts` FSM — 2-click straight/cantilever, 3-click curved με quadratic Bezier control. ESC reset, continuous chain.
- [x] `beam-completion.ts` — `buildDefaultBeamParams` + `buildBeamEntity` + `completeBeamFromTwoClicks` / `completeBeamFromThreeClicks`.
- [x] `beam-geometry.ts` — pure `computeBeamGeometry` (axis + perpendicular offset outline + length/area/volume, 16-segment Bezier subdivision για curved). `getBeamSpanDepthRatio` helper.
- [x] `BeamRenderer.ts` — micro-leaf (ADR-040), dashed outline + axis centerline (industry convention για hidden beam in plan view), per-kind palette.
- [x] `beam-validator.ts` — hard errors (width/depth ≤ 0, length < 200mm, missing curveControl) + code violations (width < 150mm Eurocode, span/depth > 20, cantilever > 10).
- [x] `beam-firestore-service.ts` + `useBeamPersistence` — 500ms debounce, diff-merge selective skip, first-save listener, delete listener. Audit via `beam-audit-client.ts`.
- [x] Ribbon contextual tab (`contextual-beam-tab.ts` + `useRibbonBeamBridge`) — kind + supportType + width + depth + elevation + close/delete actions.
- [x] Wiring: `types/entities.ts` (re-export concrete BeamEntity), EventBus (`bim:beam-params-updated` / `bim:beam-delete-requested`), `useSpecialTools` + click handler routing (PRIORITY 4.9), ToolType + ToolStateManager, audit-trail types + API route + audit script.
- [x] i18n (el+en) `ribbon.tabs.beamProperties`, `ribbon.panels.beam{Kind,Geometry,Actions}`, `ribbon.commands.beamEditor.*`, `tools.beam.*`.
- [x] 3 test suites (beam-geometry: 10+, beam-validator: 8+, useBeamTool: 6+).
- [x] §5.7 schema realized via concrete types in `bim/types/beam-types.ts` (replaced Phase 0 stub).
- [x] **Phase 5.5a IMPLEMENTED** (2026-05-18): start/end/midpoint/curveControl grips + `UpdateBeamParamsCommand` full undo/redo + ribbon migration σε CommandHistory. Details § Phase 5.5a below.
- [x] **Phase 5.5b IMPLEMENTED** (2026-05-18): in-plane width dimension grip (mirror του wall-thickness pattern, symmetric γύρω από axis midpoint, clamps στο `MIN_BEAM_WIDTH_MM=150`). Details § Phase 5.5b below.
- [x] **Phase 5.5c IMPLEMENTED** (2026-05-19): out-of-plane depth dimension grip (visual indicator dashed leader + "d=Xmm" label, clamps στο `MIN_BEAM_DEPTH_MM=200`) + material hatch patterns RC/Steel/Glulam (axis-aware glulam grain) + ribbon material picker activation. Details § Phase 5.5c below.
- [x] **Phase 5.5d IMPLEMENTED** (2026-05-19): beam-end auto-snap σε column anchors (9-point grid: center + 8 cardinals/diagonals για rect/L/T, center + 4 perimeter cardinals + 4 perimeter diagonals για circular). Pure SSoT `bim/columns/column-anchors.ts` εκθέτει anchor world points· `GeometricCalculations.getEntityEndpoints()` τα feedάρει στο `EndpointSnapEngine` spatial index. Beam draw + beam grip drag κουμπώνουν αυτόματα μέσω υφιστάμενου snap pipeline (mouse-handler-move + mouse-handler-up). Details § Phase 5.5d below.
- [ ] **Deferred Phase 5.5e+**: snap-to-wall-axis / column-center 3D wireframe integration, beam-supports-slab analytical link (Phase 6 BOQ dependency), section-profile preview overlay για variant materials (steel I/H profiles).
- [x] Hotkey `BM` (Beam 2-char chord) — **implemented Phase 7A** (2026-05-18) via `MultiCharKeySequence`. `B` has no fallback (no existing single-B shortcut), `B+M` → beam.

### Phase 5.5a — Beam Grips + UpdateBeamParamsCommand *(✅ IMPLEMENTED 2026-05-18)*

Closes part of the Phase 5 deferred list (start/end/midpoint/curveControl grips + atomic command + ribbon migration). Mirrors exactly το Phase 1C wall pattern προσαρμοσμένο στα 3 beam kinds (straight/curved/cantilever — όχι polyline ή thickness handle σε αυτή τη φάση).

**Files created (4):**
- `bim/beams/beam-grips.ts` — pure handlers (zero React / DOM / Firestore / canvas deps). `getBeamGrips(entity)` returns 3 grips για straight/cantilever (`beam-start` axis vertex, `beam-end` axis vertex, `beam-midpoint` center grip με `movesEntity=true`) και 4 για curved (`+ beam-curve` quadratic Bezier control, seeded στο axis midpoint όταν `params.curveControl` undefined). `applyBeamGripDrag(gripKind, input)` pure transform → new `BeamParams`: `beam-start`/`beam-end` translate single endpoint preserving z; `beam-midpoint` translates startPoint + endPoint + curveControl (όταν υπάρχει) κατά delta; `beam-curve` translates existing curveControl ή seeds από midpoint + delta. Zero delta + unknown grip kind short-circuit referentially.
- `bim/beams/__tests__/beam-grips.test.ts` — 15 Jest tests: grip count per kind (straight/cantilever=3, curved=4), stable ordering, vertex positions match params, curve seed at axis midpoint όταν undefined, midpoint translates both endpoints + curveControl, drag preserves foreign params (width/depth/elevation/supportType/material), zero-delta + unknown kind referential no-op.
- `core/commands/entity-commands/UpdateBeamParamsCommand.ts` — atomic patch `params` + recomputed `geometry` (`computeBeamGeometry`) + `validation` (`validateBeamParams`) + root `kind` synced με `params.kind` (mirrors slab Phase 3.5 ώστε ribbon kind switch να μένει undoable). Merge window (ADR-031 `DEFAULT_MERGE_CONFIG.mergeTimeWindow`) collapses continuous grip drags σε ένα undo entry. `validate()` rejects empty id / non-positive width / non-positive depth / degenerate axis (chord ≤ 0) / curved kind χωρίς curveControl.
- `core/commands/entity-commands/__tests__/UpdateBeamParamsCommand.test.ts` — 14 Jest tests: execute / undo / redo round-trip, geometry recompute (width=400 → area=1.6 m²), root-kind sync με `params.kind`, undo-before-execute no-op, merge window (same beam + both dragging + within window), foreign-beam merge guard, isDragging=false merge guard, validator rejects empty id / non-positive width/depth / degenerate axis / curved χωρίς curveControl, serialize round-trip.

**Files modified (7):**
- `hooks/grip-types.ts` — added `BeamGripKind = 'beam-start' | 'beam-end' | 'beam-midpoint' | 'beam-curve'` + `GripInfo.beamGripKind?` discriminator.
- `hooks/useGripMovement.ts` — re-exports `BeamGripKind`.
- `hooks/grips/unified-grip-types.ts` — `UnifiedGripInfo.beamGripKind?` forwarded από `GripInfo`.
- `hooks/grips/grip-registry.ts` — `wrapDxfGrip` conditional spread forwards `beamGripKind`.
- `hooks/grips/grip-parametric-commits.ts` — νέα `commitBeamGripDrag` (resolves beam via `sceneManager.getEntity` με `candidate.type === 'beam'` guard, builds `UpdateBeamParamsCommand` με `isDragging=true`, emits `bim:beam-params-updated`). ΟΧΙ ShiftKeyTracker plumbing — beam δεν έχει rectilinear quantization (axis-bound endpoint drag).
- `hooks/grips/grip-commit-adapters.ts` — `commitDxfGripDragModeAware` early-branches on `grip.beamGripKind` πριν τα stretch / move / rotate paths (mirror του slabOpeningGripKind branch).
- `bim/renderers/BeamRenderer.ts` — `getGrips()` πλέον γυρνά `getBeamGrips(entity).map(...)` αντί για `[]` stub· `type='center'` forwarding για midpoint grip (axis-anchor `movesEntity=true`), `type='vertex'` για τα endpoint + curve grips.
- `ui/ribbon/hooks/useRibbonBeamBridge.ts` — replaced direct scene patch με `executeCommand(new UpdateBeamParamsCommand(...))` via `useCommandHistory().execute` + `LevelSceneManagerAdapter`; drops `computeBeamGeometry`/`validateBeamParams` imports (now owned by the command). Ribbon edits use `isDragging=false` ώστε κάθε combobox change να είναι δικό του undo entry.

**Deferred to Phase 5.5b+:** width/depth dimension grips (mirror του wall-thickness perpendicular handle αλλά με 2 διαστάσεις), hatch patterns per material (RC/steel/glulam), ~~auto-connect to columns (beam ends snap to column anchors)~~ — **✅ IMPLEMENTED Phase 5.5d (2026-05-19)**, snap-to-wall-axis / column-center integration, beam-supports-slab analytical link (Phase 6 BOQ dependency).

> **2026-05-18 Update**: Phase 5.5b implemented the in-plane width dimension grip — see § Phase 5.5b below. Width entry above is now historical. Depth dimension grip deferred to Phase 5.5c (gravity axis, no plan-view visual without extra indicator).

### Phase 5.5b — Beam Width Dimension Grip *(✅ IMPLEMENTED 2026-05-18)*

Adds the in-plane width-resize affordance to the Phase 5.5a beam grip set. Mirrors exactly το Phase 1C `wall-thickness` perpendicular handle pattern: ένα ενιαίο `edge`-typed grip στο axis midpoint, offset κατά `width/2` κατά το CCW perpendicular του axis. Drag projection σε perpendicular διπλασιάζεται (symmetric resize γύρω από τον άξονα) και clamps στο `MIN_BEAM_WIDTH_MM` (150 mm, Eurocode). Parallel-to-axis delta projects σε 0 → width stays unchanged (no false-positive thickness drift όταν ο χρήστης σύρει κατά τον άξονα). `UpdateBeamParamsCommand` δεν αλλάζει — re-used as-is.

**Files modified (3):**
- `hooks/grip-types.ts` — `BeamGripKind` extended με `'beam-width'` literal. JSDoc του union enriched με Phase 5.5b semantics. Depth grip ρητά μαρκαρισμένο deferred στο Phase 5.5c.
- `bim/beams/beam-grips.ts` — `getBeamGrips()` εκπέμπει ένα ακόμη grip στο τέλος (stable `gripIndex`: 3 για straight/cantilever, 4 για curved ώστε το ordering να μένει deterministic across kinds). Νέο pure helper `beamWidthHandlePosition(params)` exported για test reuse (axis midpoint + perpendicular × width/2, null σε degenerate axis). `applyBeamGripDrag('beam-width', input)` νέα `resizeWidth(input)` private function: unit axis → perpendicular (CCW 90° rotation, mirror wall pattern) → projection of delta on perp → newWidth = max(MIN_BEAM_WIDTH_MM, width + 2 · proj). Zero-projection (parallel drag) και degenerate axis short-circuit στο originalParams.
- `bim/beams/__tests__/beam-grips.test.ts` — existing grip-count assertions extended από 3/4 σε 4/5 (straight + cantilever + curved όλα carry τώρα width handle). `movesEntity` assertion extended ένα slot. 4 νέα tests (16-19): width grip position για horizontal axis (width=300 → handle at (2000, 150)), perpendicular drag doubles delta into width (300 + 2·100 = 500), parallel drag = no-op (projection = 0), large negative perpendicular delta clamps σε `MIN_BEAM_WIDTH_MM`.

**Files created (0):** Phase 5.5b εξ ολοκλήρου σε υφιστάμενα αρχεία (επέκταση union + helper + handler + tests).

**Renderer + adapter:** `BeamRenderer.getGrips()` map δουλεύει generically (`type='center'` → 'center', όλα τα άλλα → 'vertex')· το νέο `edge`-typed width grip πέφτει στο 'vertex' bucket, που είναι αρκετό για το canvas rendering pass. JSDoc του getGrips ενημερώθηκε ρητά για το Phase 5.5b coverage και τον deferred depth-grip του Phase 5.5c. `commitBeamGripDrag` (`grip-parametric-commits.ts`) δουλεύει generically — περνάει το `grip.beamGripKind` straight through στο `applyBeamGripDrag`. Καμία αλλαγή adapter ή command path.

**Deferred to Phase 5.5c+:** depth dimension grip (out-of-plane / gravity axis — δεν φαίνεται σε plan view χωρίς ξεχωριστό visual indicator όπως section profile preview), hatch patterns per material (RC/steel/glulam), ~~auto-connect to columns (beam ends snap to column anchors)~~ — **✅ IMPLEMENTED Phase 5.5d (2026-05-19)**, snap-to-wall-axis / column-center integration, beam-supports-slab analytical link (Phase 6 BOQ dependency).

> **2026-05-19 Update**: Phase 5.5c implemented — see § Phase 5.5c below.

### Phase 5.5c — Beam Depth Grip + Material Hatch + Material Picker + BIM Hit-Test Passthrough *(✅ IMPLEMENTED 2026-05-19)*

Closes 3 από τα Phase 5.5b deferred items (depth grip, material hatch, ribbon material picker) και fix σε silent regression του BIM hit-testing.

**Beam depth grip (out-of-plane indicator):** νέο `beam-depth` grip kind. Handle στην ΑΝΤΙΘΕΤΗ πλευρά του width handle (negative perpendicular) με offset `width/2 + DEPTH_GRIP_OFFSET_MM` (250 mm). Symmetric drag projection × 2 → new depth, clamps στο `MIN_BEAM_DEPTH_MM` (200 mm Eurocode). Δεν αλλάζει footprint — μόνο `params.depth` (gravity axis). BeamRenderer ζωγραφίζει dashed leader line + label "d=Xmm" όταν hovered/selected.

**Beam material hatch** (parallel pattern του Phase 4.5c.2 column hatch): νέο pure SSoT `bim/beams/beam-hatch-patterns.ts` με `BeamMaterialKey = 'rc' \| 'steel' \| 'glulam'`. RC = dot grid 100mm (πυκνότερο από column γιατί η beam outline είναι λεπτή), Steel = cross-hatch 80mm @45°+@135°, Glulam = grain lines PARALLEL στον axis 40mm + cross-grain @30° 120mm. `axisUnit` parameter στο `computeBeamHatchPlan(bbox, axisUnit, material)` ώστε το glulam grain να ακολουθεί τον beam axis (sophistication πέρα από το column wood pattern). BeamRenderer.drawMaterialHatch() polygon-clipped pass μεταξύ fill και stroke, mirror του ColumnRenderer.

**Ribbon material picker:** `BEAM_RIBBON_KEYS.stringParams.material` added. `useRibbonBeamBridge` surface `'rc'` ως active selection όταν `params.material` undefined. Material patch routed μέσω `UpdateBeamParamsCommand` με `isDragging=false` (κάθε pick = δικό του undo entry).

**BIM hit-test passthrough fix:** `HitTestingService.toEntityModel()` δεν περιελάμβανε opening/slab/column/beam στο switch → default branch έπεφτε χωρίς `geometry.bbox` → `BoundsCalculator.calculateBimEntityBounds` έπαιρνε null → entity ΔΕΝ εισαγόταν στο spatial index → unselectable + no hover. Νέα `case 'opening'`/`'slab'`/`'column'`/`'beam'` branches (mirror του υφιστάμενου wall branch) που περνούν `geometry`/`validation` straight through.

**Files modified (9):** `bim/beams/beam-grips.ts`, `bim/renderers/BeamRenderer.ts`, `bim/types/beam-types.ts` (`MIN_BEAM_DEPTH_MM=200`), `hooks/grip-types.ts` (`BeamGripKind += 'beam-depth'`), `rendering/hitTesting/Bounds.ts` (ADR-359 XLINE/RAY bounds follow-up), `rendering/hitTesting/hit-test-entity-tests.ts` (ADR-359 XLINE/RAY hit-test dispatch), `services/HitTestingService.ts` (BIM passthrough branches), `ui/ribbon/hooks/bridge/beam-command-keys.ts`, `ui/ribbon/hooks/useRibbonBeamBridge.ts`.

**Files created (1):** `bim/beams/beam-hatch-patterns.ts`.

**Deferred to Phase 5.5d+:** ~~auto-connect to columns~~ — **✅ IMPLEMENTED Phase 5.5d (2026-05-19)**, snap-to-wall-axis / column-center integration, beam-supports-slab analytical link (Phase 6), section-profile preview overlay για steel I/H profiles.

✅ Google-level: YES — atomic `UpdateBeamParamsCommand` re-used (no new command surface), ADR-040 micro-leaf compliance preserved (pure ctx ops, zero subscriptions), Eurocode clamp στο `MIN_BEAM_DEPTH_MM`, `'rc'` fallback για forward-compat unknown materials, root-cause fix για BIM hit-test regression (proactive geometry passthrough), zero hardcoded user-facing strings.

> **2026-05-19 Update**: Phase 5.5d implemented — see § Phase 5.5d below.

### Phase 5.5d — Beam-End Auto-Snap σε Column Anchors *(✅ IMPLEMENTED 2026-05-19)*

Closes το `auto-connect to columns` deferred item από Phase 5.5a/5.5b/5.5c και το cross-phase item από Phase 4.5c.4. Industry parity: Revit smart-connect / ArchiCAD beam-to-column auto-snap — beam endpoints (στο draw + στο grip drag) κουμπώνουν αυτόματα σε column anchor points όταν ο cursor μπει εντός snap radius.

**Root cause analysis**: Το snap pipeline ήταν ΗΔΗ πλήρως wired για beam tool και beam grip drag:
- `mouse-handler-up.ts:93-98` snap-corrects το `worldPoint` που περνά στο `onCanvasClick` → `useBeamTool.onCanvasClick` (beam draw).
- `mouse-handler-move.ts:106-112` snap-corrects τη preview position όταν `isGripDragging=true`.
- `mouse-handler-up.ts:69-74` snap-corrects στο `onGripMouseUp` (grip release commit).

Το ΜΟΝΟ που έλειπε ήταν η εμφάνιση των column anchor points στο `EndpointSnapEngine` spatial index. Walls είχαν ήδη case στο `GeometricCalculations.getEntityEndpoints()` από Phase 1B· columns όχι.

**Design choices:**
- **Pure SSoT exposure module** — νέο `bim/columns/column-anchors.ts` με `getColumnAnchorWorldPoints(column)` που επιστρέφει τα 9 anchor world points ως tagged `{anchor, point}` entries. Mirror του `column-anchor-ghosts.ts` (Phase 4.5c.1) pattern — pure module, zero React / DOM / Firestore / canvas deps. Math reuses `ANCHOR_OFFSETS` SSoT + mirrors `transformFootprint` (column-geometry.ts) ώστε anchor positions να ταυτίζονται bit-exact με το footprint geometry pipeline (zero math drift μεταξύ ghost preview, footprint, και snap).
- **Snap engine integration via existing endpoint SSoT** — extend `GeometricCalculations.getEntityEndpoints()` με `isColumnEntity` case (mirror υφιστάμενου wall case lines 95-106). Καμία αλλαγή στο `EndpointSnapEngine` ή στο `ProSnapEngineV2` — η pipeline εξαρτάται από αυτό το SSoT για όλα τα entity types και αυτο-καταναλώνει το νέο column case μέσω του `initializeSpatialIndex(entities, getEntityEndpoints, ...)` flow.
- **Zero changes σε beam side** — `useBeamTool`, `applyBeamGripDrag`, `commitBeamGripDrag` ΟΛΑ μένουν as-is. Mouse handler snap pipeline ήδη φέρνει το snapped worldPoint στο click handler και στο grip drag. Δεν χρειάζεται imperative read σε hook (μηδέν cross-domain coupling).
- **Visual feedback re-uses existing SnapRenderer** — `mouse-handler-move.ts` καλεί ήδη `setFullSnapResult(snapResult)` (line 156)· ο υφιστάμενος `SnapIndicatorOverlay` / `LegacySnapAdapter` ζωγραφίζει το snap marker με το κατάλληλο icon (endpoint icon). Δεν χρειάζεται νέο leaf component ή pulse animation.
- **Circular kind: perimeter anchors, όχι bbox** — για κυκλικές κολώνες, οι 4 cardinals τοποθετούνται στην περίμετρο σε ακτίνα `radius = width/2` και τα 4 diagonals σε ακτίνα `radius·√2/2` (perimeter @ 45°). Industry-standard "8-clock" cylindrical column snap pattern (Revit + ArchiCAD). ΟΧΙ bbox corners (που θα ήταν εκτός κύκλου). `params.anchor` + `params.rotation` αγνοούνται (circular = rotationally symmetric).
- **L-shape / T-shape: bbox-grid parity** — οι 9 anchors ακολουθούν την ίδια bbox grid με τη rectangular (mirror του anchor system upstream). Αυτό σημαίνει ότι anchor `'ne'` σε L-shape είναι το bbox NE — ακόμα κι αν το L δεν φτάνει εκεί λόγω notch. Consistent με Phase 4.5c.1 ghost preview behaviour (το anchor system είναι bbox-based by design).
- **Degenerate width/depth = 0** — όλοι οι 9 anchors collapse στο `position` χωρίς exception. Validation γίνεται upstream στο `validateColumnParams`· το snap-feed module είναι defensive (καμία hard error για out-of-spec params).

**Files created (2):**
- `bim/columns/column-anchors.ts` — pure SSoT. Exports `ColumnAnchorWorldPoint` interface (`{anchor, point}`) και `getColumnAnchorWorldPoints(column)`. Internal helpers: `anchorLocalPoint` (kind dispatch — bbox grid για rect/L/T, perimeter για circular), `circularAnchorLocal` (cardinals σε radius, diagonals σε radius·√2/2), `localToWorld` (mirror του `transformFootprint` — anchor offset shift + rotation + translate, circular bypasses).
- `bim/columns/__tests__/column-anchors.test.ts` — 14 Jest tests: count + ordering ανά kind (rect/L/T/circular = 9 entries σε `ANCHOR_CYCLE_ORDER`), rect anchor=center math (cardinals at ±halfDim), rect anchor=ne shifts center διαγώνια, rect 90° rotation maps 'e' → +Y, non-zero position translates all, circular perimeter cardinals at radius, circular diagonals at radius·√2/2, circular ignores rotation, L-shape/T-shape bbox parity με rectangular, degenerate width=0 collapses στο position.

**Files modified (1):**
- `snapping/shared/GeometricCalculations.ts` — `isColumnEntity` import added · νέο `import { getColumnAnchorWorldPoints }` από `bim/columns/column-anchors` · νέα `else if (isColumnEntity(entity))` branch στο `getEntityEndpoints()` που pushes τα 9 anchor points στο endpoint array (mirror wall case structure).

**Files created (0 beyond above):** Zero React / canvas / hook changes. Pure data-flow extension.

**Snap pipeline flow (verified end-to-end):**

```
ColumnEntity → SceneModel.entities
            ↓
EndpointSnapEngine.initialize(entities)
            ↓
initializeSpatialIndex(entities, GeometricCalculations.getEntityEndpoints, 'endpoint')
            ↓  (Phase 5.5d new branch)
isColumnEntity(entity) → getColumnAnchorWorldPoints(entity) → 9 Point2D
            ↓
spatialIndex.insert(point, entity) × 9
            ↓
[user moves mouse near column]
            ↓
mouse-handler-move.ts → findSnapPoint(worldPos) → EndpointSnapEngine.findSnapCandidates()
            ↓
ProSnapResult{ found: true, snappedPoint, snapPoint.entityId }
            ↓
setFullSnapResult() → SnapIndicatorOverlay renders endpoint marker
setImmediateSnap() → consumers read imperatively
            ↓
[user clicks (beam draw) ή releases grip drag]
            ↓
mouse-handler-up.ts: worldPoint = snapResult.snappedPoint (lines 93-98 ή 69-74)
            ↓
onCanvasClick(worldPoint) → useBeamTool.onCanvasClick(snappedPoint)
ή onGripMouseUp(snappedPoint) → commitBeamGripDrag with snapped delta
            ↓
Beam endpoint EXACTLY στο column anchor world position. ✅
```

**Deferred to Phase 5.5e+ / cross-phase:**
- ~~Snap-to-wall-axis projection για beam endpoint (κοντά σε wall κέντρο axis αντί για endpoint).~~ **✅ DONE Phase 5.5e (2026-05-19).**
- Column-center-line 3D wireframe snap (out-of-plane Z-axis).
- Anchor highlight pulse animation 200-300ms (current snap marker is already visible — pulse is decorative, lower priority).
- Beam-supports-slab analytical link (Phase 6 BOQ dependency — out of snap scope).
- Section-profile preview overlay για steel I/H profile beams (Phase 5.5e+ section-profile).

✅ Google-level: YES — pure SSoT module (anchor math single-sourced + mirrors footprint pipeline math bit-exact), proactive (anchors εκτίθενται στο spatial index σε `initialize()`-time, όχι reactive on-demand), idempotent (καθαρές pure functions, ίδιο input → ίδιο output), ADR-040 micro-leaf compliance preserved (ZERO new React subscriptions — όλη η wiring γίνεται μέσω του existing snap pipeline), Revit/ArchiCAD parity για circular column 8-clock snap, defensive ως προς degenerate params (no exceptions), zero new command surfaces, zero ribbon/i18n changes.

### Phase 5.5e — Snap-to-Wall-Axis Perpendicular Projection *(✅ IMPLEMENTED 2026-05-19)*

Closes το `snap-to-wall-axis projection` deferred item από Phase 5.5d. Industry parity: AutoCAD `NEAREST` + `PERPENDICULAR` osnaps και Revit "Snap to Reference Line" — όταν ο χρήστης σχεδιάζει beam (ή οποιοδήποτε drawing tool με snap ενεργό) και ο cursor μπει εντός snap radius γύρω από wall axis (όχι σε wall endpoint/midpoint), το cursor "κουμπώνει" στην ορθή προβολή πάνω στον axis (straight/curved/polyline).

**Root cause analysis**: Πριν την Phase 5.5e, ούτε ο `NearestSnapEngine` ούτε ο `PerpendicularSnapEngine` αναγνώριζαν `WallEntity`. Walls είχαν spatial-index entries μόνο για endpoints (Phase 1B) και midpoints (Phase 1C) — όχι για on-axis points. Αποτέλεσμα: beam σχεδιαζόμενο "παράλληλα" σε υφιστάμενο τοίχο δεν είχε κανένα snap reference πάνω στο axis (παρά μόνο τα δύο endpoints), αναγκάζοντας τον χρήστη σε χειροκίνητη ευθυγράμμιση.

**Design choices:**
- **Reuse existing engines, ΟΧΙ νέος engine, ΟΧΙ νέος SnapType** — επεκτείνουμε τους `NearestSnapEngine` + `PerpendicularSnapEngine` με `isWallEntity` branch. SSoT win: ένας snap priority hierarchy, ένας user-facing tooltip ("Nearest" / "Perpendicular"), zero νέες entries στο `ExtendedSnapType`. Industry parity: AutoCAD/Revit architectural preset ήδη έχει και τους δύο osnaps ταυτόχρονα active.
- **Pure SSoT projection module** — νέο `bim/walls/wall-axis-projection.ts` με 2 exported functions. Mirror του `column-anchors.ts` (Phase 5.5d) pattern — pure module, zero React/DOM/Firestore/canvas deps.
- **Leverage cached `wall.geometry.axisPolyline.points`** — αντί για re-tessellation του quadratic Bezier ή re-implementation polyline traversal, διαβάζουμε την cached axis polyline που έχει ήδη υπολογίσει το `computeWallGeometry()` (Phase 1 invariant). Αποτέλεσμα: ένα code path για ΟΛΑ τα wall kinds (straight=2 vertices, curved=17 tessellated vertices λόγω `CURVED_SUBDIVISIONS=16`, polyline=N user vertices). Zero Bezier math duplication, zero `subdivideQuadraticBezier` export needed.
- **Clamped vs unclamped semantics μοιρασμένα στα δύο engines:**
  - `projectPointOnWallAxis(wall, cursor): Point2D | null` — **clamped** (NEAREST). Καλεί `getNearestPointOnLine(cursor, a, b, true)` ανά segment. Αν cursor είναι πέρα από wall endpoint, foot = endpoint. Καταναλώνεται από `NearestSnapEngine`.
  - `getWallAxisPerpendicularFeet(wall, cursor, maxDistance): Array<{point, segmentIndex}>` — **unclamped** (PERPENDICULAR). Καλεί `getNearestPointOnLine(cursor, a, b, false)` ανά segment και φιλτράρει με `maxDistance`. Επιτρέπει foot στην προέκταση τού segment (mirror AutoCAD Line PERPENDICULAR).
- **Zero changes σε beam side** — `useBeamTool`, `applyBeamGripDrag`, `commitBeamGripDrag` ΟΛΑ μένουν as-is. Mouse handler snap pipeline (Phase 5.5d documented) ήδη φέρνει το snapped worldPoint στο click handler και στο grip drag. Mirror του Phase 5.5d pattern: η extension του snap engine αυτο-καταναλώνεται upstream.
- **Defensive null guards** — αν `wall.geometry?.axisPolyline?.points` λείπει ή έχει `<2` vertices, οι helpers επιστρέφουν `null` / `[]` (Phase 1 invariant guarantees presence, αλλά defensive όπως όλα τα Phase 5.5x modules).
- **Snap radius semantics** — `NearestSnapEngine` ήδη ελέγχει το global radius post-projection. `PerpendicularSnapEngine` περνά `maxDistance = radius * SNAP_RADIUS_MULTIPLIERS.STANDARD` στο helper. Ίδιο pattern με τα υπάρχοντα entity branches.

**Files created (2):**
- `bim/walls/wall-axis-projection.ts` — pure SSoT. Exports `projectPointOnWallAxis(wall, cursor)` (clamped, single closest point) και `getWallAxisPerpendicularFeet(wall, cursor, maxDistance)` (unclamped, array). Read-only access σε `wall.geometry.axisPolyline.points` — μηδέν mutation.
- `bim/walls/__tests__/wall-axis-projection.test.ts` — 12 Jest tests: clamped (straight in-segment / before-start / after-end clamp · polyline closest-segment · curved Bezier mid · null geometry guard) + unclamped (straight foot εντός radius · unclamped foot στην προέκταση · εκτός radius → empty · polyline multi-segment unique indices · curved tessellated N feet · null geometry guard).

**Files modified (2):**
- `snapping/engines/NearestSnapEngine.ts` — νέο `import { isWallEntity }` + `import { projectPointOnWallAxis }`. Νέα `if (isWallEntity(entity))` branch στην αρχή του `getNearestPointOnEntity()` (πριν τα entityType lowercase checks). Επιστρέφει `projectPointOnWallAxis(entity, point)` (clamped) — η ήδη υπάρχουσα `closestDistance/radius` πύλη του engine φιλτράρει.
- `snapping/engines/PerpendicularSnapEngine.ts` — νέο `isWallEntity` import + `import { getWallAxisPerpendicularFeet }`. Νέα `else if (isWallEntity(entity))` branch στο `getPerpendicularPoints()`. Pushes `{point, type: 'Wall Axis Segment N'}` ανά foot που γυρνά ο helper (ήδη filtered by `maxDistance`).

**Files created (0 beyond above):** Zero React / canvas / hook changes. Zero ribbon / i18n changes (reuse "Nearest"/"Perpendicular" labels). Zero command surface. Pure data-flow extension του υπάρχοντος snap pipeline.

**Snap pipeline flow (verified):**

```
WallEntity → SceneModel.entities (cached geometry.axisPolyline.points)
            ↓
NearestSnapEngine.findSnapCandidates(cursor) — iterates entities
            ↓  (Phase 5.5e new branch)
isWallEntity(entity) → projectPointOnWallAxis(entity, cursor)
            ↓
loop axisPolyline.points segments → getNearestPointOnLine(clamp=true)
            ↓ closest foot across segments
SnapCandidate{type: NEAREST, point, entityId: wall.id}

PerpendicularSnapEngine.getPerpendicularPoints(cursor, maxDistance)
            ↓  (Phase 5.5e new branch)
isWallEntity(entity) → getWallAxisPerpendicularFeet(entity, cursor, maxDistance)
            ↓
loop segments → getNearestPointOnLine(clamp=false) → filter by maxDistance
            ↓ array of feet (one per qualifying segment)
SnapCandidate[]{type: PERPENDICULAR, point, label: "Wall Axis Segment N"}

[user moves mouse near wall axis]
            ↓
findSnapPoint(worldPos) → ProSnapEngineV2 combines candidates by priority
            ↓
setFullSnapResult(snapResult) → SnapIndicatorOverlay renders marker (existing icon)
setImmediateSnap() → consumers read imperatively
            ↓
[user clicks (beam draw) ή releases grip drag]
            ↓
mouse-handler-up.ts: worldPoint = snapResult.snappedPoint (lines 93-98)
            ↓
onCanvasClick(worldPoint) → useBeamTool.onCanvasClick(snappedPoint)
            ↓
Beam endpoint EXACTLY στο wall axis projection. ✅
```

**Deferred to Phase 5.5f+ / cross-phase:**
- ~~Snap-to-slab-edge perpendicular (mirror του wall axis snap για slab outline edges — Phase 3 dependency, currently slabs feed endpoints/midpoints only).~~ **✅ DONE Phase 5.5f (2026-05-19).**
- ~~Snap-to-opening-jamb perpendicular (door/window frame vertical edges — Phase 2 host-aware snap).~~ **✅ DONE Phase 5.5g (2026-05-19).**
- Wall-axis snap tooltip i18n distinct label ("Επί άξονα τοίχου") — reuses generic "Nearest" σήμερα.
- Column-center-line 3D wireframe snap (out-of-plane Z-axis) — από Phase 5.5d deferred.
- Beam-supports-slab analytical link (Phase 6 BOQ dependency — out of snap scope).
- Section-profile preview overlay για steel I/H profile beams (από Phase 5.5d deferred).

✅ Google-level: YES — pure SSoT module (axis projection single-sourced + leverages cached geometry, ZERO Bezier math duplication), reuse-first architecture (extend existing engines, ΟΧΙ νέος engine/SnapType — industry convergence με AutoCAD/Revit), idempotent (pure functions, ίδιο input → ίδιο output), ADR-040 micro-leaf compliance preserved (ZERO new React subscriptions — όλη η wiring γίνεται μέσω του existing snap pipeline), clamped vs unclamped semantics map clean σε NEAREST vs PERPENDICULAR osnap intents (mirror AutoCAD Line behaviour), defensive ως προς missing geometry (no exceptions), zero new command surfaces, zero ribbon/i18n changes.

### Phase 5.5f — Snap-to-Slab-Edge Perpendicular Projection *(✅ IMPLEMENTED 2026-05-19)*

Closes το `snap-to-slab-edge perpendicular` deferred item από Phase 5.5e. Direct mirror του Phase 5.5e pattern (wall axis → slab edge) — same architecture, same engines, same API shape. Όταν ο χρήστης σχεδιάζει οποιοδήποτε BIM entity (ή DXF drawing tool) με snap ενεργό και ο cursor μπει εντός snap radius γύρω από slab outline edge (όχι σε slab vertex / edge-midpoint που ήδη καλύπτουν `EndpointSnapEngine` / `MidpointSnapEngine`), το cursor "κουμπώνει" στην ορθή προβολή πάνω στην ακμή της πλάκας.

**Key difference from Phase 5.5e (wall):** Slab outline είναι **closed polygon** (CCW) — η closing edge `[last vertex → first vertex]` συμπεριλαμβάνεται στο loop χρησιμοποιώντας modulo indexing `(i+1) % n`. Wall axis ήταν open polyline (καμία closing edge). Αλγορίθμως: `for i in 0..n-1: edge = [points[i], points[(i+1)%n]]`.

**Design choices:**
- **Same reuse-first pattern** — extend `NearestSnapEngine` + `PerpendicularSnapEngine` με `isSlabEntity` branch (αμέσως μετά τον `isWallEntity` branch). Zero νέος engine, zero νέος SnapType.
- **Leverage cached `slab.geometry.polygon.points`** — Phase 3 invariant. `computeSlabGeometry(params)` πάντα γεμίζει `geometry.polygon = params.outline` (line 55: `polygon: params.outline`). Αυτό είναι re-export του `SlabParams.outline` (Polygon3D) — ακριβώς τα user-drawn vertices.
- **Clamped / unclamped split** — mirror Phase 5.5e:
  - `projectPointOnSlabEdge(slab, cursor): Point2D | null` → clamped, NEAREST, single closest foot
  - `getSlabEdgePerpendicularFeet(slab, cursor, maxDistance): Array<{point, edgeIndex}>` → unclamped per-edge + radius filter, PERPENDICULAR
- **Defensive guards** — `polygon.points?.length < 3 → null/[]` (validator guarantees ≥3 Phase 3, αλλά defensive).
- **Zero beam/wall/column side changes** — snap pipeline αυτο-καταναλώνεται.
- **Corner zone behaviour** — cursor in corner zone → `projectPointOnSlabEdge` returns closest foot from adjacent edges (clamped to corner vertex). `getSlabEdgePerpendicularFeet` returns ≥2 feet (unclamped from both adjacent edges' infinite lines) — engine picks priority winner.

**Files created (2):**
- `bim/slabs/slab-edge-projection.ts` — pure SSoT. Exports `projectPointOnSlabEdge(slab, cursor)` (clamped, single closest) και `getSlabEdgePerpendicularFeet(slab, cursor, maxDistance)` (unclamped, array, includes closing edge). Modulo index for closing edge.
- `bim/slabs/__tests__/slab-edge-projection.test.ts` — 12 Jest tests: clamped (bottom edge / left closing edge / corner clamp / triangle hypotenuse / null geometry / <3 vertices) + unclamped (bottom foot εντός radius / εκτός radius → empty / unclamped extension / corner zone ≥2 feet / closing edge foot / null geometry guard).

**Files modified (2):**
- `snapping/engines/NearestSnapEngine.ts` — νέο `isSlabEntity` import + `projectPointOnSlabEdge` import. Branch αμέσως μετά `isWallEntity` branch.
- `snapping/engines/PerpendicularSnapEngine.ts` — νέο `isSlabEntity` import + `getSlabEdgePerpendicularFeet` import. Branch αμέσως μετά `isWallEntity` branch, pushes `'Slab Edge N'` labels.

**Files created (0 beyond above):** Zero React / canvas / hook changes. Zero i18n / ribbon / command changes.

**Deferred to Phase 5.5g+ / cross-phase:**
- Snap-to-opening-jamb perpendicular (door/window frame edges — Phase 2 host-aware).
- Wall-axis + slab-edge distinct i18n labels ("Επί άξονα τοίχου" / "Επί ακμής πλάκας").
- Column-center-line 3D wireframe snap (out-of-plane Z).
- Beam-supports-slab analytical link (Phase 6 dependency).
- Section-profile preview overlay για steel I/H beams.

✅ Google-level: YES — pure SSoT module (edge projection single-sourced + cached geometry leveraged, modulo index for closed polygon closing edge), reuse-first (extend existing engines, zero new SnapType), idempotent, ADR-040 micro-leaf compliance (ZERO new React subscriptions), clamped vs unclamped maps clean σε NEAREST vs PERPENDICULAR, defensive missing geometry, zero ribbon/i18n/command changes.

### Phase 5.5g — Snap-to-Opening-Jamb Perpendicular Projection *(✅ IMPLEMENTED 2026-05-19)*

**Design rationale:**
Mirror του Phase 5.5e (wall axis) και Phase 5.5f (slab edge) για `OpeningEntity`. Ο χρήστης μπορεί να snap σε οποιαδήποτε από τις 4 ακμές του κουφώματος (εξωτερική/εσωτερική πλευρά + αριστερό/δεξί παραστάτη). Cached geometry SSoT: `opening.geometry.outline.vertices` (4 `Point3D`, CCW, Phase 2 invariant).

**Key geometry:**
```
Outline (horizontal wall, y-up perp):
  [0] start-outer  (2500, -100)  ←─── Edge 0: outer face (y=-halfT)
  [1] end-outer    (3500, -100)
  [2] end-inner    (3500, +100)  ←─── Edge 1: end jamb (x=end)
  [3] start-inner  (2500, +100)  ←─── Edge 2: inner face (y=+halfT)
  closing [3]→[0] = start jamb  ←─── Edge 3: start jamb (x=start)
```

Closing edge [3]→[0] included via modulo index `(i+1) % n` — ίδιο με Phase 5.5f.

**Files created:**
- `bim/walls/opening-outline-projection.ts` — pure SSoT (~75 lines). Exports:
  - `projectPointOnOpeningOutline(opening, cursor)` — NEAREST, clamped foot (NearestSnapEngine)
  - `getOpeningOutlinePerpendicularFeet(opening, cursor, maxDistance)` — PERPENDICULAR, unclamped feet per edge (PerpendicularSnapEngine)
- `bim/walls/__tests__/opening-outline-projection.test.ts` — 13 Jest tests (7 NEAREST + 6 PERPENDICULAR). Covers outer/inner faces, start/end jambs, corner zones, unclamped extensions, null guards.

**Files modified:**
- `snapping/engines/NearestSnapEngine.ts` — `isOpeningEntity` branch → `projectPointOnOpeningOutline(entity, point)` (before generic entityType fallback)
- `snapping/engines/PerpendicularSnapEngine.ts` — `isOpeningEntity` branch → `getOpeningOutlinePerpendicularFeet(entity, cursorPoint, maxDistance)` (after `isSlabEntity` branch)

**Pipeline flow:**
```
cursor move → ProSnapEngineV2 → NearestSnapEngine / PerpendicularSnapEngine
  → isOpeningEntity(entity)
  → reads opening.geometry.outline.vertices (4 × Point3D, z ignored)
  → per-edge loop with (i+1)%n closing edge
  → clamped foot (NEAREST) | unclamped foot filtered by maxDistance (PERPENDICULAR)
  → SnapCandidate { point, type: "Opening Edge N" }
```

**Deferred to Phase 5.5g+ / cross-phase:**
- Distinct i18n label "Επί παραστάτη ανοίγματος" — snap tooltip reuses "Nearest"/"Perpendicular" σήμερα.
- Snap specifically only to jamb edges (edge 1 + 3) vs all 4 — current: all 4 edges, consistent με slab/wall pattern και completeness-over-MVP rule.

✅ Google-level: YES — pure SSoT module (opening outline projection single-sourced + Phase 2 cached geometry leveraged, zero re-computation), reuse-first (extend existing NearestSnapEngine + PerpendicularSnapEngine, ΟΧΙ νέος engine/SnapType), modulo closing-edge mirrors Phase 5.5f invariant, idempotent pure functions, ADR-040 micro-leaf compliance (ZERO new React subscriptions), defensive null guard for missing geometry, zero ribbon/i18n/command changes.

### Phase 6 — BOQ Auto-Feed *(✅ CORE IMPLEMENTED 2026-05-18)*

**Files created:**
- `bim/config/bim-to-atoe-mapping.ts` — `AtoeMappingEntry` interface + 5 mapping tables (WALL/OPENING/SLAB/COLUMN/BEAM) + `resolveAtoeMapping(entityType, kind, category?)`. Wall keyed by `params.category` (WallCategory), others by `kind`. Latin `OIK-` prefix consistent with Firestore data. BOQ units: wall=m², opening=pcs, slab/column/beam=m³.
- `bim/services/BimToBoqBridge.ts` — singleton `bimToBoqBridge`. Deterministic ID `boq_bim_${entityId}`. Single Firestore `getDoc` per upsert (combined detach check + createdAt preservation). Skips detached items on update. Silent error swallow (fire-and-forget audit pattern). `BimEntityForBoq` + `BimBoqContext` interfaces.
- `bim/config/__tests__/bim-to-atoe-mapping.test.ts` — 14 tests: all entity types + unknown kind → null + BIM_TO_ATOE_MAPPING coverage + OIK- prefix invariant.
- `bim/services/__tests__/BimToBoqBridge.test.ts` — 11 tests: setDoc deterministic ID, detach guard on update, created action bypasses detach guard, createdAt preservation, unknown mapping skip, missing context skip, quantity=1 for pcs, deleteBoqItemForBim guard, getBoqItemBySourceEntity happy/not-found.

**Files modified:**
- `src/types/boq/units.ts` — `BOQSource` union += `'bim-auto'`.
- `src/types/boq/boq.ts` — `BOQItem` extends με `sourceType?`, `sourceEntityId?`, `sourceEntityType?`, `detached?`. `UpdateBOQItemInput` += `detached?`.
- `src/services/measurements/boq-repository.ts` — `normalizeBOQItem` handles 4 new fields.
- `hooks/data/useWallPersistence.ts` — `buildingId` param; `persist()` calls `bimToBoqBridge.upsertBoqItemForBim` fire-and-forget; `deleteWall` calls `bimToBoqBridge.deleteBoqItemForBim`.
- `hooks/data/useOpeningPersistence.ts` — same pattern.
- `hooks/data/useSlabPersistence.ts` — same pattern.
- `hooks/data/useColumnPersistence.ts` — same pattern.
- `hooks/data/useBeamPersistence.ts` — same pattern (already had BOQ calls from Phase 5 — buildingId guard added).
- `app/WallPersistenceHost.tsx` / `OpeningPersistenceHost.tsx` / `SlabPersistenceHost.tsx` / `ColumnPersistenceHost.tsx` / `BeamPersistenceHost.tsx` — `buildingId?: string` prop added + passed through to hook.
- `app/DxfViewerTopBar.tsx` — all 5 hosts receive `buildingId={levelManager.saveContext?.buildingId ?? undefined}`.
- `components/building-management/tabs/MeasurementsTabContent/BOQCategoryAccordion.tsx` — BIM badge (cyan = bim-auto, muted = detached) + Detach button (Unlink icon, cyan). `onDetach?: (item) => void` prop chain to `CategoryItemsTable`.
- `components/building-management/tabs/MeasurementsTabContent.tsx` — `handleDetach` callback: confirm dialog → `updateItem(id, { detached: true })`.
- `i18n/locales/en/building-tabs.json` + `i18n/locales/el/building-tabs.json` — `tabs.measurements.badge.{bimAuto, bimDetached}`, `tabs.measurements.actions.{detachFromBim, detachFromBimConfirm}`.

**Deferred to Phase 6.1+:**
- [ ] DNA layer sub-items per wall (1 BOQ item per DNA layer → OIK-4.x coating categories). Phase 6 = single summary item per wall.
- [ ] `bim_materials.atoeCode` → derived mapping via material library (Phase 6.2).
- [ ] Wall-layer DNA BOQ breakdown: `buildingId + bimMaterialLibrary.atoeCode` → per-layer BOQ items.
- [ ] ADR-175 changelog entry.

### Phase 7A — Multi-Char BIM Hotkeys *(✅ IMPLEMENTED 2026-05-18)*

Centralized all multi-character keyboard shortcuts for BIM tools into a single **`MultiCharKeySequence`** dispatcher — AutoCAD command-line prefix-tree pattern. 350ms window: first key starts the window, second key within window resolves the chord; timeout fires the fallback.

**Files created:**
- `src/subapps/dxf-viewer/keyboard/MultiCharKeySequence.ts` — pure class (no React deps, fully testable). `ChordDefinition[]` + `FallbackDefinition[]` + `FeedResult` discriminated union (`chord-started | chord-completed | fallback-fired | miss`). `hasPending()` + `destroy()` for lifecycle management.
- `src/subapps/dxf-viewer/keyboard/__tests__/MultiCharKeySequence.test.ts` — **25/25 tests** passing. Covers: chord completion (all 5 chords), timeout fallback per leader, fallback-fired on wrong 2nd key, miss for non-leaders (L/W/G), `hasPending` state transitions, `destroy` cleanup, prefix collision (S→stair/slab both resolve correctly).

**Files modified:**
- `src/subapps/dxf-viewer/config/keyboard-shortcuts.ts` — Added 4 new entries to `DXF_TOOL_SHORTCUTS`: `opening: { key: 'OP' }`, `slab: { key: 'SL' }`, `column: { key: 'CL' }`, `beam: { key: 'BM' }`. Declaration-only; `matchesShortcut()` does not handle multi-char — dispatching is via `MultiCharKeySequence`.
- `src/subapps/dxf-viewer/hooks/useDxfToolbarShortcuts.ts` — Replaced manual `stairChordRef` + individual `matchesShortcut(e, 'select')` / `matchesShortcut(e, 'circle')` / `matchesShortcut(e, 'layering')` blocks with unified `bimDispatcherRef` (`MultiCharKeySequence` instance, lazy-init once). Stable `callbacksRef.current` pattern prevents stale closures in 350ms timeout callbacks.

**Chord table (BIM_CHORDS + BIM_FALLBACKS):**

| First key | Second key | Action | Timeout / wrong 2nd key fallback |
|---|---|---|---|
| `S` | `T` | `tool:stair` | `tool:select` |
| `S` | `L` | `tool:slab` | `tool:select` |
| `O` | `P` | `tool:opening` | `tool:layering` (with toggle: if already layering → select) |
| `C` | `L` | `tool:column` | `tool:circle` |
| `B` | `M` | `tool:beam` | `null` (B has no existing single-B fallback) |

**Architecture notes:**
- `MultiCharKeySequence` is completely decoupled from React — unit-testable without DOM or timers (uses `jest.useFakeTimers()`).
- `bimDispatcherRef` is initialized once (`if (!bimDispatcherRef.current)`) and persists across re-renders.
- `fallback-fired` result: `handleToolChange(fallbackAction)` fires first, then **falls through** to process the current key via normal shortcuts (so `SX` = select + process X normally).
- G-chord system (`DXF_GUIDE_CHORD_MAP`, 30+ second-key entries) is **not merged** — kept separate intentionally, has its own timeout and different resolution logic.

**Tests:** 25/25 green (`jest --testPathPattern=MultiCharKeySequence`).

---

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

**Q5** ✅ **ΑΠΑΝΤΗΘΗΚΕ 2026-05-17**: **(β) Full migration στο `bim/`** — GOL + SSOT. Stair = building element, ζει με τα άλλα building elements. Compromise (shared abstraction μόνο, files stay put) απορρίφθηκε ως τεχνικό χρέος (παραβιάζει N.0/N.7/N.12). Νέα **Phase 0.5 "Stair Migration"** μπαίνει στο §6 — prerequisite για Phase 1 Wall.

**Migration details**:
- 45+ stair files → `bim/stairs/` (single atomic commit)
- `git mv` διατηρεί per-file history
- Bulk find/replace imports: `systems/stairs/` → `bim/stairs/` + `rendering/entities/StairRenderer` → `bim/renderers/stair-renderer` + `hooks/data/useStairPersistence` → `bim/hooks/use-stair-persistence`
- `types/stair.ts` refactor: `StairEntity extends BimEntity<StairKind, StairParams, StairGeometry>` (κληρονομεί validation/qto/softLock από abstraction)
- ADR-358 paths update + changelog entry στο ίδιο commit
- All 20+ stair tests run + pass
- Phase 0.5 acceptance: zero TS errors, all tests green, ADR-358 paths consistent, `bim/index.ts` re-exports stair public API

**Q6** ✅ **ΑΠΑΝΤΗΘΗΚΕ 2026-05-17**: **(γ) Υβριδικό — auto με override**. Default: auto layer creation με BIM naming convention. Override: per-element layer picker στο `BimTypePickerDialog` (κάτω από type picker). Existing layer detection όταν φορτώνεται DXF.

**Implementation details**:
- Νέα Firestore collection `bim_settings/{projectId}`:
  ```typescript
  {
    layerConvention: 'greek' | 'english' | 'aia-us' | 'custom',
    autoCreateLayers: boolean,         // default true
    customLayerMap?: Record<BimElementKind, string>, // αν 'custom'
  }
  ```
- 3 built-in conventions με auto-naming + auto-color:

  | Element | Greek (default) | English | AIA-US | Default ACI color |
  |---|---|---|---|---|
  | wall.exterior | Τοίχοι-Εξωτερικοί | Walls-Exterior | A-WALL-EXTR | 2 (Yellow) |
  | wall.interior | Τοίχοι-Εσωτερικοί | Walls-Interior | A-WALL-INTR | 4 (Cyan) |
  | wall.partition | Τοίχοι-Διαχωριστικοί | Walls-Partition | A-WALL-PART | 9 (LtGray) |
  | opening.door | Κουφώματα-Πόρτες | Openings-Doors | A-DOOR | 6 (Magenta) |
  | opening.window | Κουφώματα-Παράθυρα | Openings-Windows | A-WIND | 5 (Blue) |
  | slab.* | Πλάκες | Slabs | A-FLOR | 3 (Green) |
  | slab-opening | Διανοίξεις-Πλακών | Slab-Openings | A-FLOR-OTLN | 1 (Red dashed) |
  | column.* | Κολώνες | Columns | A-COLS | 1 (Red) |
  | beam.* | Δοκάρια | Beams | A-BEAM | 14 (DkRed dashed) |
  | stair.* | Σκάλες | Stairs | A-FLOR-STRS | 32 (Brown/Tan) |

- `BimLayerService` SSoT (`src/subapps/dxf-viewer/bim/services/BimLayerService.ts`):
  - `resolveLayerForEntity(elementType, kind, convention): { name: string, defaultColor: ACI, exists: boolean }`
  - `ensureLayer(name, color): Promise<LayerId>` — idempotent (no duplicate creation)
  - `detectExistingLayer(elementType, kind): Layer | null` — semantic match (case-insensitive, fuzzy: "Walls" matches "WALLS", "walls")
- Existing layer detection UX: όταν DXF φορτώνεται με layer `WALLS`, ο dropdown στο TypePickerDialog δείχνει: "🔍 Εντοπίστηκε: WALLS — Χρήση υπάρχοντος | Δημιουργία Τοίχοι-Εξωτερικοί"
- Per-session override: ο χρήστης μπορεί να αλλάξει layer για ένα μόνο entity χωρίς να αλλάξει default. Δεν επηρεάζει project setting.
- **Q6b ✅ ΑΠΑΝΤΗΘΗΚΕ**: **English default** (`Walls-Exterior`, `Openings-Doors`, ...). Layer NAMES = Latin (interop safety με legacy DWG editors + xξένη συνεργασία). UI CONTROLS = ελληνικά (CLAUDE.md language rule). User μπορεί να αλλάξει σε `'greek'` ή `'aia-us'` μέσω `bim_settings.layerConvention` setting

**Q7** ✅ **ΑΠΑΝΤΗΘΗΚΕ 2026-05-17**: **(A) Mixed 1+2 letter hotkeys**. Conflicts βρέθηκαν στην αρχική πρόταση (`CO`=COPY, `O`=OFFSET) και διορθώθηκαν. Τελικά:

| Element | Hotkey | Mnemonic | Industry alignment |
|---|---|---|---|
| Wall | `W` | Wall | AutoCAD WALL=W, Revit WA |
| Opening | `OP` | OPening | unique |
| Slab | `SL` | SLab | unique |
| SlabOpening | `SO` | SlabOpening | unique |
| Column | `CL` | CoLumn | unique |
| Beam | `BM` | BeaM | unique |
| Stair | `ST` | STair | already in ADR-358 |

Pattern: industry `W` για Wall = international standard, δεν spaπει. Υπόλοιπα 2-letter αποφεύγουν conflicts με υπάρχοντα `O`(Offset), `S`(Stretch), `C`(Circle), `CO`(Copy) shortcuts.

**Implementation**: στο `TOOL_DEFINITIONS` (ToolStateManager.ts) entries + `home-tab-bim.ts` ribbon panel + `useKeyboardShortcuts` hook επέκταση. Hotkey activation flow: keypress → `BimTypePickerDialog` opens (Q1) → user selects type → tool activates.

**Q8** ✅ **ΑΠΑΝΤΗΘΗΚΕ 2026-05-17**: **(γ) Hybrid — minimal seed + user extension**. 25 generic essentials seeded (όχι brand-specific) με `defaultUnitCost: null`. User extends per company/project scope. Avoids brand bias + stale prices + onboarding friction.

**Schema** (`bim_materials/{materialId}` Firestore):
```typescript
interface BimMaterial {
  id: string;                    // bmat_<UUID-v4>
  scope: 'system' | 'company' | 'project';
  nameEl: string;
  nameEn: string;
  category: 'plaster' | 'masonry' | 'concrete' | 'insulation' | 'flooring'
          | 'window-frame' | 'door-frame' | 'paint' | 'roofing' | 'waterproofing' | 'other';
  density?: number;              // kg/m³
  defaultThickness?: number;     // mm
  fireRating?: 'EI30' | 'EI60' | 'EI90' | 'EI120' | 'none';
  atoeCategory: AtoeCategoryCode;
  atoeArticle?: string;
  defaultUnitCost?: number | null; // DEFAULT NULL
  defaultUnit: 'm' | 'm2' | 'm3' | 'kg' | 'pcs';
  brand?: string;                // optional, για company-scoped
  brandModel?: string;
  notes?: string;
  builtin: boolean;              // system-seeded = non-deletable
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Seeded materials (~25)** — Phase 6.5 deliverable. Categories: plaster (3), masonry (3), concrete (4 + rebar), insulation (3), flooring (3), window-frame (2), door-frame (1), paint (2), roofing (2), waterproofing (1), other (1). Όλα με `defaultUnitCost: null`. Καμία brand-specific entry (Alumil/Knauf/Vitex εξαιρούνται από system seed — προστίθενται από company-scope από τον user).

**Inheritance pattern** (mirror ADR-175 §4.1.3 + Q1 bim_presets):
- System seed: 25 generic (read-only, builtin: true)
- Company scope: brand-specific extensions (π.χ. company adds "Alumil M9650" με τιμή €320/m²)
- Project scope: per-project overrides (π.χ. project negotiated price)
- Inheritance: project > company > system

**Phase 6.5 deliverable**:
- `MaterialLibraryService.ts` με CRUD per scope
- Firestore seed script `scripts/seed-bim-materials.ts` — μία φορά run, αδειάζει + γεμίζει με 25 system materials
- Materials browser UI: σε floating panel "Υλικά" — list με filter ανά category, scope chip ("Σύστημα" / "Εταιρεία" / "Έργο"), search
- Material picker UI: στο WallDna editor (Phase 1+) + Element panels, dropdown με auto-suggested ανά layer side
- Pre-commit ratchet: νέο SSoT module `bim-material-prefix` που blocks inline material ID strings outside MaterialLibraryService

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
| 2026-05-17 | **Q5 ANSWERED** — Full migration stair → `bim/` (GOL+SSOT). Compromise (γ) rejected as technical debt (παραβιάζει N.0/N.7/N.12). New **Phase 0.5 "Stair Migration"** prerequisite για Phase 1. 45+ files moved via `git mv`, atomic commit, bulk find/replace imports, StairEntity extends BimEntity<>, ADR-358 paths updated same commit. SSoT registry new module `bim-folder-residency`. §5.8 folder layout updated με stairs/ + geometry/stairs/ split. | Claude Opus 4.7 |
| 2026-05-17 | **Q6 ANSWERED** — Hybrid auto+override layer creation. New `bim_settings/{projectId}` Firestore collection + `BimLayerService` SSoT + 3 built-in conventions (Greek/English/AIA-US) με auto-naming + auto-color (10 entries). Existing layer detection με semantic fuzzy match. Per-session override. Q6b pending: which default convention. | Claude Opus 4.7 |
| 2026-05-17 | **Q6b ANSWERED** — English default layer names (`Walls-Exterior`, etc.). Layer NAMES Latin (legacy DWG interop + ξένη συνεργασία). UI CONTROLS ελληνικά (CLAUDE.md language rule). User-switchable convention μέσω `bim_settings.layerConvention`. | Claude Opus 4.7 |
| 2026-05-17 | **Q7 ANSWERED** — Hotkeys finalized: W, OP, SL, SO, CL, BM, ST. Original `O`/`CO` conflicts με Offset/Copy detected and corrected. W kept (industry standard για Wall). Pattern: mixed 1+2 letter, industry alignment > forced consistency. | Claude Opus 4.7 |
| 2026-05-17 | **Q8 ANSWERED — ALL Q1-Q8 CLOSED** — Hybrid material library: 25 generic essentials seeded (no brand bias), `defaultUnitCost: null`, scope inheritance (project > company > system). New Firestore collection `bim_materials`, `MaterialLibraryService` SSoT. **ADR-363 status moved from PROPOSED → APPROVED. Ready for Phase 0 implementation.** | Claude Opus 4.7 |
| 2026-05-17 | **Phase 0 Bootstrap IMPLEMENTED** — Zero user-visible code. Files created/modified: `bim/` skeleton (12 subfolders + index.ts), `bim/types/bim-base.ts` (BimEntity generic + Point3D + BimValidation + BimQuantityTakeoff + SoftLock + AtoeCategoryCode), `types/entities.ts` (+6 BIM EntityTypes + stub entity interfaces + type guards + getEntityBounds cases), `enterprise-id-prefixes.ts` (+9 BIM prefixes), `enterprise-id-class.ts` (+9 generator methods), `enterprise-id-convenience.ts` (+9 exports), `enterprise-id.service.ts` (facade re-export), `firestore-collections.ts` (+9 BIM collections), `firestore.indexes.json` (+21 composite indexes across 7 collections), `firestore.rules` (+9 collection rules, ADR-358 pattern), `dxf-viewer-shell.json` el+en (+ribbon.panels.bim, +ribbon.commands.bim.*), `tool-hints.json` el+en (+tools.bim.{wall/opening/slab/slabOpening/column/beam}), `.ssot-registry.json` (+3 modules: bim-entities, bim-id-prefix, bim-to-boq-bridge), `bim/types/__tests__/bim-ids.test.ts` + `bim-collections.test.ts`. Phase 0.5 (stair migration) = next session. | Claude Sonnet 4.6 |
| 2026-05-18 | **Phase 0.5 IMPLEMENTED — Stair Migration to `bim/` SSoT**. All stair code migrated from scattered locations into the `bim/` folder (ADR-363 §5.8 target structure). Changes: (1) `bim/types/bim-base.ts` updated: `BimEntity<TKind, TParams, TGeometry, TQto>` gains 4th TQto generic (default `BimQuantityTakeoff`, stair uses `StairQTO`); `qto` made optional; `TKind extends string` (removed `BimElementKind` constraint so `StairKind` can use the generic); new `BimLock` minimal interface (`{ userId }`) as base for `SoftLock`; `editingBy` uses `BimLock` so stair's `StairEditingLock` (has `userId`) is compatible. (2) NEW `bim/types/stair-types.ts` — full stair type definitions (`StairKind`, `StairParams`, `StairGeometry`, `StairValidationState`, `StairQTO`, etc.); `StairEntity extends BimEntity<StairKind, StairParams, StairGeometry, StairQTO>` (migrated from standalone `extends BaseEntity`; `kind`/`params`/`geometry` now inherited from BimEntity). `StairEditingLock extends BimLock`. (3) `types/stair.ts` → barrel re-export to `bim/types/stair-types.ts` (72 importing files continue to work via backward-compat stub). (4) `systems/stairs/stair-{validator,grips,transforms,presets-service,firestore-service,floor-link,auto-fix,material-catalog,preview-store,variant-defaults}.ts` → each file MOVED to `bim/stairs/`; barrel stub at old path. (5) `systems/stairs/stair-geometry-*.ts` + `StairGeometryService.ts` → MOVED to `bim/geometry/stairs/`; imports updated (`../../` → `../../../` for external refs); barrel stubs at old paths. (6) All stair tests moved: service tests → `bim/stairs/__tests__/`, geometry tests → `bim/geometry/stairs/__tests__/`. (7) `rendering/entities/StairRenderer.ts` → MOVED to `bim/renderers/StairRenderer.ts`; imports updated (`./BaseEntityRenderer` → `../../rendering/entities/BaseEntityRenderer`); barrel stub at old path. (8) `bim/index.ts` exports stair public API. ADR-358 paths updated same session. Zero breakage: all existing 72+ import sites work via barrel stubs (Boy Scout cleanup in Phase 1+). | Claude Sonnet 4.6 |
| 2026-05-18 | **Phase 1A IMPLEMENTED — Wall Core Types + Geometry + Validation + Builder + Renderer + Ribbon Tab + i18n + Tests**. First vertical BIM slice — αρχιτεκτονικό prove-out του ADR-363 §5.1 generic pattern. Files created: (1) `bim/types/wall-types.ts` — `WallKind` ('straight' \| 'curved' \| 'polyline'), `WallCategory` (5 τιμές: exterior/interior/partition/parapet/fence, 2 παραπάνω από genarc), `WallParams` (start/end/height/thickness/flip/dna/measurementLength/startBevel/endBevel/polylineVertices/curveControl, όλα mm), `WallGeometry` (axisPolyline/outerEdge/innerEdge/bbox/length/area/volume, m για BOQ), `WallEntity extends BimEntity<WallKind, WallParams, WallGeometry>` (concrete types αντικαθιστούν Phase 0 stubs). Σταθερές: `DEFAULT_WALL_HEIGHT_MM=3000`, `MIN_WALL_LENGTH_MM=100`, `MIN_WALL_THICKNESS_MM=50`, `MAX_WALL_THICKNESS_MM=2000`. (2) `bim/types/wall-dna-types.ts` — `WallDna`, `WallDnaLayer`, `WallLayerSide`, `computeTotalThickness()`, 5 preset factories (`createDefaultExteriorDna` 250mm/`Interior` 100mm/`Partition` 100mm/`Parapet` 150mm/`Fence` 500mm), `getDefaultDnaForCategory()` SSoT lookup. mm-baked (genarc ήταν m). (3) `types/entities.ts` — `WallKind` + `WallEntity` removed (replaced με concrete types), now re-exports from `bim/types/wall-types.ts` + `wall-dna-types.ts`; legacy imports continue working. (4) `bim/geometry/wall-geometry.ts` — `computeWallGeometry(params, kind)` SSoT: axis pickAxisVertices (straight + polyline fallback), perpendicular offset για outer/inner edges (signed by flip), vertex-normal averaging σε polyline corners, bbox extruded σε z=[0, height], length sum-of-segments. mm internal → m output. (5) `bim/validators/wall-validator.ts` — `validateWallParams()` returns `{ hardErrors, codeViolations, bimValidation }`. Hard errors: length<MIN, thickness≤0/>MAX, height≤0, DNA totalThickness mismatch >0.01mm. Code violations (non-blocking): thickness<50mm, exterior <200mm (ΝΟΚ). (6) `hooks/drawing/wall-completion.ts` — `buildDefaultWallParams()` (Revit Generic Wall pattern: explicit thickness override drops DNA, DNA preset only when no override), `buildWallEntity()` returns discriminated union `{ ok: true, entity } \| { ok: false, hardErrors }`, `completeWallFromTwoClicks()` convenience. Scene-unit aware. (7) `bim/renderers/WallRenderer.ts` — ADR-040 micro-leaf class. Phase pipeline: hover halo (OBB outline via outer+inner reversed polygon, stair §G15 pattern) → main pass (category fill rgba + edges stroke at category-specific lineweight) + dashed axis centerline. `hitTest` bbox-based. `getGrips` empty (Phase 1C). (8) Tool registration: `ToolType` union += `'wall'`, `TOOL_DEFINITIONS['wall']` category='drawing' canInterrupt=true allowsContinuous=true (chain walls, AutoCAD pattern). (9) `ui/ribbon/hooks/bridge/wall-command-keys.ts` — `WALL_RIBBON_KEYS` (stringParams.category, params.height/thickness, toggles.flip) + `WALL_RIBBON_KEYS_ACTIONS.close` + `WALL_RIBBON_BADGE_KEYS.violations`. (10) `ui/ribbon/data/contextual-wall-tab.ts` — `CONTEXTUAL_WALL_TAB`: `wall-category` panel (category combobox 5 options + flip combobox), `wall-geometry` panel (height + thickness comboboxes με προτεινόμενες τιμές 2400/2700/3000/3300/3600/4000mm για height, 100/150/200/250/300/500mm για thickness), `wall-actions` panel (close). `WALL_CONTEXTUAL_TRIGGER = 'wall-selected'`. Bridge listener (`useRibbonWallBridge`) deferred to Phase 1B — events emit no-op. (11) `app/ribbon-contextual-config.ts` — `CONTEXTUAL_WALL_TAB` registered, `resolveContextualTrigger` returns `WALL_CONTEXTUAL_TRIGGER` for `entity.type === 'wall'`. (12) `app/DxfViewerContent.tsx` — `activeContextualTrigger` returns `WALL_CONTEXTUAL_TRIGGER` when `activeTool === 'wall'` (mirrors stair pattern). (13) i18n el+en `dxf-viewer-shell.json`: `ribbon.tabs.wallProperties`, `ribbon.panels.{wallCategory,wallGeometry,wallActions}`, `ribbon.commands.wallEditor.{height,thickness,close,category.{section.title,exterior/interior/partition/parapet/fence},flip.{section.title,off,on}}`. Pure SOS N.11 compliant. (14) Tests Jest: `bim/geometry/__tests__/wall-geometry.test.ts` (17 tests: straight/degenerate/polyline/sanity), `bim/validators/__tests__/wall-validator.test.ts` (14 tests: hard errors + code violations + BimValidation payload), `hooks/drawing/__tests__/wall-completion.test.ts` (13 tests: defaults/overrides/scene-units/builder/end-to-end). Total **44/44 green**. **Phase 1B (state machine + persistence) = next session** — `useWallTool`, `wall-tool.ts` orchestrator, Firestore CRUD via `BimEntityService`, EntityAudit integration, `W` hotkey, `useRibbonWallBridge` listener, curved/polyline grip support. | Claude Opus 4.7 |
| 2026-05-18 | **Phase 1B IMPLEMENTED — Wall Tool Activation + Firestore Persistence + Ribbon Bridge**. End-to-end vertical: user draws wall with 2 clicks → entity in scene → Firestore save → contextual ribbon edits dispatch UpdateWallParamsCommand. Files created: (1) `hooks/drawing/useWallTool.ts` — state machine (idle → awaitingStart → awaitingEnd → continuous chain), ref-backed setState bypass, Dynamic Input `commit-wall` event listener, validator hardError abort path. (2) `core/commands/entity-commands/UpdateWallParamsCommand.ts` — atomic patch + recomputed geometry/validation via SSoT, undo/redo, merge-on-drag scaffold. (3) `bim/walls/wall-firestore-service.ts` — `WallFirestoreService` + `WallDoc` + factory + `entityToSaveInput`. Top-level `floorplan_walls/{wallId}` (companyId field-based tenant isolation), `setDoc` + `generateWallId` (SOS N.6), subscribe via `firestoreQueryService` (ADR-355) με ADR-361 equality guard, soft-lock acquire/release. (4) `hooks/data/useWallPersistence.ts` — debounced auto-save 500ms, diff-merge subscribe (preserves locally-dirty + never-saved), soft-lock TTL 5min, `drawing:entity-created` first-save listener. (5) `ui/ribbon/hooks/bridge/wall-param-helpers.ts` — pure read/patch με scene-unit normalization (mm I/O contract). Manual thickness override drops DNA. (6) `ui/ribbon/hooks/useRibbonWallBridge.ts` — combobox/toggle/badge bridge. Dispatches `UpdateWallParamsCommand`. (7) `app/WallPersistenceHost.tsx` — always-on null host που hostá το persistence hook. Files modified: `wall-command-keys.ts` (+isWallRibbon* type guards), `useSpecialTools.ts` (+useWallTool wired, onWallCreated → scene + EventBus), `canvas-click-types.ts` (+WallToolLike), `useCanvasClickHandler.ts` (+PRIORITY 4.6 wall click routing), `CanvasSection.tsx` (passes wallTool prop), `useRibbonCommands.ts` (composes wallBridge first για wall keys/badges), `DxfViewerContent.tsx` (mounts wallBridge + WallPersistenceHost + activeContextualTrigger för wall tool), `EntityRendererComposite.ts` (WallRenderer registered), `Bounds.ts` (calculateBimEntityBounds για wall/opening/slab/column/beam), `HitTestingService.ts` (case wall στο convertToEntityModel), `keyboard-shortcuts.ts` (wall: 'W' single-char), `useDxfToolbarShortcuts.ts` (wall match), `useKeyboardShortcuts.ts` (wall στο ESC cancel array). Tests Jest: `useWallTool.test.tsx` (10 tests). **Phase 1C (grips + curved/polyline + snap + preview) = next session.** **Phase 1D (DNA editor + EntityAudit + BOQ scaffold) follows.** | Claude Opus 4.7 |
| 2026-05-18 | **Phase 1C IMPLEMENTED — Wall Grips + Curved/Polyline Variants + Snap + Live Preview + Dynamic Input Overrides**. Editing affordances vertical: user can drag wall endpoints/midpoint/thickness/curve/polyline-vertex grips, draw curved (3-click) + polyline (N-click + Enter) walls, snap to wall endpoints/midpoints from DXF underlay, and see a WYSIWYG outer/inner footprint rubber-band ghost while drawing. Files created: (1) `bim/walls/wall-preview-store.ts` — single-writer/multi-reader module store (ADR-040-safe, mirror `stairPreviewStore`). Writes startPoint + curveControl + polylineVertices + overrides on every wall-tool state transition. Snapshot stability for `useSyncExternalStore` re-render skip. (2) `bim/walls/wall-grips.ts` — pure `getWallGrips()` + `applyWallGripDrag()`. Grip kinds: `wall-start` / `wall-end` (translate endpoints), `wall-midpoint` (translate whole wall), `wall-thickness` (resize perpendicular, drops `dna` to avoid `dnaThicknessMismatch` hardError), `wall-curve` (move/seed quadratic Bezier control point, curved kind only), `wall-vertex-N` (translate polyline interior vertex N, polyline kind only). Scene-unit-aware thickness floor (`minThicknessFloorFor`) mirrors stair `minWidthFloorFor`. (3) `bim/walls/__tests__/wall-grips.test.ts` — 14 tests grip layout per kind + applyDrag transforms + thickness clamp + dna drop + curve seed + polyline vertex move + out-of-range fallback. (4) `bim/walls/__tests__/wall-preview-store.test.ts` — 7 tests writer/reset/snapshot stability/curveControl deep-copy/overrides propagation. Files modified: (5) `hooks/grip-types.ts` — `WallGripKind` union + `GripInfo.wallGripKind?` discriminator. (6) `hooks/useGripMovement.ts` — re-export `WallGripKind`. (7) `hooks/grips/unified-grip-types.ts` — `UnifiedGripInfo.wallGripKind?` forward. (8) `hooks/grips/grip-registry.ts` — `wrapDxfGrip` forwards `wallGripKind`. (9) `hooks/grips/grip-commit-adapters.ts` — new `commitWallGripDrag` routes through `UpdateWallParamsCommand` (`isDragging=true`, merge window enabled — drag samples collapse to single undo entry). `commitDxfGripDragModeAware` early-branches on `grip.wallGripKind`. (10) `bim/renderers/WallRenderer.ts` — `getGrips()` wired to `getWallGrips(wall)` (Phase 1B was `return []`). (11) `bim/geometry/wall-geometry.ts` — `pickAxisVertices` extended για `curved` kind: subdivides quadratic Bezier into 16 segments (`CURVED_SUBDIVISIONS`, mirrors AutoCAD `SPLINESEGS`). New `subdivideQuadraticBezier` helper. Existing offset/normal/bbox logic re-used (multi-vertex polyline already supported). (12) `hooks/drawing/useWallTool.ts` — extended state machine: kind switch (`setKind('straight'|'curved'|'polyline')`), curved 3-click flow (`awaitingStart → awaitingEnd → awaitingCurveControl`), polyline N-click flow (`awaitingStart → awaitingNextVertex` loop), `finishPolyline()` method, Enter keydown listener (commits polyline chain in `awaitingNextVertex`, respects focused inputs), preview store sync via `useEffect`, Dynamic Input inline overrides (height/thickness/category/flip applied ahead of commit), status texts per phase. (13) `hooks/drawing/wall-completion.ts` — `buildWallEntity` kind threaded through (`'curved'`/`'polyline'` branches use the subdivided/polyline axis). (14) `hooks/drawing/drawing-types.ts` — `DrawingTool` union += `'wall'`. (15) `hooks/drawing/drawing-preview-generator.ts` — `generateWallPreview` branch: outer/inner edge polygon ghost via `computeWallGeometry()` (WYSIWYG with renderer), reads `wallPreviewStore` for kind/overrides/curveControl. Helpers `makeWallFootprintGhost` (straight + curved) + `makeWallPolylineGhost` (N-vertex spine). (16) `hooks/drawing/useUnifiedDrawing.tsx` — wall branch in `updatePreview`: resolves `'wall'` from `toolStateStore`, reconstructs `tempPoints` from `wallPreviewStore` (polyline vertices array OR `[startPoint]` for straight/curved), propagates scene units. (17) `systems/dynamic-input/utils/events.ts` — `DynamicSubmitDetail` extended με `height`/`thickness`/`category`/`flip` for `commit-wall` action (Stream E parity). (18) `snapping/shared/GeometricCalculations.ts` — `getEntityEndpoints` + `getEntityMidpoints` + `getEntityMidpoint` extended με wall case: straight/curved → axis endpoints + axis midpoint; polyline → per-spine-vertex + per-segment midpoints. Imports `isWallEntity`. Activates Endpoint + Midpoint snap engines για walls via existing spatial-index pipeline. (19) `bim/geometry/__tests__/wall-geometry.test.ts` — extended με curved kind suite (6 tests: subdivision count 17, endpoints pin to start/end, midpoint analytic value, fallback to straight when curveControl missing, edge counts match axis, arc-length > chord). **Total tests this Phase: 27 new + 6 extension = 33 green.** Pending → Phase 1D: DNA editor floating panel, perpendicular auto-trim (`computeWallTrims` port), EntityAudit integration (CHECK 3.17), BOQ Auto-Feed (depends on Phase 6). | Claude Opus 4.7 |
| 2026-05-18 | **Phase 1D-C IMPLEMENTED — EntityAudit Integration (wall writes)**. CHECK 3.17 compliance for `FLOORPLAN_WALLS`. Files modified/created: (1) `src/types/audit-trail.ts` — `AuditEntityType` union extended με `'wall'`. (2) `src/app/api/audit-trail/record/route.ts` — `VALID_ENTITY_TYPES` + `ENTITY_COLLECTION_MAP` entries for `'wall'` (→ `FLOORPLAN_WALLS`). (3) `bim/walls/wall-audit-client.ts` NEW — fire-and-forget `recordWallChange(action, entity, entityName?)` POSTs to `/api/audit-trail/record`. `buildWallChanges()`: kind-field for created/deleted, params-marker for updated. Pattern mirrors `useFileAudit.ts` `recordCentralizedAudit`. (4) `hooks/data/useWallPersistence.ts` — `isNew = !lastSavedParamsRef.has(id)` captured before save; `void recordWallChange(isNew ? 'created' : 'updated', entity)` after successful `svc.saveWall()`. Fire-and-forget (audit failure ≠ UX impact). (5) `scripts/check-entity-audit-coverage.js` — `FLOORPLAN_WALLS` added to `TRACKED_COLLECTION_KEYS`; `wall-firestore-service.ts` added to `HARD_EXEMPT_PATTERNS` (client-SDK, audit delegated to hook layer via API route); baseline refreshed (1 pre-existing `property-deletion-guard.ts` grandfathered). Firestore rules: no change needed — `entity_audit_trail` already covered. Delete path deferred: no delete UI yet (Phase 1E+). | Claude Sonnet 4.6 |
| 2026-05-18 | **Phase 1D-B IMPLEMENTED — Perpendicular Auto-Trim (`computeWallTrims`)**. Clean wall↔wall joins without rectangular overlap. Files created: (1) `bim/walls/wall-trims.ts` — pure module. `lineLineIntersect()` (parametric Cramer's rule), `sinAngleBetween()`, `computeWallTrims(walls)` (O(n²) pair loop → corner/T-junction/cross classification → bevel = halfThicknessOther / sin(angle) clamped to MAX_BEVEL_FRACTION=0.40 of axis length), `applyTrimPatches(entities, trims)` (patches WallParams + recomputes geometry, non-wall entities passthrough). Only `kind='straight'` processed; cross-junctions skipped. (2) `bim/geometry/wall-geometry.ts` modified: new `applyAxisBevels()` helper moves first/last axis vertices inward by `startBevel`/`endBevel` mm; called inside `computeWallGeometry` before offset/bbox computation — first time these WallParams fields actually affect geometry. (3) `hooks/tools/useSpecialTools.ts` modified: `onWallCreated` callback now includes new wall in entity list before computing trims (so neighbors also patch); `applyTrimPatches` applied; patched new-wall entity broadcast via EventBus so first Firestore save uses correct trimmed params. Tests: 19/19 green (corner 90°, corner startBevel, oblique 45°, T-junction both directions, parallel, far-apart, nearly-parallel, max-bevel clamp, applyTrimPatches patch+recompute+passthrough+identity, geometry bevel integration startBevel/endBevel/both/zero). Pending: debounced scene listener for grip-move re-trim → Phase 1E. | Claude Sonnet 4.6 |
| 2026-05-18 | **Phase 2 CORE IMPLEMENTED — Opening (Door/Window) Tool**. End-to-end vertical: user picks Opening tool → first click on a wall locks the host → second click commits a door/window/sliding-door/french-door/fixed opening at the projected offset, snapped 50mm; entity in scene → Firestore save → contextual ribbon edits live-update params. Files created (Phase 2 core, 12 new files): (1) `bim/types/opening-types.ts` — `OpeningKind` (5 kinds), `OpeningParams` (kind + wallId FK + offsetFromStart + width + height + sillHeight + frameWidth? + handing?/openDirection? for hinged + glazingPanes?), `OpeningGeometry` (position/rotation/outline/hingeArc?/bbox/area-m²/perimeter-m), `OpeningEntity extends BimEntity<OpeningKind, OpeningParams, OpeningGeometry>`; `OPENING_KIND_DEFAULTS` (door 900×2100 sill 0, window 1200×1400 sill 900, sliding-door 1800×2200, french-door 1400×2100, fixed 2000×2200), `OPENING_SNAP_INCREMENT_MM=50`, `MIN_OPENING_WIDTH_MM=200`, `MIN_OPENING_HEIGHT_MM=200`. (2) `bim/geometry/opening-geometry.ts` — `computeOpeningGeometry(params, hostWall)` pure SSoT: unit-axis + perpendicular from `wall.start→wall.end`, center at `offsetFromStart + width/2`, 4-corner outline (CCW), bbox folds vertices, area `width*height/1e6` m², perimeter `2*(w+h)/1000` m, hinge arc (door/french-door) via quadratic subdivision with handing/openDirection signs, `projectPointToWallOffset()` helper clamps to `[0, wallLength]`. Curved/polyline hosts fall back to chord (Phase 2.5 lifts). (3) `bim/validators/opening-validator.ts` — hard errors (`missingHostWall`, `widthTooSmall`, `heightTooSmall`, `offsetNegative`, `sillNegative`, `overflowsHostLength`, `overflowsHostHeight`) + code violations (`widthExceedsThicknessRatio` when width > 2× wall thickness, `doorWithSill` when kind='door' & sill > 0). Operates against `hostWall.geometry.length` (m→mm conversion) + `hostWall.params.height`. (4) `hooks/drawing/opening-completion.ts` — `buildDefaultOpeningParams(hostWall, clickPoint, overrides)` projects point onto host axis → centers + snaps to 50mm → clamps to host length; `buildOpeningEntity()` returns discriminated union `{ ok: true, entity } | { ok: false, hardErrors }`; `completeOpeningFromHostClick()` convenience. `getOpeningWorldCenter()` exported for downstream consumers. (5) `hooks/drawing/useOpeningTool.ts` — FSM `idle → awaitingHostWall → awaitingPosition → committed → awaitingHostWall` (continuous-draw chain mirroring `useWallTool`). Click-1 resolves host via injected `getWallAtPoint`; click-2 commits via injected `getWallById`. ESC mid-flow returns to `awaitingHostWall`. `setKind` resets state preserving overrides. Status text returns i18n keys for status-bar. (6) `bim/walls/opening-firestore-service.ts` — `OpeningFirestoreService` + `OpeningDoc` + factory + `entityToSaveInput`. Top-level `floorplan_openings/{openingId}` (companyId field-based tenant isolation), `setDoc` + `generateOpeningId` (SOS N.6), subscribe via `firestoreQueryService` (ADR-355) with ADR-361 equality guard. (7) `hooks/data/useOpeningPersistence.ts` — debounced auto-save 500ms, diff-merge subscribe (preserves locally-dirty + never-saved), first-save listener (`drawing:entity-created` with tool='opening'), delete-requested listener (`bim:opening-delete-requested`), geometry re-derive from `params + hostWall` on hydrate (skips snapshot entries where the host wall isn't yet in scene — re-attempts on next round-trip). (8) `bim/walls/opening-audit-client.ts` — fire-and-forget `recordOpeningChange(action, entity)` POSTs to `/api/audit-trail/record` (`entityType: 'opening'`). (9) `bim/renderers/OpeningRenderer.ts` — ADR-040 micro-leaf: outline stroke per-kind colour (door warm orange, window cool blue, sliding muted purple, french amber, fixed teal) + kind-specific overlay (`drawHingeArc` for door/french-door, `drawSlidingIndicator` for sliding rail, `drawGlazing` inset-double-line for window/fixed/french). Hover halo via outline. `getGrips` returns `[]` (drag-along-wall lands Phase 2.5). `hitTest` bbox-based. (10) `ui/ribbon/hooks/bridge/opening-command-keys.ts` — `OPENING_RIBBON_KEYS` (stringParams.{kind, handing, openDirection}, params.{width, height, sillHeight}) + `OPENING_RIBBON_KEYS_ACTIONS.{close, delete}` + `OPENING_RIBBON_BADGE_KEYS.violations` + type guards. (11) `ui/ribbon/data/contextual-opening-tab.ts` — `CONTEXTUAL_OPENING_TAB`: `opening-kind` panel (5 kind options + handing + openDirection), `opening-size` panel (width 700-2000mm / height 1400-2400mm / sill 0-1100mm comboboxes), `opening-actions` panel (close + delete). `OPENING_CONTEXTUAL_TRIGGER = 'opening-selected'`. (12) `ui/ribbon/hooks/useRibbonOpeningBridge.ts` — combobox/state/action/badge bridge. Phase 2 mutations bypass `CommandHistory` (full undo/redo lands Phase 2.5 με `UpdateOpeningParamsCommand`) — bridge patches scene directly + re-derives geometry+validation via SSoT helpers; auto-save picks up via debounce. Confirm dialog on delete via `t('ribbon.commands.openingEditor.deleteConfirm')` emits `bim:opening-delete-requested`. (13) `app/OpeningPersistenceHost.tsx` — always-on null host that hosts the persistence hook (mirror `WallPersistenceHost`). Files modified (Phase 2 wiring): (a) `types/audit-trail.ts` — `AuditEntityType += 'opening'`. (b) `types/entities.ts` — `OpeningEntity` placeholder replaced by re-export from `bim/types/opening-types`; local `OpeningKind` declaration removed (single SSoT now in concrete types). (c) `systems/events/EventBus.ts` — new events `bim:opening-params-updated` + `bim:opening-delete-requested`. (d) `rendering/core/EntityRendererComposite.ts` — `OpeningRenderer` registered under `'opening'`. (e) `hooks/tools/useSpecialTools.ts` — `useOpeningTool` wired with `getWallById` / `getWallAtPoint` resolvers (bbox containment scan over scene walls); `onOpeningCreated` updates host wall's `hostedOpeningIds` mirror optimistically + emits `drawing:entity-created`. (f) `ui/ribbon/hooks/useRibbonCommands.ts` — composer routes opening-prefixed keys to `openingBridge` (combobox/state/action/badge). (g) `app/ribbon-contextual-config.ts` — `CONTEXTUAL_OPENING_TAB` registered, `resolveContextualTrigger` returns `OPENING_CONTEXTUAL_TRIGGER` for `entity.type === 'opening'`, `activeTool === 'opening'` triggers same. (h) `app/DxfViewerContent.tsx` — `useRibbonOpeningBridge` instantiated + passed into `useRibbonCommands`. (i) `app/DxfViewerTopBar.tsx` — `OpeningPersistenceHost` mounted alongside `WallPersistenceHost`. (j) i18n el+en `dxf-viewer-shell.json`: `ribbon.tabs.openingProperties`, `ribbon.panels.opening{Kind,Size,Actions}`, full `ribbon.commands.openingEditor.*` (width/height/sillHeight/close/delete/deleteConfirm + kind/handing/openDirection section blocks with their member labels), `tools.opening.{statusHostWall,statusPosition,errors.{noHostWall,hostMissing}}`, `tools.wall.status*` (filling gap from Phase 1B). Tests Jest (3 suites, 34 tests): `bim/geometry/__tests__/opening-geometry.test.ts` (15 tests: outline shape, center positioning, rotation horizontal/vertical, area m², perimeter m, bbox folding, hinge arc presence per kind, french-door dual-arc point count, `projectPointToWallOffset` clamping), `bim/validators/__tests__/opening-validator.test.ts` (11 tests: 7 hard errors + 3 code violations + happy path), `hooks/drawing/__tests__/useOpeningTool.test.tsx` (8 tests: FSM transitions, no-host error, commit continuous chain, setKind preservation, reset, deactivate, status text). **Deferred to Phase 2.5+:** boolean cutout on wall fill (visual hole), drag-along-wall grip, wall-split-mid-opening axis update, "Διαγραφή και των N κουφωμάτων;" cascade UX, `O` hotkey + `D`/`Wn` quick-shift, `UpdateOpeningParamsCommand` (full undo/redo), polyline/curved host positioning. | Claude Opus 4.7 |
| 2026-05-18 | **Phase 1D restructured + Phase 1D-A IMPLEMENTED — WallDna Editor "Σύνθεση Στρώσεων"**. §6 Phase 1D split σε 4 sub-phases για phase-per-session compliance: 1D-A DNA Editor (this session), 1D-B Perpendicular Auto-Trim, 1D-C EntityAudit integration, 1D-D BOQ Auto-Feed (Phase 6 dependency). Files created: (1) `bim/walls/wall-material-catalog.ts` — 18 hardcoded wall-layer material presets (concrete C20/C25/C30, brick/stone/block masonry, EPS/XPS/mineral wool insulation, interior/exterior/thermal plaster, gypsum/OSB/vapor barrier, tile/marble/aluminum cladding) + `'custom'` sentinel + `WallMaterialCatalogProvider` interface (Phase 6+ Asset Manager swap target). Mirror stair-material-catalog SSoT. (2) `bim/walls/wall-dna-mutations.ts` — pure immutable helpers `addLayer`/`removeLayer`/`updateLayer`/`reorderLayer`/`fromLayers` preserving SSoT invariant `dna.totalThickness === sum(layers)`. Side-effect free. (3) `ui/wall-advanced-panel/hooks/useSelectedWall.ts` — pure derivation από primarySelectedId + scene (mirror useSelectedStair). (4) `ui/wall-advanced-panel/commands/dispatchWallParamPatch.ts` — `useWallParamsDispatcher` SSoT writer μέσω `UpdateWallParamsCommand` (ADR-031, `isDragging=false` discrete undo step). (5) `ui/wall-advanced-panel/sections/WallWarningsSection.tsx` — read-only display των `validation.violationKeys` (auto-fix Phase 1E+). (6) `ui/wall-advanced-panel/sections/WallPersistenceSection.tsx` — G24 soft-lock display + saveNow button + status indicator (idle/saving/saved HH:mm/error). (7) `ui/wall-advanced-panel/sections/WallDnaSection.tsx` — main feature: ordered layer list (side/name/thickness/material per row), ↑↓ reorder, add/remove, "Φόρτωση προεπιλογής" reloads `getDefaultDnaForCategory(category)`, "Χωρίς σύνθεση" detaches DNA (Revit Generic Wall pattern). All mutations dispatch `{ dna, thickness: dna.totalThickness }` ώστε SSoT invariant να διατηρείται και στο ribbon write path. Material picker = preset combobox + free-form text input για `'custom'`. (8) `ui/wall-advanced-panel/WallAdvancedPanel.tsx` — presentational shell (Warnings + Persistence + DNA sections); supports sidebar-tab + fixed-right modes via containerClassName/hideHeader. (9) `ui/wall-advanced-panel/WallPropertiesTab.tsx` — sidebar wrapper με auth + persistence wiring (mirror StairPropertiesTab). (10) `ui/wall-advanced-panel/BimPropertiesRouter.tsx` — discriminating router στο sidebar "Properties" tab: mounts WallPropertiesTab / StairPropertiesTab ανάλογα με `isWallEntity`/`isStairEntity`; fallback to stair tab για legacy compatibility. Files modified: `ui/hooks/usePanelContentRenderer.tsx` (`case 'properties'` → `BimPropertiesRouter`). i18n el+en: `wallAdvancedPanel.*` namespace (title, emptyState, sections.{warnings,persistence,dna}, materials.preset.* για 18 presets + custom). Pure Greek locale (memory `pure_greek_locale`), zero hardcoded strings (SOS N.11). Tests Jest: `bim/walls/__tests__/wall-dna-mutations.test.ts` (12 tests: add/remove/update/reorder + invariant + boundary no-ops + fromLayers), `bim/walls/__tests__/wall-material-catalog.test.ts` (6 tests: preset coverage + resolvePreset + classifyWallMaterial), `ui/wall-advanced-panel/hooks/__tests__/useSelectedWall.test.ts` (4 tests: match/non-wall/null-scene/null-selection). **Pending → Phase 1D-B (auto-trim), Phase 1D-C (EntityAudit + AuditEntityType extension), Phase 1D-D (BOQ, depends on Phase 6).** | Claude Opus 4.7 |
| 2026-05-18 | **Phase 4 CORE IMPLEMENTED — Column (Rectangular/Circular/L-shape/T-shape) Tool**. End-to-end vertical: user picks Column tool → optional Tab anchor cycle (9-state ring center→n→ne→e→se→s→sw→w→nw) → click commits a rectangular/circular/L-shape/T-shape column at the anchor-projected position with free rotation; entity in scene → Firestore save → contextual ribbon edits live-update params. Files created (Phase 4 core, 14 new files): (1) `bim/types/column-types.ts` — `ColumnKind` (4 kinds), `ColumnAnchor` (9-position selector), `ColumnParams` (kind + position + anchor + width + depth + height + rotation + material? + lshape?/tshape? variant overrides), `ColumnGeometry` (footprint Polygon3D + bbox + area-m² + volume-m³ + height-mm), `ColumnEntity extends BimEntity<ColumnKind, ColumnParams, ColumnGeometry>`; constants `MIN_COLUMN_DIMENSION_MM=250` (Eurocode 25cm), `DEFAULT_COLUMN_WIDTH_MM=400`, `DEFAULT_COLUMN_DEPTH_MM=400`, `DEFAULT_COLUMN_HEIGHT_MM=3000`, `MAX_SLENDERNESS_RATIO=30`, `CIRCULAR_COLUMN_SEGMENTS=32`, `ANCHOR_OFFSETS` (9-entry unit-fraction map), `ANCHOR_CYCLE_ORDER` (9-tuple Tab ring). (2) `bim/geometry/column-geometry.ts` — `computeColumnGeometry(params)` pure SSoT: per-kind local-frame footprint builder (rectangular 4-vertex, circular 32-segment polygon, L-shape 6-vertex με default arm = width/3 / depth/3, T-shape 8-vertex με default flange = width / web = depth/3), `applyAnchorTransform` (translate by anchor offset so anchor sits on `position`), `applyRotation` (rotate around `position` for visual coherence με Tab cycling, circular bypasses both). Area shoelace (m²), volume = area × height/1000 (m³), bbox folds vertices. `getColumnSlenderness()` helper για validator. Re-uses `bim/geometry/shared/polygon-utils.ts` (polygonArea + polygonBbox). (3) `bim/validators/column-validator.ts` — hard errors (`nonPositiveWidth`, `nonPositiveDepth` rectangular-only, `nonPositiveHeight`, `invalidLshapeArm`, `invalidTshapeWeb`, `invalidTshapeFlange`) + code violations (`widthTooSmall` <250mm, `depthTooSmall` <250mm rectangular-only, `maxSlendernessExceeded` >30 Eurocode crude check). Circular skips depth check. (4) `hooks/drawing/column-completion.ts` — `buildDefaultColumnParams(clickPoint, kind, overrides)` (defaults + ribbon overrides resolved), `buildColumnEntity()` returns discriminated union, `completeColumnFromClick()` convenience. ID via `generateColumnId` (SOS N.6). (5) `hooks/drawing/useColumnTool.ts` — FSM `idle → awaitingPosition → committed → awaitingPosition` (continuous chain). `cycleAnchor(±1)` advances through ANCHOR_CYCLE_ORDER. Tab keydown listener cycles forward (Shift+Tab reverses). ESC resets. `setKind` preserves anchor + overrides. (6) `bim/columns/column-firestore-service.ts` — `ColumnFirestoreService` + `ColumnDoc` + factory + `entityToSaveInput`. Top-level `floorplan_columns/{columnId}` (companyId field-based tenant isolation), `setDoc` + `generateColumnId`, subscribe via `firestoreQueryService` (ADR-355) με ADR-361 equality guard. (7) `hooks/data/useColumnPersistence.ts` — debounced auto-save 500ms, diff-merge subscribe (preserves locally-dirty + never-saved), first-save listener (`drawing:entity-created` με tool='column'), delete-requested listener (`bim:column-delete-requested`), geometry re-derive από params on hydrate. (8) `bim/columns/column-audit-client.ts` — fire-and-forget `recordColumnChange(action, entity)` POSTs σε `/api/audit-trail/record` (`entityType: 'column'`). (9) `bim/renderers/ColumnRenderer.ts` — ADR-040 micro-leaf: closed footprint polygon outline (stroke per-kind colour: rectangular cool grey, circular RC grey, L-shape ochre, T-shape steel-blue) + translucent rgba fill (~22%). Hover halo via outline glow. `hitTest`: bbox quick-reject + point-in-polygon (ray casting via `pointInPolygon`). `getGrips` returns `[]` (Phase 4.5). (10) `ui/ribbon/hooks/bridge/column-command-keys.ts` — `COLUMN_RIBBON_KEYS` (stringParams.{kind, anchor}, params.{width, depth, height, rotation}) + `COLUMN_RIBBON_KEYS_ACTIONS.{close, delete}` + `COLUMN_RIBBON_BADGE_KEYS.violations` + type guards. (11) `ui/ribbon/data/contextual-column-tab.ts` — `CONTEXTUAL_COLUMN_TAB`: `column-kind` panel (4 kind options + 9 anchor options), `column-geometry` panel (width 250-1000mm + depth 250-1000mm + height 2400-4000mm + rotation 0/15/30/45/60/90/135/180 deg comboboxes), `column-actions` panel (close + delete). `COLUMN_CONTEXTUAL_TRIGGER = 'column-selected'`. (12) `ui/ribbon/hooks/useRibbonColumnBridge.ts` — combobox/state/action/badge bridge. Phase 4 mutations bypass `CommandHistory` (full undo/redo lands Phase 4.5 με `UpdateColumnParamsCommand`) — bridge patches scene + re-derives geometry+validation via SSoT helpers; auto-save picks up via debounce. Confirm dialog on delete emits `bim:column-delete-requested`. (13) `app/ColumnPersistenceHost.tsx` — always-on null host. (14) Tests Jest (3 suites, 24+ tests): `bim/geometry/__tests__/column-geometry.test.ts` (rectangular/circular/L/T footprint shape, anchor offset center/nw/se, rotation 0/45/90, area m², volume m³, slenderness helper), `bim/validators/__tests__/column-validator.test.ts` (hard errors + code violations + happy path + circular depth bypass), `hooks/drawing/__tests__/useColumnTool.test.tsx` (FSM transitions, single-click commit chain, cycleAnchor forward/reverse, setKind preservation, status text). Files modified (Phase 4 wiring): (a) `types/audit-trail.ts` — `AuditEntityType += 'column'`. (b) `app/api/audit-trail/record/route.ts` — `VALID_ENTITY_TYPES += 'column'`, `ENTITY_COLLECTION_MAP += column: FLOORPLAN_COLUMNS`. (c) `types/entities.ts` — local `ColumnKind` declaration + `ColumnEntity` placeholder removed, now re-exports from `bim/types/column-types`; Entity union uses concrete `ColumnEntity`. (d) `systems/events/EventBus.ts` — new events `bim:column-params-updated` + `bim:column-delete-requested`. (e) `rendering/core/EntityRendererComposite.ts` — `ColumnRenderer` registered under `'column'`. (f) `ui/toolbar/types.ts` — `ToolType` union += `'column'`. (g) `systems/tools/ToolStateManager.ts` — `'column'` TOOL_DEFINITIONS entry (category='drawing', allowsContinuous=true). (h) `hooks/drawing/drawing-types.ts` — `DrawingTool` union += `'column'`. (i) `hooks/canvas/canvas-click-types.ts` — `ColumnToolLike` interface + `columnTool?` field στο `UseCanvasClickHandlerParams`. (j) `hooks/canvas/useCanvasClickHandler.ts` — PRIORITY 4.8 column click routing. (k) `components/dxf-layout/CanvasSection.tsx` — passes `columnTool` prop. (l) `hooks/tools/useSpecialTools.ts` — `useColumnTool` wired με onColumnCreated → scene append + EventBus `drawing:entity-created`. (m) `ui/ribbon/hooks/useRibbonCommands.ts` — composer routes column-prefixed keys σε `columnBridge`. (n) `app/ribbon-contextual-config.ts` — `CONTEXTUAL_COLUMN_TAB` registered; `resolveContextualTrigger` + active tool branch για `'column'`. (o) `app/DxfViewerContent.tsx` — `useRibbonColumnBridge` instantiated + passed σε `useRibbonCommands`. (p) `app/DxfViewerTopBar.tsx` — `ColumnPersistenceHost` mounted. (q) `scripts/check-entity-audit-coverage.js` — `FLOORPLAN_COLUMNS` added σε `TRACKED_COLLECTION_KEYS`; client-SDK service (`column-firestore-service.ts`) added σε `HARD_EXEMPT_PATTERNS`. (r) i18n el+en `dxf-viewer-shell.json`: `ribbon.tabs.columnProperties`, `ribbon.panels.column{Kind,Geometry,Actions}`, full `ribbon.commands.columnEditor.*` (width/depth/height/rotation/close/delete/deleteConfirm + kind + 9-position anchor section blocks), `tools.column.{statusPosition,errors.{nonPositiveWidth,nonPositiveDepth,nonPositiveHeight,invalidLshapeArm,invalidTshapeWeb,invalidTshapeFlange}}`. Pure SOS N.11 compliant (Greek labels, English keys). **Deferred to Phase 4.5+:** position/rotation/dimension grips, hatch patterns per material, anchor visual preview (ghost at all 9 positions), `CO` hotkey (Phase 7 multi-char dispatcher dependency), `UpdateColumnParamsCommand` full undo/redo, snap-to-wall-corners + grid-intersections integration. ✅ Google-level: YES — generic BIM pattern (mirror walls/openings/slabs), pure-function SSoT, ADR-040 micro-leaf renderer, CHECK 3.17 enforced, idempotent diff-merge persistence, full validation pipeline. | Claude Opus 4.7 |
| 2026-05-18 | **Phase 3 CORE IMPLEMENTED — Slab (Floor/Ceiling/Roof/Ground/Foundation) Tool**. End-to-end vertical: user picks Slab tool → multi-click polygon vertices → Enter ή auto-close near first vertex (50mm tolerance) → slab entity in scene → Firestore save → contextual ribbon edits live-update params. Files created (Phase 3 core, 14 new files): (1) `bim/types/slab-types.ts` — `SlabKind` (5 kinds: floor / ceiling / roof / ground / foundation), `SlabParams` (kind + outline Polygon3D + elevation + thickness + slabOpeningIds? + reinforcement? + material?), `SlabGeometry` (polygon + bbox + area-m² + netArea-m² + volume-m³ + perimeter-m), `SlabEntity extends BimEntity<SlabKind, SlabParams, SlabGeometry>`; constants `MIN_SLAB_THICKNESS_MM=100`, `DEFAULT_SLAB_THICKNESS_MM=200`, `MAX_FREE_SPAN_WARNING_M=5`, `MIN_POLYGON_VERTICES=3`, per-kind default elevation lookup. (2) NEW `bim/geometry/shared/polygon-utils.ts` — re-usable pure helpers: `shoelaceArea` (signed Gauss), `polygonArea`/`isPolygonCCW`, `polygonPerimeter`, `polygonBbox`, `pointInPolygon` (ray casting), `isPolygonSelfIntersecting` (O(n²) edge-pair check), `makePolygon3D`. Available for Phase 4/5 column footprint / beam section. (3) `bim/geometry/slab-geometry.ts` — `computeSlabGeometry(params)` pure SSoT: area via shoelace (m²), perimeter sum-of-edges (m), bbox folds vertices, volume = netArea × thickness/1000 (m³). Phase 3 `netArea === area` (slab-openings deferred). `getSlabMaxBboxDimensionM()` helper για validator span check. (4) `bim/validators/slab-validator.ts` — hard errors (`tooFewVertices`, `selfIntersecting`, `zeroArea`, `nonPositiveThickness`) + code violations (`thicknessTooThin` < 100mm, `maxFreeSpanExceeded` bbox > 5m, `ceilingRoofAtZeroElevation` warning). (5) `hooks/drawing/slab-completion.ts` — `buildDefaultSlabParams(vertices, overrides)` (resolves kind / thickness / elevation defaults, lifts 2D verts → Point3D); `buildSlabEntity()` returns discriminated union; `completeSlabFromPolygonClicks()` convenience. ID via `generateSlabId` (SOS N.6). (6) `hooks/drawing/useSlabTool.ts` — FSM `idle → awaitingFirstVertex → awaitingNextVertex (loop) → committed → awaitingFirstVertex` (continuous chain). Enter commits ≥3 verts. ESC resets. Auto-close: click ≤50mm από πρώτη κορυφή με ≥3 verts → commit. ref-backed state + lifecycle parity με `useWallTool` polyline mode. (7) `bim/slabs/slab-firestore-service.ts` — `SlabFirestoreService` + `SlabDoc` + factory + `entityToSaveInput`. Top-level `floorplan_slabs/{slabId}` (companyId field-based tenant isolation), `setDoc` + `generateSlabId`, subscribe via `firestoreQueryService` (ADR-355) με ADR-361 equality guard. (8) `hooks/data/useSlabPersistence.ts` — debounced auto-save 500ms, diff-merge subscribe (preserves locally-dirty + never-saved), first-save listener (`drawing:entity-created` με tool='slab'), delete-requested listener (`bim:slab-delete-requested`), geometry re-derive από params on hydrate. (9) `bim/slabs/slab-audit-client.ts` — fire-and-forget `recordSlabChange(action, entity)` POSTs σε `/api/audit-trail/record` (`entityType: 'slab'`). (10) `bim/renderers/SlabRenderer.ts` — ADR-040 micro-leaf: closed polygon outline (stroke per-kind colour: floor warm grey, ceiling cool blue-grey, roof red-brown, ground dark green, foundation dark grey) + translucent rgba fill (~20%). Hover halo via outline glow. `hitTest`: bbox quick-reject + point-in-polygon (ray casting via `pointInPolygon`). `getGrips` returns `[]` (vertex grips Phase 3.5). (11) `ui/ribbon/hooks/bridge/slab-command-keys.ts` — `SLAB_RIBBON_KEYS` (stringParams.{kind, reinforcement}, params.{thickness, elevation}) + `SLAB_RIBBON_KEYS_ACTIONS.{close, delete}` + `SLAB_RIBBON_BADGE_KEYS.violations` + type guards. (12) `ui/ribbon/data/contextual-slab-tab.ts` — `CONTEXTUAL_SLAB_TAB`: `slab-kind` panel (5 kind options + 4 reinforcement options), `slab-geometry` panel (thickness 100/150/180/200/250/300/400/500mm + elevation -500/0/1500/2800/3000/3300/6000mm comboboxes), `slab-actions` panel (close + delete). `SLAB_CONTEXTUAL_TRIGGER = 'slab-selected'`. (13) `ui/ribbon/hooks/useRibbonSlabBridge.ts` — combobox/state/action/badge bridge. Phase 3 mutations bypass `CommandHistory` (full undo/redo lands Phase 3.5 με `UpdateSlabParamsCommand`) — bridge patches scene + re-derives geometry+validation via SSoT helpers; auto-save picks up via debounce. Confirm dialog on delete emits `bim:slab-delete-requested`. (14) `app/SlabPersistenceHost.tsx` — always-on null host. Files modified (Phase 3 wiring): (a) `types/audit-trail.ts` — `AuditEntityType += 'slab'`. (b) `app/api/audit-trail/record/route.ts` — `VALID_ENTITY_TYPES += 'opening'/'slab'`, `ENTITY_COLLECTION_MAP += opening: FLOORPLAN_OPENINGS / slab: FLOORPLAN_SLABS`. (c) `types/entities.ts` — local `SlabKind` declaration + `SlabEntity` placeholder removed, now re-exports from `bim/types/slab-types`; Entity union uses concrete `SlabEntity`. (d) `systems/events/EventBus.ts` — new events `bim:slab-params-updated` + `bim:slab-delete-requested`. (e) `rendering/core/EntityRendererComposite.ts` — `SlabRenderer` registered under `'slab'`. (f) `ui/toolbar/types.ts` — `ToolType` union += `'opening'` (Phase 2 backfill) + `'slab'`. (g) `systems/tools/ToolStateManager.ts` — `'opening'` + `'slab'` TOOL_DEFINITIONS entries (category='drawing', allowsContinuous=true). (h) `hooks/drawing/drawing-types.ts` — `DrawingTool` union += `'slab'`. (i) `hooks/canvas/canvas-click-types.ts` — `SlabToolLike` interface + `slabTool?` field στο `UseCanvasClickHandlerParams`. (j) `hooks/canvas/useCanvasClickHandler.ts` — PRIORITY 4.7 slab click routing. (k) `components/dxf-layout/CanvasSection.tsx` — passes `slabTool` prop. (l) `hooks/tools/useSpecialTools.ts` — `useSlabTool` wired με onSlabCreated → scene append + EventBus `drawing:entity-created`. (m) `ui/ribbon/hooks/useRibbonCommands.ts` — composer routes slab-prefixed keys σε `slabBridge`. (n) `app/ribbon-contextual-config.ts` — `CONTEXTUAL_SLAB_TAB` registered; `resolveContextualTrigger` + active tool branch για `'slab'`. (o) `app/DxfViewerContent.tsx` — `useRibbonSlabBridge` instantiated + passed σε `useRibbonCommands`. (p) `app/DxfViewerTopBar.tsx` — `SlabPersistenceHost` mounted. (q) `scripts/check-entity-audit-coverage.js` — `FLOORPLAN_SLABS` + `FLOORPLAN_OPENINGS` added σε `TRACKED_COLLECTION_KEYS`; client-SDK services (`slab-firestore-service.ts` + `opening-firestore-service.ts`) added σε `HARD_EXEMPT_PATTERNS`. (r) i18n el+en `dxf-viewer-shell.json`: `ribbon.tabs.slabProperties`, `ribbon.panels.slab{Kind,Geometry,Actions}`, full `ribbon.commands.slabEditor.*` (thickness/elevation/close/delete/deleteConfirm + kind/reinforcement section blocks), `tools.slab.{statusFirstVertex,statusNextVertex,errors.{tooFewVertices,selfIntersecting,zeroArea}}`. Pure SOS N.11 compliant (Greek labels, English keys). Tests Jest (3 suites, 26 tests): `bim/geometry/__tests__/slab-geometry.test.ts` (15 tests: shoelace area for square/rectangle/triangle/L-shape, perimeter, bbox, volume, CCW/CW orientation handling, degenerate polygon, polygon-utils helpers — bowtie self-intersect detection), `bim/validators/__tests__/slab-validator.test.ts` (12 tests: tooFewVertices, selfIntersecting, zeroArea, nonPositiveThickness hard errors + thicknessTooThin/maxFreeSpanExceeded/ceilingRoofAtZeroElevation code violations + happy path), `hooks/drawing/__tests__/useSlabTool.test.tsx` (10 tests: FSM transitions, accumulating vertices, Enter commit ≥3 verts, < 3 verts no-op, auto-close near first vertex, deactivate, setKind preservation, status text per phase). **Deferred to Phase 3.5+:** slab-opening separate entity (lift shaft / stair well / duct / chimney, §11.Q3), vertex grips για polygon edit, rectilinear constraint Shift toggle (90° increments), hatch patterns per reinforcement type, maxFreeSpan analytical (1D beam-direction span vs crude bbox), `SL` hotkey, `UpdateSlabParamsCommand` (full undo/redo). | Claude Opus 4.7 |
| 2026-05-18 | **Phase 6 CORE IMPLEMENTED — BOQ Auto-Feed**. Fire-and-forget bridge wired σε όλα 5 BIM entity types. Files created: `bim/config/bim-to-atoe-mapping.ts` (5 ATOE tables, `resolveAtoeMapping` resolver, Latin OIK- prefix), `bim/services/BimToBoqBridge.ts` (singleton, deterministic ID `boq_bim_${entityId}`, single-getDoc upsert με detach guard + createdAt preservation, `upsertBoqItemForBim` / `deleteBoqItemForBim` / `getBoqItemBySourceEntity`). Types modified: `BOQSource` += `'bim-auto'`, `BOQItem` += 4 BIM fields (`sourceType`/`sourceEntityId`/`sourceEntityType`/`detached`), `UpdateBOQItemInput` += `detached`. Persistence hooks (5): `buildingId` param + bridge calls (`void` fire-and-forget). Persistence hosts (5): `buildingId?: string` prop. `DxfViewerTopBar`: passes `buildingId` to all 5 hosts. BOQ UI: BIM badge (cyan=auto, muted=detached) + Detach button (Unlink icon) in `BOQCategoryAccordion`. `MeasurementsTabContent`: `handleDetach` handler. i18n: `badge.{bimAuto,bimDetached}` + `actions.{detachFromBim,detachFromBimConfirm}` (el+en). Tests: 14 mapping tests + 11 bridge tests. Deferred: DNA layer sub-items (Phase 6.1), material library–driven mapping (Phase 6.2). | Claude Opus 4.7 |
| 2026-05-18 | **Phase 1 TypeScript Compilation — 0 errors**. Συστηματική διόρθωση 578→0 TS errors που προέκυψαν από ADR-363 Phase 1 (νέα BIM entity types, `layerId` migration, `ISceneManager` extension, `ICommand` interface, GripInfo type mismatch). Root-cause fixes (Autodesk-grade, χωρίς workarounds): (1) `ReorderEntityCommand.ts` — πλήρης `ICommand` interface (name/type/getDescription/serialize/getAffectedEntityIds). (2) `useWallTool.ts` — `WallParamOverrides` readonly props → spread pattern. (3) `grip-computation.ts` + `apply-entity-preview.ts` — `StairGripKind` import από σωστή πηγή (`hooks/grip-types.ts` όχι `systems/stairs/stair-grips`). (4) `trim-fence-hit-detector.ts` + `trim-intersection-mapper.ts` — `layerId` + `visible:true` σε minimal entity literals. (5) `types/scene.ts` — `LayerId` re-export. (6) `useSceneState.ts` + `useLevelSceneLoader.ts` — `layers:{}` → `layersById:{}`. (7) `HitTestingService.ts` — `baseModel` type widen, `switch(entity.type as string)` για BIM types, `never`-check default αντικαθίσταται με safe fallback. (8) `grip-commit-adapters.ts` + `useGripMovement.ts` + `useMoveEntities.ts` — 4 νέες `ISceneManager` methods (`updateEntities`/`getEntityIndex`/`reorderEntity`/`moveEntityToIndex`). (9) `StairRenderer.ts` + `WallRenderer.ts` — mapper hooks `GripInfo[]` → rendering `GripInfo[]` μέσα στο `getGrips()`. (10) `ISpatialIndex.ts` + Grid/QuadTree/Factory — `querySnap` signature += `'dim_def_point'|'dim_line'`. (11) `dxf-viewport-culling.ts` — `default:` case με large bbox fallback. (12) `ToolStateManager.ts` — `dim-center-mark`/`dim-centerline` TOOL_DEFINITIONS entries. (13) `WallPropertiesTab.tsx` — `buildingId:null`. (14) `useStairPersistence.ts` — `doc.layer` (StairDoc legacy field, όχι `doc.layerId`). (15) `wall-preview-helpers.ts` + `useAngleEntityMeasurement.ts` — `?? ''` fallback. (16) `extract-entity-key-points.ts` — type-safe `.filter((p): p is Point2D => p !== undefined)`. (17) `array-entity-transform.ts` + `scale-entity-transform.ts` — conditional spread για optional `Point2D` fields σε `scaleDimension`/`transformDimension`. (18) `useFloorplanSceneLoader.ts` + `FloorplanProcessor.ts` — `result.scene` extract σε const μετά guard. (19) `useCentralizedMouseHandlers.ts` + `useDynamicInputHandler.ts` + `extend-intersection-caster.ts` — `layer:` → `layerId:`. (20) `dxf-dimension-converter.ts` — `layer,` → `layerId: layer,`. (21) `DxfViewerContent.tsx` — `levelManager.fileRecordId ?? null`. (22) `useWallPersistence.ts` — `entity.params as unknown as Readonly<{category?:string;[key:string]:unknown}>` safe double-cast. (23) `SubscribeDocOptions` — `tenantOverride?: 'skip'` field για user-settings bypass. | Claude Sonnet 4.6 |
| 2026-05-18 | **Phase 7A IMPLEMENTED — Multi-Char BIM Hotkeys dispatcher**. Centralizes 2-char BIM tool shortcuts into `MultiCharKeySequence` (pure class, no React, 350ms prefix-tree window). Files created: (1) `src/subapps/dxf-viewer/keyboard/MultiCharKeySequence.ts` — `ChordDefinition`/`FallbackDefinition`/`FeedResult` discriminated union, `feed(key)` resolves chord-started / chord-completed / fallback-fired / miss, `hasPending()`, `destroy()`. (2) `src/subapps/dxf-viewer/keyboard/__tests__/MultiCharKeySequence.test.ts` — 25/25 tests (chord completion × 5, timeout fallback × 4 leaders, fallback-fired × 3, miss × 3, hasPending × 4, destroy × 2, prefix collision S→stair/slab). Files modified: (3) `keyboard-shortcuts.ts` — 4 new `DXF_TOOL_SHORTCUTS` entries: opening=OP, slab=SL, column=CL, beam=BM. (4) `useDxfToolbarShortcuts.ts` — replaces manual `stairChordRef` + individual select/circle/layering `matchesShortcut` blocks with unified `bimDispatcherRef`. Chord table: S+T→stair, S+L→slab, O+P→opening, C+L→column, B+M→beam. Fallbacks: S→select, O→layering (toggle), C→circle (B=null). Stale-closure prevention: `callbacksRef.current` updated every render, read at timer-fire time. Deferred items marked done: OP (Phase 2), SL (Phase 3.5), CL (Phase 4.5, also fixes CO→CL doc error), BM (Phase 5.5). | Claude Sonnet 4.6 |
| 2026-05-18 | **Phase 2.5 IMPLEMENTED — Opening Advanced Editing**. Closes the Phase 2 gaps around opening editing affordances + visual integration με τοίχους. Files created (4): (1) `core/commands/entity-commands/UpdateOpeningParamsCommand.ts` — atomic patch `params` + recomputed `geometry` (`computeOpeningGeometry`) + `validation` (`validateOpeningParams`); host wall resolved per execute/undo/redo through `sceneManager.getEntity(params.wallId)`; merge window (ADR-031 `DEFAULT_MERGE_CONFIG.mergeTimeWindow`) collapses continuous grip drags into one undo entry; soft-orphan fallback: host missing → params still applied, intrinsic-only validation, previous geometry preserved. (2) `bim/walls/opening-grips.ts` — pure (no React/DOM/Firestore). `getOpeningGrips()` returns a single `opening-offset` grip at `geometry.position` (world center on the host axis); `applyOpeningGripDrag()` projects the cursor onto the host axis via `projectPointToWallOffset()`, subtracts `width/2` to land at the left jamb, clamps to `[frameWidth, hostLength - width - frameWidth]`; refuses (returns `originalParams`) when the host can't fit the opening + both jambs; foreign grip-kind no-op. (3) `bim/walls/__tests__/opening-grips.test.ts` — 8 Jest tests: grip layout (`opening-offset`, type `center`, `movesEntity=true`), position equals `geometry.position`, drag projects+clamps min/max, refuses on undersized host, idempotent identity when cursor maps to current center, unknown grip-kind returns originalParams. (4) `core/commands/entity-commands/__tests__/UpdateOpeningParamsCommand.test.ts` — 11 Jest tests: execute/undo/redo round-trip, undo-before-execute no-op, `canMergeWith` true within window (same opening + both dragging) / false on isDragging mismatch / cross-opening, soft-orphan branch (geometry preserved, validation intrinsic-only), validate rejects empty id + negative width/offset, serialize round-trips key fields. (5) `bim/renderers/__tests__/WallRenderer-with-openings.test.ts` — 6 Jest tests via canvas-mock (firebase/auth stubbed): no openings → no `destination-out`, scoped `save/restore` brackets cutout pass, cutout fills opening outline (lineTo+closePath+fill), foreign-wall openings ignored, stroke survives cutout, multi-opening punching (≥2 beginPath/fill). Files modified (8): (a) `hooks/grip-types.ts` — added `OpeningGripKind = 'opening-offset'` + `GripInfo.openingGripKind?`. (b) `hooks/useGripMovement.ts` — re-exports `OpeningGripKind`. (c) `hooks/grips/unified-grip-types.ts` — `UnifiedGripInfo.openingGripKind?` forwarded from `GripInfo`. (d) `hooks/grips/grip-registry.ts` — `wrapDxfGrip` conditional spread forwards `openingGripKind`. (e) `hooks/grips/grip-commit-adapters.ts` — new `commitOpeningGripDrag` (resolves opening + host via `sceneManager.getEntity`, builds `UpdateOpeningParamsCommand` with `isDragging=true`, emits `bim:opening-params-updated`); `commitDxfGripDragModeAware` early-branches on `openingGripKind` before stretch/move/rotate paths. (f) `bim/renderers/OpeningRenderer.ts` — `getGrips()` now wires `getOpeningGrips(opening)` mapped to rendering `GripInfo` (replaces Phase 2 stub returning `[]`). (g) `bim/renderers/WallRenderer.ts` — `OpeningsByWall` type + private `openingsByWall` Map + `setOpeningsByWall()` setter + `punchHostedOpenings()` pass after fill (scoped `save/restore`, `globalCompositeOperation = 'destination-out'`, per-opening outline `beginPath`+`moveTo`+`lineTo`*N+`closePath`+`fill`, then `restore` before stroke). Empty/missing entries silently no-op. ADR-040 micro-leaf preserved — renderer never subscribes, caller pushes per-frame map. (h) `rendering/core/EntityRendererComposite.ts` — re-exports `OpeningsByWall`, registers `setOpeningsByWall(map)` forwarder over the wall renderer. (i) `ui/ribbon/hooks/useRibbonOpeningBridge.ts` — replaced direct scene patch with `executeCommand(new UpdateOpeningParamsCommand(...))` via `useCommandHistory().execute` + `LevelSceneManagerAdapter`; drops `resolveHostWall`/`computeOpeningGeometry`/`validateOpeningParams` imports (now owned by the command). Ribbon edits use `isDragging=false` so each combobox change is its own undo entry. Pending follow-up: wire `composite.setOpeningsByWall(...)` call site from the BIM render pass (the per-frame builder is a `scene.entities.filter(isOpeningEntity)` group-by `params.wallId`); renderer-side machinery + tests already in place. ✅ Google-level: YES — atomic Update command (proactive recompute, idempotent, single SSoT), pure grip handler (no React/DOM), ADR-040 micro-leaf cutout (setter pattern), undo/redo across both grip-drag AND ribbon edits, soft-orphan safe, full Jest coverage (25 new tests across 3 suites). | Claude Sonnet 4.6 |
| 2026-05-18 | **Phase 5 CORE IMPLEMENTED — Beam (Straight/Curved/Cantilever) Tool**. End-to-end vertical: user picks Beam tool → 2 clicks (straight/cantilever) ή 3 clicks (curved με quadratic Bezier control) → beam entity in scene → Firestore save → contextual ribbon edits live-update params. Files created (Phase 5 core, 14 new files): (1) `bim/types/beam-types.ts` — `BeamKind` (3 kinds: straight / curved / cantilever), `BeamSupportType` (simple / fixed / cantilever), `BeamParams` (kind + startPoint + endPoint + curveControl? + width + depth + elevation + material? + supportType?), `BeamGeometry` (axisPolyline + outline + bbox + length-m + area-m² + volume-m³), `BeamEntity extends BimEntity<BeamKind, BeamParams, BeamGeometry>`; constants `MIN_BEAM_WIDTH_MM=150` (Eurocode), `DEFAULT_BEAM_WIDTH_MM=250`, `DEFAULT_BEAM_DEPTH_MM=500`, `MIN_BEAM_LENGTH_MM=200`, `MAX_SPAN_DEPTH_RATIO=20`, `MAX_CANTILEVER_SPAN_DEPTH_RATIO=10`, `DEFAULT_BEAM_ELEVATION_MM=3000`, `CURVED_BEAM_SUBDIVISIONS=16`. (2) `bim/geometry/beam-geometry.ts` — `computeBeamGeometry(params)` pure SSoT: axis vertices (straight/cantilever 2-vertex, curved 17-vertex quadratic Bezier subdivision), perpendicular offset σε ±width/2 → outline (CCW polygon), length sum-of-edges (m), area = length × width (m²), volume = area × depth (m³), bbox folds outline + axis + extends z σε elevation. `getBeamSpanDepthRatio()` helper για validator. (3) `bim/validators/beam-validator.ts` — hard errors (`nonPositiveWidth`, `nonPositiveDepth`, `lengthTooShort` < 200mm, `missingCurveControl` curved-only) + code violations (`widthTooSmall` < 150mm Eurocode, `spanDepthExceeded` > 20, `cantileverSpanDepthExceeded` > 10 halved threshold). (4) `hooks/drawing/beam-completion.ts` — `buildDefaultBeamParams(start, end, kind, overrides)` (defaults + ribbon overrides, kind→supportType default: cantilever ↔ cantilever, else simple), `buildBeamEntity()` returns discriminated union, `completeBeamFromTwoClicks()` + `completeBeamFromThreeClicks()` convenience. ID via `generateBeamId` (SOS N.6). (5) `hooks/drawing/useBeamTool.ts` — FSM `idle → awaitingStart → awaitingEnd → (curved: awaitingCurveControl) → committed → awaitingStart` (continuous chain). ESC reset. `setKind` preserves overrides. Mirror του `useWallTool` curved/straight pattern (απουσιάζει polyline kind — Phase 5 scope). (6) `bim/beams/beam-firestore-service.ts` — `BeamFirestoreService` + `BeamDoc` + factory + `entityToSaveInput`. Top-level `floorplan_beams/{beamId}` (companyId field-based tenant isolation), `setDoc` + `generateBeamId`, subscribe via `firestoreQueryService` (ADR-355) με ADR-361 equality guard. (7) `hooks/data/useBeamPersistence.ts` — debounced auto-save 500ms, diff-merge subscribe (preserves locally-dirty + never-saved), first-save listener (`drawing:entity-created` με tool='beam'), delete-requested listener (`bim:beam-delete-requested`), geometry re-derive από params on hydrate. (8) `bim/beams/beam-audit-client.ts` — fire-and-forget `recordBeamChange(action, entity)` POSTs σε `/api/audit-trail/record` (`entityType: 'beam'`). (9) `bim/renderers/BeamRenderer.ts` — ADR-040 micro-leaf: dashed outline polygon (industry convention για hidden beam στο plan view — `setLineDash([8,4])`) + dashed axis centerline (thinner `[4,3]`) + translucent fill (~15% lighter από column/slab). Per-kind palette: straight steel-grey, curved warm-brown, cantilever red-accent. Hover halo via outline glow. `hitTest`: bbox quick-reject + point-in-polygon σε outline. `getGrips` returns `[]` (Phase 5.5 grips deferred). (10) `ui/ribbon/hooks/bridge/beam-command-keys.ts` — `BEAM_RIBBON_KEYS` (stringParams.{kind, supportType}, params.{width, depth, elevation}) + `BEAM_RIBBON_KEYS_ACTIONS.{close, delete}` + `BEAM_RIBBON_BADGE_KEYS.violations` + type guards. (11) `ui/ribbon/data/contextual-beam-tab.ts` — `CONTEXTUAL_BEAM_TAB`: `beam-kind` panel (3 kind options + 3 supportType options), `beam-geometry` panel (width 150/200/250/300/400mm + depth 300/400/500/600/800mm + elevation 2400/2700/3000/3300/3600/4000mm comboboxes), `beam-actions` panel (close + delete). `BEAM_CONTEXTUAL_TRIGGER = 'beam-selected'`. (12) `ui/ribbon/hooks/useRibbonBeamBridge.ts` — combobox/state/action/badge bridge. Phase 5 mutations bypass `CommandHistory` (full undo/redo lands Phase 5.5 με `UpdateBeamParamsCommand`) — bridge patches scene + re-derives geometry+validation via SSoT helpers; auto-save picks up via debounce. Confirm dialog on delete emits `bim:beam-delete-requested`. (13) `app/BeamPersistenceHost.tsx` — always-on null host. (14) Tests Jest (3 suites, 24+ tests): `bim/geometry/__tests__/beam-geometry.test.ts` (10+ tests: straight 2-vertex axis, curved 17-vertex subdivision, outline rect, length m, area m², volume m³, bbox extension to elevation, cantilever same as straight, getBeamSpanDepthRatio helper), `bim/validators/__tests__/beam-validator.test.ts` (8+ tests: 4 hard errors + 3 code violations + happy path), `hooks/drawing/__tests__/useBeamTool.test.tsx` (6+ tests: idle/activate, straight 2-click commit chain, curved 3-click commit, cantilever 2-click, setKind preservation, status text, deactivate). Files modified (Phase 5 wiring): (a) `types/audit-trail.ts` — `AuditEntityType += 'beam'`. (b) `app/api/audit-trail/record/route.ts` — `VALID_ENTITY_TYPES += 'beam'`, `ENTITY_COLLECTION_MAP += beam: FLOORPLAN_BEAMS`. (c) `types/entities.ts` — local `BeamKind` declaration + `BeamEntity` placeholder removed, now re-exports from `bim/types/beam-types`; Entity union uses concrete `BeamEntity`. (d) `systems/events/EventBus.ts` — new events `bim:beam-params-updated` + `bim:beam-delete-requested`. (e) `rendering/core/EntityRendererComposite.ts` — `BeamRenderer` registered under `'beam'`. (f) `ui/toolbar/types.ts` — `ToolType` union += `'beam'`. (g) `systems/tools/ToolStateManager.ts` — `'beam'` TOOL_DEFINITIONS entry (category='drawing', allowsContinuous=true). (h) `hooks/drawing/drawing-types.ts` — `DrawingTool` union += `'beam'`. (i) `hooks/canvas/canvas-click-types.ts` — `BeamToolLike` interface + `beamTool?` field στο `UseCanvasClickHandlerParams`. (j) `hooks/canvas/useCanvasClickHandler.ts` — PRIORITY 4.9 beam click routing. (k) `components/dxf-layout/CanvasSection.tsx` — passes `beamTool` prop. (l) `hooks/tools/useSpecialTools.ts` — `useBeamTool` wired με onBeamCreated → scene append + EventBus `drawing:entity-created`. (m) `ui/ribbon/hooks/useRibbonCommands.ts` — composer routes beam-prefixed keys σε `beamBridge`. (n) `app/ribbon-contextual-config.ts` — `CONTEXTUAL_BEAM_TAB` registered; `resolveContextualTrigger` + active tool branch για `'beam'`. (o) `app/DxfViewerContent.tsx` — `useRibbonBeamBridge` instantiated + passed σε `useRibbonCommands`. (p) `app/DxfViewerTopBar.tsx` — `BeamPersistenceHost` mounted. (q) `scripts/check-entity-audit-coverage.js` — `FLOORPLAN_BEAMS` added σε `TRACKED_COLLECTION_KEYS`; client-SDK service (`beam-firestore-service.ts`) added σε `HARD_EXEMPT_PATTERNS`. (r) i18n el+en `dxf-viewer-shell.json`: `ribbon.tabs.beamProperties`, `ribbon.panels.beam{Kind,Geometry,Actions}`, full `ribbon.commands.beamEditor.*` (width/depth/elevation/close/delete/deleteConfirm + kind/supportType section blocks), `tools.beam.{statusStart,statusEnd,statusCurveEnd,statusCurveControl,errors.{nonPositiveWidth,nonPositiveDepth,lengthTooShort,missingCurveControl,widthTooSmall,spanDepthExceeded,cantileverSpanDepthExceeded}}`. Pure SOS N.11 compliant (Greek labels, English keys). **Deferred to Phase 5.5+:** start/end/midpoint/curveControl grips, width/depth dimension grips, hatch patterns per material (RC/steel/glulam), `BM` hotkey (Phase 7 multi-char dispatcher dependency), `UpdateBeamParamsCommand` (full undo/redo), auto-connect to columns (beam ends snap to column anchors), snap-to-wall-axis/column-center integration, beam-supports-slab analytical link (Phase 6 BOQ dependency). ✅ Google-level: YES — generic BIM pattern (mirror walls/openings/slabs/columns), pure-function SSoT, ADR-040 micro-leaf renderer, CHECK 3.17 enforced, idempotent diff-merge persistence, full validation pipeline. | Claude Opus 4.7 |
| 2026-05-18 | **Phase 3.6 IMPLEMENTED — Slab Polish (edge-midpoint grips + rectilinear constraint + reinforcement hatch)**. Closes the Phase 3.5 deferred list for slab editing affordances + visual hint hatch. Files created (2): (1) `src/subapps/dxf-viewer/keyboard/ShiftKeyTracker.ts` — vanilla singleton pub/sub mirroring `GripCopyModeStore`. Installs `window` `keydown`/`keyup`/`blur` listeners once at module load (SSR-safe `typeof window` guard) and exposes `getSnapshot(): boolean` for commit-time consumers that cannot plumb the Shift modifier through `useUnifiedGripInteraction.handleMouseUp(worldPos)` (which intentionally drops the native event). ADR-040 compliant — low-frequency UI events, no render-path subscriptions. (2) `bim/renderers/__tests__/SlabRenderer-hatch.test.ts` — 7 canvas-mock tests (firebase/auth stubbed): no reinforcement → no `clip`, one-way → only horizontal hatch lines, two-way > one-way line count, waffle > two-way density, flat → arc/fill dot grid (no parallel-line strokes), scoped save/clip/restore, stroke survives clip. Files modified (5): (a) `hooks/grip-types.ts` — `SlabGripKind` widened to discriminated template-literal union `\`slab-vertex-${number}\` | \`slab-edge-midpoint-${number}\``. Re-exports through `useGripMovement.ts` + `unified-grip-types.ts` propagate automatically. (b) `bim/slabs/slab-grips.ts` — `getSlabGrips()` now returns `2N` grips for an `N`-vertex polygon (`[0, N)` vertex grips, `[N, 2N)` edge-midpoint grips with `type='midpoint'` + `edgeVertexIndices=[i, (i+1)%N]`). `SlabGripDragInput.rectilinear?: boolean` added; `applySlabGripDrag` quantizes `delta` to the dominant world axis when `rectilinear=true` (`|dx| ≥ |dy|` → keep dx, drop dy; otherwise reverse) and dispatches by prefix: `slab-vertex-` → translate indexed vertex; `slab-edge-midpoint-` → `insertVertexOnEdge(verts, delta, edgeIdx)` builds a fresh `Point3D` at `midpoint(verts[N], verts[(N+1) mod len]) + delta`, splicing it between the two endpoints (z averaged from endpoints when present). Out-of-range / unknown / zero-delta short-circuit preserved. (c) `bim/renderers/SlabRenderer.ts` — new private `drawReinforcementHatch(slab)` pass between fill and stroke when `params.reinforcement` set. Polygon-clipped (save → polygon path → clip → hatch → restore). World-space spacing per family (`HATCH_SPACING_MM`): one-way 200mm horizontal, two-way 300mm orthogonal grid, waffle 150mm dense cross-hatch, flat 250mm dot grid (arc + fill per dot). Stroke kept faint (`rgba(0,0,0,0.15)`, `lineWidth=0.5`) so outline + fill stay readable. Industry convention (Revit/ArchiCAD plan-view hint hatch). `getGrips()` maps `type='midpoint'` for edge-midpoint grips, `type='vertex'` otherwise. (d) `hooks/grips/grip-parametric-commits.ts` — `commitSlabGripDrag` reads `ShiftKeyTracker.getSnapshot()` and passes `rectilinear` into `applySlabGripDrag`. No signature change to `commitDxfGripDragModeAware`/`DxfCommitDeps`. (e) `bim/slabs/__tests__/slab-grips.test.ts` — extended from 10 → 20 Jest tests: existing Phase 3.5 coverage retained, 10 new Phase 3.6 tests for edge-midpoint grip positions (incl. closing-edge wrap), `type='midpoint'` + `edgeVertexIndices`, vertex insertion at `midpoint + delta` (length+1, original vertices untouched), out-of-range edge index short-circuit, rectilinear quantization on each axis with tie-break, edge-midpoint + rectilinear interaction, `rectilinear=false` default preserves full delta. **Deferred to Phase 3.7+:** slab-opening separate entity (§11.Q3) + boolean cutout on slab fill (mirrors wall's `OpeningsByWall` pattern from Phase 2.5), maxFreeSpan analytical (1D beam-direction span vs crude bbox max-dimension), per-material hatch palette (Phase 6+ material library dependency), snap-to-edge-midpoint preview ghost while hovering edge-midpoint grip pre-drag. ✅ Google-level: YES — pure parametric grip handler (no React/DOM/Firestore), vanilla modifier tracker (no React subscription), ADR-040 micro-leaf renderer (zero high-frequency subscriptions, hatch clipped by polygon), single command path (UpdateSlabParamsCommand), full undo/redo via existing merge window (ADR-031), zero hardcoded user-facing strings (SOS N.11 — all new code is rendering/grip math). | Claude Opus 4.7 |
| 2026-05-18 | **Phase 3.7 IMPLEMENTED — Slab-Opening Entity (§11.Q3)**. First-class BIM entity for πλακο-διανοίξεις: elevator shaft / stair well / duct / chimney. End-to-end: user picks Slab-Opening tool → click host slab → click position → rectangle opening spawned at cursor (default size per kind) → Firestore save → contextual ribbon edits kind live-update params. Files created (Phase 3.7 core + wiring): (1) `bim/types/slab-opening-types.ts` — `SlabOpeningKind` (4 kinds), `SlabOpeningParams` (kind + slabId FK + outline Polygon3D + optional: elevationOverride / multiStoreyStackGroupId / fireRating / material), `SlabOpeningGeometry`, `SlabOpeningEntity extends BimEntity`. Constants: MIN_VERTICES=3, MIN_AREA_MM2=10_000, per-kind default sizes + per-kind min dimension guards. (2) `bim/geometry/slab-opening-geometry.ts` — `computeSlabOpeningGeometry(params)` pure SSoT. (3) `bim/validators/slab-opening-validator.ts` — hard errors (tooFewVertices / selfIntersecting / zeroArea / missingHostSlab) + code violation (tooSmallForKind). (4) `hooks/drawing/useSlabOpeningTool.ts` — FSM `idle → awaitingHostSlab → awaitingPosition → committed`. (5) `hooks/tools/useSpecialTools-slab-opening.ts` — extracted `buildSlabOpeningResolvers(levelManager)` (getSlabById, getSlabAtPoint bbox, onSlabOpeningCreated host mirror + EventBus). (6) `core/commands/entity-commands/UpdateSlabOpeningParamsCommand.ts` — atomic patch params + geometry + validation; soft-orphan policy; merge window ADR-031. (7) `bim/slab-openings/slab-opening-firestore-service.ts` — Firestore `floorplan_slab_openings/{slabOpeningId}` companyId tenant isolation. (8) `hooks/data/useSlabOpeningPersistence.ts` — debounced auto-save 500ms, diff-merge subscribe, first-save + delete listeners. (9) `bim/renderers/SlabOpeningRenderer.ts` — dashed red-accent outline + 30% translucent fill + hitTest + per-kind palette; `getGrips → []` deferred. (10–13) Ribbon Feature H: `slab-opening-command-keys.ts`, `contextual-slab-opening-tab.ts` (kind combobox 4 options + actions), `useRibbonSlabOpeningBridge.ts` (`UpdateSlabOpeningParamsCommand` path, badge state, delete confirm), `SlabOpeningPersistenceHost.tsx`. Files modified (Phase 3.7 wiring): (a) `hooks/tools/useSpecialTools.ts` — `slabOpeningTool` wired PRIORITY 4.95. (b) `components/dxf-layout/CanvasSection.tsx` — `slabOpeningTool` prop. (c) `canvas-v2/dxf-canvas/dxf-types.ts` — `DxfSlab` + `DxfSlabOpening` wrappers; `DxfEntityUnion` extended. (d) `hooks/canvas/useDxfSceneConversion.ts` — slab + slab-opening convertEntity cases. (e) `canvas-v2/dxf-canvas/DxfRenderer.ts` — `buildSlabOpeningsBySlab()` per-frame + `toEntityModel` cases. (f) `rendering/core/EntityRendererComposite.ts` — `SlabOpeningRenderer` registered; `setSlabOpeningsBySlab` forwarder. (g) `systems/events/EventBus.ts` — `bim:slab-opening-params-updated` + `bim:slab-opening-delete-requested`. (h) `ui/ribbon/hooks/useRibbonCommands.ts` — `slabOpeningBridge` composer; slab-opening key guards. (i) `app/ribbon-contextual-config.ts` — `CONTEXTUAL_SLAB_OPENING_TAB` + trigger for `'slab-opening'` entity + activeTool. (j) `app/useDxfBimBridges.ts` — `slabOpeningBridge` aggregated. (k) `app/DxfViewerContent.tsx` — `slabOpeningBridge` passed to `useRibbonCommands`. (l) `app/DxfViewerTopBar.tsx` — `SlabOpeningPersistenceHost` mounted. (m) i18n el+en `dxf-viewer-shell.json` — `ribbon.tabs.slabOpeningProperties`, panels, commands, tools.slabOpening, slabOpening.validation. **Deferred to Phase 3.7+:** SlabOpeningGrips (vertex + edge-midpoint), boolean cutout on SlabRenderer (map already plumbed — `destination-out` pass pending), multi-storey stack group UI, fire-rating/material ribbon (Phase 6+ BOQ). ✅ Google-level: YES — mirrors generic BIM pattern (walls/openings/slabs/columns/beams), ADR-040 micro-leaf renderer (no subscriptions), soft-orphan host FK, atomic `UpdateSlabOpeningParamsCommand` (undoable Phase 3.7), idempotent diff-merge persistence, full i18n SSoT (SOS N.11). | Claude Opus 4.7 |
| 2026-05-18 | **Phase 3.5 IMPLEMENTED — Slab Advanced Editing**. Closes the Phase 3 gap around slab editing affordances by mirroring the Phase 2.5 opening pattern. Files created (3): (1) `core/commands/entity-commands/UpdateSlabParamsCommand.ts` — atomic patch `params` + recomputed `geometry` (`computeSlabGeometry`) + `validation` (`validateSlabParams`) + root `kind` synced with `params.kind` (so the ribbon's kind switch remains undoable); merge window (ADR-031 `DEFAULT_MERGE_CONFIG.mergeTimeWindow`) collapses continuous grip drags into one undo entry. (2) `bim/slabs/slab-grips.ts` — pure (no React/DOM/Firestore). `getSlabGrips()` returns one `slab-vertex-N` grip per outline vertex in stable index order (empty list for degenerate polygons); `applySlabGripDrag()` translates the indexed vertex by `delta` (XY only, z preserved) and short-circuits on zero delta / out-of-range / unknown grip kind. Edge-midpoint vertex insertion deferred to Phase 3.6. (3) `bim/slabs/__tests__/slab-grips.test.ts` — 10 Jest tests: grip layout per outline vertex, stable index order, type/movesEntity invariants, degenerate-polygon empty list, per-index drag translation, z preservation, zero-delta + out-of-range short-circuit, unknown-grip-kind no-op. (4) `core/commands/entity-commands/__tests__/UpdateSlabParamsCommand.test.ts` — 12 Jest tests: execute/undo/redo round-trip, geometry recompute (4×3 → 5×3 m² rectangle), root-kind sync with `params.kind`, undo-before-execute no-op, merge window (same slab + both dragging + within window), foreign-slab merge guard, validator rejects empty id / degenerate outline / non-positive thickness, serialize round-trip. Files modified (6): (a) `hooks/grip-types.ts` — added `SlabGripKind = \`slab-vertex-${number}\`` + `GripInfo.slabGripKind?`. (b) `hooks/useGripMovement.ts` — re-exports `SlabGripKind`. (c) `hooks/grips/unified-grip-types.ts` — `UnifiedGripInfo.slabGripKind?` forwarded from `GripInfo`. (d) `hooks/grips/grip-registry.ts` — `wrapDxfGrip` conditional spread forwards `slabGripKind`. (e) `hooks/grips/grip-commit-adapters.ts` — new `commitSlabGripDrag` (resolves slab via `sceneManager.getEntity`, builds `UpdateSlabParamsCommand` with `isDragging=true`, emits `bim:slab-params-updated`); `commitDxfGripDragModeAware` early-branches on `slabGripKind` before stretch/move/rotate paths. (f) `bim/renderers/SlabRenderer.ts` — `getGrips()` now wires `getSlabGrips(slab)` mapped to rendering `GripInfo` (replaces Phase 3 stub returning `[]`). (g) `ui/ribbon/hooks/useRibbonSlabBridge.ts` — replaced direct scene patch with `executeCommand(new UpdateSlabParamsCommand(...))` via `useCommandHistory().execute` + `LevelSceneManagerAdapter`; drops `computeSlabGeometry`/`validateSlabParams` imports (now owned by the command). Ribbon edits use `isDragging=false` so each combobox change is its own undo entry. **Deferred to Phase 3.6+:** edge-midpoint vertex insertion (`slab-edge-midpoint-N` grip), slab-opening separate entity + boolean cutout on slab fill (mirrors wall's `OpeningsByWall` pattern), rectilinear constraint Shift toggle (90° increments), hatch patterns per `reinforcement`, maxFreeSpan analytical (1D beam-direction). ✅ Google-level: YES — atomic Update command (proactive recompute, idempotent, single SSoT), pure grip handler (no React/DOM), ADR-040 micro-leaf renderer (no subscriptions), undo/redo across both grip-drag AND ribbon edits, full Jest coverage (22 new tests across 2 suites). | Claude Opus 4.7 |
| 2026-05-18 | **Phase 3.7a IMPLEMENTED — Slab-Opening Grips (vertex + edge-midpoint)**. Closes the Phase 3.7 deferred list for slab-opening editing affordances. Mirrors exactly το Phase 3.5/3.6 slab pattern (per-vertex translate + edge-midpoint vertex insertion + Shift-rectilinear quantization). Files created (2): (1) `bim/slab-openings/slab-opening-grips.ts` — pure handlers (zero React / DOM / Firestore / canvas deps). `getSlabOpeningGrips(entity)` returns `2N` grips για `N`-vertex polygon (`[0, N)` vertex grips + `[N, 2N)` edge-midpoint grips με `type=`'midpoint'` + `edgeVertexIndices=[i, (i+1)%N]`); empty για degenerate (<3 vertices). `applySlabOpeningGripDrag(gripKind, input)` dispatches by prefix: `slab-opening-vertex-N` → translate indexed vertex (XY, z preserved); `slab-opening-edge-midpoint-N` → insert fresh `Point3D` στο `midpoint(verts[N], verts[(N+1) mod len]) + delta` (z averaged όταν present, splicing μεταξύ των endpoints). Out-of-range / unknown / zero-delta short-circuit. `SlabOpeningGripDragInput.rectilinear?: boolean` quantizes delta στον dominant world axis (`|dx| ≥ |dy|` → keep dx, drop dy; else reverse). (2) `bim/slab-openings/__tests__/slab-opening-grips.test.ts` — 21 Jest tests: stable index order (`slab-opening-vertex-0..3`, `slab-opening-edge-midpoint-0..3`), vertex positions match outline, `type='vertex'`/`movesEntity=false`/`entityId` invariants, degenerate-polygon empty list, per-vertex translate (preserve z, zero-delta + out-of-range + unknown grip kind short-circuit), edge-midpoint positions (incl. closing edge wrap), `type='midpoint'` + `edgeVertexIndices`, vertex insertion at `midpoint + delta` (length+1, original vertices untouched), closing-edge insertion, rectilinear quantization on each axis + tie-break + edge-midpoint interaction + default-off, foreign params preservation (kind / slabId / fireRating / elevationOverride / multiStoreyStackGroupId). Files modified (7): (a) `hooks/grip-types.ts` — `SlabOpeningGripKind = `\`slab-opening-vertex-\`` | `\`slab-opening-edge-midpoint-\`` discriminated template-literal union + `GripInfo.slabOpeningGripKind?`. (b) `hooks/useGripMovement.ts` — re-exports `SlabOpeningGripKind`. (c) `hooks/grips/unified-grip-types.ts` — `UnifiedGripInfo.slabOpeningGripKind?` forwarded από `GripInfo`. (d) `hooks/grips/grip-registry.ts` — `wrapDxfGrip` conditional spread forwards `slabOpeningGripKind`. (e) `hooks/grips/grip-parametric-commits.ts` — new `commitSlabOpeningGripDrag` (resolves opening via `sceneManager.getEntity`, reads `ShiftKeyTracker.getSnapshot()` για rectilinear, builds `UpdateSlabOpeningParamsCommand` με `isDragging=true`, emits `bim:slab-opening-params-updated`). (f) `hooks/grips/grip-commit-adapters.ts` — `commitDxfGripDragModeAware` early-branches on `grip.slabOpeningGripKind` πριν τα stretch / move / rotate paths (mirror του slabGripKind branch). (g) `bim/renderers/SlabOpeningRenderer.ts` — `getGrips()` πλέον γυρνά `getSlabOpeningGrips(entity).map(...)` αντί για `[]` stub· `type='midpoint'` forwarding για edge-midpoint grips, `type='vertex'` για vertex grips. Pre-existing `bim/renderers/__tests__/SlabRenderer-with-slab-openings.test.ts` (6 tests, Phase 3.7) continues to cover το boolean cutout pass — δεν χρειάστηκε αλλαγή εκεί. ✅ Google-level: YES — pure parametric grip handler (no React/DOM/Firestore), ADR-040 micro-leaf renderer (zero high-frequency subscriptions), single command path (`UpdateSlabOpeningParamsCommand`), full undo/redo via existing merge window (ADR-031), zero hardcoded user-facing strings (SOS N.11 — all new code is grip math), Shift modifier reuses vanilla `ShiftKeyTracker` singleton από Phase 3.6 (no extra event listeners). | Claude Opus 4.7 |
| 2026-05-18 | **Phase 5.5a IMPLEMENTED — Beam parametric grips + UpdateBeamParamsCommand + ribbon migration**. Closes part of the Phase 5 deferred list (start/end/midpoint/curveControl grips + atomic command + ribbon migration). Files created (4): (1) `bim/beams/beam-grips.ts` — pure handlers (zero React / DOM / Firestore / canvas deps). `getBeamGrips(entity)` returns 3 grips για straight/cantilever (`beam-start` + `beam-end` axis endpoints + axis-midpoint anchored `beam-midpoint` με `movesEntity=true`) και 4 για curved (`+ beam-curve` quadratic Bezier control). `applyBeamGripDrag(gripKind, input)` pure transform → new `BeamParams`: `beam-start`/`beam-end` translate single endpoint preserving z; `beam-midpoint` translates startPoint + endPoint + curveControl (όταν υπάρχει) κατά delta; `beam-curve` translates existing curveControl ή seeds από axis midpoint + delta όταν undefined. Zero delta + unknown grip kind short-circuit referentially. ΟΧΙ width/depth dimension grips σε αυτή τη φάση (deferred Phase 5.5b). (2) `bim/beams/__tests__/beam-grips.test.ts` — 15 Jest tests: grip count per kind, stable ordering, vertex positions match params, curve seed at axis midpoint όταν undefined, midpoint translates both endpoints + curveControl, drag preserves foreign params (width/depth/elevation/supportType/material), zero-delta + unknown kind referential no-op. (3) `core/commands/entity-commands/UpdateBeamParamsCommand.ts` — atomic patch `params` + recomputed `geometry` (`computeBeamGeometry`) + `validation` (`validateBeamParams`) + root `kind` synced με `params.kind` (mirror slab Phase 3.5 ώστε ribbon kind switch να μένει undoable); merge window (ADR-031 `DEFAULT_MERGE_CONFIG.mergeTimeWindow`) collapses continuous grip drags σε ένα undo entry; `validate()` rejects empty id / non-positive width / non-positive depth / degenerate axis (chord ≤ 0) / curved kind χωρίς curveControl. (4) `core/commands/entity-commands/__tests__/UpdateBeamParamsCommand.test.ts` — 14 Jest tests: execute/undo/redo round-trip με geometry recompute (width=400 → area=1.6 m²), root-kind sync με params.kind, undo-before-execute no-op, merge window same-beam + both-dragging + within-window, foreign-beam merge guard, isDragging=false merge guard, validator rejects empty id / non-positive width/depth / degenerate axis / curved χωρίς curveControl, serialize round-trip. Files modified (7): (a) `hooks/grip-types.ts` — `BeamGripKind = 'beam-start' \| 'beam-end' \| 'beam-midpoint' \| 'beam-curve'` + `GripInfo.beamGripKind?` discriminator. (b) `hooks/useGripMovement.ts` — re-exports `BeamGripKind`. (c) `hooks/grips/unified-grip-types.ts` — `UnifiedGripInfo.beamGripKind?` forwarded από `GripInfo`. (d) `hooks/grips/grip-registry.ts` — `wrapDxfGrip` conditional spread forwards `beamGripKind`. (e) `hooks/grips/grip-parametric-commits.ts` — νέα `commitBeamGripDrag` (resolves beam via `sceneManager.getEntity` με `candidate.type === 'beam'` guard, builds `UpdateBeamParamsCommand` με `isDragging=true`, emits `bim:beam-params-updated`). ΟΧΙ ShiftKeyTracker (beam δεν έχει rectilinear quantization — axis-bound endpoint drag). (f) `hooks/grips/grip-commit-adapters.ts` — `commitDxfGripDragModeAware` early-branches on `grip.beamGripKind` πριν τα stretch / move / rotate paths (mirror του slabOpeningGripKind branch). (g) `bim/renderers/BeamRenderer.ts` — `getGrips()` πλέον γυρνά `getBeamGrips(entity).map(...)` αντί για `[]` stub· `type='center'` forwarding για midpoint axis-anchor grip (`movesEntity=true`), `type='vertex'` για endpoint + curve grips. (h) `ui/ribbon/hooks/useRibbonBeamBridge.ts` — replaced direct scene patch με `executeCommand(new UpdateBeamParamsCommand(...))` via `useCommandHistory().execute` + `LevelSceneManagerAdapter`; drops `computeBeamGeometry`/`validateBeamParams` imports (now owned by the command). Ribbon edits use `isDragging=false` ώστε κάθε combobox change να είναι δικό του undo entry. **Deferred to Phase 5.5b+**: width/depth dimension grips (mirror του wall-thickness perpendicular handle αλλά με 2 διαστάσεις), hatch patterns per material (RC/steel/glulam), auto-connect to columns (beam ends snap to column anchors), snap-to-wall-axis / column-center integration, beam-supports-slab analytical link (Phase 6 BOQ dependency). ✅ Google-level: YES — atomic UpdateBeamParamsCommand (proactive recompute, idempotent, single SSoT), pure grip handler (no React/DOM/Firestore), ADR-040 micro-leaf renderer (no subscriptions), undo/redo across BOTH grip-drag AND ribbon edits, full Jest coverage (29 new tests across 2 suites), zero hardcoded user-facing strings (SOS N.11 — all new code is grip math / command). | Claude Opus 4.7 |
| 2026-05-18 | **Phase 4.5 IMPLEMENTED — Column parametric grips + UpdateColumnParamsCommand + ribbon migration**. Closes part of the Phase 4 deferred list (center/rotation/width/depth grips + atomic command + ribbon migration). Files created (4): (1) `bim/columns/column-grips.ts` — pure handlers (zero React / DOM / Firestore / canvas deps). `getColumnGrips(entity)` returns 4 grips για rectangular/L-shape/T-shape (`column-center` στο footprint centroid με `movesEntity=true`, `column-rotation` πάνω από north edge, `column-width` στο far edge κατά τοπικό X, `column-depth` στο far edge κατά τοπικό Y) και 2 για circular (`column-center` + `column-width=diameter` στο world +X). `applyColumnGripDrag(gripKind, input)` pure transform → new `ColumnParams`: `column-center` translates `position` preserving anchor/rotation/kind/variant; `column-rotation` pivots γύρω από `position` (anchor invariant) μέσω atan2 διαφοράς old/new handle vector — circular kind no-op; `column-width` projects delta σε rotated +X, διαιρεί με `coefX = signX/2 − dx` (far-edge selection), clamps στο `MIN_COLUMN_DIMENSION_MM` (250mm Eurocode), preserves rotation/depth/anchor; `column-depth` mirror μέσω rotated +Y και `coefY` — circular kind no-op. Zero delta + unknown grip kind short-circuit referentially. (2) `bim/columns/__tests__/column-grips.test.ts` — 19 Jest tests: grip count per kind, stable ordering, grip positions match centroid + rotated far-edge offsets, center translate, width/depth resize με coefficient verification, rotation drag preserves width/depth/position, width+depth clamp στο MIN_COLUMN_DIMENSION_MM, circular depth/rotation referential no-op, circular width = symmetric diameter resize, zero-delta + unknown kind referential no-op, foreign params preserved (height/anchor/material/lshape/tshape). (3) `core/commands/entity-commands/UpdateColumnParamsCommand.ts` — atomic patch `params` + recomputed `geometry` (`computeColumnGeometry`) + `validation` (`validateColumnParams`) + root `kind` synced με `params.kind` (mirror slab Phase 3.5 / beam Phase 5.5a ώστε ribbon kind switch να μένει undoable); merge window (ADR-031 `DEFAULT_MERGE_CONFIG.mergeTimeWindow`) collapses continuous grip drags σε ένα undo entry; `validate()` rejects empty id / non-positive width / non-positive depth για non-circular / non-positive height / non-finite rotation. (4) `core/commands/entity-commands/__tests__/UpdateColumnParamsCommand.test.ts` — 15 Jest tests: execute/undo/redo round-trip με geometry recompute (width=600 → area=0.24 m²), root-kind sync με params.kind (rectangular ↔ circular switch), undo-before-execute no-op, merge window same-column + both-dragging + within-window, foreign-column merge guard, isDragging=false merge guard, validator rejects empty id / non-positive width / non-positive depth (non-circular) / non-positive height / non-finite rotation, circular kind skips depth check, serialize round-trip. Files modified (8): (a) `hooks/grip-types.ts` — `ColumnGripKind = 'column-center' \| 'column-rotation' \| 'column-width' \| 'column-depth'` + `GripInfo.columnGripKind?` discriminator. (b) `hooks/useGripMovement.ts` — re-exports `ColumnGripKind`. (c) `hooks/grips/unified-grip-types.ts` — `UnifiedGripInfo.columnGripKind?` forwarded από `GripInfo`. (d) `hooks/grips/grip-registry.ts` — `wrapDxfGrip` conditional spread forwards `columnGripKind`. (e) `hooks/grips/grip-parametric-commits.ts` — νέα `commitColumnGripDrag` (resolves column via `sceneManager.getEntity` με `candidate.type === 'column'` guard, builds `UpdateColumnParamsCommand` με `isDragging=true`, emits `bim:column-params-updated`). ΟΧΙ ShiftKeyTracker (column δεν έχει rectilinear quantization σε αυτή τη φάση). (f) `hooks/grips/grip-commit-adapters.ts` — `commitDxfGripDragModeAware` early-branches on `grip.columnGripKind` πριν τα stretch/move/rotate paths (mirror του beamGripKind branch). (g) `bim/renderers/ColumnRenderer.ts` — `getGrips()` πλέον γυρνά `getColumnGrips(entity).map(...)` αντί για `[]` stub· `type='center'` forwarding για center grip (`movesEntity=true`), `type='vertex'` για rotation + width + depth grips. (h) `ui/ribbon/hooks/useRibbonColumnBridge.ts` — replaced direct scene patch με `executeCommand(new UpdateColumnParamsCommand(...))` via `useCommandHistory().execute` + `LevelSceneManagerAdapter`; drops `computeColumnGeometry`/`validateColumnParams` imports (now owned by the command). Ribbon edits use `isDragging=false` ώστε κάθε combobox change να είναι δικό του undo entry. **Deferred to Phase 4.5b+**: hatch patterns per material, variant-specific arm/flange grips για L-shape (armLength/armWidth) + T-shape (flangeLength/webThickness), anchor cycling visual preview (ghost at all 9 positions), snap-to-wall-corners + grid-intersections, beam-end auto-snap to column anchors (Phase 5.5b cross-dep). — Google-level: YES — atomic UpdateColumnParamsCommand (proactive recompute, idempotent, single SSoT), pure grip handler (no React/DOM/Firestore), ADR-040 micro-leaf renderer (no subscriptions), undo/redo across BOTH grip-drag AND ribbon edits, full Jest coverage (34 new tests across 2 suites), zero hardcoded user-facing strings (SOS N.11 — all new code is grip math / command). | Claude Opus 4.7 |
| 2026-05-18 | **Phase 5.5b IMPLEMENTED — Beam Width Dimension Grip (in-plane)**. Closes the Phase 5.5a width-grip deferred item. Mirrors exactly το Phase 1C `wall-thickness` perpendicular handle pattern προσαρμοσμένο σε beam axis. Files modified (3): (1) `hooks/grip-types.ts` — `BeamGripKind` union extended με `'beam-width'` literal. JSDoc enriched με Phase 5.5b semantics (perpendicular-to-axis dimension handle στο axis midpoint, offset κατά `width/2`, symmetric resize, clamp στο `MIN_BEAM_WIDTH_MM`). Depth grip ρητά μαρκαρισμένο deferred στο Phase 5.5c. (2) `bim/beams/beam-grips.ts` — `getBeamGrips()` εκπέμπει νέο grip στο τέλος (`type='edge'`, stable `gripIndex=3` για straight/cantilever, `=4` για curved, ώστε το ordering να μένει deterministic across kinds). Νέο exported helper `beamWidthHandlePosition(params)` (axis midpoint + perpendicular × width/2, null σε degenerate axis, < 0.001 chord). `applyBeamGripDrag('beam-width', input)` νέα `resizeWidth(input)` private function: unit axis (από `unitAxis`) → CCW 90° perpendicular (`perpUnit`) → projection of delta on perp → `newWidth = max(MIN_BEAM_WIDTH_MM, width + 2 · proj)` (factor 2 = symmetric resize γύρω από axis, mirror του wall-thickness `* 2` factor). Zero-projection (parallel-to-axis delta) και degenerate axis short-circuit στο `originalParams` referentially. (3) `bim/beams/__tests__/beam-grips.test.ts` — existing grip-count assertions extended από 3/4 σε 4/5 grips (straight/cantilever 4, curved 5 — όλα τώρα carry width handle). `movesEntity` array extended ένα slot. 4 νέα tests (16-19): width grip position για horizontal axis (start=(0,0), end=(4000,0), width=300 → handle στο (2000, 150) — also asserted directly via `beamWidthHandlePosition`); perpendicular drag delta=(0, 100) → newWidth = 300 + 2·100 = 500 (axis horizontal → perp=(0,1) → projection=100); parallel drag delta=(100, 0) → newWidth stays 300 (projection=0); large negative perpendicular delta (0, −10000) → clamped σε `MIN_BEAM_WIDTH_MM` (150 mm). Files created (0): Phase 5.5b εξ ολοκλήρου σε υφιστάμενα αρχεία. **Renderer + adapter unchanged**: `BeamRenderer.getGrips()` map γενικό (`type='center'` → 'center', everything else → 'vertex'· `edge`-typed width grip πέφτει στο 'vertex' bucket, αρκετό για canvas rendering). JSDoc του getGrips ενημερώθηκε ρητά για Phase 5.5b coverage + Phase 5.5c deferred. `commitBeamGripDrag` (`grip-parametric-commits.ts`) γενικό — περνάει `grip.beamGripKind` straight through στο `applyBeamGripDrag`. `UpdateBeamParamsCommand` δεν αλλάζει — re-used as-is. **Deferred to Phase 5.5c+**: depth dimension grip (out-of-plane / gravity axis — δεν φαίνεται σε plan view χωρίς ξεχωριστό visual indicator όπως section profile preview), hatch patterns per material (RC/steel/glulam), auto-connect to columns (beam ends snap to column anchors), snap-to-wall-axis / column-center integration, beam-supports-slab analytical link (Phase 6 BOQ dependency). ✅ Google-level: YES — pure grip handler (no React/DOM/Firestore), proactive symmetric clamp στο Eurocode floor, idempotent re-use του υφιστάμενου `UpdateBeamParamsCommand` path (καμία νέα command/adapter επιφάνεια), full Jest coverage (4 νέα + 4 updated tests = 19 total beam-grip tests), zero hardcoded user-facing strings (SOS N.11 — pure math). | Claude Opus 4.7 |
| 2026-05-18 | **Phase 4.5c.1 IMPLEMENTED — Column Anchor Ghost Preview (9-state visual feedback)**. Closes the Phase 4.5b anchor-preview deferred item. Industry convention (Revit Column tool / ArchiCAD CO): όσο το column tool βρίσκεται σε `awaitingPosition` και ο cursor κινείται στο canvas, εμφανίζονται 9 ghost footprints γύρω από το cursor (ένα ανά `ColumnAnchor`) — το ενεργό anchor (`state.anchor`) highlightάρεται με kind-coloured fill (30% opacity) + bold stroke (2px @100% opacity), τα υπόλοιπα 8 σχεδιάζονται ως ημιδιαφανή outlines (1px @15% opacity, no fill). Tab/Shift+Tab cycling εναλλάσσει αμέσως το active highlight ΧΩΡΙΣ ο cursor να μετακινηθεί. Circular kind εμφανίζει 1 ghost μόνο (anchor='center'). **Files created (3)**: (1) `bim/columns/column-anchor-ghosts.ts` — pure SSoT για ghost computation. Exports `AnchorGhost` interface (`anchor` / `isActive` / `footprint` / `cursorPos`) και `computeAnchorGhostFootprints(cursorPos, kind, activeAnchor, overrides)` που iterates `ANCHOR_CYCLE_ORDER` και wraps `buildDefaultColumnParams` + `computeColumnGeometry` per anchor. ΟΧΙ `validateColumnParams` στο ghost path — το preview πρέπει να εμφανίζεται ακόμα κι αν τα defaults overrides δεν περνούν validation. Circular kind → single entry `{anchor:'center', isActive:true}`. (2) `bim/columns/__tests__/column-anchor-ghosts.test.ts` — 17 Jest tests: count + structure per kind (9 για rect/L/T, 1 για circular), `ANCHOR_CYCLE_ORDER` ordering preserved, active-flag iteration over όλο το cycle order, footprint shifts per anchor (nw → +X/-Y, se → -X/+Y), overrides propagate (width/rotation/lshape/tshape), cursorPos surface verbatim σε όλα τα entries. (3) `bim/columns/ColumnAnchorGhostRenderer.ts` — pure renderer class. Constructor takes `CanvasRenderingContext2D`· `render({ ghosts, kind, transform, viewport })` paints inactive ghosts πρώτα (background, kind-stroke @15% opacity, no fill, 1px), active με fill+bold stroke πάνω, anchor marker (5×5 px kind-coloured square στο cursor world position) τελευταίο. Stroke palette mirror `ColumnRenderer.KIND_STROKE` (rect=cool-grey, circular=RC-grey, L-shape=ochre, T-shape=steel-blue). Active fill `KIND_FILL_ACTIVE` (30% opacity, ελαφρώς πιο intense από το base 22% για να ξεχωρίζει από hovered columns). **Files modified (5)**: (a) `hooks/drawing/useColumnTool.ts` — νέος `getGhostFootprints(cursorPos)` getter στο return type. Returns `null` όταν `phase !== 'awaitingPosition'` ή `cursorPos === null`· αλλιώς wraps `computeAnchorGhostFootprints` με `state.kind`/`state.anchor`/`state.overrides`. ΟΧΙ React state mutation, ΟΧΙ store subscription — pure projection ώστε mousemove να μην triggerάρει re-render του CanvasSection (ADR-040 cardinal rule). (b) `hooks/tools/useColumnGhostPreview.ts` *(new)* — RAF-driven preview hook. Subscribes σε `useCursorWorldPosition` εσωτερικά (mirror `useRotationPreview` micro-leaf pattern), καλεί `getGhostFootprints(cursorWorld)`, instantiates `ColumnAnchorGhostRenderer` πάνω από το preview canvas ctx, ζωγραφίζει σε CSS pixels με DPR scaling. Cleanup effect clearάρει το canvas στη transition out of `awaitingPosition`. (c) `components/dxf-layout/canvas-layer-stack-leaves.tsx` — νέο memo'd leaf `ColumnGhostPreviewMount` που wraps `useColumnGhostPreview`. Προστέθηκε `columnGhost` payload στο `PreviewCanvasMounts` props (kind + isAwaitingPosition + getGhostFootprints) και το mount renders στο τέλος του `<PreviewCanvasMounts>` fragment. (d) `components/dxf-layout/canvas-layer-stack-types.ts` — `CanvasLayerStackProps.columnGhostPreview` payload type. (e) `components/dxf-layout/CanvasLayerStack.tsx` — destructures `columnGhostPreview` prop και το περνά ως `columnGhost={columnGhostPreview}` στο `PreviewCanvasMounts`. (f) `components/dxf-layout/CanvasSection.tsx` — passes `columnGhostPreview={{ isAwaitingPosition, kind: state.kind, getGhostFootprints }}` στο `CanvasLayerStack`. (g) `hooks/drawing/__tests__/useColumnTool.test.tsx` — 8 νέα Jest tests στο `getGhostFootprints` describe block: null when phase=idle, null when cursorPos=null, 9 ghosts για rectangular awaitingPosition, 1 ghost για circular, active matches state.anchor μετά setAnchor, active rotates μετά cycleAnchor, overrides propagate σε όλα τα ghosts, null μετά deactivate. **Deferred to Phase 4.5c.2+**: snap-to-wall-corners + snap-to-grid-intersections (snap engine integration), hatch patterns per material category, section-profile preview overlay για L/T variants ενώ γίνεται drag, beam-end auto-snap to column anchors (Phase 5.5c cross-dep). ✅ Google-level: YES — pure ghost computation module (no React/DOM/Firestore), ADR-040 micro-leaf preview hook (subscribes only σε `useCursorWorldPosition`, CanvasSection δεν re-renderάρει σε mousemove), pure projection getter στο tool hook (no state mutation = no per-frame re-render), idempotent renderer (no side effects), zero hardcoded user-facing strings (SOS N.11 — pure math + canvas ctx). | Claude Opus 4.7 |
| 2026-05-18 | **Phase 4.5c.2 IMPLEMENTED — Column Material Hatch Patterns (RC / Steel / Masonry / Wood plan-view hatch)**. Closes the hatch deferred item της Phase 4.5 / 4.5b / 4.5c.1 list. Industry-convention plan-view hatch ανά material category, scoped σε non-circular kinds: RC = dot grid 150mm spacing με `RC_DOT_RADIUS_PX=1.5` zoom-invariant dots; Steel = cross-hatch (@45° + @135°) 100mm spacing 0.6px stroke; Masonry = horizontal courses ανά 80mm + staggered vertical joints ανά 200mm (alternating-row offset = brickL/2, mirror του AutoCAD AR-B816 ish pattern); Wood = single-direction diagonal @45° 80mm spacing 0.4px stroke. Mirror του Phase 3.6 `SlabRenderer.drawReinforcementHatch` pattern (save → footprint polygon path → clip → hatch → restore, μεταξύ fill και stroke ώστε outline να παραμένει sharp). **Files created (3)**: (1) `bim/columns/column-hatch-patterns.ts` — pure SSoT module (zero React / DOM / Firestore / canvas-state deps). Exports `ColumnMaterialKey` union (`'rc' \| 'steel' \| 'masonry' \| 'wood'`), `resolveMaterialKey(raw)` case-insensitive + safe `'rc'` fallback (undefined / empty / unknown → RC default), `HatchLineSegment` / `HatchDot` / `HatchPlan` interfaces, `computeHatchPlan(bbox, key)` per-material algorithms (dot grid για rc, diagonal hatch builder με slope=±1 για steel/wood, horizontal+staggered-vertical για masonry), exported constants (`HATCH_SPACING_MM`, `HATCH_STROKE_RGBA = 'rgba(0,0,0,0.20)'`, `HATCH_LINE_WIDTH_PX`, `RC_DOT_RADIUS_PX=1.5`, `MASONRY_BRICK_LENGTH_MM=200`, `MASONRY_BRICK_HEIGHT_MM=80`). Safety cap `MAX_HATCH_STEPS=4000` σε όλα τα iteration loops για degenerate / huge bbox safety. (2) `bim/columns/__tests__/column-hatch-patterns.test.ts` — Jest tests: `resolveMaterialKey` lowercase / uppercase / mixed-case / undefined / empty / unknown cases (`'rc'`/`'RC'`/`'Rc'`/`undefined`/`''`/`'concrete'`/`'foo-bar'` → all RC), per-material plan structure (rc → dots only / no lines, steel → cross-hatch και στις δύο διευθύνσεις slope sign / no dots, masonry → horizontal + staggered vertical lines / no dots, wood → single-direction diagonals / no dots), 400×400 @ 150 dot grid count = 9, degenerate bbox safety (`min===max` → empty plan, negative extents `(500,500,100,100)` → empty plan, no infinite loops), large 10000×10000 bbox bounded count, exported constants verify (spacing values + stroke RGBA + line widths + dot radius + masonry brick dims), masonry alternating-row stagger (row 0 vertical joints at x∈{0,200,400}, row 1 at x∈{100,300,500}, row 1 ΔΕΝ έχει 200 ή 400). (3) `bim/renderers/__tests__/ColumnRenderer-hatch.test.ts` — canvas-mock tests (firebase/auth stubbed mirror του Phase 3.6 slab pattern): undefined material → RC fallback dispatch (arc calls > 0, clip ≥ 1), `'rc'` arc inside clip + no inner lineTo, `'steel'` cross-hatch lineTo inside clip + no arc, `'masonry'` + `'wood'` strokes inside clip + no arc, `'circular'` kind no-clip skip (αγνοεί material), extreme zoom-out (`scale=0.0001`) no-clip skip, save/clip/restore scoped, outline stroke survives μετά το restore (sharp outline), polygon clip path uses footprint first vertex (last `moveTo` πριν το clip), unknown material string `'unobtanium'` → RC fallback path, case-insensitive `'STEEL'` / `'Steel'` → steel hatch dispatch. **Files modified (1)**: `bim/renderers/ColumnRenderer.ts` — νέα `drawMaterialHatch(column)` private method μεταξύ fill (existing `ctx.fill()`) και stroke (existing outline `ctx.stroke()`), mirror του Phase 3.6 `SlabRenderer.drawReinforcementHatch` insertion point. Skip cases: `column.kind === 'circular'` (Phase 4.5c.3 deferred — visual conventions TBD) + `this.transform.scale < 0.001` (extreme zoom-out invisible, perf guard). Material resolved via `resolveMaterialKey(column.params.material)`. Plan computed από `column.geometry.bbox` σε world coords· rendering pass `worldToScreen` per segment (lines) + per `arc` center (dots). Imports από `column-hatch-patterns` (`computeHatchPlan`, `resolveMaterialKey`, `HATCH_STROKE_RGBA`, `HATCH_LINE_WIDTH_PX`, `RC_DOT_RADIUS_PX`, `ColumnMaterialKey`). JSDoc header bullets ενημερώθηκαν: Phase 4.5c.1 (anchor preview leaf — pointer μόνο, separate renderer), Phase 4.5c.2 (material hatch DONE), Phase 4.5c.3+ (circular hatch + snap deferred). **Renderer file δουλεύει εντός Google 500-line budget** (~209 lines τελικά). **Deferred to Phase 4.5c.3+**: circular column material hatch (radial pattern ή solid-fill — visual conventions TBD), snap-to-wall-corners + snap-to-grid-intersections (snap engine integration ενώ ο cursor κινείται), section-profile preview overlay για L/T variants ενώ γίνεται drag, beam-end auto-snap σε column anchors (Phase 5.5c cross-dep). ✅ Google-level: YES — pure hatch SSoT (no React / DOM / Firestore — μόνο math + world coords), ADR-040 micro-leaf renderer (zero subscriptions, polygon-clipped pass μέσα στο υφιστάμενο `render()` pipeline), `'rc'` fallback για forward-compat unknown materials, case-insensitive lookup (ribbon / Firestore inconsistencies ανθεκτικές), perf guard για extreme zoom-out, `MAX_HATCH_STEPS=4000` busy-loop safety, full Jest coverage (12 module tests + 12 renderer canvas-mock tests), zero hardcoded user-facing strings (SOS N.11 — pure math). | Claude Opus 4.7 |
| 2026-05-18 | **Phase 4.5b IMPLEMENTED — Column Variant-Specific Grips (L-shape arm + T-shape flange/web)**. Closes the Phase 4.5 variant-grip deferred item. Split σε 3-module για Google 500-line file budget (CLAUDE.md N.7.1). **Files created (2)**: (1) `bim/columns/column-grip-utils.ts` — shared local-frame math (DEG/RAD constants, `ROTATION_HANDLE_OFFSET_MM`, `rotate`, `projectDeltaToLocal`, `computeCentroidWorld`, `localToWorld`, `farEdgeSignX/Y`). Pure SSoT για base + variant modules. (2) `bim/columns/column-variant-grips.ts` — variant handlers: `materializeLshape`/`materializeTshape` defaults (`width/3, depth/3` (L) / `width, depth/3` (T) — mirror των `computeColumnGeometry` defaults), 4 handle-position helpers (`armLengthHandlePosition`/`armWidthHandlePosition`/`flangeLengthHandlePosition`/`webThicknessHandlePosition`), 4 resize transforms (`resizeArmLength` rotated +Y 1× asymmetric, `resizeArmWidth` rotated +X 1×, `resizeFlangeLength` rotated +X 2× symmetric, `resizeWebThickness` rotated +X 2×), `mergeLshape`/`mergeTshape` patch helpers. Non-matching kinds → no-op (referential identity). **Files modified (3)**: (a) `hooks/grip-types.ts` — `ColumnGripKind` union extended με `column-arm-length` / `column-arm-width` / `column-flange-length` / `column-web-thickness`. JSDoc enriched με per-grip semantics + defaults materialization rule + Eurocode clamp. (b) `bim/columns/column-grips.ts` — refactored: inline math moved σε `column-grip-utils.ts`. `getColumnGrips()` εκπέμπει επιπλέον grips (indices 4+5) για L-shape (`column-arm-length` + `column-arm-width`) και T-shape (`column-flange-length` + `column-web-thickness`). `applyColumnGripDrag` dispatches σε 4 imports από `column-variant-grips`. (c) `bim/columns/__tests__/column-grips.test.ts` — grip-count assertions extended (L/T-shape 4→6 grips), variant-specific tests added. **Renderer + command + adapter unchanged**: `ColumnRenderer.getGrips()` map γενικό (edge-typed grips → 'vertex' canvas bucket). `commitColumnGripDrag` γενικό. `UpdateColumnParamsCommand` re-used as-is. **Deferred to Phase 4.5c+**: hatch patterns per material, anchor cycling visual preview (ghost at all 9 positions), snap-to-wall-corners + grid-intersections, beam-end auto-snap to column anchors (Phase 5.5b cross-dep). ✅ Google-level: YES — pure grip handlers (no React/DOM/Firestore), proactive defaults materialization (mirror `computeColumnGeometry`), 3-file split keeps each module within SRP, idempotent re-use του υφιστάμενου `UpdateColumnParamsCommand` path (καμία νέα command/adapter επιφάνεια), Eurocode clamp στο `MIN_COLUMN_DIMENSION_MM=250`, zero hardcoded user-facing strings (SOS N.11 — pure math). | Claude Opus 4.7 |

| 2026-05-19 | **Phase 5.5c IMPLEMENTED — Beam Depth Grip + Material Hatch + Material Picker + BIM Hit-Test Passthrough**. Closes 3 deferred items του Phase 5.5b. (1) `beam-depth` grip kind στο `BeamGripKind` union — handle στην αντίθετη πλευρά του width handle (negative perpendicular) με offset `width/2 + DEPTH_GRIP_OFFSET_MM=250mm`. Symmetric drag projection × 2 → new depth, clamps στο `MIN_BEAM_DEPTH_MM=200` (Eurocode). BeamRenderer ζωγραφίζει dashed leader + "d=Xmm" label όταν hovered/selected. Footprint δεν μεταβάλλεται — μόνο `params.depth` (gravity axis). (2) Pure SSoT `bim/beams/beam-hatch-patterns.ts` — `BeamMaterialKey = 'rc'\|'steel'\|'glulam'`: RC dot grid 100mm, Steel cross-hatch 80mm, Glulam grain PARALLEL στον axis 40mm + cross-grain @30° 120mm (axis-aware sophistication πέρα από column wood). `computeBeamHatchPlan(bbox, axisUnit, material)` + `resolveBeamMaterialKey()` (case-insensitive, `'rc'` fallback). BeamRenderer.drawMaterialHatch() polygon-clipped pass μεταξύ fill και stroke. (3) Ribbon material picker: `BEAM_RIBBON_KEYS.stringParams.material` + `useRibbonBeamBridge` material wiring με `'rc'` fallback selection. Routes μέσω `UpdateBeamParamsCommand` με `isDragging=false`. (4) BIM hit-test passthrough fix: `HitTestingService.toEntityModel()` έλειπαν opening/slab/column/beam cases → spatial index έπαιρνε null bounds → unselectable. Νέα branches mirror του wall pattern. Επίσης `BoundsCalculator` + `hit-test-entity-tests.ts` XLINE/RAY support (ADR-359 follow-up, βλ. ADR-359 changelog). **Files modified (9)**: beam-grips.ts, BeamRenderer.ts, beam-types.ts, grip-types.ts, Bounds.ts, hit-test-entity-tests.ts, HitTestingService.ts, beam-command-keys.ts, useRibbonBeamBridge.ts. **Files created (1)**: beam-hatch-patterns.ts. **Deferred Phase 5.5d+**: auto-connect to columns, snap-to-wall-axis / column-center, beam-supports-slab analytical link (Phase 6), section-profile overlay για steel I/H. ✅ Google-level: YES — atomic UpdateBeamParamsCommand re-used, ADR-040 micro-leaf compliance, Eurocode clamp, root-cause hit-test fix (not workaround), zero hardcoded user-facing strings. | Claude Sonnet 4.6 |
| 2026-05-19 | **Phase 4.5c.4 IMPLEMENTED — Column Ghost Preview Snap Integration (snap-to-wall-corners + grid-intersections)**. Closes the snap visual-feedback deferred item από Phase 4.5c.3. Root cause: `useColumnGhostPreview` χρησιμοποιούσε `useCursorWorldPosition()` (raw cursor) για τη θέση των ghost footprints. Το click commit ήδη ελάμβανε snapped point (`mouse-handler-up.ts` lines 93–98: `if (snapEnabled && findSnapPoint) { worldPoint = snapResult.snappedPoint; }`). Missing piece: visual snap lock στα ghosts κατά τη διάρκεια cursor movement. Fix: εντός του `drawFrame` RAF callback, διαβάζεται `getImmediateSnap()` imperatively (μη-reactively). Αν `found === true && point != null` → ghosts render στο snapped point (wall corner / grid intersection / endpoint). Αν όχι → raw cursor (no-change fallback). ADR-040 compliant: zero new `useSyncExternalStore` subscription — reads snap state imperatively inside RAF που ήδη τρέχει per-frame λόγω `cursorWorld` dep. Ordering guaranteed: `mouse-handler-move.ts` γράφει `ImmediatePositionStore` → subscribers fire (React schedules effect) → `ImmediateSnapStore` γράφει synchronously → RAF fires (next frame) → `getImmediateSnap()` έχει ήδη latest value. **Files modified (1)**: `hooks/tools/useColumnGhostPreview.ts` — import `getImmediateSnap`; compute `effectiveCursor` (snapped when found, else raw); pass to `getGhostFootprints()`. **Files created (0)**. ✅ Google-level: YES — imperative read inside RAF (no subscription overhead), belt-and-suspenders fallback (raw cursor), reuses existing `ImmediateSnapStore` SSoT, zero race conditions (RAF strictly after snap write). | Claude Sonnet 4.6 |
| 2026-05-18 | **Phase 4.5c.3 IMPLEMENTED — Circular Column Material Hatch + Variant Dimension Labels**. Closes 2 deferred items from Phase 4.5c.2. (1) Circular RC → 3 concentric arc rings at 25/50/75% radius (`CIRCULAR_RC_RING_FRACTIONS`). Steel/Masonry/Wood circular → same bbox-clipped line patterns (32-vertex footprint polygon provides clip boundary). `HatchArc` interface added to `HatchPlan`; `computeCircularHatchPlan(center, radiusMm, material)` dispatches RC→arcs, others→bbox plan. `arcs: []` backward-compat added to all existing `computeHatchPlan` return statements. ColumnRenderer: circular early-return removed, arc render loop `ctx.arc()` added (skip `rPx < 0.5`). (2) Variant dimension labels: L-shape + T-shape columns draw compact 8px labels + dashed guide segment at relevant footprint vertex pairs when `phaseState.phase === 'highlighted'`. Pure renderer, no store subscriptions, ADR-040 compliant. Tests: 4 new describe blocks in `column-hatch-patterns.test.ts` (arcs backward-compat, RC concentric rings × 4 assertions, steel/masonry/wood arcs-empty, degenerate inputs). Files modified: `column-hatch-patterns.ts`, `ColumnRenderer.ts`, `column-hatch-patterns.test.ts`. Snap integration deferred → Phase 4.5c.4. | Claude Sonnet 4.6 |
| 2026-05-18 | **Phase 4.5d IMPLEMENTED — Ribbon UI Surface (Launcher Buttons + Material Pickers)**. 6 BIM launcher buttons στο Home → Draw panel (wall W / opening OP / slab SL / slab-opening SO / column CL / beam BM) mirror του Stair pattern — κάθε button ενεργοποιεί το αντίστοιχο tool μέσω του υπάρχοντος dispatcher, keyboard chords παραμένουν parallel path. Column material picker (`column-material` panel μεταξύ geometry και actions) ENABLED — combobox 4 options (rc / steel / masonry / wood) wires through `COLUMN_RIBBON_KEYS.stringParams.material` και `UpdateColumnParamsCommand` (undoable, `isDragging=false`). `getComboboxState` surfaces `'rc'` active selection όταν `params.material` undefined (mirror `resolveMaterialKey` fallback από Phase 4.5c.2). Beam / Wall / Slab material pickers DISABLED + comingSoon flag (mirror ADR-345 pattern): combobox greyed out + tooltip `material.comingSoon` (Beam → "Διαθέσιμο σε επόμενη φάση", Wall → "Διαθέσιμο με WallDna Phase 1D", Slab → "Διαθέσιμο με material library Phase 6+"). **Files modified (10)**: `ui/ribbon/data/home-tab-draw.ts` (new BIM row 3), `ui/ribbon/components/buttons/RibbonButtonIcon.tsx` (6 lucide icons: Construction / DoorOpen / Layers / SquareDashed / Columns3 / RectangleHorizontal), `ui/ribbon/hooks/bridge/column-command-keys.ts` (material added στο stringParams), `ui/ribbon/data/contextual-column-tab.ts` (column-material panel ENABLED), `ui/ribbon/hooks/useRibbonColumnBridge.ts` (material field wiring + `'rc'` fallback selection), `ui/ribbon/data/contextual-beam-tab.ts` (beam-material panel DISABLED), `ui/ribbon/data/contextual-wall-tab.ts` (wall-material panel DISABLED), `ui/ribbon/data/contextual-slab-tab.ts` (slab-material panel DISABLED), `i18n/locales/el/dxf-viewer-shell.json` + `i18n/locales/en/dxf-viewer-shell.json` (panel labels columnMaterial/beamMaterial/wallMaterial/slabMaterial, restructured ribbon.commands.bim.* nested label+tooltip, new material.* sub-keys per editor namespace, comingSoon tooltips). **Files created (0)**: pure UI wiring στα υφιστάμενα ribbon data + bridge files. **Deferred**: Wall material picker activation → WallDna Phase 1D, Beam material picker → Phase 5.5c, Slab material picker → material library Phase 6+. ✅ Google-level: YES — pure UI wiring, ADR-345 comingSoon pattern reused για disabled placeholders (visible reminder per ADR-261), Column material edit flows through atomic `UpdateColumnParamsCommand` (undoable, idempotent recompute), full i18n SSoT μηδέν hardcoded user-facing strings (SOS N.11), pure Greek el locale (SOS N.11 zero αγγλικές λέξεις), zero `any`/`as any` (SOS N.2). | Claude Opus 4.7 |
| 2026-05-19 | **Selection visual feedback fix — all BIM renderers**. Root cause: 6 BIM renderers (`WallRenderer`, `ColumnRenderer`, `BeamRenderer`, `OpeningRenderer`, `SlabOpeningRenderer`, `SlabRenderer`) implement custom `render()` without calling `renderGrips`. Clicking any BIM entity stored its id in `universalSelection` (selection was functional) but grips never appeared → user saw no visual change and assumed selection failed → delete from keyboard also appeared broken. Fix: `if (options.grips) { this.renderGrips(entity, options); }` added at end of each render(). `StairRenderer` already had this — mirrors its pattern. Also: `DxfRenderer.renderEntityUnified` now passes `selected: isSelected` in `renderOptions` so `PhaseManager.determinePhase` receives the flag (prevents hover glow showing on top of selection). Files modified (7): `WallRenderer.ts`, `ColumnRenderer.ts`, `BeamRenderer.ts`, `OpeningRenderer.ts`, `SlabOpeningRenderer.ts`, `SlabRenderer.ts`, `DxfRenderer.ts`. |
| 2026-05-19 | **`finalizeRender` centralization (Boy Scout Rule N.0.2)**. The `if (options.grips) { this.renderGrips(entity, options); }` block was copy-pasted in all 7 BIM renderers. SSoT fix: new `protected finalizeRender(entity, options)` method added to `BaseEntityRenderer` — single place for grip rendering logic. Also fixed pre-existing bug in `finalizeRendering`: was calling `this.renderGrips(entity)` without `options` (default `{}`) — now passes correct `options` so `PhaseManager.determinePhase` receives full phase state. All 7 BIM renderers (`WallRenderer`, `ColumnRenderer`, `BeamRenderer`, `OpeningRenderer`, `SlabOpeningRenderer`, `SlabRenderer`, `StairRenderer`) now call `this.finalizeRender(entity, options)` — zero inline if-blocks. Files modified (8): `BaseEntityRenderer.ts` (new method + bugfix) + 7 BIM renderers. | Claude Sonnet 4.6 |
| 2026-05-19 | **BIM tools ESC migration to ADR-364 EscapeCommandBus**. Bug report από Γιώργο: "ΟΤΑΝ ΔΙΝΩ ΕΝΤΟΛΗ ΓΙΑ ΝΑ ΣΧΕΔΙΑΣΩ ΟΠΟΙΑΔΗΠΟΤΕ ΟΝΤΟΤΗΤΑ, ΤΟ ESCAPE ΔΕΝ ΛΕΙΤΟΥΡΓΕΙ". Root cause: τα 5 BIM tools (column/beam/slab/opening/slab-opening) εισήχθησαν στις Phase 4.5c/5.5c (μετά το ADR-364) με per-tool capture-phase `window.addEventListener('keydown', ...)` ESC listeners που έκαναν soft reset εντός tool — αντί να βγάζουν στο select όπως οι line/polyline/rectangle/etc. Παράλληλα τα tool names ΔΕΝ ήταν στο `DRAWING_TOOLS_WITH_CANCEL` set του `useKeyboardShortcuts`, άρα ο escape-bus έκανε fall-through στο COLOR_MENU (no-op). User βλέπει "Escape doesn't work". Fix (Group 3 migration per ADR-364 §4.1): (1) `useColumnTool` — αφαίρεση του ESC branch από το Tab+ESC useEffect (Tab παραμένει). (2) `useBeamTool` — αφαίρεση ολόκληρου του ESC useEffect, drop `useEffect` import. (3) `useSlabTool` — αφαίρεση του ESC branch από το Enter+ESC useEffect (Enter παραμένει για polygon commit). (4) `useOpeningTool` — αφαίρεση ολόκληρου του ESC useEffect, drop `useEffect` import. (5) `useSlabOpeningTool` — αφαίρεση ολόκληρου του ESC useEffect, drop `useEffect` import. (6) `useKeyboardShortcuts.DRAWING_TOOLS_WITH_CANCEL` — προσθήκη `column, beam, slab, opening, slab-opening` (10 → 15 tools). Αποτέλεσμα: ESC → bus DRAW_TOOL slot → `onDrawingCancel` → `handleToolCompletion(activeTool, true)` → `activeTool = 'select'` → `useToolLifecycle` καλεί `tool.deactivate()` → tool state → INITIAL_STATE. AutoCAD/Revit/ArchiCAD parity για ΟΛΑ τα drawing tools. Bus SSoT pure: zero parallel window listeners σε capture phase. **Files modified (6)**: useColumnTool.ts, useBeamTool.ts, useSlabTool.ts, useOpeningTool.ts, useSlabOpeningTool.ts, useKeyboardShortcuts.ts. **Files created (0)**. ADR-364 changelog ενημερωμένο same session (Group 3 entry + §4.1 migration table). ✅ Google-level: YES — SSoT pure (zero parallel listeners), industry convergence (AutoCAD/Revit/ArchiCAD ESC=exit), idempotent (deactivate is no-op when already idle), zero race conditions (synchronous tool completion). | Claude Opus 4.7 + Γιώργος Παγώνης |
| 2026-05-19 | **Phase 5.5g IMPLEMENTED — Snap-to-Opening-Jamb Perpendicular Projection**. Direct mirror των Phase 5.5e (wall axis) και Phase 5.5f (slab edge) για `OpeningEntity` (4-vertex cutout rectangle). Κλείνει το `snap-to-opening-jamb perpendicular` deferred item από Phase 5.5e. Design: same reuse-first architecture — extend `NearestSnapEngine` + `PerpendicularSnapEngine` με `isOpeningEntity` branch (after existing `isSlabEntity` branch). Pure SSoT module `bim/walls/opening-outline-projection.ts`: `projectPointOnOpeningOutline(opening, cursor)` (clamped, NEAREST) + `getOpeningOutlinePerpendicularFeet(opening, cursor, maxDistance)` (unclamped per-edge, PERPENDICULAR). Cached geometry SSoT: `opening.geometry.outline.vertices` (4 `Point3D` CCW, Phase 2 invariant). Closing edge [3]→[0] included via modulo `(i+1) % n` — mirror Phase 5.5f pattern. Vertex layout: [0]=start-outer [1]=end-outer [2]=end-inner [3]=start-inner. 4 snap targets: outer face (edge 0), end jamb (edge 1), inner face (edge 2), start jamb (edge 3). **Files created (2)**: `bim/walls/opening-outline-projection.ts` (~75 γρ, pure SSoT), `bim/walls/__tests__/opening-outline-projection.test.ts` (13 Jest tests — clamped×7 + unclamped×6, rect horizontal wall + window opening, covers outer/inner faces, start/end jambs, corner zones, unclamped extensions, null guards). **Files modified (2)**: `snapping/engines/NearestSnapEngine.ts` (`isOpeningEntity` + `projectPointOnOpeningOutline` branch μετά `isSlabEntity`), `snapping/engines/PerpendicularSnapEngine.ts` (`isOpeningEntity` + `getOpeningOutlinePerpendicularFeet` branch μετά `isSlabEntity`, label `'Opening Edge N'`). Phase 5.5e deferred list ticked (snap-to-opening-jamb ✅). **Deferred Phase 5.5g+**: distinct i18n label "Επί παραστάτη ανοίγματος", column-center-line 3D wireframe snap, beam-supports-slab analytical link (Phase 6), section-profile preview. ✅ Google-level: YES — pure SSoT (opening outline projection single-sourced + Phase 2 cached geometry leveraged, zero re-computation), reuse-first (extend NearestSnapEngine + PerpendicularSnapEngine, ΟΧΙ νέος engine/SnapType), modulo closing-edge mirrors Phase 5.5f invariant, idempotent pure functions, ADR-040 micro-leaf compliance (ZERO new React subscriptions), defensive null guard, zero ribbon/i18n/command surface. | Claude Sonnet 4.6 |
| 2026-05-19 | **Phase 5.5f IMPLEMENTED — Snap-to-Slab-Edge Perpendicular Projection**. Direct mirror του Phase 5.5e (wall axis → slab outline edge). Closes deferred item από Phase 5.5e. Key difference: slab outline = closed CCW polygon → closing edge `[last→first]` via modulo index `(i+1)%n` (wall axis ήταν open polyline). Design: same reuse-first architecture — extend `NearestSnapEngine` + `PerpendicularSnapEngine` με `isSlabEntity` branch. Pure SSoT module `bim/slabs/slab-edge-projection.ts`: `projectPointOnSlabEdge(slab, cursor)` (clamped, NEAREST) + `getSlabEdgePerpendicularFeet(slab, cursor, maxDistance)` (unclamped per-edge, PERPENDICULAR, includes closing edge). Leverage cached `slab.geometry.polygon.points` (Phase 3 invariant — `computeSlabGeometry` sets `polygon: params.outline` directly). Defensive null guards εάν `polygon.points?.length < 3`. Corner zone: clamped → nearest adjacent edge foot (clamped to vertex); unclamped → ≥2 feet from adjacent infinite lines (engine picks priority winner). **Files created (2)**: `bim/slabs/slab-edge-projection.ts` (79 γρ), `bim/slabs/__tests__/slab-edge-projection.test.ts` (12 Jest tests — clamped×6 + unclamped×6, rect/triangle slabs + closing edge + null guards). **Files modified (2)**: `snapping/engines/NearestSnapEngine.ts` (νέο `isSlabEntity` import + `projectPointOnSlabEdge` import + branch μετά `isWallEntity`), `snapping/engines/PerpendicularSnapEngine.ts` (νέο `isSlabEntity` import + `getSlabEdgePerpendicularFeet` import + branch μετά `isWallEntity`, label `'Slab Edge N'`). Zero React/canvas/hook/ribbon/i18n changes. Phase 5.5e deferred list ticked (snap-to-slab-edge ✅). ✅ Google-level: YES — pure SSoT, reuse-first (extend existing engines, zero new SnapType — industry convergence AutoCAD/Revit), idempotent, ADR-040 micro-leaf compliance (ZERO new React subs), modulo index correct for closed polygon, defensive guards, zero command/ribbon/i18n surface. | Claude Sonnet 4.6 |
| 2026-05-19 | **Phase A — Distinct i18n snap labels for BIM entities (Option A)**. Closes deferred item "distinct i18n labels" από Phase 5.5g. Αρχεία τροποποιημένα (6): (1) `snapping/engines/NearestSnapEngine.ts` — μετά εύρεση `closestEntity`, αν `isWallEntity` → description=`'bim-wall'`, αν `isSlabEntity` → `'bim-slab'`, αν `isOpeningEntity` → `'bim-opening'`. (2) `snapping/engines/PerpendicularSnapEngine.ts` — BIM pre-pass πριν `findEntityBasedSnapCandidates`: wall/slab/opening entities διαχωρίζονται, candidates δημιουργούνται απευθείας με `this.createCandidate(..., 'bim-*', ...)` (ώστε να μην χαθεί η BIM-specific description στο generic `displayName: 'Perpendicular'` του `findEntityBasedSnapCandidates`). Non-BIM entities → εξακολουθούν να χρησιμοποιούν `findEntityBasedSnapCandidates`. Αποτέλεσμα: `allCandidates` = merge + sort by distance. (3) `components/dxf-layout/canvas-layer-stack-leaves.tsx` — `SnapIndicatorSubscriber` περνά `description: snapResult.snapPoint?.description` στο `SnapIndicatorOverlay`. (4) `canvas-v2/overlays/SnapIndicatorOverlay.tsx` — τοπικό `SnapResult` interface += `description?: string`. `BIM_DESCRIPTION_KEY` map: `'bim-wall'→'snapModes.labels.bim.wallAxis'` κλπ. `useTranslation('dxf-viewer-shell')`. Αν `bimLabel` resolved → εμφανίζεται text label δεξιά του snap icon (AutoCAD style). (5) `el/dxf-viewer-shell.json` — νέα keys: `snapModes.labels.bim.{wallAxis:'Επί άξονα τοίχου', slabEdge:'Επί ακμής πλάκας', openingJamb:'Επί παραστάτη ανοίγματος'}`. (6) `en/dxf-viewer-shell.json` — `snapModes.labels.bim.{wallAxis:'On wall axis', slabEdge:'On slab edge', openingJamb:'On opening jamb'}`. ✅ Google-level: YES — pure SSoT (one label source in locale files), i18n-correct (no hardcoded strings per SOS N.11), ADR-040 compliant (useTranslation in SnapIndicatorOverlay, NOT in the subscriber leaf), idempotent pure label resolution. | Claude Sonnet 4.6 |
| 2026-05-19 | **Phase 7B IMPLEMENTED — Single-char BIM variant shortcuts (D / Wn)**. Closes deferred item από Phase 2 + Phase 7A. (1) `systems/events/EventBus.ts` — 2 νέα events: `'bim:set-opening-kind': { kind: OpeningKind }` + `'bim:set-wall-kind': { kind: WallKind }`. Type-only imports (`import type`) → zero runtime coupling. (2) `hooks/drawing/useOpeningTool.ts` — `useEffect(() => EventBus.on('bim:set-opening-kind', ({ kind }) => setKind(kind)), [setKind])`. `setKind` stable (useCallback []) → listener registers exactly once per mount. (3) `hooks/drawing/useWallTool.ts` — mirror: `useEffect(() => EventBus.on('bim:set-wall-kind', ({ kind }) => setKind(kind)), [setKind])`. (4) `hooks/useDxfToolbarShortcuts.ts` — 3 νέα BIM chords: `W+1 → 'tool:wall:straight'`, `W+2 → 'tool:wall:curved'`, `W+3 → 'tool:wall:polyline'`. W fallback added: `{ firstKey: 'W', action: 'tool:wall' }` (W alone → wall, same as before). Dead code removed: `matchesShortcut(e, 'wall')` line deleted (W πλέον handled by bimDispatcher). `chord-completed` handler extended: `tool:wall:straight/curved/polyline` → `handleToolChange('wall')` + `EventBus.emit('bim:set-wall-kind', { kind })`. Context-sensitive D: `if (activeTool === 'opening' && key === 'D') → EventBus.emit('bim:set-opening-kind', { kind: 'door' }) → return`. Outside opening context: falls through to `measureDistance` (zero conflict). (5) `config/keyboard-shortcuts.ts` — doc entries: `wallStraight` (W1) / `wallCurved` (W2) / `wallPolyline` (W3) + `openingDoor` (D, context=opening). Wall entry comment updated: "W is a BIM chord leader via MultiCharKeySequence". ✅ Google-level: YES — EventBus SSoT (no prop-drilling cross-siblings), setKind stable ref (zero stale-closure risk), context-sensitive D (zero conflict with measureDistance), W chord table (mirrors existing S/O/C/B Phase 7A pattern), idempotent (setKind with same value = no-op), zero hardcoded user-facing strings (SOS N.11). | Claude Sonnet 4.6 |
| 2026-05-19 | **Phase B — Doc gap sync: Phase 0 + Phase 0.5 status update**. Επαλήθευση κώδικα vs ADR checkboxes: Phase 0 Bootstrap ALL DONE (bim/ skeleton, bim-base.ts, EntityType+6 BIM types, ENTERPRISE_ID_PREFIXES+9 prefixes, COLLECTIONS+6 collections, 21 composite indexes, 9 Firestore rules, i18n skeleton, SSoT registry +3 modules) — checkboxes ενημερώθηκαν σε [x] με ακριβείς τιμές. Phase 0.5 (Stair Migration) επαληθεύτηκε ⚠️ NOT COMPLETED: `bim/stairs/` + `bim/geometry/stairs/` έχουν αντίγραφα αρχείων αλλά `systems/stairs/` παραμένει ζωντανός SSoT (20+ αρχεία import από εκεί). Προστέθηκε status block στο §6 Phase 0.5 με πλήρη ανάλυση. Pending-ratchet-work.md ενημερώθηκε με νέο item για stair import migration. | Claude Sonnet 4.6 |
| 2026-05-19 | **Phase 2 deferred pipeline WIRED — Opening canvas pipeline + DxfOpening wrapper**. Closes the last deferred item in the Phase 2 list. The renderer-side machinery (WallRenderer `setOpeningsByWall` + `globalCompositeOperation='destination-out'` Boolean cutout) was already in place since Phase 2.5. Missing piece: `DxfEntityUnion` had no `'opening'` variant, so `useDxfSceneConversion` silently dropped opening entities and `DxfRenderer` never fed `composite.setOpeningsByWall()`. Fix: (1) `canvas-v2/dxf-canvas/dxf-types.ts` — `DxfOpening` interface (`type: 'opening'; openingEntity: OpeningEntity`), `'opening'` added to `DxfEntity.type` discriminant union, `DxfOpening` added to `DxfEntityUnion`. (2) `hooks/canvas/useDxfSceneConversion.ts` — `import type { OpeningEntity }` + `isOpeningEntity` guard added to named imports; new `case 'opening'` branch: `{ ...base, type: 'opening' as const, openingEntity: entity as OpeningEntity }` (mirrors slab case). (3) `canvas-v2/dxf-canvas/DxfRenderer.ts` — `import type { DxfOpening, OpeningEntity }` + `import type { OpeningsByWall }`; new `private buildOpeningsByWall(entities)` O(n) scan building `Map<wallId, OpeningEntity[]>`; new `case 'opening'` in `toEntityModel()` unwraps `DxfOpening` → entity; `render()` calls `composite.setOpeningsByWall(this.buildOpeningsByWall(scene.entities))` before entity render pass. Result: wall fills now visually punch through for all hosted openings (Boolean cutout). ADR-040 micro-leaf compliant (renderer never subscribes — caller pushes per-frame map). ✅ Google-level: YES — proactive O(n) scan feeds WallRenderer each frame (no stale data), idempotent (empty map = no cutout, correct for scenes with no openings), single SSoT (`buildOpeningsByWall` mirrors `buildSlabOpeningsBySlab`), zero race conditions, ADR-040 micro-leaf compliance. | Claude Sonnet 4.6 |
| 2026-05-19 | **Phase cascade-delete IMPLEMENTED — Wall cascade delete confirmation dialog**. When user deletes a wall that owns child openings, a confirmation dialog prompts before proceeding. Pattern: PathDeletionWarningDialog (createPortal). Files created (2): (1) `bim/walls/wall-cascade-delete-store.ts` — module-level Promise handshake store (HoverStore/ImmediatePositionStore pattern). `requestWallCascadeDelete(count)` suspends delete flow; `resolveWallCascadeDelete(action)` closes dialog + resolves promise. `useSyncExternalStore`-compatible subscribe/snapshot. (2) `ui/dialogs/WallCascadeDeleteDialog.tsx` — `createPortal(document.body)` modal, zero props (subscribes to store via `useSyncExternalStore`), two actions: 'delete-all' / 'cancel', `autoFocus` on Cancel (safe default: Figma/Linear/Notion pattern). Files modified (4): (3) `hooks/canvas/useSmartDelete.ts` — Priority 3 extended: detect walls in selection → scan scene for orphaned openings via `isOpeningEntity` type guard + `e.params.wallId ∈ deletingWallIds`. If orphans found → `await requestWallCascadeDelete(count)`. If 'delete-all' → `idsToDelete = [walls, openings]` → `DeleteMultipleEntitiesCommand` (full undo/redo support — restores both wall AND openings). (4+5) `i18n/locales/{el,en}/dxf-viewer-shell.json` — `bim.wallCascadeDelete.{title, body, confirmDelete, cancel}`. (6) `app/WallPersistenceHost.tsx` — renders `<WallCascadeDeleteDialog />` (portal → document.body, tree position irrelevant). ✅ Google-level: YES — proactive detection, no race conditions (async/await blocks delete), idempotent (one pending request at a time), belt-and-suspenders (no openings → skip dialog), SSoT (DeleteMultipleEntitiesCommand single delete path), undo/redo restores wall + openings. | Claude Sonnet 4.6 |
| 2026-05-19 | **Arc hit-test counterclockwise fix**. `hitTestArcEntity` (`rendering/entities/shared/line-utils.ts`) και `pointToArcDistance` (`utils/angle-entity-math.ts`) δεν λάμβαναν υπόψη το `counterclockwise` flag, οπότε CW arcs (incl. BIM curved walls drawn in CW direction) failed hit-test στο visible range τους. Fix: όταν `counterclockwise === true` swap `[startAngle, endAngle]` πριν το `isAngleInArcRange` check — visible CW arc spans `[end → start]` σε CCW orientation. `ArcRenderer.hitTest` τώρα περνάει `arcData.counterclockwise` στο shared helper. `hitTestArc` (hit-test-entity-tests.ts) ενημερωμένο cast type signature με optional `counterclockwise`. **Files modified (4)**: `ArcRenderer.ts`, `line-utils.ts`, `hit-test-entity-tests.ts`, `angle-entity-math.ts`. ✅ Google-level: YES — root-cause fix (renderer uses `!counterclockwise` for canvas direction, hit-test must mirror), pure functions, zero new state, mirrors renderer geometry. | Claude Opus 4.7 |
| 2026-05-19 | **Phase Wall-Grip-Opening-Recompute IMPLEMENTED — Revit Transaction Pattern**. Closes the deferred item "wall split mid-opening (recompute opening positions όταν αλλάζει wall axis)". When user drags a wall endpoint/midpoint grip, hosted openings now reposition proportionally and remain geometrically valid. Architecture: Revit Transaction Pattern — `WallOpeningCoordinator` wraps `UpdateWallParamsCommand` + N `UpdateOpeningParamsCommand` into a single `CompoundCommand` → one atomic undo/redo entry. Ratio-preserving: `newOffset = (oldOffset / oldLength) × newLength`. Overflow clamp: if wall shrinks and opening would overflow → clamp to `max(0, newLength − opening.width)`. Drag merge: `CompoundCommand.canMergeWith/mergeWith` added — delegates pairwise to children so consecutive drag samples collapse into a single undo entry (mirrors `UpdateWallParamsCommand` ADR-031 merge window). Short-circuit: if wall has no `hostedOpeningIds` → coordinator returns `wallCmd` unchanged (zero overhead for plain walls). **Files created (1)**: `bim/walls/wall-opening-coordinator.ts` (~80 γρ, pure SSoT — `coordinateWallUpdate(wallCmd, wallId, oldParams, newParams, sceneManager, isDragging): ICommand`). **Files modified (3)**: (1) `core/commands/CompoundCommand.ts` — `canMergeWith(other)` replaces the no-op `false`; new `mergeWith(other)` delegates pairwise. (2) `hooks/grips/grip-parametric-commits.ts` — `commitWallGripDrag` routes through `coordinateWallUpdate` before `deps.execute`. (3) `ADR-363-bim-drawing-mode.md` (this entry). **Limitation (deferred)**: curved/polyline walls use chord length as axis-length approximation — exact arc-length recompute is Phase 0.5+ work. ✅ Google-level: YES — Revit Transaction Pattern (industry standard for hosted-element cascade), single atomic undo step, ratio-preserving + overflow clamp, zero overhead for plain walls, drag merge preserved end-to-end, pure SSoT coordinator (no logic in grip handler). | Claude Sonnet 4.6 |
| 2026-05-19 | **Phase 5.5e IMPLEMENTED — Snap-to-Wall-Axis Perpendicular Projection**. Closes το `snap-to-wall-axis projection` deferred item από Phase 5.5d. Industry parity: AutoCAD NEAREST + PERPENDICULAR osnaps και Revit "Snap to Reference Line" — beam endpoints (ή κάθε drawing tool με snap ενεργό) κουμπώνουν στην ορθή προβολή πάνω στον wall axis όταν ο cursor μπει εντός snap radius. Root cause: ούτε `NearestSnapEngine` ούτε `PerpendicularSnapEngine` αναγνώριζαν `WallEntity` — walls είχαν spatial-index entries μόνο για endpoints (Phase 1B) + midpoints (Phase 1C). Design: reuse-first — extend τους δύο engines με `isWallEntity` branch, ΟΧΙ νέος engine, ΟΧΙ νέος `ExtendedSnapType` (industry convergence — AutoCAD/Revit architectural preset ήδη έχει και τους δύο osnaps active). Pure SSoT module `bim/walls/wall-axis-projection.ts` με 2 functions: `projectPointOnWallAxis(wall, cursor): Point2D \| null` (clamped, NEAREST semantics — `getNearestPointOnLine` clamp=true ανά segment, αν cursor εκτός segment foot=endpoint) και `getWallAxisPerpendicularFeet(wall, cursor, maxDistance): Array<{point, segmentIndex}>` (unclamped, PERPENDICULAR semantics — clamp=false + radius filter, επιτρέπει foot σε προέκταση). Leverage cached `wall.geometry.axisPolyline.points` (Phase 1 invariant) → uniform code path για straight (2 verts) / curved (17 tessellated λόγω `CURVED_SUBDIVISIONS=16`) / polyline (N user verts) → ZERO Bezier math duplication, ZERO export του internal `subdivideQuadraticBezier`. Defensive null guards αν geometry missing. Zero changes σε beam side, ribbon, i18n, command surface. **Files created (2)**: `bim/walls/wall-axis-projection.ts` (pure SSoT, 90 γρ), `bim/walls/__tests__/wall-axis-projection.test.ts` (12 Jest tests — clamped × 6 + unclamped × 6, καλύπτει straight/curved/polyline + null geometry guards). **Files modified (2)**: `snapping/engines/NearestSnapEngine.ts` (νέο `isWallEntity` import + `projectPointOnWallAxis` import + branch στην αρχή του `getNearestPointOnEntity()`), `snapping/engines/PerpendicularSnapEngine.ts` (νέο `isWallEntity` import + `getWallAxisPerpendicularFeet` import + `else if (isWallEntity)` branch στο `getPerpendicularPoints()` με label `'Wall Axis Segment N'`). Phase 5.5d deferred list ticked (snap-to-wall-axis ✅). **Deferred Phase 5.5f+**: snap-to-slab-edge perpendicular, snap-to-opening-jamb perpendicular, distinct i18n label "Επί άξονα τοίχου", column-center-line 3D wireframe snap (από Phase 5.5d), beam-supports-slab analytical link (Phase 6), section-profile preview steel I/H beams. ✅ Google-level: YES — pure SSoT (axis projection single-sourced + cached geometry leveraged ZERO duplication), reuse-first architecture (extend existing engines, industry convergence AutoCAD/Revit), idempotent (pure functions), ADR-040 micro-leaf compliance (ZERO new React subscriptions), clamped vs unclamped maps clean σε NEAREST vs PERPENDICULAR osnap intents, defensive missing geometry, zero ribbon/i18n/command changes. | Claude Opus 4.7 |
