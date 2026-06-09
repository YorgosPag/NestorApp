/**
 * ADR-429 — MEP Routing Brain: wall → obstacle extraction (pure, SSoT).
 *
 * Turns the storey's entities into the axis-aligned `Rect2D` obstacles the A* router must
 * route AROUND. Walls are the only obstacle class in v1 (Slice 3). Source of truth is the
 * `entities` array every orchestrator already receives — NOT `RecognitionModel`, where
 * `'structural-wall'` is reserved-but-unpopulated (ADR-424).
 *
 * Each wall contributes its cached `geometry.bbox` (already thickness-aware, in scene units),
 * inflated on every side by a clearance so the pipe centreline keeps a stand-off from the
 * face. Pure + deterministic (stable ordering, no Date/random).
 *
 * @see ./route-wall-aware.ts (consumer) · ../../../types/entities.ts (isWallEntity)
 */

import type { Entity } from '../../../types/entities';
import type { Point2D } from '../../../rendering/types/Types';
import { isWallEntity } from '../../../types/entities';
import { WALL_CLEARANCE_SCENE, type Rect2D } from './routing-constants';

/** Smallest physically meaningful wall footprint (scene units) — skip degenerate bboxes. */
const MIN_FOOTPRINT = 1e-3;

/**
 * Extract inflated wall obstacles from a storey's entities. Order follows the input entity
 * order (deterministic). Walls with a degenerate/empty bbox are skipped (an obstacle of zero
 * area helps no one and would falsely block its own centre cell).
 *
 * @param entities  The orchestrator's entity array (the same one fed to Stage 0).
 * @param clearance Per-side stand-off added to each bbox (scene units). Default = SSoT const.
 */
export function wallObstacles(
  entities: readonly Entity[],
  clearance: number = WALL_CLEARANCE_SCENE,
): readonly Rect2D[] {
  const out: Rect2D[] = [];
  for (const entity of entities) {
    if (!isWallEntity(entity)) continue;
    const bbox = entity.geometry.bbox;
    const width = bbox.max.x - bbox.min.x;
    const height = bbox.max.y - bbox.min.y;
    if (width < MIN_FOOTPRINT && height < MIN_FOOTPRINT) continue;
    out.push({
      minX: bbox.min.x - clearance,
      minY: bbox.min.y - clearance,
      maxX: bbox.max.x + clearance,
      maxY: bbox.max.y + clearance,
    });
  }
  return out;
}

/** True if point (x,y) lies inside the rectangle (inclusive). Shared with the A* grid. */
export function pointInRect(x: number, y: number, rect: Rect2D): boolean {
  return x >= rect.minX && x <= rect.maxX && y >= rect.minY && y <= rect.maxY;
}

/** True if point (x,y) lies inside ANY obstacle. */
export function pointInAnyObstacle(
  x: number,
  y: number,
  obstacles: readonly Rect2D[],
): boolean {
  for (const rect of obstacles) {
    if (pointInRect(x, y, rect)) return true;
  }
  return false;
}

const COORD_EPS = 1e-6;

/** True if closed interval [lo,hi] overlaps the OPEN interval (a,b) — boundary touch = false. */
function intervalsOverlapInterior(lo: number, hi: number, a: number, b: number): boolean {
  return Math.max(lo, a) < Math.min(hi, b) - COORD_EPS;
}

/**
 * True if the axis-aligned segment p→q passes through the INTERIOR of `rect`. Boundary-only
 * contact (a run hugging a wall face / clearance edge) counts as free — the desired Revit-grade
 * behaviour. Non-axis-aligned segments fall back to interior sampling (the routing grid only
 * emits axis-aligned edges, so that branch is a safety net, not the norm).
 */
export function segmentHitsRect(p: Point2D, q: Point2D, rect: Rect2D): boolean {
  const horizontal = Math.abs(p.y - q.y) < COORD_EPS;
  const vertical = Math.abs(p.x - q.x) < COORD_EPS;
  if (horizontal && p.y > rect.minY + COORD_EPS && p.y < rect.maxY - COORD_EPS) {
    return intervalsOverlapInterior(Math.min(p.x, q.x), Math.max(p.x, q.x), rect.minX, rect.maxX);
  }
  if (vertical && p.x > rect.minX + COORD_EPS && p.x < rect.maxX - COORD_EPS) {
    return intervalsOverlapInterior(Math.min(p.y, q.y), Math.max(p.y, q.y), rect.minY, rect.maxY);
  }
  if (horizontal || vertical) return false;
  for (let s = 1; s < 8; s++) {
    const t = s / 8;
    if (pointInRect(p.x + (q.x - p.x) * t, p.y + (q.y - p.y) * t, rect)) return true;
  }
  return false;
}

/** True if the axis-aligned segment p→q passes through the interior of ANY obstacle. */
export function segmentHitsObstacles(
  p: Point2D,
  q: Point2D,
  obstacles: readonly Rect2D[],
): boolean {
  for (const rect of obstacles) {
    if (segmentHitsRect(p, q, rect)) return true;
  }
  return false;
}
