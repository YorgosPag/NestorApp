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
import { currentLevelAdapter } from './current-level-adapter';
import { getGlobalCommandHistory } from '../../core/commands';
import { CompositeCommand } from '../../core/commands/CompositeCommand';
import { SetFinishFaceOverrideCommand } from '../../core/commands/entity-commands/SetFinishFaceOverrideCommand';
import type { FinishFaceOverride } from '../../bim/finishes/structural-finish-types';
import type { FaceAppearance } from '../../bim/types/face-appearance-types';
import {
  wholeElementFinishFaceKeys,
  type FinishPaintableEntity,
} from '../../bim/finishes/finish-face-override-ops';

/**
 * ADR-449 Slice C — `FaceAppearance` (panel/drag swatch) → `FinishFaceOverride` (σοβάς). `colorHex`
 * του panel = `colorOverride` του σοβά· `materialId` περνά αυτούσιο. `null` → clear. SSoT κοινό για
 * το panel (swatch click) ΚΑΙ το drag-drop (ώστε το ΣΟΒΑΣ drop να μεταφράζεται ίδια).
 */
export function faceAppearanceToFinishOverride(value: FaceAppearance | null): FinishFaceOverride | null {
  if (!value) return null;
  return value.colorHex ? { colorOverride: value.colorHex } : { materialId: value.materialId };
}

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

/**
 * ADR-539 (Giorgio 2026-07-22) — «ΣΟΒΑΣ» entity-level: βάφει τον σοβά σε ΟΛΕΣ τις κάθετες όψεις
 * του στοιχείου με ΕΝΑ atomic undo (mirror του `applyEntityFaceAppearanceMap` του σώματος). Το
 * drag-drop/swatch χωρίς per-face επιλογή (modes ΣΩΜΑ/ΣΟΒΑΣ) διαβάζει το stored footprint του
 * entity → `side:0..n-1` → delegate στο `applyFinishFaceOverrideToFaces`. No-op όταν λείπει
 * ενεργό επίπεδο, το entity δεν βρέθηκε, ή το footprint είναι εκφυλισμένο (<3 κορυφές).
 */
export function applyFinishToWholeElement(
  levels: LevelsHookReturn | null,
  bimId: string,
  value: FinishFaceOverride | null,
): void {
  const adapter = levelAdapter(levels);
  if (!adapter) return;
  const entity = adapter.getEntity(bimId) as unknown as FinishPaintableEntity | undefined;
  if (!entity) return;
  const faces = wholeElementFinishFaceKeys(entity).map((faceKey) => ({ bimId, faceKey }));
  applyFinishFaceOverrideToFaces(levels, faces, value);
}
