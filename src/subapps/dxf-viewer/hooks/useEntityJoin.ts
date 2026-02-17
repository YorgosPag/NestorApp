/**
 * useEntityJoin Hook
 *
 * Orchestrates entity JOIN operations using:
 * - EntityMergeService for geometry analysis + merge logic
 * - JoinEntityCommand + CommandHistory for undo/redo
 * - LevelSceneManagerAdapter for scene mutations
 *
 * @see ADR-161: Entity Join System
 * @see ADR-032: Command History / Undo-Redo
 */

'use client';

import { useCallback, useMemo } from 'react';
import { EntityMergeService, type JoinPreview } from '../services/EntityMergeService';
import { JoinEntityCommand } from '../core/commands';
import { LevelSceneManagerAdapter } from '../systems/entity-creation/LevelSceneManagerAdapter';
import { publishHighlight } from '../events/selection-bus';
import type { ICommand } from '../core/commands';
import type { SceneEntity } from '../core/commands/interfaces';
import type { LevelsHookReturn } from '../systems/levels/useLevels';

// ============================================================================
// TYPES
// ============================================================================

export interface UseEntityJoinParams {
  /** Level manager for scene access */
  levelManager: LevelsHookReturn;
  /** Command history execute function */
  executeCommand: (command: ICommand) => void;
  /** Callback to update selected entity IDs after join */
  setSelectedEntityIds: (ids: string[]) => void;
}

export interface UseEntityJoinReturn {
  /**
   * Join the given entity IDs into a single entity.
   * Executes via CommandHistory for full undo/redo support.
   * @returns true if join succeeded
   */
  joinEntities: (entityIds: string[]) => boolean;
  /**
   * Check if the given entity IDs can be joined.
   */
  canJoin: (entityIds: string[]) => boolean;
  /**
   * Get a preview of what joining would produce.
   */
  getJoinPreview: (entityIds: string[]) => JoinPreview;
}

// ============================================================================
// HOOK
// ============================================================================

export function useEntityJoin({
  levelManager,
  executeCommand,
  setSelectedEntityIds,
}: UseEntityJoinParams): UseEntityJoinReturn {

  const mergeService = useMemo(() => new EntityMergeService(), []);

  const getScene = useCallback(() => {
    if (!levelManager.currentLevelId) return null;
    return levelManager.getLevelScene(levelManager.currentLevelId);
  }, [levelManager]);

  const joinEntities = useCallback((entityIds: string[]): boolean => {
    const scene = getScene();
    if (!scene || !levelManager.currentLevelId) return false;

    // Use EntityMergeService to compute the merge result
    const result = mergeService.joinEntities({ entityIds, scene });
    if (!result.success || !result.newEntityId) return false;

    // Find the merged entity in the updated scene
    const mergedEntity = result.updatedScene.entities.find(e => e.id === result.newEntityId);
    if (!mergedEntity) return false;

    // Create adapter for command system
    const adapter = new LevelSceneManagerAdapter(
      levelManager.getLevelScene,
      levelManager.setLevelScene,
      levelManager.currentLevelId,
    );

    // Execute via command history for undo/redo
    const command = new JoinEntityCommand(
      entityIds,
      mergedEntity as unknown as SceneEntity,
      adapter,
    );
    executeCommand(command);

    // Select the new merged entity
    setSelectedEntityIds([result.newEntityId]);
    publishHighlight({ ids: [result.newEntityId] });

    return true;
  }, [getScene, levelManager, mergeService, executeCommand, setSelectedEntityIds]);

  const canJoin = useCallback((entityIds: string[]): boolean => {
    const scene = getScene();
    if (!scene) return false;
    return mergeService.canJoin(entityIds, scene);
  }, [getScene, mergeService]);

  const getJoinPreview = useCallback((entityIds: string[]): JoinPreview => {
    const scene = getScene();
    if (!scene) {
      return { canJoin: false, resultType: 'not-joinable', entityCount: 0, reason: 'No scene loaded' };
    }
    return mergeService.getJoinPreview(entityIds, scene);
  }, [getScene, mergeService]);

  return { joinEntities, canJoin, getJoinPreview };
}
