'use client';

/**
 * ADR-399 Phase B — 3D DXF overlay aggregator («Όλοι οι όροφοι» σε 3Δ).
 *
 * Producer for {@link multi-floor-dxf-source}: while `active`, emits one
 * render-ready {@link DxfScene} per floor of the active building, each tagged
 * with its **datum-relative** elevation (same SSoT as the BIM stack,
 * {@link floor-stack-elevation}) so the 3D «all floors» view stacks every
 * floor's DXF plan aligned with the stacked BIM geometry.
 *
 * Without this, `DxfToThreeConverter` only rendered the ACTIVE floor's plan at
 * Y=0 → in the combined view only one floor's κάτοψη appeared (the bug this
 * closes). Mirror of {@link useFloors3DAggregator} (BIM) + {@link useFloors2DUnderlay}
 * (2D underlay): the active floor's plan comes LIVE from the overlay store; other
 * floors from the in-memory level scene or a one-shot `loadFileV2` snapshot.
 *
 * Visibility: floors with `floorVisibilityModes==='hide'` are excluded (shared
 * SSoT with 3D BIM / Floor3DPanel). No-op in the read-only Properties pipeline.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-399-dxf-floor-navigation-tabs.md (Phase B)
 */

import { useEffect, useMemo } from 'react';
import { useLevelsOptional } from '../../systems/levels/useLevels';
import { useBuildingFloorLevels } from './useBuildingFloorLevels';
import {
  liveSceneOf,
  loadSnapshotScene,
  useFloorSceneSnapshots,
  useUnvisitedFloorPredicate,
} from './useFloorSceneSnapshots';
import { useDxfOverlay3DStore } from '../../bim-3d/stores/DxfOverlay3DStore';
import { useViewMode3DStore } from '../../bim-3d/stores/ViewMode3DStore';
import {
  setMultiFloorDxfStack,
  type DxfFloorStackEntry,
} from '../../bim-3d/scene/multi-floor-dxf-source';
import { createFloorStackElevationResolver } from '../../bim-3d/scene/floor-stack-elevation';
import { convertSceneToDxf } from '../canvas/useDxfSceneConversion';
import type { DxfScene } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { SceneModel } from '../../types/scene';

interface TargetFloor {
  readonly levelId: string;
  readonly floorId: string;
  readonly sceneFileId: string | null;
  readonly floorElevationMm: number;
}

export function useFloors3DDxfOverlay(active: boolean): void {
  const levelsCtx = useLevelsOptional();
  const levels = levelsCtx?.levels;
  const currentLevelId = levelsCtx?.currentLevelId ?? null;
  const getLevelScene = levelsCtx?.getLevelScene;

  // Active floor's live DXF plan (pushed by CanvasLayerStack, reflects edits).
  const activeDxfScene = useDxfOverlay3DStore((s) => s.dxfScene);
  // SSoT visibility (shared with BIM / Floor3DPanel) — 'hide' excludes the floor.
  const floorVisibilityModes = useViewMode3DStore((s) => s.floorVisibilityModes);

  // Canonical storey elevations (same source as the floor tabs + the BIM stack) + ένα
  // επίπεδο ανά όροφο (ADR-914 §2.14).
  const { buildingFloors, floorLevels } = useBuildingFloorLevels(levels, currentLevelId, active);

  // One target per building floor (datum-relative elevation), hidden floors excluded.
  const targets = useMemo<TargetFloor[]>(() => {
    const elevationMmOf = createFloorStackElevationResolver(buildingFloors);
    return floorLevels
      .filter((lvl) => floorVisibilityModes.get(lvl.id) !== 'hide') // Phase C SSoT
      .map((lvl) => ({
        levelId: lvl.id,
        floorId: lvl.floorId,
        sceneFileId: lvl.sceneFileId ?? null,
        floorElevationMm: elevationMmOf(lvl.floorId),
      }));
  }, [floorLevels, buildingFloors, floorVisibilityModes]);

  // Lazily fetch snapshots for unvisited, file-linked, non-active floors (ADR-914 §2.14).
  const needsSnapshot = useUnvisitedFloorPredicate(currentLevelId, getLevelScene);
  const loaded = useFloorSceneSnapshots<TargetFloor, SceneModel | null>({
    enabled: active,
    targets,
    needsSnapshot,
    load: loadSnapshotScene,
    fallback: null,
  });

  // Resolve a floor's DXF plan: active = live overlay scene; else in-memory → snapshot.
  const resolveScene = (t: TargetFloor): DxfScene | null => {
    if (t.levelId === currentLevelId) return activeDxfScene;
    const scene = liveSceneOf(getLevelScene, t.levelId);
    if (scene) return convertSceneToDxf(scene);
    const snap = loaded.get(t.levelId);
    return snap && snap.entities.length > 0 ? convertSceneToDxf(snap) : null;
  };

  // Compose + publish the DXF stack (skip floors still loading / empty).
  const stack = useMemo<DxfFloorStackEntry[]>(() => {
    if (!active) return [];
    const out: DxfFloorStackEntry[] = [];
    for (const t of targets) {
      const scene = resolveScene(t);
      if (!scene || scene.entities.length === 0) continue;
      out.push({ levelId: t.levelId, scene, floorElevationMm: t.floorElevationMm });
    }
    return out;
    // resolveScene closes over activeDxfScene + getLevelScene + loaded (deps below).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, targets, activeDxfScene, getLevelScene, loaded]);

  useEffect(() => {
    setMultiFloorDxfStack(active ? stack : []);
  }, [active, stack]);
}
