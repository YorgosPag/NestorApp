'use client';

import { useEffect } from 'react';
import type { Point2D } from '../../../rendering/types/Types';
// 🏢 ADR-065: Centralized Distance Calculation
import { calculateDistance } from '../../../rendering/entities/shared/geometry-rendering-utils';
// ADR-357 Phase 2b: Display unit conversion
import type { DisplayUnit } from '../../../config/units';
import { formatDisplayValue } from '../../../config/units';
// ADR-357 Phase 13 G14: length/angle lock constraint
import { DynamicInputLockStore } from '../DynamicInputLockStore';

interface UseDynamicInputRealtimeArgs {
  mouseWorldPosition: Point2D | null;
  showInput: boolean;
  activeTool: string;
  firstClickPoint: Point2D | null;
  isManualInput: { x: boolean; y: boolean; radius?: boolean };
  showLengthDuringDraw: boolean;
  /** ADR-357 Phase 2b: user-selected display unit for numeric readouts. */
  displayUnit: DisplayUnit;

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
  displayUnit,
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
      setXValue(formatDisplayValue(mouseWorldPosition.x, displayUnit));
    }
    if (!isManualInput.y) {
      setYValue(formatDisplayValue(mouseWorldPosition.y, displayUnit));
    }

    if (!firstClickPoint) return;

    if (RADIUS_TOOLS.has(activeTool)) {
      const distance = calculateDistance(mouseWorldPosition, firstClickPoint);
      setRadiusValue(formatDisplayValue(distance, displayUnit));
      setShowLengthDuringDraw(true);
      return;
    }

    if (LIVE_READOUT_TOOLS.has(activeTool)) {
      const dx = mouseWorldPosition.x - firstClickPoint.x;
      const dy = mouseWorldPosition.y - firstClickPoint.y;
      const distance = Math.hypot(dx, dy);
      const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
      const normalized = angleDeg < 0 ? angleDeg + 360 : angleDeg;

      // ADR-357 Phase 13 G14: skip live update for the locked field — keep locked value displayed.
      const { lockedField } = DynamicInputLockStore.getLocked();
      if (lockedField !== 'length') {
        setLengthValue(formatDisplayValue(distance, displayUnit));
      }
      // ADR-357 §4 G2 — live angle: degrees, normalized 0..360, AutoCAD convention.
      if (lockedField !== 'angle') {
        setAngleValue(normalized.toFixed(3));
      }
      setShowLengthDuringDraw(true);
    }
  }, [mouseWorldPosition, showInput, isManualInput, activeTool, firstClickPoint, displayUnit,
      setXValue, setYValue, setLengthValue, setAngleValue, setRadiusValue, setShowLengthDuringDraw]);
}