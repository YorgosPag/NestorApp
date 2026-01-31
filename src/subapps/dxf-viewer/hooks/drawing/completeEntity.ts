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
// 🏢 ADR-102: Centralized Entity Type Guards
import { isArcEntity } from '../../types/entities';
import type { SceneModel, AnySceneEntity } from '../../types/scene';
import type { ToolType } from '../../ui/toolbar/types';
import { applyCompletionStyles } from '../useLineCompletionStyle';
import { EventBus } from '../../systems/events';
import { toolStateStore } from '../../stores/ToolStateStore';

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
  // 🔍 DEBUG (2026-01-31): Log completeEntity call for circle debugging
  console.log('📦 [completeEntity] Called', {
    entityType: entity?.type,
    entityId: entity?.id,
    levelId: options.levelId,
    tool: options.tool,
    // 🔍 DEBUG: Check if arc has counterclockwise BEFORE any processing
    counterclockwiseOnEntry: entity?.type === 'arc' ? (entity as { counterclockwise?: boolean }).counterclockwise : 'N/A'
  });

  // 🛡️ GUARD: Validate entity
  if (!entity) {
    console.log('❌ [completeEntity] Entity is null');
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

  const { tool, levelId, getScene, setScene, trackForUndo, skipToolPersistence, skipEvent } = options;

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: Apply completion styles (ADR-056)
  // ═══════════════════════════════════════════════════════════════════════════
  applyCompletionStyles(entity as unknown as Record<string, unknown>);

  // 🔍 DEBUG: Check if arc has counterclockwise AFTER applyCompletionStyles
  // 🏢 ADR-102: Use centralized type guard
  if (isArcEntity(entity)) {
    console.log('📦 [completeEntity] Arc entity AFTER applyCompletionStyles:', {
      entityId: entity.id,
      counterclockwise: (entity as { counterclockwise?: boolean }).counterclockwise,
      fullEntity: JSON.stringify(entity, null, 2)
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: Add entity to scene
  // 🔧 FIX (2026-01-31): Store finalScene for event emission (avoids stale closure)
  // ═══════════════════════════════════════════════════════════════════════════
  const scene = getScene(levelId);
  let finalScene: SceneModel;

  if (scene) {
    // Add to existing scene
    finalScene = {
      ...scene,
      entities: [...scene.entities, entity as AnySceneEntity]
    };
    setScene(levelId, finalScene);
    // 🔍 DEBUG (2026-01-31): Log scene update
    console.log('✅ [completeEntity] Added to existing scene', {
      levelId,
      previousCount: scene.entities.length,
      newCount: finalScene.entities.length
    });
  } else {
    // Create new scene with default layer (measurement tools need this)
    finalScene = {
      entities: [entity as AnySceneEntity],
      layers: { '0': { name: '0', color: '#FFFFFF', visible: true, locked: false } },
      bounds: { min: { x: 0, y: 0 }, max: { x: 1000, y: 1000 } },
      units: 'mm',
    };
    setScene(levelId, finalScene);
    // 🔍 DEBUG (2026-01-31): Log new scene creation
    console.log('✅ [completeEntity] Created new scene', {
      levelId,
      entityCount: 1
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3: Track for undo (optional)
  // ═══════════════════════════════════════════════════════════════════════════
  if (trackForUndo && entity.id) {
    trackForUndo(entity.id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 4: Emit completion event
  // 🔧 FIX (2026-01-31): Pass finalScene directly to avoid stale closure issue
  // The finalScene was just created above, so it contains the new entity
  // ═══════════════════════════════════════════════════════════════════════════
  if (!skipEvent) {
    // 🔍 DEBUG: Check arc counterclockwise in finalScene BEFORE emit
    const arcEntitiesInFinalScene = finalScene.entities.filter(e => e.type === 'arc');
    console.log('📤 [completeEntity] Emitting drawing:complete with finalScene', {
      entityCount: finalScene.entities.length,
      entityId: entity.id,
      arcCount: arcEntitiesInFinalScene.length,
      arcsWithCounterclockwise: arcEntitiesInFinalScene.map(e => ({
        id: e.id,
        counterclockwise: (e as { counterclockwise?: boolean }).counterclockwise
      }))
    });

    EventBus.emit('drawing:complete', {
      tool,
      entityId: entity.id,
      entity: entity as unknown as Record<string, unknown>,
      updatedScene: finalScene as unknown as Record<string, unknown>,
      levelId,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 5: Handle tool persistence (ADR-055)
  // ═══════════════════════════════════════════════════════════════════════════
  if (!skipToolPersistence) {
    toolStateStore.handleToolCompletion(tool);
  }

  return { success: true, entityId: entity.id };
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
