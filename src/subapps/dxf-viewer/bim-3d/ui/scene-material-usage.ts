/**
 * scene-material-usage — ADR-687 Φ8 SSoT. Απαριθμεί τα υλικά που ΠΕΡΙΕΧΕΙ Η ΣΚΗΝΗ (ρητά βαμμένα),
 * ώστε η κάτω μπάρα «Υλικά όψης» (Ν.2) να δείχνει μόνο αυτά — Cinema 4D *Material Manager* (document
 * materials) / Revit *Project Materials* (in-use), σε αντίθεση με τη γενική βιβλιοθήκη (Ν.1).
 *
 * Πηγή = `SceneStore.getRecord()` (όλα τα επίπεδα). Ρητοί extractors ανά τύπο (ΟΧΙ blind deep-scan —
 * enterprise: γνωρίζουμε πού ζει κάθε appearance):
 *   - δομικά solids → `entity.faceAppearance` (base `'*'` + per-face, ADR-539)
 *   - σκάλα → `params.materials.appearance` (whole) + perTread/Riser/Landing/Waist overrides (Φ7)
 *   - κάγκελο → `params.appearance` (whole) + `params.componentAppearance` (post/baluster/rail, ADR-407 Φ8)
 * Κάθε τιμή είναι `FaceAppearance {materialId?, colorHex?}` — dedup σε δύο σύνολα.
 *
 * Pure module — no React, no three.js. Διαβάζει ΜΟΝΟ types (κανένας resolver → δεν αγγίζει τα foreign
 * `stair-material-resolver`/`railing-material-resolver`).
 *
 * @see ./useSceneMaterials.ts — reactive hook (version-gated) που φιλτράρει τον library index με αυτά
 * @see ../../bim/types/face-appearance-types.ts — FaceAppearance
 */

import type { SceneModel } from '../../types/scene';
import { type Entity, isStairEntity, isRailingEntity } from '../../types/entities';
import type { FaceAppearance, FaceAppearanceMap } from '../../bim/types/face-appearance-types';

/** Τα distinct appearance refs που περιέχει η σκηνή. */
export interface SceneAppearanceRefs {
  readonly materialIds: ReadonlySet<string>;
  readonly colorHexes: ReadonlySet<string>;
}

/** Σταθερό άδειο αποτέλεσμα (stable ref για version-gated snapshot). */
export const EMPTY_SCENE_REFS: SceneAppearanceRefs = {
  materialIds: new Set<string>(),
  colorHexes: new Set<string>(),
};

/** Reads the optional per-face appearance map off any entity (BimEntity base carries it). */
function faceAppearanceOf(entity: Entity): FaceAppearanceMap | undefined {
  return 'faceAppearance' in entity
    ? (entity as { readonly faceAppearance?: FaceAppearanceMap }).faceAppearance
    : undefined;
}

function collect(
  appearance: FaceAppearance | undefined,
  materialIds: Set<string>,
  colorHexes: Set<string>,
): void {
  if (!appearance) return;
  if (appearance.materialId) materialIds.add(appearance.materialId);
  if (appearance.colorHex) colorHexes.add(appearance.colorHex);
}

/**
 * ADR-687 Φ8 — walk όλα τα entities όλων των επιπέδων → distinct materialIds + colorHexes που
 * είναι ΡΗΤΑ βαμμένα (appearance overrides). Δεν περιλαμβάνει implicit category defaults (Giorgio
 * 2026-07-24): μόνο ό,τι ο χρήστης έβαψε ρητά, όπως το C4D Material Manager.
 */
export function collectSceneAppearanceRefs(
  record: Readonly<Record<string, SceneModel | null>>,
): SceneAppearanceRefs {
  const materialIds = new Set<string>();
  const colorHexes = new Set<string>();

  for (const scene of Object.values(record)) {
    if (!scene) continue;
    for (const entity of scene.entities as readonly Entity[]) {
      // Δομικά solids — per-face + base map.
      const faces = faceAppearanceOf(entity);
      if (faces) {
        for (const appearance of Object.values(faces)) collect(appearance, materialIds, colorHexes);
      }
      // Σκάλα — render από params (whole + per-sub-element overrides).
      if (isStairEntity(entity)) {
        const p = entity.params;
        collect(p.materials?.appearance, materialIds, colorHexes);
        for (const o of Object.values(p.perTreadOverrides ?? {})) collect(o.appearance, materialIds, colorHexes);
        for (const o of Object.values(p.perRiserOverrides ?? {})) collect(o.appearance, materialIds, colorHexes);
        for (const o of Object.values(p.perLandingOverrides ?? {})) collect(o.appearance, materialIds, colorHexes);
        for (const o of Object.values(p.perWaistOverrides ?? {})) collect(o.appearance, materialIds, colorHexes);
        continue;
      }
      // Κάγκελο — render από params (whole + per-component overrides).
      if (isRailingEntity(entity)) {
        const p = entity.params;
        collect(p.appearance, materialIds, colorHexes);
        collect(p.componentAppearance?.post, materialIds, colorHexes);
        collect(p.componentAppearance?.baluster, materialIds, colorHexes);
        collect(p.componentAppearance?.rail, materialIds, colorHexes);
      }
    }
  }

  return { materialIds, colorHexes };
}
