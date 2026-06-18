'use client';

/**
 * useFoundationLevelSync — owner hook του `foundation-level-store` (ADR-459 Phase 0
 * + Phase 7 model-SSoT sourcing).
 *
 * ΕΝΑ σημείο που επιλύει — για το κτίριο του ενεργού ορόφου — τον όροφο Θεμελίωσης
 * (`resolveBuildingFoundationLevel`) + τα entities του, και τα δημοσιεύει στο
 * low-freq `foundation-level-store`. Τα καταναλώνουν cross-level ο
 * `useStructuralOrganism` (merge στον graph), ο `useAutoFoundationDesign`
 * (level-wide auto-design) και οι all-floors aggregators (`useFloors3DAggregator`
 * 3Δ + `useBuildingFloorScenes` 2Δ) για το rendering των πεδίλων.
 *
 * Διπλή πηγή (ADR-459 Φ7):
 *   · **Πέδιλα** → realtime subscription στο **model SSoT** `floorplan_foundations`,
 *     scoped σε `target.floorId` (ADR-420 — durable storey key). Έτσι τα cross-level
 *     auto πέδιλα εμφανίζονται **ανεξάρτητα** από το scene snapshot ή το (πιθανώς
 *     drifted) `floorplanId` provenance.
 *   · **Λοιπά entities** (non-footings) → snapshot resolution (in-memory
 *     `getLevelScene` → one-shot `loadFileV2`) με τα footings αφαιρεμένα — ώστε ο
 *     organism να βλέπει τυχόν non-footing foundation-floor entities (μηδέν regression).
 *
 * Single-level fast-path: αν δεν υπάρχει foundation level ή ΕΙΝΑΙ ο ενεργός όροφος,
 * ο store καθαρίζεται → ο organism μένει single-level (μηδέν regression).
 *
 * Mounted ΜΙΑ φορά από το viewer shell (δίπλα στα structural hooks).
 *
 * @see ../state/foundation-level-store.ts
 * @see ../systems/levels/building-foundation-level.ts
 * @see ../bim/foundations/foundation-firestore-service.ts — subscribeFoundations / foundationDocToEntity
 * @see docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md §Phase 0/7
 */

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import { useFloorsByBuilding } from '@/components/properties/shared/useFloorsByBuilding';
import { EventBus, type DrawingEventType } from '../systems/events/EventBus';
import { DxfFirestoreService } from '../services/dxf-firestore.service';
import { useFoundationLevelStore } from '../state/foundation-level-store';
import {
  createFoundationFirestoreService,
  foundationDocToEntity,
} from '../bim/foundations/foundation-firestore-service';
import { resolveBimPersistenceScope } from '../bim/persistence/bim-floor-scope';
// ADR-484 Slice 3 — file-level cross-floor guard: ο όροφος Θεμελίωσης δεν παίρνει
// base entities από scene που ανήκει σε άλλον όροφο (legacy shared sceneFileId).
import { resolveFloorScopedScene } from '../systems/levels/cross-floor-link';
import {
  resolveBuildingFoundationLevel,
  resolveBuildingIdForLevel,
  resolveFloorElevationMm,
  type FoundationLevelRef,
} from '../systems/levels/building-foundation-level';
import { isFoundationEntity, type Entity } from '../types/entities';
import type { SceneModel } from '../types/scene';

interface LevelManagerLike {
  readonly levels: readonly FoundationLevelRef[];
  readonly currentLevelId: string | null;
  getLevelScene(levelId: string): SceneModel | null;
}

/** Structural μεταβολές που μπορεί να αλλάξουν τα non-footing entities → refresh base. */
const FOUNDATION_REFRESH_EVENTS: readonly DrawingEventType[] = [
  'bim:column-footing-attached',
  'bim:column-footing-attached-manual',
  'bim:column-footing-detached',
  'bim:foundation-params-updated',
  'bim:foundation-delete-requested',
];

/** Snapshot entities χωρίς τα footings (τα footings έρχονται από το model SSoT). */
function stripFootings(entities: readonly Entity[]): readonly Entity[] {
  return entities.filter((e) => !isFoundationEntity(e));
}

