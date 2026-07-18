/**
 * STRETCH ENTITY TRANSFORM — ADR-349 SSoT
 *
 * Single source of truth for applying a displacement vector to addressable
 * vertices (per-entity partial deformation) or to anchor points (rigid move).
 *
 * Phase 1c-B3 semantics:
 *   - LINE / POLYLINE / LWPOLYLINE / SPLINE: per-vertex translation
 *   - ARC:
 *       both endpoints captured  → rigid center translation
 *       single endpoint captured → bulge-preserving recompute (center / radius
 *                                  / start+end angles), keeping signed sweep
 *       arc-mid captured         → 3-point circumcircle through new midpoint
 *   - RECTANGLE / RECT:
 *       all 4 corners captured   → rigid x/y translation (axis-aligned)
 *       1-3 corners captured     → coerce to closed polyline (4 vertices,
 *                                  same id), translate captured indices
 *   - CIRCLE / ELLIPSE / TEXT / MTEXT / INSERT / POINT: anchor-based rigid move
 *     via {@link translateEntityByAnchor}
 *
 * @see ADR-349 §Core Mathematics
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import type { SceneEntity } from '../../core/commands/interfaces';
import type { VertexRef } from './stretch-vertex-classifier';
import { arcFromMovedEndpoint, arcFrom3Points } from '../../rendering/entities/shared/geometry-arc-utils';
import { degToRad } from '../../rendering/entities/shared/geometry-angle-utils';
import { translatePoint } from '../../rendering/entities/shared/geometry-vector-utils';
// SSoT convergence — canonical rigid-move geometry (handles every entity type incl. lwpolyline/BIM/group).
import { calculateMovedGeometry } from '../../core/commands/entity-commands/move-entity-geometry';
// ADR-620/513 — SSoT rectangle→4-vertex projection (corner1/corner2 OR x/y/w/h + rotation), the SAME
// order the grips + main-canvas projection + the reshape ghost use → commit ≡ ghost by construction.
import { rectangleEntityVertices } from '../../rendering/entities/shared/geometry-utils';

export interface WorldVector {
  readonly x: number;
  readonly y: number;
}

/**
 * Result of `applyVertexDisplacement` — discriminated union so the math layer
 * can request either an in-place geometry update OR a wholesale entity
 * replacement (used for rectangle → polyline coercion on partial capture).
 */
export type StretchUpdate =
  | { readonly kind: 'noop' }
  | { readonly kind: 'update'; readonly updates: Partial<SceneEntity> }
  | { readonly kind: 'replace'; readonly entity: SceneEntity };

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Rigid translate an entity by `delta` (whole-entity move).
 *
 * SSoT convergence (ADR-397/561): delegates to the canonical rigid-move geometry SSoT
 * `calculateMovedGeometry` — the ONE source that translates ANY entity (DXF primitives +
 * `lwpolyline` + BIM params + GROUP recursion). This used to be a poorer duplicate `switch`
 * that silently no-op'd line / polyline / lwpolyline / BIM / group, which broke the
 * directional move-by-value handle on JOINed (lwpolyline) entities. Kept as a thin adapter
 * so the `StretchEntityCommand` call sites stay stable.
 */
export function translateEntityByAnchor(entity: Entity, delta: WorldVector): Partial<SceneEntity> {
  return calculateMovedGeometry(entity as unknown as SceneEntity, { x: delta.x, y: delta.y, z: 0 });
}

/**
 * Apply per-vertex deformation. `capturedRefs` lists the vertices of this entity
 * that fall inside the crossing window(s); only those vertices receive `delta`.
 */
export function applyVertexDisplacement(
  entity: Entity,
  capturedRefs: ReadonlyArray<VertexRef>,
  delta: WorldVector,
): StretchUpdate {
  if (capturedRefs.length === 0) return { kind: 'noop' };

  switch (entity.type) {
    case 'line':
      return wrapUpdate(stretchLine(entity, capturedRefs, delta));
    case 'polyline':
    case 'lwpolyline':
      return wrapUpdate(stretchPolyline(entity, capturedRefs, delta));
    case 'spline':
      return wrapUpdate(stretchSpline(entity, capturedRefs, delta));
    case 'arc':
      return wrapUpdate(stretchArc(entity, capturedRefs, delta));
    case 'rectangle':
    case 'rect':
      return stretchRectangle(entity, capturedRefs, delta);
    case 'circle':
      return wrapUpdate(stretchCircle(entity, capturedRefs, delta));
    default:
      return { kind: 'noop' };
  }
}

// ── Per-entity stretchers ─────────────────────────────────────────────────────

