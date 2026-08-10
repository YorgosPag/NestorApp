/**
 * @fileoverview **Η ΑΠΑΝΤΗΣΗ ΟΤΑΝ Η ΑΠΑΝΤΗΣΗ ΕΙΝΑΙ «ΤΙΠΟΤΑ»** — ο όρος επιβίωσης του §12.6.
 * @related ADR-777 §7 (Α9 · Α5) · SPEC-777B §12.6 · lib/demand/demand-concessions.ts
 * @module lib/demand/demand-answer
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Τα κομμάτια υπήρχαν ήδη, **σε τρία μέρη**: η μηχανή ταιριάσματος
 * (`demand-matching`), οι υποχωρήσεις (`demand-concessions`), το ανώνυμο άθροισμα
 * (`demand-aggregate`). Η **σύνθεσή** τους όμως είναι απόφαση — και αν γραφόταν στην
 * οθόνη, θα ξαναγραφόταν **αλλιώς** στη δεύτερη οθόνη που τη χρειάζεται (ειδοποίηση ·
 * θερμοχάρτης Ε2 · μελλοντικό email), με τους τρεις αριθμούς να αποκλίνουν σιωπηλά.
 *
 * 🔑 Είναι, κατά γράμμα, η **κλειστή λογιστική** εφαρμοσμένη στην απογοήτευση: κάθε
 * αγγελία που εξετάστηκε καταλήγει σε **ονομασμένο** κάδο, το άθροισμα **κλείνει**,
 * και ένα «0» δεν επιτρέπεται να σημαίνει «κανείς δεν κοίταξε».
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔶 ΤΑ ΔΥΟ ΔΗΛΩΜΕΝΑ ΚΕΝΑ, ΜΕ ΟΝΟΜΑ — και γιατί ΔΕΝ κρύβονται
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η μηχανή δέχεται {@link ListingMatchFacts}: αγγελία **+** δεσμό προς το επίπεδο Α
 * **+** διαθεσιμότητα **+** μετρημένες αποστάσεις γειτονιάς. Από τα τέσσερα, σήμερα
 * υπάρχει **ένα**:
 *
 * | Είσοδος | Κατάσταση σήμερα | Τι λέει η μηχανή |
 * |---|---|---|
 * | αγγελία | ✅ `public_listings` | — |
 * | δεσμός επιπέδου Α | ❌ **άδειο** (`public_lands`/`public_buildings`) | `place-unresolved` |
 * | διαθεσιμότητα | ❌ δεν αντλείται από BIM | `availability-unknown` |
 * | αποστάσεις POI | ❌ λείπει το ερώτημα Overpass | `proximity-unknown` |
 *
 * ⚠️ **Και τα τρία κενά είναι ΚΑΤΗΓΟΡΙΚΑ εμπόδια, δηλαδή `no-match`.** Άρα μια ζήτηση
 * **Ζ3** («αυτό το κτίριο») ή **Ζ2** («από Μάρτιο») απορρίπτει σήμερα **κάθε**
 * αγγελία. Αυτό **δεν** διορθώνεται με σιωπή: το {@link DemandAnswer.blockedBy}
 * κουβαλά το γιατί, ώστε η οθόνη να λέει *«δεν ξέρουμε ακόμη πού ανήκουν»* αντί για
 * *«δεν υπάρχει τίποτα»* — η **διάκριση** που η Α5 απαιτεί και που το §12.6 πουλά.
 *
 * 🔑 **Και η μηχανή δεν μαντεύει.** Θα ήταν εύκολο να θεωρήσουμε «άγνωστη
 * διαθεσιμότητα = διαθέσιμο» και τα νούμερα θα φαίνονταν καλύτερα **σήμερα**. Θα ήταν
 * ισχυρισμός που κανείς δεν αποφάσισε, και θα κατέρρεε τη μέρα που θα υπήρχαν αληθινές
 * ημερομηνίες. Το `null` σημαίνει «δεν ρωτήσαμε», ποτέ «όχι».
 *
 * **Layering**: leaf — καθαρές συναρτήσεις. **Κανένα ρολόι** (CHECK 3.7 `date-local`):
 * το `todayDate` και το `nowIso` είναι **παράμετροι**.
 */

import type { PublicListing } from '@/types/public-listing';
import type { PropertyDemand } from '@/types/property-demand';
import { discloseCompetition, type DemandDisclosure } from './demand-aggregate';
import {
  buildConcessionReport,
  concessionCensusBalances,
  tallyBlockers,
  type DemandConcessionReport,
} from './demand-concessions';
import { matchDemand, type DemandResults } from './demand-matching';
import type { DemandBlocker, ListingMatchFacts } from './demand-match-vocabulary';
import { axesLostProjectingDemand, type DemandAxisLostInFilters } from './demand-listing-filters';

