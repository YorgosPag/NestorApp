'use client';

/**
 * 🏢 ENTERPRISE: Dynamic Input Keyboard Hook (Refactored)
 *
 * ARCHITECTURE:
 * - Strategy Pattern: Tool-specific handlers in keyboard-handlers/
 * - useRef Pattern: Stable callback references (no re-registration)
 * - Only 2 useEffect dependencies: showInput, activeTool
 *
 * BEFORE: 554 lines, 27 dependencies, re-registration on every state change
 * AFTER: ~100 lines, 2 dependencies, single registration on mount
 *
 * Pattern inspired by: useCentralizedMouseHandlers.ts (lines 123-406)
 */

import { useEffect, useCallback, useRef } from 'react';
import type { Dispatch, SetStateAction, RefObject, MutableRefObject } from 'react';
import type { FieldValueSetters, FieldValues, FullFieldState, CoordinateFieldState, ManualInputState, Field, StairField } from '../types/common-interfaces';
import type { Point2D } from '../../../rendering/types/Types';
// 🏢 ADR-098: Centralized Timing Constants
import { INPUT_TIMING } from '../../../config/timing-config';
// 🏢 ENTERPRISE: Strategy Pattern - Keyboard Handlers
import {
  getKeyboardHandler,
  looksLikeCoordSyntax,
  type KeyboardHandlerContext,
  type KeyboardHandlerActions,
  type KeyboardHandlerRefs,
  type DynamicSubmitPayload,
  type Phase,
  type CoordMode,
} from '../keyboard-handlers';
import type { DisplayUnit } from '../../../config/units';

interface UseDynamicInputKeyboardArgs extends FieldValueSetters, FieldValues {
  // visibility
  showInput: boolean;

  // tool + phase
  activeTool: string;
  drawingPhase: Phase;
  drawingPhaseRef: MutableRefObject<Phase>;
  setDrawingPhase: (p: Phase) => void;

  // active field
  activeField: Field;
  setActiveField: (f: Field) => void;
  setShowInput: (show: boolean) => void;

  // gating / flags
  setFieldUnlocked: Dispatch<SetStateAction<FullFieldState>>;
  setIsCoordinateAnchored: (s: CoordinateFieldState) => void;
  setIsManualInput: (s: ManualInputState) => void;

  // validators
  normalizeNumber: (v: string) => string;
  isValidNumber: (v: string) => boolean;

  // input refs (for focus)
  xInputRef: RefObject<HTMLInputElement | null>;
  yInputRef: RefObject<HTMLInputElement | null>;
  angleInputRef: RefObject<HTMLInputElement | null>;
  lengthInputRef: RefObject<HTMLInputElement | null>;
  radiusInputRef: RefObject<HTMLInputElement | null>;
  diameterInputRef: RefObject<HTMLInputElement | null>;

  // ADR-358 Phase 7b2b-β Stream E — stair-specific values + setters + refs + active field.
  riseValue: string;
  treadValue: string;
  widthValue: string;
  setRiseValue: (v: string) => void;
  setTreadValue: (v: string) => void;
  setWidthValue: (v: string) => void;
  activeStairField: StairField;
  setActiveStairField: (f: StairField) => void;
  riseInputRef: RefObject<HTMLInputElement | null>;
  treadInputRef: RefObject<HTMLInputElement | null>;
  widthInputRef: RefObject<HTMLInputElement | null>;

  // feedback
  CADFeedback: { onError: () => void; onInputConfirm: () => void };

  // dispatcher for custom events
  dispatchDynamicSubmit: (detail: DynamicSubmitPayload) => CustomEvent;

  // helpers for reset after actions
  resetForNextPointFirstPhase: () => void;

  // circle center coordinates
  firstClickPoint: Point2D | null;
  setFirstClickPoint: (p: Point2D | null) => void;

  // ADR-357 Phase 2b: user-selected display unit
  displayUnit: DisplayUnit;

  // ADR-357 Phase 6: active coordinate input mode (abs/rel/polar)
  coordMode: CoordMode;
}

