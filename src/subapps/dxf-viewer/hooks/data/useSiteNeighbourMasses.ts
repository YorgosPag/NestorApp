'use client';

/**
 * useSiteNeighbourMasses — cross-building horizon-mass sourcing (ADR-422 L7.3 Slice E /
 * ADR-369).
 *
 * **Πρώτος γεωμετρικός καταναλωτής** της multi-building τοποθέτησης (ADR-369
 * `siteOrigin`/`rotation`): για κάθε **άλλο** κτίριο του project αντλεί το εξωτ.
 * footprint (envelope shell ενός αντιπροσωπευτικού ορόφου) από τη σκηνή του, το
 * μεταφέρει στο **frame του ενεργού κτιρίου** (`site-placement-transform`) και υπολογίζει
 * το ύψος κορυφής → `HorizonObstacle[]` για τη geometry-derived σκίαση ορίζοντα
 * (`solar-horizon-geometry`). Ίδιο async pattern με `useBuildingFloorScenes` (in-memory
 * scene → one-shot `loadFileV2` snapshot), αλλά **cross-building** (όχι μόνο ο τρέχων).
 *
 * Single-building project / άστοχη τοποθέτηση ⇒ καμία γειτονική μάζα ⇒ `[]` ⇒ ο
 * resolver πέφτει στο manual `horizonShadingLevel` (Slice C) ⇒ zero-regression. No-op
 * έξω από `LevelsSystem`.
 *
 * @see ../../bim/thermal/heat-load/site-neighbour-masses (pure σύνθεση)
 * @see ./useBuildingFloorScenes (το πρότυπο async sourcing, single-building)
 * @see docs/centralized-systems/reference/adrs/ADR-369-bim-elevation-convention-revit-alignment.md §9
 */

import { useEffect, useMemo, useState } from 'react';
import { useLevelsOptional } from '../../systems/levels/useLevels';
import { useFirestoreBuildings } from '@/hooks/useFirestoreBuildings';
import { DxfFirestoreService } from '../../services/dxf-firestore.service';
import { isWallEntity } from '../../types/entities';
import { computeEnvelopePerimeter } from '../../bim/geometry/envelope-perimeter';
import { resolveSceneUnits, sceneUnitsToMeters } from '../../utils/scene-units';
import { projectVerticesTo2D } from '../../bim/geometry/shared/polygon-utils';
import {
  buildHorizonObstacles,
  DEFAULT_STOREY_HEIGHT_M,
  type NeighbourBuildingInput,
} from '../../bim/thermal/heat-load/site-neighbour-masses';
import type { BuildingPlacement } from '../../bim/thermal/heat-load/site-placement-transform';
import type { HorizonObstacle } from '../../bim/thermal/heat-load/solar-horizon-geometry';
import type { Level } from '../../systems/levels/config';
import type { SceneModel } from '../../types/scene';
import type { Building } from '@/types/building/contracts';

/** Ένα αντιπροσωπευτικό target ανά **μη-ενεργό** κτίριο (πρώτος όροφος με floorId κερδίζει). */
interface NeighbourTarget {
  readonly buildingId: string;
  readonly levelId: string;
  readonly sceneFileId: string | null;
}

/** Footprint (τοπικό XY) + κλίμακα της σκηνής ενός κτιρίου, ή `null` αν λείπει envelope. */
function sceneFootprint(scene: SceneModel): { footprint: { x: number; y: number }[]; sceneToM: number } | null {
  const walls = scene.entities.filter(isWallEntity);
  if (walls.length === 0) return null;
  const sceneUnits = resolveSceneUnits(scene);
  const { primaryChain } = computeEnvelopePerimeter(walls, 0, sceneUnits);
  const pts = primaryChain?.exteriorFaceLoop.points;
  if (!pts || pts.length < 3) return null;
  return { footprint: projectVerticesTo2D(pts), sceneToM: sceneUnitsToMeters(sceneUnits) };
}

/** Τοποθέτηση κτιρίου (ADR-369) + κλίμακα σκηνής → `BuildingPlacement`. */
function placementOf(building: Building | undefined, sceneToM: number): BuildingPlacement {
  return { sceneToM, siteOrigin: building?.siteOrigin, rotationDeg: building?.rotation };
}

