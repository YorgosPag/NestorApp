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
 *   - GENERIC polyline → both handles sit on the LONGEST segment's axis at its ¼
 *     points (rotation ¼-east / move ¼-west), via the SAME axis-quarter placement
 *     SSoT the plain DXF line uses. This keeps them ON a drawn edge — the earlier
 *     axis-aligned-bbox centre fell in EMPTY space for an open corner (2 lines joined
 *     at an angle) so the handles floated (Giorgio 2026-07-05 «στο μεγαλύτερο κομμάτι,
 *     ¼ & ¾, πάνω στη γεωμετρία»). A degenerate ring keeps the bbox centre.
 *
 * Zero React / DOM / Firestore / canvas deps.
 *
 * @see systems/polyline/rectangle-detect.ts — `asOrientedRect` + `longestPolylineSegment`
 * @see bim/grips/axis-box-grips.ts — `axisQuarter{Rotation,Move}HandleWorld` (line-parity SSoT)
 * @see bim/grips/rotation-handle-policy.ts — `rotationHandleMidwayOffset` (rectangle branch)
 * @see docs/centralized-systems/reference/adrs/ADR-561-move-rotate-grips-primitives.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { GripInfo, PolylineGripKind } from '../../hooks/grip-types';
import { rectLocalWorld } from '../../bim/grips/rect-frame';
import { rotationHandleMidwayOffset } from '../../bim/grips/rotation-handle-policy';
import { axisToRectFrame, axisQuarterRotationHandleWorld, axisQuarterMoveHandleWorld } from '../../bim/grips/axis-box-grips';
import { asOrientedRect, polylineBboxCenter, longestPolylineSegment } from './rectangle-detect';
import { projectVerticesTo2D } from '../../bim/geometry/shared/polygon-utils';

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

  // GENERIC polyline → both whole-entity handles on the LONGEST segment's axis, at
  // its ¼ points, via the SAME `axisQuarter{Rotation,Move}HandleWorld` placement SSoT
  // the plain DXF line uses (`systems/line/line-grips.ts`) — a polyline and a line can
  // never diverge, ZERO new placement formula. This lands the handles ON a drawn edge:
  // for an open corner (2 lines joined at an angle) the axis-aligned-bbox CENTRE fell in
  // empty space and the move cross + rotation handle floated (Giorgio 2026-07-05 «στο
  // μεγαλύτερο κομμάτι, ¼ & ¾, πάνω στη γεωμετρία»). Rotation = ¼-east / move = ¼-west of
  // that segment (line parity; the compass tie-break puts them symmetrically about the
  // segment centre). Degenerate ring (no non-zero edge) → keep the bbox centre.
  const seg = longestPolylineSegment(vertices, closed);
  if (seg) {
    const frame = axisToRectFrame({ start: seg.start, end: seg.end, width: 0 });
    return [
      {
        entityId, gripIndex: startIndex, type: 'center',
        position: axisQuarterMoveHandleWorld(frame), movesEntity: true, polylineGripKind: POLYLINE_MOVE_KIND,
      },
      {
        entityId, gripIndex: startIndex + 1, type: 'vertex',
        position: axisQuarterRotationHandleWorld(frame), movesEntity: false, polylineGripKind: POLYLINE_ROTATION_KIND,
      },
    ];
  }

  // Degenerate ring (every point coincident) → no axis to place on; keep the centre.
  const center = polylineBboxCenter(vertices);
  return [
    {
      entityId, gripIndex: startIndex, type: 'center',
      position: center, movesEntity: true, polylineGripKind: POLYLINE_MOVE_KIND,
    },
    {
      entityId, gripIndex: startIndex + 1, type: 'vertex',
      position: center, movesEntity: false, polylineGripKind: POLYLINE_ROTATION_KIND,
    },
  ];
}

