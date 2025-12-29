'use client';

// DEBUG FLAG - Set to false to disable performance-heavy logging
const DEBUG_DYNAMIC_INPUT_KEYBOARD = false;

import { useEffect, useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { FieldValueSetters, FieldValues, FullFieldState, CoordinateFieldState } from '../types/common-interfaces';
import type { Point2D } from '../../../rendering/types/Types';

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
  setFieldUnlocked: Dispatch<SetStateAction<FullFieldState>>;
  setIsCoordinateAnchored: (s: CoordinateFieldState) => void;
  setIsManualInput: (s: CoordinateFieldState) => void;

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
  dispatchDynamicSubmit: (detail: Point2D & { source: string }) => void;

  // helpers για reset μετά από ενέργειες
  resetForNextPointFirstPhase: () => void;
  
  // circle center coordinates
  firstClickPoint: Point2D | null;
  setFirstClickPoint: (p: Point2D | null) => void;
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

            } else if (activeField === 'y') {
              setActiveField('x');
              focusSoon(xInputRef);

            }
          } else if (drawingPhase === 'second-point') {
            // Phase 2: Radius είναι το μόνο field, δεν χρειάζεται Tab

          }
        } else {
          // Κανονική κυκλική πλοήγηση για άλλα tools: X → Y → Angle → Length → X
          if (activeField === 'x') {
            setActiveField('y');
            focusSoon(yInputRef);

          } else if (activeField === 'y') {
            setActiveField('angle');
            focusSoon(angleInputRef);

          } else if (activeField === 'angle') {
            setActiveField('length');
            focusSoon(lengthInputRef);

          } else {
            setActiveField('x');
            focusSoon(xInputRef);

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

            return;
          }

          if (activeField === 'y' && currentValue !== '') {
            if (drawingPhase === 'first-point') {
              // 1ο σημείο: Y → unlock Angle
              setFieldUnlocked(prev => ({ ...prev, angle: true }));
              setActiveField('angle');
              focusSoon(angleInputRef);

              return;
            } else if (drawingPhase === 'second-point') {
              // 2ο σημείο: ολοκλήρωση γραμμής με X/Y

              const xNum = xValue.trim() !== '' ? parseFloat(normalizeNumber(xValue)) : null;
              const yNum = yValue.trim() !== '' ? parseFloat(normalizeNumber(yValue)) : null;

              if (xNum !== null && yNum !== null) {

                CADFeedback.onInputConfirm();

                dispatchDynamicSubmit({
                  tool: activeTool,
                  coordinates: { x: xNum, y: yNum },
                  action: 'create-line-second-point',
                });

                // κίτρινο highlight
                setIsCoordinateAnchored({ x: true, y: true });

                // reset σε 4 πεδία (first-point) για νέα γραμμή
                drawingPhaseRef.current = 'first-point';
                setDrawingPhase('first-point');

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

            return;
          }

          if (activeField === 'length') {
            // πλήρης γραμμή με X+Y+Angle+Length

            const xNum = xValue.trim() !== '' ? parseFloat(normalizeNumber(xValue)) : null;
            const yNum = yValue.trim() !== '' ? parseFloat(normalizeNumber(yValue)) : null;
            const angleNum = angleValue.trim() !== '' ? parseFloat(normalizeNumber(angleValue)) : 0;
            const lengthNum = lengthValue.trim() !== '' ? parseFloat(normalizeNumber(lengthValue)) : 100;

            if (xNum !== null && yNum !== null) {

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

            // παραμονή σε first-point (4 πεδία) για επόμενη γραμμή
            drawingPhaseRef.current = 'first-point';
            setDrawingPhase('first-point');

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

            return;
          }

          if (activeField === 'y' && currentValue !== '') {
            if (drawingPhase === 'first-point') {
              // Center point complete → dispatch center and switch to radius phase

              const xNum = xValue.trim() !== '' ? parseFloat(normalizeNumber(xValue)) : null;
              const yNum = yValue.trim() !== '' ? parseFloat(normalizeNumber(yValue)) : null;

              if (xNum !== null && yNum !== null) {

                CADFeedback.onInputConfirm();

                // Dispatch center point
                dispatchDynamicSubmit({
                  tool: activeTool,
                  coordinates: { x: xNum, y: yNum },
                  action: 'create-circle-center',
                });

                // Store center coordinates for radius phase
                setFirstClickPoint({ x: xNum, y: yNum });

                // Highlight center coordinates
                setIsCoordinateAnchored({ x: true, y: true });

                // Switch to second phase (radius/diameter entry)
                drawingPhaseRef.current = 'second-point';
                setDrawingPhase('second-point');
                
                if (activeTool === 'circle') {

                  // Unlock radius field and focus it with auto-select

                  setFieldUnlocked({ x: false, y: false, angle: false, length: false, radius: true, diameter: false });
                  setActiveField('radius');

                  // Add delay to allow radius field to render
                  setTimeout(() => {

                    if (radiusInputRef.current) {
                      focusAndSelect(radiusInputRef);

                    } else {

                    }
                  }, 150);

                } else if (activeTool === 'circle-diameter') {

                  // Unlock diameter field and focus it with auto-select

                  setFieldUnlocked({ x: false, y: false, angle: false, length: false, radius: false, diameter: true });
                  setActiveField('diameter');

                  // Add delay to allow diameter field to render
                  setTimeout(() => {

                    if (diameterInputRef.current) {
                      focusAndSelect(diameterInputRef);

                    } else {

                    }
                  }, 150);

                } else if (activeTool === 'circle-2p-diameter') {

                  // Στείλε το πρώτο σημείο
                  dispatchDynamicSubmit({
                    tool: activeTool,
                    coordinates: { x: xNum, y: yNum },
                    action: 'create-circle-2p-diameter-first-point',
                  });
                  // Store first point for second phase
                  setFirstClickPoint({ x: xNum, y: yNum });

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

                }
              }
              return;
            }
          }

          if (activeField === 'radius' && currentValue !== '') {
            // Radius entry complete → create circle and reset

            const xNum = xValue.trim() !== '' ? parseFloat(normalizeNumber(xValue)) : null;
            const yNum = yValue.trim() !== '' ? parseFloat(normalizeNumber(yValue)) : null;
            const radiusNum = radiusValue.trim() !== '' ? parseFloat(normalizeNumber(radiusValue)) : 50;

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

            // Clear firstClickPoint to prevent auto second-point phase
            setFirstClickPoint(null);

            // Reset για επόμενο κύκλο χρησιμοποιώντας την υπάρχουσα κοινή λογική
            resetForNextPointFirstPhase();
            focusSoon(xInputRef, 50);
            return;
          }

          if (activeField === 'diameter' && currentValue !== '') {
            // Diameter entry complete → create circle and reset

            const xNum = xValue.trim() !== '' ? parseFloat(normalizeNumber(xValue)) : null;
            const yNum = yValue.trim() !== '' ? parseFloat(normalizeNumber(yValue)) : null;
            const diameterNum = diameterValue.trim() !== '' ? parseFloat(normalizeNumber(diameterValue)) : 100;
            const radiusNum = diameterNum / 2; // Convert diameter to radius for the circle entity

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

            // Clear firstClickPoint to prevent auto second-point phase
            setFirstClickPoint(null);

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

            return;
          }
          
          if (activeField === 'y' && currentValue !== '') {
            // Y για δεύτερο σημείο → δημιουργία κύκλου

            const xNum = xValue.trim() !== '' ? parseFloat(normalizeNumber(xValue)) : null;
            const yNum = yValue.trim() !== '' ? parseFloat(normalizeNumber(yValue)) : null;

            if (xNum !== null && yNum !== null && firstClickPoint) {
              // Δημιουργία κύκλου από δύο σημεία διαμέτρου
              const p1 = firstClickPoint;
              const p2 = { x: xNum, y: yNum };

              dispatchDynamicSubmit({
                tool: activeTool,
                coordinates: p1, // Στέλνουμε το πρώτο σημείο  
                secondPoint: p2, // Και το δεύτερο σημείο
                action: 'create-circle-2p-diameter',
              });
              
              // Reset to first phase for new circle AFTER creating the circle
              drawingPhaseRef.current = 'first-point';
              setDrawingPhase('first-point');

              // Clear firstClickPoint to prevent auto second-point phase
              setFirstClickPoint(null);

              // Reset για επόμενο κύκλο
              resetForNextPointFirstPhase();
              focusSoon(xInputRef, 50);
            } else {

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

              CADFeedback.onInputConfirm();

              dispatchDynamicSubmit({
                tool: activeTool,
                coordinates: { x: xNum, y: yNum },
                length: lengthNum,
                action: 'create-point',
              });

              setIsCoordinateAnchored({ x: true, y: true });

              // reset inputs (μην αλλάξεις anchored εδώ — αφήνουμε το effect σου να το σβήσει)
              setXValue(''); 
              setYValue(''); 
              setLengthValue('');
              setActiveField('x');
              setIsManualInput({ x: false, y: false });

              focusSoon(xInputRef, 50);
            } else {

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