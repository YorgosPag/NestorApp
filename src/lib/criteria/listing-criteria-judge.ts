/**
 * @fileoverview **ΤΑΙΡΙΑΖΕΙ; — ΚΑΙ ΟΤΑΝ ΔΕΝ ΞΕΡΟΥΜΕ, ΤΟ ΛΕΕΙ.**
 * @related ADR-777 §7 (Α5 · §8.32) · ADR-842 Φ3 · SPEC-777B §12.6 · ./criterion-vocabulary
 * @module lib/criteria/listing-criteria-judge
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΤΟ ΣΗΜΕΙΟ ΟΠΟΥ ΞΕΠΕΡΝΑΜΕ ΤΟΝ ΚΛΑΔΟ — ΚΑΙ ΕΙΝΑΙ ΜΕΤΡΗΜΕΝΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Σήμερα οι αγγελίες μας δηλώνουν **12 από τα 27** δημόσια στοιχεία
 * *(`listingGroupLedger`)*. Άρα ένα φίλτρο «ενεργειακή κλάση Β» με `boolean` κριτή θα
 * **εξαφάνιζε τις μισές αγγελίες χωρίς να το πει** — μετατρέποντας το *«δεν ξέρουμε»*
 * σε *«δεν είναι»*, που είναι **διαφορετικός ισχυρισμός και ψευδής** *(κανόνας Α5:
 * «η άγνοιά μας δεν γίνεται ισχυρισμός»)*.
 *
 * 📐 **Και ο κλάδος δεν έχει απάντηση σε αυτό.** Η έρευνα UI φίλτρων του Baymard
 * *(Ιούλιος 2026)* ρωτήθηκε ρητά για *«αντικείμενα που δεν έχουν την ιδιότητα στην
 * οποία φιλτράρεις»*: **δεν το πραγματεύεται**. Η μελέτη *Strategic under-disclosure
 * in online property platforms* καταγράφει ότι οι ελλιπείς αγγελίες είναι
 * **ενδημικές** — τυποποιημένα πεδία μένουν κενά ακόμη κι όταν η δήλωση είναι
 * εφικτή. Δηλαδή ο κλάδος έχει το πρόβλημα **και δεν έχει λύση**· εμείς είχαμε ήδη το
 * λεξιλόγιο *(`ListingFeatureSetState` · `UnknownPositionReason` · `UNCERTAIN_BLOCKERS`)*
 * και μας έλειπε **μόνο η χρήση** του.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΤΡΕΙΣ ΚΑΔΟΙ, ΚΑΙ Η ΠΡΟΤΕΡΑΙΟΤΗΤΑ ΤΟΥΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Κάδος | Πότε | Τι λέει η οθόνη |
 * |---|---|---|
 * | `matches` | κάθε άξονας ικανοποιήθηκε *(ή δεν ισχύει)* | «7 ταιριάζουν» |
 * | `excluded` | **έστω ένας** άξονας απάντησε και δεν ικανοποιεί | δεν δείχνεται |
 * | `undeclared` | κανένας αποκλεισμός, αλλά **έστω ένας** άξονας σιωπά | «3 δεν το δήλωσαν» |
 *
 * 🔑 **Ο αποκλεισμός ΝΙΚΑΕΙ την άγνοια, και είναι απόφαση.** Μια αγγελία ενοικίασης
 * όταν ζητάς πώληση είναι **κλειστή υπόθεση** — δεν γίνεται «ίσως» επειδή αγνοούμε την
 * ενεργειακή της κλάση. Η αντίστροφη προτεραιότητα θα γέμιζε τον κάδο της άγνοιας με
 * πράγματα που ξέρουμε ότι δεν ταιριάζουν, δηλαδή θα εκπαίδευε τον άνθρωπο να τον
 * αγνοεί — το ίδιο μάθημα με το `NEAR_MISS_MAX_AXES`.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις. Ίδια απάντηση σε χάρτη και λίστα.
 */

import type { PublicListing } from '@/types/public-listing';

import type { CriterionOutcome, CriterionRange } from './criterion-vocabulary';
import {
  LISTING_CRITERION_ASKING,
  type CriterionKey,
  type FlagCriterionKey,
  type RangeCriterionKey,
  type ValueSetCriterionKey,
} from './listing-criterion-asking';
import {
  askedCriterionKeys,
  flagOf,
  rangeOf,
  valuesOf,
  type ListingCriteria,
} from './listing-criteria';
import {
  readFlagAnswer,
  readNumericAnswer,
  readValuesAnswer,
} from './listing-criterion-reading';

