/**
 * Number utilities for DynamicInput component.
 *
 * CANONICAL comma→dot normalizer for the DXF viewer (Revit/C4D/Figma-grade
 * el-GR decimal input). This is the SINGLE source of truth — every full-string
 * comma normalization in the subapp routes through {@link normalizeNumber}
 * instead of hand-rolling `.replace(',', '.')`. Enforced by the `comma-normalize`
 * ratchet module in `.ssot-registry.json`.
 */

/**
 * Normalizes a number string by replacing EVERY comma with a period.
 *
 * Uses the global flag (`/,/g`) — a superset of the single-comma replace: a lone
 * decimal value has exactly one comma (identical result), while an arithmetic
 * expression fed to `evalExpr` (e.g. `"1,5+2,5"` from the RadialCommandRing)
 * carries several. One canonical normalizer covers both.
 *
 * NOTE — different level, intentionally NOT centralized here:
 *  - `applyTypedAngleKey` (ADR-397 §15) is a per-keystroke single-char inline
 *    buffer (`key === ',' ? '.'`), not a full-string normalizer.
 *  - `parseGreekDecimal` (`src/lib/number/greek-decimal.ts`) is the app-level
 *    currency SSoT that also interprets `.` as a thousands separator — a
 *    different contract (string→number|null). Do NOT merge the two.
 */
export const normalizeNumber = (value: string): string => {
  return value.replace(/,/g, '.');
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