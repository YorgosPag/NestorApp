/**
 * CURSOR SYSTEM HOOK
 * Standalone hook for accessing cursor context and utilities
 */

import { useContext, useSyncExternalStore } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import { CursorContext } from './CursorSystem';
import { ImmediatePositionStore } from './ImmediatePositionStore';
import { SelectionStore } from './SelectionStore';

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

// 🚀 PERF / SSoT GATING (2026-06-04, ADR-040): when a leaf is inactive
// (its tool is idle / not awaiting a position) it passes `enabled = false`.
// We then subscribe to a NO-OP store and return a stable `null`, so the
// listener is NEVER registered on `worldListeners` and the leaf does NOT
// re-render on the 60fps mousemove stream. Only the single active tool's
// leaf subscribes. This is the SSoT gate — every preview/ghost leaf funnels
// through it instead of forking its own subscription guard.
// React re-subscribes automatically when `enabled` flips (the subscribe ref
// changes), so activation/deactivation is reactive with zero extra wiring.
const noopSubscribe = (): (() => void) => () => {};
const getNullWorldPosition = (): Point2D | null => null;
export function useCursorWorldPosition(enabled: boolean = true): Point2D | null {
  return useSyncExternalStore(
    enabled ? subscribeWorldPosition : noopSubscribe,
    enabled ? getWorldPositionSnapshot : getNullWorldPosition,
    enabled ? getWorldPositionSnapshot : getNullWorldPosition,
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

// 🚀 PERF (2026-05-10): Selection state via useSyncExternalStore.
// Only DxfCanvas and LayerCanvas subscribe; CursorSystem provider stays stable
// across mousemove-during-selection (no reducer dispatch, no cascade).
const subscribeSelection = (cb: () => void) => SelectionStore.subscribe(cb);
const getSelectionSnapshot = () => SelectionStore.getSnapshot();
export function useSelectionState() {
  return useSyncExternalStore(subscribeSelection, getSelectionSnapshot, getSelectionSnapshot);
}

// Backward compatibility
export const useCursorContext = useCursor;