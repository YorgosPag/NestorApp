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
import { mmScaleFor } from '../../utils/scene-units';
import type { RectFrame, RectCorner, RectSign } from '../grips/rect-frame';
import {
  applyRectCornerDrag,
  applyRectEdgeDrag,
  type RectResizeLimits,
} from '../grips/rect-grip-engine';
// ADR-363 (2026-06-11) — the axis ⇄ RectFrame mapping is now the shared
// `axis-box-grips` SSoT (the SAME primitives beam + foundation strip use). This
// adapter only layers the WALL semantics (flip / miter / dna / thickness clamp)
// on top — «παντού ίδιος κώδικας, μηδέν διπλότυπα» (Giorgio).
import { axisToRectFrame, rectFrameToAxis } from '../grips/axis-box-grips';
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

/** `wall-corner-*` grip kind → local-axis signs (local +X = end dir, +Y = +perp). */
const WALL_CORNER_MAP: Partial<Record<WallGripKind, RectCorner>> = {
  'wall-corner-end-pos': { sx: 1, sy: 1 },
  'wall-corner-start-pos': { sx: -1, sy: 1 },
  'wall-corner-start-neg': { sx: -1, sy: -1 },
  'wall-corner-end-neg': { sx: 1, sy: -1 },
};

/**
 * Straight-wall params → axis-midpoint `RectFrame` (scene units). Delegates to the
 * shared `axisToRectFrame` (thickness = the perpendicular `width`); local +X = axis,
 * +Y = +perp, halfLength = thickness/2 scene.
 */
function wallToRectFrame(params: WallParams): RectFrame {
  return axisToRectFrame({
    start: { x: params.start.x, y: params.start.y },
    end: { x: params.end.x, y: params.end.y },
    width: params.thickness,
    sceneUnits: params.sceneUnits,
  });
}

/**
 * `RectFrame` (post-resize) → wall params: the `{start,end,width}` axis rebuild is
 * the shared `rectFrameToAxis` SSoT; this layers the WALL semantics on top — derive
 * + clamp `thickness` (= width), preserve `flip`, clear miters (junctions break on
 * resize) and drop `dna` (manual override).
 */
function rectFrameToWallParams(frame: RectFrame, params: WallParams): WallParams {
  const axis = rectFrameToAxis(frame, params.sceneUnits);
  const minT = minThicknessFloorFor(params.thickness);
  const maxT = maxThicknessCeilingFor(params.thickness);
  const thickness = Math.max(minT, Math.min(maxT, axis.width));
  const { dna: _dropped, ...rest } = params;
  return {
    ...rest,
    start: { x: axis.start.x, y: axis.start.y, z: params.start.z },
    end: { x: axis.end.x, y: axis.end.y, z: params.end.z },
    thickness,
    startMiter: undefined,
    endMiter: undefined,
  };
}

/** Min half-extents (scene units) = scene-aware thickness floor (length + perp). */
function wallResizeLimits(params: WallParams): RectResizeLimits {
  const half = (minThicknessFloorFor(params.thickness) * mmScaleFor(params)) / 2;
  return { minHalfWidth: half, minHalfLength: half };
}

/**
 * Apply a straight-wall rect grip (corner / thickness edge / length edge) via the
 * shared engine. Returns `null` when the wall is not a plain rectangle OR the grip
 * kind is not a rect grip — the caller then falls back to the bespoke handlers.
 *
 * `wall-thickness` (perp edge) uses `sign = flip ? -1 : +1` so the dragged face
 * is the one drawn (`getWallGrips` places the handle on the flip-aware +perp face,
 * `posSide`). `wall-edge-length` moves the END short edge (start edge fixed).
 */
export function applyRectWallGrip(
  gripKind: WallGripKind,
  params: WallParams,
  delta: Point2D,
): WallParams | null {
  if (!isRectWall(params)) return null;
  const limits = wallResizeLimits(params);
  const corner = WALL_CORNER_MAP[gripKind];
  if (corner) {
    return rectFrameToWallParams(applyRectCornerDrag(wallToRectFrame(params), corner, delta, limits), params);
  }
  if (gripKind === 'wall-thickness') {
    const sign: RectSign = params.flip ? -1 : 1;
    return rectFrameToWallParams(applyRectEdgeDrag(wallToRectFrame(params), { axis: 'y', sign }, delta, limits), params);
  }
  if (gripKind === 'wall-edge-length') {
    return rectFrameToWallParams(applyRectEdgeDrag(wallToRectFrame(params), { axis: 'x', sign: 1 }, delta, limits), params);
  }
  return null;
}
