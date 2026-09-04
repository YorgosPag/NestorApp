/**
 * @fileoverview **ΤΙ ΡΩΤΗΣΕ Ο ΑΝΘΡΩΠΟΣ** — ο χάρτης κριτηρίων, ένας ανά αναζήτηση.
 * @related ADR-777 §7 (Α3) · ADR-749 · ./listing-criterion-asking
 * @module lib/criteria/listing-criteria
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΕΝΑΣ ΧΑΡΤΗΣ, ΤΥΠΩΜΕΝΟΣ ΑΝΑ ΑΞΟΝΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * ```ts
 * criteria.areaSqm    // CriterionRange | undefined
 * criteria.amenities  // readonly string[] | undefined
 * criteria.hasPhotos  // boolean | undefined
 * ```
 *
 * Ο τύπος της τιμής **παράγεται από το σχήμα** του άξονα, δηλαδή από τον ίδιο πίνακα
 * που ο μεταγλωττιστής επιβάλλει εξαντλητικά. Δεν υπάρχει τρόπος να γραφτεί εύρος
 * εκεί που περιμένεται σύνολο.
 *
 * ⛔ **ΓΙΑΤΙ ΟΧΙ ~40 ΕΠΙΠΕΔΑ ΠΕΔΙΑ ΣΤΟ `ListingFilters`.** Η προφανής εναλλακτική —
 * `bathroomsMin`, `bathroomsMax`, `energyClass`, `heatingType`, … — δίνει διεπαφή που
 * **δεν** μπορεί να επαναληφθεί: κάθε νέος άξονας απαιτεί χειρόγραφη γραμμή στη
 * διεπαφή, στο `EMPTY_*`, στον αναγνώστη διεύθυνσης, στον γραφέα και στον κριτή —
 * **πέντε** θέσεις, καμία τους εξαντλητική. Ακριβώς έτσι απέκλιναν τα τέσσερα
 * λεξιλόγια που αυτός ο φάκελος ενοποιεί.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΚΕΝΟ ΚΡΙΤΗΡΙΟ ΔΕΝ ΑΠΟΘΗΚΕΥΕΤΑΙ ΠΟΤΕ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * `{ min: null, max: null }` και `[]` **δεν γράφονται** — ο άξονας απλώς λείπει.
 * Ο κανόνας επιβάλλεται στους **κατασκευαστές** ({@link withRange}, {@link withValues},
 * {@link withFlag}) και όχι μόνο στη σειριοποίηση, γιατί αλλιώς δύο **ταυτόσημες**
 * αναζητήσεις θα είχαν διαφορετικό χάρτη: η μία με `bathrooms: {min:null,max:null}`,
 * η άλλη χωρίς. Και τότε κάθε σύγκριση *(«άλλαξε το φίλτρο;», «είναι ίδια με την
 * αποθηκευμένη ζήτηση;»)* θα έλεγε **ναι** χωρίς να έχει αλλάξει τίποτα.
 *
 * **Layering**: leaf — τύποι και καθαρές συναρτήσεις.
 */

import {
  isAskedRange,
  type CriterionRange,
} from './criterion-vocabulary';
import {
  LISTING_CRITERION_ASKING,
  LISTING_CRITERION_KEYS,
  type CriterionKey,
  type FlagCriterionKey,
  type RangeCriterionKey,
  type ValueSetCriterionKey,
} from './listing-criterion-asking';

// =============================================================================
// 1. Ο ΤΥΠΟΣ
// =============================================================================

/** Το σχήμα αυτού του άξονα, σε επίπεδο **τύπου**. */
type ShapeOf<K extends CriterionKey> = (typeof LISTING_CRITERION_ASKING)[K];

/**
 * Ο τύπος της τιμής που δέχεται αυτός ο άξονας — **παραγόμενος από το σχήμα του**.
 *
 * ⚠️ Τα τρία σχήματα συνόλου *(`enum-any` · `set-any` · `set-all`)* μοιράζονται
 * **αποθήκευση**, όχι **κρίση**: όλα κρατούν `readonly string[]`, και η διαφορά τους
 * ζει στον κριτή. Ένας τρίτος τύπος αποθήκευσης θα ανάγκαζε κάθε καταναλωτή να
 * ξαναρωτήσει τον πίνακα «τι είναι αυτό;».
 */
