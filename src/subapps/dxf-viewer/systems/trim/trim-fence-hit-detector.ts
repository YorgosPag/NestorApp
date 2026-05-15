/**
 * TRIM FENCE HIT DETECTOR — ADR-350 Phase 4 + 5
 *
 * Pure functions:
 *   - {@link detectFenceHits}: fence segment → FenceHit[] (Phase 4)
 *   - {@link buildEntityPreviewPath}: entity → Point2D[] for overlay rendering (Phase 5)
 *
 * Design:
 *   - Reuses {@link computeIntersectionPoints} from the intersection mapper SSoT.
 *   - The fence is modelled as a synthetic LINE entity (id '__fence__') so it
 *     fits naturally into the CuttingEdge protocol without code duplication.
 *   - Quick mode: all visible/unlocked trimmable entities are candidates.
 *   - Standard mode: only entities whose id is in `cuttingEdgeIds`.
 *
 * No React, no state, no side effects.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-350-trim-command.md §Phase 4 §Phase 5
 */

import type {
  ArcEntity,
  CircleEntity,
  Entity,
  LineEntity,
  RayEntity,
  XLineEntity,
} from '../../types/entities';
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
} from '../../types/entities';
import type { SceneLayer, SceneModel } from '../../types/scene';
import { isValidCuttingCandidate, isTrimmable } from './trim-boundary-resolver';
import { computeIntersectionPoints, tessellateEllipse, tessellateSpline } from './trim-intersection-mapper';
import type { CuttingEdge, TrimMode } from './trim-types';
import type { Point2D } from '../../rendering/types/Types';

// Synthetic ID — never matches a real entity ID (enterprise IDs use prefix_uuid pattern).
const FENCE_ENTITY_ID = '__fence__';

export interface FenceHit {
  /** ID of the entity that the fence segment crosses. */
  readonly entityId: string;
  /** Intersection point of the entity with the fence segment (used as pick point). */
  readonly pickPoint: Point2D;
}

export interface DetectFenceHitsArgs {
  readonly fenceStart: Point2D;
  readonly fenceEnd: Point2D;
  readonly scene: SceneModel;
  readonly mode: TrimMode;
  /** Empty array = Quick mode (all visible entities). Populated in Standard mode. */
  readonly cuttingEdgeIds: ReadonlyArray<string>;
}

/**
 * Return every trimmable entity in the scene that the fence segment crosses.
 * Preserves scene order for deterministic results.
 */
