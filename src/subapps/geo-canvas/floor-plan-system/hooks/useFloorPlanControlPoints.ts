/**
 * USE FLOOR PLAN CONTROL POINTS HOOK
 *
 * Custom hook για control point management (georeferencing)
 *
 * @module floor-plan-system/hooks/useFloorPlanControlPoints
 *
 * Features:
 * - Control point collection state
 * - Click-based point placement workflow
 * - Point pair validation
 * - Edit/delete operations
 * - Min points validation (3+ required)
 *
 * Workflow:
 * 1. startPicking() → state: 'picking-floor'
 * 2. User clicks on floor plan → addFloorPlanPoint(x, y) → state: 'picking-geo'
 * 3. User clicks on map → addGeoPoint(lng, lat) → state: 'complete' → new point added
 * 4. Repeat for 3+ points
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import type {
  FloorPlanControlPoint,
  FloorPlanCoordinate,
  GeoCoordinate,
  ControlPointPickingState
} from '../types/control-points';

/**
 * Hook state interface
 */
export interface UseFloorPlanControlPointsState {
  /** Control points list */
  points: FloorPlanControlPoint[];
  /** Current picking state */
  pickingState: ControlPointPickingState;
  /** Ref to current picking state (for immediate access, no closure issues) */
  pickingStateRef: React.MutableRefObject<ControlPointPickingState>;
  /** Temporary floor plan coordinate (when picking geo) */
  tempFloorPlan: FloorPlanCoordinate | null;
  /** Temporary geo coordinate (when picking floor) */
  tempGeo: GeoCoordinate | null;
  /** Minimum points reached (3+) */
  hasMinPoints: boolean;
}

/**
 * Hook actions interface
 */
export interface UseFloorPlanControlPointsActions {
  /** Start picking new control point */
  startPicking: () => void;
  /** Cancel current picking */
  cancelPicking: () => void;
  /** Add floor plan coordinate (first step) */
  addFloorPlanPoint: (x: number, y: number) => void;
  /** Add geo coordinate (second step) */
  addGeoPoint: (lng: number, lat: number, label?: string) => void;
  /** Delete control point by ID */
  deletePoint: (id: string) => void;
  /** Clear all points */
  clearAll: () => void;
  /** Update point label */
  updateLabel: (id: string, label: string) => void;
}

/**
 * Hook return type
 */
export type UseFloorPlanControlPointsReturn = UseFloorPlanControlPointsState & UseFloorPlanControlPointsActions;

/**
 * useFloorPlanControlPoints Hook
 *
 * Manages control point collection για georeferencing
 *
 * @returns Hook state and actions
 */
export function useFloorPlanControlPoints(): UseFloorPlanControlPointsReturn {
  // ===================================================================
  // STATE
  // ===================================================================

  const [points, setPoints] = useState<FloorPlanControlPoint[]>([]);
  const [pickingState, setPickingState] = useState<ControlPointPickingState>('idle');
  const [tempFloorPlan, setTempFloorPlan] = useState<FloorPlanCoordinate | null>(null);
  const [tempGeo, setTempGeo] = useState<GeoCoordinate | null>(null);

  // ❗ CRITICAL: Use ref to store current pickingState for immediate access
  const pickingStateRef = useRef<ControlPointPickingState>('idle');

  // ===================================================================
  // DEBUG: Log pickingState changes & update ref
  // ===================================================================

  useEffect(() => {
    console.log('pickingState changed to:', pickingState);
    pickingStateRef.current = pickingState; // Update ref immediately
  }, [pickingState]);

  // ===================================================================
  // COMPUTED
  // ===================================================================

  const hasMinPoints = points.length >= 3;

  // ===================================================================
  // ACTIONS
  // ===================================================================

  /**
   * Start picking new control point
   */
  const startPicking = useCallback(() => {
    console.log('Starting control point picking...');
    console.log('Setting pickingState to: picking-floor');
    pickingStateRef.current = 'picking-floor'; // ❗ Update ref immediately!
    setPickingState('picking-floor');
    setTempFloorPlan(null);
    setTempGeo(null);
    console.log('Ref updated immediately to:', pickingStateRef.current);
  }, []);

  /**
   * Cancel current picking
   */
  const cancelPicking = useCallback(() => {
    console.log('❌ Cancelling control point picking');
    setPickingState('idle');
    setTempFloorPlan(null);
    setTempGeo(null);
  }, []);

  /**
   * Add floor plan coordinate (STEP 1)
   */
  const addFloorPlanPoint = useCallback((x: number, y: number) => {
    console.log('🗺️ Floor plan point selected:', { x, y });

    if (pickingState !== 'picking-floor') {
      console.warn('⚠️ Not in picking-floor state. Current:', pickingState);
      return;
    }

    // Store temporary floor plan coordinate
    setTempFloorPlan({ x, y });
    setPickingState('picking-geo');

    console.log('➡️ Now waiting for geo coordinate...');
  }, [pickingState]);

  /**
   * Add geo coordinate (STEP 2) - completes the pair
   */
  const addGeoPoint = useCallback((lng: number, lat: number, label?: string) => {
    console.log('🌍 Geo point selected:', { lng, lat });

    if (pickingState !== 'picking-geo' || !tempFloorPlan) {
      console.warn('⚠️ Not in picking-geo state or no temp floor plan. State:', pickingState);
      return;
    }

    // Create new control point
    const newPoint: FloorPlanControlPoint = {
      id: `cp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      floorPlan: tempFloorPlan,
      geo: { lng, lat },
      label: label || `Point ${points.length + 1}`,
      createdAt: Date.now()
    };

    // Add to points list
    setPoints(prev => [...prev, newPoint]);

    // Reset state
    setPickingState('idle');
    setTempFloorPlan(null);
    setTempGeo(null);

    console.log('✅ Control point added:', newPoint);
    console.log(`📊 Total points: ${points.length + 1}`);

    // ❌ REMOVED: Auto-start next picking (causes button flashing)
    // User must manually click "Add Control Point" for next point
    // This prevents confusing UI state changes
  }, [pickingState, tempFloorPlan, points.length]);

  /**
   * Delete control point
   */
  const deletePoint = useCallback((id: string) => {
    console.log('🗑️ Deleting control point:', id);
    setPoints(prev => prev.filter(p => p.id !== id));
  }, []);

  /**
   * Clear all points
   */
  const clearAll = useCallback(() => {
    console.log('🗑️ Clearing all control points');
    setPoints([]);
    setPickingState('idle');
    setTempFloorPlan(null);
    setTempGeo(null);
  }, []);

  /**
   * Update point label
   */
  const updateLabel = useCallback((id: string, label: string) => {
    console.log('✏️ Updating label for point:', id, '→', label);
    setPoints(prev =>
      prev.map(p => (p.id === id ? { ...p, label } : p))
    );
  }, []);

  // ===================================================================
  // RETURN
  // ===================================================================

  return {
    // State
    points,
    pickingState,
    pickingStateRef, // ❗ Add ref for immediate access
    tempFloorPlan,
    tempGeo,
    hasMinPoints,

    // Actions
    startPicking,
    cancelPicking,
    addFloorPlanPoint,
    addGeoPoint,
    deletePoint,
    clearAll,
    updateLabel
  };
}

/**
 * Export for convenience
 */
export default useFloorPlanControlPoints;
