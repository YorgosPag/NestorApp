/**
 * mutate-level-scene — SSoT για την in-place μετάλλαξη των entities της σκηνής
 * ΕΝΟΣ level (get → replace entities → set με origin).
 *
 * Το μοιράζονται οι **cross-level derived writers** που γράφουν entity στη σκηνή
 * **άλλου** ορόφου ενώ ο ενεργός είναι διαφορετικός: `foundation-cross-level-writer`
 * (πέδιλα, ADR-459) + `stairwell-opening-cross-level-writer` (auto «well» openings,
 * ADR-632). Πριν το SSoT κάθε writer είχε τον δικό του verbatim-ίδιο `mutate*Scene`
 * helper (N.0.2/N.18 dedup).
 *
 * Origin `'system-reconcile'`: derived write — η αυθεντική persistence γίνεται
 * αλλού (model collection). Δεν πρέπει να πυροδοτεί το γενικό DXF-scene autosave
 * του ορόφου-στόχου (ADR-461/293 θόρυβος σε special/file-less levels). Η σκηνή
 * ενημερώνεται μόνο για live εμφάνιση· όταν λείπει (μη φορτωμένος όροφος) → no-op
 * (η Firestore subscription συγχρονίζει μόλις ο χρήστης πάει εκεί).
 *
 * @see ../../bim/foundations/foundation-cross-level-writer.ts
 * @see ../../bim/stairs/stairwell-opening-cross-level-writer.ts
 */

import type { AnySceneEntity, SceneModel } from '../../types/scene';
import type { SceneWriteOrigin } from '../../hooks/scene/scene-write-origin';

/** Ελάχιστο read+write scene surface (subset του `LevelSceneWriter`). */
export interface LevelSceneEntitiesIO {
  getLevelScene(levelId: string): SceneModel | null;
  setLevelScene(levelId: string, scene: SceneModel, origin?: SceneWriteOrigin): void;
}

/**
 * Μεταλλάσσει τα entities της σκηνής του `levelId` μέσω της `mutate` και τη γράφει
 * πίσω με το δοθέν `origin`. No-op αν η σκηνή δεν είναι φορτωμένη.
 */
export function mutateLevelSceneEntities(
  io: LevelSceneEntitiesIO,
  levelId: string,
  mutate: (entities: readonly AnySceneEntity[]) => AnySceneEntity[],
  origin?: SceneWriteOrigin,
): void {
  const scene = io.getLevelScene(levelId);
  if (!scene) return;
  io.setLevelScene(levelId, { ...scene, entities: mutate(scene.entities) }, origin);
}
