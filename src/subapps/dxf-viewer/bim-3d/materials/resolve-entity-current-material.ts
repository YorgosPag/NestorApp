/**
 * resolve-entity-current-material — ADR-687 Φ8 (γενική βιβλιοθήκη υλικών, «τρέχον υλικό»).
 *
 * SSoT για την ερώτηση «ποιο materialId έχει ΤΩΡΑ αυτή η entity/όψη;» — καθαρή ανάγνωση του
 * `faceAppearance` (ADR-539 SSoT, `bim/types/face-appearance-types.ts`), ΧΩΡΙΣ React, ΧΩΡΙΣ
 * εξάρτηση σε entity-type (walls/structural solids/imported mesh — όλα περνούν από το ΙΔΙΟ
 * `faceAppearance` base field, βλ. `bim/types/bim-base.ts`).
 *
 * Δύο ερωτήσεις:
 *   - `resolveEntityCurrentMaterialId` — «βάψιμο ΟΛΟΥ του στοιχείου» (base `'*'`). Χρησιμοποιείται
 *     όταν η επιλογή είναι το ΣΤΟΙΧΕΙΟ (όχι μία όψη) — π.χ. swatch highlight στη γενική βιβλιοθήκη.
 *   - `resolveFaceCurrentMaterialId` — per-face override με fallback στο base (ο ίδιος cascade με
 *     `bim-3d/materials/face-appearance-material.ts::resolveFaceMaterial`, αλλά επιστρέφει
 *     `materialId` string αντί για κατασκευασμένο `Material` — δεν χρειάζεται THREE εδώ).
 *
 * @see bim/types/face-appearance-types.ts — BASE_FACE_KEY, FaceAppearanceMap, FaceKey, slotFaceKey()
 * @see bim-3d/materials/face-appearance-material.ts — ίδιο cascade, resolve σε THREE Material
 * @see app/ImportedMeshMaterialMapHost.tsx — τοπικό `currentMaterialId()` (ADR-686, μόνο base,
 *     imported-mesh-scoped) — υποψήφιο Boy-Scout dedup προς αυτό εδώ, ΟΧΙ τώρα (βλ. σημείωση PR).
 * @see docs/centralized-systems/reference/adrs/ADR-687-material-editor.md
 */

import { BASE_FACE_KEY, type FaceAppearanceMap } from '../../bim/types/face-appearance-types';

/** Οτιδήποτε μπορεί να φέρει `faceAppearance` (κάθε BIM entity, βλ. `bim/types/bim-base.ts`). */
interface EntityWithFaceAppearance {
  readonly faceAppearance?: FaceAppearanceMap;
}

/**
 * Το τρέχον override υλικού **ΟΛΟΥ** του στοιχείου (base `'*'` slot) — `null` αν δεν υπάρχει
 * override (auto/embedded/default look). Γενικό: δουλεύει για ΚΑΘΕ entity type, όχι μόνο
 * imported mesh.
 */
export function resolveEntityCurrentMaterialId(entity: EntityWithFaceAppearance): string | null {
  return entity.faceAppearance?.[BASE_FACE_KEY]?.materialId ?? null;
}

/**
 * Το τρέχον override υλικού μιας **συγκεκριμένης όψης** (`faceKey`): per-face override αν
 * υπάρχει, αλλιώς fallback στο base `'*'`, αλλιώς `null`. Ίδιος cascade με
 * `resolveFaceMaterial` (Revit «Paint» + type material / Cinema 4D material tags).
 */
export function resolveFaceCurrentMaterialId(
  entity: EntityWithFaceAppearance,
  faceKey: string,
): string | null {
  const appearance = entity.faceAppearance;
  if (!appearance) return null;
  return appearance[faceKey]?.materialId ?? appearance[BASE_FACE_KEY]?.materialId ?? null;
}
