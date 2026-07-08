import type { Entity } from './entities';
import { TEXT_METRICS_RATIOS, TEXT_SIZE_LIMITS } from '../config/text-rendering-config';
import { EMPTY_SPATIAL_BOUNDS } from '../config/geometry-constants';
// ADR-583 — annotative model-size SSoT for the North-arrow annotation symbol.
import { annotationSymbolModelSizeLive } from '../bim/annotation-symbols/annotation-symbol-model-size';
import { DEFAULT_ANNOTATION_SYMBOL_SIZE_MM } from './annotation-symbol';

export type SpatialBounds = { minX: number; minY: number; maxX: number; maxY: number };

// XLINE/RAY render as ±NOMINAL world-units for viewport culling.
// This value is intentionally large — clip-to-viewport (Phase 4.a) limits what
// actually draws on screen. Extents consumers MUST use getEntityExtentsBounds instead.
const RENDER_NOMINAL_EXTENT = 10000;

/** AABB over an array of points; empty → EMPTY_SPATIAL_BOUNDS (SSoT for vertex-based bounds). */
function aabbOf(points: ReadonlyArray<{ x: number; y: number }>): SpatialBounds {
  if (points.length === 0) return EMPTY_SPATIAL_BOUNDS;
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

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
      return 'vertices' in entity && entity.vertices ? aabbOf(entity.vertices) : EMPTY_SPATIAL_BOUNDS;
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
    case 'annotation-symbol': {
      // ADR-583 — annotative square footprint around the insertion point. The paper
      // `sizeMm` is folded to model units at the live drawing scale (same SSoT the
      // renderer uses) so the selection box / zoom-extents track the drawn glyph.
      const modelSize = annotationSymbolModelSizeLive(
        ('sizeMm' in entity && typeof entity.sizeMm === 'number' ? entity.sizeMm : DEFAULT_ANNOTATION_SYMBOL_SIZE_MM),
      );
      const half = modelSize / 2;
      return {
        minX: entity.position.x - half,
        minY: entity.position.y - half,
        maxX: entity.position.x + half,
        maxY: entity.position.y + half,
      };
    }
    case 'text': {
      // ADR-557 — honour the TEXT X-scale (`widthFactor`) so bounds (zoom-to-fit /
      // selection extent) track a horizontally-stretched glyph.
      const textWidthFactor = ('widthFactor' in entity && typeof entity.widthFactor === 'number' && entity.widthFactor > 0)
        ? entity.widthFactor
        : 1;
      const textWidth = entity.text.length * (entity.height || entity.fontSize || 2.5) * TEXT_METRICS_RATIOS.CHAR_WIDTH_MONOSPACE * textWidthFactor;
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
      return 'controlPoints' in entity && entity.controlPoints
        ? aabbOf(entity.controlPoints)
        : EMPTY_SPATIAL_BOUNDS;
    case 'leader':
      return 'vertices' in entity && entity.vertices ? aabbOf(entity.vertices) : EMPTY_SPATIAL_BOUNDS;
    case 'hatch':
      return 'boundaryPaths' in entity && entity.boundaryPaths
        ? aabbOf(entity.boundaryPaths.flat())
        : EMPTY_SPATIAL_BOUNDS;
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
    // ADR-436 — foundation uses pre-computed geometry.bbox for spatial bounds
    // (without this it falls to default → EMPTY bounds → culled in 2D viewport).
    case 'foundation':
    // ADR-406 — MEP fixture uses pre-computed geometry.bbox for spatial bounds.
    case 'mep-fixture':
    // ADR-408 Φ3 — electrical panel uses pre-computed geometry.bbox (same).
    case 'electrical-panel':
    // ADR-408 Φ12 — plumbing manifold uses pre-computed geometry.bbox (same).
    case 'mep-manifold':
    // ADR-408 Εύρος Β — heating radiator uses pre-computed geometry.bbox (same).
    case 'mep-radiator':
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
    // ADR-419 — floor finish uses pre-computed geometry.bbox (same).
    case 'floor-finish':
      if ('geometry' in entity && entity.geometry && entity.geometry.bbox) {
        const { min, max } = entity.geometry.bbox;
        return { minX: min.x, minY: min.y, maxX: max.x, maxY: max.y };
      }
      return EMPTY_SPATIAL_BOUNDS;
    default: {
      if ('vertices' in entity && entity.vertices && Array.isArray(entity.vertices)) {
        return aabbOf(entity.vertices as Array<{ x: number; y: number }>);
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
  // ADR-436 — foundation (pad/strip/tie-beam)
  | 'foundation'
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
  // ADR-408 Εύρος Β — heating radiator
  | 'mep-radiator'
  // ADR-417 — parametric pitched roof
  | 'roof'
  // ADR-419 — floor finish covering polygon
  | 'floor-finish';