function stretchLine(
  entity: Entity & { type: 'line' },
  refs: ReadonlyArray<VertexRef>,
  d: WorldVector,
): Partial<SceneEntity> {
  const hasStart = refs.some(r => r.kind === 'line-start');
  const hasEnd = refs.some(r => r.kind === 'line-end');
  if (!hasStart && !hasEnd) return {};
  return {
    start: hasStart ? translatePoint(entity.start, d) : entity.start,
    end: hasEnd ? translatePoint(entity.end, d) : entity.end,
  } as Partial<SceneEntity>;
}

function stretchPolyline(
  entity: Entity & { type: 'polyline' | 'lwpolyline' },
  refs: ReadonlyArray<VertexRef>,
  d: WorldVector,
): Partial<SceneEntity> {
  const movedIndices = new Set<number>();
  for (const r of refs) {
    if (r.kind === 'polyline-vertex' && r.index !== undefined) movedIndices.add(r.index);
  }
  if (movedIndices.size === 0) return {};
  const vertices = entity.vertices.map((v, i) =>
    movedIndices.has(i) ? translatePoint(v, d) : v,
  );
  return { vertices } as Partial<SceneEntity>;
}

function stretchSpline(
  entity: Entity & { type: 'spline' },
  refs: ReadonlyArray<VertexRef>,
  d: WorldVector,
): Partial<SceneEntity> {
  const movedIndices = new Set<number>();
  for (const r of refs) {
    if (r.kind === 'spline-cv' && r.index !== undefined) movedIndices.add(r.index);
  }
  if (movedIndices.size === 0) return {};
  const controlPoints = entity.controlPoints.map((v, i) =>
    movedIndices.has(i) ? translatePoint(v, d) : v,
  );
  return { controlPoints } as Partial<SceneEntity>;
}

/**
 * Arc stretch — handles three capture configurations (Phase 1c-B3):
 *   - both endpoints       → rigid center translation
 *   - single endpoint      → bulge-preserving recompute (signed sweep kept)
 *   - midpoint             → 3-point circumcircle through new midpoint
 *
 * Returns `{}` for degenerate geometry (zero chord, zero/full sweep, collinear
 * 3 points) — the caller treats `{}` as a no-op.
 */
function stretchArc(
  entity: Entity & { type: 'arc' },
  refs: ReadonlyArray<VertexRef>,
  d: WorldVector,
): Partial<SceneEntity> {
  const hasStart = refs.some(r => r.kind === 'arc-start');
  const hasEnd = refs.some(r => r.kind === 'arc-end');
  const hasMid = refs.some(r => r.kind === 'arc-mid');

  if (hasStart && hasEnd) {
    // Both endpoints in the same window → rigid translate
    return { center: translatePoint(entity.center, d) } as Partial<SceneEntity>;
  }

  if (hasStart || hasEnd) {
    return stretchArcSingleEndpoint(entity, hasStart ? 'arc-start' : 'arc-end', d);
  }

  if (hasMid) {
    return stretchArcMidpoint(entity, d);
  }

  return {};
}

/**
 * Single-endpoint arc reshape — delegates to the SSoT `arcFromMovedEndpoint`
 * (`geometry-arc-utils.ts`), the SAME bulge-preserving recompute the 3D live ghost uses
 * (preview ≡ commit). Angles are DEGREES (matching `ArcEntity` / the DXF scene).
 */
function stretchArcSingleEndpoint(
  arc: Entity & { type: 'arc' },
  movedKind: 'arc-start' | 'arc-end',
  d: WorldVector,
): Partial<SceneEntity> {
  const next = arcFromMovedEndpoint(arc, movedKind === 'arc-start' ? 'start' : 'end', d.x, d.y);
  return (next ?? {}) as Partial<SceneEntity>;
}

/**
 * Arc-midpoint reshape — 3-point circumcircle through the dragged (visible) midpoint,
 * delegating to the SSoT `arcFrom3Points` (degrees + direction). The original midpoint is
 * the angular average of start/end; the cursor displaces it.
 */
function stretchArcMidpoint(
  arc: Entity & { type: 'arc' },
  d: WorldVector,
): Partial<SceneEntity> {
  const pStart = arcPointDeg(arc, arc.startAngle);
  const pEnd = arcPointDeg(arc, arc.endAngle);
  const pMidNew = translatePoint(arcPointDeg(arc, (arc.startAngle + arc.endAngle) / 2), d);
  const next = arcFrom3Points(pStart, pMidNew, pEnd);
  if (!next) return {};                                // collinear → degenerate
  return {
    center: next.center,
    radius: next.radius,
    startAngle: next.startAngle,
    endAngle: next.endAngle,
    counterclockwise: next.counterclockwise,
  } as Partial<SceneEntity>;
}

