/**
 * @fileoverview **ΜΕ ΠΟΙΟ ΛΕΞΙΛΟΓΙΟ ΟΝΟΜΑΖΕΤΑΙ ΜΙΑ ΤΙΜΗ** — η **μία** συνάρτηση.
 * @related ADR-777 §8.51 (Στάδιο 3) · ADR-842 Φ3 · ADR-749 · N.0.2
 * @module lib/listings/listing-attribute-vocabulary
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΜΕΤΑΚΟΜΙΣΕ ΕΔΩ — ΚΑΙ ΓΙΑΤΙ Η ΜΕΤΑΚΟΜΙΣΗ ΗΤΑΝ Η ΠΡΩΤΗ ΠΡΑΞΗ ΤΟΥ ΣΤΑΔΙΟΥ 3
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ζούσε στο `components/listing-detail/listing-attribute-value.ts`, όπου είχε **έναν**
 * καταναλωτή: τη σελίδα του ακινήτου. Το Στάδιο 3 έδωσε **δεύτερο** — το πάνελ φίλτρων
 * της οθόνης 2, που πρέπει να ονομάσει **τις ίδιες** τιμές μέσα σε checkbox αντί μέσα
 * σε γραμμή.
 *
 * ⚠️ **Η προφανής γραφή ήταν να ξαναγραφεί εκεί, και θα ήταν ο ΑΚΡΙΒΗΣ δίδυμος κλώνος
 * που κυνηγά το CHECK 3.28** *(N.18)*. Η ημέρα που θα απέκλιναν είναι η ημέρα που το
 * dropdown θα έλεγε **άλλη λέξη από την κάρτα** για το ίδιο πράγμα — και κανένας
 * μεταγλωττιστής δεν θα παραπονιόταν, γιατί και οι δύο θα ήταν έγκυρες συμβολοσειρές.
 *
 * ⚠️ **Η δεύτερη προφανής γραφή ήταν `import` από το `components/listing-detail/`**, και
 * απορρίφθηκε: μια οθόνη δεν δανείζεται λεξιλόγιο από **άλλη οθόνη** — το λεξιλόγιο
 * δεν ανήκει σε καμία από τις δύο. Ένα `search-results → listing-detail` βέλος θα
 * έκανε τη σελίδα του ακινήτου **εξάρτηση των αποτελεσμάτων**, δηλαδή θα έδενε τον
 * κύκλο ζωής δύο οθονών που αλλάζουν με άλλον ρυθμό.
 *
 * ⇒ Το λεξιλόγιο ζει σε **`lib/`**, όπου ζουν ήδη οι τρεις πίνακες που το πλαισιώνουν
 * *(`LISTING_DISCLOSURE` · `LISTING_ATTRIBUTE_GROUP` · `ATTRIBUTE_DECLARED`)*, και οι
 * δύο οθόνες είναι **και οι δύο** καταναλωτές — καμία δεν είναι ιδιοκτήτης.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⛔ ΓΙΑΤΙ ΤΑ ΠΡΟΘΕΜΑΤΑ ΕΙΝΑΙ **ΚΥΡΙΟΛΕΚΤΙΚΑ** ΚΑΙ ΟΧΙ ΜΕΤΑΒΛΗΤΕΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η προφανής γραφή ήταν ένας πίνακας `Record<…, string>` με πλήρη προθέματα και
 * `t(prefixFromTable + '.' + value)`. **Απορρίφθηκε, και ο λόγος είναι πύλη**: ο
 * γεννήτορας του i18n shell slice (ADR-744, CHECK 3.34) αναλύει **στατικά** τις
 * κλήσεις `t(…)` και **αρνείται να παράξει slice** όσο υπάρχει ανεπίλυτη κλήση. Ένα
 * πρόθεμα από μεταβλητή είναι ακριβώς αυτό — και η θεραπεία θα ήταν χειρόγραφη
 * εγγραφή στο `$dynamicKeyPolicy`, δηλαδή **δεύτερη λίστα να συντηρείται**.
 *
 * 🔑 Με κυριολεκτικά προθέματα μέσα σε `switch`, ο γεννήτορας τα βλέπει **όλα** και ο
 * μεταγλωττιστής εγγυάται ότι κανένα λεξιλόγιο δεν έμεινε χωρίς σκέλος. Καμία
 * εγγραφή πολιτικής, καμία δεύτερη λίστα.
 *
 * **Layering**: leaf — τύποι, σταθερές και μία καθαρή συνάρτηση πάνω σε `TFunction`.
 * Καμία εξάρτηση από React ή Firestore.
 */

