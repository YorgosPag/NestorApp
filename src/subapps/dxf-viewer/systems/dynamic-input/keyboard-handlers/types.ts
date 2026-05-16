/**
 * 🏢 ENTERPRISE: Keyboard Handler Types
 * Strategy Pattern - Type definitions for tool-specific keyboard handlers
 *
 * ADR: useDynamicInputKeyboard Refactoring
 * - Reduces useEffect dependencies from 27 to 2
 * - Enables modular tool-specific handlers
 * - Follows patterns from useCentralizedMouseHandlers.ts
 */

import type { Dispatch, SetStateAction, RefObject, MutableRefObject } from 'react';
import type { Point2D } from '../../../rendering/types/Types';
import type { DynamicSubmitDetail } from '../utils/events';
import type {
  Field,
  FullFieldState,
  CoordinateFieldState,
  ManualInputState,
  StairField
} from '../types/common-interfaces';

// Re-export Phase type for convenience
export type Phase = 'first-point' | 'second-point' | 'continuous';

/**
 * 🏢 ENTERPRISE: Keyboard Handler Context (Read-Only State)
 * All values accessed via useRef.current for stable references
 */
export interface KeyboardHandlerContext {
  // Current field values (readonly)
  readonly xValue: string;
  readonly yValue: string;
  readonly angleValue: string;
  readonly lengthValue: string;
  readonly radiusValue: string;
  readonly diameterValue: string;

  // ADR-358 Phase 7b2b-β Stream E — stair-specific field values (rise/tread/width in mm).
  readonly riseValue: string;
  readonly treadValue: string;
  readonly widthValue: string;

  // Current state (readonly)
  readonly activeField: Field;
  /** ADR-358 Phase 7b2b-β Stream E — active stair field for Tab cycling. */
  readonly activeStairField: StairField;
  readonly drawingPhase: Phase;
  readonly firstClickPoint: Point2D | null;
  readonly activeTool: string;

  // Validators
  readonly normalizeNumber: (v: string) => string;
  readonly isValidNumber: (v: string) => boolean;
}

/**
 * 🏢 ENTERPRISE: Keyboard Handler Actions (Mutators)
 * All callbacks for state updates
 */
export interface KeyboardHandlerActions {
  // Field navigation
  setActiveField: (f: Field) => void;

  // State updates
  setFieldUnlocked: Dispatch<SetStateAction<FullFieldState>>;
  setDrawingPhase: (p: Phase) => void;
  setIsCoordinateAnchored: (s: CoordinateFieldState) => void;
  setIsManualInput: (s: ManualInputState) => void;

  // Value setters
  setXValue: (v: string) => void;
  setYValue: (v: string) => void;
  setAngleValue: (v: string) => void;
  setLengthValue: (v: string) => void;
  setRadiusValue: (v: string) => void;
  setDiameterValue: (v: string) => void;
  setShowInput: (show: boolean) => void;

  // ADR-358 Phase 7b2b-β Stream E — stair-specific setters + active-field cycler.
  setRiseValue: (v: string) => void;
  setTreadValue: (v: string) => void;
  setWidthValue: (v: string) => void;
  setActiveStairField: (f: StairField) => void;

  // Circle-specific
  setFirstClickPoint: (p: Point2D | null) => void;

  // Dispatch
  dispatchDynamicSubmit: (detail: DynamicSubmitPayload) => CustomEvent;
  resetForNextPointFirstPhase: () => void;

  // Feedback
  CADFeedback: {
    onError: () => void;
    onInputConfirm: () => void;
  };

  // Focus helpers
  focusSoon: (ref: RefObject<HTMLInputElement | null>, ms?: number) => void;
  focusAndSelect: (ref: RefObject<HTMLInputElement | null>, ms?: number) => void;
}

/**
 * 🏢 ENTERPRISE: Input Refs Collection
 */
export interface KeyboardHandlerRefs {
  xInputRef: RefObject<HTMLInputElement | null>;
  yInputRef: RefObject<HTMLInputElement | null>;
  angleInputRef: RefObject<HTMLInputElement | null>;
  lengthInputRef: RefObject<HTMLInputElement | null>;
  radiusInputRef: RefObject<HTMLInputElement | null>;
  diameterInputRef: RefObject<HTMLInputElement | null>;
  // ADR-358 Phase 7b2b-β Stream E — stair-specific input refs.
  riseInputRef: RefObject<HTMLInputElement | null>;
  treadInputRef: RefObject<HTMLInputElement | null>;
  widthInputRef: RefObject<HTMLInputElement | null>;
  drawingPhaseRef: MutableRefObject<Phase>;
}

/**
 * 🏢 ENTERPRISE: Dynamic Submit Payload
 * Unified payload for dispatchDynamicSubmit
 */
export type DynamicSubmitPayload = DynamicSubmitDetail;

/**
 * 🏢 ENTERPRISE: Keyboard Handler Function Signature
 * Returns true if the key was handled, false otherwise
 */
export type KeyboardHandler = (
  e: KeyboardEvent,
  keyType: 'Tab' | 'Enter' | 'Escape',
  context: KeyboardHandlerContext,
  actions: KeyboardHandlerActions,
  refs: KeyboardHandlerRefs
) => boolean;

/**
 * 🏢 ENTERPRISE: Tool Handler Registry Type
 */
export type KeyboardHandlerRegistry = Record<string, KeyboardHandler>;
