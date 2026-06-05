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
import { isRoofEntity, isSlabEntity, isWallEntity } from '../../types/entities';
import type { WallEntity } from '../types/wall-types';
import type { SlabEntity } from '../types/slab-types';
import type { RoofEntity } from '../types/roof-types';
import { reresolveWallEntity } from '../../hooks/data/wall-persistence-helpers';
import { reresolveSlabEntity } from '../../hooks/data/slab-persistence-helpers';
import { reresolveRoofEntity } from '../../hooks/data/roof-persistence-helpers';
import { wallBoqEntity } from '../../hooks/data/wall-boq-feed';
import { slabBoqGeometry } from '../../hooks/data/slab-boq-feed';
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

// ─── Slab variant (analogue of the wall fan-out above) ───────────────────────

/** All slabs in a scene linked to a given family type. Pure. */
export function findSlabsByTypeId(scene: SceneModel | null, typeId: string): SlabEntity[] {
  if (!scene) return [];
  return scene.entities.filter(isSlabEntity).filter((s) => s.typeId === typeId);
}

export interface RefeedSlabBoqForTypeArgs {
  readonly typeId: string;
  /** Levels of the active building (caller pre-filters by `buildingId`). */
  readonly levels: readonly FloorLevelLike[];
  readonly activeLevelId: string | null;
  readonly getLevelScene: (levelId: string) => SceneModel | null;
  readonly loadFileV2: (fileId: string) => Promise<{ scene?: SceneModel | null } | null>;
  readonly boqContextBase: Pick<BimBoqContext, 'companyId' | 'projectId' | 'buildingId'>;
  /** Injectable for tests; defaults to the production fire-and-forget BOQ bridge. */
  readonly upsertBoq?: (
    entityType: 'slab',
    entity: { id: string; kind: string; geometry: ReturnType<typeof slabBoqGeometry> },
    context: BimBoqContext,
    action: 'updated',
  ) => void;
}

/**
 * Re-feed the BOQ row of every slab of `typeId` across all of the building's
 * floors. Geometry is re-resolved against the live catalog store, so callers
 * MUST invoke this AFTER the optimistic `setTypes`. Mirror of
 * {@link refeedBoqForTypeAcrossFloors}.
 */
export async function refeedSlabBoqForTypeAcrossFloors(args: RefeedSlabBoqForTypeArgs): Promise<void> {
  const { companyId, projectId, buildingId } = args.boqContextBase;
  if (!companyId || !projectId || !buildingId) return;
  const upsert =
    args.upsertBoq ??
    ((entityType, entity, context, action) => {
      void bimToBoqBridge.upsertBoqItemForBim(entityType, entity, context, action);
    });

  for (const level of args.levels) {
    const scene = await sceneForSlabLevel(level, args);
    if (!scene) continue;
    for (const slab of findSlabsByTypeId(scene, args.typeId)) {
      // «type always wins»: re-resolve against the already-updated store so the
      // BOQ payload carries the NEW type-level params.
      const resolved = reresolveSlabEntity(slab);
      upsert(
        'slab',
        { id: resolved.id, kind: resolved.kind, geometry: slabBoqGeometry(resolved, scene) },
        { companyId, projectId, buildingId, floorId: level.floorId },
        'updated',
      );
    }
  }
}

/** Active floor → in-memory (already re-resolved); other floors → one-shot load. */
async function sceneForSlabLevel(
  level: FloorLevelLike,
  args: RefeedSlabBoqForTypeArgs,
): Promise<SceneModel | null> {
  if (level.id === args.activeLevelId) return args.getLevelScene(level.id);
  if (!level.sceneFileId) {
    logger.warn('Skipping slab BOQ re-feed for floor without sceneFileId (stale until loaded)', {
      levelId: level.id,
      floorId: level.floorId,
      typeId: args.typeId,
    });
    return null;
  }
  const record = await args.loadFileV2(level.sceneFileId).catch(() => null);
  return record?.scene ?? null;
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

// ─── Roof variant (analogue of the slab fan-out above, ADR-417 §10 #3) ───────

/** All roofs in a scene linked to a given family type. Pure. */
export function findRoofsByTypeId(scene: SceneModel | null, typeId: string): RoofEntity[] {
  if (!scene) return [];
  return scene.entities.filter(isRoofEntity).filter((r) => r.typeId === typeId);
}

/** Roof BOQ geometry = gross (sloped) area m² — mirror the persist-path feed. */
type RoofBoqGeometry = { readonly area: number };

export interface RefeedRoofBoqForTypeArgs {
  readonly typeId: string;
  /** Levels of the active building (caller pre-filters by `buildingId`). */
  readonly levels: readonly FloorLevelLike[];
  readonly activeLevelId: string | null;
  readonly getLevelScene: (levelId: string) => SceneModel | null;
  readonly loadFileV2: (fileId: string) => Promise<{ scene?: SceneModel | null } | null>;
  readonly boqContextBase: Pick<BimBoqContext, 'companyId' | 'projectId' | 'buildingId'>;
  /** Injectable for tests; defaults to the production fire-and-forget BOQ bridge. */
  readonly upsertBoq?: (
    entityType: 'roof',
    entity: { id: string; kind: string; geometry: RoofBoqGeometry },
    context: BimBoqContext,
    action: 'updated',
  ) => void;
}

/**
 * Re-feed the BOQ row of every roof of `typeId` across all of the building's
 * floors. Geometry is re-resolved against the live catalog store, so callers
 * MUST invoke this AFTER the optimistic `setTypes`. Mirror of
 * {@link refeedSlabBoqForTypeAcrossFloors}.
 */
export async function refeedRoofBoqForTypeAcrossFloors(args: RefeedRoofBoqForTypeArgs): Promise<void> {
  const { companyId, projectId, buildingId } = args.boqContextBase;
  if (!companyId || !projectId || !buildingId) return;
  const upsert =
    args.upsertBoq ??
    ((entityType, entity, context, action) => {
      void bimToBoqBridge.upsertBoqItemForBim(entityType, entity, context, action);
    });

  for (const level of args.levels) {
    const scene = await sceneForRoofLevel(level, args);
    if (!scene) continue;
    for (const roof of findRoofsByTypeId(scene, args.typeId)) {
      // «type always wins»: re-resolve against the already-updated store so the
      // BOQ payload carries the NEW type-level params.
      const resolved = reresolveRoofEntity(roof);
      upsert(
        'roof',
        { id: resolved.id, kind: resolved.kind, geometry: { area: resolved.geometry.grossAreaM2 } },
        { companyId, projectId, buildingId, floorId: level.floorId },
        'updated',
      );
    }
  }
}

/** Active floor → in-memory (already re-resolved); other floors → one-shot load. */
async function sceneForRoofLevel(
  level: FloorLevelLike,
  args: RefeedRoofBoqForTypeArgs,
): Promise<SceneModel | null> {
  if (level.id === args.activeLevelId) return args.getLevelScene(level.id);
  if (!level.sceneFileId) {
    logger.warn('Skipping roof BOQ re-feed for floor without sceneFileId (stale until loaded)', {
      levelId: level.id,
      floorId: level.floorId,
      typeId: args.typeId,
    });
    return null;
  }
  const record = await args.loadFileV2(level.sceneFileId).catch(() => null);
  return record?.scene ?? null;
}
