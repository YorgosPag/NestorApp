'use client';

// DEBUG FLAG - Set to false to disable performance-heavy logging
const DEBUG_DYNAMIC_INPUT_KEYBOARD = false;

import { useEffect, useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { FieldValueSetters, FieldValues } from '../types/common-interfaces';

type Phase = 'first-point' | 'second-point' | 'continuous';
type Field = 'x' | 'y' | 'angle' | 'length' | 'radius' | 'diameter';

interface UseDynamicInputKeyboardArgs extends FieldValueSetters, FieldValues {
  // visibility
  showInput: boolean;

  // tool + phase
  activeTool: string;
  drawingPhase: Phase;
  drawingPhaseRef: React.MutableRefObject<Phase>;
  setDrawingPhase: (p: Phase) => void;

  // active field
  activeField: Field;
  setActiveField: (f: Field) => void;
  setShowInput: (show: boolean) => void;

  // gating / flags
  setFieldUnlocked: Dispatch<SetStateAction<{ x: boolean; y: boolean; angle: boolean; length: boolean; radius: boolean; diameter: boolean }>>;
  setIsCoordinateAnchored: (s: { x: boolean; y: boolean }) => void;
  setIsManualInput: (s: { x: boolean; y: boolean }) => void;

  // validators
  normalizeNumber: (v: string) => string;
  isValidNumber: (v: string) => boolean;

  // input refs (για focus)
  xInputRef: React.RefObject<HTMLInputElement>;
  yInputRef: React.RefObject<HTMLInputElement>;
  angleInputRef: React.RefObject<HTMLInputElement>;
  lengthInputRef: React.RefObject<HTMLInputElement>;
  radiusInputRef: React.RefObject<HTMLInputElement>;
  diameterInputRef: React.RefObject<HTMLInputElement>;

  // feedback
  CADFeedback: { onError: () => void; onInputConfirm: () => void };

  // dispatcher για custom events (αντί για inline window.dispatchEvent)
  dispatchDynamicSubmit: (detail: any) => void;

  // helpers για reset μετά από ενέργειες
  resetForNextPointFirstPhase: () => void;
  
  // circle center coordinates
  firstClickPoint: { x: number; y: number } | null;
  setFirstClickPoint: (p: { x: number; y: number } | null) => void;
}

export function useDynamicInputKeyboard(args: UseDynamicInputKeyboardArgs) {
  const {
    showInput,
    activeTool,
    drawingPhase, drawingPhaseRef, setDrawingPhase,
    activeField, setActiveField,
    xValue, yValue, angleValue, lengthValue, radiusValue, diameterValue,
    setXValue, setYValue, setAngleValue, setLengthValue, setRadiusValue, setDiameterValue, setShowInput,
    setFieldUnlocked, setIsCoordinateAnchored, setIsManualInput,
    normalizeNumber, isValidNumber,
    xInputRef, yInputRef, angleInputRef, lengthInputRef, radiusInputRef, diameterInputRef,
    CADFeedback,
    dispatchDynamicSubmit,
    resetForNextPointFirstPhase,
    firstClickPoint,
    setFirstClickPoint,
  } = args;

  // Helper για focus με timeout
  const focusSoon = useCallback((ref: React.RefObject<HTMLInputElement>, ms = 10) => {
    setTimeout(() => ref.current?.focus(), ms);
  }, []);

  // Helper για focus και auto-select text (για radius field)
  const focusAndSelect = useCallback((ref: React.RefObject<HTMLInputElement>, ms = 50) => {
    setTimeout(() => {
      if (ref.current) {
        ref.current.focus();
        ref.current.select(); // Επιλέγει όλο το περιεχόμενο
      }
    }, ms);
  }, []);

  // Helper για να λάβει τιμή από ένα πεδίο
  const getCurrentFieldValue = useCallback((): string => {
    switch (activeField) {
      case 'x': return xValue;
      case 'y': return yValue;
      case 'angle': return angleValue;
      case 'length': return lengthValue;
      case 'radius': return radiusValue;
      case 'diameter': return diameterValue;
      default: return '';
    }
  }, [activeField, xValue, yValue, angleValue, lengthValue, radiusValue, diameterValue]);

  useEffect(() => {
    if (!showInput) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // μόνο όταν το overlay είναι ενεργό
      if (!showInput) return;

      if (e.key === 'Tab') {
        // Tab για μετάβαση μεταξύ των πεδίων
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        // Ειδική πλοήγηση για κύκλο: X → Y → X (Phase 1) ή μόνο Radius/Diameter (Phase 2)
        if (activeTool === 'circle' || activeTool === 'circle-diameter' || activeTool === 'circle-2p-diameter') {
          if (drawingPhase === 'first-point') {
            // Phase 1: X ↔ Y
            if (activeField === 'x') {
              setActiveField('y');
              focusSoon(yInputRef);
              if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log('Circle Phase 1: Y field focused');
            } else if (activeField === 'y') {
              setActiveField('x');
              focusSoon(xInputRef);
              if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log('Circle Phase 1: X field focused');
            }
          } else if (drawingPhase === 'second-point') {
            // Phase 2: Radius είναι το μόνο field, δεν χρειάζεται Tab
            if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log('Circle Phase 2: Only radius field available');
          }
        } else {
          // Κανονική κυκλική πλοήγηση για άλλα tools: X → Y → Angle → Length → X
          if (activeField === 'x') {
            setActiveField('y');
            focusSoon(yInputRef);
            if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log('Y field focused');
          } else if (activeField === 'y') {
            setActiveField('angle');
            focusSoon(angleInputRef);
            if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log('Angle field focused');
          } else if (activeField === 'angle') {
            setActiveField('length');
            focusSoon(lengthInputRef);
            if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log('Length field focused');
          } else {
            setActiveField('x');
            focusSoon(xInputRef);
            if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log('X field focused');
          }
        }
        return;
      }

      if (e.key === 'Enter') {
        const currentValue = getCurrentFieldValue().trim();

        // Επικύρωση της τρέχουσας τιμής αν υπάρχει
        if (currentValue !== '' && !isValidNumber(currentValue)) {
          CADFeedback.onError();
          e.preventDefault();
          return;
        }

        // ----- TOOL: LINE -----
        if (activeTool === 'line') {
          if (activeField === 'x' && currentValue !== '') {
            // X → unlock Y
            setFieldUnlocked(prev => ({ ...prev, y: true }));
            setActiveField('y');
            focusSoon(yInputRef);
            if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log('🔄 X → Y unlocked');
            return;
          }

          if (activeField === 'y' && currentValue !== '') {
            if (drawingPhase === 'first-point') {
              // 1ο σημείο: Y → unlock Angle
              setFieldUnlocked(prev => ({ ...prev, angle: true }));
              setActiveField('angle');
              focusSoon(angleInputRef);
              if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log('🔄 Y → Angle unlocked (first-point)');
              return;
            } else if (drawingPhase === 'second-point') {
              // 2ο σημείο: ολοκλήρωση γραμμής με X/Y
              if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log('🔄 Y Enter (second-point) → Creating line and returning to 4 fields');
              
              const xNum = xValue.trim() !== '' ? parseFloat(normalizeNumber(xValue)) : null;
              const yNum = yValue.trim() !== '' ? parseFloat(normalizeNumber(yValue)) : null;

              if (xNum !== null && yNum !== null) {
                if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log(`🎯 DISPATCHING LINE 2ND POINT EVENT:`, { end: {x: xNum, y: yNum} });
                
                CADFeedback.onInputConfirm();

                dispatchDynamicSubmit({
                  tool: activeTool,
                  coordinates: { x: xNum, y: yNum },
                  action: 'create-line-second-point',
                });

                // κίτρινο highlight
                setIsCoordinateAnchored({ x: true, y: true });
                if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log('🟡 Setting coordinates as anchored (yellow highlight)');

                // reset σε 4 πεδία (first-point) για νέα γραμμή
                drawingPhaseRef.current = 'first-point';
                setDrawingPhase('first-point');
                if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log('🔄 Keyboard: returning to first-point → 4 fields');

                resetForNextPointFirstPhase();
                focusSoon(xInputRef, 50);
              }
              return;
            }
          }

          if (activeField === 'angle') {
            // Angle → unlock Length
            setFieldUnlocked(prev => ({ ...prev, length: true }));
            setActiveField('length');
            focusSoon(lengthInputRef);
            if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log('🔄 Angle → Length unlocked');
            return;
          }

          if (activeField === 'length') {
            // πλήρης γραμμή με X+Y+Angle+Length
            if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log('🔄 Length Enter → Creating complete line and staying at 4 fields');
            
            const xNum = xValue.trim() !== '' ? parseFloat(normalizeNumber(xValue)) : null;
            const yNum = yValue.trim() !== '' ? parseFloat(normalizeNumber(yValue)) : null;
            const angleNum = angleValue.trim() !== '' ? parseFloat(normalizeNumber(angleValue)) : 0;
            const lengthNum = lengthValue.trim() !== '' ? parseFloat(normalizeNumber(lengthValue)) : 100;

            if (xNum !== null && yNum !== null) {
              if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log(`🎯 DISPATCHING LINE CREATE EVENT:`, { start: {x: xNum, y: yNum}, angle: angleNum, length: lengthNum });
              
              CADFeedback.onInputConfirm();

              dispatchDynamicSubmit({
                tool: activeTool,
                coordinates: { x: xNum, y: yNum },
                angle: angleNum,
                length: lengthNum,
                action: 'create-line-second-point',
              });
            }

            // κίτρινο highlight
            setIsCoordinateAnchored({ x: true, y: true });
            if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log('🟡 Setting coordinates as anchored (yellow highlight)');

            // παραμονή σε first-point (4 πεδία) για επόμενη γραμμή
            drawingPhaseRef.current = 'first-point';
            setDrawingPhase('first-point');
            if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log('🔄 Keyboard: staying in first-point → 4 fields (complete line created)');

            resetForNextPointFirstPhase();
            focusSoon(xInputRef, 50);
            return;
          }
        }

        // ----- TOOL: CIRCLE/CIRCLE-DIAMETER/CIRCLE-2P-DIAMETER -----
        if (activeTool === 'circle' || activeTool === 'circle-diameter' || activeTool === 'circle-2p-diameter') {
          if (activeField === 'x' && currentValue !== '') {
            // X → lock X and unlock Y
            setFieldUnlocked({ x: false, y: true, angle: false, length: false, radius: false, diameter: false });
            setActiveField('y');
            focusAndSelect(yInputRef);
            if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log('🔄 Circle X → locked X, unlocked Y');
            return;
          }

          if (activeField === 'y' && currentValue !== '') {
            if (drawingPhase === 'first-point') {
              // Center point complete → dispatch center and switch to radius phase
              if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log('🔄 Circle Y Enter (center point) → switching to radius entry');
              
              const xNum = xValue.trim() !== '' ? parseFloat(normalizeNumber(xValue)) : null;
              const yNum = yValue.trim() !== '' ? parseFloat(normalizeNumber(yValue)) : null;
              if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log('🔢 Circle values:', { xValue, yValue, xNum, yNum });

              if (xNum !== null && yNum !== null) {
                if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log('✅ Both X,Y values are valid, proceeding...');
                if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log(`🎯 DISPATCHING CIRCLE CENTER EVENT:`, { center: {x: xNum, y: yNum} });
                
                CADFeedback.onInputConfirm();

                // Dispatch center point
                dispatchDynamicSubmit({
                  tool: activeTool,
                  coordinates: { x: xNum, y: yNum },
                  action: 'create-circle-center',
                });

                // Store center coordinates for radius phase
                setFirstClickPoint({ x: xNum, y: yNum });
                if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log('💾 Stored circle center for radius phase:', { x: xNum, y: yNum });

                // Highlight center coordinates
                setIsCoordinateAnchored({ x: true, y: true });
                if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log('🟡 Setting center coordinates as anchored (yellow highlight)');

                // Switch to second phase (radius/diameter entry)
                drawingPhaseRef.current = 'second-point';
                setDrawingPhase('second-point');
                
                if (activeTool === 'circle') {
                  if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log('🔄 Circle: switching to second-point → radius field');
                  // Unlock radius field and focus it with auto-select
                  if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log('🔓 UNLOCKING radius field...');
                  setFieldUnlocked({ x: false, y: false, angle: false, length: false, radius: true, diameter: false });
                  setActiveField('radius');
                  if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log('🎯 Setting activeField to radius');
                  if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log('🎯 radiusInputRef current:', radiusInputRef.current);
                  // Add delay to allow radius field to render
                  setTimeout(() => {
                    if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log('🎯 radiusInputRef after delay:', radiusInputRef.current);
                    if (radiusInputRef.current) {
                      focusAndSelect(radiusInputRef);
                      if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log('🎯 Focus and select radius field successful');
                    } else {
                      if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log('⚠️ radiusInputRef still null after delay');
                    }
                  }, 150);
                  if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log('🎯 Focus and select radius field scheduled');
                } else if (activeTool === 'circle-diameter') {
                  if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log('🔄 Circle-Diameter: switching to second-point → diameter field');
                  // Unlock diameter field and focus it with auto-select
                  if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log('🔓 UNLOCKING diameter field...');
                  setFieldUnlocked({ x: false, y: false, angle: false, length: false, radius: false, diameter: true });
                  setActiveField('diameter');
                  if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log('🎯 Setting activeField to diameter');
                  if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log('🎯 diameterInputRef current:', diameterInputRef.current);
                  // Add delay to allow diameter field to render
                  setTimeout(() => {
                    if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log('🎯 diameterInputRef after delay:', diameterInputRef.current);
                    if (diameterInputRef.current) {
                      focusAndSelect(diameterInputRef);
                      if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log('🎯 Focus and select diameter field successful');
                    } else {
                      if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log('⚠️ diameterInputRef still null after delay');
                    }
                  }, 150);
                  if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log('🎯 Focus and select diameter field scheduled');
                } else if (activeTool === 'circle-2p-diameter') {
                  if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log('🔄 Circle-2P-Diameter: first point complete → registering and preparing for second point');
                  // Στείλε το πρώτο σημείο
                  dispatchDynamicSubmit({
                    tool: activeTool,
                    coordinates: { x: xNum, y: yNum },
                    action: 'create-circle-2p-diameter-first-point',
                  });
                  // Store first point for second phase
                  setFirstClickPoint({ x: xNum, y: yNum });
                  if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log('💾 Stored 2P-diameter first point:', { x: xNum, y: yNum });
                  // Highlight coordinates
                  setIsCoordinateAnchored({ x: true, y: true });
                  
                  // Switch to second-point phase
                  drawingPhaseRef.current = 'second-point';
                  setDrawingPhase('second-point');
                  
                  // Set up for second point coordinates
                  setFieldUnlocked({ x: true, y: false, angle: false, length: false, radius: false, diameter: false });
                  setActiveField('x'); // Focus X για το δεύτερο σημείο
                  setTimeout(() => {
                    if (xInputRef.current) {
                      xInputRef.current.focus();
                      xInputRef.current.select();
                    }
                  }, 150);
                  if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log('🎯 Circle-2P-Diameter: switched to second-point phase');
                }
              }
              return;
            }
          }

          if (activeField === 'radius' && currentValue !== '') {
            // Radius entry complete → create circle and reset
            if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log('🔄 Circle Radius Enter → Creating circle and returning to X,Y');
            
            const xNum = xValue.trim() !== '' ? parseFloat(normalizeNumber(xValue)) : null;
            const yNum = yValue.trim() !== '' ? parseFloat(normalizeNumber(yValue)) : null;
            const radiusNum = radiusValue.trim() !== '' ? parseFloat(normalizeNumber(radiusValue)) : 50;

            if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log(`🎯 DISPATCHING CIRCLE CREATE EVENT:`, { center: { x: xNum, y: yNum }, radius: radiusNum });
            
            CADFeedback.onInputConfirm();

            dispatchDynamicSubmit({
              tool: activeTool,
              coordinates: { x: xNum!, y: yNum! },
              length: radiusNum,
              action: 'create-circle-radius',
            });

            // Reset to first phase for new circle
            drawingPhaseRef.current = 'first-point';
            setDrawingPhase('first-point');
            if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log('🔄 Circle: returning to first-point → X,Y fields');

            // Clear firstClickPoint to prevent auto second-point phase
            setFirstClickPoint(null);
            if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log('🗑️ Cleared firstClickPoint after circle creation');

            // Reset για επόμενο κύκλο χρησιμοποιώντας την υπάρχουσα κοινή λογική
            resetForNextPointFirstPhase();
            focusSoon(xInputRef, 50);
            return;
          }

          if (activeField === 'diameter' && currentValue !== '') {
            // Diameter entry complete → create circle and reset
            if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log('🔄 Circle Diameter Enter → Creating circle and returning to X,Y');
            
            const xNum = xValue.trim() !== '' ? parseFloat(normalizeNumber(xValue)) : null;
            const yNum = yValue.trim() !== '' ? parseFloat(normalizeNumber(yValue)) : null;
            const diameterNum = diameterValue.trim() !== '' ? parseFloat(normalizeNumber(diameterValue)) : 100;
            const radiusNum = diameterNum / 2; // Convert diameter to radius for the circle entity

            if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log(`🎯 DISPATCHING CIRCLE CREATE EVENT:`, { center: { x: xNum, y: yNum }, diameter: diameterNum, radius: radiusNum });
            
            CADFeedback.onInputConfirm();

            dispatchDynamicSubmit({
              tool: activeTool,
              coordinates: { x: xNum!, y: yNum! },
              length: radiusNum, // Handler expects radius as length
              action: 'create-circle-diameter',
            });

            // Reset to first phase for new circle
            drawingPhaseRef.current = 'first-point';
            setDrawingPhase('first-point');
            if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log('🔄 Circle-Diameter: returning to first-point → X,Y fields');

            // Clear firstClickPoint to prevent auto second-point phase
            setFirstClickPoint(null);
            if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log('🗑️ Cleared firstClickPoint after circle creation');

            // Reset για επόμενο κύκλο χρησιμοποιώντας την υπάρχουσα κοινή λογική
            resetForNextPointFirstPhase();
            focusSoon(xInputRef, 50);
            return;
          }
        }

        // ----- SPECIAL HANDLING FOR CIRCLE-2P-DIAMETER SECOND POINT -----
        if (activeTool === 'circle-2p-diameter' && drawingPhase === 'second-point') {
          if (activeField === 'x' && currentValue !== '') {
            // X για δεύτερο σημείο → unlock Y
            setFieldUnlocked(prev => ({ ...prev, y: true }));
            setActiveField('y');
            focusSoon(yInputRef);
            if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log('🔄 2P-Diameter second point: X → Y unlocked');
            return;
          }
          
          if (activeField === 'y' && currentValue !== '') {
            // Y για δεύτερο σημείο → δημιουργία κύκλου
            if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log('🔄 Circle-2P-Diameter: Y complete → Creating circle and reset');
            
            const xNum = xValue.trim() !== '' ? parseFloat(normalizeNumber(xValue)) : null;
            const yNum = yValue.trim() !== '' ? parseFloat(normalizeNumber(yValue)) : null;
            
            if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log('🔍 DEBUG 2P-Diameter values:', { xNum, yNum, firstClickPoint });
            if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log('🔍 DEBUG 2P-Diameter firstClickPointRef:', firstClickPoint, 'from state/ref');
            
            if (xNum !== null && yNum !== null && firstClickPoint) {
              // Δημιουργία κύκλου από δύο σημεία διαμέτρου
              const p1 = firstClickPoint;
              const p2 = { x: xNum, y: yNum };
              
              if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log('🎯 DISPATCHING 2P-DIAMETER CIRCLE CREATE EVENT:', { p1, p2 });
              dispatchDynamicSubmit({
                tool: activeTool,
                coordinates: p1, // Στέλνουμε το πρώτο σημείο  
                secondPoint: p2, // Και το δεύτερο σημείο
                action: 'create-circle-2p-diameter',
              });
              
              // Reset to first phase for new circle AFTER creating the circle
              drawingPhaseRef.current = 'first-point';
              setDrawingPhase('first-point');
              if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log('🔄 Circle-2P-Diameter: returning to first-point → X,Y fields');
              
              // Clear firstClickPoint to prevent auto second-point phase
              setFirstClickPoint(null);
              if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log('🗑️ Cleared firstClickPoint after 2P-diameter circle creation');

              // Reset για επόμενο κύκλο
              resetForNextPointFirstPhase();
              focusSoon(xInputRef, 50);
            } else {
              if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log('❌ Cannot create circle - missing values:', { 
                xValid: xNum !== null, 
                yValid: yNum !== null, 
                hasFirstPoint: !!firstClickPoint 
              });
            }
            return;
          }
        }

        // ----- OTHER TOOLS (default X → Y → Length → create point) -----
        if (activeTool !== 'line' && activeTool !== 'circle' && activeTool !== 'circle-diameter' && activeTool !== 'circle-2p-diameter') {
          if (activeField === 'x' && currentValue !== '') {
            setActiveField('y');
            focusSoon(yInputRef);
            return;
          }
          if (activeField === 'y' && currentValue !== '') {
            setActiveField('length');
            focusSoon(lengthInputRef);
            return;
          }
          if (activeField === 'length') {
            const xNum = xValue.trim() !== '' ? parseFloat(normalizeNumber(xValue)) : null;
            const yNum = yValue.trim() !== '' ? parseFloat(normalizeNumber(yValue)) : null;
            const lengthNum = lengthValue.trim() !== '' ? parseFloat(normalizeNumber(lengthValue)) : null;

            if (xNum !== null && yNum !== null) {
              if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log(`🎯 DISPATCHING POINT CREATE EVENT:`, { x: xNum, y: yNum, length: lengthNum, tool: activeTool });
              
              CADFeedback.onInputConfirm();

              dispatchDynamicSubmit({
                tool: activeTool,
                coordinates: { x: xNum, y: yNum },
                length: lengthNum,
                action: 'create-point',
              });

              setIsCoordinateAnchored({ x: true, y: true });
              if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log('🟡 Setting coordinates as anchored (yellow highlight)');

              // reset inputs (μην αλλάξεις anchored εδώ — αφήνουμε το effect σου να το σβήσει)
              setXValue(''); 
              setYValue(''); 
              setLengthValue('');
              setActiveField('x');
              setIsManualInput({ x: false, y: false });

              focusSoon(xInputRef, 50);
            } else {
              if (DEBUG_DYNAMIC_INPUT_KEYBOARD) console.log('❌ CANNOT CREATE POINT: Missing coordinates', { xNum, yNum });
              CADFeedback.onError();
            }
            return;
          }
        }

        e.preventDefault();
      } else if (e.key === 'Escape') {
        // Reset και κλείσιμο
        setXValue('');
        setYValue('');
        setLengthValue('');
        setShowInput(false);
        e.preventDefault();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [
    showInput,
    activeTool, drawingPhase, activeField,
    xValue, yValue, angleValue, lengthValue,
    setActiveField, setFieldUnlocked, setIsCoordinateAnchored, setIsManualInput,
    setXValue, setYValue, setAngleValue, setLengthValue, setShowInput,
    normalizeNumber, isValidNumber,
    xInputRef, yInputRef, angleInputRef, lengthInputRef, radiusInputRef,
    CADFeedback, dispatchDynamicSubmit, resetForNextPointFirstPhase,
    setDrawingPhase, drawingPhaseRef, focusSoon, focusAndSelect, getCurrentFieldValue,
  ]);
}