'use client';

/**
 * ADR-396 v2 Phase 5C — cross-floor slab producer for the ETICS thermal envelope.
 *
 * Producer for the {@link ../../bim/stores/envelope-floor-slabs-store} SSoT that
 * lets every envelope consumer (2D `EnvelopeOverlay`, 3D `BimSceneLayer`, BOQ,
 * applicator) tell an **atrium** (hole open to sky) apart from an **interior
 * room** (hole covered by a slab of a higher floor). Mirror of
 * {@link useFloors3DAggregator}, but **always-on** (atria exist even single-floor)
 * and it only needs slabs + floor elevations, not the full entity bundle.
 *
 *   - Floor elevations come from the SAME canonical Firestore source as the floor
 *     tabs (`useFloorsByBuilding` → FLOORS doc, metres, ADR-369). NOT
 *     `Bim3DEntitiesStore.floors`, whose `elevation` arrives lossy.
 *   - The active floor's slabs come LIVE from `Bim3DEntitiesStore`. Other floors
 *     come from the in-memory level scene (`getLevelScene`) when visited, else a
 *     one-shot `DxfFirestoreService.loadFileV2(sceneFileId)` snapshot (cached).
 *
 * No-op outside `LevelsSystem` (ADR-371 read-only Properties pipeline): publishes
 * the empty snapshot so consumers fall back to "no slab data → every hole a room".
 *
 * @see docs/centralized-systems/reference/adrs/ADR-396-bim-external-thermal-envelope-etics.md §3.1.5
 */

import { useCallback, useEffect, useMemo } from 'react';
import { useLevelsOptional } from '../../systems/levels/useLevels';
import { useBuildingFloorLevels } from './useBuildingFloorLevels';
import {
  liveSceneOf,
  loadSnapshotScene,
  useFloorSceneSnapshots,
  useUnvisitedFloorPredicate,
} from './useFloorSceneSnapshots';
import { useBim3DEntitiesStore } from '../../bim-3d/stores/Bim3DEntitiesStore';
import { isSlabEntity } from '../../types/entities';
import type { SlabEntity } from '../../types/entities';
import type { SceneModel } from '../../types/scene';
import type { StoreyRef } from '../../bim/utils/bim-floor-utils';
import type { SlabForRegionCoverage } from '../../bim/geometry/footprint-region-classifier';
import {
  setEnvelopeFloorSlabs,
  type EnvelopeFloorSlabs,
} from '../../bim/stores/envelope-floor-slabs-store';

interface TargetFloor {
  readonly levelId: string;
  readonly floorId: string;
  readonly sceneFileId: string | null;
}

const EMPTY_SLABS: readonly SlabForRegionCoverage[] = [];

/**
 * SlabEntity → minimal coverage shape (carries exactly the fields
 * `resolveSlabTopMm` + `classifyFootprintRegions` read). Slabs without a valid
 * plan-view outline are dropped (cannot contribute coverage).
 */
function toCoverageSlab(slab: SlabEntity): SlabForRegionCoverage | null {
  const vertices = slab.params?.outline?.vertices;
  if (!Array.isArray(vertices) || vertices.length < 3) return null;
  const pr = slab.params;
  return {
    floorId: slab.floorId,
    params: {
      storeyId: pr.storeyId,
      offsetFromStorey: pr.offsetFromStorey,
      levelElevation: pr.levelElevation,
      heightOffsetFromLevel: pr.heightOffsetFromLevel,
      thickness: pr.thickness,
      outline: { vertices },
    },
  };
}

/** Extract the coverage slabs out of a persisted scene. */
function coverageSlabsFromScene(scene: SceneModel): SlabForRegionCoverage[] {
  const out: SlabForRegionCoverage[] = [];
  for (const e of scene.entities) {
    if (!isSlabEntity(e)) continue;
    const cov = toCoverageSlab(e);
    if (cov) out.push(cov);
  }
  return out;
}

/** Οι πλάκες κάλυψης του αποθηκευμένου στιγμιοτύπου ενός ορόφου (κενό αν δεν έχει σκηνή). */
async function loadCoverageSlabs(t: TargetFloor): Promise<readonly SlabForRegionCoverage[]> {
  const scene = await loadSnapshotScene(t);
  return scene ? coverageSlabsFromScene(scene) : EMPTY_SLABS;
}

export function useEnvelopeFloorSlabs(): void {
  const levelsCtx = useLevelsOptional();
  const levels = levelsCtx?.levels;
  const currentLevelId = levelsCtx?.currentLevelId ?? null;
  const getLevelScene = levelsCtx?.getLevelScene;

  const activeLevelId = useBim3DEntitiesStore((s) => s.activeLevelId);
  const liveSlabs = useBim3DEntitiesStore((s) => s.slabs);

  // 🏢 Κτήριο + canonical storey elevations (metres) + ένα επίπεδο ανά όροφο (ADR-914 §2.14).
  const { currentLevel, buildingFloors, floorLevels } = useBuildingFloorLevels(levels, currentLevelId);
  const activeFloorId = currentLevel?.floorId ?? null;

  const targets = useMemo<TargetFloor[]>(
    () => floorLevels.map((lvl) => ({ levelId: lvl.id, floorId: lvl.floorId, sceneFileId: lvl.sceneFileId ?? null })),
    [floorLevels],
  );

  // Firestore snapshots for unvisited, file-linked floors (ADR-914 §2.14).
  const needsSnapshot = useUnvisitedFloorPredicate(activeLevelId, getLevelScene);
  const loaded = useFloorSceneSnapshots<TargetFloor, readonly SlabForRegionCoverage[]>({
    enabled: true,
    targets,
    needsSnapshot,
    load: loadCoverageSlabs,
    fallback: EMPTY_SLABS,
  });

  const liveCoverage = useMemo<readonly SlabForRegionCoverage[]>(() => {
    const out: SlabForRegionCoverage[] = [];
    for (const s of liveSlabs) {
      const cov = toCoverageSlab(s);
      if (cov) out.push(cov);
    }
    return out;
  }, [liveSlabs]);

  // Resolve a floor's slabs: live (active) → in-memory scene → loaded snapshot.
  const resolveSlabs = useCallback(
    (t: TargetFloor): readonly SlabForRegionCoverage[] | null => {
      if (t.levelId === activeLevelId) return liveCoverage;
      const scene = liveSceneOf(getLevelScene, t.levelId);
      return scene ? coverageSlabsFromScene(scene) : loaded.get(t.levelId) ?? null;
    },
    [activeLevelId, liveCoverage, getLevelScene, loaded],
  );

  // Compose floors (StoreyRef) + flat slabs of ALL building floors.
  const snapshot = useMemo<EnvelopeFloorSlabs>(() => {
    const floors: StoreyRef[] = buildingFloors.map((f) => ({ id: f.id, elevation: f.elevation ?? 0 }));
    const slabs: SlabForRegionCoverage[] = [];
    for (const t of targets) {
      const s = resolveSlabs(t);
      if (s) slabs.push(...s);
    }
    return { floors, slabs, activeFloorId };
  }, [buildingFloors, targets, resolveSlabs, activeFloorId]);

  useEffect(() => {
    setEnvelopeFloorSlabs(snapshot);
  }, [snapshot]);
}
