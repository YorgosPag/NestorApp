/**
 * SELECTION SYSTEM
 * Centralized selection management system for entities and regions
 */

// Configuration and types
export * from './config';

// Utilities
export * from './utils';

// Hooks (can be imported safely) - now exported from SelectionSystem
export { useSelection, useSelectionContext } from './SelectionSystem';

// Components need to be imported from .tsx files directly
// For components, import directly: import { SelectionSystem } from './systems/selection/SelectionSystem';

// Re-export main system component for convenience
export { SelectionSystem } from './SelectionSystem';