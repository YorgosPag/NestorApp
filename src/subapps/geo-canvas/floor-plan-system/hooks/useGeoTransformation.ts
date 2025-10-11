/**
 * 🔄 USE GEO TRANSFORMATION HOOK
 *
 * Custom hook για automatic transformation calculation από control points
 *
 * @module floor-plan-system/hooks/useGeoTransformation
 *
 * Features:
 * - Auto-recalculation όταν αλλάζουν τα control points
 * - Transformation matrix computation
 * - Quality metrics
 * - Point transformation utilities
 * - Caching για performance
 *
 * Workflow:
 * 1. User adds control points (via useFloorPlanControlPoints)
 * 2. Hook auto-calculates transformation when points >= 3
 * 3. Returns matrix + transform functions
 * 4. Canvas layer uses transformation για rendering
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  FloorPlanControlPoint,
  AffineTransformMatrix,
  TransformationResult,
  TransformationOptions,
  CoordinateTransformer
} from '../types';
import {
  calculateAffineTransformation,
  transformPoint as transformPointUtil,
  inverseTransformPoint as inverseTransformPointUtil
} from '../utils/transformation-calculator';
import { MIN_CONTROL_POINTS } from '../types';

// ===================================================================
// CONSTANTS
// ===================================================================

/**
 * Empty transformation options (frozen for stable reference)
 *
 * ❗ CRITICAL: Χρησιμοποιείται για να αποφευχθεί το infinite loop
 * που προκαλείται από το `transformOptions = {}` destructuring
 */
const EMPTY_TRANSFORM_OPTIONS: TransformationOptions = Object.freeze({});

// ===================================================================
// INTERFACES
// ===================================================================

/**
 * Hook state interface
 */
export interface UseGeoTransformationState {
  /** Transformation result */
  result: TransformationResult | null;
  /** Is transformation valid (success + matrix exists) */
  isValid: boolean;
  /** Is calculating */
  isCalculating: boolean;
  /** Transformation matrix (shortcut) */
  matrix: AffineTransformMatrix | null;
  /** RMS error (meters) */
  rmsError: number | null;
  /** Quality grade */
  quality: 'excellent' | 'good' | 'fair' | 'poor' | null;
}

/**
 * Hook actions interface
 */
export interface UseGeoTransformationActions {
  /** Manually trigger recalculation */
  recalculate: () => void;
  /** Transform floor plan point → geo point */
  transformPoint: (x: number, y: number) => [number, number] | null;
  /** Transform geo point → floor plan point (inverse) */
  inverseTransformPoint: (lng: number, lat: number) => [number, number] | null;
  /** Get coordinate transformer utility */
  getTransformer: () => CoordinateTransformer | null;
}

/**
 * Hook return type
 */
export type UseGeoTransformationReturn = UseGeoTransformationState & UseGeoTransformationActions;

/**
 * Hook options
 */
export interface UseGeoTransformationOptions {
  /** Transformation options */
  transformOptions?: TransformationOptions;
  /** Auto-recalculate on control point changes (default: true) */
  autoRecalculate?: boolean;
  /** Enable debug logging (default: false) */
  debug?: boolean;
}

/**
 * useGeoTransformation Hook
 *
 * Auto-calculates affine transformation από control points
 *
 * @param controlPoints - Array of control points
 * @param options - Hook options
 * @returns Hook state and actions
 *
 * @example
 * ```typescript
 * const controlPoints = useFloorPlanControlPoints();
 * const transformation = useGeoTransformation(controlPoints.points);
 *
 * if (transformation.isValid && transformation.matrix) {
 *   const [lng, lat] = transformation.transformPoint(100, 200);
 * }
 * ```
 */
// ===================================================================
// DEEP EQUALITY HELPERS (ChatGPT-5 PATCH 3)
// ===================================================================

const EPS = 1e-9;

function eq(a?: number, b?: number): boolean {
  return a === b || (a != null && b != null && Math.abs(a - b) < EPS);
}

function eqMatrix(m1: AffineTransformMatrix | null | undefined, m2: AffineTransformMatrix | null | undefined): boolean {
  if (!m1 && !m2) return true;
  if (!m1 || !m2) return false;
  return eq(m1.a, m2.a) && eq(m1.b, m2.b) && eq(m1.c, m2.c) &&
         eq(m1.d, m2.d) && eq(m1.e, m2.e) && eq(m1.f, m2.f);
}

function equalTransform(prev: TransformationResult | null, next: TransformationResult): boolean {
  return eqMatrix(prev?.matrix, next.matrix) && eq(prev?.rmsError, next.rmsError);
}

// ===================================================================
// HOOK
// ===================================================================

