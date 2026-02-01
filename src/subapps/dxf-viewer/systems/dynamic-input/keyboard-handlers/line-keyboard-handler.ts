/**
 * 🏢 ENTERPRISE: Line Tool Keyboard Handler
 * Strategy Pattern - Handles Tab/Enter/Escape for line drawing tool
 *
 * Flow:
 * - Tab: X → Y → Angle → Length → X cycle
 * - Enter: Progress through fields and create line
 * - Escape: Handled by default handler
 */

import type {
  KeyboardHandler,
  KeyboardHandlerContext,
  KeyboardHandlerActions,
  KeyboardHandlerRefs
} from './types';
// 🏢 ADR-098: Centralized Timing Constants
import { INPUT_TIMING } from '../../../config/timing-config';

/**
 * 🏢 ENTERPRISE: Main Line Keyboard Handler
 */
export const handleLineKeyboard: KeyboardHandler = (
  e,
  keyType,
  context,
  actions,
  refs
) => {
  if (keyType === 'Tab') {
    return handleLineTab(context, actions, refs);
  }

  if (keyType === 'Enter') {
    return handleLineEnter(context, actions, refs);
  }

  // Escape handled by default handler
  return false;
};

/**
 * Tab Navigation for Line Tool
 * X → Y → Angle → Length → X cycle
 */
function handleLineTab(
  context: KeyboardHandlerContext,
  actions: KeyboardHandlerActions,
  refs: KeyboardHandlerRefs
): boolean {
  const { activeField } = context;
  const { setActiveField, focusSoon } = actions;

  if (activeField === 'x') {
    setActiveField('y');
    focusSoon(refs.yInputRef);
    return true;
  }

  if (activeField === 'y') {
    setActiveField('angle');
    focusSoon(refs.angleInputRef);
    return true;
  }

  if (activeField === 'angle') {
    setActiveField('length');
    focusSoon(refs.lengthInputRef);
    return true;
  }

  // length or any other field → back to X
  setActiveField('x');
  focusSoon(refs.xInputRef);
  return true;
}

/**
 * Enter Key Handler for Line Tool
 * Phase-based progression through fields
 */
function handleLineEnter(
  context: KeyboardHandlerContext,
  actions: KeyboardHandlerActions,
  refs: KeyboardHandlerRefs
): boolean {
  const {
    activeField,
    drawingPhase,
    xValue,
    yValue,
    angleValue,
    lengthValue,
    normalizeNumber,
    activeTool
  } = context;

  const {
    setActiveField,
    setFieldUnlocked,
    setIsCoordinateAnchored,
    setDrawingPhase,
    dispatchDynamicSubmit,
    resetForNextPointFirstPhase,
    CADFeedback,
    focusSoon
  } = actions;

  // Get current field value
  const currentValue = getFieldValue(activeField, context).trim();

  // Skip if current field is empty
  if (currentValue === '' && activeField !== 'length') {
    return false;
  }

  // X field → unlock Y
  if (activeField === 'x' && currentValue !== '') {
    setFieldUnlocked(prev => ({ ...prev, y: true }));
    setActiveField('y');
    focusSoon(refs.yInputRef);
    return true;
  }

  // Y field handling (depends on phase)
  if (activeField === 'y' && currentValue !== '') {
    if (drawingPhase === 'first-point') {
      // First point: Y → unlock Angle
      setFieldUnlocked(prev => ({ ...prev, angle: true }));
      setActiveField('angle');
      focusSoon(refs.angleInputRef);
      return true;
    }

    if (drawingPhase === 'second-point') {
      // Second point: complete line with X/Y
      return createLineFromXY(context, actions, refs);
    }
  }

  // Angle field → unlock Length
  if (activeField === 'angle') {
    setFieldUnlocked(prev => ({ ...prev, length: true }));
    setActiveField('length');
    focusSoon(refs.lengthInputRef);
    return true;
  }

  // Length field → create line with X+Y+Angle+Length
  if (activeField === 'length') {
    return createLineFromAngleLength(context, actions, refs);
  }

  return false;
}

/**
 * Create line using X/Y coordinates (second-point phase)
 */
function createLineFromXY(
  context: KeyboardHandlerContext,
  actions: KeyboardHandlerActions,
  refs: KeyboardHandlerRefs
): boolean {
  const { xValue, yValue, normalizeNumber, activeTool } = context;
  const {
    setIsCoordinateAnchored,
    setDrawingPhase,
    dispatchDynamicSubmit,
    resetForNextPointFirstPhase,
    CADFeedback,
    focusSoon
  } = actions;

  const xNum = xValue.trim() !== '' ? parseFloat(normalizeNumber(xValue)) : null;
  const yNum = yValue.trim() !== '' ? parseFloat(normalizeNumber(yValue)) : null;

  if (xNum !== null && yNum !== null) {
    CADFeedback.onInputConfirm();

    dispatchDynamicSubmit({
      tool: activeTool,
      coordinates: { x: xNum, y: yNum },
      action: 'create-line-second-point'
    });

    // Highlight coordinates
    setIsCoordinateAnchored({ x: true, y: true });

    // Reset to first-point phase for new line
    refs.drawingPhaseRef.current = 'first-point';
    setDrawingPhase('first-point');

    resetForNextPointFirstPhase();
    focusSoon(refs.xInputRef, INPUT_TIMING.FOCUS_DEFAULT);
    return true;
  }

  return false;
}

/**
 * Create line using Angle+Length (from first-point phase)
 */
function createLineFromAngleLength(
  context: KeyboardHandlerContext,
  actions: KeyboardHandlerActions,
  refs: KeyboardHandlerRefs
): boolean {
  const { xValue, yValue, angleValue, lengthValue, normalizeNumber, activeTool } = context;
  const {
    setIsCoordinateAnchored,
    setDrawingPhase,
    dispatchDynamicSubmit,
    resetForNextPointFirstPhase,
    CADFeedback,
    focusSoon
  } = actions;

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
      action: 'create-line-second-point'
    });
  }

  // Highlight coordinates
  setIsCoordinateAnchored({ x: true, y: true });

  // Stay in first-point phase for next line
  refs.drawingPhaseRef.current = 'first-point';
  setDrawingPhase('first-point');

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
