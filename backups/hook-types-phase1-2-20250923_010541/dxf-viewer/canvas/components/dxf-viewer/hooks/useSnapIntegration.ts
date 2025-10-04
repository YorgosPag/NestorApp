'use client';

const DEBUG_SNAP_INTEGRATION = false;

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSnapContext } from '../../../../snapping/context/SnapContext';
import { useSnapManager } from '../../../../snapping/hooks/useSnapManager';
import type { Point2D as Pt } from '../../../../types/scene';
import type { SceneModel } from '../../../../types/scene';
import type { ProSnapResult } from '../../../../snapping/extended-types';

interface SnapIntegrationOptions {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  currentScene: SceneModel | null;
  overlayEntities?: any[]; // 🎯 NEW: Include overlay entities for unified snapping
  onSnapPoint?: (point: Pt) => void;
}

export function useSnapIntegration({
  canvasRef,
  currentScene,
  overlayEntities,
  onSnapPoint
}: SnapIntegrationOptions) {
  
  // ============================================================================
  // SNAP CONTEXT INTEGRATION
  // ============================================================================
  const { snapEnabled, enabledModes } = useSnapContext();
  
  // ============================================================================
  // SNAP RESULT STATE για visual indicators
  // ============================================================================
  const [currentSnapResult, setCurrentSnapResult] = useState<ProSnapResult | null>(null);
  
  // ============================================================================
  // SNAP ENGINE INTEGRATION
  // ============================================================================
  const { snapManager, findSnapPoint } = useSnapManager(canvasRef, {
    scene: currentScene,
    overlayEntities, // 🎯 PASS overlay entities to snap manager
    onSnapPoint: (point) => {
      if (DEBUG_SNAP_INTEGRATION) console.log('🎯 Snap point found:', point);
      onSnapPoint?.(point);
    }
  });

  // ============================================================================
  // UNIFIED SNAP FUNCTION - Single source of truth
  // ============================================================================
  const applySnap = useCallback((point: Pt): Pt => {
    if (!snapEnabled || !findSnapPoint) {
      setCurrentSnapResult(null);
      if (DEBUG_SNAP_INTEGRATION) console.log('🎯 Snap disabled or no engine, using raw point:', point);
      return point;
    }
    
    try {
      const snapResult = findSnapPoint(point.x, point.y);
      setCurrentSnapResult(snapResult); // ✅ Ενημέρωση state για visual indicators
      
      if (snapResult && snapResult.found && snapResult.snappedPoint) {
        if (DEBUG_SNAP_INTEGRATION) console.log('🎯 Snap applied:', snapResult.snappedPoint, 'from:', point);
        return snapResult.snappedPoint;
      }
    } catch (error) {
      if (DEBUG_SNAP_INTEGRATION) console.warn('🎯 Snap error:', error, 'falling back to raw point');
      setCurrentSnapResult(null);
    }
    
    if (DEBUG_SNAP_INTEGRATION) console.log('🎯 No snap found, using raw point:', point);
    return point;
  }, [snapEnabled, findSnapPoint]);

  // ============================================================================
  // DEBUG TRACKING
  // ============================================================================
  useEffect(() => {
    if (DEBUG_SNAP_INTEGRATION) console.log('🎯 Snap state changed:', {
      snapEnabled,
      enabledModes: Array.from(enabledModes),
      hasSnapManager: !!snapManager,
      hasFindSnapPoint: !!findSnapPoint
    });
  }, [snapEnabled, enabledModes, snapManager, findSnapPoint]);

  // ============================================================================
  // HOVER SNAP TRACKING - Για visual indicators
  // ============================================================================
  const trackSnapForPoint = useCallback((point: Pt) => {
    if (!snapEnabled || !findSnapPoint) {
      setCurrentSnapResult(null);
      if (DEBUG_SNAP_INTEGRATION) console.log('🎯 VISUAL: Snap disabled or no engine');
      return;
    }
    
    try {
      const snapResult = findSnapPoint(point.x, point.y);
      setCurrentSnapResult(snapResult);
      
      if (snapResult && snapResult.found) {
        if (DEBUG_SNAP_INTEGRATION) console.log('🎯 VISUAL: Snap found for indicators:', snapResult);
      } else {
        if (DEBUG_SNAP_INTEGRATION) console.log('🎯 VISUAL: No snap found for:', point);
      }
    } catch (error) {
      if (DEBUG_SNAP_INTEGRATION) console.warn('🎯 Hover snap error:', error);
      setCurrentSnapResult(null);
    }
  }, [snapEnabled, findSnapPoint]);

  return {
    // State
    snapEnabled,
    enabledModes,
    snapManager,
    currentSnapResult, // ✅ Για visual indicators
    
    // Functions
    findSnapPoint,
    applySnap,
    trackSnapForPoint, // ✅ Για hover tracking
  };
}