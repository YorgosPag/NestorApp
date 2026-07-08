/**
 * Shared primitives for per-entity ribbon bridges (de-dup, ADR-583/597).
 *
 * Every per-entity bridge (`beam` / `mep-boiler` / `wall-covering` / …) exposes the
 * SAME ribbon command surface and resolves its primary-selected entity with the SAME
 * scene lookup. Those two blocks were copy-pasted across the bridges; this module owns
 * them once. Each bridge keeps only its genuinely per-type wiring (dispatchers, catalog
 * branches, per-type command keys).
 */
import { useCallback } from 'react';

import type { Entity } from '../../../types/entities';
import type { LevelSceneWriter } from '../../../systems/levels/level-scene-accessor';
import type { useUniversalSelection } from '../../../systems/selection';
import type {
  RibbonComboboxState,
  RibbonToggleState,
} from '../context/RibbonCommandContext';

/** The ribbon command surface shared by every per-entity bridge. */
export interface RibbonEntityBridgeCore {
  readonly onComboboxChange: (commandKey: string, value: string) => void;
  readonly getComboboxState: (commandKey: string) => RibbonComboboxState | null;
  readonly onToggle: (commandKey: string, nextValue: boolean) => void;
  readonly getToggleState: (commandKey: string) => RibbonToggleState;
  readonly onAction: (action: string) => void;
  /**
   * Panel visibility resolver. `true` when the panel must show; keys outside the
   * entity's visibility set → `true` (no-op).
   */
  readonly getPanelVisibility: (visibilityKey: string) => boolean;
}

type PrimaryIdSource = Pick<ReturnType<typeof useUniversalSelection>, 'getPrimaryId'>;
type SceneReader = Pick<LevelSceneWriter, 'currentLevelId' | 'getLevelScene'>;

/**
 * Resolve the primary-selected entity narrowed to a specific BIM type. Returns null
 * when there is no active level, no scene, no primary selection, or the primary
 * selection is not of the guarded type.
 */
export function useResolveSelectedEntity<T extends Entity>(
  levelManager: SceneReader,
  universalSelection: PrimaryIdSource,
  guard: (entity: Entity) => entity is T,
): () => T | null {
  return useCallback((): T | null => {
    const id = universalSelection.getPrimaryId();
    if (!id || !levelManager.currentLevelId) return null;
    const scene = levelManager.getLevelScene(levelManager.currentLevelId);
    if (!scene) return null;
    const entity = scene.entities.find((x) => x.id === id);
    if (!entity || !guard(entity)) return null;
    return entity;
  }, [levelManager, universalSelection, guard]);
}
