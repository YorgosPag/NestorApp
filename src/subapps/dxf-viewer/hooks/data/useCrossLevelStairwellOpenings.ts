'use client';

/**
 * ADR-632 CL-3 — owner hook του cross-level stairwell-opening engine (mirror
 * `useEnvelopeFloorSlabs` gather + `useFoundationLevelSync` owner/apply, ADR-459).
 *
 * ΕΝΑ σημείο που — για το κτίριο του ενεργού ορόφου — μαζεύει σκάλες + πλάκες +
 * managed openings **όλων** των ορόφων, τρέχει τον building-wide planner σε κοινό
 * απόλυτο datum (CL-1 FFL offset ανά όροφο) και εφαρμόζει το αποτέλεσμα μέσω του
 * cross-level writer στη σκηνή + Firestore scope **της πλάκας** κάθε ζεύγους.
 *
 * Πηγή entities ανά όροφο (mirror `useEnvelopeFloorSlabs`):
 *   · ενεργός → live `Bim3DEntitiesStore` (freshest — reflect-άρει το τελευταίο command)
 *   · επισκεφθείς → in-memory `getLevelScene`
 *   · μη-επισκεφθείς file-linked → one-shot `DxfFirestoreService.loadFileV2` snapshot (cached)
 *
 * **Delete-safety:** το apply τρέχει ΜΟΝΟ όταν ΟΛΟΙ οι όροφοι έχουν resolved entities
 * (`allResolved`). Αλλιώς, όσο φορτώνει η σκηνή της σκάλας, ο planner θα έβλεπε «καμία
 * σκάλα» για ένα υπάρχον opening → θα το έσβηνε ως orphan (flicker/churn). Περιμένουμε
 * να φορτώσουν όλοι → μηδέν ψευδο-orphan.
 *
 * **Zero-loop (ADR-492 §4):** ο writer γράφει με origin `'system-reconcile'` (δεν
 * πυροδοτεί autosave) και το plan είναι idempotent (αμετάβλητη σκηνή → κενό αποτέλεσμα)
 * → όποια scene mutation στον ενεργό όροφο επανα-τρέξει τον κύκλο, ο planner επιστρέφει
 * κενό → σύγκλιση.
 *
 * Mounted ΜΙΑ φορά από το viewer shell (δίπλα στο `useFoundationLevelSync`).
 *
 * @see bim/stairs/stairwell-cross-level-plan.ts — ο pure building-wide planner
 * @see bim/stairs/stairwell-opening-cross-level-writer.ts — ο cross-level writer
 * @see docs/centralized-systems/reference/adrs/ADR-632-stairwell-auto-opening-ssot.md §8b
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import { useFloorsByBuilding } from '@/components/properties/shared/useFloorsByBuilding';
import { DxfFirestoreService } from '../../services/dxf-firestore.service';
import { useBim3DEntitiesStore } from '../../bim-3d/stores/Bim3DEntitiesStore';
import { isSlabEntity, isSlabOpeningEntity, isStairEntity } from '../../types/entities';
import { resolveFloorElevationMm } from '../../systems/levels/building-foundation-level';
import type { SlabEntity } from '../../bim/types/slab-types';
import type { SlabOpeningEntity } from '../../bim/types/slab-opening-types';
import type { StairEntity } from '../../bim/types/stair-types';
import type { SceneModel } from '../../types/scene';
import type { LevelSceneWriter } from '../../systems/levels/level-scene-accessor';
import {
  planCrossLevelStairwellOpenings,
  type CrossLevelFloorEntry,
} from '../../bim/stairs/stairwell-cross-level-plan';
import { createStairwellOpeningCrossLevelWriter } from '../../bim/stairs/stairwell-opening-cross-level-writer';

/** Ελάχιστο σχήμα ενός Level που χρειάζεται το gather (το `Level` το ικανοποιεί). */
interface CrossLevelFloorRef {
  readonly id: string;
  readonly floorId?: string;
  readonly buildingId?: string;
  readonly sceneFileId?: string;
  readonly projectId?: string;
}

/** Ο level manager που περνά το shell (mirror `useFoundationLevelSync`). */
interface CrossLevelStairwellManager extends LevelSceneWriter {
  readonly levels: readonly CrossLevelFloorRef[];
}

interface TargetFloor {
  readonly levelId: string;
  readonly floorId: string;
  readonly sceneFileId: string | null;
  readonly projectId: string | null;
  readonly floorElevationMm: number;
}

/** Τα stairwell-relevant entities μιας σκηνής (σκάλες + πλάκες + managed openings). */
interface FloorBundle {
  readonly stairs: readonly StairEntity[];
  readonly slabs: readonly SlabEntity[];
  readonly managedOpenings: readonly SlabOpeningEntity[];
}

const EMPTY_BUNDLE: FloorBundle = { stairs: [], slabs: [], managedOpenings: [] };

/** Extract σκάλες/πλάκες/openings από μια persisted σκηνή. */
function bundleFromScene(scene: SceneModel): FloorBundle {
  return {
    stairs: scene.entities.filter(isStairEntity),
    slabs: scene.entities.filter(isSlabEntity),
    managedOpenings: scene.entities.filter(isSlabOpeningEntity),
  };
}

