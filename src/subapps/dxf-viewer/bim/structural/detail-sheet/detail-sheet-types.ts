/**
 * ADR-457 — Column Reinforcement Detail Sheet · drawing-model types (SSoT).
 *
 * Pure type module describing ONE paper-style detail sheet of a column's
 * reinforcement as a backend-agnostic geometric model in **sheet-millimetres**
 * (origin top-left, +y downwards — matches both the offscreen Canvas2D preview
 * AND jsPDF page space). The same `DetailSheetModel` is consumed by two
 * backends so that **preview === PDF**:
 *   - `render/detail-canvas-renderer.ts` → live preview inside the dialog.
 *   - `render/detail-pdf-renderer.ts`    → exported / printed PDF.
 *
 * No runtime logic, no imports of runtime code (keeps the dependency graph
 * acyclic). `RectMm` is re-used from the print engine (ADR-453) so the sheet
 * geometry shares the print SSoT for paper rectangles.
 *
 * @module subapps/dxf-viewer/bim/structural/detail-sheet/detail-sheet-types
 * @see docs/centralized-systems/reference/adrs/ADR-457-column-reinforcement-detail-sheet.md
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { PaperSpec, RectMm } from '../../../print/config/paper-types';

export type { RectMm };

/** The five fixed regions of the detail sheet (Revit/Tekla layout). */
export type SheetRegionId =
  | 'plan'          // (1) κάτοψη — κάτω-αριστερά
  | 'elevation'     // (2) όψη — πάνω-αριστερά
  | 'perspective'   // (3) 3Δ προοπτικό — κέντρο/δεξιά
  | 'schedule'      // (5) στοιχεία οπλισμού — πάνω-δεξιά
  | 'title-block';  // (4) στοιχεία σχεδίου — κάτω-δεξιά

/** Stroke styling for a vector primitive, in millimetre line weight. */
export interface SheetStroke {
  /** CSS colour string (hex). */
  readonly colorHex: string;
  /** Line weight in millimetres (ISO pen widths, e.g. 0.13 / 0.25 / 0.5). */
  readonly widthMm: number;
  /** Dash pattern in millimetres (omitted → solid line). */
  readonly dashMm?: readonly number[];
}

/** A straight segment in sheet-mm. */
export interface LinePrimitive {
  readonly kind: 'line';
  readonly a: Point2D;
  readonly b: Point2D;
  readonly stroke: SheetStroke;
}

/** An open or closed polyline in sheet-mm. */
export interface PolylinePrimitive {
  readonly kind: 'polyline';
  readonly points: readonly Point2D[];
  readonly stroke: SheetStroke;
  readonly closed: boolean;
  /** Optional solid fill colour (hex) — used for rebar dots / hatching. */
  readonly fillHex?: string;
}

/** A circle in sheet-mm (longitudinal bar dot, spiral marker). */
export interface CirclePrimitive {
  readonly kind: 'circle';
  readonly center: Point2D;
  readonly radiusMm: number;
  readonly stroke?: SheetStroke;
  readonly fillHex?: string;
}

/**
 * Horizontal text-alignment for a {@link TextPrimitive}. Vertical baseline is
 * always the alphabetic baseline at `position.y` (renderer-handled).
 */
export type TextAlign = 'left' | 'center' | 'right';

/** A pre-resolved text label in sheet-mm (N.11: no i18n keys live in the model). */
export interface TextPrimitive {
  readonly kind: 'text';
  readonly position: Point2D;
  /** Already-translated string — the orchestrator injects resolved labels. */
  readonly text: string;
  /** Cap height in millimetres. */
  readonly heightMm: number;
  readonly colorHex: string;
  readonly align: TextAlign;
  /** Bold weight (headings / values). */
  readonly bold?: boolean;
}

/**
 * A linear dimension between two points in sheet-mm. The renderer materialises
 * extension lines, the dimension line, arrowheads and the centred text from
 * this declarative description via the `detail-sheet-dim` SSoT helper.
 */
