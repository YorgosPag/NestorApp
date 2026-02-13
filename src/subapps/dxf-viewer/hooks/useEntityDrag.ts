/**
 * USE ENTITY DRAG HOOK
 *
 * 🏢 ENTERPRISE (2026-01-25): React hook for dragging selected entities
 *
 * Enterprise Pattern: Command + Observer Pattern
 * - Drag operations trigger MoveEntityCommand for undo/redo support
 * - Command merging for smooth drag (consecutive moves merge within 500ms)
 * - Based on patterns from: AutoCAD, Figma, Adobe Illustrator
 *
 * Features:
 * - Direct drag of selected entities
 * - Mouse down/move/up handling
 * - Touch support (for tablets)
 * - Visual feedback during drag
 * - Snap-to-grid support (optional)
 * - Performance optimized with requestAnimationFrame
 *
 * Usage:
 * ```tsx
 * const { isDragging, startDrag, updateDrag, endDrag } = useEntityDrag({
 *   selectedEntityIds,
 *   onDragStart: () => console.debug('Started dragging'),
 *   onDragEnd: (delta) => console.debug('Dragged by', delta),
 * });
 *
 * // In canvas mouse handlers:
 * const handleMouseDown = (e) => {
 *   if (hoveredEntityId && selectedEntityIds.includes(hoveredEntityId)) {
 *     startDrag({ x: e.clientX, y: e.clientY });
 *   }
 * };
 * ```
 *
 * @see HYBRID_LAYER_MOVEMENT_ARCHITECTURE.md
 * @see hooks/useMoveEntities.ts
 */

import { useCallback, useRef, useState, useEffect } from 'react';
import type { Point2D } from '../rendering/types/Types';
import { useMoveEntities } from './useMoveEntities';
// 🏢 ADR-065: Centralized Distance Calculation
import { calculateDistance } from '../rendering/entities/shared/geometry-rendering-utils';
// 🏢 ADR-118: Centralized Zero Point Pattern
import { createZeroPoint } from '../config/geometry-constants';

// ============================================================================
// 🏢 ENTERPRISE: Configuration Constants
// ============================================================================

/**
 * Drag configuration constants
 * Based on AutoCAD/Figma performance guidelines
 */
const DRAG_CONFIG = {
  /** Minimum drag distance to start drag (pixels) - prevents accidental drags */
  MIN_DRAG_DISTANCE: 3,
  /** Throttle interval for drag updates (ms) - 60fps target */
  THROTTLE_MS: 16,
  /** Command merge window for smooth undo (ms) */
  MERGE_WINDOW_MS: 500,
  /** Maximum entities before showing simplified preview */
  PREVIEW_SIMPLIFY_THRESHOLD: 100,
} as const;

/**
 * Debug mode flag
 */
const DEBUG_MODE = process.env.NODE_ENV === 'development';

// ============================================================================
// 🏢 ENTERPRISE: Type Definitions
// ============================================================================

/**
 * Drag state for tracking mouse/touch movement
 */
interface DragState {
  /** Is currently dragging */
  isDragging: boolean;
  /** Starting point in screen coordinates */
  startPoint: Point2D | null;
  /** Current point in screen coordinates */
  currentPoint: Point2D | null;
  /** Total delta accumulated during drag */
  totalDelta: Point2D;
  /** Has moved past minimum drag distance */
  hasMoved: boolean;
}

/**
 * Options for useEntityDrag hook
 */
export interface UseEntityDragOptions {
  /** Currently selected entity IDs */
  selectedEntityIds: string[];
  /** Callback when drag starts */
  onDragStart?: () => void;
  /** Callback during drag with current delta */
  onDragMove?: (delta: Point2D) => void;
  /** Callback when drag ends with final delta */
  onDragEnd?: (delta: Point2D) => void;
  /** Transform screen coordinates to world coordinates */
  screenToWorld?: (point: Point2D) => Point2D;
  /** Enable snap to grid */
  snapToGrid?: boolean;
  /** Grid snap size (world units) */
  gridSize?: number;
  /** Whether drag is enabled */
  enabled?: boolean;
}

/**
 * Return type for useEntityDrag hook
 */
export interface UseEntityDragReturn {
  /** Is currently dragging */
  isDragging: boolean;
  /** Current drag delta (world coordinates) */
  currentDelta: Point2D;
  /** Start a drag operation */
  startDrag: (screenPoint: Point2D) => void;
  /** Update drag position (call on mouse/touch move) */
  updateDrag: (screenPoint: Point2D) => void;
  /** End drag operation */
  endDrag: () => void;
  /** Cancel drag without applying changes */
  cancelDrag: () => void;
  /** Has drag moved past minimum distance */
  hasMoved: boolean;
}

// ============================================================================
// 🏢 ENTERPRISE: Utility Functions
// ============================================================================

/**
 * Debug logger
 */
function debugLog(message: string, ...args: unknown[]): void {
  if (DEBUG_MODE) {
    console.debug(`[EntityDrag] ${message}`, ...args);
  }
}

/**
 * Apply grid snapping to a point
 */
function snapToGrid(point: Point2D, gridSize: number): Point2D {
  return {
    x: Math.round(point.x / gridSize) * gridSize,
    y: Math.round(point.y / gridSize) * gridSize,
  };
}

/**
 * Default screen to world transform (identity)
 */
function defaultScreenToWorld(point: Point2D): Point2D {
  return point;
}

// ============================================================================
// 🏢 ENTERPRISE: Initial State
// ============================================================================

// 🏢 ADR-118: Use createZeroPoint() for mutable state initialization
const INITIAL_DRAG_STATE: DragState = {
  isDragging: false,
  startPoint: null,
  currentPoint: null,
  totalDelta: createZeroPoint(),
  hasMoved: false,
};

