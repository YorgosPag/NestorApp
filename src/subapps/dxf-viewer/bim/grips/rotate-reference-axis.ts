/**
 * ADR-363 Slice G.6 — FREE-rotate reference baseline along the entity's MAJOR axis.
 *
 * When the user picks a rotation centre (pivot) in the free-rotate hot-grip flow, the
 * imaginary reference line (from which the live sweep is measured) should start
 * PARALLEL to the entity's longest axis — pointing toward the entity BODY — so the
 * far end of that axis tracks the cursor (Giorgio 2026-06-30: «η νοητή ευθεία από το
 * κέντρο περιστροφής να είναι πάντοτε παράλληλη προς τον μεγαλύτερο άξονα· η μακρινή
 * άκρη ακολουθεί το ποντίκι»). Before this, the baseline was the cursor position at
 * the first move after the pivot — an arbitrary direction.
 *
 * This pure helper resolves that baseline ANCHOR (`pivot + majorAxisUnit`) for ANY
 * entity, REUSING the existing orientation SSoT `resolveMoveGlyphFrame` (the same
 * local +X/+Y axes the MOVE glyph rotates by) — NO new orientation maths. Returns
 * `null` when the entity has no planar orientation, so the caller falls back to the
 * legacy first-move baseline (zero regression).
 *
 * Major-axis selection: linear entities (wall / beam / segment / strip / plain line)
 * are longest ALONG their axis → local +X. Box entities (column / foundation / …)
 * use whichever of width (local +X) / depth (local +Y) is larger. Direction is then
 * flipped to point from the pivot toward the entity centre (the «body»), so the
 * reference line lies over the body and its far end chases the cursor.
 *
 * Pure: zero React / DOM / Firestore / canvas deps.
 *
 * @see bim/grips/move-glyph-frame.ts — `resolveMoveGlyphFrame` (the orientation SSoT)
 * @see hooks/grips/grip-hotgrip-actions.ts — seeds `hotGripRotateBaseRef` with this
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md Slice G.6
 */

import type { Entity } from '../../types/entities';
import type { Point2D } from '../../rendering/types/Types';
import { resolveMoveGlyphFrame } from './move-glyph-frame';
import { rotateVector } from './grip-math';
import { rectOrPolylineVertices, asOrientedRect, longestPolylineSegment, polylineBboxCenter } from '../../systems/polyline/rectangle-detect';

/**
 * World-unit threshold separating a pivot that sits OFF the axis of symmetry (so the
 * body lies clearly to one side → follow it) from one ON it (projection ≈ 0 → the
 * direction is ambiguous, default to −major). Tiny: real grips project at ½·dimension.
 */
const MAJOR_AXIS_PROJ_EPS = 1e-6;

/**
 * The SINGLE «orient the reference baseline toward the entity body» rule, shared by
 * EVERY reference family (wall/box via move-glyph-frame, rectangle, generic polyline)
 * so they can never drift. Given the `pivot`, a UNIT `majorUnit` axis and the entity
 * `centre`, returns the baseline anchor one unit from the pivot: keep `+majorUnit` only
 * when it points clearly toward the centre (projection > ε), else `−majorUnit` (it points
 * away, OR the pivot sits on the axis of symmetry so projection ≈ 0 → the direction is
 * ambiguous and we default to −major). `centre === null` → −major (no body reference).
 * This is the exact wall 9-grip truth-table Giorgio specified, expressed once.
 */
function anchorTowardBody(pivot: Point2D, majorUnit: Point2D, centre: Point2D | null): Point2D {
  let dir: Point2D = { x: -majorUnit.x, y: -majorUnit.y };
  if (centre) {
    const proj = (centre.x - pivot.x) * majorUnit.x + (centre.y - pivot.y) * majorUnit.y;
    if (proj > MAJOR_AXIS_PROJ_EPS) dir = majorUnit;
  }
  return { x: pivot.x + dir.x, y: pivot.y + dir.y };
}

