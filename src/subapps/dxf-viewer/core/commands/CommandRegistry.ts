/**
 * COMMAND REGISTRY
 *
 * 🏢 ENTERPRISE (2026-01-25): Command factory registry for deserialization
 * Enables restoring commands from persisted state.
 *
 * Features:
 * - Register command factories by type
 * - Deserialize commands from JSON
 * - Support for custom command types (plugins)
 */

import { createModuleLogger } from '@/lib/telemetry';
import type { ICommandRegistry, CommandFactory, SerializedCommand, ISceneManager, ICommand } from './interfaces';

const logger = createModuleLogger('CommandRegistry');

/**
 * Command Registry implementation
 * Maps command types to factory functions for deserialization
 */
export class CommandRegistry implements ICommandRegistry {
  private factories: Map<string, CommandFactory> = new Map();

  /**
   * Register a command factory
   */
  register(type: string, factory: CommandFactory): void {
    if (this.factories.has(type)) {
      logger.warn(`Overwriting factory for type: ${type}`);
    }
    this.factories.set(type, factory);
  }

  /**
   * Unregister a command factory
   */
  unregister(type: string): void {
    this.factories.delete(type);
  }

  /**
   * Create command from serialized data
   */
  deserialize(serialized: SerializedCommand, sceneManager: ISceneManager): ICommand | null {
    const factory = this.factories.get(serialized.type);

    if (!factory) {
      logger.warn(`No factory registered for type: ${serialized.type}`);
      return null;
    }

    try {
      return factory(serialized, sceneManager);
    } catch (error) {
      logger.error('Failed to deserialize command', { error });
      return null;
    }
  }

  /**
   * Check if type is registered
   */
  isRegistered(type: string): boolean {
    return this.factories.has(type);
  }

  /**
   * Get all registered types
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.factories.keys());
  }

  /**
   * Get factory count
   */
  size(): number {
    return this.factories.size;
  }
}

// ============================================================================
// GLOBAL REGISTRY INSTANCE
// ============================================================================

let globalRegistry: CommandRegistry | null = null;

/**
 * Get the global command registry
 */
export function getGlobalCommandRegistry(): CommandRegistry {
  if (!globalRegistry) {
    globalRegistry = new CommandRegistry();
  }
  return globalRegistry;
}

/**
 * Reset the global registry (for testing)
 */
export function resetGlobalCommandRegistry(): void {
  globalRegistry = null;
}

// ============================================================================
// BUILT-IN COMMAND FACTORIES
// ============================================================================

/**
 * Register all built-in command factories
 * Call this during application initialization
 */