/**
 * ADR-357/561 — the alignment-tracking anchor point(s) for a plain-polyline VERTEX grip
 * drag, so the SAME centralized Object-Snap-Tracking (`resolveActionAlignmentTracking`) the
 * line + dimension flows use lights up while a polyline vertex is dragged: the white/yellow
 * AutoAlign traces, the Polar increments AND the cyan ambient-neighbour hints. Mirror of
 * `getLineGripAlignmentAnchors` (its line sibling) — ONE resolver family, per-entity anchor
 * provider. The dragged vertex tracks off its FIXED neighbour vertices (they stay put) ⊕ the
 * ambient neighbours the resolver adds itself.
 *
 *   • endpoint of an OPEN ring (gripIndex 0 or n−1) → the single adjacent vertex.
 *   • interior vertex → BOTH adjacent vertices (tracks off either neighbour).
 *   • closed ring → neighbours wrap (vertex 0 ↔ vertex n−1).
 *
 * `gripIndex` outside the vertex range (an edge / move / rotation handle) → `null`, so the
 * caller keeps its own anchor (whole-entity move → base point) or the raw cursor. Pure —
 * zero React / DOM / store deps.
 */
export function getPolylineGripAlignmentAnchors(
  gripIndex: number,
  vertices: readonly Point2D[],
  closed: boolean,
): Point2D[] | null {
  const n = vertices.length;
  if (n < 2 || gripIndex < 0 || gripIndex >= n) return null;
  const anchors: Point2D[] = [];
  if (gripIndex - 1 >= 0) anchors.push(vertices[gripIndex - 1]);
  else if (closed) anchors.push(vertices[n - 1]);
  if (gripIndex + 1 < n) anchors.push(vertices[gripIndex + 1]);
  else if (closed) anchors.push(vertices[0]);
  return anchors.length ? projectVerticesTo2D(anchors) : null;
}

/**
 * ADR-508 §line-hud / ADR-561 — the vertex-index pairs of the segment(s) whose LENGTH changes
 * when polyline vertex `gripIndex` is dragged: the (≤2) edges incident to that vertex. An OPEN
 * endpoint (grip 0 or n−1) has ONE incident edge; an interior/corner vertex has TWO; a closed ring
 * wraps (vertex 0 ↔ n−1). Feeds the live white length+angle HUD — one `buildSegmentHudMeta`+
 * `paintWallHud` per returned segment, the SAME painters the plain line/wall use — so EVERY changing
 * leg of a joined system is dimensioned exactly like a lone line (Revit temporary-dimensions parity,
 * Giorgio 2026-07-05). Sibling of {@link getPolylineGripAlignmentAnchors} (same neighbour selection,
 * segments instead of anchor points). Returns [] for a non-vertex index or <2 vertices. Pure.
 */
export function getPolylineVertexIncidentSegments(
  gripIndex: number,
  vertexCount: number,
  closed: boolean,
): Array<readonly [number, number]> {
  const n = vertexCount;
  if (n < 2 || gripIndex < 0 || gripIndex >= n) return [];
  const segments: Array<readonly [number, number]> = [];
  // incoming edge (previous neighbour → dragged vertex)
  if (gripIndex - 1 >= 0) segments.push([gripIndex - 1, gripIndex]);
  else if (closed) segments.push([n - 1, gripIndex]);
  // outgoing edge (dragged vertex → next neighbour)
  if (gripIndex + 1 < n) segments.push([gripIndex, gripIndex + 1]);
  else if (closed) segments.push([gripIndex, 0]);
  return segments;
}

// NOTE (ADR-561, 2026-07-05): the live polyline/rectangle ROTATION ghost has NO bespoke
// `applyPolylineRotationDrag` — it would be a verbatim copy of `rotateEntity`'s polyline
// case (`vertices.map(rotatePoint)`). The ghost delegates to the shared
// `applyPrimitiveRotationDrag` (`hooks/grips/primitive-rotation-drag.ts`), which runs the
// SAME `rotateEntity` the commit (`RotateEntityCommand` / rectangle explode) does, with
// `polylineBboxCenter` as the pivot fallback. See `rendering/ghost/apply-entity-preview.ts`.
