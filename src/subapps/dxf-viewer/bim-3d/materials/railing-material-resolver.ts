/**
 * railing-material-resolver — ADR-407 Φ8. Revit-pattern per-component material resolution για 3D
 * κιγκλιδώματα. Αντικαθιστά τα hardcoded `getElementMaterial3D('railing')` του `railing-to-three`.
 *
 * Resolution cascade (πιο ειδικό κερδίζει — mirror του `resolveStairMaterial`):
 *   1. per-component appearance (`params.componentAppearance[component]`) — Revit railing-type
 *      ξεχωριστό υλικό ανά κουπαστή/κάγκελα/κολόνες (ADR-407 Φ8).
 *   2. whole-railing «base» appearance (`params.appearance`) — Cinema 4D object material tag /
 *      Revit type material· βάφει ΟΛΟ το κάγκελο (κάθε component χωρίς δικό του override).
 *   3. element-type default (`elem-railing` via MaterialCatalog3D).
 *
 * Το βήμα appearance→THREE (textured PBR ή flat χρώμα) το κάνει το κοινό `resolveAppearanceMaterial`
 * SSoT (ίδιο με σκάλα/solids, N.18) — μηδέν δεύτερη υλοποίηση.
 *
 * @see bim-3d/materials/appearance-material.ts — appearance→material SSoT (κοινό με σκάλα)
 * @see bim-3d/converters/railing-to-three.ts — ο μόνος caller (balusters/posts/rails)
 * @see docs/centralized-systems/reference/adrs/ADR-407-bim-railings.md
 */

import type * as THREE from 'three';
import type { RailingEntity, RailingComponent } from '../../bim/types/railing-types';
import { getElementMaterial3D } from './MaterialCatalog3D';
import { resolveAppearanceMaterial } from './appearance-material';

/**
 * THREE material για ένα component κιγκλιδώματος (`'post'|'baluster'|'rail'`), βάσει της cascade
 * component → whole → element default. Πάντα επιστρέφει material (ποτέ null): το βήμα 3 εγγυάται
 * fallback στο `elem-railing`.
 */
export function resolveRailingMaterial(
  railing: RailingEntity,
  component: RailingComponent,
): THREE.MeshStandardMaterial {
  const { params } = railing;
  // 1. per-component override (Revit railing-type material ανά component).
  const componentMat = resolveAppearanceMaterial(params.componentAppearance?.[component]);
  if (componentMat) return componentMat;
  // 2. whole-railing base appearance (Cinema 4D object tag / Revit type material).
  const wholeMat = resolveAppearanceMaterial(params.appearance);
  if (wholeMat) return wholeMat;
  // 3. element-type default.
  return getElementMaterial3D('railing');
}
