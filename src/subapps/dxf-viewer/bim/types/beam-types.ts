/**
 * BIM Beam — Type Schema (ADR-363 §5.7 + ADR-369 §2.2 + §9 Q5 + Q8, Phase A4).
 *
 * Concrete `BeamParams` + `BeamGeometry` + `BeamEntity`. 3 kinds (straight /
 * curved / cantilever). Straight + cantilever: 2-click. Curved: 3-click με
 * quadratic Bezier control. Cross-section width × depth.
 *
 * ADR-369 §2.2 canonical convention (Post-ADR-369):
 *   - `topElevation` = **top face** (top-of-beam) σε mm από project origin.
 *     Default = `floor.elevation` (Hybrid A FFL). Beam hangs DOWN by `depth`.
 *   - `zOffset?` = mm (default 0) — drop-from-ceiling για ψευδοροφές, exposed
 *     beams κάτω από slab, κλπ.
 *   - Geometry: top = topElevation + zOffset
 *              bottom = top - depth
 *
 * ADR-369 §9 Q5 §854: Beams `topElevation` = floor.elevation by default.
 * `zOffset` (mm) για drop-from-ceiling cases. Δεν χρειάζονται baseBinding/
 * topBinding enums όπως walls/columns (beam έχει ενιαία top reference).
 *
 * ADR-369 §9 Q8 IFC4 readiness:
 *   - BeamEntity extends IfcEntityMixin. ifcType='IfcBeam' πάντα.
 *
 * SSoT:
 *   - `BeamParams.startPoint` + `endPoint` (+ optional `curveControl`) ορίζουν
 *     τον άξονα. `width` / `depth` ορίζουν τη διατομή.
 *   - `BeamGeometry` cache από `computeBeamGeometry()` — re-derivable από params.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.7
 * @see docs/centralized-systems/reference/adrs/ADR-369-bim-elevation-convention-revit-alignment.md §2.2, §9 Q5, §9 Q8
 */

import type {
  BimEntity,
  BoundingBox3D,
  Point3D,
  Polygon3D,
  Polyline3D,
} from './bim-base';
import type { SceneUnits } from '../../utils/scene-units';
import type { IfcEntityMixin } from './ifc-entity-mixin';
import type { EnvelopeFunction, EnvelopeLayer } from './thermal-envelope-types';

// ─── Sub-type discriminators (ADR-363 §5.7) ─────────────────────────────────

/**
 * Beam kind discriminator. 3 industry-standard τύποι δοκαριού:
 *   - `straight`     → ευθύγραμμη δοκός (2-click)
 *   - `curved`       → καμπυλωτή δοκός με quadratic Bezier control (3-click)
 *   - `cantilever`   → πρόβολος (2-click, χωρίς υποστήριξη στο 2ο άκρο)
 */
export type BeamKind = 'straight' | 'curved' | 'cantilever';

/**
 * Structural support type. Cantilever beams MUST have `supportType: 'cantilever'`
 * (validator-enforced σε αυτή τη φάση). Straight / curved beams default σε
 * `'simple'` (simply supported — pin/roller). `'fixed'` = αμφίπακτη.
 */
export type BeamSupportType = 'simple' | 'fixed' | 'cantilever';

/**
 * Steel section profile type.
 *   - `'I'` → standard I-beam (IPE series, flangeT/h ≈ 0.15)
 *   - `'H'` → broad-flange H-beam (HEA/HEB series, flangeT/h ≈ 0.33)
 * Only relevant when `material === 'steel'`. Ignored for rc/glulam.
 */
export type BeamSectionType = 'I' | 'H';

// ─── Parameters (user-editable, SSoT for geometry derivation) ────────────────

/**
 * Beam parameters. All linear measurements σε mm (Nestor convention).
 *
 *   - `startPoint` / `endPoint` — άξονας σε world coords (mm).
 *   - `curveControl` — quadratic Bezier control point (μόνο αν `kind === 'curved'`).
 *   - `width` — mm. Cross-section X (πλάτος διατομής).
 *   - `depth` — mm. Cross-section Y (structural depth — δομικό βάθος).
 *   - `topElevation` — mm. **Top face** (top-of-beam) από project origin.
 *     ADR-369 §2.2 canonical (renamed από legacy `elevation`).
 *   - `zOffset?` — mm (default 0). Drop-from-ceiling offset. ADR-369 §854.
 *   - `material` — material library ID (Phase 6+).
 *   - `supportType` — pin/roller / fixed / cantilever (default per kind).
 */
