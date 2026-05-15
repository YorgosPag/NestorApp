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
import { calculateDistance } from '../../rendering/entities/shared/geometry-rendering-utils';
import type { AnySceneEntity, SceneModel } from '../../types/scene';
import type { useOverlayStore } from '../../overlays/overlay-store';
import type { UnifiedGripInfo } from './unified-grip-types';
import { type GripMode } from '../../systems/grip/grip-mode-cycle';
import { GripHandoffStore } from '../../systems/grip/GripHandoffStore';
import { gripToVertexRefs } from '../../systems/grip/grip-to-vertex-refs';
import { StretchEntityCommand, type StretchParams } from '../../core/commands/entity-commands/StretchEntityCommand';
import type { Entity } from '../../types/entities';

// ============================================================================
// TYPES
// ============================================================================

/** Dependencies needed for DXF grip commits */
export interface DxfCommitDeps {
  moveEntities: (ids: string[], delta: Point2D, opts: { isDragging: boolean }) => void;
  execute: (command: ICommand) => void;
  currentLevelId: string | null;
  getLevelScene: (levelId: string) => SceneModel | null;
  setLevelScene: (levelId: string, scene: SceneModel) => void;
  /** Switch active tool — required for rotate/scale/mirror grip handoff (ADR-349 Phase 1c-B2). */
  onToolChange: (tool: string) => void;
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
 * Commit a DXF grip drag through the unified `StretchEntityCommand` (ADR-349
 * Phase 1c-B3). Replaces the legacy fragmented `commitDxfGripDrag` (manual
 * edge mutation per entity type / `MoveVertexCommand` / `moveEntities`):
 *
 *   - vertex/edge grips → resolved to `VertexRef[]` via `gripToVertexRefs` and
 *     dispatched as `vertexMoves` (line / polyline / arc / rectangle)
 *   - whole-entity grips (`grip.movesEntity` — circle / ellipse / text / point /
 *     block) → dispatched as `anchorMoves` (rigid translation by anchor)
 *
 * The math (bulge-preserving arc, rectangle → polyline coercion, polyline /
 * line / spline per-vertex translation) lives in `stretch-entity-transform.ts`
 * and is shared with `useStretchPreview` so the ghost cannot diverge from the
 * commit result.
 */
export function commitDxfGripDragViaStretchCommand(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  if (delta.x === 0 && delta.y === 0) return;
  if (!grip.entityId) return;

  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;

  const entity = sceneManager.getEntity(grip.entityId);
  if (!entity) return;

  const refs = gripToVertexRefs(entity as unknown as Entity, grip);

  const vertexMoves = refs.length > 0 ? [{ entityId: grip.entityId, refs }] : [];
  const anchorMoves = refs.length === 0 && grip.movesEntity ? [grip.entityId] : [];

  if (vertexMoves.length === 0 && anchorMoves.length === 0) return;

  const params: StretchParams = { vertexMoves, anchorMoves, displacement: delta };
  const command = new StretchEntityCommand(params, sceneManager);
  if (command.validate() !== null) return;
  deps.execute(command);
}

/**
 * Mode-aware DXF grip commit (ADR-349 Phase 1c-A / 1c-B2 / 1c-B3).
 *
 * Routes the drag through the strategy selected by the spacebar cycle:
 *   - `stretch` (default) — Phase 1c-B3: routes through `StretchEntityCommand`
 *     via {@link commitDxfGripDragViaStretchCommand} (vertex refs for line /
 *     polyline / arc / rectangle, anchor for circle / ellipse / text / etc.)
 *   - `move` — translates the WHOLE entity regardless of grip type
 *   - `rotate` / `scale` / `mirror` — Phase 1c-B2: pre-seeds the target tool's
 *     first point in {@link GripHandoffStore} and switches `activeTool`
 */
export function commitDxfGripDragModeAware(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
  mode: GripMode,
): void {
  if (delta.x === 0 && delta.y === 0) return;
  if (!grip.entityId) return;

  if (mode === 'move') {
    deps.moveEntities([grip.entityId], delta, { isDragging: false });
    return;
  }

  if (mode === 'rotate' || mode === 'scale' || mode === 'mirror') {
    GripHandoffStore.set(mode, grip.position);
    deps.onToolChange(mode);
    return;
  }

  // mode === 'stretch' (default): unified StretchEntityCommand path.
  commitDxfGripDragViaStretchCommand(grip, delta, deps);
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
  const { overlayStore, executeCommand, movementDetectionThreshold } = deps;

  // 🐛 FIX (2026-05-09): Click-without-drag teleported vertex to (0,0).
  // Two root causes: (1) no movement threshold guard so a bare click committed
  // a zero-delta move that, combined with (2) the `?? 0` fallback when the
  // vertex was missing in the store, produced (0,0) targets. Now: skip commit
  // entirely if there is no real movement, and skip any grip whose vertex is
  // not currently in the polygon (no silent (0,0) substitution).
  const hasMovement = Math.abs(delta.x) > movementDetectionThreshold ||
                      Math.abs(delta.y) > movementDetectionThreshold;
  if (!hasMovement) return;

  const movements: VertexMovement[] = [];
  for (const grip of grips) {
    const overlay = overlayStore.overlays[grip.overlayId!];
    const polygon = overlay?.polygon;
    const vertexIndex = grip.gripIndex;
    const vertex = polygon?.[vertexIndex];
    if (!vertex) continue;
    const oldX = vertex[0];
    const oldY = vertex[1];
    movements.push({
      overlayId: grip.overlayId!,
      vertexIndex,
      oldPosition: [oldX, oldY] as [number, number],
      newPosition: [oldX + delta.x, oldY + delta.y] as [number, number],
    });
  }

  if (movements.length === 0) return;

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
