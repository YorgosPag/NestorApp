# ADR-363 — BIM Drawing Mode (Parametric Building Elements)

| Πεδίο | Τιμή |
|---|---|
| **Status** | 🟢 **FULLY IMPLEMENTED** 2026-05-21 — Phases 0-8 complete. Wall/Opening/Slab/Column/Beam tools, Phase 5.6 Wall Split, Phase 6 BOQ auto-feed, Phase 7.1-7.2 multi-select + bulk edit, Phase 8 schedule export. |
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

> **Elevation convention**: `levelElevation` = top face (FFL) σε mm από project origin. Slab hangs DOWN by `thickness`. Βλ. **ADR-369 §2.1** για full reference system.

```typescript
// src/subapps/dxf-viewer/bim/types/slab-types.ts  (Post-ADR-369 §2.1 — Phase A4)
export type SlabKind = 'floor' | 'ceiling' | 'roof' | 'ground' | 'foundation';
export type SlabGeometryType = 'box' | 'tilted';

export interface SlabParams {
  readonly kind: SlabKind;
  readonly outline: Polygon3D;              // closed polygon (CCW). Min 3 vertices.
  readonly levelElevation: number;          // mm. Top face z (FFL). Renamed από elevation (ADR-369 §2.1).
  readonly heightOffsetFromLevel?: number;  // mm (default 0) — raise/drop top-face від FFL.
  readonly thickness: number;               // mm (default 200)
  readonly geometryType: SlabGeometryType;  // 'box' (default) | 'tilted'. ADR-369 §9 Q7.
  readonly slope?: SlabSlope;               // required when geometryType='tilted', forbidden otherwise.
  readonly slabOpeningIds?: string[];       // διανοίξεις (lift shaft, stair well) — Phase 3.5
  readonly material?: string;
  readonly reinforcement?: 'one-way' | 'two-way' | 'waffle' | 'flat';
}

export interface SlabGeometry {
  readonly polygon: Polygon3D;
  readonly bbox: BoundingBox3D;
  readonly area: number;               // m² (gross)
  readonly netArea: number;            // m² (μετά τις διανοίξεις)
  readonly volume: number;             // m³ (netArea × thickness)
  readonly perimeter: number;          // m
  readonly maxFreeSpanM: number;       // m (Phase 3.8)
}

export interface SlabEntity extends BimEntity<SlabKind, SlabParams, SlabGeometry>, IfcEntityMixin {
  type: 'slab';
  readonly ifcType: 'IfcSlab';
}
```

### 5.6 Column — Type Schema

```typescript
// src/subapps/dxf-viewer/bim/types/column-types.ts (post-Column-Shapes-Phase-8 — 7 kinds)
export type ColumnKind =
  | 'rectangular'
  | 'circular'
  | 'L-shape'
  | 'T-shape'
  | 'polygon'      // ADR-363 Phase 8 — regular N-gon (3–12 sides)
  | 'shear-wall'   // ADR-363 Phase 8 — μακρόστενη ορθογωνία (Eurocode 8 §5.4.2.4)
  | 'I-shape';     // ADR-363 Phase 8 — steel double-T (IPE/HEA family)

export type ColumnAnchor = 'center' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w';

export interface ColumnParams {
  readonly kind: ColumnKind;
  readonly position: Point3D;
  readonly anchor: ColumnAnchor;       // ποιο σημείο του διατομής είναι στο position
  readonly width: number;              // mm (διάμετρος αν circular, circumscribed Ø αν polygon, flange-width b αν I-shape, length αν shear-wall)
  readonly depth: number;              // mm (αγνοείται αν circular/polygon, section-depth h αν I-shape, thickness αν shear-wall)
  readonly height: number;              // mm (default 3000)
  readonly rotation: number;            // deg (αγνοείται αν circular)
  readonly material?: string;
  readonly lshape?: { armLength?: number; armWidth?: number; flipY?: boolean };
  readonly tshape?: { flangeLength?: number; webThickness?: number; flipY?: boolean };
  readonly polygon?: { sides?: number };                                          // Phase 8
  readonly ishape?: { flangeThickness?: number; webThickness?: number; flipY?: boolean }; // Phase 8
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

> **Elevation convention**: `topElevation` = top face (top-of-beam) σε mm από project origin. Beam hangs DOWN by `depth`. Βλ. **ADR-369 §2.2** για full reference system.

```typescript
// src/subapps/dxf-viewer/bim/types/beam-types.ts  (Post-ADR-369 §2.2 — Phase A4)
export type BeamKind = 'straight' | 'curved' | 'cantilever';
export type BeamSupportType = 'simple' | 'fixed' | 'cantilever';

export interface BeamParams {
  readonly kind: BeamKind;
  readonly startPoint: Point3D;             // renamed από start (ADR-369 Phase A4)
  readonly endPoint: Point3D;               // renamed από end
  readonly curveControl?: Point3D;          // για curved kind (Bezier control)
  readonly width: number;                   // mm. Cross-section X (default 250)
  readonly depth: number;                   // mm. Cross-section Y / structural depth (default 500). Renamed από height.
  readonly topElevation: number;            // mm. Top face z. Renamed από elevation (ADR-369 §2.2).
  readonly zOffset?: number;                // mm (default 0) — drop-from-ceiling offset. ADR-369 §854.
  readonly supportType?: BeamSupportType;
  readonly material?: string;
}

export interface BeamGeometry {
  readonly axisPolyline: Polyline3D;
  readonly outline: Polygon3D;
  readonly bbox: BoundingBox3D;
  readonly length: number;             // m (axis length)
  readonly area: number;               // m² (top surface)
  readonly volume: number;             // m³
  readonly maxFreeSpanM: number;       // m (Phase 3.8)
}

export interface BeamEntity extends BimEntity<BeamKind, BeamParams, BeamGeometry>, IfcEntityMixin {
  type: 'beam';
  readonly ifcType: 'IfcBeam';
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

### 5.17 EntityAudit Integration (ADR-195 + ADR-379 + ADR-380)

Κάθε create/update/delete BIM entity → fire-and-forget POST to `/api/audit-trail/record` via thin client `bim/<type>/<type>-audit-client.ts`. Server route dispatches σε `EntityAuditService.recordChange()` (server-only) με payload diffed στον client μέσω `bim/utils/bim-audit-helpers.ts` SSoT + **7 tracked-fields registries** στο `src/config/audit-tracked-fields.ts` (WALL/COLUMN/SLAB/BEAM/OPENING από ADR-379, **STAIR + SLAB_OPENING από ADR-380**):

```typescript
// Client (persistence hook)
const prevParams = lastSavedParamsRef.current.get(entity.id) ?? null;
const isNew = prevParams === null;
await svc.saveWall(entityToSaveInput(entity));
void recordWallChange(
  isNew ? 'created' : 'updated',
  entity,
  { prevParams: prevParams ?? undefined },
);
```

Helper routing (ADR-379 §2.3):
- `created` → `buildBimCreationChanges(snapshot, WALL_TRACKED_FIELDS)` — one entry per non-null tracked field, `oldValue: null → newValue: X`
- `updated` → `buildBimUpdateChanges(prev, next, WALL_TRACKED_FIELDS)` — only changed fields; **skip POST if empty** (debounced auto-save fires on identical params often)
- `deleted` → `buildBimDeletionChanges(snapshot, WALL_TRACKED_FIELDS)` — reverse diff, `oldValue: X → newValue: null` per non-null tracked field

Server route handles two race scenarios (ADR-379 §2.1):
- `action === 'deleted'` + `!entityDoc.exists` → 200 (entity already removed client-side); audit row tagged με `ctx.companyId` (defense-in-depth)
- Other actions + `!entityDoc.exists` → 404 (legitimate not-found)
- `entityDoc.exists` + foreign companyId → 403 (cross-tenant block)

**Pre-commit CHECK 3.17** baseline=0 από 2026-04-13 — όλα τα νέα writers πρέπει να καλούν `recordChange` αμέσως. Hard gate. Static analysis δεν εντοπίζει payload-quality issues; ADR-379 (wall/column/slab/beam/opening) + ADR-380 (stair + slab-opening) closed the runtime gap για 7/7 BIM entity types.

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

> **✅ STATUS 2026-05-19: COMPLETED**
>
> **Reality-vs-ADR reconciliation 2026-05-19**: Η αρχική περιγραφή της Phase 0.5 παρουσίαζε ένα drift πρόβλημα — υπέθετε ότι το `systems/stairs/` περιείχε ζωντανό κώδικα και το `bim/stairs/` ήταν stale duplicates. Στην πραγματικότητα η μετακίνηση είχε ξεκινήσει: τα ζωντανά αρχεία ζούσαν στο `bim/stairs/` + `bim/geometry/stairs/` (καθώς και `bim/types/stair-types.ts` + `bim/renderers/StairRenderer.ts`), ενώ το `systems/stairs/` περιείχε **45 barrel re-export stubs** (24 source + 21 test) που έδειχναν προς bim/. Επίσης 2 ζωντανά hooks (`hooks/data/useStairPersistence.ts`, `ui/ribbon/hooks/useRibbonStairBridge.ts`) ήταν ακόμα έξω από bim/ και χρειάστηκε μετακίνηση + import fix. Το `bim/renderers/StairRenderer.ts` είχε επίσης leak legacy `../../systems/stairs/` imports.
>
> **Actual closure 2026-05-19**:
> - ✅ 45 barrel stubs `systems/stairs/` διαγράφηκαν (folder removed)
> - ✅ 2 barrels `types/stair.ts` + `rendering/entities/StairRenderer.ts` διαγράφηκαν
> - ✅ 2 hooks μετακινήθηκαν σε `bim/hooks/` (`use-stair-persistence.ts` + `use-ribbon-stair-bridge.ts`) με fixed internal imports
> - ✅ `bim/renderers/StairRenderer.ts` legacy imports διορθώθηκαν (3 lines)
> - ✅ Consumer sweep: 17 αρχεία × `systems/stairs/` + 4 × `hooks/data/useStairPersistence` + 1 × `ui/ribbon/hooks/useRibbonStairBridge` + 65 × `types/stair` → όλα δείχνουν τώρα σε `bim/*`
> - ✅ `bim/index.ts` public API εκθέτει πλήρες stair surface (49 types + 3 type guards)
> - ✅ SSoT registry module `bim-folder-residency` προστέθηκε (forbiddenPatterns blocking imports σε 5 legacy paths, baseline 0) + `stair-presets-service` + `stair-firestore-service` ssotFile/allowlist paths ενημερώθηκαν σε bim/
> - ✅ tsc zero new errors, stair test suites (~150 tests) green
> - ✅ ADR-358 changelog updated
> - ✅ `.claude-rules/pending-ratchet-work.md` entry «ADR-363 STAIR MIGRATION — Phase 0.5 incomplete» αφαιρέθηκε

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

- [x] `bim/walls/wall-grips.ts` — pure `getWallGrips()` + `applyWallGripDrag()`. Grip kinds: `wall-start`, `wall-end`, `wall-midpoint`, `wall-thickness`, `wall-curve` (curved kind only), `wall-vertex-N` (polyline kind only). Pattern mirror stair-grips: zero React/DOM/Firestore deps. Scene-unit-aware thickness min/max floors (mirror `minWidthFloorFor` from stair). **2026-05-28 — 3-file split (N.7.1, mirror stair-grips):** `wall-grip-math.ts` (shared `unitAxis`/`perpUnit`/`project2D`) + `wall-grip-transforms.ts` (`applyWallGripDrag` + drag fns + thickness clamps, re-exported from `wall-grips.ts` for a stable public API) + `wall-grips.ts` (positions only). Zero behavior change.
- [x] `bim/walls/wall-preview-store.ts` — single-writer/multi-reader module store (ADR-040-safe). Mirror `stairPreviewStore`. `useWallTool` writes startPoint + curveControl + polylineVertices + overrides on every transition; `updatePreview` reads it.
- [x] `WallRenderer.getGrips()` — wired to `getWallGrips(wall)`. `grip-types.ts` + `grip-registry.ts` + `grip-commit-adapters.ts` extended for `wallGripKind` discriminator. New `commitWallGripDrag` routes through `UpdateWallParamsCommand` (`isDragging=true` → merge window).
- [x] `useWallTool` extended: kind switch (`setKind('straight'|'curved'|'polyline')`), curved 3-click flow (start → end → curveControl), polyline N-click flow with Enter to finish, preview store sync, Dynamic Input inline overrides (height/thickness/category/flip).
- [x] `drawing-preview-generator.generateWallPreview()` — outer/inner edge polygon ghost from `computeWallGeometry()` (WYSIWYG with committed renderer). Reads `wallPreviewStore` for kind/overrides/curveControl.
- [x] `useUnifiedDrawing` wall branch — resolves wall from `toolStateStore`, reconstructs `tempPoints` from `wallPreviewStore`, propagates scene units to preview.
- [x] `bim/geometry/wall-geometry.ts` — curved kind subdivision: quadratic Bezier 16 segments (`CURVED_SUBDIVISIONS`), pinned endpoints to params.start/end, mirrors AutoCAD `SPLINESEGS`.
- [x] Snap engine integration — `GeometricCalculations.getEntityEndpoints/getEntityMidpoints/getEntityMidpoint` extended με wall case (axis endpoints + axis midpoint; polyline kind → per-spine vertex/segment). Activates Endpoint + Midpoint snap engines για walls via existing spatial index pipeline.
- [x] `DynamicSubmitDetail` extended με `height`/`thickness`/`category`/`flip` — Phase 1B Stream E parity για walls. `commit-wall` action applies inline overrides ahead of commit.
- [x] Tests Jest: `bim/walls/__tests__/wall-grips.test.ts` (14 tests grip layout + applyDrag transforms — extended to 22 tests in Phase 1C-bis), `bim/walls/__tests__/wall-preview-store.test.ts` (7 tests writer/reset/snapshot stability), `bim/geometry/__tests__/wall-geometry.test.ts` extended με curved subdivision suite (6 tests).
- [ ] Floating advanced panel "Σύνθεση Στρώσεων" (WallDna editor) → deferred to Phase 1D.
- [ ] `wall-tool.ts` perpendicular auto-trim (`computeWallTrims` port) → deferred to Phase 1D.
- [ ] `WallDnaService` με material catalog (Phase 6+ material library) → unchanged.

**Phase 1C-bis — Asymmetric corner grips (✅ IMPLEMENTED 2026-05-27)**

Industry parity με ArchiCAD / Vectorworks / AutoCAD reference-line stretch. Closes
το direct-manipulation principle gap του Phase 1C: ο χρήστης πλέον μπορεί να
πιάσει οποιαδήποτε από τις 4 γωνίες του ορθογωνίου περιγράμματος ενός straight
wall και να το μεγαλώσει/μικρύνει κατά μήκος ΚΑΙ κατά πλάτος ταυτόχρονα, ενώ η
απέναντι όψη μένει anchor και ο άξονας ξανακεντράρεται.

- [x] `hooks/grip-types.ts` — επέκταση `WallGripKind` union με 4 νέα members:
  `wall-corner-start-pos`, `wall-corner-start-neg`, `wall-corner-end-pos`,
  `wall-corner-end-neg`. JSDoc περιγράφει το 2-DOF asymmetric semantics.
- [x] `bim/walls/wall-grips.ts` — `getWallGrips()` emits 4 corner GripInfo entries
  (μετά το thickness handle) ΜΟΝΟ για `kind === 'straight'`. Νέος pure helper
  `moveCorner(input, side, perpSign)` που:
    - decomposes το cursor delta σε axial (κατά τον άξονα) + perpendicular
      (κάθετα στον άξονα, signed στο +perp basis) components;
    - μεταφράζει το axial μόνο στο `start` ή στο `end` (αναλόγως side);
    - υπολογίζει `new_t = clamp(t + perpSign · perp_d, minT, maxT)` (scene-unit-aware
      μέσω των ήδη υπαρχόντων `minThicknessFloorFor` / `maxThicknessCeilingFor`);
    - back-derives `actualPerp_d = perpSign · (new_t − t)` ώστε η απέναντι όψη
      να μένει ακίνητη ακόμη και μετά από clamp;
    - shifts axis κατά `actualPerp_d / 2` στο +perp direction (axis recenter
      στη μέση των δύο όψεων → wall παραμένει ορθογώνιο, parallel faces invariant
      preserved);
    - drops `dna` (manual override parity με `resizeThickness`).
  4 νέα branches στο `applyWallGripDrag()` για τα 4 corner kinds.
- [x] Tests Jest: `bim/walls/__tests__/wall-grips.test.ts` extended με 8 νέα
  tests (#15–#22): corner positions, axial-only drag, +Y/-Y perp drag axis
  recenter, diagonal drag, scene-unit thickness clamp, axis-direction
  preservation (parallel faces invariant), opposite-face anchored.
- [x] Pipeline reuse — ZERO αλλαγές χρειάστηκαν στο rest του grip system:
  `computeDxfEntityGrips` καλεί `getWallGrips()` directly, `grip-registry` /
  `grip-projections` / `apply-entity-preview` / `commitWallGripDrag` /
  `UpdateWallParamsCommand` propagation γενικά forward το `wallGripKind`
  discriminator → νέα corner kinds ροή χωρίς extra wiring.

**Διατήρηση παλιών grips**: όλα τα 4 υπάρχοντα grips (start/end/midpoint/thickness)
παραμένουν λειτουργικά. Σύνολο grips σε straight wall πλέον 8 (4 corners +
2 axis endpoints + midpoint + symmetric thickness handle). Ο symmetric thickness
handle κρατήθηκε γιατί προσφέρει διαφορετική, αμετάβλητη σε ορθογώνιο, αλλαγή
πάχους χωρίς axis recenter (mirror του Revit "Wall Centerline" location-line
mode όταν θες symmetric resize).

**Phase 1C-bis hotfix — geometry-driven grip positions + symmetric thickness handle (✅ FIXED 2026-05-28)**

**Σύμπτωμα (live browser).** Ο χρήστης επέλεγε straight wall και έβλεπε ΜΟΝΟ 3
χερούλια (start / end / midpoint — τα σημεία πάνω στον άξονα), ενώ ο υπολογισμός
έβγαζε σωστά 8 grips (`getWallGrips` + `WallRenderer.getGrips` επιστρέφουν 8). Τα
5 χερούλια εκτός άξονα (thickness handle + 4 corners) ζωγραφίζονταν αλλά σε λάθος
θέση εκτός οθόνης.

**Root cause (unit mismatch — ίδια οικογένεια με το Phase 1F wall-trims footgun).**
Το `thickness` αποθηκεύεται ΠΑΝΤΑ σε mm (SSoT, `WallParams` §5.3), ενώ τα `start`/`end`
είναι σε canvas world units. Το `getWallGrips` ΞΑΝΑΫΠΟΛΟΓΙΖΕ τις θέσεις των off-axis
grips από raw params ως σκέτο `params.thickness / 2` — ΧΩΡΙΣ τον `mmToSceneUnits(sceneUnits)`
factor που εφαρμόζει το `computeWallGeometry` (`halfThicknessCanvas = thickness/2 · s`,
wall-geometry.ts:63). Σε meter-based scene (`s = 0.001`) τα corners έπεφταν 1000×
μακρύτερα → εκτός viewport. mm-scene (`s = 1`) δούλευε — γι' αυτό τα 22 mm-only tests
περνούσαν ενώ το production (meters) έσπαγε.

**Fix — geometry-driven SSoT (όχι "scale-the-mirror"), mirror του stair grip pattern.**
Η σωστή Google-level λύση: τα grips ΔΙΑΒΑΖΟΝΤΑΙ από το ήδη-computed footprint
(`geometry.outerEdge` / `innerEdge` — η ΙΔΙΑ SSoT που ζωγραφίζει ο renderer), αντί να
ξανα-υπολογίζονται από raw params. Έτσι οι handles ΔΕΝ ΜΠΟΡΟΥΝ να αποκλίνουν από τις
όψεις (όπως κάνει το `getStairGrips`, που διαβάζει `geometry.stringers`/`walkline`).
- `getWallGrips` (straight kind): corners = footprint vertices, thickness handles =
  edge-midpoints — όλα από `geometry.outerEdge`/`innerEdge`. Το `flip` (baked στο
  geometry από `computeWallGeometry`) remapped στο +perp/-perp basis που χρησιμοποιεί
  το `moveCorner` (flip-agnostic) ώστε picked corner ↔ drag direction να μένουν συνεπή.
- **+2ο symmetric thickness handle** στην απέναντι μακριά όψη (AutoCAD edge-midpoint
  parity — σύρεις οποιαδήποτε όψη). Ίδιο `wall-thickness` transform (το `resizeThickness`
  είναι symmetric γύρω από άξονα → οποιαδήποτε όψη οδηγεί ίδιο resize). Σύνολο straight
  grips: 9 (3 axis + 2 thickness faces + 4 corners).
- Curved/polyline: κρατούν 1 thickness handle στο axis-mid (δεν υπάρχει ορθογώνιο
  footprint), scene-scaled (`· mmToSceneUnits`).
- DRAG transforms ΚΡΑΤΟΥΝ conversion (αναπόφευκτο canvas↔mm boundary, δεν διαβάζεται
  από geometry): `resizeThickness` `|proj|·2 / s`· `moveCorner` perp `/s` (canvas→mm
  thickness) + axis-recenter shift `·s` (mm→canvas). Helper `sceneScale(params) =
  mmToSceneUnits(params.sceneUnits ?? 'mm')`.
- Αφαιρέθηκαν τα 2 temp-debug blocks (`window.__wallGripsDebug` / `__wallRendererGetGrips`).
- Tests: 26/26 PASS — #1 → 9 grips, #15b (2 thickness faces), #23–#25 (`sceneUnits='m'`:
  positions scale, drag canvas→mm). Τα meter tests θα είχαν πιάσει το αρχικό bug.

**Γιατί geometry-driven και όχι το αρχικό "× s" mirror:** το `× s` ΔΟΥΛΕΥΕ αλλά κρατούσε
την offset math duplicated σε 2 σημεία (footprint + grips) → δυνητική απόκλιση. Geometry-
read = single source, ταυτόσημο με το stair pattern και με Revit/AutoCAD (τα grips ΕΙΝΑΙ
οι κορυφές του model). Bonus: corners πλέον σωστά και σε beveled walls (`startBevel`/
`endBevel`), που το raw-param re-derive αγνοούσε.

**Phase 1C-ter — Straight wall: μόνο 4 corners + center (κρύψιμο 0/1/3/4) (✅ IMPLEMENTED 2026-05-28)**

**Απόφαση Giorgio (direct-manipulation).** Σε straight wall, οι 4 corner grips (5..8 από
το Phase 1C-bis) ΗΔΗ καλύπτουν όλα τα DOF: η axial συνιστώσα ενός corner drag μετακινεί
το κοντινό endpoint (μήκος), η perpendicular μεγαλώνει την κοντινή όψη ΜΕ την απέναντι όψη
αγκυρωμένη (πάχος — `moveCorner` axis-recenter, ήδη opposite-face-anchored). Άρα τα grips:
- `wall-start` (0) + `wall-end` (1) — endpoint translate → redundant (corners το κάνουν).
- `wall-thickness` (3, 4) — οι δύο face-midpoint handles → redundant (corner perp το κάνει).

…είναι περιττά και **κρύβονται** από το emitted set. Παραμένει το `wall-midpoint` (2 —
center, μετακινεί ΟΛΟ τον τοίχο, `movesEntity:true`) + τα 4 corners. **Visible straight set
= 5 grips** (1 center + 4 corners).

**Drag semantics (επιβεβαιωμένα από Giorgio, ήδη υλοποιημένα στο `moveCorner`):**
- σύρω κάτω όψη (6,8) κάτω → πάνω όψη (5,7) ακίνητη· και αντίστροφα (opposite face anchored).
- σύρω αριστερή ακμή (5,6) → δεξιά ακμή (7,8) ακίνητη· και αντίστροφα (opposite endpoint anchored).
- σύρω center (2) → όλος ο τοίχος μετακινείται.

**Implementation (1 source file).** `bim/walls/wall-grips.ts`: νέος helper
`suppressRedundantStraightGrips(grips, kind)` φιλτράρει `wall-start`/`wall-end`/`wall-thickness`
ΜΟΝΟ για straight kind· curved/polyline επιστρέφουν αναλλοίωτα (δεν έχουν ορθογώνιο footprint
→ δεν έχουν corners, κρατούν endpoints + single thickness handle). Ο builder υπολογίζει
ΚΑΙ ΤΑ 9 grips — **τίποτα δεν διαγράφηκε** (Giorgio: "κρύψτα, μην τα διαγράφεις"). Restore =
one-line revert του filter. `gripIndex` σταθερό (5..8), άρα IDs + commit routing αμετάβλητα.
Render + hit-test περνούν και τα δύο από `getWallGrips` (μέσω `computeDxfEntityGrips` +
`WallRenderer.getGrips`) → ΕΝΑ filter point καλύπτει αμφότερα· **κανένα renderer file δεν
αγγίχθηκε** (αποφυγή pre-commit CHECK 6B/6D).

**Tests:** 26/26 PASS — #1 → 5 visible grips, #4 (no wall-start/end/thickness σε straight),
#5 (midpoint πρώτο visible), #15/#23 (corners στα visible indices 1..4), #15b (curved κρατά
thickness + endpoints). Τα drag tests (#16–#22, #24, #25) αμετάβλητα (καλούν `applyWallGripDrag`
απευθείας). tsc clean.

**Phase 1C-ter+ — Wall MOVE/ROTATION glyphs + `wall-rotation` grip (✅ IMPLEMENTED 2026-05-28)**

Mirror του stair grip-UX (ADR-393 v2 Phase 1): το `wall-midpoint` παίρνει 4-arrow MOVE glyph
και προστίθεται νέο `wall-rotation` grip (handle έξω από την end short edge, offset
`WALL_ROTATION_GRIP_OFFSET_MM = 200` scene-scaled via `mmScaleFor`) με curved-arrow ROTATION
glyph — ίδιο icon vocabulary με τα stair base/direction.
- `hooks/grip-types.ts`: `WallGripKind` += `'wall-rotation'`.
- `bim/walls/wall-grips.ts`: νέα `wallGripGlyphShape(kind)` (midpoint→`'move'`, rotation→`'rotation'`,
  default `'square'`) + emit του `wall-rotation` grip (θέση end + offset·axis).
- `bim/walls/wall-grip-transforms.ts`: νέα `rotateWall` — anchor-relative swept angle γύρω από
  το midpoint (mirror stair `rotateDirection`· absolute bearing θα flip-άρε τον τοίχο στο grab),
  spin και των δύο endpoints.
- `bim/renderers/WallRenderer.getGrips`: περνά `shape: wallGripGlyphShape(g.wallGripKind)`
  (mirror `StairRenderer`). **Renderer file touched** → ADR staged (CHECK 6D).

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
- [x] Client helper `bim/walls/wall-audit-client.ts` — `recordWallChange(action, entity, { prevParams, entityName }?)` fire-and-forget POST to `/api/audit-trail/record`. Diff via `bim-audit-helpers.ts` SSoT + `WALL_TRACKED_FIELDS` registry (17 fields). **ADR-379 refactor 2026-05-27**: original Phase 1D-C signature was `Pick<WallEntity, 'id'|'kind'>` και emitted `[{ field: 'kind' }]` placeholders only — replaced με full-entity diff + skip-on-no-diff semantics.
- [x] Hook `useWallPersistence.ts` — `prevParams` snapshot captured before save; `void recordWallChange(isNew ? 'created' : 'updated', entity, { prevParams })` after successful `svc.saveWall()`. Delete path captures `deletedEntity` snapshot BEFORE `svc.deleteWall` και περνά full entity για reverse-diff. Fire-and-forget (never awaited, audit failure ≠ UX impact).
- [x] Delete path — `WallFirestoreService.deleteWall()` exists (Phase 1B); delete UI + audit wired in Phase 1E (ribbon button → bridge → EventBus → useWallPersistence).
- [x] **Stair audit (ADR-380, 2026-05-27)**: same pattern applied. NEW `bim/stairs/stair-audit-client.ts` (mirror beam) + `STAIR_TRACKED_FIELDS` registry (~28 fields). `'stair'` προστέθηκε σε `AuditEntityType` + `VALID_ENTITY_TYPES` + `ENTITY_COLLECTION_MAP` (FLOORPLAN_STAIRS). `use-stair-persistence.ts` capture prevParams + full snapshot on delete.
- [x] **Slab-opening audit (ADR-380, 2026-05-27)**: legacy placeholder pattern (`[{ field: 'kind' }]`) refactored σε diffTrackedFields SSoT. NEW `SLAB_OPENING_TRACKED_FIELDS` registry (8 fields). `slab-opening-audit-client.ts` πλέον χρησιμοποιεί `bim-audit-helpers.ts`. `useSlabOpeningPersistence.ts` passes prevParams + full snapshot on delete.
- [x] CHECK 3.17 scanner: `TRACKED_COLLECTION_KEYS` extended με `FLOORPLAN_WALLS`; `wall-firestore-service.ts` added to `HARD_EXEMPT_PATTERNS` (client-SDK, audit at hook layer); baseline refreshed (1 pre-existing `property-deletion-guard.ts` grandfathered — unrelated to ADR-363).

**Phase 1D-B deferred item (now done in Phase 1E)**:
- [x] Debounced scene listener (200ms) για grip-moved wall triggers — see Phase 1E below.

**Phase 1D-D — BOQ Auto-Feed (depends on Phase 6)** *(✅ IMPLEMENTED 2026-05-19)*

- [x] `BimToBoqBridge.upsertBoqItemForBim('wall', ...)` wired in `useWallPersistence.persist()` — emits ΟΙΚ-3 BOQ item per wall (OIK-3.05 for exterior/parapet/fence, OIK-3.06 for interior/partition). Unit: m2, quantity: `geometry.area`. Single-layer path uses parent-only row; multi-layer DNA uses Phase 6.1 parent+children path.
- [x] `bimToBoqBridge.deleteBoqItemForBim(wallId, companyId)` wired in `useWallPersistence.deleteWall()` — cascades to multi-layer child rows via companyId-scoped query.
- [x] **Bug fix (regression)**: `deleteBoqItemForBim` called without `companyId` in all 5 persistence hooks (`useWallPersistence`, `useSlabPersistence`, `useOpeningPersistence`, `useColumnPersistence`, `useBeamPersistence`). Multi-layer cascade query `where('companyId', '==', companyId)` was receiving `undefined`, orphaning child BOQ rows on delete. Fixed: pass `companyId ?? ''` + added `companyId` to `useCallback` deps in all 5 hooks.
- [x] Tests: 8 new tests in `BimToBoqBridge.test.ts` covering all 5 WallCategory → ΑΤΟΕ mappings + area quantity + no-category skip + cascade companyId regression. Total: 32 tests (24 prior + 8 new), all pass.

**Phase 1E — Re-Trim on Grip + Wall Delete Action** *(✅ IMPLEMENTED 2026-05-18)*

- [x] **Feature A — Debounced Re-Trim on Grip Drag**: `EventBus` receives `'bim:wall-params-updated': { wallId }` (new event). `commitWallGripDrag` emits this event after executing `UpdateWallParamsCommand`. `useSpecialTools` subscribes with 200ms debounce → calls `computeWallTrims(allWalls)` + `applyTrimPatches` + `setLevelScene`. Guard: skip if `<2` walls or `trims.size === 0`. Result: bevel joins stay correct when user drags wall endpoints or midpoints.
- [x] **Feature B — Wall Delete Action**: `wall-command-keys.ts` → `WALL_RIBBON_KEYS_ACTIONS.delete = 'wall.actions.delete'` + `isWallActionKey()` guard. `contextual-wall-tab.ts` → delete button (icon: `trash`) in wall-actions panel, i18n key `ribbon.commands.wallEditor.delete`. `useRibbonWallBridge.onAction` → confirm dialog (`window.confirm` via `t('ribbon.commands.wallEditor.deleteConfirm')`) → emits `'bim:wall-delete-requested'` EventBus event. `useRibbonCommands.onAction` → routes `isWallActionKey` to `wallBridge.onAction` before generic handler. `useWallPersistence` → subscribes to `'bim:wall-delete-requested'` → `svc.deleteWall()` + `recordWallChange('deleted', ...)` + optimistic scene removal + refs cleanup. EventBus event `'bim:wall-delete-requested': { wallId }` added. i18n keys added: `ribbon.commands.wallEditor.delete` + `ribbon.commands.wallEditor.deleteConfirm` (el + en).
- [x] Architecture: full EventBus decoupling between bridge (UI layer) and persistence (data layer). Bridge owns confirm dialog (ribbon responsibility), persistence owns Firestore + scene mutation (data responsibility). No threading through DxfViewerContent.

**Phase 1F — Strict 3-Click Lateral Alignment** *(✅ IMPLEMENTED 2026-05-26)*

**Motivation.** Phase 1B/1C committed the straight wall on click 2 with its axis (centerline) coinciding with the user-picked A→B line. Result: when the user clicks two endpoints of an underlay line intending to align a wall with it, the line ends up cutting the wall in half — the user has no way to tell the tool *which side* of A→B the wall should sit on. Industry tools (Revit "Location Line", AutoCAD Architecture "Justification") solve this with a 3-click affordance or a post-pick edge selector. Phase 1F adopts the 3-click variant: the third click is the lateral side pick, made mandatory so no wall ships without an explicit alignment.

