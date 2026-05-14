/**
 * STRETCH ENTITY TRANSFORM — ADR-349 SSoT
 *
 * Single source of truth for applying a displacement vector to addressable
 * vertices (per-entity partial deformation) or to anchor points (rigid move).
 *
 * Phase 1a semantics:
 *   - LINE, POLYLINE/LWPOLYLINE, SPLINE: per-vertex translation
 *   - ARC: rigid center translation only when both endpoints captured;
 *          partial capture is skipped (proper geometric recompute → Phase 1c)
 *   - RECTANGLE/RECT: rigid translation only when all 4 corners captured
 *   - CIRCLE/ELLIPSE/TEXT/MTEXT/INSERT/POINT: anchor-based rigid translation
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
): Partial<SceneEntity> {
  if (capturedRefs.length === 0) return {};

  switch (entity.type) {
    case 'line':
      return stretchLine(entity, capturedRefs, delta);
    case 'polyline':
    case 'lwpolyline':
      return stretchPolyline(entity, capturedRefs, delta);
    case 'spline':
      return stretchSpline(entity, capturedRefs, delta);
    case 'arc':
      return stretchArc(entity, capturedRefs, delta);
    case 'rectangle':
    case 'rect':
      return stretchRectangle(entity, capturedRefs, delta);
    default:
      return {};
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

function stretchArc(
  entity: Entity & { type: 'arc' },
  refs: ReadonlyArray<VertexRef>,
  d: WorldVector,
): Partial<SceneEntity> {
  const hasStart = refs.some(r => r.kind === 'arc-start');
  const hasEnd = refs.some(r => r.kind === 'arc-end');
  // Phase 1a: only rigid translate when both endpoints captured.
  // Partial-capture geometric recompute (bulge-preserving) → Phase 1c.
  if (hasStart && hasEnd) {
    return { center: translatePoint(entity.center, d) } as Partial<SceneEntity>;
  }
  return {};
}

function stretchRectangle(
  entity: Entity & { type: 'rectangle' | 'rect' },
  refs: ReadonlyArray<VertexRef>,
  d: WorldVector,
): Partial<SceneEntity> {
  const cornersCaptured = refs.filter(r => r.kind === 'rectangle-corner').length;
  // Phase 1a: rigid translate only when all 4 corners captured.
  // Partial-capture → would break axis-alignment, defer to Phase 1c (convert to polyline).
  if (cornersCaptured === 4) {
    return { x: entity.x + d.x, y: entity.y + d.y } as Partial<SceneEntity>;
  }
  return {};
}
