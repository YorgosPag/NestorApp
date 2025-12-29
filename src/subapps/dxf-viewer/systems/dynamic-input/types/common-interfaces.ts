/**
 * Common Interfaces for Dynamic Input System
 * Shared interface definitions to eliminate duplication
 */

import type { Dispatch, SetStateAction } from 'react';
import type { Point2D, Phase } from '../../../rendering/types/Types';

export type Field = 'x' | 'y' | 'angle' | 'length' | 'radius' | 'diameter';

/**
 * 🏢 ENTERPRISE: Standardized Field State Types
 * Single source of truth για field boolean states
 */
export interface FullFieldState {
  x: boolean;
  y: boolean;
  angle: boolean;
  length: boolean;
  radius: boolean;
  diameter: boolean;
}

export interface CoordinateFieldState {
  x: boolean;
  y: boolean;
}

export interface ManualInputState {
  x: boolean;
  y: boolean;
  radius: boolean;
}

export interface CircleFieldState {
  x: boolean;
  y: boolean;
  angle: boolean;
  length: boolean;
  radius: boolean;
}

/**
 * Common field values used across multiple hooks
 */
export interface FieldValues {
  xValue: string;
  yValue: string;
  angleValue: string;
  lengthValue: string;
  radiusValue: string;
  diameterValue: string;
}

/**
 * Common field value setters used across multiple hooks
 */
export interface FieldValueSetters {
  setXValue: (v: string) => void;
  setYValue: (v: string) => void;
  setAngleValue: (v: string) => void;
  setLengthValue: (v: string) => void;
  setRadiusValue: (v: string) => void;
  setDiameterValue: (v: string) => void;
}

/**
 * 🏢 ENTERPRISE: Common field state management using centralized types
 * ZERO HARDCODED interface definitions - all using standardized types
 */
export interface FieldStateManagement {
  setActiveField: (f: Field) => void;
  setFieldUnlocked: (u: FullFieldState) => void;
  setIsManualInput: (s: ManualInputState) => void;
}

/**
 * Combined common dynamic input actions
 */
export interface CommonDynamicInputActions extends FieldValueSetters, FieldStateManagement {
  setFirstClickPoint: (p: Point2D | null) => void;
}