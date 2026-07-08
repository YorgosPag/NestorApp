/**
 * ROTATION MATH UTILITIES
 *
 * 🏢 ADR-188: Entity Rotation System — Centralized rotation math
 * Single Source of Truth for all rotation calculations.
 *
 * Conventions (AutoCAD/DXF standard):
 * - Positive angle = counterclockwise (CCW)
 * - Storage unit = degrees
 * - Math operations use radians internally
 *
 * @see ADR-188 §6.1 (Translate-Rotate-Translate method)
 * @see ADR-188 §6.2 (Entity-specific transform logic)
 */

import type { Point2D } from '../rendering/types/Types';
import type { Entity } from '../types/entities';
import type { EntityType } from '../types/base-entity';
// 🏢 ADR-067: Centralized angle conversion
import { degToRad, normalizeAngleDeg } from '../rendering/entities/shared/geometry-utils';

/**
 * Rotate a point around a pivot by a given angle.
 *
 * Uses Translate-Rotate-Translate method (ADR-188 §6.1):
 *   x' = (x - bx)·cos(θ) - (y - by)·sin(θ) + bx
 *   y' = (x - bx)·sin(θ) + (y - by)·cos(θ) + by
 *
 * @param point  - Point to rotate
 * @param pivot  - Rotation center (base point)
 * @param angleDeg - Rotation angle in degrees (positive = CCW)
 * @returns Rotated point
 */
export function rotatePoint(point: Point2D, pivot: Point2D, angleDeg: number): Point2D {
  const rad = degToRad(angleDeg);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const dx = point.x - pivot.x;
  const dy = point.y - pivot.y;

  return {
    x: dx * cos - dy * sin + pivot.x,
    y: dx * sin + dy * cos + pivot.y,
  };
}

/**
 * Per-entity rotation handler. Receives the full `Entity` and narrows internally
 * (mirrors the discriminated-union narrowing the previous `switch` relied on).
 */
type RotateHandler = (entity: Entity, pivot: Point2D, angleDeg: number) => Partial<Entity>;

/** POLYLINE/LWPOLYLINE — rotate all vertices (shared body, previously fall-through). */
const rotatePolylineLike: RotateHandler = (entity, pivot, angleDeg) => {
  const e = entity as Extract<Entity, { type: 'polyline' | 'lwpolyline' }>;
  return { vertices: e.vertices.map((v) => rotatePoint(v, pivot, angleDeg)) };
};

/** RECTANGLE/RECT — rotate origin + accumulate rotation + recompute corners (grip interaction). */
const rotateRectangleLike: RotateHandler = (entity, pivot, angleDeg) => {
  const e = entity as Extract<Entity, { type: 'rectangle' | 'rect' }>;
  const currentRotation = e.rotation ?? 0;
  const origin = rotatePoint({ x: e.x, y: e.y }, pivot, angleDeg);
  const updates: Partial<Entity> = {
    x: origin.x,
    y: origin.y,
    rotation: normalizeAngleDeg(currentRotation + angleDeg),
  };
  if (e.corner1 && e.corner2) {
    updates.corner1 = rotatePoint(e.corner1, pivot, angleDeg);
    updates.corner2 = rotatePoint(e.corner2, pivot, angleDeg);
  }
  return updates;
};

/** TEXT/MTEXT — rotate position + accumulate rotation field (shared body). */
const rotateTextLike: RotateHandler = (entity, pivot, angleDeg) => {
  const e = entity as Extract<Entity, { type: 'text' | 'mtext' }>;
  const currentRotation = e.rotation ?? 0;
  return {
    position: rotatePoint(e.position, pivot, angleDeg),
    rotation: normalizeAngleDeg(currentRotation + angleDeg),
  };
};

/**
 * Introspectable rotation seam (ADR-587 Φ5 — TIER-2 cheap seam). ΕΝΑ type-keyed
 * registry αντί για `switch (entity.type)`, ώστε τα keys να δένονται στο descriptor
 * domain μέσω coverage test (`__tests__/rotate-entity-coverage.test.ts`) — νέος
 * renderable τύπος χωρίς συνειδητή απόφαση rotation → σπάει το build.
 *
 * **Adapter, όχι rewrite** (ADR-587 §4.1): κάθε case έγινε handler με ΤΑΥΤΟΣΗΜΗ math·
 * ζει στο ΙΔΙΟ layer (utils) → μηδέν layering inversion/cycle. Απόντος handler ⇒ ο τύπος
 * ΔΕΝ περιστρέφεται μέσω αυτού του path (BIM/point/dimension/hatch/xline/ray → `{}` no-op,
 * ρητά καρφωμένο στο coverage — per-site default, ADR-587 §4.6).
 */
