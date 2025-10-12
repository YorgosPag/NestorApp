/**
 * 🏢 CENTRALIZED POLYGON SYSTEM HOOK
 * Replacement for individual usePolygonSystem hooks
 *
 * @module polygon-system/hooks
 * @enterprise-pattern Single Source of Truth
 */

import { useMemo } from 'react';
import { usePolygonSystemContext } from './usePolygonSystemContext';
import type { CentralizedPolygonSystemHook } from '../types/polygon-system.types';

/**
 * Centralized polygon system hook
 *
 * This hook replaces individual usePolygonSystem() calls in components.
 * Provides unified interface for all polygon operations while maintaining
 * backward compatibility with existing component APIs.
 *
 * @returns CentralizedPolygonSystemHook
 */
export function useCentralizedPolygonSystem(): CentralizedPolygonSystemHook {
  const { state, actions, config } = usePolygonSystemContext();

  // Memoized statistics
  const stats = useMemo(() => ({
    totalPolygons: state.polygons.length,
    activeDrawing: state.isDrawing,
    currentTool: state.currentTool
  }), [state.polygons.length, state.isDrawing, state.currentTool]);

  // Return interface that matches existing component expectations
  return {
    // ========================================================================
    // POLYGONS & STATISTICS
    // ========================================================================

    polygons: state.polygons,
    stats,

    // ========================================================================
    // CORE ACTIONS (Compatible with existing components)
    // ========================================================================

    startDrawing: actions.startDrawing,
    finishDrawing: actions.finishDrawing,
    cancelDrawing: actions.cancelDrawing,
    clearAll: actions.clearAll,
    addPoint: actions.addPoint,
    updatePolygonConfig: actions.updatePolygonConfig,

    // ========================================================================
    // MAP INTEGRATION
    // ========================================================================

    setMapRef: actions.setMapRef,

    // ========================================================================
    // EXPORT FUNCTIONALITY
    // ========================================================================

    exportAsGeoJSON: actions.exportAsGeoJSON,

    // ========================================================================
    // LIVE PREVIEW FUNCTIONALITY
    // ========================================================================

    getCurrentDrawing: actions.getCurrentDrawing,

    // ========================================================================
    // LEGACY COMPATIBILITY
    // ========================================================================

    handlePolygonClosure: actions.handlePolygonClosure,
    isPolygonComplete: state.isPolygonComplete,

    // ========================================================================
    // STATE ACCESS
    // ========================================================================

    isDrawing: state.isDrawing,
    currentRole: state.currentRole
  };
}