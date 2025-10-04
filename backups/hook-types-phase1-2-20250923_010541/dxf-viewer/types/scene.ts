import { Point2D } from './shared';

// Re-export Point2D for convenience
export { Point2D };

export interface SceneEntity {
  id: string;
  type: 'line' | 'polyline' | 'circle' | 'arc' | 'text' | 'block' | 'rectangle' | 'angle-measurement';
  layer: string;
  color?: string;
  lineweight?: number;
  visible: boolean;
  name?: string;
}

export interface LineEntity extends SceneEntity {
  type: 'line';
  start: Point2D;
  end: Point2D;
}

export interface PolylineEntity extends SceneEntity {
  type: 'polyline';
  vertices: Point2D[];
  closed: boolean;
}

export interface CircleEntity extends SceneEntity {
  type: 'circle';
  center: Point2D;
  radius: number;
}

export interface ArcEntity extends SceneEntity {
  type: 'arc';
  center: Point2D;
  radius: number;
  startAngle: number;
  endAngle: number;
}

export interface TextEntity extends SceneEntity {
  type: 'text';
  position: Point2D;
  text: string;
  height: number;
  rotation?: number;
}

export interface BlockEntity extends SceneEntity {
  type: 'block';
  name: string;
  position: Point2D;
  scale: Point2D;
  rotation: number;
  entities: SceneEntity[];
}

export interface RectangleEntity extends SceneEntity {
  type: 'rectangle';
  corner1: Point2D;
  corner2: Point2D;
  rotation?: number;
}

export interface AngleMeasurementEntity extends SceneEntity {
  type: 'angle-measurement';
  vertex: Point2D; // Center point of the angle
  point1: Point2D; // First arm endpoint
  point2: Point2D; // Second arm endpoint
  angle: number; // Angle in degrees
}

export type AnySceneEntity = LineEntity | PolylineEntity | CircleEntity | ArcEntity | TextEntity | BlockEntity | RectangleEntity | AngleMeasurementEntity;

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
