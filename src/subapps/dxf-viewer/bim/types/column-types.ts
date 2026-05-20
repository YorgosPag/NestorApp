/**
 * BIM Column — Type Schema (ADR-363 §5.6, Phase 4).
 *
 * Concrete `ColumnParams` + `ColumnGeometry` + `ColumnEntity` αντικαθιστούν το
 * Phase 0 stub στο `types/entities.ts`.
 *
 * 4 kinds (rectangular / circular / L-shape / T-shape), single-click placement
 * με 9-position anchor + free rotation. Footprint cached στο `geometry` (SSoT
 * = params), area σε m², volume σε m³.
 *
 * SSoT:
 *   - `ColumnParams.position` + `anchor` (+ rotation/kind/width/depth) ορίζουν
 *     το footprint του πολυγώνου.
 *   - `ColumnGeometry` cache από `computeColumnGeometry()` — re-derivable από
 *     params.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.6
 */

import type {
  BimEntity,
  BoundingBox3D,
  Point3D,
  Polygon3D,
} from './bim-base';
import type { SceneUnits } from '../../utils/scene-units';

// ─── Sub-type discriminator (ADR-363 §5.6) ───────────────────────────────────

/** Column kind discriminator. 4 industry-standard τύποι κολώνας. */
export type ColumnKind =
  | 'rectangular'
  | 'circular'
  | 'L-shape'
  | 'T-shape';

/**
 * 9-position anchor — ποιο σημείο της διατομής εδράζεται στο `position`.
 *   center | n | s | e | w | nw | ne | sw | se
 */
export type ColumnAnchor =
  | 'center'
  | 'n' | 's' | 'e' | 'w'
  | 'nw' | 'ne' | 'sw' | 'se';

// ─── Variant-specific param blocks ───────────────────────────────────────────

/**
 * L-shape geometry override. Optional — defaults derived ως `width/3` /
 * `depth/3` αν λείπουν (computeColumnGeometry).
 */
export interface ColumnLshapeParams {
  /** mm. Μήκος δευτερεύοντος βραχίονα (Y-axis). */
  readonly armLength?: number;
  /** mm. Πάχος δευτερεύοντος βραχίονα. */
  readonly armWidth?: number;
  /**
   * Arm at top instead of bottom. Set by mirror operations (ADR-363 Phase 7.2).
   * Proof: local mirror transform T[1][1] = -1 for all axisAngle+rotation.
   */
  readonly flipY?: boolean;
}

/**
 * T-shape geometry override. Optional — defaults derived ως `depth/3` αν
 * λείπουν.
 */
export interface ColumnTshapeParams {
  /** mm. Μήκος πέλματος (X-axis flange). */
  readonly flangeLength?: number;
  /** mm. Πάχος κορμού (Y-axis web). */
  readonly webThickness?: number;
  /**
   * Flange at bottom instead of top. Set by mirror operations (ADR-363 Phase 7.2).
   * Proof: local mirror transform T[1][1] = -1 for all axisAngle+rotation.
   */
  readonly flipY?: boolean;
}

// ─── Parameters (user-editable, SSoT for geometry derivation) ────────────────

/**
 * Column parameters. All linear measurements σε mm (Nestor convention).
 *
 *   - `position` — clicked point σε world coords (mm). Anchor offset
 *     εφαρμόζεται στο geometry pipeline.
 *   - `anchor` — 9-position selector (default 'center').
 *   - `width` — mm. Διάμετρος αν `kind === 'circular'`. Αλλιώς πλάτος X-axis.
 *   - `depth` — mm. Αγνοείται αν `kind === 'circular'`. Αλλιώς ύψος Y-axis.
 *   - `height` — mm. Storey height (default 3000).
 *   - `rotation` — μοίρες CCW γύρω από το anchor. Αγνοείται αν circular.
 *   - `material` — material library ID (Phase 6+).
 *   - `lshape` / `tshape` — variant-specific dimensions.
 */
