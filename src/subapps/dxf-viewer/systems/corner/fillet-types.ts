/**
 * FILLET TYPES — ADR-510 Φ4e
 *
 * Shared types for the AutoCAD-style FILLET modify tool. Mirrors the offset-types
 * pattern (zero-React store state). Two commit shapes:
 *   • two-lines  → trim ≤2 lines + add 1 tangent arc
 *   • polyline   → replace one polyline with a rounded-corner version (one command)
 *
 * @see docs/centralized-systems/reference/adrs/ADR-510-line-creation-system.md §Φ4e
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ArcEntity, CircleEntity, LineEntity, LWPolylineEntity, PolylineEntity } from '../../types/entities';

/**
 * A FILLET-able "first pick": a line (line–line), an arc/circle (curve fillet, Φ4e.2), or a
 * polyline (same-polyline two-segment fillet, Φ4e.2 — the second pick selects the shared corner).
 */
export type FilletFirstEntity = LineEntity | ArcEntity | CircleEntity | PolylineEntity | LWPolylineEntity;

/** AutoCAD FILLETRAD default (0 → the first pick simply extends the corner). */
export const FILLET_DEFAULT_RADIUS = 0;

/**
 * Tool phases:
 *   picking-first  → pick line 1 (or, in polyline mode, pick the whole polyline)
 *   picking-second → pick line 2; a live ghost of the arc + trims follows the hover
 */
export type FilletPhase = 'picking-first' | 'picking-second';

/** Non-React tool state held in the FilletToolStore (mirror of OffsetToolStore). */
export interface FilletToolState {
  readonly phase: FilletPhase;
  /** First picked entity (line, or arc/circle for curve fillets); null while picking-first. */
  readonly first: FilletFirstEntity | null;
  /** The pick point on the first line (selects which side is kept). */
  readonly firstPick: Point2D | null;
  /** Current fillet radius (world units). 0 ⇒ extend-to-corner. */
  readonly radius: number;
  /** AutoCAD FILLET «Trim» option — trim the two lines back to the tangent points. */
  readonly trim: boolean;
  /** «Polyline» mode — one pick fillets EVERY fitting corner of a polyline. */
  readonly polylineMode: boolean;
  /** In-progress digit buffer for numeric radius entry (e.g. "20", "20.5"). */
  readonly typedBuffer: string;
  /** Last committed radius, remembered as the default for the next fillet. */
  readonly lastRadius: number;
}
