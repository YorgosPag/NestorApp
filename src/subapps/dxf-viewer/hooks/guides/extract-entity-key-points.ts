/**
 * @module extract-entity-key-points
 * @enterprise ADR-189 (B121) — SSOT for "entity → guide-source points"
 *
 * Single canonical mapping from an Entity to the set of Point2D used to seed
 * X/Y construction guides via `guideState.addGuide('X'|'Y', offset)`.
 *
 * Used by the "Create Guides" notification triggered after any entity is
 * completed via `EventBus.emit('drawing:complete', ...)` (ADR-057).
 */
import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';

interface ArcEntityShape {
  center: Point2D;
  radius: number;
  startAngle: number;
  endAngle: number;
  counterclockwise?: boolean;
}

function arcEndpoint(arc: ArcEntityShape, angleDeg: number): Point2D {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: arc.center.x + arc.radius * Math.cos(rad),
    y: arc.center.y + arc.radius * Math.sin(rad),
  };
}

interface RectangleShape {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  corner1?: Point2D;
  corner2?: Point2D;
}

function rectangleCorners(rect: RectangleShape): Point2D[] {
  // Drawing pipeline produces rectangles with corner1/corner2 (see
  // drawing-entity-builders.ts) — x/y/width/height are optional fallbacks.
  if (rect.corner1 && rect.corner2) {
    const { corner1: c1, corner2: c2 } = rect;
    return [c1, { x: c2.x, y: c1.y }, c2, { x: c1.x, y: c2.y }];
  }
  if (
    typeof rect.x === 'number' && typeof rect.y === 'number' &&
    typeof rect.width === 'number' && typeof rect.height === 'number'
  ) {
    return [
      { x: rect.x,              y: rect.y },
      { x: rect.x + rect.width, y: rect.y },
      { x: rect.x + rect.width, y: rect.y + rect.height },
      { x: rect.x,              y: rect.y + rect.height },
    ];
  }
  return [];
}

/**
 * Returns the geometric points that should seed X/Y construction guides for
 * a freshly-drawn entity. Empty array → no notification will be raised.
 */
export function extractEntityKeyPoints(entity: Entity): readonly Point2D[] {
  switch (entity.type) {
    case 'line':
      return [entity.start, entity.end];

    case 'polyline':
    case 'lwpolyline':
      return entity.vertices ?? [];

    case 'circle':
      return [entity.center];

    case 'ellipse':
      return [entity.center];

    case 'arc': {
      const a = entity as unknown as ArcEntityShape;
      return [a.center, arcEndpoint(a, a.startAngle), arcEndpoint(a, a.endAngle)];
    }

    case 'rectangle':
    case 'rect':
      return rectangleCorners(entity);

    case 'text':
    case 'mtext':
      return [entity.position];

    case 'point':
      return [entity.position];

    case 'dimension':
      return [entity.startPoint, entity.endPoint];

    case 'spline':
      return entity.controlPoints ?? [];

    case 'angle-measurement':
    case 'block':
    case 'hatch':
    case 'leader':
    case 'xline':
    case 'ray':
      return [];

    default:
      return [];
  }
}
