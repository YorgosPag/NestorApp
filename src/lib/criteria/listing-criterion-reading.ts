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
 * | «ποιο κανονικό είδος είναι;» | **το σύνορο ανάγνωσης** *(ADR-842 §7.6.12)* — δεν ρωτιέται πια εδώ |
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
import { getEffectivePrice, priceClassOf, type PriceRole } from '@/lib/properties/price-resolver';
import { isLandProperty } from '@/constants/property-classification';

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
  if (isLandProperty(listing.type) && !landCanAnswer(key)) return false;
  return priceAxisAppliesTo(listing, key);
}

/**
 * **Η ΔΕΥΤΕΡΗ ΚΛΑΣΗ ΑΡΝΗΣΗΣ — Η ΜΟΝΑΔΑ** (ADR-777 §8.60.14 Φάση 2).
 *
 * Ένα εύρος σε **€/μήνα** δεν είναι χαλαρό ή αυστηρό για μια αγγελία **πώλησης** —
 * **δεν τη ρώτησε**. Η σωστή απάντηση δεν είναι `excluded` *(θα την εξαφάνιζε για
 * ερώτηση που δεν της έγινε)* ούτε `never-asked` *(θα χρέωνε στον κάτοχο σιωπή που
 * δεν του ζητήθηκε)*: είναι `not-applicable` — *«ο άξονας αγνοείται»*, η τέταρτη
 * κατάσταση που το `criterion-vocabulary` ορίζει ρητά ως **δήλωση για την ερώτηση,
 * όχι για την αγγελία**.
 *
 * 🔑 **Ο ρόλος έρχεται από τον ΕΝΑ κριτή** (`priceClassOf`) — τον ίδιο που διαμερίζει
 * τη λίστα σε τμήματα. Χάρτης, σειρά και φίλτρο απαντούν στο *«τι είδους ποσό είναι
 * αυτό;»* με **μία** φωνή.
 *
 * ⚠️ Αγγελία **χωρίς** τιμή (`'unpriced'`) δεν ταιριάζει σε **κανέναν** από τους τρεις
 * άξονες ⇒ `not-applicable` παντού, και μένει ορατή. Ήταν ήδη έτσι: ο παλιός
 * αναγνώστης επέστρεφε `null` ⇒ `never-asked`. **Η αλλαγή είναι ότι παύει να χρεώνεται
 * ως σιωπή του κατόχου** — η τιμή δεν είναι δήλωσή του, είναι **λυμένη** από τις
 * διαθέσεις (δες το σχόλιο του άξονα στο `BESPOKE_ASKING`).
 */
function priceAxisAppliesTo(listing: PublicListing, key: CriterionKey): boolean {
  const wanted = PRICE_AXIS_CLASS[key as PriceAxisKey];
  return wanted === undefined || priceClassOf(listing) === wanted;
}

/**
 * **Ποιος άξονας ρωτά ποια μονάδα** — `Record` πάνω στους τρεις, ώστε ένας τέταρτος
 * ρόλος να **μη μεταγλωττίζεται** χωρίς άξονα και ένας άξονας χωρίς ρόλο καθόλου.
 */
const PRICE_AXIS_CLASS = {
  priceSale: 'sale',
  priceRent: 'rent',
  priceNightly: 'nightly',
} as const satisfies Partial<Record<CriterionKey, PriceRole>>;

type PriceAxisKey = keyof typeof PRICE_AXIS_CLASS;

/**
 * **Ποια διάθεση οδηγεί ποιον άξονα τιμής** — `undefined` για διάθεση χωρίς ποσό (ανταλλαγή).
 *
 * 🔑 **Ζει ΕΔΩ, δίπλα στο {@link PRICE_AXIS_CLASS}**, επειδή είναι η **ίδια** γνώση από την άλλη
 * πλευρά: εκεί «ο άξονας ρωτά αυτή τη μονάδα», εδώ «αυτή η διάθεση ρωτά αυτόν τον άξονα». Γεννήθηκε
 * στη γραμμή φίλτρων (`components/search-results/filters`) και **ανέβηκε** στο λεξιλόγιο όταν τη
 * χρειάστηκε **δεύτερος** καταναλωτής (η προβολή ζήτησης → φίλτρα): ένα `lib/` που εισάγει από
 * `components/` είναι αντιστροφή επιπέδων, και ένα δεύτερο χειρόγραφο αντίγραφο θα απέκλινε.
 */
