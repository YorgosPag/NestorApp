/**
 * Slab → structural section-context SSoT (ADR-459 Phase 4e/E3 + ADR-476).
 *
 * Εξαγωγή (boy-scout, N.0.2 / N.7.1 file-size) του slab-block από το `section-context.ts`:
 * helpers οικογένειας πλάκας + `SlabFoundationSectionContext` builder + φορτίο σχεδιασμού +
 * «ενεργός» οπλισμός πλάκας. Αυτόνομο (δεν εξαρτάται από column/beam/footing builders) ⇒
 * το `section-context.ts` το ξανα-εξάγει για μηδέν αλλαγή στους callers.
 *
 * geometry-is-SSoT: όλα τα μεγέθη παράγονται από `params`/`outline` (+ `geometry` cache).
 * Pure — zero React/DOM/Firestore. Όλες οι μετρήσεις σε mm (Nestor convention).
 *
 * @see ./codes/structural-code-types.ts — τα SectionContext schemas
 * @see ./section-context.ts — τα column/beam/footing builders + member-agnostic facade
 * @see docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md §Phase 4e
 */

import type { Entity } from '../../types/entities';
import { isSlabEntity } from '../../types/entities';
import type { SlabEntity } from '../types/slab-types';
import { mmToSceneUnits } from '../../utils/scene-units';
import { combineUls, EN1990_ULS_FACTORS } from './loads/load-combinations';
import { isZeroMemberLoad, resolveAppliedMemberLoad } from './loads/structural-loads-types';
import type { SlabSupportCondition } from './loads/slab-beam-support';
import { DEFAULT_CONCRETE_GRADE } from './concrete-grades';
import type { SlabFoundationReinforcement } from './reinforcement/slab-foundation-reinforcement-types';
import type {
  SlabFoundationSectionContext,
  SlabReinforcementKind,
  StructuralCodeProvider,
} from './codes/structural-code-types';

const M_TO_MM = 1000;

/** True αν η πλάκα είναι εδαφόπλακα/raft (kind foundation/ground). */
export function isFoundationSlabEntity(e: Entity): e is SlabEntity {
  return isSlabEntity(e) && (e.kind === 'foundation' || e.kind === 'ground');
}

/** ADR-476 — True αν η πλάκα είναι **αναρτημένη** (kind floor/ceiling/roof). */
export function isSuspendedSlabEntity(e: Entity): e is SlabEntity {
  return isSlabEntity(e) && (e.kind === 'floor' || e.kind === 'ceiling' || e.kind === 'roof');
}

/**
 * ADR-476 — δομική οικογένεια οπλισμού της πλάκας: foundation/ground → 'foundation'
 * (raft, EC2 §9.8.2)· floor/ceiling/roof → 'suspended' (EC2 §9.3.1). ΕΝΑ SSoT mapping.
 */
export function resolveSlabReinforcementKind(slab: SlabEntity): SlabReinforcementKind {
  return slab.kind === 'foundation' || slab.kind === 'ground' ? 'foundation' : 'suspended';
}

/**
 * ADR-476 (parity με κολόνα/δοκάρι) — **ο «ενεργός» οπλισμός μιας πλάκας**:
 *   - absent           → `undefined` (δεν έχει οριστεί· κανείς δεν ζωγραφίζει).
 *   - manual (`!auto`) → το stored design ως έχει (κλειδωμένο, ο χρήστης το όρισε).
 *   - auto (`auto`)    → **φρέσκο code-suggested design από την ΤΡΕΧΟΥΣΑ γεωμετρία**
 *                        (πάχος/outline/span/φορτίο) → resize ⇒ real-time re-study.
 * Διατηρεί το `auto:true` flag. Pure (provider arg) ⇒ unit-testable· οι renderers
 * χρησιμοποιούν το store-coupled `resolveActiveSlabReinforcementForEntity`.
 */
