/**
 * apply-entity-face-appearance-map — ADR-539 Φ4a SSoT. Εφαρμόζει ΟΛΟΚΛΗΡΟ map per-face
 * εμφάνισης σε μία entity (entity-level paste) μέσω του undoable
 * `SetEntityFaceAppearanceMapCommand` + του level-scene adapter (κοινό command history).
 * Αδελφό του per-face `applyFaceAppearance` — ΕΝΑ undo step για «επικόλληση εμφάνισης entity».
 *
 * @see ./apply-face-appearance.ts — per-face αδελφό
 * @see core/commands/entity-commands/SetEntityFaceAppearanceMapCommand.ts
 * @see docs/centralized-systems/reference/adrs/ADR-539-cinema4d-polygon-mode-per-face-appearance.md
 */

import type { LevelsHookReturn } from '../../systems/levels/useLevels';
import { createLevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { getGlobalCommandHistory } from '../../core/commands';
import { SetEntityFaceAppearanceMapCommand } from '../../core/commands/entity-commands/SetEntityFaceAppearanceMapCommand';
import type { FaceAppearanceMap } from '../../bim/types/face-appearance-types';

export function applyEntityFaceAppearanceMap(
  levels: LevelsHookReturn | null,
  bimId: string,
  value: FaceAppearanceMap,
): void {
  if (!levels?.currentLevelId) return;
  const adapter = createLevelSceneManagerAdapter(
    levels.getLevelScene, levels.setLevelScene, levels.currentLevelId,
  );
  getGlobalCommandHistory().execute(
    new SetEntityFaceAppearanceMapCommand(bimId, value, adapter),
  );
}
