/**
 * ADR-362 Phase A1 — Center Marks & Centerlines (D13, standalone variant).
 *
 * Two independent entity types complementary to `DimensionEntity`:
 *   - `CenterMarkEntity`  — cross at the center of a circle/arc.
 *   - `CenterLineEntity`  — line through 2 points or through a circle center.
 *
 * Both are fully associative (D11): if `geometryId` is set, the mark follows
 * the host geometry when it moves. Independent grip editing and deletion
 * (a Radial/Diameter dim's bundled DIMCEN center mark is NOT one of these
 * entities — bundled mode renders inside `DimensionRenderer` directly).
 *
 * DXF interop: emitted as native `0 CENTERMARK` (AutoCAD 2017+) or
 * decomposed to LINE+POINT block for older targets.
 */

import type { Point2D } from '../rendering/types/Types';
import type { BaseEntity } from './entities';

// ──────────────────────────────────────────────────────────────────────────────
// CenterMarkEntity — cross at a center
// ──────────────────────────────────────────────────────────────────────────────

/** How the center mark is drawn (mirrors DIMCEN sign convention). */
export type CenterMarkStyle =
  | 'markOnly'         // DIMCEN > 0 — short cross at center only
  | 'markWithLines'    // DIMCEN < 0 — cross + extension lines crossing the geometry
  | 'none';            // DIMCEN = 0 — for completeness; should not be persisted

export interface CenterMarkEntity extends BaseEntity {
  type: 'center-mark';

  /** Geometric center of the mark (world coordinates). */
  center: Point2D;
  /** Size of the mark arms (mm paper, scaled by current annotation scale). */
  size: number;
  /** Drawing style (mirrors DIMCEN sign). */
  style: CenterMarkStyle;
  /** Rotation of the cross arms in degrees (0 = axis-aligned). */
  rotation?: number;

  /** D11 — associated host geometry (circle/arc). Mark follows host transforms. */
  geometryId?: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// CenterLineEntity — line through 2 points or through a circle center
// ──────────────────────────────────────────────────────────────────────────────

/** Whether the centerline is defined by 2 free points or anchored to a host geometry. */
export type CenterLineKind =
  | 'twoPoint'       // start + end given directly
  | 'throughCenter'; // line through a circle/arc center along a direction

export interface CenterLineEntity extends BaseEntity {
  type: 'centerline';

  kind: CenterLineKind;
  /** Start point (twoPoint) or first sample on the line (throughCenter). */
  start: Point2D;
  /** End point (twoPoint) or second sample on the line (throughCenter). */
  end: Point2D;
  /** Extension beyond start/end (mm paper). */
  extension?: number;
  /** Dash scale factor for the centerline pattern (defaults to DIMSTYLE/linetype). */
  dashScale?: number;

  /** D11 — associated host geometry (when `kind === 'throughCenter'`). */
  geometryId?: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Type guards
// ──────────────────────────────────────────────────────────────────────────────

export const isCenterMarkEntity = (e: { type: string }): e is CenterMarkEntity =>
  e.type === 'center-mark';

export const isCenterLineEntity = (e: { type: string }): e is CenterLineEntity =>
  e.type === 'centerline';
