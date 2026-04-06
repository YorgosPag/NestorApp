/**
 * GRIP SCENE ADAPTER — ISceneManager adapter for grip editing
 *
 * Creates an ISceneManager implementation that bridges between the grip
 * interaction hook and the level-based scene storage. Handles vertex
 * updates for all entity types (polyline, line, circle, arc, rectangle, angle).
 *
 * @module hooks/grip-scene-adapter
 * @see useDxfGripInteraction.ts
 */

import type { Point2D } from '../rendering/types/Types';
import type { ISceneManager, SceneEntity } from '../core/commands/interfaces';
import type { AnySceneEntity } from '../types/scene';
import { calculateDistance } from '../rendering/entities/shared/geometry-rendering-utils';
import { computeAngleDegrees } from './grip-computation';

// ============================================================================
// TYPES
// ============================================================================

interface LevelSceneAccess {
  currentLevelId: string;
  getLevelScene: (levelId: string) => { entities: AnySceneEntity[] } | null;
  setLevelScene: (levelId: string, scene: { entities: AnySceneEntity[] }) => void;
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Create an ISceneManager adapter for MoveVertexCommand.
 * Bridges grip editing operations to the level-based scene storage.
 */
export function createGripSceneAdapter(access: LevelSceneAccess): ISceneManager {
  const { currentLevelId, getLevelScene, setLevelScene } = access;

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

          // Circle: gripIndex 1-4 = quadrant → update radius (center stays fixed)
          if ('center' in e && 'radius' in e && !('startAngle' in e)) {
            const center = e.center as Point2D;
            return { ...e, radius: calculateDistance(center, position) };
          }

          // Arc: gripIndex 1→startAngle, 2→endAngle (+ update radius)
          if ('center' in e && 'radius' in e && 'startAngle' in e && 'endAngle' in e) {
            const center = e.center as Point2D;
            const newRadius = calculateDistance(center, position);
            let angleDeg = Math.atan2(position.y - center.y, position.x - center.x) * (180 / Math.PI);
            if (angleDeg < 0) angleDeg += 360;
            if (vertexIndex === 1) return { ...e, startAngle: angleDeg, radius: newRadius };
            if (vertexIndex === 2) return { ...e, endAngle: angleDeg, radius: newRadius };
            return e;
          }

          // Rectangle: gripIndex 0-3 → corners derived from corner1/corner2
          if ('corner1' in e && 'corner2' in e) {
            const c1 = e.corner1 as Point2D;
            const c2 = e.corner2 as Point2D;
            if (vertexIndex === 0) return { ...e, corner1: position };
            if (vertexIndex === 1) return { ...e, corner1: { x: c1.x, y: position.y }, corner2: { x: position.x, y: c2.y } };
            if (vertexIndex === 2) return { ...e, corner2: position };
            if (vertexIndex === 3) return { ...e, corner1: { x: position.x, y: c1.y }, corner2: { x: c2.x, y: position.y } };
            return e;
          }

          // Angle-measurement: gripIndex 0→vertex, 1→point1, 2→point2
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

      // Polyline/polygon: actual vertices array
      if ('vertices' in entity && Array.isArray(entity.vertices)) {
        return entity.vertices as Point2D[];
      }
      // Line: [start, end]
      if ('start' in entity && 'end' in entity) {
        return [entity.start as Point2D, entity.end as Point2D];
      }
      // Circle: [center, E, N, W, S]
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
      // Arc: [center, startPt, endPt, midArcPt]
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
      // Rectangle: 4 corners from corner1/corner2
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
      // Angle-measurement: [vertex, point1, point2]
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
