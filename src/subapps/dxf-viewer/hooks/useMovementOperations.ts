/**
 * USE MOVEMENT OPERATIONS HOOK
 *
 * 🏢 ENTERPRISE (2026-01-25): Unified hook for all entity movement operations
 *
 * This hook combines all movement capabilities:
 * - Nudge (Arrow keys) - 1 unit normal, 10 with Shift
 * - Drag (Mouse drag) - Direct entity manipulation
 * - Move Tool (M key) - AutoCAD-style base point + destination
 *
 * Enterprise Pattern: Facade + Command Pattern
 * - Unified interface for all movement operations
 * - All operations use MoveEntityCommand for undo/redo
 * - Consistent behavior across input methods
 *
 * Usage:
 * ```tsx
 * const {
 *   // Nudge
 *   nudge,
 *   nudgeUp, nudgeDown, nudgeLeft, nudgeRight,
 *   // Drag
 *   isDragging, startDrag, updateDrag, endDrag,
 *   // Move Tool
 *   isMoveTool, activateMoveTool, deactivateMoveTool,
 *   // State
 *   canMove,
 * } = useMovementOperations({ selectedEntityIds });
 * ```
 *
 * @see HYBRID_LAYER_MOVEMENT_ARCHITECTURE.md
 * @see hooks/useMoveEntities.ts
 * @see hooks/useEntityDrag.ts
 */

import { useCallback, useMemo } from 'react';
import type { Point2D } from '../rendering/types/Types';
import { useMoveEntities } from './useMoveEntities';
import { useEntityDrag, type UseEntityDragOptions } from './useEntityDrag';

// ============================================================================
// 🏢 ENTERPRISE: Configuration Constants
// ============================================================================

/**
 * Nudge step configuration
 * Based on AutoCAD/Figma standards
 */
export const NUDGE_CONFIG = {
  /** Base nudge step (world units) */
  BASE_STEP: 1,
  /** Large nudge multiplier (Shift key) */
  LARGE_MULTIPLIER: 10,
  /** Small nudge divisor (Ctrl key - for precision) */
  SMALL_DIVISOR: 10,
} as const;

/**
 * Debug mode flag
 */
const DEBUG_MODE = process.env.NODE_ENV === 'development';

// ============================================================================
// 🏢 ENTERPRISE: Type Definitions
// ============================================================================

/**
 * Nudge direction
 */
export type NudgeDirection = 'up' | 'down' | 'left' | 'right';

/**
 * Nudge modifier for step size
 */
export type NudgeModifier = 'normal' | 'large' | 'small';

/**
 * Options for useMovementOperations hook
 */
export interface UseMovementOperationsOptions {
  /** Currently selected entity IDs */
  selectedEntityIds: string[];
  /** Transform screen coordinates to world coordinates */
  screenToWorld?: (point: Point2D) => Point2D;
  /** Enable snap to grid */
  snapToGrid?: boolean;
  /** Grid snap size (world units) */
  gridSize?: number;
  /** Custom nudge step size */
  nudgeStep?: number;
  /** Custom large nudge multiplier */
  largeNudgeMultiplier?: number;
  /** Callback when movement starts */
  onMoveStart?: () => void;
  /** Callback when movement ends */
  onMoveEnd?: (delta: Point2D) => void;
}

/**
 * Return type for useMovementOperations hook
 */
export interface UseMovementOperationsReturn {
  // ============================================================================
  // Nudge Operations (Arrow Keys)
  // ============================================================================

  /** Nudge selected entities in direction */
  nudge: (direction: NudgeDirection, modifier?: NudgeModifier) => void;

  /** Nudge up (positive Y) */
  nudgeUp: (modifier?: NudgeModifier) => void;

  /** Nudge down (negative Y) */
  nudgeDown: (modifier?: NudgeModifier) => void;

  /** Nudge left (negative X) */
  nudgeLeft: (modifier?: NudgeModifier) => void;

  /** Nudge right (positive X) */
  nudgeRight: (modifier?: NudgeModifier) => void;

  /** Get nudge step for modifier */
  getNudgeStep: (modifier: NudgeModifier) => number;

  // ============================================================================
  // Drag Operations (Mouse/Touch)
  // ============================================================================

  /** Is currently dragging */
  isDragging: boolean;

  /** Current drag delta */
  dragDelta: Point2D;

  /** Start drag at screen point */
  startDrag: (screenPoint: Point2D) => void;

  /** Update drag with current screen point */
  updateDrag: (screenPoint: Point2D) => void;

  /** End drag and apply movement */
  endDrag: () => void;

  /** Cancel drag without applying */
  cancelDrag: () => void;

  // ============================================================================
  // Direct Move (Command-based)
  // ============================================================================

  /** Move selected entities by delta */
  moveByDelta: (delta: Point2D) => void;

  // ============================================================================
  // State
  // ============================================================================

  /** Can move (has selection) */
  canMove: boolean;

  /** Number of selected entities */
  selectionCount: number;

  // ============================================================================
  // Undo/Redo
  // ============================================================================

  /** Undo last movement */
  undo: () => boolean;

  /** Redo last undone movement */
  redo: () => boolean;

  /** Can undo */
  canUndo: boolean;

  /** Can redo */
  canRedo: boolean;
}

// ============================================================================
// 🏢 ENTERPRISE: Utility Functions
// ============================================================================

/**
 * Debug logger
 */
function debugLog(message: string, ...args: unknown[]): void {
  if (DEBUG_MODE) {
    console.debug(`[MovementOps] ${message}`, ...args);
  }
}

/**
 * Calculate nudge step based on modifier
 */
