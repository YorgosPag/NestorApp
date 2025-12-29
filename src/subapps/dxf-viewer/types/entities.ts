/**
 * Core Entity Types for DXF Viewer
 * Provides type safety for all entity operations
 */

import type { Point2D } from '../rendering/types/Types';

// Base entity interface
export interface BaseEntity {
  id: string;
  type: EntityType;
  layer?: string;
  color?: string;
  selected?: boolean;
  preview?: boolean;
  measurement?: boolean;
  isOverlayPreview?: boolean;
  showPreviewGrips?: boolean;
  previewGripPoints?: Point2D[];
  visible?: boolean;
  locked?: boolean;
  metadata?: Record<string, unknown>;

  // Line styling properties (CAD Standard)
  lineweight?: number;        // Line thickness (ISO 128 standard)
  opacity?: number;           // 0.0 to 1.0
  lineType?: 'solid' | 'dashed' | 'dotted' | 'dashdot';  // Line pattern
  dashScale?: number;         // Dash pattern scale factor
  lineCap?: 'butt' | 'round' | 'square';  // Line cap style
  lineJoin?: 'miter' | 'round' | 'bevel'; // Line join style
  dashOffset?: number;        // Dash pattern offset

  // Preview/Completion flags
  breakAtCenter?: boolean;    // Split line at center for distance label
  showEdgeDistances?: boolean; // Show distance labels on preview
}

// Supported entity types
export type EntityType =
  | 'line'
  | 'polyline'
  | 'circle'
  | 'arc'
  | 'text'
  | 'rectangle'
  | 'point'
  | 'dimension'
  | 'block'
  | 'angle-measurement';

// Geometric entities
export interface LineEntity extends BaseEntity {
  type: 'line';
  start: Point2D;
  end: Point2D;
  lineWidth?: number;
  lineStyle?: string;
}

export interface PolylineEntity extends BaseEntity {
  type: 'polyline';
  vertices: Point2D[];
  closed?: boolean;
  lineWidth?: number;
  lineStyle?: string;
}

export interface CircleEntity extends BaseEntity {
  type: 'circle';
  center: Point2D;
  radius: number;
  fillColor?: string;
  strokeWidth?: number;
}

export interface ArcEntity extends BaseEntity {
  type: 'arc';
  center: Point2D;
  radius: number;
  startAngle: number;
  endAngle: number;
  strokeWidth?: number;
}

export interface RectangleEntity extends BaseEntity {
  type: 'rectangle';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  fillColor?: string;
  strokeWidth?: number;
}

export interface PointEntity extends BaseEntity {
  type: 'point';
  position: Point2D;
  size?: number;
  style?: 'dot' | 'cross' | 'plus' | 'circle';
}

export interface TextEntity extends BaseEntity {
  type: 'text';
  position: Point2D;
  text: string;
  fontSize?: number;
  fontFamily?: string;
  alignment?: 'left' | 'center' | 'right';
  rotation?: number;
}

export interface DimensionEntity extends BaseEntity {
  type: 'dimension';
  startPoint: Point2D;
  endPoint: Point2D;
  textPosition: Point2D;
  value: number;
  unit?: string;
  precision?: number;
}

// ✅ ENTERPRISE: Additional entity types from scene.ts integration
export interface BlockEntity extends BaseEntity {
  type: 'block';
  name: string;
  position: Point2D;
  scale: Point2D;
  rotation: number;
  entities: Entity[];
}

export interface AngleMeasurementEntity extends BaseEntity {
  type: 'angle-measurement';
  vertex: Point2D; // Center point of the angle
  point1: Point2D; // First arm endpoint
  point2: Point2D; // Second arm endpoint
  angle: number; // Angle in degrees
}

// Union type for all entities
export type Entity =
  | LineEntity
  | PolylineEntity
  | CircleEntity
  | ArcEntity
  | RectangleEntity
  | PointEntity
  | TextEntity
  | DimensionEntity
  | BlockEntity
  | AngleMeasurementEntity;

// Entity collection types
export interface EntityCollection {
  entities: Entity[];
  bounds?: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  layers: string[];
  metadata?: Record<string, unknown>;
}

// Entity creation helpers
export type CreateEntityParams<T extends Entity> = Omit<T, 'id'> & {
  id?: string;
};

// Entity update helpers
export type UpdateEntityParams<T extends Entity> = Partial<T> & {
  id: string;
};

