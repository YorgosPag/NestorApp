/**
 * **Πρόταση κωδικού από την ετικέτα** (ADR-923 §5.2) — «Ψυκτική ισχύς H» → `psyktiki_ischys_h`.
 *
 * Ο κωδικός είναι **αμετάβλητος** και λατινικός (`CATALOG_CODE_PATTERN`), ενώ ο άνθρωπος σκέφτεται με την ετικέτα.
 * Το Akeneo προτείνει τον κωδικό από την ετικέτα όσο ο χρήστης δεν τον έχει αγγίξει· το ίδιο εδώ — **πρόταση**, όχι
 * επιβολή: ο άνθρωπος μπορεί πάντα να γράψει δικό του πριν τη δημιουργία.
 *
 * Μεταγραφή μέσω του SSoT `transliterateGreekToLatin` (κανένας δεύτερος πίνακας ελληνικών→λατινικών).
 *
 * @module subapps/catalog/vocabulary/suggest-catalog-code
 */

import { transliterateGreekToLatin } from '@/utils/greek-text';
import { isCatalogCode } from './catalog-limits';

const MAX_CODE_LENGTH = 64;
/** Πρόθεμα όταν η ετικέτα αρχίζει με ψηφίο («2 βαθμίδες») — ο κωδικός πρέπει να αρχίζει με γράμμα. */
const LEADING_DIGIT_PREFIX = 'x_';

/** Ο προτεινόμενος κωδικός, ή `''` όταν η ετικέτα δεν δίνει κανένα γράμμα ή ψηφίο. */
export function suggestCatalogCode(label: string): string {
  const latin = transliterateGreekToLatin(label)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (latin.length === 0) return '';
  const prefixed = /^[a-z]/.test(latin) ? latin : `${LEADING_DIGIT_PREFIX}${latin}`;
  const code = prefixed.slice(0, MAX_CODE_LENGTH).replace(/_+$/, '');
  return isCatalogCode(code) ? code : '';
}
