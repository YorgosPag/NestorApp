/**
 * @fileoverview **ΟΙ ΟΡΟΙ ΤΗΣ ΖΗΤΗΣΗΣ** — ένα ποσό με τη μονάδα του, ένα είδος ακινήτου με το όνομά του.
 * @related ADR-886 · lib/demand/demand-phrases.ts (η περίληψη) · lib/demand/demand-display-name.ts (το όνομα)
 * @module lib/demand/demand-terms
 *
 * 🔴 **ΓΙΑΤΙ ΧΩΡΙΣΤΑ ΑΠΟ ΤΟ `demand-phrases.ts` — ΜΕΤΡΗΜΕΝΟ, ΟΧΙ ΑΙΣΘΗΤΙΚΟ** (2026-09-25): τους δύο
 * όρους τους χρειάζονται **και** η περίληψη **και** το όνομα της ζήτησης. Όσο ζούσαν μέσα στο
 * `demand-phrases.ts`, το πεδίο ονόματος της φόρμας έφερνε στη στατική κλειστότητα **όλες** τις φράσεις
 * περίληψης ⇒ το route slice της `/demands/new` πήγε 13.013 → 15.293 bytes (CHECK 3.34, πάνω από το
 * ταβάνι). Εδώ μένει μόνο ό,τι μοιράζονται — και οι δύο καταναλωτές το εισάγουν, κανείς δεν το αντιγράφει.
 */

import { PROPERTY_TYPE_I18N_KEYS } from '@/constants/property-types';
import { normalizePropertyType } from '@/constants/property-type-aliases';
import { priceRoleOfSeek } from '@/lib/criteria/listing-criterion-reading';
import { resolvedPriceLabel, type PriceLabelT } from '@/lib/listings/listing-price-label';
import type { PricedDemandSeek } from '@/types/property-demand';

const K = 'property-market:demand.summary';

/**
 * Το εύρος τιμής **μίας** εναλλακτικής, με τη μονάδα της — «έως 900 €/μήνα». `null` όταν δεν έθεσε
 * κανένα όριο. Η μονάδα έρχεται από τον **ΕΝΑ** μορφοποιητή (`resolvedPriceLabel`), ποτέ από «€» στο locale.
 *
 * ⚠️ Το «μόνο κατώτατο» (`min` χωρίς `max`) είναι **υπαρκτό αίτημα** («τίποτα κάτω από Χ»): μια φράση
 * που έδειχνε μόνο οροφή θα το εξαφάνιζε από την οθόνη ενώ θα **ίσχυε** στο ταίριασμα.
 */
export function demandSeekRangePhrase(t: PriceLabelT, seek: PricedDemandSeek): string | null {
  const role = priceRoleOfSeek(seek);
  const amount = (value: number) => resolvedPriceLabel(t, { role, amount: value });
  const { min, max } = seek.price;
  if (min !== null && max !== null) return t(`${K}.priceRange`, { priceMin: amount(min), priceMax: amount(max) });
  if (max !== null) return t(`${K}.priceUpTo`, { priceMax: amount(max) });
  if (min !== null) return t(`${K}.priceFrom`, { priceMin: amount(min) });
  return null;
}

/**
 * Το όνομα **ενός** είδους ακινήτου — από το **SSoT ετικετών**, ποτέ χειρόγραφη λίστα.
 *
 * 🔴 **ΚΑΝΟΝΙΚΟΠΟΙΗΣΗ, ΟΧΙ ΙΣΧΥΡΙΣΜΟΣ** (ADR-842 §7.6.12 / §8 #11): μια παλαιά ελληνική τιμή
 * (`'Στούντιο'`) λύνεται σε `studio` και ο άνθρωπος βλέπει τη σωστή ετικέτα στη γλώσσα του. Πραγματικά
 * άγνωστο είδος εμφανίζεται **ως έχει** αντί να εξαφανιστεί: μια ζήτηση που φιλτράρει σε κάτι που δεν
 * δείχνουμε είναι χειρότερη από μια ετικέτα χωρίς μετάφραση.
 */
export function demandTypeName(t: PriceLabelT, type: string): string {
  const canonical = normalizePropertyType(type);
  return canonical === null ? type : t(`properties-enums:${PROPERTY_TYPE_I18N_KEYS[canonical]}`);
}
