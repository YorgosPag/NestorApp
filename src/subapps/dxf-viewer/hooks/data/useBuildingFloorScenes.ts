'use client';

/**
 * useBuildingFloorScenes — cross-floor SceneModel sourcing SSoT (ADR-399 / ADR-408 Φ15).
 *
 * Returns the **raw** {@link SceneModel} of every **non-active** floor of the
 * current building (before any DXF conversion), so multiple consumers can read
 * the unmodified BIM entities (incl. `mep-segment` z / params that
 * `convertSceneToDxf` discards):
 *   - {@link useFloors2DUnderlay} converts each to a render-ready DxfScene (Revit
 *     «xref / underlay» of the other floors).
 *   - the cross-floor «riser through» overlay (ADR-408 Φ15 Task B) filters the
 *     vertical `mep-segment`s to draw their plan glyph on floors they pass through.
 *
 * Data sourcing (mirror of {@link useFloors3DAggregator}):
 *   - visited floor → in-memory `getLevelScene(levelId)`.
 *   - unvisited file-linked floor → one-shot
 *     `DxfFirestoreService.loadFileV2(sceneFileId)` snapshot (cached in state).
 *     The persisted scene (DXF + BIM entities) is keyed-by-floorplanId =
 *     `level.sceneFileId`.
 *
 * Visibility: floors with `floorVisibilityModes==='hide'` are excluded — the
 * **shared SSoT** with 3D (Phase C) and `Floor3DPanel`.
 *
 * The active floor is excluded — it is drawn LIVE by the main interactive
 * pipeline (`currentScene`). No-op outside `LevelsSystem` (ADR-371). The `active`
 * gate is supplied by each consumer (the 2D underlay only in «all» scope; the
 * riser overlay in any 2D scope), keeping this hook gate-agnostic.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-399-dxf-floor-navigation-tabs.md §Phase D
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ15
 */

import { useCallback, useMemo } from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import { useLevelsOptional } from '../../systems/levels/useLevels';
import { floorRepresentativeLevels } from '../../systems/levels/level-floor-representative';
import { useViewMode3DStore } from '../../bim-3d/stores/ViewMode3DStore';
// ADR-469 / ADR-484 Slice 3 — snapshot με φράχτη ορόφου, και per-entity εφεδρεία
// (floorplan_*, keyed-by-floorId) για όροφο χωρίς `.scene.json`· ένας φορτωτής, ADR-914 §2.14.
import { loadFloorScopedScene } from './floor-scoped-scene-loader';
import { liveSceneOf, useFloorSceneSnapshots } from './useFloorSceneSnapshots';
// ADR-459 Φ7 — read-side foreign-floor BIM guard + model-SSoT footing injection:
// ένα floor model δείχνει ΜΟΝΟ τα δικά του entities, και ο όροφος Θεμελίωσης παίρνει
// τα cross-level πέδιλα από το `floorplan_foundations` (όχι από το snapshot).
import {
  stripForeignFloorBim,
  replaceFootingsFromModel,
  stripAllFoundations,
} from '../../systems/levels/scene-bim-load-policy';
import { useFoundationLevelStore } from '../../state/foundation-level-store';
import { isFoundationEntity, type Entity } from '../../types/entities';
import { EMPTY_BOUNDS } from '../../config/geometry-constants';
import type { SceneModel } from '../../types/scene';

/** One non-active building floor, as its raw (unconverted) SceneModel. */
export interface BuildingFloorScene {
  readonly levelId: string;
  readonly floorId: string;
  readonly model: SceneModel;
}

interface TargetFloor {
  readonly levelId: string;
  readonly floorId: string;
  readonly sceneFileId: string | null;
  readonly projectId: string | null;
}

