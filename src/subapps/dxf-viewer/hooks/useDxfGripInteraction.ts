/**
 * @deprecated ADR-183: Replaced by useUnifiedGripInteraction.
 * Use `useUnifiedGripInteraction` from `hooks/grips/useUnifiedGripInteraction` instead.
 * Types and computeDxfEntityGrips() are still exported for reuse.
 *
 * DXF GRIP INTERACTION HOOK
 *
 * AutoCAD-style grip editing for DXF entities.
 *
 * 🏢 (2026-02-15): Drag-release model (replaces click-commit)
 *
 * State machine:
 *   idle ──[cursor near grip]──→ hovering (cold blue, start 1s timer)
 *     ↑                              │
 *     │ [cursor leaves]              ↓ [timer expires]
 *     └──────────────────────── warm (visual: orange)
 *                                    │
 *                             [mouseDown on grip]
 *                                    ↓
 *                              dragging (hot: red, entity/vertex follows cursor)
 *                                    │
 *                   ┌────────────────┼────────────────┐
 *                   ↓                ↓                 ↓
 *              [mouseUp]       [Escape]          [right-click]
 *              commit pos.    cancel+revert     cancel+revert
 *                   │                │                 │
 *                   └────────────────┴─────────────────┘
 *                                    ↓
 *                                  idle
 *
 * Grip types:
 * - vertex: stretch — only that vertex moves → MoveVertexCommand
 * - center: move — entire entity moves → MoveEntityCommand
 * - edge (with edgeVertexIndices): edge-stretch — both edge vertices move together
 *
 * @see useGripMovement.ts — existing hook (reuses GripInfo, GRIP_CONFIG types)
 * @see rendering/grips/ — existing temperature/color system
 */

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import type { Point2D, ViewTransform } from '../rendering/types/Types';
import type { DxfEntityUnion, DxfScene } from '../canvas-v2/dxf-canvas/dxf-types';
import { GRIP_CONFIG, type GripInfo } from './useGripMovement';
import { calculateDistance } from '../rendering/entities/shared/geometry-rendering-utils';
import { useMoveEntities } from './useMoveEntities';
import { useCommandHistory, MoveVertexCommand } from '../core/commands';
import { useLevels } from '../systems/levels';
import { createGripSceneAdapter } from './grip-scene-adapter';
import { computeDxfEntityGrips } from './grip-computation';

// Re-export types and pure functions for consumers
export type {
  GripPhase,
  GripIdentifier,
  DxfGripDragPreview,
  DxfGripInteractionState,
  UseDxfGripInteractionReturn,
} from './grip-computation';

export { computeDxfEntityGrips, computeAngleDegrees } from './grip-computation';

import type {
  GripPhase,
  GripIdentifier,
  DxfGripDragPreview,
  DxfGripInteractionState,
  UseDxfGripInteractionReturn,
} from './grip-computation';
// computeAngleDegrees re-exported from grip-computation for consumers

/** Options for useDxfGripInteraction */
interface UseDxfGripInteractionOptions {
  selectedEntityIds: string[];
  dxfScene: DxfScene | null;
  transform: ViewTransform;
  enabled?: boolean;
}

const WARM_DELAY_MS = 1000;

// ============================================================================
// HOOK (deprecated — use useUnifiedGripInteraction instead)
// ============================================================================

