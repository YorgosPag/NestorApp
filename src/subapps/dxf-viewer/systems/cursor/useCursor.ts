/**
 * CURSOR SYSTEM HOOK
 * Standalone hook for accessing cursor context and utilities
 */

import { useContext } from 'react';
import { CursorContext } from './CursorSystem';

export function useCursor() {
  const context = useContext(CursorContext);
  if (!context) {
    throw new Error('useCursor must be used within a CursorSystem');
  }
  return context;
}

// Additional convenience hooks
export function useCursorState() {
  const cursor = useCursor();
  return {
    position: cursor.position,
    viewport: cursor.viewport,
    isActive: cursor.isActive,
    tool: cursor.tool,
    snapPoint: cursor.snapPoint,
    worldPosition: cursor.worldPosition,
  };
}

export function useCursorSettings() {
  const cursor = useCursor();
  return {
    settings: cursor.settings,
    updateSettings: cursor.updateSettings,
    resetToDefaults: cursor.resetToDefaults,
  };
}

export function useCursorActions() {
  const cursor = useCursor();
  return {
    updatePosition: cursor.updatePosition,
    updateViewport: cursor.updateViewport,
    setActive: cursor.setActive,
    setTool: cursor.setTool,
    setSnapPoint: cursor.setSnapPoint,
    setWorldPosition: cursor.setWorldPosition,
  };
}

// Backward compatibility
export const useCursorContext = useCursor;