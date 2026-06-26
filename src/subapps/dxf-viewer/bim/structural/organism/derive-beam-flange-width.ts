/**
 * Beam effective-flange map builder — DERIVED `b_eff` ανά δοκό (ADR-534 Φ3c-B1).
 *
 * Ο organism pass παράγει `beamId → b_eff (mm)` για ΟΛΕΣ τις δοκούς που καλύπτει μονολιθική
 * πλάκα οροφής/δαπέδου (πλακοδοκός, EC2 §5.3.2.1). Mirror του `computeBeamDesignTorsion` /
 * `buildBeamMaxWidthMap`: ΕΝΑ pass γράφει το transient `BeamFlangeStore` → ο live render/reinforce
 * path το διαβάζει synchronous (μηδέν re-detection ανά frame).
 *
 * **FULL SSoT reuse:** ο πραγματικός υπολογισμός είναι ο ΙΔΙΟΣ detector με το title block / το
 * αριστερό panel — `resolveBeamEffectiveFlangeWidthMm` (`beam-flange-context`). Μένει **pure**
 * (zero scene/bim-3d import): ο caller (organism core) χτίζει τα `coveringHosts` μέσω
 * `buildCeilingSlabHosts` και τα δίνει εδώ — όπως κάνουν `BeamDetailHost` / `BeamPropertiesTab`.
 *
 * Ο `supportType` έρχεται από τον ΗΔΗ-υπολογισμένο topology-aware χάρτη του ίδιου pass
 * (`BeamSupportConditionStore` source) ώστε το `l_0` (zero-moment span) του `b_eff` να είναι
 * συνεπές με τη στήριξη που «βλέπει» ο οπλισμός — μία αλήθεια, μηδέν απόκλιση.
 *
 * @see ../beam-flange-context.ts — resolveBeamEffectiveFlangeWidthMm (ο detector SSoT)
 * @see ../../../bim-3d/scene/monolithic-slab-clip.ts — buildCeilingSlabHosts (ο caller το χτίζει)
 * @see ./beam-flange-store.ts — BeamFlangeStore (ο προορισμός)
 */

import type { Entity } from '../../../types/entities';
import { isBeamEntity } from '../../../types/entities';
import type { HostFootprintInput } from '../../geometry/wall-host-plan-builder';
import type { BeamSupportType } from '../../types/beam-types';
import { resolveBeamEffectiveFlangeWidthMm } from '../beam-flange-context';

/**
 * `Map<beamId → b_eff (mm)>` για κάθε δοκό που καλύπτει μονολιθική πλάκα (T-beam). Δοκοί χωρίς
 * κάλυψη / εκφυλισμένες παραλείπονται (absent → `b_w` fallback στον consumer). Κανένα host →
 * άδειος χάρτης (μηδέν alloc μέσω του store EMPTY). `supportTypeByBeamId` = ο topology-aware χάρτης
 * του ίδιου pass· miss → `params.supportType ?? 'simple'`.
 */
export function buildBeamFlangeWidthMap(
  entities: readonly Entity[],
  coveringHosts: readonly HostFootprintInput[],
  supportTypeByBeamId: ReadonlyMap<string, BeamSupportType>,
): Map<string, number> {
  const map = new Map<string, number>();
  if (coveringHosts.length === 0) return map;
  for (const e of entities) {
    if (!isBeamEntity(e)) continue;
    const supportType = supportTypeByBeamId.get(e.id) ?? e.params.supportType ?? 'simple';
    const beff = resolveBeamEffectiveFlangeWidthMm(e, coveringHosts, supportType);
    if (beff !== undefined) map.set(e.id, beff);
  }
  return map;
}