export function useFoundationLevelSync(props: { levelManager: LevelManagerLike }): void {
  const { levelManager } = props;
  const { levels, currentLevelId } = levelManager;
  const { user } = useAuth();
  const companyId = user?.companyId ?? null;
  const userId = user?.uid ?? null;

  const buildingId = useMemo(
    () => resolveBuildingIdForLevel(levels, currentLevelId),
    [levels, currentLevelId],
  );
  const { floors } = useFloorsByBuilding(buildingId, !!buildingId);

  const projectId = useMemo(
    () => levels.find((l) => l.id === currentLevelId)?.projectId ?? null,
    [levels, currentLevelId],
  );

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

  // Stable primitives για το subscription keying (αποφυγή re-subscribe ανά render).
  const targetFloorId = target?.floorId ?? null;
  const targetSceneFileId = target?.sceneFileId ?? null;
  const targetLevelId = target?.levelId ?? null;

  // ── Πέδιλα: realtime subscription στο model SSoT (floorplan_foundations) ──────
  const [modelFootings, setModelFootings] = useState<readonly Entity[]>([]);
  useEffect(() => {
    if (!targetFloorId) {
      setModelFootings([]);
      return;
    }
    const scope = resolveBimPersistenceScope({
      companyId,
      projectId,
      userId,
      floorId: targetFloorId,
      floorplanId: targetSceneFileId,
    });
    if (!scope) {
      setModelFootings([]);
      return;
    }
    const svc = createFoundationFirestoreService({
      companyId: scope.companyId,
      projectId: scope.projectId,
      floorplanId: scope.floorplanId,
      floorId: scope.floorId,
      userId: scope.userId,
    });
    const unsubscribe = svc.subscribeFoundations(
      (docs) => setModelFootings(docs.map(foundationDocToEntity) as unknown as readonly Entity[]),
      () => setModelFootings([]),
    );
    return () => unsubscribe();
  }, [targetFloorId, targetSceneFileId, companyId, projectId, userId]);

  // ── Λοιπά entities: snapshot (footings αφαιρεμένα) ────────────────────────────
  const [refreshTick, setRefreshTick] = useState(0);
  useEffect(() => {
    const unsubs = FOUNDATION_REFRESH_EVENTS.map((ev) =>
      EventBus.on(ev, () => setRefreshTick((t) => t + 1)),
    );
    return () => unsubs.forEach((u) => u());
  }, []);

  const [baseEntities, setBaseEntities] = useState<readonly Entity[]>([]);
  useEffect(() => {
    if (!targetLevelId) {
      setBaseEntities([]);
      return;
    }
    // 1. in-memory scene (visited this session).
    const liveScene = levelManager.getLevelScene(targetLevelId);
    if (liveScene && liveScene.entities.length > 0) {
      setBaseEntities(stripFootings(liveScene.entities as unknown as readonly Entity[]));
      return;
    }
    // 2. one-shot Firestore snapshot (unvisited, file-linked).
    if (!targetSceneFileId) {
      setBaseEntities([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const rec = await DxfFirestoreService.loadFileV2(targetSceneFileId);
        if (cancelled) return;
        // ADR-484 Slice 3 — null όταν το record ανήκει σε άλλον όροφο (shared fileId):
        // καμία διαρροή base entities· τα footings έρχονται ανεξάρτητα από το
        // floorId-scoped model subscription.
        const ents = (resolveFloorScopedScene(rec, targetFloorId)?.entities ??
          []) as unknown as readonly Entity[];
        setBaseEntities(stripFootings(ents));
      } catch {
        if (!cancelled) setBaseEntities([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [targetLevelId, targetSceneFileId, targetFloorId, levelManager, refreshTick]);

  // ── Publish: base + model footings + pending optimistic ───────────────────────
  useEffect(() => {
    const store = useFoundationLevelStore.getState();
    if (!target) {
      store.setFoundationLevel(null, [], activeFloorElevationMm);
      return;
    }
    store.publishFoundationLevel(target, baseEntities, modelFootings, activeFloorElevationMm);
  }, [target, baseEntities, modelFootings, activeFloorElevationMm]);

  // Καθαρισμός store στο unmount (single-level / αλλαγή viewer).
  useEffect(() => () => useFoundationLevelStore.getState().clear(), []);
}
