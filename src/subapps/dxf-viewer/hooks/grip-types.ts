/**
 * Grip type definitions — extracted from useGripMovement.ts (SRP, ADR-358 Phase 5b).
 * Consumed by useGripMovement, grip-registry, unified-grip-types, stair-grips, dimension-grips.
 */

import type { Point2D } from '../rendering/types/Types';

/** Grip type enumeration */
export type GripType = 'vertex' | 'center' | 'edge' | 'corner' | 'midpoint';

/**
 * ADR-358 Phase 5b — Stair grip kind (parametric grip type).
 * One of 5 grips exposed by `StairEntity`: base point translate, direction
 * rotate, width resize, length (stepCount) resize, split (flightSplit) for
 * L/U/gamma variants only. See `bim/stairs/stair-grips.ts`.
 */
export type StairGripKind =
  | 'stair-base'
  | 'stair-direction'
  | 'stair-width'
  | 'stair-length'
  | 'stair-split';

/**
 * ADR-362 Phase I2 — Dimension grip kind.
 * Routes grip commit through `applyDimensionGripDrag` + direct scene patch
 * instead of the standard `StretchEntityCommand` vertex path.
 * See `hooks/dimensions/useDimensionGrips.ts`.
 */
export type DimensionGripKind =
  | 'dim-defpoint-0'  // ext line origin 1 → defPoints[0]
  | 'dim-defpoint-1'  // ext line origin 2 → defPoints[1]
  | 'dim-line-ref'    // dim line reference → defPoints[2]
  | 'dim-text'        // text label → textMidpoint
  | 'dim-extra';      // type-specific 5th grip (rotation handle / arcPoint / datum / etc.)

/**
 * ADR-363 Phase 1C — Wall grip kind (parametric grip type).
 * Routes commit through `applyWallGripDrag()` + `UpdateWallParamsCommand`
 * instead of the standard `StretchEntityCommand` vertex path.
 *
 * Wall grips exposed by `WallEntity` (`bim/walls/wall-grips.ts`):
 *   - `wall-start`     → translate axis start endpoint
 *   - `wall-end`       → translate axis end endpoint
 *   - `wall-midpoint`  → translate whole wall (axis midpoint anchor)
 *   - `wall-thickness` → resize thickness perpendicular to axis
 *   - `wall-curve`     → move quadratic Bezier control point (curved kind only)
 *   - `wall-vertex-N`  → translate polyline interior vertex N (polyline kind only)
 */
export type WallGripKind =
  | 'wall-start'
  | 'wall-end'
  | 'wall-midpoint'
  | 'wall-thickness'
  | 'wall-curve'
  | `wall-vertex-${number}`;

/**
 * ADR-363 Phase 2.5 — Opening grip kind (parametric grip type).
 * Routes commit through `applyOpeningGripDrag()` + `UpdateOpeningParamsCommand`
 * instead of the standard `StretchEntityCommand` vertex path.
 *
 * Single grip exposed by `OpeningEntity` (`bim/walls/opening-grips.ts`):
 *   - `opening-offset` → drag along host wall axis, clamped to host length
 *     minus frame width on both sides.
 */
export type OpeningGripKind = 'opening-offset';

/**
 * ADR-363 Phase 3.5 + 3.6 — Slab grip kind (parametric grip type).
 * Routes commit through `applySlabGripDrag()` + `UpdateSlabParamsCommand`
 * instead of the standard `StretchEntityCommand` vertex path.
 *
 * Two grip families exposed by `SlabEntity` (`bim/slabs/slab-grips.ts`):
 *   - `slab-vertex-N`        → translate polygon outline vertex N (XY only, z preserved).
 *   - `slab-edge-midpoint-N` → insert new vertex at edge N midpoint + delta
 *                              (Phase 3.6 — splits edge `[N, N+1]`).
 */
export type SlabGripKind =
  | `slab-vertex-${number}`
  | `slab-edge-midpoint-${number}`;

/**
 * ADR-363 Phase 3.7a — Slab-opening grip kind (parametric grip type).
 * Routes commit through `applySlabOpeningGripDrag()` +
 * `UpdateSlabOpeningParamsCommand` instead of the standard `StretchEntityCommand`
 * vertex path.
 *
 * Two grip families exposed by `SlabOpeningEntity`
 * (`bim/slab-openings/slab-opening-grips.ts`):
 *   - `slab-opening-vertex-N`        → translate cutout outline vertex N
 *                                      (XY only, z preserved).
 *   - `slab-opening-edge-midpoint-N` → insert new vertex at edge N midpoint +
 *                                      delta (splits edge `[N, N+1]`).
 */
export type SlabOpeningGripKind =
  | `slab-opening-vertex-${number}`
  | `slab-opening-edge-midpoint-${number}`;