interface BBoxView { readonly min: { x: number; y: number }; readonly max: { x: number; y: number }; }

interface DimsView {
  readonly width?: number;
  readonly depth?: number;
  readonly length?: number;
  readonly height?: number;
  readonly start?: { x: number; y: number };
  readonly end?: { x: number; y: number };
  readonly startPoint?: { x: number; y: number };
  readonly endPoint?: { x: number; y: number };
  readonly position?: { x: number; y: number };
}

/** Entity centre (world) for the «toward the body» direction flip. */
function entityCentre(entity: Entity): Point2D | null {
  const bbox = (entity as { geometry?: { bbox?: BBoxView } }).geometry?.bbox;
  if (bbox) return { x: (bbox.min.x + bbox.max.x) / 2, y: (bbox.min.y + bbox.max.y) / 2 };
  // Plain DXF line: top-level start/end midpoint.
  const ln = entity as { type?: string; start?: { x: number; y: number }; end?: { x: number; y: number } };
  if (ln.type === 'line' && ln.start && ln.end) {
    return { x: (ln.start.x + ln.end.x) / 2, y: (ln.start.y + ln.end.y) / 2 };
  }
  const p = (entity as { params?: DimsView }).params;
  if (p) {
    const a = p.start ?? p.startPoint;
    const b = p.end ?? p.endPoint;
    if (a && b) return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    if (p.position) return { x: p.position.x, y: p.position.y };
  }
  return null;
}

/**
 * True when local +Y (depth) is the MAJOR axis (so the reference uses `axisY`).
 * Linear entities (an axis with start/end) and params-less primitives are longest
 * along local +X → false. Box entities compare width (local +X) vs depth/length/
 * height (local +Y). Unknown dims → false (default to +X).
 */
function axisYIsMajor(entity: Entity): boolean {
  const p = (entity as { params?: DimsView }).params;
  if (!p) return false; // plain line: length along +X dominates
  if ((p.start && p.end) || (p.startPoint && p.endPoint)) return false; // linear → +X
  const w = p.width;
  const d = p.depth ?? p.length ?? p.height;
  if (typeof w === 'number' && typeof d === 'number') return d > w;
  return false;
}

/**
 * ADR-561 — the rectangle sibling of the wall's major-axis reference. Recovers the
 * oriented rect frame from the entity's vertices (SSoT `asOrientedRect`) and returns the
 * baseline anchor along its MAJOR side (the longer edge), oriented toward the box centre
 * via the shared `anchorTowardBody` SSoT. Returns `null` for a
 * non-rectangle (⇒ caller falls through to the generic move-glyph-frame path — zero
 * regression to line/arc/generic-polyline). One axis, coaxial with a side, exactly like the
 * wall — the existing `paintDirectionArc` then draws that single dashed 0° baseline.
 */
function rectReferenceAnchor(entity: Entity, pivot: Point2D): Point2D | null {
  const vertices = rectOrPolylineVertices(entity);
  if (!vertices) return null;
  const rect = asOrientedRect(vertices);
  if (!rect) return null;
  // Major side = the longer edge → wall parity (the wall's major axis is its length). The
  // frame's local +X runs along the first edge (halfWidth); +Y along the second (halfLength).
  const majorDeg = rect.halfLength > rect.halfWidth ? rect.rotationDeg + 90 : rect.rotationDeg;
  const major = rotateVector({ x: 1, y: 0 }, majorDeg);
  return anchorTowardBody(pivot, major, rect.center);
}

