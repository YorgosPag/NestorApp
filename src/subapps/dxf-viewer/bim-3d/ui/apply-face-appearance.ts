/**
 * apply-face-appearance — ADR-539 Φ2/Φ4b SSoT. Εφαρμόζει (ή καθαρίζει) per-face appearance σε
 * ΜΙΑ ή ΠΟΛΛΕΣ όψεις δομικών solids μέσω undoable `SetFaceAppearanceCommand` + του level-scene
 * adapter (κοινό command history). ΕΝΑ wiring, κοινό για:
 *   - click-to-apply / custom-color / clear του `PolygonMaterialPanel` (faces = `selectedFaces`),
 *   - Φ4a keyboard paste/clear (faces = `selectedFaces`),
 *   - HTML5 drop του `use-polygon-drag-drop` (face = raycast hit κάτω από τον κέρσορα).
 *
 * `value = FaceAppearance` → βάψε/ντύσε· `value = null` → καθάρισε το override της όψης.
 *
 * Φ4b — batch = ΕΝΑ undo: N όψεις (ακόμη και cross-entity) τυλίγονται σε `CompositeCommand`,
 * άρα ένα Ctrl+Z αναιρεί ΟΛΕΣ τις βαφές μαζί (Cinema 4D / Revit «paint on multiple faces»).
 * Τα children έχουν lazy snapshot στο πρώτο `execute()` και τρέχουν σειριακά μέσα στο composite
 * → same-entity multi-face αναιρείται σωστά σε reverse order (nested transaction unwind).
 *
 * @see core/commands/entity-commands/SetFaceAppearanceCommand.ts — per-face child
 * @see core/commands/CompositeCommand.ts — atomic undo group (ΕΝΑ undo)
 * @see docs/centralized-systems/reference/adrs/ADR-539-cinema4d-polygon-mode-per-face-appearance.md
 */

import type { LevelsHookReturn } from '../../systems/levels/useLevels';
import type { SelectedFace3D } from '../stores/PolygonMode3DStore';
import { createLevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { getGlobalCommandHistory } from '../../core/commands';
import { CompositeCommand } from '../../core/commands/CompositeCommand';
import { SetFaceAppearanceCommand } from '../../core/commands/entity-commands/SetFaceAppearanceCommand';
import type { ISceneManager } from '../../core/commands/interfaces';
import type { FaceAppearance } from '../../bim/types/face-appearance-types';

/** Κοινό level-scene adapter (current level), ή null όταν δεν υπάρχει ενεργό επίπεδο. */
function levelAdapter(levels: LevelsHookReturn | null): ISceneManager | null {
  if (!levels?.currentLevelId) return null;
  return createLevelSceneManagerAdapter(
    levels.getLevelScene, levels.setLevelScene, levels.currentLevelId,
  );
}

export function applyFaceAppearance(
  levels: LevelsHookReturn | null,
  bimId: string,
  faceKey: string,
  value: FaceAppearance | null,
): void {
  const adapter = levelAdapter(levels);
  if (!adapter) return;
  getGlobalCommandHistory().execute(
    new SetFaceAppearanceCommand(bimId, faceKey, value, adapter),
  );
}

/**
 * Φ4b — εφαρμόζει την ίδια `value` σε ΟΛΕΣ τις όψεις με ΕΝΑ atomic undo step. Cross-entity OK
 * (per-child `getAffectedEntityIds`). 0 όψεις → no-op· 1 όψη → απλό command (μηδέν composite
 * overhead, ίδια συμπεριφορά με `applyFaceAppearance`)· N → `CompositeCommand`.
 */
export function applyFaceAppearanceToFaces(
  levels: LevelsHookReturn | null,
  faces: readonly SelectedFace3D[],
  value: FaceAppearance | null,
): void {
  const adapter = levelAdapter(levels);
  if (!adapter || faces.length === 0) return;
  const children = faces.map(
    (f) => new SetFaceAppearanceCommand(f.bimId, f.faceKey, value, adapter),
  );
  getGlobalCommandHistory().execute(
    children.length === 1 ? children[0] : new CompositeCommand(children),
  );
}
