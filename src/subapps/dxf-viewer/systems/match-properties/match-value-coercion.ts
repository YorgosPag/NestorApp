/**
 * ADR-581 — Value coercion (source value → target-συμβατή τιμή).
 *
 * Δεύτερη γραμμή άμυνας μετά το mapping: επιβάλλει unit/type συμβατότητα, κάνει
 * clamp αριθμών στα όρια του target descriptor, απορρίπτει άγνωστες enum τιμές,
 * και μεταφέρει το χρώμα ατομικά. Επιστρέφει `COERCE_SKIP` όταν δεν υπάρχει
 * ασφαλής τιμή → ο applier παραλείπει το πεδίο.
 */

import {
  COERCE_SKIP,
  type ColorValue,
  type CoerceResult,
  type MatchablePropertyDescriptor,
  type MatchableValue,
} from './match-types';

function clampNumber(value: number, min?: number, max?: number): number {
  let out = value;
  if (min !== undefined && out < min) out = min;
  if (max !== undefined && out > max) out = max;
  return out;
}

/** Coerce μιας source τιμής ώστε να γραφτεί με ασφάλεια στον target descriptor. */
export function coerceValue(
  value: MatchableValue | undefined,
  source: MatchablePropertyDescriptor,
  target: MatchablePropertyDescriptor,
): CoerceResult {
  if (value === undefined || value === null) return COERCE_SKIP;

  // Type & unit guards (mapping συνήθως τα εγγυάται — εδώ belt-and-suspenders).
  if (source.valueType !== target.valueType) return COERCE_SKIP;
  if (source.unit !== target.unit && source.unit !== 'none' && target.unit !== 'none') {
    return COERCE_SKIP;
  }

  switch (target.valueType) {
    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return COERCE_SKIP;
      return clampNumber(value, target.min, target.max);
    }
    case 'enum': {
      if (typeof value !== 'string') return COERCE_SKIP;
      const allowed = target.enumValues;
      if (allowed && !allowed.includes(value)) return COERCE_SKIP;
      return value;
    }
    case 'color': {
      if (typeof value !== 'object') return COERCE_SKIP;
      const c = value as ColorValue;
      // Τουλάχιστον ένα ορισμένο χρωματικό πεδίο, αλλιώς no-op.
      const hasAny =
        c.color !== undefined ||
        c.colorMode !== undefined ||
        c.colorAci !== undefined ||
        c.colorTrueColor !== undefined;
      return hasAny ? c : COERCE_SKIP;
    }
    case 'boolean':
      return typeof value === 'boolean' ? value : COERCE_SKIP;
    case 'string':
      return typeof value === 'string' ? value : COERCE_SKIP;
    default:
      return COERCE_SKIP;
  }
}