// =============================================================================
// 1. ΤΑ ΠΡΩΤΟΓΟΝΑ ΤΗΣ ΚΡΙΣΗΣ
// =============================================================================

/**
 * Είναι ο **γνωστός** αριθμός μέσα στο εύρος;
 *
 * 🔑 **Δέχεται `number`, όχι `number | null` — και εκεί είναι όλη η διαφορά από τον
 * παλιό `withinRange`.** Η περίπτωση «δεν υπάρχει αριθμός» **δεν φτάνει ποτέ εδώ**:
 * την έχει ήδη ονομάσει ο αναγνώστης ως `never-asked`, και ο κριτής τη στέλνει στον
 * **δικό της κάδο** αντί να την ισοπεδώσει σε `false`. Ο παλιός `withinRange` κρατά
 * αυτή τη σημασιολογία για τη **ζήτηση**, που δεν έχει τρίτο κάδο — και **καλεί
 * αυτήν εδώ** για το κοινό μέρος, ώστε να μην υπάρχουν δύο απαντήσεις στο «μέσα;».
 */
export function satisfiesRange(value: number, range: CriterionRange): boolean {
  return (
    (range.min === null || value >= range.min) && (range.max === null || value <= range.max)
  );
}

/** Τέμνονται τα δύο σύνολα; — το κριτήριο των `enum-any` και `set-any`. */
function intersects(declared: readonly string[], wanted: readonly string[]): boolean {
  return declared.some((value) => wanted.includes(value));
}

/** Περιέχει το δηλωμένο **όλο** το ζητούμενο; — το κριτήριο του `set-all`. */
function containsAll(declared: readonly string[], wanted: readonly string[]): boolean {
  return wanted.every((value) => declared.includes(value));
}

// =============================================================================
// 2. Η ΚΡΙΣΗ ΕΝΟΣ ΑΞΟΝΑ
// =============================================================================

/**
 * **Τι απαντά αυτός ο άξονας για αυτή την αγγελία;**
 *
 * ⚠️ **Άξονας που δεν ρωτήθηκε δίνει `satisfied`, ποτέ `undeclared`.** Η σιωπή της
 * αγγελίας μετράει **μόνο εκεί όπου κάποιος ρώτησε**: το να μετρήσουμε ως «δεν το
 * δήλωσαν» ένα πεδίο που κανείς δεν ζήτησε θα γέμιζε τον κάδο με τις **27 μείον 12**
 * σιωπές **κάθε** αγγελίας, σε **κάθε** αναζήτηση.
 */
export function judgeCriterion(
  listing: PublicListing,
  criteria: ListingCriteria,
  key: CriterionKey
): CriterionOutcome {
  switch (LISTING_CRITERION_ASKING[key]) {
    case 'range':
      return judgeRange(listing, criteria, key as RangeCriterionKey);
    case 'flag':
      return judgeFlag(listing, criteria, key as FlagCriterionKey);
    default:
      return judgeValues(listing, criteria, key as ValueSetCriterionKey);
  }
}

function judgeRange(
  listing: PublicListing,
  criteria: ListingCriteria,
  key: RangeCriterionKey
): CriterionOutcome {
  const range = rangeOf(criteria, key);
  if (range === undefined) return 'satisfied';

  const answer = readNumericAnswer(listing, key);
  switch (answer.state) {
    case 'not-applicable':
      return 'not-applicable';
    case 'never-asked':
      return 'undeclared';
    // ⚠️ Ένας **αριθμός** δεν έχει «δήλωσε καμία»: το `declared-none` ανήκει στα
    // σύνολα. Ο αναγνώστης δεν το παράγει ποτέ εδώ, και ο κλάδος υπάρχει ώστε ο
    // μεταγλωττιστής να επιβάλλει την πλήρη κάλυψη της ένωσης.
    case 'declared-none':
      return 'undeclared';
    case 'declared':
      return satisfiesRange(answer.value, range) ? 'satisfied' : 'excluded';
  }
}

