'use client';

import { useEffect } from 'react';
import type { Field, Phase } from './useDynamicInputState';
import type { FieldValueSetters, FullFieldState, CoordinateFieldState } from '../types/common-interfaces';
import type { Point2D } from '../../../rendering/types/Types';

interface UseDynamicInputToolResetArgs extends FieldValueSetters {
  activeTool: string;
  drawingPhase: Phase;
  getFieldsToShow: () => string[];
  setActiveField: (f: Field) => void;
  setIsManualInput: (s: CoordinateFieldState) => void;
  setHideAngleLengthFields: (h: boolean) => void;
  setShowLengthDuringDraw: (s: boolean) => void;
  setFirstClickPoint: (p: Point2D | null) => void;
  setFieldUnlocked: (u: FullFieldState) => void;
  
  // Ref access
  hideAngleLengthFieldsRef: React.MutableRefObject<boolean>;
}

export function useDynamicInputToolReset({
  activeTool,
  drawingPhase,
  getFieldsToShow,
  setXValue,
  setYValue,
  setAngleValue,
  setLengthValue,
  setRadiusValue,
  setDiameterValue,
  setActiveField,
  setIsManualInput,
  setHideAngleLengthFields,
  setShowLengthDuringDraw,
  setFirstClickPoint,
  setFieldUnlocked,
  hideAngleLengthFieldsRef,
}: UseDynamicInputToolResetArgs) {
  
  // Καθαρισμός τιμών κάθε φορά που αλλάζει το εργαλείο
  useEffect(() => {
    setXValue('');
    setYValue('');
    setAngleValue('');
    setLengthValue('');
    setRadiusValue('');
    setDiameterValue('');
    setActiveField('x');
    setIsManualInput({ x: false, y: false });
    // ΔΕΝ reset-άρουμε το drawingPhase εδώ - μόνο από canvas-click
    // setDrawingPhase('first-point'); // Reset to first point
    // drawingPhaseRef.current = 'first-point';
    setHideAngleLengthFields(false); // Reset angle/length visibility
    hideAngleLengthFieldsRef.current = false;
    setShowLengthDuringDraw(false);
    setFirstClickPoint(null);
    
    // Reset progressive unlocking based on tool and phase
    const fieldsToShow = getFieldsToShow();
    const initialUnlocking = {
      x: fieldsToShow.includes('x'),
      y: false,
      angle: false,
      length: false,
      radius: fieldsToShow.includes('radius'),
      diameter: fieldsToShow.includes('diameter')
    };
    
    setFieldUnlocked(initialUnlocking);
  }, [activeTool, drawingPhase, getFieldsToShow, 
      setXValue, setYValue, setAngleValue, setLengthValue, setRadiusValue, setDiameterValue,
      setActiveField, setIsManualInput, setHideAngleLengthFields, setShowLengthDuringDraw,
      setFirstClickPoint, setFieldUnlocked, hideAngleLengthFieldsRef]);
}