/**
 * face-appearance-material — ADR-539 / ADR-679 Φ2b. Επιλύει το THREE material μιας όψης
 * από το per-face appearance override. Thin delegate προς το `MaterialCatalog3D` (ΕΝΑ SSoT
 * για ΚΑΘΕ 3D υλικό): μηδέν κατασκευή textured material εδώ, μηδέν δεύτερο texture cache (N.18).
 *
 * Cascade (Revit/Cinema 4D base+override): `appearance[faceKey]` → αλλιώς το base
 * `appearance['*']` («βάψε όλο») → αλλιώς το `baseMaterial` (κοινό instance, μηδέν regression).
 *
 * Ανάλυση override (ADR-679 Φ2b — «η καρδιά», textured per-face):
 *   1. Αν το υλικό της όψης έχει ΠΡΑΓΜΑΤΙΚΗ υφή (library `bmat_*` + albedo + realistic ON) →
 *      το textured PBR υλικό μέσω `getFaceMaterial3D` → `getMaterial3D` (υφή, cached, preload→
 *      resync δωρεάν). Πριν το Φ2b αυτό ισοπεδωνόταν σε flat χρώμα — ΑΥΤΟ ήταν το κενό.
 *   2. Αλλιώς → ΑΜΕΤΑΒΛΗΤΟ legacy flat χρώμα μέσω `faceAppearanceColorHex` (το ΙΔΙΟ SSoT με το
 *      2D plan fill): `colorHex` κερδίζει· αλλιώς `materialId` → χρώμα καταλόγου (wall-covering/
 *      floor-finish, flat). Καμία πηγή χρώματος → `baseMaterial`. Μηδέν παλινδρόμηση για flat ids.
 *
 * @see bim-3d/materials/MaterialCatalog3D — getFaceMaterial3D / getFaceColorMaterial3D (SSoT)
 * @see bim/utils/face-appearance-color — faceAppearanceColorHex (κοινό με 2D plan fill)
 * @see bim-3d/converters/bim-three-faced-prism.ts — faceKey ↔ materialIndex (+ Φ2b UVs)
 * @see docs/centralized-systems/reference/adrs/ADR-539-cinema4d-polygon-mode-per-face-appearance.md
 */

import type { Material } from 'three';
import type { FaceAppearanceMap } from '../../bim/types/face-appearance-types';
import { BASE_FACE_KEY } from '../../bim/types/face-appearance-types';
import { faceAppearanceColorHex } from '../../bim/utils/face-appearance-color';
import { getFaceMaterial3D, getFaceColorMaterial3D } from './MaterialCatalog3D';

/**
 * Material για ΜΙΑ όψη. Καθαρή, re-entrant επίλυση (καλείται fresh σε κάθε `resyncBimScene`):
 * επιστρέφει cached singletons — ο caller ΠΟΤΕ δεν κάνει dispose ό,τι επιστρέφει εδώ (το leak
 * του παλιού fresh-per-face path εξαλείφεται). Ο `baseMaterial` (αβαφής όψη) παραμένει ο κοινός
 * base του solid.
 */
export function resolveFaceMaterial(
  faceKey: string,
  appearance: FaceAppearanceMap,
  baseMaterial: Material,
): Material {
  const face = appearance[faceKey] ?? appearance[BASE_FACE_KEY];
  if (!face) return baseMaterial;
  // 1. Textured PBR — μόνο όταν το υλικό όψης έχει όντως υφή (Φ2b).
  if (face.materialId) {
    const textured = getFaceMaterial3D(face.materialId);
    if (textured) return textured;
  }
  // 2. Legacy flat χρώμα (ΑΜΕΤΑΒΛΗΤΟ): colorHex ή materialId→catalog color.
  const hex = faceAppearanceColorHex(face);
  return hex ? getFaceColorMaterial3D(hex) : baseMaterial;
}
