/**
 * CONSTRAINTS SYSTEM
 * Centralized ortho/polar constraint management system for DXF viewer
 */

// Configuration (types and functions)
export * from './config';

// Utilities
export * from './utils';

// Hooks (can be imported safely)
export { 
  useConstraints, 
  useOrthoConstraints, 
  usePolarConstraints,
  useConstraintApplication,
  useConstraintManagement,
  useCoordinateConversion,
  useConstraintSettings,
  useConstraintInput,
  useConstraintVisualization,
  // Legacy compatibility hooks
  useOrtho,
  usePolar,
  useOrthoPolar
} from './useConstraints';

// Components need to be imported from .tsx files directly
// For components, import directly: import { ConstraintsSystem } from './systems/constraints/ConstraintsSystem';

// Re-export main system component for convenience
export { ConstraintsSystem, useConstraintsContext } from './ConstraintsSystem';