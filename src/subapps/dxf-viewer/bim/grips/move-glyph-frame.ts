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
 *   - Anything else (plain DXF line/circle, no orientation) → `null`, leaving the
 *     glyph screen-axis-aligned exactly as before (zero regression).
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

const DEG_TO_RAD = Math.PI / 180;

/** The entity's local axes as world-space unit vectors. */
export interface MoveGlyphFrame {
  /** Local +X (width / along-axis) as a world unit vector. */
  readonly axisX: Point2D;
  /** Local +Y (depth / perpendicular) as a world unit vector. */
  readonly axisY: Point2D;
}

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
  if (!params) return null;

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
    const ax = worldToScreen({ x: pos.x + frame.axisX.x, y: pos.y + frame.axisX.y });
    cached = Math.atan2(ax.y - c.y, ax.x - c.x);
    return cached;
  };
  return grips.map((g) => (g.shape === 'move' ? { ...g, glyphRotationRad: angleAt(g.position) } : g));
}
