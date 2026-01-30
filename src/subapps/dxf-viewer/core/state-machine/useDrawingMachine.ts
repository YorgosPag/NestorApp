"use client";

/**
 * DRAWING STATE MACHINE - REACT HOOK
 *
 * 🏢 ENTERPRISE (2026-01-25): React integration for Drawing State Machine
 *
 * Features:
 * - Reactive state updates via useSyncExternalStore
 * - Type-safe event dispatching
 * - Automatic subscription management
 * - Keyboard shortcut integration
 */

import { useCallback, useEffect, useSyncExternalStore, useRef } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type {
  DrawingStateType,
  DrawingContext,
  DrawingMachineState,
  DrawingStateMachineConfig,
  DrawingStateInfo,
} from './interfaces';
import {
  DrawingStateMachine,
  getGlobalDrawingStateMachine,
  createDrawingStateMachine,
} from './DrawingStateMachine';

// ============================================================================
// HOOK TYPES
// ============================================================================

export interface UseDrawingMachineOptions {
  /** Use global singleton instance */
  useGlobal?: boolean;

  /** Custom configuration (ignored if useGlobal=true) */
  config?: DrawingStateMachineConfig;

  /** Enable keyboard shortcuts (ESC to cancel, Enter to complete) */
  enableKeyboardShortcuts?: boolean;
}

export interface UseDrawingMachineReturn {
  // State
  state: DrawingStateType;
  context: DrawingContext;
  stateInfo: DrawingStateInfo;
  fullState: DrawingMachineState;

  // Derived state
  isIdle: boolean;
  isDrawing: boolean;
  canComplete: boolean;
  canCancel: boolean;
  canAddPoint: boolean;
  canPreview: boolean;
  pointCount: number;
  hasMinPoints: boolean;

  // Actions
  selectTool: (toolType: string) => void;
  deselectTool: () => void;
  addPoint: (point: Point2D, snapped?: boolean, snapType?: string) => void;
  undoPoint: () => void;  // 🏢 ADR-047: Remove last point (AutoCAD U command)
  moveCursor: (position: Point2D, snapped?: boolean, snapType?: string) => void;
  complete: (forced?: boolean) => void;
  cancel: (reason?: string) => void;
  reset: () => void;

  // Machine instance (for advanced usage)
  machine: DrawingStateMachine;
}

// ============================================================================
// MAIN HOOK
// ============================================================================

/**
 * React hook for using the Drawing State Machine
 *
 * @example
 * ```tsx
 * function DrawingCanvas() {
 *   const {
 *     state,
 *     isDrawing,
 *     canComplete,
 *     addPoint,
 *     complete,
 *     cancel
 *   } = useDrawingMachine();
 *
 *   const handleClick = (point: Point2D) => {
 *     addPoint(point);
 *   };
 *
 *   const handleDoubleClick = () => {
 *     if (canComplete) complete();
 *   };
 *
 *   return (
 *     <canvas
 *       onClick={handleClick}
 *       onDoubleClick={handleDoubleClick}
 *     />
 *   );
 * }
 * ```
 */
export function useDrawingMachine(
  options: UseDrawingMachineOptions = {}
): UseDrawingMachineReturn {
  const {
    useGlobal = true,
    config,
    enableKeyboardShortcuts = false,
  } = options;

  // Get or create machine instance
  const machineRef = useRef<DrawingStateMachine | null>(null);

  if (!machineRef.current) {
    machineRef.current = useGlobal
      ? getGlobalDrawingStateMachine()
      : createDrawingStateMachine(config);
  }

  const machine = machineRef.current;

  // Subscribe to state changes using useSyncExternalStore
  const fullState = useSyncExternalStore(
    useCallback((callback) => machine.subscribe(callback), [machine]),
    useCallback(() => machine.getState(), [machine]),
    useCallback(() => machine.getState(), [machine]) // Server snapshot
  );

  // Derived state
  const state = fullState.currentState;
  const context = fullState.context;
  const stateInfo = machine.getStateInfo();

  const isIdle = state === 'IDLE';
  const isDrawing =
    state === 'TOOL_READY' ||
    state === 'COLLECTING_POINTS' ||
    state === 'PREVIEWING' ||
    state === 'COMPLETING';

  const canComplete = machine.canComplete();
  const canCancel = machine.canCancel();
  const canAddPoint = machine.canAddPoint();
  const canPreview = machine.canPreview();

  const pointCount = context.points.length;
  const hasMinPoints = pointCount >= context.minPoints;

  // Actions (memoized)
  const selectTool = useCallback(
    (toolType: string) => machine.selectTool(toolType),
    [machine]
  );

  const deselectTool = useCallback(
    () => machine.deselectTool(),
    [machine]
  );

  const addPoint = useCallback(
    (point: Point2D, snapped = false, snapType?: string) =>
      machine.addPoint(point, snapped, snapType),
    [machine]
  );

  // 🏢 ADR-047: Undo last point (AutoCAD U command)
  const undoPoint = useCallback(
    () => machine.undoPoint(),
    [machine]
  );

  const moveCursor = useCallback(
    (position: Point2D, snapped = false, snapType?: string) =>
      machine.moveCursor(position, snapped, snapType),
    [machine]
  );

  const complete = useCallback(
    (forced = false) => machine.complete(forced),
    [machine]
  );

  const cancel = useCallback(
    (reason?: string) => machine.cancel(reason),
    [machine]
  );

  const reset = useCallback(
    () => machine.reset(),
    [machine]
  );

  // Keyboard shortcuts
  useEffect(() => {
    if (!enableKeyboardShortcuts) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC to cancel
      if (e.key === 'Escape' && canCancel) {
        e.preventDefault();
        cancel('ESC key pressed');
      }

      // Enter to complete
      if (e.key === 'Enter' && canComplete) {
        e.preventDefault();
        complete();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enableKeyboardShortcuts, canCancel, canComplete, cancel, complete]);

  return {
    // State
    state,
    context,
    stateInfo,
    fullState,

    // Derived state
    isIdle,
    isDrawing,
    canComplete,
    canCancel,
    canAddPoint,
    canPreview,
    pointCount,
    hasMinPoints,

    // Actions
    selectTool,
    deselectTool,
    addPoint,
    undoPoint,
    moveCursor,
    complete,
    cancel,
    reset,

    // Machine instance
    machine,
  };
}

// ============================================================================
// SPECIALIZED HOOKS
// ============================================================================

/**
 * Hook for keyboard shortcuts only
 * Use when you need keyboard integration without full state management
 */
export function useDrawingKeyboardShortcuts(
  onCancel: () => void,
  onComplete: () => void,
  enabled = true
): void {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        onComplete();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, onCancel, onComplete]);
}

/**
 * Hook for state info display
 * Use in status bars or debug panels
 */
export function useDrawingStateInfo(): {
  stateName: string;
  stateDescription: string;
  pointCount: number;
  minPoints: number;
  maxPoints: number;
  toolType: string | null;
} {
  const { stateInfo, context } = useDrawingMachine();

  return {
    stateName: stateInfo.displayName,
    stateDescription: stateInfo.description,
    pointCount: context.points.length,
    minPoints: context.minPoints,
    maxPoints: context.maxPoints,
    toolType: context.toolType,
  };
}

/**
 * Hook for state history (debugging)
 */
export function useDrawingStateHistory(): readonly DrawingStateType[] {
  const { fullState } = useDrawingMachine();
  return fullState.history;
}
