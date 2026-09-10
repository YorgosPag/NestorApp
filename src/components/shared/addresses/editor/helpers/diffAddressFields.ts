/**
 * =============================================================================
 * ADDRESS EDITOR — Field Diff Helper (ADR-332 Phase 1)
 * =============================================================================
 *
 * Compares a user-entered `ResolvedAddressFields` snapshot against the
 * Nominatim-resolved counterpart and produces a list of conflicts to feed
 * the Reconciliation Panel (Phase 2/4) and per-field badges (Phase 3).
 *
 * Comparison rules:
 *   - Case-insensitive (Greek + Latin) via `normalizeGreekText`.
 *   - Trim whitespace.
 *   - Ignore fields where either side is empty (handled by FieldMatchKind
 *     `unknown` / `not-provided`, not as conflicts).
 *
 * @module components/shared/addresses/editor/helpers/diffAddressFields
 * @see ADR-332 §3.5 Reconciliation logic
 */

import { normalizeGreekText } from '@/services/ai-pipeline/shared/greek-text-utils';
import { foldPlaceName } from '@/utils/address/place-name';
import type { AddressFieldConflict, ResolvedAddressFields } from '../types';

const COMPARABLE_FIELDS: ReadonlyArray<keyof ResolvedAddressFields> = [
  'street',
  'number',
  'postalCode',
  'neighborhood',
  'city',
  'county',
  'region',
  'country',
];

function normalize(value: string | undefined): string {
  if (!value) return '';
  // ADR-332 D27 Βήμα Β (Β7): «Ελευθέριο-Κορδελιό» και «Ελευθέριο Κορδελιό» είναι το ΙΔΙΟ όνομα —
  // διαφέρει η γραφή. Χωρίς αυτό ο διάλογος συρσίματος έδειχνε «αλλαγή» μόνο για την παύλα.
  return normalizeGreekText(foldPlaceName(value)).toLowerCase();
}

/** Ο κοινός πυρήνας: ΕΝΑ πέρασμα· το «τι μετρά ως διαφορά» είναι η μόνη παράμετρος. */
function collectFieldDiffs(
  before: ResolvedAddressFields,
  after: ResolvedAddressFields,
  counts: (before: string, after: string) => boolean,
): AddressFieldConflict[] {
  const diffs: AddressFieldConflict[] = [];
  for (const field of COMPARABLE_FIELDS) {
    const userValue = before[field];
    const resolvedValue = after[field];
    if (counts(normalize(userValue), normalize(resolvedValue))) {
      diffs.push({
        field,
        userValue: (userValue ?? '').trim(),
        resolvedValue: (resolvedValue ?? '').trim(),
      });
    }
  }
  return diffs;
}

function isConflict(user: string, resolved: string): boolean {
  if (user.length === 0 || resolved.length === 0) return false;
  return user !== resolved;
}

/**
 * Returns one entry per field where user vs resolved disagree (both non-empty).
 * Empty user fields or empty resolved fields are NOT conflicts (different
 * semantic — handled by `unknown` / `not-provided` field-status badges).
 */
export function diffAddressFields(
  userInput: ResolvedAddressFields,
  resolved: ResolvedAddressFields,
): AddressFieldConflict[] {
  return collectFieldDiffs(userInput, resolved, isConflict);
}

/**
 * **Τι αλλάζει αν το `next` ΑΝΤΙΚΑΤΑΣΤΗΣΕΙ το `current`** — προσθήκη, αλλαγή **και σβήσιμο**.
 *
 * ⚠️ **Άλλη ερώτηση από το {@link diffAddressFields}, όχι διόρθωσή του.** Στη συμφιλίωση το
 * κενό σημαίνει «ο πάροχος δεν το είπε» και σωστά δεν είναι διαφορά. Σε **αντικατάσταση**
 * (σύρσιμο πινέζας) το κενό σημαίνει «**θα σβηστεί**».
 *
 * 🔴 2026-09-10 (ADR-332 D27): ο διάλογος συρσίματος ρωτούσε την πρώτη ερώτηση ⇒
 * «Σαμοθράκης 16 → Σαμοθράκης» έδειχνε **μηδέν** αλλαγές, και το «Ναι, ενημέρωσε» έσβηνε
 * τον αριθμό **σιωπηλά**.
 */
export function diffAddressReplacement(
  current: ResolvedAddressFields,
  next: ResolvedAddressFields,
): AddressFieldConflict[] {
  return collectFieldDiffs(current, next, (before, after) => before !== after);
}

/** Σβήνει αυτή η αλλαγή τιμή που **υπήρχε**; */
export function isClearedField(change: AddressFieldConflict): boolean {
  return change.userValue.length > 0 && change.resolvedValue.length === 0;
}

/**
 * Convenience predicate — true when at least one comparable field disagrees.
 */
export function hasFieldConflicts(
  userInput: ResolvedAddressFields,
  resolved: ResolvedAddressFields,
): boolean {
  return diffAddressFields(userInput, resolved).length > 0;
}
