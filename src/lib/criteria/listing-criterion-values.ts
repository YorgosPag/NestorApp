/**
 * @fileoverview **ΠΟΙΕΣ ΤΙΜΕΣ ΔΕΧΕΤΑΙ ΚΑΘΕ ΑΞΟΝΑΣ** — τα κλειστά σύνολα, ενωμένα.
 * @related ADR-777 §7 (Α3) · ADR-842 Φ3 · N.12 (καμία δεύτερη γραφή λεξιλογίου)
 * @module lib/criteria/listing-criterion-values
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ — Ο ΦΡΟΥΡΟΣ ΤΗΣ ΔΙΕΥΘΥΝΣΗΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η διεύθυνση είναι **κείμενο που γράφει ο κόσμος**: κοινοποιημένος σύνδεσμος,
 * χειροκίνητη παράμετρος, παλιό bookmark. Χωρίς κλειστό σύνολο, ένα `?energy=Ω` θα
 * ταξίδευε σε κάθε επόμενη σελίδα και θα έδινε **μηδέν αποτελέσματα χωρίς εξήγηση** —
 * το ίδιο ελάττωμα που το `readGeoFilter` λύνει για την ακτίνα *(«ακτίνα μηδέν
 * φιλτράρει τα πάντα και ο επισκέπτης θα έβλεπε άδεια οθόνη χωρίς να ξέρει ότι
 * έφταιγε μια παράμετρος»)*.
 *
 * Το `readOfferKinds` **ήδη** το έκανε για έναν άξονα. Εδώ γίνεται για **δεκαέξι**.
 *
 * ⚠️ **ΚΑΜΙΑ ΤΙΜΗ ΔΕΝ ΞΑΝΑΓΡΑΦΕΤΑΙ ΕΔΩ.** Κάθε γραμμή δείχνει στο **υπάρχον**
 * λεξιλόγιο. Μια χειρόγραφη λίστα δίπλα στην αυθεντική θα ήταν ακριβώς το περιστατικό
 * που το `property-features-enterprise.ts` καταγράφει: *«η νέα τιμή δεν φτάνει ποτέ
 * στο dropdown και κανένας μεταγλωττιστής δεν παραπονιέται»*.
 *
 * ⚠️ **`Record<ValueSetCriterionKey, …>`** ⇒ νέος άξονας με σχήμα συνόλου **δεν
 * μεταγλωττίζεται** μέχρι να πει ποιες τιμές δέχεται.
 *
 * **Layering**: leaf — σταθερές και μία καθαρή συνάρτηση.
 */

import { OFFER_KINDS } from '@/types/property-offers';
import { LISTING_AUTHORSHIPS } from '@/types/public-listing';
import { PROPERTY_TYPES } from '@/constants/property-types';
import {
  AMENITIES,
  CONDITIONS,
  COOLING_TYPES,
  ENERGY_CLASSES,
  FLOORINGS,
  FRAMES,
  FUEL_TYPES,
  GLAZINGS,
  HEATING_TYPES,
  INTERIOR_FEATURES,
  ORIENTATIONS,
  SECURITY_FEATURES,
  WATER_HEATING_TYPES,
} from '@/constants/property-features-enterprise';

import type { ValueSetCriterionKey } from './listing-criterion-asking';

/**
 * **Οι αποδεκτές τιμές κάθε άξονα με σχήμα συνόλου.**
 *
 * 🔑 **Η σειρά ΕΙΝΑΙ η σειρά της οθόνης** — ίδια σύμβαση με το `ORIENTATIONS` και το
 * `PROPERTY_TYPES` *(«ο πίνακας είναι σε σειρά εμφάνισης και μια αναδιάταξη θα
 * μετακινούσε σιωπηλά κάθε dropdown»)*. Γι' αυτό οι αναφορές είναι **άμεσες** και όχι
 * ταξινομημένα αντίγραφα.
 *
 * 🔴 **Το `type` δείχνει στα ΚΑΝΟΝΙΚΑ είδη, όχι στα «δημιουργήσιμα».** Η αναζήτηση
 * ρωτά *«τι υπάρχει;»*, όχι *«τι επιτρέπεται να γεννηθεί;»*: ένα είδος που έπαψε να
 * προσφέρεται σε νέες καταχωρήσεις εξακολουθεί να **υπάρχει** στον κατάλογο, και ένα
 * φίλτρο που δεν μπορούσε να το ζητήσει θα έκρυβε υπαρκτές αγγελίες. Οι **παλαιές
 * ελληνικές** τιμές δεν είναι εδώ επίτηδες — δεν ζητιούνται, **λύνονται**: ο
 * αναγνώστης κανονικοποιεί το είδος της αγγελίας πριν το συγκρίνει *(δες
 * `./listing-criterion-reading`)*, ώστε ένα `'Οικόπεδο'` της βάσης να απαντά στο
 * φίλτρο `plot`.
 */
export const CRITERION_VALUES: Record<ValueSetCriterionKey, readonly string[]> = {
  type: PROPERTY_TYPES,
  energyClass: ENERGY_CLASSES,
  condition: CONDITIONS,
  heatingType: HEATING_TYPES,
  heatingFuel: FUEL_TYPES,
  coolingType: COOLING_TYPES,
  waterHeating: WATER_HEATING_TYPES,
  windowFrames: FRAMES,
  glazing: GLAZINGS,
  flooring: FLOORINGS,
  orientations: ORIENTATIONS,
  interiorFeatures: INTERIOR_FEATURES,
  securityFeatures: SECURITY_FEATURES,
  amenities: AMENITIES,
  offerKind: OFFER_KINDS,
  authorship: LISTING_AUTHORSHIPS,
};

/**
 * **Κράτα μόνο ό,τι αναγνωρίζει το λεξιλόγιο** — και **ξεδιπλασίασε**.
 *
 * ⚠️ **Τα διπλότυπα πετιούνται στην πόρτα.** Ένα `?amen=pool&amen=pool` δεν είναι
 * λάθος του χρήστη — παράγεται από διπλό κλικ και από συνενωμένους συνδέσμους — και
 * αν περνούσε, δύο ταυτόσημες αναζητήσεις θα είχαν **διαφορετική** διεύθυνση μετά τη
 * σειριοποίηση. Είναι ο ίδιος κανόνας με το *«τα κενά φίλτρα δεν γράφονται»*.
 *
 * 🔑 **Η σειρά ακολουθεί το ΛΕΞΙΛΟΓΙΟ, όχι τη διεύθυνση**: `?amen=gym&amen=pool` και
 * `?amen=pool&amen=gym` είναι η **ίδια** ερώτηση, και οφείλουν να παράγουν την ίδια
 * κανονική διεύθυνση — αλλιώς μια μηχανή αναζήτησης βλέπει δύο σελίδες με ταυτόσημο
 * περιεχόμενο *(το ακριβές πρόβλημα «index bloat» της πλοηγικής με όψεις)*.
 */
export function keepKnownValues(
  key: ValueSetCriterionKey,
  raw: readonly string[]
): readonly string[] {
  const wanted = new Set(raw.map((value) => value.trim()).filter((value) => value !== ''));
  return CRITERION_VALUES[key].filter((value) => wanted.has(value));
}
