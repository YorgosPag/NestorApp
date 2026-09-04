/**
 * @fileoverview **ΤΙ ΑΠΑΝΤΑ Η ΑΓΓΕΛΙΑ ΣΕ ΚΑΘΕ ΑΞΟΝΑ** — και σε ποια από τις τέσσερις
 *   καταστάσεις είναι η απάντηση.
 * @related ADR-777 §7 (Α5 · §8.32) · ADR-842 Α7 · ADR-842 §7.6.11 · N.12
 * @module lib/criteria/listing-criterion-reading
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΔΕΝ ΞΕΡΕΙ ΤΙΠΟΤΑ — ΡΩΤΑΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Κάθε ερώτημα που έχει **ήδη** αυθεντία στο έργο, **ρωτιέται**· δεν ξαναγράφεται:
 *
 * | Ερώτημα | Ποιον ρωτάμε |
 * |---|---|
 * | «έχει δηλωθεί αυτή η ιδιότητα;» | `isAttributeDeclared` *(`listing-attribute-declared`)* |
 * | «σε ποια από τις τρεις καταστάσεις είναι το σύνολο;» | `featureSetState` — ίδιο αρχείο |
 * | «είναι γη;» | `isLandProperty` — ο **ΕΝΑΣ** κριτής *(ADR-842 §7.6.11)* |
 * | «ποια είναι η τιμή;» | `getEffectivePrice` *(23 καταναλωτές)* |
 * | «ποιο κανονικό είδος είναι;» | `normalizePropertyType` |
 *
 * 🔴 **Ο λόγος είναι μετρημένος, όχι αισθητικός.** Ένα `listing.levels !== null` εδώ
 * θα ήταν **δεύτερος** κριτής δίπλα στον `ATTRIBUTE_DECLARED.levels`, που ελέγχει
 * **επιπλέον** το `isPubliclyPresentable` *(ADR-842 Α7: χαρακτηριστικό που μάντεψε
 * μοντέλο δεν φτάνει στον αγοραστή ως γεγονός)*. Δηλαδή η αναζήτηση θα φιλτράριζε σε
 * δεδομένο που η οθόνη **αρνείται να δείξει** — και η διαφορά θα φαινόταν μόνο την
 * ημέρα που ο γραφέας αρχίσει να παράγει `inferred`.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις πάνω σε `PublicListing`. Καμία εξάρτηση από
 * React/Firestore, καμία γνώση της διεύθυνσης.
 */

import type { PublicListing } from '@/types/public-listing';
import type {
  ListingAttributeKey,
  ListingFeatureSetKey,
} from '@/lib/listings/listing-disclosure';
import {
  featureSetState,
  isAttributeDeclared,
  listingFeatureSetValues,
} from '@/lib/listings/listing-attribute-declared';
import { getEffectivePrice } from '@/lib/properties/price-resolver';
import { isLandProperty } from '@/constants/property-classification';
import { normalizePropertyType } from '@/constants/property-type-aliases';

import {
  DECLARED_NONE,
  NEVER_ASKED,
  NOT_APPLICABLE,
  declaredAnswer,
  type CriterionAnswer,
} from './criterion-vocabulary';
import {
  landCanAnswer,
  type CriterionKey,
  type FlagCriterionKey,
  type RangeCriterionKey,
  type ValueSetCriterionKey,
} from './listing-criterion-asking';

// =============================================================================
// 1. Ο ΦΡΟΥΡΟΣ ΤΗΣ ΕΦΑΡΜΟΣΙΜΟΤΗΤΑΣ — πριν από κάθε ανάγνωση
// =============================================================================

/**
 * **Σηκώνει ΑΥΤΗ η αγγελία αυτή την ερώτηση;**
 *
 * 🔴 **Ρωτιέται ΠΡΩΤΟΣ, πάντα** — πριν αγγίξουμε το πεδίο. Ένα οικόπεδο έχει
 * `bedrooms: null` **εκ κατασκευής** *(`ownerPropertyDraftFrom`: «`floor: land ? null
 * : …`»)*, άρα μια ανάγνωση που έτρεχε πρώτη θα το κατέτασσε στο `never-asked` —
 * δηλαδή θα το έβαζε στον κάδο *«3 δεν το δήλωσαν»* και θα ζητούσε από τον κάτοχο γης
 * να δηλώσει υπνοδωμάτια. Η σειρά **είναι** η σημασία.
 *
 * ⚠️ Σήμερα η μόνη κλάση με άρνηση είναι η **γη**, και ο λόγος γράφεται ολόκληρος στο
 * {@link LAND_CANNOT_ANSWER}. Η συνάρτηση μένει σε αυτή τη μορφή ώστε μια δεύτερη
 * κλάση να προστεθεί **εδώ** και όχι σε κάθε αναγνώστη.
 */
