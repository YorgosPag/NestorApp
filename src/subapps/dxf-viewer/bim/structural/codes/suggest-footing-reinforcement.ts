/**
 * Footing/tie-beam default-reinforcement suggester (ADR-459 Phase 4b).
 *
 * Extracted from `suggest-reinforcement.ts` (N.7.1 file-size). Reuses the SSoT
 * bar/mesh-selection core (`resolveMatMesh`, `resolveBarSet`, `footingEffectiveDepthMm`)
 * and the beam suggester from there, keeping a one-directional dependency
 * (mirror of `suggest-slab-reinforcement.ts`). Providers import
 * `suggestFootingReinforcementFrom` directly from here.
 *
 * @see ./suggest-reinforcement.ts
 */

import { barAreaMm2, nextRebarDiameterMm, rebarFydMpa } from '../rebar-catalog';
import {
  footingEffectiveDepthMm,
  KN_TO_N,
  resolveBarSet,
  resolveMatMesh,
  suggestBeamReinforcementFrom,
} from './suggest-reinforcement';
import type { BeamRebarLayer } from '../reinforcement/beam-reinforcement-types';
import type { FootingReinforcement } from '../reinforcement/footing-reinforcement-types';
import type {
  FootingReinforcementLimits,
  FootingSectionContext,
  PadSectionContext,
  StructuralCodeProvider,
  TieBeamSectionContext,
} from './structural-code-types';

/**
 * ADR-464 — απαιτείται άνω σχάρα πεδίλου; (κανόνας code-driven, μηδέν φορτίο
 * απαραίτητο): (α) χονδρό πέδιλο `thickness ≥ padTopMeshMinThicknessMm` (επιδερμικός
 * οπλισμός, EC2 §9.7/§7.3.3) **ή** (β) έκκεντρο `eccentricityRatio > padTopMeshKernRatio`
 * (kern → αποκόλληση/hogging). Default πέδιλο (0.5m, κεντρικό) ⇒ false (μηδέν regression).
 */
function padNeedsTopMesh(ctx: PadSectionContext, limits: FootingReinforcementLimits): boolean {
  if (ctx.thicknessMm >= limits.padTopMeshMinThicknessMm) return true;
  return (ctx.eccentricityRatio ?? 0) > limits.padTopMeshKernRatio;
}

/**
 * EN1998-5 §5.4.1.2 — αναβάθμιση μιας παρειάς (κάτω/άνω) ώστε να φέρει το μερίδιό της
 * της σεισμικής δύναμης σύνδεσης: αν ο υπάρχων (καμπτικός/ελάχιστος) οπλισμός υπολείπεται
 * του `asTiePerFaceMm2`, ξανα-επιλέγεται με reuse του SSoT `resolveBarSet` (μηδέν duplicate).
 */
function upgradeFaceForTie(layer: BeamRebarLayer, asTiePerFaceMm2: number): BeamRebarLayer {
  if (layer.count * barAreaMm2(layer.diameterMm) >= asTiePerFaceMm2) return layer;
  const set = resolveBarSet(asTiePerFaceMm2, layer.count, layer.diameterMm);
  return { diameterMm: set.diameterMm, count: set.count };
}

/**
 * Συνδετήρια δοκός: ΕΙΝΑΙ δοκός → πρώτα delegate στον beam suggester (καμπτικός +
 * detailing + EC8 συνδετήρες, μηδέν duplicate). Έπειτα, αν υπάρχει σεισμική δύναμη
 * σύνδεσης (EN1998-5 §5.4.1.2(7)), προστίθεται `As,tie = N_tie/f_yd` κατανεμημένο
 * **συμμετρικά** (μισό κάτω, μισό άνω — αξονικός σύνδεσμος εφελκυσμού/θλίψης):
 * κάθε παρειά = max(καμπτικό/ελάχιστο, μερίδιο tie). Absent/≤0 N_tie → καθαρά δοκός.
 */
function suggestTieBeamReinforcementFrom(
  provider: StructuralCodeProvider,
  ctx: TieBeamSectionContext,
): FootingReinforcement {
  const beam = suggestBeamReinforcementFrom(provider, ctx);
  const nTieKn = ctx.designAxialTieKn ?? 0;
  if (nTieKn <= 0) return { kind: 'tie-beam', ...beam };
  const asTiePerFaceMm2 = (nTieKn * KN_TO_N) / rebarFydMpa() / 2;
  return {
    kind: 'tie-beam',
    ...beam,
    bottom: upgradeFaceForTie(beam.bottom, asTiePerFaceMm2),
    top: upgradeFaceForTie(beam.top, asTiePerFaceMm2),
  };
}

/**
 * Επιλέγει ελάχιστο-έγκυρο οπλισμό θεμελίωσης ανά kind. pad → δι-διευθυντική σχάρα
 * (reuse `resolveMatMesh`)· strip → εγκάρσια σχάρα + διαμήκεις διανομής (reuse
 * `resolveBarSet`)· tie-beam → **delegate** στον beam suggester (μηδέν duplicate,
 * N.0.2). Καλείται από κάθε provider.
 */
export function suggestFootingReinforcementFrom(
  provider: StructuralCodeProvider,
  ctx: FootingSectionContext,
): FootingReinforcement {
  if (ctx.kind === 'tie-beam') {
    return suggestTieBeamReinforcementFrom(provider, ctx);
  }

  const limits = provider.footingReinforcementLimits(ctx);
  const seedDia = nextRebarDiameterMm(limits.minBarDiameterMm);
  const thicknessMm = ctx.thicknessMm;
  const dEff = footingEffectiveDepthMm(thicknessMm, limits.nominalCoverMm);
  const asPerMetre = limits.minRatio * 1000 * dEff;

  if (ctx.kind === 'pad') {
    const mesh = resolveMatMesh(asPerMetre, seedDia, limits.maxBarSpacingMm);
    const layer = { diameterMm: mesh.diameterMm, spacingMm: mesh.spacingMm };
    // ADR-464 — άνω σχάρα όταν την απαιτεί ο κώδικας (επιδερμικός/kern)· ίδια
    // ελάχιστη διάταξη με την κάτω (mirror raft, συντηρητικό & πρακτικό).
    const topMesh = padNeedsTopMesh(ctx, limits) ? layer : undefined;
    return {
      kind: 'pad',
      bottomMeshX: layer,
      bottomMeshY: layer,
      ...(topMesh ? { topMesh } : {}),
      coverMm: limits.nominalCoverMm,
    };
  }

  // strip — ανεστραμμένη δοκός: εγκάρσιες (κύριος) + διαμήκεις διανομής (detailing).
  const transverse = resolveMatMesh(asPerMetre, seedDia, limits.maxBarSpacingMm);
  const initialLongCount = Math.max(
    limits.minLongitudinalBarCount,
    Math.ceil(ctx.widthMm / limits.maxBarSpacingMm) + 1,
  );
  // Διαμήκεις = detailing-governed (όχι strength) → asRequired=0 ⇒ reuse SSoT χωρίς bump.
  const longitudinal = resolveBarSet(0, initialLongCount, seedDia);
  return {
    kind: 'strip',
    transverse: { diameterMm: transverse.diameterMm, spacingMm: transverse.spacingMm },
    longitudinal: { diameterMm: longitudinal.diameterMm, count: longitudinal.count },
    coverMm: limits.nominalCoverMm,
  };
}
