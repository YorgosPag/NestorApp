/**
 * @fileoverview **Η ΕΤΥΜΗΓΟΡΙΑ** — και δεν επιτρέπεται να πει «όχι» χωρίς να πει **γιατί**.
 * @related ADR-777 §7 (Α9 · Α5 · Α20) · SPEC-777B §12.2 · §12.6
 * @module lib/demand/demand-matching
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Η ΕΤΥΜΗΓΟΡΙΑ ΔΕΝ ΕΙΝΑΙ BOOLEAN — ΚΑΙ ΑΥΤΟ ΕΙΝΑΙ ΟΡΟΣ ΕΠΙΒΙΩΣΗΣ, ΟΧΙ ΓΟΥΣΤΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το SPEC-777B §12.6 βάζει **όρο**: *«η ζήτηση πρέπει να **αξίζει και όταν δεν
 * ταιριάζει τίποτα**. Αλλιώς ο χρήστης δηλώνει, δεν παίρνει απάντηση, και δεν
 * ξαναγυρνά»*. Και ονομάζει την ελάχιστη απάντηση: *«τι υπάρχει **κοντά** στο αίτημα
 * και **τι το εμποδίζει** — «με +20.000 € υπάρχουν 6»»*.
 *
 * Μια μηχανή που επιστρέφει `true/false` **δομικά δεν μπορεί** να το πει. Άρα εδώ
 * επιστρέφεται {@link DemandMatch}: ετυμηγορία **τριών καταστάσεων**, **ονομασμένα
 * εμπόδια**, και **μετρημένη απόσταση** από την ικανοποίηση σε κάθε άξονα που έχει
 * διάταξη. Το «+20.000 €» **δεν γράφεται από άνθρωπο σε κείμενο** — **υπολογίζεται**.
 *
 * 🔑 **Είναι η δοκτρίνη των πυλών μας, μεταφερμένη στον τομέα.** Τα CHECK 3.39 · 3.42
 * · 3.44 · 3.47 · 3.48 απαιτούν *κλειστή λογιστική, fail-closed, με κάθε κατάσταση
 * **ονομασμένη*** — και ρητό `throw` σε άγνωστη. Το ίδιο εδώ: κάθε άρνηση κουβαλά
 * τουλάχιστον έναν κωδικό από κλειστό σύνολο, και ένα «όχι» χωρίς κωδικό είναι
 * **σφάλμα**, όχι απάντηση.
 *
 * 🏆 **ΠΟΥ ΞΕΠΕΡΝΑΜΕ ΤΟ ΠΡΟΤΥΠΟ.** Το RESO λύνει το ίδιο πρόβλημα με `SavedSearch`
 * (ένα ερώτημα OData) + `Prospecting` (*«automatic email … to send results matching
 * saved search criteria»*): ό,τι ταιριάζει φεύγει με email, ό,τι **δεν** ταιριάζει
 * **δεν υπάρχει**. Ο χρήστης που έγραψε «ως 250.000» και έχασε ένα σπίτι στις 255.000
 * **δεν το μαθαίνει ποτέ** — και δεν μαθαίνει ούτε ότι υπάρχει. Εδώ είναι
 * `near-miss` με `priceOverBy: 5000`.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΔΕΝ ΞΑΝΑΓΡΑΦΕΤΑΙ ΤΟ ΦΙΛΤΡΟ ΤΗΣ ΟΘΟΝΗΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η μηχανή ελέγχει **δύο** ομάδες αξόνων, και η γραμμή ανάμεσά τους **δεν είναι
 * κρίση αυτού του αρχείου**: είναι το `DEMAND_AXES_LOST_IN_FILTERS`
 * (`demand-listing-filters.ts`) — **μία** λίστα, δύο αναγνώστες.
 *
 * - Ό,τι **ταξιδεύει** στα φίλτρα κρίνεται με τα **ίδια πρωτόγονα** (`withinRange`,
 *   `getEffectivePrice`, `distanceMeters`), ώστε ο χάρτης, η λίστα και η μηχανή να
 *   **μην μπορούν** να διαφωνήσουν.
 * - Ό,τι **χάνεται** (χρόνος · σχήμα περιοχής · ταυτότητα ακινήτου · όροφος ·
 *   γειτονιά) κρίνεται στους άξονες (`demand-match-axes.ts`), και πουθενά αλλού.
 *
 * Άγκυρα: το **θεώρημα υπερσυνόλου** στο `__tests__` — `verdict === 'match'`
 * συνεπάγεται `matchesListingFilters(listing, listingFiltersFromDemand(demand))`,
 * **πάντα**. Ίδιο ιδίωμα με το θεώρημα υποσυνόλου των **125** σχημάτων της Α20.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις. Καμία εξάρτηση από React/Firestore/δίκτυο.
 */

