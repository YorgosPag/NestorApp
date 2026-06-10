/**
 * ADR-422 L1.7 — Μοντέλο αερισμού/διείσδυσης (EN 12831-1 §6.3.3) — PURE SSoT.
 *
 * Διαχωρίζει τις απώλειες αερισμού του heat-load engine σε δύο φυσικά ξεχωριστά
 * σκέλη και επιστρέφει το **effective** ρυθμό εναλλαγών αέρα `n_eff` (1/h) που
 * τροφοδοτεί τον αμετάβλητο τύπο του engine `Φ_V = 0.34·n·V·ΔΤ`:
 *
 *   n_inf = 2 · n50 · e · ε        (διείσδυση μέσω στεγανότητας κελύφους)
 *   n_ven = n_min · (1 − η)        (σχεδιασμένος/υγιεινός αερισμός μείον ανάκτηση η)
 *   n_eff = max(n_inf, n_ven)      (EN 12831-1 §6.3.3 — ΜΕΓΙΣΤΟ, single-zone)
 *
 * όπου `n50` = εναλλαγές αέρα στα 50 Pa (αεροστεγανότητα), `e` = συντελεστής
 * ανεμοπροστασίας ανά #εκτεθειμένων όψεων, `ε` = διόρθωση ύψους, `n_min` = ελάχιστος
 * υγιεινός αερισμός (default χρήσης), `η` = απόδοση ανάκτησης εναλλάκτη.
 *
 * Με `n50=0` (default `unspecified`) + `η=0` (default `natural`) ⇒ `n_inf=0` και
 * `n_ven=n_min` ⇒ `n_eff=max(0, n_min)=n_min` ⇒ **byte-identical** με το προ-L1.7
 * μοντέλο (zero-regression by construction).
 *
 * Καθαρή αριθμητική — καμία γεωμετρία/state/config import (οι σταθερές/preset τιμές
 * resolved από τον caller μέσω `heat-load-config`). Full unit-testable.
 *
 * @see ./heat-load-config (n50/η/e/ε presets + getters) · ./derive-space-heat-loads (caller)
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md §3 (L1.7)
 */

/** Μη-πεπερασμένο/αρνητικό → 0 (αμυντικό clamp για κάθε ρυθμό αερισμού). */
function nonNegative(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Ρυθμός διείσδυσης `n_inf = 2·n50·e·ε` (1/h). EN 12831-1 §6.3.3. `n50` σε 1/h @50Pa,
 * `shieldingE` = συντελεστής ανεμοπροστασίας (ανά #εκτεθειμένων όψεων), `heightEpsilon`
 * = διόρθωση ύψους. Οποιοδήποτε μη-θετικό όρισμα ⇒ 0.
 */
export function computeInfiltrationRate(
  n50: number,
  shieldingE: number,
  heightEpsilon: number,
): number {
  return 2 * nonNegative(n50) * nonNegative(shieldingE) * nonNegative(heightEpsilon);
}

/**
 * Σχεδιασμένος ρυθμός αερισμού `n_ven = n_min·(1−η)` (1/h). Η ανάκτηση `η` ∈ [0,1)
 * μειώνει το υγιεινό σκέλος. `η≤0` ⇒ `n_min` αμετάβλητο· `η≥1` clamp στο 0 (πλήρης
 * ανάκτηση — μη-φυσικό όριο).
 */
export function computeDesignVentilationRate(nMin: number, heatRecoveryEta: number): number {
  const min = nonNegative(nMin);
  const eta = Number.isFinite(heatRecoveryEta) ? Math.min(Math.max(heatRecoveryEta, 0), 1) : 0;
  return min * (1 - eta);
}

/** Παράμετροι υπολογισμού του effective ρυθμού αερισμού (resolved από τον caller). */
export interface EffectiveVentilationInput {
  /** 1/h — ελάχιστος υγιεινός αερισμός (σχεδιασμένο σκέλος, default χρήσης). */
  readonly nMin: number;
  /** 1/h @50Pa — αεροστεγανότητα κελύφους (0 ⇒ διείσδυση δεν λαμβάνεται υπόψη). */
  readonly n50: number;
  /** Συντελεστής ανεμοπροστασίας `e` (ανά #εκτεθειμένων όψεων). */
  readonly shieldingE: number;
  /** Συντελεστής διόρθωσης ύψους `ε` (≈1.0 τυπικά). */
  readonly heightEpsilon: number;
  /** Απόδοση ανάκτησης θερμότητας `η` ∈ [0,1) (0 ⇒ καμία ανάκτηση). */
  readonly heatRecoveryEta: number;
}

/**
 * Effective ρυθμός εναλλαγών αέρα `n_eff = max(n_inf, n_ven)` (1/h) — EN 12831-1
 * §6.3.3 single-zone. Αυτό το `n_eff` περνά ως το υπάρχον `airChangesPerHour` στον
 * engine (που μένει τυφλός). Defaults (n50=0, η=0) ⇒ `n_eff=n_min` (zero-regression).
 */
export function computeEffectiveVentilationRate(input: EffectiveVentilationInput): number {
  const infiltration = computeInfiltrationRate(input.n50, input.shieldingE, input.heightEpsilon);
  const design = computeDesignVentilationRate(input.nMin, input.heatRecoveryEta);
  return Math.max(infiltration, design);
}
