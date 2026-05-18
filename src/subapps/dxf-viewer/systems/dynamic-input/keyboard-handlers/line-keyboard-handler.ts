/**
 * Line tool — Dynamic Input keyboard handler (ADR-357 Phase 2a).
 *
 * Tab cycle: Length → Angle → Length (2-cycle, AutoCAD-style, ADR §5.1).
 * Enter on Length (no Angle yet) → unlock+focus Angle.
 * Enter on Angle (Length+Angle present) → compute relative worldPoint from
 *   firstClickPoint and dispatch `{action:'add-point', coordinates}` so the
 *   global drawing pipeline (`useDrawingHandlers.onDrawingPoint`) handles
 *   snap/ortho/polar/styles/CommandHistory/persistence — no direct entity
 *   creation, no `completeEntity()` bypass (ADR §4 G2 regression fix).
 *
 * X/Y fields are intentionally NOT in the Tab cycle for `line` — coordinate
 * input syntax (`100,50`, `@100<45`) lands in Phase 6 via `coordinate-parser`.
 */

import type {
  KeyboardHandler,
  KeyboardHandlerContext,
  KeyboardHandlerActions,
  KeyboardHandlerRefs,
} from './types';
// 🏢 ADR-098: Centralized Timing Constants
import { INPUT_TIMING } from '../../../config/timing-config';
// 🏢 ADR-067: Centralized degrees → radians conversion.
import { degToRad } from '../../../rendering/entities/shared/geometry-utils';
// ADR-357 Phase 2b: convert user-typed display-unit length → internal mm.
import { fromDisplay } from '../../../config/units';

export const handleLineKeyboard: KeyboardHandler = (
  _e,
  keyType,
  context,
  actions,
  refs,
) => {
  if (keyType === 'Tab') {
    return handleLineTab(context, actions, refs);
  }
  if (keyType === 'Enter') {
    return handleLineEnter(context, actions, refs);
  }
  return false;
};

function handleLineTab(
  context: KeyboardHandlerContext,
  actions: KeyboardHandlerActions,
  refs: KeyboardHandlerRefs,
): boolean {
  const { activeField } = context;
  const { setActiveField, setFieldUnlocked, focusSoon } = actions;

  // Outside the Length/Angle cycle (initial X/Y default) → jump to Length.
  if (activeField !== 'length' && activeField !== 'angle') {
    setFieldUnlocked(prev => ({ ...prev, length: true }));
    setActiveField('length');
    focusSoon(refs.lengthInputRef);
    return true;
  }

  // 2-cycle: Length → Angle, Angle → Length.
  if (activeField === 'length') {
    setFieldUnlocked(prev => ({ ...prev, angle: true }));
    setActiveField('angle');
    focusSoon(refs.angleInputRef);
    return true;
  }

  setFieldUnlocked(prev => ({ ...prev, length: true }));
  setActiveField('length');
  focusSoon(refs.lengthInputRef);
  return true;
}

function handleLineEnter(
  context: KeyboardHandlerContext,
  actions: KeyboardHandlerActions,
  refs: KeyboardHandlerRefs,
): boolean {
  const {
    activeField, firstClickPoint, lengthValue, angleValue, normalizeNumber, activeTool,
  } = context;
  const {
    setActiveField, setFieldUnlocked, setIsCoordinateAnchored, setDrawingPhase,
    dispatchDynamicSubmit, resetForNextPointFirstPhase, CADFeedback, focusSoon,
  } = actions;

  // X / Y are not part of the line Tab cycle — fall through to default handler
  // (Phase 6 coordinate syntax will parse direct typing into worldPoint).
  if (activeField !== 'length' && activeField !== 'angle') {
    return false;
  }

  // Length pressed without a value → no-op (let user type, no error feedback).
  if (activeField === 'length' && lengthValue.trim() === '') {
    return false;
  }

  // Length committed but Angle not yet entered → advance the cycle.
  if (activeField === 'length' && angleValue.trim() === '') {
    setFieldUnlocked(prev => ({ ...prev, angle: true }));
    setActiveField('angle');
    focusSoon(refs.angleInputRef);
    return true;
  }

  // Submit requires a first-click anchor (mouse-set in Phase 2a).
  if (!firstClickPoint) {
    CADFeedback.onError();
    return true;
  }

  const lengthDisplay = parseFloat(normalizeNumber(lengthValue));
  const angleNum = parseFloat(normalizeNumber(angleValue));
  if (!Number.isFinite(lengthDisplay) || !Number.isFinite(angleNum)) {
    CADFeedback.onError();
    return true;
  }

  // ADR-357 Phase 2b: user typed in display unit → convert to internal mm for world coords.
  const lengthMm = fromDisplay(lengthDisplay, context.displayUnit);
  const angleRad = degToRad(angleNum);
  const worldPoint = {
    x: firstClickPoint.x + lengthMm * Math.cos(angleRad),
    y: firstClickPoint.y + lengthMm * Math.sin(angleRad),
  };

  // Dispatch through the drawing pipeline — NO direct entity creation here.
  // Consumer (`useDynamicInputHandler`) maps `add-point` to `onDrawingPoint`.
  dispatchDynamicSubmit({
    tool: activeTool,
    action: 'add-point',
    coordinates: worldPoint,
    length: lengthMm,
    angle: angleNum,
  });

  CADFeedback.onInputConfirm();
  setIsCoordinateAnchored({ x: true, y: true });

  // Reset for next chain segment — phase tracker rearms first-point logic.
  refs.drawingPhaseRef.current = 'first-point';
  setDrawingPhase('first-point');
  resetForNextPointFirstPhase();
  setActiveField('length');
  setFieldUnlocked(prev => ({ ...prev, length: true, angle: false }));
  focusSoon(refs.lengthInputRef, INPUT_TIMING.FOCUS_DEFAULT);
  return true;
}
