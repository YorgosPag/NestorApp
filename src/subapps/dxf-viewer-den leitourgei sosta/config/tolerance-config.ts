/**
 * TOLERANCE CONFIGURATION
 * Central configuration for all tolerance and precision settings
 */

// Basic tolerance settings (in pixels, unless stated otherwise)
export const TOLERANCE_CONFIG = {
  // Selection tolerances
  SELECTION_DEFAULT: 8,     // Default selection tolerance
  SELECTION_MIN: 2,         // Minimum selection tolerance
  SELECTION_MAX: 20,        // Maximum selection tolerance
  
  // Snap tolerances  
  SNAP_DEFAULT: 10,         // Default snap tolerance in pixels
  SNAP_PRECISION: 1e-10,    // High-precision snap tolerance (geometric calculations)
  
  // Hit testing
  HIT_TEST_DEFAULT: 8,      // Default hit test tolerance
  HIT_TEST_RADIUS: 12,      // Hit test radius for visual elements
  
  // Grips and handles
  GRIP_APERTURE: 8,         // Default grip aperture size
  VERTEX_HANDLE_SIZE: 8,    // Size of vertex handles for editing
  
  // Calibration
  CALIBRATION: 2.0,         // Calibration tolerance for precise measurements
  
  // Geometry precision
  POLYLINE_PRECISION: 0.01, // Precision for polyline rendering
  
  // Marquee and lasso
  MARQUEE_MIN_SIZE: 3,      // Minimum pixels for valid marquee selection
  LASSO_MIN_POINTS: 3,      // Minimum points for valid lasso selection
} as const;

// Hover tolerances (scaled by zoom)
export interface HoverToleranceConfig {
  basePixels: number;
  scaleWithZoom: boolean;
}

export const HOVER_TOLERANCE_CONFIG: HoverToleranceConfig = {
  basePixels: 5,
  scaleWithZoom: true,
};

// Export convenient aliases for backward compatibility
export const DEFAULT_TOLERANCE = TOLERANCE_CONFIG.SELECTION_DEFAULT;
export const SNAP_TOLERANCE = TOLERANCE_CONFIG.SNAP_DEFAULT;
export const HIT_TEST_RADIUS_PX = TOLERANCE_CONFIG.HIT_TEST_RADIUS;
export const CALIB_TOLERANCE_PX = TOLERANCE_CONFIG.CALIBRATION;
export const VERTEX_HANDLE_SIZE = TOLERANCE_CONFIG.VERTEX_HANDLE_SIZE;
export const MIN_POLY_POINTS = 3;
export const MIN_POLY_AREA = 0.05;

// Utility function to convert tolerance based on zoom scale
export const getScaledTolerance = (baseTolerance: number, scale: number): number => {
  return baseTolerance / scale;
};