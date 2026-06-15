/**
 * Legacy Greek structural code provider (ADR-456 — Στατικά, Slice 1).
 *
 * ΕΚΩΣ 2000 (Ελληνικός Κανονισμός Ωπλισμένου Σκυροδέματος) + ΕΑΚ 2003 (Ελληνικός
 * Αντισεισμικός Κανονισμός). Used for assessing / retrofitting existing buildings
 * (ΚΑΝ.ΕΠΕ workflow) designed before the Eurocodes. Slightly more conservative
 * detailing than EC2/EC8 in places (e.g. Ø14 minimum bar, 100mm critical
 * stirrup spacing).
 *
 * @see ./structural-code-types.ts
 */

import { nextRebarDiameterMm } from '../rebar-catalog';
import type { ColumnReinforcement } from '../reinforcement/column-reinforcement-types';
import type { BeamReinforcement } from '../reinforcement/beam-reinforcement-types';
import type { FootingReinforcement } from '../reinforcement/footing-reinforcement-types';
import type {
  BeamReinforcementLimits,
  BeamSectionContext,
  ColumnReinforcementLimits,
  ColumnSectionContext,
  FootingReinforcementLimits,
  FootingSectionContext,
  StructuralCodeProvider,
} from './structural-code-types';
import {
  suggestBeamReinforcementFrom,
  suggestColumnReinforcementFrom,
  suggestFootingReinforcementFrom,
} from './suggest-reinforcement';

/** Μελετητική ενεργός διατομή δοκού d ≈ 0.9·h. */
const BEAM_EFFECTIVE_DEPTH_FACTOR = 0.9;

function greekLegacyColumnLimits(
  ctx: ColumnSectionContext,
  longitudinalDiameterMm: number,
): ColumnReinforcementLimits {
  const bMin = Math.min(ctx.widthMm, ctx.depthMm);
  // ΕΚΩΣ 2000 §18.3.5: συνδετήρες φw ≥ max(8mm, dbL/3).
  const minStirrupRaw = Math.max(8, longitudinalDiameterMm / 3);
  return {
    // ΕΚΩΣ 2000 §18.3.3 — ελάχιστο ποσοστό 1%.
    minRatio: 0.01,
    // ΕΚΩΣ 2000 §18.3.3 — μέγιστο ποσοστό 4%.
    maxRatio: 0.04,
    minBarCount: 4,
    // ΕΚΩΣ 2000 §18.3.4 — κύριος οπλισμός υποστυλωμάτων Ø ≥ 14mm.
    minBarDiameterMm: 14,
    minStirrupDiameterMm: nextRebarDiameterMm(minStirrupRaw),
    // ΕΚΩΣ 2000 §18.3.5 — εκτός κρισίμων περιοχών (συντηρητικό: 15·dbL).
    maxStirrupSpacingMm: Math.min(15 * longitudinalDiameterMm, bMin, 300),
    // ΕΑΚ 2003 §18.4.6 — κρίσιμες περιοχές: s ≤ min(b/2, 100, 8·dbL).
    criticalStirrupSpacingMm: Math.min(bMin / 2, 100, 8 * longitudinalDiameterMm),
    // ΕΑΚ 2003 §18.4.5 — κάθε διαμήκης συγκρατημένη ράβδος ≤200mm απόσταση.
    maxBarSpacingMm: 200,
    // ΕΚΩΣ 2000 §5 — επικάλυψη ~25mm για στοιχεία εσωτερικού περιβάλλοντος.
    nominalCoverMm: 25,
  };
}

/**
 * ΕΚΩΣ 2000 §17 (διαστασιολόγηση/λεπτομέρειες) + ΕΑΚ 2003 (αντισεισμικά) όρια
 * ορθογωνικής RC δοκού. Ελαφρώς συντηρητικότερα από EC2/EC8.
 */
