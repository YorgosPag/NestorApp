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
import type {
  ColumnReinforcementLimits,
  ColumnSectionContext,
  StructuralCodeProvider,
} from './structural-code-types';
import { suggestColumnReinforcementFrom } from './suggest-reinforcement';

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

export const GREEK_LEGACY_PROVIDER: StructuralCodeProvider = {
  id: 'greek-legacy',
  labelKey: 'structural.code.greekLegacy',
  columnReinforcementLimits: greekLegacyColumnLimits,
  suggestColumnReinforcement(ctx: ColumnSectionContext): ColumnReinforcement {
    return suggestColumnReinforcementFrom(this, ctx);
  },
};