/**
 * ADR-363 Phase 5.5a + 5.5b + 5.5c — Beam grip kind (parametric grip type).
 * Routes commit through `applyBeamGripDrag()` + `UpdateBeamParamsCommand`
 * instead of the standard `StretchEntityCommand` vertex path.
 *
 * Grips exposed by `BeamEntity` (`bim/beams/beam-grips.ts`):
 *   - `beam-start`    → translate axis start endpoint
 *   - `beam-end`      → translate axis end endpoint
 *   - `beam-midpoint` → translate whole beam (axis midpoint anchor, moves
 *                       startPoint + endPoint + curveControl όπου υπάρχει)
 *   - `beam-curve`    → move quadratic Bezier control point (curved kind only;
 *                       seeded από axis midpoint όταν undefined)
 *   - `beam-width`    → resize width perpendicular to axis (symmetric γύρω από
 *                       axis midpoint). Clamps στο `MIN_BEAM_WIDTH_MM`. Mirror
 *                       του `wall-thickness` pattern (Phase 1C).
 *   - `beam-depth`    → Phase 5.5c — out-of-plane (gravity axis) dimension
 *                       indicator. Handle stands στο axis midpoint κατά το
 *                       NEGATIVE perpendicular (αντίθετη πλευρά από το
 *                       width handle), με offset `width/2 + DEPTH_GRIP_OFFSET_MM`
 *                       ώστε να είναι ξεκάθαρα έξω από το footprint.
 *                       Dashed visual indicator + label "d=Xmm" στον renderer.
 *                       Symmetric drag projection × 2 → new depth, clamps
 *                       στο `MIN_BEAM_DEPTH_MM`. Δεν αλλάζει το footprint
 *                       (depth ζει στον z-axis), μόνο το `params.depth`.
 */
export type BeamGripKind =
  | 'beam-start'
  | 'beam-end'
  | 'beam-midpoint'
  | 'beam-curve'
  | 'beam-width'
  | 'beam-depth';

/**
 * ADR-363 Phase 4.5 + 4.5b + Phase 8C — Column grip kind (parametric grip type).
 * Routes commit through `applyColumnGripDrag()` + `UpdateColumnParamsCommand`
 * instead of the standard `StretchEntityCommand` vertex path.
 *
 * Base grips exposed by `ColumnEntity` (`bim/columns/column-grips.ts`):
 *   - `column-center`   → translate `position` (anchor stays)
 *   - `column-rotation` → rotate γύρω από `position` (non-circular only)
 *   - `column-width`    → resize width on the far edge from anchor (= diameter
 *                          για `circular` + `polygon` kinds)
 *   - `column-depth`    → resize depth on the far edge from anchor (skipped
 *                          για `circular` + `polygon` kinds — depth meaningless)
 *
 * Variant-specific grips (Phase 4.5b — L-shape / T-shape):
 *   - `column-arm-length`    → L-shape only (`params.lshape.armLength`,
 *                               Y-axis δευτερεύοντος βραχίονα). Asymmetric
 *                               edge handle στο inner-corner edge κατά τοπικό
 *                               +Y. Drag projection × 1.
 *   - `column-arm-width`     → L-shape only (`params.lshape.armWidth`,
 *                               πάχος δευτερεύοντος βραχίονα). Asymmetric
 *                               edge handle στο inner-corner edge κατά τοπικό
 *                               +X. Drag projection × 1.
 *   - `column-flange-length` → T-shape only (`params.tshape.flangeLength`,
 *                               X-axis πέλματος). Symmetric — handle στη
 *                               δεξιά πλευρά πέλματος. Drag projection × 2
 *                               (mirror του column-width symmetric pattern).
 *   - `column-web-thickness` → T-shape only (`params.tshape.webThickness`,
 *                               πάχος κορμού κατά X). Symmetric — handle
 *                               στη δεξιά πλευρά κορμού. Drag projection × 2.
 *
 * Variant-specific grips (Phase 8C — I-shape):
 *   - `column-i-flange-thickness` → I-shape only (`params.ishape.flangeThickness`,
 *                                    πάχος πέλματος tf). Asymmetric edge handle
 *                                    στο top-flange bottom-edge midpoint κατά
 *                                    τοπικό +Y. Drag projection × 1 (bottom
 *                                    flange mirrors automatically μέσω geometry).
 *   - `column-i-web-thickness`    → I-shape only (`params.ishape.webThickness`,
 *                                    πάχος κορμού tw). Symmetric — handle στη
 *                                    αριστερή πλευρά κορμού. Drag projection
 *                                    × 2 (web centered around vertical axis).
 *
 * Όλες οι νέες διαστάσεις clamp στο `MIN_COLUMN_DIMENSION_MM` (250 mm) — εκτός
 * των I-shape plate thicknesses που clamp στο `MIN_I_PLATE_THICKNESS_MM` (5 mm).
 * Όταν `params.lshape` / `params.tshape` / `params.ishape` undefined, ο handler
 * materializes defaults από `width/3 + depth/3` (L) ή `width + depth/3` (T) ή
 * `DEFAULT_I_FLANGE_THICKNESS_MM` / `DEFAULT_I_WEB_THICKNESS_MM` (I) — mirror
 * των `computeColumnGeometry` defaults — ώστε το επόμενο drag να ξεκινά από τα
 * ήδη υπολογισμένα values. Circular + shear-wall kinds δεν εκπέμπουν
 * variant-specific grips (shear-wall = rect parity).
 */
