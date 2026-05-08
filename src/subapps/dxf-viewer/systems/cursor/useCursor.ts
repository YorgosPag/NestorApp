/**
 * CURSOR SYSTEM HOOK
 * Standalone hook for accessing cursor context and utilities
 */

import { useContext, useSyncExternalStore } from 'react';
import { CursorContext } from './CursorSystem';
import { ImmediatePositionStore } from './ImmediatePositionStore';

export function useCursor() {
  const context = useContext(CursorContext);
  if (!context) {
    throw new Error('useCursor must be used within a CursorSystem');
  }
  return context;
}

// 🚀 PERF (2026-05-08): position-selective subscriptions via
// useSyncExternalStore. Only components that read position re-render on
// mousemove; the rest of the CursorSystem subtree stays stable.
const subscribePosition = (cb: () => void): (() => void) =>
  ImmediatePositionStore.subscribe(cb);
const getPositionSnapshot = () => ImmediatePositionStore.getPosition();
export function useCursorPosition() {
  return useSyncExternalStore(subscribePosition, getPositionSnapshot, getPositionSnapshot);
}

const subscribeWorldPosition = (cb: () => void): (() => void) =>
  ImmediatePositionStore.subscribeWorldPosition(cb);
const getWorldPositionSnapshot = () => ImmediatePositionStore.getWorldPosition();
export function useCursorWorldPosition() {
  return useSyncExternalStore(
    subscribeWorldPosition,
    getWorldPositionSnapshot,
    getWorldPositionSnapshot,
  );
}

// Additional convenience hooks
// 🚀 PERF (2026-05-08): position + worldPosition now come from
// `ImmediatePositionStore` via useSyncExternalStore so this hook stays usable
// without scheduling React re-renders on the entire CursorSystem subtree.
export function useCursorState() {
  const cursor = useCursor();
  const position = useCursorPosition();
  const worldPosition = useCursorWorldPosition();
  return {
    position,
    viewport: cursor.viewport,
    isActive: cursor.isActive,
    tool: cursor.tool,
    snapPoint: cursor.snapPoint,
    worldPosition,
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