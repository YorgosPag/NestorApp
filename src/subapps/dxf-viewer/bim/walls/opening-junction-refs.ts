/**
 * opening-junction-refs — pure SSoT for Revit "junction-aware" opening dimensions
 * (ADR-363 Φ1G.5 Slice 2f).
 *
 * When a dragged opening has NO sibling on one side, its temporary dimension on that
 * side measures to the host WALL END. If a TRANSVERSE wall meets the host at that end
 * (an "L"/"T" junction), measuring to the host-axis endpoint includes HALF the
 * transverse wall's thickness as dead space. Revit's default for openings measures to
 * the transverse wall's near FACE instead — the real free clearance. A FREE end (no
 * transverse wall) keeps measuring to the wall end (the existing, correct behaviour).
 *
 * This computes the inset (mm) from the host endpoint to that near face ALONG the host
 * axis, reusing the wall-trim junction SSoT verbatim — zero new intersection maths:
 *   - `lineLineIntersect` + near-endpoint t / on-wall u + `sinAngleBetween` ≥ MIN_ANGLE
 *     is the exact transverse-wall detection of `classifyPair` (`wall-trims.ts`).
 *   - `penetrationBevel` returns `(halfₜ − ⊥dist(endpoint→transverseAxis)) / |sinθ|`,
 *     i.e. how far along the host axis the transverse near face sits. At a clean L/T
 *     corner the host endpoint lies on the transverse centreline (⊥dist≈0) → the inset
 *     is `halfₜ / sinθ`: perpendicular ⇒ tₜ/2, oblique ⇒ larger.
 */

import type { WallEntity } from '../types/wall-types';
import { mmToSceneUnits } from '../../utils/scene-units';
import { lineLineIntersect, sinAngleBetween } from './wall-trims-geometry';
import { penetrationBevel, MIN_ANGLE_RAD } from './wall-trims-corner-resolve';
import { JOIN_THRESHOLD_MM } from './wall-trims';

/** Host wall axis snapshot in scene-world units (the space of `params.start/end`). */
interface HostAxis {
  readonly endpoint: 'start' | 'end';
  /** The chosen endpoint (junction corner) — scene coords. */
  readonly ex: number;
  readonly ey: number;
  readonly a1x: number;
  readonly a1y: number;
  readonly a2x: number;
  readonly a2y: number;
  /** Full axis length (scene units). */
  readonly len: number;
  /** mm → scene-units factor of the host. */
  readonly scale: number;
}

/**
 * The inset (mm) from the host wall's `endpoint` to the near face of a transverse
 * wall meeting it, measured along the host axis — or `null` when the endpoint is FREE
 * (no transverse wall). When several walls cross, the largest inset wins (the binding
 * near face that bounds the real clearance).
 */
export function resolveJunctionFaceInsetMm(
  host: WallEntity,
  endpoint: 'start' | 'end',
  candidateWalls: readonly WallEntity[],
): number | null {
  if (host.kind !== 'straight') return null;
  const scale = mmToSceneUnits(host.params.sceneUnits ?? 'mm');
  const a1x = host.params.start.x, a1y = host.params.start.y;
  const a2x = host.params.end.x, a2y = host.params.end.y;
  const len = Math.hypot(a2x - a1x, a2y - a1y);
  if (len < scale) return null; // degenerate host (< 1 mm)

  const axis: HostAxis = {
    endpoint,
    ex: endpoint === 'start' ? a1x : a2x,
    ey: endpoint === 'start' ? a1y : a2y,
    a1x, a1y, a2x, a2y, len, scale,
  };

  let bestInsetScene = 0;
  for (const w of candidateWalls) {
    if (w.id === host.id || w.kind !== 'straight') continue;
    const inset = transverseInsetScene(axis, w);
    if (inset > bestInsetScene) bestInsetScene = inset;
  }
  return bestInsetScene > 0 ? bestInsetScene / (scale || 1) : null;
}

/**
 * Inset (scene units) to the near face of transverse wall `w` at the host endpoint,
 * or 0 when `w` is not a transverse wall meeting that endpoint. Mirrors the
 * `classifyPair` junction test (`wall-trims.ts`) then defers the face maths to the
 * shared `penetrationBevel` SSoT.
 */
function transverseInsetScene(axis: HostAxis, w: WallEntity): number {
  const sW = mmToSceneUnits(w.params.sceneUnits ?? 'mm');
  const b1x = w.params.start.x, b1y = w.params.start.y;
  const b2x = w.params.end.x, b2y = w.params.end.y;
  const lenB = Math.hypot(b2x - b1x, b2y - b1y);
  if (lenB < sW) return 0;

  const isect = lineLineIntersect(axis.a1x, axis.a1y, axis.a2x, axis.a2y, b1x, b1y, b2x, b2y);
  if (!isect) return 0;
  const sinA = sinAngleBetween(axis.a2x - axis.a1x, axis.a2y - axis.a1y, b2x - b1x, b2y - b1y);
  if (sinA < Math.sin(MIN_ANGLE_RAD)) return 0; // collinear → not a transverse wall

  const epsA = (JOIN_THRESHOLD_MM * axis.scale) / axis.len;
  const epsB = (JOIN_THRESHOLD_MM * sW) / lenB;
  const tNear = axis.endpoint === 'start'
    ? isect.t >= -epsA && isect.t <= epsA
    : isect.t >= 1 - epsA && isect.t <= 1 + epsA;
  const uOnWall = isect.u >= -epsB && isect.u <= 1 + epsB;
  if (!tNear || !uOnWall) return 0;

  const halfW = (w.params.thickness / 2) * sW;
  return penetrationBevel(axis.ex, axis.ey, b1x, b1y, (b2x - b1x) / lenB, (b2y - b1y) / lenB, halfW, sinA, axis.len);
}
