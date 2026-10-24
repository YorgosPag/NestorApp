/**
 * @fileoverview **Η ΛΟΓΙΣΤΙΚΗ ΤΩΝ ΥΠΟΧΩΡΗΣΕΩΝ** — κλειστή, fail-closed: πού πήγε **κάθε** κοντινή αγγελία.
 * @related ADR-777 §7 (Α9 · Α5) · ADR-919 §12 · SPEC-777B §12.6 · lib/demand/demand-concessions.ts (οι σκάλες) ·
 *   lib/demand/demand-awaiting-delivery.ts (`pendingDeliveryOf`)
 * @module lib/demand/demand-concession-report
 *
 * Χωρίστηκε από το `demand-concessions.ts` (N.7.1, 547 > 500 γραμμές — ADR-919 «επαλήθευση §12»). Εκεί ζει το
 * **λεξιλόγιο** και η **σκάλα ενός άξονα**· εδώ η **σύνθεση**: από N κοντινές αγγελίες σε σκάλες **και** απογραφή.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις. Καμία εξάρτηση από React/Firestore/ρολόι.
 */

import type { DemandBlocker, DemandMatch } from './demand-match-vocabulary';
import type { PriceRole } from '@/lib/properties/price-resolver';
import {
  buildLadder,
  concessionCeiling,
  soleConcessionOf,
  type ConcessionDemand,
  type ConcessionLadder,
  type DemandConcession,
} from './demand-concessions';

/**
 * Πού πήγε **κάθε** κοντινή αγγελία.
 *
 * 🔴 **Υπάρχει επειδή η σύνθεση ΠΕΤΑΕΙ πράγματα, και μια σύνθεση που πετάει σιωπηλά
 * επικυρώνει τον εαυτό της.** Το `multiAxis` και το `unquantified` δεν είναι σφάλματα:
 * είναι κοντινές αγγελίες που **δεν επιτρέπεται** να μπουν σε πρόταση. Χωρίς τους
 * κάδους, μια οθόνη που δείχνει «3 κοντά» ενώ η μηχανή βρήκε **11** θα φαινόταν
 * σωστή — και το λάθος θα ήταν **ακριβώς** εκεί όπου η βοήθεια είναι πιο χρήσιμη.
 *
 * ⚠️ **Κάθε κάδος τυπώνεται ακόμη και στο μηδέν** (μάθημα CHECK 3.48 `Κ6`): ένα «0»
 * που δεν τυπώνεται διαβάζεται ως «δεν υπάρχει τέτοιος έλεγχος».
 */
export interface DemandConcessionCensus {
  /** Κοντινές με **έναν** άξονα και μετρημένο ποσό — αυτές γεννούν σκάλες. */
  readonly ladderedCount: number;
  /** Κοντινές με **δύο** άξονες: αληθινές, μη προτάσιμες. */
  readonly multiAxis: number;
  /** Κοντινές με έναν άξονα **χωρίς** «πόσο» (όροφος · ληγμένη υπόσχεση · σχήμα · γειτονιά). */
  readonly unquantified: number;
  /**
   * Κοντινές που σταματά **μόνο** ο χρόνος, με **μελλοντική** υπόσχεση — «χτίζονται N» (ADR-919 §12). Ίσο, εκ
   * κατασκευής, με το `DemandAnswer.awaitingDelivery.count`.
   */
  readonly awaitingDelivery: number;
  /** Πόσες κοντινές εξετάστηκαν. */
  readonly considered: number;
}

/** Κλείνει το άθροισμα; Υπάρχει **για να αποτύχει θορυβωδώς**, όχι για να επιβεβαιώνει. */
export function concessionCensusBalances(census: DemandConcessionCensus): boolean {
  return (
    census.ladderedCount + census.multiAxis + census.unquantified + census.awaitingDelivery ===
    census.considered
  );
}

/** Καμία κοντινή δεν «χτίζεται» — η προεπιλογή όταν ο καλών δεν ξέρει το «σήμερα». */
const NEVER_AWAITING = (): boolean => false;

/** Οι σκάλες **και** η λογιστική τους — ποτέ το ένα χωρίς το άλλο. */
export interface DemandConcessionReport {
  /**
   * Ταξινομημένες κατά **πόσο βοηθούν**: πρώτα όσες έχουν `headline`, κατά φθίνον
   * πλήθος. Η οθόνη διαβάζει την πρώτη· η σειρά **δεν** αποφασίζεται εκεί.
   */
  readonly ladders: readonly ConcessionLadder[];
  readonly census: DemandConcessionCensus;
}

/** Η ταυτότητα μιας σκάλας — **(υποχώρηση, ρόλος τιμής)**, ADR-777 §8.60.15. */
interface LadderKey {
  readonly concession: DemandConcession;
  readonly priceRole: PriceRole | null;
}

/** Σταθερό κλειδί σκάλας — και για τον κάδο, και για το `key` της λίστας στην οθόνη. */
export function ladderIdOf(key: LadderKey): string {
  return key.priceRole === null ? key.concession : `${key.concession}:${key.priceRole}`;
}

/** Οι κάδοι της απογραφής πριν γίνουν σκάλες. */
interface NearMissBuckets {
  readonly amounts: Map<string, { key: LadderKey; list: number[] }>;
  multiAxis: number;
  unquantified: number;
  awaitingDelivery: number;
}

