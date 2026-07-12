/**
 * ADR-183: Unified Grip System — Scene Manager Adapter
 *
 * ISceneManager adapter that wraps the level-scene store so grip commands
 * (MoveVertexCommand / StretchEntityCommand / CopyEntityCommand) can read
 * and write entities through the shared command interface.
 *
 * Extracted from grip-commit-adapters.ts for N.7.1 file-size compliance.
 *
 * 🏢 ADR-049: DELIBERATELY separate from the canonical `LevelSceneManagerAdapter`.
 * Its `updateVertex`/`getVertices` carry DXF grip-editing semantics the canonical
 * does NOT model — circle radius via quadrant grips, arc start/end angles,
 * rectangle 4-corner, angle-measurement. Folding it into the canonical would
 * regress those grips, so it stays a grip-specialized sibling (no forced
 * abstraction). Only the move-entity adapter duplicate (`useMoveEntities`) was
 * consolidated onto the canonical.
 */
import type { Point2D } from '../../rendering/types/Types';
import type { ISceneManager, SceneEntity } from '../../core/commands/interfaces';
import { calculateDistance } from '../../rendering/entities/shared/geometry-rendering-utils';
import type { AnySceneEntity } from '../../types/scene';
import type { Entity } from '../../types/entities';
// ADR-575 §enter-group — member-aware read/write SSoT: an id may be a top-level entity
// OR a member of a GROUP container the user has drilled into (in-place edit). ONE place
// resolves + immutably writes back the member, so every grip command edits an entered
// member without re-implementing the container descent.
import {
  findEntityOrGroupMember,
  updateEntityOrGroupMember,
  updateEntitiesOrGroupMembers,
} from '../../systems/group/group-member-scene-access';
// ADR-641 Φ4 — BLOCK-member counterpart: while a Block Editor session is open (BEDIT), the id is a
// member of the active block's `.entities` (block-local coords). `getActiveBlockEditId()` gates the
// descent; GROUP drill-in and BEDIT are mutually exclusive (ADR-641 §7), so exactly one path applies.
import { getActiveBlockEditId } from '../../systems/block/ActiveBlockEditStore';
import {
  findEntityOrBlockMember,
  updateEntityOrBlockMember,
  updateEntitiesOrBlockMembers,
  addBlockMember,
  removeEntityOrBlockMember,
} from '../../systems/block/block-member-scene-access';
// Z-order render-list reordering SSoT (shared with LevelSceneManagerAdapter — no per-adapter twin).
import { moveEntityInList, frontBackTargetIndex } from '../../systems/entity-creation/entity-zorder-ops';
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

  // ADR-575 + ADR-641 Φ4 — container-member routing SSoT for THIS adapter. An id may resolve at the
  // top level, inside an entered GROUP, or inside the active BLOCK (BEDIT). The two drill-ins are
  // mutually exclusive, so `getActiveBlockEditId()` picks the path: block-member helpers while inside
  // a Block Editor, group-member helpers otherwise (which already fold in the plain top-level case).
  const resolveEntity = (entities: readonly Entity[] | undefined, id: string): Entity | null => {
    const activeBlockId = getActiveBlockEditId();
    return activeBlockId
      ? findEntityOrBlockMember(entities, id, activeBlockId)
      : findEntityOrGroupMember(entities, id);
  };
  const writeBackEntity = (entities: readonly Entity[], id: string, updater: (e: Entity) => Entity): Entity[] => {
    const activeBlockId = getActiveBlockEditId();
    return activeBlockId
      ? updateEntityOrBlockMember(entities, id, activeBlockId, updater)
      : updateEntityOrGroupMember(entities, id, updater);
  };
  const writeBackMany = (entities: readonly Entity[], patches: ReadonlyMap<string, (e: Entity) => Entity>): Entity[] => {
    const activeBlockId = getActiveBlockEditId();
    return activeBlockId
      ? updateEntitiesOrBlockMembers(entities, patches, activeBlockId)
      : updateEntitiesOrGroupMembers(entities, patches);
  };

  return {
    addEntity: (entity: SceneEntity) => {
      const scene = getLevelScene(currentLevelId);
      if (scene) {
        // ADR-641 Φ4 — a Copy-grip inside BEDIT adds a MEMBER to the active block; top-level append otherwise.
        setLevelScene(currentLevelId, {
          ...scene,
          entities: addBlockMember(
            scene.entities as readonly Entity[],
            getActiveBlockEditId(),
            entity as unknown as Entity,
          ) as unknown as AnySceneEntity[],
        });
      }
    },
    removeEntity: (id: string) => {
      const scene = getLevelScene(currentLevelId);
      if (scene) {
        // ADR-641 Φ4 — member-aware delete (top-level OR a member of the active block).
        setLevelScene(currentLevelId, {
          ...scene,
          entities: removeEntityOrBlockMember(
            scene.entities as readonly Entity[],
            id,
            getActiveBlockEditId(),
          ) as unknown as AnySceneEntity[],
        });
      }
    },
    getEntity: (id: string) => {
      const scene = getLevelScene(currentLevelId);
      // ADR-575 / ADR-641 Φ4 — member-aware: resolves an id INSIDE an entered group OR the active block.
      return (resolveEntity(scene?.entities as readonly Entity[] | undefined, id) ?? undefined) as SceneEntity | undefined;
    },
    getEntities: () => {
      const scene = getLevelScene(currentLevelId);
      return (scene?.entities ?? []) as unknown as readonly SceneEntity[];
    },
    updateEntity: (id: string, updates: Partial<SceneEntity>) => {
      const scene = getLevelScene(currentLevelId);
      if (scene) {
        // ADR-575 / ADR-641 Φ4 — member-aware writeback (top-level, entered group, OR active block).
        setLevelScene(currentLevelId, {
          ...scene,
          entities: writeBackEntity(
            scene.entities as readonly Entity[],
            id,
            (e) => ({ ...e, ...updates } as unknown as Entity),
          ) as unknown as AnySceneEntity[],
        });
      }
    },
    updateVertex: (id: string, vertexIndex: number, position: Point2D) => {
      const scene = getLevelScene(currentLevelId);
      if (!scene) return;
      // ADR-575 / ADR-641 Φ4 — member-aware writeback: the per-type vertex transform runs on the
      // resolved entity whether it is top-level, a member of an entered group, OR of the active block.
      setLevelScene(currentLevelId, {
        ...scene,
        entities: writeBackEntity(scene.entities as readonly Entity[], id, (e) => {
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
      // ADR-575 / ADR-641 Φ4 — member-aware: resolve an entered group OR active-block member by id.
      const entity = resolveEntity(scene?.entities as readonly Entity[] | undefined, id);
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
      // ADR-575 / ADR-641 Φ4 — member-aware batch writeback: patches also reach members inside an
      // entered group OR the active block (multi-grip move of an in-place member). Build a per-id
      // patch-fn map once; the routed SSoT descends into the entered container.
      const patchFns = new Map<string, (e: Entity) => Entity>();
      updates.forEach((patch, id) => patchFns.set(id, (e) => ({ ...e, ...patch } as unknown as Entity)));
      setLevelScene(currentLevelId, {
        ...scene,
        entities: writeBackMany(scene.entities as readonly Entity[], patchFns) as unknown as AnySceneEntity[],
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
      const entities = moveEntityInList(
        scene.entities,
        entityId,
        frontBackTargetIndex(direction, scene.entities.length),
      );
      if (entities) setLevelScene(currentLevelId, { ...scene, entities });
    },
    moveEntityToIndex: (entityId: string, targetIndex: number) => {
      const scene = getLevelScene(currentLevelId);
      if (!scene) return;
      const entities = moveEntityInList(scene.entities, entityId, targetIndex);
      if (entities) setLevelScene(currentLevelId, { ...scene, entities });
    },
  };
}
