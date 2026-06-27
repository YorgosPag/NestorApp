/**
 * AMBIENT TRACKING COMPOSE — ADR-357 / ADR-543 (2D↔3D shared tracking SSoT)
 *
 * Pure composition of the Object-Snap-Tracking resolve pass that BOTH canvases run:
 *
 *   merge(acquired AutoCAD points + ambient Revit anchors)
 *     → `resolveTrackingSnap` (alignment-path intersection / projection)
 *     → adaptive-distance quantize (only the projection slide).
 *
 * Extracted from the 2D `drawing-hover-handler` so the 3D wall placement hook
 * (`use-bim3d-wall-placement`, ADR-543) reuses the EXACT same math — one tracking
 * brain, two canvases, zero duplication. The 2D handler keeps owning the *acquisition*
 * (hover-1s timer + `getImmediateSnap`) and the *ambient collection*; this helper is
 * the deterministic resolve+quantize the two callers share.
 *
 * Pure — zero React/DOM/store. All points are in the caller's working space (DXF
 * world for 2D, scene units for 3D); the caller derives `worldTolerance` /
 * `worldPerPixel` from its own projection so the screen feel stays constant.
 *
 * @see ./tracking-resolver.ts — resolveTrackingSnap (the path math)
 * @see ./adaptive-distance-snap.ts — adaptiveDistanceStep / quantizeAlongPath
 * @see ../../hooks/drawing/drawing-hover-handler.ts — the 2D caller (acquisition + ambient)
 */

import type { Point2D } from '../../rendering/types/Types';
import type { AcquiredTrackingPoint } from './TrackingPointStore';
import {
  resolveTrackingSnap,
  type TrackingPolarConfig,
  type TrackingSnapResult,
} from './tracking-resolver';
import { adaptiveDistanceStep, quantizeAlongPath } from './adaptive-distance-snap';

export interface ComposeTrackingOptions {
  /** Polar tracking configuration (H/V always; polar increments when enabled). */
  readonly polar: TrackingPolarConfig;
  /** Match tolerance in working-space units (caller derives from 3px / scale). */
  readonly worldTolerance: number;
  /** Working-space units per screen pixel — drives the adaptive quantize step. */
  readonly worldPerPixel: number;
}

export interface ComposedTracking {
  /** The raw resolver result — active paths / intersections / anchor for rendering. */
  readonly result: TrackingSnapResult;
  /** The (adaptive-quantized) snapped cursor point the caller should adopt. */
  readonly point: Point2D;
}

/**
 * Merge the two anchor sources, resolve the best alignment-path snap, and quantize
 * the projection slide to a nice round distance. Returns `null` when there are no
 * anchors or no path is within tolerance (caller keeps the raw cursor).
 */
export function composeTrackingSnap(
  cursor: Point2D,
  acquired: readonly AcquiredTrackingPoint[],
  ambient: readonly AcquiredTrackingPoint[],
  opts: ComposeTrackingOptions,
): ComposedTracking | null {
  // One engine, two sources (ADR-357 ambient extension): the AutoCAD hover-acquired
  // points + the Revit auto-emitted ambient anchors feed the SAME resolver.
  const merged = ambient.length > 0 ? [...acquired, ...ambient] : acquired;
  if (merged.length === 0) return null;

  const result = resolveTrackingSnap(cursor, merged, opts.polar, opts.worldTolerance);
  if (!result) return null;

  // "Magic" adaptive distance snap (AutoCAD PolarSnap / Revit temp-dim): round the
  // slide distance along a projection track to a nice value whose on-screen spacing
  // stays ~constant. Only projection slides — intersections are already fixed.
  let point = result.point;
  if (result.kind === 'projection' && result.activePaths.length > 0) {
    const path = result.activePaths[0];
    const step = adaptiveDistanceStep(opts.worldPerPixel);
    point = quantizeAlongPath(result.point, result.anchorPoint, path.dx, path.dy, step);
  }
  return { result, point };
}
