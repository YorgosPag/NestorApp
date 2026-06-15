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
  ColumnReinforcementLimits,
  ColumnSectionContext,
  StructuralCodeProvider,
} from './structural-code-types';

/** Άνω φράγμα ασφαλείας πλήθους διαμήκων (αποφυγή runaway σε εκφυλισμένη είσοδο). */
const MAX_LONGITUDINAL_BARS = 200;

/** Στρογγυλοποίηση βήματος συνδετήρων προς τα κάτω στο πλησιέστερο 25mm (πρακτικό). */
function roundSpacingDown(spacingMm: number): number {
  return Math.max(50, Math.floor(spacingMm / 25) * 25);
}

/**
 * Πλήθος περιμετρικών διαμήκων ράβδων ώστε η απόσταση μεταξύ διαδοχικών
 * **συγκρατημένων** ράβδων να ΜΗΝ ξεπερνά `maxBarSpacingMm` σε καμία πλευρά
 * (EC8 §5.4.3.2.2(11) / ΕΑΚ): ορθογώνιο = 2·⌈W/s⌉ + 2·⌈D/s⌉ (συμπεριλ. γωνιών).
 * Μικτές διαστάσεις (συντηρητικό: το core span είναι μικρότερο → πραγματική
 * απόσταση ≤ s). Ελάχιστο 4 (μία ανά γωνία) όταν s ≤ 0.
 */
function spacingBarCount(ctx: ColumnSectionContext, maxBarSpacingMm: number): number {
  if (maxBarSpacingMm <= 0) return 4;
  const nW = Math.max(1, Math.ceil(ctx.widthMm / maxBarSpacingMm));
  const nD = Math.max(1, Math.ceil(ctx.depthMm / maxBarSpacingMm));
  return 2 * nW + 2 * nD;
}

/**
 * Επιλέγει πλήθος + εμπορική διάμετρο διαμήκων ώστε να ικανοποιούνται ΤΑΥΤΟΧΡΟΝΑ:
 * (α) απόσταση ≤ max-bar-spacing, (β) ρ ≥ ρ_min, (γ) ≥ minBarCount. Στρατηγική
 * Revit-grade: το πλήθος ξεκινά από την περίσφιγξη (spacing) → ανεβαίνει η
 * διάμετρος για το ρ_min → αν κορεστεί η μέγιστη εμπορική, προστίθενται ράβδοι
 * (ανά 2, συμμετρικά) μέχρι το ρ_min.
 */
function resolveLongitudinalDesign(
  seed: ColumnReinforcementLimits,
  ctx: ColumnSectionContext,
): { count: number; diameterMm: number } {
  const asRequiredMm2 = ctx.grossAreaMm2 * seed.minRatio;
  let count = Math.max(seed.minBarCount, spacingBarCount(ctx, seed.maxBarSpacingMm));
  let diameterMm = nextRebarDiameterMm(seed.minBarDiameterMm);
  // (1) Ανέβασε τη διάμετρο μέχρι As = count·area ≥ ρ_min·Ac.
  while (count * barAreaMm2(diameterMm) < asRequiredMm2) {
    const next = nextRebarDiameterMm(diameterMm + 1);
    if (next === diameterMm) break; // έφτασε στη μέγιστη εμπορική
    diameterMm = next;
  }
  // (2) Η μέγιστη εμπορική δεν φτάνει → πρόσθεσε ράβδους (ανά 2 για συμμετρία).
  while (count * barAreaMm2(diameterMm) < asRequiredMm2 && count < MAX_LONGITUDINAL_BARS) {
    count += 2;
  }
  return { count, diameterMm };
}

/**
 * Επιλέγει ελάχιστο-έγκυρο διαμήκη + εγκάρσιο οπλισμό για τη διατομή, εγγυώμενος
 * ΚΑΙ ρ ≥ ρ_min ΚΑΙ απόσταση ≤ max-bar-spacing (δυναμικό πλήθος που κλιμακώνεται
 * με τη διατομή). Καλείται από κάθε provider μέσα στο `suggestColumnReinforcement`.
 */
export function suggestColumnReinforcementFrom(
  provider: StructuralCodeProvider,
  ctx: ColumnSectionContext,
): ColumnReinforcement {
  // ρ_min/count/minBarDiameter/maxBarSpacing/cover ανεξάρτητα της διαμέτρου → seed call.
  const seed = provider.columnReinforcementLimits(ctx, 16);
  const { count, diameterMm } = resolveLongitudinalDesign(seed, ctx);

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
