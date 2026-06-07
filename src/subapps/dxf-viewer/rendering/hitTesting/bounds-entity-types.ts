/**
 * BOUNDS ENTITY TYPES — Internal property interfaces for Bounds.ts
 * Entity-specific type interfaces and intersection aliases used for
 * safe type-casting during bounding-box computation.
 */

import type { EntityModel, Point2D } from '../types/Types';
import type { DxfTextNode } from '../../text-engine/types';

// 🏢 ENTERPRISE: Entity-specific type interfaces for safe type casting
export interface LineEntityProperties {
  start: Point2D;
  end: Point2D;
}

export interface CircleEntityProperties {
  center: Point2D;
  radius: number;
}

export interface PolylineEntityProperties {
  vertices: Point2D[];
  points?: Point2D[];
}

export interface EllipseEntityProperties {
  center: Point2D;
  radiusX: number;
  radiusY: number;
}

export interface TextEntityProperties {
  position: Point2D;
  text: string;
  textNode?: DxfTextNode;
  fontSize?: number;
  height?: number;      // 🏢 DXF text height (primary property from DXF parser)
  rotation?: number;    // 🏢 DXF text rotation in degrees (for rotated AABB)
}

export interface SplineEntityProperties {
  controlPoints?: Point2D[];
  vertices?: Point2D[];
}

export interface PointEntityProperties {
  position: Point2D;
}

export interface AngleMeasurementEntityProperties {
  vertex: Point2D;
  point1: Point2D;
  point2: Point2D;
}

// 🏢 ENTERPRISE: Type guard helpers
export type EntityWithLine = EntityModel & LineEntityProperties;
export type EntityWithCircle = EntityModel & CircleEntityProperties;
export type EntityWithPolyline = EntityModel & PolylineEntityProperties;
export type EntityWithEllipse = EntityModel & EllipseEntityProperties;
export type EntityWithText = EntityModel & TextEntityProperties;
export type EntityWithSpline = EntityModel & SplineEntityProperties;
export type EntityWithPoint = EntityModel & PointEntityProperties;
export type EntityWithAngleMeasurement = EntityModel & AngleMeasurementEntityProperties;