// =============================================================================
// 1. ΑΓΓΕΛΙΑ → ΓΕΓΟΝΟΤΑ, με ό,τι ξέρουμε σήμερα
// =============================================================================

/**
 * Ό,τι **δεν** ζει στην αγγελία, όπως το ξέρει ο καλών.
 *
 * 🔑 **Χάρτες κατά ταυτότητα αγγελίας, όχι πεδία στην αγγελία.** Η {@link PublicListing}
 * είναι **κλειστό σχήμα δημοσίευσης** (*«ό,τι δεν είναι γραμμένο εδώ, δεν φεύγει
 * ποτέ»*) — προσθήκη πεδίου εκεί είναι **απόφαση αποκάλυψης**, όχι ευκολία
 * ταιριάσματος. Και τα τρία θα γεμίσουν από **άλλες πηγές** (επίπεδο Α · BIM ·
 * Overpass), οπότε ζουν δίπλα, με τα κενά τους **ορατά στην υπογραφή**.
 */
export interface ListingKnowledge {
  readonly places: ReadonlyMap<string, ListingMatchFacts['place']>;
  readonly availability: ReadonlyMap<string, ListingMatchFacts['availability']>;
  readonly proximityMetres: ReadonlyMap<string, ListingMatchFacts['proximityMetres']>;
}

/**
 * **Τίποτα από τα τρία** — η σημερινή, μετρημένη κατάσταση.
 *
 * ⚠️ Ονομασμένη σταθερά και **όχι** τρία `new Map()` στο σημείο κλήσης: όταν το
 * επίπεδο Α αποκτήσει γραμμές, ο μεταγλωττιστής θα δείξει **κάθε** καταναλωτή που
 * ακόμη υποθέτει άγνοια. Τρεις σιωπηλοί κενοί χάρτες δεν θα έδειχναν κανέναν.
 */
export const NO_LISTING_KNOWLEDGE: ListingKnowledge = {
  places: new Map(),
  availability: new Map(),
  proximityMetres: new Map(),
};

/** Αγγελίες + γνώση → οι είσοδοι της μηχανής. */
export function listingFactsFrom(
  listings: readonly PublicListing[],
  knowledge: ListingKnowledge,
): readonly ListingMatchFacts[] {
  return listings.map((listing) => ({
    listing,
    place: knowledge.places.get(listing.id) ?? null,
    availability: knowledge.availability.get(listing.id) ?? null,
    // ⚠️ Κενός χάρτης = «δεν ρωτήσαμε **κανένα** είδος», που η μηχανή διαβάζει ως
    // `proximity-unknown` **ανά απαίτηση**. Είναι διαφορετικό από «δεν υπάρχει κοντά».
    proximityMetres: knowledge.proximityMetres.get(listing.id) ?? {},
  }));
}

// =============================================================================
// 2. Η ΑΠΑΝΤΗΣΗ
// =============================================================================

/**
 * **Ό,τι μαθαίνει ο άνθρωπος για τη ζήτησή του** — και ειδικά όταν δεν βρέθηκε τίποτα.
 *
 * Το §12.6 ορίζει την **ελάχιστη** απάντηση σε δύο σκέλη· και τα δύο είναι εδώ:
 *
 * 1. *«τι υπάρχει **κοντά** και **τι το εμποδίζει**»* → {@link concessions} + {@link blockedBy}
 * 2. *«**πόσοι άλλοι** ζητούν το ίδιο»* → {@link competition}
 */
export interface DemandAnswer {
  /** Πόσες αγγελίες ταιριάζουν **πλήρως**. */
  readonly matchedCount: number;
  /** Οι αγγελίες που ταιριάζουν — για την προεπισκόπηση, χωρίς δεύτερο πέρασμα. */
  readonly matched: readonly PublicListing[];
  /** Οι προτάσεις υποχώρησης, **με τη σκάλα τους**. Πρώτη = αυτή που λέγεται πρώτη. */
  readonly concessions: DemandConcessionReport;
  /**
   * Τι σταμάτησε τις **απορριφθείσες**. Αραιός χάρτης — μόνο όσα εμφανίστηκαν.
   *
   * 🔴 Χωρίς αυτό, το «0 αποτελέσματα» είναι **αδιάκριτο** από «δεν υπάρχει τέτοιο
   * ακίνητο στην Ελλάδα». Με αυτό, η οθόνη λέει *«καμία δεν κρίθηκε γεωγραφικά»*.
   */
  readonly blockedBy: ReadonlyMap<DemandBlocker, number>;
  /** Πόσοι **άλλοι** ζητούν κάτι παρόμοιο — ή `null` κάτω από το κατώφλι. */
  readonly competition: DemandDisclosure;
  /**
   * Οι άξονες που **δεν ταξιδεύουν** στον σύνδεσμο «δες τι υπάρχει σήμερα».
   *
   * ⚠️ Ταξιδεύει **μαζί** με την απάντηση, όχι υπολογισμένο ξανά στην οθόνη: ο
   * σύνδεσμος είναι **πιο πλατύς** από τη ζήτηση όποτε αυτό δεν είναι κενό, και η
   * οθόνη **οφείλει** να το πει — αλλιώς ο χρήστης διαβάζει τα αποτελέσματα ως
   * απάντηση στο αίτημά του ενώ είναι απάντηση σε **χαλαρότερο** αίτημα.
   */
  readonly axesLost: readonly DemandAxisLostInFilters[];
  /** Η ωμή λογιστική της μηχανής — ώστε το άθροισμα να είναι **λέξιμο**. */
  readonly results: DemandResults;
}