export function registerBuiltInCommands(registry: ICommandRegistry): void {
  // Import factories lazily to avoid circular dependencies
  const registerFactories = async () => {
    // Create Entity
    registry.register('create-entity', (serialized, sceneManager) => {
      const { CreateEntityCommand } = require('./entity-commands/CreateEntityCommand');
      const data = serialized.data as {
        entityData: Record<string, unknown>;
        options?: Record<string, unknown>;
      };
      return new CreateEntityCommand(data.entityData, sceneManager, data.options);
    });

    // Delete Entity
    registry.register('delete-entity', (serialized, sceneManager) => {
      const { DeleteEntityCommand } = require('./entity-commands/DeleteEntityCommand');
      const data = serialized.data as { entityId: string };
      return new DeleteEntityCommand(data.entityId, sceneManager);
    });

    // Move Vertex
    registry.register('move-vertex', (serialized, sceneManager) => {
      const { MoveVertexCommand } = require('./vertex-commands/MoveVertexCommand');
      const data = serialized.data as {
        entityId: string;
        vertexIndex: number;
        oldPosition: { x: number; y: number };
        newPosition: { x: number; y: number };
        isDragging?: boolean;
      };
      return new MoveVertexCommand(
        data.entityId,
        data.vertexIndex,
        data.oldPosition,
        data.newPosition,
        sceneManager,
        data.isDragging ?? false
      );
    });

    // Add Vertex
    registry.register('add-vertex', (serialized, sceneManager) => {
      const { AddVertexCommand } = require('./vertex-commands/AddVertexCommand');
      const data = serialized.data as {
        entityId: string;
        insertIndex: number;
        position: { x: number; y: number };
      };
      return new AddVertexCommand(data.entityId, data.insertIndex, data.position, sceneManager);
    });

    // Remove Vertex
    registry.register('remove-vertex', (serialized, sceneManager) => {
      const { RemoveVertexCommand } = require('./vertex-commands/RemoveVertexCommand');
      const data = serialized.data as {
        entityId: string;
        vertexIndex: number;
      };
      return new RemoveVertexCommand(data.entityId, data.vertexIndex, sceneManager);
    });

    // Extend Entities (ADR-353) — single undo step per pick
    registry.register('extend-entities', (serialized, sceneManager) => {
      const { ExtendEntityCommand } = require('./entity-commands/ExtendEntityCommand');
      const data = serialized.data as {
        operations: ReadonlyArray<import('../../systems/extend/extend-types').ExtendOperation>;
        pickPoint: { x: number; y: number };
      };
      return new ExtendEntityCommand(
        { operations: data.operations, pickPoint: data.pickPoint },
        sceneManager,
      );
    });

    // Trim Entities (ADR-350) — single undo step per pick
    registry.register('trim-entities', (serialized, sceneManager) => {
      const { TrimEntityCommand } = require('./entity-commands/TrimEntityCommand');
      const data = serialized.data as {
        operations: ReadonlyArray<import('../../systems/trim/trim-types').TrimOperation>;
        pickPoint: { x: number; y: number };
        inverse: boolean;
      };
      return new TrimEntityCommand(
        { operations: data.operations, pickPoint: data.pickPoint, inverse: data.inverse },
        sceneManager,
      );
    });

    // Compound Command
    registry.register('compound', (serialized, sceneManager) => {
      const { CompoundCommand } = require('./CompoundCommand');
      const data = serialized.data as { commands: SerializedCommand[] };
      const commands: ICommand[] = [];

      for (const cmdData of data.commands) {
        const cmd = registry.deserialize(cmdData, sceneManager);
        if (cmd) commands.push(cmd);
      }

      return new CompoundCommand(serialized.name, commands);
    });

    // ─── ADR-358 §5.6.bis — Layer commands (Phase 10) ────────────────────────
    registry.register('layer-isolate', (serialized) => {
      const { LayerIsolateCommand } = require('./layer/LayerIsolateCommand');
      const data = serialized.data as {
        targetLayerIds: string[];
        settings: { mode: 'dim' | 'freeze'; dimOpacityPercent: number };
        category: string | null;
      };
      return new LayerIsolateCommand({
        targetLayerIds: data.targetLayerIds,
        settings: data.settings,
        category: data.category
      });
    });

    registry.register('layer-isolate-inverse', (serialized) => {
      const { LayerIsolateInverseCommand } = require('./layer/LayerIsolateInverseCommand');
      const data = serialized.data as {
        targetLayerIds: string[];
        settings: { mode: 'dim' | 'freeze'; dimOpacityPercent: number };
        category: string | null;
      };
      return new LayerIsolateInverseCommand({
        targetLayerIds: data.targetLayerIds,
        settings: data.settings,
        category: data.category
      });
    });

    registry.register('layer-unisolate', () => {
      const { LayerUnisolateCommand } = require('./layer/LayerUnisolateCommand');
      return new LayerUnisolateCommand();
    });

    registry.register('layer-dim', (serialized) => {
      const { LayerDimCommand } = require('./layer/LayerDimCommand');
      const data = serialized.data as {
        targetLayerIds: string[];
        dimOpacityPercent: number;
        category: string | null;
      };
      return new LayerDimCommand({
        targetLayerIds: data.targetLayerIds,
        dimOpacityPercent: data.dimOpacityPercent,
        category: data.category
      });
    });

    registry.register('layer-off', (serialized) => {
      const { LayerOffCommand } = require('./layer/LayerOffCommand');
      const data = serialized.data as { layerId: string };
      return new LayerOffCommand({ layerId: data.layerId });
    });

    registry.register('layer-freeze', (serialized) => {
      const { LayerFreezeCommand } = require('./layer/LayerFreezeCommand');
      const data = serialized.data as { layerId: string };
      return new LayerFreezeCommand({ layerId: data.layerId });
    });

    registry.register('layer-lock', (serialized) => {
      const { LayerLockCommand } = require('./layer/LayerLockCommand');
      const data = serialized.data as { layerId: string };
      return new LayerLockCommand({ layerId: data.layerId });
    });

    registry.register('layer-thaw-all', () => {
      const { LayerThawAllCommand } = require('./layer/LayerThawAllCommand');
      return new LayerThawAllCommand();
    });

    registry.register('layer-on-all', () => {
      const { LayerOnAllCommand } = require('./layer/LayerOnAllCommand');
      return new LayerOnAllCommand();
    });
  };

  // Execute registration
  registerFactories().catch((error) => {
    logger.error('Failed to register built-in commands', { error });
  });
}
