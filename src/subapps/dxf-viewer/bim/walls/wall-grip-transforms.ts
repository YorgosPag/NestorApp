/**
 * ADR-363 Phase 1C — Wall parametric grip drag transforms.
 *
 * Pure functions: zero React / DOM / Firestore / canvas deps. `applyWallGripDrag`
 * maps a wall grip kind + drag input → new `WallParams`. Geometry is NOT
 * recomputed here — the caller (`UpdateWallParamsCommand.execute`) is responsible
 * for the `computeWallGeometry()` call so the math SSoT stays in one place and
 * command merging preserves the original delta semantics. Re-exported from
 * `wall-grips.ts` for a stable public API (mirror `stair-grip-transforms.ts`).
 *
 * Manual-thickness override semantics mirror the ribbon bridge
 * (`ui/ribbon/hooks/bridge/wall-param-helpers.ts`): when the user drags the
 * thickness handle or any corner we drop `dna` so the validator does not fire
 * `dnaThicknessMismatch` against the legacy preset.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.3 §6 Phase 1C / 1C-bis
 */

import type { Point2D } from '../../rendering/types/Types';
import type { WallGripKind } from '../../hooks/useGripMovement';
import type { WallParams } from '../types/wall-types';
import type { Point3D } from '../types/bim-base';
import { mmScaleFor } from '../../utils/scene-units';
import {
  unitAxis,
  perpUnit,
  minThicknessFloorFor,
  maxThicknessCeilingFor,
} from './wall-grip-math';
// ADR-363 Slice D — straight-wall corner/edge resize delegates to the shared
// rect-grip-engine (opposite-element-fixed), same code as column/foundation.
import { applyRectWallGrip } from './wall-rect-adapter';
// ADR-397 §D3 — rotate-about-pivot is shared SSoT: `rotateAxisPointsAboutPivot`
// (swept angle from grip-math + canonical rotatePoint, ADR-188) is consumed by
// both the wall and beam rotation grips. No re-implemented cos/sin here.
import { rotateAxisPointsAboutPivot } from '../grips/grip-math';
// ADR-565 — arc apex drag ↔ bulge conversion reuses the bulge SSoT (ADR-510).
import { bulgeApexPoint, bulgeFromApexPoint } from '../../rendering/entities/shared/geometry-bulge-utils';

// ─── Whole-wall translation SSoT ─────────────────────────────────────────────

type WallMiter = NonNullable<WallParams['startMiter']>;

function shiftPoint3D(p: Point3D, delta: Point2D): Point3D {
  return p.z !== undefined
    ? { x: p.x + delta.x, y: p.y + delta.y, z: p.z }
    : { x: p.x + delta.x, y: p.y + delta.y };
}

function shiftMiter(m: WallMiter, delta: Point2D): WallMiter {
  return {
    outer: { x: m.outer.x + delta.x, y: m.outer.y + delta.y },
    inner: { x: m.inner.x + delta.x, y: m.inner.y + delta.y },
  };
}

/**
 * SSoT — translate ALL world-coord fields of `WallParams` by a 2D delta.
 *
 * Covers: start · end · polylineVertices · curveControl · startMiter · endMiter.
 * Used by both the grip-drag preview path (`moveMidpoint`) and the commit path
 * (`bim-move-geometry.moveWall`) so the two can never diverge.
 */
export function translateWallParams(params: WallParams, delta: Point2D): WallParams {
  return {
    ...params,
    start: shiftPoint3D(params.start, delta),
    end: shiftPoint3D(params.end, delta),
    polylineVertices: params.polylineVertices?.map((v) => shiftPoint3D(v, delta)),
    curveControl: params.curveControl ? shiftPoint3D(params.curveControl, delta) : undefined,
    startMiter: params.startMiter ? shiftMiter(params.startMiter, delta) : undefined,
    endMiter: params.endMiter ? shiftMiter(params.endMiter, delta) : undefined,
  };
}

// ─── Drag transforms ─────────────────────────────────────────────────────────

export interface WallGripDragInput {
  /** Original params at drag start (preserves invariants). */
  readonly originalParams: WallParams;
  /** World-space delta from drag anchor to current cursor position. */
  readonly delta: Point2D;
  /** Current world cursor position (used for thickness resolve). */
  readonly currentPos: Point2D;
  /**
   * ADR-363 Phase 1G — optional rotation pivot for `wall-rotation`. When set, the
   * wall rotates around this point instead of its midpoint (the AutoCAD ROTATE
   * "specify center" flow where the user picks an arbitrary rotation centre). The
   * swept angle is still anchor-relative (`currentPos − delta` → `currentPos`),
   * so there is no snap when rotation starts. Undefined → legacy midpoint pivot.
   */
  readonly pivot?: Point2D;
}