export function resolveActiveSlabReinforcement(
  slab: SlabEntity,
  provider: StructuralCodeProvider,
  supportCondition?: SlabSupportCondition,
): SlabFoundationReinforcement | undefined {
  const r = slab.params.structuralReinforcement;
  if (!r || !r.auto) return r;
  const fresh = provider.suggestSlabFoundationReinforcement(
    buildSlabFoundationSectionContext(slab, supportCondition),
  );
  return { ...fresh, auto: true };
}

/**
 * Πλάκα → `SlabFoundationSectionContext` (universal, ADR-459 Φ4e/E3 + ADR-476). bbox
 * dims από το `outline` (canvas units → mm μέσω `sceneUnits`, geometry-is-SSoT — όπως ο
 * graph footprint). Οι σχάρες τρέχουν στο περιβάλλον ορθογώνιο (πλακοειδής σύμβαση).
 * kind-aware: foundation vs suspended· οι αναρτημένες παίρνουν span (από
 * `geometry.maxFreeSpanM`) + φορτίο σχεδιασμού (q_Ed) για strength-driven κάτω σχάρα.
 */
export function buildSlabFoundationSectionContext(
  slab: SlabEntity,
  supportCondition?: SlabSupportCondition,
): SlabFoundationSectionContext {
  const perScene = mmToSceneUnits(slab.params.sceneUnits ?? 'mm');
  const verts = slab.params.outline.vertices;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const v of verts) {
    if (v.x < minX) minX = v.x;
    if (v.x > maxX) maxX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.y > maxY) maxY = v.y;
  }
  const widthMm = verts.length > 0 ? (maxX - minX) / perScene : 0;
  const lengthMm = verts.length > 0 ? (maxY - minY) / perScene : 0;
  const grossAreaMm2 = Math.max(0, widthMm) * Math.max(0, lengthMm);
  const kind = resolveSlabReinforcementKind(slab);
  // ADR-498 — πρόβολος: το άνοιγμα σχεδιασμού = η κάθετη προβολή (cantileverLengthM), ΟΧΙ το
  // ελεύθερο άνοιγμα μεταξύ στηρίξεων. Absent override ⇒ 'simple' (μηδέν regression).
  const isCantilever = supportCondition?.supportType === 'cantilever';
  return {
    widthMm,
    lengthMm,
    thicknessMm: slab.params.thickness,
    grossAreaMm2,
    kind,
    maxFreeSpanMm: Math.max(0, slab.geometry.maxFreeSpanM) * M_TO_MM,
    concreteGrade: slab.params.concreteGrade ?? DEFAULT_CONCRETE_GRADE,
    ...(supportCondition ? { supportType: supportCondition.supportType } : {}),
    ...(isCantilever ? { cantileverSpanMm: Math.max(0, supportCondition!.cantileverLengthM) * M_TO_MM } : {}),
    ...resolveSlabDesignLoad(slab, grossAreaMm2),
  };
}

/**
 * ADR-476 — φορτίο σχεδιασμού επιφανείας q_Ed (kPa = kN/m², ULS) μιας **αναρτημένης**
 * πλάκας από το tributary `appliedLoad` (ADR-467): q_Ed = W_Ed(ULS)[kN] / area[m²].
 * Μηδενικό/απών φορτίο ή μη-θετικό εμβαδό ⇒ κενό ⇒ min-detailing (μηδέν regression,
 * όπως κολόνα/δοκάρι). Οι εδαφόπλακες αγνοούν το q (raft = εδαφική αντίδραση, §9.8.2).
 */
function resolveSlabDesignLoad(
  slab: SlabEntity,
  grossAreaMm2: number,
): Pick<SlabFoundationSectionContext, 'designLoadKpa'> {
  if (slab.kind === 'foundation' || slab.kind === 'ground') return {};
  const areaM2 = grossAreaMm2 / 1e6;
  if (areaM2 <= 0) return {};
  const load = resolveAppliedMemberLoad(slab.params.appliedLoad);
  if (isZeroMemberLoad(load)) return {};
  const totalUlsKn = combineUls(load, EN1990_ULS_FACTORS).axialKn;
  return { designLoadKpa: totalUlsKn / areaM2 };
}
