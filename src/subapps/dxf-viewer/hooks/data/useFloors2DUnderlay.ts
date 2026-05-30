'use client';

/**
 * ADR-399 Phase D — 2D underlay aggregator («Όλοι οι όροφοι» σε 2Δ).
 *
 * Producer για το read-only 2Δ underlay (AutoCAD xref / Revit underlay): όσο
 * `active` (= `floor3DScope==='all'` ΚΑΙ `mode==='2d'`), επιστρέφει ένα converted
 * {@link DxfScene} ανά **μη-ενεργό** όροφο του τρέχοντος κτιρίου. Ο ενεργός όροφος
 * **εξαιρείται** — τον ζωγραφίζει ο κύριος interactive pipeline (`currentScene`).
 *
 * Data sourcing (mirror του {@link useFloors3DAggregator}):
 *   - visited floor → in-memory `getLevelScene(levelId)`.
 *   - unvisited file-linked floor → one-shot `DxfFirestoreService.loadFileV2(sceneFileId)`
 *     snapshot (cached σε state). Το περιεχόμενο (DXF + BIM entities) ζει μέσα στο
 *     persisted scene, keyed-by-floorplanId = `level.sceneFileId`.
 *
 * Ορατότητα: όροφοι με `floorVisibilityModes==='hide'` εξαιρούνται — **κοινό SSoT**
 * με το 3Δ (Phase C) και το `Floor3DPanel`.
 *
 * No-op εκτός `LevelsSystem` (read-only Properties pipeline, ADR-371).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-399-dxf-floor-navigation-tabs.md §Phase D
 */

import { useEffect, useMemo, useState } from 'react';
import { useLevelsOptional } from '../../systems/levels/useLevels';
import { DxfFirestoreService } from '../../services/dxf-firestore.service';
import { useViewMode3DStore } from '../../bim-3d/stores/ViewMode3DStore';
import { convertSceneToDxf } from '../canvas/useDxfSceneConversion';
import type { DxfScene } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { SceneModel } from '../../types/scene';

/** One non-active building floor, converted to a render-ready DxfScene. */
export interface UnderlayFloorScene {
  readonly levelId: string;
  readonly scene: DxfScene;
}

interface TargetFloor {
  readonly levelId: string;
  readonly floorId: string;
  readonly sceneFileId: string | null;
}

export function useFloors2DUnderlay(active: boolean): readonly UnderlayFloorScene[] {
  const levelsCtx = useLevelsOptional();
  const levels = levelsCtx?.levels;
  const currentLevelId = levelsCtx?.currentLevelId ?? null;
  const getLevelScene = levelsCtx?.getLevelScene;

  // SSoT visibility (shared with 3D / Floor3DPanel) — 'hide' excludes the floor.
  const floorVisibilityModes = useViewMode3DStore((s) => s.floorVisibilityModes);

  // Firestore snapshots for floors not visited this session.
  const [loaded, setLoaded] = useState<ReadonlyMap<string, SceneModel | null>>(new Map());

  // One target per NON-active building floor (first level wins per floor).
  const targets = useMemo<TargetFloor[]>(() => {
    if (!active || !levels) return [];
    const current = levels.find((l) => l.id === currentLevelId);
    const buildingId = current?.buildingId;
    if (!buildingId) return [];
    const seen = new Set<string>();
    const out: TargetFloor[] = [];
    for (const lvl of levels) {
      if (lvl.buildingId !== buildingId || !lvl.floorId || seen.has(lvl.floorId)) continue;
      seen.add(lvl.floorId);
      if (lvl.id === currentLevelId) continue; // active floor drawn by main pipeline
      if (floorVisibilityModes.get(lvl.id) === 'hide') continue; // Phase C SSoT
      out.push({ levelId: lvl.id, floorId: lvl.floorId, sceneFileId: lvl.sceneFileId ?? null });
    }
    return out;
  }, [active, levels, currentLevelId, floorVisibilityModes]);

  // Resolve a floor's SceneModel: in-memory scene → loaded snapshot.
  const resolveScene = (t: TargetFloor): SceneModel | null => {
    const scene = getLevelScene?.(t.levelId);
    if (scene && scene.entities.length > 0) return scene;
    return loaded.get(t.levelId) ?? null;
  };

  // Lazily fetch snapshots for unvisited, file-linked floors.
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

  // Compose + convert the visible non-active floors (skip floors still loading).
  return useMemo<readonly UnderlayFloorScene[]>(() => {
    if (!active) return [];
    const out: UnderlayFloorScene[] = [];
    for (const t of targets) {
      const model = resolveScene(t);
      if (!model || model.entities.length === 0) continue;
      out.push({ levelId: t.levelId, scene: convertSceneToDxf(model) });
    }
    return out;
    // resolveScene closes over getLevelScene + loaded; both are deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, targets, getLevelScene, loaded]);
}