export function useGeoTransformation(
  controlPoints: FloorPlanControlPoint[],
  options: UseGeoTransformationOptions = {}
): UseGeoTransformationReturn {
  // ===================================================================
  // STABLE OPTIONS (ChatGPT-5 ROOT FIX)
  // ===================================================================

  /**
   * ❗ CRITICAL: Memoize transformOptions to prevent infinite loop
   *
   * Το `transformOptions = {}` destructuring δημιουργεί νέο object σε κάθε render.
   * Αυτό προκαλεί re-run του useEffect → setState → infinite loop.
   *
   * Λύση: useMemo για σταθερό reference
   */
  const tfOpts = useMemo(
    () => options.transformOptions ?? EMPTY_TRANSFORM_OPTIONS,
    [options.transformOptions]
  );

  const autoRecalculate = options.autoRecalculate ?? true;
  const debug = options.debug ?? false;

  // ===================================================================
  // STABLE DEPS (ChatGPT-5 PATCH 1)
  // ===================================================================

  const pointsKey = useMemo(
    () =>
      controlPoints
        // μόνο πλήρη ζεύγη
        .filter(p => p.floor && p.geo)
        .map(p => `${p.floor!.x},${p.floor!.y},${p.geo!.lng},${p.geo!.lat}`)
        .join('|'),
    [controlPoints]
  );

  // ===================================================================
  // STATE
  // ===================================================================

  const [result, setResult] = useState<TransformationResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // ===================================================================
  // COMPUTED STATE
  // ===================================================================

  const isValid = useMemo(() => {
    return result?.success === true && result.matrix != null;
  }, [result]);

  const matrix = useMemo(() => {
    return result?.matrix || null;
  }, [result]);

  const rmsError = useMemo(() => {
    return result?.rmsError || null;
  }, [result]);

  const quality = useMemo(() => {
    return result?.quality || null;
  }, [result]);

  // ===================================================================
  // TRANSFORMATION CALCULATION
  // ===================================================================

  /**
   * Calculate transformation
   */
  const calculate = useCallback(() => {
    if (debug) {
      console.log('🔄 useGeoTransformation: Calculating...', {
        pointCount: controlPoints.length,
        minRequired: MIN_CONTROL_POINTS
      });
    }

    if (controlPoints.length < MIN_CONTROL_POINTS) {
      setResult({
        success: false,
        error: `Need at least ${MIN_CONTROL_POINTS} control points (have ${controlPoints.length})`
      });
      return;
    }

    setIsCalculating(true);

    try {
      const transformResult = calculateAffineTransformation(
        controlPoints,
        tfOpts
      );

      setResult(transformResult);

      if (debug) {
        console.log('✅ Transformation calculated:', {
          success: transformResult.success,
          quality: transformResult.quality,
          rmsError: transformResult.rmsError
        });
      }
    } catch (error) {
      console.error('❌ Transformation calculation failed:', error);
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsCalculating(false);
    }
  }, [controlPoints, tfOpts, debug]);

  /**
   * Manual recalculation
   */
  const recalculate = useCallback(() => {
    if (debug) {
      console.log('🔄 Manual recalculation triggered');
    }
    calculate();
  }, [calculate, debug]);

  // ===================================================================
  // AUTO-RECALCULATION (ChatGPT-5 PATCH 2)
  // ===================================================================

  useEffect(() => {
    if (!autoRecalculate) return;

    // ❗ CRITICAL: Guard για insufficient points (prevents infinite loop)
    if (controlPoints.length < MIN_CONTROL_POINTS) {
      // κάνε reset ΜΟΝΟ αν υπήρχε matrix πριν
      setResult(prev =>
        prev?.matrix
          ? { success: false, matrix: undefined, rmsError: undefined, quality: undefined }
          : prev
      );
      if (debug) {
        console.log('⏭️ Skipping calculation: insufficient points', {
          count: controlPoints.length,
          required: MIN_CONTROL_POINTS
        });
      }
      return;
    }

    if (debug) {
      console.log('🔄 Control points changed, auto-recalculating...', {
        count: controlPoints.length,
        pointsKey
      });
    }

    // αμιγώς υπολογιστικό, καμία setState εδώ
    const next = calculateAffineTransformation(controlPoints, tfOpts);

    // setState ΜΟΝΟ αν το αποτέλεσμα άλλαξε (deep equality)
    setResult(prev => {
      if (equalTransform(prev, next)) {
        if (debug) {
          console.log('⏭️ Skipping setState: result unchanged');
        }
        return prev;
      }

      if (debug) {
        console.log('✅ Transformation updated:', {
          success: next.success,
          quality: next.quality,
          rmsError: next.rmsError
        });
      }

      return next;
    });
  }, [pointsKey, autoRecalculate, debug, controlPoints, tfOpts]);

  // ===================================================================
  // TRANSFORMATION UTILITIES
  // ===================================================================

  /**
   * Transform floor plan point → geo point
   */
  const transformPoint = useCallback((x: number, y: number): [number, number] | null => {
    if (!matrix) {
      if (debug) {
        console.warn('⚠️ Cannot transform point: No valid transformation matrix');
      }
      return null;
    }

    return transformPointUtil(x, y, matrix);
  }, [matrix, debug]);

  /**
   * Transform geo point → floor plan point (inverse)
   */
  const inverseTransformPoint = useCallback((lng: number, lat: number): [number, number] | null => {
    if (!matrix) {
      if (debug) {
        console.warn('⚠️ Cannot inverse transform point: No valid transformation matrix');
      }
      return null;
    }

    return inverseTransformPointUtil(lng, lat, matrix);
  }, [matrix, debug]);

  /**
   * Get coordinate transformer utility
   */
  const getTransformer = useCallback((): CoordinateTransformer | null => {
    if (!matrix || !result) {
      return null;
    }

    return {
      transformPoint: (x: number, y: number) => transformPointUtil(x, y, matrix),
      inverseTransformPoint: (lng: number, lat: number) => inverseTransformPointUtil(lng, lat, matrix),
      getMatrix: () => matrix,
      getQuality: () => result
    };
  }, [matrix, result]);

  // ===================================================================
  // RETURN
  // ===================================================================

  return {
    // State
    result,
    isValid,
    isCalculating,
    matrix,
    rmsError,
    quality,

    // Actions
    recalculate,
    transformPoint,
    inverseTransformPoint,
    getTransformer
  };
}

/**
 * Export for convenience
 */
export default useGeoTransformation;
