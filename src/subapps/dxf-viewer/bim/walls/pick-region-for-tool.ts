/**
 * ADR-638 / ADR-419 — Click-in-region gesture SSoT για «Place Space»-style
 * εργαλεία (thermal-space, bathroom auto-arrange).
 *
 * Ενοποιεί το ΑΥΤΟΛΕΞΕΙ διπλό pick → open-loop diagnostics → oversized guard που
 * ζούσε χωριστά σε `useThermalSpaceTool` και `useBathroomAutoArrangeTool` (N.18
 * sibling-clone). Εκπέμπει τα ΙΔΙΑ EventBus rejection signals ώστε κάθε
 * region-pick εργαλείο να συμπεριφέρεται πανομοιότυπα.
 *
 * @see bim/walls/perimeter-from-faces.ts — τα υποκείμενα pick/validate primitives
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import { EventBus } from '../../systems/events/EventBus';
import {
  pickRegionPerimeterAt,
  isPerimeterOversized,
  perimeterExtentMm,
  findOpenChainLineIdsNear,
  type ClosedPerimeter,
} from './perimeter-from-faces';

/**
 * Αποτέλεσμα ενός click-in-region:
 *  - `picked`   → βρέθηκε έγκυρο περίγραμμα· ο caller προχωρά σε build/arrange.
 *  - `consumed` → εκπέμφθηκε rejection (open-loop / oversized)· ο caller επιστρέφει `true`.
 *  - `ignored`  → τίποτα κοντά στο σημείο· ο caller επιστρέφει `false` (pass-through).
 */
export type RegionPickForClickOutcome =
  | { readonly status: 'picked'; readonly perimeter: ClosedPerimeter }
  | { readonly status: 'consumed' }
  | { readonly status: 'ignored' };

/**
 * Layer 1 SSoT (κοινό click + hover): pick μικρότερου εμπεριέχοντος loop, με
 * open-chain diagnostics και γιγάντιο-περίγραμμα guard. ADR-638 §wall-aware —
 * `structuralFootprints=true` ώστε τα δωμάτια να πιάνονται και από BIM
 * τοίχους/κολόνες (Revit «Place Space»), όχι μόνο DXF γραμμές.
 */
export function pickValidatedRegionForClick(
  point: Readonly<Point2D>,
  entities: readonly Entity[],
  sceneUnits: SceneUnits,
): RegionPickForClickOutcome {
  const scale = mmToSceneUnits(sceneUnits);
  const { perimeter: pick, tol } = pickRegionPerimeterAt(point, entities, sceneUnits, true);
  if (!pick) {
    // Open-loop diagnostics (highlight unclosed lines, μην σιωπάς).
    const openIds = findOpenChainLineIdsNear(point, entities, tol);
    if (openIds.length === 0) return { status: 'ignored' };
    EventBus.emit('bim:region-perimeter-rejected', { reason: 'no-closed-loop' });
    EventBus.emit('dxf.highlightByIds', { mode: 'select', ids: openIds });
    return { status: 'consumed' };
  }
  // Γιγάντιο περίγραμμα (εξωτερικό κτίριο) → warning, όχι garbage τοποθέτηση.
  if (isPerimeterOversized(pick, scale)) {
    const { width, height } = perimeterExtentMm(pick, scale);
    EventBus.emit('bim:region-perimeter-rejected', {
      reason: 'oversized',
      widthM: width / 1000,
      depthM: height / 1000,
    });
    return { status: 'consumed' };
  }
  return { status: 'picked', perimeter: pick };
}
