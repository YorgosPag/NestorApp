/**
 * ADR-422 L2 — Radiator-sizing engine (EN 442 exponent correction) — PURE SSoT.
 *
 * Διαστασιολόγηση θερμαντικού σώματος: από το θερμικό φορτίο που του αναλογεί
 * (`roomLoadW`, W) στην **απαιτούμενη ονομαστική ισχύ** (W @ΔΤ50K), συγκρίσιμη με
 * την ισχύ καταλόγου (`thermalOutputW`). Διόρθωση κατά EN 442 για το πραγματικό
 * θερμοκρασιακό καθεστώς του δικτύου:
 *
 *   ΔΤ_actual        = (Tsupply + Treturn)/2 − Ti          (AMTD — σύμβαση EN 442)
 *   correctionFactor = (ΔΤ_nominal / ΔΤ_actual)^n          (ΔΤ_nominal = 50 K)
 *   requiredNominalW = roomLoadW · correctionFactor         (ισχύς @ΔΤ50K)
 *
 * ΚΑΜΙΑ γεωμετρία / state / persistence / catalogue — μόνο αριθμητική. Full
 * unit-testable με EN 442 worked examples. Idempotent.
 *
 * ΜΟΝΑΔΕΣ: θερμοκρασίες °C/K, φορτίο/ισχύς W → ίδιες μονάδες στην έξοδο.
 *
 * @see ./radiator-sizing-config (ΔΤ_nominal / εκθέτης / regimes)
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md §3 (L2)
 */

import { DELTA_T_NOMINAL_K } from './radiator-sizing-config';

/** Είσοδος διαστασιολόγησης ενός σώματος (resolved — καμία γνώση scene). */
export interface RadiatorSizingInput {
  /** W — θερμικό φορτίο που αναλογεί στο σώμα (μερίδιο του Φ_room). */
  readonly roomLoadW: number;
  /** °C — θερμοκρασία προσαγωγής δικτύου. */
  readonly supplyC: number;
  /** °C — θερμοκρασία επιστροφής δικτύου. */
  readonly returnC: number;
  /** °C — εσωτερική θερμοκρασία σχεδιασμού χώρου Ti. */
  readonly indoorC: number;
  /** Εκθέτης σώματος `n` (EN 442). */
  readonly exponent: number;
}

/** Αποτέλεσμα διαστασιολόγησης (derived — ΠΟΤΕ persisted). */
export interface RadiatorSizingResult {
  /** K — θερμοκρασιακή υπεροχή σώματος–χώρου (AMTD). 0 αν εκφυλισμένη. */
  readonly deltaTActualK: number;
  /** Παράγοντας διόρθωσης (ΔΤ_nominal/ΔΤ_actual)^n. 1.0 όταν ΔΤ_actual = ΔΤ_nominal. */
  readonly correctionFactor: number;
  /** W — απαιτούμενη ονομαστική ισχύς @ΔΤ50K (συγκρίσιμη με κατάλογο). */
  readonly requiredNominalW: number;
}

/**
 * Απαιτούμενη ονομαστική ισχύς σώματος (EN 442). Pure/idempotent.
 *
 * Guard εκφυλισμού: αν `ΔΤ_actual ≤ 0` (το νερό δεν είναι θερμότερο από τον χώρο)
 * το σώμα δεν αποδίδει — επιστρέφεται μηδενικό ΔΤ/factor 0 και `requiredNominalW`
 * = roomLoadW (ο consumer το ερμηνεύει ως «μη ρεαλιστικό regime»). Δεν πετά.
 */
export function computeRequiredRadiatorOutput(
  input: RadiatorSizingInput,
): RadiatorSizingResult {
  const meanWaterC = (input.supplyC + input.returnC) / 2;
  const deltaTActualK = meanWaterC - input.indoorC;

  if (!(deltaTActualK > 0)) {
    return { deltaTActualK: 0, correctionFactor: 0, requiredNominalW: input.roomLoadW };
  }

  const correctionFactor = Math.pow(DELTA_T_NOMINAL_K / deltaTActualK, input.exponent);
  const roomLoadW = Number.isFinite(input.roomLoadW) ? input.roomLoadW : 0;
  return {
    deltaTActualK,
    correctionFactor,
    requiredNominalW: roomLoadW * correctionFactor,
  };
}