/**
 * 🏢 ENTERPRISE: Dynamic Input Keyboard Hook
 * Uses Strategy Pattern + useRef for optimal performance
 */
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
    // ADR-358 Phase 7b2b-β Stream E
    riseValue, treadValue, widthValue,
    setRiseValue, setTreadValue, setWidthValue,
    activeStairField, setActiveStairField,
    riseInputRef, treadInputRef, widthInputRef,
    // ADR-357 Phase 2b
    displayUnit,
    // ADR-357 Phase 6
    coordMode,
  } = args;

  // 🏢 ENTERPRISE: Helper for focus with timeout
  const focusSoon = useCallback((ref: RefObject<HTMLInputElement | null>, ms: number = INPUT_TIMING.FOCUS_IMMEDIATE) => {
    setTimeout(() => ref.current?.focus(), ms);
  }, []);

  // 🏢 ENTERPRISE: Helper for focus and auto-select text
  const focusAndSelect = useCallback((ref: RefObject<HTMLInputElement | null>, ms: number = INPUT_TIMING.FOCUS_AND_SELECT) => {
    setTimeout(() => {
      if (ref.current) {
        ref.current.focus();
        ref.current.select();
      }
    }, ms);
  }, []);

  // 🏢 ENTERPRISE PATTERN: useRef for stable context (from useCentralizedMouseHandlers.ts)
  // These refs are updated on every render but don't trigger re-registration
  const contextRef = useRef<KeyboardHandlerContext | null>(null);
  const actionsRef = useRef<KeyboardHandlerActions | null>(null);
  const refsRef = useRef<KeyboardHandlerRefs | null>(null);

  // Update context ref on each render (no useEffect needed - just assignment)
  contextRef.current = {
    xValue,
    yValue,
    angleValue,
    lengthValue,
    radiusValue,
    diameterValue,
    // ADR-358 Phase 7b2b-β Stream E
    riseValue,
    treadValue,
    widthValue,
    activeStairField,
    activeField,
    drawingPhase,
    firstClickPoint,
    activeTool,
    normalizeNumber,
    isValidNumber,
    // ADR-357 Phase 2b
    displayUnit,
    // ADR-357 Phase 6
    coordMode,
  };

  // Update actions ref on each render
  actionsRef.current = {
    setActiveField,
    setFieldUnlocked,
    setDrawingPhase,
    setIsCoordinateAnchored,
    setIsManualInput,
    setXValue,
    setYValue,
    setAngleValue,
    setLengthValue,
    setRadiusValue,
    setDiameterValue,
    setShowInput,
    setFirstClickPoint,
    dispatchDynamicSubmit,
    resetForNextPointFirstPhase,
    CADFeedback,
    focusSoon,
    focusAndSelect,
    // ADR-358 Phase 7b2b-β Stream E
    setRiseValue,
    setTreadValue,
    setWidthValue,
    setActiveStairField,
  };

  // Update refs ref on each render
  refsRef.current = {
    xInputRef,
    yInputRef,
    angleInputRef,
    lengthInputRef,
    radiusInputRef,
    diameterInputRef,
    drawingPhaseRef,
    // ADR-358 Phase 7b2b-β Stream E
    riseInputRef,
    treadInputRef,
    widthInputRef,
  };

  // 🏢 ENTERPRISE PATTERN: Single useEffect with MINIMAL dependencies
  // Handler is re-registered only when showInput or activeTool changes
  useEffect(() => {
    if (!showInput) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Guard: only when overlay is active
      if (!showInput) return;

      // Determine key type
      let keyType: 'Tab' | 'Enter' | 'Escape' | null = null;
      if (e.key === 'Tab') keyType = 'Tab';
      else if (e.key === 'Enter') keyType = 'Enter';
      else if (e.key === 'Escape') keyType = 'Escape';

      if (!keyType) return;

      // Prevent default for all handled keys
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      // Validate current field value (for Enter only).
      // ADR-357 Phase 6: coord syntax (@100,50 / 100<45) bypasses isValidNumber guard.
      if (keyType === 'Enter' && contextRef.current && actionsRef.current) {
        const currentValue = getCurrentFieldValue(contextRef.current);
        if (currentValue !== '' && !contextRef.current.isValidNumber(currentValue)) {
          if (!looksLikeCoordSyntax(currentValue)) {
            actionsRef.current.CADFeedback.onError();
            return;
          }
        }
      }

      // Get handler for current tool using Strategy Pattern
      const handler = getKeyboardHandler(activeTool);

      // Execute handler with current refs
      if (contextRef.current && actionsRef.current && refsRef.current) {
        handler(
          e,
          keyType,
          contextRef.current,
          actionsRef.current,
          refsRef.current
        );
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [showInput, activeTool]); // 🎯 ONLY 2 dependencies!
}

/**
 * Helper to get current field value from context
 */
function getCurrentFieldValue(context: KeyboardHandlerContext): string {
  switch (context.activeField) {
    case 'x': return context.xValue;
    case 'y': return context.yValue;
    case 'angle': return context.angleValue;
    case 'length': return context.lengthValue;
    case 'radius': return context.radiusValue;
    case 'diameter': return context.diameterValue;
    default: return '';
  }
}
