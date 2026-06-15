/**
 * Eurocode structural code provider (ADR-456 — Στατικά, Slice 1).
 *
 * EN 1992-1-1 (EC2) detailing + EN 1998-1 (EC8) seismic detailing with the Greek
 * National Annexes. Since Greece is a seismic country, the EC8 Ductility Class
 * Medium (DCM) minima govern over the plain-EC2 values where they differ
 * (e.g. ρ_min = 1% from EC8 §5.4.3.2.2 vs 0.2% from EC2 §9.5.2).
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

function eurocodeColumnLimits(
  ctx: ColumnSectionContext,
  longitudinalDiameterMm: number,
): ColumnReinforcementLimits {
  const bMin = Math.min(ctx.widthMm, ctx.depthMm);
  // EC2 §9.5.3(1): φw ≥ max(6mm, 0.25·dbL,max) → επόμενη εμπορική.
  const minStirrupRaw = Math.max(6, 0.25 * longitudinalDiameterMm);
  return {
    // EC8 §5.4.3.2.2(1)P (DCM) — κυριαρχεί έναντι EC2 §9.5.2 (0.002).
    minRatio: 0.01,
    // EC2 §9.5.2(3) — εκτός περιοχών υπερκάλυψης.
    maxRatio: 0.04,
    // EC2 §9.5.2(4): ≥1 ράβδος ανά γωνία → 4 για ορθογωνική.
    minBarCount: 4,
    // EC2 §9.5.2(1) NA / EC8 πρακτική — Ø12 για κύριο οπλισμό κολώνας.
    minBarDiameterMm: 12,
    minStirrupDiameterMm: nextRebarDiameterMm(minStirrupRaw),
    // EC2 §9.5.3(3): scl,tmax = min(20·dbL,min, b, 400mm).
    maxStirrupSpacingMm: Math.min(20 * longitudinalDiameterMm, bMin, 400),
    // EC8 §5.4.3.2.2(11) DCM κρίσιμη περιοχή: s ≤ min(b0/2, 175, 8·dbL).
    criticalStirrupSpacingMm: Math.min(bMin / 2, 175, 8 * longitudinalDiameterMm),
    // EC8 §5.4.3.2.2(11)P (DCM): κάθε διαμήκης συγκρατημένη ράβδος ≤200mm απόσταση.
    maxBarSpacingMm: 200,
    // EN 1992-1-1 §4.4.1 — cnom ~30mm για XC κλάση έκθεσης κτιρίων.
    nominalCoverMm: 30,
  };
}

export const EUROCODE_PROVIDER: StructuralCodeProvider = {
  id: 'eurocode',
  labelKey: 'structural.code.eurocode',
  columnReinforcementLimits: eurocodeColumnLimits,
  suggestColumnReinforcement(ctx: ColumnSectionContext): ColumnReinforcement {
    return suggestColumnReinforcementFrom(this, ctx);
  },
};
