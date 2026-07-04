/**
 * ADR-561 — Plain DXF POLYLINE whole-entity grip SSoT (pure helpers).
 *
 * Emits the TWO whole-polyline handles — the MOVE cross + the rotation handle —
 * that both grip paths append to the existing vertex/edge grips:
 *   - `computeDxfEntityGrips` (case 'polyline') → interaction + hit-testing.
 *   - `PolylineRenderer.getGrips`               → on-canvas 2D grip painting.
 *
 * (The per-vertex / per-edge / arc-apex grips keep their existing emission in each
 * path — this module owns ONLY the new move + rotation handles, the single feature
 * ADR-561 adds, so it is the SSoT for their placement + kinds.)
 *
 *   - `polyline-move`     → centre grip, 4-arrow MOVE glyph + per-arm directional
 *                           move-by-value + whole-entity translate (existing
 *                           `movesEntity` path, NO new commit).
 *   - `polyline-rotation` → rotation handle; commit routes through the canonical
 *                           `RotateEntityCommand` (rotate all vertices; a scene
 *                           `rectangle` explodes to a polyline first — see
 *                           `commitPolylineRotationGripDrag`).
 *
 * PLACEMENT — Giorgio 2026-07-01:
 *   - RECTANGLE (closed 4-corner, right angles) → «rect-box parity»: the move sits
 *     at the box centre and the rotation handle midway on a FIXED side of the box,
 *     TILTING with the shape — via the shared `rect-frame` SSoT + the SAME
 *     `rotationHandleMidwayOffset` policy the column / text use.
 *   - GENERIC polyline → the move sits at the axis-aligned-bbox centre, the rotation
 *     handle midway below it (bbox-relative). Non-oriented, but covers any shape.
 *
 * Zero React / DOM / Firestore / canvas deps.
 *
 * @see systems/polyline/rectangle-detect.ts — `asOrientedRect` (oriented placement)
 * @see bim/grips/rotation-handle-policy.ts — `rotationHandleMidwayOffset` (shared)
 * @see docs/centralized-systems/reference/adrs/ADR-561-move-rotate-grips-primitives.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { GripInfo, PolylineGripKind } from '../../hooks/grip-types';
import { rectLocalWorld } from '../../bim/grips/rect-frame';
import { rotationHandleMidwayOffset } from '../../bim/grips/rotation-handle-policy';
import { asOrientedRect, polylineBbox, polylineBboxCenter } from './rectangle-detect';
// ADR-561 — live polyline/rectangle ROTATION ghost SSoT: the SAME swept-angle + rotate
// primitives the commit runs (`commitPolylineRotationGripDrag` → `resolveRotation` →
// `RotateEntityCommand` / explode-to-polyline), so preview ≡ commit by construction (μηδέν
// νέα rotate math — mirror `applyArcRotationDrag` / `applyLineRotationDrag`).
import { sweptAngleDegAboutPivot } from '../../bim/grips/grip-math';
import { rotatePoint } from '../../utils/rotation-math';

/** The polyline whole-entity grip kinds (mirror `wall-midpoint` / `wall-rotation`). */
export const POLYLINE_MOVE_KIND: PolylineGripKind = 'polyline-move';
export const POLYLINE_ROTATION_KIND: PolylineGripKind = 'polyline-rotation';

/**
 * The grip index at which the two whole-polyline handles start — right after the
 * per-vertex grips (`0..n-1`) + the per-edge grips (`n..n+edgeCount-1`). Shared so
 * interaction + render assign the SAME indices (a mismatch would break hit-test ↔
 * paint correspondence). `edgeCount = closed ? n : n-1` (AutoCAD outgoing segments).
 */
export function polylineMoveRotateStartIndex(vertexCount: number, closed: boolean): number {
  const edgeCount = closed ? vertexCount : Math.max(0, vertexCount - 1);
  return vertexCount + edgeCount;
}

