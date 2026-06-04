import type { Entity } from './entities';
import { TEXT_METRICS_RATIOS, TEXT_SIZE_LIMITS } from '../config/text-rendering-config';
import { EMPTY_SPATIAL_BOUNDS } from '../config/geometry-constants';

export type SpatialBounds = { minX: number; minY: number; maxX: number; maxY: number };

// XLINE/RAY render as ±NOMINAL world-units for viewport culling.
// This value is intentionally large — clip-to-viewport (Phase 4.a) limits what
// actually draws on screen. Extents consumers MUST use getEntityExtentsBounds instead.
const RENDER_NOMINAL_EXTENT = 10000;

function computeBounds(entity: Entity, forExtents: boolean): SpatialBounds {
  switch (entity.type) {
    case 'line':
      return {
        minX: Math.min(entity.start.x, entity.end.x),
        minY: Math.min(entity.start.y, entity.end.y),
        maxX: Math.max(entity.start.x, entity.end.x),
        maxY: Math.max(entity.start.y, entity.end.y),
      };
    case 'polyline':
    case 'lwpolyline':
      if ('vertices' in entity && entity.vertices && entity.vertices.length > 0) {
        const xs = entity.vertices.map(v => v.x);
        const ys = entity.vertices.map(v => v.y);
        return {
          minX: Math.min(...xs),
          minY: Math.min(...ys),
          maxX: Math.max(...xs),
          maxY: Math.max(...ys),
        };
      }
      return EMPTY_SPATIAL_BOUNDS;
    case 'circle':
      return {
        minX: entity.center.x - entity.radius,
        minY: entity.center.y - entity.radius,
        maxX: entity.center.x + entity.radius,
        maxY: entity.center.y + entity.radius,
      };
    case 'ellipse': {
      const maxAxisRadius = Math.max(entity.majorAxis, entity.minorAxis);
      return {
        minX: entity.center.x - maxAxisRadius,
        minY: entity.center.y - maxAxisRadius,
        maxX: entity.center.x + maxAxisRadius,
        maxY: entity.center.y + maxAxisRadius,
      };
    }
    case 'rectangle':
    case 'rect':
      return {
        minX: entity.x,
        minY: entity.y,
        maxX: entity.x + entity.width,
        maxY: entity.y + entity.height,
      };
    case 'point':
      return {
        minX: entity.position.x,
        minY: entity.position.y,
        maxX: entity.position.x,
        maxY: entity.position.y,
      };
    case 'text': {
      const textWidth = entity.text.length * (entity.height || entity.fontSize || 2.5) * TEXT_METRICS_RATIOS.CHAR_WIDTH_MONOSPACE;
      const textHeight = entity.height || entity.fontSize || 2.5;
      return {
        minX: entity.position.x,
        minY: entity.position.y - textHeight,
        maxX: entity.position.x + textWidth,
        maxY: entity.position.y,
      };
    }
    case 'mtext': {
      const mtextHeight = entity.height || (entity.fontSize || TEXT_SIZE_LIMITS.DEFAULT_FONT_SIZE);
      return {
        minX: entity.position.x,
        minY: entity.position.y - mtextHeight,
        maxX: entity.position.x + entity.width,
        maxY: entity.position.y,
      };
    }
    case 'spline':
      if ('controlPoints' in entity && entity.controlPoints && entity.controlPoints.length > 0) {
        const xs = entity.controlPoints.map(p => p.x);
        const ys = entity.controlPoints.map(p => p.y);
        return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
      }
      return EMPTY_SPATIAL_BOUNDS;
    case 'leader':
      if ('vertices' in entity && entity.vertices && entity.vertices.length > 0) {
        const xs = entity.vertices.map(v => v.x);
        const ys = entity.vertices.map(v => v.y);
        return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
      }
      return EMPTY_SPATIAL_BOUNDS;
    case 'hatch':
      if ('boundaryPaths' in entity && entity.boundaryPaths && entity.boundaryPaths.length > 0) {
        const allPoints = entity.boundaryPaths.flat();
        if (allPoints.length > 0) {
          const xs = allPoints.map(p => p.x);
          const ys = allPoints.map(p => p.y);
          return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
        }
      }
      return EMPTY_SPATIAL_BOUNDS;
    case 'xline':
      if (forExtents) return EMPTY_SPATIAL_BOUNDS;
      if ('basePoint' in entity && entity.basePoint) {
        return {
          minX: entity.basePoint.x - RENDER_NOMINAL_EXTENT,
          minY: entity.basePoint.y - RENDER_NOMINAL_EXTENT,
          maxX: entity.basePoint.x + RENDER_NOMINAL_EXTENT,
          maxY: entity.basePoint.y + RENDER_NOMINAL_EXTENT,
        };
      }
      return EMPTY_SPATIAL_BOUNDS;
    case 'ray':
      if (forExtents) return EMPTY_SPATIAL_BOUNDS;
      if ('basePoint' in entity && entity.basePoint) {
        const dirX = entity.direction?.x ?? 1;
        const dirY = entity.direction?.y ?? 0;
        return {
          minX: Math.min(entity.basePoint.x, entity.basePoint.x + dirX * RENDER_NOMINAL_EXTENT),
          minY: Math.min(entity.basePoint.y, entity.basePoint.y + dirY * RENDER_NOMINAL_EXTENT),
          maxX: Math.max(entity.basePoint.x, entity.basePoint.x + dirX * RENDER_NOMINAL_EXTENT),
          maxY: Math.max(entity.basePoint.y, entity.basePoint.y + dirY * RENDER_NOMINAL_EXTENT),
        };
      }
      return EMPTY_SPATIAL_BOUNDS;
    case 'stair':
    case 'wall':
    case 'opening':
    case 'slab':
    case 'slab-opening':
    case 'column':
    case 'beam':
    // ADR-406 — MEP fixture uses pre-computed geometry.bbox for spatial bounds.
    case 'mep-fixture':
    // ADR-408 Φ3 — electrical panel uses pre-computed geometry.bbox (same).
    case 'electrical-panel':
    // ADR-408 Φ12 — plumbing manifold uses pre-computed geometry.bbox (same).
    case 'mep-manifold':
    // ADR-410 — furniture uses pre-computed geometry.bbox (same).
    case 'furniture':
    // ADR-408 Φ8 — MEP segment uses pre-computed geometry.bbox (same).
    case 'mep-segment':
    // ADR-408 Φ11 — MEP fitting uses pre-computed geometry.bbox (same).
    case 'mep-fitting':
    // ADR-415 — floorplan symbol uses pre-computed geometry.bbox (same).
    case 'floorplan-symbol':
    // ADR-417 — roof uses pre-computed geometry.bbox (same).
    case 'roof':
      if ('geometry' in entity && entity.geometry && entity.geometry.bbox) {
        const { min, max } = entity.geometry.bbox;
        return { minX: min.x, minY: min.y, maxX: max.x, maxY: max.y };
      }
      return EMPTY_SPATIAL_BOUNDS;
    default: {
      if ('vertices' in entity && entity.vertices && Array.isArray(entity.vertices) && entity.vertices.length > 0) {
        const vertices = entity.vertices as Array<{ x: number; y: number }>;
        const xs = vertices.map(v => v.x);
        const ys = vertices.map(v => v.y);
        return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
      }
      return EMPTY_SPATIAL_BOUNDS;
    }
  }
}

