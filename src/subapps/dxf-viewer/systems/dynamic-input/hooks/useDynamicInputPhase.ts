'use client';

// DEBUG FLAG - Set to false to disable performance-heavy logging
const DEBUG_DYNAMIC_INPUT_PHASE = false;

import { useEffect, useCallback, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { resetPhaseForNewShape, type PhaseResetActions } from '../utils/field-value-utils';
import type { Point2D, Phase } from '../../../rendering/types/Types';
import type { CircleFieldState, ManualInputState, CoordinateFieldState } from '../types/common-interfaces';

interface UseDynamicInputPhaseArgs {
  activeTool: string;
  showInput: boolean;

  // mouse position
  mouseWorldPosition: Point2D | null;

  // current state
  isCoordinateAnchored: CoordinateFieldState;

  // state setters
  setXValue: (v: string) => void;
  setYValue: (v: string) => void;
  setLengthValue: (v: string) => void;
  setActiveField: (f: 'x' | 'y' | 'angle' | 'length' | 'radius') => void;
  setFieldUnlocked: Dispatch<SetStateAction<CircleFieldState>>;
  setIsCoordinateAnchored: (s: CoordinateFieldState) => void;
  setIsManualInput: (s: ManualInputState) => void;

  // phase management
  drawingPhase: Phase;
  setDrawingPhase: (p: Phase) => void;
  drawingPhaseRef: React.MutableRefObject<Phase>;

  // first click point
  firstClickPoint: Point2D | null;
  setFirstClickPoint: (p: Point2D | null) => void;
}

export function useDynamicInputPhase(args: UseDynamicInputPhaseArgs) {
  const {
    activeTool,
    showInput,
    mouseWorldPosition,
    isCoordinateAnchored,
    setXValue, setYValue, setLengthValue,
    setActiveField, setFieldUnlocked, setIsCoordinateAnchored, setIsManualInput,
    drawingPhase, setDrawingPhase, drawingPhaseRef,
    firstClickPoint, setFirstClickPoint,
  } = args;

  const hideAngleLengthFieldsRef = useRef(false);
  
  // Stable refs για όλα τα functions που χρησιμοποιούμε
  const argsRef = useRef(args);
  argsRef.current = args;

  // ✅ Stable event handler για canvas-click
  const stableHandleCanvasClick = useCallback(() => {

    const currentArgs = argsRef.current;

    if (DEBUG_DYNAMIC_INPUT_PHASE) console.debug('[DIO] click; phase before:', currentArgs.drawingPhaseRef.current);
    
    // Και τα δύο πεδία X,Y ανάβουν κίτρινα για 2 δευτερόλεπτα
    currentArgs.setIsCoordinateAnchored({ x: true, y: true });
    if (DEBUG_DYNAMIC_INPUT_PHASE) console.debug('[DynamicInputOverlay] canvas-click → anchor both X and Y');
    
    // Phase switching για εργαλεία που χρησιμοποιούν 2+ σημεία
    const drawingTools = ['line', 'rectangle', 'measure-distance', 'polyline', 'polygon'];
    const threePointTools: string[] = []; // Εργαλεία που χρειάζονται 3 σημεία
    const circleTools = ['circle', 'circle-diameter', 'circle-2p-diameter'];
    
    if (drawingTools.includes(currentArgs.activeTool)) {
      if (currentArgs.drawingPhaseRef.current === 'first-point') {
        // First click → switch to second point
        currentArgs.drawingPhaseRef.current = 'second-point';
        currentArgs.setDrawingPhase('second-point');
        console.debug('[DIO] phase after:', 'second-point');
        
        // ΠΡΟΣΩΡΙΝΟ ΞΕΚΛΕΙΔΩΜΑ Y για 2s ώστε να βαφτεί κίτρινο
        currentArgs.setFieldUnlocked(prev => ({ ...prev, y: true }));
        console.debug('[DIO] Temporarily unlocked Y field for highlight');
        
        // Store first point for distance calculation
        if (currentArgs.mouseWorldPosition) {
          const point = { x: currentArgs.mouseWorldPosition.x, y: currentArgs.mouseWorldPosition.y };
          currentArgs.setFirstClickPoint(point);
          console.debug(`[DIO] Stored first point:`, point);
        }
      } else if (currentArgs.drawingPhaseRef.current === 'second-point') {
        // Second click → reset to first point for new shape/line
        currentArgs.drawingPhaseRef.current = 'first-point';
        currentArgs.setDrawingPhase('first-point');
        console.debug('[DIO] phase after:', 'first-point');
        
        // Reset για νέο σχήμα
        resetPhaseForNewShape(currentArgs as PhaseResetActions);
      }
    } else if (circleTools.includes(currentArgs.activeTool)) {
      // Circle tools: Special 2-phase logic
      if (currentArgs.drawingPhaseRef.current === 'first-point') {
        // First click → switch to radius entry phase
        currentArgs.drawingPhaseRef.current = 'second-point';
        currentArgs.setDrawingPhase('second-point');
        console.debug('[DIO] Circle phase after first click:', 'second-point (radius entry)');
        
        // Store center point for radius calculation
        if (currentArgs.mouseWorldPosition) {
          const centerPoint = { x: currentArgs.mouseWorldPosition.x, y: currentArgs.mouseWorldPosition.y };
          currentArgs.setFirstClickPoint(centerPoint);
          console.debug(`[DIO] Stored circle center:`, centerPoint);
        }
        
        // Switch to radius field and unlock it
        currentArgs.setFieldUnlocked({ x: false, y: false, angle: false, length: false, radius: true });
        currentArgs.setActiveField('radius');
        console.debug('[DIO] Switched to radius field for circle');
      } else if (currentArgs.drawingPhaseRef.current === 'second-point') {
        // Second click (or Enter after radius entry) → reset to first point for new circle
        currentArgs.drawingPhaseRef.current = 'first-point';
        currentArgs.setDrawingPhase('first-point');
        console.debug('[DIO] Circle completed, reset to first-point');
        
        // Reset για νέο κύκλο χρησιμοποιώντας την κοινή λογική
        // Το resetForNextPointFirstPhase() θα γίνει από το keyboard hook
      }
    } else if (threePointTools.includes(currentArgs.activeTool)) {
      // Three-point tools: Χρειάζονται 3 clicks για να ολοκληρωθούν
      if (currentArgs.drawingPhaseRef.current === 'first-point') {
        // First click → switch to second point phase
        currentArgs.drawingPhaseRef.current = 'second-point';
        currentArgs.setDrawingPhase('second-point');
        console.debug('[DIO] Three-point tool: phase after first click:', 'second-point');
        
        // Store first point for distance calculation
        if (currentArgs.mouseWorldPosition) {
          const point = { x: currentArgs.mouseWorldPosition.x, y: currentArgs.mouseWorldPosition.y };
          currentArgs.setFirstClickPoint(point);
          console.debug(`[DIO] Three-point tool: Stored first point:`, point);
        }
      } else if (currentArgs.drawingPhaseRef.current === 'second-point') {
        // Second click → switch to continuous phase (wait for third point)
        currentArgs.drawingPhaseRef.current = 'continuous';
        currentArgs.setDrawingPhase('continuous');
        console.debug('[DIO] Three-point tool: phase after second click:', 'continuous');
        
        // Keep firstClickPoint for distance calculation during third point
        // DON'T reset firstClickPoint here!
      } else if (currentArgs.drawingPhaseRef.current === 'continuous') {
        // Third click → tool will auto-complete, reset for new measurement
        currentArgs.drawingPhaseRef.current = 'first-point';
        currentArgs.setDrawingPhase('first-point');
        console.debug('[DIO] Three-point tool: completed, reset to first-point');
        
        // Reset για νέα μέτρηση
        resetPhaseForNewShape(currentArgs as PhaseResetActions);
      }
    }

    // "άγκυρα" τις τιμές Χ/Υ - ΜΟΝΟ αν το overlay είναι visible
    if (currentArgs.mouseWorldPosition && currentArgs.showInput) {
      currentArgs.setXValue(currentArgs.mouseWorldPosition.x.toFixed(3));
      currentArgs.setYValue(currentArgs.mouseWorldPosition.y.toFixed(3));
      currentArgs.setIsManualInput({ x: true, y: true, radius: false });
      console.debug('[DynamicInputOverlay] Updated input values from world position:', currentArgs.mouseWorldPosition);
    }
  }, []); // Τώρα είναι πραγματικά σταθερό!

  // ✅ Register canvas-click event
  useEffect(() => {

    window.addEventListener('canvas-click', stableHandleCanvasClick);
    return () => {

      window.removeEventListener('canvas-click', stableHandleCanvasClick);
    };
  }, []); // Σταθερό event listener - δεν αλλάζει

  return {
    stableHandleCanvasClick,
    hideAngleLengthFieldsRef,
  };
}