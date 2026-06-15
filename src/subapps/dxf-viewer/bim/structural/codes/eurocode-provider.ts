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
import type { BeamReinforcement } from '../reinforcement/beam-reinforcement-types';
import type {
  BeamReinforcementLimits,
  BeamSectionContext,
  ColumnReinforcementLimits,
  ColumnSectionContext,
  StructuralCodeProvider,
} from './structural-code-types';
import {
  suggestBeamReinforcementFrom,
  suggestColumnReinforcementFrom,
} from './suggest-reinforcement';

/** Μελετητική ενεργός διατομή δοκού d ≈ 0.9·h. */
const BEAM_EFFECTIVE_DEPTH_FACTOR = 0.9;

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

/**
 * EC2 §9.2 (detailing) + EC8 §5.4.3.1.2 (DCM seismic) όρια ορθογωνικής RC δοκού.
 * Τα ρ αναφέρονται στην ενεργό διατομή b·d (d ≈ 0.9h).
 */
function eurocodeBeamLimits(
  ctx: BeamSectionContext,
  longitudinalDiameterMm: number,
): BeamReinforcementLimits {
  const dEff = BEAM_EFFECTIVE_DEPTH_FACTOR * ctx.depthMm;
  // EC2 §9.2.2(1) φw ≥ max(6mm, 0.25·dbL,max)· EC8 DCM + ελληνική πρακτική → Ø8 min.
  const minStirrup = nextRebarDiameterMm(Math.max(8, 0.25 * longitudinalDiameterMm));
  return {
    // EC8 §5.4.3.1.2(5) DCM: ρ_min = 0.5·fctm/fyk ≈ 0.0026 (C25/30 + B500C).
    minRatio: 0.0026,
    // EC8 §5.4.3.1.2(4) — πρακτικό άνω όριο εφελκυόμενου οπλισμού δοκού.
    maxRatio: 0.04,
    // EC2 §9.2.1.1 — ≥2 γωνιακές ράβδοι κάτω + 2 διαμπερείς άνω.
    minBottomBarCount: 2,
    minTopBarCount: 2,
    // EC2/Greek πρακτική — Ø14 κύριος οπλισμός δοκού.
    minBarDiameterMm: 14,
    minStirrupDiameterMm: minStirrup,
    // EC2 §9.2.2(6): sl,max = 0.75·d (κατακόρυφοι συνδετήρες).
    maxStirrupSpacingMm: Math.min(0.75 * dEff, 300),
    // EC8 §5.4.3.1.2(6) DCM κρίσιμη ζώνη: s ≤ min(hw/4, 175, 8·dbL, 24·dbw).
    criticalStirrupSpacingMm: Math.min(ctx.depthMm / 4, 175, 8 * longitudinalDiameterMm, 24 * minStirrup),
    // EC2 §7.3 crack control — απόσταση διαμήκων.
    maxBarSpacingMm: 200,
    // EN 1992-1-1 §4.4.1 — cnom ~30mm για XC κτιρίων.
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
  beamReinforcementLimits: eurocodeBeamLimits,
  suggestBeamReinforcement(ctx: BeamSectionContext): BeamReinforcement {
    return suggestBeamReinforcementFrom(this, ctx);
  },
};
