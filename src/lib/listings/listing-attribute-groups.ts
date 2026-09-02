/**
 * @fileoverview **ΠΟΥ ΚΑΘΕΤΑΙ ΚΑΘΕ ΣΤΟΙΧΕΙΟ ΣΤΗΝ ΟΘΟΝΗ** — και η λογιστική **ανά ομάδα**.
 * @related ADR-842 §7 (Φ3 · §8 #4) · ADR-777 §7 (Α3 οθόνη 3 · Α7) · ./listing-disclosure
 * @module lib/listings/listing-attribute-groups
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΠΡΟΒΛΗΜΑ ΠΟΥ ΓΕΝΝΗΣΕ ΤΟ ΑΡΧΕΙΟ — ΚΑΙ ΕΙΝΑΙ ΤΟ ΙΔΙΟ, ΣΕ ΑΛΛΗ ΜΟΡΦΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η Φ3 μεγάλωσε τα δημόσια στοιχεία από **4** σε **27**. Ο κανόνας της οθόνης 3 λέει
 * *«κάθε στοιχείο φαίνεται — με τιμή, ή με **ονομασμένη απουσία**»*, και αυτός ο
 * κανόνας είναι ό,τι ξεπερνά κάθε portal (Zillow · idealista · Spitogatos απλώς
 * **παραλείπουν**, οπότε ο αναγνώστης δεν ξέρει αν έλειπε ένα ή δέκα).
 *
 * ⚠️ **Εφαρμοσμένος ωμά σε 27 πεδία, ο ίδιος κανόνας γίνεται το αντίθετό του**: μια
 * επίπεδη λίστα με ~21 γραμμές «δεν έχει δηλωθεί» **θάβει** τα 6 πραγματικά γεγονότα
 * και διαβάζεται ως **κατηγορητήριο κατά του κατόχου**. Το ADR-842 §8 #4 το είχε
 * καταγράψει ως ανοιχτό: *«30 πεδία σε μία λίστα θα ήταν άλλη μορφή του ίδιου
 * προβλήματος»*.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 Η ΛΥΣΗ — ΚΑΙ ΓΙΑΤΙ ΕΙΝΑΙ ΑΥΣΤΗΡΟΤΕΡΗ ΚΑΙ ΑΠΟ ΤΑ ΔΥΟ ΑΚΡΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * **Η λογιστική ταξιδεύει ΜΑΖΙ ΜΕ ΤΗΝ ΟΜΑΔΑ.** Κάθε ομάδα τυπώνει **πάντα** το δικό
 * της κλειστό ισοζύγιο (*«2 από 3»*), δείχνει τα **δηλωμένα**, και κρύβει τα κενά
 * πίσω από μία ενέργεια που τα **ονομάζει και τα μετρά** (*«1 δεν έχει δηλωθεί»*).
 *
 * | | Zillow / idealista | Επίπεδη λίστα 27 γραμμών | **Εδώ** |
 * |---|---|---|---|
 * | Ξέρω **πόσα** λείπουν; | ❌ ποτέ | ✅ | ✅ **πάντα ορατό** |
 * | Ξέρω **ποια** λείπουν; | ❌ ποτέ | ✅ | ✅ με **ένα** κλικ |
 * | Διαβάζονται τα γεγονότα; | ✅ | ❌ θάβονται | ✅ |
 *
 * 📐 **Δύο επίπεδα αποκάλυψης, ΠΟΤΕ τρία** — ρητή σύσταση Nielsen Norman Group:
 * *«designs that go beyond 2 disclosure levels typically have low usability»*, και
 * *«the progression must have strong information scent»*. Γι' αυτό η ενέργεια δεν
 * λέει «Περισσότερα» αλλά **πόσα** και **τι κατάστασης** είναι.
 *
 * 🔑 **Και το ίδιο ιδίωμα το έχουν τα εργαλεία που ο Giorgio έθεσε ως πήχη**: η
 * παλέτα ιδιοτήτων του Revit ομαδοποιεί σε *Constraints · Dimensions · Identity Data*
 * με πτυσσόμενες κεφαλίδες, και η γραμμή μιας παραμέτρου **δεν εξαφανίζεται ποτέ**
 * όταν είναι κενή· ο Attribute Manager του Cinema 4D χωρίζει σε καρτέλες ανά ομάδα.
 * Καμία από τις δύο δεν δείχνει 27 πράγματα ταυτόχρονα, και **καμία** δεν κρύβει την
 * ύπαρξη μιας παραμέτρου.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΓΙΑΤΙ ΔΕΥΤΕΡΟΣ ΠΙΝΑΚΑΣ ΚΑΙ ΟΧΙ ΣΤΗΛΗ ΣΤΟΝ ΠΡΩΤΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `LISTING_DISCLOSURE` απαντά *«με ποιον **τρόπο** γίνεται ορατό;»* (μηχανισμός).
 * Εδώ απαντάται *«**πού** κάθεται;»* (διάταξη). Δύο ερωτήματα — και το δεύτερο
 * αλλάζει όταν αλλάζει η οθόνη, ενώ το πρώτο όχι.
 *
 * 🔑 **ΚΑΙ ΔΕΝ ΕΙΝΑΙ «ΔΥΟ ΛΙΣΤΕΣ ΠΟΥ ΣΥΜΦΩΝΟΥΝ ΜΕΤΑΞΥ ΤΟΥΣ»** — το σχήμα που αυτό το
 * repo έχει πληρώσει τρεις φορές. Ο πίνακας εδώ είναι `Record<` πάνω στα κλειδιά που
 * **παράγονται** από εκείνον: δεν είναι δεύτερη λίστα, είναι **προβολή της πρώτης**.
 * Ένα νέο πεδίο εκεί **δεν μεταγλωττίζεται** μέχρι να πάρει ομάδα εδώ, και μια ομάδα
 * για πεδίο που δεν υπάρχει **δεν μεταγλωττίζεται** καθόλου. Απόκλιση: **αδύνατη**.
 */

