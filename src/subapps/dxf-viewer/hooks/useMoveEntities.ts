/**
 * USE MOVE ENTITIES HOOK
 *
 * 🏢 ENTERPRISE (2026-01-25): React hook for moving entities with undo/redo support
 *
 * This hook provides a simple interface for moving entities:
 * - Single entity movement
 * - Multiple entities movement (batch)
 * - Full undo/redo support via Command Pattern
 * - Command merging for smooth drag operations
 *
 * Usage:
 * ```tsx
 * const { moveEntity, moveEntities, isMoving } = useMoveEntities();
 *
 * // Move single entity
 * moveEntity('entity_1', { x: 10, y: 5 });
 *
 * // Move multiple entities
 * moveEntities(['entity_1', 'entity_2'], { x: 10, y: 5 });
 *
 * // For drag operations (enables command merging)
 * moveEntity('entity_1', { x: 1, y: 0 }, { isDragging: true });
 * ```
 *
 * @see HYBRID_LAYER_MOVEMENT_ARCHITECTURE.md
 * @see core/commands/entity-commands/MoveEntityCommand.ts
 */

import { useCallback, useMemo, useState } from 'react';
import type { Point2D } from '../rendering/types/Types';
import type { ISceneManager, SceneEntity } from '../core/commands/interfaces';
import type { SceneModel } from '../types/scene';
import { MoveEntityCommand, MoveMultipleEntitiesCommand } from '../core/commands';
import { useCommandHistory } from '../core/commands';
import { useLevels } from '../systems/levels';
// 🏢 ADR-049: canonical ISceneManager adapter SSoT (stateless pass-through to root live SSoT + full vertex ops)
import { createLevelSceneManagerAdapter } from '../systems/entity-creation/LevelSceneManagerAdapter';

/**
 * Options for move operations
 */
export interface MoveOptions {
  /** Mark as dragging operation (enables command merging) */
  isDragging?: boolean;
  /** Optional: Override the level ID (defaults to current level) */
  levelId?: string;
}

/**
 * Return type for useMoveEntities hook
 */
export interface UseMoveEntitiesReturn {
  /** Move a single entity by delta */
  moveEntity: (entityId: string, delta: Point2D, options?: MoveOptions) => void;

  /** Move multiple entities by delta */
  moveEntities: (entityIds: string[], delta: Point2D, options?: MoveOptions) => void;

  /** Whether a move operation is in progress */
  isMoving: boolean;

  /** Undo last move */
  undo: () => boolean;

  /** Redo last undone move */
  redo: () => boolean;

  /** Can undo */
  canUndo: boolean;

  /** Can redo */
  canRedo: boolean;
}

/**
 * Creates a SceneManager adapter from useLevels.
 *
 * 🏢 ADR-049: thin binding over the canonical `LevelSceneManagerAdapter` SSoT.
 * Previously this re-implemented the whole ISceneManager inline. Delegating gains the
 * canonical read-after-write behaviour (ADR-527: the adapter is a stateless pass-through
 * to the root `levelScenesRef`, which `setLevelScene` writes synchronously so a
 * multi-mutation sync batch always sees prior writes) + full vertex/z-order ops with zero
 * duplicated logic. The entities-only param types are kept for the existing call sites;
 * the casts mirror the level functions' real `SceneModel` shape.
 */
function createSceneManagerAdapter(
  levelId: string,
  getLevelScene: (id: string) => { entities: SceneEntity[] } | null,
  setLevelScene: (id: string, scene: { entities: SceneEntity[] }) => void
): ISceneManager {
  return createLevelSceneManagerAdapter(
    getLevelScene as unknown as (id: string) => SceneModel | null,
    setLevelScene as unknown as (id: string, scene: SceneModel) => void,
    levelId,
  );
}

/**
 * React hook for moving entities with undo/redo support
 */
