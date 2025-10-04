/**
 * Calibration utilities
 * Eliminates duplicate calibration object creation patterns
 */

export interface CalibrationData {
  point1: { screen: { x: number; y: number }, world: { x: number; y: number } };
  point2: { screen: { x: number; y: number }, world: { x: number; y: number } };
  units: string;
  realDistance: number;
}

/**
 * Create default calibration object - eliminates duplicate code
 */
export function createDefaultCalibration(
  units: string,
  realDistance: number
): CalibrationData {
  return {
    point1: { screen: { x: 0, y: 0 }, world: { x: 0, y: 0 } },
    point2: { screen: { x: 100, y: 100 }, world: { x: 100, y: 100 } },
    units,
    realDistance
  };
}