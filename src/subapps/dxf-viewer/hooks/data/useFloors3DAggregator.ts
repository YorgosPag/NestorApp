'use client';

/**
 * ADR-399 Phase B — multi-floor 3D aggregator.
 *
 * Producer for the {@link multi-floor-3d-source} SSoT consumed by the "Όλοι οι
 * όροφοι" (all floors) 3D scope. While `active`, it builds one
 * {@link FloorStackEntry} per floor of the **active building**:
 *
 *   - The active floor's entities come LIVE from `Bim3DEntitiesStore` (freshest).
 *   - Other floors come from the in-memory level scene (`getLevelScene`) when the
 *     user has already visited them, otherwise a one-shot
 *     `DxfFirestoreService.loadFileV2(sceneFileId)` snapshot (cached). BIM entities
 *     live inside the persisted scene (`scene.entities`), keyed-by-floorplanId =
 *     the level's `sceneFileId`, so each floor's geometry is self-contained.
 *
 * Each entry carries `floorElevationMm = floor.elevation (m, ADR-369) × 1000` so
 * `BimSceneLayer.syncMultiFloor` stacks them at the right height.
 *
 * When `active` is false (single-floor scope) the source is cleared. The hook is
 * a no-op outside `LevelsSystem` (ADR-371 read-only Properties pipeline).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-399-dxf-floor-navigation-tabs.md
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLevelsOptional } from '../../systems/levels/useLevels';
import { useFloorsByBuilding } from '@/components/properties/shared/useFloorsByBuilding';
import { DxfFirestoreService } from '../../services/dxf-firestore.service';
import { useBim3DEntitiesStore } from '../../bim-3d/stores/Bim3DEntitiesStore';
import { EMPTY_BIM_ENTITIES, type Bim3DEntities } from '../../bim-3d/stores/Bim3DEntitiesStore';
import {
  setMultiFloorStack,
  type FloorStackEntry,
} from '../../bim-3d/scene/multi-floor-3d-source';
import {
  resolveBuildingDatumElevationM,
  resolveFloorDatumRelativeElevationMm,
} from '../../bim-3d/scene/floor-stack-elevation';
import {
  isWallEntity, isColumnEntity, isBeamEntity, isSlabEntity,
  isSlabOpeningEntity, isOpeningEntity, isStairEntity, isMepFixtureEntity, isElectricalPanelEntity, isRailingEntity, isFurnitureEntity, isMepSegmentEntity, isMepFittingEntity, isMepManifoldEntity, isMepRadiatorEntity, isMepBoilerEntity, isMepWaterHeaterEntity, isRoofEntity, isFloorFinishEntity, isMepUnderfloorEntity,
} from '../../types/entities';
import type { SceneModel } from '../../types/scene';

interface TargetFloor {
  readonly levelId: string;
  readonly floorId: string;
  readonly sceneFileId: string | null;
  readonly floorElevationMm: number;
}

/** Split a persisted scene into the per-category BIM bundle the 3D layer wants. */
function extractBim3DEntities(scene: SceneModel): Bim3DEntities {
  const e = scene.entities;
  return {
    walls: e.filter(isWallEntity),
    columns: e.filter(isColumnEntity),
    beams: e.filter(isBeamEntity),
    slabs: e.filter(isSlabEntity),
    slabOpenings: e.filter(isSlabOpeningEntity),
    openings: e.filter(isOpeningEntity),
    stairs: e.filter(isStairEntity),
    fixtures: e.filter(isMepFixtureEntity),
    panels: e.filter(isElectricalPanelEntity),
    railings: e.filter(isRailingEntity),
    furnitures: e.filter(isFurnitureEntity),
    roofs: e.filter(isRoofEntity),
    floorFinishes: e.filter(isFloorFinishEntity),
    mepSegments: e.filter(isMepSegmentEntity),
    mepFittings: e.filter(isMepFittingEntity),
    manifolds: e.filter(isMepManifoldEntity),
    radiators: e.filter(isMepRadiatorEntity),
    boilers: e.filter(isMepBoilerEntity),
    waterHeaters: e.filter(isMepWaterHeaterEntity),
    underfloors: e.filter(isMepUnderfloorEntity),
  };
}

