/**
 * ENTITY CREATION SYSTEM
 * Centralized entity creation and drawing tools management
 *
 * 🏢 ENTERPRISE (2026-01-30): ADR-055 Event Bus + Command Pattern Integration
 * - LevelSceneManagerAdapter: Bridges Command Pattern with Level System
 * - useEntityCreationManager: Listens to EventBus and executes Commands
 * - emitEntityCreateRequest: Standard way to request entity creation
 */

// Configuration and types
export * from './config';

// Utilities
export * from './utils';

// 🏢 ENTERPRISE (2026-01-30): Event Bus + Command Pattern Integration
// This is the new enterprise way to create entities with undo/redo support
export { LevelSceneManagerAdapter, createLevelSceneManagerAdapter } from './LevelSceneManagerAdapter';
export {
  useEntityCreationManager,
  emitEntityCreateRequest,
  stripEntityId,
  type EntityCreationManagerConfig,
} from './useEntityCreationManager';

// Hooks (can be imported safely)
export {
  useEntityCreation,
  useEntityCreationMethods,
  useDrawingState,
  useDrawingInteraction,
  useDrawing,
  useDrawingSystem
} from './useEntityCreation';

// Re-export existing drawing components for easy access
export { useUnifiedDrawing } from '../../hooks/drawing/useUnifiedDrawing';

// Components need to be imported from .tsx files directly
// For components, import directly: import { EntityCreationSystem } from './systems/entity-creation/EntityCreationSystem';

// Re-export main system component for convenience
export { EntityCreationSystem, useEntityCreationContext } from './EntityCreationSystem';