/**
 * Measurement types for DXF Viewer
 * Enterprise-grade measurement system
 */

import type { Point2D } from '../rendering/types/Types';

export interface BaseMeasurement {
  id: string;
  type: string;
  points: Point2D[];
  label?: string;
  color?: string;
  visible?: boolean;
  precision?: number;
}

export interface LinearMeasurement extends BaseMeasurement {
  type: 'linear';
  length: number;
  angle?: number;
}

export interface AngularMeasurement extends BaseMeasurement {
  type: 'angular';
  angle: number;
  startAngle?: number;
  endAngle?: number;
  radius?: number;
}

export interface AreaMeasurement extends BaseMeasurement {
  type: 'area';
  area: number;
  perimeter?: number;
}

export interface RadialMeasurement extends BaseMeasurement {
  type: 'radial';
  radius: number;
  center: Point2D;
}

export interface DiameterMeasurement extends BaseMeasurement {
  type: 'diameter';
  diameter: number;
  center: Point2D;
}

// ✅ ENTERPRISE FIX: Add MeasurementType for useToolbarState compatibility
export type MeasurementType = 'linear' | 'angular' | 'area' | 'radial' | 'diameter';

// Union type for all measurement types
export type AnyMeasurement =
  | LinearMeasurement
  | AngularMeasurement
  | AreaMeasurement
  | RadialMeasurement
  | DiameterMeasurement;

// Default measurement settings
export const DEFAULT_MEASUREMENT_SETTINGS = {
  precision: 2,
  color: '#00ff00',
  visible: true,
} as const;