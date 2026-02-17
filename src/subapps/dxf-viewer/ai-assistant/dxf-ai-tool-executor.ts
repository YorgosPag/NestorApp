/**
 * @module ai-assistant/dxf-ai-tool-executor
 * @description Client-side executor that translates AI tool calls into canvas entities
 *
 * Receives parsed DxfAiToolCall objects from the API response and:
 * - Validates arguments (rejects negative radius, zero-length lines, etc.)
 * - Creates proper entity objects (LineEntity, CircleEntity, RectangleEntity)
 * - Uses completeEntities() for batch entity insertion (ADR-057)
 * - Returns execution results with created entity IDs
 *
 * IMPORTANT: This runs on the CLIENT, not the server.
 *
 * @see ADR-185 (AI Drawing Assistant)
 * @see ADR-057 (Unified Entity Completion)
 * @since 2026-02-17
 */

import type {
  DxfAiToolCall,
  DxfAiExecutionResult,
  DrawLineArgs,
  DrawRectangleArgs,
  DrawCircleArgs,
  QueryEntitiesArgs,
} from './types';
import type { Entity, LineEntity, CircleEntity, RectangleEntity, SceneModel } from '../types/entities';
import type { CompleteEntityOptions } from '../hooks/drawing/completeEntity';
import { completeEntities } from '../hooks/drawing/completeEntity';
import { generateEntityId } from '../systems/entity-creation/utils';
import { DXF_AI_DEFAULTS, DXF_AI_LIMITS } from '../config/ai-assistant-config';

// ============================================================================
// ENTITY BUILDERS
// ============================================================================

function buildLineEntity(args: DrawLineArgs): LineEntity {
  return {
    id: generateEntityId(),
    type: 'line',
    start: { x: args.start_x, y: args.start_y },
    end: { x: args.end_x, y: args.end_y },
    layer: args.layer ?? DXF_AI_DEFAULTS.LAYER,
    color: args.color ?? DXF_AI_DEFAULTS.COLOR,
  };
}

function buildRectangleEntity(args: DrawRectangleArgs): RectangleEntity {
  return {
    id: generateEntityId(),
    type: 'rectangle',
    x: args.x,
    y: args.y,
    width: args.width,
    height: args.height,
    layer: args.layer ?? DXF_AI_DEFAULTS.LAYER,
    color: args.color ?? DXF_AI_DEFAULTS.COLOR,
  };
}

function buildCircleEntity(args: DrawCircleArgs): CircleEntity {
  return {
    id: generateEntityId(),
    type: 'circle',
    center: { x: args.center_x, y: args.center_y },
    radius: args.radius,
    layer: args.layer ?? DXF_AI_DEFAULTS.LAYER,
    color: args.color ?? DXF_AI_DEFAULTS.COLOR,
  };
}

// ============================================================================
// VALIDATION
// ============================================================================

function validateLine(args: DrawLineArgs): string | null {
  if (args.start_x === args.end_x && args.start_y === args.end_y) {
    return 'Η γραμμή έχει μηδενικό μήκος (ίδιο αρχικό και τελικό σημείο)';
  }
  return null;
}

function validateRectangle(args: DrawRectangleArgs): string | null {
  if (args.width <= 0) {
    return `Μη έγκυρο πλάτος ορθογωνίου: ${args.width}`;
  }
  if (args.height <= 0) {
    return `Μη έγκυρο ύψος ορθογωνίου: ${args.height}`;
  }
  return null;
}

function validateCircle(args: DrawCircleArgs): string | null {
  if (args.radius <= 0) {
    return `Μη έγκυρη ακτίνα κύκλου: ${args.radius}`;
  }
  return null;
}

// ============================================================================
// QUERY ENTITIES
// ============================================================================

interface QueryResult {
  message: string;
}

function executeQuery(
  args: QueryEntitiesArgs,
  getScene: (levelId: string) => SceneModel | null,
  levelId: string,
): QueryResult {
  const scene = getScene(levelId);
  if (!scene || scene.entities.length === 0) {
    return { message: 'Ο καμβάς είναι κενός — δεν υπάρχουν entities.' };
  }

  let filtered = scene.entities;

  if (args.type) {
    filtered = filtered.filter(e => e.type === args.type);
  }
  if (args.layer) {
    filtered = filtered.filter(e => e.layer === args.layer);
  }

  if (filtered.length === 0) {
    const filterDesc = [
      args.type ? `τύπος: ${args.type}` : null,
      args.layer ? `layer: ${args.layer}` : null,
    ].filter(Boolean).join(', ');
    return { message: `Δεν βρέθηκαν entities ${filterDesc ? `(${filterDesc})` : ''}.` };
  }

  // Count by type
  const countByType = new Map<string, number>();
  for (const entity of filtered) {
    const current = countByType.get(entity.type) ?? 0;
    countByType.set(entity.type, current + 1);
  }

  const summary = Array.from(countByType.entries())
    .map(([type, count]) => `${count} ${type}`)
    .join(', ');

  return { message: `Βρέθηκαν ${filtered.length} entities: ${summary}.` };
}

