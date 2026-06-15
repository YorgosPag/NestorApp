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
import type { BeamReinforcement } from '../reinforcement/beam-reinforcement-types';
import type {
  BeamReinforcementLimits,
  BeamSectionContext,
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
 * SSoT bar-selection core (N.0.2 — μοιράζεται κολόνα + δοκάρι): δεδομένης
 * απαιτούμενης As, αρχικού πλήθους & seed διαμέτρου, επιστρέφει {count, diameter}
 * ώστε `count·area(diameter) ≥ asRequired`. Πρώτα ανεβαίνει η διάμετρος στις
 * εμπορικές τιμές· αν κορεστεί η μέγιστη, προστίθενται ράβδοι ανά `addStep`.
 */
export function resolveBarSet(
  asRequiredMm2: number,
  initialCount: number,
  seedDiameterMm: number,
  addStep = 2,
): { count: number; diameterMm: number } {
  let count = initialCount;
  let diameterMm = seedDiameterMm;
  while (count * barAreaMm2(diameterMm) < asRequiredMm2) {
    const next = nextRebarDiameterMm(diameterMm + 1);
    if (next === diameterMm) break; // έφτασε στη μέγιστη εμπορική
    diameterMm = next;
  }
  while (count * barAreaMm2(diameterMm) < asRequiredMm2 && count < MAX_LONGITUDINAL_BARS) {
    count += addStep;
  }
  return { count, diameterMm };
}

/**
 * Επιλέγει πλήθος + εμπορική διάμετρο διαμήκων ώστε να ικανοποιούνται ΤΑΥΤΟΧΡΟΝΑ:
 * (α) απόσταση ≤ max-bar-spacing, (β) ρ ≥ ρ_min, (γ) ≥ minBarCount. Το πλήθος
 * ξεκινά από την περίσφιγξη (spacing) → reuse `resolveBarSet`.
 */
function resolveLongitudinalDesign(
  seed: ColumnReinforcementLimits,
  ctx: ColumnSectionContext,
): { count: number; diameterMm: number } {
  const asRequiredMm2 = ctx.grossAreaMm2 * seed.minRatio;
  const initialCount = Math.max(seed.minBarCount, spacingBarCount(ctx, seed.maxBarSpacingMm));
  return resolveBarSet(asRequiredMm2, initialCount, nextRebarDiameterMm(seed.minBarDiameterMm));
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

// ─── Beam suggester (ADR-459 Phase 4a) ───────────────────────────────────────

/** Μελετητική ενεργός διατομή d ≈ 0.9·h (cover/bar-agnostic seed για ρ). */
const BEAM_EFFECTIVE_DEPTH_FACTOR = 0.9;

/** EC8 §5.4.3.1.2(5) — ο άνω οπλισμός κατά μήκος ≥ 0.25·κάτω (αναρτήρες). */
const BEAM_TOP_TO_BOTTOM_RATIO = 0.25;

/**
 * Επιλέγει ελάχιστο-έγκυρο διαμήκη (κάτω/άνω) + εγκάρσιο οπλισμό δοκαριού,
 * εγγυώμενος ρ_κάτω ≥ ρ_min επί της ενεργού διατομής b·d (d ≈ 0.9h). Reuse του
 * SSoT `resolveBarSet` (μηδέν duplicate). Καλείται από κάθε provider.
 */
export function suggestBeamReinforcementFrom(
  provider: StructuralCodeProvider,
  ctx: BeamSectionContext,
): BeamReinforcement {
  const seed = provider.beamReinforcementLimits(ctx, 16);
  const effectiveDepthMm = BEAM_EFFECTIVE_DEPTH_FACTOR * ctx.depthMm;
  const asBottomMm2 = seed.minRatio * ctx.widthMm * effectiveDepthMm;
  const seedDia = nextRebarDiameterMm(seed.minBarDiameterMm);

  const bottom = resolveBarSet(asBottomMm2, Math.max(seed.minBottomBarCount, 2), seedDia);
  const top = resolveBarSet(
    BEAM_TOP_TO_BOTTOM_RATIO * bottom.count * barAreaMm2(bottom.diameterMm),
    Math.max(seed.minTopBarCount, 2),
    seedDia,
  );

  const limits = provider.beamReinforcementLimits(ctx, bottom.diameterMm);
  return {
    bottom: { diameterMm: bottom.diameterMm, count: bottom.count },
    top: { diameterMm: top.diameterMm, count: top.count },
    stirrups: {
      diameterMm: limits.minStirrupDiameterMm,
      spacingMm: roundSpacingDown(limits.maxStirrupSpacingMm),
      spacingCriticalMm: roundSpacingDown(limits.criticalStirrupSpacingMm),
    },
    coverMm: limits.nominalCoverMm,
  };
}
