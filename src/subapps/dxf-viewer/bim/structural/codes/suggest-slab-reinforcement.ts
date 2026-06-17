/**
 * Universal slab-reinforcement suggester (ADR-459 Φ4e/E3 + ADR-476).
 *
 * Split out of `suggest-reinforcement.ts` (N.7.1 file-size) — keeps the shared
 * bar/mesh-selection core (`resolveMatMesh`, `footingEffectiveDepthMm`) as the
 * SSoT and only adds the kind-aware slab algorithm here. Re-exported from
 * `suggest-reinforcement.ts` so existing importers stay unchanged.
 *
 * @see ./suggest-reinforcement.ts
 * @see ./structural-code-types.ts
 */

import { nextRebarDiameterMm, rebarFydMpa } from '../rebar-catalog';
import { footingEffectiveDepthMm, resolveMatMesh } from './suggest-reinforcement';
import type { SlabFoundationReinforcement } from '../reinforcement/slab-foundation-reinforcement-types';
import type {
  SlabFoundationSectionContext,
  StructuralCodeProvider,
} from './structural-code-types';

/** Μοχλοβραχίονας πλάκας z ≈ 0.9·d (απλοποιημένο EC2 §6.1 κάμψη, mirror δοκού). */
const SLAB_LEVER_ARM_FACTOR = 0.9;

/**
 * ADR-476 — απαιτούμενη As ανά μέτρο πλάτους **αναρτημένης** πλάκας από καμπτική
 * αντοχή (EC2 §6.1, μοχλοβραχίονας z=0.9·d): λωρίδα 1m υπό ομοιόμορφο επιφανειακό
 * φορτίο q_Ed (kPa = kN/m²) → M_Ed = q_Ed·L²/8 (kNm/m), A_s = M_Ed/(z·f_yd).
 * Επιστρέφει 0 χωρίς φορτίο/άνοιγμα ⇒ ο ρ_min κυριαρχεί (μηδέν regression). Συντηρητικό
 * αμφιέρειστο μοντέλο (÷8)· συνέχεια/δι-διευθυντική κατανομή = DEFER (ADR-476 §4).
 */
function asStrengthSlabPerMetreMm2(
  ctx: SlabFoundationSectionContext,
  dEffMm: number,
): number {
  const qEd = ctx.designLoadKpa ?? 0;
  const spanMm = ctx.maxFreeSpanMm ?? 0;
  if (qEd <= 0 || spanMm <= 0 || dEffMm <= 0) return 0;
  const spanM = spanMm / 1000;
  const mEdNmmPerM = ((qEd * spanM * spanM) / 8) * 1e6; // kNm/m → N·mm/m
  return mEdNmmPerM / (SLAB_LEVER_ARM_FACTOR * dEffMm * rebarFydMpa());
}

/**
 * Επιλέγει ελάχιστο-έγκυρο οπλισμό πλάκας (ΟΛΑ τα είδη — kind-aware, ADR-476). Reuse
 * του SSoT `resolveMatMesh` (μηδέν duplicate, N.0.2). Καλείται από κάθε provider.
 *
 *   - **εδαφόπλακα/raft** (`kind` foundation/absent): δι-διευθυντική **κάτω** + **άνω**
 *     σχάρα, ίδια ελάχιστη διάταξη (ρ ≥ ρ_min ανά μέτρο· EC2 §9.8.2 — soil push-up).
 *   - **αναρτημένη** (`kind` suspended): **κάτω** σχάρα ανοίγματος = max(ρ_min, strength
 *     από q·L²/8)· **άνω** σχάρα στηρίξεων = ελάχιστη διάταξη (detailing/anti-crack,
 *     preliminary — συνέχεια/hogging από ανάλυση = DEFER ADR-476 §4).
 */
export function suggestSlabFoundationReinforcementFrom(
  provider: StructuralCodeProvider,
  ctx: SlabFoundationSectionContext,
): SlabFoundationReinforcement {
  const limits = provider.slabFoundationReinforcementLimits(ctx);
  const seedDia = nextRebarDiameterMm(limits.minBarDiameterMm);
  const dEff = footingEffectiveDepthMm(ctx.thicknessMm, limits.nominalCoverMm);
  const asMinPerMetre = limits.minRatio * 1000 * dEff;

  if (ctx.kind === 'suspended') {
    const asBottomPerMetre = Math.max(asMinPerMetre, asStrengthSlabPerMetreMm2(ctx, dEff));
    const bottom = resolveMatMesh(asBottomPerMetre, seedDia, limits.maxBarSpacingMm);
    const top = resolveMatMesh(asMinPerMetre, seedDia, limits.maxBarSpacingMm);
    const bottomLayer = { diameterMm: bottom.diameterMm, spacingMm: bottom.spacingMm };
    const topLayer = { diameterMm: top.diameterMm, spacingMm: top.spacingMm };
    return {
      bottomMeshX: bottomLayer,
      bottomMeshY: bottomLayer,
      topMeshX: topLayer,
      topMeshY: topLayer,
      coverMm: limits.nominalCoverMm,
    };
  }

  // foundation/ground — δι-διευθυντική top+bottom, ίδια ελάχιστη διάταξη.
  const mesh = resolveMatMesh(asMinPerMetre, seedDia, limits.maxBarSpacingMm);
  const layer = { diameterMm: mesh.diameterMm, spacingMm: mesh.spacingMm };
  return {
    bottomMeshX: layer,
    bottomMeshY: layer,
    topMeshX: layer,
    topMeshY: layer,
    coverMm: limits.nominalCoverMm,
  };
}
