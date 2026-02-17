/**
 * useEntityJoin Hook
 *
 * Orchestrates entity JOIN operations using:
 * - EntityMergeService for geometry analysis + merge logic
 * - JoinEntityCommand + CommandHistory for undo/redo
 * - LevelSceneManagerAdapter for scene mutations
 *
 * @see ADR-186: Entity Join System
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
  /** Optional warning callback for user feedback */
  onWarning?: (message: string) => void;
  /** Optional success callback for user feedback */
  onSuccess?: (message: string) => void;
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
  onWarning,
  onSuccess,
}: UseEntityJoinParams): UseEntityJoinReturn {

  const mergeService = useMemo(() => new EntityMergeService(), []);

  const getScene = useCallback(() => {
    if (!levelManager.currentLevelId) return null;
    return levelManager.getLevelScene(levelManager.currentLevelId);
  }, [levelManager]);

  const joinEntities = useCallback((entityIds: string[]): boolean => {
    const scene = getScene();
    if (!scene || !levelManager.currentLevelId) {
      console.warn('[EntityJoin] No scene or level ID available');
      onWarning?.('No active scene');
      return false;
    }

    if (entityIds.length < 2) {
      console.warn('[EntityJoin] Need 2+ entities, got:', entityIds.length);
      onWarning?.('Select at least 2 entities to join');
      return false;
    }

    // Debug: log entity types
    const entities = scene.entities.filter(e => entityIds.includes(e.id));
    console.log('[EntityJoin] Joining entities:', entities.map(e => ({
      id: e.id.substring(0, 8),
      type: e.type,
      hasStart: 'start' in e,
      hasVertices: 'vertices' in e,
    })));

    // Use EntityMergeService to compute the merge result
    const result = mergeService.joinEntities({ entityIds, scene });

    if (!result.success || !result.newEntityId) {
      console.warn('[EntityJoin] Merge failed:', result.message);
      onWarning?.(result.message || 'Join failed');
      return false;
    }

    // Find the merged entity in the updated scene
    const mergedEntity = result.updatedScene.entities.find(e => e.id === result.newEntityId);
    if (!mergedEntity) {
      console.error('[EntityJoin] Merged entity not found in updated scene');
      onWarning?.('Join computation error');
      return false;
    }

    console.log('[EntityJoin] Merge succeeded:', {
      resultType: mergedEntity.type,
      entityCount: entities.length,
      newId: result.newEntityId.substring(0, 8),
    });

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

    onSuccess?.(result.message || `Joined ${entities.length} entities`);
    return true;
  }, [getScene, levelManager, mergeService, executeCommand, setSelectedEntityIds, onWarning, onSuccess]);

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