export function useDxfGripInteraction({
  selectedEntityIds,
  dxfScene,
  transform,
  enabled = true,
}: UseDxfGripInteractionOptions): UseDxfGripInteractionReturn {
  // ----- State -----
  const [phase, setPhase] = useState<GripPhase>('idle');
  const [hoveredGrip, setHoveredGrip] = useState<GripInfo | null>(null);
  const [activeGrip, setActiveGrip] = useState<GripInfo | null>(null);
  const [currentWorldPos, setCurrentWorldPos] = useState<Point2D | null>(null);

  // Anchor = world position at the moment the grip drag started
  const anchorRef = useRef<Point2D | null>(null);
  const warmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ----- Hooks for committing -----
  const { moveEntities } = useMoveEntities();
  const { execute } = useCommandHistory();
  const { currentLevelId, getLevelScene, setLevelScene } = useLevels();

  // ----- Computed: all grips for selected entities -----
  const allGrips = useMemo<GripInfo[]>(() => {
    if (!dxfScene || selectedEntityIds.length === 0) return [];
    const result: GripInfo[] = [];
    for (const entity of dxfScene.entities) {
      if (selectedEntityIds.includes(entity.id)) {
        result.push(...computeDxfEntityGrips(entity));
      }
    }
    return result;
  }, [dxfScene, selectedEntityIds]);

  // ----- Reset when selection changes -----
  useEffect(() => {
    setPhase('idle');
    setHoveredGrip(null);
    setActiveGrip(null);
    setCurrentWorldPos(null);
    anchorRef.current = null;
    if (warmTimerRef.current) {
      clearTimeout(warmTimerRef.current);
      warmTimerRef.current = null;
    }
  }, [selectedEntityIds]);

  // ----- Cleanup timer on unmount -----
  useEffect(() => {
    return () => {
      if (warmTimerRef.current) clearTimeout(warmTimerRef.current);
    };
  }, []);

  // ----- Helper: find grip near world position -----
  const findGripNear = useCallback(
    (worldPos: Point2D): GripInfo | null => {
      const tolerance = GRIP_CONFIG.HIT_TOLERANCE / transform.scale;
      for (const grip of allGrips) {
        if (calculateDistance(worldPos, grip.position) <= tolerance) {
          return grip;
        }
      }
      return null;
    },
    [allGrips, transform.scale]
  );

  // ----- Helper: create SceneManager adapter for MoveVertexCommand -----
  const createSceneManagerAdapter = useCallback(() => {
    if (!currentLevelId) return null;
    return createGripSceneAdapter({ currentLevelId, getLevelScene, setLevelScene });
  }, [currentLevelId, getLevelScene, setLevelScene]);

  // ----- Helper: reset to idle -----
  const resetToIdle = useCallback(() => {
    setPhase('idle');
    setActiveGrip(null);
    setHoveredGrip(null);
    setCurrentWorldPos(null);
    anchorRef.current = null;
  }, []);

  // ----- Helper: commit grip delta (shared by mouseUp) -----
  const commitGripDelta = useCallback((grip: GripInfo, delta: Point2D) => {
    if (delta.x === 0 && delta.y === 0) return;

    if (grip.edgeVertexIndices) {
      // Edge-stretch: Move BOTH vertices of this edge ATOMICALLY.
      // Single setLevelScene call avoids React batching race condition.
      if (!currentLevelId) return;
      const scene = getLevelScene(currentLevelId);
      if (!scene) return;

      const entity = scene.entities.find(e => e.id === grip.entityId);
      if (!entity) return;

      // Polyline/polygon: move both edge vertices
      if ('vertices' in entity && Array.isArray(entity.vertices)) {
        const [v1idx, v2idx] = grip.edgeVertexIndices;
        const vertices = entity.vertices as Point2D[];
        if (v1idx >= vertices.length || v2idx >= vertices.length) return;

        const newVertices = [...vertices];
        newVertices[v1idx] = { x: vertices[v1idx].x + delta.x, y: vertices[v1idx].y + delta.y };
        newVertices[v2idx] = { x: vertices[v2idx].x + delta.x, y: vertices[v2idx].y + delta.y };

        setLevelScene(currentLevelId, {
          ...scene,
          entities: scene.entities.map(e =>
            e.id === grip.entityId ? { ...e, vertices: newVertices } : e
          ),
        });
      }
      // Line: move both start and end (midpoint edge grip)
      else if ('start' in entity && 'end' in entity) {
        const start = entity.start as Point2D;
        const end = entity.end as Point2D;
        setLevelScene(currentLevelId, {
          ...scene,
          entities: scene.entities.map(e =>
            e.id === grip.entityId ? {
              ...e,
              start: { x: start.x + delta.x, y: start.y + delta.y },
              end: { x: end.x + delta.x, y: end.y + delta.y },
            } : e
          ),
        });
      }
      // Rectangle: edge midpoints move one side (update corner1/corner2)
      else if ('corner1' in entity && 'corner2' in entity) {
        const c1 = entity.corner1 as Point2D;
        const c2 = entity.corner2 as Point2D;
        const [v1, v2] = grip.edgeVertexIndices;
        let newC1 = { ...c1 };
        let newC2 = { ...c2 };

        // Top edge [0,1]: shift corner1.y
        if ((v1 === 0 && v2 === 1) || (v1 === 1 && v2 === 0)) {
          newC1 = { ...c1, y: c1.y + delta.y };
        }
        // Right edge [1,2]: shift corner2.x
        else if ((v1 === 1 && v2 === 2) || (v1 === 2 && v2 === 1)) {
          newC2 = { ...c2, x: c2.x + delta.x };
        }
        // Bottom edge [2,3]: shift corner2.y
        else if ((v1 === 2 && v2 === 3) || (v1 === 3 && v2 === 2)) {
          newC2 = { ...c2, y: c2.y + delta.y };
        }
        // Left edge [3,0]: shift corner1.x
        else if ((v1 === 3 && v2 === 0) || (v1 === 0 && v2 === 3)) {
          newC1 = { ...c1, x: c1.x + delta.x };
        }

        setLevelScene(currentLevelId, {
          ...scene,
          entities: scene.entities.map(e =>
            e.id === grip.entityId ? { ...e, corner1: newC1, corner2: newC2 } : e
          ),
        });
      }
    } else if (grip.movesEntity) {
      // Move entire entity
      moveEntities([grip.entityId], delta, { isDragging: false });
    } else {
      // Move single vertex
      const sceneManager = createSceneManagerAdapter();
      if (sceneManager) {
        const vertices = sceneManager.getVertices(grip.entityId);
        if (vertices && grip.gripIndex < vertices.length) {
          const oldPosition = vertices[grip.gripIndex];
          const newPosition: Point2D = {
            x: oldPosition.x + delta.x,
            y: oldPosition.y + delta.y,
          };
          const command = new MoveVertexCommand(
            grip.entityId,
            grip.gripIndex,
            oldPosition,
            newPosition,
            sceneManager
          );
          execute(command);
        }
      }
    }
  }, [createSceneManagerAdapter, execute, moveEntities, currentLevelId, getLevelScene, setLevelScene]);

  // ----- Mouse Move Handler -----
  const handleGripMouseMove = useCallback(
    (worldPos: Point2D, _screenPos: Point2D): boolean => {
      if (!enabled || allGrips.length === 0) return false;

      // During dragging: update current position for drag preview
      if (phase === 'dragging' && activeGrip) {
        setCurrentWorldPos(worldPos);
        return true; // consumed
      }

      // During idle/hovering/warm: detect hover
      const nearGrip = findGripNear(worldPos);

      if (nearGrip) {
        // Cursor is on a grip
        if (
          !hoveredGrip ||
          hoveredGrip.entityId !== nearGrip.entityId ||
          hoveredGrip.gripIndex !== nearGrip.gripIndex
        ) {
          // New grip hovered
          setHoveredGrip(nearGrip);
          setPhase('hovering');

          // Start warm timer
          if (warmTimerRef.current) clearTimeout(warmTimerRef.current);
          warmTimerRef.current = setTimeout(() => {
            setPhase('warm');
            warmTimerRef.current = null;
          }, WARM_DELAY_MS);
        }
        return false; // don't consume — still allow other handlers to detect hover
      }

      // Cursor left grip area
      if (hoveredGrip && phase !== 'dragging') {
        setHoveredGrip(null);
        setPhase('idle');
        if (warmTimerRef.current) {
          clearTimeout(warmTimerRef.current);
          warmTimerRef.current = null;
        }
      }

      return false;
    },
    [enabled, allGrips, phase, activeGrip, hoveredGrip, findGripNear]
  );

  // ----- MouseDown Handler (drag-release model) -----
  // 🏢 FIX (2026-02-15): Accept mouseDown on any visible grip regardless of phase.
  // Previous code required phase='hovering'|'warm', but React state batching could
  // prevent phase from updating between mousemove and mousedown (same event loop).
  // Proximity check alone is sufficient — hover/warm is visual feedback, not a prerequisite.
  const handleGripMouseDown = useCallback(
    (worldPos: Point2D): boolean => {
      if (!enabled || allGrips.length === 0) return false;

      // Already dragging — ignore (shouldn't happen, but defensive)
      if (phase === 'dragging') return false;

      const nearGrip = findGripNear(worldPos);
      if (!nearGrip) return false;

      // Start drag
      setActiveGrip(nearGrip);
      setPhase('dragging');
      anchorRef.current = worldPos;
      setCurrentWorldPos(worldPos);

      // Clear warm timer
      if (warmTimerRef.current) {
        clearTimeout(warmTimerRef.current);
        warmTimerRef.current = null;
      }

      return true; // consumed — prevents marquee start
    },
    [enabled, allGrips, phase, findGripNear]
  );

  // ----- MouseUp Handler (NEW — drag-release commit) -----
  const handleGripMouseUp = useCallback(
    (worldPos: Point2D): boolean => {
      if (phase !== 'dragging' || !activeGrip || !anchorRef.current) return false;

      const delta: Point2D = {
        x: worldPos.x - anchorRef.current.x,
        y: worldPos.y - anchorRef.current.y,
      };

      commitGripDelta(activeGrip, delta);
      resetToIdle();
      return true; // consumed
    },
    [phase, activeGrip, commitGripDelta, resetToIdle]
  );

  // ----- Click Handler (no-op in drag-release model — kept for backward compat) -----
  const handleGripClick = useCallback(
    (_worldPos: Point2D): boolean => {
      // 🏢 (2026-02-15): Drag-release model — click is no longer used for grip activation/commit.
      // handleGripMouseDown starts drag, handleGripMouseUp commits.
      return false;
    },
    []
  );

  // ----- Escape Handler -----
  const handleGripEscape = useCallback((): boolean => {
    if (phase === 'dragging') {
      // Cancel — revert to idle (no changes committed)
      resetToIdle();
      return true;
    }
    return false;
  }, [phase, resetToIdle]);

  // ----- Right-click Handler -----
  const handleGripRightClick = useCallback((): boolean => {
    // Same as Escape — cancel dragging
    return handleGripEscape();
  }, [handleGripEscape]);

  // ----- Computed: drag preview -----
  const dragPreview = useMemo<DxfGripDragPreview | null>(() => {
    if (phase !== 'dragging' || !activeGrip || !anchorRef.current || !currentWorldPos) {
      return null;
    }

    return {
      entityId: activeGrip.entityId,
      gripIndex: activeGrip.gripIndex,
      delta: {
        x: currentWorldPos.x - anchorRef.current.x,
        y: currentWorldPos.y - anchorRef.current.y,
      },
      movesEntity: activeGrip.movesEntity,
      edgeVertexIndices: activeGrip.edgeVertexIndices,
    };
  }, [phase, activeGrip, currentWorldPos]);

  // ----- Computed: interaction state for rendering pipeline -----
  const gripInteractionState = useMemo<DxfGripInteractionState>(() => {
    const state: DxfGripInteractionState = {};

    if (hoveredGrip && (phase === 'hovering' || phase === 'warm')) {
      state.hoveredGrip = {
        entityId: hoveredGrip.entityId,
        gripIndex: hoveredGrip.gripIndex,
      };
    }

    if (activeGrip && phase === 'dragging') {
      state.activeGrip = {
        entityId: activeGrip.entityId,
        gripIndex: activeGrip.gripIndex,
      };
    }

    return state;
  }, [hoveredGrip, activeGrip, phase]);

  return useMemo(
    () => ({
      gripInteractionState,
      isDraggingGrip: phase === 'dragging',
      isFollowingGrip: phase === 'dragging', // backward compat alias
      handleGripMouseMove,
      handleGripMouseDown,
      handleGripMouseUp,
      handleGripClick,
      handleGripEscape,
      handleGripRightClick,
      dragPreview,
    }),
    [gripInteractionState, phase, handleGripMouseMove, handleGripMouseDown, handleGripMouseUp, handleGripClick, handleGripEscape, handleGripRightClick, dragPreview]
  );
}