// ============================================================================
// MAIN EXECUTOR
// ============================================================================

export interface ExecuteDxfAiToolCallsOptions {
  /** Function to get current scene (from levelManager) */
  getScene: (levelId: string) => SceneModel | null;
  /** Function to set scene (from levelManager) */
  setScene: (levelId: string, scene: SceneModel) => void;
  /** Current level ID */
  levelId: string;
}

/**
 * Execute AI tool calls on the canvas.
 *
 * Processes each tool call, validates arguments, creates entities,
 * and uses completeEntities() for batch insertion.
 *
 * @param toolCalls - Array of tool calls from AI response
 * @param options - Canvas access options (getScene, setScene, levelId)
 * @returns Execution result with created entity IDs and messages
 */
export function executeDxfAiToolCalls(
  toolCalls: DxfAiToolCall[],
  options: ExecuteDxfAiToolCallsOptions,
): DxfAiExecutionResult {
  const { getScene, setScene, levelId } = options;
  const entitiesToCreate: Entity[] = [];
  const messages: string[] = [];
  const errors: string[] = [];

  // Safety: limit entities per command
  let entityCount = 0;

  for (const call of toolCalls) {
    switch (call.name) {
      case 'draw_line': {
        const args = call.arguments as DrawLineArgs;
        const validationError = validateLine(args);
        if (validationError) {
          errors.push(validationError);
          break;
        }
        if (entityCount >= DXF_AI_LIMITS.MAX_ENTITIES_PER_COMMAND) {
          errors.push(`Μέγιστο όριο ${DXF_AI_LIMITS.MAX_ENTITIES_PER_COMMAND} entities ανά εντολή`);
          break;
        }
        entitiesToCreate.push(buildLineEntity(args));
        entityCount++;
        break;
      }

      case 'draw_rectangle': {
        const args = call.arguments as DrawRectangleArgs;
        const validationError = validateRectangle(args);
        if (validationError) {
          errors.push(validationError);
          break;
        }
        if (entityCount >= DXF_AI_LIMITS.MAX_ENTITIES_PER_COMMAND) {
          errors.push(`Μέγιστο όριο ${DXF_AI_LIMITS.MAX_ENTITIES_PER_COMMAND} entities ανά εντολή`);
          break;
        }
        entitiesToCreate.push(buildRectangleEntity(args));
        entityCount++;
        break;
      }

      case 'draw_circle': {
        const args = call.arguments as DrawCircleArgs;
        const validationError = validateCircle(args);
        if (validationError) {
          errors.push(validationError);
          break;
        }
        if (entityCount >= DXF_AI_LIMITS.MAX_ENTITIES_PER_COMMAND) {
          errors.push(`Μέγιστο όριο ${DXF_AI_LIMITS.MAX_ENTITIES_PER_COMMAND} entities ανά εντολή`);
          break;
        }
        entitiesToCreate.push(buildCircleEntity(args));
        entityCount++;
        break;
      }

      case 'query_entities': {
        const args = call.arguments as QueryEntitiesArgs;
        const queryResult = executeQuery(args, getScene, levelId);
        messages.push(queryResult.message);
        break;
      }

      case 'undo_action': {
        // Phase 1: undo not yet integrated — report to user
        messages.push('Η αναίρεση δεν είναι ακόμα διαθέσιμη στο AI assistant (Phase 1b).');
        break;
      }
    }
  }

  // Batch insert all created entities
  if (entitiesToCreate.length > 0) {
    const completeOptions: Omit<CompleteEntityOptions, 'skipEvent' | 'skipToolPersistence'> = {
      tool: 'select', // AI-created entities don't lock a drawing tool
      levelId,
      getScene,
      setScene,
    };

    const results = completeEntities(entitiesToCreate, completeOptions);
    const createdIds = results.filter(r => r.success).map(r => r.entityId);
    const failedCount = results.filter(r => !r.success).length;

    if (failedCount > 0) {
      errors.push(`${failedCount} entity/ies απέτυχαν κατά τη δημιουργία`);
    }

    return {
      success: createdIds.length > 0 || messages.length > 0,
      entitiesCreated: createdIds,
      message: messages.join('\n'),
      error: errors.length > 0 ? errors.join('; ') : undefined,
    };
  }

  return {
    success: errors.length === 0,
    entitiesCreated: [],
    message: messages.join('\n'),
    error: errors.length > 0 ? errors.join('; ') : undefined,
  };
}