export function criterionAppliesTo(listing: PublicListing, key: CriterionKey): boolean {
  return !isLandProperty(listing.type) || landCanAnswer(key);
}

// =============================================================================
// 2. ΟΙ ΑΡΙΘΜΗΤΙΚΟΙ ΑΞΟΝΕΣ
// =============================================================================

type NumericReader = (listing: PublicListing) => number | null;

/**
 * Ένα δημόσιο στοιχείο που είναι **σκέτος αριθμός** στο `PublicListing`.
 *
 * ⚠️ **Ο έλεγχος «δηλωμένο;» γίνεται με τον υπάρχοντα κριτή, ΚΑΙ ΜΕΤΑ διαβάζεται η
 * τιμή.** Τα δύο δεν είναι το ίδιο ερώτημα: το `levels` είναι δηλωμένο **μόνο** αν
 * είναι και δημοσιεύσιμο *(Α7)*, κι ας έχει τιμή.
 */
function plainNumber<K extends ListingAttributeKey>(
  key: K,
  read: (listing: PublicListing) => number | null
): NumericReader {
  return (listing) => (isAttributeDeclared(listing, key) ? read(listing) : null);
}

/**
 * **Οι αναγνώστες αριθμού, εξαντλητικά πάνω στους άξονες εύρους.**
 *
 * 🔑 `Record<RangeCriterionKey, …>` ⇒ νέος άξονας με σχήμα `'range'` **δεν
 * μεταγλωττίζεται** μέχρι να πει από πού διαβάζεται.
 */
const NUMERIC_READERS: Record<RangeCriterionKey, NumericReader> = {
  areaSqm: plainNumber('areaSqm', (l) => l.areaSqm),
  floor: plainNumber('floor', (l) => l.floor),
  bedrooms: plainNumber('bedrooms', (l) => l.bedrooms),
  renovationYear: plainNumber('renovationYear', (l) => l.renovationYear),
  bathrooms: plainNumber('bathrooms', (l) => l.bathrooms),
  wc: plainNumber('wc', (l) => l.wc),
  totalRooms: plainNumber('totalRooms', (l) => l.totalRooms),
  /**
   * ⚠️ **Το μόνο στοιχείο με προέλευση.** Η τιμή ζει στο `.value`· η άδεια να φύγει
   * δημόσια την κρίνει ο `ATTRIBUTE_DECLARED.levels`, που **ήδη** ρωτά το
   * `isPubliclyPresentable`. Εδώ δεν επαναλαμβάνεται ο έλεγχος — γίνεται από τον
   * {@link plainNumber}.
   */
  levels: plainNumber('levels', (l) => l.levels?.value ?? null),
  balconies: plainNumber('balconies', (l) => l.balconies),
  netAreaSqm: plainNumber('netAreaSqm', (l) => l.netAreaSqm),
  balconyAreaSqm: plainNumber('balconyAreaSqm', (l) => l.balconyAreaSqm),
  terraceAreaSqm: plainNumber('terraceAreaSqm', (l) => l.terraceAreaSqm),
  gardenAreaSqm: plainNumber('gardenAreaSqm', (l) => l.gardenAreaSqm),
  /**
   * 🔑 **Δεν είναι δημόσιο στοιχείο, είναι ΛΥΜΕΝΗ τιμή** — γι' αυτό δεν περνά από τον
   * `isAttributeDeclared`: η τιμή δεν «δηλώνεται» ως πεδίο, **προκύπτει** από τις
   * διαθέσεις. Ο μοναδικός επιλυτής είναι το `getEffectivePrice`, όπως ακριβώς έκανε
   * και ο παλιός κριτής.
   */
  price: (listing) => getEffectivePrice(listing)?.amount ?? null,
};

