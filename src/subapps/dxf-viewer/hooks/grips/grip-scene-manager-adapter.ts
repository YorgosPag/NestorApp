/**
 * ADR-183: Unified Grip System — Scene Manager Adapter
 *
 * ISceneManager adapter that wraps the level-scene store so grip commands
 * (MoveVertexCommand / StretchEntityCommand / CopyEntityCommand) can read
 * and write entities through the shared command interface.
 *
 * Extracted from grip-commit-adapters.ts for N.7.1 file-size compliance.
 */
import type { Point2D } from '../../rendering/types/Types';
import type { ISceneManager, SceneEntity } from '../../core/commands/interfaces';
import { calculateDistance } from '../../rendering/entities/shared/geometry-rendering-utils';
import type { AnySceneEntity } from '../../types/scene';
import type { DxfCommitDeps } from './unified-grip-types';

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/** Recalculate angle (degrees) between two arms meeting at a vertex */
export function computeAngleDegrees(vertex: Point2D, p1: Point2D, p2: Point2D): number {
  const a1 = Math.atan2(p1.y - vertex.y, p1.x - vertex.x);
  const a2 = Math.atan2(p2.y - vertex.y, p2.x - vertex.x);
  let deg = Math.abs(a2 - a1) * (180 / Math.PI);
  if (deg > 180) deg = 360 - deg;
  return deg;
}

// ============================================================================
// SCENE MANAGER ADAPTER
// ============================================================================

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
    getEntities: () => {
      const scene = getLevelScene(currentLevelId);
      return (scene?.entities ?? []) as unknown as readonly SceneEntity[];
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
    updateEntities: (updates: ReadonlyMap<string, Partial<SceneEntity>>) => {
      const scene = getLevelScene(currentLevelId);
      if (!scene) return;
      setLevelScene(currentLevelId, {
        ...scene,
        entities: scene.entities.map((e) => {
          const patch = updates.get(e.id);
          return patch ? ({ ...e, ...patch } as AnySceneEntity) : e;
        }),
      });
    },
    getEntityIndex: (entityId: string): number => {
      const scene = getLevelScene(currentLevelId);
      if (!scene) return -1;
      return scene.entities.findIndex((e) => e.id === entityId);
    },
    reorderEntity: (entityId: string, direction: 'front' | 'back') => {
      const scene = getLevelScene(currentLevelId);
      if (!scene) return;
      const idx = scene.entities.findIndex((e) => e.id === entityId);
      if (idx === -1) return;
      const entities = [...scene.entities];
      const [entity] = entities.splice(idx, 1);
      if (direction === 'front') entities.push(entity);
      else entities.unshift(entity);
      setLevelScene(currentLevelId, { ...scene, entities });
    },
    moveEntityToIndex: (entityId: string, targetIndex: number) => {
      const scene = getLevelScene(currentLevelId);
      if (!scene) return;
      const idx = scene.entities.findIndex((e) => e.id === entityId);
      if (idx === -1) return;
      const entities = [...scene.entities];
      const [entity] = entities.splice(idx, 1);
      entities.splice(targetIndex, 0, entity);
      setLevelScene(currentLevelId, { ...scene, entities });
    },
  };
}
