/**
 * Common Interfaces for Dynamic Input System
 * Shared interface definitions to eliminate duplication
 */

import type { Dispatch, SetStateAction } from 'react';
import type { Point2D, Phase } from '../../../rendering/types/Types';

export type Field = 'x' | 'y' | 'angle' | 'length' | 'radius' | 'diameter';

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
 * Common field state management used across multiple hooks
 */
export interface FieldStateManagement {
  setActiveField: (f: Field) => void;
  setFieldUnlocked: (u: { x: boolean; y: boolean; angle: boolean; length: boolean; radius: boolean; diameter: boolean }) => void;
  setIsManualInput: (s: { x: boolean; y: boolean }) => void;
}

/**
 * Combined common dynamic input actions
 */
export interface CommonDynamicInputActions extends FieldValueSetters, FieldStateManagement {
  setFirstClickPoint: (p: Point2D | null) => void;
}