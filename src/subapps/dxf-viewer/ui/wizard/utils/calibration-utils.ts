/**
 * Calibration utilities
 * Eliminates duplicate calibration object creation patterns
 */

import type { Point2D } from '../../../rendering/types/Types';

// ✅ ENTERPRISE FIX: Use strict units type instead of string
export interface CalibrationData {
  point1: { screen: Point2D, world: Point2D };
  point2: { screen: Point2D, world: Point2D };
  units: "mm" | "cm" | "m" | "in" | "ft"; // ✅ ENTERPRISE FIX: Match levels config type
  realDistance: number;
}

/**
 * Create default calibration object - eliminates duplicate code
 */
export function createDefaultCalibration(
  units: "mm" | "cm" | "m" | "in" | "ft", // ✅ ENTERPRISE FIX: Strict units type
  realDistance: number
): CalibrationData {
  return {
    point1: { screen: { x: 0, y: 0 }, world: { x: 0, y: 0 } },
    point2: { screen: { x: 100, y: 100 }, world: { x: 100, y: 100 } },
    units,
    realDistance
  };
}