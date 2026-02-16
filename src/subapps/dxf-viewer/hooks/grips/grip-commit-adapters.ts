/**
 * ADR-183: Unified Grip System — Commit Adapters
 *
 * Adapters that know how to COMMIT a grip drag for each source system.
 * Extracted from useDxfGripInteraction (DXF) and useCanvasMouse (overlay).
 *
 * Pattern: Strategy — the unified hook delegates commit to the right adapter
 * based on `grip.source`.
 *
 * @see useDxfGripInteraction.ts — original DXF commit (commitGripDelta, createSceneManagerAdapter)
 * @see useCanvasMouse.ts — original overlay commit (handleContainerMouseUp)
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ISceneManager, SceneEntity, ICommand } from '../../core/commands/interfaces';
import type { VertexMovement } from '../../core/commands';
import { MoveVertexCommand } from '../../core/commands';
import { calculateDistance } from '../../rendering/entities/shared/geometry-rendering-utils';
import type { AnySceneEntity } from '../../types/scene';
import type { useOverlayStore } from '../../overlays/overlay-store';
import type { UnifiedGripInfo } from './unified-grip-types';

// ============================================================================
// TYPES
// ============================================================================

/** Dependencies needed for DXF grip commits */
export interface DxfCommitDeps {
  moveEntities: (ids: string[], delta: Point2D, opts: { isDragging: boolean }) => void;
  execute: (command: ICommand) => void;
  currentLevelId: string | null;
  getLevelScene: (levelId: string) => { entities: AnySceneEntity[] } | null;
  setLevelScene: (levelId: string, scene: { entities: AnySceneEntity[] }) => void;
}

/** Dependencies needed for overlay grip commits */
export interface OverlayCommitDeps {
  overlayStore: ReturnType<typeof useOverlayStore>;
  executeCommand: (command: ICommand) => void;
  movementDetectionThreshold: number;
}

// ============================================================================
// DXF GRIP COMMIT
// ============================================================================

/** Recalculate angle (degrees) between two arms meeting at a vertex */
function computeAngleDegrees(vertex: Point2D, p1: Point2D, p2: Point2D): number {
  const a1 = Math.atan2(p1.y - vertex.y, p1.x - vertex.x);
  const a2 = Math.atan2(p2.y - vertex.y, p2.x - vertex.x);
  let deg = Math.abs(a2 - a1) * (180 / Math.PI);
  if (deg > 180) deg = 360 - deg;
  return deg;
}

/**
 * Create ISceneManager adapter for MoveVertexCommand.
 * Extracted from useDxfGripInteraction.ts:378-551.
 */
