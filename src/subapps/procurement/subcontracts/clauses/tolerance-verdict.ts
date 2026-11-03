/**
 * @fileoverview **Ετυμηγορία ζώνης ανοχής** (ADR-928 §5.2.1) — πού πέφτει μια τιμή σε σχέση με τις ζώνες της.
 * @module subapps/procurement/subcontracts/clauses/tolerance-verdict
 *
 * Βελτίωση πάνω στο Workday Evisort (Preferred / Fallback / Walk away): η έγκριση ζητείται **μόνο** ανάμεσα στο
 * αποδεκτό και στο απαγορευμένο. Η ίδια συνάρτηση κρίνει πρότυπα (Φ1), αποκλίσεις συμφωνητικών (Φ2) και
 * επιφυλάξεις διαγωνισμού (§5.9) — ένας κριτής, όχι τρεις.
 *
 * ⚠️ Προϋπόθεση: η τιμή είναι **ήδη έγκυρη** (`validateParameterValue`). Η ετυμηγορία δεν είναι επικύρωση.
 */

import type {
  ClauseParameterDefinition,
  ClauseParameterValue,
  NumericRange,
  ToleranceVerdict,
} from '../types/clause-parameter';
import { sameParameterValue } from './validate-clause-parameter';

/** Συμπεριληπτικό εύρος· `null` = ανοιχτό από εκείνη την πλευρά. */
export function inNumericRange(range: NumericRange, value: number): boolean {
  return (range.min === null || value >= range.min) && (range.max === null || value <= range.max);
}

/** Η αριθμητική όψη των ειδών που έχουν εύρος — `null` για τα υπόλοιπα. */
export function numericValueOf(value: ClauseParameterValue): number | null {
  return value.kind === 'percent' || value.kind === 'money' || value.kind === 'days' ? value.value : null;
}

/** Η ετυμηγορία μιας **έγκυρης** τιμής απέναντι στις ζώνες του ορισμού της. */
export function toleranceVerdict(definition: ClauseParameterDefinition, value: ClauseParameterValue): ToleranceVerdict {
  if (sameParameterValue(definition.preferred, value)) return 'preferred';
  const tolerance = definition.tolerance;
  if (tolerance === null) return 'acceptable';
  if (tolerance.kind === 'fixed') return 'needs_approval';
  if (tolerance.kind === 'options') {
    if (value.kind !== 'enum') return 'forbidden';
    if (tolerance.forbidden.includes(value.value)) return 'forbidden';
    return tolerance.acceptable.includes(value.value) ? 'acceptable' : 'needs_approval';
  }
  const numeric = numericValueOf(value);
  if (numeric === null || !inNumericRange(tolerance.walkAway, numeric)) return 'forbidden';
  return inNumericRange(tolerance.acceptable, numeric) ? 'acceptable' : 'needs_approval';
}

/** Περνά χωρίς έγκριση; (`preferred` ή `acceptable`) */
export function isFreeVerdict(verdict: ToleranceVerdict): boolean {
  return verdict === 'preferred' || verdict === 'acceptable';
}