/**
 * Κάθε κοντινή σε **έναν** κάδο. 🔑 Το `awaitsDelivery` ρωτιέται **πρώτο**, ώστε μια αγγελία που «χτίζεται» να μη
 * λογιστεί ποτέ `unquantified` (το `soleConcessionOf` δεν ξέρει «πόσο» για τον χρόνο).
 */
function bucketNearMisses(
  nearMisses: readonly DemandMatch[],
  awaitsDelivery: (match: DemandMatch) => boolean,
): NearMissBuckets {
  const buckets: NearMissBuckets = { amounts: new Map(), multiAxis: 0, unquantified: 0, awaitingDelivery: 0 };
  for (const match of nearMisses) {
    if (awaitsDelivery(match)) {
      buckets.awaitingDelivery += 1;
      continue;
    }
    if (match.blockers.length > 1) {
      buckets.multiAxis += 1;
      continue;
    }
    const sole = soleConcessionOf(match);
    if (sole === null) {
      buckets.unquantified += 1;
      continue;
    }
    const key: LadderKey = { concession: sole.concession, priceRole: sole.priceRole };
    const bucket = buckets.amounts.get(ladderIdOf(key));
    if (bucket === undefined) buckets.amounts.set(ladderIdOf(key), { key, list: [sole.amount] });
    else bucket.list.push(sole.amount);
  }
  return buckets;
}

/**
 * **Κοντινές αγγελίες → προτάσεις υποχώρησης.**
 *
 * @param demand — για τα δηλωμένα όρια, πάνω στα οποία μετριέται το «λογικό»
 * @param nearMisses — οι ετυμηγορίες `near-miss` της `matchDemand`
 * @param awaitsDelivery — «τη σταματά μόνο ο χρόνος, με μελλοντική υπόσχεση;» (`pendingDeliveryOf`). Ρωτιέται
 *   **πρώτο**, ώστε μια τέτοια αγγελία να μη λογιστεί ποτέ `unquantified`.
 */
export function buildConcessionReport(
  demand: ConcessionDemand,
  nearMisses: readonly DemandMatch[],
  awaitsDelivery: (match: DemandMatch) => boolean = NEVER_AWAITING,
): DemandConcessionReport {
  const { amounts, multiAxis, unquantified, awaitingDelivery } = bucketNearMisses(nearMisses, awaitsDelivery);

  const ladders = [...amounts.values()]
    .map(({ key, list }) =>
      buildLadder(key.concession, list, concessionCeiling(demand, key.concession, key.priceRole), key.priceRole),
    )
    .filter((ladder): ladder is ConcessionLadder => ladder !== null);

  return {
    ladders: [...ladders].sort(compareLadders),
    census: {
      ladderedCount: [...amounts.values()].reduce((sum, bucket) => sum + bucket.list.length, 0),
      multiAxis,
      unquantified,
      awaitingDelivery,
      considered: nearMisses.length,
    },
  };
}

/**
 * Ποια σκάλα λέγεται πρώτη. **Όσες προτείνουν πάνω από όσες δεν προτείνουν**, και
 * μεταξύ τους κατά φθίνον πλήθος· τελικός διαχωριστής το **όνομα**, ώστε η σειρά να
 * μην εξαρτάται από τη σειρά άφιξης των εγγράφων.
 */
function compareLadders(a: ConcessionLadder, b: ConcessionLadder): number {
  const unlocksA = a.headline?.unlocks ?? 0;
  const unlocksB = b.headline?.unlocks ?? 0;
  if (unlocksA !== unlocksB) return unlocksB - unlocksA;
  return ladderIdOf(a).localeCompare(ladderIdOf(b));
}

/**
 * Τα εμπόδια που **απέρριψαν** αγγελίες, με πλήθος — «τι μας σταμάτησε».
 *
 * 🔑 **Είναι η κλειστή λογιστική της Α5 εφαρμοσμένη στην άρνηση.** Σήμερα το επίπεδο
 * Α δεν έχει γραμμές και η διαθεσιμότητα δεν αντλείται, οπότε μια ζήτηση **Ζ3** θα
 * απορριφθεί από **κάθε** αγγελία με `place-unresolved`. Χωρίς αυτόν τον πίνακα η
 * οθόνη θα έλεγε σκέτο «κανένα αποτέλεσμα» — δηλαδή θα μετέτρεπε *«δεν ξέρουμε
 * ακόμη»* σε *«δεν υπάρχει»*, τον **ακριβώς** ισχυρισμό που η Α5 απαγορεύει.
 *
 * ⚠️ Επιστρέφει **αραιό** χάρτη: μόνο όσα εμπόδια εμφανίστηκαν. Ένα πλήρες `Record`
 * με 17 μηδενικά θα ανάγκαζε την οθόνη να τα φιλτράρει, και το φιλτράρισμα είναι
 * ακριβώς η στιγμή που κάποιος γράφει λάθος κατώφλι.
 */
export function tallyBlockers(
  matches: readonly DemandMatch[],
): ReadonlyMap<DemandBlocker, number> {
  const tally = new Map<DemandBlocker, number>();
  for (const match of matches) {
    for (const blocker of match.blockers) {
      tally.set(blocker, (tally.get(blocker) ?? 0) + 1);
    }
  }
  return tally;
}
