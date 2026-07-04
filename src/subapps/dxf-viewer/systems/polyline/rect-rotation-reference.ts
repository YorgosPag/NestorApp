/**
 * ADR-561 — Coaxial rotation reference for a RECTANGLE when the rotation centre is
 * picked ON one of its 8 reshape handles (Giorgio 2026-07-05).
 *
 * In the free-rotate hot-grip flow the 0° reference arm normally starts at the first
 * cursor move (an arbitrary direction). Giorgio's rule for a rectangle: WHEN the picked
 * rotation centre coincides with one of the box's 8 handles (4 corners + 4 edge
 * midpoints), the reference must instead be COAXIAL with the box sides — a cross of the
 * two (possibly tilted) side axes through the pivot — and the 0° arm = whichever side
 * axis is nearest the cursor, so the sweep reads from a side «κάθε φορά». If the pivot
 * does NOT land on one of those 8 points (or the shape is not a rectangle) this returns
 * `null` and the caller keeps the existing behaviour (zero regression).
 *
 * Reuses the shared SSoT geometry (`asOrientedRect` + the `rect-frame` handle helpers +
 * `rotateVector`), so the axes it reports are the SAME ones the grips are placed on — no
 * second orientation maths. Pure: zero React / DOM / Firestore / canvas deps.
 *
 * @see systems/polyline/rectangle-detect.ts — `rectOrPolylineVertices` / `asOrientedRect`
 * @see bim/grips/rect-frame.ts — `rectCornerWorld` / `rectEdgeWorld` (the 8 handle SSoT)
 * @see hooks/grips/grip-dxf-drag-preview-resolver.ts — the consumer (free-rotate wiring)
 * @see docs/centralized-systems/reference/adrs/ADR-561-move-rotate-grips-primitives.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { rotateVector } from '../../bim/grips/grip-math';
import { rectCornerWorld, rectEdgeWorld, RECT_CORNERS, type RectFrame } from '../../bim/grips/rect-frame';
import { rectOrPolylineVertices, asOrientedRect } from './rectangle-detect';

/**
 * Fraction of the SMALLER half-dimension within which the pivot counts as «on» a
 * handle. Scale-free (a ratio of world distances), so it works at any zoom and grows
 * with the shape. Snapping usually lands the pivot exactly on the handle; this covers
 * a no-snap pick near it.
 */
const ON_HANDLE_REL_TOL = 0.15;

/** Cross-guide half-length as a multiple of the LARGER half-dimension (visual reach). */
const CROSS_EXTENSION = 6;

/** A dashed guide segment (matches `DxfGripDragPreview.rotateRefLine`/`rotateAlignLine`). */
export interface AxisSegment {
  readonly from: Point2D;
  readonly to: Point2D;
}

export interface RectRotationReference {
  /** `pivot + nearestSideAxisUnit` — the 0° reference arm, coaxial with the nearest side. */
  readonly refAnchor: Point2D;
  /** The two full side-axis guide lines through the pivot (the coaxial cross). */
  readonly cross: { readonly axisRef: AxisSegment; readonly axisAlign: AxisSegment };
}

/** The 8 reshape handles (4 corners + 4 edge midpoints) of an oriented rect frame. */
function rectEightHandles(frame: RectFrame): Point2D[] {
  return [
    ...RECT_CORNERS.map((c) => rectCornerWorld(frame, c)),
    rectEdgeWorld(frame, { axis: 'x', sign: 1 }),
    rectEdgeWorld(frame, { axis: 'x', sign: -1 }),
    rectEdgeWorld(frame, { axis: 'y', sign: 1 }),
    rectEdgeWorld(frame, { axis: 'y', sign: -1 }),
  ];
}

function dist(a: Point2D, b: Point2D): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Resolve the coaxial rotation reference for `entity` when `pivot` lands on one of its
 * 8 rectangle handles, or `null` otherwise (non-rectangle, or pivot off the handles).
 * `cursor` (may be `null` before the first move) selects which of the four side arms is
 * the 0° reference — the one nearest the pivot→cursor direction.
 */
export function resolveRectRotationReference(
  entity: Entity,
  pivot: Point2D,
  cursor: Point2D | null,
): RectRotationReference | null {
  const vertices = rectOrPolylineVertices(entity);
  if (!vertices) return null;
  const frame = asOrientedRect(vertices);
  if (!frame) return null;

  const tol = ON_HANDLE_REL_TOL * Math.min(frame.halfWidth, frame.halfLength);
  if (!(tol > 0)) return null;
  const onHandle = rectEightHandles(frame).some((h) => dist(pivot, h) <= tol);
  if (!onHandle) return null;

  // The two (possibly tilted) side-axis unit directions — the SAME frame the grips use.
  const axisX = rotateVector({ x: 1, y: 0 }, frame.rotationDeg);
  const axisY = rotateVector({ x: 0, y: 1 }, frame.rotationDeg);

  // 0° = the side arm nearest the cursor direction (falls back to +axisX with no cursor).
  const arms: readonly Point2D[] = [axisX, { x: -axisX.x, y: -axisX.y }, axisY, { x: -axisY.x, y: -axisY.y }];
  let nearest = arms[0];
  if (cursor) {
    const cx = cursor.x - pivot.x;
    const cy = cursor.y - pivot.y;
    if (cx !== 0 || cy !== 0) {
      let best = -Infinity;
      for (const arm of arms) {
        const d = arm.x * cx + arm.y * cy; // arms are unit → dot ∝ cos(angle)
        if (d > best) { best = d; nearest = arm; }
      }
    }
  }
  const refAnchor: Point2D = { x: pivot.x + nearest.x, y: pivot.y + nearest.y };

  // The coaxial cross: each side axis drawn as a full line through the pivot.
  const L = CROSS_EXTENSION * Math.max(frame.halfWidth, frame.halfLength);
  const axisSegment = (axis: Point2D): AxisSegment => ({
    from: { x: pivot.x - axis.x * L, y: pivot.y - axis.y * L },
    to: { x: pivot.x + axis.x * L, y: pivot.y + axis.y * L },
  });

  return { refAnchor, cross: { axisRef: axisSegment(axisX), axisAlign: axisSegment(axisY) } };
}
