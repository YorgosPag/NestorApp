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
 *   - Value identity = `sameAddressFieldValue` (`lib/geocoding/field-match`) — the ONE judgment
 *     shared with the per-field badge and the server (ADR-332 D32).
 *   - Trim whitespace.
 *   - Ignore fields where either side is empty (handled by FieldMatchKind
 *     `unknown` / `not-provided`, not as conflicts).
 *
 * @module components/shared/addresses/editor/helpers/diffAddressFields
 * @see ADR-332 §3.5 Reconciliation logic
 */

import {
  COMPARABLE_ADDRESS_FIELDS,
  sameAddressFieldValue,
  type ComparableAddressField,
} from '@/lib/geocoding/field-match';
import type { AddressFieldConflict, ResolvedAddressFields } from '../types';

/**
 * Το «τι μετρά ως διαφορά» — η **μόνη** παράμετρος του πυρήνα. Η **ταυτότητα** των τιμών δεν
 * κρίνεται εδώ: τη δίνει το {@link sameAddressFieldValue} (ADR-332 D32).
 *
 * 🔴 Ως το D32 αυτό το αρχείο είχε **δική του** κρίση ταυτότητας (γραφή + ISO χώρας), ενώ η ετικέτα
 * του πεδίου ρωτούσε το `field-match` (γραφή + πτώση/καθαρεύουσα + Τ.Κ.). Η ίδια φόρμα έδειχνε
 * «Ταιριάζει» στο πεδίο και «1 εκκρεμής διαφορά: Ωραιόκαστρον → Ωραιόκαστρο» στον πίνακα.
 */
type DiffRule = (field: ComparableAddressField, before: string, after: string) => boolean;

/** Ο κοινός πυρήνας: ΕΝΑ πέρασμα. */
function collectFieldDiffs(
  before: ResolvedAddressFields,
  after: ResolvedAddressFields,
  counts: DiffRule,
): AddressFieldConflict[] {
  const diffs: AddressFieldConflict[] = [];
  for (const field of COMPARABLE_ADDRESS_FIELDS) {
    const userValue = (before[field] ?? '').trim();
    const resolvedValue = (after[field] ?? '').trim();
    if (counts(field, userValue, resolvedValue)) {
      diffs.push({ field, userValue, resolvedValue });
    }
  }
  return diffs;
}

/** Συμφιλίωση: κενό σε οποιαδήποτε πλευρά = «δεν ειπώθηκε», όχι διαφορά. */
const isConflict: DiffRule = (field, user, resolved) =>
  user.length > 0 && resolved.length > 0 && !sameAddressFieldValue(field, user, resolved);

/** Αντικατάσταση: προσθήκη και σβήσιμο μετρούν· ίδια τιμή με άλλη γραφή όχι. */
const isReplacementChange: DiffRule = (field, before, after) => {
  if (before.length === 0 || after.length === 0) return before.length !== after.length;
  return !sameAddressFieldValue(field, before, after);
};

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
  return collectFieldDiffs(current, next, isReplacementChange);
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