import type { PropertyDemand } from '@/types/property-demand';
import {
  NEAR_MISS_MAX_AXES,
  isCategoricalBlocker,
  isMeasurableBlocker,
  type DemandBlocker,
  type DemandGaps,
  type DemandMatch,
  type DemandVerdict,
  type ListingMatchFacts,
} from './demand-match-vocabulary';
import {
  categoryBlockers,
  numericOutcome,
  proximityBlockers,
  spatialOutcome,
  timingBlockers,
} from './demand-match-axes';

// Το λεξιλόγιο ταξιδεύει μαζί με τη μηχανή: ο καταναλωτής εισάγει **ένα** module και
// παίρνει και τους τύπους και τη συνάρτηση. Χωρίς αυτό, κάθε οθόνη θα έπρεπε να ξέρει
// σε ποιο από τα τρία αρχεία ζει το κάθε όνομα — δηλαδή θα διέρρεε ο διαχωρισμός, που
// είναι εσωτερική απόφαση μεγέθους αρχείου και όχι μέρος του συμβολαίου.
export * from './demand-match-vocabulary';

// =============================================================================
// Η ΣΥΝΘΕΣΗ — και η λογιστική που δεν επιτρέπεται να μη κλείσει
// =============================================================================

/**
 * **Ταιριάζει αυτή η αγγελία σε αυτή τη ζήτηση;** — και, αν όχι, **γιατί** και
 * **πόσο λείπει**.
 *
 * ⚠️ **Καθαρή συνάρτηση.** Καμία άντληση, καμία μεταλλαγή, **κανένα ρολόι**.
 *
 * 🔴 **Το `todayDate` είναι ΠΑΡΑΜΕΤΡΟΣ, και η πρώτη γραφή το είχε λάθος.** Υπήρχε
 * ιδιωτική `todayIso()` που καλούσε `new Date()` μέσα στον άξονα του χρόνου — δηλαδή
 * μια «καθαρή» μηχανή που **διάβαζε κρυφά το ρολόι**, στο ίδιο commit που το
 * `demand-aggregate.ts` δηλώνει ρητά το αντίθετο («*ρητή παράμετρος ώστε … να μη
 * διαβάζει κανείς κρυφά το ρολόι*»). Το έπιασε το **CHECK 3.7** (`date-local`,
 * μηδενική ανοχή σε νέο αρχείο) — και η θεραπεία **δεν** ήταν κεντρικό βοήθημα
 * ημερομηνίας: ήταν να **φύγει η ανάγνωση**. Ένα ταίριασμα που αλλάζει απάντηση
 * ανάλογα με το πότε τρέχει δεν είναι δοκιμάσιμο ούτε αναπαραγώγιμο.
 *
 * @param todayDate — σημερινή ημερομηνία ISO `YYYY-MM-DD`· χρησιμοποιείται **μόνο**
 *   από το `timing: 'now'`
 *
 * 🔴 **Ο έλεγχος συνέπειας στο τέλος δεν είναι παράνοια — είναι η fail-closed
 * λογιστική των πυλών.** Ετυμηγορία `match` με εμπόδια, ή άρνηση χωρίς κανένα
 * εμπόδιο, σημαίνει ότι ένας άξονας απάντησε και **κανείς δεν τον κατέγραψε**. Αυτό
 * είναι **σφάλμα προγράμματος**, όχι αποτέλεσμα τομέα — και το repo έχει κανόνα γι'
 * αυτό: *άγνωστη κατάσταση ⇒ `throw` **με όνομα***.
 */
export function matchDemandAgainstListing(
  demand: PropertyDemand,
  facts: ListingMatchFacts,
  todayDate: string,
): DemandMatch {
  const numeric = numericOutcome(demand, facts.listing);
  const spatial = spatialOutcome(demand, facts);

  const blockers: DemandBlocker[] = [
    ...categoryBlockers(demand, facts.listing),
    ...numeric.blockers,
    ...spatial.blockers,
    ...timingBlockers(demand.timing, facts.availability, todayDate),
    ...proximityBlockers(demand, facts),
  ];

  const gaps: DemandGaps = {
    ...numeric.gaps,
    distanceOverMetres: spatial.distanceOverMetres,
  };

  const verdict = decideVerdict(blockers);

  if ((verdict === 'match') !== (blockers.length === 0)) {
    throw new Error(
      `demand-matching: ασυνεπής λογιστική — ετυμηγορία "${verdict}" με ${blockers.length} εμπόδια`,
    );
  }

  return { verdict, blockers, gaps };
}

/**
 * Εμπόδια → ετυμηγορία. Εξάγεται ώστε η **πολιτική** να δοκιμάζεται χωρίς αγγελία.
 *
 * 🔑 **Ένα και μόνο ένα κατηγορικό εμπόδιο αρκεί για `no-match`**, όσο λίγα κι αν
 * είναι συνολικά. Μια αγγελία ενοικίασης δεν γίνεται πώληση «σχεδόν», και ένα
 * «κοντινό αποτέλεσμα» που ο χρήστης **δεν μπορεί να πλησιάσει** είναι θόρυβος με
 * περιτύλιγμα βοήθειας.
 */