/** Η απάντηση της αγγελίας σε **αριθμητικό** άξονα. */
export function readNumericAnswer(
  listing: PublicListing,
  key: RangeCriterionKey
): CriterionAnswer<number> {
  if (!criterionAppliesTo(listing, key)) return NOT_APPLICABLE;
  const value = NUMERIC_READERS[key](listing);
  return value === null ? NEVER_ASKED : declaredAnswer(value);
}

// =============================================================================
// 3. ΟΙ ΑΞΟΝΕΣ ΜΕ ΤΙΜΕΣ ΛΕΞΙΛΟΓΙΟΥ
// =============================================================================

type ValuesReader = (listing: PublicListing) => CriterionAnswer<readonly string[]>;

/**
 * Ένα δημόσιο στοιχείο με **μία** τιμή λεξιλογίου.
 *
 * 🔑 **Η μοναδική τιμή ταξιδεύει ως πίνακας ενός στοιχείου**, ώστε ο κριτής να έχει
 * **ένα** σχήμα να κρίνει. Δεν χάνεται πληροφορία: η διαφορά «μία τιμή» ⇄ «σύνολο»
 * ζει ήδη στο **σχήμα** (`enum-any` ⇄ `set-any`/`set-all`) και η κρίση τη διαβάζει
 * από εκεί. Ένας δεύτερος τύπος απάντησης θα ανάγκαζε κάθε καταναλωτή να ρωτήσει
 * ξανά «τι είναι αυτό;» — δηλαδή θα μετέφερε την απόφαση από τον τύπο στη συμπεριφορά.
 *
 * ⚠️ **`declared-none` ΔΕΝ προκύπτει ποτέ εδώ, και είναι σωστό**: μια μοναδική τιμή
 * είτε υπάρχει είτε όχι. Η τρίτη κατάσταση ανήκει **μόνο** στα σύνολα, όπου το `[]`
 * είναι **απάντηση του κατόχου** *(«καμία»)*.
 */
function singleValue<K extends ListingAttributeKey>(
  key: K,
  read: (listing: PublicListing) => string | null
): ValuesReader {
  return (listing) => {
    if (!isAttributeDeclared(listing, key)) return NEVER_ASKED;
    const value = read(listing);
    return value === null ? NEVER_ASKED : declaredAnswer([value]);
  };
}

/**
 * Ένα δημόσιο **σύνολο** — οι τρεις καταστάσεις έρχονται από τον υπάρχοντα κριτή.
 *
 * ⚠️ **Καμία δεύτερη ανάγνωση του `[]`.** Το `featureSetState` είναι η μία θέση όπου
 * ζει η διάκριση `never-asked` ⇄ `declared-none`, και ολόκληρο το ADR-842 Φ3 στηρίζεται
 * σε αυτήν *(«ο κάτοχος **απάντησε**»)*.
 */
function featureSet(key: ListingFeatureSetKey): ValuesReader {
  return (listing) => {
    switch (featureSetState(listing, key)) {
      case 'never-asked':
        return NEVER_ASKED;
      case 'declared-none':
        return DECLARED_NONE;
      case 'declared':
        return declaredAnswer(listingFeatureSetValues(listing, key) ?? []);
    }
  };
}

/**
 * **Οι αναγνώστες τιμών, εξαντλητικά πάνω στους άξονες με σύνολο.**
 */
