/**
 * slab-sizing — SSoT αυτόματης διαστασιολόγησης **πάχους** πλάκας-προβόλου
 * (ADR-499 Slice B, Revit-grade). Αδελφή του `member-sizing.suggestBeamSection`.
 *
 * Πρόβολος-πλάκα (ADR-498): η μονόπλευρη στήριξη δίνει hogging `M_Ed = q·L²/2`. Αν το
 * πάχος μένει σταθερό (π.χ. 200mm), ο οπλισμός κορεστεί στο A_s,lim (flexural-capacity
 * cap, Slice A) και η πλάκα είναι **φυσικά ανεπαρκής**. Εδώ το πάχος αυτο-μεγαλώνει
 * ώστε να ικανοποιούνται ΤΑΥΤΟΧΡΟΝΑ:
 *   1. **SLS βέλος** (EC2 §7.4.2): `d_req ≥ cantileverSpan / (l/d)_limit` (provider
 *      `slabSpanDepthLimit`, ADR-498· πρόβολος K=0.4).
 *   2. **ULS κάμψη** (η φυσική πύλη): `d_req ≥ √(M_Ed/(μ_lim·f_cd·b))` (`capacityDepthMm`,
 *      b = 1000mm λωρίδα) ⇒ `M_Ed ≤ M_Rd,lim` ⇒ ο οπλισμός παύει να κορέννυται.
 * Πάχος = `max(d_req) + cover` (αντιστροφή `footingEffectiveDepthMm`), στρογγυλεμένο σε
 * module 10mm, με πρακτικό άνω φράγμα (Slice D escalation όταν δεν αρκεί).
 *
 * **Scope B1:** μόνο **αναρτημένη πλάκα-πρόβολος** (`kind suspended` + `cantilever`). Η
 * εδαφόπλακα/raft διαστασιολογείται από εδαφική αντίδραση (όχι εδώ)· η αμφιέρειστη
 * αναρτημένη = DEFER (ο Slice A cap την προστατεύει ήδη από ψεύτικο οπλισμό).
 *
 * REUSE (μηδέν duplicate μηχανικής, N.0.2): `capacityDepthMm`/`limitMomentNmm`
 * (flexural-capacity SSoT), `slabDesignMomentNmmPerM` (suggest-slab-reinforcement),
 * `footingEffectiveDepthMm`, `slabSpanDepthLimit`/`flexuralLimitMuLim` (provider). Pure
 * — zero React/DOM/Firestore. Όλα σε mm.
 *
 * @see ./member-sizing.ts — `suggestBeamSection` (το αδελφό pattern)
 * @see ../codes/flexural-capacity.ts — `capacityDepthMm` (η φυσική πύλη ως βάθος)
 * @see docs/centralized-systems/reference/adrs/ADR-499-auto-correcting-organism.md
 */

import { DEFAULT_CONCRETE_GRADE, concreteFcdMpa } from '../concrete-grades';
import { capacityDepthMm } from '../codes/flexural-capacity';
import { slabDesignMomentNmmPerM } from '../codes/suggest-slab-reinforcement';
import { footingEffectiveDepthMm } from '../codes/suggest-reinforcement';
import type { SlabFoundationSectionContext, StructuralCodeProvider } from '../codes/structural-code-types';
import { MIN_SLAB_THICKNESS_MM } from '../../types/slab-types';

/** Constructible module στρογγυλοποίησης πάχους πλάκας (mm). */
const SLAB_THICKNESS_MODULE_MM = 10;

/** Πρακτικό άνω φράγμα πάχους πλάκας (mm) — πάνω από αυτό → Slice D escalation (ανέφικτο). */
export const MAX_PRACTICAL_SLAB_THICKNESS_MM = 1200;

/** Πλάτος λωρίδας σχεδιασμού πλάκας (mm) — ανά μέτρο. */
const SLAB_DESIGN_STRIP_MM = 1000;

/** Ποιος έλεγχος καθόρισε το τελικό πάχος (διαγνωστικό/τεκμηρίωση). */
export type SlabSizingGovernedBy = 'serviceability' | 'capacity' | 'minimum';

/** Προτεινόμενο πάχος πλάκας. */
export interface SlabSizing {
  readonly thicknessMm: number;
  readonly governedBy: SlabSizingGovernedBy;
}

function roundUpToModule(value: number, module: number): number {
  return Math.ceil(value / module) * module;
}

/**
 * Πρόταση ελάχιστου επαρκούς πάχους **πλάκας-προβόλου**. `undefined` όταν δεν εφαρμόζεται
 * (μη-αναρτημένη / μη-πρόβολος / μηδενικό άνοιγμα) ⇒ ο caller κρατά το stored πάχος.
 * `governedBy` = ο έλεγχος που καθόρισε το raw βάθος (προ-clamp).
 */
export function suggestSlabThickness(
  provider: StructuralCodeProvider,
  ctx: SlabFoundationSectionContext,
): SlabSizing | undefined {
  if (ctx.kind !== 'suspended' || ctx.supportType !== 'cantilever') return undefined;
  const spanMm = ctx.cantileverSpanMm ?? 0;
  if (spanMm <= 0) return undefined;

  const ldLimit = provider.slabSpanDepthLimit(ctx);
  const dService = ldLimit > 0 ? spanMm / ldLimit : 0;
  const fcd = concreteFcdMpa(ctx.concreteGrade ?? DEFAULT_CONCRETE_GRADE);
  const dCapacity = capacityDepthMm(
    slabDesignMomentNmmPerM(ctx), fcd, provider.flexuralLimitMuLim(), SLAB_DESIGN_STRIP_MM,
  );

  const winner = dCapacity > dService
    ? { dEff: dCapacity, governedBy: 'capacity' as const }
    : { dEff: dService, governedBy: 'serviceability' as const };
  const cover = provider.slabFoundationReinforcementLimits(ctx).nominalCoverMm;
  const rawThicknessMm = winner.dEff + cover; // αντιστροφή footingEffectiveDepthMm
  const thicknessMm = Math.min(
    MAX_PRACTICAL_SLAB_THICKNESS_MM,
    Math.max(MIN_SLAB_THICKNESS_MM, roundUpToModule(rawThicknessMm, SLAB_THICKNESS_MODULE_MM)),
  );
  // Sanity: το cover-inverse να συμφωνεί με το footingEffectiveDepthMm (μηδέν drift).
  const governedBy: SlabSizingGovernedBy =
    footingEffectiveDepthMm(thicknessMm, cover) <= 0 || winner.dEff <= 0 ? 'minimum' : winner.governedBy;
  return { thicknessMm, governedBy };
}
