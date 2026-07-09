/**
 * ADR-397 — Move-glyph local frame SSoT (Giorgio 2026-06-17).
 *
 * Resolves the LOCAL orientation of a BIM entity so the 4-arrow MOVE handle
 * (`renderMoveGlyph`) rotates together with the entity instead of staying
 * screen-axis-aligned. Returns the entity's local +X / +Y axes as WORLD unit
 * vectors:
 *
 *   - Box / point entities (column, foundation pad, MEP fixture/panel/manifold/
 *     radiator/boiler/water-heater, furniture, floorplan-symbol) carry an
 *     explicit `params.rotation` (degrees, world CCW) → axes from that angle.
 *   - Linear entities (wall, beam, MEP segment, foundation strip) orient along
 *     their axis (`start→end`) → axisX runs along the element, axisY perpendicular.
 *   - Plain DXF `line` (no `params` — the axis lives in TOP-LEVEL `start`/`end`)
 *     orients along that top-level axis → same `fromAxis` path (ADR-363 Slice G.5,
 *     so the line's ¼-west MOVE cross rotates with the line + drives directional move).
 *   - Anything else (circle, no orientation) → `null`, leaving the glyph
 *     screen-axis-aligned exactly as before (zero regression).
 *
 * The renderer projects these world axes through `worldToScreen` to obtain the
 * on-screen glyph angle (handles the canvas Y-flip + scale), and the directional
 * move (ADR-397 Phase 2) translates the entity along `axisX`/`axisY` by a typed
 * value. ONE SSoT → both consumers stay in lock-step.
 *
 * Pure: zero React / DOM / Firestore / canvas deps.
 *
 * @see rendering/grips/GripShapeRenderer.ts — renderMoveGlyph (rotation applied here)
 * @see docs/centralized-systems/reference/adrs/ADR-397-bim-grip-glyph-behavior-ssot.md
 */

import type { Entity } from '../../types/entities';
import type { GripInfo, Point2D } from '../../rendering/types/Types';
import { translatePoint } from '../../rendering/entities/shared/geometry-vector-utils';

const DEG_TO_RAD = Math.PI / 180;

/** The entity's local axes as world-space unit vectors. */
export interface MoveGlyphFrame {
  /** Local +X (width / along-axis) as a world unit vector. */
  readonly axisX: Point2D;
  /** Local +Y (depth / perpendicular) as a world unit vector. */
  readonly axisY: Point2D;
}

/**
 * ADR-561 — the WORLD-aligned frame (local +X = world +X, +Y = world +Y). Used by
 * the plain DXF primitives (circle / arc / polyline / rectangle) whose MOVE cross
 * has no intrinsic single axis: the 4 arms point world E/N/W/S and the per-arm
 * directional move-by-value runs along the world axes.
 */
const IDENTITY_FRAME: MoveGlyphFrame = { axisX: { x: 1, y: 0 }, axisY: { x: 0, y: 1 } };

/** Frame from a world-CCW angle (radians): axisX = (cos,sin), axisY = ⟂ left-hand. */
function fromAngleRad(rad: number): MoveGlyphFrame {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return { axisX: { x: c, y: s }, axisY: { x: -s, y: c } };
}

/** Frame from an axis direction (dx,dy): axisX along it, axisY perpendicular. Null if degenerate. */
function fromAxis(dx: number, dy: number): MoveGlyphFrame | null {
  const len = Math.hypot(dx, dy);
  if (!(len > 1e-9)) return null;
  const ux = dx / len;
  const uy = dy / len;
  return { axisX: { x: ux, y: uy }, axisY: { x: -uy, y: ux } };
}

/** Minimal structural view of the geometry fields we read across BIM param shapes. */
interface OrientedParams {
  readonly rotation?: number;
  readonly start?: { readonly x: number; readonly y: number };
  readonly end?: { readonly x: number; readonly y: number };
  readonly startPoint?: { readonly x: number; readonly y: number };
  readonly endPoint?: { readonly x: number; readonly y: number };
}

/**
 * Resolve the move-glyph local frame for `entity`, or `null` when the entity has
 * no defined planar orientation (the glyph then stays screen-axis-aligned).
 */
