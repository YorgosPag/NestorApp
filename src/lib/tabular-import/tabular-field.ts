/**
 * «Είναι αυτό το κελί αριθμός;» — ο **ένας** κριτής πεδίου του πινακοειδούς πυρήνα (ADR-923 §5.5 · ADR-920 Β4.1α).
 *
 * Τον μοιράζονται ο εντοπισμός διαχωριστή, η ανίχνευση επικεφαλίδας και ο sniffer τιμών: ό,τι κρίνει ο ένας αριθμό
 * το διαβάζει και ο άλλος ως αριθμό. Η έκδοση «ελληνικό Excel» (`384512,345`) περνά από το SSoT `parseLocaleNumber`.
 * @module lib/tabular-import/tabular-field
 */

import { parseLocaleNumber } from '@/lib/number/locale-number';

/** Ένα πεδίο πρέπει να ΜΟΙΑΖΕΙ αριθμητικό πριν ξοδέψουμε τον `parseLocaleNumber` — το `TREE1` δεν είναι αριθμός. */
const NUMERIC_FIELD = /^[+-]?[\d.,]+$/;

/** Μπορεί το πεδίο να είναι αριθμός; (φτηνή πύλη πριν από την ανάλυση) */
export function looksNumericField(field: string): boolean {
  return NUMERIC_FIELD.test(field);
}

/**
 * Ένα πεδίο → αριθμός ή `null`. Γρήγορος δρόμος το `Number()` (η συντριπτική πλειοψηφία είναι απλά δεκαδικά με
 * τελεία)· ό,τι απορρίπτει αλλά μοιάζει αριθμητικό πέφτει στο `parseLocaleNumber`.
 */
export function parseTabularField(field: string): number | null {
  if (!looksNumericField(field)) return null;
  const fast = Number(field);
  if (Number.isFinite(fast)) return fast;
  return parseLocaleNumber(field);
}
