// 🏢 ADR-363 Phase 3.7 — Slab-Opening tool resolver helpers
// Extracted from useSpecialTools.ts to keep that file ≤500 LOC (Google SRP).

import { isSlabEntity } from '../../types/entities';
import type { SlabEntity } from '../../bim/types/slab-types';
import type { SlabOpeningEntity } from '../../bim/types/slab-opening-types';
import type { Point2D } from '../../rendering/types/Types';
import { EventBus } from '../../systems/events/EventBus';
import type { LevelsHookReturn } from '../../systems/levels';
import { resolveSceneUnits, type SceneUnits } from '../../utils/scene-units';

type LevelManagerLike = LevelsHookReturn;

export interface SlabOpeningToolResolvers {
  currentLevelId: string;
  getSlabById: (slabId: string) => SlabEntity | null;
  getSlabAtPoint: (point: Readonly<Point2D>) => SlabEntity | null;
  onSlabOpeningCreated: (openingEntity: SlabOpeningEntity) => void;
  /** ADR-370 — units του active scene για mm→scene-units conversion στο builder. */
  getSceneUnits: () => SceneUnits;
}

export function buildSlabOpeningResolvers(levelManager: LevelManagerLike): SlabOpeningToolResolvers {
  return {
    currentLevelId: levelManager.currentLevelId || '0',
    getSlabById: (slabId) => {
      const levelId = levelManager.currentLevelId;
      if (!levelId) return null;
      const scene = levelManager.getLevelScene(levelId);
      if (!scene) return null;
      const e = scene.entities.find((x) => x.id === slabId);
      return e && isSlabEntity(e) ? (e as SlabEntity) : null;
    },
    getSlabAtPoint: (point) => {
      const levelId = levelManager.currentLevelId;
      if (!levelId) return null;
      const scene = levelManager.getLevelScene(levelId);
      if (!scene) return null;
      const slabs = scene.entities.filter(isSlabEntity) as SlabEntity[];
      return slabs.find((s) => {
        const bb = s.geometry?.bbox;
        if (!bb) return false;
        return point.x >= bb.min.x && point.x <= bb.max.x
            && point.y >= bb.min.y && point.y <= bb.max.y;
      }) ?? null;
    },
    onSlabOpeningCreated: (openingEntity) => {
      const levelId = levelManager.currentLevelId;
      if (!levelId) return;
      const scene = levelManager.getLevelScene(levelId);
      if (!scene) return;
      // Mirror: append opening id to host slab's slabOpeningIds (bidirectional link).
      const nextEntities = scene.entities.map((e) => {
        if (!isSlabEntity(e) || e.id !== openingEntity.params.slabId) return e;
        const existing = (e as SlabEntity).params.slabOpeningIds ?? [];
        if (existing.includes(openingEntity.id)) return e;
        return {
          ...(e as SlabEntity),
          params: { ...(e as SlabEntity).params, slabOpeningIds: [...existing, openingEntity.id] },
        };
      });
      levelManager.setLevelScene(levelId, {
        ...scene,
        entities: [...nextEntities, openingEntity],
      });
      EventBus.emit('drawing:entity-created', { entity: openingEntity, tool: 'slab-opening' });
    },
    // ADR-370 — propagate active scene units so the slab-opening rectangle
    // builder scales the mm-baked defaults into the host scene's coordinate
    // space (otherwise a 1.5 m shaft in a meter-units scene became 1500 m).
    getSceneUnits: () => {
      const levelId = levelManager.currentLevelId;
      if (!levelId) return 'mm';
      return resolveSceneUnits(levelManager.getLevelScene(levelId));
    },
  };
}
