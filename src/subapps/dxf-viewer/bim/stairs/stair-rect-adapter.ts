/**
 * ADR-393 Phase C (2026-07-10) — Stair (straight) ⇄ axis-box grip adapter.
 *
 * Bridges the STRAIGHT stair to the SAME shared `axis-box-grips` SSoT the straight
 * wall / beam / foundation-strip consume, so its 8 shape handles (4 corners + 4 mid-
 * edges) + rotation + move cross are the SAME code column the wall uses — Giorgio
 * 2026-07-10 «ίδιες ακριβώς λαβές με τον τοίχο, μηδέν διπλότυπα». The template is
 * `bim/walls/wall-rect-adapter.ts` (sibling pattern).
 *
 * ── UNIT NOTE (non-obvious, the class of bug memory warns about) ──────────────
 * The wall stores `thickness` in **mm** and its axis in scene units, so
 * `wallAxisBoxParams` passes `sceneUnits` and the SSoT scales thickness mm→scene.
 * The STAIR stores `width` / `totalRun` / `basePoint` ALREADY in **scene units**
 * (that is why `inferSceneUnitsFromWidth` / `minWidthFloorFor` inspect the numeric
 * magnitude). So `stairAxisBoxParams` passes NO `sceneUnits` → the SSoT runs at the
 * identity scale (`mmScaleFor` defaults to 1) and every value stays in scene units.
 * Passing a real `sceneUnits` here would double-scale and place the footprint 1000×
 * off in metre/cm scenes.
 *
 * ── RESIZE SEMANTICS ─────────────────────────────────────────────────────────
 * The axis-box engine produces a continuous `{start,end,width}` patch (opposite-
 * element-fixed, wall parity). `stairParamsFromPatch` then re-applies the STAIR
 * invariant that a straight run is a whole number of treads: it snaps the run to
 * `tread·(stepCount−1)` and recomputes `stepCount`/`totalRise` via the shared
 * `recomputeRunSteps` SSoT, RE-ANCHORING the snapped run to whichever short edge the
 * axis-box kept fixed for that role (start-side roles keep the back edge fixed; end-
 * side + width roles keep the front/base fixed). Direction is preserved (a resize
 * never rotates). Rotation is NOT handled here — it keeps the bespoke pivot-aware
 * `rotateStair` (mirror of the wall's `applyRectWallGrip` returning null for rotation).
 *
 * Zero React / DOM / Firestore / canvas deps.
 *
 * @see bim/walls/wall-rect-adapter.ts — the wall sibling (template)
 * @see bim/grips/axis-box-grips.ts — shared axis-box SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-393-bim-stair-extended-grips.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { StairGripKind } from '../../hooks/useGripMovement';
import type { StairParams } from '../types/stair-types';
import {
  applyAxisBoxGripDrag,
  invertAxisBoxRoleMap,
  type AxisBoxParams,
  type AxisBoxGripRole,
  type AxisBoxPatch,
} from '../grips/axis-box-grips';
import {
  unitVectorFromDirection,
  minWidthFloorFor,
  recomputeRunSteps,
} from './stair-grip-math';

/** True when the stair is a plain straight run (the only variant with a rectangular footprint). */
export function isRectStair(params: StairParams): boolean {
  return params.variant.kind === 'straight';
}

/**
 * Stair grip kind ⇄ shared axis-box role. Exported so the grip EMISSION
 * (`getStairGrips` straight branch) and the drag both read the SAME mapping (one
 * source). Local +X = axis (basePoint→run), +Y = +perp (left). The stair's single
 * scalar `width` is the perpendicular `width-edge`; `totalRun` is the axial `length-edge`.
 * `pos` (+perp) = left, `neg` (−perp) = right (matches `stair-corner-*-left/right`).
 */
export const STAIR_ROLE_TO_KIND: Readonly<Record<AxisBoxGripRole, StairGripKind>> = {
  'width-edge': 'stair-width',
  'length-edge': 'stair-length',
  'corner-start-pos': 'stair-corner-start-left',
  'corner-start-neg': 'stair-corner-start-right',
  'corner-end-pos': 'stair-corner-end-left',
  'corner-end-neg': 'stair-corner-end-right',
  'width-edge-far': 'stair-width-far',
  'length-edge-start': 'stair-length-start',
  rotation: 'stair-direction',
};
const STAIR_KIND_TO_ROLE = invertAxisBoxRoleMap(STAIR_ROLE_TO_KIND);