import type { PublicListing } from '@/types/public-listing';

import {
  LISTING_ATTRIBUTE_KEYS,
  LISTING_FEATURE_SET_KEYS,
  type ListingAttributeKey,
  type ListingFeatureSetKey,
} from './listing-disclosure';
import { ledgerOver, type ListingAttributeLedger } from './listing-attribute-declared';

// ============================================================================
// 1. ΤΟ ΛΕΞΙΛΟΓΙΟ ΤΩΝ ΟΜΑΔΩΝ — η λίστα είναι η πηγή, ο τύπος παράγεται
// ============================================================================

/**
 * Οι ομάδες, **στη σειρά που εμφανίζονται**.
 *
 * ⚠️ **Η σειρά είναι οθόνη**, όπως και στο `LISTING_DISCLOSURE`: αλλαγή εδώ = αλλαγή
 * οθόνης, και διαβάζεται ως τέτοια στο diff.
 *
 * 🔑 Ίδιο ιδίωμα με τη Φ1 (ADR-842 Α4) και με το `LOCATION_PROVENANCES`: **η λίστα
 * είναι η πηγή, ο τύπος παράγεται**. Ένα `type X = 'a' | 'b'` δίπλα σε μια χειρόγραφη
 * `X[]` θα δεχόταν **υποσύνολο** — δηλαδή μια ομάδα θα μπορούσε να υπάρχει στον τύπο
 * και **να μη φτάσει ποτέ στην οθόνη**, χωρίς κανένας μεταγλωττιστής να παραπονεθεί.
 */
export const LISTING_ATTRIBUTE_GROUPS = [
  'essentials',
  'energyCondition',
  'roomsAreas',
  'systemsFinishes',
  'features',
] as const;

export type ListingAttributeGroup = (typeof LISTING_ATTRIBUTE_GROUPS)[number];

// ============================================================================
// 2. Η ΑΝΑΘΕΣΗ — εξαντλητική πάνω στα ΠΑΡΑΓΟΜΕΝΑ κλειδιά
// ============================================================================

/**
 * **Κάθε στοιχείο, και η ομάδα του.**
 *
 * 🔴 `Record<ListingAttributeKey | ListingFeatureSetKey, …>` ⇒ **νέο δημόσιο στοιχείο
 * δεν μεταγλωττίζεται μέχρι κάποιος να πει πού κάθεται**. Είναι η **ίδια** εγγύηση με
 * το `ATTRIBUTE_DECLARED`, σε δεύτερο ερώτημα — και για τα σύνολα είναι η **μοναδική**
 * (η ανάγνωσή τους είναι ολική εξ ορισμού, δες `listingFeatureSetValues`).
 *
 * ⚠️ **Η ΣΕΙΡΑ ΜΕΣΑ ΣΤΗΝ ΟΜΑΔΑ ΔΕΝ ΔΗΛΩΝΕΤΑΙ ΕΔΩ.** Παράγεται με φιλτράρισμα των
 * ταξινομημένων καταλόγων του `listing-disclosure` — δες {@link listingGroupMembers}.
 * Μια δεύτερη δήλωση σειράς θα ήταν ακριβώς η απόκλιση που όλο αυτό το αρχείο
 * αποφεύγει.
 */
