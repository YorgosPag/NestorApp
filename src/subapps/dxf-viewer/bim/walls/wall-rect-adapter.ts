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
import { minThicknessFloorFor, maxThicknessCeilingFor } from './wall-grip-math';

const DEG_PER_RAD = 180 / Math.PI;

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

/** Straight-wall params → axis-midpoint `RectFrame` (scene units). */
function wallToRectFrame(params: WallParams): RectFrame {
  const dx = params.end.x - params.start.x;
  const dy = params.end.y - params.start.y;
  const len = Math.hypot(dx, dy);
  const s = mmScaleFor(params);
  return {
    center: { x: (params.start.x + params.end.x) / 2, y: (params.start.y + params.end.y) / 2 },
    rotationDeg: Math.atan2(dy, dx) * DEG_PER_RAD,
    halfWidth: len / 2,
    halfLength: (params.thickness * s) / 2,
  };
}

/**
 * `RectFrame` (post-resize) → wall params: rebuild `start`/`end` from the new
 * centre ± ½ length along the axis, derive + clamp `thickness`, preserve `flip`,
 * clear miters (junctions break on resize) and drop `dna` (manual override).
 */
function rectFrameToWallParams(frame: RectFrame, params: WallParams): WallParams {
  const s = mmScaleFor(params);
  const rad = frame.rotationDeg / DEG_PER_RAD;
  const ux = Math.cos(rad);
  const uy = Math.sin(rad);
  const hw = frame.halfWidth;
  const rawThickness = (frame.halfLength * 2) / s;
  const minT = minThicknessFloorFor(params.thickness);
  const maxT = maxThicknessCeilingFor(params.thickness);
  const thickness = Math.max(minT, Math.min(maxT, rawThickness));
  const { dna: _dropped, ...rest } = params;
  return {
    ...rest,
    start: { x: frame.center.x - hw * ux, y: frame.center.y - hw * uy, z: params.start.z },
    end: { x: frame.center.x + hw * ux, y: frame.center.y + hw * uy, z: params.end.z },
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
