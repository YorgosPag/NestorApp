/**
 * 🔄 AFFINE TRANSFORMATION CALCULATOR
 *
 * Υπολογισμός affine transformation matrix από control points
 *
 * @module floor-plan-system/utils/transformation-calculator
 *
 * Mathematical Background:
 * - Affine transformation: [lng, lat] = [a*x + b*y + c, d*x + e*y + f]
 * - Least-squares solution για over-determined system (3+ points)
 * - RMS error calculation για quality assessment
 *
 * References:
 * - AutoCAD Georeferencing: https://knowledge.autodesk.com/support/autocad
 * - QGIS Georeferencer: https://docs.qgis.org/3.28/en/docs/user_manual/working_with_raster/georeferencer.html
 * - Affine Transformations: https://en.wikipedia.org/wiki/Affine_transformation
 */

import type {
  FloorPlanControlPoint,
  AffineTransformMatrix,
  TransformationResult,
  TransformationOptions
} from '../types';
import { TRANSFORMATION_QUALITY_THRESHOLDS, MIN_CONTROL_POINTS } from '../types';

/**
 * Calculate affine transformation matrix from control points
 *
 * Uses least-squares solution to find best-fit affine transformation
 * that maps floor plan coordinates to geographic coordinates.
 *
 * @param controlPoints - Array of control points (minimum 3)
 * @param options - Transformation options
 * @returns Transformation result with matrix and quality metrics
 *
 * @example
 * ```typescript
 * const result = calculateAffineTransformation(controlPoints);
 * if (result.success && result.matrix) {
 *   const [lng, lat] = transformPoint(100, 200, result.matrix);
 * }
 * ```
 */