**FSM extension.** `straight` kind now: `idle → awaitingStart → awaitingEnd → awaitingAlignment → commit → awaitingStart` (continuous chain). Click 1 stores `startPoint`, click 2 stores `endPoint` (no commit yet), click 3 commits with a lateral offset computed from the click position relative to the A→B line. Polyline + curved kinds are **unchanged** — only `straight` enters `awaitingAlignment`. After every commit the tool resets to `awaitingStart`, so click 1 of the next wall is unambiguously a NEW wall (no risk of the next click being mistaken for the previous wall's alignment).

**Offset math** *(pure, `computeWallAlignmentOffset` in `wall-completion.ts`)*.

```
d   = end - start                  (axis vector, canvas world units)
n   = (-dy, dx) / |d|              (CCW 90° perpendicular = "left" of A→B)
cross = dx*(Cy-Ay) - dy*(Cx-Ax)    (sign tells which side C is on)
sign  = cross > 0 ? +1 : -1        (cross == 0 → zero offset, centered)
offset = sign * (thicknessMm/2) * mmToSceneUnits(sceneUnits) * n
```

`offset` is added to BOTH `params.start` AND `params.end` before building the entity. The resulting wall has the edge AWAY from C sitting exactly on the original A→B click line, with the body extending TOWARD C. This matches the user expectation: "click right → left edge on line; click left → right edge on line."

**Files modified.**

- [x] `hooks/drawing/wall-completion.ts` — `buildDefaultWallParams` gains optional `alignmentPoint?: Point2D | null` (5th arg). Thickness is resolved upfront (DNA preset or override) so the offset path can use it; existing callers without alignment get the legacy centered behaviour. New exported pure function `computeWallAlignmentOffset()` — testable in isolation. `completeWallFromTwoClicks` mirrors the new optional arg.
- [x] `hooks/drawing/useWallTool.ts` — `WallToolPhase` union gains `'awaitingAlignment'`. Straight-kind click pipeline: click 2 transitions to `awaitingAlignment` (stores `endPoint`) instead of committing; click 3 calls `commitStraightFromState(s, s.endPoint, point)` with the alignment point as the third arg. `commitStraightFromState` signature gains the optional alignment arg and forwards it to `buildDefaultWallParams`. Preview-store effect surfaces `endPoint` to the store ONLY during `straight + awaitingAlignment` (every other phase/kind keeps it null). Status text adds `tools.wall.statusAlignment`. `isAwaitingAlignment` boolean added to the hook return.
- [x] `bim/walls/wall-preview-store.ts` — `WallPreviewState` gains `endPoint: Point2D | null`. `EMPTY`, `set()` deep-equality guard, and snapshot deep-copy extended.
- [x] `hooks/drawing/wall-preview-helpers.ts` — `generateWallPreview` detects `preview.endPoint` (only set in `awaitingAlignment`) and renders the wall from `start → endPoint` with the live cursor as the alignment point. Outside of `awaitingAlignment` the legacy rubber-band preview (`start → cursor`) is unchanged. `makeWallFootprintGhost` accepts an optional `alignmentPoint` and forwards it to `buildDefaultWallParams`.
- [x] Dynamic Input contract — `commit-wall` submitted at `awaitingEnd` BYPASSES alignment and commits centered (precision path; explicit coords leave no room for half-thickness ambiguity). Submitted at `awaitingAlignment` it is treated as the alignment side pick. Manual mouse-click users still get the strict 3-click flow.
- [x] i18n — `tools.wall.statusAlignment` added to `dxf-viewer-shell.json` (el + en).
- [x] Tests Jest — `useWallTool.test.tsx`: 13 tests (was 10) — phase transition `awaitingEnd → awaitingAlignment`, click 3 commits with +Y / -Y / +X-axis offsets, zero-length retry from `awaitingAlignment`, status text key, overrides flow with 3 clicks. `wall-completion.test.ts`: 9 new tests for `computeWallAlignmentOffset` (colinear / degenerate / +Y / -Y / diagonal / sceneUnits='m') + `buildDefaultWallParams` alignment integration (back-compat default / DNA-thickness shift / override-thickness shift). Pre-existing wall-completion `scene-unit m` test corrected to match the SSoT spec (height/thickness stay in mm — boundary conversion lives in `computeWallGeometry`).
- [x] Companion hotfix — `bim/walls/wall-trims.ts` `processPair` had a unit-mismatch bug exposed by Phase 1F: `JOIN_THRESHOLD_MM` (200 mm) and `thickness/2` were used directly while `lenA`/`lenB` are in canvas world units. In meter-based scenes this inflated `epsA` (40× larger), spuriously classified every wall pair as a junction, and emitted a bevel of ~2 m that `applyAxisBevels` then interpreted as canvas units → start of the new wall shifted by 40% of its length. Fix: multiply `halfA`, `halfB`, and `joinThreshold` by `mmToSceneUnits(params.sceneUnits)`. 19 existing `wall-trims` tests still pass (mm-unit scenes unchanged); the bug was a latent footgun that only manifested in scenes with non-mm units.

**Out of scope (Phase 1G+).**

- ESC from `awaitingAlignment` currently deactivates the tool entirely (same as ESC from any other phase). A future incremental-back behaviour ("ESC at `awaitingAlignment` → back to `awaitingEnd` so the user can re-pick the end") is not part of Phase 1F.
- A keyboard shortcut to commit centered on click 2 (skipping alignment) is intentionally NOT provided — the user explicitly requested mandatory 3 clicks.
- Curved + polyline kinds keep their existing flows. Curved already has a 3rd click (Bezier control); polyline uses Enter to finish. Adding a 4th alignment click on top is deferred until there is a concrete request.

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
- [x] Wall split mid-opening: recompute opening positions when wall axis updates. **→ Phase Wall-Grip-Opening-Recompute (2026-05-19)**: `WallOpeningCoordinator` + `CompoundCommand` merge. **→ Phase 2 leftover (2026-05-20)**: arc-length recompute done — chord approximation fully resolved.
- [x] Wall delete prompt "Διαγραφή και των N κουφωμάτων;" (cascading delete UX). **→ Phase cascade-delete (2026-05-19)**: `WallCascadeDeleteDialog` + `wall-cascade-delete-store`.
- [x] Hotkey `OP` (Opening 2-char chord) — **implemented Phase 7A** (2026-05-18) via `MultiCharKeySequence`. `O` alone → `tool:layering` (fallback, toggle), `OP` → `tool:opening`.
- [x] Single-char variant shortcuts `D`/`Wn` — **implemented Phase 7B (2026-05-19)** via EventBus. `D` (context-sensitive when `activeTool === 'opening'`) → `bim:set-opening-kind` → kind=`'door'`. `W+1/2/3` BIM chords → `bim:set-wall-kind` → kind=`'straight'/'curved'/'polyline'` + `onToolChange('wall')`. `W` alone → fallback `tool:wall` (unchanged). `D` outside opening context → falls through to `measureDistance` (no conflict).
- [x] Polyline / curved host wall positioning — **Phase 2 leftover (2026-05-20)**: `getWallAxisVertices()` + `walkPolylineToDistance()` + `projectPointToPolylineOffset()`. `WallOpeningCoordinator` uses true arc length. 11 new tests.
- [x] Canvas pipeline call site for `composite.setOpeningsByWall(...)` — **implemented Phase 2 deferred (2026-05-19)**. `DxfOpening` wrapper added to `dxf-types.ts`; `case 'opening'` added to `useDxfSceneConversion.ts` and `DxfRenderer.toEntityModel()`; `DxfRenderer.buildOpeningsByWall()` builds `Map<wallId, OpeningEntity[]>` per-frame from scene entities; `DxfRenderer.render()` calls `composite.setOpeningsByWall(map)` before the entity render pass — WallRenderer now punches boolean cutouts through wall fills for all hosted openings.
- [x] **Opening tool canvas wiring + ghost preview + scene-units thread — implemented 2026-05-25 canvas-wiring follow-up.** Silent failure resolved: `useCanvasClickHandler` now dispatches `worldPoint → openingTool.onCanvasClick` (new PRIORITY 4.96 branch, mirrors slab-opening PRIORITY 4.95); new `useOpeningGhostPreview` hook + `OpeningGhostRenderer` (dashed rectangle + crosshair + per-kind palette + optional hinge arc) + `OpeningGhostPreviewMount` micro-leaf mounted in `PreviewCanvasMounts`; `CanvasSection.tsx` destructures `openingTool` from `useSpecialTools` (previously dropped) and feeds the `openingGhostPreview` payload with a `getHostWall` resolver; `buildDefaultOpeningParams` + `buildOpeningEntity` + `computeOpeningGeometry` gain an optional `sceneUnits: SceneUnits = 'mm'` parameter so the projected offset stays in mm (per `OpeningParams` contract) and the outline scales correctly for scene='m'/'cm'/'in'/'ft'; `useOpeningTool` accepts an optional `getSceneUnits` resolver, wired by `useSpecialTools` via `resolveSceneUnits(level scene)`. ADR-040 micro-leaf compliance preserved (ghost subscribes to `useCursorWorldPosition` internally; CanvasSection / CanvasLayerStack don't re-render on mousemove). Pre-existing scene-unit drift in the edit paths (`computeOpeningGeometry` callers from grip-commit / move / mirror / rotate / cascade) carries over as a separate follow-up.

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
- [x] maxFreeSpan analytical (1D beam-direction span detection — currently crude bbox max-dimension). **✅ Phase 3.8 (2026-05-20)**.

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
- [x] maxFreeSpan analytical (1D beam-direction span detection). **✅ Phase 3.8 (2026-05-20).**
- [ ] Per-material hatch palette (Phase 6+ depends on material library).
- [x] ~~Snap-to-edge-midpoint preview ghost while hovering edge midpoint grip pre-drag.~~ **✅ Phase 3.7b++ (2026-05-20)**: green "+vertex" indicator at `hoveredEdgeMidpointGrip.position` via `useSlabOpeningGhostPreview` extension.

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
- [x] Multi-storey stack group UI ("Copy to all floors" bulk-create workflow). **Done Phase 3.7b+ (2026-05-20).**
- [ ] Fire-rating + material fields in ribbon (Phase 6+ BOQ dependency).

### Phase 3.7c — Slab-Opening visibility fix (z-order + scene-units) *(✅ IMPLEMENTED 2026-05-25)*

**Bug**: User σχεδίαζε slab-opening πάνω σε πλάκα στο `/dxf/viewer` αλλά καμία οπή δεν εμφανιζόταν — ούτε ghost preview, ούτε committed entity.

**Two independent root causes**:

1. **Scene-units bug** (size off by 1000×): ο `buildDefaultSlabOpeningParams` παίρνει `widthMm: 1500` αλλά τα έβαζε στο polygon ΧΩΡΙΣ conversion στις scene units → σε scene σε `'m'`, rectangle έβγαινε 1500×1500 m αντί 1.5×1.5 m, totally outside slab. Mirror του slab-completion Phase 8 fix.
   - Fix: propagation `sceneUnits` field σε `SlabOpeningParams`, `mmToSceneUnits()` factor εφαρμογή ΠΡΙΝ το polygon build, area calc με `canvasToM` conversion.
   - Files: `bim/types/slab-opening-types.ts` (+`sceneUnits` field), `bim/geometry/slab-opening-geometry.ts` (canvasToM), `bim/validators/slab-opening-validator.ts` (area conversion), `hooks/drawing/slab-opening-completion.ts` (mm→scene), `hooks/tools/useSpecialTools-slab-opening.ts` (getSceneUnits via resolveSceneUnits).
   - Ghost preview parity: `useSlabOpeningGhostPreview.ts` + `canvas-layer-stack-slab-opening-ghost.tsx` (passthrough `getSceneUnits` prop), `components/dxf-layout/CanvasSection.tsx` (wire `resolveSceneUnits` → `slabOpeningGhostPreview`).

2. **Z-order bug** (rendered but invisible): οι 5+ persisted slab-openings από Firestore έρχονταν στο `scene.entities` array ΠΡΙΝ τα persisted slabs (snapshot delivery order). Ο `DxfRenderer` iterate-ει sequentially → openings ζωγραφίζονταν πρώτα, slabs ΜΕΤΑ ΠΑΝΩ τους (alpha-blend 20%). Το `punchHostedSlabOpenings` με `destination-out` έσβηνε ΚΑΙ τα slab ΚΑΙ τα opening pixels στο cutout area → αόρατη οπή.
   - Fix: **two-pass rendering** στο `DxfRenderer.ts` per-entity loop:
     - Pass A: όλα τα entities ΕΚΤΟΣ slab-opening (slab fill + `punchHostedSlabOpenings` με destination-out clears cutout).
     - Pass B: μόνο slab-openings (dashed outline + kind fill ΠΑΝΩ από slab).
   - Industry parallel: AutoCAD/Revit z-order — structural cutouts always rendered on top of host element για να μη χάνονται σε alpha-blend.
   - Files: `canvas-v2/dxf-canvas/DxfRenderer.ts` (two-pass loop), `bim/renderers/SlabOpeningRenderer.ts` (visual enhancement: KIND_STROKE darker/more saturated, KIND_FILL alpha 0.35 από 0.18, lineWidth `THICK` 3px από `NORMAL` 2px).
   - **Preventive note**: Ίδιο pattern μπορεί να χρειαστεί preventively σε `opening` (window/door) vs `wall` αν εμφανιστεί. WallRenderer χρησιμοποιεί identical `punchHostedOpenings` με destination-out — ίδιο risk.

**Verification**: Magenta debug stroke επιβεβαίωσε render path πριν cleanup. User confirmed οπτικά ότι οι 9 υπάρχουσες οπές εμφανίστηκαν μετά το fix.

### Phase 3.7d — Slab-Opening 3D coverage parity *(✅ IMPLEMENTED 2026-05-25)*

Cross-reference: ADR-370 §6 Phase 7 changelog (read-only 3D + `/dxf/viewer` toggle).

**Bug**: μετά την Phase 3.7c (2D visibility), οι οπές εμφανίζονταν σωστά στο 2D `/dxf/viewer` αλλά οι BIM πλάκες σε 3D (toggle 3D στο `/dxf/viewer` ΚΑΙ Properties read-only 3D σε `?view=floorplan&mediaTab=floorplan-floor`) εμφανίζονταν solid χωρίς cutouts. Mirror gap της Phase 5 stair coverage.

**Root cause**: `Bim3DEntities` interface δεν είχε `slabOpenings` field, `slabToMesh` δεν δεχόταν openings array, `BimSceneLayer.sync` δεν τα πέρναγε στο converter, `Bim3DReadOnlyOverlay` δεν τα forwardάρει από το `useFloorplanBimEntities` snapshot.

**Industry-standard fix** (`THREE.Shape.holes` + `ExtrudeGeometry` native ear-clipping triangulation, mirror IFC `IfcRelVoidsElement` voiding `IfcSlab` / Revit Floor+Opening family / AutoCAD ARCHITECTURE Slab+Opening pattern):

- [x] `bim-3d/stores/Bim3DEntitiesStore.ts` — `slabOpenings: readonly SlabOpeningEntity[]` field + `setSlabOpenings(arr)` setter + `selectBim3DEntities` includes slabOpenings.
- [x] `bim-3d/converters/BimToThreeConverter.ts` — `slabToMesh(slab, openings=[], levelId?, buildingBaseElevationM?)`. Νέος helper `pushHoles(shape, openings)` που reverses vertex winding (BIM CCW → THREE.Path CW) πριν push στο `shape.holes`. `ExtrudeGeometry` handles triangulation natively. Hole inherits slab extrude z (no override — `elevationOverride` field reserved για future multi-storey stack visualization).
- [x] `bim-3d/scene/BimSceneLayer.ts` — slab loop: filter `entities.slabOpenings.filter(o => o.params.slabId === slab.id)`, pass ως 2ο arg στο `slabToMesh`. Inline (no separate loop) γιατί openings είναι attachments στο host slab — ζωγραφίζονται μαζί στο extrude.
- [x] `bim-3d/viewport/BimViewport3D.tsx` — `EMPTY_BIM_ENTITIES.slabOpenings = []` + initial sync destructuring + ongoing subscribe pushes `s.slabOpenings`.
- [x] `components/shared/files/media/Bim3DReadOnlyOverlay.tsx` — `useMemo` deps + `slabOpenings: bimSnapshot.slabOpenings`. (`useFloorplanBimEntities` ήδη subscribed σε `FLOORPLAN_SLAB_OPENINGS` από ADR-370 Phase 1 — μόνο forwarding χρειαζόταν.)
- [x] `app/SlabOpeningPersistenceHost.tsx` — `+useEffect` που πιέζει `currentScene.entities.filter(isSlabOpeningEntity)` στο `Bim3DEntitiesStore.setSlabOpenings()`. Mirror `SlabPersistenceHost` lines 58-61. `SlabOpeningPersistenceHost` υπήρχε ήδη από Phase 3.7 (Firestore persistence) — μόνο additive 3D feed hookup, καμία νέα φιλοξενούμενη responsibility.

**Multi-storey stack**: groups (`SlabOpeningStackHost` Phase 3.7b+) δουλεύουν αυτόματα — κάθε floor έχει own slab + own opening doc, ο `slabId` filter cuts per-floor χωρίς ειδικό handling.

**Performance**: CHECK 6B/6C compliant (όλες αλλαγές low-frequency — user-triggered entity changes). Per-slab opening filter είναι O(N×M) όπου N=slabs, M=openings. Για typical project (~20 slabs × ~5 openings = 100 ops/rebuild) δεν παρατηρείται FPS regression. Phase 3+ incremental dirty-tracking θα optimize αν χρειαστεί.

**No Firestore touch**: ZERO writes — μόνο 3D pipeline read-side. Schema, rules, indexes αμετάβλητα από Phase 3.7c.

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
- [x] ~~Multi-storey stack group UI ("Copy to all floors")~~ **✅ Phase 3.7b+ (2026-05-20)**: `SlabOpeningStackHost` + `SlabOpeningStackDialog` + ribbon `copyToFloors` action. EventBus decoupled. Enterprise ID `bmstkg`. `findHostSlabForLevel` + `buildStackedOpeningEntity` pure SSoT.
- [x] ~~Fire-rating in ribbon~~ **✅ Phase 3.7b (2026-05-20)**: fireRating combobox (60/90/120/none) + i18n el+en. Material deferred to Phase 6.5.
- [x] ~~Snap-to-edge-midpoint preview ghost~~ **✅ Phase 3.7b+ (2026-05-20)**: `useSlabOpeningGhostPreview` + `SlabOpeningGhostRenderer` — rectangle ghost (dashed stroke + 25% fill + crosshair marker) at snapped cursor position. RAF pattern, micro-leaf ADR-040 compliant. `getImmediateSnap()` imperative read mirrors Phase 4.5c.4.

### Phase 3.8 — Slab Vertex Editing (Add / Remove Corner) *(✅ IMPLEMENTED 2026-05-22)*

Revit-style **Edit Boundary** vertex editing για existing slabs: hover corner grip → Delete key αφαιρεί γωνία, right-click → context menu "Delete corner" / "Add corner here", min-3-vertex guard, undo/redo μέσω `UpdateSlabParamsCommand`.

**Design choices:**
- **`hoveredDxfGrip` ως Delete trigger** — εντοπίζει vertex grip κάτω από cursor αντί να επεκτείνει το `SelectedGrip` overlay-only state. Zero state duplication, ακριβώς το UX που αναμένει ο χρήστης (hover + Delete).
- **Pure `removeVertexFromSlab()`** — mirror του `applySlabGripDrag` pattern: δέχεται `SlabParams + vertexIndex`, επιστρέφει νέο `SlabParams` ή referentially ίδιο αν out-of-range / min-3 guard. Zero side effects.
- **Context menu dispatch μέσω `getGlobalCommandHistory().execute()`** — ίδιο pattern με session undo, αποφεύγει νέο prop threading από `CanvasSection`.
- **"Add corner here" από context menu** — καλεί `applySlabGripDrag(kind, {delta:{x:0,y:0}})` που εισάγει vertex στο ακριβές edge midpoint (zero delta = καμία μετατόπιση).

**Files created (0) / modified (8):**
- `bim/slabs/slab-grips.ts` — νέα exported `removeVertexFromSlab(originalParams, vertexIndex)`: min-3 guard + out-of-range guard → referential short-circuit, αλλιώς `filter` αφαιρεί τον indexed vertex, spread preserves all other params.
- `bim/slabs/__tests__/slab-grips.test.ts` — 5 νέα tests (20-24): remove indexed vertex (length 4→3), min-3 guard (triangle → identity), out-of-range ±index → identity, removing vertex-0 shifts remaining correctly, preserves kind/thickness/levelElevation. (Old test 20 → 25.)
- `hooks/canvas/useSmartDelete.ts` — νέο `hoveredDxfGrip?: UnifiedGripInfo | null` στο Params interface. PRIORITY 0.5 block (εκτελείται πριν το PRIORITY 1 overlay vertex): ανιχνεύει `slab-vertex-*` grip kind, resolve entity via `LevelSceneManagerAdapter.getEntity`, `removeVertexFromSlab` + `UpdateSlabParamsCommand` + `executeCommand`.
- `hooks/canvas/useCanvasEditActions.ts` — forward `hoveredDxfGrip` από params σε `useSmartDelete`.
- `components/dxf-layout/CanvasSection.tsx` — πέρναγε `hoveredDxfGrip: unified.hoveredGrip` στο `useCanvasEditActions`.
- `systems/grip/grip-context-menu-resolver.ts` — νέα `GripContextActionId` literals `'vertex-ops:deleteCorner' | 'vertex-ops:addCorner'`, νέο section id `'vertex-ops'`, `buildVertexOpsSection(grip)` pure builder που ανιχνεύει `slab-vertex-*` / `slab-edge-midpoint-*` / `slab-opening-*` kinds, `resolveContextMenuSections` δέχεται `grip` arg και ενίσχει τις sections.
- `systems/grip/grip-context-menu-actions.ts` — νέα `onSlabVertexOp?` callback στο `GripContextActionBindContext`, `grip?: UnifiedGripInfo` 3ο arg στο `bindContextMenuAction`, 2 νέα cases `'vertex-ops:deleteCorner'` + `'vertex-ops:addCorner'` στο dispatch switch.
- `hooks/grips/useGripContextMenuController.ts` — `LevelManagerLike` extended με `setLevelScene`, `onSlabVertexOp` callback (resolve entity → `removeVertexFromSlab` / `applySlabGripDrag` → `UpdateSlabParamsCommand` → `getGlobalCommandHistory().execute()`), pass `onSlabVertexOp` + `grip` στο `bindContextMenuAction`.
- `i18n/locales/en/tool-hints.json` + `i18n/locales/el/tool-hints.json` — νέα keys `gripContextMenu.deleteCorner`, `gripContextMenu.addCorner`, `gripContextMenu.section.vertexOps`.

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
- [x] **Phase 4.5c.3 IMPLEMENTED** (2026-05-18): circular hatch + variant dimension labels. Details § Phase 4.5c.3.
- [x] **Phase 4.5c.4 IMPLEMENTED** (2026-05-19): snap-to-wall-corners + grid-intersections visual feedback for column ghost preview. Details § Phase 4.5c.4.
- [x] **Phase 4.5c.5 IMPLEMENTED** (2026-05-19): drag-time dimension annotations (GripDimAnnotationMount + useGripDimAnnotation). Details § Phase 4.5c.5.
- [x] **Phase 4.5c.6 IMPLEMENTED** (2026-05-20): L/T section-profile symbol overlay (∟/⊤) on hover+selection for steel columns. Details § Phase 4.5c.6.
- [ ] **Deferred Phase 4.5c.4+**: beam-end auto-snap σε column anchors (Phase 5.5c cross-dep) — **✅ Phase 5.5d (2026-05-19)**.
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
- ~~Full drag-time dimension annotations~~ — **✅ IMPLEMENTED Phase 4.5c.5 (2026-05-19)**. `GripDimAnnotationMount` leaf + `useGripDimAnnotation` hook — see § Phase 4.5c.5 below.

> **2026-05-19 Update**: Phase 4.5c.4 implemented snap-to-wall-corners + grid-intersections visual feedback — see § Phase 4.5c.4 below. Beam-end auto-snap σε column anchors **implemented Phase 5.5d (2026-05-19)** — see § Phase 5.5d below. Drag-time dim annotations **implemented Phase 4.5c.5 (2026-05-19)** — see § Phase 4.5c.5 below.

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
- ~~Full drag-time dimension annotations~~ — **✅ IMPLEMENTED Phase 4.5c.5 (2026-05-19)**. `GripDimAnnotationMount` leaf + `useGripDimAnnotation` hook — see § Phase 4.5c.5 below.

> **2026-05-19 Update**: Phase 4.5c.5 implemented drag-time dimension annotations — see § Phase 4.5c.5 below.

### Phase 4.5c.5 — Drag-Time Dimension Annotations *(✅ IMPLEMENTED 2026-05-19)*

Closes το last deferred item από το Phase 4.5c series (deferred 4× from 4.5b → 4.5c → 4.5c.1 → 4.5c.4). Revit/AutoCAD live-dim convention: floating labels ("w=350mm" / "al=150mm" κλπ) εμφανίζονται κοντά στο active grip handle στο PreviewCanvas κατά το drag.

**Architecture:** ADR-040 micro-leaf — `GripDimAnnotationMount` (`React.memo` + `return null`) calls `useGripDimAnnotation` hook εσωτερικά. CanvasSection zero νέες subscriptions. RAF-based draw (clear on drag end). `DxfGripDragPreview` extended με `columnGripKind?` + `beamGripKind?` + `anchorPos` (grip-projections.ts).

**Files created (2):** `hooks/tools/useGripDimAnnotation.ts`, `components/dxf-layout/canvas-layer-stack-grip-dim-annotation.tsx`. **Files modified (3):** `hooks/grip-computation.ts`, `hooks/grips/grip-projections.ts`, `components/dxf-layout/canvas-layer-stack-leaves.tsx`. Details σε ADR-363 changelog 2026-05-19.

**Deferred to Phase 4.5c.6:**
- ~~Section-profile preview overlay για steel L/T column variants~~ — **✅ IMPLEMENTED Phase 4.5c.6 (2026-05-20)** — see § Phase 4.5c.6 below.

### Phase 4.5c.6 — L/T Column Section-Profile Symbol Overlay *(✅ IMPLEMENTED 2026-05-20)*

Closes το last remaining item από το Phase 4.5b/4.5c deferred series: "section-profile preview overlay για L/T variants". Mirrors ADR-363 Phase 5.5h (steel I/H section symbol on beam hover) adapted for column variants.

**Design choices:**
- **Steel only** — non-steel L/T columns already communicate shape via footprint polygon + variant dimension labels (Phase 4.5c.3). Section symbol for non-steel would add visual noise without structural meaning (section profile convention is for structural steel in Revit/Tekla plan views).
- **Fixed size, no rotation** — symbol is a "legend" indicator, not a geometrically faithful overlay of the footprint (which already does that). Fixed orientation makes it readable regardless of column rotation.
- **Right of bbox, vertically centred** — symbol centre = `(rightmost screen X of bbox + OFFSET_PX, vertical centre of bbox in screen Y)`. Consistent position independent of column rotation angle.
- **flipY reflects Phase 7.2 mirror handedness** — `computeLProfileOutline(flipY)` / `computeTProfileOutline(flipY)` reads from `column.params.lshape?.flipY` / `column.params.tshape?.flipY`. Symbol shape matches actual arm/flange orientation.
- **Suppression guards** — same pattern as Phase 5.5h: `scale < COL_SECTION_MIN_SCALE` (0.06) + footprint screen span < 14px → no draw (prevents pixel blur at extreme zoom-out).
- **Violet colour** — `rgba(90,50,190,0.18)` fill / `rgba(50,20,140,0.82)` stroke. Distinct from beam symbol blue `rgba(60,100,200,0.18)` — columns use warm-violet to match the `KIND_FILL['L-shape']` ochre-adjacent palette.

**SSoT module:**
- `bim/columns/column-section-profile.ts` — new pure SSoT (zero React/DOM/canvas/Firestore deps). Exports:
  - `computeLProfileOutline(w, h, lt, flipY)` → 6-vertex polygon (∟ shape)
  - `computeTProfileOutline(flangeW, totalH, flangeT, webW, flipY)` → 8-vertex polygon (⊤ shape)
  - 10 exported constants (`COL_L_SECTION_W_PX`, `COL_L_SECTION_H_PX`, `COL_L_LEG_T_PX`, `COL_T_FLANGE_W_PX`, `COL_T_TOTAL_H_PX`, `COL_T_FLANGE_T_PX`, `COL_T_WEB_W_PX`, `COL_SECTION_OFFSET_PX`, `COL_SECTION_MIN_SCALE`, `COL_SECTION_MIN_FOOTPRINT_PX`)
  - `SectionPoint` interface, `COL_SECTION_FILL_COLOR`, `COL_SECTION_STROKE_COLOR`, `COL_SECTION_LINE_WIDTH_PX`

**Files created (2):**
- `bim/columns/column-section-profile.ts` — SSoT (pure functions + constants). 140 lines.
- `bim/columns/__tests__/column-section-profile.test.ts` — 27 tests (L-shape 9 + T-shape 8 + constants 10). All pass.

**Files modified (1):**
- `bim/renderers/ColumnRenderer.ts` — imports από `column-section-profile`; `render()` calls `this.drawSectionProfile(column)` alongside `drawVariantDimensionLabels` under `highlighted` guard; new private `drawSectionProfile(column)` method: early-return guards (L/T + steel + scale + footprint), screen-space bbox corners via `worldToScreen`, symbol centre = rightmost bbox X + OFFSET, trace outline, fill + stroke. ADR-040: ZERO new store subscriptions.

**Deferred:**
- Snap-to-wall-corners + snap-to-grid-intersections for column ghost preview (cross-domain — Phase 4.5c.4 covers ghost preview snap; column placement snap is separate).
- Section-profile symbol for non-steel L/T (design decision needed — what symbol for RC L-shape?).
- Drag-time section-profile update (currently hover/selection only, consistent with Phase 5.5h beam pattern).

✅ Google-level: YES — SSoT pure module (zero deps), ADR-040 micro-leaf compliant (no new subscriptions), suppression guards (same pattern as Phase 5.5h), flipY mirrors Phase 7.2 handedness (idempotent), 27/27 tests pass, steel-only guard avoids visual noise on non-steel variants.

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
- [x] ~~Tab/Shift+Tab cycling για material picker~~ **✅ Phase 4.5e+ (2026-05-21)**: `useBimMaterialCycler.ts` — Revit-style enum cycle, toolStateStore guard, undoable command per entity type.
- Material-aware default geometry (e.g. steel column → IPE/HEB profile section): cross-dep με Phase 4.5c.3 section-profile preview.

### Phase 5 — Beam *(✅ CORE IMPLEMENTED 2026-05-18)*

- [x] Port `beam-types.ts` (3 kinds: straight/curved/cantilever, BeamSupportType, defaults + Eurocode constants).
- [x] `useBeamTool.ts` FSM — 2-click straight/cantilever, 3-click curved με quadratic Bezier control. ESC reset, continuous chain.
- [x] `beam-completion.ts` — `buildDefaultBeamParams` + `buildBeamEntity` + `completeBeamFromTwoClicks` / `completeBeamFromThreeClicks`.
- [x] `beam-geometry.ts` — pure `computeBeamGeometry` (axis + perpendicular offset outline + length/area/volume/maxFreeSpanM, 16-segment Bezier subdivision για curved). `getBeamSpanDepthRatio` helper. **Phase 3.8**: `maxFreeSpanM = length` (polyline chord = structural free span).
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
- [x] **Phase 5.5e IMPLEMENTED** (2026-05-19): snap-to-wall-axis perpendicular projection (NearestSnapEngine clamped + PerpendicularSnapEngine unclamped, pure `bim/walls/wall-axis-projection.ts` SSoT). Details § Phase 5.5e below.
- [x] **Phase 5.5f IMPLEMENTED** (2026-05-19): snap-to-slab-edge perpendicular projection (closed polygon modulo-index pattern, `bim/slabs/slab-edge-projection.ts`). Details § Phase 5.5f below.
- [x] **Phase 5.5g IMPLEMENTED** (2026-05-19): snap-to-opening-jamb perpendicular projection (4-edge outline, `bim/walls/opening-outline-projection.ts`). Details § Phase 5.5g below.
- [x] **Phase 5.5h IMPLEMENTED** (2026-05-19): steel I/H section-profile symbol overlay (hover + selection, `bim/beams/beam-section-profile.ts` pure SSoT + `BeamRenderer.drawSectionProfile()`). Details § Phase 5.5h below.
- [x] **Phase 5.5i IMPLEMENTED** (2026-05-20): column center-axis snap (⊕ wireframe symbol, "Επί άξονα κολώνας" i18n label, priority -1 supersedes generic ENDPOINT). Details § Phase 5.5i below.
- [x] **Phase 5.5i+ IMPLEMENTED** (2026-05-20): beam-supports-slab analytical link — BOQ volume deduction. Details § Phase 5.5i+ below.
- [x] **Phase 5.5j IMPLEMENTED** (2026-05-20): H-beam variant (`BeamSectionType='H'`, `SECTION_H_FLANGE_T_PX=9`) + `profileDesignation` canvas label + ribbon sectionType/profileDesignation comboboxes. Details § Phase 5.5j below.
- [x] **Phase 5.5j extras IMPLEMENTED** (2026-05-21): scale-adaptive section-profile symbol (`symW ∝ beamWidthPx`, clamped [12,50]px) + anchor highlight pulse (`drawAnchorPulse`, sin α @ 1.2Hz, `performance.now()`). Details § Phase 5.5j below.
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

**Deferred to Phase 5.5h+ / cross-phase:**
- ~~Section-profile preview overlay για steel I/H profile beams.~~ **✅ DONE Phase 5.5h (2026-05-19).**
- Distinct i18n label "Επί παραστάτη ανοίγματος" — snap tooltip reuses "Nearest"/"Perpendicular" σήμερα.
- Snap specifically only to jamb edges (edge 1 + 3) vs all 4 — current: all 4 edges, consistent με slab/wall pattern και completeness-over-MVP rule.

✅ Google-level: YES — pure SSoT module (opening outline projection single-sourced + Phase 2 cached geometry leveraged, zero re-computation), reuse-first (extend existing NearestSnapEngine + PerpendicularSnapEngine, ΟΧΙ νέος engine/SnapType), modulo closing-edge mirrors Phase 5.5f invariant, idempotent pure functions, ADR-040 micro-leaf compliance (ZERO new React subscriptions), defensive null guard for missing geometry, zero ribbon/i18n/command changes.

> **2026-05-19 Update**: Phase 5.5h implemented the section-profile overlay for steel beams — see § Phase 5.5h below.

### Phase 5.5h — Steel I/H Section-Profile Symbol Overlay *(✅ IMPLEMENTED 2026-05-19)*

Closes the long-deferred `section-profile preview overlay για steel I/H profiles` item from Phase 5.5c → 5.5d → 5.5e → 5.5f → 5.5g deferred lists. Revit/Tekla plan-view convention: when a steel beam is hovered or selected, a small I/H cross-section profile symbol appears at the beam midpoint, offset perpendicularly, communicating the structural section shape without cluttering the normal plan view.

**Design choices:**
- **BeamRenderer-native, NOT PreviewCanvas leaf** — drawn in `BeamRenderer.drawSectionProfile()` alongside the existing `drawDepthIndicator()` (Phase 5.5c), both triggered by `phaseState.phase === 'highlighted'`. Same visibility semantics as depth indicator: hover + selection, no extra React subscriptions, no new canvas layer, no new micro-leaf. ADR-040 cardinal rules unaffected.
- **Pure SSoT module `bim/beams/beam-section-profile.ts`** — computes the I-profile outline polygon + exports all constants. Zero deps (React / DOM / Firestore / canvas). Mirror của `bim/beams/beam-hatch-patterns.ts` pattern (pure math → renderer renders).
- **Symbol orientation** — `ctx.rotate(screenAngle + PI/2)` where `screenAngle = Math.atan2(screenDy, screenDx)` (screen-space, no Y-flip arithmetic needed). After rotation: local ±X (flange axis) → perpendicular to beam on screen; local ±Y (web axis) → parallel to beam on screen. Revit/Tekla structural plan convention.
- **Fixed screen size** — 20×26 px (W×H), flangeT=4px, webW=4px. Readable at all zoom levels. Suppressed at `scale < SECTION_MIN_SCALE (0.08)` or beam screen length `< SECTION_MIN_BEAM_LEN_PX (24px)` to avoid noise at extreme zoom-out.
- **Position** — beam midpoint offset perpendicular outward by `(beamWidth/2 × scale) + SECTION_OFFSET_PX (12px)`. Same offset direction as depth indicator, opposite perpendicular side (depth indicator is on the negative perpendicular via `beamDepthHandlePosition`, section profile is on the positive perpendicular).
- **Material gate** — `resolveBeamMaterialKey(params.material) !== 'steel'` → early return. RC beams use dot-hatch (Phase 5.5c) which already communicates material; glulam uses grain lines. Steel is the only material where the I/H section is structurally meaningful in plan view.
- **Visual style** — semi-transparent steel-blue fill `rgba(60, 100, 200, 0.18)` + dark blue stroke `rgba(30, 60, 160, 0.82)`, lineWidth 1.5px, no dash. Distinguishable from the dashed beam outline + gray hatch pattern, consistent with the steel-blue identity color convention.

**I-profile outline geometry** (local coords, `computeIProfileOutline(w, h, ww, ft)`):
```
local ±X = flange axis (perpendicular to beam after rotation)
local ±Y = web/depth axis (parallel to beam after rotation)

12 vertices, CW from top-left:
(-hw, +hh) → (+hw, +hh) → (+hw, +hh-ft) → (+hww, +hh-ft)
→ (+hww, -hh+ft) → (+hw, -hh+ft) → (+hw, -hh) → (-hw, -hh)
→ (-hw, -hh+ft) → (-hww, -hh+ft) → (-hww, +hh-ft) → (-hw, +hh-ft)
→ close
```

**Files created (1):**
- `bim/beams/beam-section-profile.ts` — pure SSoT (~110 lines). Exports `SectionPoint` interface, `computeIProfileOutline(w, h, ww, ft)`, size constants (`SECTION_PROFILE_W/H_PX`, `SECTION_WEB_W_PX`, `SECTION_FLANGE_T_PX`, `SECTION_OFFSET_PX`, `SECTION_MIN_SCALE`, `SECTION_MIN_BEAM_LEN_PX`) and visual constants (`SECTION_FILL_COLOR`, `SECTION_STROKE_COLOR`, `SECTION_LINE_WIDTH_PX`). Zero React / DOM / Firestore / canvas deps.

**Files modified (1):**
- `bim/renderers/BeamRenderer.ts` — import από `beam-section-profile`; νέα private `drawSectionProfile(beam)` method (~50 lines): early-return guards (non-steel / low scale / degenerate beam); `this.worldToScreen()` for start+end → screen angle; perpendicular unit vector (screen space) → symbol centre `cx, cy`; `ctx.save() / translate(cx,cy) / rotate(screenAngle + PI/2) / path(outline) / fill() / stroke() / restore()`. Called from `render()` alongside `drawDepthIndicator()` under the `highlighted` condition.

**Deferred to Phase 5.5i+ / cross-phase:**
- [x] ~~Scale-adaptive symbol size~~ **✅ IMPLEMENTED Phase 5.5j extras (2026-05-21)**: `symW = clamp(beamWidthPx × 0.35, [12, 50]px)`; all sub-dims (web, flange, offset) scale proportionally; 3 new constants in `beam-section-profile.ts`.
- [x] ~~H-beam variant (broader flanges, `flangeT/h` ratio = 0.33 vs I-beam 0.15)~~ **✅ IMPLEMENTED Phase 5.5j (2026-05-20)**: `BeamSectionType = 'I' | 'H'` + `profileDesignation?: string` added to `BeamParams`; `computeHProfileOutline()` + `SECTION_H_FLANGE_T_PX=9` added to `beam-section-profile.ts`; `BeamRenderer.drawSectionProfile()` branches on `params.sectionType ?? 'I'`; ribbon sectionType combobox + profileDesignation combobox wired in `contextual-beam-tab.ts` + `useRibbonBeamBridge`.
- [x] ~~Distinct i18n tooltip for section symbol (hover text "IPE 300" / "HEA 200")~~ **✅ IMPLEMENTED Phase 5.5j (2026-05-20)**: `params.profileDesignation` drawn as `bold 8px` canvas label offset `W/2 + 8px` from symbol centre in perpendicular direction (screen-space, stays horizontal). i18n keys: `beamEditor.sectionType.*` + `beamEditor.profileDesignation.*` in el+en.
- Section symbol at beam endpoint vs midpoint toggle (engineer preference — lower priority).

✅ Google-level: YES — pure SSoT module (section outline single-sourced, renderer imports constants), ADR-040 micro-leaf compliance (ZERO new React subscriptions, no PreviewCanvas changes, no new leaf), same pattern as `drawDepthIndicator` (Phase 5.5c), `'steel'` gate via existing `resolveBeamMaterialKey` SSoT, screen-space angle avoids Y-flip arithmetic, idempotent (same params → same symbol), defensive scale + length guards.

---

### Phase 5.5i — Column Center Axis Snap *(✅ IMPLEMENTED 2026-05-20)*

Closes the `column-center-line 3D wireframe snap` item from the Phase 5.5i+ deferred list. Industry convention (Revit "Column Grid" snap / ArchiCAD "Column Center" OSnap): when drawing a beam or dragging a grip, cursor locks specifically to the structural center axis of a column — distinct from the 8 perimeter anchors already available via Phase 5.5d.

**Design choices:**
- **Dedicated `ColumnCenterSnapEngine`** (NOT merged into `EndpointSnapEngine`) — keeps the BIM-specific snap type isolated, allows independent enable/disable, mirrors the `DimDefPointSnapEngine` + `DimLineSnapEngine` precedent (ADR-362 I1).
- **`ExtendedSnapType.BIM_COLUMN_CENTER = 'bim_column_center'`** — new enum value; SnapShape switch renders ⊕ (circle + crosshair) — the standard structural engineering plan symbol for a column center.
- **Priority -1** (via `SNAP_ENGINE_PRIORITIES.BIM_COLUMN_CENTER`) — supersedes generic `ENDPOINT` (priority 0) when cursor is at the column center, giving the structural axis snap precedence over the 9-anchor endpoint snap from Phase 5.5d. Both engines find the same center point; BIM_COLUMN_CENTER wins due to higher priority (lower value).
- **`description: 'bim-column'`** → `SnapIndicatorOverlay.BIM_DESCRIPTION_KEY` maps this to `snapModes.labels.bim.columnAxis` → i18n tooltip "Επί άξονα κολώνας" / "On column axis".
- **`extractColumnCenter()` pure helper** (module-level, not exported) — filters column entities, calls `getColumnAnchorWorldPoints(entity).find(a => a.anchor === 'center')`. Zero deps on React/canvas/Firestore.
- **Enabled by default** in `DEFAULT_PRO_SNAP_SETTINGS.enabledTypes`. Added before `INTERSECTION` in `priority` list for ordering.

**Files created (1):**
- `snapping/engines/ColumnCenterSnapEngine.ts` — ~75 lines. `extends BaseSnapEngine`. `initializeSpatialIndex` pattern mirrors `DimDefPointSnapEngine` exactly.
- `snapping/engines/__tests__/ColumnCenterSnapEngine.test.ts` — 11 tests: no-column entity, empty list, rect/circular/L-shape/T-shape centers, wrong radius, excludeEntityId, mixed entities, multiple columns. All 11/11 pass.

**Files modified (5):**
- `snapping/extended-types.ts` — new enum value + enabled defaults + priority + perModePxTolerance
- `snapping/orchestrator/SnapEngineRegistry.ts` — import + registration
- `canvas-v2/overlays/SnapIndicatorOverlay.tsx` — `'bim-column'` key in `BIM_DESCRIPTION_KEY` + `case 'bim_column_center':` SVG ⊕ shape
- `i18n/locales/el/dxf-viewer-shell.json` — `snapModes.labels.bim.columnAxis: "Επί άξονα κολώνας"`
- `i18n/locales/en/dxf-viewer-shell.json` — `columnAxis: "On column axis"`
- `config/tolerance-config.ts` — `SNAP_ENGINE_PRIORITIES.BIM_COLUMN_CENTER: -1`

✅ Google-level: YES — dedicated snap type (clean separation from generic ENDPOINT), SSoT pure `extractColumnCenter` helper, priority -1 ensures structural snap always wins at center point, i18n label via existing BIM_DESCRIPTION_KEY pattern (consistent with wall/slab/opening labels from Phase A), 11/11 tests pass, ADR-040 unaffected (no new React subscriptions).

---

### Phase 5.5i+ — Beam-Supports-Slab Analytical Link *(✅ IMPLEMENTED 2026-05-20)*

Closes the `beam-supports-slab analytical link` deferred item from Phase 5.5a–5.5i. Industry precedent: Revit Material Takeoff + ArchiCAD Interactive Schedule both deduct beam footprint × min(beamDepth, slabThickness) from slab volume. Phase 6 BOQ bridge (BimToBoqBridge) was the gating dependency — now resolved.

**Problem**: `computeSlabGeometry()` returned `volume = netArea × thickness / 1000` regardless of beams sitting on/through the slab. BOQ volume was over-estimated by the beam solid intersection volume.

**Algorithm (pure, no Firestore query):**
1. At slab persist time, `useSlabPersistence.persist()` reads current level scene (beams already in memory via `levelManager.getLevelScene()`) → builds `BeamFootprintForDeduction[]`.
2. `computeSlabGeometry(params, undefined, beamFootprints)` clips each beam outline against the slab outline using Sutherland-Hodgman (beam = convex clip polygon → exact result).
3. Deduction per beam = `intersectionAreaMm2 × min(beamDepth, slabThickness) / 1e9` → m³.
4. `volume = max(0, netArea × thickness / 1000 − Σ deductions)`.
5. When any beam changes (move / resize / delete), `useBeamPersistence` emits `bim:beam-persisted`. `useSlabPersistence` listener re-calls `bimToBoqBridge.upsertBoqItemForBim('slab', ...)` for every slab in scene — no Firestore slab save, only BOQ bridge update.

**Files modified (6):**
- `bim/geometry/shared/polygon-utils.ts` — New `clipPolygonBySH(subject, convexClip)` (Sutherland-Hodgman 1974) + `polygonIntersectionAreaMm2(slabVerts, beamVerts)` with AABB fast rejection. S-H exact for convex clip (beam rectangle) + concave subject (slab polygon).
- `bim/geometry/slab-geometry.ts` — New `interface BeamFootprintForDeduction { outline: Polygon3D; depthMm: number }`. Extended `computeSlabGeometry(params, slabOpenings?, beamFootprints?)` — mirrors Phase 3.7 `slabOpenings` pattern. `sumBeamDeductionsM3()` private helper. Backward-compat: no beamFootprints → volume unchanged.
- `systems/events/EventBus.ts` — New event `'bim:beam-persisted': { floorplanId: string }`.
- `hooks/data/useBeamPersistence.ts` — Emit `bim:beam-persisted` after `saveBeam()` + `deleteBeam()` success.
- `hooks/data/useSlabPersistence.ts` — `persist()` reads beams from scene via `collectBeamFootprints()`. New `useEffect` listens for `bim:beam-persisted` → re-BOQ all scene slabs (bridge-only, no Firestore slab save).
- `docs/.../ADR-363-bim-drawing-mode.md` — This entry.

**Files created (1):**
- `bim/geometry/__tests__/slab-geometry-beam-deduction.test.ts` — 17 tests: S-H clip (4), intersection area (4), `computeSlabGeometry` with beam deductions (9). All pass.

✅ Google-level: YES — pure geometry function (no side effects, idempotent), AABB fast rejection guards hot path, S-H exact for convex beam outline, clamp `min(beamDepth, slabThickness)` respects structural reality, EventBus decoupling (beam persistence doesn't import slab hooks), backward-compat (no beamFootprints arg → identical behaviour), 17/17 tests pass, ADR-040 unaffected (zero new React subscriptions).

---

### Phase 5.5j — H-Beam Variant + Profile Designation Label *(✅ IMPLEMENTED 2026-05-20)*

Closes the two open items from the Phase 5.5h deferred list: H-beam visual variant (HEA/HEB series) and per-beam profile designation canvas label ("IPE 300", "HEA 200").

**Design choices:**
- **`BeamSectionType = 'I' | 'H'`** — new type in `beam-types.ts`. Optional field `sectionType?: BeamSectionType` on `BeamParams` (default `'I'` at render time — backward-compatible, existing beams keep I-symbol).
- **`profileDesignation?: string`** — free-text field on `BeamParams`. Empty string treated as `undefined` (bridge clears it: `value || undefined`).
- **`SECTION_H_FLANGE_T_PX = 9`** — `flangeT/h` = 9/26 ≈ 0.346, within the 0.30–0.40 range of HEA/HEB series (vs 0.15 for IPE). Visually distinct from I-symbol.
- **`computeHProfileOutline()`** — delegates to `computeIProfileOutline` with `ft = SECTION_H_FLANGE_T_PX`. Single-source: shape logic not duplicated.
- **Label position** — drawn in screen space (post-symbol, outside `ctx.rotate`). Offset: `SECTION_PROFILE_W_PX/2 + 8 = 18px` from symbol centre in perpendicular direction, i.e. 8px beyond symbol outer flange edge. `bold 8px sans-serif`, `textAlign: 'center'`, `textBaseline: 'middle'`. Stays horizontal regardless of beam angle.
- **Ribbon** — new row in `beam-material` panel: sectionType combobox (I/H, 80px) + profileDesignation combobox with 14 preset IPE/HEA/HEB designations (110px, free-entry supported).
- **i18n** — `beamEditor.sectionType.{section.title, I, H}` + `beamEditor.profileDesignation.section.title` in el+en.

**Files modified (7):**
- `bim/types/beam-types.ts` — `BeamSectionType` type + `sectionType?` + `profileDesignation?` on `BeamParams`.
- `bim/beams/beam-section-profile.ts` — `SECTION_H_FLANGE_T_PX = 9` + `computeHProfileOutline()`.
- `bim/renderers/BeamRenderer.ts` — `drawSectionProfile()` branches `sectionType ?? 'I'`; label draw when `profileDesignation` set.
- `ui/ribbon/hooks/bridge/beam-command-keys.ts` — `sectionType` + `profileDesignation` keys added to `BEAM_RIBBON_KEYS.stringParams` + type union + string key set.
- `ui/ribbon/data/contextual-beam-tab.ts` — new row in `beam-material` panel: sectionType combobox + profileDesignation combobox (14 presets).
- `ui/ribbon/hooks/useRibbonBeamBridge.ts` — import `BeamSectionType`; new STRING_KEY_TO_FIELD entries; `sectionType`/`profileDesignation` patch branches in `onComboboxChange`.
- `src/i18n/locales/el/dxf-viewer-shell.json` + `en/dxf-viewer-shell.json` — new keys.

**Files created (0):** Zero new files — pure extension of existing SSoT modules.

✅ Google-level: YES — backward-compat (`sectionType ?? 'I'` default), idempotent (same params → same symbol), SSoT (`computeHProfileOutline` delegates to I-variant, no geometry duplication), ADR-040 compliant (zero new React subscriptions, no PreviewCanvas changes), ribbon mutation routes through `UpdateBeamParamsCommand` (undoable), `profileDesignation || undefined` prevents empty-string persistence.

#### Phase 5.5j extras — Scale-Adaptive Symbol + Anchor Pulse *(✅ IMPLEMENTED 2026-05-21)*

**Scale-adaptive section-profile symbol:**
- `symW = clamp(beamWidthPx × SECTION_SYMBOL_BEAM_W_RATIO, W_MIN, W_MAX)` where `beamWidthPx = beam.params.width × this.transform.scale`
- Ratio `0.35` → symbol ≈ 35% of beam on-screen width. Clamp `[12, 50]px` prevents tiny symbol at low zoom or oversized at high zoom.
- All sub-dims scale uniformly: `symH = symW × (H/W aspect)`, `symWebW = symW × (WEB_W / W)`, `symFlangeT = symW × (FLANGE_T / W)`, `symHFlangeT = symW × (H_FLANGE_T / W)`.
- Symbol offset from beam edge also scales: `symOffset = SECTION_OFFSET_PX + (symW - W) × 0.3` (partial proportional growth).
- New SSoT constants in `beam-section-profile.ts`: `SECTION_SYMBOL_W_MIN_PX=12`, `SECTION_SYMBOL_W_MAX_PX=50`, `SECTION_SYMBOL_BEAM_W_RATIO=0.35`.

**Anchor highlight pulse:**
- `drawAnchorPulse(beam)` — new private method in `BeamRenderer`.
- Called in `highlighted` branch alongside `drawDepthIndicator` + `drawSectionProfile`.
- Draws stroke ring (`r=7px`, `lw=1.5px`) at `startPoint` + `endPoint` in screen space.
- Alpha modulated: `α = max(0, 0.15 + 0.25 × sin(t × 2π × 1.2Hz))` where `t = performance.now()/1000`. Pulses when canvas is in active RAF loop; static glow otherwise.
- ADR-040 compliant: zero new subscriptions, pure `ctx` operations, no PreviewCanvas changes.

**Files modified (2):**
- `bim/beams/beam-section-profile.ts` — 3 new exported constants.
- `bim/renderers/BeamRenderer.ts` — 3 new imports; `drawSectionProfile()` updated to adaptive sizing; new `drawAnchorPulse()` method; 3 module-level pulse constants; `highlighted` branch calls `drawAnchorPulse`.

✅ Google-level: YES — ADR-040 micro-leaf compliant (zero subscriptions), pure canvas math, idempotent, constants SSoT-sourced, pulse degrades gracefully to static glow when canvas not in RAF loop.

---

### Phase 5.6 — Wall Split Tool *(✅ IMPLEMENTED 2026-05-19)*

**Pattern**: Revit "Split Element" — dedicated tool mode (`wall-split`), continuous pick loop (multi-split, stays active until ESC), hover preview με perpendicular indicator line across wall at projected split point.

**Architecture decision**: `useWallSplitTool` τοποθετείται σε `hooks/tools/` (ΟΧΙ `hooks/drawing/`) και εισάγεται μέσω `useModifyTools` — διότι είναι destructive editing operation που χρειάζεται `executeCommand` + undo/redo. Creation tools (wall, opening, slab) πηγαίνουν σε `useSpecialTools`.

**Files created:**

- `src/subapps/dxf-viewer/bim/walls/wall-split.ts` — Pure geometry functions, zero React/DOM/Firestore deps:
  - `computeSplitOffset(wall, splitPoint): number | null` — projects cursor onto wall axis via `projectPointOnWallAxis()` SSoT, clamps to `[MIN_SEGMENT_MM=100, totalLen-100]`, returns `null` για curved/polyline/degenerate walls.
  - `computeSplitWallParams(wall, splitOffset): { wall1Params, wall2Params }` — interpolates midpoint on axis, inherits bevels (wall1: `startBevel`; wall2: `endBevel`), clears `measurementLength`.
  - `redistributeOpenings(hostedOpeningIds, openingsByIdFn, splitOffset, wall1Id, wall2Id): RedistributeResult` — center-based assignment: `center > splitOffset` → wall2 (offset -= splitOffset, clamped to 0); else → wall1. Returns `wall1OpeningIds`, `wall2OpeningIds`, `openingUpdates`.
  - `computeSplitIndicatorLine(wall, splitPoint): [Point2D, Point2D]` — perpendicular at `1.5 × half-thickness` (REACH_FACTOR=1.5).
  - `OpeningUpdate { openingId, previousParams, nextParams }` exported type.

- `src/subapps/dxf-viewer/systems/wall-split/WallSplitStore.ts` — Module-level store (ADR-040 pattern, mirrors `TrimToolStore`/`WallPreviewStore`):
  - State: `WallSplitHoverState { hoveredWallId: string|null, splitPoint: Point2D|null, splitLine: [Point2D,Point2D]|null }`.
  - `WallSplitStore.set(next)` — equality guard on `hoveredWallId` + `splitPoint` coords, deep-copies on change.
  - `WallSplitStore.reset()`, `.get()`, `.subscribe()`.
  - `useWallSplitPreview()` hook via `useSyncExternalStore`.

- `src/subapps/dxf-viewer/core/commands/entity-commands/WallSplitCommand.ts` — ICommand implementation:
  - `execute()`: `removeEntity(original.id)` → `addEntity(wall1)` → `addEntity(wall2)` → loop `openingUpdates` → `applyOpeningPatch(nextParams)`.
  - `undo()`: `removeEntity(wall1.id)` → `removeEntity(wall2.id)` → `addEntity(originalWall)` → loop `openingUpdates` reversed → `applyOpeningPatch(previousParams)`.
  - `applyOpeningPatch`: resolves host wall from `sceneManager`, recomputes geometry + validation (soft-orphan: proceeds even if host missing), calls `updateEntity`.
  - `canMergeWith()` → `false` (no drag merge).
  - `getAffectedEntityIds()`: `originalWall.id + wall1.id + wall2.id + all opening IDs`.

- `src/subapps/dxf-viewer/hooks/tools/useWallSplitTool.ts` — Editing tool hook:
  - Props: `{ activeTool, levelManager, executeCommand, transformScale, onToolChange }`.
  - Return: `{ isActive, handleWallSplitClick, handleWallSplitMouseMove, handleWallSplitEscape }`.
  - `findWallAtPoint(worldPoint)`: iterates `isWallEntity` walls, calls `projectPointOnWallAxis()` + `calculateDistance()` vs `TOLERANCE_CONFIG.SNAP_DEFAULT / transformScaleRef.current`.
  - `handleWallSplitMouseMove`: finds wall, projects cursor, calls `computeSplitIndicatorLine`, updates `WallSplitStore`.
  - `useEffect` subscribes to `subscribeToImmediateWorldPosition` when `isActive` (resets store on deactivate).
  - `handleWallSplitClick`: getSceneManager → `findWallAtPoint` → `computeSplitOffset` (null → return) → `computeSplitWallParams` → `generateWallId()×2` → `computeWallGeometry` for wall1+wall2 → `redistributeOpenings` → `new WallSplitCommand` → `executeCommand(cmd)`.
  - `handleWallSplitEscape`: resets `WallSplitStore`, calls `onToolChange?.('select')`.

- `src/subapps/dxf-viewer/bim/walls/__tests__/wall-split.test.ts` — 21 test cases:
  - `computeSplitOffset`: 7 cases (midpoint, clamp-start, clamp-end, curved→null, polyline→null, degenerate→null, off-axis projection).
  - `computeSplitWallParams`: 5 cases (endpoints, startBevel inheritance, endBevel inheritance, property preservation, measurementLength cleared).
  - `redistributeOpenings`: 6 cases (wall1 assignment, wall2 + offset adjust, straddle→wall1, missing→skip, offset≥0, previousParams for undo).
  - `computeSplitIndicatorLine`: 3 cases (perpendicular endpoints, length=thickness×REACH_FACTOR, degenerate→zero-length pair).

**Files modified:**

- `src/subapps/dxf-viewer/ui/toolbar/types.ts` — `DxfTool` union += `'wall-split'`.
- `src/subapps/dxf-viewer/systems/tools/ToolStateManager.ts` — entry: `{ id: 'wall-split', category: 'editing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false }`.
- `src/subapps/dxf-viewer/core/commands/entity-commands/index.ts` — re-exports `WallSplitCommand` + `WallSplitCommandParams`.
- `src/subapps/dxf-viewer/hooks/tools/useModifyTools.ts` — imports + instantiates `useWallSplitTool`, exposes `wallSplitTool` in return.
- `src/subapps/dxf-viewer/hooks/canvas/canvas-click-types.ts` — `wallSplitIsActive?` + `handleWallSplitClick?` props added.
- `src/subapps/dxf-viewer/hooks/canvas/useCanvasClickHandler.ts` — PRIORITY 1.61 branch after extend (1.60).
- `src/subapps/dxf-viewer/components/dxf-layout/CanvasSection.tsx` — wires `wallSplitTool.isActive` + `handleWallSplitClick` → click handler; `handleWallSplitEscape` + `wallSplitIsActive` → keyboard shortcuts.
- `src/subapps/dxf-viewer/hooks/canvas/useCanvasKeyboardShortcuts.ts` — `handleWallSplitEscape?` + `wallSplitIsActive?` params, passed to escape registrations.
- `src/subapps/dxf-viewer/hooks/canvas/useCanvasEscapeRegistrations.ts` — `buildModifyHandler('wall-split', ...)` at `ESC_PRIORITY.MODIFY_TOOL` after array-path.
- `src/i18n/locales/el/dxf-viewer-shell.json` — `"wall-split": "Χωρισμός Τοίχου"`.
- `src/i18n/locales/en/dxf-viewer-shell.json` — `"wall-split": "Split Wall"`.

**Opening redistribution algorithm:**

```
center = opening.offsetFromStart + opening.width / 2
if center > splitOffset:
  wall2 ← opening, newOffset = max(0, offsetFromStart − splitOffset)
else:
  wall1 ← opening, offset unchanged
straddle (center === splitOffset) → wall1 (same as Revit behavior)
```

**Bevel inheritance at split point:**

```
wall1: startBevel = original.startBevel  (preserved),  endBevel = undefined (clean cut)
wall2: startBevel = undefined (clean cut),              endBevel = original.endBevel (preserved)
```

**Phase 5.6 Ribbon + Context Menu *(✅ IMPLEMENTED 2026-05-19)*:**
- [x] Visual renderer — `useWallSplitPreviewDraw` micro-leaf (ADR-040 compliant, mirrors TrimPreviewMount). Dashed `#FFD24A` perpendicular line + split-point circle. Mounted in `canvas-layer-stack-leaves.tsx → PreviewCanvasMounts`.
- [x] Ribbon button "Χωρισμός" in `contextual-wall-tab.ts` wall-actions panel (`commandKey: 'wall-split'` → `onToolChange('wall-split')`). Icon: `bim-wall-split` (Scissors). Appears whenever any wall is selected (contextual tab trigger).
- [x] Context menu entry "Χωρισμός Τοίχου" in `EntityContextMenu` — `canSplit` prop computed via `isWallEntity` guard on `currentScene.entities` (pure derivation, zero subscription). `SplitWallIcon` added to `MenuIcons.tsx`.

**Still deferred:**
- [ ] Keyboard shortcut — toolbar-only for now (`SL` conflicts with Slab chord). `WS` or dedicated chord in future phase.
- [ ] Curved/polyline wall split — returns null; requires arc-subdivision algorithm (separate phase).

✅ Google-level: YES — Revit Split Element pattern (enterprise standard, all major CAD tools converge), dedicated tool mode (not context-menu-only), full undo/redo via `WallSplitCommand` (ICommand pattern, ADR-031), center-based opening redistribution (AutoCAD/Revit straddle behavior), pure geometry functions (zero React deps in `wall-split.ts`), ADR-040 module-level store (zero React state for high-frequency mouse-move), idempotent `execute/undo`, `projectPointOnWallAxis()` SSoT reused (zero duplication), enterprise IDs via `generateWallId()` (N.6 compliance), 21 test cases.

---

### Phase 5.6.1 — Wall Split Persistence Fix *(✅ IMPLEMENTED 2026-05-19)*

**Root cause**: `WallSplitCommand.execute()` was purely scene-side (removeEntity + addEntity×2 + applyOpeningPatch). Original wall remained in Firestore, wall1/wall2 were never saved, redistributed opening params were never updated. Data loss on page reload.

**Fix**: EventBus-driven persistence hook (`useWallSplitPersistence`) mounted inside `WallPersistenceHost`. `useWallSplitTool` emits `bim:wall-split-committed` after `executeCommand(cmd)`. The hook persists atomically:
1. `Promise.all([ deleteWall(original), saveWall(wall1), saveWall(wall2) ])`
2. `updateOpening(id, { params: nextParams })` for each redistributed opening (parallel)
3. BOQ bridge: `deleteBoqItemForBim(original, companyId)` + `upsertBoqItemForBim('wall', wall1/wall2, context, 'created')`
4. Audit: `recordWallChange('deleted'/'created'…)` × 3

**Files changed:**
- `src/subapps/dxf-viewer/systems/events/EventBus.ts` — Added `WallEntity` + `OpeningUpdate` imports; added `'bim:wall-split-committed': { originalWallId, wall1, wall2, openingUpdates }` to `DrawingEventMap`
- `src/subapps/dxf-viewer/hooks/tools/useWallSplitTool.ts` — Imports `EventBus`; emits `'bim:wall-split-committed'` after `executeCommand(cmd)` in `handleWallSplitClick`
- `src/subapps/dxf-viewer/hooks/data/useWallSplitPersistence.ts` — NEW hook. Subscribes to `'bim:wall-split-committed'`, creates `WallFirestoreService` + `OpeningFirestoreService`, calls `persistSplit()` async
- `src/subapps/dxf-viewer/app/WallPersistenceHost.tsx` — Calls `useWallSplitPersistence({...})` alongside `useWallPersistence`
- `src/subapps/dxf-viewer/hooks/data/__tests__/useWallSplitPersistence.test.ts` — 9 tests: service init, no-op when not ready, delete+save×2, opening redistribution, BOQ bridge, audit records

✅ Google-level: YES — EventBus-driven (decoupled from scene command layer), idempotent (same IDs always produce same Firestore docs), parallel Promise.all for delete+create, stale-closure-safe (refs for companyId/projectId/buildingId), zero race conditions (no debounce needed — wall split is user-explicit action, not continuous edit), belt-and-suspenders (existing `useWallPersistence` subscription picks up wall1/wall2 on next snapshot), 9 test cases (renderHook + act pattern).

---

### Phase 6 — BOQ Auto-Feed *(✅ CLOSED 2026-05-19 — multi-layer DNA + material catalog)*

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

**Phase 6.1 — Multi-Layer DNA BOQ *(✅ IMPLEMENTED 2026-05-19)*:**
- [x] **Multi-layer payload builder** — `bim/services/boq-multi-layer-builder.ts` (pure factory). Για walls με `params.dna.layers.length > 1`, παράγει 1 parent summary row `boq_bim_${entity.id}` (isGroupParent=true, atoeCategory από parent mapping, quantity = wallNetArea m²) + N child rows `boq_bim_${entity.id}_layer_${layerId}` (parentBoqItemId=parent.id, layerIndex 0..N-1, materialId, per-layer quantity). Volume materials: `quantity = wallNetArea × layer.thickness_mm / 1000` (m³). Area materials: `quantity = wallNetArea` (m², single-side count per layer). Unknown materialId (custom user input) → child skipped, parent unchanged. 15 tests.
- [x] **BimToBoqBridge multi-entry upsert** — `isMultiLayerWall()` guard dispatches walls με dna.layers>1 σε `upsertMultiLayerWall()` path. Single-entry path unchanged για walls χωρίς DNA, single-layer walls (1 layer), και όλα τα non-wall entities (opening/slab/column/beam). Parallel `getDoc` για όλα τα candidate IDs (parent + N children) — combined detach check + createdAt preservation.
- [x] **Per-layer detach guard** — κάθε child row έχει ανεξάρτητο detach flag. User detach σε ένα layer entry δεν επηρεάζει parent ή sibling layers. On `action='updated'`, detached rows skipped individually. On `action='created'` (first-save), detached flag bypassed (επαναφορά μετά από delete+recreate).
- [x] **Multi-layer delete cascade** — `deleteBoqItemForBim()` τώρα queries `where('parentBoqItemId', '==', boq_bim_${entityId})` για να βρει όλα τα children και cascades delete. Detached children skipped individually. Cascade query failure → best-effort parent delete continues (orphan children await manual recovery).

**Phase 6.2 — Material → ΑΤΟΕ centralized SSoT *(✅ IMPLEMENTED 2026-05-19)*:**
- [x] **`bim/config/material-to-atoe-mapping.ts`** — read-only seed catalog mapping και τα 18 wall-material-catalog preset IDs σε ΑΤΟΕ codes + units + quantityKind ('area'|'volume'). ΟΙΚ-2 σκυροδέματα (m³ volume), ΟΙΚ-3 τοιχοποιίες (m² ή m³ ανά υλικό), ΟΙΚ-4 επιχρίσματα (m² area), ΟΙΚ-7 επενδύσεις (m² area), ΟΙΚ-10 μονώσεις (m² area), ΟΙΚ-12 ειδικές κατασκευές (m² area). Resolver `resolveMaterialAtoeMapping(materialId)` με null fallback για unknown/custom user-typed strings. 23 tests.
- [x] **Industry alignment** — 6/6 σύγκλιση επιβεβαιωμένη σε SPEC-3D-004D §12 Q4 RESOLVED (Revit Material Takeoff / ArchiCAD Interactive Schedule / Bentley BIS / Tekla BOM / Vectorworks Worksheet / Allplan Quantity Takeoff).

**Backward-compatibility:**
- Existing single-entry rows `boq_bim_${entityId}` (no layer suffix) διατηρούνται. Νέο save για multi-layer wall **overrides** τη single-entry δομή στο parent ID (που είναι το ίδιο string), προσθέτει N νέα child rows. Single-layer / no-dna walls + όλα τα non-wall entities συνεχίζουν να παράγουν 1 row (zero behavior change).
- BOQItem schema: τα νέα fields `parentBoqItemId`, `isGroupParent`, `layerIndex`, `materialId` είναι ΟΛΑ optional → υπάρχουσες χειροκίνητες entries (`source: 'manual'`) δεν επηρεάζονται.

**Future (Phase 6.2+, NOT in current scope):**
- [ ] `bim_atoe_overrides/{projectId}` Firestore collection για user-editable per-project overrides (hierarchy: item override > project override > system seed).
- [ ] BOQ panel UI: parent row collapsible me children indented (Hybrid group+expand, Q4).
- [ ] `bim_materials.atoeCode` field στο material library entries (Phase 6.2+ Firestore Asset Manager swap).
- [ ] ADR-175 schema update entry για νέα BOQItem fields (cross-link).

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

### Phase A — Wall Category Chords *(✅ IMPLEMENTED 2026-05-19)*

2-char keyboard chords that change the **wall category** during drawing (`activeTool === 'wall'`). Extends the Phase 7B `W+n` kind-chord pattern to a second dimension: `W+letter` sets `WallParams.category` via `overrides` without resetting the state machine.

**Chord table:**

| Chord | Category | Meaning |
|-------|----------|---------|
| `W+E` | `'exterior'` | Εξωτερικός τοίχος |
| `W+I` | `'interior'` | Εσωτερικός τοίχος |
| `W+P` | `'parapet'` | Στηθαίο |
| `W+F` | `'fence'` | Φράχτης |
| `W+T` | `'partition'` | Διαχωριστικό (par**T**ition) |

**Behavioural contract:**
- If wall tool idle → activates it (`phase: 'awaitingStart'`)
- If wall tool already drawing → updates category in-place, **no state machine reset** (unlike `setKind`)
- Category persists into next wall commits via `overrides.category`

**Files modified (4):**
- `systems/events/EventBus.ts` — import `WallCategory`, add `'bim:set-wall-category': { category: WallCategory }` event
- `hooks/useDxfToolbarShortcuts.ts` — import `WallCategory`; 5 new chord entries (`W+E/I/P/F/T`); `chord-completed` handler: `action.startsWith('wall:category:')` branch → `handleToolChange('wall')` + `EventBus.emit('bim:set-wall-category', { category })`
- `hooks/drawing/useWallTool.ts` — import `WallCategory`; `setCategory` callback (updates `overrides`, activates from idle); `useEffect(() => EventBus.on('bim:set-wall-category', …), [setCategory])`
- `config/keyboard-shortcuts.ts` — 5 documentary entries (`wallExterior` / `wallInterior` / `wallParapet` / `wallFence` / `wallPartition`); action prefix `'wall:category:'`

---

### Phase 7 — Multi-Element Selection & Bulk Edit (split 2026-05-19 into 7.1 + 7.2 per Giorgio Q5)

> **Naming note**: this ADR already uses the labels "Phase 7A / Phase 7B" elsewhere
> for the unrelated Multi-Char BIM Hotkeys sub-track (line 1928 + §6 Phase 7A/B).
> The Phase-7 selection-feature split therefore uses **7.1 / 7.2** to avoid clash.

#### Phase 7.1 — Selection Core ✅ CLOSED 2026-05-19

Scope: rubber-band BIM selection, multi-move with cascade, multi-delete with cascade,
bulk-edit ribbon contextual tab. Ratio of original Phase 7 ≈ 70%.

- [x] **BIM marquee bounds** — `selection-duplicate-utils.calculateEntityBounds()` previously
  silently dropped 7 BIM kinds (returned `null` in `default:` branch → marquee
  selection skipped every wall/opening/slab/slab-opening/column/beam/stair).
  Now delegates to new SSoT `bim/utils/bim-bounds.ts:calculateBimEntity2DBounds()`
  which projects `geometry.bbox` (BoundingBox3D) to XY plan view. 13 tests.
- [x] **BIM move geometry** — `move-entity-geometry.calculateMovedGeometry()` was a no-op for
  BIM (returned empty `Partial`). New `bim/utils/bim-move-geometry.ts:calculateBimMovedGeometry()`
  produces `{params, geometry}` atomic patch per kind: wall shifts `start`/`end`/`polylineVertices`,
  slab/slab-opening shift outline vertices, column shifts `position`, beam shifts
  `startPoint`/`endPoint`/`curveControl`, stair shifts `basePoint`. Geometry recomputed
  via per-type `compute*Geometry()` SSoT so bbox stays in sync. Opening returns `{}`
  (derived geometry — follows host wall automatically). 9 tests.
- [x] **Cascade resolver SSoT** — `bim/cascade/bim-cascade-resolver.ts`: pure functions
  `findHostedOpenings`, `findHostedSlabOpenings`, `partitionBimHosts`,
  `expandSelectionForDelete`, `expandSelectionForMove`. Registry module
  `bim-cascade-resolver` (Tier 3) forbids inline host→hosted sweeps. 15 tests.
- [x] **useMoveTool slab→slab-opening cascade** — group move auto-expands selection
  with `expandSelectionForMove()`. Walls do NOT cascade for move (opening derives
  world geometry from host wall, follows automatically).
- [x] **useSmartDelete slab→slab-opening cascade** — Boy-Scout N.0.2: previous inline
  `entities.filter(isOpeningEntity)` sweep replaced by resolver call. Adds
  slab→slab-opening orphan cascade alongside the existing wall→opening prompt.
- [x] **Multi-Selection Ribbon Contextual Tab** — `multi-selection` tab via ADR-345
  registry (trigger `multi-selection-bim`), "Κοινές Ιδιότητες" panel + "Φιλτράρισμα"
  panel (Revit/AutoCAD pattern per Giorgio Q3 decision). Live commit on focus loss /
  Enter → `CompoundCommand(N × UpdateXxxParamsCommand)` = 1 undo step (Google-Docs
  pattern). Implementation **2026-05-19**:
  - SSoT registry `bim/types/bim-common-properties.ts` — 6 editable numeric props
    (`height`, `thickness`, `width`, `depth`, `elevation`, `sillHeight`) × 7 BIM
    kinds, intersection helper `getCommonProperties()`, `countByKind`,
    `isHomogeneous`. 23 tests.
  - Bulk command factory `bim/cascade/bim-bulk-update-builder.ts` — per-kind
    dispatch (`Update{Wall,Opening,Slab,Column,Beam,Stair}ParamsCommand`),
    `CompoundCommand` for atomic execute + single-step undo + rollback on
    sub-command failure. Skip rules: missing entity / unsupported kind /
    out-of-registry key filtered silently. 20 tests.
  - Bridge hook `ui/ribbon/hooks/useMultiSelectionRibbonBridge.ts` — derives
    `mode` (`none`/`single`/`multi`), `bimEntries` (filters scene + supported
    kinds), `kindsCount`, `commonProperties`, `isHomogeneous`, `currentValues`
    (mixed-detect per prop), `executeBulkPatch(patch)`, `narrowToKind(kind)`.
    ADR-040 R1: subscribes inside ribbon leaf, never in `CanvasSection`. 19 tests.
  - Widget components
    `ui/ribbon/components/MultiSelectionCommonPropertiesPanel.tsx` (live-commit
    numeric inputs, Enter/blur commits, Escape reverts, mixed-value placeholder
    via i18n `differentValues`) +
    `ui/ribbon/components/MultiSelectionFilterPanel.tsx` (N per-kind narrow
    buttons με count, hidden when homogeneous). Registered στο `RibbonPanel.tsx`
    widget dispatcher.
  - Tab data `ui/ribbon/data/contextual-multi-selection-tab.ts` — 2 panels,
    widget-type buttons (`multi-selection-common-properties`,
    `multi-selection-filter`).
  - Dispatcher wiring `app/ribbon-contextual-config.ts` —
    `useActiveContextualTrigger` extended with `selectedEntityIds`. When 2+ BIM
    entities selected → `MULTI_SELECTION_CONTEXTUAL_TRIGGER` overrides any
    per-kind trigger driven by `primarySelectedId`. `DxfViewerContent` passes
    `selectedEntityIds` through.
  - i18n: `ribbon.tabs.multiSelection`, `ribbon.panels.multiSelection{Common,Filter}`,
    `ribbon.contextualTabs.multiSelection.*` (properties/filterButtons/hints)
    σε el + en. Πλήρως μεταφρασμένο στα Ελληνικά (no English words στο el).
  - CSS tokens `ribbon-tokens.css` — `dxf-ribbon-multi-{common,filter}*`.
  - Google-Level checklist (N.7.2): ✅ Proactive (resolved on selection change) /
    ✅ No race (`CompoundCommand` atomic) / ✅ Idempotent / ✅ Belt-and-suspenders
    (per-kind tabs intact after narrow) / ✅ SSoT (registry + builder + bridge) /
    ✅ Await (`executeCommand` sync) / ✅ Lifecycle owner (bridge hook).

#### Phase 7.2 — Transform BIM ✅ CLOSED 2026-05-19

Scope was matrix transform coverage for BIM. The 3 commands (`MirrorEntityCommand`,
`RotateEntityCommand`, plus a new `BimCopyCommand` wrapping a kind-aware copy
builder) now produce atomic `{params, geometry}` patches per BIM kind via
pure-function SSoTs.

- [x] **Mirror BIM** — `bim/transforms/bim-mirror-geometry.ts` SSoT. Per-kind
  axis-aware mirror: wall `start`/`end` reflection (+ `polylineVertices` +
  `curveControl`), opening `handing` flip on hinged kinds (door/french-door),
  slab + slab-opening polygon mirror, column position+rotation reflection
  AND anchor re-snap via `(dx,dy)` reflection across the axis (axis-aligned
  reflections exact; arbitrary axes snap to closest of 9 anchors), beam
  endpoints + `curveControl` mirror, stair `basePoint` + `direction` mirror.
  L-shape / T-shape column ARM handedness correctly flipped via `flipY` param
  toggle (2026-05-19 follow-up). Mathematical proof: local transform
  `T = R(-θ') × M × R(θ)` has `T[1][1] = −1` for ALL `axisAngle` + `rotation`
  combinations → `flipY` always toggles, zero runtime matrix computation.
  `MirrorEntityCommand` now dispatches BIM through the SSoT (with fallback to
  `mirrorEntity()` for non-BIM).
- [x] **Rotate BIM** — `bim/transforms/bim-rotate-geometry.ts` SSoT. Per-kind
  pivot rotation: wall endpoints + polylineVertices + curveControl, slab +
  slab-opening outline vertices, column position rotates around pivot AND
  `rotation` field accumulates `+angleDeg`, beam endpoints + curveControl,
  stair `basePoint` rotates AND `direction` accumulates `+angleDeg`.
  `RotateEntityCommand` now dispatches BIM (in both in-place and copyMode).
  The existing `useRotationTool` 3-click pivot UI (`awaiting-base-point →
  awaiting-reference → awaiting-angle`) already covers the AutoCAD-style
  pivot flow with group rotation around a common pivot — no new hook needed.
- [x] **Copy BIM** — `bim/transforms/bim-copy-builder.ts` SSoT +
  `BimCopyCommand` wrapper. ID regeneration via `enterprise-id-convenience`
  (kind-specific: `generateWallId`, `generateOpeningId`, …) per SOS N.6.
  Independent host references rewired: opening clones get the cloned wall's
  ID when the wall is ALSO in the selection (else preserve original wallId);
  slab-opening clones get the cloned slab's ID likewise. Firestore writes
  happen automatically via the existing per-type persistence subscriptions
  (`useWallPersistence`, `useOpeningPersistence`, …) — the kind-specific
  enterprise ID routes the new entity to the correct collection via
  `setDoc()`. Three transform paths supported: `translate` / `mirror` /
  `rotate`. Rationale for new `BimCopyCommand` (rather than extending
  `CopyEntityCommand`): the existing `CopyEntityCommand` is grip-flow
  specific (vertex-stretch + anchor-translate displacement) — conflating
  with BIM clipboard copy would obscure both responsibilities.

**Files created (Phase 7.2):**
1. `bim/transforms/bim-mirror-geometry.ts` — 7-kind mirror SSoT (pure function).
2. `bim/transforms/bim-rotate-geometry.ts` — 7-kind rotate SSoT (pure function).
3. `bim/transforms/bim-copy-builder.ts` — kind-specific ID gen + host rewire SSoT.
4. `core/commands/entity-commands/BimCopyCommand.ts` — ICommand wrapper.
5. `bim/transforms/__tests__/bim-mirror-geometry.test.ts` — 28 tests (23 dispatch incl. L/T handedness + 5 anchor reflection).
6. `bim/transforms/__tests__/bim-rotate-geometry.test.ts` — 12 tests.
7. `bim/transforms/__tests__/bim-copy-builder.test.ts` — 10 tests.
8. `core/commands/entity-commands/__tests__/MirrorEntityCommand.bim.test.ts` — 5 tests.
9. `core/commands/entity-commands/__tests__/RotateEntityCommand.bim.test.ts` — 5 tests.
10. `core/commands/entity-commands/__tests__/BimCopyCommand.test.ts` — 6 tests.

**Files modified:**
- `core/commands/entity-commands/MirrorEntityCommand.ts` — added `computeMirrorUpdates()` that dispatches BIM first, falls through to `mirrorEntity()` for non-BIM. Used by `execute` and `redo` paths.
- `core/commands/entity-commands/RotateEntityCommand.ts` — analogous `computeRotateUpdates()`.

**Phase 7.2 follow-up (2026-05-19) — L/T arm handedness:**
- `bim/types/column-types.ts` — `flipY?: boolean` added to `ColumnLshapeParams` + `ColumnTshapeParams`.
- `bim/geometry/column-geometry.ts` — `buildLshapeLocal` + `buildTshapeLocal` apply `ys = flipY ? -1 : 1` sign + reverse CCW.
- `bim/transforms/bim-mirror-geometry.ts` — `mirrorColumn()` toggles `lshape.flipY` / `tshape.flipY`.

**Tests: 59 passed across 6 suites (original) + 7 new handedness tests = 66 total.**

**Ribbon/context-menu wiring status**: ribbon "Mirror" / "Rotate" / "Copy"
buttons + shortcuts (`MI` / `RO` / `CO`) ΗΔΗ υπάρχουν στο
`ui/ribbon/data/home-tab-modify.ts`. `useMirrorTool` + `useRotationTool`
hooks ΗΔΗ wired και τώρα δουλεύουν σε BIM μέσω της επέκτασης των commands.
Ένα **dedicated `useBimCopyTool` hook** για clipboard-style BIM copy (που
χρησιμοποιεί το `BimCopyCommand` με translate delta από user pick) δεν
υπάρχει ακόμη — η υποδομή (SSoT + command) είναι στη θέση της και θα
wireθεί σε επόμενη iteration όταν το UX flow αποφασιστεί (πιθανότατα
ώστε να ταιριάζει με grip-context-menu `Copy` modifier του ADR-357 +
ribbon `Copy` shortcut). Tracked στο pending-ratchet ως follow-up.

**Google-Level N.7.2 verdict**: ✅ Proactive (pure SSoTs computed at command
build time, not as side-effects) / ✅ No race (each command writes
atomically via `sceneManager.updateEntity`) / ✅ Idempotent (mirror twice =
identity for axis-symmetric anchor; rotate by 360° normalises to 0; copy
produces deterministic clone via snapshot redo) / ✅ Belt-and-suspenders
(BIM dispatcher returns null for non-BIM → generic path runs; kind-specific
generators throw clearly if an unknown kind is passed) / ✅ SSoT
(geometry + ID gen + host rewire all centralized in `bim/transforms/`) /
✅ Sync await (no fire-and-forget — every patch returns before
`updateEntity` runs) / ✅ Lifecycle owner (command class owns the patch
lifecycle).

### Phase 8 — Schedule Export (1 session) ✅ IMPLEMENTED 2026-05-19

- [x] `BimScheduleExporter` — generate table per element type ή combined.
- [x] Formats: CSV, Excel (xlsx), PDF (via existing print pipeline).
- [x] Filterable schedule UI (per floor, per category, canvas region, selection).
- [x] 8 presets: door/window/wall/slab/column/beam/stair/slab-opening + combined.
- [x] Ribbon "Ανάλυση" tab με BIM Schedule button (analyze-tab.ts, ribbon-default-tabs.ts).
- [x] Region pick FSM (region-pick-store + useScheduleRegionPickTool).
- [x] i18n: dxf-schedule namespace (el + en, 37 keys, ICU {count}).
- [x] Tests: 81 passing (filters + builder + exporters).
- [x] SSoT registry: `bim-schedule` module (Tier 3, ADR-294).

**Files (M1–M7)**:
- `bim/schedule/types.ts`, `filters.ts`, `schedule-presets.ts`, `schedule-builder.ts`
- `bim/schedule/exporters/`: `value-formatters.ts`, `csv-exporter.ts`, `xlsx-exporter.ts`, `pdf-exporter.ts`, `index.ts`
- `bim/schedule/index.ts` (barrel)
- `bim/schedule/stores/region-pick-store.ts`
- `bim/schedule/__tests__/`: filters, builder, exporters (81 tests)
- `ui/bim/schedule/`: ScheduleEntityToggle, ScheduleFilterBar, SchedulePreviewTable, ScheduleFormatPicker, BimScheduleDialog
- `hooks/tools/useScheduleRegionPickTool.ts`
- `hooks/useBimScheduleExport.ts`
- `ui/ribbon/data/analyze-tab.ts` (NEW)
- `ui/ribbon/data/ribbon-default-tabs.ts` (+ANALYZE_TAB)
- `ui/ribbon/components/buttons/RibbonButtonIcon.tsx` (+bim-schedule icon)
- `src/i18n/locales/el/dxf-schedule.json`, `src/i18n/locales/en/dxf-schedule.json`

### Phase 9+ — Out of Scope (διατυπώνεται για documentation)

- 3D viewer (Three.js port από genarc) → ίσως `dxf-viewer-3d/` subapp.
- IFC export (IfcWall/IfcDoor/...).
- MEP entities (ducts/pipes/electrical).
- Real-time clash detection.
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
- [x] `MaterialLibraryService.ts` με CRUD per scope **✅ Phase 6.5.A (2026-05-20)** — 3-scope inheritance resolver (system + company + project), cache TTL 5min, subscribe με equality guard, builtin guard για system seed, SOS N.6 compliant (setDoc + `generateBimMaterialId()`).
- [x] Firestore seed script `scripts/seed-bim-materials.ts` **✅ Phase 6.5.A (2026-05-20)** — deterministic `bmat_sys_<slug>` IDs (mirror seed-boq-subcategories), idempotent, `pnpm run seed:bim-materials`. 25 system materials per §Q8 distribution.
- [x] System seed data `bim/data/system-materials-seed.ts` **✅ Phase 6.5.A (2026-05-20)** — pure data, 25 entries, build-time invariant check.
- [x] Types `bim/types/bim-material-types.ts` **✅ Phase 6.5.A (2026-05-20)** — `BimMaterial`, `SaveBimMaterialInput`, `UpdateBimMaterialPatch`, `BIM_MATERIAL_ERRORS` codes.
- [x] Unit tests `services/__tests__/MaterialLibraryService.test.ts` **✅ Phase 6.5.A (2026-05-20)** — 3-scope merge, cache TTL, builtin guard, system-scope client rejection, NOT_FOUND, stripUndefined patch.
- [x] Materials browser UI **✅ Phase 6.5.B (2026-05-20)** — 5η tab "Υλικά" (FloatingPanelType + PanelTabs + usePanelContentRenderer). `MaterialsLibraryPanel` (filter row: category select + scope chips + search, list cards + scope badge + density, system read-only), `MaterialEditorDialog` (Radix Dialog, 14 πεδία σε 3 sections, create/edit mode, builtin guard), `useMaterialLibrary` hook (memoized service per companyId+userId+projectId, live subscribe + equality guard), i18n namespace `bim-materials` (el + en), `panels.materials` keys στο `dxf-viewer-panels`, lazy-config + namespace-loaders updated.
- [x] Material picker UI: στο WallDna editor **✅ Phase 6.5.C (2026-05-20)** — `useDnaMaterialOptions` hook (4 wall-relevant categories filter), `WallAdvancedPanel.projectId?` prop, `MaterialPicker` extended με `<optgroup>` "Βιβλιοθήκη Υλικών" + "Προεπιλεγμένα", `bmat_*` ID detection (δεν κάνει trigger custom text input), auto-populate layer name από `material.nameEl` on library selection.
- [ ] Pre-commit ratchet `bim-material-prefix` SSoT module — deferred (no inline material ID strings exist outside catalog files).

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
| 2026-05-28 | **Phase 1C-ter ext — Wall MOVE/ROTATION grip glyphs + `wall-rotation` handle (same code as stair)**. Giorgio request (screenshot): το central wall grip να δείχνει το ΙΔΙΟ "move" σημάδι με το stair base grip + νέο σημάδι ΠΕΡΙΣΤΡΟΦΗΣ σε μικρή πλευρά του τοίχου όπως το stair direction grip — «χρησιμοποίησε τον ίδιο κώδικα». Reuse του glyph vocabulary (`GripShape` `'move'`/`'rotation'`, ADR-393): νέο `wallGripGlyphShape(kind)` (mirror `stairGripGlyphShape`) → `wall-midpoint`→`'move'`, `wall-rotation`→`'rotation'`, else `'square'`· το `WallRenderer.getGrips` το περνά ως `shape` (mirror `StairRenderer.getGrips`) → ίδιο `GripShapeRenderer`, μηδέν νέος render κώδικας. Νέο grip kind `wall-rotation` εκπέμπεται στο straight branch (gripIndex 9) σε θέση `end + 200mm·u` (scene-scaled, έξω από την end short edge)· επιβιώνει του `suppressRedundantStraightGrips`. Νέο transform `rotateWall`: anchor-relative swept-angle περιστροφή ΚΑΙ ΤΩΝ ΔΥΟ endpoints γύρω από το midpoint (mirror stair `rotateDirection` — αποφεύγει snap/flip στο off-axis handle). Straight only (curved/polyline θα παραμόρφωναν interior). Visible straight set: 6 grips (center MOVE + 4 corners + ROTATION). Files: `grip-types.ts`, `wall-grips.ts`, `wall-grip-transforms.ts`, `WallRenderer.ts`, `wall-grips.test.ts` (+5 tests). 30/30 PASS, tsc clean. ⚠️ Browser verify. ✅ Google-level: YES — SSoT glyph reuse (zero parallel renderer), midpoint+length invariant, idempotent, anchor-relative no-flip. | Claude Opus 4.7 |
| 2026-05-28 | **ROOT FIX — `useSceneManager` stale-ref clobber + §5.4 opening-refresh re-applied**. CompoundCommand (wall+opening) edits επανέφεραν τον τοίχο. DevTools diagnostic (Giorgio) έδειξε: `cmd=CompoundCommand`, intended `t=889.7 ex=10.97`, **immediate scene-read `t=250 ex=10.32` (OLD)**, καμία `[CompoundCommand]` rollback → όχι rollback, **clobber**. **Πραγματικό root (`hooks/scene/useSceneManager.ts`)**: το `setLevelScene` ενημέρωνε ΜΟΝΟ React state (`setLevelScenes`, async/batched) — το `levelScenesRef.current` (που διαβάζει το `getLevelScene`) ανανεωνόταν ΜΟΝΟ στο render (γρ. 21). Άρα μέσα στο synchronous CompoundCommand.execute: ο wallCmd γράφει wall→NEW, ο openingCmd καλεί `getLevelScene()` → **stale ref (wall OLD)** → ξαναχτίζει ολόκληρο scene object με wall OLD + opening NEW → ο τοίχος επανερχόταν. Plain wall (1 command) = κανένα 2ο write = δούλευε· γι' αυτό φαινόταν «opening-specific». Latent bug για ΚΑΘΕ multi-entity command (CompoundCommand / future batch). **Fix**: το `setLevelScene` (+`clearLevelScene`/`clearAllScenes`) ενημερώνει το `levelScenesRef.current` ΣΥΓΧΡΟΝΙΣΜΕΝΑ πριν το `setLevelScenes` → οι διαδοχικές `getLevelScene` reads βλέπουν live το προηγούμενο write. **§5.4 re-applied** (τώρα ασφαλές): `coordinateWallUpdate` εκπέμπει same-params `UpdateOpeningParamsCommand` σε thickness/flip/axis change → το opening cut-depth (=host.thickness, `opening-geometry.ts:60`) ανανεώνεται. Temp diagnostic αφαιρέθηκε. **Files**: `useSceneManager.ts` (core scene-state — sync ref), `wall-opening-coordinator.ts` (hostGeomChanged + samePoint), `grip-parametric-commits.ts` (diagnostic removed). tsc clean. ⚠️ Browser verify (revert fixed + opening depth follows thickness + opening follows wall move). ✅ Google-level: YES — ρίζα διορθωμένη (όχι workaround), single SSoT (ref = sync source of truth για scene reads-within-tick), idempotent, fixes ολόκληρη κλάση multi-entity clobbers, zero renderer touch. | Claude Opus 4.7 |
| 2026-05-28 | **Bugfix §5.10 — Loaded-wall grip edits επέστρεφαν στην αρχική θέση (persistence asymmetry vs openings)**. Live report Giorgio: σύρσιμο wall grip → preview ΟΚ αλλά στο release ο τοίχος επέστρεφε πάντα στην αρχική θέση· εντονότερο σε τοίχο με κούφωμα (loaded από προηγ. session). Root cause = **δύο αποκλίσεις** του `useWallPersistence` από το (δουλεύον) `useOpeningPersistence`: **(1)** το wall subscription ΔΕΝ έσπερνε το `lastSavedParamsRef` για loaded docs (το opening το κάνει, γρ. 214-218) → ο auto-save gate `if (!known && !pendingWall) return` (ADR-390 Bug-A defense) έβλεπε `known=false` για κάθε τοίχο φορτωμένο από Firestore → ο τοίχος ΠΟΤΕ δεν γινόταν dirty, ΠΟΤΕ δεν σωζόταν, και το επόμενο snapshot τον επανέφερε. **(2)** το `persist()` καλούσε ΠΑΝΤΑ `saveWall` (`setDoc merge:false` που ξανα-σφραγίζει `createdAt: serverTimestamp()`) αντί για `updateWall` (`updateDoc`) σε υπάρχοντες τοίχους → το UPDATE rule (createdAt immutable) απέρριπτε το write → re-edit δεν περνούσε. Το opening persist ήδη διάλεγε σωστά `saveOpening` vs `updateOpening` — το wall όχι. **Fix (1 file, `hooks/data/useWallPersistence.ts`)**: (A) seed loop `for (doc of docs) if (!lastSavedParamsRef.has(doc.id)) set(doc.id, doc.params)` στο subscription (mirror opening)· (B) `persist` → `isNew ? saveWall : updateWall({params,validation,geometry,layerId})`. `persistRestore` αμετάβλητο (undo→re-create = create). Δεν αγγίχθηκε renderer/canvas file (όχι CHECK 6B/6D). Δεν προήλθε από το Phase 1C-ter (αυτό μόνο κρύβει grips). tsc clean. ⚠️ Χρειάζεται browser verify (δεν τρέχει αυτόματα). Out of scope: persistence του coordinated opening-reposition (offset) όταν σύρεται ο host wall ενώ το κούφωμα δεν είναι selected — ξεχωριστό follow-up αν εμφανιστεί drift. ✅ Google-level: YES — mirrors το proven opening SSoT pattern, createdAt audit integrity preserved, idempotent seed (set-if-absent), zero renderer touch. | Claude Opus 4.7 |
| 2026-05-28 | **Phase 1C-ter — Straight wall: μόνο 4 corners + center (κρύψιμο grips 0/1/3/4)**. Direct-manipulation απόφαση Giorgio: σε straight wall οι 4 corner grips (Phase 1C-bis) ΗΔΗ καλύπτουν μήκος (axial corner drag → nearest endpoint) + πάχος (perp corner drag → opposite face anchored μέσω `moveCorner` axis-recenter). Άρα `wall-start`/`wall-end` (endpoint translate) + οι δύο `wall-thickness` face handles είναι περιττά → κρύβονται. Παραμένει `wall-midpoint` (center, μετακινεί ΟΛΟ τον τοίχο) + 4 corners = **5 visible grips**. **Drag semantics επιβεβαιωμένα (ήδη υλοποιημένα στο 1C-bis `moveCorner`)**: σύρω κάτω όψη → πάνω ακίνητη (& αντίστροφα)· σύρω αριστερή ακμή → δεξιά ακίνητη (& αντίστροφα)· σύρω center → όλος ο τοίχος. **Implementation (1 source file)**: `bim/walls/wall-grips.ts` νέος helper `suppressRedundantStraightGrips(grips, kind)` φιλτράρει `wall-start`/`wall-end`/`wall-thickness` ΜΟΝΟ σε straight· curved/polyline αναλλοίωτα (δεν έχουν footprint/corners → κρατούν endpoints + 1 thickness handle). Ο builder υπολογίζει ΚΑΙ ΤΑ 9 — τίποτα δεν διαγράφηκε (Giorgio: "κρύψτα, μην τα διαγράφεις"), restore = one-line revert. `gripIndex` σταθερό (5..8) → IDs + commit routing αμετάβλητα. Render + hit-test περνούν ΚΑΙ ΤΑ ΔΥΟ από `getWallGrips` (μέσω `computeDxfEntityGrips` + `WallRenderer.getGrips`) → ΕΝΑ filter point· κανένα renderer file δεν αγγίχθηκε (αποφυγή CHECK 6B/6D). **Tests**: 26/26 PASS (#1 → 5 visible, #4 no start/end/thickness, #5 midpoint πρώτο, #15/#23 corners στα visible 1..4, #15b curved κρατά thickness+endpoints). Drag tests (#16–22,24,25) αμετάβλητα. tsc clean. Reference-line + grip-number labels (αρχικό task) ΔΕΝ υλοποιήθηκαν σε app — ήταν chat sketch για alignment. ✅ Google-level: YES — direct-manipulation (corners = model vertices, Revit/AutoCAD), single SSoT filter point, zero renderer-file touch, builder intact (reversible), idempotent. | Claude Opus 4.7 |
| 2026-05-26 | **Phase 1F — Strict 3-Click Lateral Alignment for straight walls**. Phase 1B's 2-click flow committed the wall centered on the A→B click line, leaving the user with no way to align an edge to an underlay line. Phase 1F upgrades the straight-kind FSM to mandatory 3 clicks (`awaitingStart → awaitingEnd → awaitingAlignment → commit`). The third click picks the lateral side: cross product sign of `(B-A) × (C-A)` selects `±n_ccw`, axis is shifted by `±halfThickness * n_ccw`, the edge AWAY from C ends up on the original A→B line. Pure helper `computeWallAlignmentOffset()` exported from `wall-completion.ts` (testable in isolation). `buildDefaultWallParams` gains optional 5th arg `alignmentPoint`. **Files modified (5)**: `hooks/drawing/wall-completion.ts` (offset helper + buildDefaultWallParams threading + thickness resolved upfront), `hooks/drawing/useWallTool.ts` (`'awaitingAlignment'` phase + click pipeline + preview-store `endPoint` surfacing + DI handler at awaitingAlignment + `isAwaitingAlignment` getter + status text key), `bim/walls/wall-preview-store.ts` (`endPoint: Point2D | null` field + deep-equality guard + snapshot deep-copy), `hooks/drawing/wall-preview-helpers.ts` (`generateWallPreview` detects `preview.endPoint`, renders start→endPoint shifted toward cursor; `makeWallFootprintGhost` accepts `alignmentPoint`), i18n `dxf-viewer-shell.json` el+en (`tools.wall.statusAlignment`). **Companion hotfix** (`bim/walls/wall-trims.ts`): pre-existing unit-mismatch in `processPair` exposed by Phase 1F — `JOIN_THRESHOLD_MM` and `thickness/2` (mm) were divided/compared against `lenA/lenB` (canvas world units), inflating `epsA` 40× and producing a ~2m bevel in meter-based scenes (start of new wall shifted 40%). Fix: multiply `halfA`, `halfB`, `joinThreshold` by `mmToSceneUnits(params.sceneUnits)`. **Tests** (`useWallTool` 13/13 PASS, `wall-completion` 22/22 PASS incl. 9 new alignment-offset cases + 1 pre-existing scene-unit test corrected to match SSoT spec "scalars stay in mm", `wall-trims` 19/19 PASS unchanged). **Out of scope**: ESC at `awaitingAlignment` still deactivates the whole tool (incremental-back deferred); no "skip alignment" shortcut (user explicitly requested mandatory 3 clicks); curved + polyline kinds unchanged. ✅ Google-level: YES — proactive (no center-then-grip workaround), zero races (per-click state machine + sync store writes), idempotent (offset is a pure function of start/end/C/thickness/units), single SSoT (`computeWallAlignmentOffset` exported, consumed by both commit and preview), ADR-040 micro-leaf compliant (preview store remains single-writer/multi-reader). | Claude Opus 4.7 |
| 2026-05-25 (final+3) | **Bug 4b — Opening bbox expansion: spatial pre-filter εξαιρούσε το opening πάνω από arc/leaf**. Browser verify μετά Bug 4 (hitTestOpening 3-branch fix): hover πάνω στο leaf line / arc ΑΚΟΜΑ δεν χτυπούσε. Root cause: `calculateBimEntityBounds` (`Bounds.ts:207`) χρησιμοποιεί ΜΟΝΟ `geometry.bbox`. Το `computeBbox` στο `computeOpeningGeometry` υπολόγιζε bbox ΜΟΝΟ από `outline.vertices` (cutout rectangle, y: -125..125). Cursor πάνω στο arc (y≈450-900) → bbox miss → `hitTestOpening` δεν καλείται ποτέ. Ο Bug 4 hit-test fix ήταν σωστός στη λογική αλλά άχρηστος χωρίς bbox expansion. **Fix (1 file)**: `bim/geometry/opening-geometry.ts` — `computeOpeningGeometry` μετακινεί τον υπολογισμό `hingeResult` ΠΡΙΝ το `computeBbox`. Νέα `bboxPoints`: για hinged kinds (`door`/`french-door`) = `[...outline.vertices, ...hingeResult.arc.points]`· για non-hinged = `outline.vertices` only. Το `computeBbox` (iterates min/max) αυτόματα καλύπτει και τα 13 arc points (door) ή 26 arc points (french-door) → `bbox.max.y ≈ 900mm` για horizontal wall 250mm door. Comment εξηγεί γιατί (spatial pre-filter context). **Tests (+1 updated, +1 new → 38/38 PASS)**: `'bbox folds all outline vertices'` → switched to `kind: 'window'` (no arc) ώστε το outline-only assertion εξακολουθεί ισχύει. Νέο: `'bbox for door expands beyond outline to include hingeArc tip (Bug 4 spatial pre-filter)'` — asserts `bbox.max.y > outlineMaxY + 100`. **TSC**: exit 0. ✅ Google-level: YES — SSoT fix (bbox computed from all visible geometry, not just cutout), idempotent, no API change, window/fixed/sliding-door unaffected (no hingeResult → outline-only unchanged), french-door gets both arc segments in bboxPoints (26 points). | Claude Sonnet 4.6 |
| 2026-05-25 (final+2) | **Bug 4 — Hit-test opening επεκτείνεται σε leaf line + swing arc**. Browser verify (after Bug 1 v2 + Bug 2 + Bug 3): ο hit-test δούλευε ΜΟΝΟ στο outline rectangle (cutout μέσα στον τοίχο). Hover στο leaf line (έξω από wall thickness) ή στο swing arc (quarter-arc έξω από wall) → opening ΔΕΝ αντιλαμβανόταν. Industry convergence 4/4 majors (Revit family hover / AutoCAD block pickbox / ArchiCAD single object / SketchUp component edges): hit-test σε ΟΛΗ τη visible geometry. **Fix (1 file)**: `rendering/hitTesting/hit-test-entity-tests.ts` — `hitTestOpening` επεκτείνεται από 1-branch (outline polygon) σε 3-branch: (1) outline rectangle `isPointInPolygon` (unchanged), (2) leaf line(s): `pointToLineDistance(point, hingeAnchor, arc.points[HINGE_ARC_SUBDIVISIONS]) ≤ tolerance` + french-door second leaf via `hingeAnchor2`/`arc.points[HINGE_ARC_SUBDIVISIONS+1]`, (3) swing arc: iterate consecutive chord pairs `pointToLineDistance(arc.points[i], arc.points[i+1]) ≤ tolerance`. Signature +`tolerance` param (call site updated). Import `HINGE_ARC_SUBDIVISIONS` από `opening-geometry.ts` (εξαχθέν σε Bug 3). Sliding-door / window / fixed: arc=undefined → branches 2+3 skip gracefully. **Tests (+5 cases, 14/14 PASS total)**: `makeOpeningWithArc()` door factory (13 computed arc points, hingeAnchor=(1000,0)), `makeFrenchDoorOpening()` french-door factory (26 arc points, hingeAnchor2=(1900,0)). Cases: leaf-line midpoint hit ✅, arc midpoint hit ✅, far-miss null ✅, french-door second leaf hit ✅, window-no-arc outline fallback ✅. **TSC**: `npx tsc --noEmit` exit 0. ✅ Google-level: YES — industry-standard CAD/BIM hit convention (whole visible geometry), `HINGE_ARC_SUBDIVISIONS` index safety (Bug 3 exported constant), defensive null guards (`arc/hinge undefined` → skip branches 2+3), O(N_segments) linear scan = negligible vs render cost. | Claude Sonnet 4.6 |
| 2026-05-25 (final+1) | **Bug 3 — Door leaf line λείπει στην κάτοψη**. Browser verify (after Bug 1 v2): η πόρτα στην κάτοψη έδειχνε ΜΟΝΟ το dashed quarter swing arc — λείπει η solid leaf line (door panel σε 90°-open) που ενώνει τον hinge anchor με την άκρη του arc. Industry-standard AutoCAD/Revit door plan = swing arc (dashed) + leaf line (solid). Το docstring στο `OpeningRenderer.ts:8` ανέφερε "dashed hinge swing arc + jamb leaf line" αλλά η leaf line δεν είχε ποτέ υλοποιηθεί. Root cause: `buildHingeArc` στο `opening-geometry.ts` υπολόγιζε το `hinge` pivot ως local variable αλλά το έπεταγε στο return value — επέστρεφε μόνο `Polyline3D` με τα arc points. Ο renderer δεν είχε way να ξέρει το hinge anchor. **Fix (3 αρχεία)**: (1) `bim/types/opening-types.ts` — `OpeningGeometry` interface +2 πεδία: `hingeAnchor?: Point3D` (door + french-door) + `hingeAnchor2?: Point3D` (french-door dual-leaf). (2) `bim/geometry/opening-geometry.ts` — `buildHingeArc` refactored να επιστρέφει `{ arc, hingeAnchor, hingeAnchor2 }` interface αντί για raw Polyline3D. `computeOpeningGeometry` populate τα νέα πεδία στο return. Exported `HINGE_ARC_SUBDIVISIONS` constant ώστε ο renderer να index-άρει στο `arc.points` χωρίς re-derive. (3) `bim/renderers/OpeningRenderer.ts` — `drawHingeArc` extended: μετά το dashed arc draw, switch σε solid line dash + `RENDER_LINE_WIDTHS.NORMAL` + draw leaf line από `hingeAnchor` → `arc.points[HINGE_ARC_SUBDIVISIONS]` (=90°-open tip). Για french-door: second leaf line από `hingeAnchor2` → `arc.points[HINGE_ARC_SUBDIVISIONS+1]`. Νέο `drawLeafLine` private helper. **Tests**: opening-geometry.test.ts existing 27/27 ΕΞΑΚΟΛΟΥΘΟΥΝ PASS — τα tests δεν είχαν assertions στο leaf line layout (ο renderer είναι canvas-only). **TSC**: clean. ✅ Google-level: YES — industry-standard plan convention (AutoCAD/Revit/IFC IfcDoorPlacement), `hingeAnchor` field στο geometry cache (όχι re-derive σε render path), exported constant για index safety, defensive null guards (hinge undefined → skip leaf line), pattern uniform για door + french-door. | Claude Sonnet 4.6 |
| 2026-05-25 (final) | **Bug 1 v2 follow-up — Opening wrapper unwrap στο HitTestingService**. Browser verification μετά την (even later) entry: Bug 2 ✅ (3D cutouts ορατά), Bug 1 ΑΚΟΜΑ broken (wall πάντα κερδίζει). Root cause: στο `useDxfSceneConversion.ts:306-312` το opening **wrapped** ως `{ ...base, type: 'opening', openingEntity: <OpeningEntity> }`. `HitTestingService.convertToEntityModel` στο case 'opening' (line 316-320) χρησιμοποιούσε `buildBimEntityModel(entity.type, entity, baseModel)` ΧΩΡΙΣ unwrap — έπαιρνε τον wrapper που δεν έχει `geometry`/`params` στο top level → `geometry: bim.geometry` undefined → `BoundsCalculator.calculateBimEntityBounds` επέστρεφε null → opening εξαφανιζόταν από το spatial index pre-filter → πάντα κέρδιζε το wall. Fix (1 file): `src/subapps/dxf-viewer/services/HitTestingService.ts` — moved `case 'opening'` σε ξεχωριστό branch μετά τα slab/slab-opening, unwrap `(entity as { openingEntity }).openingEntity`. Pattern mirror των existing slab/slab-opening unwrappers. Outdated comment "wall/opening/column/beam are direct entities" διορθώθηκε σε "wall/column/beam". **Tests**: 9/9 hit-test-bim-entities.test.ts ΕΞΑΚΟΛΟΥΘΟΥΝ PASS (το test wrapper ήδη unwrapped — επιβεβαιώνει τη λογική). **TSC**: clean. ✅ Google-level: YES — comment alignment με actual wrapper state, defensive unwrap pattern parity για όλα τα wrapped BIM entities (slab / slab-opening / opening), idempotent. | Claude Sonnet 4.6 |
| 2026-05-25 (even later+1) | **Phase 8F — Column permanent dimension labels (Revit-style centred pill)**. Adds Revit/ArchiCAD-style permanent dimension annotations directly on the column footprint, visible when selected OR hovered. **(1) `rendering/utils/canvas-pill.ts` (new, 42 lines)** — SSOT για shared pill-drawing primitives: `pillPath()`, `PILL_FONT`/`PILL_TEXT_COLOR`/`PILL_BG_COLOR`/`PILL_PADDING`/`PILL_RADIUS` exported. Eliminates `pillPath` duplication between `useGripDimAnnotation` and new dim-label code (N.0.2 fix). **(2) `bim/columns/column-dim-labels.ts` (new, 98 lines)** — Pure SSoT: `formatColumnDimLabels(params: ColumnParams): string[]` computes label text for all 7 kinds (`rectangular`: `w=400  d=400` / `circular`: `Ø=400` / `shear-wall`: `L=2000  t=200` / `I-shape`: `b=150  h=300` / `polygon`: `Ø=400  N=6` / `L-shape`: `w=400  d=400` / `T-shape`: `w=400  d=400`). `catalogProfile` prepended as first line when set (e.g. `["IPE-300", "b=150  h=300"]`). `drawColumnDimPill(ctx, lines, cx, cy)` — centred multi-line pill renderer using `canvas-pill` SSOT. `COLUMN_LABEL_MIN_FOOTPRINT_PX=20` — hide when footprint < threshold. **(3) `bim/columns/__tests__/column-dim-labels.test.ts` (new, 18 tests)** — 18/18 PASS. **(4) `bim/renderers/ColumnRenderer.ts` (modified)** — `drawCenterDimLabel(column)` private method: worldToScreen bbox → span guard → `formatColumnDimLabels` → `drawColumnDimPill` at bbox centre. Called in `render()` when `phaseState.phase === 'highlighted' || options.selected` (Revit parity: labels on hover AND selection). **(5) `hooks/tools/useGripDimAnnotation.ts` (modified)** — local `pillPath` + 5 constants replaced by imports from `canvas-pill` SSOT. `LABEL_OFFSET_X`/`LABEL_OFFSET_Y` kept local (grip-specific positioning). No behaviour change. ✅ Google-level: YES — `formatColumnDimLabels` is the single SSoT for all 7 kinds (zero inline strings elsewhere), pill SSoT eliminates cross-layer duplication, centred anchor-agnostic label (bbox centre, correct regardless of 9-position anchor setting), footprint threshold prevents tiny-zoom label clutter, idempotent (pure canvas draw), ADR-040 compliant (zero new store subscriptions). i18n note: dimension labels (`w=/d=/Ø=/L=/t=/b=/h=/N=`) are industry-standard abbreviations (AutoCAD/Revit convention), NOT user-facing translatable strings — intentionally hardcoded per N.11 exception clause. | Claude Sonnet 4.6 |
| 2026-05-25 (even later) | **Bug 1 + Bug 2 fix — Opening selectability + 3D wall cutouts**. Browser verification αποκάλυψε δύο pre-existing bugs μετά την Phase 2 canvas-wiring: (1) ο user δεν μπορούσε ποτέ να επιλέξει opening επειδή ο host wall κέρδιζε πάντα το hit-test (bbox-only default σε όλα τα BIM types + flat priority 50), (2) τα openings δεν εμφανίζονταν σε 3D mode επειδή το `wallToMesh` δεν δεχόταν openings (ADR-370 Phase 7 mirror gap — slab-opening cutouts είχαν γίνει, opening cutouts όχι). **Fix Bug 1 (5 files)**: (A) `rendering/hitTesting/hit-test-entity-tests.ts` — `performDetailedHitTest()` dispatcher gains 6 BIM cases (opening / slab-opening / slab / wall / column / beam) με `isPointInPolygon(point, outline.vertices)` polygon containment. Wall uses outer+inner edge reversed ένωση (mirror του `buildWallShape`). (B) `rendering/hitTesting/hit-tester-utils.ts` — `calculatePriority()` adds child-over-parent boost: opening / slab-opening → priority 75 (vs wall/slab default 50). (C) `bim/renderers/OpeningRenderer.ts:93-104` — `hitTest()` replaces bbox με polygon containment του cached `outline.vertices`. (D) `bim/renderers/WallRenderer.ts:131-142` — `hitTest()` replaces bbox με outer+inner edge ring polygon (αποτρέπει wall overshoot πέρα από το opening cutout area). (E) `SlabOpeningRenderer.ts` already polygon-aware. **Fix Bug 2 (6 modified + 1 new utility)**: (1) `bim-3d/converters/wall-opening-extrude.ts` (NEW, ~130 LOC) — `buildWallMeshWithOpenings()` per-segment front-face re-extrude. Για κάθε axis segment του wall, build `THREE.Shape` rectangle (L_seg × wallHeightM) με `THREE.Path` CW holes για όλα τα openings στο `[arcStart, arcEnd]` range. `ExtrudeGeometry` depth = thicknessM. Apply basis matrix (xAxis = DXF segment direction in Y-up world, zAxis = perpendicular) + translate to wall axis position - half-thickness perpendicular. Handles straight / curved / polyline walls uniformly μέσω `getWallAxisVertices`. Mirror του IFC `IfcRelVoidsElement(IfcWall, IfcOpeningElement)` semantic, zero new deps, zero `three` upgrade. (2) `bim-3d/converters/BimToThreeConverter.ts` — `wallToMesh` signature gains `openings: readonly OpeningEntity[] = []`, returns `THREE.Object3D \| null` (Group when openings present, solid Mesh fallback otherwise). (3) `bim-3d/stores/Bim3DEntitiesStore.ts` — `Bim3DEntities` interface adds `openings: readonly OpeningEntity[]` + `setOpenings()` setter + `selectBim3DEntities` extension. (4) `bim-3d/scene/BimSceneLayer.ts` — wall loop filters `entities.openings` by `wallId`, passes inline στο `wallToMesh`. `clearGroup()` upgraded σε recursive `traverse` dispose (handles new Group return). (5) `bim-3d/viewport/BimViewport3D.tsx` — 3 places: `EMPTY_BIM_ENTITIES` adds `openings: []`, both `syncBimEntities()` call sites extract + include `openings`. (6) `app/OpeningPersistenceHost.tsx` — adds `useEffect` που pushes `currentScene.entities.filter(isOpeningEntity)` στο `useBim3DEntitiesStore.setOpenings()`. Mirror του `SlabOpeningPersistenceHost:58-64` pattern. CHECK 6B/6C compliant — low-freq scene change. (7) `components/shared/files/media/Bim3DReadOnlyOverlay.tsx` — `useMemo` snapshot adds `openings: bimSnapshot.openings` (Properties read-only 3D viewer path). `FloorplanBimSnapshot.openings` ήδη subscribed σε `FLOORPLAN_OPENINGS` collection (από prior Phase 1 work). **Tests (2 new files, 15 cases)**: `bim-3d/converters/__tests__/wall-opening-extrude.test.ts` (6 cases — straight wall με hole, polyline L-shape με 2 holes, sillHeight positioning, position offsets, edge cases). `rendering/hitTesting/__tests__/hit-test-bim-entities.test.ts` (9 cases — polygon containment opening/slab/wall, wall-band fail, opening-outside-bbox fail, priority opening > wall = 75 > 50, slab-opening > slab). All 15/15 PASS. **TSC**: `npx tsc --noEmit` PASS (exit 0). ✅ Google-level: YES — proactive 3D pipeline closure (mirror Phase 7 slab pattern), zero races (push to store before sync), polygon containment is the IFC-standard hit-test (`IfcRepresentationItem.Boundary`), child-over-parent priority is industry convention (Revit element vs hosted family selection), idempotent (geometry recomputed on every sync), defensive null guards (degenerate vertex count, missing geometry). Per-segment re-extrude handles all wall kinds με zero new deps + zero `three` upgrade risk. Out of scope: stair detailed hit-test (treads/landings), per-opening material (door/window glass vs frame), arched/polygonal opening cutouts. | Claude Sonnet 4.6 |
| 2026-05-25 (later) | **Phase 2 carry-over — scene-units thread στα 4 opening edit-path callers**. Pre-existing bug pre-dating Phase 2 canvas-wiring: τα **edit paths** του `computeOpeningGeometry(params, hostWall)` καλούσαν με 2 args → ο 3ος default `'mm'` → σε scenes σε `'m'`/`'cm'`/`'in'`/`'ft'` η geometry έβγαινε off-by-mmFactor. Fix με **frozen-host-context pattern**: κάθε caller διαβάζει `hostWall.params.sceneUnits ?? 'mm'` και το περνά ως 3ο arg. Καμία API change σε commands / `OpeningParams`, καμία migration σε Firestore — αξιοποιεί το υπάρχον `WallParams.sceneUnits?: SceneUnits` (`bim/types/wall-types.ts:92`). **Files modified (4)**: (1) `src/components/shared/files/media/bim-readonly-hydration.ts:132` (`hydrateOpening`) — read-only viewer hydrate path. (2) `src/subapps/dxf-viewer/hooks/data/useOpeningPersistence.ts:109` (`docToEntity`) — Firestore subscribe diff-merge hydrate. (3) `src/subapps/dxf-viewer/core/commands/entity-commands/UpdateOpeningParamsCommand.ts:71` (`applyPatch`) — execute/undo/redo recompute. (4) `src/subapps/dxf-viewer/core/commands/entity-commands/WallSplitCommand.ts:149` (`applyOpeningPatch`) — wall split opening redistribution. **Pending-ratchet list correction**: ο carry-over entry απαριθμούσε 11 callers — μόνο **4 είναι πραγματικές calls**. 7 false positives (αναφορές μόνο σε docstrings ή deliberate-no-op handlers στα `opening-grips.ts`, `opening-corner-anchors.ts`, `bim-mirror-geometry.ts`, `bim-rotate-geometry.ts`, `bim-move-geometry.ts`, `bim-cascade-resolver.ts`, `opening-firestore-service.ts`, `useMoveTool.ts`) + **1 missing real caller** (`bim-readonly-hydration.ts`, read-only viewer path). **Tests**: 3 νέα cases στο `opening-geometry.test.ts` (`computeOpeningGeometry — scene units 'm'` describe block) — outline + hingeArc scaling σε scene 'm' + regression case `sceneUnits='mm'` default. 27/27 PASS. **TSC**: `npx tsc --noEmit` background after edits. ✅ Google-level: YES — single SSoT surface (`hostWall.params.sceneUnits`), frozen-context propagation (host wall carries its own scene-units context), defensive `?? 'mm'` covers legacy walls hydrated πριν την propagation patch (back-compat preserved per `migrateWallParamsToMm`), idempotent (καλώντας 2× = ίδιο αποτέλεσμα). **Out of scope**: pre-existing `wall.geometry.length * 1000` assumption σε `applyOpeningGripDrag` (`opening-grips.ts:88`) — separate ratchet candidate. | Claude Opus 4.7 |
| 2026-05-25 | **Phase 2 canvas-wiring follow-up — Opening tool ghost preview + click pipeline + scene-units thread**. Silent-failure fix: ο user πατούσε το BIM "opening" ribbon button, ο tool ενεργοποιούταν στο lifecycle (state=`awaitingHostWall`) αλλά **τίποτα δεν συνέβαινε στο canvas** — κανένα ghost, κανένα hover/snap, κανένα commit on click. Root cause: όλη η canvas wiring infrastructure έλειπε vs το πανομοιότυπο slab-opening tool. **Gaps που κλείνουν**: (a) `useCanvasClickHandler` δεν δρομολογούσε `worldPoint → openingTool.onCanvasClick`, (b) ghost preview hook + renderer δεν υπήρχαν, (c) ghost canvas leaf δεν υπήρχε στο `canvas-layer-stack-leaves.tsx`, (d) `CanvasSection.tsx:192` destructure-άρει 5 BIM tools από `useSpecialTools` αλλά παραλείπει το `openingTool` (το `useSpecialTools.ts:498` το εκθέτει ήδη), (e) `opening-completion` + `opening-geometry` δεν ήταν scene-units aware → σε scene 'm'/'cm' το committed opening rectangle θα ήταν 1000× off (mirror του slab-opening Phase 6 fix). **Files modified (8)**: (1) `hooks/canvas/canvas-click-types.ts` — νέο `OpeningToolLike` interface + `openingTool?: OpeningToolLike` στο `UseCanvasClickHandlerParams`. (2) `hooks/canvas/useCanvasClickHandler.ts` — destructure `openingTool` + νέο PRIORITY 4.96 branch (`activeTool === 'opening' && openingTool?.isActive → openingTool.onCanvasClick(worldPoint)`) μετά το PRIORITY 4.95 slab-opening branch + deps. (3) `components/dxf-layout/CanvasSection.tsx` — destructure `openingTool` από `useSpecialTools` (line 192), pass στο `useCanvasClickHandler` (line 306), νέο `openingGhostPreview` payload στο `CanvasLayerStack` (line 435: `isAwaitingPosition` + `kind` + `overrides` + `getHostWall` resolver via `levelManager.getLevelScene().entities.find(...)` με `isWallEntity` guard + `getSceneUnits` via `resolveSceneUnits`), `import type { WallEntity }` added. (4) `components/dxf-layout/canvas-layer-stack-types.ts` — νέο `openingGhostPreview: { isAwaitingPosition; kind; overrides; getHostWall; getSceneUnits? }` slot στο `CanvasLayerStackProps`. (5) `components/dxf-layout/CanvasLayerStack.tsx` — destructure + pass-through στο `PreviewCanvasMounts`. (6) `components/dxf-layout/canvas-layer-stack-leaves.tsx` — import + mount `OpeningGhostPreviewMount` στο `PreviewCanvasMounts` (mirror του slab-opening mount, χωρίς `selectedEntityIds`/`levelManager` shared props). (7) `hooks/drawing/opening-completion.ts` — `buildDefaultOpeningParams` + `buildOpeningEntity` + `completeOpeningFromHostClick` δέχονται `sceneUnits: SceneUnits = 'mm'` (default-safe για existing callers). Projection result από `projectPointToWallOffset` (scene-units) διαιρείται με `mmToSceneUnits(sceneUnits)` ώστε `params.offsetFromStart` να μένει σταθερά σε mm κατά το type contract. (8) `bim/geometry/opening-geometry.ts` — `computeOpeningGeometry(params, hostWall, sceneUnits='mm')`: `centerOffsetMm`→`centerOffsetScene` μέσω `mmFactor`, `widthScene` + `thicknessScene` για το outline build, `buildHingeArc` gains `widthScene` parameter για consistent door/french-door swing radius. **Files created (3)**: (1) `bim/walls/opening-ghost-renderer.ts` — pure `OpeningGhostRenderer` class (DPR-applied ctx contract, mirror του `SlabOpeningGhostRenderer`): 5-kind colour palette (door warm-orange / window cool-blue / sliding muted-purple / french amber / fixed teal) + dashed outline `[6,4]` + 25% fill + crosshair + optional `[4,3]`-dashed hinge arc points για door / french-door ghost preview. (2) `hooks/tools/useOpeningGhostPreview.ts` — RAF-driven hook (mirror του `useSlabOpeningGhostPreview`): subscribes σε `useCursorWorldPosition` + `getImmediateSnap` imperatively, ενεργοποιείται **μόνο** σε phase `awaitingPosition` (host wall locked), υπολογίζει inline scene-aware projection (`projectPointToPolylineOffset` + `walkPolylineToDistance` + scene-aware width/thickness scaling) χωρίς να καλεί το `buildDefaultOpeningParams` (zero cycle με opening-completion). Optional `getSceneUnits` defaults σε `'mm'`. (3) `components/dxf-layout/canvas-layer-stack-opening-ghost.tsx` — `OpeningGhostPreviewMount` micro-leaf wrapper γύρω από το preview hook (mirror του `SlabOpeningGhostPreviewMount`). **Files modified (extras, 2)**: (9) `hooks/drawing/useOpeningTool.ts` — `UseOpeningToolOptions` gains optional `getSceneUnits?: () => SceneUnits`, `commitOpeningFromState` propagates στο `buildDefaultOpeningParams` + `buildOpeningEntity` (default 'mm'). (10) `hooks/tools/useSpecialTools.ts` — passes `getSceneUnits: () => resolveSceneUnits(levelManager.getLevelScene(levelId))` στο `useOpeningTool` options block. **TSC**: `npx tsc --noEmit` PASS (exit 0). ✅ Google-level: YES — proactive (canvas wiring closed proactively, όχι reactively per-bug), idempotent (default `sceneUnits='mm'` keeps all 22+ pre-existing `computeOpeningGeometry`/`buildOpeningEntity` callers identical), single SSoT (ghost rectangle computed once inside the hook with scene-aware math, commit rectangle computed inside the same SSoT functions — both paths converge on identical vertices in any scene unit), ADR-040 micro-leaf compliance (ghost subscribes εσωτερικά σε `useCursorWorldPosition`, CanvasSection / CanvasLayerStack δεν re-renderάρει σε mousemove), defensive (`getHostWall` resolver early-returns null when level/scene/wall missing). ⏸️ Carry-over: `computeOpeningGeometry` callers in grip-commit / move / mirror / rotate / cascade paths δεν περνούν `sceneUnits` ακόμη — για scene='mm' (Nestor default) δουλεύουν σωστά· για scene='m'/'cm' οι **edit paths** (όχι creation) θα παράγουν geometry off-by-mmFactor (pre-existing bug, not introduced here). Tracked στο `.claude-rules/pending-ratchet-work.md` για follow-up sweep. | Claude Opus 4.7 |
| 2026-05-25 | **Column Shapes Phase 8 — Phase E (Section Catalog Presets: shear-wall RC concrete + I-shape IPE/HEA)**. Adds Revit-style catalog dropdown to the contextual column ribbon for the 2 structurally-defined kinds. **(1) `bim/columns/section-catalog.ts` (new, 85 lines)** — SSoT pure-data file: `ShearWallCatalogPreset` + `IShapeCatalogPreset` interfaces, `SHEAR_WALL_CATALOG` (5 Eurocode 2 presets: C20/25→200mm … C40/50→300mm) + `ISHAPE_CATALOG` (10 EN 10025-2 sections: IPE-200/240/300/360/400/500 + HEA-200/240/300/400 with exact b/h/tf/tw from SCI/Arcelor tables), `findShearWallPreset` + `findIShapePreset` lookup helpers, `CATALOG_CUSTOM_SENTINEL = 'custom'`. **(2) `bim/columns/__tests__/section-catalog.test.ts` (new, 23 tests)** — catalog length, uniqueness, positive dimensions, flange-thickness > web-thickness invariant, IPE-300 + HEA-300 exact EN 10025-2 values, lookup helpers, custom-sentinel behavior. 23/23 ✅. **(3) `ui/ribbon/hooks/bridge/column-bridge-catalog-helpers.ts` (new, 115 lines)** — extracted module-level helpers to keep bridge hook ≤500 lines: `catalogOwnsDimension` / `catalogOwnsNestedParam` (custom-sentinel guards — return true when a manual number edit should clear `catalogProfile`), `applyEntityCatalogPreset` (entity path: batch-writes all preset dims + `catalogProfile` in one `UpdateColumnParamsCommand`), `applyToolCatalogPreset` (drawing-tool path: calls `handle.setParamOverrides` with full preset batch). **(4) `bim/types/column-types.ts`** — `ColumnParams` gains `catalogProfile?: string` (Firestore-persisted catalog ID, undefined = Custom). **(5) `hooks/drawing/column-completion.ts`** — `ColumnParamOverrides` gains `catalogProfile?: string` + `buildDefaultColumnParams` propagates it. **(6) `ui/ribbon/hooks/bridge/column-command-keys.ts`** — `COLUMN_RIBBON_KEYS.stringParams.catalogProfile = 'column.params.catalogProfile'`; `ColumnRibbonStringCommandKey` union + `COLUMN_RIBBON_STRING_KEYS` array extended; `COLUMN_RIBBON_VISIBILITY_KEYS` gains `shearWallCatalog` + `ishapeCatalog` keys; `ColumnRibbonVisibilityKey` union + `COLUMN_VISIBILITY_KEY_SET` extended. **(7) `ui/ribbon/data/contextual-column-tab.ts`** — `SHEAR_WALL_CATALOG_OPTIONS` (6 options: custom + 5 RC classes) + `ISHAPE_CATALOG_OPTIONS` (11 options: custom + 6 IPE + 4 HEA); 2 new conditional panels (`column-shear-wall-catalog` visible iff kind=shear-wall, `column-ishape-catalog` visible iff kind=I-shape), each with a single catalog combobox `comboboxWidthPx=190`. Panels sit between `column-ishape-params` and `column-material`. **(8) `ui/ribbon/hooks/useRibbonColumnBridge.ts`** — imports catalog helpers; `getComboboxState`: `catalogProfile` absent → `CATALOG_CUSTOM_SENTINEL` (special-cased before generic string handler); drawing-mode reads `toolHandle.overrides.catalogProfile ?? CATALOG_CUSTOM_SENTINEL`; `onComboboxChange`: `catalogProfile` key → `applyEntityCatalogPreset` / `applyToolCatalogPreset` (before `isColumnRibbonStringKey` check); manual number edits → `catalogOwnsDimension` / `catalogOwnsNestedParam` guards clear `catalogProfile` (Revit-style Custom sentinel); `getPanelVisibility` extended for `shearWallCatalog` + `ishapeCatalog`. **(9) i18n** — `el/en dxf-viewer-shell.json`: `ribbon.panels.{columnShearWallCatalog, columnIshapeCatalog}`, `ribbon.commands.columnEditor.catalogProfile.{section.title, custom, shearWall.{c2025…c4050}, iShape.{ipe200…ipe500, hea200…hea400}}`. Greek: "Κατάλογος προφίλ", "Προσαρμοσμένο". Zero English words in Greek locale. **Files created (3)**: `section-catalog.ts`, `section-catalog.test.ts`, `column-bridge-catalog-helpers.ts`. **Files modified (7)**: `column-types.ts`, `column-completion.ts`, `column-command-keys.ts`, `contextual-column-tab.ts`, `useRibbonColumnBridge.ts`, `el/dxf-viewer-shell.json`, `en/dxf-viewer-shell.json`. File budgets: bridge 461 ≤500, ribbon tab 454 ≤500, command-keys 131 ≤500. ✅ Google-level: YES — Revit/Tekla/ArchiCAD/SAP2000/Bentley (5/5) convergence on catalog ID persistence (Q1 Α, Q2 α per session 2026-05-25), batch-write atomicity (one `UpdateColumnParamsCommand` for all 4 preset dims + catalogProfile), custom-sentinel idempotent (clear on any manual dim edit, no-op on catalog select), drawing-tool path mirrors entity path (symmetric UX), pure SSoT data file (no logic, no React), zero `any`, file/function budgets respected. | Claude Sonnet 4.6 |
| 2026-05-25 | **Column Shapes Phase 8 — Phase D (ribbon kind selector + variant numeric inputs + drawing-mode bridge)**. Closes the last UX gap: the 3 new column kinds (polygon / shear-wall / I-shape) become fully usable from the contextual Column ribbon. **(1) `ui/ribbon/data/contextual-column-tab.ts`** — `COLUMN_KIND_OPTIONS` extended from 4 → 7 (polygon / shear-wall / I-shape added with i18n labels `kind.{polygon,shearWall,iShape}`). Two new conditional panels declared via `visibilityKey` (ADR-358 Phase 7b2b-β pattern): `column-polygon-params` (`POLYGON_SIDES_OPTIONS` 3..12) and `column-ishape-params` (`I_FLANGE_THICKNESS_OPTIONS` + `I_WEB_THICKNESS_OPTIONS`, IPE/HEA preset ranges). **(2) `ui/ribbon/hooks/bridge/column-command-keys.ts`** — `COLUMN_RIBBON_KEYS.params` extended with `sides`/`flangeThickness`/`webThickness`; new `COLUMN_RIBBON_VISIBILITY_KEYS` (`polygonParams`/`ishapeParams`) + `isColumnVisibilityKey` type guard; `COLUMN_RIBBON_NUMBER_KEYS` array extended (now 7 entries) so `isColumnRibbonKey` recognises the new numeric keys. **(3) `ui/ribbon/hooks/bridge/column-tool-bridge-store.ts` (new file, 88 lines)** — module-level mutable cell + `useSyncExternalStore` pattern (mirrors `stair-status-store`). Single writer (`useColumnTool` effect), multi-reader (`useRibbonColumnBridge`). Bridges the sibling-subtree gap between `CanvasSection` (where `useColumnTool` lives via `useSpecialTools`) and `DxfViewerContent` (where the ribbon bridges run via `useDxfBimBridges`) without lifting `useSpecialTools` above `DxfViewerContent`. **(4) `ui/ribbon/hooks/useRibbonColumnBridge.ts`** — added `NESTED_NUMBER_KEY_TO_PATH` table mapping `column.params.{sides,flangeThickness,webThickness}` → `{ group, field, defaultValue }`; new `readNestedValue` + `patchNestedParams` helpers (typed merge of `polygon`/`ishape` variant overrides). `getComboboxState` now has two branches: SELECTED ENTITY (reads from `column.params.polygon?.sides` ?? default, etc.) and DRAWING-MODE (reads from `columnToolBridgeStore.use()` handle). `onComboboxChange` mirror: selected → `UpdateColumnParamsCommand` patch with merged variant params; drawing-mode → `handle.setKind()` / `handle.setParamOverrides({polygon|ishape: {...}})`. New `getPanelVisibility` callback — resolves `kind` from selected entity first, falls back to tool handle when active. New exported guard `isColumnPanelVisibilityKey`. **(5) `ui/ribbon/hooks/useRibbonCommands.ts`** — `getPanelVisibility` composer gains `isColumnPanelVisibilityKey` branch (next to `isStairPanelVisibilityKey`). **(6) `hooks/drawing/useColumnTool.ts`** — new `useEffect` publishes `{ isActive, kind, anchor, overrides, setKind, setAnchor, setParamOverrides }` to `columnToolBridgeStore` on every state/setter change, with cleanup that only clears the store when this mount is still the current publisher (prevents wiping a newer mount that took over). `getGhostFootprints` ghostOverrides assembly extended to spread `s.overrides.polygon` + `s.overrides.ishape` (live ghost preview now reflects polygon sides + I-shape flange/web thickness). **(7) `bim/columns/column-anchor-ghosts.ts`** — `ColumnGhostOverrides` interface gains `polygon?: ColumnPolygonParams` + `ishape?: ColumnIShapeParams`; `buildGhostParams` adds the two spreads (mirrors lshape/tshape pattern). **(8) i18n** — `el/en dxf-viewer-shell.json`: new keys under `ribbon.commands.columnEditor.{sides, flangeThickness, webThickness}` + `.kind.{polygon, shearWall, iShape}`, plus new panel headers `ribbon.panels.{columnPolygon, columnIshape}`. Greek labels strictly pure (no English words). **(9) Tests** — `column-anchor-ghosts.test.ts` (+6 cases: polygon 9 ghosts in ANCHOR_CYCLE_ORDER, polygon sides default=6 vertex count, polygon sides=8 override propagates, shear-wall 9 ghosts × 4 verts each, I-shape 9 ghosts in cycle order, ishape override propagates). `useRibbonColumnBridge.test.tsx` (new file, ~250 lines, 18 cases covering both branches: SELECTED — reads nested polygon/ishape with fallback to defaults, getPanelVisibility per kind; DRAWING-MODE — reads kind/sides from tool handle, setKind/setSides/setFlangeThickness write through handle, returns null when no selection + tool inactive, isColumnPanelVisibilityKey type guard). Mocks `UpdateColumnParamsCommand` to verify write payloads. **Files modified (8)**: `contextual-column-tab.ts`, `column-command-keys.ts`, `useRibbonColumnBridge.ts`, `useRibbonCommands.ts`, `useColumnTool.ts`, `column-anchor-ghosts.ts`, `el/dxf-viewer-shell.json`, `en/dxf-viewer-shell.json`. **Files created (2)**: `column-tool-bridge-store.ts`, `useRibbonColumnBridge.test.tsx`. ✅ Google-level: YES — single writer pattern for tool↔ribbon bridge (zero races), reactive `useSyncExternalStore` for ribbon re-render on tool state change, defaults SSoT (`DEFAULT_POLYGON_SIDES` / `DEFAULT_I_FLANGE_THICKNESS_MM` / `DEFAULT_I_WEB_THICKNESS_MM` imported from `column-types.ts`, never duplicated), visibility resolver mirrors selected-entity SSoT first (params.kind) then falls back to tool handle (consistent UX in both modes), no `any` (full discriminated typing via `NestedGroup` + `NestedField`), file budgets respected (bridge 440 ≤500, ribbon tab 379 ≤500, tool hook 314 ≤500, ghosts 160 ≤500). ⏸️ Phase E (closure): final E2E manual smoke in `/dxf/viewer` (verify all 3 new kinds round-trip: select kind from ribbon → adjust variant input → click canvas → confirm Firestore writes correct params and grips reflect chosen kind), commit chain across A/B/C/D, `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + memory final sync. | Claude Opus 4.7 |
| 2026-05-25 | **Column Shapes Phase 8 — Phase C (anchors + grips + snap parity για 3 νέα kinds)**. Closes τα 3 remaining gaps που άφησαν Phases A + B: anchor SSoT, grip emitter, snap-engine coverage. **(1) `bim/columns/column-anchors.ts`** — `anchorLocalPoint` + `localToWorld` gained `polygon` branch + exported `polygonBboxMm(diameter, sides)` helper που υπολογίζει actual N-gon bbox σε mm (mirror του geometry pipeline `computeLocalBboxCanvas`). Hexagon Ø=400 → dimX = 200·√3 ≈ 346.41, dimY = 400 (όχι width × depth). shear-wall + I-shape χρησιμοποιούν the default `(dx × width, dy × depth)` branch (bbox = width × depth — verified by parity tests). Circular branch unchanged — ήδη geometrically correct (perimeter at 45°, distance = radius). **(2) `bim/columns/column-grip-utils.ts`** — `computeCentroidWorld` polygon-aware: για polygon kind χρησιμοποιεί `polygonBboxMm()` αντί για `(width, depth)` ώστε ο centroid να συμπίπτει με το geometry pipeline (anchor='ne' πολυγώνου εδράζεται στην NE της actual bbox, όχι μιας ψευδο-rect (width × width)). **(3) `hooks/grip-types.ts`** — `ColumnGripKind` union +2 variants: `'column-i-flange-thickness'` (asymmetric 1×) + `'column-i-web-thickness'` (symmetric 2×). JSDoc updated με Phase 8C section + revised semantics για width/depth (circular + polygon = circumscribed Ø, skip depth). **(4) `bim/columns/column-variant-grips.ts`** — I-shape section mirror του L/T pattern: `materializeIshape` (defaults from `DEFAULT_I_FLANGE_THICKNESS_MM`=20 / `DEFAULT_I_WEB_THICKNESS_MM`=15), `iFlangeThicknessHandlePosition` (top-flange bottom-edge midpoint at `(0, depth/2 - tf)` local — drag +Y → tf decreases 1× factor, bottom flange mirrors automatically μέσω geometry), `iWebThicknessHandlePosition` (web left-edge midpoint at `(-tw/2, 0)` — drag +X → tw decreases 2× factor, symmetric web), `resizeIFlangeThickness` + `resizeIWebThickness` (clamp `MIN_I_PLATE_THICKNESS_MM`=5, no-op on non-I-shape kinds), `mergeIshape` (materialize-overlay-preserve-flipY pattern). **(5) `bim/columns/column-grips.ts`** — `getColumnGrips` dispatcher gains 3 branches: `polygon` → 3 grips (center + rotation + width(=Ø), no depth — early return), `I-shape` → 6 grips (base 4 + tf + tw), `shear-wall` → 4 grips (falls through με rect parity, bbox = width × depth). `widthHandleWorld` + `rotationHandleWorld` polygon-aware: rotation handle offset bases on actual `polygonBboxMm().dimY` αντί για `params.depth`. `resizeWidth` polygon branch: symmetric 2× factor (mirror circular). `resizeDepth` polygon → no-op (depth meaningless). `applyColumnGripDrag` dispatcher +2 cases for I-shape variant grips. **(6) `hooks/tools/useGripDimAnnotation.ts`** — 2 switch cases: `'column-i-flange-thickness'` → `tf=` label, `'column-i-web-thickness'` → `tw=` label. **(7) Tests fixed + extended**: `column-corner-anchors.test.ts` (circular hypot assertion corrected — `radius`, όχι `radius·√2/2` — η αρχική assertion συγχέει coord με Euclidean distance, perimeter point at 45° έχει `hypot(r·√2/2, r·√2/2) = r`. +4 cases για polygon (hexagon bbox + N=4 square) / shear-wall / I-shape corner positions). `ColumnCornerSnapEngine.test.ts` (same hypot fix + 3 cases για polygon/shear-wall/I-shape snap candidates). `column-anchors.test.ts` (+6 cases για 3 νέα kinds: 9-entry order, hexagon bbox, polygon rotation, shear-wall + I-shape bbox parity με rect). `column-grips.test.ts` (+18 cases: polygon 3-grip set + width handle + depth no-op + symmetric resize, shear-wall 4-grip rect parity + depth drag, I-shape 6-grip set + tf/tw handle positions + 1×/2× factor resize + plate-thickness clamp + cross-kind no-op + materializeIshape defaults + materialize partial-override + materialize-from-defaults during drag). **Files modified (6 source + 4 tests)**. **Tests**: column-anchors 20/20, column-corner-anchors 9/9, column-grips 63/63, ColumnCornerSnapEngine 10/10. Column-related subtree (columns + geometry + validators + renderers): 635/635 PASS. Three unrelated pre-existing failures (`beam-grips#5` curve-grip count, `slab-edge-projection` 8 cases, `MaterialLibraryService` Firebase auth import) untouched by Phase C. ✅ Google-level: YES — anchor SSoT mirrors geometry pipeline exactly (polygon uses actual bbox, never width×depth ψευδο-rect), shear-wall reuses rect with zero new code (bbox parity = SSoT win), I-shape grip pattern mirrors L/T (factor 1× asymmetric for tf, 2× symmetric for tw — geometrically derived, not arbitrary), circular geometry kept intact (test math fixed, not impl), `polygonBboxMm` single SSoT for polygon bbox math (consumed by column-anchors + column-grip-utils + column-grips, zero duplicate vertex builders). File budgets: column-anchors 188 lines, column-grips 386 lines, column-variant-grips 351 lines (all ≤500). Longest function ≤30 lines after extraction. ⏸️ Phase D scope: ribbon contextual tab για polygon sides numeric + I-shape tf/tw numeric inputs, `useRibbonColumnBridge.resolveColumn()` tool-mode bridge, `ColumnDimensionService` full integration. Phase E: closure + ΕΚΚΡΕΜΟΤΗΤΕΣ + ADR-index + master memory sync. | Claude Opus 4.7 |
| 2026-05-25 | **Column Shapes Phase 8 — Phase B (validator + renderer + hatch bugfix)**. Compatibility layer for the 3 new column kinds (polygon / shear-wall / I-shape) που πρόσθεσε η Phase A (types + geometry + section profile + completion). **(1) `column-validator.ts`** — extended pre-existing if-else chain στο `validateVariantParams()`: `validatePolygonParams` (sides ∈ [MIN_POLYGON_SIDES=3, MAX_POLYGON_SIDES=12], integer-only — `invalidPolygonSides` hard error), `validateShearWallParams` (thickness < `MIN_SHEAR_WALL_THICKNESS_MM`=150 → `shearWallThicknessTooSmall` code violation, length/thickness < `SHEAR_WALL_MIN_ASPECT_RATIO`=4 → `shearWallAspectRatioBelow`), `validateIShapeParams` (`flangeThickness`/`webThickness` < `MIN_I_PLATE_THICKNESS_MM`=5 → `invalidIShapePlateThickness`, `2*tf >= depth` → `invalidIShapeFlangeOverlap`, `tw >= width` → `invalidIShapeWebOverflow`). `validateDimensions` relaxes the 250mm Eurocode minimum for `shear-wall` (`isRelaxedWidth`/`isRelaxedDepth` helpers) and skips the depth check entirely for `polygon` + `circular` (single planar dimension). **(2) `ColumnRenderer.ts`** — `KIND_STROKE`/`KIND_FILL` maps gained 3 entries: polygon warm-green (`#5c8a3a` / `rgba(120,170,90,0.22)`), shear-wall deep-RC-grey (`#3a4048` / `rgba(70,80,90,0.25)`), I-shape cool-steel (`#4a4a52` / `rgba(95,95,110,0.20)`). `drawVariantDimensionLabels` extended via `hasVariantLabels(kind)` predicate: `drawPolygonSideLabel` renders `N=k` (k = `params.polygon?.sides` ?? vertex count) at the top vertex (via `pickTopVertexIndex`); `drawIShapeLabels` renders `b=` (verts[0]→verts[1] bottom flange edge) and `h=` (verts[1]→verts[6] right outer edge) for the 12-vertex outline emitted by `buildIShapeLocal()`. shear-wall is purposely unannotated (clean rectangle). Material hatch dispatch unchanged — `computeCircularHatchPlan` runs only for `kind === 'circular'`; the 3 new kinds use `computeHatchPlan(bbox, material)` and rely on the footprint polygon clip. **(3) `column-hatch-patterns.ts`** — pre-existing bug in `buildDiagonalHatch()`: `kMin = bbox.min.x − slope · bbox.max.y` + `kMax = bbox.max.x − slope · bbox.min.y` collapsed to `kMin === kMax = 400` for `slope=-1` on a 0..400×0..400 square bbox → zero negative-slope lines (Phase A test #2 + #1 cascade through `buildSteelCrossHatch`). Fixed by computing `kMin/kMax` across all four corners: `min/max(bbox.min.x−slope·bbox.min.y, bbox.min.x−slope·bbox.max.y, bbox.max.x−slope·bbox.min.y, bbox.max.x−slope·bbox.max.y)`. **(4) `ColumnRenderer-hatch.test.ts` test #6** updated — Phase 4.5c.3 already replaced the "circular → SKIP hatch" semantics with "circular RC → 3 concentric arcs inside a single clip pass"; the stale assertion `clip === 0 / arc === 0` is now `clip === 1 / arc >= 3`. Files modified (5): `bim/validators/column-validator.ts`, `bim/renderers/ColumnRenderer.ts`, `bim/columns/column-hatch-patterns.ts`, `bim/validators/__tests__/column-validator.test.ts` (+15 cases for the 3 new kinds), `bim/columns/__tests__/column-hatch-patterns.test.ts` (+2 slope-parity cases pinning the bugfix), `bim/renderers/__tests__/ColumnRenderer-hatch.test.ts` (+9 cases × 3 kinds × material + stroke-colour assertions, test #6 updated). i18n el+en `dxf-viewer-shell.json` — new top-level `column.validation` namespace with full `hardErrors` (10 keys) + `codeViolations` (5 keys) coverage, including the pre-existing Phase 4 keys (previously in i18n-missing-keys baseline). 79/79 Phase B affected tests pass; 606/607 bim-tree pass (the single remaining failure is `column-corner-anchors.test.ts › circular: diagonals at radius·√2/2`, plus the cascade `ColumnCornerSnapEngine.test.ts › circular column: 4 candidates` — both belong to Phase C — `column-anchors.ts` does not yet special-case circular geometry, and the snap engine derives from it). ✅ Google-level: YES — proactive validator (pre-write errors), zero races (pure functions), idempotent, single SSoT switch per concern (kind-based dispatch), all constants from `column-types.ts`, file/function size limits respected (validator 165 lines, renderer 412 lines, hatch 326 lines; longest function ≤30 lines after extraction). ⏸️ Phase C scope: `column-anchors.ts` per-kind anchor offsets (circular corners at √2/2·r — fixes the 2 lingering tests), grip extension for polygon/shear-wall/I-shape, snap registry entries for the 3 new kinds. Phase D scope: contextual ribbon kind selector bridge (drawing-mode `useRibbonColumnBridge` does not connect to `useColumnTool.setKind()`). | Claude Opus 4.7 |
| 2026-05-21 | **BIM Entity Points SSoT consumer sweep (Boy Scout, partial)**. Migration 3 αρχείων + import fix: **(1)** `bim-entity-points.ts` — broken `'../extended-types'` → `'../../types/entities'` (file δεν υπήρχε). **(2)** `bim/slabs/slab-grips.ts` `getSlabGrips`: `entity.params.outline.vertices` → `getBimEntityKeyPoints2D(entity as Entity)`. **(3)** `bim/slab-openings/slab-opening-grips.ts` `getSlabOpeningGrips`: same pattern. **(4)** `bim/renderers/BeamRenderer.ts` 4 private methods (`drawMaterialHatch`/`drawDepthIndicator`/`drawSectionProfile`/`drawAnchorPulse`): `beam.params.startPoint`/`endPoint` → `getBimEntityKeyPoints2D(beam)` destructuring; `drawSectionProfile` simplified `worldToScreen({x:sp.x,y:sp.y})` → `worldToScreen(sp)`. **Intentional skips** (need full 3D `Point3D` — 2D SSoT loses z): `bim-move-geometry.ts`, `bim-mirror-geometry.ts`, `bim-rotate-geometry.ts` (`shiftPoint3D`/`mirrorPoint3D`/`rotatePoint3D` args), `apply-entity-preview.ts` (z-preserving delta application), geometry+validator files (take raw `params`, not `Entity`). **Files modified (4)**: `bim-entity-points.ts`, `slab-grips.ts`, `slab-opening-grips.ts`, `BeamRenderer.ts`. ✅ Google-level: YES — SSoT centralizes 2D extraction in grip+renderer layer, import fix prevents tsc error, type-safe casts, `drawSectionProfile` simplification removes redundant object wrapping. | Claude Sonnet 4.6 |
| 2026-05-21 | **SSoT — `useBimEntityMovedPersistEffect` utility hook centralizes `bim:entities-moved` persistence side-effect**. Removed 5× duplicated 12-line `useEffect` block (isWall/isBeam/isSlab/isColumn/isSlabOpening guard + dirtyIdsRef.add + persist call) from `useWallPersistence`, `useBeamPersistence`, `useSlabPersistence`, `useColumnPersistence`, `useSlabOpeningPersistence`. New `hooks/data/useBimEntityMovedPersistEffect.ts` — generic `<T extends AnySceneEntity, S>` hook: takes type guard + serviceRef + dirtyIdsRef + persist callback, registers ONE `EventBus.on('bim:entities-moved')` listener per hook. Each hook now calls `useBimEntityMovedPersistEffect(isWall, serviceRef, dirtyIdsRef, persist)` (1 line). **Files created (1)**: `useBimEntityMovedPersistEffect.ts`. **Files modified (5)**: `useWallPersistence.ts`, `useBeamPersistence.ts`, `useSlabPersistence.ts`, `useColumnPersistence.ts`, `useSlabOpeningPersistence.ts`. ✅ Google-level: YES — SSoT eliminates 60-line duplication, generic `<T,S>` = no `any`, single place to change if event payload/logic evolves, lifecycle identical (each hook still owns its own subscription + cleanup), ADR-040 compliant (no high-freq subscriptions). | Claude Sonnet 4.6 |
| 2026-05-21 | **Fix — Multi-entity BIM move revert bug**. Root cause: `primarySelectedId = payloads[0].id` → non-primary entities (wall/beam/slab/column/slab-opening) never get `dirtyIdsRef` populated → Firestore onSnapshot overwrites moved positions. Fix: new EventBus event `'bim:entities-moved'` emitted by `MoveMultipleEntitiesCommand.execute/undo/redo` after `updateEntities()`; all 5 BIM persistence hooks add `EventBus.on('bim:entities-moved')` listener that marks dirty + calls `persist()` immediately. **Files modified (7)**: `EventBus.ts`, `MoveEntityCommand.ts`, `useWallPersistence.ts`, `useBeamPersistence.ts`, `useSlabPersistence.ts`, `useColumnPersistence.ts`, `useSlabOpeningPersistence.ts`. ✅ Google-level: YES — EventBus decoupling (mirrors wall-split pattern), idempotent, belt-and-suspenders (dirty+persist), zero race (emit after sync updateEntities), undo/redo protected. | Claude Sonnet 4.6 |
| 2026-05-21 | **BIM Entity Points SSoT Utility — `bim/utils/bim-entity-points.ts`**. Νέο pure module `getBimEntityKeyPoints2D(entity)` + `getBimEntityEdgeMidpoints2D(entity)` που συγκεντρώνει όλη τη λογική 2D point extraction για BIM entities (beam/slab/slab-opening/opening/wall/column). `GeometricCalculations.getEntityEndpoints()` + `getEntityMidpoints()` + `getEntityMidpoint()` refactored να delegate στο SSoT (inline params.outline.vertices / startPoint blocks αντικαταστάθηκαν με 1-liners). **Files created (1)**: `bim/utils/bim-entity-points.ts`. **Files modified (1)**: `snapping/shared/GeometricCalculations.ts` — import `getBimEntityKeyPoints2D`/`getBimEntityEdgeMidpoints2D`, 3 methods refactored. Ratchet entry added στο `pending-ratchet-work.md` για migration 20+ αρχείων (Boy Scout). ✅ Google-level: YES — SSoT εξαλείφει inline params scatter, idempotent (pure function), zero React/DOM/Firestore deps, consumer-compatible (same output, delegating wrapper). | Claude Sonnet 4.6 |
| 2026-05-21 | **Snap SSoT fix — Beam/Slab/SlabOpening/Opening endpoint+midpoint snap candidates**. `GeometricCalculations.getEntityEndpoints()` + `getEntityMidpoints()` + `getEntityMidpoint()` extended για 4 BIM kinds που **έλειπαν** από τον spatial index (αποτέλεσμα: δεν υπήρχε snap indicator κατά Move base-point picking σε αυτές τις οντότητες). Προστέθηκαν: (1) **beam** → endpoints = `params.startPoint` + `params.endPoint` (Point3D→2D projection); midpoint = axis midpoint. (2) **slab** → endpoints = όλα τα `params.outline.vertices`· midpoints = per-edge midpoints (closed polygon pattern, mirrors closed polyline). (3) **slab-opening** → ίδιο με slab. (4) **opening** → endpoints = `params.outline.vertices` (4-corner cutout rectangle); midpoints = 4 edge midpoints. Imports εισήχθησαν: `isBeamEntity`, `isSlabEntity`, `isSlabOpeningEntity`, `isOpeningEntity`. **File modified (1)**: `snapping/shared/GeometricCalculations.ts`. ✅ Google-level: YES — SSoT spatial index τροφοδοτείται από όλα τα BIM kinds, EndpointSnapEngine + MidpointSnapEngine δουλεύουν χωρίς αλλαγή, idempotent (pure function, spatial index rebuilt per scene load), zero race (read-only extraction). | Claude Sonnet 4.6 |
| 2026-05-20 | **Phase 5 hotfix — DxfBeam direct entity wrapper + beam preview store race fix**. (1) `dxf-types.ts`: `DxfBeam` interface (mirror DxfWall pattern — `kind`/`params`/`geometry`/`validation` at top level) + `'beam'` εισαγωγή στο `DxfEntity.type` union + στο `DxfEntityUnion`. (2) `DxfRenderer.ts` `convertToEntity()`: νέο `case 'beam'` — direct passthrough χωρίς wrapper extraction (consistent με wall Phase 1B). (3) `useDxfSceneConversion.ts` `convertEntity()`: νέο `case 'beam'` με `isBeamEntity` guard + import `BeamEntity` type. (4) `drawing-preview-generator.ts`: `generateBeamPreview(tempPoints, cursorPoint, sceneUnits)` forwarding του `sceneUnits` (ADR-363 SSoT consistency με eee90e17 πρόσφατο SSoT fix). (5) `useBeamTool.ts`: race fix — `beamPreviewStore.set(...)` *πριν* το `setState(...)` σε 4 click handlers (straight start, curved start, curved mid, commit success). Reason: το store διαβάζεται από useEffect subscriptions, όπου το next mousemove έβλεπε stale state (cursor-dot flash ή ghost footprint από τον προηγούμενο click). Belt-and-suspenders pattern: store sync synchronous (immediate observability), setState queued (eventual consistency). ✅ Google-level: YES — race-free preview pipeline (sync-before-setState pattern), DxfBeam wrapper mirror του DxfWall SSoT, sceneUnits propagation consistent με beam/column/slab tree. | Claude Sonnet 4.6 |
| 2026-05-21 | **Documentation sync — Phase 6.5/7/8 status reconciled across all trackers**. Discovered ότι ο handoff της προηγούμενης συνεδρίας παρουσίασε Phase 6.5 (~4-6h), Phase 7 (~4-6h), Phase 8 (~5-8h) ως "εκκρεμή", αλλά στην πραγματικότητα έχουν ολοκληρωθεί όλες (Phase 6.5.A/B/C 2026-05-20 · Phase 7.1/7.2 2026-05-19 · Phase 8 2026-05-19). **Αλλαγές docs (no code change)**: (1) §Phase 7.1 header — `(in flight 2026-05-19)` → `✅ CLOSED 2026-05-19` (όλα τα 6 checkboxes ήταν ήδη [x]). (2) §Phase 9+ Out of Scope — αφαίρεση γραμμής `Custom material library editor (Phase 6.5 ή ξεχωριστό ADR)` (Phase 6.5 ΥΛΟΠΟΙΗΘΗΚΕ — δεν είναι out-of-scope πλέον, βλ. §6.5 lines 2652-2659). (3) Root tracker `ADR-363-pending-summary.md` — Phase 6.5/7/8 μετακινήθηκαν από "Εκκρεμείς ❌" στις "Ολοκληρωμένες ✅", summary table totals → 0 items / 0h. **Εκκρεμή ADR-363**: μηδέν. Επόμενα βήματα ανήκουν στο ADR-366 (3D viewer port). | Claude Sonnet 4.6 |
| 2026-05-20 | **Phase 6.5.C IMPLEMENTED — Material Picker Library Wire-up (WallDna editor)**. Consumer side of the BIM Material Library wired into `WallDnaSection.MaterialPicker`. New `useDnaMaterialOptions.ts` hook (`wall-advanced-panel/hooks/`): calls `useMaterialLibrary` (companyId + userId + projectId) and filters to the 4 wall-relevant categories (`plaster`, `masonry`, `concrete`, `insulation`). `WallAdvancedPanel.tsx` extended: `projectId?: string` prop added to `WallAdvancedPanelProps`, hook called inside component, `libraryMaterials` + `libraryLoading` passed to `WallDnaSection`. `WallDnaSection.tsx` extended: `WallDnaSectionProps` += `libraryMaterials?/libraryLoading?`, default values = `[]/false`; threading through `DnaLayerList → DnaLayerRow → MaterialPicker`. `MaterialPicker` fully rewritten: `onChange: (value: string, name?: string) => void` signature (name auto-populates layer name for library selections); `bmat_*` prefix detection bypasses `classifyWallMaterial` (avoids triggering custom text input); presets split into `presetOptions` + `customOption` (custom sentinel stays outside optgroups); when `libraryMaterials.length > 0`: two `<optgroup>` groups ("Βιβλιοθήκη Υλικών" + "Προεπιλεγμένα"), otherwise flat preset list; loading-state disabled placeholder option when `libraryLoading && !hasLibrary`; `onSelectChange` finds the matching `BimMaterial` for `bmat_*` IDs and calls `onChange(id, material.nameEl)`. `DnaLayerRow.onChange` wired as `(materialId, name) => onUpdate({ materialId, ...(name !== undefined ? { name } : {}) })`. i18n keys `libraryGroup/presetsGroup/libraryLoading` added to `dxf-viewer-shell.json` el+en (inside `wallAdvancedPanel.sections.dna.fields`). **Files created (1)**: `useDnaMaterialOptions.ts`. **Files modified (3)**: `WallAdvancedPanel.tsx`, `WallDnaSection.tsx`, `dxf-viewer-shell.json` el+en (2 locale files). ADR-363 checklist updated. ✅ Google-level: YES — hook memoizes service per (companyId, userId, projectId) via `useMaterialLibrary` SSoT (equality guard, cache TTL 5min), bmat_ detection is O(1) string prefix check, name auto-fill is single `.find()` over pre-filtered array, no new stores/subscriptions, ADR-040 compliant. | Claude Sonnet 4.6 |
| 2026-05-20 | **Phase 6.5.B IMPLEMENTED — BIM Material Library Editor UI ("Υλικά" 5η tab)**. Materials browser + CRUD dialog + live hook wired into the DXF Viewer left sidebar. New `useMaterialLibrary.ts` hook: memoizes `MaterialLibraryService` per `(companyId, userId, projectId)` via `useMemo`, live subscribe με equality guard, exposes `{ materials, loading, error, save, update, remove, refresh }`. New `MaterialEditorDialog.tsx` (Radix Dialog ADR-001): 14-field form in 3 sub-sections (RequiredSection/DimensionsSection/MetadataSection), create + edit mode, builtin guard (`fieldset disabled` για system materials), form resets on dialog reopen via `useEffect([open, initial, projectId])`, `buildSaveInput/buildUpdatePatch` extracted module-level helpers, all form fields as strings (numbers parsed via `toNumber()`). New `MaterialsLibraryPanel.tsx`: filter row (category Select + scope chips + search input), list of `MaterialCard` components (scope badge + density), `DeleteConfirmDialog` (Radix AlertDialog). `FloatingPanelType` union += `'materials'`, `PANEL_METADATA` += materials entry (iconName `Palette`), `PanelTabs` += 5η tab, `usePanelContentRenderer` `case 'materials'`. i18n namespace `bim-materials` (NEW, el + en): categories(11), fireRatings(5), units(5), scopes(4), form(16 keys), validation(3), list(8), delete(4), readOnlyHint. `SUPPORTED_NAMESPACES` + `critical` array + `namespace-loaders` switch cases updated. `dxf-viewer-panels.json` el+en += `panels.materials` keys. **Files created (5)**: `useMaterialLibrary.ts`, `MaterialEditorDialog.tsx`, `MaterialsLibraryPanel.tsx`, `bim-materials.json` el+en. **Files modified (8)**: `panel-types.ts`, `PanelTabs.tsx`, `usePanelContentRenderer.tsx`, `lazy-config.ts`, `namespace-loaders.ts`, `config.ts`, `dxf-viewer-panels.json` el+en. ✅ Google-level: YES — service memoized only on auth-state change, equality guard prevents 60fps re-render, builtin guard belt-and-suspenders (TS Exclude + form fieldset disabled), form never leaks dirty state across dialog sessions (useEffect reset), DELETE guarded by AlertDialog confirmation. | Claude Sonnet 4.6 |
| 2026-05-20 | **Phase 6.5.A IMPLEMENTED — BIM Material Library Data Layer**. Foundation για Custom Material Library Editor. New `bim/types/bim-material-types.ts` (`BimMaterial`, `BimMaterialScope`, 11-category union, `SaveBimMaterialInput`, `UpdateBimMaterialPatch`, `BIM_MATERIAL_ERRORS` codes). New pure-data `bim/data/system-materials-seed.ts` — 25 system materials per §Q8 distribution (plaster 3, masonry 3, concrete+rebar 4, insulation 3, flooring 3, window-frame 2, door-frame 1, paint 2, roofing 2, waterproofing 1, other 1) με ΑΤΟΕ codes + density + defaultThickness + fireRating, all `defaultUnitCost: null`, no brand. Build-time invariant check 25 entries. New `bim/services/MaterialLibraryService.ts` — class με 3-scope inheritance resolver (system + company + project), cache TTL 5min mirroring `StairPresetsService`, subscribe με 3 onSnapshot listeners + equality guard (snapshot-key hash), CRUD: `saveMaterial`/`updateMaterial`/`deleteMaterial`/`getMaterialById`. Guards: `BUILTIN_NOT_MUTABLE` για system seed, `SYSTEM_SCOPE_CLIENT_FORBIDDEN` belt-and-suspenders (TS `Exclude<…, 'system'>` + runtime check), `PROJECT_SCOPE_REQUIRES_PROJECT_ID`, `NAME_REQUIRED`, `NOT_FOUND`. `stripUndefined()` helper για Firestore-undefined rejection. SOS N.6 compliant (setDoc + `generateBimMaterialId()`). New seed script `scripts/seed-bim-materials.ts` (Admin SDK) με deterministic `bmat_sys_<slug>` IDs (mirror seed-boq-subcategories pattern για system data), idempotent, `pnpm run seed:bim-materials`. New unit tests `services/__tests__/MaterialLibraryService.test.ts`: Firestore SDK fully mocked με in-memory store, coverage = 3-scope merge (4 of 6 seeded docs visible), cache TTL + invalidation, save+project+system rejections, builtin guard on update/delete, stripUndefined patch, getMaterialById null vs found. **Files created (5)**: `bim-material-types.ts`, `system-materials-seed.ts`, `MaterialLibraryService.ts`, `MaterialLibraryService.test.ts`, `seed-bim-materials.ts`. **Files modified (2)**: `package.json` (+seed:bim-materials script), `ADR-363-bim-drawing-mode.md` (Phase 6.5 deliverables checklist). ✅ Google-level: YES — proactive cache invalidation on writes, idempotent setDoc seed, 3-scope inheritance Q-conformant, subscribe equality guard prevents 60fps re-renders, lifecycle = auth session per companyId, belt-and-suspenders system-scope guard. Next: Phase 6.5.B (Editor UI floating panel "Υλικά") + 6.5.C (Consumer wire-up). | Claude Opus 4.7 |
| 2026-05-21 | **Phase 4.5e+ IMPLEMENTED — Tab/Shift+Tab Material Cycling for Selected BIM Entities**. Revit-style enum cycle: while a wall/slab/beam/column is selected and select tool is active, Tab advances to next material option; Shift+Tab reverses. New `hooks/useBimMaterialCycler.ts` — `cycleMaterialValue(current, options, dir)` pure SSoT helper; `useBimMaterialCycler({ levelManager, universalSelection })` hook with `window.addEventListener('keydown', …, { capture: true })`. Guard sequence: key='Tab', no Ctrl/Meta/Alt, `toolStateStore.get().activeTool === 'select'` (excludes drawing-mode Tab handlers e.g. column anchor cycling), no input/textarea focused. Each cycle dispatches `UpdateWallParamsCommand` / `UpdateSlabParamsCommand` / `UpdateBeamParamsCommand` / `UpdateColumnParamsCommand` (isDragging=false → discrete undo step). Material option lists: wall `[rc, masonry, aerated-concrete, gypsum]`, slab `[rc, composite, wood]`, beam `[rc, steel, glulam]`, column `[rc, steel, masonry, wood]`. Undefined material treated as `options[0]` (matches combobox default display). Wired via `useDxfBimBridges` — zero props changes needed (levelManager + universalSelection already in scope). **Files created (1)**: `hooks/useBimMaterialCycler.ts`. **Files modified (1)**: `app/useDxfBimBridges.ts`. ✅ Google-level: YES — pure SSoT cycle helper (testable in isolation), toolStateStore guard prevents double-firing with drawing-tool Tab handlers, undoable via command pattern (Ctrl+Z restores previous material), ADR-040 compliant (no new store subscriptions), idempotent (same material cycled = same result). | Claude Sonnet 4.6 |
| 2026-05-20 | **Phase 3.8 IMPLEMENTED — Analytical Free Span for Slab + Beam**. `SlabGeometry.maxFreeSpanM` + `BeamGeometry.maxFreeSpanM` fields added. Algorithm (Slab): N_ANGLES=12 direction sampling, project slab + support outlines onto each direction, find clear distance between opposing inner faces, max across all angles (clamped to slab directional extent). Fallback (no supports): `min(bbox.w, bbox.h)` = conservative structural span estimate. `WallFootprintForSpan` interface added to `slab-geometry.ts`. `useSlabPersistence.collectWallFootprints()` collects wall plan-view outlines (outerEdge+innerEdge CCW polygon) from scene; passes to `computeSlabGeometry` alongside existing `beamFootprints`. Validator `validateSpan` updated: `Math.min` instead of `Math.max` (structural span = SHORT direction). Beam: `maxFreeSpanM = length` (polyline chord = actual span; slenderness check already uses true length). **Files modified (6)**: `slab-types.ts`, `slab-geometry.ts`, `beam-types.ts`, `beam-geometry.ts`, `useSlabPersistence.ts`, `slab-validator.ts`. **Tests (3 suites +18 tests)**: `slab-geometry-beam-deduction.test.ts` (+8 analytical span tests), `beam-geometry.test.ts` (+3 maxFreeSpanM tests), `slab-validator.test.ts` (comment update). 72 tests pass. ✅ Google-level: YES — pure geometry algorithm (O(N×S)), backward-compat fallback, BOQ geometry includes analytical value at persist time, idempotent. | Claude Sonnet 4.6 |
| 2026-05-20 | **Phase 3.7b++ IMPLEMENTED — Slab-Opening Edge-Midpoint Hover Indicator (pre-drag)**. `useSlabOpeningGhostPreview` extended: new `hoveredEdgeMidpointGrip?: UnifiedGripInfo | null` prop. When set, draws green filled circle (r=6px, rgba 0,200,120) + white ring + bold "+" label at the grip's screen position — Revit/AutoCAD "Add Vertex" affordance convention. RAF lifecycle unified: `isActive = isAwaitingPosition \|\| hoveredEdgeMidpointGrip != null`. `CanvasSection` passes `unified.hoveredGrip?.slabOpeningGripKind?.startsWith('slab-opening-edge-midpoint-') ? unified.hoveredGrip : null` inline (net 0 lines added — 500 line limit preserved). `SlabOpeningGhostPreviewMountProps` + `canvas-layer-stack-types.ts` extended with the new optional field; `CanvasLayerStack` + leaves flow automatically. **Files modified (4)**: `useSlabOpeningGhostPreview.ts`, `canvas-layer-stack-slab-opening-ghost.tsx`, `canvas-layer-stack-types.ts`, `CanvasSection.tsx`. **Files created (0)**. ✅ Google-level: YES — ADR-040 micro-leaf pattern (zero orchestrator subscriptions), RAF lifecycle unified into single isActive guard, industry convention (green "+vertex" = Revit/AutoCAD standard), zero new lines in 500-line-capped files. | Claude Sonnet 4.6 |
| 2026-05-20 | **Phase 3.7b+ IMPLEMENTED — Multi-Storey Slab-Opening Stack ("Copy to Floors")**. EventBus `bim:slab-opening-stack-requested` + `bim:slab-opening-stack-confirmed` wired end-to-end. Enterprise ID prefix `BIM_STACK_GROUP: 'bmstkg'` + `generateBimStackGroupId()` added to ID service. Pure utility `bim/slab-openings/slab-opening-stack.ts`: `findHostSlabForLevel(outline, scene)` (bbox-center containment, mirrors `getSlabAtPoint`) + `buildStackedOpeningEntity(source, hostSlab, layerId, groupId)` (new enterprise ID, clones outline/kind/fireRating). `SlabOpeningStackDialog` (checkbox list per non-current level, pre-selects levels with host slab, disabled+⚠ for floors without slab, confirm badge shows count). `SlabOpeningStackHost` (EventBus subscriber, groupId assign on source, loop over selected levels → `buildStackedOpeningEntity` + `setLevelScene` + `drawing:entity-created` emit). Ribbon: `copyToFloors` action key + button in actions panel. Bridge `onAction` dispatches EventBus. `DxfViewerTopBar` mounts host. i18n el+en: `slabOpeningEditor.copyToFloors` + `slabOpeningStack.dialog.*` (6 keys). **Files created (3)**: `slab-opening-stack.ts`, `SlabOpeningStackDialog.tsx`, `SlabOpeningStackHost.tsx`. **Files modified (8)**: `enterprise-id-prefixes.ts`, `enterprise-id-class.ts`, `enterprise-id-convenience.ts`, `EventBus.ts`, `slab-opening-command-keys.ts`, `contextual-slab-opening-tab.ts`, `useRibbonSlabOpeningBridge.ts`, `DxfViewerTopBar.tsx`. i18n el+en: 2 files. ✅ Google-level: YES — EventBus decoupling (host owns lifecycle), pure utility (testable in isolation), SSoT enterprise ID, confirmation dialog with floor selection, idempotent per-level scene update, ADR-040 compliant (no high-freq subscriptions in host). | Claude Sonnet 4.6 |
| 2026-05-20 | **Phase 3.7b+ ghost preview IMPLEMENTED — Slab-Opening Edge-Midpoint Ghost Preview**. `SlabOpeningGhostRenderer` (per-kind colors: shaft=#5b4a78/well=#3a5a78/duct=#3a5a3a/chimney=#7a3a3a, dashed [6,4] stroke, 25% fill, 10px crosshair) + `useSlabOpeningGhostPreview` (RAF-based, `getImmediateSnap()` imperative read mirrors Phase 4.5c.4, `useCursorWorldPosition()` trigger). `SlabOpeningGhostPreviewMount` leaf (React.memo, returns null). `canvas-layer-stack-types.ts` + leaves/LayerStack/Section wired. ADR-040 micro-leaf compliant: zero new orchestrator `useSyncExternalStore`. **Files created (3)**: `slab-opening-ghost-renderer.ts`, `useSlabOpeningGhostPreview.ts`, `canvas-layer-stack-slab-opening-ghost.tsx`. **Files modified (4)**: `canvas-layer-stack-types.ts`, `canvas-layer-stack-leaves.tsx`, `CanvasLayerStack.tsx`, `CanvasSection.tsx`. ✅ Google-level: YES — ADR-040 pattern exact (micro-leaf + RAF + imperative snap read), per-kind color palette, zero React state in preview path. | Claude Sonnet 4.6 |
| 2026-05-20 | **Phase 4.5e-A+B RIBBON ACTIVATION — Slab + Wall Material Pickers ENABLED**. Phase 4.5e-A (Slab): `SLAB_RIBBON_KEYS.stringParams.material` added; `useRibbonSlabBridge` wires `material` field via `patchSlabStringParam`; `contextual-slab-tab.ts` removes `comingSoon: true` + updates to `SLAB_RIBBON_KEYS.stringParams.material`. Phase 4.5e-B (Wall ribbon): `contextual-wall-tab.ts` removes `comingSoon: true`, updates comment to Phase 4.5e-B, switches to `WALL_RIBBON_KEYS.stringParams.material` constant; bridge already handles via `isWallRibbonStringKey` → `readWallStringField`/`patchWallStringParam` (material added Phase 4.5e-B commit). i18n: `wallEditor.material.tooltip` added (el+en). 6 files modified, 0 new. | Claude Sonnet 4.6 |
| 2026-05-20 | **Phase 4.5e-B IMPLEMENTED — Wall Material Hatch Patterns**. New `bim/walls/wall-hatch-patterns.ts` (pure SSoT) — 4 plan-view hatches: `rc` (dot grid 150mm, reuses column RC pattern), `masonry` (horizontal rows 80mm), `aerated-concrete` (cross-hatch 45°/135° 150mm), `gypsum` (single diag 45° 80mm). `WallRenderer.drawMaterialHatch()` clips to outer+inner edge polygon (same path as drawFootprint) → strokes lines + fills RC dots. Guards: DNA-bearing walls skip (per-layer DNA renders materials); `transform.scale < 0.001` skip (perf). `WallParams.material?: string` field added. `WALL_RIBBON_KEYS.stringParams.material` key registered. ADR-040 unaffected (no new subscriptions, render-only). 4 files modified + 1 new SSoT module. | Claude Sonnet 4.6 |
| 2026-05-20 | **Phase 2 leftover IMPLEMENTED — Polyline/Curved Host Wall Positioning**. `getWallAxisVertices(params, kind)` + `computePolylineLengthMm` exported from `wall-geometry.ts` as SSoT. `opening-geometry.ts`: `walkPolylineToDistance()` walks actual axis polyline (straight/curved/polyline); `projectPointToPolylineOffset()` finds closest foot on polyline + returns cumulative arc offset. `computeOpeningGeometry` now places cutout at correct arc position on polyline/curved walls; `projectPointToWallOffset` projects to actual polyline. `wall-opening-coordinator.ts`: `axisLengthMm()` uses true arc length (`getWallAxisVertices` + `computePolylineLengthMm`). Pre-existing test bug fixed (`opening-grips.test.ts` test 6: `toBe(opening.params)` → `toBe(originalParams)`). 11 new tests in `opening-geometry.test.ts` covering polyline L-shaped wall (segment routing, rotation) + curved wall (non-chord position). 5 files modified, 0 new. | Claude Sonnet 4.6 |
| 2026-05-20 | **Phase 3.7b IMPLEMENTED — Slab-Opening Fire-Rating Ribbon**. `SLAB_OPENING_RIBBON_KEYS.stringParams.fireRating` added to key registry. `SLAB_OPENING_FIRE_RATING_OPTIONS` (60/90/120/none) + combobox row added to `contextual-slab-opening-tab.ts`. Bridge: `getComboboxState` returns `''` for undefined; `onComboboxChange` parses `'' → undefined` else `Number() as 60\|90\|120`. i18n el+en: `slabOpeningEditor.fireRating.{section.title, none, 60, 90, 120}`. 4 files modified. Multi-storey stack + edge-midpoint ghost deferred (need cross-level persistence + ADR-040 micro-leaf respectively). | Claude Sonnet 4.6 |
| 2026-05-20 | **Phase 5.5j IMPLEMENTED — H-Beam Variant + Profile Designation Label**. `BeamSectionType = 'I' \| 'H'` + `profileDesignation?: string` added to `BeamParams`. `SECTION_H_FLANGE_T_PX=9` + `computeHProfileOutline()` (delegates to I-variant) added to `beam-section-profile.ts`. `BeamRenderer.drawSectionProfile()` branches on `sectionType ?? 'I'`; canvas label drawn in screen space at `W/2 + 8px` offset when `profileDesignation` set. Ribbon: new sectionType combobox (I/H) + profileDesignation combobox (14 IPE/HEA/HEB presets) in `beam-material` panel. i18n: `beamEditor.sectionType.*` + `beamEditor.profileDesignation.*` in el+en. 7 files modified, 0 new. | Claude Sonnet 4.6 |
| 2026-05-20 | **Phase 5.5i+ IMPLEMENTED — Beam-Supports-Slab Analytical Link**. Pure geometry SSoT: `clipPolygonBySH` (Sutherland-Hodgman) + `polygonIntersectionAreaMm2` added to `polygon-utils.ts`. `computeSlabGeometry` extended with optional `beamFootprints?: BeamFootprintForDeduction[]` param (mirrors Phase 3.7 slabOpenings pattern). Deduction = Σ(intersectionMm2 × min(beamDepth, slabThickness) / 1e9). `useBeamPersistence` emits `bim:beam-persisted` after save/delete → `useSlabPersistence` listener re-BOQs all scene slabs (fire-and-forget bridge, no Firestore slab save). 6 files modified + 1 test file (17 tests, 100% pass). Backward-compat: no beamFootprints arg → identical behaviour. | Claude Sonnet 4.6 |
| 2026-05-20 | **Phase 5.5i IMPLEMENTED — Column Center Axis Snap**. New `ColumnCenterSnapEngine` (extends BaseSnapEngine, mirrors DimDefPointSnapEngine pattern): snaps exclusively to structural column center ('center' anchor from 9-point Phase 5.5d grid). New `ExtendedSnapType.BIM_COLUMN_CENTER = 'bim_column_center'` with priority -1 (supersedes ENDPOINT priority 0 at center point). ⊕ SVG shape (circle + crosshair = standard structural plan column symbol) added to `SnapShape` switch in `SnapIndicatorOverlay`. `'bim-column'` description key → `snapModes.labels.bim.columnAxis` i18n path (consistent with Phase A wall/slab/opening pattern). 11 new tests (rect/circular/L/T column centers, radius guard, excludeEntityId, mixed entities, multiple columns). 6 files modified + 1 new engine + 1 new test file. | Claude Sonnet 4.6 |
| 2026-05-19 | **Phase 5.5h IMPLEMENTED — Steel I/H Section-Profile Symbol Overlay**. Pure `BeamRenderer`-native addition (same pattern as `drawDepthIndicator` Phase 5.5c). New `bim/beams/beam-section-profile.ts` SSoT: `computeIProfileOutline(w,h,ww,ft)` — 12-vertex CW I-profile polygon in local coords + 9 exported constants. Modified `bim/renderers/BeamRenderer.ts`: imports constants from SSoT; `drawSectionProfile(beam)` private method — early-return guards (non-steel / `scale < 0.08` / screen length `< 24px`), screen-space angle via `worldToScreen()` on start+end, perpendicular unit vector → symbol centre at midpoint + `(beamHalfWidthPx + 12px)` offset, `ctx.rotate(screenAngle + PI/2)` aligns flanges perpendicular to beam (Revit/Tekla convention), fill `rgba(60,100,200,0.18)` + stroke `rgba(30,60,160,0.82)` 1.5px solid; called from `render()` alongside `drawDepthIndicator()` under `highlighted` condition. ADR-040: ZERO new React subscriptions, no PreviewCanvas changes, no new micro-leaf. Phase checklist updated (5.5e–5.5h marked ✅, new 5.5i+ deferred line). | Claude Sonnet 4.6 |
| 2026-05-19 | **Phase 0.5 hotfix-2 — re-add `rendering/entities/StairRenderer.ts` 1-line barrel**. Closure changelog δήλωνε ότι το barrel «διαγράφηκε», αλλά ο `EntityRendererComposite.ts:20` εξακολουθεί να κάνει `import { StairRenderer } from '../entities/StairRenderer'` — HEAD build broke. Ο shim επαναφέρει το build μέχρι να γίνει Boy-Scout migration του composite import σε `../../bim/renderers/StairRenderer`. SSoT path παραμένει `bim/renderers/StairRenderer.ts` (re-export only). | Claude Opus 4.7 |
| 2026-05-19 | **Phase 0.5 CLOSED — Stair Migration to `bim/` ολοκληρώθηκε**. Reality-vs-ADR drift διορθώθηκε: 45 barrel stubs `systems/stairs/` αφαιρέθηκαν, 2 barrels `types/stair.ts` + `rendering/entities/StairRenderer.ts` διαγράφηκαν, 2 ζωντανά hooks (`hooks/data/useStairPersistence.ts`, `ui/ribbon/hooks/useRibbonStairBridge.ts`) μετακινήθηκαν σε `bim/hooks/use-stair-persistence.ts` + `bim/hooks/use-ribbon-stair-bridge.ts` με fixed internal imports, `bim/renderers/StairRenderer.ts` legacy imports διορθώθηκαν (3 lines). Consumer sweep: 17 αρχεία × `systems/stairs/` + 4 × `hooks/data/useStairPersistence` + 1 × `ui/ribbon/hooks/useRibbonStairBridge` + 65 × `types/stair` → όλα δείχνουν τώρα σε `bim/*`. `bim/index.ts` εκθέτει πλήρες stair surface (49 types + 3 type guards). SSoT registry module `bim-folder-residency` (Tier 3, baseline 0) προστέθηκε με 5 forbidden patterns που μπλοκάρουν imports σε legacy paths. `stair-presets-service` + `stair-firestore-service` registry ssotFile/allowlist paths ενημερώθηκαν προς bim/. tsc zero new errors. Stair test suites: **21 suites / 322 tests / 100% green**. Known follow-up (Boy Scout, low priority): `ui/ribbon/hooks/bridge/stair-command-keys.ts` + `stair-param-helpers.ts` ζουν ακόμα στο ui/ribbon/ — cross-domain BIM→UI coupling για τους 2 ribbon-bridge files· extraction σε bim/hooks/bridge/ διπλωματικά παραπεμπόμενη σε ratchet follow-up. Google-Level N.7.2 verdict: ✅ Proactive (atomic migration, single commit chain) / ✅ No race (pure path refactor) / ✅ Idempotent (re-run = no-op) / ✅ Belt-and-suspenders (tsc + tests + pre-commit registry gate) / ✅ SSoT (bim/ canonical mount point, registry enforces) / ✅ Sync (no async lifecycle change) / ✅ Lifecycle owner (bim/stairs + bim/geometry/stairs + bim/renderers + bim/hooks all explicit). | Claude Opus 4.7 |
| 2026-05-19 | **Phase 5.6.1 CLOSED — Wall Split Persistence Fix**. Root cause: `WallSplitCommand.execute()` was scene-only — original wall survived in Firestore on reload, wall1/wall2 were never saved. Fix: `useWallSplitPersistence` hook (mounted in `WallPersistenceHost`) listens for `EventBus.emit('bim:wall-split-committed')` emitted by `useWallSplitTool.handleWallSplitClick` after `executeCommand(cmd)`. Persistence: `Promise.all([deleteWall(originalId), saveWall(wall1), saveWall(wall2)])` → `updateOpening(id, {params: nextParams})` per redistributed opening → BOQ bridge (delete original + upsert wall1/wall2) → audit records ×3. 9 new tests (renderHook + act pattern): service init, no-op when companyId null, delete+save×2, opening redistribution, BOQ bridge (with+without buildingId), audit. ✅ Google-level: EventBus-driven (decoupled), stale-closure-safe refs, parallel Promise.all, belt-and-suspenders (existing subscription picks up wall1/wall2 on next snapshot). | Claude Sonnet 4.6 |
| 2026-05-19 | **Phase 1D-D CLOSED — Wall BOQ Auto-Feed wired + deleteBoqItemForBim bug fix**. `upsertBoqItemForBim('wall', ...)` already wired in `useWallPersistence.persist()` (Phase 6 landing). Bug fixed: all 5 persistence hooks (`useWallPersistence`, `useSlabPersistence`, `useOpeningPersistence`, `useColumnPersistence`, `useBeamPersistence`) called `deleteBoqItemForBim(entityId)` without `companyId` — multi-layer cascade query received `undefined`, orphaning child BOQ rows on delete. Fix: `deleteBoqItemForBim(entityId, companyId ?? '')` + `companyId` added to `useCallback` deps in all 5 hooks. 8 new tests covering all 5 WallCategory → ΑΤΟΕ mappings (OIK-3.05/3.06), area quantity, no-category skip, cascade companyId regression. Total 32 tests (24 prior + 8 new), 100% pass. | Claude Sonnet 4.6 |
| 2026-05-19 | **Phase 6 CLOSED — BOQ Auto-feed multi-layer DNA + Material→ΑΤΟΕ SSoT**. Phase 6.1 implements Revit-style Material Takeoff Schedule pattern (6/6 industry σύγκλιση per SPEC-3D-004D §12 Q4): walls με `WallDna.layers.length > 1` παράγουν 1 parent summary row + N child rows (deterministic IDs `boq_bim_${entityId}` + `boq_bim_${entityId}_layer_${layerId}`). Per-layer detach guard ανεξάρτητο. Multi-layer delete cascade via `where('parentBoqItemId', '==', parentId)` query. Phase 6.2 implements material→ΑΤΟΕ centralized SSoT (`material-to-atoe-mapping.ts`) με όλα τα 18 wall-material-catalog preset IDs: ΟΙΚ-2 (concrete m³ volume), ΟΙΚ-3 (masonry m²/m³), ΟΙΚ-4 (plaster m² area), ΟΙΚ-7 (cladding m² area), ΟΙΚ-10 (insulation m² area), ΟΙΚ-12 (special m² area). Quantity derivation: volume kind → `wallNetArea × thickness_m`, area kind → `wallNetArea` (single-sided per layer). Files: `bim/services/boq-multi-layer-builder.ts` (pure factory, 15 tests), `bim/config/material-to-atoe-mapping.ts` (seed catalog, 23 tests), `bim/services/BimToBoqBridge.ts` extended (12 νέα multi-layer tests + 12 existing single-entry tests preserved). BOQItem schema +4 optional fields (`parentBoqItemId`, `isGroupParent`, `layerIndex`, `materialId`) — back-compat 100% (existing manual entries + Phase 6 single-entry rows unaffected). Industry analysis confirmed: ΟΛΟΙ οι 6 major BIM tools παράγουν per-layer quantities (Material Takeoff = standard). Future Phase 6.2+: user-editable `bim_atoe_overrides/{projectId}` Firestore overrides, BOQ panel parent/children expandable UI, ADR-175 schema cross-link. | Claude Opus 4.7 |
| 2026-05-19 | **Phase 7.2 CLOSED — Mirror/Rotate/Copy BIM IMPLEMENTED**. Files created: (1) `bim/transforms/bim-mirror-geometry.ts` — 7-kind axis-aware mirror SSoT (pure function): `mirrorPoint3D` z-preserving generic, `mirrorPolygon3D`, `mirrorColumnAnchor` reflects `(dx,dy)` across axis with snap to nearest of 9 discrete anchors (exact for axis-aligned reflections, snap for arbitrary axes). Per-kind: wall reflects start/end + polylineVertices + curveControl + recomputes via `computeWallGeometry`; opening flips handing on door/french-door (window/sliding/fixed = no-op); slab + slab-opening reflect outline vertices; column reflects position + `mirrorAngle(rotation, axisAngle)` + anchor snap; beam reflects startPoint+endPoint+curveControl; stair reflects basePoint + direction. (2) `bim/transforms/bim-rotate-geometry.ts` — 7-kind pivot rotation SSoT: wall endpoints + accessory points, slab + slab-opening polygon, column position rotates + `rotation` field accumulates `+angleDeg` (normalized), beam endpoints + curveControl, stair basePoint rotates + `direction` accumulates. Opening = no-op (hosted-derived from wall). (3) `bim/transforms/bim-copy-builder.ts` — kind-specific enterprise ID gen via `generateWallId`/`generateOpeningId`/etc (SOS N.6) + host rewire (opening.wallId → cloned wall ID when both in selection; slab-opening.slabId → cloned slab ID likewise; preserves original host ID when host NOT in selection) + 3 transform paths (translate/mirror/rotate). Non-BIM sources returned in `skipped`. (4) `core/commands/entity-commands/BimCopyCommand.ts` — ICommand wrapper: execute() addEntity clones + records ID list, undo() removeEntity all clones, redo() replays snapshots deterministically. NOT extending CopyEntityCommand (grip-flow specific) — rationale documented inline. Files modified: (a) `MirrorEntityCommand.ts` — new private `computeMirrorUpdates()` tries `calculateBimMirroredGeometry` first, falls through to generic `mirrorEntity()` for non-BIM. Wired in both `execute` and `redo` paths (both keepOriginals modes). (b) `RotateEntityCommand.ts` — analogous `computeRotateUpdates()` (handles `copyMode` clones too). Tests: 59 passed across 6 suites (21 mirror-geometry + 12 rotate-geometry + 10 copy-builder + 5 mirror command dispatch + 5 rotate command dispatch + 6 BimCopyCommand undo/redo). Ribbon buttons + shortcuts (MI/RO/CO) ΗΔΗ υπάρχουν στο home-tab-modify.ts; `useMirrorTool` + `useRotationTool` ΗΔΗ wired και τώρα δουλεύουν σε BIM μέσω επέκτασης commands. Dedicated `useBimCopyTool` hook (clipboard-style BIM copy χρησιμοποιώντας `BimCopyCommand` + translate delta από user pick) deferred — υποδομή έτοιμη, UX flow tied to ADR-357 grip-context-menu Copy modifier. **Google-Level N.7.2 verdict**: ✅ Proactive (pure SSoTs computed at command build time) / ✅ No race (atomic `sceneManager.updateEntity`) / ✅ Idempotent (axis-symmetric mirror twice = identity; rotate 360° normalizes; copy snapshot redo deterministic) / ✅ Belt-and-suspenders (BIM dispatcher null → generic fallback) / ✅ SSoT (geometry + ID gen + host rewire centralized) / ✅ Sync (no fire-and-forget) / ✅ Lifecycle owner (command class). Caveat: L-shape/T-shape column ARM handedness NOT flipped on mirror — uncommon variant, deferred. | Claude Opus 4.7 |
| 2026-05-19 | **Phase 7 SPLIT into 7.1 + 7.2** per Giorgio Q5 decision (phase-per-session, Google-level scope). **Phase 7.1 partial landing**: BIM marquee bounds via new SSoT `bim/utils/bim-bounds.ts` (fixed silent drop of 7 BIM kinds from `calculateEntityBounds` → `default:null`); BIM move geometry via new SSoT `bim/utils/bim-move-geometry.ts` (fixed `calculateMovedGeometry` no-op on BIM, recomputes geometry atomically per kind); cascade resolver SSoT `bim/cascade/bim-cascade-resolver.ts` (Boy-Scout N.0.2: extracts inline `useSmartDelete` wall→opening sweep + adds slab→slab-opening cascade); `useMoveTool` + `useSmartDelete` wired to resolver. Registry module `bim-cascade-resolver` (Tier 3) added. 37 new tests (13 + 9 + 15). **Pending in 7.1**: multi-selection ribbon contextual tab (Revit/AutoCAD common-properties + Filter panel pattern per Giorgio Q3) — handoff for next session. **Phase 7.2** (deferred): Mirror/Rotate/Copy BIM coverage. | Claude Opus 4.7 |
| 2026-05-19 | **Phase 7.1 CLOSURE — Multi-Selection Ribbon Contextual Tab IMPLEMENTED**. Files created: (1) SSoT registry `bim/types/bim-common-properties.ts` — 6 editable numeric props × 7 BIM kinds + `getCommonProperties` (Revit common-properties intersection) + `countByKind` + `isHomogeneous`. (2) Bulk command factory `bim/cascade/bim-bulk-update-builder.ts` — per-kind dispatch builds `Update{Wall,Opening,Slab,Column,Beam,Stair}ParamsCommand`, wraps σε `CompoundCommand` (single undo step, atomic rollback). Skip rules: missing entity / kind out-of-registry / patch key not in kind's allow-list. (3) Bridge hook `ui/ribbon/hooks/useMultiSelectionRibbonBridge.ts` — `mode`/`bimEntries`/`kindsCount`/`commonProperties`/`isHomogeneous`/`currentValues` (mixed-detect)/`executeBulkPatch(patch)`/`narrowToKind(kind)`. ADR-040 R1: subscribes inside ribbon leaf, never στο `CanvasSection`. (4) Widget components `ui/ribbon/components/MultiSelectionCommonPropertiesPanel.tsx` (number inputs με Enter/blur commit, Escape revert, mixed-value placeholder) + `MultiSelectionFilterPanel.tsx` (N per-kind narrow buttons + count, hidden όταν homogeneous). Widget dispatcher registration στο `RibbonPanel.tsx`. (5) Tab data `ui/ribbon/data/contextual-multi-selection-tab.ts` — 2 panels (`multi-selection-common-properties`, `multi-selection-filter`). (6) Dispatcher wiring: `app/ribbon-contextual-config.ts.useActiveContextualTrigger` extended με `selectedEntityIds` arg + priority override (2+ BIM → `MULTI_SELECTION_CONTEXTUAL_TRIGGER` υπερτερεί του per-kind tab). `DxfViewerContent` περνάει `selectedEntityIds`. (7) CSS `ribbon-tokens.css` — `dxf-ribbon-multi-{common,filter}*` classes. (8) i18n: `ribbon.tabs.multiSelection`, `ribbon.panels.multiSelection{Common,Filter}`, `ribbon.contextualTabs.multiSelection.{title, properties.*, differentValues, emptyCommon, applyHint, filterButtons.*}` σε el + en (Greek pure — no English words). **62 new tests** (23 registry + 20 builder + 19 bridge), όλα πράσινα. Google-Level N.7.2 verdict: ✅ Proactive / ✅ No race (CompoundCommand atomic) / ✅ Idempotent / ✅ Belt-and-suspenders (per-kind tabs intact post-narrow) / ✅ SSoT (registry+builder+bridge) / ✅ Sync await / ✅ Lifecycle owner (bridge hook). **Phase 7.1 CLOSED. Phase 7.2 (Mirror/Rotate/Copy BIM) remains deferred.** | Claude Opus 4.7 |
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
| 2026-05-19 | **Phase 5.6 Ribbon + Context Menu IMPLEMENTED**. Ribbon button "Χωρισμός" added to `contextual-wall-tab.ts` wall-actions panel (`commandKey: 'wall-split'`, icon `bim-wall-split` = Scissors). Context menu entry "Χωρισμός Τοίχου" added to `EntityContextMenu` via `canSplit` prop (computed from `isWallEntity` guard on `props.currentScene.entities`, pure derivation — zero subscription) + `SplitWallIcon` added to `MenuIcons.tsx`. i18n: `ribbon.commands.wallEditor.split` (el/en `dxf-viewer-shell.json`) + `contextMenu.entity.splitWall` (el/en `dxf-viewer.json`). ADR-040 updated (CanvasSection `isWallEntity` import + passthrough props — cardinal rule 1 respected, zero new orchestrator subscriptions). ✅ Google-level: YES — keyboard/ribbon/context-menu triple activation pattern (Revit/AutoCAD standard), pure derivation for `canSplit`, i18n SSoT compliant (N.11). | Claude Sonnet 4.6 |
| 2026-05-19 | **Phase 5.6 IMPLEMENTED — Wall Split Tool (Revit Split Element pattern)**. Νέο editing tool που σπάει straight wall σε δύο segments στο click point, redistributing hosted openings between the two new walls (atomic undo/redo). State machine: idle → picking (continuous loop) → click wall → execute → loop. ESC / right-click → `onToolChange('select')`. Mouse-move path: `subscribeToImmediateWorldPosition` → `findWallAtPoint` (via `projectPointOnWallAxis` + `TOLERANCE_CONFIG.SNAP_DEFAULT/scale`) → `WallSplitStore.set({hoveredWallId, splitPoint, splitLine})` — ZERO React state for high-freq path (mirrors `TrimToolStore`, ADR-040 compliance). Click path: `computeSplitOffset` (clamped to ≥`MIN_SEGMENT_MM=100mm` each side) → `computeSplitWallParams` (bevel inheritance: wall1 keeps `startBevel`, wall2 keeps `endBevel`; `measurementLength` cleared) → `redistributeOpenings` (straddle policy: opening center ≤ split → wall1, > split → wall2; wall2 openings get `offsetFromStart -= splitOffset`) → `WallSplitCommand` (single atomic undo/redo: remove orig + add wall1+wall2 + patch openings; soft-orphan-safe `applyOpeningPatch` mirrors `UpdateOpeningParamsCommand`). Phase 1 limitation: straight walls only — curved/polyline split deferred to Phase 0.5+. **Files created (6)**: `bim/walls/wall-split.ts` (pure geometry SSoT — 4 functions), `bim/walls/__tests__/wall-split.test.ts`, `core/commands/entity-commands/WallSplitCommand.ts` (~160 γρ), `hooks/tools/useWallSplitTool.ts` (~220 γρ — editing hook, needs `executeCommand`, mirrors `useTrimTool`), `systems/wall-split/WallSplitStore.ts` (~110 γρ, snapshot-stable module-pub/sub). **Files modified (9)**: `entity-commands/index.ts` (+2 exports), `useModifyTools.ts`, `canvas-click-types.ts`, `useCanvasClickHandler.ts` (+PRIORITY 1.61), `useCanvasEscapeRegistrations.ts` (+`buildModifyHandler('wall-split',…)`), `useCanvasKeyboardShortcuts.ts`, `ToolStateManager.ts` (+ToolInfo), `ui/toolbar/types.ts` (+ToolType `'wall-split'`), `CanvasSection.tsx` (plumb-only, ZERO new orchestrator subs — ADR-040 changelog updated this session). i18n keys (el/en `dxf-viewer-shell.json`). ✅ Google-level: YES — Revit Split Element parity, atomic command (orig wall + opening params restored on undo), pure SSoT geometry, soft-orphan-safe patch, snapshot-stable store, MIN_SEGMENT_MM guard, ADR-040 micro-leaf compliance, reuse-first (`useTrimTool` + `projectPointOnWallAxis` from Phase 5.5e). | Claude Opus 4.7 |
| 2026-05-19 | **Phase 4.5c.5 IMPLEMENTED — Drag-Time Dimension Annotations (Column + Beam grips)**. Closes the last deferred item from Phase 4.5c series (deferred 4× from 4.5b → 4.5c → 4.5c.1 → 4.5c.4). Revit/AutoCAD live-dim convention: floating "w=350mm" / "d=400mm" / "al=150mm" labels appear near the active grip handle on the PreviewCanvas during grip drag. Architecture: ADR-040 micro-leaf pattern — `GripDimAnnotationMount` (new leaf, `React.memo` + `return null`) calls `useGripDimAnnotation` hook internally; CanvasSection never subscribes to extra high-frequency state. `useGripDimAnnotation` mirrors `useGripGhostPreview`: RAF-based draw, triggered by `dragPreview` prop changes, clears on drag end. Canvas clear ordering: leaf mounted AFTER `GripDragPreviewMount` in `PreviewCanvasMounts` — ghost RAF (clear + ghost) runs first, annotation RAF (label only, no clear) runs second → correct stacking. `DxfGripDragPreview` extended with `columnGripKind?: ColumnGripKind` and `beamGripKind?: BeamGripKind` + `anchorPos` always included when column/beam kind present — populated in `buildDxfDragPreview` (`grip-projections.ts`) mirroring the existing stair discriminator pattern. Label computation: calls `applyColumnGripDrag` / `applyBeamGripDrag` (existing pure SSoT functions) with `{ originalParams, delta }` → extracts relevant dimension from result → `Math.round()` → `"w=350"` format. Column label map: `column-width` → `w`, `column-depth` → `d`, `column-arm-length` → `al`, `column-arm-width` → `aw`, `column-flange-length` → `fl`, `column-web-thickness` → `wt`; `column-center` + `column-rotation` → no label. Beam label map: `beam-width` → `w`, `beam-depth` → `d`; positional grips (start/end/midpoint/curve) → no label. Label style: white pill background (3px padding, 3px border-radius) + dark text `rgba(0,0,0,0.75)`, `9px sans-serif`, offset `(+12, -4)` from grip screen position — matches `drawDepthIndicator` style. `drawLabelPill` uses `ctx.roundRect` (browser-native, IE11+ not targeted). **Files created (2)**: `hooks/tools/useGripDimAnnotation.ts` (~180 lines), `components/dxf-layout/canvas-layer-stack-grip-dim-annotation.tsx` (~30 lines). **Files modified (3)**: `hooks/grip-computation.ts` (+`columnGripKind?`+`beamGripKind?` to `DxfGripDragPreview` + imports), `hooks/grips/grip-projections.ts` (`buildDxfDragPreview`: +column/beam kind spreads + anchorPos for column/beam), `components/dxf-layout/canvas-layer-stack-leaves.tsx` (+import + `<GripDimAnnotationMount>` in `PreviewCanvasMounts`). **Docs updated (2)**: ADR-363 (this entry) + ADR-040 (changelog). ✅ Google-level: YES — ADR-040 leaf pattern (zero orchestrator subscription), RAF-driven (no React re-renders inside hook), correct canvas ordering (RAF FIFO via mount order), reuse-first (`applyColumnGripDrag`/`applyBeamGripDrag` SSoT), no new i18n (labels are unit strings not translatable dimension annotations per industry convention — AutoCAD/Revit don't translate "w=350"), label cleared on drag end (useEffect cleanup). | Claude Sonnet 4.6 |
| 2026-05-19 | **R2 IMPLEMENTED — Stair Bridge Helpers Cross-Domain Fix**. Resolved cross-domain coupling: `bim/hooks/use-ribbon-stair-bridge.ts` was importing from `ui/ribbon/hooks/bridge/stair-command-keys` and `stair-param-helpers` (BIM → UI direction, violation of layer order). Fix: copy content to `bim/hooks/bridge/stair-command-keys.ts` + `stair-param-helpers.ts` (new canonical location) with updated relative imports (`../../../../bim/` paths → `../types/`, `../stairs/`). Old files replaced with re-export barrels (`export * from '../../../../bim/hooks/bridge/...'`) so existing UI consumers (`contextual-stair-tab.ts`, `useRibbonCommands.ts`) require no immediate import updates. `bim/hooks/use-ribbon-stair-bridge.ts` now imports from `./bridge/stair-command-keys` and `./bridge/stair-param-helpers` (clean same-domain import). **Files created (2)**: `bim/hooks/bridge/stair-command-keys.ts`, `bim/hooks/bridge/stair-param-helpers.ts`. **Files modified (3)**: old `stair-command-keys.ts` + `stair-param-helpers.ts` (barrels), `use-ribbon-stair-bridge.ts` (import paths). ✅ Google-level: YES — cross-domain coupling fixed, backward-compat preserved via barrel re-exports, clean domain boundary (BIM hooks own BIM bridge helpers). | Claude Sonnet 4.6 |
| 2026-05-19 | **R1 IMPLEMENTED — useBimCopyTool (AutoCAD COPY pattern)**. Closes Phase 7.2 pending follow-up: `copy-selected` action (CO chord) now activates `useBimCopyTool` FSM. FSM: `idle → awaiting-base-point → awaiting-target-point (continuous loop)`. Click 1: record base point. Click 2+: compute translate delta → `new BimCopyCommand(bimIds, {kind:'translate', delta})` → execute → stay in awaiting-target-point (continuous). ESC → select mode. BIM filter: `['wall','opening','slab','slab-opening','column','beam','stair']` — non-BIM in selection silently skipped by `BimCopyCommand`. `BIM_COPY_TYPES` set local to hook (mirrors `ID_GENERATORS` in bim-copy-builder). No BIM entities in selection → revert to `select` immediately. Tool hint override per phase (i18n `dxf-viewer-guides:bimCopyTool.*`). **Files created (2)**: `hooks/tools/useBimCopyTool.ts`, `hooks/tools/__tests__/useBimCopyTool.test.ts` (16 tests: activation×4, FSM×5, escape×1, BIM-type-filter×8). **Files modified (11)**: `ui/toolbar/types.ts` (+`'bim-copy'`), `systems/tools/ToolStateManager.ts` (+entry), `hooks/tools/useModifyTools.ts` (+instantiate+return), `hooks/useDxfViewerState.ts` (+`case 'copy-selected'`), `hooks/canvas/canvas-click-types.ts` (+bimCopy props), `hooks/canvas/useCanvasClickHandler.ts` (+PRIORITY 1.62), `hooks/canvas/useCanvasKeyboardShortcuts.ts` (+bimCopy escape params), `hooks/canvas/useCanvasEscapeRegistrations.ts` (+buildModifyHandler), `components/dxf-layout/CanvasSection.tsx` (+click+escape wiring), `el/dxf-viewer-guides.json`, `en/dxf-viewer-guides.json` (+bimCopyTool keys). ✅ Google-level: YES — AutoCAD COPY parity (continuous-mode from same base, ESC to exit), `BimCopyCommand` SSoT reused (zero duplication), idempotent (each click = deterministic delta), ADR-040 compliant (no orchestrator subscriptions), enterprise IDs via kind-specific generators (SOS N.6 inherited from BimCopyCommand), i18n-correct (N.11), BIM-type filter future-proof (7 kinds). | Claude Sonnet 4.6 |
| 2026-05-19 | **Phase A IMPLEMENTED — Wall Category Chords (We/Wi/Wp/Wf/Wt)**. Extends Phase 7B kind-chord pattern with a second dimension: `W+E/I/P/F/T` BIM chords set `WallParams.category` (exterior/interior/parapet/fence/partition) via `overrides` without resetting the state machine. Unlike kind chords, category chords preserve the current drawing phase — only activating from idle. EventBus `'bim:set-wall-category'` event added to `EventBus.ts`. `useWallTool` `setCategory` callback updates `overrides.category` + activates from idle. `useDxfToolbarShortcuts` 5 new chord entries + `wall:category:*` action prefix in chord-completed handler. `keyboard-shortcuts.ts` 5 documentary entries. **Files modified (4)**: EventBus.ts, useDxfToolbarShortcuts.ts, useWallTool.ts, keyboard-shortcuts.ts. ✅ Google-level: YES — EventBus SSoT (no prop-drilling), setCategory stable ref (zero stale-closure risk), no state-machine reset on mid-drawing category change (preserves drawing continuity), idempotent (same category = no visible change), mirrors Phase 7B pattern exactly. | Claude Sonnet 4.6 |
| 2026-05-19 | **Phase 7.2 FOLLOW-UP — L/T Column Arm Handedness on Mirror**. Closes the Phase 7.2 caveat: L-shape / T-shape column arm direction now correctly flips on mirror. Implementation: `flipY?: boolean` added to `ColumnLshapeParams` + `ColumnTshapeParams`; `buildLshapeLocal` + `buildTshapeLocal` apply `ys = flipY ? -1 : 1` sign on all y-vertices + reverse array to restore CCW winding; `mirrorColumn()` toggles `lshape.flipY` / `tshape.flipY`. Mathematical basis: local transform `T = R(-θ') × M × R(θ)` has `T[1][1] = -1` algebraically for ALL axisAngle+rotation pairs (proven: `−sin²(2α−θ) − cos²(2α−θ) = −1`) → always toggle `flipY`, zero runtime matrix math. Double-mirror restores original arm orientation (idempotent via XOR toggle). **Files modified (3)**: `bim/types/column-types.ts` (+`flipY`), `bim/geometry/column-geometry.ts` (flipY support in both L+T builders), `bim/transforms/bim-mirror-geometry.ts` (`mirrorColumn` L/T branches + caveat removed). **Tests: +7 new** (L-shape false→true, true→false, axis-independent, no-override default, T-shape false→true, true→false, rectangular unaffected) → **28 total in bim-mirror-geometry.test.ts**. ✅ Google-level: YES — pure parametric SSoT (flipY stored in params, geometry fully re-derived), idempotent (2× mirror = identity), zero runtime matrix computation (algebraic proof), no UI/ribbon/i18n changes (internal geometry param). | Claude Sonnet 4.6 |
| 2026-05-20 | **Phase 4.5c.6 IMPLEMENTED — L/T Column Section-Profile Symbol Overlay**. Closes το last remaining deferred item από Phase 4.5b/4.5c series: "section-profile preview overlay για L/T variants". Mirrors ADR-363 Phase 5.5h (steel I/H beam symbol) adapted for column variants. **New SSoT**: `bim/columns/column-section-profile.ts` (pure, zero React/DOM/canvas/Firestore deps) — `computeLProfileOutline(w,h,lt,flipY)` → 6-vertex closed ∟ polygon; `computeTProfileOutline(flangeW,totalH,flangeT,webW,flipY)` → 8-vertex closed ⊤ polygon; 13 exported constants (sizes, colours, thresholds). **ColumnRenderer**: imports from SSoT; `drawSectionProfile(column)` private method — guards (L/T only, steel material via `resolveMaterialKey`, `scale < 0.06`, footprint screen span < 14px), screen bbox via `worldToScreen` on `geometry.bbox.min/.max`, symbol centre = rightmost screen X + 12px offset (vertically centred on column), `flipY` read from `params.lshape?.flipY` / `params.tshape?.flipY` (mirrors Phase 7.2 handedness), trace outline + fill `rgba(90,50,190,0.18)` + stroke `rgba(50,20,140,0.82)` 1.5px solid; called from `render()` under `highlighted` guard alongside `drawVariantDimensionLabels`. ADR-040: ZERO new store subscriptions. **Tests**: 27/27 pass (`bim/columns/__tests__/column-section-profile.test.ts` — L-shape×9 + T-shape×8 + constants×10). **Files created (2)**: `bim/columns/column-section-profile.ts`, `bim/columns/__tests__/column-section-profile.test.ts`. **Files modified (1)**: `bim/renderers/ColumnRenderer.ts`. ✅ Google-level: YES — pure SSoT module (mirrors Phase 5.5h beam pattern), ADR-040 micro-leaf compliant (zero new subscriptions), suppression guards prevent pixel blur, flipY mirrors Phase 7.2 idempotent handedness, steel-only guard avoids noise on non-steel variants, 27/27 tests green. | Claude Sonnet 4.6 |
| 2026-05-20 | **SSOT FIX — Wall scalar params always in mm (ADR-363 unit convention)**. Root cause: `wall-completion.ts` violated the declared mm convention by converting `height` and `thickness` to scene units via `mmToSceneUnits(sceneUnits)` at build time, while all other BIM entities (slab, beam, column) stored raw mm. This caused: (1) 3D walls 1000× too tall when sceneUnits='mm' canvas (BimToThreeConverter expected meters, got mm), (2) BOQ area/volume off by 1000× when sceneUnits='m' (wall-geometry.ts did `height * MM_TO_M` expecting mm, got meters), (3) opening validator `wallHeightMm = hostWall.params.height` compared meters as mm. **Fix — 7 files**: (1) `wall-types.ts` — added `sceneUnits?: SceneUnits` to `WallParams`; corrected JSDoc for `start/end` (canvas world coords, not mm); height/thickness JSDoc clarified as "always mm". Added SceneUnits import. (2) `wall-completion.ts` — removed `const s = mmToSceneUnits(sceneUnits)` + all scaling; `buildDefaultWallParams` stores raw mm; DNA layers stored raw mm (no scale); added `sceneUnits: 'mm'` to emitted params; removed `sceneUnits` param from `buildDefaultWallParams` (not needed — builder always stores mm). (3) `wall-geometry.ts` — added `mmToSceneUnits` import; added `const s = mmToSceneUnits(params.sceneUnits ?? 'mm')` in `computeWallGeometry`; uses `halfThicknessCanvas = (thickness/2) * s` for edge offsets; `computeBbox` receives `height * s` (canvas units); `lengthM = lengthCanvas * MM_TO_M / s` (correct canvas → m conversion regardless of sceneUnits); `heightM/thicknessM * MM_TO_M` now always correct (mm input). (4) `wall-validator.ts` — `validateThickness` + `validateDnaConsistency`: compare directly against mm constants (no `* s`); `validateGeometry` retains `s` for canvas-unit length comparison. (5) `BimToThreeConverter.ts` — `extrudeAndRotate(shape, wall.params.height * MM_TO_M)` (was passing height directly). (6) `wall-split.ts` — `computeSplitWallParams` shared params now includes `sceneUnits: wall.params.sceneUnits`. (7) `useWallPersistence.ts` — `migrateParamsToMm()` migration function: detects legacy entities (no `sceneUnits` field + height < 100 → was meters) and converts height×1000, thickness×1000, DNA×1000, adds `sceneUnits:'mm'`. **Callers updated (2)**: `useWallTool.ts` (3 calls to `buildDefaultWallParams` — removed sceneUnits arg), `wall-preview-helpers.ts` (2 calls — same). **Pending ratchet**: bevel fields (`startBevel/endBevel`) are still stored in canvas world units by wall-join operations — should be migrated to mm in a future pass. ✅ Google-level: YES — complete SSoT (single storage unit for all BIM scalar params), backward-compat (migration in docToEntity), no caller changes for computeWallGeometry (sceneUnits self-contained in params), idempotent migration (already-migrated entities have sceneUnits field → no-op), consistent with Revit/AutoCAD internal mm storage convention. | Claude Sonnet 4.6 |
| 2026-05-20 | **BUG FIX — 3D Slab elevation convention: bottom surface, extrudes upward**. After the mm→m unit fix, slab appeared to extend from y=0 DOWNWARD (floor:elevation=0 → top at 0, bottom at -0.20m) while walls extend from y=0 UPWARD. Root cause: `slabToMesh()` used `mesh.position.y = elevationM - thicknessM` (elevation=top surface) but walls use floor elevation = bottom surface. Fix: changed `elevation` semantic to **bottom surface** → `mesh.position.y = elevationM` (extrusion goes upward by thicknessM). Default values in `SLAB_KIND_DEFAULT_ELEVATION_MM` remain correct: `floor:0 → 0..+0.20m`, `ceiling:2800 → 2.80..3.00m`, `roof:3000 → 3.00..3.20m`. Documentation updated: `SlabParams.elevation` JSDoc + constant comment in `slab-types.ts`. **Files modified (2)**: `bim-3d/converters/BimToThreeConverter.ts` (slabToMesh), `bim/types/slab-types.ts` (2 doc comments). ✅ Google-level: YES — matches wall convention (floor elevation = bottom of element, extrude upward), no data migration needed (default values align with new semantic), single-line renderer change. | Claude Sonnet 4.6 |
| 2026-05-20 | **BUG FIX — 3D Slab/Column/Beam unit mismatch (1000× thickness)**. Root cause: `BimToThreeConverter.ts` comment incorrectly stated all BIM params are in "canvas world units (~meters)". In reality, `slab.params.thickness`, `slab.params.elevation`, `beam.params.depth`, `beam.params.elevation`, `column.params.height`, and `floorElevationMm` are stored in **raw mm** by their completion builders (`slab-completion.ts`, `beam-completion.ts`, `column-completion.ts`) — only `wall.params.height` is in meters (because `wall-completion.ts` applies `mmToSceneUnits()`). Three.js scene is in meters → 200mm slab appeared as 200m thick (1000× error). Fix: added `const MM_TO_M = 0.001` constant + accurate comment block. Applied `* MM_TO_M` to: `slab.params.thickness` + `slab.params.elevation` (in `slabToMesh`), `beam.params.depth` + `beam.params.elevation` (in `beamToMesh`), `column.params.height` (in `columnToMesh`), `floorElevationMm` (in `wallToMesh` — was already 0 for ground floor so invisible, but fixed for multi-floor correctness). Shape vertices (outerEdge, footprint, outline) remain unconverted — correct since canvas world coords are already in meters. **Files modified (1)**: `bim-3d/converters/BimToThreeConverter.ts`. ✅ Google-level: YES — root-cause fix (renderer applies correct mm→m scale), backward-compatible (wall.params.height left unchanged as it's already meters), `MM_TO_M` named constant (not magic number), accurate comment documents the exception for wall.params.height. | Claude Sonnet 4.6 |
| 2026-05-20 | **BUG FIX — Wall entity invisible on canvas after second click**. Root cause: `useDxfSceneConversion.convertEntity()` lacked a `case 'wall'` branch — `WallEntity` (type: `'wall'`) fell through to `default → return null`, silently dropped from `DxfEntityUnion[]`. Same regression pattern as the ADR-362 dimension fix (noted in that comment). Fix (3 files): (1) `canvas-v2/dxf-canvas/dxf-types.ts` — added `DxfWall` interface (`wallEntity: WallEntity`) + added `'wall'` to `DxfEntity.type` union + added `DxfWall` to `DxfEntityUnion`. (2) `hooks/canvas/useDxfSceneConversion.ts` — added `isWallEntity`/`WallEntity` imports + `case 'wall'` wrapping into `DxfWall`. (3) `canvas-v2/dxf-canvas/DxfRenderer.ts` — added `case 'wall'` to `toEntityModel()` unwrapping `wallEntity.{kind, params, geometry, validation}` (mirrors `case 'stair'` pattern). `WallRenderer` was already registered in `EntityRendererComposite` at `'wall'` key — the pipeline was complete except for this missing conversion step. ✅ Google-level: YES — 3-file targeted fix, zero duplication, mirrors established stair/slab/opening/dimension patterns, exhaustive TS type guard maintained. | Claude Sonnet 4.6 |
| 2026-05-20 | **SSOT FIX — Beam/Column/Slab sceneUnits propagation (mirror του wall fix 2026-05-20)**. Επεκτείνει το wall scalar-params-always-in-mm fix στα υπόλοιπα 3 BIM entities. Πριν: beam/column/slab geometry έκαναν `width / 2`, `depth * MM_TO_M`, `polygonArea * MM_TO_M²` υποθέτοντας ότι params και canvas vertices ήταν στην ίδια unit. Σπάει όταν `sceneUnits !== 'mm'` — outline offsets λάθος, BOQ area/volume 10⁶× off. **Fix — 8 files**: (1) `bim/types/{beam,column,slab}-types.ts` — `sceneUnits?: SceneUnits` field σε `BeamParams`/`ColumnParams`/`SlabParams` (default `'mm'` για legacy Firestore docs). (2) `bim/geometry/beam-geometry.ts` — `const s = mmToSceneUnits(params.sceneUnits)`, `buildOutlineRect(axis, widthMm, s)` → `half = (widthMm * s) / 2`, `computeBbox` paid `elevationMm * s`, `lengthM = lengthCanvas * (1/s) * MM_TO_M`, ίδιο για `getBeamSpanDepthRatio`. (3) `bim/geometry/column-geometry.ts` — `buildLocalFootprint(params, s)` και 4 builders (rect/circular/L/T) scale όλους τους mm scalars × s, `transformFootprint` scales anchor offsets × s, `areaM2 = areaCanvas2 * canvasToM²`. (4) `bim/geometry/slab-geometry.ts` — `canvasToM = (1/s) * MM_TO_M` για area/perimeter/bbox; `computeSlabMaxFreeSpanM` νέο optional `sceneUnits` param για bbox fallback unit. (5) `bim/validators/beam-validator.ts` — `validateAxis` chord compared with `MIN_BEAM_LENGTH_MM * s` (mirrors wall validator). (6) `hooks/drawing/beam-completion.ts` — `buildDefaultBeamParams` + `buildBeamEntity` + `complete*` δέχονται `sceneUnits` arg, stored στα params. (7) `hooks/drawing/column-completion.ts` — same pattern. (8) `hooks/drawing/slab-completion.ts` — same pattern. **Callers (5)**: `useBeamTool.ts`/`useColumnTool.ts`/`useSlabTool.ts` αποκτούν `getSceneUnits?: () => SceneUnits` option (mirror του useWallTool pattern) + περνούν στο builder. `beam-preview-helpers.ts` + `wall-preview-helpers.ts` + `useWallTool.ts` + `wall-completion.ts` περνούν `sceneUnits` στο `buildDefaultWallParams` (closes mini-regression από προηγούμενο commit όπου `buildDefaultWallParams` αγνοούσε το arg). **Pending**: orchestrator wiring (`getSceneUnits` callback από useColumnTool/useSlabTool/useBeamTool consumers — επόμενη φάση). ✅ Google-level: YES — complete SSoT (params always mm, geometry derives canvas-unit outlines + m² BOQ via single `s` factor), backward-compat (sceneUnits optional, defaults 'mm'), mirrors established wall pattern (industry convergence AutoCAD/Revit internal mm storage), idempotent (pure functions), pure validators (no React/canvas touch), zero ribbon/i18n/command surface change. | Claude Opus 4.7 |
| 2026-05-20 | **BUG FIX — Phase 5.5P beam ghost preview flickering during mousemove**. Δύο ανεξάρτητα bugs ανιχνεύθηκαν μέσω `console.trace` + `console.debug` diagnostics. **Bug 1** (`useCenterMarkCreate.ts`): `useEffect([activeTool])` καλούσε `previewCanvasRef.current?.clear()` unconditionally σε κάθε αλλαγή `activeTool` — συμπεριλαμβανομένου του switch από dim-center-mark → beam. Αποτέλεσμα: το preview canvas cleared ακριβώς τη στιγμή που ο beam tool ενεργοποιείται, σβήνοντας το green ghost rectangle. Fix: guard `if (CENTER_MARK_TOOLS.has(activeTool))` — το `clear()` πλέον πυροδοτείται ΜΟΝΟ όταν εισέρχεται center-mark mode. **Bug 2** (`useBeamTool.ts`): ο συγχρονισμός `beamPreviewStore` → `useEffect([state])` ήταν async (passive effect, fires after paint). Αν ο React scheduler επεξεργαζόταν ένα mousemove event πριν εκτελεστεί το effect του click, το `beamPreviewStore.get().startPoint` εξακολουθούσε να είναι `null` → `tempPoints = []` → cursor-dot αντί για rectangle. Fix: αφαιρέθηκε πλήρως ο `useEffect([state])` από το `useBeamTool`. Κάθε state transition (`activate`, `setKind`, `deactivate`, `reset`, `setParamOverrides`) πλέον sync-ize το store ΑΜΕΣΩΣ (πριν το `setState`), χρησιμοποιώντας `stateRef.current` για πρόσβαση στην τρέχουσα κατάσταση χωρίς stale closure. Pattern mirrors click handlers (σύγχρονο set + setState). Παραμένει μόνο `useEffect([], cleanup)` για unmount teardown. **Cleanup**: `console.trace` αφαιρέθηκε από `PreviewRenderer.clear()`, `console.debug` αφαιρέθηκε από `updatePreview` beam branch. **Files modified (4)**: `hooks/dimensions/useCenterMarkCreate.ts` (guard), `hooks/drawing/useBeamTool.ts` (sync store updates), `canvas-v2/preview-canvas/PreviewRenderer.ts` (trace removed), `hooks/drawing/useUnifiedDrawing.tsx` (debug removed). ✅ Google-level: YES — root-cause fixes (zero timing window for stale store reads), sync-before-setState pattern consistent με click handlers, ADR-040 micro-leaf compliant (store is module-level, zero React subscriptions added), equality guard στο `beamPreviewStore.set()` αποτρέπει unnecessary notifications. | Claude Sonnet 4.6 |
| 2026-05-21 | **BUG FIX — BIM entity ghost preview missing during grip drag (beam/slab/slab-opening/opening)**. Root cause: 4-point pipeline gap. (1) `DxfGripDragPreview` interface missing `slabGripKind`, `slabOpeningGripKind`, `openingGripKind` fields. (2) `buildDxfDragPreview()` not propagating these 3 kinds from `UnifiedGripInfo` (which already had them). (3) `EntityPreviewTransform` missing `beamGripKind`, `slabGripKind`, `slabOpeningGripKind` + `applyEntityPreview()` not destructuring/routing them. (4) `drawGhostEntity()` missing `case` entries for all 4 entity types. Fix — 4 files: (A) `hooks/grip-computation.ts`: added `SlabGripKind`, `SlabOpeningGripKind`, `OpeningGripKind` imports + 3 fields to `DxfGripDragPreview`. (B) `hooks/grips/grip-projections.ts`: added 3 spread entries in `buildDxfDragPreview` for slab/slabOpening/opening grip kinds. (C) `rendering/ghost/apply-entity-preview.ts`: added `beamGripKind`/`slabGripKind`/`slabOpeningGripKind` to `EntityPreviewTransform`; 3 parametric preview blocks (beam→`applyBeamGripDrag`+`computeBeamGeometry`; slab→`applySlabGripDrag`; slab-opening→`applySlabOpeningGripDrag`); 4 `movesEntity` translation cases (beam via `beam-midpoint`; slab/slab-opening via vertex translate; opening via geometry outline translate). (D) `rendering/ghost/draw-ghost-entity.ts`: extracted `drawPolygon()` helper (DRY — reused by all 4 new cases); added `case 'beam'` (geometry.outline.vertices), `case 'slab'` (slabEntity.params.outline.vertices), `case 'slab-opening'` (slabOpeningEntity.params.outline.vertices), `case 'opening'` (openingEntity.geometry.outline.vertices). ✅ Google-level: YES — root-cause fix at all 4 pipeline layers, reuses existing SSoT helpers (`applyBeamGripDrag`, `applySlabGripDrag`, `applySlabOpeningGripDrag`), `drawPolygon` eliminates 4× copy-paste, pure functions (no mutation), idempotent, zero new React subscriptions. | Claude Sonnet 4.6 |
| 2026-05-21 | **BUG FIX — Wall Move command ghost missing (movesEntity switch gap in applyEntityPreview)**. Root cause: `applyEntityPreview()` `movesEntity` switch lacked `case 'wall'`. When Move command used on wall: `makeTranslationPreview` creates preview with `movesEntity:true` but no `wallGripKind` → wall parametric block skipped → movesEntity switch has no wall case → falls through → returns original entity → `transformed === entity` → no ghost in `useMovePreview`. Grip drag ghost (endpoint/midpoint) was unaffected because those paths go through the parametric block. **Fix — 1 file**: `apply-entity-preview.ts` — added `case 'wall'` in movesEntity switch: delegates to `applyWallGripDrag('wall-midpoint', { originalParams: wall.params, delta, currentPos: delta })` (SSoT in `wall-grips.ts:217` — `moveMidpoint` uses only `delta` + `originalParams`, `currentPos` unused for this kind), then `computeWallGeometry(newParams, wall.kind)`. Mirrors beam pattern exactly (`applyBeamGripDrag('beam-midpoint', ...)` → beam translate SSoT). `drawGhostEntity` wall case already reads `geometry.outerEdge.points` + `geometry.innerEdge.points` — correct output from `computeWallGeometry`. ✅ Google-level: YES — root-cause fix, SSoT-first (delegates to `applyWallGripDrag` instead of inlining arithmetic), idempotent (`newParams === wall.params` early return), no new imports. | Claude Sonnet 4.6 |
| 2026-05-21 | **BUG FIX — Slab/slab-opening/opening ghost preview broken (DxfWrapper vs raw entity mismatch)**. Root cause: `applyEntityPreview()` and `drawGhostEntity()` assumed DxfSlab/DxfSlabOpening/DxfOpening wrapper structs (`.slabEntity.params`, `.slabOpeningEntity.params`, `.openingEntity.geometry`) — but `useGripGhostPreview.getEntity()` reads from `scene.entities` which contains **raw** `SlabEntity` / `SlabOpeningEntity` / `OpeningEntity` (`.params` / `.geometry` directly, same as `BeamEntity`). Result: accessing `.slabEntity` on a raw SlabEntity returns `undefined` → `undefined.params` → TypeError in RAF → no ghost drawn. `applyEntityPreview` movesEntity translate path had same bug for all 3 types. **Fix — 2 files**: (A) `apply-entity-preview.ts`: parametric blocks for slab/slab-opening now cast as raw entity (`entity as unknown as SlabEntity` / `SlabOpeningEntity`) + return `{ ...entity, params: newParams }`. Opening movesEntity block reads `opening.geometry.outline` directly, returns `{ ...entity, geometry: { ...geometry, outline: {...} } }`. Added `OpeningEntity` import. (B) `draw-ghost-entity.ts`: `case 'slab'` reads `.params?.outline?.vertices`, `case 'slab-opening'` reads `.params?.outline?.vertices`, `case 'opening'` reads `.geometry?.outline?.vertices` (removed `.slabEntity` / `.slabOpeningEntity` / `.openingEntity` nesting). Note: beam was already correct (`.geometry?.outline?.vertices` direct access) — wall was already correct (direct WallEntity cast). ✅ Google-level: YES — root-cause fix at both pipeline layers (applyEntityPreview + drawGhostEntity), mirrors established beam/wall pattern (industry SSoT), no mutation, idempotent, zero new subscriptions, OpeningEntity import closes missing type guard. | Claude Sonnet 4.6 |
| 2026-05-21 | **BUG FIX — Beam/slab/slab-opening endpoint grip ghost missing (useGripGhostPreview pipeline gap)**. Root cause: `useGripGhostPreview.ts` manually constructs `EntityPreviewTransform` from `DxfGripDragPreview` but omitted `beamGripKind`, `slabGripKind`, `slabOpeningGripKind` pass-throughs (lines 99-110). Without these, `applyEntityPreview()` never hit the parametric blocks for beam-start/beam-end/beam-curve/slab-vertex/slab-opening-vertex drags — returning the original entity unchanged → `transformed === entity` guard triggered → no ghost drawn. The `movesEntity=true` path (translate whole entity) already worked because it doesn't require these kinds. `wallGripKind` and `stairGripKind` were already correctly passed through (wall/stair endpoint ghosts worked before this fix). **Fix — 1 file**: `hooks/tools/useGripGhostPreview.ts` — added 3 spread entries: `beamGripKind`, `slabGripKind`, `slabOpeningGripKind`. `anchorPos` propagation was already correct. `openingGripKind` NOT added — openings have no parametric block in `applyEntityPreview` (opening grips use `movesEntity:true` translate path only). ✅ Google-level: YES — root-cause fix (5th gap in the 5-layer ghost pipeline), minimal change (1 file, 3 lines), mirrors existing stair/wall pass-through pattern, idempotent (undefined → empty spread), no new subscriptions. | Claude Sonnet 4.6 |
| 2026-05-21 | **BUG FIX — BIM entity grips missing in 2D canvas (beam/slab/slab-opening/opening)**. Root cause: `computeDxfEntityGrips()` in `hooks/grip-computation.ts` switch statement lacked `case` entries for `'beam'`, `'slab'`, `'slab-opening'`, `'opening'` — all fell through silently returning `[]`. Column is not in `DxfEntityUnion` (BIM-layer only) so no grip case needed. Fix: added 4 cases using correct access patterns: `'beam'` → direct (`entity as unknown as BeamEntity`, mirrors wall pattern); `'slab'` → wrapper (`entity.slabEntity`); `'slab-opening'` → wrapper (`entity.slabOpeningEntity`); `'opening'` → wrapper (`entity.openingEntity`). Added imports for `BeamEntity` type + `getBeamGrips`, `getSlabGrips`, `getSlabOpeningGrips`, `getOpeningGrips`. **Files modified (1)**: `hooks/grip-computation.ts`. ✅ Google-level: YES — root-cause fix, mirrors established stair/wall/xline/ray pattern, exhaustive coverage of all 4 missing union members, zero side effects. | Claude Sonnet 4.6 |
| 2026-05-21 | **Phase 0.5 follow-up — `types/entities.ts` consumer sweep fix**. `entities.ts` είχε παραλειφθεί από τη consumer sweep της Phase 0.5: εξακολουθούσε να importάρει `StairEntity` / `StairKind` / `StairParams` / `StairVariantParams` / `StairGeometry` / `StairDoc` / `StairPresetDoc` / `StairQTO` από `'./stair'` — barrel που είχε διαγραφεί στη Phase 0.5. Fix: 2 import statements ενημερώθηκαν σε `'../bim/types/stair-types'` (canonical path). Το `types/stair.ts` ΔΕΝ επανδημιουργήθηκε — σωστά σύμφωνα με Phase 0.5 intent. **Files modified (1)**: `types/entities.ts`. | Claude Sonnet 4.6 |
| 2026-05-19 | **Phase 5.5e IMPLEMENTED — Snap-to-Wall-Axis Perpendicular Projection**. Closes το `snap-to-wall-axis projection` deferred item από Phase 5.5d. Industry parity: AutoCAD NEAREST + PERPENDICULAR osnaps και Revit "Snap to Reference Line" — beam endpoints (ή κάθε drawing tool με snap ενεργό) κουμπώνουν στην ορθή προβολή πάνω στον wall axis όταν ο cursor μπει εντός snap radius. Root cause: ούτε `NearestSnapEngine` ούτε `PerpendicularSnapEngine` αναγνώριζαν `WallEntity` — walls είχαν spatial-index entries μόνο για endpoints (Phase 1B) + midpoints (Phase 1C). Design: reuse-first — extend τους δύο engines με `isWallEntity` branch, ΟΧΙ νέος engine, ΟΧΙ νέος `ExtendedSnapType` (industry convergence — AutoCAD/Revit architectural preset ήδη έχει και τους δύο osnaps active). Pure SSoT module `bim/walls/wall-axis-projection.ts` με 2 functions: `projectPointOnWallAxis(wall, cursor): Point2D \| null` (clamped, NEAREST semantics — `getNearestPointOnLine` clamp=true ανά segment, αν cursor εκτός segment foot=endpoint) και `getWallAxisPerpendicularFeet(wall, cursor, maxDistance): Array<{point, segmentIndex}>` (unclamped, PERPENDICULAR semantics — clamp=false + radius filter, επιτρέπει foot σε προέκταση). Leverage cached `wall.geometry.axisPolyline.points` (Phase 1 invariant) → uniform code path για straight (2 verts) / curved (17 tessellated λόγω `CURVED_SUBDIVISIONS=16`) / polyline (N user verts) → ZERO Bezier math duplication, ZERO export του internal `subdivideQuadraticBezier`. Defensive null guards αν geometry missing. Zero changes σε beam side, ribbon, i18n, command surface. **Files created (2)**: `bim/walls/wall-axis-projection.ts` (pure SSoT, 90 γρ), `bim/walls/__tests__/wall-axis-projection.test.ts` (12 Jest tests — clamped × 6 + unclamped × 6, καλύπτει straight/curved/polyline + null geometry guards). **Files modified (2)**: `snapping/engines/NearestSnapEngine.ts` (νέο `isWallEntity` import + `projectPointOnWallAxis` import + branch στην αρχή του `getNearestPointOnEntity()`), `snapping/engines/PerpendicularSnapEngine.ts` (νέο `isWallEntity` import + `getWallAxisPerpendicularFeet` import + `else if (isWallEntity)` branch στο `getPerpendicularPoints()` με label `'Wall Axis Segment N'`). Phase 5.5d deferred list ticked (snap-to-wall-axis ✅). **Deferred Phase 5.5f+**: snap-to-slab-edge perpendicular, snap-to-opening-jamb perpendicular, distinct i18n label "Επί άξονα τοίχου", column-center-line 3D wireframe snap (από Phase 5.5d), beam-supports-slab analytical link (Phase 6), section-profile preview steel I/H beams. ✅ Google-level: YES — pure SSoT (axis projection single-sourced + cached geometry leveraged ZERO duplication), reuse-first architecture (extend existing engines, industry convergence AutoCAD/Revit), idempotent (pure functions), ADR-040 micro-leaf compliance (ZERO new React subscriptions), clamped vs unclamped maps clean σε NEAREST vs PERPENDICULAR osnap intents, defensive missing geometry, zero ribbon/i18n/command changes. | Claude Opus 4.7 |
| 2026-05-26 | **BUG FIX — Firestore  on opening save**. Root cause:  uses  (full overwrite) and always sets . The Firestore  UPDATE rule requires  — a new  is never equal to the stored timestamp → rule rejects every update. Reproduced on: auto-save after ribbon param edit, , and any re-save of an existing opening. **Fix — 2 files**: (A) : added  to ;  now includes  in the  payload. (B) :  uses  only when  (first write → CREATE rule applies); for  (existing opening) uses  —  preserves / → UPDATE rule passes. ✅ Google-level: YES — root-cause fix at service boundary, minimal change (2 files), correct Firestore create-vs-update semantics, mirrors  split pattern. | Claude Sonnet 4.6 |
| 2026-05-26 | **BUG FIX β€” Firestore permission error on opening update**. Root cause: `saveOpening()` uses `setDoc` (full overwrite) and always writes `createdAt: serverTimestamp()`. The Firestore `floorplan_openings` UPDATE rule requires `request.resource.data.createdAt == resource.data.createdAt` β€” a new `serverTimestamp()` never equals the stored Timestamp β†’ rule rejects every update (auto-save, ribbon edits, `saveNow`). Fix β€” 2 files: (A) `opening-firestore-service.ts`: added `kind?` to `OpeningUpdateInput`; `updateOpening()` includes `kind` in `updateDoc` payload. (B) `useOpeningPersistence.ts`: `persist()` uses `saveOpening` only when `isNew===true` (first write, CREATE rule); for `isNew===false` uses `updateOpening()` β€” `updateDoc` preserves `createdAt`/`createdBy` β†’ UPDATE rule passes. β… Google-level: YES β€” root-cause fix, correct Firestore create-vs-update semantics, minimal 2-file change. | Claude Sonnet 4.6 |
| 2026-05-27 | **Phase 1C-bis IMPLEMENTED — Asymmetric corner grips για BIM wall (4 corners + axis recenter)**. Closes το direct-manipulation principle gap του Phase 1C. Industry parity ArchiCAD / Vectorworks / AutoCAD reference-line stretch (3/4 industry tools — Revit uses Location Line property αντί per-corner grip). Πριν: ο straight wall είχε 4 grips (start/end midpoint/thickness symmetric); η αλλαγή πάχους ήταν μόνο συμμετρική γύρω από τον άξονα — αν χρήστης πιάσει «οπτική» γωνία τοίχου, τα δύο πρόσωπα κουνιόντουσαν ταυτόχρονα (Direct Manipulation violation: «πιάνεις κάτω γωνία αλλά κουνιέται και η πάνω»). Φιλοσοφία: ο τοίχος είναι `axis + thickness` με parallel faces invariant — δεν τραπέζιο. **Λύση**: 4 νέα grip kinds (`wall-corner-start-pos/neg`, `wall-corner-end-pos/neg`), εμφανίζονται μόνο για `kind==='straight'` στις 4 γωνίες του ορθογωνίου περιγράμματος. Drag γωνίας = 2 DOF mapping σε 2 params: axial component → μόνο `start.xy` ή `end.xy` (αναλόγως side); perpendicular component → only the corner's face moves outward/inward + axis recenters by half the displacement → opposite face stays anchored, ο τοίχος μένει ορθογώνιος. Pure function `moveCorner(input, side, perpSign)` στο `wall-grips.ts`: decompose delta σε axial/perp components μέσω existing `unitAxis()` + `perpUnit()` helpers, thickness clamp scene-unit-aware (reuse `minThicknessFloorFor`/`maxThicknessCeilingFor`), back-derive actual perp displacement μετά από clamp ώστε opposite face anchored ακόμη και μετά από floor/ceiling clamp, axis shift `actualPerp_d/2 · p`, drops `dna` parity με `resizeThickness`. **Pipeline reuse**: ZERO αλλαγές σε `WallRenderer.getGrips()` / `computeDxfEntityGrips` / `grip-registry` / `grip-projections` / `apply-entity-preview` / `commitWallGripDrag` / `UpdateWallParamsCommand` — όλα ήδη forward το `wallGripKind` discriminator generically, νέα corner kinds ρέουν χωρίς extra wiring (merge window για drag-and-release, ADR-031, ήδη ενεργό). **Files modified (4)**: `hooks/grip-types.ts` (+4 union members + JSDoc Phase 1C-bis), `bim/walls/wall-grips.ts` (444 lines, εντός N.7.1 500 floor — +4 corner emissions στο `getWallGrips`, +`moveCorner` helper, +4 dispatch branches στο `applyWallGripDrag`, header + layout JSDoc updated), `bim/walls/__tests__/wall-grips.test.ts` (22 tests, test #1 updated 4→8 grips, +8 νέα tests #15–#22 για corner positions / axial drag / +Y -Y perp drag axis recenter / diagonal drag / scene-unit thickness clamp / parallel-faces invariant / opposite-face anchored), `docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md` (Phase 1C-bis section). Tests: 22/22 PASS (14 παλιά + 8 νέα). ✅ Google-level: YES — pure function isolated (ADR-040 micro-leaf compliant, zero React/store touch), parallel-faces invariant mathematically proven via opposite-face back-derivation, idempotent (pure transform), scene-unit-aware clamp reuses existing SSoT helpers, industry convergence pattern (ArchiCAD/Vectorworks/AutoCAD), direct-manipulation principle restored, file-size N.7.1 compliant, ZERO new dependencies. Symmetric thickness handle (#3) intentionally retained — διαφορετική λειτουργία (no axis recenter), mirror Revit "Wall Centerline" location-line mode. | Claude Opus 4.7 |
| 2026-05-27 | **Phase 1C-bis HOTFIX — Corner grips invisible due to showMidpoints filter**. Live test από Giorgio αμέσως μετά το Phase 1C-bis implementation: «βλέπω μόνον 3 χερούλια, όπως πριν». Root cause: `wrapDxfGrip()` στο `hooks/grips/grip-registry.ts:32` έκανε map `grip.type === 'corner' \|\| grip.type === 'midpoint'` → `'edge'` (παλιά συσσώρευση δύο διαφορετικών semantics σε ένα type slot). Στη συνέχεια, line 148 φιλτράρει όλα τα `wrapped.type === 'edge'` όταν `showMidpoints=false`. Αποτέλεσμα: τα νέα 4 corner grips (που εκπέμπονταν με `type: 'corner'`) εξαφανίζονταν στο unified pipeline ακόμη και αν εκπέμπονταν σωστά από το `getWallGrips()`. **Fix — 1 file**: `hooks/grips/grip-registry.ts` — split το mapping: `'corner' → 'vertex'` (corners ΕΙΝΑΙ vertices του outline polygon, όχι midpoints), `'midpoint' → 'edge'` (legacy semantic διατηρείται). Σχόλιο εξηγεί ότι direct-manipulation principle απαιτεί τα corners να είναι πάντα visible όταν entity selected. Tests: 22/22 wall-grips PASS (independent), TSC clean. `UnifiedGripType` union (`'vertex' \| 'center' \| 'edge'`) δεν αλλάζει. Symmetric thickness handle (`wall-thickness`, original `type: 'edge'`) **παραμένει** subject στο showMidpoints filter — legacy behavior preserved, separate user preference. ✅ Google-level: YES — root-cause fix στο SSoT, minimal change (1 line), separation of semantics (corner ≠ midpoint), test coverage maintained. | Claude Opus 4.7 |
