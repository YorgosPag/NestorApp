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

import type { StairEntity } from '../types/stair-types';
import type { RailingHostContext, RailingPath } from '../types/railing-types';
import { inferSceneUnitsFromWidth, mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';

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

/**
 * Build the `RailingHostContext` for one stair side. `null` when that side has no usable rail
 * polyline. Bakes the scalar `treadCount` (Revit «Baluster Per Tread»): the railing engine
 * places `treadCount × type.perTread.count` balusters, deriving each position + slope z LIVE
 * from `resolvedPath` — so the balusters share the rail's exact path and can never drift above
 * it (ADR-407 Φ7b — no baked anchor positions to go stale).
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

  return {
    hostId: stair.id,
    hostType: 'stair',
    resolvedPath,
    slopeRatio,
    treadCount: Math.max(1, stair.params.stepCount),
  };
}
