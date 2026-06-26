/**
 * Beam → DERIVED T-beam flange context (ADR-534 Φ3b).
 *
 * Geometry-is-SSoT bridge: «καλύπτει μονολιθική πλάκα αυτή τη δοκό;» → αν ναι, η δοκός
 * είναι **πλακοδοκός (T-beam)** και το `b_eff` (EC2 §5.3.2.1) υπολογίζεται μέσω του SSoT
 * `computeEffectiveFlangeWidthMm`. Αν όχι (γυμνή δοκός χωρίς πέλμα) → `undefined` →
 * ορθογώνια διατομή `b_w` (μηδέν regression).
 *
 * **FULL SSoT reuse** — ΜΗΝ ξαναγραφτεί boolean/point-in-slab:
 *   · `hostUndersideAt` (`host-footprint-eval`) — point-in-footprint → soffit, η ΙΔΙΑ
 *     που κόβει τα attached μέλη στο soffit (§monolithic-cut)·
 *   · `polygon2DCentroid` (`polygon-utils`) — δειγματοληψία κέντρου footprint.
 * Ο caller (scene access) χτίζει τα `coveringHosts` μέσω `buildCeilingSlabHosts`
 * (`monolithic-slab-clip`) ώστε αυτό το module να μένει pure (zero scene/bim-3d import).
 *
 * @see ./codes/effective-flange-width.ts — b_eff SSoT (EC2 §5.3.2.1)
 * @see ../../bim-3d/scene/monolithic-slab-clip.ts — buildCeilingSlabHosts (ο caller το χτίζει)
 * @see docs/centralized-systems/reference/adrs/ADR-534-auto-ceiling-slab-per-bay.md §Φ3b
 */

import type { BeamEntity, BeamSupportType } from '../types/beam-types';
import type { HostFootprintInput, Pt2 } from '../geometry/wall-host-plan-builder';
import { hostUndersideAt } from '../geometry/host-footprint-eval';
import { polygon2DCentroid } from '../geometry/shared/polygon-utils';
import { computeEffectiveFlangeWidthMm } from './codes/effective-flange-width';

const M_TO_MM = 1000;

/** True αν οποιοδήποτε δείγμα (κέντρο + κορυφές) του footprint πέφτει κάτω από host πλάκα. */
function isFootprintCoveredBySlab(
  footprint: readonly Pt2[],
  coveringHosts: readonly HostFootprintInput[],
): boolean {
  const samples: Pt2[] = [polygon2DCentroid(footprint), ...footprint];
  for (const h of coveringHosts) {
    for (const pt of samples) {
      if (hostUndersideAt(h, pt) !== null) return true;
    }
  }
  return false;
}

/**
 * DERIVED `b_eff` (mm) μιας δοκού που καλύπτεται από μονολιθική πλάκα οροφής/δαπέδου.
 * `undefined` όταν δεν την καλύπτει πλάκα (γυμνή ορθογώνια δοκός) ή εκφυλισμένη γεωμετρία
 * → ο consumer πέφτει στο `b_w` (μηδέν regression). `supportType` = topology-aware (caller).
 *
 * Διπλό πέλμα (T-beam, `flangeSides: 2`) — η edge/L-beam ανίχνευση (περιμετρική δοκός με
 * πλάκα μία πλευρά) = DEFER (βλ. ADR-534 §Φ3b).
 */
export function resolveBeamEffectiveFlangeWidthMm(
  beam: Pick<BeamEntity, 'params' | 'geometry'>,
  coveringHosts: readonly HostFootprintInput[],
  supportType: BeamSupportType,
): number | undefined {
  const verts = beam.geometry.outline.vertices;
  if (verts.length < 3 || coveringHosts.length === 0 || beam.params.width <= 0) return undefined;
  const footprint: Pt2[] = verts.map((v) => ({ x: v.x, y: v.y }));
  if (!isFootprintCoveredBySlab(footprint, coveringHosts)) return undefined;
  return computeEffectiveFlangeWidthMm({
    webWidthMm: beam.params.width,
    spanMm: beam.geometry.length * M_TO_MM,
    supportType,
  });
}
