/**
 * LEVELS SYSTEM
 * Centralized level and floorplan management system for DXF viewer
 */

// Configuration (types and functions)
export * from './config';

// Utilities
export * from './utils';

// Hooks (can be imported safely)
export { 
  useLevels, 
  useLevelManager,
  useLevelSystem,
  useLevelOperations,
  useFloorplanOperations,
  useImportWizard,
  useLevelState,
  useLevelSelection,
  useLevelSettings,
  // Type exports
  type LevelsHookReturn,
  type LevelSystemState,
  type LevelSystemActions
} from './useLevels';

// Components need to be imported from .tsx files directly
// For components, import directly: import { LevelsSystem } from './systems/levels/LevelsSystem';

// Re-export main system component for convenience
export { LevelsSystem, useLevelsContext } from './LevelsSystem';