export function decideVerdict(blockers: readonly DemandBlocker[]): DemandVerdict {
  if (blockers.length === 0) return 'match';
  // ⚠️ **ΚΑΤΗΓΟΡΙΚΟ, ΟΧΙ «μη μετρήσιμο»** — η διάκριση έγινε ουσιαστική όταν γεννήθηκε
  // η τρίτη τάξη ({@link UNCERTAIN_BLOCKERS}). Ένα εμπόδιο **άγνοιας** δεν είναι
  // κλειστή υπόθεση: η αγγελία **μπορεί** να ταιριάζει και απλώς δεν το ξέρουμε, άρα
  // περνά στο μονοπάτι του «κοντινού αποτελέσματος» με τον λόγο **γραμμένο**. Το παλιό
  // `!isMeasurableBlocker(...)` θα την έριχνε σιωπηλά στα `rejected`.
  if (blockers.some(isCategoricalBlocker)) return 'no-match';
  return blockers.length <= NEAR_MISS_MAX_AXES ? 'near-miss' : 'no-match';
}

// =============================================================================
// ΤΟ ΣΥΝΟΛΟ — κλειστή λογιστική στα αποτελέσματα
// =============================================================================

/**
 * Όλες οι αγγελίες που **ταιριάζουν**, και όσες είναι **κοντά** — σε ένα πέρασμα.
 *
 * 🔑 **Η κλειστή λογιστική της Α5, στα αποτελέσματα της ζήτησης.** Τα τρία σύνολα
 * είναι **χωριστά πεδία και όχι αφαίρεση**: ένας καταναλωτής που υπολόγιζε
 * `σύνολο − ταιριάσματα` θα είχε δίκιο μέχρι την πρώτη τέταρτη κατάσταση, και τότε το
 * άθροισμα θα έκλεινε **λάθος, σιωπηλά** — η **ίδια** πρόταση που δικαιολογεί το
 * `ListingLedger`.
 */
export interface DemandResults {
  readonly matched: readonly ListingMatchFacts[];
  readonly nearMissed: readonly DemandOutcome[];
  /**
   * Οι απορριφθείσες — **με την ετυμηγορία τους**, όχι σκέτο πλήθος.
   *
   * 🔴 **Ήταν `number` μέχρι 2026-08-11, και ήταν λάθος για μετρημένο λόγο.** Ο
   * **όρος επιβίωσης** του §12.6 απαιτεί να λέμε *«τι το εμποδίζει»* — και το «τι»
   * ζει **αποκλειστικά** στα `blockers` της κάθε άρνησης. Με σκέτο πλήθος, η οθόνη
   * που δείχνει «0 αποτελέσματα» **δομικά δεν μπορεί** να πει *«καμία δεν κρίθηκε
   * γεωγραφικά, γιατί δεν ξέρουμε πού είναι»* — δηλαδή μετατρέπει το «δεν ξέρουμε
   * ακόμη» σε «δεν υπάρχει», τον ακριβώς ισχυρισμό που απαγορεύει η **Α5**.
   *
   * Η εναλλακτική —δεύτερος βρόχος στην οθόνη που ξανακρίνει τις ίδιες αγγελίες—
   * θα ήταν **δεύτερη μηχανή για το ίδιο ερώτημα** (ADR-749). Και τα **τρία** σύνολα
   * είναι πλέον πίνακες: η συμμετρία **είναι** η κλειστή λογιστική.
   */
  readonly rejected: readonly DemandOutcome[];
  /** Πόσα κρίθηκαν συνολικά — ώστε το άθροισμα να είναι **λέξιμο**. */
  readonly considered: number;
}

/** Μια αγγελία **μαζί** με την ετυμηγορία της. */
export interface DemandOutcome {
  readonly facts: ListingMatchFacts;
  readonly match: DemandMatch;
}

/** Κλείνει το άθροισμα; Υπάρχει **για να αποτύχει θορυβωδώς**, όχι για να επιβεβαιώνει. */
export function demandResultsBalance(results: DemandResults): boolean {
  return (
    results.matched.length + results.nearMissed.length + results.rejected.length ===
    results.considered
  );
}

/** Εφαρμογή σε σύνολο αγγελιών. */
export function matchDemand(
  demand: PropertyDemand,
  candidates: readonly ListingMatchFacts[],
  todayDate: string,
): DemandResults {
  const matched: ListingMatchFacts[] = [];
  const nearMissed: DemandOutcome[] = [];
  const rejected: DemandOutcome[] = [];

  for (const facts of candidates) {
    const match = matchDemandAgainstListing(demand, facts, todayDate);
    if (match.verdict === 'match') matched.push(facts);
    else if (match.verdict === 'near-miss') nearMissed.push({ facts, match });
    else rejected.push({ facts, match });
  }

  return { matched, nearMissed, rejected, considered: candidates.length };
}