export interface ColumnParams {
  readonly kind: ColumnKind;
  readonly position: Point3D;
  readonly anchor: ColumnAnchor;
  readonly width: number;
  readonly depth: number;
  readonly height: number;
  readonly rotation: number;
  readonly material?: string;
  readonly lshape?: ColumnLshapeParams;
  readonly tshape?: ColumnTshapeParams;
  /**
   * DXF canvas coordinate unit. Always stored so `computeColumnGeometry` can
   * convert mm scalars (width/depth) → canvas units for 2D footprint offsets.
   * Defaults to 'mm' when absent (legacy Firestore docs).
   */
  readonly sceneUnits?: SceneUnits;
}

// ─── Geometry cache (derivable from params; SSoT = params) ──────────────────

/**
 * Computed column geometry. Returned by `computeColumnGeometry(params)` —
 * ΠΟΤΕ mutated by consumers. `area` σε m², `volume` σε m³, `height` σε mm
 * (BOQ-ready για volume calc).
 */
export interface ColumnGeometry {
  /** Polygon3D — οριζόντια τομή σε z = elevation (currently 0). Closed CCW. */
  readonly footprint: Polygon3D;
  readonly bbox: BoundingBox3D;
  /** m². Εμβαδό τομής. */
  readonly area: number;
  /** m³. area × height / 1000. */
  readonly volume: number;
  /** mm. Mirror of `params.height` για ευκολία downstream. */
  readonly height: number;
}

// ─── Entity (BIM generic instantiation) ─────────────────────────────────────

/**
 * Column BIM entity. Extends `BimEntity` με `kind: ColumnKind` discriminator.
 */
export interface ColumnEntity
  extends BimEntity<ColumnKind, ColumnParams, ColumnGeometry> {
  readonly type: 'column';
}

// ─── Defaults & constants ────────────────────────────────────────────────────

/** Ελάχιστη διατομή (mm) — Eurocode 25×25cm. Phase 4 code violation threshold. */
export const MIN_COLUMN_DIMENSION_MM = 250;

/** Default πλάτος κολώνας (mm). 40×40cm RC typical. */
export const DEFAULT_COLUMN_WIDTH_MM = 400;

/** Default βάθος κολώνας (mm). */
export const DEFAULT_COLUMN_DEPTH_MM = 400;

/** Default ύψος ορόφου (mm). */
export const DEFAULT_COLUMN_HEIGHT_MM = 3000;

/**
 * Max slenderness ratio (height / min(width, depth)). Πάνω από 30 → code
 * violation (Eurocode-aligned crude check, Phase 4 sufficient).
 */
export const MAX_SLENDERNESS_RATIO = 30;

/** Default rotation (μοίρες). */
export const DEFAULT_COLUMN_ROTATION_DEG = 0;

/** Number of segments για circular footprint approximation. */
export const CIRCULAR_COLUMN_SEGMENTS = 32;

/**
 * Anchor → unit-fraction offset within the (width × depth) bounding box,
 * BEFORE rotation. `dx`/`dy` ∈ {-0.5, 0, +0.5}. Geometry pipeline εφαρμόζει
 * `position - (dx × width, dy × depth)` ώστε το anchor σημείο να συμπίπτει
 * με το clicked `position`.
 *
 *   nw  n  ne
 *   w   c  e
 *   sw  s  se
 */
export const ANCHOR_OFFSETS: Readonly<Record<ColumnAnchor, { dx: number; dy: number }>> = {
  'center': { dx:  0,    dy:  0    },
  'n':      { dx:  0,    dy:  0.5  },
  's':      { dx:  0,    dy: -0.5  },
  'e':      { dx:  0.5,  dy:  0    },
  'w':      { dx: -0.5,  dy:  0    },
  'nw':     { dx: -0.5,  dy:  0.5  },
  'ne':     { dx:  0.5,  dy:  0.5  },
  'sw':     { dx: -0.5,  dy: -0.5  },
  'se':     { dx:  0.5,  dy: -0.5  },
};

/** Ring order για Tab cycling στο column-tool (9-state). */
export const ANCHOR_CYCLE_ORDER: readonly ColumnAnchor[] = [
  'center', 'n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw',
];
