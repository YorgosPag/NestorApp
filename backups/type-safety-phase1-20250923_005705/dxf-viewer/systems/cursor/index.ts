/**
 * CURSOR SYSTEM
 * Centralized cursor management with AutoCAD-style behavior
 */

// Configuration and types
export * from './config';

// Utilities
export * from './utils';

// Hooks (can be imported safely)
export { useCursor, useCursorState, useCursorSettings, useCursorActions, useCursorContext } from './useCursor';

// Components need to be imported from .tsx files directly
// For components, import directly: import { CursorSystem } from './systems/cursor/CursorSystem';

// Re-export main system component for convenience
export { CursorSystem, useCursorSystemContext } from './CursorSystem';