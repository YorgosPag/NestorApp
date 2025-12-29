'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { Field, Phase } from './useDynamicInputState';
import type { CircleFieldState, CoordinateFieldState, ManualInputState } from '../types/common-interfaces';

/**
 * Interface for field value management
 */
export interface FieldValueActions {
  getValue: (field: Field) => string;
  setValue: (field: Field, value: string) => void;
  getValues: () => {
    x: string;
    y: string;
    angle: string;
    length: string;
    radius: string;
  };
}

/**
 * Interface for field state management (active, locked, etc)
 */
export interface FieldStateActions {
  getActiveField: () => Field;
  setActiveField: (field: Field) => void;
  isFieldUnlocked: (field: Field) => boolean;
  setFieldUnlocked: (state: CircleFieldState) => void;
}

/**
 * Interface for coordinate anchoring/highlighting
 */
export interface CoordinateActions {
  anchorCoordinates: (state: CoordinateFieldState) => void;
  setManualInput: (state: ManualInputState) => void;
}

/**
 * Interface for phase management
 */
export interface PhaseActions {
  getCurrentPhase: () => Phase;
  setPhase: (phase: Phase) => void;
  getPhaseRef: () => React.MutableRefObject<Phase>;
}

/**
 * Interface for input refs management
 */
export interface InputRefActions {
  focusField: (field: Field) => void;
  getFieldRef: (field: Field) => React.RefObject<HTMLInputElement>;
}

/**
 * Interface for validation
 */
export interface ValidationActions {
  normalizeNumber: (value: string) => string;
  isValidNumber: (value: string) => boolean;
}

/**
 * Interface for feedback and events
 */
export interface FeedbackActions {
  onError: () => void;
  onInputConfirm: () => void;
  dispatchSubmit: (detail: unknown) => void;
}

/**
 * Interface for reset actions
 */
export interface ResetActions {
  resetForNextPoint: () => void;
  setShowInput: (show: boolean) => void;
}