export type CriterionValueOf<K extends CriterionKey> = ShapeOf<K> extends 'range'
  ? CriterionRange
  : ShapeOf<K> extends 'flag'
    ? boolean
    : readonly string[];

/**
 * **Ο χάρτης κριτηρίων** — «τι ρώτησε ο άνθρωπος», μία φορά.
 *
 * ⚠️ **Άξονας που λείπει = δεν ρωτήθηκε**, ποτέ «ρωτήθηκε με ουδέτερη τιμή». Είναι ο
 * ίδιος κανόνας με το `guests: null` *(«δεν ρωτήθηκε, ποτέ ένα»)*, γενικευμένος.
 */
export type ListingCriteria = {
  readonly [K in CriterionKey]?: CriterionValueOf<K>;
};

/** Καμία ερώτηση. **Ο κενός χάρτης είναι κενό αντικείμενο** — όχι 30 `null`. */
export const EMPTY_LISTING_CRITERIA: ListingCriteria = {};

// =============================================================================
// 2. ΑΝΑΓΝΩΣΗ — τυπωμένη ανά σχήμα
// =============================================================================

/**
 * Το εύρος που ζητήθηκε σε αυτόν τον άξονα, ή `undefined`.
 *
 * 🔑 **Τρεις αναγνώστες αντί για ένα `criteria[key]`, και ο λόγος είναι ο κριτής.**
 * Ένας γενικός αναγνώστης θα επέστρεφε `CriterionRange | readonly string[] | boolean`,
 * και **κάθε** καταναλωτής θα έπρεπε να ξανακάνει τη διάκριση που ο πίνακας σχημάτων
 * έχει ήδη κάνει — δηλαδή θα υπήρχαν τόσες υλοποιήσεις της όσοι και οι καταναλωτές.
 */
export function rangeOf(
  criteria: ListingCriteria,
  key: RangeCriterionKey
): CriterionRange | undefined {
  return criteria[key];
}

/** Οι τιμές που ζητήθηκαν σε αυτόν τον άξονα, ή `undefined`. */
export function valuesOf(
  criteria: ListingCriteria,
  key: ValueSetCriterionKey
): readonly string[] | undefined {
  return criteria[key];
}

/** Η σημαία που ζητήθηκε σε αυτόν τον άξονα, ή `undefined`. */
export function flagOf(
  criteria: ListingCriteria,
  key: FlagCriterionKey
): boolean | undefined {
  return criteria[key];
}

// =============================================================================
// 3. ΓΡΑΨΙΜΟ — ο κενός άξονας ΦΕΥΓΕΙ, δεν αποθηκεύεται κενός
// =============================================================================

/**
 * Ένα **προσωρινό αντίγραφο** του χάρτη, γραπτό.
 *
 * ⚠️ **Νέο αντικείμενο, ΠΟΤΕ μετάλλαξη του δοσμένου.** Ο χάρτης ταξιδεύει σε
 * `useMemo`/`useSyncExternalStore`: μια μετάλλαξη στη θέση της δεν θα άλλαζε την
 * ταυτότητα — δηλαδή η οθόνη δεν θα ξαναζωγράφιζε, και το φίλτρο θα «κολλούσε».
 */
type CriteriaDraft = { -readonly [K in CriterionKey]?: CriterionValueOf<K> };

function draftOf(criteria: ListingCriteria): CriteriaDraft {
  return { ...criteria };
}

/**
 * **Αφαιρεί έναν άξονα από τον χάρτη.**
 *
 * 🔑 **Δημόσιο από τις 2026-09-04 (Στάδιο 3), και ο δεύτερος καταναλωτής είναι ο
 * λόγος**: τα πλήθη ανά επιλογή απαντούν *«αν πατήσω ΑΥΤΟ, πόσα θα δω;»* — ερώτηση
 * που κρίνεται πάνω στο σύνολο **χωρίς** τον ίδιο τον άξονα *(διαζευκτικές όψεις, το
 * πρότυπο Elasticsearch/Algolia)*. Με τον άξονα μέσα, κάθε **ανεπίλεκτη** επιλογή θα
 * μετρούσε μηδέν — δηλαδή η οθόνη θα έλεγε ότι δεν υπάρχει τίποτα, ενώ υπάρχει.
 *
 * ⚠️ Ήταν ήδη γραμμένο και **ιδιωτικό**· έγινε `export` αντί να γραφτεί δεύτερο
 * ταυτόσημο τριών γραμμών σε άλλο αρχείο (N.0.2 · CHECK 3.28).
 */
