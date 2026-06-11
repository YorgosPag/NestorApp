/**
 * ADR-363 Slice D — Wall (straight) ⇄ RectFrame adapter.
 *
 * Bridges the STRAIGHT wall to the shared `rect-grip-engine` SSoT so its corner +
 * thickness/length edge resize math is the SAME code column (rect/shear-wall) and
 * foundation (pad) use — Giorgio 2026-06-10 «παντού ίδιος κώδικας, μηδέν διπλότυπα».
 *
 * The wall model is an AXIS (`start`,`end`) + `thickness` + `flip` (NOT
 * anchor+W×L+rotation like column/pad), so the adapter maps:
 *   - local +X = axis direction (start→end)  → `halfWidth` = ½ axis length
 *   - local +Y = +perp (`perpUnit(u)`)        → `halfLength` = thickness/2 (scene)
 *   - `rotationDeg` = axis bearing (`atan2`)
 *
 * Curved / polyline walls have NO rectangular footprint → `applyRectWallGrip`
 * returns `null` for them (detected via the `curveControl` / `polylineVertices`
 * params proxy, since the transform layer has no entity `kind`) and the caller
 * falls back to the bespoke `wall-grip-transforms` handlers.
 *
 * SEMANTICS (engine): corner → opposite corner fixed; thickness/length edge →
 * opposite edge fixed (replaces the prior asymmetric `moveCorner` + symmetric
 * `resizeThickness` for straight walls). `rectFrameToWallParams` re-applies wall
 * semantics: preserves `flip`, clears `startMiter`/`endMiter` (absolute junction
 * points that break on resize) and drops `dna` (manual override), and clamps the
 * thickness scene-unit-aware (shared `min/maxThicknessFor`).
 *
 * Zero React / DOM / Firestore / canvas deps.
 *
 * @see bim/grips/rect-grip-engine.ts — shared corner/edge SSoT
 * @see bim/columns/column-rect-adapter.ts — column adapter (sibling pattern)
 */

import type { Point2D } from '../../rendering/types/Types';
import type { WallGripKind } from '../../hooks/useGripMovement';
import type { WallParams } from '../types/wall-types';
// ADR-363 (2026-06-11) — the WHOLE axis grip pipeline (geometry + corner/edge
// resize + the axis↔frame mapping) is the shared `axis-box-grips` SSoT — the SAME
// `applyAxisBoxGripDrag` the beam + foundation strip call. This adapter only maps
// wall kind↔role and layers the WALL semantics (flip / miter / dna / thickness
// clamp) on the `{start,end,width}` patch — «παντού ίδιος κώδικας, μηδέν διπλότυπα».
import {
  applyAxisBoxGripDrag,
  invertAxisBoxRoleMap,
  type AxisBoxParams,
  type AxisBoxGripRole,
} from '../grips/axis-box-grips';
import { minThicknessFloorFor, maxThicknessCeilingFor } from './wall-grip-math';

/**
 * True when the wall is a plain straight rectangle (no curve control, no
 * polyline). The transform layer has no entity `kind`, so this params proxy is
 * the SSoT discriminator (a curved wall carries `curveControl`; a polyline wall
 * carries ≥3 `polylineVertices`).
 */
export function isRectWall(params: WallParams): boolean {
  if (params.curveControl) return false;
  if (params.polylineVertices && params.polylineVertices.length >= 3) return false;
  return true;
}

/**
 * Wall grip kind ⇄ shared axis-box role. Exported so the wall grip EMISSION
 * (`getWallGrips`) and the drag both read the SAME mapping (one source). Local
 * +X = axis (start→end), +Y = +perp; `wall-thickness` = the perpendicular
 * `width-edge`, `wall-edge-length` = the axial `length-edge`.
 */
export const WALL_ROLE_TO_KIND: Readonly<Record<AxisBoxGripRole, WallGripKind>> = {
  'width-edge': 'wall-thickness',
  'length-edge': 'wall-edge-length',
  'corner-start-pos': 'wall-corner-start-pos',
  'corner-start-neg': 'wall-corner-start-neg',
  'corner-end-pos': 'wall-corner-end-pos',
  'corner-end-neg': 'wall-corner-end-neg',
  rotation: 'wall-rotation',
};
const WALL_KIND_TO_ROLE = invertAxisBoxRoleMap(WALL_ROLE_TO_KIND);

/**
 * `WallParams` → the minimal `AxisBoxParams` the shared SSoT reads. `thickness`
 * is the perpendicular `width`; `flip` chooses which face the single `width-edge`
 * + `rotation` handles sit on (`widthFaceSign`). Exported so `getWallGrips`
 * emission and the drag derive the footprint from the SAME mapping.
 */
export function wallAxisBoxParams(params: WallParams): AxisBoxParams {
  return {
    start: { x: params.start.x, y: params.start.y },
    end: { x: params.end.x, y: params.end.y },
    width: params.thickness,
    sceneUnits: params.sceneUnits,
    widthFaceSign: params.flip ? -1 : 1,
  };
}

/**
 * Shared axis-box `{start,end,width}` patch + WALL semantics → `WallParams`:
 * derive + clamp `thickness` (= width, scene-aware), preserve `flip`, clear miters
 * (junctions break on resize) and drop `dna` (manual override).
 */
function wallParamsFromPatch(
  patch: { start: Point2D; end: Point2D; width: number },
  params: WallParams,
): WallParams {
  const minT = minThicknessFloorFor(params.thickness);
  const maxT = maxThicknessCeilingFor(params.thickness);
  const thickness = Math.max(minT, Math.min(maxT, patch.width));
  const { dna: _dropped, ...rest } = params;
  return {
    ...rest,
    start: { x: patch.start.x, y: patch.start.y, z: params.start.z },
    end: { x: patch.end.x, y: patch.end.y, z: params.end.z },
    thickness,
    startMiter: undefined,
    endMiter: undefined,
  };
}

/**
 * Apply a straight-wall rect grip (corner / thickness edge / length edge) via the
 * shared `applyAxisBoxGripDrag` SSoT. Returns `null` when the wall is not a plain
 * rectangle, the grip is not a rect grip, OR the grip is `wall-rotation` (rotation
 * keeps its bespoke `rotateWall` to honour the picked-pivot 6-click flow) — the
 * caller then falls back to the bespoke handlers.
 */
export function applyRectWallGrip(
  gripKind: WallGripKind,
  params: WallParams,
  delta: Point2D,
): WallParams | null {
  if (!isRectWall(params)) return null;
  const role = WALL_KIND_TO_ROLE[gripKind];
  if (!role || role === 'rotation') return null;
  const patch = applyAxisBoxGripDrag(role, {
    originalParams: wallAxisBoxParams(params),
    delta,
    minWidthMm: minThicknessFloorFor(params.thickness),
  });
  if (!patch) return params;
  return wallParamsFromPatch(patch, params);
}