export const LISTING_ATTRIBUTE_GROUP: Record<
  ListingAttributeKey | ListingFeatureSetKey,
  ListingAttributeGroup
> = {
  // ── Τα τέσσερα που ήταν ήδη δημόσια (§25.6: 5 βασικά + 3 ειδικά) ──────────
  type: 'essentials',
  areaSqm: 'essentials',
  floor: 'essentials',
  bedrooms: 'essentials',

  energyClass: 'energyCondition',
  condition: 'energyCondition',
  renovationYear: 'energyCondition',

  bathrooms: 'roomsAreas',
  wc: 'roomsAreas',
  totalRooms: 'roomsAreas',
  levels: 'roomsAreas',
  balconies: 'roomsAreas',
  netAreaSqm: 'roomsAreas',
  balconyAreaSqm: 'roomsAreas',
  terraceAreaSqm: 'roomsAreas',
  gardenAreaSqm: 'roomsAreas',

  heatingType: 'systemsFinishes',
  heatingFuel: 'systemsFinishes',
  coolingType: 'systemsFinishes',
  waterHeating: 'systemsFinishes',
  windowFrames: 'systemsFinishes',
  glazing: 'systemsFinishes',
  flooring: 'systemsFinishes',
  orientations: 'systemsFinishes',

  interiorFeatures: 'features',
  securityFeatures: 'features',
  amenities: 'features',
};

// ============================================================================
// 3. ΤΑ ΜΕΛΗ ΚΑΙ Η ΛΟΓΙΣΤΙΚΗ ΤΟΥΣ — παραγόμενα, ποτέ ξαναγραμμένα
// ============================================================================

/** Τα στοιχεία μιας ομάδας, **στη σειρά του πίνακα αποκάλυψης**. */
export interface ListingGroupMembers {
  readonly attributes: readonly ListingAttributeKey[];
  readonly featureSets: readonly ListingFeatureSetKey[];
}

/**
 * Ποια στοιχεία ανήκουν σε αυτή την ομάδα.
 *
 * ⚠️ **Δύο κατάλογοι και όχι ένας ανάμεικτος**, για τον ίδιο λόγο που οι ρόλοι είναι
 * δύο: εμφανίζονται με **άλλον μηχανισμό** (γραμμή ετικέτα/τιμή vs ετικέτες
 * πολλαπλών τιμών). Ένας ανάμεικτος κατάλογος θα ανάγκαζε κάθε καταναλωτή να
 * ξαναρωτήσει τον πίνακα «τι είναι αυτό;» — δηλαδή θα μετέφερε την απόφαση από τον
 * τύπο στη συμπεριφορά.
 */
export function listingGroupMembers(group: ListingAttributeGroup): ListingGroupMembers {
  return {
    attributes: LISTING_ATTRIBUTE_KEYS.filter(
      (key) => LISTING_ATTRIBUTE_GROUP[key] === group
    ),
    featureSets: LISTING_FEATURE_SET_KEYS.filter(
      (key) => LISTING_ATTRIBUTE_GROUP[key] === group
    ),
  };
}

/**
 * Η **κλειστή λογιστική μιας ομάδας** — *«2 από 3»*, πάντα, ακόμη και στο «3 από 3».
 *
 * 🔑 **Ίδια μηχανή με τη συνολική** (`ledgerOver`), άλλη εμβέλεια. Ένας δεύτερος
 * μετρητής θα ήταν δεύτερη αλήθεια για το ίδιο ερώτημα (ADR-749) — και θα απέκλινε
 * την ημέρα που αλλάξει ο ορισμός του «δηλωμένο» για τα σύνολα (`declared-none`
 * **μετράει** ως δηλωμένο, γιατί ο κάτοχος **απάντησε**).
 */
export function listingGroupLedger(
  listing: PublicListing,
  group: ListingAttributeGroup
): ListingAttributeLedger {
  const members = listingGroupMembers(group);
  return ledgerOver(listing, members.attributes, members.featureSets);
}