/**
 * The 2 whole-polyline handles (MOVE cross + rotation), placed with rect-box parity
 * for a rectangle or bbox-relative for a generic polyline. Returns the hooks
 * `GripInfo`; the 2D renderer maps each to its render `GripInfo` (+`shape`).
 * Degenerate rings (<2 vertices) get no handles.
 */
export function getPolylineMoveRotateGrips(
  entityId: string,
  vertices: readonly Point2D[],
  closed: boolean,
  startIndex: number,
): GripInfo[] {
  if (vertices.length < 2) return [];

  // RECTANGLE → oriented rect-box placement (rotation handle tilts with the shape).
  const rect = closed ? asOrientedRect(vertices) : null;
  if (rect) {
    const rotOffsetY = rotationHandleMidwayOffset(rect.halfLength * 2); // −halfLength/2
    return [
      {
        entityId, gripIndex: startIndex, type: 'center',
        position: rect.center, movesEntity: true, polylineGripKind: POLYLINE_MOVE_KIND,
      },
      {
        entityId, gripIndex: startIndex + 1, type: 'vertex',
        position: rectLocalWorld(rect, 0, rotOffsetY), movesEntity: false, polylineGripKind: POLYLINE_ROTATION_KIND,
      },
    ];
  }

  // GENERIC polyline → axis-aligned-bbox placement.
  const center = polylineBboxCenter(vertices);
  const b = polylineBbox(vertices);
  const rotOffsetY = rotationHandleMidwayOffset(b.maxY - b.minY); // −height/4 (below centre)
  return [
    {
      entityId, gripIndex: startIndex, type: 'center',
      position: center, movesEntity: true, polylineGripKind: POLYLINE_MOVE_KIND,
    },
    {
      entityId, gripIndex: startIndex + 1, type: 'vertex',
      position: { x: center.x, y: center.y + rotOffsetY }, movesEntity: false, polylineGripKind: POLYLINE_ROTATION_KIND,
    },
  ];
}

/** The minimal polyline geometry the rotation ghost reads (mirror `ArcRotationDragInput`). */
export interface PolylineRotationDragInput {
  /** The polyline's vertices (a rectangle is already exploded to 4 corners upstream). */
  readonly vertices: readonly Point2D[];
  /** Reference anchor at mouseDown — the swept angle is anchor-relative (`angle(cur) − angle(anchor)`). */
  readonly anchor: Point2D;
  /** Live world cursor position (= anchor + delta). */
  readonly currentPos: Point2D;
  /** Rotation centre. Absent → the vertices' axis-aligned-bbox centre (commit's fallback pivot). */
  readonly pivot?: Point2D;
}

/**
 * ADR-561 — rotate every polyline vertex about the pivot (or its bbox centre) by the
 * anchor-relative swept angle. Thin adapter over the EXACT rotate primitives the commit runs
 * (`commitPolylineRotationGripDrag` → `resolveRotation` → `RotateEntityCommand` polyline case /
 * rectangle explode): `sweptAngleDegAboutPivot` for the angle, then `rotatePoint` on every vertex
 * — identical to the `polyline`/`lwpolyline` branch of `rotateEntity` (rotation-math). So the live
 * ghost ≡ the committed result by construction (NO re-implemented rotate math — one engine, mirror
 * `applyArcRotationDrag`). The bbox-centre fallback matches the commit's `polylineBboxCenter` pivot,
 * so a legacy (non-hot-grip) drag previews identically too. Returns `null` for a degenerate / zero
 * sweep (cursor on the pivot) so callers no-op.
 */
export function applyPolylineRotationDrag(input: PolylineRotationDragInput): Point2D[] | null {
  if (input.vertices.length < 2) return null;
  const pivot = input.pivot ?? polylineBboxCenter(input.vertices);
  const sweptDeg = sweptAngleDegAboutPivot(pivot, input.anchor, input.currentPos);
  if (sweptDeg === null || sweptDeg === 0) return null;
  return input.vertices.map((v) => rotatePoint(v, pivot, sweptDeg));
}
