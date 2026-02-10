/**
 * Measurement System Types
 * Unified measurement and ruler system για DXF Viewer
 */

import type { Point2D } from '@/core/canvas/primitives/coordinates';
import { UI_COLORS } from '@/subapps/dxf-viewer/config/color-config';

export type { Point2D } from '@/core/canvas/primitives/coordinates';

// === MEASUREMENT TYPES ===
export type MeasurementType = 'distance' | 'area' | 'angle' | 'radius' | 'perimeter';
export type MeasurementUnit = 'mm' | 'cm' | 'm' | 'in' | 'ft' | 'units';
export type MeasurementPrecision = 0 | 1 | 2 | 3 | 4;

export interface MeasurementPoint {
  id: string;
  position: Point2D;
  worldPosition: Point2D;
  entityId?: string; // Snap to entity
  snapType?: 'endpoint' | 'midpoint' | 'center' | 'intersection' | 'perpendicular';
}

export interface BaseMeasurement {
  id: string;
  type: MeasurementType;
  points: MeasurementPoint[];
  value: number;
  unit: MeasurementUnit;
  precision: MeasurementPrecision;
  label?: string;
  visible: boolean;
  locked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DistanceMeasurement extends BaseMeasurement {
  type: 'distance';
  points: [MeasurementPoint, MeasurementPoint]; // Exactly 2 points
  deltaX: number;
  deltaY: number;
}

export interface AreaMeasurement extends BaseMeasurement {
  type: 'area';
  points: MeasurementPoint[]; // 3+ points for polygon
  perimeter: number;
}

export interface AngleMeasurement extends BaseMeasurement {
  type: 'angle';
  points: [MeasurementPoint, MeasurementPoint, MeasurementPoint]; // vertex, arm1, arm2
  degrees: number;
  radians: number;
}

export interface RadiusMeasurement extends BaseMeasurement {
  type: 'radius';
  points: [MeasurementPoint, MeasurementPoint]; // center, edge
  diameter: number;
}

export interface PerimeterMeasurement extends BaseMeasurement {
  type: 'perimeter';
  points: MeasurementPoint[]; // 2+ points
  segments: number[];
}

export type AnyMeasurement = 
  | DistanceMeasurement 
  | AreaMeasurement 
  | AngleMeasurement 
  | RadiusMeasurement 
  | PerimeterMeasurement;

// === RULER DISPLAY ===
export interface RulerStyle {
  lineColor: string;
  textColor: string;
  backgroundColor: string;
  lineWidth: number;
  fontSize: number;
  arrowSize: number;
  extensionLineLength: number;
  textOffset: number;
  opacity: number;
}

export interface MeasurementState {
  measurements: Record<string, AnyMeasurement>;
  activeMeasurement: string | null;
  isCreating: boolean;
  creatingType: MeasurementType | null;
  tempPoints: MeasurementPoint[];
  showAll: boolean;
  unit: MeasurementUnit;
  precision: MeasurementPrecision;
  style: RulerStyle;
}

// === UTILITY CONSTANTS ===
export const MEASUREMENT_UNITS: Record<MeasurementUnit, { name: string; factor: number, abbreviation: string }> = {
  mm: { name: 'Millimeters', factor: 1, abbreviation: 'mm' },
  cm: { name: 'Centimeters', factor: 10, abbreviation: 'cm' },
  m: { name: 'Meters', factor: 1000, abbreviation: 'm' },
  in: { name: 'Inches', factor: 25.4, abbreviation: '"' },
  ft: { name: 'Feet', factor: 304.8, abbreviation: '\'' },
  units: { name: 'Drawing Units', factor: 1, abbreviation: '' }
};

export const DEFAULT_RULER_STYLE: RulerStyle = {
  lineColor: UI_COLORS.MEASUREMENT_LINE,
  textColor: UI_COLORS.RULER_NEUTRAL_GRAY, // ✅ ENTERPRISE: High contrast light gray instead of pure white
  backgroundColor: UI_COLORS.CANVAS_BACKGROUND,
  lineWidth: 1,
  fontSize: 12,
  arrowSize: 8,
  extensionLineLength: 10,
  textOffset: 5,
  opacity: 0.9
};

