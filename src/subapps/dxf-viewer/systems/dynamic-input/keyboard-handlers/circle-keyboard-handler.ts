/**
 * 🏢 ENTERPRISE: Circle Tools Keyboard Handler
 * Strategy Pattern - Handles Tab/Enter/Escape for circle drawing tools
 *
 * Supports:
 * - circle (center + radius)
 * - circle-diameter (center + diameter)
 * - circle-2p-diameter (two points defining diameter)
 *
 * Flow:
 * - Phase 1 (first-point): X ↔ Y for center
 * - Phase 2 (second-point): Radius/Diameter or second point
 */

import type {
  KeyboardHandler,
  KeyboardHandlerContext,
  KeyboardHandlerActions,
  KeyboardHandlerRefs
} from './types';
// 🏢 ADR-098: Centralized Timing Constants
import { INPUT_TIMING, FIELD_TIMING } from '../../../config/timing-config';

/**
 * 🏢 ENTERPRISE: Main Circle Keyboard Handler
 * Handles circle, circle-diameter, and circle-2p-diameter tools
 */
export const handleCircleKeyboard: KeyboardHandler = (
  e,
  keyType,
  context,
  actions,
  refs
) => {
  if (keyType === 'Tab') {
    return handleCircleTab(context, actions, refs);
  }

  if (keyType === 'Enter') {
    return handleCircleEnter(context, actions, refs);
  }

  // Escape handled by default handler
  return false;
};

/**
 * Tab Navigation for Circle Tools
 * Phase 1: X ↔ Y
 * Phase 2: No tab needed (single field)
 */
function handleCircleTab(
  context: KeyboardHandlerContext,
  actions: KeyboardHandlerActions,
  refs: KeyboardHandlerRefs
): boolean {
  const { activeField, drawingPhase, activeTool } = context;
  const { setActiveField, focusSoon } = actions;

  if (drawingPhase === 'first-point') {
    // Phase 1: X ↔ Y cycle
    if (activeField === 'x') {
      setActiveField('y');
      focusSoon(refs.yInputRef);
      return true;
    }

    if (activeField === 'y') {
      setActiveField('x');
      focusSoon(refs.xInputRef);
      return true;
    }
  }

  // Phase 2 for circle-2p-diameter: X ↔ Y for second point
  if (drawingPhase === 'second-point' && activeTool === 'circle-2p-diameter') {
    if (activeField === 'x') {
      setActiveField('y');
      focusSoon(refs.yInputRef);
      return true;
    }

    if (activeField === 'y') {
      setActiveField('x');
      focusSoon(refs.xInputRef);
      return true;
    }
  }

  // Phase 2: Radius/Diameter is the only field - no tab needed
  return true;
}

/**
 * Enter Key Handler for Circle Tools
 * Phase-based progression
 */
function handleCircleEnter(
  context: KeyboardHandlerContext,
  actions: KeyboardHandlerActions,
  refs: KeyboardHandlerRefs
): boolean {
  const { activeField, drawingPhase, activeTool } = context;

  // Get current field value
  const currentValue = getFieldValue(activeField, context).trim();

  // Skip if current field is empty
  if (currentValue === '') {
    return false;
  }

  // X field → lock X, unlock Y
  if (activeField === 'x' && currentValue !== '') {
    // Special handling for circle-2p-diameter second-point
    if (activeTool === 'circle-2p-diameter' && drawingPhase === 'second-point') {
      return handleCircle2pSecondPointX(context, actions, refs);
    }

    actions.setFieldUnlocked({ x: false, y: true, angle: false, length: false, radius: false, diameter: false });
    actions.setActiveField('y');
    actions.focusAndSelect(refs.yInputRef);
    return true;
  }

  // Y field handling (depends on phase)
  if (activeField === 'y' && currentValue !== '') {
    if (drawingPhase === 'first-point') {
      return handleCircleCenterComplete(context, actions, refs);
    }

    // circle-2p-diameter second point Y
    if (activeTool === 'circle-2p-diameter' && drawingPhase === 'second-point') {
      return handleCircle2pSecondPointY(context, actions, refs);
    }
  }

  // Radius field → create circle
  if (activeField === 'radius' && currentValue !== '') {
    return handleCircleRadiusComplete(context, actions, refs);
  }

  // Diameter field → create circle
  if (activeField === 'diameter' && currentValue !== '') {
    return handleCircleDiameterComplete(context, actions, refs);
  }

  return false;
}