/**
 * Pure transform: wall grip kind + drag input → new `WallParams`. Geometry is
 * NOT recomputed here — the caller (`UpdateWallParamsCommand.execute`) is
 * responsible for the `computeWallGeometry()` call so the math SSoT stays in
 * one place and command merging preserves the original delta semantics.
 *
 * For `wall-vertex-N` the numeric index `N` is parsed from the discriminator
 * suffix; an out-of-range index yields `originalParams` unchanged.
 */
export function applyWallGripDrag(
  gripKind: WallGripKind,
  input: Readonly<WallGripDragInput>,
): WallParams {
  // ADR-363 Slice D — straight-wall corners (4) + thickness/length edges (2) go
  // through the shared rect-grip-engine SSoT (opposite-element-fixed, same code
  // as column/foundation). Returns `null` for curved/polyline walls OR non-rect
  // grip kinds (rotation / curve / vertex / endpoint / midpoint) → fall through
  // to the bespoke handlers below.
  // ADR-363 Slice D/E — straight-wall corners + thickness/length edges go through
  // the shared axis-box engine (opposite-element-fixed, ίδιος κώδικας με δοκό/
  // πεδιλοδοκό). Returns null για curved/polyline OR non-rect kinds (rotation /
  // curve / vertex / endpoint / midpoint) → fall through to the bespoke handlers.
  // Straight-wall corners (4) + ALL 4 mid-edges (thickness/length + far/start) → the
  // shared axis-box engine. The 2 column-parity extras are now plain roles in
  // `WALL_ROLE_TO_KIND`, so no wall-only edge handler is needed.
  const rect = applyRectWallGrip(gripKind, input.originalParams, input.delta);
  if (rect) return rect;
  if (gripKind === 'wall-start') return moveStart(input);
  if (gripKind === 'wall-end') return moveEnd(input);
  if (gripKind === 'wall-midpoint') return moveMidpoint(input);
  if (gripKind === 'wall-thickness') return resizeThickness(input); // curved/polyline path only
  if (gripKind === 'wall-rotation') return rotateWall(input);
  if (gripKind === 'wall-arc-apex') return moveArcApex(input);
  if (gripKind === 'wall-curve') return moveCurveControl(input);
  if (gripKind.startsWith('wall-vertex-')) {
    const idx = parseInt(gripKind.slice('wall-vertex-'.length), 10);
    if (Number.isFinite(idx) && idx >= 1) return movePolylineVertex(input, idx);
  }
  return input.originalParams;
}

function moveStart(input: Readonly<WallGripDragInput>): WallParams {
  const { originalParams, delta } = input;
  const newStart: Point3D = {
    x: originalParams.start.x + delta.x,
    y: originalParams.start.y + delta.y,
    z: originalParams.start.z,
  };
  // startMiter is an absolute world-coord junction point — moving the start
  // endpoint breaks the junction, so clear it (recomputed on commit).
  return { ...originalParams, start: newStart, startMiter: undefined };
}

function moveEnd(input: Readonly<WallGripDragInput>): WallParams {
  const { originalParams, delta } = input;
  const newEnd: Point3D = {
    x: originalParams.end.x + delta.x,
    y: originalParams.end.y + delta.y,
    z: originalParams.end.z,
  };
  // endMiter is an absolute world-coord junction point — moving the end
  // endpoint breaks the junction, so clear it (recomputed on commit).
  return { ...originalParams, end: newEnd, endMiter: undefined };
}

function moveMidpoint(input: Readonly<WallGripDragInput>): WallParams {
  return translateWallParams(input.originalParams, input.delta);
}

/**
 * Phase 1C-ter — rotate the whole wall around its midpoint. Mirror of the stair
 * `rotateDirection` (anchor-relative): the handle sits just outside the end
 * short edge (OFF the start→end axis), so using the cursor's absolute bearing
 * would snap the wall the instant the handle is grabbed. Instead we rotate by
 * the angle SWEPT from the anchor (the grip world position at mousedown =
 * `currentPos − delta`) about the midpoint, then spin both endpoints by it.
 *
 * ADR-397 §D3 — swept angle + point rotation are the shared
 * `rotateAxisPointsAboutPivot` SSoT (`grip-math` `sweptAngleDegAboutPivot` +
 * canonical `rotatePoint`), the same primitive the beam + column rotation grips
 * use. No re-implemented cos/sin.
 */
