/**
 * ADR-363 Phase 1D-B — Perpendicular auto-trim for wall↔wall intersections.
 *
 * Pure module: given the full set of WallEntity objects in a scene, computes
 * `startBevel` / `endBevel` patches (mm) so that axis endpoints are shortened
 * to eliminate the rectangular overlap that appears at wall junctions.
 *
 * Algorithm (per pair):
 *   1. axis-axis infinite-line intersection (parametric t, u).
 *   2. Classify: corner (both endpoints near) | T-junction (one mid) | skip.
 *   3. bevel = halfThicknessOther / sin(angle_between_axes), clamped.
 *   4. Accumulate max bevel per endpoint (multiple junctions → worst case wins).
 *
 * Cross-junctions (both axes interior) are skipped in Phase 1D-B.
 * Only `kind === 'straight'` walls are processed; curved/polyline land later.
 *
 * Industry parallel: AutoCAD Architecture "WallCleanup", Revit auto-join.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6 Phase 1D-B
 */

import type { WallEntity, WallParams } from '../types/wall-types';
import type { AnySceneEntity } from '../../types/entities';
import { computeWallGeometry } from '../geometry/wall-geometry';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Physical distance (mm) within which an axis endpoint is considered "touching" the intersection. */
const JOIN_THRESHOLD_MM = 200;

/** Angle below which axes are treated as parallel → no trim. */
const MIN_ANGLE_RAD = Math.PI / 12; // 15°

/** Maximum bevel as fraction of axis length; prevents axis inversion. */
const MAX_BEVEL_FRACTION = 0.40;

// ─── Types ────────────────────────────────────────────────────────────────────