export function createSceneManagerAdapter(deps: DxfCommitDeps): ISceneManager | null {
  const { currentLevelId, getLevelScene, setLevelScene } = deps;
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
      if (!scene) return;

      setLevelScene(currentLevelId, {
        ...scene,
        entities: scene.entities.map((e) => {
          if (e.id !== id) return e;

          // Polyline/polygon: has vertices array
          if ('vertices' in e && Array.isArray(e.vertices)) {
            const vertices = [...e.vertices] as Point2D[];
            if (vertexIndex >= 0 && vertexIndex < vertices.length) {
              vertices[vertexIndex] = position;
            }
            return { ...e, vertices };
          }

          // Line: gripIndex 0→start, 1→end
          if ('start' in e && 'end' in e && !('vertices' in e)) {
            if (vertexIndex === 0) return { ...e, start: position };
            if (vertexIndex === 1) return { ...e, end: position };
            return e;
          }

          // Circle: gripIndex 1-4 = quadrant → update radius
          if ('center' in e && 'radius' in e && !('startAngle' in e)) {
            const center = e.center as Point2D;
            return { ...e, radius: calculateDistance(center, position) };
          }

          // Arc: gripIndex 1→startAngle, 2→endAngle
          if ('center' in e && 'radius' in e && 'startAngle' in e && 'endAngle' in e) {
            const center = e.center as Point2D;
            const newRadius = calculateDistance(center, position);
            let angleDeg = Math.atan2(position.y - center.y, position.x - center.x) * (180 / Math.PI);
            if (angleDeg < 0) angleDeg += 360;
            if (vertexIndex === 1) return { ...e, startAngle: angleDeg, radius: newRadius };
            if (vertexIndex === 2) return { ...e, endAngle: angleDeg, radius: newRadius };
            return e;
          }

          // Rectangle: corners from corner1/corner2
          if ('corner1' in e && 'corner2' in e) {
            const c1 = e.corner1 as Point2D;
            const c2 = e.corner2 as Point2D;
            if (vertexIndex === 0) return { ...e, corner1: position };
            if (vertexIndex === 1) return { ...e, corner1: { x: c1.x, y: position.y }, corner2: { x: position.x, y: c2.y } };
            if (vertexIndex === 2) return { ...e, corner2: position };
            if (vertexIndex === 3) return { ...e, corner1: { x: position.x, y: c1.y }, corner2: { x: c2.x, y: position.y } };
            return e;
          }

          // Angle-measurement
          if ('vertex' in e && 'point1' in e && 'point2' in e) {
            const vertex = vertexIndex === 0 ? position : e.vertex as Point2D;
            const point1 = vertexIndex === 1 ? position : e.point1 as Point2D;
            const point2 = vertexIndex === 2 ? position : e.point2 as Point2D;
            return {
              ...e,
              vertex, point1, point2,
              angle: computeAngleDegrees(vertex, point1, point2),
            };
          }

          return e;
        }),
      });
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
      if (!entity) return undefined;

      if ('vertices' in entity && Array.isArray(entity.vertices)) {
        return entity.vertices as Point2D[];
      }
      if ('start' in entity && 'end' in entity) {
        return [entity.start as Point2D, entity.end as Point2D];
      }
      if ('center' in entity && 'radius' in entity && !('startAngle' in entity)) {
        const c = entity.center as Point2D;
        const r = entity.radius as number;
        return [
          c,
          { x: c.x + r, y: c.y },
          { x: c.x, y: c.y + r },
          { x: c.x - r, y: c.y },
          { x: c.x, y: c.y - r },
        ];
      }
      if ('center' in entity && 'radius' in entity && 'startAngle' in entity && 'endAngle' in entity) {
        const c = entity.center as Point2D;
        const r = entity.radius as number;
        const sa = ((entity.startAngle as number) * Math.PI) / 180;
        const ea = ((entity.endAngle as number) * Math.PI) / 180;
        const ma = (sa + ea) / 2;
        return [
          c,
          { x: c.x + r * Math.cos(sa), y: c.y + r * Math.sin(sa) },
          { x: c.x + r * Math.cos(ea), y: c.y + r * Math.sin(ea) },
          { x: c.x + r * Math.cos(ma), y: c.y + r * Math.sin(ma) },
        ];
      }
      if ('corner1' in entity && 'corner2' in entity) {
        const c1 = entity.corner1 as Point2D;
        const c2 = entity.corner2 as Point2D;
        return [
          c1,
          { x: c2.x, y: c1.y },
          c2,
          { x: c1.x, y: c2.y },
        ];
      }
      if ('vertex' in entity && 'point1' in entity && 'point2' in entity) {
        return [
          entity.vertex as Point2D,
          entity.point1 as Point2D,
          entity.point2 as Point2D,
        ];
      }
      return undefined;
    },
  };
}

/**
 * Commit a DXF grip drag.
 * Extracted from useDxfGripInteraction.ts:563-665.
 */
