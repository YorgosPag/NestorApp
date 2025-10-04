'use client';

import { useEffect } from 'react';

const DEBUG_DYNAMIC_INPUT = false;

interface UseDynamicInputRealtimeArgs {
  mouseWorldPosition: { x: number; y: number } | null;
  showInput: boolean;
  activeTool: string;
  firstClickPoint: { x: number; y: number } | null;
  isManualInput: { x: boolean; y: boolean; radius?: boolean };
  showLengthDuringDraw: boolean;
  
  // Setters
  setXValue: (v: string) => void;
  setYValue: (v: string) => void;
  setLengthValue: (v: string) => void;
  setRadiusValue: (v: string) => void;
  setShowLengthDuringDraw: (s: boolean) => void;
}

export function useDynamicInputRealtime({
  mouseWorldPosition,
  showInput,
  activeTool,
  firstClickPoint,
  isManualInput,
  showLengthDuringDraw,
  setXValue,
  setYValue,
  setLengthValue,
  setRadiusValue,
  setShowLengthDuringDraw,
}: UseDynamicInputRealtimeArgs) {
  
  // Real-time coordinates: Ενημέρωση των πεδίων με τις τρέχουσες συντεταγμένες
  useEffect(() => {
    if (DEBUG_DYNAMIC_INPUT) console.log(`[MOUSE EFFECT] mouseWorldPosition: ${mouseWorldPosition ? 'exists' : 'null'}, showInput: ${showInput}, activeTool: ${activeTool}`);
    
    if (mouseWorldPosition && showInput) {
      // Ενημέρωση μόνο αν δεν έχει γίνει manual input
      if (!isManualInput.x) {
        setXValue(mouseWorldPosition.x.toFixed(3));
      }
      if (!isManualInput.y) {
        setYValue(mouseWorldPosition.y.toFixed(3));
      }
      
      // DISTANCE/RADIUS CALCULATION - Show appropriate value when we have a first point
      if (DEBUG_DYNAMIC_INPUT) console.log(`[DISTANCE] Checking: tool=${activeTool}, firstPoint=${firstClickPoint ? 'exists' : 'null'}`);
      if ((activeTool === 'line' || activeTool === 'circle' || activeTool === 'circle-diameter' || activeTool === 'polyline' || activeTool === 'measure-angle' || activeTool === 'polygon' || activeTool === 'measure-distance' || activeTool === 'measure-area') && firstClickPoint) {
        const dx = mouseWorldPosition.x - firstClickPoint.x;
        const dy = mouseWorldPosition.y - firstClickPoint.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (DEBUG_DYNAMIC_INPUT) console.log(`[DISTANCE] ✅ CALCULATED: ${distance.toFixed(3)}`);
        
        // For circle tools, use radius field instead of length field
        if (activeTool === 'circle' || activeTool === 'circle-diameter') {
          setRadiusValue(distance.toFixed(3));
        } else {
          setLengthValue(distance.toFixed(3));
        }
        setShowLengthDuringDraw(true);
      } else {
        if (DEBUG_DYNAMIC_INPUT) console.log(`[DISTANCE] ❌ SKIPPED`);
      }
    }
  }, [mouseWorldPosition, showInput, isManualInput, activeTool, showLengthDuringDraw, firstClickPoint,
      setXValue, setYValue, setLengthValue, setRadiusValue, setShowLengthDuringDraw]);
}