function calculateNudgeStep(
  baseStep: number,
  modifier: NudgeModifier,
  largeMultiplier: number
): number {
  switch (modifier) {
    case 'large':
      return baseStep * largeMultiplier;
    case 'small':
      return baseStep / NUDGE_CONFIG.SMALL_DIVISOR;
    case 'normal':
    default:
      return baseStep;
  }
}

/**
 * Get delta for nudge direction
 */
function getNudgeDelta(direction: NudgeDirection, step: number): Point2D {
  switch (direction) {
    case 'up':
      return { x: 0, y: step };
    case 'down':
      return { x: 0, y: -step };
    case 'left':
      return { x: -step, y: 0 };
    case 'right':
      return { x: step, y: 0 };
    default:
      return { x: 0, y: 0 };
  }
}

// ============================================================================
// 🏢 ENTERPRISE: Main Hook Implementation
// ============================================================================

/**
 * Unified hook for all entity movement operations
 *
 * Architecture: Facade Pattern
 * - Combines useMoveEntities and useEntityDrag
 * - Provides consistent interface for all movement methods
 * - All operations backed by Command Pattern for undo/redo
 */
export function useMovementOperations({
  selectedEntityIds,
  screenToWorld,
  snapToGrid = false,
  gridSize = 1,
  nudgeStep = NUDGE_CONFIG.BASE_STEP,
  largeNudgeMultiplier = NUDGE_CONFIG.LARGE_MULTIPLIER,
  onMoveStart,
  onMoveEnd,
}: UseMovementOperationsOptions): UseMovementOperationsReturn {
  // Movement command hook
  const {
    moveEntities,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useMoveEntities();

  // Drag hook configuration
  const dragOptions: UseEntityDragOptions = useMemo(() => ({
    selectedEntityIds,
    screenToWorld,
    snapToGrid,
    gridSize,
    onDragStart: onMoveStart,
    onDragEnd: onMoveEnd,
    enabled: selectedEntityIds.length > 0,
  }), [selectedEntityIds, screenToWorld, snapToGrid, gridSize, onMoveStart, onMoveEnd]);

  // Drag hook
  const {
    isDragging,
    currentDelta: dragDelta,
    startDrag,
    updateDrag,
    endDrag,
    cancelDrag,
  } = useEntityDrag(dragOptions);

  // ============================================================================
  // Nudge Operations
  // ============================================================================

  /**
   * Get nudge step for modifier
   */
  const getNudgeStep = useCallback((modifier: NudgeModifier): number => {
    return calculateNudgeStep(nudgeStep, modifier, largeNudgeMultiplier);
  }, [nudgeStep, largeNudgeMultiplier]);

  /**
   * Nudge selected entities in direction
   */
  const nudge = useCallback((direction: NudgeDirection, modifier: NudgeModifier = 'normal') => {
    if (selectedEntityIds.length === 0) {
      debugLog('Cannot nudge: no selection');
      return;
    }

    const step = getNudgeStep(modifier);
    const delta = getNudgeDelta(direction, step);

    debugLog(`Nudging ${direction} by ${step} units (${modifier})`);

    moveEntities(selectedEntityIds, delta, { isDragging: false });
  }, [selectedEntityIds, getNudgeStep, moveEntities]);

  /**
   * Directional nudge shortcuts
   */
  const nudgeUp = useCallback((modifier?: NudgeModifier) => {
    nudge('up', modifier);
  }, [nudge]);

  const nudgeDown = useCallback((modifier?: NudgeModifier) => {
    nudge('down', modifier);
  }, [nudge]);

  const nudgeLeft = useCallback((modifier?: NudgeModifier) => {
    nudge('left', modifier);
  }, [nudge]);

  const nudgeRight = useCallback((modifier?: NudgeModifier) => {
    nudge('right', modifier);
  }, [nudge]);

  // ============================================================================
  // Direct Move
  // ============================================================================

  /**
   * Move selected entities by delta
   */
  const moveByDelta = useCallback((delta: Point2D) => {
    if (selectedEntityIds.length === 0) {
      debugLog('Cannot move: no selection');
      return;
    }

    if (delta.x === 0 && delta.y === 0) {
      debugLog('Move delta is zero, skipping');
      return;
    }

    debugLog(`Moving ${selectedEntityIds.length} entities by (${delta.x}, ${delta.y})`);

    onMoveStart?.();
    moveEntities(selectedEntityIds, delta, { isDragging: false });
    onMoveEnd?.(delta);
  }, [selectedEntityIds, moveEntities, onMoveStart, onMoveEnd]);

  // ============================================================================
  // Computed State
  // ============================================================================

  const canMove = selectedEntityIds.length > 0;
  const selectionCount = selectedEntityIds.length;

  // ============================================================================
  // Return Hook Interface
  // ============================================================================

  return useMemo(() => ({
    // Nudge
    nudge,
    nudgeUp,
    nudgeDown,
    nudgeLeft,
    nudgeRight,
    getNudgeStep,

    // Drag
    isDragging,
    dragDelta,
    startDrag,
    updateDrag,
    endDrag,
    cancelDrag,

    // Direct move
    moveByDelta,

    // State
    canMove,
    selectionCount,

    // Undo/Redo
    undo,
    redo,
    canUndo,
    canRedo,
  }), [
    nudge,
    nudgeUp,
    nudgeDown,
    nudgeLeft,
    nudgeRight,
    getNudgeStep,
    isDragging,
    dragDelta,
    startDrag,
    updateDrag,
    endDrag,
    cancelDrag,
    moveByDelta,
    canMove,
    selectionCount,
    undo,
    redo,
    canUndo,
    canRedo,
  ]);
}

/**
 * Alias for backward compatibility
 */
export const useMoveOperations = useMovementOperations;
