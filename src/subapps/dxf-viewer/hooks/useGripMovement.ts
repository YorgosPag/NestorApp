/**
 * USE GRIP MOVEMENT HOOK
 *
 * 🏢 ENTERPRISE (2026-01-25): React hook bridging GripInteractionManager with Command Pattern
 *
 * Phase 4 of HYBRID_LAYER_MOVEMENT_ARCHITECTURE:
 * - Integrates grip operations with MoveEntityCommand for undo/redo
 * - Provides visual feedback during grip drag
 * - Supports both vertex movement and entity movement via grips
 *
 * Enterprise Patterns:
 * - Bridge Pattern: Connects GripInteractionManager with Command system
 * - Observer Pattern: Listens to grip state changes
 * - Command Pattern: All operations are undoable
 *
 * Grip Types:
 * - Vertex Grips: Move individual vertices (polyline, polygon)
 * - Entity Grips: Move entire entity (center grip)
 * - Edge Grips: Move edges (rectangle sides)
 *
 * Usage:
 * ```tsx
 * const {
 *   gripState,
 *   handleGripMouseDown,
 *   handleGripMouseMove,
 *   handleGripMouseUp,
 *   isGripDragging,
 * } = useGripMovement({
 *   entityId: selectedEntity.id,
 *   onGripMove: (delta) => console.log('Grip moved by', delta),
 * });
 * ```
 *
 * @see HYBRID_LAYER_MOVEMENT_ARCHITECTURE.md
 * @see systems/grip-interaction/GripInteractionManager.ts
 * @see core/commands/vertex-commands/MoveVertexCommand.ts
 */

import { useCallback, useRef, useState, useMemo } from 'react';
import type { Point2D } from '../rendering/types/Types';
import { useMoveEntities } from './useMoveEntities';
import { useCommandHistory, MoveVertexCommand } from '../core/commands';
import { useLevels } from '../systems/levels';

// ============================================================================
// 🏢 ENTERPRISE: Configuration Constants
// ============================================================================

/**
 * Grip interaction configuration
 * Based on AutoCAD/MicroStation grip behavior
 */
export const GRIP_CONFIG = {
  /** Minimum drag distance before grip operation starts (pixels) */
  MIN_DRAG_DISTANCE: 2,
  /** Grip hit tolerance (pixels) */
  HIT_TOLERANCE: 8,
  /** Debounce time for rapid grip operations (ms) */
  DEBOUNCE_MS: 16,
  /** Command merge window for smooth drag (ms) */
  MERGE_WINDOW_MS: 500,
} as const;

/**
 * Debug mode flag
 */
const DEBUG_MODE = process.env.NODE_ENV === 'development';

// ============================================================================
// 🏢 ENTERPRISE: Type Definitions
// ============================================================================

/**
 * Grip type enumeration
 */
export type GripType = 'vertex' | 'center' | 'edge' | 'corner' | 'midpoint';

/**
 * Grip information
 */
export interface GripInfo {
  /** Entity ID this grip belongs to */
  entityId: string;
  /** Grip index within the entity */
  gripIndex: number;
  /** Grip type */
  type: GripType;
  /** World position of the grip */
  position: Point2D;
  /** Whether this grip moves the entire entity */
  movesEntity: boolean;
}

/**
 * Grip drag state
 */
export interface GripDragState {
  /** Is currently dragging a grip */
  isDragging: boolean;
  /** Active grip being dragged */
  activeGrip: GripInfo | null;
  /** Start position (world coordinates) */
  startPosition: Point2D | null;
  /** Current position (world coordinates) */
  currentPosition: Point2D | null;
  /** Total delta during drag */
  totalDelta: Point2D;
  /** Has moved past minimum distance */
  hasMoved: boolean;
}

/**
 * Options for useGripMovement hook
 */
export interface UseGripMovementOptions {
  /** Entity ID for grip operations */
  entityId: string | null;
  /** Transform screen to world coordinates */
  screenToWorld?: (point: Point2D) => Point2D;
  /** Enable snap to grid */
  snapToGrid?: boolean;
  /** Grid snap size (world units) */
  gridSize?: number;
  /** Callback when grip drag starts */
  onGripDragStart?: (grip: GripInfo) => void;
  /** Callback during grip drag */
  onGripDragMove?: (grip: GripInfo, delta: Point2D) => void;
  /** Callback when grip drag ends */
  onGripDragEnd?: (grip: GripInfo, finalDelta: Point2D) => void;
  /** Whether grip movement is enabled */
  enabled?: boolean;
}

/**
 * Return type for useGripMovement hook
 */