/**
 * `StairParams` → the minimal `AxisBoxParams` the shared SSoT reads. Axis =
 * `basePoint → basePoint + totalRun·u`, `width` = the scalar perpendicular extent.
 * NO `sceneUnits` (identity scale) — the stair values are already in scene units
 * (see the UNIT NOTE above). Exported so emission + drag derive the footprint from
 * the SAME mapping.
 */
export function stairAxisBoxParams(params: StairParams): AxisBoxParams {
  const u = unitVectorFromDirection(params.direction);
  const { basePoint: b, totalRun } = params;
  return {
    start: { x: b.x, y: b.y },
    end: { x: b.x + totalRun * u.x, y: b.y + totalRun * u.y },
    width: params.width,
  };
}

/** Axis midpoint (scene units) — the `stair-base` centre MOVE-cross anchor (wall parity). */
export function stairAxisMidpoint(params: StairParams): Point2D {
  const u = unitVectorFromDirection(params.direction);
  const { basePoint: b, totalRun } = params;
  return { x: b.x + (totalRun / 2) * u.x, y: b.y + (totalRun / 2) * u.y };
}

/** Roles whose START short edge moves → the axis-box keeps the BACK edge fixed. */
const START_ANCHORED_ROLES: ReadonlySet<AxisBoxGripRole> = new Set([
  'corner-start-pos',
  'corner-start-neg',
  'length-edge-start',
]);

/**
 * Shared axis-box `{start,end,width}` patch + STAIR semantics → `StairParams`:
 * clamp `width` to the scene-unit floor, snap the run to whole treads (recompute
 * `stepCount`/`totalRise` via the shared SSoT), and re-anchor the snapped run to the
 * short edge the axis-box kept fixed for `role`. `direction` is preserved (resize
 * never rotates). Geometry is recomputed by `UpdateStairParamsCommand` at commit.
 */
function stairParamsFromPatch(
  patch: AxisBoxPatch,
  params: StairParams,
  role: AxisBoxGripRole,
): StairParams {
  const u = unitVectorFromDirection(params.direction);
  const minW = minWidthFloorFor(params.width);
  const width = Math.max(minW, patch.width);

  const rawRun = Math.hypot(patch.end.x - patch.start.x, patch.end.y - patch.start.y);
  const { stepCount, totalRun, totalRise } = recomputeRunSteps(params, rawRun);

  // Re-anchor the snapped run to the fixed short edge: start-side roles keep the
  // BACK edge (`patch.end`) fixed → derive base from it; every other role keeps the
  // FRONT/base (`patch.start`, already perp-recentered) fixed.
  const base2D: Point2D = START_ANCHORED_ROLES.has(role)
    ? { x: patch.end.x - totalRun * u.x, y: patch.end.y - totalRun * u.y }
    : { x: patch.start.x, y: patch.start.y };

  return {
    ...params,
    basePoint: { x: base2D.x, y: base2D.y, z: params.basePoint.z },
    width,
    stepCount,
    totalRun,
    totalRise,
  };
}

/**
 * Apply a straight-stair rect grip (corner / width edge / length edge, incl. the 2
 * opposite mid-edges) via the shared `applyAxisBoxGripDrag` SSoT. Returns `null`
 * when the stair is not straight, the grip is not a rect grip, OR the grip is
 * `stair-direction` (rotation keeps its bespoke pivot-aware `rotateStair`) — the
 * caller then falls through to the bespoke handlers. Returns `params` (referentially
 * unchanged) on a no-op patch so the commit can short-circuit.
 */
export function applyRectStairGrip(
  gripKind: StairGripKind,
  params: StairParams,
  delta: Point2D,
): StairParams | null {
  if (!isRectStair(params)) return null;
  const role = STAIR_KIND_TO_ROLE[gripKind];
  if (!role || role === 'rotation') return null;
  const patch = applyAxisBoxGripDrag(role, {
    originalParams: stairAxisBoxParams(params),
    delta,
    minWidthMm: minWidthFloorFor(params.width),
  });
  if (!patch) return params;
  return stairParamsFromPatch(patch, params, role);
}
