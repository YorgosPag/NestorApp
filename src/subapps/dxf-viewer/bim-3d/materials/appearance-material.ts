/**
 * appearance-material — ADR-539 SSoT. `FaceAppearance` → THREE material, ΤΟ ΙΔΙΟ path με το
 * per-face solid resolve (`resolveFaceMaterial`): textured PBR όταν το `materialId` έχει όντως
 * υφή, αλλιώς flat χρώμα (`colorHex` ή `materialId`→catalog color). `null` όταν το appearance
 * δεν δίνει καμία πηγή χρώματος (→ ο caller πέφτει στο δικό του default).
 *
 * Γενικό (entity-agnostic): εξήχθη από τον `stair-material-resolver` (ADR-539 Φ7) ώστε το ΙΔΙΟ
 * appearance→material βήμα να το μοιράζονται σκάλα (`resolveStairMaterial`) ΚΑΙ κάγκελο
 * (`resolveRailingMaterial`, ADR-407 Φ8) — μηδέν δεύτερη υλοποίηση (N.18). Cinema 4D material
 * tag / Revit «Paint» parity: το ίδιο swatch/χρώμα/υφή που βάφει τοίχο/σκαλί βάφει και κάγκελο.
 *
 * @see bim-3d/materials/stair-material-resolver.ts — re-exports ως `resolveStairAppearanceMaterial`
 * @see bim-3d/materials/railing-material-resolver.ts — railing per-component cascade
 * @see docs/centralized-systems/reference/adrs/ADR-539-cinema4d-polygon-mode-per-face-appearance.md
 */

import type * as THREE from 'three';
import type { FaceAppearance } from '../../bim/types/face-appearance-types';
import { getFaceMaterial3D, getFaceColorMaterial3D } from './MaterialCatalog3D';
import { faceAppearanceColorHex } from '../../bim/utils/face-appearance-color';

/**
 * `FaceAppearance` → THREE material (textured PBR ή flat χρώμα), ή `null` όταν το appearance δεν
 * ορίζει καμία πηγή χρώματος. `materialId` με πραγματική υφή κερδίζει· αλλιώς `colorHex`/catalog color.
 */
export function resolveAppearanceMaterial(
  appearance: FaceAppearance | undefined,
): THREE.MeshStandardMaterial | null {
  if (!appearance) return null;
  if (appearance.materialId) {
    const textured = getFaceMaterial3D(appearance.materialId);
    if (textured) return textured;
  }
  const hex = faceAppearanceColorHex(appearance);
  return hex ? getFaceColorMaterial3D(hex) : null;
}