export function detectFenceHits(args: DetectFenceHitsArgs): FenceHit[] {
  const { fenceStart, fenceEnd, scene, mode, cuttingEdgeIds } = args;

  const fenceEdge = buildFenceEdge(fenceStart, fenceEnd);
  const layers: Record<string, SceneLayer> = scene.layers ?? {};
  const allow = mode === 'standard' ? new Set(cuttingEdgeIds) : null;
  const hits: FenceHit[] = [];

  for (const rawEntity of scene.entities) {
    if (!isTrimmable(rawEntity)) continue;
    if (!isValidCuttingCandidate(rawEntity, layers)) continue;
    if (allow && !allow.has(rawEntity.id)) continue;

    const entity = rawEntity as Entity;
    const pts = computeIntersectionPoints(entity, [fenceEdge]);
    if (pts.length === 0) continue;

    hits.push({ entityId: entity.id, pickPoint: closestToOrigin(pts, fenceStart) });
  }

  return hits;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildFenceEdge(start: Point2D, end: Point2D): CuttingEdge {
  const entity: LineEntity = {
    id: FENCE_ENTITY_ID,
    type: 'line',
    start,
    end,
    layer: '',
  };
  return { sourceEntityId: FENCE_ENTITY_ID, entity, extended: false };
}

/** Returns the point from `pts` closest to `origin` (shortest squared distance). */
function closestToOrigin(pts: ReadonlyArray<Point2D>, origin: Point2D): Point2D {
  let best = pts[0];
  let bestD2 = distSq(pts[0], origin);
  for (let i = 1; i < pts.length; i++) {
    const d2 = distSq(pts[i], origin);
    if (d2 < bestD2) {
      bestD2 = d2;
      best = pts[i];
    }
  }
  return best;
}

function distSq(a: Point2D, b: Point2D): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

// ── Preview path builder (Phase 5 — G5 live fence preview) ───────────────────

const PREVIEW_ARC_SEGMENTS = 32;
const PREVIEW_CIRCLE_SEGMENTS = 64;
const RAY_RENDER_LENGTH = 1e4;

/**
 * Convert any trimmable entity to a polyline path for the red overlay preview.
 * Used by the fence drag preview to highlight which entities would be trimmed.
 * Returns an empty array for unknown or zero-geometry entities.
 */
export function buildEntityPreviewPath(entity: Entity): ReadonlyArray<Point2D> {
  if (isLineEntity(entity)) return [entity.start, entity.end];
  if (isArcEntity(entity)) return tessellateArc(entity, PREVIEW_ARC_SEGMENTS);
  if (isCircleEntity(entity)) return tessellateCircle(entity, PREVIEW_CIRCLE_SEGMENTS);
  if (isLWPolylineEntity(entity) || isPolylineEntity(entity)) {
    return entity.vertices.map((v) => ({ x: v.x, y: v.y }));
  }
  if (isEllipseEntity(entity)) return tessellateEllipse(entity, PREVIEW_ARC_SEGMENTS);
  if (isSplineEntity(entity)) return tessellateSpline(entity, PREVIEW_ARC_SEGMENTS);
  if (isRayEntity(entity)) return rayToSegment(entity);
  if (isXLineEntity(entity)) return xlineToSegment(entity);
  return [];
}

function tessellateArc(arc: ArcEntity, n: number): Point2D[] {
  const two = Math.PI * 2;
  const ccw = arc.counterclockwise !== false;
  let sweep: number;
  if (ccw) {
    sweep = arc.endAngle >= arc.startAngle ? arc.endAngle - arc.startAngle : two - (arc.startAngle - arc.endAngle);
  } else {
    sweep = arc.startAngle >= arc.endAngle ? arc.startAngle - arc.endAngle : two - (arc.endAngle - arc.startAngle);
  }
  const pts: Point2D[] = [];
  for (let i = 0; i <= n; i++) {
    const t = ccw ? arc.startAngle + (sweep * i) / n : arc.startAngle - (sweep * i) / n;
    pts.push({ x: arc.center.x + arc.radius * Math.cos(t), y: arc.center.y + arc.radius * Math.sin(t) });
  }
  return pts;
}

function tessellateCircle(circle: CircleEntity, n: number): Point2D[] {
  const pts: Point2D[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2;
    pts.push({ x: circle.center.x + circle.radius * Math.cos(t), y: circle.center.y + circle.radius * Math.sin(t) });
  }
  return pts;
}

function rayToSegment(ray: RayEntity): [Point2D, Point2D] {
  const dlen = Math.hypot(ray.direction.x, ray.direction.y) || 1;
  return [
    ray.basePoint,
    { x: ray.basePoint.x + (ray.direction.x / dlen) * RAY_RENDER_LENGTH, y: ray.basePoint.y + (ray.direction.y / dlen) * RAY_RENDER_LENGTH },
  ];
}

function xlineToSegment(xl: XLineEntity): [Point2D, Point2D] {
  const dlen = Math.hypot(xl.direction.x, xl.direction.y) || 1;
  const ux = xl.direction.x / dlen;
  const uy = xl.direction.y / dlen;
  return [
    { x: xl.basePoint.x - ux * RAY_RENDER_LENGTH, y: xl.basePoint.y - uy * RAY_RENDER_LENGTH },
    { x: xl.basePoint.x + ux * RAY_RENDER_LENGTH, y: xl.basePoint.y + uy * RAY_RENDER_LENGTH },
  ];
}
