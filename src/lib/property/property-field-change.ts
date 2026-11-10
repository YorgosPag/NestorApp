/**
 * @fileoverview **«Άλλαξε αυτό το πεδίο ακινήτου;»** — ο ΕΝΑΣ κριτής, για τον server (κλείδωμα σε συναλλαγή,
 * ADR-249 §7) **και** τον πελάτη (η φόρμα στέλνει μόνο ό,τι άλλαξε).
 * @module lib/property/property-field-change
 *
 * 🔑 **Ίδια τιμή = ίδια ΣΗΜΑΣΙΑ, όχι ίδια bytes** (Google AIP-203: «the service should ignore the field if the
 * value matches»). Τρία πεδία έχουν ισοδυναμίες του τομέα που ένας γενικός σειριοποιητής δεν ξέρει, και για αυτά
 * μιλούν οι **υπάρχοντες** κριτές τους — καμία νέα ισότητα:
 *   - `areas` → `sameAreas` (`0` ≡ απουσία ≡ «δεν μετρήθηκε», ADR-777 §8.97)
 *   - `energy` → `sameEnergyCertificate` πάνω στον αναγνώστη (ADR-777 §8.94)
 *   - `commonCharges` → `sameCommonCharges` πάνω στον αναγνώστη (ADR-777 §8.93)
 * Όλα τα άλλα: ο σειριοποιητής του ιστορικού (`serializeScalar` του `audit-diff`) — ώστε «άλλαξε» για το κλείδωμα,
 * για τη φόρμα **και** για τη γραμμή ιστορικού να σημαίνει το ΙΔΙΟ πράγμα.
 *
 * Καθαρό αρχείο, χωρίς I/O: το εισάγουν και ο server και ο πελάτης.
 */

import { serializeScalar } from '@/lib/audit/audit-diff';
import { sameAreas } from '@/lib/properties/property-areas';
import { readEnergyCertificate, sameEnergyCertificate } from '@/lib/energy-certificate/energy-certificate';
import { readCommonCharges, sameCommonCharges } from '@/lib/common-charges/common-charges';

type FieldEquivalence = (a: unknown, b: unknown) => boolean;

/** Πεδία με ισοδυναμία του τομέα — ο κριτής του καθενός ζει στο δικό του module. */
const DOMAIN_EQUIVALENCE: Readonly<Record<string, FieldEquivalence>> = {
  areas: sameAreas,
  energy: (a, b) => sameEnergyCertificate(readEnergyCertificate(a), readEnergyCertificate(b)),
  commonCharges: (a, b) => sameCommonCharges(readCommonCharges(a), readCommonCharges(b)),
};

/** Ίδια τιμή για αυτό το πεδίο ακινήτου; (`undefined` ≡ `null` ≡ κενό — «δεν δηλώθηκε») */
export function samePropertyFieldValue(field: string, a: unknown, b: unknown): boolean {
  const domain = DOMAIN_EQUIVALENCE[field];
  return domain ? domain(a, b) : serializeScalar(a) === serializeScalar(b);
}

/** Η τιμή ενός πεδίου, χωρίς cast: `undefined` όταν το αντικείμενο δεν το έχει ως δικό του. */
function ownValue(source: object, field: string): unknown {
  return Object.getOwnPropertyDescriptor(source, field)?.value;
}

/**
 * **Μερική διόρθωση (RFC 7396) από δύο καταστάσεις**: μόνο τα πεδία που διαφέρουν από τη `baseline`.
 *
 * - Πεδίο του `next` με **ίδια** τιμή ⇒ παραλείπεται (καμία εγγραφή, καμία γραμμή ιστορικού, κανένα κλείδωμα).
 * - Πεδίο της `baseline` που **λείπει** από το `next` και είχε τιμή ⇒ `null` («σβήσε το»). Έτσι η φόρμα μπορεί να
 *   αδειάσει ένα πεδίο — ως τώρα ένα άδειο μπλοκ απλώς δεν στελνόταν, και η παλιά τιμή έμενε.
 *
 * ⚠️ Και οι δύο καταστάσεις πρέπει να έχουν παραχθεί από τον **ΙΔΙΟ** χαρτογράφο (π.χ. φόρμα τώρα ↔ φόρμα όπως
 * φορτώθηκε): τότε κάθε διαφορά αναπαράστασης ακυρώνεται και μένει μόνο η πρόθεση του ανθρώπου.
 */
export function changedPropertyFields(next: object, baseline: object): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(next)) {
    if (value === undefined) continue;
    if (!samePropertyFieldValue(field, value, ownValue(baseline, field))) patch[field] = value;
  }
  for (const [field, value] of Object.entries(baseline)) {
    if (ownValue(next, field) !== undefined) continue;
    if (!samePropertyFieldValue(field, undefined, value)) patch[field] = null;
  }
  return patch;
}