// Entity query helpers
export interface EntityQuery {
  type?: EntityType | EntityType[];
  layer?: string | string[];
  selected?: boolean;
  visible?: boolean;
  bounds?: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
}

// Entity validation
export interface EntityValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

// Type guards
export const isLineEntity = (entity: Entity): entity is LineEntity =>
  entity.type === 'line';

export const isPolylineEntity = (entity: Entity): entity is PolylineEntity =>
  entity.type === 'polyline';

export const isCircleEntity = (entity: Entity): entity is CircleEntity =>
  entity.type === 'circle';

export const isArcEntity = (entity: Entity): entity is ArcEntity =>
  entity.type === 'arc';

export const isRectangleEntity = (entity: Entity): entity is RectangleEntity =>
  entity.type === 'rectangle';

export const isPointEntity = (entity: Entity): entity is PointEntity =>
  entity.type === 'point';

export const isTextEntity = (entity: Entity): entity is TextEntity =>
  entity.type === 'text';

export const isDimensionEntity = (entity: Entity): entity is DimensionEntity =>
  entity.type === 'dimension';

export const isBlockEntity = (entity: Entity): entity is BlockEntity =>
  entity.type === 'block';

export const isAngleMeasurementEntity = (entity: Entity): entity is AngleMeasurementEntity =>
  entity.type === 'angle-measurement';

// ✅ ENTERPRISE MIGRATION: generateEntityId moved to systems/entity-creation/utils.ts
// Re-export from centralized location for backward compatibility
export { generateEntityId } from '../systems/entity-creation/utils';

export const getEntityBounds = (entity: Entity): { minX: number; minY: number; maxX: number; maxY: number } => {
  switch (entity.type) {
    case 'line':
      return {
        minX: Math.min(entity.start.x, entity.end.x),
        minY: Math.min(entity.start.y, entity.end.y),
        maxX: Math.max(entity.start.x, entity.end.x),
        maxY: Math.max(entity.start.y, entity.end.y)
      };
    case 'circle':
      return {
        minX: entity.center.x - entity.radius,
        minY: entity.center.y - entity.radius,
        maxX: entity.center.x + entity.radius,
        maxY: entity.center.y + entity.radius
      };
    case 'rectangle':
      return {
        minX: entity.x,
        minY: entity.y,
        maxX: entity.x + entity.width,
        maxY: entity.y + entity.height
      };
    case 'point':
      return {
        minX: entity.position.x,
        minY: entity.position.y,
        maxX: entity.position.x,
        maxY: entity.position.y
      };
    case 'text':
      // Simple approximation - actual bounds would need font metrics
      const textWidth = entity.text.length * (entity.fontSize || 12) * 0.6;
      const textHeight = entity.fontSize || 12;
      return {
        minX: entity.position.x,
        minY: entity.position.y - textHeight,
        maxX: entity.position.x + textWidth,
        maxY: entity.position.y
      };
    default:
      // For polyline and other complex shapes, calculate from vertices
      if ('vertices' in entity && entity.vertices) {
        const xs = entity.vertices.map(v => v.x);
        const ys = entity.vertices.map(v => v.y);
        return {
          minX: Math.min(...xs),
          minY: Math.min(...ys),
          maxX: Math.max(...xs),
          maxY: Math.max(...ys)
        };
      }
      return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }
};

// ============================================================================
// 🔄 SCENE MANAGEMENT TYPES - Unified from scene.ts
// ============================================================================
// ✅ ENTERPRISE: Scene-specific types integrated for complete entity system

export type AnySceneEntity = Entity; // ✅ UNIFIED: Now alias to main Entity type

// ✅ ENTERPRISE: Legacy compatibility aliases
export type EntityModel = BaseEntity; // ✅ LEGACY: For rendering system compatibility

export interface SceneLayer {
  name: string;
  color: string;
  visible: boolean;
  locked: boolean;
}

export interface SceneBounds {
  min: Point2D;
  max: Point2D;
}

export interface SceneModel {
  entities: AnySceneEntity[];
  layers: Record<string, SceneLayer>;
  bounds: SceneBounds;
  units: 'mm' | 'cm' | 'm' | 'in' | 'ft';
}

export interface DxfImportResult {
  success: boolean;
  scene?: SceneModel;
  error?: string;
  warnings?: string[];
  stats: {
    entityCount: number;
    layerCount: number;
    parseTimeMs: number;
  };
}