/**
 * Handle center point complete → switch to radius/diameter phase
 */
function handleCircleCenterComplete(
  context: KeyboardHandlerContext,
  actions: KeyboardHandlerActions,
  refs: KeyboardHandlerRefs
): boolean {
  const { xValue, yValue, normalizeNumber, activeTool } = context;
  const {
    setFieldUnlocked,
    setActiveField,
    setDrawingPhase,
    setFirstClickPoint,
    setIsCoordinateAnchored,
    dispatchDynamicSubmit,
    CADFeedback,
    focusAndSelect
  } = actions;

  const xNum = xValue.trim() !== '' ? parseFloat(normalizeNumber(xValue)) : null;
  const yNum = yValue.trim() !== '' ? parseFloat(normalizeNumber(yValue)) : null;

  if (xNum === null || yNum === null) {
    return false;
  }

  CADFeedback.onInputConfirm();

  // Dispatch center point
  dispatchDynamicSubmit({
    tool: activeTool,
    coordinates: { x: xNum, y: yNum },
    action: 'create-circle-center'
  });

  // Store center coordinates
  setFirstClickPoint({ x: xNum, y: yNum });

  // Highlight center coordinates
  setIsCoordinateAnchored({ x: true, y: true });

  // Switch to second phase
  refs.drawingPhaseRef.current = 'second-point';
  setDrawingPhase('second-point');

  // Tool-specific field setup
  if (activeTool === 'circle') {
    // Unlock radius field
    setFieldUnlocked({ x: false, y: false, angle: false, length: false, radius: true, diameter: false });
    setActiveField('radius');

    // Delay to allow field to render
    setTimeout(() => {
      if (refs.radiusInputRef.current) {
        focusAndSelect(refs.radiusInputRef);
      }
    }, FIELD_TIMING.FIELD_RENDER_DELAY);
  } else if (activeTool === 'circle-diameter') {
    // Unlock diameter field
    setFieldUnlocked({ x: false, y: false, angle: false, length: false, radius: false, diameter: true });
    setActiveField('diameter');

    setTimeout(() => {
      if (refs.diameterInputRef.current) {
        focusAndSelect(refs.diameterInputRef);
      }
    }, FIELD_TIMING.FIELD_RENDER_DELAY);
  } else if (activeTool === 'circle-2p-diameter') {
    // First point dispatched, now set up for second point
    dispatchDynamicSubmit({
      tool: activeTool,
      coordinates: { x: xNum, y: yNum },
      action: 'create-circle-2p-diameter-first-point'
    });

    // Set up for second point coordinates
    setFieldUnlocked({ x: true, y: false, angle: false, length: false, radius: false, diameter: false });
    setActiveField('x');

    setTimeout(() => {
      if (refs.xInputRef.current) {
        refs.xInputRef.current.focus();
        refs.xInputRef.current.select();
      }
    }, FIELD_TIMING.FIELD_RENDER_DELAY);
  }

  return true;
}

/**
 * Handle circle-2p-diameter second point X field
 */
function handleCircle2pSecondPointX(
  context: KeyboardHandlerContext,
  actions: KeyboardHandlerActions,
  refs: KeyboardHandlerRefs
): boolean {
  actions.setFieldUnlocked(prev => ({ ...prev, y: true }));
  actions.setActiveField('y');
  actions.focusSoon(refs.yInputRef);
  return true;
}

/**
 * Handle circle-2p-diameter second point Y field → create circle
 */