/**
 * Rectangle stretch — Phase 1c-B3:
 *   - all 4 corners captured  → rigid x/y translation (axis-aligned)
 *   - 1–3 corners captured    → coerce to closed polyline (4 vertices, same id)
 *                                with captured indices translated
 *   - 0 captured              → noop
 *
 * The polyline coercion preserves the entity id so selection and references
 * remain valid; the StretchEntityCommand replaces the entity wholesale.
 */
function stretchRectangle(
  entity: Entity & { type: 'rectangle' | 'rect' },
  refs: ReadonlyArray<VertexRef>,
  d: WorldVector,
): StretchUpdate {
  const captured = new Set<number>();
  for (const r of refs) {
    if (r.kind === 'rectangle-corner' && r.index !== undefined) captured.add(r.index);
  }
  if (captured.size === 0) return { kind: 'noop' };

  // ADR-620/513 — derive the 4 corners via the SSoT that handles BOTH representations
  // (`corner1/corner2` from the drawing tool + rotation, OR legacy `x/y/w/h`) in the SAME
  // vertex ORDER the grips + main-canvas projection use. Reading `entity.x/width` directly gave
  // `undefined → NaN` for a freshly-drawn rectangle → the reshaped entity vanished on drop
  // (Giorgio 2026-07-18). Degenerate rect (NaN) → noop (mirror `rectangleEntityVertices` intent).
  const corners = rectangleEntityVertices(entity);
  if (corners.some((c) => !Number.isFinite(c.x) || !Number.isFinite(c.y))) return { kind: 'noop' };

  if (captured.size === 4) {
    // Rigid translate keeping the rectangle representation. corner1/corner2 (drawn/rotated) →
    // translate both anchors; legacy x/y/w/h → translate the x/y origin. Either keeps it a rectangle.
    if (entity.corner1 && entity.corner2) {
      return { kind: 'update', updates: {
        corner1: translatePoint(entity.corner1, d),
        corner2: translatePoint(entity.corner2, d),
      } as Partial<SceneEntity> };
    }
    return { kind: 'update', updates: translatePoint({ x: entity.x, y: entity.y }, d) as Partial<SceneEntity> };
  }

  // Partial capture → coerce to polyline preserving id, layer, visibility, etc.
  const newVertices = corners.map((c, i) => (captured.has(i) ? translatePoint(c, d) : c));

  // ADR-358 Phase 9D-5a: id-only WRITE — legacy `layer` field dropped (schema flip deferred to 9D-5b).
  const replacement = {
    id: entity.id,
    layerId: entity.layerId,
    visible: entity.visible,
    type: 'polyline' as const,
    vertices: newVertices,
    closed: true,
  } as unknown as SceneEntity;

  return { kind: 'replace', entity: replacement };
}

/**
 * Circle stretch — a captured quadrant grip resizes the circle so the new
 * grip position lies on the circumference. Center is preserved (rigid move
 * of a circle goes through {@link translateEntityByAnchor} via the center
 * grip / `anchorMoves`, not through quadrant capture).
 *
 * Multi-quadrant capture (geometrically over-constrained) is resolved by
 * averaging the resulting radii — pragmatic and stable under crossing-window
 * stretch, where 2-3 quadrants may fall inside the window.
 */
function stretchCircle(
  entity: Entity & { type: 'circle' },
  refs: ReadonlyArray<VertexRef>,
  d: WorldVector,
): Partial<SceneEntity> {
  const captured: number[] = [];
  for (const r of refs) {
    if (r.kind === 'circle-quadrant' && r.index !== undefined) captured.push(r.index);
  }
  if (captured.length === 0) return {};

  const oldQuadrants: Point2D[] = [
    { x: entity.center.x + entity.radius, y: entity.center.y },
    { x: entity.center.x,                 y: entity.center.y + entity.radius },
    { x: entity.center.x - entity.radius, y: entity.center.y },
    { x: entity.center.x,                 y: entity.center.y - entity.radius },
  ];

  let radiusSum = 0;
  for (const i of captured) {
    const newPos = translatePoint(oldQuadrants[i], d);
    radiusSum += Math.hypot(newPos.x - entity.center.x, newPos.y - entity.center.y);
  }
  const newRadius = radiusSum / captured.length;
  if (newRadius < 1e-9) return {};

  return { radius: newRadius } as Partial<SceneEntity>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function wrapUpdate(updates: Partial<SceneEntity>): StretchUpdate {
  return Object.keys(updates).length === 0
    ? { kind: 'noop' }
    : { kind: 'update', updates };
}

/** Point on an arc at `angleDeg` (DEGREES) — angles are stored in degrees on `ArcEntity`. */
function arcPointDeg(arc: { center: Point2D; radius: number }, angleDeg: number): Point2D {
  const a = degToRad(angleDeg);
  return {
    x: arc.center.x + arc.radius * Math.cos(a),
    y: arc.center.y + arc.radius * Math.sin(a),
  };
}