/** For render culling: XLINE/RAY use NOMINAL_EXTENT so they appear across the viewport. */
export const getEntityRenderBounds = (entity: Entity): SpatialBounds =>
  computeBounds(entity, false);

/** For zoom-to-extents: XLINE/RAY return empty bounds — infinite lines must not affect zoom. */
export const getEntityExtentsBounds = (entity: Entity): SpatialBounds =>
  computeBounds(entity, true);

/** @deprecated Use getEntityRenderBounds (rendering) or getEntityExtentsBounds (zoom). */
export const getEntityBounds = getEntityRenderBounds;

/**
 * Union of BIM entity type strings that use pre-computed `geometry.bbox` for
 * spatial bounds. Used for type-narrowing in downstream consumers.
 * Mirror of the `case 'electrical-panel':` / `case 'mep-manifold':` branch.
 */
export type BimEntityWithBounds =
  | 'wall' | 'opening' | 'slab' | 'slab-opening' | 'column' | 'beam' | 'stair'
  // ADR-406 — MEP fixture
  | 'mep-fixture'
  // ADR-408 Φ3 — electrical panel
  | 'electrical-panel'
  // ADR-410 — furniture
  | 'furniture'
  // ADR-408 Φ8 — MEP segment
  | 'mep-segment'
  // ADR-408 Φ11 — MEP fitting
  | 'mep-fitting'
  // ADR-415 — floorplan symbol
  | 'floorplan-symbol'
  // ADR-408 Φ12 — plumbing manifold
  | 'mep-manifold'
  // ADR-417 — parametric pitched roof
  | 'roof';