function handleCircle2pSecondPointY(
  context: KeyboardHandlerContext,
  actions: KeyboardHandlerActions,
  refs: KeyboardHandlerRefs
): boolean {
  const { xValue, yValue, normalizeNumber, activeTool, firstClickPoint } = context;
  const {
    setDrawingPhase,
    setFirstClickPoint,
    dispatchDynamicSubmit,
    resetForNextPointFirstPhase,
    focusSoon
  } = actions;

  const xNum = xValue.trim() !== '' ? parseFloat(normalizeNumber(xValue)) : null;
  const yNum = yValue.trim() !== '' ? parseFloat(normalizeNumber(yValue)) : null;

  if (xNum === null || yNum === null || !firstClickPoint) {
    return false;
  }

  // Create circle from two diameter points
  const p1 = firstClickPoint;
  const p2 = { x: xNum, y: yNum };

  dispatchDynamicSubmit({
    tool: activeTool,
    coordinates: p1,
    secondPoint: p2,
    action: 'create-circle-2p-diameter'
  });

  // Reset to first phase for new circle
  refs.drawingPhaseRef.current = 'first-point';
  setDrawingPhase('first-point');

  // Clear firstClickPoint
  setFirstClickPoint(null);

  // Reset for next circle
  resetForNextPointFirstPhase();
  focusSoon(refs.xInputRef, INPUT_TIMING.FOCUS_DEFAULT);

  return true;
}

/**
 * Handle radius entry complete → create circle
 */
function handleCircleRadiusComplete(
  context: KeyboardHandlerContext,
  actions: KeyboardHandlerActions,
  refs: KeyboardHandlerRefs
): boolean {
  const { xValue, yValue, radiusValue, normalizeNumber, activeTool } = context;
  const {
    setDrawingPhase,
    setFirstClickPoint,
    dispatchDynamicSubmit,
    resetForNextPointFirstPhase,
    CADFeedback,
    focusSoon
  } = actions;

  const xNum = xValue.trim() !== '' ? parseFloat(normalizeNumber(xValue)) : null;
  const yNum = yValue.trim() !== '' ? parseFloat(normalizeNumber(yValue)) : null;
  const radiusNum = radiusValue.trim() !== '' ? parseFloat(normalizeNumber(radiusValue)) : 50;

  if (xNum === null || yNum === null) {
    return false;
  }

  CADFeedback.onInputConfirm();

  dispatchDynamicSubmit({
    tool: activeTool,
    coordinates: { x: xNum, y: yNum },
    length: radiusNum,
    action: 'create-circle-radius'
  });

  // Reset to first phase
  refs.drawingPhaseRef.current = 'first-point';
  setDrawingPhase('first-point');

  // Clear firstClickPoint
  setFirstClickPoint(null);

  // Reset for next circle
  resetForNextPointFirstPhase();
  focusSoon(refs.xInputRef, INPUT_TIMING.FOCUS_DEFAULT);

  return true;
}

/**
 * Handle diameter entry complete → create circle
 */
function handleCircleDiameterComplete(
  context: KeyboardHandlerContext,
  actions: KeyboardHandlerActions,
  refs: KeyboardHandlerRefs
): boolean {
  const { xValue, yValue, diameterValue, normalizeNumber, activeTool } = context;
  const {
    setDrawingPhase,
    setFirstClickPoint,
    dispatchDynamicSubmit,
    resetForNextPointFirstPhase,
    CADFeedback,
    focusSoon
  } = actions;

  const xNum = xValue.trim() !== '' ? parseFloat(normalizeNumber(xValue)) : null;
  const yNum = yValue.trim() !== '' ? parseFloat(normalizeNumber(yValue)) : null;
  const diameterNum = diameterValue.trim() !== '' ? parseFloat(normalizeNumber(diameterValue)) : 100;
  const radiusNum = diameterNum / 2; // Convert to radius for entity

  if (xNum === null || yNum === null) {
    return false;
  }

  CADFeedback.onInputConfirm();

  dispatchDynamicSubmit({
    tool: activeTool,
    coordinates: { x: xNum, y: yNum },
    length: radiusNum, // Handler expects radius
    action: 'create-circle-diameter'
  });

  // Reset to first phase
  refs.drawingPhaseRef.current = 'first-point';
  setDrawingPhase('first-point');

  // Clear firstClickPoint
  setFirstClickPoint(null);

  // Reset for next circle
  resetForNextPointFirstPhase();
  focusSoon(refs.xInputRef, INPUT_TIMING.FOCUS_DEFAULT);

  return true;
}

/**
 * Helper to get field value from context
 */
function getFieldValue(
  field: string,
  context: KeyboardHandlerContext
): string {
  switch (field) {
    case 'x': return context.xValue;
    case 'y': return context.yValue;
    case 'angle': return context.angleValue;
    case 'length': return context.lengthValue;
    case 'radius': return context.radiusValue;
    case 'diameter': return context.diameterValue;
    default: return '';
  }
}
