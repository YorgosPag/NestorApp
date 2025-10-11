/**
 * USE GEO-TRANSFORM HOOK
 * Enterprise React hook για DXF georeferencing functionality
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  GeoControlPoint,
  DxfCoordinate,
  GeoCoordinate,
  GeoreferenceInfo
} from '../types';

import { dxfGeoTransformService } from '../services/geo-transform/DxfGeoTransform';
import { controlPointManager, type ControlPointValidation } from '../services/geo-transform/ControlPointManager';

// ============================================================================
// HOOK STATE INTERFACES
// ============================================================================

export interface GeoTransformState {
  // Transformation status
  isCalibrated: boolean;
  isCalibrating: boolean;
  accuracy: number | null;
  method: 'affine' | 'polynomial' | 'tps' | null;

  // Control points
  controlPoints: GeoControlPoint[];
  selectedPointId: string | null;
  validation: ControlPointValidation | null;

  // Error handling
  error: string | null;
  lastOperation: string | null;
}

export interface GeoTransformActions {
  // Control point management
  addControlPoint: (dxfPoint: DxfCoordinate, geoPoint: GeoCoordinate, options?: {
    id?: string;
    accuracy?: number;
    description?: string;
  }) => Promise<void>;
  updateControlPoint: (id: string, updates: Partial<GeoControlPoint>) => Promise<void>;
  removeControlPoint: (id: string) => Promise<void>;
  selectControlPoint: (id: string | null) => void;
  clearControlPoints: () => Promise<void>;

  // Transformation operations
  calibrateTransformation: (method?: 'affine' | 'polynomial' | 'tps') => Promise<void>;
  transformPoint: (dxfPoint: DxfCoordinate) => GeoCoordinate | null;
  transformBatch: (dxfPoints: DxfCoordinate[]) => GeoCoordinate[];
  validateTransformation: () => void;

  // Persistence
  saveControlPoints: () => void;
  loadControlPoints: () => boolean;
  exportGeoreferencing: () => GeoreferenceInfo | null;
  importGeoreferencing: (georef: GeoreferenceInfo) => Promise<void>;

  // Utilities
  suggestOptimalPoints: (targetCount?: number) => DxfCoordinate[];
  clearError: () => void;
  reset: () => void;
}

// ============================================================================
// MAIN HOOK
// ============================================================================

/**
 * Main hook για DXF georeferencing functionality
 */
