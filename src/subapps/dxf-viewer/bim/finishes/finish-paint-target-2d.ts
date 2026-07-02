/**
 * ADR-449 PART B Slice C (2D) — «Βαφή σοβά» click → face target (pure SSoT).
 *
 * Η ΜΙΑ γέφυρα ανάμεσα σε ένα world click και τον κοινό writer: μαζεύει τα finish-active
 * στοιχεία (`collectFinishPickElements`), βρίσκει την πλησιέστερη όψη σοβά
 * (`pickFinishFaceAtPoint`) και επιστρέφει το `{bimId, faceKey}` που τρώει αυτούσιο ο
 * `applyFinishFaceOverrideToFaces` (ίδιο write path με το 3D — μηδέν δεύτερη ροή). `faceKey`
 * = `'side:' + edgeIndex` (footprint edge → `finishFaceRef`).
 *
 * Pure: μηδέν globals/React/apply — 100% testable. Ο caller (hook) κρατά το apply, ώστε το
 * `bim/finishes` να μην εξαρτάται από το `bim-3d` (καθαρή στρωμάτωση).
 *
 * @see ./finish-face-pick-2d — pickFinishFaceAtPoint (nearest-edge εντός band)
 * @see ./finish-pick-scene — collectFinishPickElements (scene → FinishPickElement[])
 * @see ../../hooks/canvas/useFinishPaintClick — ο caller (collect+pick εδώ, apply εκεί)
 */

import type { Pt2 } from '../geometry/shared/segment-polygon-coverage';
import { collectFinishPickElements } from './finish-pick-scene';
import { pickFinishFaceAtPoint } from './finish-face-pick-2d';

/** Ό,τι χρειάζεται ο κοινός writer: entity id + faceKey (`side:i`). Δομικά ίδιο με `SelectedFace3D`. */
export interface FinishPaintTarget {
  readonly bimId: string;
  readonly faceKey: string;
}

/**
 * Πλησιέστερη όψη σοβά στο `worldPoint` (canvas units) → `{bimId, faceKey}`, ή `null` όταν καμία
 * εντός band. `scale` = canvas units ανά mm (`mmToSceneUnits`)· `tolWorld` = click margin (canvas units).
 */
export function resolveFinishPaintTarget(
  worldPoint: Pt2,
  entities: Parameters<typeof collectFinishPickElements>[0],
  scale: number,
  tolWorld = 0,
): FinishPaintTarget | null {
  const pick = pickFinishFaceAtPoint(worldPoint, collectFinishPickElements(entities), scale, tolWorld);
  if (!pick) return null;
  return { bimId: pick.elementId, faceKey: `side:${pick.edgeIndex}` };
}
