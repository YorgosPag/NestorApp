/**
 * Foundation-slab (raft / εδαφόπλακα) reinforcement quantity compute (ADR-459 Φ4e/E3).
 *
 * Pure functions: `SlabFoundationReinforcement` + section context → derived takeoff
 * quantities (μήκη/βάρος κάτω+άνω σχάρας, ρ). NEVER stored — re-derived on demand
 * (mirror geometry-is-SSoT, όπως κολόνα/δοκάρι/πέδιλο). Μήκη σε μέτρα, βάρος σε kg.
 *
 * Reuse του SSoT `meshDirectionTotals`/`footingEffectiveDepthMm` του πεδίλου (ΕΝΑ
 * αλγόριθμος σχάρας, μηδέν duplicate — N.0.2): η raft = πέδιλο με ΥΠΟΧΡΕΩΤΙΚΗ άνω
 * σχάρα (δι-διευθυντική και στις δύο στρώσεις).
 *
 * @see ./footing-reinforcement-compute.ts — ο δίδυμος του πεδίλου (mesh SSoT)
 * @see ./slab-foundation-reinforcement-types.ts
 * @see docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md §6g
 */

import { barAreaMm2 } from '../rebar-catalog';
import {
  footingEffectiveDepthMm,
  meshDirectionTotals,
} from './footing-reinforcement-compute';
import type { RebarMesh, SlabFoundationReinforcement } from './slab-foundation-reinforcement-types';
import type { SlabFoundationSectionContext } from '../codes/structural-code-types';

/** Derived takeoff quantities for a foundation-slab's reinforcement. */
export interface SlabFoundationReinforcementQuantities {
  /** Μήκος κάτω σχάρας (X+Y) (m). */
  readonly bottomLengthM: number;
  /** Βάρος κάτω σχάρας (kg). */
  readonly bottomWeightKg: number;
  /** Μήκος άνω σχάρας (X+Y) (m). */
  readonly topLengthM: number;
  /** Βάρος άνω σχάρας (kg). */
  readonly topWeightKg: number;
  /** Συνολικό βάρος χάλυβα B500C (kg). */
  readonly totalSteelWeightKg: number;
  /** Ποσοστό κύριου (κάτω) οπλισμού ρ. */
  readonly ratio: number;
}

/** Μήκος+βάρος μίας δι-διευθυντικής σχάρας (ράβδοι // X + // Y) πάνω στο bbox. */
function meshPairTotals(
  meshX: RebarMesh,
  meshY: RebarMesh,
  ctx: SlabFoundationSectionContext,
  coverMm: number,
): { lengthM: number; weightKg: number } {
  const xDir = meshDirectionTotals(meshX, ctx.widthMm, ctx.lengthMm, coverMm);
  const yDir = meshDirectionTotals(meshY, ctx.lengthMm, ctx.widthMm, coverMm);
  return { lengthM: xDir.lengthM + yDir.lengthM, weightKg: xDir.weightKg + yDir.weightKg };
}

/**
 * Υπολογισμός όλων των ποσοτήτων οπλισμού εδαφόπλακας. Μηδενικά σε εκφυλισμένη
 * είσοδο. `MM_TO_M` reused ώστε το ρ/μήκη να συμφωνούν με το πέδιλο.
 */
export function computeSlabFoundationReinforcementQuantities(
  ctx: SlabFoundationSectionContext,
  r: SlabFoundationReinforcement,
): SlabFoundationReinforcementQuantities {
  const cover = r.coverMm;
  const bottom = meshPairTotals(r.bottomMeshX, r.bottomMeshY, ctx, cover);
  const top = meshPairTotals(r.topMeshX, r.topMeshY, ctx, cover);

  const dEff = footingEffectiveDepthMm(ctx.thicknessMm, cover);
  const ratio = dEff > 0 && r.bottomMeshX.spacingMm > 0
    ? barAreaMm2(r.bottomMeshX.diameterMm) / (r.bottomMeshX.spacingMm * dEff)
    : 0;

  return {
    bottomLengthM: bottom.lengthM,
    bottomWeightKg: bottom.weightKg,
    topLengthM: top.lengthM,
    topWeightKg: top.weightKg,
    totalSteelWeightKg: bottom.weightKg + top.weightKg,
    ratio,
  };
}
