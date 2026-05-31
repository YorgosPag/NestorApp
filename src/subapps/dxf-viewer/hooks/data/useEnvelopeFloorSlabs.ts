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

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLevelsOptional } from '../../systems/levels/useLevels';
import { useFloorsByBuilding } from '@/components/properties/shared/useFloorsByBuilding';
import { DxfFirestoreService } from '../../services/dxf-firestore.service';
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

export function useEnvelopeFloorSlabs(): void {
  const levelsCtx = useLevelsOptional();
  const levels = levelsCtx?.levels;
  const currentLevelId = levelsCtx?.currentLevelId ?? null;
  const getLevelScene = levelsCtx?.getLevelScene;

  const activeLevelId = useBim3DEntitiesStore((s) => s.activeLevelId);
  const liveSlabs = useBim3DEntitiesStore((s) => s.slabs);

  const currentLevel = useMemo(
    () => (levels ? levels.find((l) => l.id === currentLevelId) ?? null : null),
    [levels, currentLevelId],
  );
  const buildingId = currentLevel?.buildingId ?? null;
  const activeFloorId = currentLevel?.floorId ?? null;

  // 🏢 Canonical storey elevations (metres) from the floor-tabs source.
  const { floors: buildingFloors } = useFloorsByBuilding(buildingId, Boolean(buildingId));

  // One target per building floor (first level wins for duplicates).
  const targets = useMemo<TargetFloor[]>(() => {
    if (!levels || !buildingId) return [];
    const seen = new Set<string>();
    const out: TargetFloor[] = [];
    for (const lvl of levels) {
      if (lvl.buildingId !== buildingId || !lvl.floorId || seen.has(lvl.floorId)) continue;
      seen.add(lvl.floorId);
      out.push({ levelId: lvl.id, floorId: lvl.floorId, sceneFileId: lvl.sceneFileId ?? null });
    }
    return out;
  }, [levels, buildingId]);

  // Firestore snapshots for floors not visited this session.
  const [loaded, setLoaded] = useState<ReadonlyMap<string, readonly SlabForRegionCoverage[]>>(
    new Map(),
  );

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
      const scene = getLevelScene?.(t.levelId);
      if (scene && scene.entities.length > 0) return coverageSlabsFromScene(scene);
      return loaded.get(t.levelId) ?? null;
    },
    [activeLevelId, liveCoverage, getLevelScene, loaded],
  );

  // Lazily fetch snapshots for unvisited, file-linked floors.
  useEffect(() => {
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
      const entries: [string, readonly SlabForRegionCoverage[]][] = [];
      for (const t of missing) {
        try {
          const rec = await DxfFirestoreService.loadFileV2(t.sceneFileId as string);
          if (cancelled) return;
          const scene = rec?.scene as SceneModel | undefined;
          entries.push([
            t.levelId,
            scene && Array.isArray(scene.entities) ? coverageSlabsFromScene(scene) : EMPTY_SLABS,
          ]);
        } catch {
          entries.push([t.levelId, EMPTY_SLABS]);
        }
      }
      if (cancelled || entries.length === 0) return;
      setLoaded((prev) => {
        const next = new Map(prev);
        for (const [k, v] of entries) next.set(k, v);
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [targets, activeLevelId, loaded, getLevelScene]);

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