/**
 * **Ζήτηση + κόσμος → απάντηση.**
 *
 * @param demand — η εντολή
 * @param listings — οι δημοσιευμένες αγγελίες
 * @param knowledge — ό,τι ξέρουμε πέρα από την αγγελία ({@link NO_LISTING_KNOWLEDGE} σήμερα)
 * @param otherDemands — οι **άλλες** ζητήσεις για το «πόσοι ψάχνουν το ίδιο»
 * @param todayDate — ISO `YYYY-MM-DD`· **ρητή παράμετρος**, ποτέ ανάγνωση ρολογιού
 * @param nowIso — η στιγμή αναφοράς για τη **φρεσκάδα** του αθροίσματος
 */
export function answerDemand(params: {
  readonly demand: PropertyDemand;
  readonly listings: readonly PublicListing[];
  readonly knowledge: ListingKnowledge;
  readonly otherDemands: readonly PropertyDemand[];
  readonly todayDate: string;
  readonly nowIso: string;
}): DemandAnswer {
  const { demand, listings, knowledge, otherDemands, todayDate, nowIso } = params;

  const results = matchDemand(demand, listingFactsFrom(listings, knowledge), todayDate);

  return {
    matchedCount: results.matched.length,
    matched: results.matched.map((facts) => facts.listing),
    concessions: buildConcessionReport(
      demand,
      results.nearMissed.map((outcome) => outcome.match),
    ),
    blockedBy: tallyBlockers(results.rejected.map((outcome) => outcome.match)),
    competition: discloseCompetition(demand, otherDemands, nowIso),
    axesLost: axesLostProjectingDemand(demand),
    results,
  };
}

// =============================================================================
// 3. ΤΙ ΛΕΕΙ Η ΑΠΑΝΤΗΣΗ — κλειστό σύνολο, ώστε η οθόνη να μη «βγάζει συμπεράσματα»
// =============================================================================

/**
 * **Το σχήμα της απάντησης**, ονομασμένο.
 *
 * 🔑 **Η οθόνη ΔΕΝ επιτρέπεται να το συμπεράνει με `if`.** Ένα `answer.matchedCount >
 * 0 ? … : answer.concessions.ladders.length > 0 ? … : …` γραμμένο σε component είναι
 * **πολιτική σε JSX**: θα ξαναγραφόταν με άλλη σειρά στην επόμενη επιφάνεια, και οι
 * δύο θα διαφωνούσαν για την **ίδια** ζήτηση. Είναι το ίδιο ιδίωμα με τα
 * `PublicListingLookup` / `SubmitState`: **ποτέ** `boolean` + `null` για δύο
 * διαφορετικές καταστάσεις.
 *
 * ⚠️ **Η ΣΕΙΡΑ ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ**, όχι τύχη — βλ. {@link demandAnswerShape}.
 */
export const DEMAND_ANSWER_SHAPES = [
  /** Υπάρχουν ταιριάσματα. Ο,τιδήποτε άλλο είναι δευτερεύον. */
  'has-matches',
  /** Τίποτα δεν ταιριάζει, αλλά **υπάρχει πρόταση με ποσό**: το «+20.000 → 6». */
  'has-concession',
  /**
   * Τίποτα δεν ταιριάζει και **καμία πρόταση δεν είναι λογική** — υπάρχουν κοντινές,
   * αλλά όλες πέρα από το κατώφλι, ή χωρίς μετρήσιμο «πόσο».
   */
  'near-but-unreachable',
  /**
   * Τίποτα δεν κρίθηκε **επειδή δεν ξέρουμε**: το επίπεδο Α είναι άδειο, η
   * διαθεσιμότητα δεν αντλείται, οι αποστάσεις λείπουν. **Δεν είναι απουσία
   * ακινήτων** — είναι απουσία **γνώσης**, και ο χρήστης δικαιούται τη διάκριση.
   */
  'blocked-by-unknowns',
  /** Κρίθηκαν, και κανένα δεν πλησιάζει. Η μόνη ειλικρινής «όχι σήμερα». */
  'no-match',
  /** **Δεν υπάρχει τίποτα να κριθεί** — άδειος κατάλογος. Ψυχρή εκκίνηση (§25.7). */
  'nothing-to-judge',
] as const;

