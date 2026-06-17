/**
 * Load combinations — EN1990 (ADR-464, Slice 1).
 *
 * SSoT για τους συνδυασμούς δράσεων: μετατρέπει το χαρακτηριστικό (service) G/Q
 * `MemberLoad` σε `CombinedLoad` σχεδιασμού. Δύο καταστάσεις:
 *   - **ULS** (EN1990 §6.4.3.2, εξ. 6.10): γ_G·G + γ_Q·Q (θεμελιώδης συνδυασμός)
 *     → για κάμψη/διάτρηση (Slices 2-3).
 *   - **SLS** (EN1990 §6.5.3, χαρακτηριστικός): 1.0·G + 1.0·Q → για τον έλεγχο
 *     έδρασης εδάφους (η επιτρεπόμενη τάση σ_allow είναι ήδη service-level).
 *
 * Οι συντελεστές γ_G/γ_Q είναι code-specific → παρέχονται από τον provider
 * (`footingDesignFactors().combination`) ώστε Eurocode/ΕΚΩΣ να διαφέρουν χωρίς
 * διπλότυπο (N.0.2). Pure — zero deps πέραν των types.
 *
 * @see ./structural-loads-types.ts
 */

import type { CombinedLoad, MemberLoad } from './structural-loads-types';

/** Συντελεστές θεμελιώδους συνδυασμού ULS (EN1990 Πίνακας A1.2(B)). */
export interface LoadCombinationFactors {
  /** γ_G — μόνιμες δράσεις (EN1990: 1.35). */
  readonly gammaG: number;
  /** γ_Q — μεταβλητές δράσεις (EN1990: 1.50). */
  readonly gammaQ: number;
}

/**
 * SSoT θεμελιώδους συνδυασμού ULS (EN1990 Πίνακας A1.2(B), εξ. 6.10): γ_G=1.35,
 * γ_Q=1.50. ΕΝΑ μέρος για τους συντελεστές — Eurocode ΚΑΙ ΕΚΩΣ/ΕΑΚ 2003 §3.2.3
 * χρησιμοποιούν τους ίδιους (το ΕΑΚ τους υιοθετεί ρητά). Τα `footingDesignFactors()`
 * των providers + ο load-aware suggester (ADR-472) τον καταναλώνουν — μηδέν διπλότυπο
 * literal 1.35/1.5 (N.0.2). Αν μελλοντικός κώδικας διαφοροποιηθεί → provider override.
 */
export const EN1990_ULS_FACTORS: LoadCombinationFactors = { gammaG: 1.35, gammaQ: 1.5 };

/** Συνδυασμός μιας τριάδας G/Q συνιστωσών με δοθέντες συντελεστές. */
function combine(
  deadKn: number,
  liveKn: number,
  factors: LoadCombinationFactors,
): number {
  return factors.gammaG * deadKn + factors.gammaQ * liveKn;
}

/**
 * ULS θεμελιώδης συνδυασμός (EN1990 6.10): γ_G·G + γ_Q·Q ανά συνιστώσα
 * (αξονικό + ροπές). Για διαστασιολόγηση οπλισμού/διάτρησης.
 */
export function combineUls(
  load: MemberLoad,
  factors: LoadCombinationFactors,
): CombinedLoad {
  return {
    axialKn: combine(load.deadAxialKn, load.liveAxialKn, factors),
    momentXKnm: combine(load.deadMomentXKnm, load.liveMomentXKnm, factors),
    momentYKnm: combine(load.deadMomentYKnm, load.liveMomentYKnm, factors),
  };
}

/**
 * SLS χαρακτηριστικός συνδυασμός (EN1990 6.14b): G + Q (γ=1). Για τον έλεγχο
 * έδρασης εδάφους — η σ_allow αναφέρεται σε service φορτία.
 */
export function combineSls(load: MemberLoad): CombinedLoad {
  return {
    axialKn: load.deadAxialKn + load.liveAxialKn,
    momentXKnm: load.deadMomentXKnm + load.liveMomentXKnm,
    momentYKnm: load.deadMomentYKnm + load.liveMomentYKnm,
  };
}
