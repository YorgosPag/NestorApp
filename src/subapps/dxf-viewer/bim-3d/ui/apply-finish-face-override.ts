/**
 * apply-finish-face-override — ADR-449 PART B Slice C SSoT. Εφαρμόζει (ή καθαρίζει) per-face
 * **σοβά** override σε ΜΙΑ ή ΠΟΛΛΕΣ όψεις μέσω undoable `SetFinishFaceOverrideCommand` + του
 * level-scene adapter (κοινό command history). Αδελφό του `apply-face-appearance.ts` (ADR-539,
 * σώμα)· εδώ ο στόχος είναι το **δέρμα** (σοβάς), keyed by `finishFaceRef`.
 *
 * `value = FinishFaceOverride` → βάψε/ντύσε· `value = null` → καθάρισε το override της όψης.
 * N όψεις (ακόμη και cross-entity) → `CompositeCommand` = ΕΝΑ undo (Cinema 4D «paint multiple»).
 *
 * @see ./apply-face-appearance.ts — αδελφό (σώμα)
 * @see core/commands/entity-commands/SetFinishFaceOverrideCommand.ts — per-face child
 * @see docs/centralized-systems/reference/adrs/ADR-449-structural-finish-skin.md §PART B
 */

import type { LevelsHookReturn } from '../../systems/levels/useLevels';
import type { SelectedFace3D } from '../stores/PolygonMode3DStore';
import { createLevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { getGlobalCommandHistory } from '../../core/commands';
import { CompositeCommand } from '../../core/commands/CompositeCommand';
import { SetFinishFaceOverrideCommand } from '../../core/commands/entity-commands/SetFinishFaceOverrideCommand';
import type { ISceneManager } from '../../core/commands/interfaces';
import type { FinishFaceOverride } from '../../bim/finishes/structural-finish-types';

/** Κοινό level-scene adapter (current level), ή null όταν δεν υπάρχει ενεργό επίπεδο. */
function levelAdapter(levels: LevelsHookReturn | null): ISceneManager | null {
  if (!levels?.currentLevelId) return null;
  return createLevelSceneManagerAdapter(
    levels.getLevelScene, levels.setLevelScene, levels.currentLevelId,
  );
}

/**
 * Εφαρμόζει την ίδια `value` σε ΟΛΕΣ τις όψεις με ΕΝΑ atomic undo step. Cross-entity OK
 * (per-child `getAffectedEntityIds`). 0 όψεις → no-op· 1 όψη → απλό command· N → `CompositeCommand`.
 */
export function applyFinishFaceOverrideToFaces(
  levels: LevelsHookReturn | null,
  faces: readonly SelectedFace3D[],
  value: FinishFaceOverride | null,
): void {
  const adapter = levelAdapter(levels);
  if (!adapter || faces.length === 0) return;
  const children = faces.map(
    (f) => new SetFinishFaceOverrideCommand(f.bimId, f.faceKey, value, adapter),
  );
  getGlobalCommandHistory().execute(
    children.length === 1 ? children[0] : new CompositeCommand(children),
  );
}
