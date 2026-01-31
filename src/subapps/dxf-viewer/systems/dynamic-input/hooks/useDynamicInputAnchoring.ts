'use client';

import { useEffect } from 'react';
import type { Phase } from './useDynamicInputState';
import type { CoordinateFieldState, CircleFieldState } from '../types/common-interfaces';
// 🏢 ADR-098: Centralized Timing Constants
import { UI_TIMING } from '../../../config/timing-config';

interface UseDynamicInputAnchoringArgs {
  isCoordinateAnchored: CoordinateFieldState;
  drawingPhase: Phase;
  activeTool: string;

  // Setters
  setIsCoordinateAnchored: (s: CoordinateFieldState) => void;
  setIsManualInput: (s: CoordinateFieldState) => void;
  setFieldUnlocked: (u: CircleFieldState) => void;
}

export function useDynamicInputAnchoring({
  isCoordinateAnchored,
  drawingPhase,
  activeTool,
  setIsCoordinateAnchored,
  setIsManualInput,
  setFieldUnlocked,
}: UseDynamicInputAnchoringArgs) {
  
  // Auto-unanchor XY highlight after anchor display duration με field unlocking logic
  // 🏢 ADR-098: Using UI_TIMING.ANCHOR_DISPLAY_DURATION
  useEffect(() => {
    if (isCoordinateAnchored.x || isCoordinateAnchored.y) {
      const resetTimer = setTimeout(() => {
        // ΕΠΑΝΑΦΟΡΑ anchoring για το κίτρινο highlighting
        setIsCoordinateAnchored({ x: false, y: false });
        setIsManualInput({ x: false, y: false });
        console.debug('[DynamicInputOverlay] Reset anchor state after anchor display duration');

        // ΕΠΑΝΑΦΟΡΑ της κανονικής κατάστασης fieldUnlocked - tool-aware reset για second-point
        if (drawingPhase === 'second-point') {
          if (activeTool === 'circle') {
            setFieldUnlocked({ x: false, y: false, angle: false, length: false, radius: true, diameter: false });
            console.debug('[DynamicInputOverlay] Reset to radius unlocked for circle second-point');
          } else if (activeTool === 'circle-diameter') {
            setFieldUnlocked({ x: false, y: false, angle: false, length: false, radius: false, diameter: true });
            console.debug('[DynamicInputOverlay] Reset to diameter unlocked for circle-diameter second-point');
          } else {
            setFieldUnlocked({ x: true, y: false, angle: false, length: false, radius: false, diameter: false });
            console.debug('[DynamicInputOverlay] Reset Y field to locked state (second-point)');
          }
        }
      }, UI_TIMING.ANCHOR_DISPLAY_DURATION);

      return () => clearTimeout(resetTimer);
    }
  }, [isCoordinateAnchored, drawingPhase, activeTool, setIsCoordinateAnchored, setIsManualInput, setFieldUnlocked]);
}