'use client';

/**
 * ADR-412 Φ5 — Family-type edit side-effects (all-floors BOQ re-feed) SSoT.
 *
 * When a wall TYPE's `typeParams` change, every placed instance must re-flow:
 *   - GEOMETRY — handled for free by the store-`version` re-resolution
 *     (`useWallTypeReresolution`) on the ACTIVE floor, and on OTHER floors by
 *     `docToEntity`/`resolveEffectiveWallParams` at next load («type always
 *     wins»). NOTHING to do here for geometry.
 *   - BOQ — a persisted aggregate cache that does NOT auto-refresh per instance
 *     (only the primary-selected wall auto-persists). So a type edit MUST
 *     eager-re-feed the BOQ row of every affected wall, on every floor, to keep
 *     project-wide schedules correct (Revit-grade).
 *
 * This module is the fan-out: enumerate the building's levels, get each floor's
 * scene (active = in-memory, others = `loadFileV2`), re-resolve its walls of the
 * edited type against the (already-updated) catalog store, and re-feed BOQ with
 * THAT floor's `floorId`. Pure except for the injected `loadFileV2` + BOQ bridge,
 * so it is unit-testable with fakes.
 *
 * Known limitation (logged, not silent): a level without a `sceneFileId` (BIM
 * placed but the DXF scene file was never saved) cannot be reached here — its
 * walls keep correct geometry on load but their BOQ stays stale until that floor
 * is loaded/persisted. Full coverage would need a `floorplan_walls WHERE
 * buildingId==X AND typeId==Y` composite-index query (out of Φ5 scope).
 *
 * @see hooks/data/useFamilyTypeBoqRefeed.ts — the host hook that wires this up
 * @see docs/centralized-systems/reference/adrs/ADR-412-bim-family-types.md §3.5 §5
 */

import { createModuleLogger } from '@/lib/telemetry';
import type { SceneModel } from '../../types/entities';
import { isWallEntity } from '../../types/entities';
import type { WallEntity } from '../types/wall-types';
import { reresolveWallEntity } from '../../hooks/data/wall-persistence-helpers';
import { wallBoqEntity } from '../../hooks/data/wall-boq-feed';
import { bimToBoqBridge, type BimBoqContext, type BimEntityForBoq } from '../services/BimToBoqBridge';

const logger = createModuleLogger('FamilyTypeSideEffects');

/** All walls in a scene linked to a given family type. Pure. */
export function findWallsByTypeId(scene: SceneModel | null, typeId: string): WallEntity[] {
  if (!scene) return [];
  return scene.entities.filter(isWallEntity).filter((w) => w.typeId === typeId);
}

/** Minimal level shape needed to source each floor's scene + tag its BOQ rows. */
export interface FloorLevelLike {
  readonly id: string;
  readonly floorId?: string;
  readonly sceneFileId?: string;
}

export interface RefeedBoqForTypeArgs {
  readonly typeId: string;
  /** Levels of the active building (caller pre-filters by `buildingId`). */
  readonly levels: readonly FloorLevelLike[];
  readonly activeLevelId: string | null;
  readonly getLevelScene: (levelId: string) => SceneModel | null;
  readonly loadFileV2: (fileId: string) => Promise<{ scene?: SceneModel | null } | null>;
  readonly boqContextBase: Pick<BimBoqContext, 'companyId' | 'projectId' | 'buildingId'>;
  /** Injectable for tests; defaults to the production fire-and-forget BOQ bridge. */
  readonly upsertBoq?: (
    entityType: 'wall',
    entity: BimEntityForBoq,
    context: BimBoqContext,
    action: 'updated',
  ) => void;
}

/**
 * Re-feed the BOQ row of every wall of `typeId` across all of the building's
 * floors. Geometry is re-resolved against the live catalog store, so callers
 * MUST invoke this AFTER the optimistic `setTypes` (the command does). Returns
 * once every floor has been visited; BOQ writes are fire-and-forget.
 */
export async function refeedBoqForTypeAcrossFloors(args: RefeedBoqForTypeArgs): Promise<void> {
  const { companyId, projectId, buildingId } = args.boqContextBase;
  if (!companyId || !projectId || !buildingId) return;
  const upsert =
    args.upsertBoq ??
    ((entityType, entity, context, action) => {
      void bimToBoqBridge.upsertBoqItemForBim(entityType, entity, context, action);
    });

  for (const level of args.levels) {
    const scene = await sceneForLevel(level, args);
    if (!scene) continue;
    for (const wall of findWallsByTypeId(scene, args.typeId)) {
      // «type always wins»: re-resolve against the already-updated store so the
      // BOQ payload carries the NEW type-level params (non-active floors hold
      // drift-cache params from their persisted doc).
      const resolved = reresolveWallEntity(wall);
      upsert(
        'wall',
        wallBoqEntity(resolved, scene),
        { companyId, projectId, buildingId, floorId: level.floorId },
        'updated',
      );
    }
  }
}

/** Active floor → in-memory (already re-resolved); other floors → one-shot load. */
async function sceneForLevel(
  level: FloorLevelLike,
  args: RefeedBoqForTypeArgs,
): Promise<SceneModel | null> {
  if (level.id === args.activeLevelId) return args.getLevelScene(level.id);
  if (!level.sceneFileId) {
    logger.warn('Skipping BOQ re-feed for floor without sceneFileId (stale until loaded)', {
      levelId: level.id,
      floorId: level.floorId,
      typeId: args.typeId,
    });
    return null;
  }
  const record = await args.loadFileV2(level.sceneFileId).catch(() => null);
  return record?.scene ?? null;
}
