/**
 * GRIPS SYSTEM
 * Centralized grips management with AutoCAD-style behavior
 */

// Configuration and types
export * from './config';

// Utilities
export * from './utils';

// Hooks (can be imported safely)
export { useGrips, useGripSettings, useGripInteraction, useGrip, useGripSystem } from './useGrips';

// Re-export existing grips components for easy access
export { useUnifiedGripsSystem } from '../../hooks/grips/useUnifiedGripsSystem';

// Components need to be imported from .tsx files directly
// For components, import directly: import { GripsSystem } from './systems/grips/GripsSystem';

// Re-export main system component for convenience
export { GripsSystem, useGripsContext } from './GripsSystem';