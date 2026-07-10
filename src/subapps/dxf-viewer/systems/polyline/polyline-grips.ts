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
import { isStraightSegment } from '../../rendering/entities/shared/geometry-bulge-utils';

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

/** The world positions of the 2 whole-entity handles (MOVE cross + rotation). */
export interface MoveRotateHandleWorld {
  readonly move: Point2D;
  readonly rotation: Point2D;
}

/**
 * ADR-561/627 — THE single placement SSoT for the whole-entity MOVE cross + rotation
 * handle of ANY closed/open vertex ring: a plain polyline (`getPolylineMoveRotateGrips`)
 * AND a hatch boundary ring (`getHatchMoveRotateGrips`, ADR-627) derive their two handle
 * POSITIONS from here, so the two entity families can never place them differently
 * («όλα ΙΔΙΑ με το περίγραμμα εμβαδού»). Only the grip-kind tagging differs per caller.
 *
 *   - RECTANGLE (closed, oriented rect-box) → move at the box centre, rotation midway on
 *     a fixed side (tilts with the shape) via the shared `rect-frame` + `rotationHandleMidwayOffset`.
 *   - GENERIC ring → both handles on the LONGEST segment's axis at its ¼ points (move ¼-west
 *     / rotation ¼-east) via the SAME `axisQuarter{Move,Rotation}HandleWorld` the plain DXF
 *     line uses — lands them ON a drawn edge (an axis-aligned-bbox centre falls in empty space
 *     for an open corner, Giorgio 2026-07-05 «στο μεγαλύτερο κομμάτι, ¼ & ¾, πάνω στη γεωμετρία»).
 *   - DEGENERATE ring (every point coincident) → no axis; both fall back to the bbox centre.
 *
 * `null` for <2 vertices (no handles). Pure — zero React / DOM / store deps.
 */
export function resolveMoveRotateHandleWorld(
  vertices: readonly Point2D[],
  closed: boolean,
): MoveRotateHandleWorld | null {
  if (vertices.length < 2) return null;

  const rect = closed ? asOrientedRect(vertices) : null;
  if (rect) {
    const rotOffsetY = rotationHandleMidwayOffset(rect.halfLength * 2); // −halfLength/2
    return { move: rect.center, rotation: rectLocalWorld(rect, 0, rotOffsetY) };
  }

  const seg = longestPolylineSegment(vertices, closed);
  if (seg) {
    const frame = axisToRectFrame({ start: seg.start, end: seg.end, width: 0 });
    return { move: axisQuarterMoveHandleWorld(frame), rotation: axisQuarterRotationHandleWorld(frame) };
  }

  const center = polylineBboxCenter(vertices);
  return { move: center, rotation: center };
}

/**
 * The 2 whole-polyline handles (MOVE cross + rotation), placed via the shared
 * {@link resolveMoveRotateHandleWorld} placement SSoT (rect-box parity for a rectangle,
 * longest-segment ¼-points for a generic polyline). Returns the hooks `GripInfo`; the 2D
 * renderer maps each to its render `GripInfo` (+`shape`). Degenerate rings (<2 vertices)
 * get no handles.
 */
