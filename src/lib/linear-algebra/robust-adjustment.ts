/**
 * @fileoverview **ΣΥΝΟΡΘΩΣΗ ΜΕ ΕΝΤΟΠΙΣΜΟ ΧΟΝΔΡΟΕΙΔΩΝ ΣΦΑΛΜΑΤΩΝ** (SSoT) — επαναληπτικό data snooping (Baarda), η πρακτική
 * των γεωδαιτικών δικτύων.
 * @module lib/linear-algebra/robust-adjustment
 * @related `./weighted-least-squares.ts`
 *
 * 🔑 **Μία απόρριψη κάθε φορά.** Συνόρθωση → τυποποιημένα υπόλοιπα `w` → αν το μεγαλύτερο |w| ξεπερνά την κρίσιμη τιμή, η
 * παρατήρηση βγαίνει και η συνόρθωση ξαναγίνεται. Η τελική λύση είναι **κλασική** στις παρατηρήσεις που έμειναν, ώστε τα
 * `w`, `r`, `σ₀` να έχουν τη γνωστή στατιστική σημασία. Το επαναληπτικό data snooping είναι «τουλάχιστον τόσο
 * αποτελεσματικό όσο κάθε άλλη μέθοδος» (ASCE J. Surv. Eng. 119(4), 1993).
 * ⚠️ **ΓΙΑΤΙ ΟΧΙ Huber / M-εκτιμητές (μετρημένο στη Φ4 του ADR-929).** Ένας M-εκτιμητής μειώνει το βάρος των παρατηρήσεων με
 * μεγάλο **κανονικοποιημένο** υπόλοιπο `|v|/σ = |w|·√r`. Μια παρατήρηση με **μικρό** `r` (υψηλή μόχλευση: μία διάσταση
 * ανάμεσα σε δύο γραμμές) έχει πάντα μικρό `|v|/σ`, άρα ο M-εκτιμητής την **κρατά** και ρίχνει το φταίξιμο στις άλλες — το
 * γνωστό τυφλό σημείο τους. Το `w` του Baarda διορθώνει ακριβώς αυτό (διαιρεί με `√r`).
 * 🔑 **Ισοβαθμία ⇒ δηλωμένη προτίμηση.** Σε υποσύστημα με **έναν** πλεονασμό όλα τα `w` είναι ίσα: το τεστ λέει «κάτι είναι
 * λάθος», όχι **τι**. Ο καλών δηλώνει ποιον κατηγορεί πρώτο (`blamePriority`), αντί για τυχαία σειρά.
 * 🔑 **Μόνο ό,τι ελέγχεται απορρίπτεται.** Παρατήρηση με `r` κάτω από το αριθμητικό κατώφλι δεν έχει `w`, και η απόρριψή της
 * θα έκανε το σύστημα ιδιάζον.
 */

import {
  chiSquareQuantile,
  solveWeightedLeastSquares,
  standardizedResidual,
  Z_95,
  type LeastSquaresSolution,
  type LinearObservation,
} from './weighted-least-squares';

export interface RobustAdjustmentOptions {
  /** Κρίσιμη τιμή του |w| (α₀ = 0,001 ⇒ 3,29). */
  readonly critical: number;
  /** **Αριθμητικό** κατώφλι: κάτω από αυτό το `r` το `w` δεν ορίζεται (η παρατήρηση δεν ελέγχεται καθόλου). */
  readonly minRedundancy: number;
  /** Ποιος φταίει σε ισοβαθμία (|w| μέσα σε 1%): μεγαλύτερο = φταίει πρώτο· προεπιλογή 0 για όλες. */
  readonly blamePriority?: readonly number[];
}

export interface ObservationVerdict {
  readonly active: boolean;
  /** Υπόλοιπο στην τελική λύση (και για τις απορριφθείσες: προβλεπόμενο). */
  readonly residual: number;
  readonly w: number | null;
  /** Αριθμός πλεονασμού στην τελική λύση· `null` για απορριφθείσα. */
  readonly redundancy: number | null;
}

export interface RobustAdjustment {
  readonly solution: LeastSquaresSolution;
  readonly verdicts: readonly ObservationVerdict[];
  readonly rejected: number;
  readonly sigma0: number | null;
  readonly globalTestPassed: boolean | null;
}

/** Δύο |w| μέσα σε τόσο σχετικά θεωρούνται ισοβαθμία. */
const TIE_REL = 0.01;

const factorsOf = (active: readonly boolean[]): number[] => active.map((a) => (a ? 1 : 0));

/** Ο χειρότερος ελέγξιμος ύποπτος πάνω από την κρίσιμη τιμή, με την προτίμηση του καλούντος στις ισοβαθμίες. */
function worstSuspect(
  obs: readonly LinearObservation[],
  active: readonly boolean[],
  s: LeastSquaresSolution,
  o: RobustAdjustmentOptions,
): number | null {
  const priority = (i: number) => o.blamePriority?.[i] ?? 0;
  let worst: number | null = null;
  let worstW = 0;
  for (let i = 0; i < obs.length; i++) {
    const r = s.redundancy[i];
    if (!active[i] || r < o.minRedundancy) continue;
    const w = Math.abs(s.residuals[i]) / (obs[i].sigma * Math.sqrt(r));
    if (w <= o.critical) continue;
    const tie = worst !== null && Math.abs(w - worstW) <= TIE_REL * worstW;
    if (worst === null || (tie ? priority(i) > priority(worst) : w > worstW)) {
      worst = i;
      worstW = Math.max(w, tie ? worstW : 0);
    }
  }
  return worst;
}

function verdicts(obs: readonly LinearObservation[], active: readonly boolean[], s: LeastSquaresSolution, o: RobustAdjustmentOptions): ObservationVerdict[] {
  return obs.map((ob, i) => {
    const residual = s.residuals[i];
    const redundancy = active[i] ? s.redundancy[i] : null;
    return { active: active[i], residual, w: standardizedResidual(ob, residual, s, redundancy, o.minRedundancy), redundancy };
  });
}

/** Η συνόρθωση με επαναληπτική απόρριψη του χειρότερου ελέγξιμου χονδροειδούς σφάλματος. */
export function adjustWithDataSnooping(obs: readonly LinearObservation[], unknowns: number, o: RobustAdjustmentOptions): RobustAdjustment {
  const active = obs.map(() => true);
  let solution = solveWeightedLeastSquares(obs, unknowns, factorsOf(active));
  for (let round = 0; round < obs.length && !solution.singular; round++) {
    const suspect = worstSuspect(obs, active, solution, o);
    if (suspect === null) break;
    active[suspect] = false;
    const next = solveWeightedLeastSquares(obs, unknowns, factorsOf(active));
    if (next.singular) {
      active[suspect] = true; // η απόρριψη θα άφηνε άγνωστο χωρίς παρατήρηση: σταματάμε, δεν σπάμε τη λύση
      break;
    }
    solution = next;
  }
  const df = solution.degreesOfFreedom;
  return {
    solution,
    verdicts: verdicts(obs, active, solution, o),
    rejected: active.filter((a) => !a).length,
    sigma0: !solution.singular && df > 0 ? Math.sqrt(solution.weightedSquareSum / df) : null,
    globalTestPassed: !solution.singular && df > 0 ? solution.weightedSquareSum <= chiSquareQuantile(df, Z_95) : null,
  };
}
