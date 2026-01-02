/**
 * Bounds Utilities - Union operations για DXF + Overlays
 * Υποστηρίζει fitToView με unified bounds calculation
 *
 * 🏢 ENTERPRISE: Extended with DXF entity bounds calculation
 * Single source of truth for all bounds operations
 */

// ✅ ENTERPRISE FIX: Correct Point2D import path
import type { Point2D } from '../rendering/types/Types';
import type { BaseEntity, SceneModel, SceneBounds } from '../types/scene';

export interface Bounds {
  min: Point2D;
  max: Point2D;
}

/**
 * Υπολογίζει union δύο bounds objects
 */
export function unionBounds(a: Bounds, b: Bounds): Bounds {
  return {
    min: {
      x: Math.min(a.min.x, b.min.x),
      y: Math.min(a.min.y, b.min.y)
    },
    max: {
      x: Math.max(a.max.x, b.max.x),
      y: Math.max(a.max.y, b.max.y)
    }
  };
}

/**
 * Υπολογίζει bounds από overlay regions
 */
export function getOverlayBounds(overlayEntities: any[]): Bounds | null {
  if (!overlayEntities?.length) return null;

  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  for (const entity of overlayEntities) {
    if (entity.vertices) {
      // Polygon/Region entity
      for (const vertex of entity.vertices) {
        minX = Math.min(minX, vertex.x);
        minY = Math.min(minY, vertex.y);
        maxX = Math.max(maxX, vertex.x);
        maxY = Math.max(maxY, vertex.y);
      }
    } else if (entity.bounds) {
      // Entity με ήδη υπολογισμένα bounds
      minX = Math.min(minX, entity.bounds.min.x);
      minY = Math.min(minY, entity.bounds.min.y);
      maxX = Math.max(maxX, entity.bounds.max.x);
      maxY = Math.max(maxY, entity.bounds.max.y);
    }
  }

  if (minX === Infinity) return null;

  return {
    min: { x: minX, y: minY },
    max: { x: maxX, y: maxY }
  };
}

/**
 * Υπολογίζει unified bounds από DXF scene + overlays
 */
export function calculateUnifiedBounds(
  sceneBounds: Bounds | null,
  overlayEntities: any[] = []
): Bounds | null {
  const overlayBounds = getOverlayBounds(overlayEntities);

  if (!sceneBounds && !overlayBounds) return null;
  if (!sceneBounds) return overlayBounds;
  if (!overlayBounds) return sceneBounds;

  return unionBounds(sceneBounds, overlayBounds);
}

// ============================================================================
// 🏢 ENTERPRISE: DXF ENTITY BOUNDS CALCULATION
// ============================================================================
// Centralized bounds calculation for DXF entities
// Extracted from dxf-import.ts for Single Responsibility Principle
// ============================================================================

/**
 * 🏢 ENTERPRISE: Entity type interfaces for bounds calculation
 * Type-safe entity handling without 'any'
 */
interface LineEntityBounds extends BaseEntity {
  type: 'line';
  start: Point2D;
  end: Point2D;
}

interface PolylineEntityBounds extends BaseEntity {
  type: 'polyline';
  vertices: Point2D[];
}

interface CircleEntityBounds extends BaseEntity {
  type: 'circle';
  center: Point2D;
  radius: number;
}

interface ArcEntityBounds extends BaseEntity {
  type: 'arc';
  center: Point2D;
  radius: number;
}

interface TextEntityBounds extends BaseEntity {
  type: 'text';
  position: Point2D;
  text?: string;
  height?: number;
}

interface BlockEntityBounds extends BaseEntity {
  type: 'block';
  position: Point2D;
}

/**
 * 🏢 ENTERPRISE: Calculate tight bounds from DXF scene entities
 *
 * Calculates precise bounds from all entities and normalizes positions
 * so that bottom-left corner is at (0,0).
 *
 * @param scene - The DXF scene model with entities
 * @returns Normalized bounds with bottom-left at (0,0)
 */
export function calculateTightBounds(scene: SceneModel): SceneBounds {
  if (scene.entities.length === 0) {
    return { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  // 🔺 ΒΗΜΑ 1: Εύρεση ΑΚΡΙΒΩΝ bounds (χωρίς κανένα padding)
  scene.entities.forEach((entity) => {
    try {
      const entityBounds = getEntityBounds(entity);
      if (entityBounds) {
        minX = Math.min(minX, entityBounds.min.x);
        minY = Math.min(minY, entityBounds.min.y);
        maxX = Math.max(maxX, entityBounds.max.x);
        maxY = Math.max(maxY, entityBounds.max.y);
      }
    } catch (error) {
      console.warn('Error processing entity bounds:', entity, error);
    }
  });

  if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
    console.warn('Invalid bounds calculated, using defaults');
    return { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } };
  }

  // 🔺 ΒΗΜΑ 2: PERFECT ALIGNMENT OFFSET
  const offsetX = -minX;
  const offsetY = -minY;

  // 🔺 ΒΗΜΑ 3: Εφαρμογή του offset σε ΟΛΕΣ τις οντότητες
  normalizeEntityPositions(scene.entities, offsetX, offsetY);

  // 🔺 ΒΗΜΑ 4: PERFECT TIGHT BOUNDS - ZERO PADDING
  return {
    min: { x: 0, y: 0 },
    max: {
      x: maxX - minX,
      y: maxY - minY
    }
  };
}

