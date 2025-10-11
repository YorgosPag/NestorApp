/**
 * 🔄 FLOOR PLAN TRANSFORMATION - TYPE DEFINITIONS
 *
 * Types για affine transformation και georeferencing
 *
 * @module floor-plan-system/types/transformation
 */

import type { FloorPlanControlPoint } from './control-points';

/**
 * 2D Affine Transformation Matrix
 *
 * Transforms local floor plan coordinates to geographic coordinates:
 * [lng, lat] = [a*x + b*y + c, d*x + e*y + f]
 *
 * Matrix representation:
 * | a  b  c |
 * | d  e  f |
 * | 0  0  1 |
 */
export interface AffineTransformMatrix {
  /** X scale/rotation component */
  a: number;
  /** Y skew/rotation component */
  b: number;
  /** X translation (longitude offset) */
  c: number;
  /** X skew/rotation component */
  d: number;
  /** Y scale/rotation component */
  e: number;
  /** Y translation (latitude offset) */
  f: number;
}

/**
 * Transformation calculation result
 */
export interface TransformationResult {
  /** Success status */
  success: boolean;
  /** Transformation matrix (if successful) */
  matrix?: AffineTransformMatrix;
  /** Root Mean Square Error (meters) */
  rmsError?: number;
  /** Maximum residual error (meters) */
  maxError?: number;
  /** Mean error (meters) */
  meanError?: number;
  /** Quality grade */
  quality?: 'excellent' | 'good' | 'fair' | 'poor';
  /** Per-point residual errors (meters) */
  residuals?: number[];
  /** Error message (if failed) */
  error?: string;
}

/**
 * Transformation quality thresholds (meters)
 */
export const TRANSFORMATION_QUALITY_THRESHOLDS = {
  excellent: 1.0,   // < 1m RMS error
  good: 5.0,        // < 5m RMS error
  fair: 10.0,       // < 10m RMS error
  poor: Infinity    // >= 10m RMS error
} as const;

/**
 * Minimum control points required
 */
export const MIN_CONTROL_POINTS = 3;

/**
 * Transformation method
 */
export type TransformationMethod = 'affine' | 'polynomial' | 'tps';

/**
 * Transformation options
 */
export interface TransformationOptions {
  /** Transformation method (default: affine) */
  method?: TransformationMethod;
  /** Enable robust estimation (RANSAC) */
  robust?: boolean;
  /** RANSAC threshold (meters) */
  ransacThreshold?: number;
  /** Maximum iterations for RANSAC */
  maxIterations?: number;
}

/**
 * Coordinate transformation utilities
 */
export interface CoordinateTransformer {
  /** Transform floor plan coord → geo coord */
  transformPoint: (x: number, y: number) => [number, number];
  /** Transform geo coord → floor plan coord (inverse) */
  inverseTransformPoint: (lng: number, lat: number) => [number, number];
  /** Get transformation matrix */
  getMatrix: () => AffineTransformMatrix;
  /** Get transformation quality metrics */
  getQuality: () => TransformationResult;
}