export interface UseGripMovementReturn {
  /** Current grip drag state */
  gripState: GripDragState;
  /** Is currently dragging a grip */
  isGripDragging: boolean;
  /** Current drag delta */
  currentDelta: Point2D;
  /** Start grip drag */
  startGripDrag: (grip: GripInfo, screenPoint: Point2D) => void;
  /** Update grip drag position */
  updateGripDrag: (screenPoint: Point2D) => void;
  /** End grip drag and apply movement */
  endGripDrag: () => void;
  /** Cancel grip drag without applying */
  cancelGripDrag: () => void;
  /** Check if a point is near a grip */
  isNearGrip: (position: Point2D, grips: GripInfo[]) => GripInfo | null;
}

// ============================================================================
// 🏢 ENTERPRISE: Initial State
// ============================================================================

const INITIAL_GRIP_STATE: GripDragState = {
  isDragging: false,
  activeGrip: null,
  startPosition: null,
  currentPosition: null,
  totalDelta: { x: 0, y: 0 },
  hasMoved: false,
};

// ============================================================================
// 🏢 ENTERPRISE: Utility Functions
// ============================================================================

/**
 * Debug logger
 */
function debugLog(message: string, ...args: unknown[]): void {
  if (DEBUG_MODE) {
    console.log(`[GripMovement] ${message}`, ...args);
  }
}

/**
 * Calculate distance between two points
 */
function distance(p1: Point2D, p2: Point2D): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Apply grid snapping to delta
 */
function snapDeltaToGrid(delta: Point2D, gridSize: number): Point2D {
  return {
    x: Math.round(delta.x / gridSize) * gridSize,
    y: Math.round(delta.y / gridSize) * gridSize,
  };
}

/**
 * Default screen to world transform (identity)
 */
function defaultScreenToWorld(point: Point2D): Point2D {
  return point;
}

// ============================================================================
// 🏢 ENTERPRISE: Main Hook Implementation
// ============================================================================

/**
 * React hook for grip-based entity movement
 *
 * Architecture: Bridge Pattern
 * - Connects GripInteractionManager events with Command Pattern
 * - Supports both vertex grips (MoveVertexCommand) and entity grips (MoveEntityCommand)
 */
