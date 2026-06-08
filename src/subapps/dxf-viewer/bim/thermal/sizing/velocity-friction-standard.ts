/**
 * ADR-422 L3 — Pluggable pipe-sizing standard (D5 «velocity + friction»).
 *
 * Mirror του `SizingStandard` της ύδρευσης (`systems/mep-design/water/water-sizing.ts`),
 * στο thermal namespace: αντί ΣLU→DN, εδώ **παροχή όγκου (m³/s) → DN** με διπλό
 * κριτήριο. Ανεβαίνει την κλίμακα `HEATING_DN_LADDER` και επιστρέφει τον **μικρότερο**
 * βαθμό όπου `v ≤ v_max` ΚΑΙ `R ≤ R_max`· αν κανένας δεν τα ικανοποιεί (πολύ μεγάλη
 * παροχή), τον μεγαλύτερο βαθμό με `saturated:true` (ο μελετητής το βλέπει).
 *
 * Pluggable: ένας πλήρης υδραυλικός engine (Colebrook/CIBSE) μπαίνει πίσω από το ίδιο
 * interface χωρίς αλλαγή στους callers (network walk / hook / UI).
 *
 * @see ./pipe-sizing (pipeVelocity / pipeFriction)
 * @see ./pipe-sizing-config (κλίμακα + όρια)
 */

import {
  HEATING_DN_LADDER,
  MAX_VELOCITY_M_S,
  MAX_FRICTION_PA_M,
  type DnLadderStep,
} from './pipe-sizing-config';
import { pipeVelocity, pipeFriction } from './pipe-sizing';

/** Επιλεγμένη διάμετρος + τα υδραυλικά μεγέθη που την αιτιολογούν. */
export interface PipeDiameterSelection {
  /** Ονομαστική διάμετρος (DN, mm). */
  readonly dnMm: number;
  /** mm — εξωτερική διάμετρος (→ `mep-segment.params.diameter`). */
  readonly outerMm: number;
  /** mm — εσωτερική διάμετρος. */
  readonly innerMm: number;
  /** m/s — ταχύτητα ροής στην επιλεγμένη διάμετρο. */
  readonly velocityMS: number;
  /** Pa/m — ειδική τριβή στην επιλεγμένη διάμετρο. */
  readonly frictionPaM: number;
  /** true όταν ΚΑΝΕΝΑΣ βαθμός δεν ικανοποιεί τα όρια (επιστράφηκε ο μεγαλύτερος). */
  readonly saturated: boolean;
}

/** Pluggable standard: παροχή όγκου (m³/s) → επιλογή διαμέτρου. */
export interface PipeSizingStandard {
  readonly id: string;
  /** Smallest ladder step satisfying v_max ∧ R_max (else largest, saturated). */
  diameterForFlow(volumeFlowM3s: number): PipeDiameterSelection;
}

/** Υλικά μεγέθη ενός βαθμού για δεδομένη παροχή. */
function evaluateStep(step: DnLadderStep, volumeFlowM3s: number): PipeDiameterSelection {
  const velocityMS = pipeVelocity(volumeFlowM3s, step.innerMm);
  const frictionPaM = pipeFriction(velocityMS, step.innerMm);
  return {
    dnMm: step.dnMm,
    outerMm: step.outerMm,
    innerMm: step.innerMm,
    velocityMS,
    frictionPaM,
    saturated: false,
  };
}

/** Το pilot standard «velocity + friction» πάνω στην `HEATING_DN_LADDER`. */
export const VELOCITY_FRICTION_STANDARD: PipeSizingStandard = {
  id: 'velocity-friction(v≤1.0,R≤150)',
  diameterForFlow(volumeFlowM3s: number): PipeDiameterSelection {
    for (const step of HEATING_DN_LADDER) {
      const evald = evaluateStep(step, volumeFlowM3s);
      if (evald.velocityMS <= MAX_VELOCITY_M_S && evald.frictionPaM <= MAX_FRICTION_PA_M) {
        return evald;
      }
    }
    const largest = HEATING_DN_LADDER[HEATING_DN_LADDER.length - 1]!;
    return { ...evaluateStep(largest, volumeFlowM3s), saturated: true };
  },
};
