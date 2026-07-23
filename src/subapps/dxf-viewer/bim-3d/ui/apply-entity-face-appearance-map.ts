/**
 * apply-entity-face-appearance-map — ADR-539 Φ4a SSoT. Εφαρμόζει ΟΛΟΚΛΗΡΟ map per-face
 * εμφάνισης σε μία entity (entity-level paste) μέσω του undoable
 * `SetEntityFaceAppearanceMapCommand` + του level-scene adapter (κοινό command history).
 * Αδελφό του per-face `applyFaceAppearance` — ΕΝΑ undo step για «επικόλληση εμφάνισης entity».
 *
 * Φ7 — `applyWholeElementBodyAppearance`: stair-aware «βάψε ΟΛΟ το σώμα» (mode ΣΩΜΑ). Τα δομικά
 * solids διαβάζουν `FaceAppearance['*']` (base)· η ΠΑΡΑΜΕΤΡΙΚΗ σκάλα ΟΧΙ (render από `params`),
 * οπότε δρομολογείται στον `applyStairWholeAppearance` (γράφει `params.materials.appearance`).
 *
 * @see ./apply-face-appearance.ts — per-face αδελφό
 * @see ./apply-stair-sub-element-appearance.ts — stair whole/sub writers
 * @see core/commands/entity-commands/SetEntityFaceAppearanceMapCommand.ts
 * @see docs/centralized-systems/reference/adrs/ADR-539-cinema4d-polygon-mode-per-face-appearance.md
 */

import type { LevelsHookReturn } from '../../systems/levels/useLevels';
import { currentLevelAdapter } from './current-level-adapter';
import { getGlobalCommandHistory } from '../../core/commands';
import { SetEntityFaceAppearanceMapCommand } from '../../core/commands/entity-commands/SetEntityFaceAppearanceMapCommand';
import { entireElementFaceMap, type FaceAppearance, type FaceAppearanceMap } from '../../bim/types/face-appearance-types';
import { applyStairWholeAppearance } from './apply-stair-sub-element-appearance';
import { applyRailingWholeAppearance } from './apply-railing-appearance';

export function applyEntityFaceAppearanceMap(
  levels: LevelsHookReturn | null,
  bimId: string,
  value: FaceAppearanceMap,
): void {
  const adapter = currentLevelAdapter(levels);
  if (!adapter) return;
  getGlobalCommandHistory().execute(
    new SetEntityFaceAppearanceMapCommand(bimId, value, adapter),
  );
}

/**
 * ADR-539 Φ7 / ADR-407 Φ8 — «βάψε ΟΛΟ το στοιχείο» (mode ΣΩΜΑ), ένα call-site για panel + drag-drop.
 * Επιλύει τον τύπο του entity και δρομολογεί: **σκάλα** → `applyStairWholeAppearance`
 * (params.materials.appearance)· **κάγκελο** → `applyRailingWholeAppearance` (params.appearance) —
 * και τα δύο render-άρονται ΑΠΟ params, όχι `FaceAppearance` base· **οτιδήποτε άλλο** (solid) →
 * `entireElementFaceMap` base `'*'` (αμετάβλητη συμπεριφορά). `value=null` → clear. No-op όταν λείπει
 * επίπεδο/entity.
 */
export function applyWholeElementBodyAppearance(
  levels: LevelsHookReturn | null,
  bimId: string,
  value: FaceAppearance | null,
): void {
  const adapter = currentLevelAdapter(levels);
  if (!adapter) return;
  const entity = adapter.getEntity(bimId);
  if (entity?.type === 'stair') {
    applyStairWholeAppearance(levels, bimId, value);
    return;
  }
  if (entity?.type === 'railing') {
    applyRailingWholeAppearance(levels, bimId, value);
    return;
  }
  applyEntityFaceAppearanceMap(levels, bimId, entireElementFaceMap(value));
}
