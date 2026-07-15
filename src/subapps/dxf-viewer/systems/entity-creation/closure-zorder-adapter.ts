/**
 * ADR-661 — closure-based z-order adapter methods (SSoT).
 *
 * The two closure-style `ISceneManager` adapters — `grip-scene-manager-adapter` and the one inside
 * `useGripMovement` — both wrap a `(levelId) → SceneModel` getter + a `(levelId, SceneModel)` setter.
 * Their WHOLE z-order method set (index lookup, single + batch reorder, order snapshot/restore) was
 * byte-identical (CHECK 3.28 jscpd sibling clone), so it lives here ONCE and both adapters spread the
 * result. The class adapter (`LevelSceneManagerAdapter`) uses its own member-aware `commitScene`, so
 * it calls the same pure `entity-zorder-ops` helpers directly instead of this closure factory.
 */

import type { SceneModel, AnySceneEntity } from '../../types/scene';
import type { ISceneManager } from '../../core/commands/interfaces';
import {
  moveEntityInList,
  moveEntitiesInList,
  frontBackTargetIndex,
  entityIdOrder,
  reorderEntitiesToIdList,
} from './entity-zorder-ops';

/**
 * The z-order slice of `ISceneManager`, bound to a level's scene getter/setter. Derived via `Pick`
 * from the interface itself (single source of truth for the signatures — no re-declared twin).
 */
export type ClosureZOrderMethods = Pick<
  ISceneManager,
  'getEntityIndex' | 'reorderEntity' | 'moveEntityToIndex' | 'reorderEntities' | 'getEntityOrder' | 'setEntityOrder'
>;

/** Build the z-order methods against a level-scoped scene getter/setter (shared SSoT). */
export function buildClosureZOrderMethods(
  getScene: (levelId: string) => SceneModel | null,
  setScene: (levelId: string, scene: SceneModel) => void,
  levelId: string,
): ClosureZOrderMethods {
  const commit = (scene: SceneModel, entities: readonly { id: string }[]): void => {
    setScene(levelId, { ...scene, entities: entities as AnySceneEntity[] });
  };
  return {
    getEntityIndex(entityId) {
      const scene = getScene(levelId);
      return scene ? scene.entities.findIndex((e) => e.id === entityId) : -1;
    },
    reorderEntity(entityId, direction) {
      const scene = getScene(levelId);
      if (!scene) return;
      const entities = moveEntityInList(scene.entities, entityId, frontBackTargetIndex(direction, scene.entities.length));
      if (entities) commit(scene, entities);
    },
    moveEntityToIndex(entityId, targetIndex) {
      const scene = getScene(levelId);
      if (!scene) return;
      const entities = moveEntityInList(scene.entities, entityId, targetIndex);
      if (entities) commit(scene, entities);
    },
    reorderEntities(ids, direction) {
      const scene = getScene(levelId);
      if (!scene) return;
      const entities = moveEntitiesInList(scene.entities, new Set(ids), direction);
      if (entities) commit(scene, entities);
    },
    getEntityOrder() {
      const scene = getScene(levelId);
      return scene ? entityIdOrder(scene.entities) : [];
    },
    setEntityOrder(orderedIds) {
      const scene = getScene(levelId);
      if (!scene) return;
      const entities = reorderEntitiesToIdList(scene.entities, orderedIds);
      if (entities) commit(scene, entities);
    },
  };
}
