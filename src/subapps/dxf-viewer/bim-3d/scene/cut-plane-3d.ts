/**
 * ADR-452 — cut-plane 3D resolver (store wiring).
 *
 * Reads the single cut-plane SSoT (`cutPlaneActive` + `viewRange.cutPlaneMm` from
 * the BIM render-settings store) plus the active storey FFL and active building
 * base, and returns the world-Y of the horizontal section plane — or `null` when
 * the cut plane is inactive. Consumed by `SectionSceneController` (the single
 * owner of the scene's clipping planes).
 */

import type * as THREE from 'three';
import { useBimRenderSettingsStore } from '../../state/bim-render-settings-store';
import { useActiveStoreyStore } from '../../systems/levels/active-storey-store';
import { useBim3DEntitiesStore } from '../stores/Bim3DEntitiesStore';
import { useViewMode3DStore } from '../stores/ViewMode3DStore';
import { computeCutPlaneWorldY, buildCutPlane, buildAxisCutPlane, type CutAxis } from './cut-plane-3d-math';

export { computeCutPlaneWorldY, buildCutPlane, buildAxisCutPlane, MM_TO_M, type CutAxis } from './cut-plane-3d-math';

/** ADR-455 — a resolved, active axis cut ready to build a clip plane from. */
export interface ResolvedAxisCut {
  readonly axis: CutAxis;
  /** Plane position in three.js metres (X/Y plan coord, or Z world-Y). */
  readonly worldCoordM: number;
  /** Viewing side (+1 keeps lower DXF coord, −1 keeps higher). */
  readonly sign: 1 | -1;
}

// ADR-455 — note on units: BIM plan geometry vertices are baked into three.js in
// the SAME numeric scene/canvas units the 2D plan uses (metres for BIM scenes; the
// converters place them 1:1, no scaling — only the Z height params are mm×MM_TO_M).
// So an X/Y cut's stored `position` IS the three.js plan coordinate — no conversion.
// (The DXF underlay group is separately unit-scaled; X/Y cuts target BIM geometry.)

/** Active building base elevation (metres). Falls back to the first building, else 0. */
export function resolveActiveBuildingBaseElevationM(): number {
  const s = useBim3DEntitiesStore.getState();
  const building = s.activeBuildingId
    ? s.buildings.find((b) => b.id === s.activeBuildingId)
    : s.buildings[0];
  return building?.baseElevation ?? 0;
}

/**
 * ADR-452 — anti clip-boundary z-fight bias. The horizontal cut keeps `p.y < worldY`.
 * When the user parks the cut AT a storey level (cutPlaneMm = ceiling height), the
 * structural TOP faces sit at EXACTLY `worldY` → `dot == 0` at the boundary →
 * floating-point makes adjacent fragments fall on either side of the plane → the top
 * faces flicker / mix colours (Giorgio 2026-06-19: «μίξη χρωμάτων μόνο όταν το slider
 * της οριζόντιας τομής είναι στην κορυφή»). A tiny upward bias keeps those boundary
 * faces reliably BELOW the plane (kept, not flickering) and lifts the section cap a
 * hair above them so it can't z-fight either. 1 mm is imperceptible at building scale.
 */
const CUT_PLANE_KEEP_EPSILON_M = 0.001;

/** World-Y (metres) of the cut plane, or `null` when the cut plane is off. */
export function resolveCutPlaneWorldY(): number | null {
  const rs = useBimRenderSettingsStore.getState();
  if (!rs.cutPlaneActive) return null;
  // «Όλοι οι όροφοι» (ADR-399): the slider value is already datum-relative building
  // mm (it spans the whole occupied stack — see `multi-floor-cut-range`), so the
  // active-storey FFL offset must NOT be added; the value lives in the same datum
  // frame as `computeCutPlaneWorldY`'s `floorElevationMm` input. Single-floor scope
  // keeps the FFL-relative behaviour (Revit per-level View Range).
  const allFloors = useViewMode3DStore.getState().floor3DScope === 'all';
  const floorElevationMm = allFloors
    ? 0
    : useActiveStoreyStore.getState().context?.floorElevationMm ?? 0;
  return computeCutPlaneWorldY(
    floorElevationMm,
    rs.viewRange.cutPlaneMm,
    resolveActiveBuildingBaseElevationM(),
  ) + CUT_PLANE_KEEP_EPSILON_M;
}

/** Build the active cut plane, or `null` when off. */
export function resolveCutPlane(): THREE.Plane | null {
  const worldY = resolveCutPlaneWorldY();
  return worldY === null ? null : buildCutPlane(worldY);
}

/**
 * ADR-455 — resolve one vertical section cut (DXF world X or Y) from the SSoT, or
 * `null` when inactive. Position is an absolute DXF coordinate (mm → metres), no
 * FFL/datum offset (those apply only to the Z height cut).
 */
export function resolveAxisCut(axis: 'x' | 'y'): ResolvedAxisCut | null {
  const rs = useBimRenderSettingsStore.getState();
  const cut = axis === 'x' ? rs.xAxisCut : rs.yAxisCut;
  if (!cut.active) return null;
  // `position` is already in three.js plan units (scene/canvas units, 1:1) — no scale.
  return { axis, worldCoordM: cut.position, sign: cut.sign };
}

/**
 * ADR-455 — all active cut planes in a stable order (z first, then x, then y). The
 * Z entry reuses the FFL-relative {@link resolveCutPlaneWorldY}; X/Y are absolute.
 * Stable order keeps the composition key + 6-plane slice deterministic.
 */
export function resolveAllAxisCuts(): ResolvedAxisCut[] {
  const out: ResolvedAxisCut[] = [];
  const worldY = resolveCutPlaneWorldY();
  if (worldY !== null) out.push({ axis: 'z', worldCoordM: worldY, sign: 1 });
  const x = resolveAxisCut('x');
  if (x) out.push(x);
  const y = resolveAxisCut('y');
  if (y) out.push(y);
  return out;
}

/** ADR-455 — build the THREE.Plane for a resolved axis cut. */
export function buildResolvedAxisCutPlane(cut: ResolvedAxisCut): THREE.Plane {
  return buildAxisCutPlane(cut.axis, cut.worldCoordM, cut.sign);
}
