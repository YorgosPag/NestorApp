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
import { MoveEntityCommand, MoveMultipleEntitiesCommand } from '../core/commands';
import { useCommandHistory } from '../core/commands';
import { useLevels } from '../systems/levels';

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
 * Creates a SceneManager adapter from useLevels
 * This bridges the Levels system with the Command Pattern
 */
function createSceneManagerAdapter(
  levelId: string,
  getLevelScene: (id: string) => { entities: SceneEntity[] } | null,
  setLevelScene: (id: string, scene: { entities: SceneEntity[] }) => void
): ISceneManager {
  return {
    addEntity(entity: SceneEntity): void {
      const scene = getLevelScene(levelId);
      if (scene) {
        const updatedEntities = [...scene.entities, entity];
        setLevelScene(levelId, { ...scene, entities: updatedEntities });
      }
    },

    removeEntity(entityId: string): void {
      const scene = getLevelScene(levelId);
      if (scene) {
        const updatedEntities = scene.entities.filter(e => e.id !== entityId);
        setLevelScene(levelId, { ...scene, entities: updatedEntities });
      }
    },

    getEntity(entityId: string): SceneEntity | undefined {
      const scene = getLevelScene(levelId);
      if (scene) {
        return scene.entities.find(e => e.id === entityId) as SceneEntity | undefined;
      }
      return undefined;
    },

    // ADR-363 §5.4 — the hosted-opening cascade (`cascadeHostedOpeningsForWalls`,
    // run by Move/MoveMultiple commands) resolves a wall's openings by scanning
    // ALL entities for `opening.params.wallId === wall.id` (the authoritative
    // child→parent foreign key). Without `getEntities` it silently fell back to
    // the `wall.hostedOpeningIds` mirror, so an Alt-drag whole-wall move (ADR-363
    // Φ1G.5) left hosted doors/windows behind. Mirror the grip adapter (which has
    // always implemented this) so every move path keeps openings attached.
    getEntities(): readonly SceneEntity[] {
      const scene = getLevelScene(levelId);
      return (scene?.entities ?? []) as readonly SceneEntity[];
    },

    updateEntity(entityId: string, updates: Partial<SceneEntity>): void {
      const scene = getLevelScene(levelId);
      if (scene) {
        const updatedEntities = scene.entities.map(e => {
          if (e.id === entityId) {
            return { ...e, ...updates };
          }
          return e;
        });
        setLevelScene(levelId, { ...scene, entities: updatedEntities });
      }
    },

    updateVertex(entityId: string, vertexIndex: number, position: Point2D): void {
      const scene = getLevelScene(levelId);
      if (scene) {
        const updatedEntities = scene.entities.map(e => {
          if (e.id === entityId && 'vertices' in e && Array.isArray(e.vertices)) {
            const vertices = [...e.vertices];
            if (vertexIndex >= 0 && vertexIndex < vertices.length) {
              vertices[vertexIndex] = position;
            }
            return { ...e, vertices };
          }
          return e;
        });
        setLevelScene(levelId, { ...scene, entities: updatedEntities });
      }
    },

    insertVertex(entityId: string, insertIndex: number, position: Point2D): void {
      const scene = getLevelScene(levelId);
      if (scene) {
        const updatedEntities = scene.entities.map(e => {
          if (e.id === entityId && 'vertices' in e && Array.isArray(e.vertices)) {
            const vertices = [...e.vertices];
            vertices.splice(insertIndex, 0, position);
            return { ...e, vertices };
          }
          return e;
        });
        setLevelScene(levelId, { ...scene, entities: updatedEntities });
      }
    },

    removeVertex(entityId: string, vertexIndex: number): void {
      const scene = getLevelScene(levelId);
      if (scene) {
        const updatedEntities = scene.entities.map(e => {
          if (e.id === entityId && 'vertices' in e && Array.isArray(e.vertices)) {
            const vertices = [...e.vertices];
            if (vertexIndex >= 0 && vertexIndex < vertices.length) {
              vertices.splice(vertexIndex, 1);
            }
            return { ...e, vertices };
          }
          return e;
        });
        setLevelScene(levelId, { ...scene, entities: updatedEntities });
      }
    },

    getVertices(entityId: string): Point2D[] | undefined {
      const scene = getLevelScene(levelId);
      if (scene) {
        const entity = scene.entities.find(e => e.id === entityId);
        if (entity && 'vertices' in entity && Array.isArray(entity.vertices)) {
          return entity.vertices as Point2D[];
        }
      }
      return undefined;
    },
    updateEntities(updates: ReadonlyMap<string, Partial<SceneEntity>>): void {
      const scene = getLevelScene(levelId);
      if (!scene) return;
      const updatedEntities = scene.entities.map((e) => {
        const patch = updates.get(e.id);
        return patch ? ({ ...e, ...patch } as SceneEntity) : e;
      });
      setLevelScene(levelId, { ...scene, entities: updatedEntities });
    },
    getEntityIndex(entityId: string): number {
      const scene = getLevelScene(levelId);
      if (!scene) return -1;
      return scene.entities.findIndex((e) => e.id === entityId);
    },
    reorderEntity(entityId: string, direction: 'front' | 'back'): void {
      const scene = getLevelScene(levelId);
      if (!scene) return;
      const idx = scene.entities.findIndex((e) => e.id === entityId);
      if (idx === -1) return;
      const entities = [...scene.entities];
      const [entity] = entities.splice(idx, 1);
      if (direction === 'front') entities.push(entity);
      else entities.unshift(entity);
      setLevelScene(levelId, { ...scene, entities });
    },
    moveEntityToIndex(entityId: string, targetIndex: number): void {
      const scene = getLevelScene(levelId);
      if (!scene) return;
      const idx = scene.entities.findIndex((e) => e.id === entityId);
      if (idx === -1) return;
      const entities = [...scene.entities];
      const [entity] = entities.splice(idx, 1);
      entities.splice(targetIndex, 0, entity);
      setLevelScene(levelId, { ...scene, entities });
    },
  };
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
