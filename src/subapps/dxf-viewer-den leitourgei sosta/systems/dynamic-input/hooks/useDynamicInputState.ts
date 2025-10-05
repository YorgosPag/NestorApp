'use client';

import { useRef, useState, useCallback } from 'react';
import type {
  FieldValueActions,
  FieldStateActions,
  CoordinateActions,
  PhaseActions,
  InputRefActions
} from './interfaces';
import { setFieldValue } from '../utils/field-value-utils';
import type { Point2D, Phase } from '../../../rendering/types/Types';

export type Field = 'x' | 'y' | 'angle' | 'length' | 'radius' | 'diameter';

interface UseDynamicInputStateProps {
  activeTool: string;
}

export function useDynamicInputState({ activeTool }: UseDynamicInputStateProps) {
  // Core values
  const [showInput, setShowInput] = useState(false);
  const [xValue, setXValue] = useState('');
  const [yValue, setYValue] = useState('');
  const [angleValue, setAngleValue] = useState('');
  const [lengthValue, setLengthValue] = useState('');
  const [radiusValue, setRadiusValue] = useState('');
  const [diameterValue, setDiameterValue] = useState('');

  // Field management
  const [activeField, setActiveField] = useState<Field>('x');
  const [isManualInput, setIsManualInput] = useState({ x: false, y: false, radius: false });
  const [isCoordinateAnchored, setIsCoordinateAnchored] = useState({ x: false, y: false });
  const [fieldUnlocked, setFieldUnlocked] = useState({ x: true, y: false, angle: false, length: false, radius: false, diameter: false });

  // Phase management
  const [drawingPhase, setDrawingPhase] = useState<Phase>('first-point');
  const [hideAngleLengthFields, setHideAngleLengthFields] = useState(false);
  const [showLengthDuringDraw, setShowLengthDuringDraw] = useState(false);
  const [firstClickPoint, setFirstClickPoint] = useState<Point2D | null>(null);

  // Refs
  const hideAngleLengthFieldsRef = useRef(false);
  const drawingPhaseRef = useRef<Phase>('first-point');
  const firstClickPointRef = useRef<Point2D | null>(null); // Hot reload safe backup
  const xInputRef = useRef<HTMLInputElement>(null);
  const yInputRef = useRef<HTMLInputElement>(null);
  const angleInputRef = useRef<HTMLInputElement>(null);
  const lengthInputRef = useRef<HTMLInputElement>(null);
  const radiusInputRef = useRef<HTMLInputElement>(null);
  const diameterInputRef = useRef<HTMLInputElement>(null);

  // Helper functions (memoized για σταθερότητα)
  // Custom setFirstClickPoint that updates both state and ref
  const setFirstClickPointSafe = useCallback((point: Point2D | null) => {
    setFirstClickPoint(point);
    firstClickPointRef.current = point;
  }, []);
  
  const resetForNextPointFirstPhase = useCallback(() => {
    setXValue(''); 
    setYValue(''); 
    setAngleValue(''); 
    setLengthValue('');
    setRadiusValue('');
    setActiveField('x');
    setIsManualInput({ x: false, y: false, radius: false });
    hideAngleLengthFieldsRef.current = false;
    setShowLengthDuringDraw(false);
    // Only clear firstClickPoint if we're not in second-point phase for circle-2p-diameter
    if (!(activeTool === 'circle-2p-diameter' && drawingPhase === 'second-point')) {
      setFirstClickPointSafe(null);
    }
    setFieldUnlocked({ x: true, y: false, angle: false, length: false, radius: false });
  }, [activeTool, drawingPhase, setFirstClickPointSafe]);

  const setCurrentFieldValue = useCallback((value: string) => {
    setFieldValue(activeField, value, {
      setXValue, setYValue, setAngleValue, setLengthValue, setRadiusValue
    });
  }, [activeField]);

  // Interface implementations για cleaner API
  const fieldValueActions: FieldValueActions = {
    getValue: useCallback((field: Field): string => {
      switch (field) {
        case 'x': return xValue;
        case 'y': return yValue;
        case 'angle': return angleValue;
        case 'length': return lengthValue;
        case 'radius': return radiusValue;
        case 'diameter': return diameterValue;
        default: return '';
      }
    }, [xValue, yValue, angleValue, lengthValue, radiusValue, diameterValue]),

    setValue: useCallback((field: Field, value: string) => {
      setFieldValue(field, value, {
        setXValue, setYValue, setAngleValue, setLengthValue, setRadiusValue, setDiameterValue
      });
    }, []),

    getValues: useCallback(() => ({
      x: xValue,
      y: yValue,
      angle: angleValue,
      length: lengthValue,
      radius: radiusValue,
      diameter: diameterValue,
    }), [xValue, yValue, angleValue, lengthValue, radiusValue, diameterValue])
  };

  const fieldStateActions: FieldStateActions = {
    getActiveField: useCallback(() => activeField, [activeField]),
    setActiveField,
    isFieldUnlocked: useCallback((field: Field) => {
      switch (field) {
        case 'x': return fieldUnlocked.x;
        case 'y': return fieldUnlocked.y;
        case 'angle': return fieldUnlocked.angle;
        case 'length': return fieldUnlocked.length;
        case 'radius': return fieldUnlocked.radius;
        default: return false;
      }
    }, [fieldUnlocked]),
    setFieldUnlocked,
  };

  const coordinateActions: CoordinateActions = {
    anchorCoordinates: setIsCoordinateAnchored,
    setManualInput: (state) => setIsManualInput({ x: state.x, y: state.y, radius: state.radius || false }),
  };

  const phaseActions: PhaseActions = {
    getCurrentPhase: useCallback(() => drawingPhase, [drawingPhase]),
    setPhase: setDrawingPhase,
    getPhaseRef: useCallback(() => drawingPhaseRef, [drawingPhaseRef]),
  };

  const inputRefActions: InputRefActions = {
    focusField: useCallback((field: Field) => {
      const refMap = {
        x: xInputRef,
        y: yInputRef,
        angle: angleInputRef,
        length: lengthInputRef,
        radius: radiusInputRef,
        diameter: diameterInputRef,
      };
      refMap[field].current?.focus();
    }, []),
    
    getFieldRef: useCallback((field: Field) => {
      switch (field) {
        case 'x': return xInputRef;
        case 'y': return yInputRef;
        case 'angle': return angleInputRef;
        case 'length': return lengthInputRef;
        case 'radius': return radiusInputRef;
        case 'diameter': return diameterInputRef;
        default: return xInputRef;
      }
    }, []),
  };

  return {
    // Core values
    showInput, xValue, yValue, angleValue, lengthValue, radiusValue, diameterValue,
    activeField, isManualInput, isCoordinateAnchored, fieldUnlocked,
    drawingPhase, hideAngleLengthFields, showLengthDuringDraw, 
    firstClickPoint: firstClickPoint || firstClickPointRef.current, // Hot reload recovery
    
    // Refs
    hideAngleLengthFieldsRef, drawingPhaseRef, firstClickPointRef,
    xInputRef, yInputRef, angleInputRef, lengthInputRef, radiusInputRef, diameterInputRef,

    // Setters
    setShowInput, setXValue, setYValue, setAngleValue, setLengthValue, setRadiusValue, setDiameterValue,
    setActiveField, setIsManualInput, setIsCoordinateAnchored, setFieldUnlocked,
    setDrawingPhase, setHideAngleLengthFields, setShowLengthDuringDraw, 
    setFirstClickPoint: setFirstClickPointSafe, // Use the safe version

    // Helper functions
    resetForNextPointFirstPhase,
    setCurrentFieldValue,

    // Interface implementations (για cleaner API)
    fieldValueActions,
    fieldStateActions,
    coordinateActions,
    phaseActions,
    inputRefActions,
  };
}