export function useGeoTransform(): [GeoTransformState, GeoTransformActions] {
  // State management
  const [state, setState] = useState<GeoTransformState>({
    isCalibrated: false,
    isCalibrating: false,
    accuracy: null,
    method: null,
    controlPoints: [],
    selectedPointId: null,
    validation: null,
    error: null,
    lastOperation: null
  });

  const mountedRef = useRef(true);

  // ========================================================================
  // CONTROL POINT MANAGEMENT
  // ========================================================================

  const addControlPoint = useCallback(async (
    dxfPoint: DxfCoordinate,
    geoPoint: GeoCoordinate,
    options: { id?: string; accuracy?: number; description?: string } = {}
  ) => {
    try {
      setState(prev => ({ ...prev, error: null, lastOperation: 'Adding control point' }));

      const newPoint = controlPointManager.addControlPoint(dxfPoint, geoPoint, options);
      const allPoints = controlPointManager.getAllControlPoints();

      console.log('🎯 Hook: Added control point:', newPoint);
      console.log('🎯 Hook: All control points:', allPoints);
      console.log('🎯 Hook: Points count:', allPoints.length);

      // 🔧 ENTERPRISE FIX: Direct setState - no mountedRef check needed
      console.log('🔍 Hook: About to call setState directly...');
      setState(prev => {
        const newState = {
          ...prev,
          controlPoints: allPoints,
          validation: controlPointManager.validateControlPoints(),
          lastOperation: `Added control point: ${newPoint.id}`
        };
        console.log('🎯 Hook: Setting new state:', newState);
        return newState;
      });
      console.log('✅ Hook: setState called successfully!');
    } catch (error) {
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to add control point',
          lastOperation: null
        }));
      }
    }
  }, []);

  const updateControlPoint = useCallback(async (
    id: string,
    updates: Partial<GeoControlPoint>
  ) => {
    try {
      setState(prev => ({ ...prev, error: null, lastOperation: 'Updating control point' }));

      controlPointManager.updateControlPoint(id, updates);

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          controlPoints: controlPointManager.getAllControlPoints(),
          validation: controlPointManager.validateControlPoints(),
          lastOperation: `Updated control point: ${id}`
        }));
      }
    } catch (error) {
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to update control point',
          lastOperation: null
        }));
      }
    }
  }, []);

  const removeControlPoint = useCallback(async (id: string) => {
    try {
      setState(prev => ({ ...prev, error: null, lastOperation: 'Removing control point' }));

      const removed = controlPointManager.removeControlPoint(id);

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          controlPoints: controlPointManager.getAllControlPoints(),
          selectedPointId: prev.selectedPointId === id ? null : prev.selectedPointId,
          validation: controlPointManager.validateControlPoints(),
          lastOperation: removed ? `Removed control point: ${id}` : 'Control point not found',
          isCalibrated: false // Reset calibration after removing points
        }));
      }
    } catch (error) {
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to remove control point',
          lastOperation: null
        }));
      }
    }
  }, []);

  const selectControlPoint = useCallback((id: string | null) => {
    setState(prev => ({ ...prev, selectedPointId: id }));
  }, []);

  const clearControlPoints = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, error: null, lastOperation: 'Clearing control points' }));

      controlPointManager.clearControlPoints();
      dxfGeoTransformService.reset();

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          controlPoints: [],
          selectedPointId: null,
          validation: null,
          isCalibrated: false,
          accuracy: null,
          method: null,
          lastOperation: 'Cleared all control points'
        }));
      }
    } catch (error) {
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to clear control points',
          lastOperation: null
        }));
      }
    }
  }, []);

  // ========================================================================
  // TRANSFORMATION OPERATIONS
  // ========================================================================

  const calibrateTransformation = useCallback(async (
    method: 'affine' | 'polynomial' | 'tps' = 'affine'
  ) => {
    try {
      setState(prev => ({
        ...prev,
        isCalibrating: true,
        error: null,
        lastOperation: 'Calibrating transformation'
      }));

      const controlPoints = controlPointManager.getAllControlPoints();
      if (controlPoints.length < 3) {
        throw new Error('Χρειάζονται τουλάχιστον 3 control points για calibration');
      }

      const georeferenceInfo = await dxfGeoTransformService.calibrateTransformation(
        controlPoints,
        method
      );

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isCalibrating: false,
          isCalibrated: true,
          accuracy: georeferenceInfo.accuracy,
          method: georeferenceInfo.method,
          lastOperation: `Calibration complete - Accuracy: ${georeferenceInfo.accuracy.toFixed(3)}m`
        }));
      }
    } catch (error) {
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isCalibrating: false,
          isCalibrated: false,
          error: error instanceof Error ? error.message : 'Calibration failed',
          lastOperation: null
        }));
      }
    }
  }, []);

  const transformPoint = useCallback((dxfPoint: DxfCoordinate): GeoCoordinate | null => {
    try {
      if (!state.isCalibrated) {
        return null;
      }
      return dxfGeoTransformService.transformDxfToGeo(dxfPoint);
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Point transformation failed'
      }));
      return null;
    }
  }, [state.isCalibrated]);

  const transformBatch = useCallback((dxfPoints: DxfCoordinate[]): GeoCoordinate[] => {
    try {
      if (!state.isCalibrated) {
        return [];
      }
      return dxfGeoTransformService.transformDxfBatch(dxfPoints);
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Batch transformation failed'
      }));
      return [];
    }
  }, [state.isCalibrated]);

  const validateTransformation = useCallback(() => {
    const validation = controlPointManager.validateControlPoints();
    setState(prev => ({ ...prev, validation }));
  }, []);

  // ========================================================================
  // PERSISTENCE
  // ========================================================================

  const saveControlPoints = useCallback(() => {
    try {
      controlPointManager.saveToLocalStorage();
      setState(prev => ({
        ...prev,
        lastOperation: 'Control points saved to localStorage'
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Failed to save control points',
        lastOperation: null
      }));
    }
  }, []);

  const loadControlPoints = useCallback((): boolean => {
    try {
      const loaded = controlPointManager.loadFromLocalStorage();

      if (loaded && mountedRef.current) {
        setState(prev => ({
          ...prev,
          controlPoints: controlPointManager.getAllControlPoints(),
          validation: controlPointManager.validateControlPoints(),
          lastOperation: 'Control points loaded από localStorage',
          isCalibrated: false // Require re-calibration
        }));
      }

      return loaded;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Failed to load control points',
        lastOperation: null
      }));
      return false;
    }
  }, []);

  const exportGeoreferencing = useCallback((): GeoreferenceInfo | null => {
    return dxfGeoTransformService.exportGeoreferencing();
  }, []);

  const importGeoreferencing = useCallback(async (georef: GeoreferenceInfo) => {
    try {
      setState(prev => ({ ...prev, error: null, lastOperation: 'Importing georeferencing' }));

      dxfGeoTransformService.loadGeoreferencing(georef);

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isCalibrated: true,
          accuracy: georef.accuracy,
          method: georef.method,
          lastOperation: 'Georeferencing imported successfully'
        }));
      }
    } catch (error) {
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to import georeferencing',
          lastOperation: null
        }));
      }
    }
  }, []);

  // ========================================================================
  // UTILITIES
  // ========================================================================

  const suggestOptimalPoints = useCallback((targetCount: number = 6): DxfCoordinate[] => {
    try {
      return controlPointManager.suggestOptimalPoints(targetCount);
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to suggest optimal points'
      }));
      return [];
    }
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const reset = useCallback(() => {
    controlPointManager.clearControlPoints();
    dxfGeoTransformService.reset();

    setState({
      isCalibrated: false,
      isCalibrating: false,
      accuracy: null,
      method: null,
      controlPoints: [],
      selectedPointId: null,
      validation: null,
      error: null,
      lastOperation: 'System reset'
    });
  }, []);

  // ========================================================================
  // EFFECTS
  // ========================================================================

  // Initialize από localStorage on mount
  useEffect(() => {
    const loaded = controlPointManager.loadFromLocalStorage();
    if (loaded) {
      setState(prev => ({
        ...prev,
        controlPoints: controlPointManager.getAllControlPoints(),
        validation: controlPointManager.validateControlPoints(),
        lastOperation: 'Loaded saved control points'
      }));
    }

    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Auto-validate when control points change
  useEffect(() => {
    if (state.controlPoints.length > 0) {
      validateTransformation();
    }
  }, [state.controlPoints.length, validateTransformation]);

  // ========================================================================
  // RETURN HOOK INTERFACE
  // ========================================================================

  const actions: GeoTransformActions = {
    addControlPoint,
    updateControlPoint,
    removeControlPoint,
    selectControlPoint,
    clearControlPoints,
    calibrateTransformation,
    transformPoint,
    transformBatch,
    validateTransformation,
    saveControlPoints,
    loadControlPoints,
    exportGeoreferencing,
    importGeoreferencing,
    suggestOptimalPoints,
    clearError,
    reset
  };

  return [state, actions];
}

export default useGeoTransform;