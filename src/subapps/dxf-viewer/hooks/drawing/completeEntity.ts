/**
 * @module completeEntity
 * @description ADR-057: Unified Entity Completion Pipeline
 *
 * 🏢 ENTERPRISE PATTERN: Single Entry Point for ALL Entity Completions
 *
 * PROBLEM SOLVED:
 * - Previously: 4 different code paths for entity completion
 *   - tryCompleteEntity() for line/rectangle/circle
 *   - finishPolyline() for polyline/polygon/measure-area
 *   - inline code for continuous measurement
 *   - Each path had its own style/scene/event logic
 *
 * SOLUTION:
 * - Single `completeEntity()` function for ALL entity types
 * - Handles: styles, scene addition, undo tracking, events, tool persistence
 * - AutoCAD/BricsCAD/SolidWorks pattern compliance
 *
 * ARCHITECTURE:
 * ```
 * Any Tool (line, rectangle, circle, polyline, polygon, measure-*)
 *                    ↓
 *          completeEntity(entity, options)
 *                    ↓
 *     ┌──────────────┼──────────────┐
 *     ↓              ↓              ↓
 * Apply Styles   Add to Scene   Emit Event
 * (ADR-056)      (centralized)  (EventBus)
 * ```
 *
 * @author Anthropic Claude Code
 * @since 2026-01-30
 * @see ADR-057 in docs/centralized-systems/reference/adr-index.md
 */