const ROTATE_HANDLERS: Partial<Record<EntityType, RotateHandler>> = {
  line: (entity, pivot, angleDeg) => {
    const e = entity as Extract<Entity, { type: 'line' }>;
    return {
      start: rotatePoint(e.start, pivot, angleDeg),
      end: rotatePoint(e.end, pivot, angleDeg),
    };
  },
  circle: (entity, pivot, angleDeg) => {
    const e = entity as Extract<Entity, { type: 'circle' }>;
    return { center: rotatePoint(e.center, pivot, angleDeg) };
  },
  arc: (entity, pivot, angleDeg) => {
    const e = entity as Extract<Entity, { type: 'arc' }>;
    return {
      center: rotatePoint(e.center, pivot, angleDeg),
      startAngle: normalizeAngleDeg(e.startAngle + angleDeg),
      endAngle: normalizeAngleDeg(e.endAngle + angleDeg),
    };
  },
  polyline: rotatePolylineLike,
  lwpolyline: rotatePolylineLike,
  rectangle: rotateRectangleLike,
  rect: rotateRectangleLike,
  ellipse: (entity, pivot, angleDeg) => {
    const e = entity as Extract<Entity, { type: 'ellipse' }>;
    const currentRot = e.rotation ?? 0;
    return {
      center: rotatePoint(e.center, pivot, angleDeg),
      rotation: normalizeAngleDeg(currentRot + angleDeg),
    };
  },
  text: rotateTextLike,
  mtext: rotateTextLike,
  // ADR-583 — annotation symbol (North arrow): rotate the insertion point about the
  // pivot + accumulate the glyph rotation (1:1 the text/mtext case). About its own
  // centre (grip pivot = position) the point is fixed and only `rotation` advances.
  'annotation-symbol': (entity, pivot, angleDeg) => {
    const e = entity as typeof entity & { position: Point2D; rotation?: number };
    const currentRotation = e.rotation ?? 0;
    return {
      position: rotatePoint(e.position, pivot, angleDeg),
      rotation: normalizeAngleDeg(currentRotation + angleDeg),
    } as Partial<Entity>;
  },
  'angle-measurement': (entity, pivot, angleDeg) => {
    const e = entity as Extract<Entity, { type: 'angle-measurement' }>;
    // Angle between arms is invariant under rotation — keep original angle value
    return {
      vertex: rotatePoint(e.vertex, pivot, angleDeg),
      point1: rotatePoint(e.point1, pivot, angleDeg),
      point2: rotatePoint(e.point2, pivot, angleDeg),
    };
  },
  spline: (entity, pivot, angleDeg) => {
    const e = entity as Extract<Entity, { type: 'spline' }>;
    return { controlPoints: e.controlPoints.map((v) => rotatePoint(v, pivot, angleDeg)) };
  },
  // ADR-575 — GROUP container: rotating the group rotates every member about the SAME
  // pivot. Recurse the SAME SSoT per member (handles nested groups).
  group: (entity, pivot, angleDeg) => {
    const members = (entity as unknown as { members: Entity[] }).members.map((m) => ({
      ...m,
      ...rotateEntity(m, pivot, angleDeg),
    }));
    return { members } as unknown as Partial<Entity>;
  },
};

/**
 * Types με ρητή rotation υλοποίηση (keys του `ROTATE_HANDLERS`) — δένονται στο
 * descriptor domain μέσω coverage test. Mirror του `POINT_BUILT_TYPES` pattern.
 */
export const ROTATE_SUPPORTED_TYPES: readonly EntityType[] =
  Object.keys(ROTATE_HANDLERS) as EntityType[];

/**
 * Rotate entity geometry around a pivot (ADR-188 §6.2).
 *
 * Returns a partial update object suitable for `sceneManager.updateEntity()`.
 * Dispatches via the introspectable `ROTATE_HANDLERS` seam (ADR-587 Φ5).
 *
 * @param entity   - Entity to rotate (Enterprise Entity type)
 * @param pivot    - Rotation center
 * @param angleDeg - Angle in degrees (positive = CCW)
 * @returns Partial entity update object (`{}` no-op for non-rotatable types)
 */
export function rotateEntity(
  entity: Entity,
  pivot: Point2D,
  angleDeg: number
): Partial<Entity> {
  const handler = ROTATE_HANDLERS[entity.type];
  return handler ? handler(entity, pivot, angleDeg) : {};
}

/**
 * Calculate the angle in degrees from a pivot to a point.
 * Returns value in [0, 360) — useful for mouse-based angle picking.
 *
 * @param pivot - Origin of angle measurement
 * @param point - Target point
 * @returns Angle in degrees [0, 360), measured CCW from positive X-axis
 */
export function angleBetweenPointsDeg(pivot: Point2D, point: Point2D): number {
  const dx = point.x - pivot.x;
  const dy = point.y - pivot.y;
  const rad = Math.atan2(dy, dx);
  return normalizeAngleDeg(rad * (180 / Math.PI));
}
