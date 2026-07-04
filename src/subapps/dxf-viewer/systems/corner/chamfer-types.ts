/**
 * CHAMFER TYPES — ADR-510 Φ4f
 *
 * Shared types for the AutoCAD-style CHAMFER modify tool. Mirrors fillet-types; the
 * connector is a straight bevel (LINE) instead of a tangent arc. Two input modes
 * (Giorgio 2026-07-04): Distance–Distance (d1,d2, default EQUAL) and Distance–Angle
 * (d1 + angle from line 1, d2 derived by the law of sines).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-510-line-creation-system.md §Φ4f
 */

import type { Point2D } from '../../rendering/types/Types';
import type { LineEntity, LWPolylineEntity, PolylineEntity } from '../../types/entities';

/**
 * A CHAMFER-able "first pick": a line (line–line) or a polyline (same-polyline two-segment chamfer,
 * Φ4f.2 — the second pick selects the shared corner). Arcs/circles are NOT chamfer-able (AutoCAD).
 */
export type ChamferFirstEntity = LineEntity | PolylineEntity | LWPolylineEntity;

/** AutoCAD CHAMFERA/CHAMFERB default (equal distances → symmetric 45° bevel). */
export const CHAMFER_DEFAULT_DISTANCE = 10;
/** Default chamfer angle (degrees, from line 1) for Angle mode. */
export const CHAMFER_DEFAULT_ANGLE = 45;

export type ChamferMode = 'distance' | 'angle';

/** Which value the numeric keyboard buffer currently edits. */
export type ChamferTypedTarget = 'distance' | 'angle';

export type ChamferPhase = 'picking-first' | 'picking-second';

/** Non-React tool state held in the ChamferToolStore (mirror of FilletToolStore). */
export interface ChamferToolState {
  readonly phase: ChamferPhase;
  /** First picked entity (line, or polyline for the same-polyline chamfer); null while picking-first. */
  readonly first: ChamferFirstEntity | null;
  /** The pick point on the first line (selects which side is kept). */
  readonly firstPick: Point2D | null;
  /** Distance cut on line 1 (world units). */
  readonly d1: number;
  /** Distance cut on line 2 (world units). */
  readonly d2: number;
  /** Chamfer angle from line 1 (degrees) — Angle mode only. */
  readonly angle: number;
  /** Input mode: two distances, or a distance + an angle. */
  readonly mode: ChamferMode;
  /** AutoCAD CHAMFER «Trim» — trim the two lines back to the bevel endpoints. */
  readonly trim: boolean;
  /** «Polyline» mode — one pick bevels EVERY fitting corner of a polyline. */
  readonly polylineMode: boolean;
  /** In-progress digit buffer for numeric entry. */
  readonly typedBuffer: string;
  /** Which value the keyboard edits (`distance` sets d1=d2 equally; `angle` sets angle). */
  readonly typedTarget: ChamferTypedTarget;
  /** Last committed distances, remembered as defaults for the next chamfer. */
  readonly lastD1: number;
  readonly lastD2: number;
}