export const PRICE_AXIS_OF_OFFER_KIND: Readonly<Record<string, PriceAxisKey | undefined>> = {
  sell: 'priceSale',
  leaseOut: 'priceRent',
  leaseShort: 'priceNightly',
};

/**
 * **Ποιον άξονα τιμής σηκώνει ΑΥΤΗ η αγγελία;** — `null` όταν κανέναν (`'unpriced'`).
 *
 * 🔴 **ΓΙΑΤΙ ΕΞΑΓΕΤΑΙ** (ζωντανό 500, 2026-09-18): όταν το §8.60.14 έσπασε το ενιαίο
 * `'price'` σε τρεις άξονες, ο άξονας τιμής της **ζήτησης** έμεινε να ζητά το παλιό
 * όνομα ⇒ `NUMERIC_READERS['price']` ήταν `undefined` ⇒ `TypeError` ⇒ **500** σε κάθε
 * `GET /api/demand/interest` με ζήτηση που δηλώνει εύρος τιμής. Ο καλών **δεν** επιτρέπεται
 * να μαντεύει όνομα άξονα: η σχέση ρόλου ↔ άξονα ζει **εδώ**, στον ίδιο πίνακα που την
 * επιβάλλει — αντιστροφή του {@link PRICE_AXIS_CLASS}, ποτέ δεύτερη λίστα που θα απέκλινε.
 */
export function priceAxisKeyOf(listing: PublicListing): PriceAxisKey | null {
  const role = priceClassOf(listing);
  const entry = Object.entries(PRICE_AXIS_CLASS).find(([, axisRole]) => axisRole === role);
  return entry === undefined ? null : (entry[0] as PriceAxisKey);
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
  /**
   * 🔑 **Δεν είναι δημόσιο στοιχείο, είναι ΛΥΜΕΝΗ τιμή** — γι' αυτό δεν περνά από τον
   * `isAttributeDeclared`: η τιμή δεν «δηλώνεται» ως πεδίο, **προκύπτει** από τις
   * διαθέσεις. Ο μοναδικός επιλυτής είναι το `getEffectivePrice`.
   *
   * ⚠️ **Και οι τρεις διαβάζουν το ΙΔΙΟ ποσό, και είναι σωστό**: η **μονάδα** κρίθηκε
   * ήδη στο {@link priceAxisAppliesTo} — αν φτάσαμε εδώ, η αγγελία **είναι** αυτού του
   * ρόλου. Ένας δεύτερος έλεγχος ρόλου εδώ θα ήταν η ίδια κρίση, δεύτερη φορά,
   * ελεύθερη να αποκλίνει.
   */
  priceSale: (listing) => getEffectivePrice(listing)?.amount ?? null,
  priceRent: (listing) => getEffectivePrice(listing)?.amount ?? null,
  priceNightly: (listing) => getEffectivePrice(listing)?.amount ?? null,
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
   * 🔴 **Η ΚΑΝΟΝΙΚΟΠΟΙΗΣΗ ΜΕΤΑΚΟΜΙΣΕ ΣΤΟ ΣΥΝΟΡΟ** (ADR-842 §7.6.12 / §8 #11). Εδώ
   * έγραφε `normalizePropertyType(l.type) ?? l.type`, με αιτιολογία *«το
   * `PublicListing.type` δηλώνει ρητά ότι κουβαλά και παλαιές ελληνικές τιμές»* — που
   * **έπαψε να ισχύει** 2026-09-06: με τη φάση contract ο τύπος είναι
   * `PropertyTypeCanonical | null` και μεταφράζεται **μία φορά**, στην ανάγνωση.
   *
   * 🔑 **Η βλάβη που το γέννησε μένει κλεισμένη**: μια αγγελία γραμμένη `'Οικόπεδο'`
   * εξακολουθεί να απαντά στο φίλτρο `plot` — απλώς έχει ήδη γίνει `plot` πριν φτάσει
   * εδώ, αντί να ελπίζει ότι **αυτός** ο αναγνώστης θα το θυμηθεί.
   *
   * ⚠️ **Η μη αναγνωρίσιμη τιμή δεν «ταξιδεύει αυτούσια» πια — δεν ΦΤΑΝΕΙ**: το σύνορο
   * τη μετατρέπει σε `null` (με καταγραφή), και η πύλη δημοσίευσης αρνείται να τη
   * δημοσιεύσει. Το `null` το πιάνει το `isAttributeDeclared` του {@link singleValue}
   * και δίνει `never-asked` — που είναι πλέον **αληθές**: δεν ξέρουμε τι δήλωσε.
   */
  type: singleValue('type', (l) => l.type),
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