/** Per-wall trim patch returned by `computeWallTrims`. undefined = no change. */
export interface WallTrimPatch {
  readonly startBevel?: number; // mm
  readonly endBevel?: number;   // mm
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Compute perpendicular auto-trim patches for all wall pairs in `walls`.
 *
 * Idempotent: calling with the same input always returns the same patches.
 * Returns a Map keyed by wallId; walls with no trim are NOT included.
 */
export function computeWallTrims(walls: readonly WallEntity[]): Map<string, WallTrimPatch> {
  const startBevels = new Map<string, number>();
  const endBevels = new Map<string, number>();

  for (let i = 0; i < walls.length; i++) {
    for (let j = i + 1; j < walls.length; j++) {
      processPair(walls[i], walls[j], startBevels, endBevels);
    }
  }

  const result = new Map<string, WallTrimPatch>();
  for (const wall of walls) {
    const sb = startBevels.get(wall.id);
    const eb = endBevels.get(wall.id);
    if (sb !== undefined || eb !== undefined) {
      result.set(wall.id, {
        ...(sb !== undefined ? { startBevel: sb } : {}),
        ...(eb !== undefined ? { endBevel: eb } : {}),
      });
    }
  }
  return result;
}

/**
 * Apply trim patches to an entity array: returns a new array with patched wall
 * `params` and recomputed `geometry`. Non-wall entities pass through unchanged.
 * Idempotent — applying twice yields the same result (patches are absolute mm).
 */
export function applyTrimPatches(
  entities: readonly AnySceneEntity[],
  trims: Map<string, WallTrimPatch>,
): AnySceneEntity[] {
  if (trims.size === 0) return [...entities];

  return entities.map((entity): AnySceneEntity => {
    if (entity.type !== 'wall') return entity;
    const patch = trims.get(entity.id);
    if (!patch) return entity;

    const wall = entity as WallEntity;
    const newParams: WallParams = {
      ...wall.params,
      ...(patch.startBevel !== undefined ? { startBevel: patch.startBevel } : {}),
      ...(patch.endBevel !== undefined ? { endBevel: patch.endBevel } : {}),
    };

    return {
      ...wall,
      params: newParams,
      geometry: computeWallGeometry(newParams, wall.kind),
    } as WallEntity;
  });
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Parametric intersection of two infinite 2D lines.
 * Returns { t, u } such that:
 *   A(t) = a1 + t*(a2-a1) = B(u) = b1 + u*(b2-b1)
 * Returns null when lines are parallel (cross product ≈ 0).
 */
function lineLineIntersect(
  a1x: number, a1y: number,
  a2x: number, a2y: number,
  b1x: number, b1y: number,
  b2x: number, b2y: number,
): { t: number; u: number } | null {
  const dax = a2x - a1x;
  const day = a2y - a1y;
  const dbx = b2x - b1x;
  const dby = b2y - b1y;

  const cross = dax * dby - day * dbx;
  if (Math.abs(cross) < 1e-9) return null;

  const wx = b1x - a1x;
  const wy = b1y - a1y;

  return {
    t: (wx * dby - wy * dbx) / cross,
    u: (wx * day - wy * dax) / cross,
  };
}

/** |sin| of angle between two direction vectors (always in [0, 1]). */
function sinAngleBetween(dax: number, day: number, dbx: number, dby: number): number {
  const lenA = Math.hypot(dax, day);
  const lenB = Math.hypot(dbx, dby);
  if (lenA < 1e-9 || lenB < 1e-9) return 0;
  return Math.abs(dax * dby - day * dbx) / (lenA * lenB);
}

function accumMax(map: Map<string, number>, id: string, value: number): void {
  const prev = map.get(id);
  if (prev === undefined || value > prev) map.set(id, value);
}

/**
 * Classify and accumulate trim bevels for one wall pair (A, B).
 * Only handles `kind === 'straight'` in Phase 1D-B.
 */
function processPair(
  a: WallEntity,
  b: WallEntity,
  startBevels: Map<string, number>,
  endBevels: Map<string, number>,
): void {
  if (a.kind !== 'straight' || b.kind !== 'straight') return;

  const a1x = a.params.start.x, a1y = a.params.start.y;
  const a2x = a.params.end.x,   a2y = a.params.end.y;
  const b1x = b.params.start.x, b1y = b.params.start.y;
  const b2x = b.params.end.x,   b2y = b.params.end.y;

  const lenA = Math.hypot(a2x - a1x, a2y - a1y);
  const lenB = Math.hypot(b2x - b1x, b2y - b1y);
  if (lenA < 1 || lenB < 1) return;

  const isect = lineLineIntersect(a1x, a1y, a2x, a2y, b1x, b1y, b2x, b2y);
  if (!isect) return;

  const { t, u } = isect;

  const sinA = sinAngleBetween(a2x - a1x, a2y - a1y, b2x - b1x, b2y - b1y);
  if (sinA < Math.sin(MIN_ANGLE_RAD)) return;

  const epsA = JOIN_THRESHOLD_MM / lenA;
  const epsB = JOIN_THRESHOLD_MM / lenB;

  const tNearStart = t >= -epsA && t <= epsA;
  const tNearEnd   = t >= 1 - epsA && t <= 1 + epsA;
  const tInterior  = t > epsA && t < 1 - epsA;

  const uNearStart = u >= -epsB && u <= epsB;
  const uNearEnd   = u >= 1 - epsB && u <= 1 + epsB;
  const uInterior  = u > epsB && u < 1 - epsB;

  const halfA = a.params.thickness / 2;
  const halfB = b.params.thickness / 2;

  if ((tNearStart || tNearEnd) && (uNearStart || uNearEnd)) {
    // Corner: both endpoints meet — trim each by half-thickness of the other.
    const bevelA = Math.min(halfB / sinA, MAX_BEVEL_FRACTION * lenA);
    const bevelB = Math.min(halfA / sinA, MAX_BEVEL_FRACTION * lenB);
    if (tNearStart) accumMax(startBevels, a.id, bevelA);
    else             accumMax(endBevels,   a.id, bevelA);
    if (uNearStart) accumMax(startBevels, b.id, bevelB);
    else             accumMax(endBevels,   b.id, bevelB);
  } else if (tInterior && (uNearStart || uNearEnd)) {
    // T-junction: A continues; only B's stem endpoint is trimmed.
    const bevelB = Math.min(halfA / sinA, MAX_BEVEL_FRACTION * lenB);
    if (uNearStart) accumMax(startBevels, b.id, bevelB);
    else             accumMax(endBevels,   b.id, bevelB);
  } else if (uInterior && (tNearStart || tNearEnd)) {
    // T-junction: B continues; only A's stem endpoint is trimmed.
    const bevelA = Math.min(halfB / sinA, MAX_BEVEL_FRACTION * lenA);
    if (tNearStart) accumMax(startBevels, a.id, bevelA);
    else             accumMax(endBevels,   a.id, bevelA);
  }
  // Cross (both interior): skip Phase 1D-B.
}