export function without(criteria: ListingCriteria, key: CriterionKey): ListingCriteria {
  if (!(key in criteria)) return criteria;
  const next = draftOf(criteria);
  delete next[key];
  return next;
}

/** Θέτει εύρος. **Κενό εύρος ⇒ ο άξονας φεύγει.** */
export function withRange(
  criteria: ListingCriteria,
  key: RangeCriterionKey,
  range: CriterionRange
): ListingCriteria {
  if (!isAskedRange(range)) return without(criteria, key);
  const next = draftOf(criteria);
  next[key] = range;
  return next;
}

/**
 * Θέτει τιμές. **Κενό σύνολο ⇒ ο άξονας φεύγει.**
 *
 * 🔑 **Το κενό σύνολο σημαίνει «όλες οι τιμές», όχι «καμία»** — ίδια σημασιολογία με
 * το σημερινό `offerKinds: []` *(«όλες οι διαθέσεις, όχι καμία»)*. Άρα η ουδέτερη
 * κατάσταση είναι **απουσία**, και η αποθήκευση ενός `[]` θα ήταν δεύτερη γραφή της
 * ίδιας ερώτησης.
 */
export function withValues(
  criteria: ListingCriteria,
  key: ValueSetCriterionKey,
  values: readonly string[]
): ListingCriteria {
  if (values.length === 0) return without(criteria, key);
  const next = draftOf(criteria);
  next[key] = values;
  return next;
}

/**
 * Θέτει σημαία. **`undefined` ⇒ ο άξονας φεύγει.**
 *
 * ⚠️ **Το `false` ΔΕΝ είναι απουσία, και αποθηκεύεται.** «Μόνο **χωρίς**
 * φωτογραφίες» είναι υπαρκτή ερώτηση *(π.χ. ο επαγγελματίας που ψάχνει αγγελίες
 * να βελτιώσει)*, και είναι **διαφορετική** από το «δεν με νοιάζει».
 */
export function withFlag(
  criteria: ListingCriteria,
  key: FlagCriterionKey,
  value: boolean | undefined
): ListingCriteria {
  if (value === undefined) return without(criteria, key);
  const next = draftOf(criteria);
  next[key] = value;
  return next;
}

// =============================================================================
// 4. ΛΟΓΙΣΤΙΚΗ ΤΟΥ ΙΔΙΟΥ ΤΟΥ ΧΑΡΤΗ
// =============================================================================

/**
 * **Ποιοι άξονες ρωτούν κάτι** — στη σειρά του πίνακα, ποτέ στη σειρά του
 * `Object.keys` του χάρτη.
 *
 * 🔑 **Η σειρά έρχεται από τη δήλωση, όχι από την εισαγωγή.** Ο χάρτης χτίζεται με τη
 * σειρά που έτυχε να πατήσει ο άνθρωπος τα χειριστήρια· η οθόνη οφείλει να τα δείχνει
 * **πάντα** με την ίδια σειρά, αλλιώς η λίστα των ενεργών φίλτρων χοροπηδά.
 *
 * ⚠️ Ένας άξονας μπορεί να **υπάρχει** στον χάρτη και να μη ρωτά τίποτα, αν κάποιος
 * τον έγραψε παρακάμπτοντας τους κατασκευαστές. Ο έλεγχος γίνεται **και εδώ** — ζώνη
 * και τιράντες (N.7.2 #4): ο κανόνας επιβάλλεται στην είσοδο, αλλά η ανάγνωση δεν
 * τον εμπιστεύεται.
 */
export function askedCriterionKeys(criteria: ListingCriteria): readonly CriterionKey[] {
  return LISTING_CRITERION_KEYS.filter((key) => criterionAsksSomething(criteria, key));
}

/** Ρωτά κάτι αυτός ο άξονας; */
function criterionAsksSomething(
  criteria: ListingCriteria,
  key: CriterionKey
): boolean {
  const value = criteria[key];
  if (value === undefined) return false;
  switch (LISTING_CRITERION_ASKING[key]) {
    case 'range':
      return isAskedRange(value as CriterionRange);
    case 'flag':
      return true;
    default:
      return (value as readonly string[]).length > 0;
  }
}
