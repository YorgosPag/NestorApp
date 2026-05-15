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

export function translatePoint(p: Point2D, d: WorldVector): Point2D {
  return { x: p.x + d.x, y: p.y + d.y };
}

/**
 * Rigid translate an entity by `delta` using its anchor point.
 * Used for CIRCLE / ELLIPSE / TEXT / MTEXT / INSERT / POINT.
 */
export function translateEntityByAnchor(entity: Entity, delta: WorldVector): Partial<SceneEntity> {
  switch (entity.type) {
    case 'circle':
    case 'ellipse':
      return { center: translatePoint(entity.center, delta) } as Partial<SceneEntity>;
    case 'text':
    case 'mtext':
      return { position: translatePoint(entity.position, delta) } as Partial<SceneEntity>;
    case 'point':
      return { position: translatePoint(entity.position, delta) } as Partial<SceneEntity>;
    case 'block':
      return { position: translatePoint(entity.position, delta) } as Partial<SceneEntity>;
    default:
      return {};
  }
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

function stretchArcSingleEndpoint(
  arc: Entity & { type: 'arc' },
  movedKind: 'arc-start' | 'arc-end',
  d: WorldVector,
): Partial<SceneEntity> {
  const pStartOld = arcEndpoint(arc, arc.startAngle);
  const pEndOld = arcEndpoint(arc, arc.endAngle);
  const pStartNew = movedKind === 'arc-start' ? translatePoint(pStartOld, d) : pStartOld;
  const pEndNew = movedKind === 'arc-end' ? translatePoint(pEndOld, d) : pEndOld;

  const theta = arc.endAngle - arc.startAngle;        // signed sweep
  if (Math.abs(theta) < 1e-9) return {};               // degenerate
  if (Math.abs(theta) >= 2 * Math.PI - 1e-9) return {}; // full circle

  const vx = pEndNew.x - pStartNew.x;
  const vy = pEndNew.y - pStartNew.y;
  const L = Math.hypot(vx, vy);
  if (L < 1e-9) return {};                             // chord collapsed

  const halfAbs = Math.abs(theta) / 2;
  const sinHalf = Math.sin(halfAbs);
  if (sinHalf < 1e-9) return {};

  const newRadius = L / (2 * sinHalf);

  // Side selection: keep the original geometric side of the center relative
  // to the chord (preserves bulge convention regardless of CW/CCW).
  const oldChordX = pEndOld.x - pStartOld.x;
  const oldChordY = pEndOld.y - pStartOld.y;
  const oldOffsetX = arc.center.x - pStartOld.x;
  const oldOffsetY = arc.center.y - pStartOld.y;
  const oldCross = oldChordX * oldOffsetY - oldChordY * oldOffsetX;
  const side = oldCross >= 0 ? 1 : -1;

  // Distance from new chord midpoint to new center.
  const halfChordSq = (L / 2) * (L / 2);
  const distSq = newRadius * newRadius - halfChordSq;
  const dist = distSq > 0 ? Math.sqrt(distSq) : 0;

  // Left perpendicular to (vx, vy) is (-vy, vx); flip with `side`.
  const perpX = -vy / L;
  const perpY = vx / L;
  const mx = (pStartNew.x + pEndNew.x) / 2;
  const my = (pStartNew.y + pEndNew.y) / 2;
  const newCenter: Point2D = {
    x: mx + side * dist * perpX,
    y: my + side * dist * perpY,
  };

  const newStart = Math.atan2(pStartNew.y - newCenter.y, pStartNew.x - newCenter.x);
  let newEnd = Math.atan2(pEndNew.y - newCenter.y, pEndNew.x - newCenter.x);
  // Preserve signed sweep (atan2 collapses to (-π, π] so we may need to wrap).
  let sweep = newEnd - newStart;
  if (theta > 0 && sweep < 0) sweep += 2 * Math.PI;
  else if (theta < 0 && sweep > 0) sweep -= 2 * Math.PI;
  newEnd = newStart + sweep;

  return {
    center: newCenter,
    radius: newRadius,
    startAngle: newStart,
    endAngle: newEnd,
  } as Partial<SceneEntity>;
}

function stretchArcMidpoint(
  arc: Entity & { type: 'arc' },
  d: WorldVector,
): Partial<SceneEntity> {
  const pStart = arcEndpoint(arc, arc.startAngle);
  const pEnd = arcEndpoint(arc, arc.endAngle);
  const pMidOld = arcEndpoint(arc, (arc.startAngle + arc.endAngle) / 2);
  const pMidNew = translatePoint(pMidOld, d);

  const theta = arc.endAngle - arc.startAngle;
  if (Math.abs(theta) < 1e-9) return {};

  const newCenter = circumcenter(pStart, pMidNew, pEnd);
  if (!newCenter) return {};                           // collinear → degenerate
  const newRadius = Math.hypot(pStart.x - newCenter.x, pStart.y - newCenter.y);
  if (newRadius < 1e-9) return {};

  const newStart = Math.atan2(pStart.y - newCenter.y, pStart.x - newCenter.x);
  let newEnd = Math.atan2(pEnd.y - newCenter.y, pEnd.x - newCenter.x);
  let sweep = newEnd - newStart;
  if (theta > 0 && sweep < 0) sweep += 2 * Math.PI;
  else if (theta < 0 && sweep > 0) sweep -= 2 * Math.PI;
  newEnd = newStart + sweep;

  return {
    center: newCenter,
    radius: newRadius,
    startAngle: newStart,
    endAngle: newEnd,
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

  if (captured.size === 4) {
    return { kind: 'update', updates: { x: entity.x + d.x, y: entity.y + d.y } as Partial<SceneEntity> };
  }

  // Partial capture → coerce to polyline preserving id, layer, visibility, etc.
  const corners: Point2D[] = [
    { x: entity.x,                y: entity.y },
    { x: entity.x + entity.width, y: entity.y },
    { x: entity.x + entity.width, y: entity.y + entity.height },
    { x: entity.x,                y: entity.y + entity.height },
  ];
  const newVertices = corners.map((c, i) => (captured.has(i) ? translatePoint(c, d) : c));

  const replacement = {
    id: entity.id,
    layer: entity.layer,
    visible: entity.visible,
    type: 'polyline' as const,
    vertices: newVertices,
    closed: true,
  } as unknown as SceneEntity;

  return { kind: 'replace', entity: replacement };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function wrapUpdate(updates: Partial<SceneEntity>): StretchUpdate {
  return Object.keys(updates).length === 0
    ? { kind: 'noop' }
    : { kind: 'update', updates };
}

function arcEndpoint(arc: { center: Point2D; radius: number }, angleRad: number): Point2D {
  return {
    x: arc.center.x + arc.radius * Math.cos(angleRad),
    y: arc.center.y + arc.radius * Math.sin(angleRad),
  };
}

/**
 * Circumcenter of three points. Returns null when the three points are
 * collinear (denominator → 0), which is the only degenerate case for a
 * 3-point circle.
 */
function circumcenter(a: Point2D, b: Point2D, c: Point2D): Point2D | null {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < 1e-12) return null;
  const aSq = a.x * a.x + a.y * a.y;
  const bSq = b.x * b.x + b.y * b.y;
  const cSq = c.x * c.x + c.y * c.y;
  const ux = (aSq * (b.y - c.y) + bSq * (c.y - a.y) + cSq * (a.y - b.y)) / d;
  const uy = (aSq * (c.x - b.x) + bSq * (a.x - c.x) + cSq * (b.x - a.x)) / d;
  return { x: ux, y: uy };
}