import type { TFunction } from 'i18next';

import type { ListingFeatureSetKey } from './listing-disclosure';

// ============================================================================
// 1. ΤΑ ΛΕΞΙΛΟΓΙΑ — ένα όνομα ανά κατάλογο ετικετών
// ============================================================================

/**
 * Ποιος κατάλογος του `properties-enums` ονομάζει τις τιμές αυτού του πεδίου.
 *
 * ⚠️ **Ονόματα λεξιλογίου, ΟΧΙ ονόματα πεδίων**: το `heatingType` και το
 * `systemsOverride.heatingType` της φόρμας μοιράζονται τον **ίδιο** κατάλογο, και το
 * `flooring` τον μοιράζεται ως **σύνολο**. Αν το κλειδί ήταν το όνομα του πεδίου, δύο
 * πεδία με το ίδιο λεξιλόγιο θα το δήλωναν δύο φορές.
 */
export type AttributeVocabulary =
  | 'condition'
  | 'heating'
  | 'fuel'
  | 'cooling'
  | 'waterHeating'
  | 'frames'
  | 'glazing'
  | 'flooring'
  | 'orientation'
  | 'interiorFeature'
  | 'securityFeature'
  | 'amenity';

/**
 * Μία τιμή λεξιλογίου → η ετικέτα της.
 *
 * 🔴 **Κάθε πρόθεμα είναι ΚΥΡΙΟΛΕΚΤΙΚΟ** — δες την κεφαλίδα για το γιατί, και το
 * `switch` είναι εξαντλητικό πάνω στο {@link AttributeVocabulary}, άρα νέο λεξιλόγιο
 * **δεν μεταγλωττίζεται** μέχρι να πει από πού διαβάζονται οι ετικέτες του.
 *
 * 🔑 **Ο ΕΝΑΣ καταναλωτής έγινε ΔΥΟ, και η συνάρτηση δεν άλλαξε**: η γραμμή της
 * οθόνης 3 *(«Θέρμανση: Φυσικό αέριο»)* και το checkbox της οθόνης 2 *(«☐ Φυσικό
 * αέριο»)* ρωτούν **το ίδιο πράγμα**. Ό,τι διαφέρει είναι το **περίβλημα**, και το
 * περίβλημα δεν είναι δουλειά του λεξιλογίου.
 */
export function vocabularyLabel(
  t: TFunction,
  vocabulary: AttributeVocabulary,
  value: string
): string {
  switch (vocabulary) {
    case 'condition':
      return t(`properties-enums:condition.${value}`);
    case 'heating':
      return t(`properties-enums:systems.heating.${value}`);
    case 'fuel':
      return t(`properties-enums:systems.fuel.${value}`);
    case 'cooling':
      return t(`properties-enums:systems.cooling.${value}`);
    case 'waterHeating':
      return t(`properties-enums:systems.waterHeating.${value}`);
    case 'frames':
      return t(`properties-enums:finishes.frames.${value}`);
    case 'glazing':
      return t(`properties-enums:finishes.glazing.${value}`);
    case 'flooring':
      return t(`properties-enums:finishes.flooring.${value}`);
    case 'orientation':
      return t(`properties-enums:units.orientation.${value}`);
    case 'interiorFeature':
      return t(`properties-enums:features.interior.${value}`);
    case 'securityFeature':
      return t(`properties-enums:features.security.${value}`);
    case 'amenity':
      return t(`properties-enums:features.amenities.${value}`);
  }
}

// ============================================================================
// 2. ΠΟΙΑ ΙΔΙΟΤΗΤΑ ΔΙΑΒΑΖΕΤΑΙ ΜΕ ΠΟΙΟ ΛΕΞΙΛΟΓΙΟ
// ============================================================================