export interface DimPrimitive {
  readonly kind: 'dim';
  /** First measured point (sheet-mm). */
  readonly p1: Point2D;
  /** Second measured point (sheet-mm). */
  readonly p2: Point2D;
  /** Perpendicular offset of the dimension line from the p1→p2 axis (mm). */
  readonly offsetMm: number;
  /** Pre-resolved dimension text (e.g. "400"). */
  readonly text: string;
  readonly stroke: SheetStroke;
  /** Text cap height in mm (defaults applied by the renderer when omitted). */
  readonly textHeightMm?: number;
}

/**
 * A raster slot in sheet-mm — the 3D perspective region is rendered offscreen
 * (WebGL → PNG) and placed here so preview and PDF share the identical image.
 */
export interface RasterPrimitive {
  readonly kind: 'raster';
  readonly rect: RectMm;
  /** PNG data URL (offscreen capture); `null` while still rendering. */
  readonly dataUrl: string | null;
  /**
   * Intrinsic pixel width/height of the raster. Lets the PDF backend contain-fit
   * the image without decoding it (the Canvas backend reads the size from the
   * already-decoded image instead). Omitted on the pending (null) slot.
   */
  readonly widthPx?: number;
  readonly heightPx?: number;
}

/** Any drawable element of a region, in sheet-mm. */
export type DetailPrimitive =
  | LinePrimitive
  | PolylinePrimitive
  | CirclePrimitive
  | TextPrimitive
  | DimPrimitive
  | RasterPrimitive;

/** One laid-out region of the sheet with its drawable contents. */
export interface SheetRegion {
  readonly id: SheetRegionId;
  /** Region rectangle in sheet-mm (from `detail-sheet-layout`). */
  readonly rectMm: RectMm;
  /** Pre-resolved region heading (already translated). */
  readonly title: string;
  /** Optional pre-resolved caption (scale, e.g. "1:20"). */
  readonly caption?: string;
  /** Drawable contents, in sheet-mm (empty in the Slice 0 shell). */
  readonly primitives: readonly DetailPrimitive[];
}

/** The complete backend-agnostic detail-sheet drawing model. */
export interface DetailSheetModel {
  readonly paper: PaperSpec;
  /** Full sheet width in mm (paper, orientation-resolved). */
  readonly sheetWidthMm: number;
  /** Full sheet height in mm (paper, orientation-resolved). */
  readonly sheetHeightMm: number;
  /** The five regions in render order. */
  readonly regions: readonly SheetRegion[];
}

/** Pre-resolved reinforcement-schedule table labels (N.11-safe, host-injected). */
export interface DetailScheduleLabels {
  readonly mark: string;        // «Στοιχείο» / item column
  readonly diameter: string;    // «Ø»
  readonly count: string;       // «Πλήθος» / quantity
  readonly length: string;      // «Μήκος (m)»
  readonly weight: string;      // «Βάρος (kg)»
  readonly longitudinal: string;// «Διαμήκεις» row
  readonly stirrups: string;    // «Συνδετήρες» row
  readonly spiral: string;      // «Σπείρα» row (spiral type)
  readonly total: string;       // «Σύνολο» row
  readonly ratio: string;       // «ρ» longitudinal ratio
  readonly confinement: string; // «α» confinement factor
}

/** Pre-resolved title-block (drawing data) field labels (N.11-safe, host-injected). */
export interface DetailTitleBlockLabels {
  readonly section: string;     // «Διατομή»
  readonly height: string;      // «Ύψος»
  readonly concrete: string;    // «Σκυρόδεμα»
  readonly steel: string;       // «Χάλυβας»
  readonly cover: string;       // «Επικάλυψη»
  readonly longitudinal: string;// «Διαμήκης οπλισμός»
  readonly stirrups: string;    // «Συνδετήρες»
}

/** Pre-resolved region headings injected by the UI host (N.11-safe). */
export interface DetailSheetLabels {
  readonly plan: string;
  readonly elevation: string;
  readonly perspective: string;
  readonly schedule: string;
  readonly titleBlock: string;
  /** Reinforcement-schedule table column/row labels. */
  readonly scheduleTable: DetailScheduleLabels;
  /** Title-block (drawing data) field labels. */
  readonly titleFields: DetailTitleBlockLabels;
}

// ─── ADR-463 — Footing detail labels (kind-neutral rows: pad/strip/tie-beam) ──

