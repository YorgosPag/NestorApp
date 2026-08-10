/**
 * @fileoverview **Σχήμα χάρτη → κλειδιά i18n.** Η ετικέτα και η εξήγηση, μία φορά.
 * @related ADR-777 §7 (Α5) · lib/listings/listing-map-shape · CHECK 3.41
 * @module lib/listings/listing-shape-keys
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΑΡΧΕΙΟ ΚΑΙ ΟΧΙ ΣΤΑΘΕΡΕΣ ΜΕΣΑ ΣΤΟ COMPONENT
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η ένωση {@link ListingMapShape} χρησιμοποιεί **παύλες** (`pin-with-ring`), τα κλειδιά
 * i18n **camelCase** (`pinWithRing`). Η μετάφραση ανάμεσά τους είναι **μηχανική και
 * επιρρεπής**: γραμμένη μέσα σε ένα component, θα ξαναγραφόταν στο επόμενο — και το
 * πρώτο λάθος θα εμφανιζόταν ως **ωμό κλειδί στην οθόνη**, την οικογένεια σφάλματος
 * που το repo έχει πληρώσει σε **CHECK 3.34 · 3.36 · 3.51**.
 *
 * 🔑 Εδώ είναι **δεδομένα**, άρα ελέγξιμα: μια άγκυρα μπορεί να ρωτήσει «υπάρχει
 * **κάθε** κλειδί αυτού του πίνακα και στις δύο γλώσσες;» — ερώτηση που **δεν** μπορεί
 * να τεθεί σε σταθερά κλειδωμένη μέσα σε αρχείο `.tsx` του οποίου η απόδοση απαιτεί
 * χάρτη, provider και browser.
 *
 * ⚠️ Και τα δύο είναι `Record<…>` πάνω στην **ένωση**: νέο σχήμα **σπάει τη
 * μεταγλώττιση εδώ**, αντί να πέσει σε προεπιλογή που θα ήταν λάθος γι' αυτό.
 */

import type { ListingMapShape } from './listing-map-shape';

/**
 * Το σχήμα σε **μία ετικέτα** — το ίδιο λεξιλόγιο με το υπόμνημα της οθόνης 2.
 *
 * Περιλαμβάνει το `'none'`: «χωρίς δηλωμένη θέση» **είναι** έγκυρη ετικέτα, και η
 * λίστα της οθόνης 2 τη χρειάζεται ακριβώς επειδή αυτές οι αγγελίες **δεν
 * εξαφανίζονται** (Α5 §4.1).
 */
export const SHAPE_LABEL_KEY: Readonly<Record<ListingMapShape, string>> = {
  outline: 'search-results:map.shape.outline',
  pin: 'search-results:map.shape.pin',
  'pin-with-ring': 'search-results:map.shape.pinWithRing',
  'shaded-circle': 'search-results:map.shape.shadedCircle',
  'shaded-city': 'search-results:map.shape.shadedCity',
  none: 'search-results:map.shape.none',
};

/**
 * Τι **σημαίνει** το σχήμα, σε μία πρόταση — η γλωσσική εκδοχή της ακρίβειας.
 *
 * 🔴 **Το `'none'` λείπει επίτηδες, και ο τύπος το επιβάλλει** (`Exclude<…, 'none'>`).
 * Όταν δεν ξέρουμε θέση, η σωστή απάντηση δεν είναι «τι σημαίνει το σχήμα» — είναι
 * **η αιτία** (`never-asked` vs `owner-declined`), που έχει δικό της λεξιλόγιο και
 * **διαφορετική θεραπεία**: το πρώτο είναι δικό μας χρέος, το δεύτερο επιλογή του
 * κατόχου. Μια κοινή πρόταση θα τα ισοπέδωνε.
 */
export const SHAPE_MEANING_KEY: Readonly<
  Record<Exclude<ListingMapShape, 'none'>, string>
> = {
  outline: 'search-results:detail.position.meaning.outline',
  pin: 'search-results:detail.position.meaning.pin',
  'pin-with-ring': 'search-results:detail.position.meaning.pinWithRing',
  'shaded-circle': 'search-results:detail.position.meaning.shadedCircle',
  'shaded-city': 'search-results:detail.position.meaning.shadedCity',
};

/**
 * Η εξήγηση του σχήματος, ή `null` όταν δεν υπάρχει σχήμα.
 *
 * ⚠️ **Στένωση με έλεγχο, ποτέ με `as`.** Είναι αλήθεια ότι μια `known` θέση δεν
 * παράγει ποτέ `'none'`, αλλά αυτή η αλήθεια ζει σε **άλλο αρχείο** και μπορεί να
 * αλλάξει· ένας ισχυρισμός τύπου εδώ θα την κρατούσε γραμμένη **πουθενά**.
 */
export function shapeMeaningKey(shape: ListingMapShape): string | null {
  return shape === 'none' ? null : SHAPE_MEANING_KEY[shape];
}