export function useCrossLevelStairwellOpenings(props: {
  levelManager: CrossLevelStairwellManager;
}): void {
  const { levelManager } = props;
  const levels = levelManager.levels;
  const currentLevelId = levelManager.currentLevelId;
  const getLevelScene = levelManager.getLevelScene;
  const setLevelScene = levelManager.setLevelScene;

  const { user } = useAuth();
  const companyId = user?.companyId ?? null;
  const userId = user?.uid ?? null;

  const activeLevelId = useBim3DEntitiesStore((s) => s.activeLevelId);
  const liveStairs = useBim3DEntitiesStore((s) => s.stairs);
  const liveSlabs = useBim3DEntitiesStore((s) => s.slabs);
  const liveSlabOpenings = useBim3DEntitiesStore((s) => s.slabOpenings);

  const currentLevel = useMemo(
    () => (levels ? levels.find((l) => l.id === currentLevelId) ?? null : null),
    [levels, currentLevelId],
  );
  const buildingId = currentLevel?.buildingId ?? null;

  const { floors: buildingFloors } = useFloorsByBuilding(buildingId, Boolean(buildingId));

  // One target per building floor (first level wins for duplicates), με FFL (mm).
  const targets = useMemo<TargetFloor[]>(() => {
    if (!levels || !buildingId) return [];
    const seen = new Set<string>();
    const out: TargetFloor[] = [];
    for (const lvl of levels) {
      if (lvl.buildingId !== buildingId || !lvl.floorId || seen.has(lvl.floorId)) continue;
      seen.add(lvl.floorId);
      out.push({
        levelId: lvl.id,
        floorId: lvl.floorId,
        sceneFileId: lvl.sceneFileId ?? null,
        projectId: lvl.projectId ?? null,
        floorElevationMm: resolveFloorElevationMm(buildingFloors, lvl.floorId),
      });
    }
    return out;
  }, [levels, buildingId, buildingFloors]);

  const liveBundle = useMemo<FloorBundle>(
    () => ({ stairs: liveStairs, slabs: liveSlabs, managedOpenings: liveSlabOpenings }),
    [liveStairs, liveSlabs, liveSlabOpenings],
  );

  // Firestore snapshots για ορόφους που δεν επισκεφθήκαμε αυτή τη συνεδρία.
  const [loaded, setLoaded] = useState<ReadonlyMap<string, FloorBundle>>(new Map());

  // Resolve entities ενός ορόφου: live (active) → in-memory scene → loaded snapshot.
  // `null` = ακόμη pending (file-linked, μη φορτωμένος) → delete-safety gate.
  const resolveBundle = useCallback(
    (t: TargetFloor): FloorBundle | null => {
      if (t.levelId === activeLevelId) return liveBundle;
      const scene = getLevelScene?.(t.levelId);
      if (scene && scene.entities.length > 0) return bundleFromScene(scene);
      if (loaded.has(t.levelId)) return loaded.get(t.levelId) ?? EMPTY_BUNDLE;
      return t.sceneFileId ? null : EMPTY_BUNDLE;
    },
    [activeLevelId, liveBundle, getLevelScene, loaded],
  );

  // Lazily fetch snapshots για μη-επισκεφθέντες, file-linked ορόφους.
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
      const entries: [string, FloorBundle][] = [];
      for (const t of missing) {
        try {
          const rec = await DxfFirestoreService.loadFileV2(t.sceneFileId as string);
          if (cancelled) return;
          const scene = rec?.scene as SceneModel | undefined;
          entries.push([t.levelId, scene && Array.isArray(scene.entities) ? bundleFromScene(scene) : EMPTY_BUNDLE]);
        } catch {
          entries.push([t.levelId, EMPTY_BUNDLE]);
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

  // Compose entries — ΜΟΝΟ resolved όροφοι· `allResolved` gate για delete-safety.
  const { entries, allResolved } = useMemo(() => {
    const list: CrossLevelFloorEntry[] = [];
    for (const t of targets) {
      const bundle = resolveBundle(t);
      if (!bundle) continue;
      list.push({
        levelId: t.levelId,
        floorId: t.floorId,
        floorplanId: t.sceneFileId,
        projectId: t.projectId,
        floorElevationMm: t.floorElevationMm,
        stairs: bundle.stairs,
        slabs: bundle.slabs,
        managedOpenings: bundle.managedOpenings,
      });
    }
    return { entries: list, allResolved: targets.length >= 2 && list.length === targets.length };
  }, [targets, resolveBundle]);

  // Apply — plan → cross-level writer ανά όροφο-στόχο.
  useEffect(() => {
    if (!allResolved || !getLevelScene || !setLevelScene) return;
    const applies = planCrossLevelStairwellOpenings(entries);
    if (applies.length === 0) return;
    const io = { getLevelScene, setLevelScene };
    for (const apply of applies) {
      const writer = createStairwellOpeningCrossLevelWriter(
        { companyId, projectId: apply.projectId, userId },
        { levelId: apply.levelId, floorId: apply.floorId, floorplanId: apply.floorplanId },
        io,
      );
      if (!writer) continue;
      for (const entity of apply.creates) writer.put(entity);
      for (const entity of apply.updates) writer.put(entity);
      for (const openingId of apply.deletes) writer.remove(openingId);
    }
  }, [allResolved, entries, companyId, userId, getLevelScene, setLevelScene]);
}
