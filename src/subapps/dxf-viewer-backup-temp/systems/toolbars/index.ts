/**
 * TOOLBARS SYSTEM
 * Centralized toolbar and tool runner management system for DXF viewer
 */

// Configuration (types and functions)
export * from './config';

// Utilities
export * from './utils';

// Hooks (can be imported safely)
export { 
  useToolbars, 
  useActiveTool, 
  useToolRunner,
  useToolbarConfig,
  useToolDefinitions,
  useToolStates,
  useHotkeys,
  useToolbarCustomization,
  useToolbarSettings,
  // Legacy compatibility hooks
  useToolbar,
  useTools,
  useToolSystem
} from './useToolbars';

// Components need to be imported from .tsx files directly
// For components, import directly: import { ToolbarsSystem } from './systems/toolbars/ToolbarsSystem';

// Re-export main system component for convenience
export { ToolbarsSystem, useToolbarsContext } from './ToolbarsSystem';