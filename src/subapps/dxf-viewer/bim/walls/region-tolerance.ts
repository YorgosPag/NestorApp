/**
 * ADR-419 — Region/perimeter loop-detection tolerance SSoT (Layer 2).
 *
 * Boy-scout (N.0.2): κεντρικοποιεί το διπλό `regionTol` callback που υπήρχε ΚΑΙ
 * στο `use-column-perimeter-commit.ts` ΚΑΙ στο `use-wall-region-clicks.ts`
 * (`SNAP_DEFAULT / transform.scale`), και προσθέτει το **gap-closure floor**:
 * μικρά κενά στις παρειές που σχεδιάστηκαν χωρίς snap κλείνουν αυτόματα (Revit
 * auto-trim/extend), ανεξάρτητα από το zoom.
 *
 * Η ανοχή εκφράζεται σε **world/scene units** = max(pixel-based, mm-based floor):
 *   - pixel-based: `SNAP_DEFAULT / scale` (όπως πριν — κλιμακώνεται με το zoom).
 *   - mm-based floor: `REGION_PERIMETER_LIMITS.LOOP_JOIN_TOLERANCE_MM × mmToScene`
 *     (φυσική απόσταση στο σχέδιο, ανεξάρτητη zoom· mirror PIPE_JOIN_TOLERANCE_MM).
 *
 * @see ./perimeter-from-faces.ts (consumer — closed-loop detection)
 * @see ../../config/tolerance-config.ts (REGION_PERIMETER_LIMITS SSoT)
 */

import { TOLERANCE_CONFIG, REGION_PERIMETER_LIMITS } from '../../config/tolerance-config';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';

/**
 * Ανοχή ένωσης άκρων / hit-test για region/perimeter detection (world units).
 * Live: διαβάζει το τρέχον transform.scale στο event time (ίδιος κανόνας με πριν).
 */
export function resolveRegionLoopTolWorld(sceneUnits: SceneUnits): number {
  const pixelTol = TOLERANCE_CONFIG.SNAP_DEFAULT / getImmediateTransform().scale;
  const gapFloor = REGION_PERIMETER_LIMITS.LOOP_JOIN_TOLERANCE_MM * mmToSceneUnits(sceneUnits);
  return Math.max(pixelTol, gapFloor);
}
