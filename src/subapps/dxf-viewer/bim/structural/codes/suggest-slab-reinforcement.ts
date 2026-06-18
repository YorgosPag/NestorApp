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
import { concreteFcdMpa, DEFAULT_CONCRETE_GRADE } from '../concrete-grades';
import { footingEffectiveDepthMm, resolveMatMesh, spanMomentDivisor } from './suggest-reinforcement';
import { flexuralCapacityCapFactor, limitMomentNmm } from './flexural-capacity';
import type { SlabFoundationReinforcement } from '../reinforcement/slab-foundation-reinforcement-types';
import type {
  SlabFoundationSectionContext,
  StructuralCodeProvider,
} from './structural-code-types';

/** Μοχλοβραχίονας πλάκας z ≈ 0.9·d (απλοποιημένο EC2 §6.1 κάμψη, mirror δοκού). */
const SLAB_LEVER_ARM_FACTOR = 0.9;

/**
 * Άνοιγμα σχεδιασμού (mm) που οδηγεί τη ροπή της αναρτημένης πλάκας: **πρόβολος** (ADR-498) →
 * το μήκος προβόλου `cantileverSpanMm` (κάθετη προβολή)· αλλιώς το ελεύθερο `maxFreeSpanMm`.
 */
function slabDesignSpanMm(ctx: SlabFoundationSectionContext): number {
  return ctx.supportType === 'cantilever'
    ? (ctx.cantileverSpanMm ?? 0)
    : (ctx.maxFreeSpanMm ?? 0);
}

/**
 * ADR-499 — ροπή σχεδιασμού ανά μέτρο πλάτους αναρτημένης πλάκας `M_Ed/m = q_Ed·L²/c`
 * (N·mm/m). Extracted SSoT: τη μοιράζονται ο οπλισμός & η φυσική πύλη επάρκειας. Ο
 * `c` = `spanMomentDivisor(supportType)`: αμφιέρειστο ÷8 (κάτω), **πρόβολος ÷2** (hogging,
 * άνω σχάρα — ADR-498). 0 χωρίς φορτίο/άνοιγμα.
 */
function slabDesignMomentNmmPerM(ctx: SlabFoundationSectionContext): number {
  const qEd = ctx.designLoadKpa ?? 0;
  const spanMm = slabDesignSpanMm(ctx);
  if (qEd <= 0 || spanMm <= 0) return 0;
  const spanM = spanMm / 1000;
  return ((qEd * spanM * spanM) / spanMomentDivisor(ctx.supportType ?? 'simple')) * 1e6;
}

/**
 * ADR-476/498 — απαιτούμενη As ανά μέτρο πλάτους **αναρτημένης** πλάκας από καμπτική αντοχή
 * (EC2 §6.1, μοχλοβραχίονας z=0.9·d): λωρίδα 1m → A_s = M_Ed/(z·f_yd). 0 χωρίς φορτίο/άνοιγμα
 * ⇒ ρ_min κυριαρχεί (μηδέν regression). Συνέχεια/two-way = DEFER (ADR-476 §4).
 */
function asStrengthSlabPerMetreMm2(
  ctx: SlabFoundationSectionContext,
  dEffMm: number,
): number {
  if (dEffMm <= 0) return 0;
  const mEdNmmPerM = slabDesignMomentNmmPerM(ctx);
  if (mEdNmmPerM <= 0) return 0;
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
    // ADR-499 — φυσική πύλη (λωρίδα 1m): όταν M_Ed/m > M_Rd,lim/m η θλιβόμενη ζώνη
    // αστοχεί ⇒ ο χάλυβας κορεστεί στο A_s,lim· αποτρέπει ψεύτικο Ø25/75 σε 200mm. Η
    // ανεπάρκεια διορθώνεται με μεγαλύτερο πάχος (auto-size, ADR-499 Slice B). cap=1 → μηδέν regression.
    const fcd = concreteFcdMpa(ctx.concreteGrade ?? DEFAULT_CONCRETE_GRADE);
    const mLimNmm = limitMomentNmm(1000, dEff, fcd, provider.flexuralLimitMuLim());
    const capFactor = flexuralCapacityCapFactor(slabDesignMomentNmmPerM(ctx), mLimNmm);
    const asStrength = Math.max(asMinPerMetre, asStrengthSlabPerMetreMm2(ctx, dEff) * capFactor);
    const strengthMesh = resolveMatMesh(asStrength, seedDia, limits.maxBarSpacingMm);
    const minMesh = resolveMatMesh(asMinPerMetre, seedDia, limits.maxBarSpacingMm);
    const strengthLayer = { diameterMm: strengthMesh.diameterMm, spacingMm: strengthMesh.spacingMm };
    const minLayer = { diameterMm: minMesh.diameterMm, spacingMm: minMesh.spacingMm };
    // ADR-498 — πρόβολος: hogging → η strength σχάρα πάει ΕΠΑΝΩ (στήριξη), κάτω = ρ_min.
    // Αμφιέρειστο: strength ΚΑΤΩ (άνοιγμα), άνω = ρ_min (τρέχουσα συμπεριφορά).
    const cantilever = ctx.supportType === 'cantilever';
    const bottomLayer = cantilever ? minLayer : strengthLayer;
    const topLayer = cantilever ? strengthLayer : minLayer;
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