export function getPolylineMoveRotateGrips(
  entityId: string,
  vertices: readonly Point2D[],
  closed: boolean,
  startIndex: number,
): GripInfo[] {
  const pos = resolveMoveRotateHandleWorld(vertices, closed);
  if (!pos) return [];
  return [
    {
      entityId, gripIndex: startIndex, type: 'center',
      position: pos.move, movesEntity: true,
      gripKind: { on: 'polyline', kind: POLYLINE_MOVE_KIND },
    },
    {
      entityId, gripIndex: startIndex + 1, type: 'vertex',
      position: pos.rotation, movesEntity: false,
      gripKind: { on: 'polyline', kind: POLYLINE_ROTATION_KIND },
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
  const { prev, next } = getPolylineVertexNeighbourIndices(gripIndex, vertices.length, closed);
  const anchors: Point2D[] = [];
  if (prev !== null) anchors.push(vertices[prev]);
  if (next !== null) anchors.push(vertices[next]);
  return anchors.length ? projectVerticesTo2D(anchors) : null;
}

/**
 * ADR-357/508/561 — the ONE adjacency SSoT for a polyline VERTEX grip: its incoming (`prev`) and
 * outgoing (`next`) neighbour vertex indices, with wraparound for a closed ring and `null` at an
 * open ring's boundary. `{ prev: null, next: null }` when `gripIndex` is outside the vertex range
 * or the ring is degenerate (<2). Shared by EVERY per-vertex consumer so the «which neighbours are
 * adjacent» rule lives once — the alignment-tracking anchors ({@link getPolylineGripAlignmentAnchors}),
 * the incident-segment white HUD ({@link getPolylineVertexIncidentSegments}) and (indirectly) the
 * endpoint reshape/corner arcs all derive from it, never re-implementing the `if (i−1≥0) … else if
 * (closed) …` selection. Pure — zero deps.
 */
export function getPolylineVertexNeighbourIndices(
  gripIndex: number,
  vertexCount: number,
  closed: boolean,
): { readonly prev: number | null; readonly next: number | null } {
  const n = vertexCount;
  if (n < 2 || gripIndex < 0 || gripIndex >= n) return { prev: null, next: null };
  return {
    prev: gripIndex - 1 >= 0 ? gripIndex - 1 : closed ? n - 1 : null,
    next: gripIndex + 1 < n ? gripIndex + 1 : closed ? 0 : null,
  };
}

/**
 * ADR-508 §line-hud / ADR-561 — the vertex-index pairs of the segment(s) whose LENGTH changes
 * when polyline vertex `gripIndex` is dragged: the (≤2) edges incident to that vertex. An OPEN
 * endpoint (grip 0 or n−1) has ONE incident edge; an interior/corner vertex has TWO; a closed ring
 * wraps (vertex 0 ↔ n−1). Feeds the live white length+angle HUD — one `buildSegmentHudMeta`+
 * `paintWallHud` per returned segment, the SAME painters the plain line/wall use — so EVERY changing
 * leg of a joined system is dimensioned exactly like a lone line (Revit temporary-dimensions parity,
 * Giorgio 2026-07-05). Derives from the shared {@link getPolylineVertexNeighbourIndices} adjacency
 * SSoT (segments instead of anchor points). Returns [] for a non-vertex index or <2 vertices. Pure.
 */
export function getPolylineVertexIncidentSegments(
  gripIndex: number,
  vertexCount: number,
  closed: boolean,
): Array<readonly [number, number]> {
  const { prev, next } = getPolylineVertexNeighbourIndices(gripIndex, vertexCount, closed);
  const segments: Array<readonly [number, number]> = [];
  if (prev !== null) segments.push([prev, gripIndex]); // incoming edge (prev → dragged vertex)
  if (next !== null) segments.push([gripIndex, next]); // outgoing edge (dragged vertex → next)
  return segments;
}

/**
 * ADR-561/508 — is this grip drag a STRAIGHT whole-segment SLIDE? A `polyline-segment-midpoint-N`
 * grip carries `edgeVertexIndices` (`[i, next]`) and translates BOTH edge vertices rigidly, so
 * dragging it slides the whole leg (Giorgio 2026-07-06 «λαβές των μέσων»). Only STRAIGHT segments
 * qualify — an ARC apex (`polyline-arc-midpoint-N`, non-zero `bulges[i]`) tunes curvature instead,
 * so it is excluded (`isStraightSegment` SSoT on the outgoing-segment bulge, `edgeVertexIndices[0]`
 * = segment index N). Lets the two live overlays (base-point alignment traces + λευκές ενδείξεις)
 * treat a mid-leg slide exactly like the vertex reshape they already light up. Pure — zero deps.
 */
export function isPolylineStraightEdgeSlide(
  edgeVertexIndices: readonly [number, number] | undefined,
  bulges: readonly number[] | undefined,
): boolean {
  if (!edgeVertexIndices) return false;
  return isStraightSegment(bulges?.[edgeVertexIndices[0]]);
}

/**
 * ADR-508 §line-hud / ADR-561 — the vertex-index pairs of the segment(s) that the live white HUD
 * (length + ∠angle) must dimension while a STRAIGHT segment-midpoint grip is dragged. Sliding edge
 * `[i, next]` moves BOTH its vertices, so every segment incident to EITHER moving vertex is relevant:
 * the leg itself (`i → next`, rigid-translated) PLUS its two neighbours (`prev → i`, `next → nn`),
 * whose length/angle change. Derived as the deduped UNION of the two vertices' incident segments via
 * the shared {@link getPolylineVertexIncidentSegments} adjacency SSoT — never re-deriving adjacency.
 * Open-ring boundaries drop the missing neighbour automatically. Returns [] for a degenerate ring.
 * Pure — zero deps.
 */
export function getPolylineEdgeSlideIncidentSegments(
  edgeVertexIndices: readonly [number, number],
  vertexCount: number,
  closed: boolean,
): Array<readonly [number, number]> {
  const seen = new Map<string, readonly [number, number]>();
  for (const vertexIndex of edgeVertexIndices) {
    for (const seg of getPolylineVertexIncidentSegments(vertexIndex, vertexCount, closed)) {
      seen.set(`${seg[0]}-${seg[1]}`, seg);
    }
  }
  return [...seen.values()];
}

// NOTE (ADR-561, 2026-07-05): the live polyline/rectangle ROTATION ghost has NO bespoke
// `applyPolylineRotationDrag` — it would be a verbatim copy of `rotateEntity`'s polyline
// case (`vertices.map(rotatePoint)`). The ghost delegates to the shared
// `applyPrimitiveRotationDrag` (`hooks/grips/primitive-rotation-drag.ts`), which runs the
// SAME `rotateEntity` the commit (`RotateEntityCommand` / rectangle explode) does, with
// `polylineBboxCenter` as the pivot fallback. See `rendering/ghost/apply-entity-preview.ts`.
