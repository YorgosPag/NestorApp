/**
 * current-level-adapter — SSoT helper: `LevelsHookReturn` → `ISceneManager` adapter για το ΤΡΕΧΟΝ
 * επίπεδο (κοινό command history), ή `null` όταν δεν υπάρχει ενεργό επίπεδο. Κοινό από ΟΛΟΥΣ τους
 * «apply» writers του 3D material panel (per-face σώμα ADR-539, σοβάς ADR-449, stair sub-element
 * ADR-539 Φ7) — ΕΝΑ σημείο ορισμού, μηδέν διπλότυπο (N.18· πριν ήταν inline `levelAdapter` ×3).
 *
 * @see ./apply-face-appearance.ts · ./apply-finish-face-override.ts · ./apply-stair-sub-element-appearance.ts
 */

import type { LevelsHookReturn } from '../../systems/levels/useLevels';
import { createLevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import type { ISceneManager } from '../../core/commands/interfaces';

export function currentLevelAdapter(levels: LevelsHookReturn | null): ISceneManager | null {
  if (!levels?.currentLevelId) return null;
  return createLevelSceneManagerAdapter(
    levels.getLevelScene, levels.setLevelScene, levels.currentLevelId,
  );
}
