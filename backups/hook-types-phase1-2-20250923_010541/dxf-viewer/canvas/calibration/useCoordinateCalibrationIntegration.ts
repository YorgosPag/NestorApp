import { useCallback } from 'react';
import type { Point2D as Point } from '../../types/scene';
import type { CalibrationProps, ClickTest } from './types';
import { useCalibrationState } from './useCalibrationState';
import { useCoordinateCalculations } from './useCoordinateCalculations';
// useGridRendering removed - διέγραψα το calibration grid system που έκανε τα κόκκινα γράμματα κάτω αριστερά
import { useTestEntity } from './useTestEntity';

export function useCoordinateCalibrationIntegration(props: CalibrationProps) {
  const {
    mousePos,
    worldPos,
    canvasRect,
    coordinateManager,
    currentScene,
    onInjectTestEntity
  } = props;

  // Initialize individual hooks
  const { state, actions, clickIdRef } = useCalibrationState();
  const { calculations } = useCoordinateCalculations(canvasRect, coordinateManager);
  // useGridRendering removed - διέγραψα το calibration grid system που έκανε τα κόκκινα γράμματα κάτω αριστερά
  const { testEntity } = useTestEntity(
    worldPos,
    onInjectTestEntity,
    () => actions.setTestEntityInjected(true)
  );

  // Scene info calculations
  const entitiesCount = currentScene?.entities?.length ?? 0;
  const layersCount = currentScene?.layers ? Object.keys(currentScene.layers).length : 0;
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

  // Current mouse position calculations
  const currentRoundTripError = mousePos ? calculations.calculateRoundTripError(mousePos) : null;
  const currentAccuracy = mousePos && worldPos ? calculations.checkCoordinateAccuracy(mousePos, worldPos) : null;

  // Click test handler
  const handleCalibrationClick = useCallback((e: React.MouseEvent) => {
    if (!canvasRect || !coordinateManager) return;
    
    const cssPoint = { x: e.clientX - canvasRect.left, y: e.clientY - canvasRect.top };
    const worldPoint = coordinateManager.screenToWorld(cssPoint);
    if (!worldPoint) return;
    
    const unified = calculations.calculateUnifiedCoordinates(cssPoint);
    const roundTripError = calculations.calculateRoundTripError(cssPoint);
    const coordinateAccuracy = calculations.checkCoordinateAccuracy(cssPoint, worldPoint);
    
    const newTest: ClickTest = {
      id: ++clickIdRef.current,
      cssPoint,
      worldPoint,
      canvasPoint: unified?.canvasPoint || { x: 0, y: 0 },
      canvasPointWorldUp: unified?.canvasPointWorldUp || { x: 0, y: 0 },
      roundTripError: roundTripError || undefined,
      coordinateAccuracy,
      timestamp: new Date().toLocaleTimeString()
    };
    
    actions.addClickTest(newTest);
  }, [canvasRect, coordinateManager, calculations, actions, clickIdRef]);

  return {
    // State
    state,
    actions,
    
    // Calculations
    calculations,
    currentRoundTripError,
    currentAccuracy,
    
    // Scene info
    entitiesCount,
    layersCount,
    dpr,
    
    // Test entity
    testEntity,
    
    // Event handlers
    handleCalibrationClick,
  };
}