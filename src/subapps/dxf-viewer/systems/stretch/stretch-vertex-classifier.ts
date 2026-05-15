/**
 * STRETCH VERTEX CLASSIFIER — ADR-349 SSoT
 *
 * Per-entity vertex enumeration. Single source of truth for what counts as a
 * "vertex" per DXF entity type and how to read / write its position.
 *
 * Two complementary modes:
 *   - Vertex-level addressing  → enumerateVertices(entity)  (LINE, POLYLINE, ARC, SPLINE)
 *   - Whole-entity anchor      → getAnchorPoint(entity)     (CIRCLE, ELLIPSE, TEXT, INSERT, POINT)
 *
 * @see ADR-349 §Vertex Classification
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';

// ── Vertex reference (discriminated union) ────────────────────────────────────

export type VertexKind =
  | 'line-start'
  | 'line-end'
  | 'polyline-vertex'
  | 'arc-start'
  | 'arc-mid'
  | 'arc-end'
  | 'spline-cv'
  | 'rectangle-corner';

export interface VertexRef {
  readonly entityId: string;
  readonly kind: VertexKind;
  /** Index for indexed kinds (polyline-vertex, spline-cv, rectangle-corner) */
  readonly index?: number;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the list of addressable vertices for an entity, or [] when the
 * entity is "whole-entity only" (use `getAnchorPoint` instead).
 */
export function enumerateVertices(entity: Entity): VertexRef[] {
  switch (entity.type) {
    case 'line':
      return [
        { entityId: entity.id, kind: 'line-start' },
        { entityId: entity.id, kind: 'line-end' },
      ];
    case 'polyline':
    case 'lwpolyline':
      return entity.vertices.map((_, i) => ({
        entityId: entity.id, kind: 'polyline-vertex' as const, index: i,
      }));
    case 'arc':
      return [
        { entityId: entity.id, kind: 'arc-start' },
        { entityId: entity.id, kind: 'arc-mid' },
        { entityId: entity.id, kind: 'arc-end' },
      ];
    case 'spline':
      return entity.controlPoints.map((_, i) => ({
        entityId: entity.id, kind: 'spline-cv' as const, index: i,
      }));
    case 'rectangle':
    case 'rect':
      return [0, 1, 2, 3].map(i => ({
        entityId: entity.id, kind: 'rectangle-corner' as const, index: i,
      }));
    default:
      return [];
  }
}

/**
 * Returns the anchor point used for whole-entity rigid translation,
 * or null when the entity has its own addressable vertices.
 */
export function getAnchorPoint(entity: Entity): Point2D | null {
  switch (entity.type) {
    case 'circle':
    case 'ellipse':
      return entity.center;
    case 'text':
    case 'mtext':
      return entity.position;
    case 'point':
      return entity.position;
    case 'block':
      return entity.position;
    default:
      return null;
  }
}

/**
 * Reads the current world position of a vertex.
 * Returns null on type/index mismatch.
 */
export function getVertexPosition(entity: Entity, ref: VertexRef): Point2D | null {
  if (ref.entityId !== entity.id) return null;
  switch (ref.kind) {
    case 'line-start':
      return entity.type === 'line' ? entity.start : null;
    case 'line-end':
      return entity.type === 'line' ? entity.end : null;
    case 'polyline-vertex':
      return readPolylineVertex(entity, ref.index);
    case 'arc-start':
      return entity.type === 'arc' ? arcEndpoint(entity, entity.startAngle) : null;
    case 'arc-mid':
      return entity.type === 'arc'
        ? arcEndpoint(entity, (entity.startAngle + entity.endAngle) / 2)
        : null;
    case 'arc-end':
      return entity.type === 'arc' ? arcEndpoint(entity, entity.endAngle) : null;
    case 'spline-cv':
      return readSplineCv(entity, ref.index);
    case 'rectangle-corner':
      return readRectangleCorner(entity, ref.index);
    default:
      return null;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function readPolylineVertex(entity: Entity, index: number | undefined): Point2D | null {
  if (index === undefined) return null;
  if (entity.type !== 'polyline' && entity.type !== 'lwpolyline') return null;
  return entity.vertices[index] ?? null;
}

function readSplineCv(entity: Entity, index: number | undefined): Point2D | null {
  if (index === undefined || entity.type !== 'spline') return null;
  return entity.controlPoints[index] ?? null;
}

function readRectangleCorner(entity: Entity, index: number | undefined): Point2D | null {
  if (index === undefined) return null;
  if (entity.type !== 'rectangle' && entity.type !== 'rect') return null;
  const { x, y, width: w, height: h } = entity;
  switch (index) {
    case 0: return { x, y };
    case 1: return { x: x + w, y };
    case 2: return { x: x + w, y: y + h };
    case 3: return { x, y: y + h };
    default: return null;
  }
}

function arcEndpoint(arc: { center: Point2D; radius: number }, angleRad: number): Point2D {
  return {
    x: arc.center.x + arc.radius * Math.cos(angleRad),
    y: arc.center.y + arc.radius * Math.sin(angleRad),
  };
}
