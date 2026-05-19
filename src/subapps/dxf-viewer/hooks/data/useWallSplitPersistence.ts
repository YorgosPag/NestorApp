'use client';

/**
 * ADR-363 Phase X — Wall Split Persistence hook.
 *
 * Listens for `bim:wall-split-committed` EventBus events and persists the
 * split result to Firestore:
 *   1. deleteWall(originalWallId)
 *   2. saveWall(wall1) + saveWall(wall2)       ← parallel with step 1
 *   3. updateOpening(id, { params }) per redistributed opening
 *   4. BOQ bridge: deleteBoqItemForBim(original) + upsert wall1 + upsert wall2
 *   5. Audit records
 *
 * Mounted inside `WallPersistenceHost` (no new host file needed). Purely
 * side-effect — no return value, no UI state.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §Phase X
 */

import { useCallback, useEffect, useRef } from 'react';

import type { WallEntity } from '../../bim/types/wall-types';
import type { OpeningUpdate } from '../../bim/walls/wall-split';
import {
  createWallFirestoreService,
  entityToSaveInput as wallEntityToSaveInput,
  WallFirestoreService,
} from '../../bim/walls/wall-firestore-service';
import {
  createOpeningFirestoreService,
  OpeningFirestoreService,
} from '../../bim/walls/opening-firestore-service';
import { recordWallChange } from '../../bim/walls/wall-audit-client';
import { bimToBoqBridge } from '../../bim/services/BimToBoqBridge';
import { EventBus } from '../../systems/events/EventBus';

// ============================================================================
// TYPES
// ============================================================================

export interface UseWallSplitPersistenceParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  readonly buildingId: string | null | undefined;
  readonly userId: string | null;
}

// ============================================================================
// HOOK
// ============================================================================

export function useWallSplitPersistence(params: UseWallSplitPersistenceParams): void {
  const { companyId, projectId, floorplanId, buildingId, userId } = params;

  const wallSvcRef = useRef<WallFirestoreService | null>(null);
  const openingSvcRef = useRef<OpeningFirestoreService | null>(null);

  // Refs for async handler — avoid stale closure, no re-subscription on change.
  const companyIdRef = useRef(companyId);
  companyIdRef.current = companyId;
  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;
  const buildingIdRef = useRef(buildingId);
  buildingIdRef.current = buildingId;

  useEffect(() => {
    if (!companyId || !projectId || !floorplanId || !userId) {
      wallSvcRef.current = null;
      openingSvcRef.current = null;
      return;
    }
    const cfg = { companyId, projectId, floorplanId, userId };
    wallSvcRef.current = createWallFirestoreService(cfg);
    openingSvcRef.current = createOpeningFirestoreService(cfg);
  }, [companyId, projectId, floorplanId, userId]);

  const persistSplit = useCallback(async (
    originalWallId: string,
    wall1: WallEntity,
    wall2: WallEntity,
    openingUpdates: readonly OpeningUpdate[],
  ): Promise<void> => {
    const wallSvc = wallSvcRef.current;
    const openingSvc = openingSvcRef.current;
    if (!wallSvc || !openingSvc) return;

    await Promise.all([
      wallSvc.deleteWall(originalWallId),
      wallSvc.saveWall(wallEntityToSaveInput(wall1)),
      wallSvc.saveWall(wallEntityToSaveInput(wall2)),
    ]);

    if (openingUpdates.length > 0) {
      await Promise.all(
        openingUpdates.map(({ openingId, nextParams }) =>
          openingSvc.updateOpening(openingId, { params: nextParams }),
        ),
      );
    }

    void recordWallChange('deleted', { id: originalWallId, kind: wall1.kind });
    void recordWallChange('created', wall1);
    void recordWallChange('created', wall2);

    const cId = companyIdRef.current;
    const pId = projectIdRef.current;
    const bId = buildingIdRef.current;
    if (cId && pId && bId) {
      void bimToBoqBridge.deleteBoqItemForBim(originalWallId, cId);
      void bimToBoqBridge.upsertBoqItemForBim(
        'wall',
        { id: wall1.id, kind: wall1.kind, geometry: wall1.geometry, params: wall1.params },
        { companyId: cId, projectId: pId, buildingId: bId },
        'created',
      );
      void bimToBoqBridge.upsertBoqItemForBim(
        'wall',
        { id: wall2.id, kind: wall2.kind, geometry: wall2.geometry, params: wall2.params },
        { companyId: cId, projectId: pId, buildingId: bId },
        'created',
      );
    }
  }, []);

  useEffect(() => {
    return EventBus.on('bim:wall-split-committed', ({ originalWallId, wall1, wall2, openingUpdates }) => {
      void persistSplit(originalWallId, wall1, wall2, openingUpdates);
    });
  }, [persistSplit]);
}
