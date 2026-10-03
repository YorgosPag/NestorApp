/**
 * @module server/places/public-unit-seed
 * @description **Ο σπόρος της δημόσιας μονάδας** (ADR-900 §8 #2, 2β.4) — HMAC του κλειδιού `cadastral`, ποτέ ο ΚΑΕΚ.
 *
 * Η δημόσια μονάδα (`public_units`, `read: true`) χρειάζεται ταυτότητα **ντετερμινιστική** (ίδιος ΚΑΕΚ ⇒ ίδιο
 * έγγραφο, ιδεμποτία μέσα στη συναλλαγή του κριτή) αλλά **αδιαφανή** — όπως το `zpid` του Zillow, που δεν
 * είναι ο αριθμός γεωτεμαχίου (APN).
 *
 * 🔴 **HMAC, ΠΟΤΕ σκέτο hash.** Ο ΚΑΕΚ του γεωτεμαχίου φαίνεται στον δημόσιο χάρτη του Κτηματολογίου και ο
 * χώρος `/Κ/Ο` ενός γεωτεμαχίου είναι μικρός: σκέτο hash σπάει εξαντλητικά σε δευτερόλεπτα ⇒ το id θα
 * δημοσίευε τον ΚΑΕΚ της αγγελίας (απόφαση Ε2: η αγγελία **δεν** δείχνει ΚΑΕΚ) — και ο ΚΑΕΚ είναι ακριβώς
 * το κλειδί με το οποίο ζητείται ΠΚΑ μέσω TAXISnet. Ίδιο σκεπτικό με το `tax-id-protection.ts`.
 *
 * 🔑 **Μυστικό αποκλειστικού σκοπού** (ένα κλειδί = ένας σκοπός): ο ΑΦΜ και η μονάδα **δεν** μοιράζονται
 * κλειδί. ⚠️ Το μυστικό **δεν** αλλάζει χωρίς μετανάστευση: άλλο μυστικό ⇒ άλλο id ⇒ ο επόμενος κάτοχος
 * γεννά **δεύτερη** μονάδα για το ίδιο σπίτι. Χωρίς μυστικό ⇒ **ρίχνει** (fail-closed· η επαλήθευση απαντά 503,
 * ποτέ μονάδα με ασθενή ταυτότητα).
 */

import 'server-only';

import { createHmac } from 'crypto';

import { requireTokenSecret } from '@/lib/tokens/signed-token';
import type { PlaceUnitKey } from '@/lib/geo/place-unit-key.server';

export const PUBLIC_UNIT_SEED_SECRET_ENV = 'PUBLIC_UNIT_ID_HMAC_SECRET';

/**
 * Ο σπόρος — **μόνο** για κλειδί `cadastral` (Ε1: δημόσια μονάδα μόνο από επαληθευμένο ΚΑΕΚ). Ένα `declared`
 * κλειδί (δήλωση) επιστρέφει `null`: η δήλωση **δεν** γεννά ποτέ δημόσια μονάδα.
 */
export function publicUnitSeed(key: PlaceUnitKey): string | null {
  if (key.strength !== 'cadastral') return null;
  return createHmac('sha256', requireTokenSecret(PUBLIC_UNIT_SEED_SECRET_ENV)).update(key.key).digest('hex');
}