// ============================================================================
// 🏢 ENTERPRISE: Main Hook Implementation
// ============================================================================

/**
 * React hook for dragging selected entities
 *
 * Architecture: Command + Observer Pattern
 * - Uses MoveEntityCommand for undo/redo support
 * - Command merging for smooth drag operations
 * - Performance optimized with RAF throttling
 */
export function useEntityDrag({
  selectedEntityIds,
  onDragStart,
  onDragMove,
  onDragEnd,
  screenToWorld = defaultScreenToWorld,
  snapToGrid: enableSnap = false,
  gridSize = 1,
  enabled = true,
}: UseEntityDragOptions): UseEntityDragReturn {
  // Movement hook for command execution
  const { moveEntities } = useMoveEntities();

  // Drag state
  const [dragState, setDragState] = useState<DragState>(INITIAL_DRAG_STATE);

  // Refs for performance (avoid closure stale values)
  const lastUpdateRef = useRef<number>(0);
  // 🏢 ADR-118: Use createZeroPoint() for mutable ref initialization
  const pendingDeltaRef = useRef<Point2D>(createZeroPoint());
  const rafIdRef = useRef<number | null>(null);
  const startWorldPointRef = useRef<Point2D | null>(null);

  /**
   * Start drag operation
   */
  const startDrag = useCallback((screenPoint: Point2D) => {
    if (!enabled || selectedEntityIds.length === 0) {
      debugLog('Cannot start drag: disabled or no selection');
      return;
    }

    const worldPoint = screenToWorld(screenPoint);
    startWorldPointRef.current = worldPoint;

    // 🏢 ADR-118: Use createZeroPoint() for mutable state initialization
    setDragState({
      isDragging: true,
      startPoint: screenPoint,
      currentPoint: screenPoint,
      totalDelta: createZeroPoint(),
      hasMoved: false,
    });

    debugLog(`Started drag at screen(${screenPoint.x}, ${screenPoint.y}) world(${worldPoint.x.toFixed(2)}, ${worldPoint.y.toFixed(2)})`);
    onDragStart?.();
  }, [enabled, selectedEntityIds.length, screenToWorld, onDragStart]);

  /**
   * Update drag position
   * Uses RAF throttling for performance
   */
  const updateDrag = useCallback((screenPoint: Point2D) => {
    if (!dragState.isDragging || !dragState.startPoint || !startWorldPointRef.current) {
      return;
    }

    // Check minimum drag distance
    const dragDistance = calculateDistance(dragState.startPoint, screenPoint);
    const hasMoved = dragDistance >= DRAG_CONFIG.MIN_DRAG_DISTANCE;

    if (!hasMoved && !dragState.hasMoved) {
      return;
    }

    // Calculate world delta
    const currentWorldPoint = screenToWorld(screenPoint);
    let delta: Point2D = {
      x: currentWorldPoint.x - startWorldPointRef.current.x,
      y: currentWorldPoint.y - startWorldPointRef.current.y,
    };

    // Apply grid snapping if enabled
    if (enableSnap && gridSize > 0) {
      delta = snapToGrid(delta, gridSize);
    }

    // Throttle updates
    const now = Date.now();
    if (now - lastUpdateRef.current < DRAG_CONFIG.THROTTLE_MS) {
      pendingDeltaRef.current = delta;

      // Schedule RAF update if not already pending
      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(() => {
          rafIdRef.current = null;
          setDragState(prev => ({
            ...prev,
            currentPoint: screenPoint,
            totalDelta: pendingDeltaRef.current,
            hasMoved: true,
          }));
          onDragMove?.(pendingDeltaRef.current);
        });
      }
      return;
    }

    lastUpdateRef.current = now;

    setDragState(prev => ({
      ...prev,
      currentPoint: screenPoint,
      totalDelta: delta,
      hasMoved: true,
    }));

    onDragMove?.(delta);
  }, [dragState, screenToWorld, enableSnap, gridSize, onDragMove]);

  /**
   * End drag operation - apply movement via command
   */
  const endDrag = useCallback(() => {
    if (!dragState.isDragging) {
      return;
    }

    // Cancel any pending RAF
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    const finalDelta = dragState.totalDelta;

    // Only execute move if actually moved
    if (dragState.hasMoved && (finalDelta.x !== 0 || finalDelta.y !== 0)) {
      debugLog(`Ending drag with delta (${finalDelta.x.toFixed(2)}, ${finalDelta.y.toFixed(2)})`);

      // Execute move command (with isDragging=false to finalize)
      moveEntities(selectedEntityIds, finalDelta, { isDragging: false });

      onDragEnd?.(finalDelta);
    } else {
      debugLog('Drag ended without movement');
    }

    // Reset state
    setDragState(INITIAL_DRAG_STATE);
    startWorldPointRef.current = null;
  }, [dragState, selectedEntityIds, moveEntities, onDragEnd]);

  /**
   * Cancel drag without applying changes
   */
  const cancelDrag = useCallback(() => {
    if (!dragState.isDragging) {
      return;
    }

    // Cancel any pending RAF
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    debugLog('Drag cancelled');

    // Reset state without executing command
    setDragState(INITIAL_DRAG_STATE);
    startWorldPointRef.current = null;
  }, [dragState.isDragging]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  /**
   * Cancel drag on ESC key
   */
  useEffect(() => {
    if (!dragState.isDragging) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cancelDrag();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dragState.isDragging, cancelDrag]);

  return {
    isDragging: dragState.isDragging,
    currentDelta: dragState.totalDelta,
    startDrag,
    updateDrag,
    endDrag,
    cancelDrag,
    hasMoved: dragState.hasMoved,
  };
}

/**
 * Alias for backward compatibility
 */
export const useDragEntities = useEntityDrag;
