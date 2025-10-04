/**
 * Field Value Utilities
 * Shared utilities for dynamic input field value management
 */

export type Field = 'x' | 'y' | 'angle' | 'length' | 'radius' | 'diameter';

export interface FieldSetters {
  setXValue: (value: string) => void;
  setYValue: (value: string) => void;
  setAngleValue: (value: string) => void;
  setLengthValue: (value: string) => void;
  setRadiusValue: (value: string) => void;
  setDiameterValue?: (value: string) => void;
}

export interface PhaseResetActions {
  setFirstClickPoint: (point: any) => void;
  setLengthValue: (value: string) => void;
  setFieldUnlocked: (fields: Record<string, boolean>) => void;
  setActiveField: (field: Field) => void;
}

/**
 * Set field value using the appropriate setter
 */
export function setFieldValue(
  field: Field,
  value: string,
  setters: FieldSetters
): void {
  switch (field) {
    case 'x': setters.setXValue(value); break;
    case 'y': setters.setYValue(value); break;
    case 'angle': setters.setAngleValue(value); break;
    case 'length': setters.setLengthValue(value); break;
    case 'radius': setters.setRadiusValue(value); break;
    case 'diameter': 
      if (setters.setDiameterValue) {
        setters.setDiameterValue(value);
      }
      break;
  }
}

/**
 * Reset phase for new shape/measurement
 */
export function resetPhaseForNewShape(actions: PhaseResetActions): void {
  actions.setFirstClickPoint(null);
  actions.setLengthValue('');
  actions.setFieldUnlocked({ x: true, y: false, angle: false, length: false, radius: false });
  actions.setActiveField('x');
}