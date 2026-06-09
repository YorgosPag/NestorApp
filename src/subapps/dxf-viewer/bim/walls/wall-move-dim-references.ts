/**
 * wall-move-dim-references — pure SSoT for the Revit temporary/listening dimensions
 * of a wall as it is dragged laterally (ADR-363 Φ1G.5 Slice 2h).
 *
 * UNLIKE an opening (which slides 1D ALONG its host axis → distances are offsets along
 * that axis), a wall moves SIDEWAYS. Its temporary dimension is therefore the
 * PERPENDICULAR clear gap between the moving wall's near FACE and the near FACE of the
 * nearest PARALLEL reference wall on each side (Revit "Wall faces" temporary-dimension
 * setting — the real free clearance, not the centreline-to-centreline span). At most
 * two dimensions — one per perpendicular side.
 *
 * Reuses the wall-trim junction SSoT verbatim — zero new intersection / angle maths:
 *   - `sinAngleBetween` (`wall-trims-geometry`) + `MIN_ANGLE_RAD` (`wall-trims-corner-resolve`)
 *     classify a candidate as PARALLEL (sin θ below the same threshold used to reject
 *     "collinear" elsewhere).
 *
 * Everything is computed in the moving wall's SCENE-UNIT space (the space of
 * `params.start/end`); the only mm value returned is the measured distance (divided by
 * the wall's `mmToSceneUnits` factor). The world-space witness points are derived later
 * by the 3D overlay — no geometry/Three.js here. The scene is assumed to share one unit
 * system (one drawing), so the moving wall's scale converts every candidate too.
 */

import type { WallEntity } from '../types/wall-types';
import type { SceneUnits } from '../../utils/scene-units';
import { mmToSceneUnits } from '../../utils/scene-units';
import { sinAngleBetween } from './wall-trims-geometry';
import { MIN_ANGLE_RAD } from './wall-trims-corner-resolve';

/** Plan point in the wall's scene-unit space (same space as `params.start/end`). */
interface Pt {
  readonly x: number;
  readonly y: number;
}

/** Live axis of the dragged wall (scene units) — already at the preview position. */
export interface MovingWallAxis {
  readonly id: string;
  readonly start: Pt;
  readonly end: Pt;
  /** mm. Cross-section thickness (always mm, SSoT) — for the near-face offset. */
  readonly thicknessMm: number;
  readonly sceneUnits?: SceneUnits;
}

export interface WallMoveDimReference {
  /** Which perpendicular side of the moving wall the reference lies on (CCW normal = positive). */
  readonly side: 'positive' | 'negative';
  /** Witness anchor on the moving wall's near FACE (scene units). */
  readonly fromPlan: Pt;
  /** Foot on the reference wall's near FACE (scene units). */
  readonly toPlan: Pt;
  /** Perpendicular face-to-face clear gap (mm, ≥ 0). */
  readonly distanceMm: number;
  /** Reference wall id (the nearest parallel wall on that side). */
  readonly referenceWallId: string;
}

export interface WallMoveDimReferences {
  /** 0–2 references — the nearest parallel reference wall on each side, if any. */
  readonly references: readonly WallMoveDimReference[];
}

/**
 * Resolve the ≤2 perpendicular reference dimensions for a wall at its live (dragged)
 * `moving` axis, against the scene's `candidateWalls`. On each side the nearest PARALLEL
 * wall whose centreline the perpendicular from the moving wall's MIDPOINT actually meets
 * (overlap-gated) wins. A degenerate moving wall (< 1 mm) yields no references.
 */
export function resolveWallMoveDimReferences(
  moving: MovingWallAxis,
  candidateWalls: readonly WallEntity[],
): WallMoveDimReferences {
  const dx = moving.end.x - moving.start.x;
  const dy = moving.end.y - moving.start.y;
  const len = Math.hypot(dx, dy);
  const scale = mmToSceneUnits(moving.sceneUnits ?? 'mm') || 1;
  if (len < scale) return { references: [] };

  const ux = dx / len, uy = dy / len; // axis unit
  const nx = -uy, ny = ux; // CCW perpendicular unit
  const mid: Pt = { x: (moving.start.x + moving.end.x) / 2, y: (moving.start.y + moving.end.y) / 2 };
  const movingHalfScene = (moving.thicknessMm / 2) * scale; // moving wall near-face offset

  let pos: WallMoveDimReference | null = null;
  let neg: WallMoveDimReference | null = null;
  for (const w of candidateWalls) {
    if (w.id === moving.id) continue;
    const ref = evalCandidate(w, mid, nx, ny, ux, uy, scale, movingHalfScene);
    if (!ref) continue;
    if (ref.side === 'positive') pos = nearer(pos, ref);
    else neg = nearer(neg, ref);
  }

  const references = [pos, neg].filter((r): r is WallMoveDimReference => r !== null);
  return { references };
}

/** The reference with the smaller clearance (the binding one on that side). */
function nearer(a: WallMoveDimReference | null, b: WallMoveDimReference): WallMoveDimReference {
  return a === null || b.distanceMm < a.distanceMm ? b : a;
}

/**
 * Evaluate one candidate wall: returns its FACE-to-FACE reference when it is a PARALLEL
 * wall whose centreline the perpendicular from `mid` reaches within its extent and a
 * positive clear gap remains, else null. `movingHalfScene` is the moving wall's
 * near-face offset (half-thickness, scene units).
 */
function evalCandidate(
  w: WallEntity,
  mid: Pt,
  nx: number, ny: number,
  ux: number, uy: number,
  scale: number,
  movingHalfScene: number,
): WallMoveDimReference | null {
  if (w.kind !== 'straight') return null;
  const cs = w.params.start, ce = w.params.end;
  const cdx = ce.x - cs.x, cdy = ce.y - cs.y;
  const clen = Math.hypot(cdx, cdy);
  if (clen < scale) return null; // degenerate
  if (sinAngleBetween(ux, uy, cdx, cdy) >= Math.sin(MIN_ANGLE_RAD)) return null; // not parallel

  // Centreline-to-centreline signed perpendicular distance (scene units), then subtract
  // both half-thicknesses → the real face-to-face clear gap.
  const signed = (cs.x - mid.x) * nx + (cs.y - mid.y) * ny;
  const refHalfScene = (w.params.thickness / 2) * scale;
  const clearScene = Math.abs(signed) - movingHalfScene - refHalfScene;
  if (clearScene <= scale) return null; // touching / overlapping (< 1 mm gap)

  const dir = signed > 0 ? 1 : -1;
  const footC: Pt = { x: mid.x + signed * nx, y: mid.y + signed * ny };
  const along = ((footC.x - cs.x) * cdx + (footC.y - cs.y) * cdy) / clen; // along candidate from cs
  if (along < -scale || along > clen + scale) return null; // perpendicular misses the segment

  const toFace = Math.abs(signed) - refHalfScene; // mid → reference near face (scene units)
  return {
    side: signed > 0 ? 'positive' : 'negative',
    fromPlan: { x: mid.x + dir * movingHalfScene * nx, y: mid.y + dir * movingHalfScene * ny },
    toPlan: { x: mid.x + dir * toFace * nx, y: mid.y + dir * toFace * ny },
    distanceMm: clearScene / scale,
    referenceWallId: w.id,
  };
}