export function useMoveEntities(): UseMoveEntitiesReturn {
  const { currentLevelId, getLevelScene, setLevelScene } = useLevels();
  const { execute, undo, redo, canUndo, canRedo } = useCommandHistory();
  const [isMoving, setIsMoving] = useState(false);

  // Create scene manager adapter for current level
  // 🏢 ENTERPRISE: Type-safe adapter creation with proper casting
  const sceneManager = useMemo(() => {
    if (!currentLevelId) {
      return null;
    }
    return createSceneManagerAdapter(
      currentLevelId,
      getLevelScene as unknown as (id: string) => { entities: SceneEntity[] } | null,
      setLevelScene as unknown as (id: string, scene: { entities: SceneEntity[] }) => void
    );
  }, [currentLevelId, getLevelScene, setLevelScene]);

  /**
   * Move a single entity by delta
   */
  const moveEntity = useCallback(
    (entityId: string, delta: Point2D, options: MoveOptions = {}) => {
      const targetLevelId = options.levelId ?? currentLevelId;

      if (!targetLevelId) {
        console.warn('[useMoveEntities] No level ID available');
        return;
      }

      // Create adapter for target level
      // 🏢 ENTERPRISE: Type-safe adapter creation with proper casting
      const targetSceneManager = options.levelId
        ? createSceneManagerAdapter(
            targetLevelId,
            getLevelScene as unknown as (id: string) => { entities: SceneEntity[] } | null,
            setLevelScene as unknown as (id: string, scene: { entities: SceneEntity[] }) => void
          )
        : sceneManager;

      if (!targetSceneManager) {
        console.warn('[useMoveEntities] Scene manager not available');
        return;
      }

      // Validate delta
      if (delta.x === 0 && delta.y === 0) {
        return;
      }

      setIsMoving(true);

      try {
        const command = new MoveEntityCommand(
          entityId,
          delta,
          targetSceneManager,
          options.isDragging ?? false
        );
        execute(command);
      } finally {
        setIsMoving(false);
      }
    },
    [currentLevelId, sceneManager, execute, getLevelScene, setLevelScene]
  );

  /**
   * Move multiple entities by delta
   */
  const moveEntities = useCallback(
    (entityIds: string[], delta: Point2D, options: MoveOptions = {}) => {
      const targetLevelId = options.levelId ?? currentLevelId;

      if (!targetLevelId) {
        console.warn('[useMoveEntities] No level ID available');
        return;
      }

      if (entityIds.length === 0) {
        return;
      }

      // Create adapter for target level
      // 🏢 ENTERPRISE: Type-safe adapter creation with proper casting
      const targetSceneManager = options.levelId
        ? createSceneManagerAdapter(
            targetLevelId,
            getLevelScene as unknown as (id: string) => { entities: SceneEntity[] } | null,
            setLevelScene as unknown as (id: string, scene: { entities: SceneEntity[] }) => void
          )
        : sceneManager;

      if (!targetSceneManager) {
        console.warn('[useMoveEntities] Scene manager not available');
        return;
      }

      // Validate delta
      if (delta.x === 0 && delta.y === 0) {
        return;
      }

      setIsMoving(true);

      try {
        // Use single entity command for single entity
        if (entityIds.length === 1) {
          const command = new MoveEntityCommand(
            entityIds[0],
            delta,
            targetSceneManager,
            options.isDragging ?? false
          );
          execute(command);
        } else {
          // Use batch command for multiple entities
          const command = new MoveMultipleEntitiesCommand(
            entityIds,
            delta,
            targetSceneManager,
            options.isDragging ?? false
          );
          execute(command);
        }
      } finally {
        setIsMoving(false);
      }
    },
    [currentLevelId, sceneManager, execute, getLevelScene, setLevelScene]
  );

  return {
    moveEntity,
    moveEntities,
    isMoving,
    undo,
    redo,
    canUndo,
    canRedo,
  };
}

/**
 * Alias for backward compatibility
 */
export const useMoveEntity = useMoveEntities;
