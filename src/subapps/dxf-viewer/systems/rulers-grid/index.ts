/**
 * RULERS/GRID SYSTEM
 * Centralized rulers and grid management system for DXF viewer
 */

// Configuration (types and functions)
export * from './config';

// Utilities
export * from './utils';

// Hooks (can be imported safely)
export {
  useRulersGrid,
  useRulerState,
  useGridState,
  useSnapState,
  useOriginState,
  useRulersGridCalculations,
  useRulersGridDisplay,
  useRulersGridSettings
} from './useRulersGrid';

// Components need to be imported from .tsx files directly
// For components, import directly: import { RulersGridSystem } from './systems/rulers-grid/RulersGridSystem';

// Re-export main system component for convenience
export { RulersGridSystem, useRulersGridContext } from './RulersGridSystem';