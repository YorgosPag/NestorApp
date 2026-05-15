/**
 * TRIM ENTITY CUTTER — ADR-350 (Dispatcher)
 *
 * SSoT entry point for the per-entity-type "cut at intersection" operation.
 * Pure dispatcher — delegates to family-specific cutters:
 *   - LINE / ARC / CIRCLE / ELLIPSE → {@link trim-line-arc-cutter}
 *   - POLYLINE / LWPOLYLINE / SPLINE → {@link trim-polyline-cutter}
 *   - RAY / XLINE → {@link trim-ray-xline-cutter}
 *
 * Caller (useTrimTool) is responsible for:
 *   - Computing intersections via {@link trim-intersection-mapper}
 *   - Filtering locked / hidden entities via {@link trim-boundary-resolver}
 *   - Generating new IDs via `enterprise-id.service` (N.6)
 *
 * Split per N.7.1 (≤500 lines / file).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-350-trim-command.md §Per-entity Trim Cutter
 */

import type { Point2D } from '../../rendering/types/Types';
import {
  isArcEntity,
  isCircleEntity,
  isEllipseEntity,
  isLineEntity,
  isLWPolylineEntity,
  isPolylineEntity,
  isRayEntity,
  isSplineEntity,
  isXLineEntity,
  type Entity,
} from '../../types/entities';
import type { TrimResult } from './trim-types';
import { EMPTY_RESULT } from './trim-cut-shared';
import {
  cutArc,
  cutCircle,
  cutEllipse,
  cutLine,
  type CutContext,
} from './trim-line-arc-cutter';
import { cutPolyline, cutSpline } from './trim-polyline-cutter';
import { cutRay, cutXLine } from './trim-ray-xline-cutter';

export interface TrimCutArgs {
  readonly entity: Entity;
  readonly intersections: ReadonlyArray<Point2D>;
  readonly pickPoint: Point2D;
  /** Quick mode deletes the entity if no intersection. Standard reports a no-op. */
  readonly mode: 'quick' | 'standard';
  /** id factory for new entities created via split / promotion (N.6). */
  readonly newId: () => string;
}

export function trimEntity(args: TrimCutArgs): TrimResult {
  const ctx: CutContext = {
    intersections: args.intersections,
    pickPoint: args.pickPoint,
    mode: args.mode,
    newId: args.newId,
  };
  const { entity } = args;
  if (isLineEntity(entity)) return cutLine(entity, ctx);
  if (isArcEntity(entity)) return cutArc(entity, ctx);
  if (isCircleEntity(entity)) return cutCircle(entity, ctx);
  if (isEllipseEntity(entity)) return cutEllipse(entity, ctx);
  if (isPolylineEntity(entity) || isLWPolylineEntity(entity)) return cutPolyline(entity, ctx);
  if (isSplineEntity(entity)) return cutSpline(entity, ctx);
  if (isRayEntity(entity)) return cutRay(entity, ctx);
  if (isXLineEntity(entity)) return cutXLine(entity, ctx);
  return EMPTY_RESULT;
}

export type { CutContext };