export interface BeamParams {
  readonly kind: BeamKind;
  readonly startPoint: Point3D;
  readonly endPoint: Point3D;
  /** Defined when `kind === 'curved'`. mm. Quadratic Bezier control point. */
  readonly curveControl?: Point3D;
  /** mm. Cross-section X (Eurocode min 150mm — code violation αν μικρότερο). */
  readonly width: number;
  /** mm. Cross-section Y / structural depth. */
  readonly depth: number;
  /** mm. Top face (top-of-beam) από project origin. ADR-369 §2.2. */
  readonly topElevation: number;
  /** mm. Drop-from-ceiling offset (default 0). ADR-369 §854. */
  readonly zOffset?: number;
  readonly material?: string;
  readonly supportType?: BeamSupportType;
  /** Steel section profile type ('I' or 'H'). Ignored for rc/glulam. Default: 'I'. */
  readonly sectionType?: BeamSectionType;
  /** Free-text profile designation shown on canvas (e.g. "IPE 300", "HEA 200"). */
  readonly profileDesignation?: string;
  /**
   * DXF canvas coordinate unit. Always stored so `computeBeamGeometry` can
   * convert mm scalars (width/depth) → canvas units for 2D outline offset.
   * Defaults to 'mm' when absent (legacy Firestore docs).
   */
  readonly sceneUnits?: SceneUnits;
  // ─── ADR-369 Phase 0.4 + A.1 — Storey linkage ────────────────────────────
  /** FK → Floor.id (storey reference). Semantic alias for entity-level floorId. */
  readonly storeyId?: string;
  /** mm. Top face offset από storey reference elevation. Default 0 = top-of-beam at FFL. */
  readonly offsetFromStorey?: number;
  /**
   * ADR-396 Phase P2 — External thermal envelope (ETICS) exterior layer.
   * Zone Z1 (κατακόρυφη όψη). Optional/non-breaking. Set by the P6
   * auto-apply command. `thickness_m` σε ΜΕΤΡΑ (SSoT unit), όχι mm.
   */
  readonly envelopeLayer?: EnvelopeLayer;
  /**
   * ADR-396 v2 Φάση 4 — Χειροκίνητη παράκαμψη (Revit-style) της αυτόματης ETICS
   * ταξινόμησης (Στρ.3). `undefined` = auto· 'exterior'/'interior' = override.
   * Set χειροκίνητα (UI Φάση 6).
   */
  readonly envelopeFunction?: EnvelopeFunction;
}

// ─── Geometry cache (derivable from params; SSoT = params) ──────────────────

/**
 * Computed beam geometry. Returned by `computeBeamGeometry(params)` —
 * ΠΟΤΕ mutated by consumers.
 *
 *   - `axisPolyline` — centerline (start → end για straight/cantilever,
 *     CURVED_BEAM_SUBDIVISIONS-subdivided Bezier για curved).
 *   - `outline` — plan-view rectangle (width × length) — closed CCW polygon.
 *   - `length` — m. Σύνολο μήκους κατά μήκος του άξονα.
 *   - `area` — m². Top surface (length × width / 1e6) — feeds BOQ formwork.
 *   - `volume` — m³. length × width × depth / 1e9.
 *   - `bbox` — folds outline + axis vertices, z extends σε topElevation.
 */
export interface BeamGeometry {
  readonly axisPolyline: Polyline3D;
  readonly outline: Polygon3D;
  readonly bbox: BoundingBox3D;
  /** m — geometric axis length (sum-of-edges). */
  readonly length: number;
  /** m² — top surface (length × width). */
  readonly area: number;
  /** m³ — length × width × depth / 1e9. */
  readonly volume: number;
  /**
   * m. Free span = geometric axis length (polyline chord start→end). For
   * straight/cantilever beams this equals `length`. Phase 3.8.
   */
  readonly maxFreeSpanM: number;
}

// ─── Entity (BIM generic instantiation) ─────────────────────────────────────

/**
 * Beam BIM entity. Extends `BimEntity` με `kind: BeamKind` discriminator + IFC mixin.
 */
export interface BeamEntity
  extends BimEntity<BeamKind, BeamParams, BeamGeometry>,
    IfcEntityMixin {
  readonly type: 'beam';
  /** ADR-369 §9 Q8 — IFC4 class. Always 'IfcBeam'. */
  readonly ifcType: 'IfcBeam';
}

// ─── Defaults & constants ────────────────────────────────────────────────────

/** Ελάχιστο πλάτος διατομής (mm) — Eurocode minimum για RC beam. */
export const MIN_BEAM_WIDTH_MM = 150;

/** Default πλάτος δοκαριού (mm). 25cm RC typical. */
export const DEFAULT_BEAM_WIDTH_MM = 250;

/** Default structural depth (mm). 50cm RC beam typical (Greek residential). */
export const DEFAULT_BEAM_DEPTH_MM = 500;

/**
 * Ελάχιστο structural depth (mm) — Eurocode floor για RC beam. Out-of-plane
 * dimension (gravity axis): δεν φαίνεται σε plan view, αλλά clampάρει το
 * `beam-depth` grip drag (ADR-363 Phase 5.5c).
 */
export const MIN_BEAM_DEPTH_MM = 200;

/** Ελάχιστο μήκος δοκαριού (mm) — degenerate guard. */
export const MIN_BEAM_LENGTH_MM = 200;

/**
 * Maximum span/depth ratio. Πάνω από 20 → code violation (slender beam
 * warning). Cantilever-specific threshold halved (10) στον validator.
 */
export const MAX_SPAN_DEPTH_RATIO = 20;

/**
 * Cantilever-specific max span/depth ratio. Cantilevers (πρόβολοι) έχουν
 * μικρότερο stiffness contribution → πιο αυστηρό όριο.
 */
export const MAX_CANTILEVER_SPAN_DEPTH_RATIO = 10;

/**
 * Default top elevation (mm) — top-of-slab για typical Greek residential
 * storey (3m). ADR-369 §2.2 renamed από `DEFAULT_BEAM_ELEVATION_MM`.
 */
export const DEFAULT_BEAM_TOP_ELEVATION_MM = 3000;

/** ADR-369 §854 — default drop-from-ceiling zOffset (mm). */
export const DEFAULT_BEAM_Z_OFFSET_MM = 0;

/**
 * Quadratic Bezier subdivision count για `curved` kind. 16 segments mirror
 * the wall-geometry pattern (smooth curve + accurate offset normals).
 */
export const CURVED_BEAM_SUBDIVISIONS = 16;