/**
 * 🏢 ENTERPRISE: Get bounds for a single entity
 *
 * @param entity - The entity to calculate bounds for
 * @returns Bounds object or null if entity type not supported
 */
export function getEntityBounds(entity: BaseEntity): Bounds | null {
  switch (entity.type) {
    case 'line': {
      const lineEntity = entity as LineEntityBounds;
      if (lineEntity.start && lineEntity.end) {
        return {
          min: {
            x: Math.min(lineEntity.start.x, lineEntity.end.x),
            y: Math.min(lineEntity.start.y, lineEntity.end.y)
          },
          max: {
            x: Math.max(lineEntity.start.x, lineEntity.end.x),
            y: Math.max(lineEntity.start.y, lineEntity.end.y)
          }
        };
      }
      break;
    }

    case 'polyline': {
      const polylineEntity = entity as PolylineEntityBounds;
      if (polylineEntity.vertices && Array.isArray(polylineEntity.vertices)) {
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        polylineEntity.vertices.forEach((vertex: Point2D) => {
          if (vertex.x !== undefined && vertex.y !== undefined) {
            minX = Math.min(minX, vertex.x);
            minY = Math.min(minY, vertex.y);
            maxX = Math.max(maxX, vertex.x);
            maxY = Math.max(maxY, vertex.y);
          }
        });
        if (isFinite(minX)) {
          return { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } };
        }
      }
      break;
    }

    case 'circle':
    case 'arc': {
      const circleEntity = entity as CircleEntityBounds | ArcEntityBounds;
      if (circleEntity.center && circleEntity.radius !== undefined) {
        return {
          min: {
            x: circleEntity.center.x - circleEntity.radius,
            y: circleEntity.center.y - circleEntity.radius
          },
          max: {
            x: circleEntity.center.x + circleEntity.radius,
            y: circleEntity.center.y + circleEntity.radius
          }
        };
      }
      break;
    }

    case 'text': {
      const textEntity = entity as TextEntityBounds;
      if (textEntity.position) {
        const textWidth = (textEntity.text?.length || 5) * (textEntity.height || 10) * 0.7;
        const textHeight = textEntity.height || 10;
        return {
          min: { x: textEntity.position.x, y: textEntity.position.y },
          max: {
            x: textEntity.position.x + textWidth,
            y: textEntity.position.y + textHeight
          }
        };
      }
      break;
    }

    case 'block': {
      const blockEntity = entity as BlockEntityBounds;
      if (blockEntity.position) {
        return {
          min: { x: blockEntity.position.x, y: blockEntity.position.y },
          max: { x: blockEntity.position.x, y: blockEntity.position.y }
        };
      }
      break;
    }
  }

  return null;
}

/**
 * 🏢 ENTERPRISE: Normalize entity positions
 *
 * Applies offset to all entities so that bottom-left corner is at (0,0).
 * Mutates entities in place for performance.
 *
 * @param entities - Array of entities to normalize
 * @param offsetX - X offset to apply
 * @param offsetY - Y offset to apply
 */
export function normalizeEntityPositions(
  entities: BaseEntity[],
  offsetX: number,
  offsetY: number
): void {
  entities.forEach((entity) => {
    try {
      switch (entity.type) {
        case 'line': {
          const lineEnt = entity as LineEntityBounds;
          if (lineEnt.start && lineEnt.end) {
            lineEnt.start.x += offsetX;
            lineEnt.start.y += offsetY;
            lineEnt.end.x += offsetX;
            lineEnt.end.y += offsetY;
          }
          break;
        }

        case 'polyline': {
          const polyEnt = entity as PolylineEntityBounds;
          if (polyEnt.vertices && Array.isArray(polyEnt.vertices)) {
            polyEnt.vertices.forEach((vertex: Point2D) => {
              if (vertex.x !== undefined && vertex.y !== undefined) {
                vertex.x += offsetX;
                vertex.y += offsetY;
              }
            });
          }
          break;
        }

        case 'circle':
        case 'arc': {
          const circEnt = entity as CircleEntityBounds | ArcEntityBounds;
          if (circEnt.center) {
            circEnt.center.x += offsetX;
            circEnt.center.y += offsetY;
          }
          break;
        }

        case 'text': {
          const textEnt = entity as TextEntityBounds;
          if (textEnt.position) {
            textEnt.position.x += offsetX;
            textEnt.position.y += offsetY;
          }
          break;
        }

        case 'block': {
          const blockEnt = entity as BlockEntityBounds;
          if (blockEnt.position) {
            blockEnt.position.x += offsetX;
            blockEnt.position.y += offsetY;
          }
          break;
        }
      }
    } catch (error) {
      console.warn('Error normalizing entity:', entity, error);
    }
  });
}