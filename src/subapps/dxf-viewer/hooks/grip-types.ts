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
 * L/U/gamma variants only. See `systems/stairs/stair-grips.ts`.
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
