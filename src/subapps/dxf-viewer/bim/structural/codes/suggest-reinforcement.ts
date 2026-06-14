/**
 * Shared default-reinforcement suggester (ADR-456 — Στατικά, Slice 1B).
 *
 * SSoT for «δώσε μου έναν έγκυρο ελάχιστο οπλισμό για αυτή τη διατομή». Both
 * code providers delegate here so the bar-selection algorithm lives in ONE place
 * (boy-scout / N.0.2) — only the LIMITS differ per code, never the algorithm.
 *
 * @see ./structural-code-types.ts
 */

import {
  barAreaMm2,
  nextRebarDiameterMm,
} from '../rebar-catalog';
import type { ColumnReinforcement } from '../reinforcement/column-reinforcement-types';
import type {
  ColumnSectionContext,
  StructuralCodeProvider,
} from './structural-code-types';

/** Στρογγυλοποίηση βήματος συνδετήρων προς τα κάτω στο πλησιέστερο 25mm (πρακτικό). */
function roundSpacingDown(spacingMm: number): number {
  return Math.max(50, Math.floor(spacingMm / 25) * 25);
}

/**
 * Επιλέγει ελάχιστο-έγκυρο διαμήκη + εγκάρσιο οπλισμό για τη διατομή, εγγυώμενος
 * ρ ≥ ρ_min ανεβάζοντας τη διάμετρο στις εμπορικές τιμές. Καλείται από κάθε
 * provider μέσα στο `suggestColumnReinforcement`.
 */
export function suggestColumnReinforcementFrom(
  provider: StructuralCodeProvider,
  ctx: ColumnSectionContext,
): ColumnReinforcement {
  // ρ_min/count/minBarDiameter/cover είναι ανεξάρτητα της διαμέτρου → seed call.
  const seed = provider.columnReinforcementLimits(ctx, 16);
  const count = seed.minBarCount;
  let diameterMm = nextRebarDiameterMm(seed.minBarDiameterMm);

  // Ανέβασε τη διάμετρο μέχρι As = count·area ≥ ρ_min·Ac.
  const asRequiredMm2 = ctx.grossAreaMm2 * seed.minRatio;
  while (count * barAreaMm2(diameterMm) < asRequiredMm2) {
    const next = nextRebarDiameterMm(diameterMm + 1);
    if (next === diameterMm) break; // έφτασε στη μέγιστη εμπορική
    diameterMm = next;
  }

  // Stirrup rules εξαρτώνται από την τελική διάμετρο διαμήκους → δεύτερο call.
  const limits = provider.columnReinforcementLimits(ctx, diameterMm);

  return {
    longitudinal: { diameterMm, count },
    stirrups: {
      diameterMm: limits.minStirrupDiameterMm,
      spacingMm: roundSpacingDown(limits.maxStirrupSpacingMm),
      spacingCriticalMm: roundSpacingDown(limits.criticalStirrupSpacingMm),
    },
    coverMm: limits.nominalCoverMm,
  };
}
