'use client';

/**
 * useFoundationLevelSync — owner hook του `foundation-level-store` (ADR-459 Phase 0).
 *
 * ΕΝΑ σημείο που επιλύει — για το κτίριο του ενεργού ορόφου — τον όροφο Θεμελίωσης
 * (`resolveBuildingFoundationLevel`) + τα entities του (πέδιλα), και τα δημοσιεύει
 * στο low-freq `foundation-level-store`. Τα καταναλώνουν cross-level ο
 * `useStructuralOrganism` (merge στον graph) και ο `useAutoFoundationDesign`
 * (level-wide auto-design + write target).
 *
 * Resolution των foundation entities — mirror του `useFloors3DAggregator`:
 *   1. in-memory `getLevelScene(foundationLevelId)` (αν ο χρήστης το επισκέφθηκε).
 *   2. αλλιώς one-shot `DxfFirestoreService.loadFileV2(sceneFileId)` snapshot.
 *
 * Single-level fast-path: αν δεν υπάρχει foundation level ή ΕΙΝΑΙ ο ενεργός όροφος
 * (ο μηχανικός σχεδιάζει πάνω στη Θεμελίωση), ο store καθαρίζεται → ο organism
 * μένει single-level (μηδέν regression).
 *
 * Mounted ΜΙΑ φορά από το viewer shell (δίπλα στα structural hooks).
 *
 * @see ../state/foundation-level-store.ts
 * @see ../systems/levels/building-foundation-level.ts
 * @see docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md §Phase 0
 */

import { useEffect, useMemo, useState } from 'react';
import { useFloorsByBuilding } from '@/components/properties/shared/useFloorsByBuilding';
import { EventBus, type DrawingEventType } from '../systems/events/EventBus';
import { DxfFirestoreService } from '../services/dxf-firestore.service';
import { useFoundationLevelStore } from '../state/foundation-level-store';
import {
  resolveBuildingFoundationLevel,
  resolveBuildingIdForLevel,
  resolveFloorElevationMm,
  type FoundationLevelRef,
} from '../systems/levels/building-foundation-level';
import type { Entity } from '../types/entities';
import type { SceneModel } from '../types/scene';

interface LevelManagerLike {
  readonly levels: readonly FoundationLevelRef[];
  readonly currentLevelId: string | null;
  getLevelScene(levelId: string): SceneModel | null;
}

/** Structural μεταβολές που μπορεί να αλλάξουν τα foundation entities → refresh. */
const FOUNDATION_REFRESH_EVENTS: readonly DrawingEventType[] = [
  'bim:column-footing-attached',
  'bim:column-footing-attached-manual',
  'bim:column-footing-detached',
  'bim:foundation-params-updated',
  'bim:foundation-delete-requested',
];

export function useFoundationLevelSync(props: { levelManager: LevelManagerLike }): void {
  const { levelManager } = props;
  const { levels, currentLevelId } = levelManager;

  const buildingId = useMemo(
    () => resolveBuildingIdForLevel(levels, currentLevelId),
    [levels, currentLevelId],
  );
  const { floors } = useFloorsByBuilding(buildingId, !!buildingId);

  // Foundation level του κτιρίου, μόνο όταν διαφέρει από τον ενεργό (cross-level).
  const target = useMemo(() => {
    const t = resolveBuildingFoundationLevel(levels, currentLevelId, floors);
    return t && t.levelId !== currentLevelId ? t : null;
  }, [levels, currentLevelId, floors]);

  // Datum-relative FFL του ενεργού ορόφου (mm) — για το cross-level Z offset.
  const activeFloorElevationMm = useMemo(() => {
    const activeFloorId = levels.find((l) => l.id === currentLevelId)?.floorId ?? null;
    return resolveFloorElevationMm(floors, activeFloorId);
  }, [levels, currentLevelId, floors]);

  // Refresh tick: ξανα-resolve τα foundation entities μετά από cross-level write.
  const [refreshTick, setRefreshTick] = useState(0);
  useEffect(() => {
    const unsubs = FOUNDATION_REFRESH_EVENTS.map((ev) =>
      EventBus.on(ev, () => setRefreshTick((t) => t + 1)),
    );
    return () => unsubs.forEach((u) => u());
  }, []);

  useEffect(() => {
    const store = useFoundationLevelStore.getState();
    if (!target) {
      store.setFoundationLevel(null, [], activeFloorElevationMm);
      return;
    }
    // 1. in-memory scene (visited this session).
    const liveScene = levelManager.getLevelScene(target.levelId);
    if (liveScene && liveScene.entities.length > 0) {
      store.setFoundationLevel(
        target,
        liveScene.entities as unknown as readonly Entity[],
        activeFloorElevationMm,
      );
      return;
    }
    // 2. one-shot Firestore snapshot (unvisited, file-linked).
    if (!target.sceneFileId) {
      store.setFoundationLevel(target, [], activeFloorElevationMm);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const rec = await DxfFirestoreService.loadFileV2(target.sceneFileId as string);
        if (cancelled) return;
        const entities =
          rec?.scene && Array.isArray(rec.scene.entities)
            ? ((rec.scene as SceneModel).entities as unknown as readonly Entity[])
            : [];
        useFoundationLevelStore
          .getState()
          .setFoundationLevel(target, entities, activeFloorElevationMm);
      } catch {
        if (!cancelled) {
          useFoundationLevelStore.getState().setFoundationLevel(target, [], activeFloorElevationMm);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [target, levelManager, refreshTick, activeFloorElevationMm]);

  // Καθαρισμός store στο unmount (single-level / αλλαγή viewer).
  useEffect(() => () => useFoundationLevelStore.getState().clear(), []);
}