export function useBuildingFloorScenes(active: boolean): readonly BuildingFloorScene[] {
  const levelsCtx = useLevelsOptional();
  const levels = levelsCtx?.levels;
  const currentLevelId = levelsCtx?.currentLevelId ?? null;
  const getLevelScene = levelsCtx?.getLevelScene;

  // ADR-469 — identity for the per-entity fallback scope (companyId/userId).
  const { user } = useAuth();
  const companyId = user?.companyId ?? null;
  const userId = user?.uid ?? null;

  // SSoT visibility (shared with 3D / Floor3DPanel) — 'hide' excludes the floor.
  const floorVisibilityModes = useViewMode3DStore((s) => s.floorVisibilityModes);

  // ADR-459 Φ7 — ο όροφος Θεμελίωσης + τα πέδιλά του από το model SSoT.
  const foundationLevelId = useFoundationLevelStore((s) => s.target?.levelId ?? null);
  const foundationStoreEntities = useFoundationLevelStore((s) => s.entities);
  const modelFootings = useMemo<readonly Entity[]>(
    () => foundationStoreEntities.filter(isFoundationEntity),
    [foundationStoreEntities],
  );

  // One target per NON-active building floor (first level wins per floor).
  const targets = useMemo<TargetFloor[]>(() => {
    if (!active || !levels) return [];
    const current = levels.find((l) => l.id === currentLevelId);
    const buildingId = current?.buildingId;
    if (!buildingId) return [];
    const out: TargetFloor[] = [];
    for (const lvl of floorRepresentativeLevels(levels, buildingId, currentLevelId)) {
      if (lvl.id === currentLevelId) continue; // active floor drawn by main pipeline
      if (floorVisibilityModes.get(lvl.id) === 'hide') continue; // Phase C SSoT
      out.push({
        levelId: lvl.id,
        floorId: lvl.floorId,
        sceneFileId: lvl.sceneFileId ?? null,
        projectId: lvl.projectId ?? null,
      });
    }
    return out;
  }, [active, levels, currentLevelId, floorVisibilityModes]);

  // Lazily source unvisited floors: snapshot first, then per-entity fallback for
  // file-less / orphaned floors (ADR-469). Includes floors WITHOUT a sceneFileId
  // (file-less) — previously skipped, hence invisible in the cross-floor underlay.
  const needsSnapshot = useCallback(
    (t: TargetFloor): boolean => !liveSceneOf(getLevelScene, t.levelId),
    [getLevelScene],
  );
  const load = useCallback(
    (t: TargetFloor, isCancelled: () => boolean) =>
      loadFloorScopedScene(t, { companyId, userId }, isCancelled),
    [companyId, userId],
  );
  // Firestore snapshots for floors not visited this session (ADR-914 §2.14).
  const loaded = useFloorSceneSnapshots<TargetFloor, SceneModel | null>({
    enabled: active,
    targets,
    needsSnapshot,
    load,
    fallback: null,
  });

  // Resolve a floor's SceneModel: in-memory scene → loaded snapshot.
  const resolveScene = (t: TargetFloor): SceneModel | null =>
    liveSceneOf(getLevelScene, t.levelId) ?? loaded.get(t.levelId) ?? null;

  // Compose the visible non-active floors' raw models (skip floors still loading).
  return useMemo<readonly BuildingFloorScene[]>(() => {
    if (!active) return [];
    const out: BuildingFloorScene[] = [];
    for (const t of targets) {
      const isFoundationFloor = t.levelId === foundationLevelId;
      const raw = resolveScene(t);
      if (!raw || raw.entities.length === 0) {
        // ADR-459 Φ7 — ο όροφος Θεμελίωσης χωρίς (έγκυρο) snapshot: synthetic scene με
        // μόνο τα model footings, ώστε το 2Δ underlay να τα δείχνει.
        if (isFoundationFloor && modelFootings.length > 0) {
          const model = {
            entities: modelFootings,
            layersById: {},
            bounds: { ...EMPTY_BOUNDS },
            units: 'mm',
          } as unknown as SceneModel;
          out.push({ levelId: t.levelId, floorId: t.floorId, model });
        }
        continue;
      }
      // Strip foreign-floor BIM (cross-level leak) so a floor's underlay shows only
      // its own entities (ADR-459 Φ7 — defense-in-depth vs legacy baked snapshots).
      const stripped = stripForeignFloorBim(raw, t.floorId);
      // ο όροφος Θεμελίωσης παίρνει τα cross-level auto πέδιλα από το model SSoT· ADR-484
      // Slice 5 — κάθε ΑΛΛΟΣ όροφος ΔΕΝ δείχνει πέδιλα (Revit-canonical· legacy blob garbage).
      const model = isFoundationFloor
        ? replaceFootingsFromModel(stripped, modelFootings)
        : stripAllFoundations(stripped);
      out.push({ levelId: t.levelId, floorId: t.floorId, model });
    }
    return out;
    // resolveScene closes over getLevelScene + loaded; both are deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, targets, getLevelScene, loaded, foundationLevelId, modelFootings]);
}