/**
 * **Οι ιδιότητες που ονομάζονται από κατάλογο του `properties-enums`.**
 *
 * 🔴 **ΜΕΡΙΚΟΣ ΠΙΝΑΚΑΣ, ΚΑΙ ΕΙΝΑΙ ΣΩΣΤΟ ΝΑ ΕΙΝΑΙ**: οι υπόλοιπες ιδιότητες δεν έχουν
 * λεξιλόγιο επειδή **δεν είναι απαρίθμηση** — ένα εμβαδόν, ένα έτος, ένας αριθμός
 * μπάνιων. Ένα εξαντλητικό `Record` εδώ θα ανάγκαζε καθεμιά τους να δηλώσει
 * `undefined`, δηλαδή θα ζητούσε **απάντηση σε ερώτηση που δεν τους τίθεται**.
 *
 * ⚠️ **Η εξαντλητικότητα ζει αλλού, και είναι δύο φορές**: το `ATTRIBUTE_VALUE_KIND`
 * *(«πώς γίνεται κείμενο;»)* και το `CRITERION_VALUE_NAMING` *(«πώς ονομάζεται η
 * επιλογή στο φίλτρο;»)* είναι **και τα δύο** εξαντλητικά πάνω στα κλειδιά τους και
 * **και τα δύο** δείχνουν εδώ. Άρα μια ιδιότητα δεν μπορεί να ξεχαστεί — αλλά ούτε
 * και να έχει **δύο** λεξιλόγια, ένα ανά οθόνη.
 *
 * 🔑 `as const satisfies` και όχι `: Partial<Record<…>>`: με σκέτη δήλωση τύπου το
 * `ATTRIBUTE_VOCABULARY.condition` θα ήταν `AttributeVocabulary | undefined` και κάθε
 * καταναλωτής θα χρειαζόταν `!`. Έτσι είναι το **κυριολεκτικό** `'condition'`.
 */
export const ATTRIBUTE_VOCABULARY = {
  condition: 'condition',
  heatingType: 'heating',
  heatingFuel: 'fuel',
  coolingType: 'cooling',
  waterHeating: 'waterHeating',
  windowFrames: 'frames',
  glazing: 'glazing',
} as const satisfies Partial<Record<string, AttributeVocabulary>>;

// ============================================================================
// 3. ΠΟΙΟ ΣΥΝΟΛΟ ΔΙΑΒΑΖΕΤΑΙ ΜΕ ΠΟΙΟ ΛΕΞΙΛΟΓΙΟ
// ============================================================================

/**
 * **Κάθε σύνολο, και το λεξιλόγιο των τιμών του.**
 *
 * 🔑 `Record<ListingFeatureSetKey, …>` ⇒ νέο σύνολο **δεν μεταγλωττίζεται** μέχρι να
 * πει με ποιες ετικέτες ονομάζονται οι τιμές του. Είναι ο **ένας** από τους δύο
 * φρουρούς των συνόλων (ο άλλος είναι το `LISTING_ATTRIBUTE_GROUP`) — τα σύνολα δεν
 * έχουν πίνακα «πότε είναι δηλωμένο», γιατί η ανάγνωσή τους είναι ολική εξ ορισμού.
 *
 * ⚠️ Το `listing-disclosure.ts` το αναφέρει ονομαστικά ως τον δεύτερο φρουρό. Ως τις
 * 2026-09-04 το ανέφερε με **λάθος όνομα** (`FEATURE_SET_VALUE_LABEL_NS`, που δεν
 * υπήρξε ποτέ στον κώδικα) — μπαγιάτικο σχόλιο που διορθώθηκε μαζί με αυτή τη
 * μετακόμιση. Ένας φρουρός που αναφέρεται με όνομα που δεν υπάρχει είναι φρουρός που
 * κανείς δεν μπορεί να βρει.
 */
export const FEATURE_SET_VOCABULARY: Record<ListingFeatureSetKey, AttributeVocabulary> = {
  flooring: 'flooring',
  orientations: 'orientation',
  interiorFeatures: 'interiorFeature',
  securityFeatures: 'securityFeature',
  amenities: 'amenity',
};
