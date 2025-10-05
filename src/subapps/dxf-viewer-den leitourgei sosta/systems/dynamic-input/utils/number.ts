/**
 * Number utilities for DynamicInput component
 */

/**
 * Normalizes a number string by replacing comma with period
 */
export const normalizeNumber = (value: string): string => {
  return value.replace(',', '.');
};

/**
 * Validates if a string represents a valid number
 */
export const isValidNumber = (value: string): boolean => {
  const normalized = normalizeNumber(value.trim());
  
  // Κενό string, μόνο μείον, ή μόνο τελεία δεν είναι έγκυρα
  if (normalized === '' || normalized === '-' || normalized === '.') return false;
  
  // Επιτρέπουμε μόνο έγκυρους αριθμούς: ακέραιους, δεκαδικούς, αρνητικούς, και το μηδέν
  const numberRegex = /^-?(0|[1-9]\d*)(\.\d+)?$/;
  
  // Ξεχωριστός έλεγχος για το μηδέν (0 ή 0.0 ή -0)
  if (normalized === '0' || normalized === '0.0' || normalized === '-0') return true;
  
  return numberRegex.test(normalized);
};