/** Pre-resolved footing reinforcement-schedule table labels (N.11-safe). */
export interface FootingScheduleLabels {
  readonly item: string;        // «Στοιχείο» / item column
  readonly description: string; // «Οπλισμός» (Ø/βήμα ή nØd)
  readonly length: string;      // «Μήκος (m)»
  readonly weight: string;      // «Βάρος (kg)»
  readonly main: string;        // «Κύριος» row (κάτω σχάρα / εγκάρσιες / κάτω ράβδοι)
  readonly secondary: string;   // «Δευτερεύων» row (άνω σχάρα / διαμήκεις / άνω ράβδοι)
  readonly stirrups: string;    // «Συνδετήρες» row (strip / tie-beam)
  readonly total: string;       // «Σύνολο» row
  readonly ratio: string;       // «ρ» κύριος (καμπτικός) λόγος οπλισμού
}

/** Pre-resolved footing title-block (drawing data) field labels (N.11-safe). */
export interface FootingTitleBlockLabels {
  readonly kind: string;        // «Τύπος» (πέδιλο/πεδιλοδοκός/συνδετήρια)
  readonly section: string;     // «Διατομή» (W×L ή W×H band)
  readonly thickness: string;   // «Πάχος/Ύψος»
  readonly concrete: string;    // «Σκυρόδεμα»
  readonly steel: string;       // «Χάλυβας»
  readonly cover: string;       // «Επικάλυψη»
  readonly main: string;        // «Κύριος οπλισμός»
  readonly secondary: string;   // «Δευτερεύων οπλισμός»
}

/** ADR-464 Slice 5 — pre-resolved design-checks summary labels (N.11-safe). */
export interface FootingDesignSummaryLabels {
  readonly check: string;        // «Έλεγχος» (header)
  readonly demand: string;       // «Απαίτηση»
  readonly capacity: string;     // «Αντοχή»
  readonly utilization: string;  // «Αξιοπ.»
  readonly bearing: string;      // «Έδραση (kPa)»
  readonly punching: string;     // «Διάτρηση (MPa)»
  readonly oneWayShear: string;  // «Τέμνουσα (MPa)»
  readonly topMeshNote: string;  // «Απαιτείται άνω σχάρα (κάμψη)»
  readonly ok: string;           // «OK»
  readonly fail: string;         // «!»
}

/** Pre-resolved footing detail-sheet region headings + table/field labels. */
export interface FootingDetailSheetLabels {
  readonly plan: string;
  readonly elevation: string;
  readonly perspective: string;
  readonly schedule: string;
  readonly titleBlock: string;
  readonly scheduleTable: FootingScheduleLabels;
  readonly titleFields: FootingTitleBlockLabels;
  /** Pre-resolved kind values («Πέδιλο» / «Πεδιλοδοκός» / «Συνδετήρια δοκός»). */
  readonly kindValues: Readonly<Record<'pad' | 'strip' | 'tie-beam', string>>;
  /** ADR-464 Slice 5 — design-checks summary labels (optional· absent → χωρίς πίνακα). */
  readonly designSummary?: FootingDesignSummaryLabels;
  /**
   * ADR-477 Slice 2b — beam-style region headings για τη **συνδετήρια δοκό** (η οποία
   * ΕΙΝΑΙ δοκός): slot 'elevation' → longitudinal «ΟΨΗ», slot 'plan' → εγκάρσια «ΔΙΑΤΟΜΗ».
   * Absent → fallback στις footing όψεις/labels (back-compat· π.χ. tests χωρίς αυτά).
   */
  readonly tieBeamRegions?: { readonly elevation: string; readonly section: string };
}

// ─── ADR-471 — Beam detail labels (κάτω/άνω διαμήκεις + συνδετήρες) ────────────

/** Pre-resolved beam reinforcement-schedule table labels (N.11-safe). */
export interface BeamScheduleLabels {
  readonly item: string;             // «Στοιχείο» / item column
  readonly description: string;      // «Οπλισμός» (nØd ή Ø/βήμα)
  readonly length: string;           // «Μήκος (m)»
  readonly weight: string;           // «Βάρος (kg)»
  readonly bottomLongitudinal: string;// «Κάτω διαμήκεις» row
  readonly topLongitudinal: string;  // «Άνω διαμήκεις» row
  readonly stirrups: string;         // «Συνδετήρες» row
  readonly total: string;            // «Σύνολο» row
  readonly ratio: string;            // «ρ» εφελκυόμενου (κάτω) λόγου οπλισμού
}