/** Αριθμός distinct ορόφων ενός κτιρίου (για το ύψος εξώθησης). */
function countFloors(levels: readonly Level[], buildingId: string): number {
  const set = new Set<string>();
  for (const l of levels) if (l.buildingId === buildingId && l.floorId) set.add(l.floorId);
  return set.size;
}

export function useSiteNeighbourMasses(active: boolean): readonly HorizonObstacle[] {
  const levelsCtx = useLevelsOptional();
  const levels = levelsCtx?.levels;
  const currentLevelId = levelsCtx?.currentLevelId ?? null;
  const getLevelScene = levelsCtx?.getLevelScene;
  const { buildings } = useFirestoreBuildings();

  const activeBuildingId = useMemo(
    () => (levels?.find((l) => l.id === currentLevelId)?.buildingId ?? null),
    [levels, currentLevelId],
  );

  // Ένα target ανά μη-ενεργό κτίριο (πρώτος όροφος με floorId).
  const targets = useMemo<NeighbourTarget[]>(() => {
    if (!active || !levels || !activeBuildingId) return [];
    const seen = new Set<string>();
    const out: NeighbourTarget[] = [];
    for (const lvl of levels) {
      if (!lvl.buildingId || !lvl.floorId || lvl.buildingId === activeBuildingId) continue;
      if (seen.has(lvl.buildingId)) continue;
      seen.add(lvl.buildingId);
      out.push({ buildingId: lvl.buildingId, levelId: lvl.id, sceneFileId: lvl.sceneFileId ?? null });
    }
    return out;
  }, [active, levels, activeBuildingId]);

  const [loaded, setLoaded] = useState<ReadonlyMap<string, SceneModel | null>>(new Map());

  const resolveScene = (t: NeighbourTarget): SceneModel | null => {
    const scene = getLevelScene?.(t.levelId);
    if (scene && scene.entities.length > 0) return scene;
    return loaded.get(t.levelId) ?? null;
  };

  // Lazy fetch των μη-επισκεφθέντων, file-linked γειτονικών ορόφων (one-shot snapshot).
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const missing = targets.filter(
      (t) =>
        t.sceneFileId &&
        !loaded.has(t.levelId) &&
        !((getLevelScene?.(t.levelId)?.entities.length ?? 0) > 0),
    );
    if (missing.length === 0) return;

    void (async () => {
      const entries: [string, SceneModel | null][] = [];
      for (const t of missing) {
        try {
          const rec = await DxfFirestoreService.loadFileV2(t.sceneFileId as string);
          if (cancelled) return;
          entries.push([
            t.levelId,
            rec?.scene && Array.isArray(rec.scene.entities) ? (rec.scene as SceneModel) : null,
          ]);
        } catch {
          entries.push([t.levelId, null]);
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
  }, [active, targets, loaded, getLevelScene]);

  // Active placement + κλίμακα (από τη σκηνή του ενεργού ορόφου· fallback mm).
  const activePlacement = useMemo<BuildingPlacement>(() => {
    const activeScene = currentLevelId ? getLevelScene?.(currentLevelId) ?? null : null;
    const sceneToM = activeScene ? sceneUnitsToMeters(resolveSceneUnits(activeScene)) : sceneUnitsToMeters('mm');
    const building = buildings.find((b) => b.id === activeBuildingId);
    return placementOf(building, sceneToM);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildings, activeBuildingId, currentLevelId, getLevelScene, loaded]);

  return useMemo<readonly HorizonObstacle[]>(() => {
    if (!active || !levels) return [];
    const neighbours: NeighbourBuildingInput[] = [];
    for (const t of targets) {
      const model = resolveScene(t);
      if (!model) continue;
      const fp = sceneFootprint(model);
      if (!fp) continue;
      const building = buildings.find((b) => b.id === t.buildingId);
      neighbours.push({
        footprintLocalXY: fp.footprint,
        placement: placementOf(building, fp.sceneToM),
        baseElevationM: building?.baseElevation ?? 0,
        floorCount: countFloors(levels, t.buildingId),
        storeyHeightM: DEFAULT_STOREY_HEIGHT_M,
      });
    }
    return buildHorizonObstacles(neighbours, activePlacement);
    // resolveScene closes over getLevelScene + loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, levels, targets, buildings, activePlacement, getLevelScene, loaded]);
}
