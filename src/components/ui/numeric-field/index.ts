/**
 * Numeric field SSoT — canonical decimal input for the whole app.
 * @see ADR-706
 */
export { NumericField, type NumericFieldProps } from './NumericField';
export { useNumericField, type UseNumericFieldOptions, type UseNumericFieldResult } from './use-numeric-field';
export { evaluateNumericExpression, isNumericExpression } from './numeric-expression';
export {
  clampToBounds,
  formatForDisplay,
  formatForEditing,
  NUDGE_MULTIPLIER,
  nudgeValue,
  resolveDecimalSeparator,
  stripFloatNoise,
  type NumericBounds,
} from './numeric-field-core';
