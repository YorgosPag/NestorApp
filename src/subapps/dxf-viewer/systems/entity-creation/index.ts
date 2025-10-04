/**
 * ENTITY CREATION SYSTEM
 * Centralized entity creation and drawing tools management
 */

// Configuration and types
export * from './config';

// Utilities
export * from './utils';

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