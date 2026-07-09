// 🏢 ADR-363 Phase 2 — Opening tool resolver helpers
// ADR-615 — self-hosted (free-standing) opening resolvers added (additive,
// wall-hosted path untouched below).
// Extracted from useSpecialTools.ts to keep that file ≤500 LOC (Google SRP).

import { isWallEntity } from '../../types/entities';
import type { Entity } from '../../types/entities';
import type { WallEntity } from '../../bim/types/wall-types';
import type { OpeningEntity } from '../../bim/types/opening-types';
import type { Point2D } from '../../rendering/types/Types';
import { EventBus } from '../../systems/events/EventBus';
import type { LevelsHookReturn } from '../../systems/levels';
import { resolveSceneUnits, type SceneUnits } from '../../utils/scene-units';
import { appendEntityToScene } from '../../bim/scene/append-entity-to-scene';

type LevelManagerLike = LevelsHookReturn;

export interface OpeningToolResolvers {
  currentLevelId: string;
  getWallById: (wallId: string) => WallEntity | null;
  getWallAtPoint: (point: Readonly<Point2D>) => WallEntity | null;
  getSceneUnits: () => SceneUnits;
  onOpeningCreated: (openingEntity: OpeningEntity) => void;
}

export function buildOpeningResolvers(levelManager: LevelManagerLike): OpeningToolResolvers {
  return {
    currentLevelId: levelManager.currentLevelId || '0',
    getWallById: (wallId) => {
      const levelId = levelManager.currentLevelId;
      if (!levelId) return null;
      const scene = levelManager.getLevelScene(levelId);
      if (!scene) return null;
      const e = scene.entities.find((x) => x.id === wallId);
      return e && isWallEntity(e) ? (e as WallEntity) : null;
    },
    getWallAtPoint: (point) => {
      const levelId = levelManager.currentLevelId;
      if (!levelId) return null;
      const scene = levelManager.getLevelScene(levelId);
      if (!scene) return null;
      const walls = scene.entities.filter(isWallEntity) as WallEntity[];
      // Bbox containment — adequate for Phase 2 click placement.
      return walls.find((w) => {
        const bb = w.geometry?.bbox;
        if (!bb) return false;
        return point.x >= bb.min.x && point.x <= bb.max.x
            && point.y >= bb.min.y && point.y <= bb.max.y;
      }) ?? null;
    },
    getSceneUnits: () => {
      const levelId = levelManager.currentLevelId;
      if (!levelId) return 'mm';
      return resolveSceneUnits(levelManager.getLevelScene(levelId));
    },
    onOpeningCreated: (openingEntity) => {
      const levelId = levelManager.currentLevelId;
      if (!levelId) return;
      const scene = levelManager.getLevelScene(levelId);
      if (!scene) return;
      // Update host wall's `hostedOpeningIds` mirror so the wall renderer
      // and BOQ pipeline can find the opening from the host side.
      const nextEntities: Entity[] = scene.entities.map((e) => {
        if (!isWallEntity(e)) return e as Entity;
        if (e.id !== openingEntity.params.wallId) return e as Entity;
        const existing = (e as WallEntity).hostedOpeningIds ?? [];
        if (existing.includes(openingEntity.id)) return e as Entity;
        return { ...(e as WallEntity), hostedOpeningIds: [...existing, openingEntity.id] } as Entity;
      });
      levelManager.setLevelScene(levelId, {
        ...scene,
        entities: [...nextEntities, openingEntity],
      });
      EventBus.emit('drawing:entity-created', { entity: openingEntity, tool: 'opening' });
    },
  };
}

// ─── ADR-615 — Self-hosted (free-standing) opening resolvers ────────────────

/**
 * Resolver shape consumed by `useSelfOpeningTool` (ADR-615). Mirrors
 * `OpeningToolResolvers` minus the host-wall lookups — a self-hosted opening
 * has no `WallEntity` to resolve/mirror, so `onOpeningCreated` is a plain
 * `appendEntityToScene` (SSoT — no `hostedOpeningIds` mirror needed).
 */
export interface SelfOpeningToolResolvers {
  currentLevelId: string;
  getSceneUnits: () => SceneUnits;
  onOpeningCreated: (openingEntity: OpeningEntity) => void;
}

export function buildSelfOpeningResolvers(levelManager: LevelManagerLike): SelfOpeningToolResolvers {
  return {
    currentLevelId: levelManager.currentLevelId || '0',
    getSceneUnits: () => {
      const levelId = levelManager.currentLevelId;
      if (!levelId) return 'mm';
      return resolveSceneUnits(levelManager.getLevelScene(levelId));
    },
    onOpeningCreated: (openingEntity) => {
      // ADR-615 — no host wall to mirror; plain append + broadcast (SSoT).
      appendEntityToScene(levelManager, openingEntity, 'self-opening');
    },
  };
}