export type ColumnGripKind =
  | 'column-center'
  | 'column-rotation'
  | 'column-width'
  | 'column-depth'
  | 'column-arm-length'
  | 'column-arm-width'
  | 'column-flange-length'
  | 'column-web-thickness'
  | 'column-i-flange-thickness'
  | 'column-i-web-thickness';

/**
 * ADR-359 Phase 11 — XLine grip kind.
 * Routes commit through `applyXLineGripDrag()` + direct scene patch instead of
 * the standard `StretchEntityCommand` vertex path.
 *   - `xline-base` → translate basePoint (direction invariant).
 *   - `xline-dir`  → rotate: recompute direction = normalize(cursor − basePoint).
 */
export type XLineGripKind = 'xline-base' | 'xline-dir';

/**
 * ADR-359 Phase 11 — Ray grip kind.
 * Routes commit through `applyRayGripDrag()` + direct scene patch.
 *   - `ray-base` → translate basePoint (direction invariant).
 *   - `ray-dir`  → rotate: recompute direction = normalize(cursor − basePoint).
 */
export type RayGripKind = 'ray-base' | 'ray-dir';

/** Grip information */
export interface GripInfo {
  entityId: string;
  gripIndex: number;
  type: GripType;
  position: Point2D;
  movesEntity: boolean;
  edgeVertexIndices?: [number, number];
  /**
   * ADR-358 Phase 5b — parametric stair grip discriminator. Present only when
   * the grip belongs to a `StairEntity`; routes the commit through
   * `applyStairGripDrag()` + `UpdateStairParamsCommand` instead of the
   * standard `StretchEntityCommand` vertex path.
   */
  stairGripKind?: StairGripKind;
  /**
   * ADR-362 Phase I2 — dimension grip discriminator. Present only when
   * the grip belongs to a `DxfDimension`; routes commit through
   * `applyDimensionGripDrag()` + direct scene patch.
   */
  dimGripKind?: DimensionGripKind;
  /**
   * ADR-363 Phase 1C — parametric wall grip discriminator. Present only when
   * the grip belongs to a `WallEntity`; routes the commit through
   * `applyWallGripDrag()` + `UpdateWallParamsCommand` instead of the standard
   * `StretchEntityCommand` vertex path.
   */
  wallGripKind?: WallGripKind;
  /**
   * ADR-363 Phase 2.5 — parametric opening grip discriminator. Present only
   * when the grip belongs to an `OpeningEntity`; routes the commit through
   * `applyOpeningGripDrag()` + `UpdateOpeningParamsCommand` (drag-along-wall).
   */
  openingGripKind?: OpeningGripKind;
  /**
   * ADR-363 Phase 3.5 — parametric slab grip discriminator. Present only when
   * the grip belongs to a `SlabEntity`; routes the commit through
   * `applySlabGripDrag()` + `UpdateSlabParamsCommand` (per-vertex translate).
   */
  slabGripKind?: SlabGripKind;
  /**
   * ADR-363 Phase 3.7a — parametric slab-opening grip discriminator. Present
   * only when the grip belongs to a `SlabOpeningEntity`; routes the commit
   * through `applySlabOpeningGripDrag()` + `UpdateSlabOpeningParamsCommand`
   * (per-vertex translate + edge-midpoint insertion).
   */
  slabOpeningGripKind?: SlabOpeningGripKind;
  /**
   * ADR-363 Phase 5.5a — parametric beam grip discriminator. Present only when
   * the grip belongs to a `BeamEntity`; routes the commit through
   * `applyBeamGripDrag()` + `UpdateBeamParamsCommand` (start/end/midpoint
   * translate + curve control move).
   */
  beamGripKind?: BeamGripKind;
  /**
   * ADR-363 Phase 4.5 — parametric column grip discriminator. Present only when
   * the grip belongs to a `ColumnEntity`; routes the commit through
   * `applyColumnGripDrag()` + `UpdateColumnParamsCommand` (center translate +
   * rotation + width/depth resize).
   */
  columnGripKind?: ColumnGripKind;
  /**
   * ADR-359 Phase 11 — XLine grip discriminator. Present only when the grip
   * belongs to an `XLineEntity`; routes commit through `applyXLineGripDrag()` +
   * direct scene patch (translate basePoint or rotate direction).
   */
  xlineGripKind?: XLineGripKind;
  /**
   * ADR-359 Phase 11 — Ray grip discriminator. Present only when the grip
   * belongs to a `RayEntity`; routes commit through `applyRayGripDrag()` +
   * direct scene patch (translate basePoint or rotate direction).
   */
  rayGripKind?: RayGripKind;
}

/** Grip drag state */
export interface GripDragState {
  isDragging: boolean;
  activeGrip: GripInfo | null;
  startPosition: Point2D | null;
  currentPosition: Point2D | null;
  totalDelta: Point2D;
  hasMoved: boolean;
}
