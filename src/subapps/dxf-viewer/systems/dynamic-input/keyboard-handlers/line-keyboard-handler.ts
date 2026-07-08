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
// ADR-357 Phase 2b: convert user-typed display-unit length → internal mm.
import { fromDisplay } from '../../../config/units';
// ADR-357 Phase 6: coordinate input parser.
import { parseCoordInput, applyCoordMode } from '../coordinate-parser';
// ADR-510 Φ1 (E2): math in the length/angle fields (e.g. "1500+300", "3000/2").
import { evalExpr } from '../numeric-expression';
// 🏢 ADR-513: Centralized polar point (SSoT for angle+distance → Point2D).
import { polarPoint } from '../radial-ring-logic';

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
    coordMode, displayUnit,
  } = context;
  const {
    setActiveField, setFieldUnlocked, setIsCoordinateAnchored, setDrawingPhase,
    dispatchDynamicSubmit, resetForNextPointFirstPhase, CADFeedback, focusSoon,
  } = actions;

  // ADR-357/510 — κοινό post-submit: confirm feedback + anchor + rearm του
  // first-point cycle (μοιράζεται coordinate-input & length/angle submit paths).
  const confirmAndRearm = (): void => {
    CADFeedback.onInputConfirm();
    setIsCoordinateAnchored({ x: true, y: true });
    refs.drawingPhaseRef.current = 'first-point';
    setDrawingPhase('first-point');
    resetForNextPointFirstPhase();
    setActiveField('length');
    setFieldUnlocked(prev => ({ ...prev, length: true, angle: false }));
    focusSoon(refs.lengthInputRef, INPUT_TIMING.FOCUS_DEFAULT);
  };

  // X / Y are not part of the line Tab cycle — fall through to default handler.
  if (activeField !== 'length' && activeField !== 'angle') {
    return false;
  }

  // Length pressed without a value → no-op.
  if (activeField === 'length' && lengthValue.trim() === '') {
    return false;
  }

  // ADR-357 Phase 6: try coordinate input BEFORE length/angle calc.
  // Applies coordMode prefix then parses all 4 syntax patterns.
  const rawFieldText = activeField === 'length' ? lengthValue : angleValue;
  const coordText = applyCoordMode(rawFieldText, coordMode);
  const coordPoint = parseCoordInput(coordText, firstClickPoint, displayUnit);
  if (coordPoint) {
    dispatchDynamicSubmit({
      tool: activeTool,
      action: 'add-point',
      coordinates: coordPoint,
    });
    confirmAndRearm();
    return true;
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

  // ADR-510 Φ1 (E2): evaluate each field as an arithmetic expression (a plain
  // number evaluates to itself), so "1500+300" / "3000/2" are accepted directly.
  const lengthDisplay = evalExpr(normalizeNumber(lengthValue));
  const angleNum = evalExpr(normalizeNumber(angleValue));
  if (lengthDisplay === null || angleNum === null ||
      !Number.isFinite(lengthDisplay) || !Number.isFinite(angleNum)) {
    CADFeedback.onError();
    return true;
  }

  // ADR-357 Phase 2b: user typed in display unit → convert to internal mm for world coords.
  const lengthMm = fromDisplay(lengthDisplay, displayUnit);
  const worldPoint = polarPoint(firstClickPoint.x, firstClickPoint.y, lengthMm, angleNum);

  // Dispatch through the drawing pipeline — NO direct entity creation here.
  // Consumer (`useDynamicInputHandler`) maps `add-point` to `onDrawingPoint`.
  dispatchDynamicSubmit({
    tool: activeTool,
    action: 'add-point',
    coordinates: worldPoint,
    length: lengthMm,
    angle: angleNum,
  });

  // Reset for next chain segment — phase tracker rearms first-point logic.
  confirmAndRearm();
  return true;
}