function greekLegacyBeamLimits(
  ctx: BeamSectionContext,
  longitudinalDiameterMm: number,
): BeamReinforcementLimits {
  const dEff = BEAM_EFFECTIVE_DEPTH_FACTOR * ctx.depthMm;
  // ΕΚΩΣ 2000 §18.3.5 πρακτική — συνδετήρες φw ≥ max(8mm, dbL/4).
  const minStirrup = nextRebarDiameterMm(Math.max(8, longitudinalDiameterMm / 4));
  return {
    // ΕΚΩΣ 2000 §17.5 — ελάχιστο εφελκυόμενο ποσοστό (συντηρητικό).
    minRatio: 0.0030,
    maxRatio: 0.04,
    minBottomBarCount: 2,
    minTopBarCount: 2,
    // ΕΚΩΣ 2000 §17.x — Ø ≥ 14mm κύριος οπλισμός δοκού.
    minBarDiameterMm: 14,
    minStirrupDiameterMm: minStirrup,
    // ΕΚΩΣ 2000 — βήμα συνδετήρων εκτός κρισίμων (συντηρητικό 0.75·d, cap 250).
    maxStirrupSpacingMm: Math.min(0.75 * dEff, 250),
    // ΕΑΚ 2003 §18.4.6 — κρίσιμη ζώνη: s ≤ min(hw/4, 100, 8·dbL, 24·dbw).
    criticalStirrupSpacingMm: Math.min(ctx.depthMm / 4, 100, 8 * longitudinalDiameterMm, 24 * minStirrup),
    maxBarSpacingMm: 200,
    // ΕΚΩΣ 2000 §5 — επικάλυψη ~25mm εσωτερικού περιβάλλοντος.
    nominalCoverMm: 25,
  };
}

/**
 * ΕΚΩΣ 2000 §17 (θεμελιώσεις) όρια θεμελιακού στοιχείου — ελαφρώς συντηρητικότερα
 * από EC2 (μεγαλύτερο ρ_min, πυκνότερο μέγιστο βήμα). `tie-beam` = δοκός →
 * ισοδύναμα beam limits.
 */
function greekLegacyFootingLimits(ctx: FootingSectionContext): FootingReinforcementLimits {
  if (ctx.kind === 'tie-beam') {
    const b = greekLegacyBeamLimits(ctx, 16);
    return {
      minRatio: b.minRatio,
      minBarDiameterMm: b.minBarDiameterMm,
      maxBarSpacingMm: b.maxBarSpacingMm,
      minLongitudinalBarCount: b.minBottomBarCount,
      nominalCoverMm: b.nominalCoverMm,
    };
  }
  return {
    // ΕΚΩΣ 2000 §17 — ελάχιστο ποσοστό σχάρας θεμελίωσης (συντηρητικό).
    minRatio: 0.0015,
    // Ø12 κύριος οπλισμός σχάρας.
    minBarDiameterMm: 12,
    // Συντηρητικό μέγιστο βήμα σχάρας θεμελίωσης.
    maxBarSpacingMm: 200,
    minLongitudinalBarCount: 4,
    // ΕΚΩΣ 2000 §5 — επικάλυψη θεμελίωσης (έδραση σε έδαφος).
    nominalCoverMm: 50,
  };
}

export const GREEK_LEGACY_PROVIDER: StructuralCodeProvider = {
  id: 'greek-legacy',
  labelKey: 'structural.code.greekLegacy',
  columnReinforcementLimits: greekLegacyColumnLimits,
  suggestColumnReinforcement(ctx: ColumnSectionContext): ColumnReinforcement {
    return suggestColumnReinforcementFrom(this, ctx);
  },
  beamReinforcementLimits: greekLegacyBeamLimits,
  suggestBeamReinforcement(ctx: BeamSectionContext): BeamReinforcement {
    return suggestBeamReinforcementFrom(this, ctx);
  },
  footingReinforcementLimits: greekLegacyFootingLimits,
  suggestFootingReinforcement(ctx: FootingSectionContext): FootingReinforcement {
    return suggestFootingReinforcementFrom(this, ctx);
  },
};