function judgeValues(
  listing: PublicListing,
  criteria: ListingCriteria,
  key: ValueSetCriterionKey
): CriterionOutcome {
  const wanted = valuesOf(criteria, key);
  if (wanted === undefined || wanted.length === 0) return 'satisfied';

  const answer = readValuesAnswer(listing, key);
  switch (answer.state) {
    case 'not-applicable':
      return 'not-applicable';
    case 'never-asked':
      return 'undeclared';
    /**
     * 🔑 **«Καμία» ΕΙΝΑΙ απάντηση, και κρίνεται — δεν πάει στον κάδο της άγνοιας.**
     * Ο κάτοχος που δήλωσε ρητά ότι το ακίνητο **δεν** έχει παροχές έχει απαντήσει:
     * δεν έχει πισίνα. Το να μετρηθεί ως «δεν το δήλωσε» θα του ζητούσε να ξαναπεί
     * κάτι που είπε — ακριβώς η αδικία που το `declared-none` γεννήθηκε να λύσει.
     */
    case 'declared-none':
      return 'excluded';
    case 'declared':
      return matchesValues(key, answer.value, wanted) ? 'satisfied' : 'excluded';
  }
}

/** Το κριτήριο εξαρτάται από το **σχήμα**, όχι από τον άξονα. */
function matchesValues(
  key: ValueSetCriterionKey,
  declared: readonly string[],
  wanted: readonly string[]
): boolean {
  return LISTING_CRITERION_ASKING[key] === 'set-all'
    ? containsAll(declared, wanted)
    : intersects(declared, wanted);
}

function judgeFlag(
  listing: PublicListing,
  criteria: ListingCriteria,
  key: FlagCriterionKey
): CriterionOutcome {
  const wanted = flagOf(criteria, key);
  if (wanted === undefined) return 'satisfied';

  const answer = readFlagAnswer(listing, key);
  switch (answer.state) {
    case 'not-applicable':
      return 'not-applicable';
    case 'never-asked':
    case 'declared-none':
      return 'undeclared';
    case 'declared':
      return answer.value === wanted ? 'satisfied' : 'excluded';
  }
}

// =============================================================================
// 3. Η ΕΤΥΜΗΓΟΡΙΑ ΓΙΑ ΟΛΟΚΛΗΡΗ ΤΗΝ ΑΓΓΕΛΙΑ
// =============================================================================

/** Τρεις καταστάσεις — ποτέ δύο. */
export const LISTING_CRITERIA_VERDICTS = ['matches', 'undeclared', 'excluded'] as const;

export type ListingCriteriaVerdict = (typeof LISTING_CRITERIA_VERDICTS)[number];

/**
 * Η ετυμηγορία **με τους λόγους της**.
 *
 * ⚠️ **Οι δύο κατάλογοι είναι ξεχωριστά πεδία, ΟΧΙ ένας με φιλτράρισμα**: ένας
 * καταναλωτής που ξεχώριζε μόνος του «ποιοι απέκλεισαν» από «ποιοι σιωπούν» θα είχε
 * δίκιο μέχρι την πρώτη τέταρτη έκβαση, και μετά θα έκλεινε **λάθος, σιωπηλά** — το
 * ίδιο μάθημα με το `ListingAttributeLedger` *(«ένας καταναλωτής που υπολογίζει
 * `total - declared` …»)*.
 */
export interface ListingCriteriaMatch {
  readonly verdict: ListingCriteriaVerdict;
  /** Οι άξονες που **απάντησαν και δεν ικανοποιούν**. Κενό όταν δεν είναι `excluded`. */
  readonly excludedBy: readonly CriterionKey[];
  /**
   * Οι άξονες που **σιωπούν** ενώ ρωτήθηκαν. Γεμάτο **και** σε `excluded`: αν η
   * αγγελία επανέλθει επειδή χαλάρωσε ο αποκλείων άξονας, η άγνοια είναι ακόμη εκεί.
   */
  readonly undeclaredOn: readonly CriterionKey[];
}

/**
 * **Κρίνει μία αγγελία απέναντι στα κριτήρια.**
 *
 * 🔑 **Τρέχει μόνο πάνω στους άξονες που ΡΩΤΗΘΗΚΑΝ** (`askedCriterionKeys`), όχι και
 * στους 31. Δεν είναι βελτιστοποίηση — είναι **σημασία**: ένας άξονας που δεν
 * ρωτήθηκε δεν έχει τίποτα να πει, και μια σιωπή που κανείς δεν ζήτησε δεν είναι κενό.
 */