export function resolveMoveGlyphFrame(entity: Entity): MoveGlyphFrame | null {
  const params = (entity as { params?: OrientedParams }).params;
  if (params) {
    // Linear entities first: a real axis (wall/beam/segment/strip) defines orientation.
    const a = params.start ?? params.startPoint;
    const b = params.end ?? params.endPoint;
    if (a && b) return fromAxis(b.x - a.x, b.y - a.y);

    // Box / point entities: explicit rotation (degrees, world CCW).
    if (typeof params.rotation === 'number' && Number.isFinite(params.rotation)) {
      return fromAngleRad(params.rotation * DEG_TO_RAD);
    }
    return null;
  }

  // ADR-363 Slice G.5 — plain DXF `line`: no `params`; the axis lives directly on
  // the entity as top-level `start`/`end`. Gated to `type === 'line'` so no other
  // params-less primitive (circle/arc/…) is accidentally given a frame (zero
  // regression). Same `fromAxis` orientation as a wall, so the line's MOVE cross
  // rotates with the line AND the directional move-by-value runs along its local axes.
  const line = entity as { type?: string; start?: Point2D; end?: Point2D };
  if (line.type === 'line' && line.start && line.end) {
    return fromAxis(line.end.x - line.start.x, line.end.y - line.start.y);
  }

  // ADR-557 / ADR-583 — Text / MText / annotation-symbol: no `params`; the planar
  // orientation lives in the TOP-LEVEL `rotation` field (degrees, world CCW), like a box
  // entity. So the 4-arrow MOVE cross rotates with the glyph AND the per-arm directional
  // move-by-value runs along its local axes — parity with the column's centre MOVE. Default
  // 0 → identity (world-aligned), matching an un-rotated glyph. NOTE: this same frame's major
  // axis ALSO seeds the deterministic rotation reference baseline via
  // `resolveRotateReferenceAnchor` (one SSoT, two uses) — so an annotation-symbol rotated about
  // a picked centre draws its ghost reference axis COAXIAL with the symbol's faces (its local
  // ±X), never the arbitrary first-move baseline (Giorgio 2026-07-09: «ο άξονας-φάντασμα πάντα
  // στοιχισμένος οριζόντια/κάθετα με τις παρειές, να μην αποκλίνει»).
  const txt = entity as { type?: string; rotation?: number };
  if (txt.type === 'text' || txt.type === 'mtext' || txt.type === 'annotation-symbol') {
    const rot = typeof txt.rotation === 'number' && Number.isFinite(txt.rotation) ? txt.rotation : 0;
    return fromAngleRad(rot * DEG_TO_RAD);
  }

  // ADR-583 Φ3 — graphic scale-bar: no `params`; its planar orientation is the TOP-LEVEL
  // `angleRad` (RADIANS, world CCW — not degrees). A frame from it keeps the rotation-about-a-
  // picked-centre ghost reference axis COAXIAL with the bar's length (its faces), the SAME SSoT
  // the annotation-symbol/text use (`resolveRotateReferenceAnchor`). Default 0 → identity.
  const bar = entity as { type?: string; angleRad?: number };
  if (bar.type === 'scale-bar') {
    const rad = typeof bar.angleRad === 'number' && Number.isFinite(bar.angleRad) ? bar.angleRad : 0;
    return fromAngleRad(rad);
  }

  // ADR-612 Φ2 — opening-info-tag: no `params`; its planar orientation is the TOP-LEVEL `angleRad`
  // (RADIANS, world CCW), exactly like the scale-bar. A frame from it (a) rotates the 4-arrow MOVE
  // cross with the box AND (b) keeps the rotation-about-a-picked-centre ghost reference axis COAXIAL
  // with the box's edges (its faces) via `resolveRotateReferenceAnchor` — the SAME SSoT text/scale-bar
  // use — so the axis-ghost is ALWAYS in full alignment with the sides, never at an arbitrary angle
  // (Giorgio 2026-07-09: «ο άξονας-φάντασμα πάντα σε πλήρη ταύτιση με τις πλευρές»). Default 0 → identity.
  const tag = entity as { type?: string; angleRad?: number };
  if (tag.type === 'opening-info-tag') {
    const rad = typeof tag.angleRad === 'number' && Number.isFinite(tag.angleRad) ? tag.angleRad : 0;
    return fromAngleRad(rad);
  }

  // ADR-561 — plain DXF primitives (circle / arc / polyline; rectangle/rect/lwpolyline
  // normalise to 'polyline' in the DXF pipeline but the scene entity keeps its own
  // type, so accept them too). They are symmetric or have no single axis → the MOVE
  // cross stays WORLD-aligned. A NON-NULL frame is REQUIRED so `grip-registry`
  // attaches `moveGlyphFrame` + `moveGlyphMmScale` and the per-arm directional
  // click→distance prompt runs (a null frame draws the glyph but leaves the arms
  // inert — the exact bug the line hit before Slice G.5).
  const primType = (entity as { type?: string }).type;
  if (
    primType === 'circle' || primType === 'arc' || primType === 'polyline' ||
    primType === 'rectangle' || primType === 'rect' || primType === 'lwpolyline'
  ) {
    return IDENTITY_FRAME;
  }
  return null;
}

/**
 * Attach the screen-space MOVE-glyph rotation to every `shape: 'move'` grip of
 * `entity`, leaving all other grips untouched. The angle is derived by projecting
 * the entity's local +X axis through `worldToScreen` (so the canvas Y-flip + scale
 * are handled), and is computed at most once per entity. Returns the input array
 * unchanged when the entity has no orientation (`resolveMoveGlyphFrame` → null) or
 * carries no move grip — zero allocation in the common case.
 */
export function withMoveGlyphRotation(
  grips: GripInfo[],
  entity: Entity,
  worldToScreen: (p: Point2D) => Point2D,
): GripInfo[] {
  const frame = resolveMoveGlyphFrame(entity);
  if (!frame) return grips;
  let cached: number | null = null;
  const angleAt = (pos: Point2D): number => {
    if (cached !== null) return cached;
    const c = worldToScreen(pos);
    const ax = worldToScreen(translatePoint(pos, frame.axisX));
    cached = Math.atan2(ax.y - c.y, ax.x - c.x);
    return cached;
  };
  return grips.map((g) => (g.shape === 'move' ? { ...g, glyphRotationRad: angleAt(g.position) } : g));
}
