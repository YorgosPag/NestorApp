/**
 * apply-face-appearance — ADR-539 Φ2 SSoT. Εφαρμόζει (ή καθαρίζει) per-face appearance σε
 * ΜΙΑ όψη δομικού solid μέσω του undoable `SetFaceAppearanceCommand` + του level-scene
 * adapter (κοινό command history). ΕΝΑ wiring, κοινό για:
 *   - click-to-apply / custom-color του `PolygonMaterialPanel` (face = `selectedFace`),
 *   - HTML5 drop του `use-polygon-drag-drop` (face = raycast hit κάτω από τον κέρσορα).
 *
 * `value = FaceAppearance` → βάψε/ντύσε· `value = null` → καθάρισε το override της όψης.
 *
 * @see core/commands/entity-commands/SetFaceAppearanceCommand.ts
 * @see docs/centralized-systems/reference/adrs/ADR-539-cinema4d-polygon-mode-per-face-appearance.md
 */

import type { LevelsHookReturn } from '../../systems/levels/useLevels';
import { createLevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { getGlobalCommandHistory } from '../../core/commands';
import { SetFaceAppearanceCommand } from '../../core/commands/entity-commands/SetFaceAppearanceCommand';
import type { FaceAppearance } from '../../bim/types/face-appearance-types';

export function applyFaceAppearance(
  levels: LevelsHookReturn | null,
  bimId: string,
  faceKey: string,
  value: FaceAppearance | null,
): void {
  if (!levels?.currentLevelId) return;
  const adapter = createLevelSceneManagerAdapter(
    levels.getLevelScene, levels.setLevelScene, levels.currentLevelId,
  );
  getGlobalCommandHistory().execute(
    new SetFaceAppearanceCommand(bimId, faceKey, value, adapter),
  );
}