export function useFloors3DAggregator(active: boolean): void {
  const levelsCtx = useLevelsOptional();
  const levels = levelsCtx?.levels;
  const currentLevelId = levelsCtx?.currentLevelId ?? null;
  const getLevelScene = levelsCtx?.getLevelScene;

  const activeLevelId = useBim3DEntitiesStore((s) => s.activeLevelId);

  // ADR-399 Phase B — building of the active level. Drives the canonical floor
  // elevation lookup below.
  const buildingId = useMemo(
    () => (active && levels ? levels.find((l) => l.id === currentLevelId)?.buildingId ?? null : null),
    [active, levels, currentLevelId],
  );
  // 🏢 ADR-369 storey elevations from the SAME canonical Firestore source as the
  // floor tabs (`useFloorsByBuilding` → FLOORS doc). NOT `Bim3DEntitiesStore.floors`,
  // whose `elevation` arrives undefined (ProjectHierarchyContext drops it + the
  // by-company API never returns it) → previously every floor stacked at Y=0.
  const { floors: buildingFloors } = useFloorsByBuilding(buildingId, active);
  // Individual array selectors keep stable refs (no re-render unless changed).
  const walls = useBim3DEntitiesStore((s) => s.walls);
  const columns = useBim3DEntitiesStore((s) => s.columns);
  const beams = useBim3DEntitiesStore((s) => s.beams);
  const slabs = useBim3DEntitiesStore((s) => s.slabs);
  const slabOpenings = useBim3DEntitiesStore((s) => s.slabOpenings);
  const openings = useBim3DEntitiesStore((s) => s.openings);
  const stairs = useBim3DEntitiesStore((s) => s.stairs);
  const fixtures = useBim3DEntitiesStore((s) => s.fixtures);
  const panels = useBim3DEntitiesStore((s) => s.panels);
  const railings = useBim3DEntitiesStore((s) => s.railings);
  const furnitures = useBim3DEntitiesStore((s) => s.furnitures);
  const roofs = useBim3DEntitiesStore((s) => s.roofs);
  const floorFinishes = useBim3DEntitiesStore((s) => s.floorFinishes);
  const mepSegments = useBim3DEntitiesStore((s) => s.mepSegments);
  const mepFittings = useBim3DEntitiesStore((s) => s.mepFittings);
  const manifolds = useBim3DEntitiesStore((s) => s.manifolds);
  const radiators = useBim3DEntitiesStore((s) => s.radiators);
  const boilers = useBim3DEntitiesStore((s) => s.boilers);
  const waterHeaters = useBim3DEntitiesStore((s) => s.waterHeaters);
  const underfloors = useBim3DEntitiesStore((s) => s.underfloors);

  // Firestore snapshots for floors the user has not visited this session.
  const [loaded, setLoaded] = useState<ReadonlyMap<string, Bim3DEntities>>(new Map());

  const liveActive = useMemo<Bim3DEntities>(
    () => ({ walls, columns, beams, slabs, slabOpenings, openings, stairs, fixtures, panels, railings, furnitures, roofs, floorFinishes, mepSegments, mepFittings, manifolds, radiators, boilers, waterHeaters, underfloors }),
    [walls, columns, beams, slabs, slabOpenings, openings, stairs, fixtures, panels, railings, furnitures, roofs, floorFinishes, mepSegments, mepFittings, manifolds, radiators, boilers, waterHeaters, underfloors],
  );

  // One target per building floor (first level wins for a floor with duplicates).
  const targets = useMemo<TargetFloor[]>(() => {
    if (!active || !levels || !buildingId) return [];
    // 🏢 Revit-grade datum: stack relative to the building's ground floor (or the
    // lowest storey when no ground floor exists) so the model rests on the ground
    // (world 0) instead of floating at the lowest storey's raw elevation. The
    // building-base offset is applied downstream by the per-entity converters.
    const datumM = resolveBuildingDatumElevationM(buildingFloors);
    const elevByFloorId = new Map(buildingFloors.map((f) => [f.id, f.elevation ?? 0] as const));
    const seen = new Set<string>();
    const out: TargetFloor[] = [];
    for (const lvl of levels) {
      if (lvl.buildingId !== buildingId || !lvl.floorId || seen.has(lvl.floorId)) continue;
      seen.add(lvl.floorId);
      const elevationM = elevByFloorId.get(lvl.floorId) ?? 0;
      out.push({
        levelId: lvl.id,
        floorId: lvl.floorId,
        sceneFileId: lvl.sceneFileId ?? null,
        floorElevationMm: resolveFloorDatumRelativeElevationMm(elevationM, datumM),
      });
    }
    return out;
  }, [active, levels, currentLevelId, buildingId, buildingFloors]);

  // Resolve a floor's entities: live (active) → in-memory scene → loaded snapshot.
  const resolveEntities = useCallback(
    (t: TargetFloor): Bim3DEntities | null => {
      if (t.levelId === activeLevelId) return liveActive;
      const scene = getLevelScene?.(t.levelId);
      if (scene && scene.entities.length > 0) return extractBim3DEntities(scene);
      return loaded.get(t.levelId) ?? null;
    },
    [activeLevelId, liveActive, getLevelScene, loaded],
  );

  // Lazily fetch snapshots for unvisited, file-linked floors.
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const missing = targets.filter(
      (t) =>
        t.sceneFileId &&
        t.levelId !== activeLevelId &&
        !loaded.has(t.levelId) &&
        !((getLevelScene?.(t.levelId)?.entities.length ?? 0) > 0),
    );
    if (missing.length === 0) return;

    void (async () => {
      const entries: [string, Bim3DEntities][] = [];
      for (const t of missing) {
        try {
          const rec = await DxfFirestoreService.loadFileV2(t.sceneFileId as string);
          if (cancelled) return;
          entries.push([
            t.levelId,
            rec?.scene && Array.isArray(rec.scene.entities)
              ? extractBim3DEntities(rec.scene as SceneModel)
              : EMPTY_BIM_ENTITIES,
          ]);
        } catch {
          entries.push([t.levelId, EMPTY_BIM_ENTITIES]);
        }
      }
      if (cancelled || entries.length === 0) return;
      setLoaded((prev) => {
        const next = new Map(prev);
        for (const [k, v] of entries) next.set(k, v);
        return next;
      });
    })();

    return () => { cancelled = true; };
  }, [active, targets, activeLevelId, loaded, getLevelScene]);

  // Compose + publish the stack to the SSoT source (skip floors still loading).
  const stack = useMemo<FloorStackEntry[]>(() => {
    if (!active) return [];
    const out: FloorStackEntry[] = [];
    for (const t of targets) {
      const entities = resolveEntities(t);
      if (!entities) continue;
      out.push({ levelId: t.levelId, floorElevationMm: t.floorElevationMm, entities });
    }
    return out;
  }, [active, targets, resolveEntities]);

  useEffect(() => {
    setMultiFloorStack(active ? stack : []);
  }, [active, stack]);
}
