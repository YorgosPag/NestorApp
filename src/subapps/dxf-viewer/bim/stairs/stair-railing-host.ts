/**
 * Stair → Railing host resolver — ADR-407 Φ7 (SSoT for the hosted-railing path).
 *
 * Pure geometry bridge: turns a `StairEntity` + side into the `RailingHostContext` the
 * railing engine already reserves (`computeRailingGeometry(params, host)`). NO new geometry
 * engine — it re-uses the stair's own `geometry.handrails.inner/outer` polyline (which already
 * follows the steps) as the rail path, and the railing engine derives posts + balusters + rails
 * from it. This is the «κλείσιμο του κυκλώματος»: the reserved hosted branch finally gets a host.
 *
 * **Units (critical, mirror `StairToThreeConverter`):** stair geometry lives in *scene units*
 * (m/cm/mm inferred from `width`, ADR-358 §9.2). The railing engine wants path **xy in canvas
 * units (= scene units → pass through)** but member/elevation **z in mm**. So the polyline z is
 * converted scene-units → mm via `1 / mmToSceneUnits(units)`, while xy is left untouched. The
 * railing params carry the SAME `sceneUnits` so the 3D converter's xy→metres scale agrees.
 *
 * @see bim/railings/railing-geometry.ts — `computeRailingGeometry(params, host)` (reserved branch)
 * @see bim/stairs/stair-railing-plan.ts — the pure planner that consumes this
 * @see docs/centralized-systems/reference/adrs/ADR-407-bim-railings.md §Φ7
 */

import type { StairEntity, Polygon3D } from '../types/stair-types';
import type { Point3D } from '../types/bim-base';
import type { RailingHostContext, RailingPath } from '../types/railing-types';
import { inferSceneUnitsFromWidth, mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import { projectOntoPath } from '../railings/railing-geometry';

export type StairRailingSide = 'inner' | 'outer';

/**
 * The stair sides that should carry an auto-railing: an active `handrails` toggle AND a real
 * (≥2-point) rail polyline. Φ7 is driven by the existing `handrails.inner/outer` SSoT; wall-
 * adjacency auto-detection (Giorgio 2026-07-23) lands incrementally on top of this signal.
 */
export function stairRailingSides(stair: StairEntity): StairRailingSide[] {
  // Defensive: the cascade runs after ANY command and over any (possibly partial) stair — it must
  // never throw. A stair with no handrail params/geometry simply yields no railing.
  const hr = stair.params?.handrails;
  const g = stair.geometry?.handrails;
  const sides: StairRailingSide[] = [];
  if (!hr || !g) return sides;
  if (hr.inner && g.inner && g.inner.length >= 2) sides.push('inner');
  if (hr.outer && g.outer && g.outer.length >= 2) sides.push('outer');
  return sides;
}

/** The scene units the stair (and therefore its hosted railing) is authored in. */
export function stairRailingSceneUnits(stair: StairEntity): SceneUnits {
  return inferSceneUnitsFromWidth(stair.params.width);
}

/** XY centroid of a tread polygon (its plan position on the flight). */
function centroidXY(poly: Polygon3D): { readonly x: number; readonly y: number } {
  let sx = 0;
  let sy = 0;
  for (const p of poly) {
    sx += p.x;
    sy += p.y;
  }
  const n = Math.max(1, poly.length);
  return { x: sx / n, y: sy / n };
}

/**
 * Revit «Baluster Per Tread» anchors (ADR-407 Φ7c): ONE point per stair tread, seated on the
 * railing line at the tread's plan position and carrying the tread's TOP z (stepped, mm). The
 * engine puts one baluster on each — base on the tread, top reaching the smooth rail — so the
 * balusters «πατάνε στη σκάλα» instead of floating on the walkline ramp at even spacing.
 *
 * Built from the actual tread polygons (`treadsBelowCut` + `treadsAboveCut`, all treads regardless
 * of cut plane), so it is correct for straight / gamma / winder / spiral runs uniformly. `undefined`
 * when the stair carries no tread geometry (defensive — a partial stair mid-cascade).
 */
function buildTreadAnchors(
  stair: StairEntity,
  resolvedPath: RailingPath,
  mmPerScene: number,
): readonly Point3D[] | undefined {
  const g = stair.geometry;
  const treads: readonly Polygon3D[] = [...(g?.treadsBelowCut ?? []), ...(g?.treadsAboveCut ?? [])];
  if (treads.length === 0) return undefined;
  const anchors = treads
    .filter((t) => t.length > 0)
    .map((t) => {
      const c = centroidXY(t);
      const seat = projectOntoPath(resolvedPath, c.x, c.y); // xy ON the railing line at this tread
      const treadTopZmm = (t[0]?.z ?? 0) * mmPerScene; // tread top elevation (stepped) → mm
      return { x: seat.x, y: seat.y, z: treadTopZmm };
    })
    .sort((a, b) => (a.z ?? 0) - (b.z ?? 0)); // bottom → top
  return anchors.length > 0 ? anchors : undefined;
}

/**
 * Build the `RailingHostContext` for one stair side. `null` when that side has no usable rail
 * polyline. Bakes `perTreadAnchors` (Revit «Baluster Per Tread») = one railing-line point per
 * actual tread, carrying the tread-top z, so the engine seats a baluster on each tread. Only the
 * tread PLAN positions are baked (they need the stair's tread geometry); the rail and every
 * baluster HEIGHT stay derived live from `resolvedPath`, so a stale bake can never float the
 * rail off the members (ADR-407 Φ7c).
 */
export function buildStairRailingHost(
  stair: StairEntity,
  side: StairRailingSide,
): RailingHostContext | null {
  const poly = stair.geometry?.handrails?.[side];
  if (!poly || poly.length < 2) return null;

  const sceneUnits = stairRailingSceneUnits(stair);
  const mmPerScene = 1 / mmToSceneUnits(sceneUnits); // scene units → mm (z only; xy pass through)
  const resolvedPath: RailingPath = poly.map((p) => ({ x: p.x, y: p.y, z: (p.z ?? 0) * mmPerScene }));

  const totalRun = stair.params.totalRun || 1;
  const slopeRatio = stair.params.totalRise / totalRun;
  const perTreadAnchors = buildTreadAnchors(stair, resolvedPath, mmPerScene);

  return {
    hostId: stair.id,
    hostType: 'stair',
    resolvedPath,
    slopeRatio,
    ...(perTreadAnchors ? { perTreadAnchors } : {}),
  };
}