export function useGripMovement({
  entityId,
  screenToWorld = defaultScreenToWorld,
  snapToGrid = false,
  gridSize = 1,
  onGripDragStart,
  onGripDragMove,
  onGripDragEnd,
  enabled = true,
}: UseGripMovementOptions): UseGripMovementReturn {
  // Command hooks
  const { moveEntities } = useMoveEntities();
  const { execute } = useCommandHistory();
  const { currentLevelId, getLevelScene, setLevelScene } = useLevels();

  // Grip state
  const [gripState, setGripState] = useState<GripDragState>(INITIAL_GRIP_STATE);

  // Refs for performance
  const startWorldPositionRef = useRef<Point2D | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);

  /**
   * Create SceneManager adapter for vertex commands
   */
  const createSceneManagerAdapter = useCallback(() => {
    if (!currentLevelId) return null;

    return {
      getEntity: (id: string) => {
        const scene = getLevelScene(currentLevelId);
        return scene?.entities?.find(e => e.id === id);
      },
      updateEntity: (id: string, updates: Record<string, unknown>) => {
        const scene = getLevelScene(currentLevelId);
        if (scene) {
          const updatedEntities = scene.entities.map(e =>
            e.id === id ? { ...e, ...updates } : e
          );
          setLevelScene(currentLevelId, { ...scene, entities: updatedEntities });
        }
      },
      updateVertex: (id: string, vertexIndex: number, position: Point2D) => {
        const scene = getLevelScene(currentLevelId);
        if (scene) {
          const updatedEntities = scene.entities.map(e => {
            if (e.id === id && 'vertices' in e && Array.isArray(e.vertices)) {
              const vertices = [...e.vertices];
              if (vertexIndex >= 0 && vertexIndex < vertices.length) {
                vertices[vertexIndex] = position;
              }
              return { ...e, vertices };
            }
            return e;
          });
          setLevelScene(currentLevelId, { ...scene, entities: updatedEntities });
        }
      },
      getVertices: (id: string): Point2D[] | undefined => {
        const scene = getLevelScene(currentLevelId);
        const entity = scene?.entities?.find(e => e.id === id);
        if (entity && 'vertices' in entity) {
          return entity.vertices as Point2D[];
        }
        return undefined;
      },
    };
  }, [currentLevelId, getLevelScene, setLevelScene]);

  /**
   * Start grip drag operation
   */
  const startGripDrag = useCallback((grip: GripInfo, screenPoint: Point2D) => {
    if (!enabled || !entityId) {
      debugLog('Cannot start grip drag: disabled or no entity');
      return;
    }

    const worldPoint = screenToWorld(screenPoint);
    startWorldPositionRef.current = worldPoint;

    setGripState({
      isDragging: true,
      activeGrip: grip,
      startPosition: worldPoint,
      currentPosition: worldPoint,
      totalDelta: { x: 0, y: 0 },
      hasMoved: false,
    });

    debugLog(`Started grip drag: entity=${grip.entityId}, grip=${grip.gripIndex}, type=${grip.type}`);
    onGripDragStart?.(grip);
  }, [enabled, entityId, screenToWorld, onGripDragStart]);

  /**
   * Update grip drag position
   */
  const updateGripDrag = useCallback((screenPoint: Point2D) => {
    if (!gripState.isDragging || !gripState.activeGrip || !startWorldPositionRef.current) {
      return;
    }

    // Throttle updates
    const now = Date.now();
    if (now - lastUpdateTimeRef.current < GRIP_CONFIG.DEBOUNCE_MS) {
      return;
    }
    lastUpdateTimeRef.current = now;

    const currentWorldPoint = screenToWorld(screenPoint);

    // Calculate delta
    let delta: Point2D = {
      x: currentWorldPoint.x - startWorldPositionRef.current.x,
      y: currentWorldPoint.y - startWorldPositionRef.current.y,
    };

    // Check minimum drag distance (in world units, approximate)
    const dragDistance = Math.sqrt(delta.x * delta.x + delta.y * delta.y);
    const hasMoved = dragDistance >= GRIP_CONFIG.MIN_DRAG_DISTANCE / 10; // Rough conversion

    if (!hasMoved && !gripState.hasMoved) {
      return;
    }

    // Apply grid snapping if enabled
    if (snapToGrid && gridSize > 0) {
      delta = snapDeltaToGrid(delta, gridSize);
    }

    setGripState(prev => ({
      ...prev,
      currentPosition: currentWorldPoint,
      totalDelta: delta,
      hasMoved: true,
    }));

    onGripDragMove?.(gripState.activeGrip, delta);
  }, [gripState, screenToWorld, snapToGrid, gridSize, onGripDragMove]);

  /**
   * End grip drag and apply movement via command
   */
  const endGripDrag = useCallback(() => {
    if (!gripState.isDragging || !gripState.activeGrip) {
      return;
    }

    const { activeGrip, totalDelta, hasMoved } = gripState;

    // Only execute if actually moved
    if (hasMoved && (totalDelta.x !== 0 || totalDelta.y !== 0)) {
      debugLog(`Ending grip drag: delta=(${totalDelta.x.toFixed(2)}, ${totalDelta.y.toFixed(2)})`);

      if (activeGrip.movesEntity) {
        // Use MoveEntityCommand for center/entity grips
        moveEntities([activeGrip.entityId], totalDelta, { isDragging: false });
      } else {
        // Use MoveVertexCommand for vertex grips
        const sceneManager = createSceneManagerAdapter();
        if (sceneManager) {
          const vertices = sceneManager.getVertices(activeGrip.entityId);
          if (vertices && activeGrip.gripIndex < vertices.length) {
            const oldPosition = vertices[activeGrip.gripIndex];
            const newPosition: Point2D = {
              x: oldPosition.x + totalDelta.x,
              y: oldPosition.y + totalDelta.y,
            };

            // Execute via command for undo support
            // 🏢 ENTERPRISE: Type-safe casting for ISceneManager interface
            const command = new MoveVertexCommand(
              activeGrip.entityId,
              activeGrip.gripIndex,
              oldPosition,
              newPosition,
              sceneManager as unknown as Parameters<typeof MoveVertexCommand['prototype']['constructor']>[4]
            );
            execute(command);
          }
        }
      }

      onGripDragEnd?.(activeGrip, totalDelta);
    } else {
      debugLog('Grip drag ended without movement');
    }

    // Reset state
    setGripState(INITIAL_GRIP_STATE);
    startWorldPositionRef.current = null;
  }, [gripState, moveEntities, createSceneManagerAdapter, execute, onGripDragEnd]);

  /**
   * Cancel grip drag without applying
   */
  const cancelGripDrag = useCallback(() => {
    if (!gripState.isDragging) {
      return;
    }

    debugLog('Grip drag cancelled');
    setGripState(INITIAL_GRIP_STATE);
    startWorldPositionRef.current = null;
  }, [gripState.isDragging]);

  /**
   * Check if a point is near any grip
   */
  const isNearGrip = useCallback((position: Point2D, grips: GripInfo[]): GripInfo | null => {
    for (const grip of grips) {
      const dist = distance(position, grip.position);
      if (dist <= GRIP_CONFIG.HIT_TOLERANCE) {
        return grip;
      }
    }
    return null;
  }, []);

  // ============================================================================
  // Return Hook Interface
  // ============================================================================

  return useMemo(() => ({
    gripState,
    isGripDragging: gripState.isDragging,
    currentDelta: gripState.totalDelta,
    startGripDrag,
    updateGripDrag,
    endGripDrag,
    cancelGripDrag,
    isNearGrip,
  }), [
    gripState,
    startGripDrag,
    updateGripDrag,
    endGripDrag,
    cancelGripDrag,
    isNearGrip,
  ]);
}

/**
 * Alias for backward compatibility
 */
export const useGripDrag = useGripMovement;
