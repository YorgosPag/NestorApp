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

import { useEffect, useMemo, useState } from 'react';
import { useLevelsOptional } from '../../systems/levels/useLevels';
import { DxfFirestoreService } from '../../services/dxf-firestore.service';
import { useViewMode3DStore } from '../../bim-3d/stores/ViewMode3DStore';
// ADR-459 Φ7 — read-side foreign-floor BIM guard: ένα floor model δείχνει ΜΟΝΟ τα
// δικά του entities· legacy cross-level πέδιλο (floorId άλλου ορόφου baked στο
// snapshot) δεν εμφανίζεται πια ως «φάντασμα» στο all-floors view.
import { stripForeignFloorBim } from '../../systems/levels/scene-bim-load-policy';
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
}

export function useBuildingFloorScenes(active: boolean): readonly BuildingFloorScene[] {
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

  // Compose the visible non-active floors' raw models (skip floors still loading).
  return useMemo<readonly BuildingFloorScene[]>(() => {
    if (!active) return [];
    const out: BuildingFloorScene[] = [];
    for (const t of targets) {
      const raw = resolveScene(t);
      if (!raw || raw.entities.length === 0) continue;
      // Strip foreign-floor BIM (cross-level leak) so a floor's underlay shows only
      // its own entities (ADR-459 Φ7 — defense-in-depth vs legacy baked snapshots).
      const model = stripForeignFloorBim(raw, t.floorId);
      out.push({ levelId: t.levelId, floorId: t.floorId, model });
    }
    return out;
    // resolveScene closes over getLevelScene + loaded; both are deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, targets, getLevelScene, loaded]);
}
