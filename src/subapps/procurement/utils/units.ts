/**
 * Predefined unit-of-measure list for procurement line items (§5.Z.5).
 * Displayed in unit Select; "OTHER" sentinel triggers free-text input.
 */

export const UNITS = [
  'τμχ',
  'm',
  'm²',
  'm³',
  'kg',
  'g',
  'l',
  'ml',
  'ώρα',
  'ημέρα',
  'μήνας',
  'σετ',
  'ζεύγος',
  'πακέτο',
  'ρολό',
  'παλέτα',
] as const;

export type Unit = typeof UNITS[number];

export const OTHER_UNIT = '__other__' as const;

export function isKnownUnit(unit: string): unit is Unit {
  return (UNITS as readonly string[]).includes(unit);
}