export function calculateAffineTransformation(
  controlPoints: FloorPlanControlPoint[],
  options: TransformationOptions = {}
): TransformationResult {
  console.log('🔄 Calculating affine transformation...', {
    pointCount: controlPoints.length,
    options
  });

  // ===================================================================
  // VALIDATION
  // ===================================================================

  if (controlPoints.length < MIN_CONTROL_POINTS) {
    return {
      success: false,
      error: `Insufficient control points. Need at least ${MIN_CONTROL_POINTS}, got ${controlPoints.length}`
    };
  }

  // ===================================================================
  // LEAST-SQUARES SOLUTION
  // ===================================================================

  try {
    // Build system of linear equations: A * x = b
    // For each control point: lng = a*x + b*y + c, lat = d*x + e*y + f

    const n = controlPoints.length;

    // Coefficient matrix A (2n x 6) - stacked for both equations
    const A: number[][] = [];
    // Result vector b (2n x 1)
    const b: number[] = [];

    for (const point of controlPoints) {
      const { floor, geo } = point;

      if (!floor || !geo) {
        console.warn('⚠️ Skipping incomplete control point:', point);
        continue;
      }

      // Equation 1: lng = a*x + b*y + c
      A.push([floor.x, floor.y, 1, 0, 0, 0]);
      b.push(geo.lng);

      // Equation 2: lat = d*x + e*y + f
      A.push([0, 0, 0, floor.x, floor.y, 1]);
      b.push(geo.lat);
    }

    // Solve: A^T * A * x = A^T * b (normal equations)
    const AtA = multiplyMatrixTranspose(A);
    const Atb = multiplyMatrixVectorTranspose(A, b);
    const solution = solveLinearSystem(AtA, Atb);

    if (!solution) {
      return {
        success: false,
        error: 'Failed to solve linear system. Control points may be collinear.'
      };
    }

    // Extract transformation parameters
    const matrix: AffineTransformMatrix = {
      a: solution[0],
      b: solution[1],
      c: solution[2],
      d: solution[3],
      e: solution[4],
      f: solution[5]
    };

    console.log('✅ Transformation matrix calculated:', matrix);

    // ===================================================================
    // QUALITY ASSESSMENT
    // ===================================================================

    const qualityMetrics = calculateQualityMetrics(controlPoints, matrix);

    return {
      success: true,
      matrix,
      ...qualityMetrics
    };

  } catch (error) {
    console.error('❌ Transformation calculation failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Calculate quality metrics (RMS error, residuals, etc.)
 */
function calculateQualityMetrics(
  controlPoints: FloorPlanControlPoint[],
  matrix: AffineTransformMatrix
): Omit<TransformationResult, 'success' | 'matrix' | 'error'> {
  const residuals: number[] = [];
  let sumSquaredError = 0;

  for (const point of controlPoints) {
    const { floor, geo } = point;

    if (!floor || !geo) {
      console.warn('⚠️ Skipping incomplete control point in quality calculation:', point);
      continue;
    }

    // Transform floor plan point using matrix
    const [predictedLng, predictedLat] = transformPoint(
      floor.x,
      floor.y,
      matrix
    );

    // Calculate residual error (Euclidean distance in geographic coords)
    // Convert to meters using approximate conversion
    const deltaLng = (predictedLng - geo.lng) * 111320 * Math.cos(geo.lat * Math.PI / 180);
    const deltaLat = (predictedLat - geo.lat) * 110540;
    const residual = Math.sqrt(deltaLng * deltaLng + deltaLat * deltaLat);

    residuals.push(residual);
    sumSquaredError += residual * residual;
  }

  // RMS error
  const rmsError = Math.sqrt(sumSquaredError / controlPoints.length);

  // Max error
  const maxError = Math.max(...residuals);

  // Mean error
  const meanError = residuals.reduce((a, b) => a + b, 0) / residuals.length;

  // Quality grade
  let quality: 'excellent' | 'good' | 'fair' | 'poor';
  if (rmsError < TRANSFORMATION_QUALITY_THRESHOLDS.excellent) {
    quality = 'excellent';
  } else if (rmsError < TRANSFORMATION_QUALITY_THRESHOLDS.good) {
    quality = 'good';
  } else if (rmsError < TRANSFORMATION_QUALITY_THRESHOLDS.fair) {
    quality = 'fair';
  } else {
    quality = 'poor';
  }

  console.log('📊 Quality metrics:', {
    rmsError: `${rmsError.toFixed(2)}m`,
    maxError: `${maxError.toFixed(2)}m`,
    meanError: `${meanError.toFixed(2)}m`,
    quality
  });

  return {
    rmsError,
    maxError,
    meanError,
    quality,
    residuals
  };
}

/**
 * Transform a point using affine matrix
 *
 * @param x - Floor plan X coordinate
 * @param y - Floor plan Y coordinate
 * @param matrix - Affine transformation matrix
 * @returns [longitude, latitude]
 */
export function transformPoint(
  x: number,
  y: number,
  matrix: AffineTransformMatrix
): [number, number] {
  const lng = matrix.a * x + matrix.b * y + matrix.c;
  const lat = matrix.d * x + matrix.e * y + matrix.f;
  return [lng, lat];
}

/**
 * Inverse transform (geo → floor plan)
 *
 * @param lng - Longitude
 * @param lat - Latitude
 * @param matrix - Affine transformation matrix
 * @returns [x, y] floor plan coordinates
 */
export function inverseTransformPoint(
  lng: number,
  lat: number,
  matrix: AffineTransformMatrix
): [number, number] {
  // Solve inverse: [x, y] = M^-1 * [lng - c, lat - f]
  const det = matrix.a * matrix.e - matrix.b * matrix.d;

  if (Math.abs(det) < 1e-10) {
    console.warn('⚠️ Matrix is singular, inverse transformation may be inaccurate');
    return [0, 0];
  }

  const dx = lng - matrix.c;
  const dy = lat - matrix.f;

  const x = (matrix.e * dx - matrix.b * dy) / det;
  const y = (-matrix.d * dx + matrix.a * dy) / det;

  return [x, y];
}

// ===================================================================
// LINEAR ALGEBRA UTILITIES
// ===================================================================

/**
 * Multiply A^T * A (matrix transpose times matrix)
 */
function multiplyMatrixTranspose(A: number[][]): number[][] {
  const rows = A[0].length;
  const result: number[][] = Array(rows).fill(0).map(() => Array(rows).fill(0));

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < rows; j++) {
      let sum = 0;
      for (let k = 0; k < A.length; k++) {
        sum += A[k][i] * A[k][j];
      }
      result[i][j] = sum;
    }
  }

  return result;
}

/**
 * Multiply A^T * b (matrix transpose times vector)
 */
function multiplyMatrixVectorTranspose(A: number[][], b: number[]): number[] {
  const cols = A[0].length;
  const result: number[] = Array(cols).fill(0);

  for (let i = 0; i < cols; i++) {
    let sum = 0;
    for (let j = 0; j < A.length; j++) {
      sum += A[j][i] * b[j];
    }
    result[i] = sum;
  }

  return result;
}

/**
 * Solve linear system A * x = b using Gaussian elimination
 *
 * @param A - Coefficient matrix (n x n)
 * @param b - Result vector (n x 1)
 * @returns Solution vector x, or null if singular
 */
function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = A.length;

  // Create augmented matrix [A | b]
  const augmented: number[][] = A.map((row, i) => [...row, b[i]]);

  // Forward elimination
  for (let i = 0; i < n; i++) {
    // Find pivot
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
        maxRow = k;
      }
    }

    // Swap rows
    [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];

    // Check for singular matrix
    if (Math.abs(augmented[i][i]) < 1e-10) {
      console.error('❌ Singular matrix detected');
      return null;
    }

    // Eliminate column
    for (let k = i + 1; k < n; k++) {
      const factor = augmented[k][i] / augmented[i][i];
      for (let j = i; j <= n; j++) {
        augmented[k][j] -= factor * augmented[i][j];
      }
    }
  }

  // Back substitution
  const x: number[] = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = augmented[i][n];
    for (let j = i + 1; j < n; j++) {
      x[i] -= augmented[i][j] * x[j];
    }
    x[i] /= augmented[i][i];
  }

  return x;
}

/**
 * Export for convenience
 */
export default calculateAffineTransformation;
