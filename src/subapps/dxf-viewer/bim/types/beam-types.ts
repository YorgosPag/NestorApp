/**
 * BIM Beam — Type Schema (ADR-363 §5.7, Phase 5).
 *
 * Concrete `BeamParams` + `BeamGeometry` + `BeamEntity` αντικαθιστούν τα Phase 0
 * stubs (`BimParamsStub`/`BimGeometryStub`) στο `types/entities.ts` για beams.
 *
 * 3 kinds (straight / curved / cantilever). Straight + cantilever: 2-click
 * placement (start → end). Curved: 3-click (start → end → curve control point).
 * Cross-section width × depth + elevation (top-of-beam από project origin).
 *
 * SSoT:
 *   - `BeamParams.startPoint` + `endPoint` (+ optional `curveControl`) ορίζουν
 *     τον άξονα. `width` / `depth` ορίζουν τη διατομή.
 *   - `BeamGeometry` cache από `computeBeamGeometry()` — re-derivable από
 *     params σε corruption (mirrors wall/slab/column pattern).
 *
 * Plan-view rendering: dashed line (industry convention για beam hidden above
 * floor in plan view) με translucent fill στο width × length footprint.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.7
 */

import type {
  BimEntity,
  BoundingBox3D,
  Point3D,
  Polygon3D,
  Polyline3D,
} from './bim-base';

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

// ─── Parameters (user-editable, SSoT for geometry derivation) ────────────────

/**
 * Beam parameters. All linear measurements σε mm (Nestor convention).
 *
 *   - `startPoint` / `endPoint` — άξονας σε world coords (mm).
 *   - `curveControl` — quadratic Bezier control point (μόνο αν `kind === 'curved'`).
 *   - `width` — mm. Cross-section X (πλάτος διατομής).
 *   - `depth` — mm. Cross-section Y (structural depth — δομικό βάθος).
 *   - `elevation` — mm. Top-of-beam από project origin (typical 3000mm για
 *     top-of-slab-storey level).
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
  /** mm. Top-of-beam από project origin (typically storey height). */
  readonly elevation: number;
  readonly material?: string;
  readonly supportType?: BeamSupportType;
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
 *   - `bbox` — folds outline + axis vertices, z extends σε elevation.
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
}

// ─── Entity (BIM generic instantiation) ─────────────────────────────────────

/**
 * Beam BIM entity. Extends `BimEntity` με `kind: BeamKind` discriminator.
 */
export interface BeamEntity
  extends BimEntity<BeamKind, BeamParams, BeamGeometry> {
  readonly type: 'beam';
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

/** Default elevation (mm) — top-of-slab για typical Greek residential storey. */
export const DEFAULT_BEAM_ELEVATION_MM = 3000;

/**
 * Quadratic Bezier subdivision count για `curved` kind. 16 segments mirror
 * the wall-geometry pattern (smooth curve + accurate offset normals).
 */
export const CURVED_BEAM_SUBDIVISIONS = 16;
