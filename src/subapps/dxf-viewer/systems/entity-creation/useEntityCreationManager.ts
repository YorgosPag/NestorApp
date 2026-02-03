/**
 * ENTITY CREATION MANAGER HOOK
 *
 * 🏢 ENTERPRISE (2026-01-30): Centralized entity creation via Event Bus + Command Pattern
 * Pattern: Autodesk/SAP - Event-driven architecture with full undo/redo support
 *
 * Architecture (ADR-055):
 * - useUnifiedDrawing emits 'entity:create-request' event via EventBus
 * - This manager listens to events and creates CreateEntityCommand
 * - Command is executed via CommandHistory for undo/redo support
 * - 'entity:created-confirmed' event emitted after successful creation
 *
 * Benefits:
 * - Single source of truth for entity creation
 * - Full undo/redo support via Command Pattern
 * - Decoupled components (drawing doesn't know about storage)
 * - Audit trail via CommandHistory
 *
 * Usage:
 * ```tsx
 * // In DxfViewerContent or similar parent component:
 * function DxfViewerContent() {
 *   const { getLevelScene, setLevelScene, currentLevelId } = useLevels();
 *
 *   // Initialize entity creation manager
 *   useEntityCreationManager({
 *     getLevelScene,
 *     setLevelScene,
 *     defaultLevelId: currentLevelId || '0',
 *   });
 *
 *   // ... rest of component
 * }
 * ```
 */

import { useEffect, useCallback, useRef } from 'react';
import { EventBus, type DrawingEventPayload } from '../../systems/events';
import { useCommandHistory } from '../../core/commands';
import { CreateEntityCommand } from '../../core/commands/entity-commands/CreateEntityCommand';
import { LevelSceneManagerAdapter } from './LevelSceneManagerAdapter';
import type { SceneModel, AnySceneEntity } from '../../types/scene';
import type { SceneEntity, CreateEntityOptions } from '../../core/commands/interfaces';
import { DXF_DEFAULT_LAYER } from '../../config/layer-config';

/**
 * Configuration for the entity creation manager
 */
export interface EntityCreationManagerConfig {
  /** Function to get scene for a level (from useLevels) */
  getLevelScene: (levelId: string) => SceneModel | null;

  /** Function to set scene for a level (from useLevels) */
  setLevelScene: (levelId: string, scene: SceneModel) => void;

  /** Default level ID to use when none specified in event */
  defaultLevelId: string;

  /** Optional: Enable debug logging */
  debug?: boolean;
}

/**
 * Payload for entity:create-request event (from EventBus.ts)
 */
type EntityCreateRequestPayload = DrawingEventPayload<'entity:create-request'>;

/**
 * 🏢 ENTERPRISE: Hook that manages entity creation via Event Bus + Command Pattern
 *
 * This hook listens to 'entity:create-request' events from useUnifiedDrawing
 * and creates entities using the Command Pattern for full undo/redo support.
 */
export function useEntityCreationManager(config: EntityCreationManagerConfig): void {
  const { getLevelScene, setLevelScene, defaultLevelId, debug = false } = config;

  // Get command history for execute/undo/redo
  const { execute } = useCommandHistory();

  // Use refs to avoid stale closures in event listener
  const getLevelSceneRef = useRef(getLevelScene);
  const setLevelSceneRef = useRef(setLevelScene);
  const defaultLevelIdRef = useRef(defaultLevelId);

  // Update refs when props change
  useEffect(() => {
    getLevelSceneRef.current = getLevelScene;
    setLevelSceneRef.current = setLevelScene;
    defaultLevelIdRef.current = defaultLevelId;
  }, [getLevelScene, setLevelScene, defaultLevelId]);

  // Handle entity creation request
  const handleEntityCreateRequest = useCallback(
    (payload: EntityCreateRequestPayload) => {
      const { entity, toolType, requestId, targetLevelId } = payload;

      // Determine target level
      const levelId = targetLevelId || defaultLevelIdRef.current || '0';

      if (debug) {
        console.log('🏢 [EntityCreationManager] Received create request:', {
          requestId,
          toolType,
          levelId,
          entityType: entity.type,
        });
      }

      // Create adapter for this level
      const adapter = new LevelSceneManagerAdapter(
        getLevelSceneRef.current,
        setLevelSceneRef.current,
        levelId
      );

      // Prepare entity data for command (strip 'id' as command generates its own)
      // This follows Command Pattern best practice - command owns entity lifecycle
      const normalizedEntity: SceneEntity = {
        ...entity,
        layer: entity.layer ?? DXF_DEFAULT_LAYER,
        visible: entity.visible ?? true
      };
      const { id: existingId, ...entityDataWithoutId } = normalizedEntity;

      // Create options from entity data
      const options: CreateEntityOptions = {
        layer: entity.layer ?? DXF_DEFAULT_LAYER,
        color: entity.color,
        lineweight: entity.lineweight,
        opacity: entity.opacity,
      };

      // 🏢 ENTERPRISE: Create and execute command via CommandHistory
      // This enables full undo/redo support
      const command = new CreateEntityCommand(
        entityDataWithoutId as Omit<SceneEntity, 'id'>,
        adapter,
        options
      );

      try {
        execute(command);

        // Get the created entity (with generated ID)
        const createdEntity = command.getEntity();

        if (debug) {
          console.log('🏢 [EntityCreationManager] Entity created:', {
            requestId,
            entityId: createdEntity?.id,
            commandId: command.id,
          });
        }

        // 🏢 ENTERPRISE: Emit confirmation event
        // Other components can listen for this to update their state
        EventBus.emit('entity:created-confirmed', {
        entity: createdEntity ? (createdEntity as unknown as AnySceneEntity) : entity,
        levelId,
        commandId: command.id,
      });
      } catch (error) {
        console.error('❌ [EntityCreationManager] Failed to create entity:', error);
      }
    },
    [execute, debug]
  );

  // Subscribe to EventBus on mount
  useEffect(() => {
    if (debug) {
      console.log('🏢 [EntityCreationManager] Subscribing to entity:create-request events');
    }

    // Subscribe to entity creation requests
    const unsubscribe = EventBus.on('entity:create-request', handleEntityCreateRequest);

    return () => {
      if (debug) {
        console.log('🏢 [EntityCreationManager] Unsubscribing from events');
      }
      unsubscribe();
    };
  }, [handleEntityCreateRequest, debug]);
}

/**
 * 🏢 ENTERPRISE: Helper function to emit entity creation request
 *
 * This is the standard way for components to request entity creation.
 * Use this instead of directly calling setLevelScene().
 *
 * Usage:
 * ```typescript
 * emitEntityCreateRequest({
 *   entity: { type: 'line', start: {x: 0, y: 0}, end: {x: 100, y: 100}, ... },
 *   toolType: 'line',
 *   targetLevelId: currentLevelId,
 * });
 * ```
 */
export function emitEntityCreateRequest(params: {
  entity: AnySceneEntity;
  toolType: string;
  targetLevelId?: string;
}): string {
  const requestId = `create_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  EventBus.emit('entity:create-request', {
    entity: params.entity,
    toolType: params.toolType,
    requestId,
    targetLevelId: params.targetLevelId,
  });

  return requestId;
}

/**
 * 🏢 ENTERPRISE: Helper to strip ID from entity for command creation
 *
 * The Command Pattern expects entity data WITHOUT id - the command generates it.
 * Use this when you have an entity with existing ID that you want to save via events.
 */
export function stripEntityId<T extends { id?: string }>(entity: T): Omit<T, 'id'> {
  const { id: _id, ...entityWithoutId } = entity;
  return entityWithoutId;
}