export type DemandAnswerShape = (typeof DEMAND_ANSWER_SHAPES)[number];

/**
 * Τα εμπόδια που σημαίνουν **«δεν ξέρουμε»**, όχι «όχι».
 *
 * ⚠️ **Ονομασμένη σταθερά, όχι σιωπηλό `else`** — ίδιο πρότυπο με το
 * `CATEGORICAL_BLOCKERS`. Ένα **νέο** εμπόδιο άγνοιας που θα προστεθεί χωρίς να
 * χαρακτηριστεί θα λογιστεί σιωπηλά ως πραγματική άρνηση, και η οθόνη θα λέει «δεν
 * υπάρχει» για κάτι που **κανείς δεν ρώτησε**.
 */
export const IGNORANCE_BLOCKERS = [
  'place-unresolved',
  'position-unknown',
  'availability-unknown',
  'proximity-unknown',
] as const satisfies readonly DemandBlocker[];

/**
 * Ποιο σχήμα έχει αυτή η απάντηση.
 *
 * 🔴 **Η ΣΕΙΡΑ ΤΩΝ ΕΡΩΤΗΣΕΩΝ ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ** — ίδιο πρότυπο με τη σειρά
 * ταξινόμησης του CHECK 3.47 και τη σειρά αποκλεισμού του `demandExclusionReason`:
 *
 * 1. Το **ταίριασμα** νικά τα πάντα· κανείς δεν θέλει συμβουλή όταν βρήκε.
 * 2. Η **πρόταση με ποσό** πριν κάθε εξήγηση: είναι το ίδιο το δόλωμα του §12.6.
 * 3. Η **άγνοια** πριν την άρνηση — γιατί «δεν ξέρουμε» **δεν είναι** «όχι», και αν
 *    ρωτιόταν τελευταία θα την έτρωγε το `no-match` σε **κάθε** ζήτηση Ζ2/Ζ3/Ζ6.
 *
 * ⚠️ Το «η **πλειοψηφία** των αρνήσεων είναι άγνοια» (και όχι «υπάρχει έστω μία») —
 * αλλιώς **μία** αγγελία χωρίς θέση θα έβαφε ολόκληρη την απάντηση «δεν ξέρουμε»,
 * ενώ οι υπόλοιπες κρίθηκαν κανονικά και είπαν όχι.
 */
export function demandAnswerShape(answer: DemandAnswer): DemandAnswerShape {
  if (answer.matchedCount > 0) return 'has-matches';
  if (answer.concessions.ladders.some((ladder) => ladder.headline !== null)) {
    return 'has-concession';
  }
  if (answer.results.considered === 0) return 'nothing-to-judge';
  if (answer.results.nearMissed.length > 0) return 'near-but-unreachable';

  return ignoranceShare(answer) > 0.5 ? 'blocked-by-unknowns' : 'no-match';
}

/** Ποιο **ποσοστό** των αρνήσεων οφείλεται σε άγνοια. `0` όταν δεν υπάρχουν αρνήσεις. */
export function ignoranceShare(answer: DemandAnswer): number {
  const rejected = answer.results.rejected.length;
  if (rejected === 0) return 0;

  const ignorant = answer.results.rejected.filter((outcome) =>
    outcome.match.blockers.some((blocker) =>
      (IGNORANCE_BLOCKERS as readonly string[]).includes(blocker),
    ),
  ).length;

  return ignorant / rejected;
}

/**
 * Κλείνει **όλη** η λογιστική της απάντησης; Υπάρχει **για να αποτύχει θορυβωδώς**.
 *
 * Δύο ανεξάρτητα αθροίσματα, **ποτέ ένα με «και»**: το ένα λέει ότι καμία αγγελία
 * δεν χάθηκε ανάμεσα στους τρεις κάδους της μηχανής, το άλλο ότι καμία **κοντινή**
 * δεν χάθηκε ανάμεσα στους τρεις κάδους της σύνθεσης. Ένα εύρημα στο δεύτερο δεν
 * θα φαινόταν καθόλου στο πρώτο.
 */
export function demandAnswerBalances(answer: DemandAnswer): boolean {
  const engine =
    answer.results.matched.length +
      answer.results.nearMissed.length +
      answer.results.rejected.length ===
    answer.results.considered;

  return engine && concessionCensusBalances(answer.concessions.census);
}
