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
import type { Entity, RectangleEntity } from '../types/entities';
import type { EntityType } from '../types/base-entity';
// 🏢 ADR-067: Centralized angle conversion
import { degToRad, normalizeAngleDeg } from '../rendering/entities/shared/geometry-utils';
// ADR-647 — rotate an imported hatch's preserved pattern def WITH its boundary (SSoT).
import { transformInlinePattern } from '../data/hatch-pattern-catalog';

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

/**
 * RECTANGLE/RECT — canonical rotated-rect model: `corner1/corner2` = γωνίες στο ΤΟΠΙΚΟ (unrotated)
 * frame· η γωνία ζει ΜΟΝΟ στο `rotation` (το vertex SSoT `createRectangleVertices` περιστρέφει γύρω
 * από corner1). Άρα εδώ ο anchor (corner1/origin) ακολουθεί τον pivot και το corner2 **ΜΕΤΑΚΙΝΕΙΤΑΙ
 * (translate) μαζί** — ΔΕΝ περιστρέφεται (αλλιώς double-rotation με τον rotation-aware render).
 * (Μαθηματικά ισοδύναμο με πλήρη περιστροφή του σχήματος — βλ. ADR rotated-rectangle.)
 */
const rotateRectangleLike: RotateHandler = (entity, pivot, angleDeg) => {
  const e = entity as Extract<Entity, { type: 'rectangle' | 'rect' }>;
  const currentRotation = e.rotation ?? 0;
  // `Partial<Entity>` distributes over the union, so the accumulator is typed against the
  // rectangle member (RectEntity is structurally identical for these fields).
  const updates: Partial<RectangleEntity> = {
    rotation: normalizeAngleDeg(currentRotation + angleDeg),
  };
  if (e.corner1 && e.corner2) {
    const c1 = rotatePoint(e.corner1, pivot, angleDeg);
    const dx = c1.x - e.corner1.x;
    const dy = c1.y - e.corner1.y;
    updates.corner1 = c1;
    updates.corner2 = { x: e.corner2.x + dx, y: e.corner2.y + dy };
    updates.x = c1.x;
    updates.y = c1.y;
  } else {
    // x/y/w/h αναπαράσταση (χωρίς corner1/corner2): ο origin {x,y} ακολουθεί τον pivot· w/h αναλλοίωτα.
    const origin = rotatePoint({ x: e.x, y: e.y }, pivot, angleDeg);
    updates.x = origin.x;
    updates.y = origin.y;
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

// Shared point-insertion rotation (ADR-583 annotation-symbol + ADR-640 block INSERT):
// rotate the insertion point about the pivot + accumulate the glyph/placement rotation.
// Both carry a `position` + optional `rotation` and are NOT recursed into (unlike the
// identity GROUP). About their own centre (grip pivot = position) only `rotation` advances.
const rotatePointInsertionLike: RotateHandler = (entity, pivot, angleDeg) => {
  const e = entity as typeof entity & { position: Point2D; rotation?: number };
  const currentRotation = e.rotation ?? 0;
  return {
    position: rotatePoint(e.position, pivot, angleDeg),
    rotation: normalizeAngleDeg(currentRotation + angleDeg),
  } as Partial<Entity>;
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
  // ADR-583 — annotation symbol (North arrow): point-insertion rotation (1:1 text/mtext).
  'annotation-symbol': rotatePointInsertionLike,
  // ADR-640 — BLOCK instance (DXF INSERT): point-insertion rotation (INSERT semantics — the
  // block definition is immutable; local members are NOT recursed, unlike the identity GROUP).
  block: rotatePointInsertionLike,
  // ADR-651 Φάση Ε — standalone raster image: point-insertion rotation about `position`
  // (1:1 annotation-symbol/block — width/height are unaffected by pure rotation).
  image: rotatePointInsertionLike,
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
  // ADR-627 — HATCH: rotate every boundary-ring vertex about the pivot so the fill spins
  // WITH its boundary (+ seed points, pattern origin, and the pattern/gradient angle so the
  // hatching keeps its visual orientation). Previously a test-pinned no-op — this unlocks
  // BOTH the toolbar Rotate tool AND the `hatch-rotation` grip (which route through here via
  // `RotateEntityCommand` / `applyPrimitiveRotationDrag`, exactly like the polyline/area outline).
  hatch: (entity, pivot, angleDeg) => {
    const e = entity as Extract<Entity, { type: 'hatch' }>;
    return {
      boundaryPaths: e.boundaryPaths.map((path) => path.map((v) => rotatePoint(v, pivot, angleDeg))),
      ...(e.seedPoints ? { seedPoints: e.seedPoints.map((v) => rotatePoint(v, pivot, angleDeg)) } : {}),
      ...(e.patternOrigin ? { patternOrigin: rotatePoint(e.patternOrigin, pivot, angleDeg) } : {}),
      ...(e.patternAngle !== undefined ? { patternAngle: normalizeAngleDeg(e.patternAngle + angleDeg) } : {}),
      // ADR-647 — rotate the preserved inlinePattern about the SAME pivot (rotate-only: no scale/translate).
      ...(e.inlinePattern ? { inlinePattern: transformInlinePattern(e.inlinePattern, pivot, 1, 1, angleDeg, pivot) } : {}),
      ...(e.gradient
        ? { gradient: { ...e.gradient, angleDeg: normalizeAngleDeg((e.gradient.angleDeg ?? 0) + angleDeg) } }
        : {}),
    } as Partial<Entity>;
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
