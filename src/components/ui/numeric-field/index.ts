/**
 * Numeric field SSoT — canonical decimal input for the whole app.
 * @see ADR-706
 */
export { NumericField, type NumericFieldProps } from './NumericField';
export { CountField, DecimalField, MilliQuantityField, MoneyField, PercentField, type ScaledFieldProps } from './ScaledNumericField';
export { MILLI_QUANTITY_SCALE, modelOfDisplay, MONEY_SCALE, PERCENT_SCALE, type ValueScale } from './scaled-value';
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
