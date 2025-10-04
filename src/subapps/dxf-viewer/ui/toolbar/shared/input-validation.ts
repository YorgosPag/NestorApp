/**
 * Shared input validation utilities for Scale and Zoom controls
 */

export interface ValidationOptions {
  minValue?: number;
  maxValue?: number;
  defaultValue?: number;
}

/**
 * Normalizes input by cleaning whitespace and converting comma to period
 * @param value - The input string to normalize
 * @param options - Validation options
 * @returns Normalized number value
 */
export function normalizeNumericInput(
  value: string, 
  options: ValidationOptions = {}
): number {
  const { minValue = 1, maxValue = 99999, defaultValue = 100 } = options;
  
  const cleaned = value.trim();
  if (!cleaned) return defaultValue;
  
  const normalized = cleaned.replace(',', '.');
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? defaultValue : Math.max(minValue, Math.min(maxValue, parsed));
}

/**
 * Validates numeric input string
 * @param value - The input string to validate  
 * @param options - Validation options
 * @returns Whether the input is valid
 */
export function validateNumericInput(
  value: string,
  options: ValidationOptions = {}
): boolean {
  const { minValue = 1, maxValue = 99999 } = options;
  
  const cleaned = value.trim();
  if (!cleaned) return false;
  
  const pattern = /^[\d.,]+$/;
  if (!pattern.test(cleaned)) {
    return false;
  }
  
  const normalized = normalizeNumericInput(cleaned, options);
  return normalized >= minValue && normalized <= maxValue;
}