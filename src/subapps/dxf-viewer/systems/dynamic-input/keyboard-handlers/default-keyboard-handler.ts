/**
 * 🏢 ENTERPRISE: Default Keyboard Handler
 * Fallback handler for tools without specific keyboard handling
 *
 * Flow:
 * - Tab: X → Y → Length → X cycle
 * - Enter: X → Y → Length → create point
 * - Escape: Clear values and close input
 */

import type {
  KeyboardHandler,
  KeyboardHandlerContext,
  KeyboardHandlerActions,
  KeyboardHandlerRefs
} from './types';
// 🏢 ADR-098: Centralized Timing Constants
import { INPUT_TIMING } from '../../../config/timing-config';
// ADR-364 Group 3 follow-up — DI cleanup SSoT
import { closeDynamicInput } from './dynamic-input-actions';

/**
 * 🏢 ENTERPRISE: Default Keyboard Handler
 * Used for tools that don't have specific handlers
 */
export const handleDefaultKeyboard: KeyboardHandler = (
  e,
  keyType,
  context,
  actions,
  refs
) => {
  if (keyType === 'Tab') {
    return handleDefaultTab(context, actions, refs);
  }

  if (keyType === 'Enter') {
    return handleDefaultEnter(context, actions, refs);
  }

  if (keyType === 'Escape') {
    return handleDefaultEscape(actions);
  }

  return false;
};

/**
 * Tab Navigation for Default Tools
 * X → Y → Length → X cycle
 */
function handleDefaultTab(
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
 * Enter Key Handler for Default Tools
 * X → Y → Length → create point
 */
function handleDefaultEnter(
  context: KeyboardHandlerContext,
  actions: KeyboardHandlerActions,
  refs: KeyboardHandlerRefs
): boolean {
  const {
    activeField,
    xValue,
    yValue,
    lengthValue,
    normalizeNumber,
    activeTool
  } = context;

  const {
    setActiveField,
    setXValue,
    setYValue,
    setLengthValue,
    setIsCoordinateAnchored,
    setIsManualInput,
    dispatchDynamicSubmit,
    CADFeedback,
    focusSoon
  } = actions;

  // Get current field value
  const currentValue = getFieldValue(activeField, context).trim();

  // X field → go to Y
  if (activeField === 'x' && currentValue !== '') {
    setActiveField('y');
    focusSoon(refs.yInputRef);
    return true;
  }

  // Y field → go to Length
  if (activeField === 'y' && currentValue !== '') {
    setActiveField('length');
    focusSoon(refs.lengthInputRef);
    return true;
  }

  // Length field → create point
  if (activeField === 'length') {
    return createPoint(context, actions, refs);
  }

  return false;
}

/**
 * Create point from X/Y/Length values
 */
function createPoint(
  context: KeyboardHandlerContext,
  actions: KeyboardHandlerActions,
  refs: KeyboardHandlerRefs
): boolean {
  const { xValue, yValue, lengthValue, normalizeNumber, activeTool } = context;
  const {
    setActiveField,
    setXValue,
    setYValue,
    setLengthValue,
    setIsCoordinateAnchored,
    setIsManualInput,
    dispatchDynamicSubmit,
    CADFeedback,
    focusSoon
  } = actions;

  const xNum = xValue.trim() !== '' ? parseFloat(normalizeNumber(xValue)) : null;
  const yNum = yValue.trim() !== '' ? parseFloat(normalizeNumber(yValue)) : null;
  const lengthNum = lengthValue.trim() !== '' ? parseFloat(normalizeNumber(lengthValue)) : null;

  if (xNum !== null && yNum !== null) {
    CADFeedback.onInputConfirm();

    dispatchDynamicSubmit({
      tool: activeTool,
      coordinates: { x: xNum, y: yNum },
      length: lengthNum ?? undefined,
      action: 'create-point'
    });

    setIsCoordinateAnchored({ x: true, y: true });

    // Reset inputs
    setXValue('');
    setYValue('');
    setLengthValue('');
    setActiveField('x');
    setIsManualInput({ x: false, y: false, radius: false });

    focusSoon(refs.xInputRef, INPUT_TIMING.FOCUS_DEFAULT);
    return true;
  }

  CADFeedback.onError();
  return true;
}

/**
 * Escape handler — delegates to the shared `closeDynamicInput` SSoT
 * (ADR-364 Group 3 follow-up). Returns true so legacy callers that still
 * dispatch through the Strategy outside the EscapeCommandBus retain the
 * "consumed" contract.
 */
function handleDefaultEscape(actions: KeyboardHandlerActions): boolean {
  closeDynamicInput(actions);
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
