/**
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
import { calculateMidpoint } from '../rendering/entities/shared/geometry-utils';
import { useMoveEntities } from './useMoveEntities';
import { useCommandHistory, MoveVertexCommand } from '../core/commands';
import { useLevels } from '../systems/levels';
import type { ISceneManager, SceneEntity } from '../core/commands/interfaces';
import type { AnySceneEntity } from '../types/scene';

// ============================================================================
// TYPES
// ============================================================================

/** Interaction phase of the grip state machine */
type GripPhase = 'idle' | 'hovering' | 'warm' | 'dragging';

/** Unique grip identifier for rendering pipeline */
export interface GripIdentifier {
  entityId: string;
  gripIndex: number;
}

/** Drag preview data for live rendering */
export interface DxfGripDragPreview {
  entityId: string;
  gripIndex: number;
  delta: Point2D;
  movesEntity: boolean;
  /** For edge grips: which 2 vertex indices to move together (edge-stretch preview) */
  edgeVertexIndices?: [number, number];
}

/** Grip interaction state for rendering pipeline */
export interface DxfGripInteractionState {
  hoveredGrip?: GripIdentifier;
  activeGrip?: GripIdentifier;
}

/** Return type of useDxfGripInteraction */
export interface UseDxfGripInteractionReturn {
  gripInteractionState: DxfGripInteractionState;
  /** True while user is dragging a grip (mouseDown → mouseUp) */
  isDraggingGrip: boolean;
  /** @deprecated Use isDraggingGrip — kept for backward compatibility */
  isFollowingGrip: boolean;
  handleGripMouseMove: (worldPos: Point2D, screenPos: Point2D) => boolean;
  /** Start drag on mouseDown over a hovering/warm grip. Returns true if consumed. */
  handleGripMouseDown: (worldPos: Point2D) => boolean;
  /** Commit drag on mouseUp. Returns true if consumed. */
  handleGripMouseUp: (worldPos: Point2D) => boolean;
  /** @deprecated No-op in drag-release model — kept for backward compatibility */
  handleGripClick: (worldPos: Point2D) => boolean;
  handleGripEscape: () => boolean;
  handleGripRightClick: () => boolean;
  dragPreview: DxfGripDragPreview | null;
}