export function matchListingCriteria(
  listing: PublicListing,
  criteria: ListingCriteria
): ListingCriteriaMatch {
  const excludedBy: CriterionKey[] = [];
  const undeclaredOn: CriterionKey[] = [];

  for (const key of askedCriterionKeys(criteria)) {
    const outcome = judgeCriterion(listing, criteria, key);
    if (outcome === 'excluded') excludedBy.push(key);
    else if (outcome === 'undeclared') undeclaredOn.push(key);
  }

  const verdict: ListingCriteriaVerdict =
    excludedBy.length > 0 ? 'excluded' : undeclaredOn.length > 0 ? 'undeclared' : 'matches';

  return { verdict, excludedBy, undeclaredOn };
}

/**
 * Οι ετυμηγορίες που **αφήνουν την αγγελία στα αποτελέσματα**.
 *
 * ⚠️ **Ονομασμένη σταθερά, όχι `verdict !== 'excluded'`** — ίδιο πρότυπο με τα
 * `CATEGORICAL_BLOCKERS` και `KINDS_WITHOUT_LEGACY_PROJECTION`: μια **τέταρτη**
 * ετυμηγορία που θα προστεθεί χωρίς να καταταγεί εδώ θα λογιζόταν σιωπηλά ως «μένει».
 */
export const VERDICTS_KEEPING_THE_LISTING = [
  'matches',
  'undeclared',
] as const satisfies readonly ListingCriteriaVerdict[];

/**
 * **Μένει η αγγελία στα αποτελέσματα;**
 *
 * 🔴 **Η σιωπή ΔΕΝ εξαφανίζει**, και είναι ολόκληρο το νόημα του τρίτου κάδου: μια
 * αγγελία που δεν δήλωσε ενεργειακή κλάση **μένει ορατή** σε αναζήτηση με ενεργειακή
 * κλάση — μετρημένη χωριστά, με τη λέξη της. Η εξαφάνισή της θα τιμωρούσε τον κάτοχο
 * για πεδίο που **κανείς δεν του ζήτησε** (N.12), και θα έκρυβε από τον αγοραστή
 * ακίνητο που **μπορεί** να είναι ακριβώς αυτό που ζητά.
 */
export function listingSurvivesCriteria(
  listing: PublicListing,
  criteria: ListingCriteria
): boolean {
  const { verdict } = matchListingCriteria(listing, criteria);
  return (VERDICTS_KEEPING_THE_LISTING as readonly string[]).includes(verdict);
}

// =============================================================================
// 4. Η ΚΛΕΙΣΤΗ ΛΟΓΙΣΤΙΚΗ — «7 ταιριάζουν · 3 δεν το δήλωσαν»
// =============================================================================

/**
 * **Η λογιστική των κριτηρίων** — τα τρία μέρη κλείνουν πάντα στο σύνολο.
 *
 * 🔑 **Ίδιο ιδίωμα με τα `ListingLedger` και `StayLedger`**: τυπώνεται **πάντα**,
 * ακόμη και στο μηδέν, και το άθροισμα ελέγχεται. Χωρίς αυτό, ο άνθρωπος που βλέπει
 * επτά αποτελέσματα δεν ξέρει αν έλειπε **μία** αγγελία ή **δέκα** — που είναι
 * ακριβώς το ελάττωμα των μεγάλων portals: **παραλείπουν σιωπηλά**.
 */
export interface ListingCriteriaLedger {
  readonly total: number;
  readonly matching: number;
  /** Δεν αποκλείστηκαν — απλώς **δεν το δήλωσαν**. Μένουν ορατές. */
  readonly undeclared: number;
  readonly excluded: number;
}

/** Μετρά ένα σύνολο αγγελιών απέναντι στα κριτήρια. */
export function computeCriteriaLedger(
  listings: readonly PublicListing[],
  criteria: ListingCriteria
): ListingCriteriaLedger {
  let matching = 0;
  let undeclared = 0;
  let excluded = 0;

  for (const listing of listings) {
    switch (matchListingCriteria(listing, criteria).verdict) {
      case 'matches':
        matching += 1;
        break;
      case 'undeclared':
        undeclared += 1;
        break;
      case 'excluded':
        excluded += 1;
        break;
    }
  }

  return { total: listings.length, matching, undeclared, excluded };
}

/** **Κλείνει η λογιστική;** — ο φρουρός, ίδιος με το `attributeLedgerBalances`. */
export function criteriaLedgerBalances(ledger: ListingCriteriaLedger): boolean {
  return ledger.matching + ledger.undeclared + ledger.excluded === ledger.total;
}