/**
 * ADR-561 — the GENERIC-polyline sibling of `rectReferenceAnchor`. A polyline made of
 * 2+ lines joined at an angle has NO single oriented rect frame (`asOrientedRect` →
 * null) and `resolveMoveGlyphFrame` hands it a world-aligned IDENTITY → a horizontal
 * baseline (wrong). Instead the major axis = the direction of the LONGEST segment (the
 * SAME segment the move/rotation grips sit on, `longestPolylineSegment`), oriented toward
 * the polyline body (bbox centre) via the shared `anchorTowardBody` SSoT the wall /
 * rectangle also use — so the dashed reference line is coaxial with the dominant line
 * (Giorgio 2026-07-05: «ο άξονας αναφοράς να ταυτίζεται με τον άξονα της γραμμής, πάντοτε»).
 * Returns `null` for a non-polyline / degenerate ring (⇒ caller falls through).
 */
function polylineReferenceAnchor(entity: Entity, pivot: Point2D): Point2D | null {
  const type = (entity as { type?: string }).type;
  if (type !== 'polyline' && type !== 'lwpolyline') return null;
  const vertices = rectOrPolylineVertices(entity);
  if (!vertices || vertices.length < 2) return null;
  const closed = (entity as { closed?: boolean }).closed ?? false;
  const seg = longestPolylineSegment(vertices, closed);
  if (!seg) return null;
  const dx = seg.end.x - seg.start.x;
  const dy = seg.end.y - seg.start.y;
  const len = Math.hypot(dx, dy);
  if (len < MAJOR_AXIS_PROJ_EPS) return null;
  const major: Point2D = { x: dx / len, y: dy / len };
  return anchorTowardBody(pivot, major, polylineBboxCenter(vertices));
}

/**
 * Resolve the free-rotate reference baseline anchor (`pivot + majorAxisUnit`,
 * oriented toward the entity body) for `entity`, or `null` when the entity has no
 * planar orientation (caller falls back to the legacy first-move baseline).
 *
 * The returned point is one unit from the pivot along the major axis; only its
 * DIRECTION matters (the sweep is angle-based, distance-independent), mirroring how
 * the 6-click reference flow and the typed-angle flow seed their anchors.
 */
export function resolveRotateReferenceAnchor(entity: Entity, pivot: Point2D): Point2D | null {
  // A CIRCLE is symmetric and carries no rotation handle (ADR-561: circle = move only), so it
  // has no meaningful reference axis → null (first-move fallback). Explicit guard because
  // `resolveMoveGlyphFrame` hands the circle a world-aligned IDENTITY frame for its MOVE glyph,
  // which must NOT be misread here as a rotation axis (would yield an arbitrary world-X baseline).
  if ((entity as { type?: string }).type === 'circle') return null;

  // ADR-561 — a RECTANGLE rotates about the SAME single reference axis a wall does (its own
  // major side, oriented toward the body), but its planar orientation lives in its VERTICES,
  // not a move-glyph frame — `resolveMoveGlyphFrame` returns a world-aligned IDENTITY for a
  // rectangle, which would give a world-axis 0° baseline (wrong for a tilted box). Derive the
  // oriented frame from the vertices so the reference is coaxial with a side — identical
  // single-axis behaviour to the wall (Giorgio 2026-07-05: «ίδιος κώδικας τοίχου, ΕΝΑΣ άξονας»).
  const rectAnchor = rectReferenceAnchor(entity, pivot);
  if (rectAnchor) return rectAnchor;

  // ADR-561 — a GENERIC polyline (2+ lines joined at an angle) is coaxial with its
  // LONGEST segment; without this it would take the world-aligned IDENTITY frame below
  // and the dashed reference baseline would be horizontal (Giorgio 2026-07-05).
  const polyAnchor = polylineReferenceAnchor(entity, pivot);
  if (polyAnchor) return polyAnchor;

  const frame = resolveMoveGlyphFrame(entity);
  if (!frame) return null;
  const major = axisYIsMajor(entity) ? frame.axisY : frame.axisX;
  // Orient along the major axis toward the body via the shared SSoT (the wall 9-grip
  // truth-table: east-side grips → west, west-side grips → east, central-X grips → −major).
  return anchorTowardBody(pivot, major, entityCentre(entity));
}