/** Options for useDxfGripInteraction */
interface UseDxfGripInteractionOptions {
  selectedEntityIds: string[];
  dxfScene: DxfScene | null;
  transform: ViewTransform;
  enabled?: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Time (ms) before a hovered grip transitions to warm (orange) */
const WARM_DELAY_MS = 1000;

// ============================================================================
// PURE: Compute grips from DXF entity geometry
// ============================================================================

function computeDxfEntityGrips(entity: DxfEntityUnion): GripInfo[] {
  const grips: GripInfo[] = [];

  switch (entity.type) {
    case 'line': {
      // Start vertex
      grips.push({
        entityId: entity.id,
        gripIndex: 0,
        type: 'vertex',
        position: entity.start,
        movesEntity: false,
      });
      // End vertex
      grips.push({
        entityId: entity.id,
        gripIndex: 1,
        type: 'vertex',
        position: entity.end,
        movesEntity: false,
      });
      // Midpoint — edge-stretch: moves both endpoints together
      grips.push({
        entityId: entity.id,
        gripIndex: 2,
        type: 'edge',
        position: calculateMidpoint(entity.start, entity.end),
        movesEntity: false,
        edgeVertexIndices: [0, 1],
      });
      break;
    }

    case 'circle': {
      // Center (moves entire entity)
      grips.push({
        entityId: entity.id,
        gripIndex: 0,
        type: 'center',
        position: entity.center,
        movesEntity: true,
      });
      // Quadrant points (stretch radius)
      const quadrants: Point2D[] = [
        { x: entity.center.x + entity.radius, y: entity.center.y },
        { x: entity.center.x, y: entity.center.y + entity.radius },
        { x: entity.center.x - entity.radius, y: entity.center.y },
        { x: entity.center.x, y: entity.center.y - entity.radius },
      ];
      quadrants.forEach((pos, i) => {
        grips.push({
          entityId: entity.id,
          gripIndex: i + 1,
          type: 'vertex',
          position: pos,
          movesEntity: false,
        });
      });
      break;
    }

    case 'polyline': {
      // Each vertex
      entity.vertices.forEach((v, i) => {
        grips.push({
          entityId: entity.id,
          gripIndex: i,
          type: 'vertex',
          position: v,
          movesEntity: false,
        });
      });
      // Midpoints of each edge — edge-stretch: moves the 2 vertices of this edge
      const vLen = entity.vertices.length;
      const edgeCount = entity.closed ? vLen : vLen - 1;
      for (let i = 0; i < edgeCount; i++) {
        const next = (i + 1) % vLen;
        grips.push({
          entityId: entity.id,
          gripIndex: vLen + i,
          type: 'edge',
          position: calculateMidpoint(entity.vertices[i], entity.vertices[next]),
          movesEntity: false,
          edgeVertexIndices: [i, next],
        });
      }
      break;
    }

    case 'arc': {
      const startRad = (entity.startAngle * Math.PI) / 180;
      const endRad = (entity.endAngle * Math.PI) / 180;
      const midRad = (startRad + endRad) / 2;

      // Center (moves entire entity)
      grips.push({
        entityId: entity.id,
        gripIndex: 0,
        type: 'center',
        position: entity.center,
        movesEntity: true,
      });
      // Start point
      grips.push({
        entityId: entity.id,
        gripIndex: 1,
        type: 'vertex',
        position: {
          x: entity.center.x + entity.radius * Math.cos(startRad),
          y: entity.center.y + entity.radius * Math.sin(startRad),
        },
        movesEntity: false,
      });
      // End point
      grips.push({
        entityId: entity.id,
        gripIndex: 2,
        type: 'vertex',
        position: {
          x: entity.center.x + entity.radius * Math.cos(endRad),
          y: entity.center.y + entity.radius * Math.sin(endRad),
        },
        movesEntity: false,
      });
      // Mid-arc point (moves entire entity)
      grips.push({
        entityId: entity.id,
        gripIndex: 3,
        type: 'edge',
        position: {
          x: entity.center.x + entity.radius * Math.cos(midRad),
          y: entity.center.y + entity.radius * Math.sin(midRad),
        },
        movesEntity: true,
      });
      break;
    }

    case 'text': {
      // Position grip (moves entire entity)
      grips.push({
        entityId: entity.id,
        gripIndex: 0,
        type: 'center',
        position: entity.position,
        movesEntity: true,
      });
      break;
    }

    case 'angle-measurement': {
      // Vertex
      grips.push({
        entityId: entity.id,
        gripIndex: 0,
        type: 'vertex',
        position: entity.vertex,
        movesEntity: false,
      });
      // Point 1
      grips.push({
        entityId: entity.id,
        gripIndex: 1,
        type: 'vertex',
        position: entity.point1,
        movesEntity: false,
      });
      // Point 2
      grips.push({
        entityId: entity.id,
        gripIndex: 2,
        type: 'vertex',
        position: entity.point2,
        movesEntity: false,
      });
      break;
    }
  }

  return grips;
}

// ============================================================================
// HOOK
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
  const createSceneManagerAdapter = useCallback((): ISceneManager | null => {
    if (!currentLevelId) return null;
    return {
      addEntity: (entity: SceneEntity) => {
        const scene = getLevelScene(currentLevelId);
        if (scene) {
          setLevelScene(currentLevelId, {
            ...scene,
            entities: [...scene.entities, entity as unknown as AnySceneEntity],
          });
        }
      },
      removeEntity: (id: string) => {
        const scene = getLevelScene(currentLevelId);
        if (scene) {
          setLevelScene(currentLevelId, {
            ...scene,
            entities: scene.entities.filter((e) => e.id !== id),
          });
        }
      },
      getEntity: (id: string) => {
        const scene = getLevelScene(currentLevelId);
        return scene?.entities?.find((e) => e.id === id) as SceneEntity | undefined;
      },
      updateEntity: (id: string, updates: Partial<SceneEntity>) => {
        const scene = getLevelScene(currentLevelId);
        if (scene) {
          setLevelScene(currentLevelId, {
            ...scene,
            entities: scene.entities.map((e) =>
              e.id === id ? ({ ...e, ...updates } as AnySceneEntity) : e
            ),
          });
        }
      },
      updateVertex: (id: string, vertexIndex: number, position: Point2D) => {
        const scene = getLevelScene(currentLevelId);
        if (scene) {
          setLevelScene(currentLevelId, {
            ...scene,
            entities: scene.entities.map((e) => {
              if (e.id === id && 'vertices' in e && Array.isArray(e.vertices)) {
                const vertices = [...e.vertices];
                if (vertexIndex >= 0 && vertexIndex < vertices.length) {
                  vertices[vertexIndex] = position;
                }
                return { ...e, vertices };
              }
              return e;
            }),
          });
        }
      },
      insertVertex: (_id: string, _insertIndex: number, _position: Point2D) => {
        // Not needed for grip editing
      },
      removeVertex: (_id: string, _vertexIndex: number) => {
        // Not needed for grip editing
      },
      getVertices: (id: string): Point2D[] | undefined => {
        const scene = getLevelScene(currentLevelId);
        const entity = scene?.entities?.find((e) => e.id === id);
        if (entity && 'vertices' in entity) {
          return entity.vertices as Point2D[];
        }
        // For lines: synthesize vertices from start/end
        if (entity && 'start' in entity && 'end' in entity) {
          return [entity.start as Point2D, entity.end as Point2D];
        }
        return undefined;
      },
    };
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
      // 🏢 Edge-stretch: Move BOTH vertices of this edge ATOMICALLY
      // FIX (2026-02-15): Direct scene update instead of 2 sequential MoveVertexCommands.
      // Problem: cmd2 reads scene BEFORE cmd1's setLevelScene takes effect (React batching)
      // → cmd2 overwrites cmd1's changes. Solution: single atomic setLevelScene call.
      if (!currentLevelId) return;
      const scene = getLevelScene(currentLevelId);
      if (!scene) return;

      const [v1idx, v2idx] = grip.edgeVertexIndices;
      const entity = scene.entities.find(e => e.id === grip.entityId);
      if (!entity || !('vertices' in entity) || !Array.isArray(entity.vertices)) return;

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
