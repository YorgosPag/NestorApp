'use client';

import { useEffect } from 'react';
import type { Point2D } from '../../../rendering/types/Types';
// 🏢 ADR-065: Centralized Distance Calculation
import { calculateDistance } from '../../../rendering/entities/shared/geometry-rendering-utils';

interface UseDynamicInputRealtimeArgs {
  mouseWorldPosition: Point2D | null;
  showInput: boolean;
  activeTool: string;
  firstClickPoint: Point2D | null;
  isManualInput: { x: boolean; y: boolean; radius?: boolean };
  showLengthDuringDraw: boolean;

  // Setters
  setXValue: (v: string) => void;
  setYValue: (v: string) => void;
  setLengthValue: (v: string) => void;
  setAngleValue: (v: string) => void;
  setRadiusValue: (v: string) => void;
  setShowLengthDuringDraw: (s: boolean) => void;
}

// ADR-357 Phase 2a §4 G2 — tools that show live Length + Angle while drawing.
const LIVE_READOUT_TOOLS = new Set([
  'line', 'polyline', 'polygon',
  'measure-distance', 'measure-area', 'measure-angle',
]);
// ADR-357 Phase 2a — circle family uses radius (not length/angle).
const RADIUS_TOOLS = new Set(['circle', 'circle-diameter']);

export function useDynamicInputRealtime({
  mouseWorldPosition,
  showInput,
  activeTool,
  firstClickPoint,
  isManualInput,
  setXValue,
  setYValue,
  setLengthValue,
  setAngleValue,
  setRadiusValue,
  setShowLengthDuringDraw,
}: UseDynamicInputRealtimeArgs) {
  useEffect(() => {
    if (!mouseWorldPosition || !showInput) return;

    if (!isManualInput.x) {
      setXValue(mouseWorldPosition.x.toFixed(3));
    }
    if (!isManualInput.y) {
      setYValue(mouseWorldPosition.y.toFixed(3));
    }

    if (!firstClickPoint) return;

    if (RADIUS_TOOLS.has(activeTool)) {
      const distance = calculateDistance(mouseWorldPosition, firstClickPoint);
      setRadiusValue(distance.toFixed(3));
      setShowLengthDuringDraw(true);
      return;
    }

    if (LIVE_READOUT_TOOLS.has(activeTool)) {
      const dx = mouseWorldPosition.x - firstClickPoint.x;
      const dy = mouseWorldPosition.y - firstClickPoint.y;
      const distance = Math.hypot(dx, dy);
      setLengthValue(distance.toFixed(3));
      // ADR-357 §4 G2 — live angle (degrees, normalized 0..360, AutoCAD convention).
      const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
      const normalized = angleDeg < 0 ? angleDeg + 360 : angleDeg;
      setAngleValue(normalized.toFixed(3));
      setShowLengthDuringDraw(true);
    }
  }, [mouseWorldPosition, showInput, isManualInput, activeTool, firstClickPoint,
      setXValue, setYValue, setLengthValue, setAngleValue, setRadiusValue, setShowLengthDuringDraw]);
}