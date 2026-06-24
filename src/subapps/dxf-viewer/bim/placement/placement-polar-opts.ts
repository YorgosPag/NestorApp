/**
 * ADR-514 Φ6d / ADR-398 §3.13 — κοινό SSoT για τα `PolarDiskSnapOptions` (Polar/Rect Magnet) ΟΛΩΝ
 * των point-based placement εργαλείων (**κολώνα ΚΑΙ πέδιλο**). Μαζεύει σε ΕΝΑ σημείο τα τρία inputs
 * που χρειάζεται ο `resolvePolarDiskSnap`/`buildPlacementGridMeta`, ώστε ghost ΚΑΙ commit να τα χτίζουν
 * ΙΔΙΑ (preview ≡ commit):
 *   · `worldPerPixel` — zoom-adaptive ring/angle βήμα (από το live `ImmediateTransformStore`)·
 *   · `shiftFractions` — §3.13 Q1 (από το `ColumnPolarStore` interaction state, tool-agnostic UX)·
 *   · `clearanceScene` — Q5 edge clearance = cover + ημι-διαγώνιος της διατομής (από τις διαστάσεις).
 *
 * Εξήχθη από το `column-polar-opts.ts` (ήταν column-only) ώστε το πέδιλο να το μοιράζεται με τις δικές
 * του διαστάσεις (width×length) — μηδέν διπλότυπο. Ο `buildColumnPolarSnapOptions` delegate-άρει εδώ.
 *
 * Μη-pure (διαβάζει live stores) — γι' αυτό ζει χωριστά από τον pure `polar-disk-snap`.
 *
 * @see ../columns/polar-disk-snap.ts — ο pure resolver που καταναλώνει αυτά τα opts
 * @see ../columns/column-polar-opts.ts — column wrapper (delegate)
 */

import { worldPerPixel } from '../../rendering/utils/viewport-scale';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import { getColumnPolarState } from '../../systems/cursor/ColumnPolarStore';
import { polarClearanceScene, type PolarDiskSnapOptions } from '../columns/polar-disk-snap';
import type { SceneUnits } from '../../utils/scene-units';

/**
 * Χτίσε τα live `PolarDiskSnapOptions` από τις διαστάσεις διατομής (mm) + το τρέχον zoom. `widthMm`/
 * `depthMm` = οι δύο διαστάσεις ίχνους (κολώνα: width×depth· πέδιλο: width×length) — τροφοδοτούν τον
 * ημι-διαγώνιο edge clearance ώστε το μαγνητικό σημείο να μην ακουμπά πάνω σε στόχο.
 */
export function buildPlacementPolarSnapOptions(
  widthMm: number,
  depthMm: number,
  sceneUnits: SceneUnits,
): PolarDiskSnapOptions {
  return {
    worldPerPixel: worldPerPixel(getImmediateTransform().scale),
    shiftFractions: getColumnPolarState().shiftFractions,
    clearanceScene: polarClearanceScene(widthMm, depthMm, sceneUnits),
  };
}