function rotateWall(input: Readonly<WallGripDragInput>): WallParams {
  const { originalParams, currentPos, delta, pivot } = input;
  // ADR-363 Phase 1G — rotate around the picked pivot when supplied, else the
  // wall midpoint (legacy drag-handle behaviour).
  const centre: Point2D = pivot
    ? pivot
    : {
        x: (originalParams.start.x + originalParams.end.x) / 2,
        y: (originalParams.start.y + originalParams.end.y) / 2,
      };
  const anchor = { x: currentPos.x - delta.x, y: currentPos.y - delta.y };
  const rotated = rotateAxisPointsAboutPivot(
    [
      { x: originalParams.start.x, y: originalParams.start.y },
      { x: originalParams.end.x, y: originalParams.end.y },
    ],
    { pivot: centre, anchor, currentPos },
  );
  if (!rotated) return originalParams;
  const [ns, ne] = rotated;
  return {
    ...originalParams,
    start: { x: ns.x, y: ns.y, z: originalParams.start.z },
    end: { x: ne.x, y: ne.y, z: originalParams.end.z },
  };
}

function resizeThickness(input: Readonly<WallGripDragInput>): WallParams {
  const { originalParams, currentPos } = input;
  const u = unitAxis(originalParams);
  if (!u) return originalParams;
  const p = perpUnit(u);
  const sign = originalParams.flip ? -1 : 1;
  const mid: Point2D = {
    x: (originalParams.start.x + originalParams.end.x) / 2,
    y: (originalParams.start.y + originalParams.end.y) / 2,
  };
  // Signed projection of (cursor − mid) onto the (signed) perpendicular.
  // Thickness = 2 * |proj| (handle is mid-axis offset by ±t/2). `proj` is in
  // canvas units; thickness is stored in mm, so divide by sceneScale.
  const dx = currentPos.x - mid.x;
  const dy = currentPos.y - mid.y;
  const proj = (dx * p.x + dy * p.y) * sign;
  const rawThickness = (Math.abs(proj) * 2) / mmScaleFor(originalParams);
  const minT = minThicknessFloorFor(originalParams.thickness);
  const maxT = maxThicknessCeilingFor(originalParams.thickness);
  const clamped = Math.max(minT, Math.min(maxT, rawThickness));
  // Manual override drops DNA so the validator does not fire
  // `dnaThicknessMismatch` (parity with `wall-param-helpers` ribbon path).
  const { dna: _dropped, ...rest } = originalParams;
  return { ...rest, thickness: clamped };
}

// ADR-363 Slice E (2026-06-11) — the bespoke asymmetric `moveCorner` was removed:
// straight-wall corners now route through the shared axis-box engine (via
// `applyRectWallGrip`, opposite-corner-fixed), and curved/polyline walls never
// emit corner grips. Identical 2-DOF result (axial → length, perpendicular →
// near-face thickness with axis recenter), now ONE code path with beam/foundation.

/**
 * ADR-565 — drag the circular arc's sagitta apex to reshape the radius/sweep.
 * The apex position is `bulgeApexPoint(start, end, arc)`; the new bulge is the
 * inverse `bulgeFromApexPoint` of the dragged apex (constrained to the chord's
 * perpendicular at the midpoint — a symmetric radius handle). Reuses the bulge
 * SSoT; geometry is recomputed by the caller (`UpdateWallParamsCommand`).
 */
function moveArcApex(input: Readonly<WallGripDragInput>): WallParams {
  const { originalParams, delta } = input;
  if (originalParams.arc == null) return originalParams;
  const start: Point2D = { x: originalParams.start.x, y: originalParams.start.y };
  const end: Point2D = { x: originalParams.end.x, y: originalParams.end.y };
  const apex = bulgeApexPoint(start, end, originalParams.arc);
  const nextApex: Point2D = { x: apex.x + delta.x, y: apex.y + delta.y };
  return { ...originalParams, arc: bulgeFromApexPoint(start, end, nextApex) };
}

function moveCurveControl(input: Readonly<WallGripDragInput>): WallParams {
  const { originalParams, delta } = input;
  const existing = originalParams.curveControl;
  if (!existing) {
    // Seed from current cursor: handle was implicitly at axis midpoint.
    const mid: Point3D = {
      x: (originalParams.start.x + originalParams.end.x) / 2 + delta.x,
      y: (originalParams.start.y + originalParams.end.y) / 2 + delta.y,
      z: 0,
    };
    return { ...originalParams, curveControl: mid };
  }
  const next: Point3D = {
    x: existing.x + delta.x,
    y: existing.y + delta.y,
    z: existing.z,
  };
  return { ...originalParams, curveControl: next };
}

function movePolylineVertex(
  input: Readonly<WallGripDragInput>,
  index: number,
): WallParams {
  const { originalParams, delta } = input;
  const verts = originalParams.polylineVertices;
  if (!verts || index < 1 || index >= verts.length - 1) return originalParams;
  const next: Point3D[] = verts.map((v, i) =>
    i === index
      ? { x: v.x + delta.x, y: v.y + delta.y, z: v.z }
      : { x: v.x, y: v.y, z: v.z },
  );
  // Polyline endpoints stay anchored to params.start/end (axis-aligned SSoT).
  return { ...originalParams, polylineVertices: next };
}