export function commitDxfGripDrag(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  if (delta.x === 0 && delta.y === 0) return;
  if (!grip.entityId) return;

  const { moveEntities, execute, currentLevelId, getLevelScene, setLevelScene } = deps;

  if (grip.edgeVertexIndices) {
    // Edge-stretch: Move BOTH vertices of this edge ATOMICALLY
    if (!currentLevelId) return;
    const scene = getLevelScene(currentLevelId);
    if (!scene) return;

    const entity = scene.entities.find(e => e.id === grip.entityId);
    if (!entity) return;

    // Polyline/polygon
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
    // Line: move both start and end
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
    // Rectangle: edge midpoints move one side
    else if ('corner1' in entity && 'corner2' in entity) {
      const c1 = entity.corner1 as Point2D;
      const c2 = entity.corner2 as Point2D;
      const [v1, v2] = grip.edgeVertexIndices;
      let newC1 = { ...c1 };
      let newC2 = { ...c2 };

      if ((v1 === 0 && v2 === 1) || (v1 === 1 && v2 === 0)) {
        newC1 = { ...c1, y: c1.y + delta.y };
      } else if ((v1 === 1 && v2 === 2) || (v1 === 2 && v2 === 1)) {
        newC2 = { ...c2, x: c2.x + delta.x };
      } else if ((v1 === 2 && v2 === 3) || (v1 === 3 && v2 === 2)) {
        newC2 = { ...c2, y: c2.y + delta.y };
      } else if ((v1 === 3 && v2 === 0) || (v1 === 0 && v2 === 3)) {
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
    moveEntities([grip.entityId], delta, { isDragging: false });
  } else {
    // Move single vertex via command
    const sceneManager = createSceneManagerAdapter(deps);
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
}

// ============================================================================
// OVERLAY GRIP COMMIT
// ============================================================================

/**
 * Commit an overlay vertex grip drag (single or multi-vertex).
 * Extracted from useCanvasMouse.ts:520-557.
 */
export async function commitOverlayVertexDrag(
  grips: UnifiedGripInfo[],
  delta: Point2D,
  deps: OverlayCommitDeps,
): Promise<void> {
  const { overlayStore, executeCommand } = deps;

  const movements: VertexMovement[] = grips.map(grip => {
    const overlay = overlayStore.overlays[grip.overlayId!];
    const polygon = overlay?.polygon;
    const vertexIndex = grip.gripIndex;
    const oldX = polygon?.[vertexIndex]?.[0] ?? 0;
    const oldY = polygon?.[vertexIndex]?.[1] ?? 0;

    return {
      overlayId: grip.overlayId!,
      vertexIndex,
      oldPosition: [oldX, oldY] as [number, number],
      newPosition: [oldX + delta.x, oldY + delta.y] as [number, number],
    };
  });

  const { MoveMultipleOverlayVerticesCommand } = await import('../../core/commands');
  const command = new MoveMultipleOverlayVerticesCommand(movements, overlayStore);
  executeCommand(command);
}

/**
 * Commit an overlay edge midpoint grip drag (vertex insertion).
 * Extracted from useCanvasMouse.ts:559-589.
 */
export async function commitOverlayEdgeMidpointDrag(
  grip: UnifiedGripInfo,
  worldPos: Point2D,
  newVertexCreated: boolean,
  deps: OverlayCommitDeps,
): Promise<void> {
  const { overlayStore } = deps;
  if (!grip.overlayId || grip.edgeInsertIndex === undefined) return;

  if (!newVertexCreated) {
    await overlayStore.addVertex(
      grip.overlayId,
      grip.edgeInsertIndex,
      [worldPos.x, worldPos.y]
    );
  } else {
    await overlayStore.updateVertex(
      grip.overlayId,
      grip.edgeInsertIndex,
      [worldPos.x, worldPos.y]
    );
  }
}

/**
 * Commit an overlay body drag (move entire overlay).
 * Extracted from useCanvasMouse.ts:591-626.
 */
export async function commitOverlayBodyDrag(
  overlayId: string,
  delta: Point2D,
  deps: OverlayCommitDeps,
): Promise<void> {
  const { overlayStore, executeCommand, movementDetectionThreshold } = deps;

  const hasMovement = Math.abs(delta.x) > movementDetectionThreshold ||
                      Math.abs(delta.y) > movementDetectionThreshold;

  if (hasMovement) {
    const { MoveOverlayCommand } = await import('../../core/commands');
    const command = new MoveOverlayCommand(
      overlayId,
      delta,
      overlayStore,
      true // isDragging = true
    );
    executeCommand(command);
  }
}