import type { Entity } from '../../types/entities';
import { DXF_DEFAULT_LAYER } from '../../config/layer-config';
import { UI_COLORS } from '../../config/color-config';
import type { SceneModel, AnySceneEntity } from '../../types/scene';
import type { ToolType } from '../../ui/toolbar/types';
import { applyCompletionStyles } from '../useLineCompletionStyle';
import { EventBus } from '../../systems/events';
import { toolStateStore } from '../../stores/ToolStateStore';
import { perfMark, perfStart, perfEnd } from '../../debug/perf-line-profile';
import { getGlobalCommandHistory } from '../../core/commands/CommandHistory';
import { CreateEntityCommand } from '../../core/commands/entity-commands/CreateEntityCommand';
import { LevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import type { SceneEntity } from '../../core/commands/interfaces';
import type { DrawingTool } from './drawing-types';
import type { PersistEntityOptions, PersistEntityResult } from './useOverlayPersistence';

/**
 * ADR-340 Phase 9 STEP G — opt-in persistence to floorplan_overlays.
 * Caller (typically useUnifiedDrawing) injects the `persist` callback from
 * `useOverlayPersistence()`; the persistence runs as a non-blocking side
 * effect after the entity has been added to the scene. Layering tools do
 * NOT use this — they persist via the overlay store directly.
 */
export interface PersistToOverlaysOptions extends PersistEntityOptions {
  persist: (
    entity: Entity,
    tool: DrawingTool,
    options: PersistEntityOptions,
  ) => Promise<PersistEntityResult>;
}

/**
 * Options for entity completion
 */
export interface CompleteEntityOptions {
  /** Current tool type (for event emission and tool persistence) */
  tool: ToolType;

  /** Level/Layer ID where entity will be added */
  levelId: string;

  /** Function to get current scene for a level */
  getScene: (levelId: string) => SceneModel | null;

  /** Function to set/update scene for a level */
  setScene: (levelId: string, scene: SceneModel) => void;

  /** Optional: Track entity ID for undo functionality */
  trackForUndo?: (entityId: string) => void;

  /** Optional: Skip tool persistence handling (for batch operations) */
  skipToolPersistence?: boolean;

  /** Optional: Skip event emission (for internal operations) */
  skipEvent?: boolean;

  /** Optional: Skip applyCompletionStyles (for AI-created entities with explicit colors) */
  skipStyles?: boolean;

  /**
   * ADR-340 Phase 9 STEP G — opt-in Firestore persistence on `floorplan_overlays`.
   * When provided, fires a non-blocking call to the gateway after the entity
   * has been added to the scene. Persistence failures are logged but do not
   * abort the completion (scene state remains authoritative for the session).
   */
  persistToOverlays?: PersistToOverlaysOptions;
}

/**
 * Result of entity completion
 */
export interface CompleteEntityResult {
  success: boolean;
  entityId: string;
  error?: string;
}

/**
 * 🏢 ENTERPRISE: Unified Entity Completion Function
 *
 * Single entry point for ALL entity completions (line, rectangle, circle,
 * polyline, polygon, measure-distance, measure-area, etc.)
 *
 * RESPONSIBILITIES:
 * 1. Apply completion styles (ADR-056)
 * 2. Add entity to scene
 * 3. Track for undo (optional)
 * 4. Emit completion event
 * 5. Handle tool persistence (ADR-055)
 *
 * @param entity - The entity to complete (must have valid id and type)
 * @param options - Completion options
 * @returns Result with success status and entity ID
 *
 * @example
 * ```typescript
 * // In any drawing tool completion:
 * const newEntity = createEntityFromTool(tool, points);
 *
 * completeEntity(newEntity, {
 *   tool: currentTool,
 *   levelId: currentLevelId || '0',
 *   getScene: getLevelScene,
 *   setScene: setLevelScene,
 *   trackForUndo: (id) => sessionEntityIds.push(id),
 * });
 * ```
 */
export function completeEntity(
  entity: Entity | null,
  options: CompleteEntityOptions
): CompleteEntityResult {
  if (!entity) {
    return { success: false, entityId: '', error: 'Entity is null' };
  }

  // Validate id exists and is string
  const entityId = entity.id;
  if (!entityId || typeof entityId !== 'string') {
    return { success: false, entityId: '', error: 'Entity has invalid id' };
  }

  // Validate type exists and is string
  if (!('type' in entity) || typeof entity.type !== 'string') {
    return { success: false, entityId: entityId, error: 'Entity has invalid type' };
  }

  const {
    tool,
    levelId,
    getScene,
    setScene,
    trackForUndo,
    skipToolPersistence,
    skipEvent,
    skipStyles,
    persistToOverlays,
  } = options;

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: Apply completion styles (ADR-056)
  // Skip for AI-created entities that have explicit colors/styles
  // ═══════════════════════════════════════════════════════════════════════════
  if (!skipStyles) {
    applyCompletionStyles(entity as unknown as Record<string, unknown>);
  }

  // STEP 2: Add entity to scene via Command Pattern (ADR-031 + ADR-057).
  // Going through CreateEntityCommand + global CommandHistory is what wires
  // Ctrl+Z / undo-button to drawing tools — direct setScene() bypasses the
  // undo stack and leaves the user unable to revert a freshly drawn shape.
  const _perfTotal = perfStart();
  const sceneBefore = getScene(levelId);
  const styledEntity = entity as Entity & Record<string, unknown>;
  const { id: existingId, ...entityWithoutId } = styledEntity as { id: string } & Record<string, unknown>;
  const adapter = new LevelSceneManagerAdapter(getScene, setScene, levelId);
  const command = new CreateEntityCommand(
    entityWithoutId as unknown as Omit<SceneEntity, 'id'>,
    adapter,
    {
      existingId,
      layer: typeof styledEntity.layer === 'string' ? styledEntity.layer : undefined,
      color: typeof styledEntity.color === 'string' ? styledEntity.color : undefined,
      lineweight: typeof styledEntity.lineweight === 'number' ? styledEntity.lineweight : undefined,
      opacity: typeof styledEntity.opacity === 'number' ? styledEntity.opacity : undefined,
    }
  );
  perfMark('completeEntity.execute(CreateEntityCommand)', () => {
    getGlobalCommandHistory().execute(command);
  });
  const createdEntity = (command.getEntity() ?? entity) as AnySceneEntity;
  const finalEntityId = createdEntity.id;
  const finalScene: SceneModel = sceneBefore
    ? { ...sceneBefore, entities: [...sceneBefore.entities, createdEntity] }
    : {
        entities: [createdEntity],
        layers: { [DXF_DEFAULT_LAYER]: { name: DXF_DEFAULT_LAYER, color: UI_COLORS.WHITE, visible: true, locked: false } },
        bounds: { min: { x: 0, y: 0 }, max: { x: 1000, y: 1000 } },
        units: 'mm',
      };

  // STEP 3: Track for undo (optional — used by continuous-measurement session bookkeeping)
  if (trackForUndo) {
    trackForUndo(finalEntityId);
  }

  // STEP 4: Emit completion event
  if (!skipEvent) {
    perfMark('completeEntity.emit(drawing:complete)', () => {
      EventBus.emit('drawing:complete', {
        tool,
        entityId: finalEntityId,
        entity: createdEntity,
        updatedScene: finalScene,
        levelId,
      });
    });
  }

  // STEP 5: Handle tool persistence
  if (!skipToolPersistence) {
    perfMark('completeEntity.toolStateStore.handleToolCompletion', () => {
      toolStateStore.handleToolCompletion(tool);
    });
  }
  perfEnd('completeEntity.TOTAL', _perfTotal);

  // STEP 6: ADR-340 Phase 9 STEP G — opt-in Firestore persistence
  if (persistToOverlays) {
    const { persist, ...persistOpts } = persistToOverlays;
    void persist(createdEntity as unknown as Entity, tool as DrawingTool, persistOpts);
  }

  return { success: true, entityId: finalEntityId };
}

/**
 * 🏢 ENTERPRISE: Batch entity completion
 *
 * Completes multiple entities in a single operation (e.g., continuous measurement)
 * Optimized to emit single event and handle tool persistence once at the end.
 *
 * @param entities - Array of entities to complete
 * @param options - Completion options (skipEvent/skipToolPersistence are auto-set)
 * @returns Array of results
 */
export function completeEntities(
  entities: (Entity | null)[],
  options: Omit<CompleteEntityOptions, 'skipEvent' | 'skipToolPersistence'>
): CompleteEntityResult[] {
  const results: CompleteEntityResult[] = [];
  const validEntityIds: string[] = [];

  // Complete each entity (skip individual events and tool persistence)
  for (const entity of entities) {
    const result = completeEntity(entity, {
      ...options,
      skipEvent: true,
      skipToolPersistence: true,
    });
    results.push(result);
    if (result.success) {
      validEntityIds.push(result.entityId);
    }
  }

  // Emit single event for last entity (batch mode)
  if (validEntityIds.length > 0) {
    EventBus.emit('drawing:complete', {
      tool: options.tool,
      entityId: validEntityIds[validEntityIds.length - 1], // Last entity
    });
  }

  // Handle tool persistence once
  toolStateStore.handleToolCompletion(options.tool);

  return results;
}
