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
import { toast } from 'sonner';
import i18next from 'i18next';
import { EntityMergeService, type JoinPreview, type JoinRejectReason } from '../services/EntityMergeService';
import { JoinEntityCommand } from '../core/commands';
import { LevelSceneManagerAdapter, createLevelSceneManagerAdapter } from '../systems/entity-creation/LevelSceneManagerAdapter';
import { publishHighlight } from '../events/selection-bus';
import type { ICommand } from '../core/commands';
import type { SceneEntity } from '../core/commands/interfaces';
import type { LevelsHookReturn } from '../systems/levels/useLevels';

// ============================================================================
// FEEDBACK SSoT — reason → i18n key (mirrors useWallMergeTool's BLOCK_REASON_KEY)
// ============================================================================

/**
 * Localized toast key per structured JOIN rejection reason. This is the SINGLE
 * source of truth for JOIN failure messaging — every entry point (ribbon button,
 * `J` shortcut, right-click context menu) funnels through `joinEntities` below,
 * so they all get identical, localized feedback. NEVER toast the service's raw
 * `result.message` (English, debug-only) — map the `reasonCode` here (N.11).
 */
const JOIN_REJECT_KEY: Record<JoinRejectReason, string> = {
  'too-few': 'tool-hints:join.selectEntities',
  'non-joinable-type': 'tool-hints:join.nonJoinableType',
  'closed-entity': 'tool-hints:join.closedEntity',
  'not-connected': 'tool-hints:join.notConnected',
};
/** Fallback when the failure has no structured reason (e.g. no active scene). */
const JOIN_REJECT_FALLBACK_KEY = 'tool-hints:join.cannotJoin';

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
    // Localized failure feedback SSoT: prefer the caller's `onWarning` sink
    // (e.g. the context-menu's toast wrapper); otherwise fall back to a direct
    // toast. Either way the TEXT comes from `reasonCode` → i18n key, so every
    // entry point shows the same localized message.
    const warnByReason = (code?: JoinRejectReason): void => {
      const text = i18next.t(code ? JOIN_REJECT_KEY[code] : JOIN_REJECT_FALLBACK_KEY);
      if (onWarning) onWarning(text);
      else toast.warning(text);
    };

    const scene = getScene();
    if (!scene || !levelManager.currentLevelId) {
      console.warn('[EntityJoin] No scene or level ID available');
      warnByReason();
      return false;
    }

    if (entityIds.length < 2) {
      console.warn('[EntityJoin] Need 2+ entities, got:', entityIds.length);
      warnByReason('too-few');
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
      warnByReason(result.reasonCode);
      return false;
    }

    // Find the merged entity in the updated scene
    const mergedEntity = result.updatedScene.entities.find(e => e.id === result.newEntityId);
    if (!mergedEntity) {
      console.error('[EntityJoin] Merged entity not found in updated scene');
      warnByReason();
      return false;
    }

    console.log('[EntityJoin] Merge succeeded:', {
      resultType: mergedEntity.type,
      entityCount: entities.length,
      newId: result.newEntityId.substring(0, 8),
    });

    // Create adapter for command system
    const adapter = createLevelSceneManagerAdapter(
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

    // Localized success text (the service `result.message` is English/debug-only).
    // Caller-controlled: only surfaces where an `onSuccess` sink is wired (e.g. the
    // context menu). Ribbon/`J` stay silent on success — Revit-like, no toast spam.
    onSuccess?.(i18next.t('tool-hints:join.joined', { count: entities.length }));
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

  return useMemo(
    () => ({ joinEntities, canJoin, getJoinPreview }),
    [joinEntities, canJoin, getJoinPreview],
  );
}
