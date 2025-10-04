import { useCallback } from 'react';
import type { Point2D as Point } from '../../types/scene';
import { RULER_LEFT_PAD, RULER_BOTTOM_PAD, CALIB_TOLERANCE_PX } from '../../constants';
import type { CoordinateCalculations, CoordinateAccuracy } from './types';

export interface CoordinateCalculationsHook {
  calculations: CoordinateCalculations;
}

export function useCoordinateCalculations(
  canvasRect: DOMRect | undefined,
  coordinateManager: any
): CoordinateCalculationsHook {
  
  const calculateUnifiedCoordinates = useCallback((cssPoint: { x: number; y: number }) => {
    if (!canvasRect) return null;
    const leftPad = RULER_LEFT_PAD;
    const bottomPad = RULER_BOTTOM_PAD;
    const viewH = canvasRect.height - bottomPad;

    const canvasPoint = { x: cssPoint.x - leftPad, y: cssPoint.y };
    const canvasPointWorldUp = { x: canvasPoint.x, y: viewH - canvasPoint.y };

    return { canvasPoint, canvasPointWorldUp };
  }, [canvasRect]);

  const calculateRoundTripError = useCallback((cssPoint: { x: number; y: number }) => {
    if (!coordinateManager || !canvasRect) return null;
    const worldPt = coordinateManager.screenToWorld(cssPoint);
    if (!worldPt) return null;
    const backToCss = coordinateManager.worldToScreen(worldPt);
    if (!backToCss) return null;
    const deltaX = cssPoint.x - backToCss.x;
    const deltaY = cssPoint.y - backToCss.y;
    return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  }, [coordinateManager, canvasRect]);

  const checkCoordinateAccuracy = useCallback((cssPoint: { x: number; y: number }, worldPoint: { x: number; y: number }): CoordinateAccuracy => {
    if (!coordinateManager) return { xOk: false, yOk: false, overall: false };
    const cssFromWorld = coordinateManager.worldToScreen(worldPoint);
    const deltaX = Math.abs(cssPoint.x - cssFromWorld.x);
    const deltaY = Math.abs(cssPoint.y - cssFromWorld.y);
    const tolerance = CALIB_TOLERANCE_PX;
    const xOk = deltaX < tolerance;
    const yOk = deltaY < tolerance;
    return { xOk, yOk, overall: xOk && yOk };
  }, [coordinateManager]);

  const calculations: CoordinateCalculations = {
    calculateUnifiedCoordinates,
    calculateRoundTripError,
    checkCoordinateAccuracy,
  };

  return {
    calculations,
  };
}