/** Pre-resolved beam title-block (drawing data) field labels (N.11-safe). */
export interface BeamTitleBlockLabels {
  readonly section: string;      // «Διατομή» (b×h)
  readonly effectiveFlangeWidth: string; // ADR-534 Φ3b — «b_eff» ενεργό πλάτος πέλματος (T-beam)
  readonly span: string;         // «Άνοιγμα»
  readonly concrete: string;     // «Σκυρόδεμα»
  readonly steel: string;        // «Χάλυβας»
  readonly cover: string;        // «Επικάλυψη»
  readonly longitudinal: string; // «Διαμήκης οπλισμός»
  readonly stirrups: string;     // «Συνδετήρες»
}

/** Pre-resolved beam detail-sheet region headings + table/field labels. */
export interface BeamDetailSheetLabels {
  readonly plan: string;        // slot 'plan' → «ΔΙΑΤΟΜΗ»
  readonly elevation: string;   // slot 'elevation' → «ΟΨΗ»
  readonly perspective: string;
  readonly schedule: string;
  readonly titleBlock: string;
  readonly scheduleTable: BeamScheduleLabels;
  readonly titleFields: BeamTitleBlockLabels;
}

// ─── ADR-476 — Slab detail labels (mesh-model: κάτω/άνω σχάρα, χωρίς συνδετήρες) ──

/** Pre-resolved slab reinforcement-schedule table labels (N.11-safe). */
export interface SlabScheduleLabels {
  readonly item: string;        // «Στοιχείο» / item column
  readonly description: string; // «Οπλισμός» (Ø/βήμα σχάρας)
  readonly length: string;      // «Μήκος (m)»
  readonly weight: string;      // «Βάρος (kg)»
  readonly bottomMesh: string;  // «Κάτω σχάρα» row (κύρια καμπτική / ανοίγματος)
  readonly topMesh: string;     // «Άνω σχάρα» row (στηρίξεων / hogging)
  readonly total: string;       // «Σύνολο» row
  readonly ratio: string;       // «ρ» κύριος (κάτω) λόγος οπλισμού
}

/** Pre-resolved slab title-block (drawing data) field labels (N.11-safe). */
export interface SlabTitleBlockLabels {
  readonly kind: string;        // «Τύπος» (δάπεδο/οροφή/στέγη/εδαφόπλακα)
  readonly section: string;     // «Διάσταση κάτοψης» (W×L bbox)
  readonly thickness: string;   // «Πάχος»
  readonly concrete: string;    // «Σκυρόδεμα»
  readonly steel: string;       // «Χάλυβας»
  readonly cover: string;       // «Επικάλυψη»
  readonly bottomMesh: string;  // «Κάτω σχάρα»
  readonly topMesh: string;     // «Άνω σχάρα»
  readonly span: string;        // «Άνοιγμα L» (μόνο αναρτημένη — suspended)
  readonly designLoad: string;  // «Φορτίο q_Ed» (μόνο αναρτημένη — suspended)
}

/** Pre-resolved slab detail-sheet region headings + table/field labels. */
export interface SlabDetailSheetLabels {
  readonly plan: string;        // slot 'plan' → «ΚΑΤΟΨΗ»
  readonly section: string;     // slot 'elevation' → «ΤΟΜΗ»
  readonly perspective: string;
  readonly schedule: string;
  readonly titleBlock: string;
  readonly scheduleTable: SlabScheduleLabels;
  readonly titleFields: SlabTitleBlockLabels;
  /** Pre-resolved kind values («Δάπεδο» / «Οροφή» / «Στέγη» / «Εδαφόπλακα» …). */
  readonly kindValues: Readonly<Record<SlabKindForDetail, string>>;
}

/** The 5 slab kinds (mirror `SlabKind`) — kept local to avoid a runtime import. */
export type SlabKindForDetail = 'floor' | 'ceiling' | 'roof' | 'ground' | 'foundation';