const VALUES_READERS: Record<ValueSetCriterionKey, ValuesReader> = {
  /**
   * 🔑 **ΚΑΝΟΝΙΚΟΠΟΙΕΙΤΑΙ ΠΡΙΝ ΣΥΓΚΡΙΘΕΙ** — και αυτό είναι διόρθωση, όχι
   * διακόσμηση. Το `PublicListing.type` δηλώνει ρητά ότι κουβαλά και **παλαιές
   * ελληνικές** τιμές *(«για συμβατότητα με παλιά έγγραφα Firestore»)*, ενώ το
   * φίλτρο ρωτά με **κανονικά** ονόματα. Χωρίς κανονικοποίηση, μια αγγελία
   * `'Οικόπεδο'` **δεν θα απαντούσε ποτέ** στο φίλτρο `plot` — σιωπηλά.
   *
   * ⚠️ **Μη αναγνωρίσιμη τιμή ταξιδεύει ΑΥΤΟΥΣΙΑ, ποτέ ως `never-asked`.** Ο κάτοχος
   * **δήλωσε** κάτι· η αδυναμία μας να το διαβάσουμε δεν είναι σιωπή του. Ταιριάζει
   * μόνο σε φίλτρο που ζητά ακριβώς αυτό — δηλαδή σε κανένα, όσο τα φίλτρα
   * περιορίζονται στο κλειστό λεξιλόγιο.
   */
  type: singleValue('type', (l) => normalizePropertyType(l.type) ?? l.type),
  energyClass: singleValue('energyClass', (l) => l.energyClass),
  condition: singleValue('condition', (l) => l.condition),
  heatingType: singleValue('heatingType', (l) => l.heatingType),
  heatingFuel: singleValue('heatingFuel', (l) => l.heatingFuel),
  coolingType: singleValue('coolingType', (l) => l.coolingType),
  waterHeating: singleValue('waterHeating', (l) => l.waterHeating),
  windowFrames: singleValue('windowFrames', (l) => l.windowFrames),
  glazing: singleValue('glazing', (l) => l.glazing),
  flooring: featureSet('flooring'),
  orientations: featureSet('orientations'),
  interiorFeatures: featureSet('interiorFeatures'),
  securityFeatures: featureSet('securityFeatures'),
  amenities: featureSet('amenities'),
  /**
   * ⚠️ **Κενός πίνακας διαθέσεων = `declared-none`, όχι `never-asked`.** Μια αγγελία
   * που δεν προσφέρει τίποτα δεν είναι «δεν ρωτήθηκε» — είναι αγγελία εκτός αγοράς,
   * και ο άξονας οφείλει να την **αποκλείει** από κάθε ερώτηση διάθεσης αντί να τη
   * χαρίζει στον κάδο της άγνοιας.
   */
  offerKind: (listing) =>
    listing.offerKinds.length === 0 ? DECLARED_NONE : declaredAnswer(listing.offerKinds),
  /**
   * 🏆 **«Επαγγελματίες / Ιδιώτες» — ΠΑΝΤΑ δηλωμένο.** Το `authorship` δεν είναι
   * `| null`: κάθε αγγελία ξέρει αν προέρχεται από γραφείο ή από τον ίδιο τον κάτοχο
   * *(ADR-843 §10.16, οι δύο οικογένειες)*. Άρα αυτός ο άξονας **δεν παράγει ποτέ**
   * τον κάδο *«δεν το δήλωσαν»* — κι αυτό είναι το σπάνιο, όχι ο κανόνας.
   */
  authorship: (listing) => declaredAnswer([listing.authorship]),
};

/** Η απάντηση της αγγελίας σε άξονα με **τιμές λεξιλογίου**. */
export function readValuesAnswer(
  listing: PublicListing,
  key: ValueSetCriterionKey
): CriterionAnswer<readonly string[]> {
  if (!criterionAppliesTo(listing, key)) return NOT_APPLICABLE;
  return VALUES_READERS[key](listing);
}

// =============================================================================
// 4. ΟΙ ΑΞΟΝΕΣ ΝΑΙ/ΟΧΙ
// =============================================================================

type FlagReader = (listing: PublicListing) => boolean;

/**
 * **Οι αναγνώστες ναι/όχι, εξαντλητικά.**
 *
 * 🔑 **Ποτέ `never-asked`, και είναι ουσιαστικό**: το «έχει φωτογραφίες;» δεν είναι
 * δήλωση του κατόχου που μπορεί να λείπει — είναι **γεγονός του εγγράφου** που το
 * ξέρουμε πάντα. Ένας κάδος άγνοιας εδώ θα ήταν φρουρός χωρίς απόδειξη ζωής.
 *
 * ⚠️ **Ρωτιούνται ΚΑΙ ΤΑ ΔΥΟ πεδία.** Το εξώφυλλο και η συλλογή γεμίζουν από
 * διαφορετικές διαδρομές, και μια αγγελία με συλλογή αλλά χωρίς επιλεγμένο εξώφυλλο
 * **έχει** φωτογραφίες.
 */
const FLAG_READERS: Record<FlagCriterionKey, FlagReader> = {
  hasPhotos: (listing) => listing.coverImage !== null || listing.gallery.length > 0,
};

/** Η απάντηση της αγγελίας σε άξονα **ναι/όχι**. */
export function readFlagAnswer(
  listing: PublicListing,
  key: FlagCriterionKey
): CriterionAnswer<boolean> {
  if (!criterionAppliesTo(listing, key)) return NOT_APPLICABLE;
  return declaredAnswer(FLAG_READERS[key](listing));
}
