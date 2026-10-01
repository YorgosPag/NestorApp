/**
 * @fileoverview **Η ετικέτα μιας πρόσοψης** (ADR-898 Φ3β) — ο ΕΝΑΣ τόπος όπου το λεξιλόγιο του νόμου
 * (`RESIDENCE_FRONTAGES`) δένεται με τον κατάλογο `properties-enums:frontage`.
 * @related `listing-attribute-vocabulary.ts` (`vocabularyLabel` → `'frontage'` καλεί αυτό) ·
 *   `components/objective-value/ObjectiveValueQuestions.tsx` (ο υπολογιστής)
 * @module lib/listings/frontage-label
 *
 * ⚠️ **Χωριστό αρχείο, επίτηδες — και ο λόγος είναι μετρημένος**: ο γεννήτορας του route slice (ADR-744) διαβάζει
 * τις κλήσεις `t(…)` **ανά αρχείο**. Ο υπολογιστής που εισήγαγε το `vocabularyLabel` κουβαλούσε **κάθε** λεξιλόγιο
 * (κατάσταση, θέρμανση, κουφώματα, παροχές…): **+2.579 bytes** για τέσσερις ετικέτες. Εδώ κουβαλά μόνο τις δικές του.
 * Η αντιστοίχιση μένει **μία** — το `vocabularyLabel` δεν ξαναγράφει το πρόθεμα, καλεί αυτή τη συνάρτηση.
 */

import type { TFunction } from 'i18next';

import type { ResidenceFrontage } from '@/lib/objective-value/objective-value-types';

export function frontageLabel(t: TFunction, value: ResidenceFrontage | string): string {
  return t(`properties-enums:frontage.${value}`);
}
