'use client';

/**
 * ADR-566 — Wall Merge Persistence hook.
 *
 * Listens for `bim:wall-merge-committed` EventBus events and persists the merge
 * result to Firestore (inverse of `useWallSplitPersistence`):
 *   1. deleteWall(wallAId) + deleteWall(wallBId)
 *   2. saveWall(merged)                         ← parallel with step 1
 *   3. updateOpening(id, { params }) per re-hosted opening
 *   4. BOQ bridge: deleteBoqItemForBim(A) + deleteBoqItemForBim(B) + upsert merged
 *   5. Audit records
 *
 * Mounted inside `WallPersistenceHost` (no new host file needed). Purely
 * side-effect — no return value, no UI state.
 *
 * @see hooks/data/useWallSplitPersistence.ts — the mirrored inverse operation
 * @see docs/centralized-systems/reference/adrs/ADR-566-merge-join-walls.md
 */

import { useCallback, useEffect, useRef } from 'react';

import type { WallEntity } from '../../bim/types/wall-types';
import type { OpeningUpdate } from '../../bim/walls/wall-split';
import { resolveBimPersistenceScope } from '../../bim/persistence/bim-floor-scope';
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

export interface UseWallMergePersistenceParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  readonly buildingId: string | null | undefined;
  /** ADR-395 Phase 1 (G7) — floor link for per-floor BOQ grouping. */
  readonly floorId: string | null | undefined;
  readonly userId: string | null;
}

// ============================================================================
// HOOK
// ============================================================================

export function useWallMergePersistence(params: UseWallMergePersistenceParams): void {
  const { companyId, projectId, floorplanId, buildingId, floorId, userId } = params;

  const wallSvcRef = useRef<WallFirestoreService | null>(null);
  const openingSvcRef = useRef<OpeningFirestoreService | null>(null);

  // Refs for async handler — avoid stale closure, no re-subscription on change.
  const companyIdRef = useRef(companyId);
  companyIdRef.current = companyId;
  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;
  const buildingIdRef = useRef(buildingId);
  buildingIdRef.current = buildingId;
  const floorIdRef = useRef(floorId);
  floorIdRef.current = floorId;

  useEffect(() => {
    const scope = resolveBimPersistenceScope({ companyId, projectId, userId, floorId, floorplanId });
    if (!scope) {
      wallSvcRef.current = null;
      openingSvcRef.current = null;
      return;
    }
    const cfg = {
      companyId: scope.companyId,
      projectId: scope.projectId,
      floorplanId: scope.floorplanId,
      floorId: scope.floorId,
      userId: scope.userId,
    };
    wallSvcRef.current = createWallFirestoreService(cfg);
    openingSvcRef.current = createOpeningFirestoreService(cfg);
  }, [companyId, projectId, floorplanId, floorId, userId]);

  const persistMerge = useCallback(async (
    wallAId: string,
    wallBId: string,
    merged: WallEntity,
    openingUpdates: readonly OpeningUpdate[],
  ): Promise<void> => {
    const wallSvc = wallSvcRef.current;
    const openingSvc = openingSvcRef.current;
    if (!wallSvc || !openingSvc) return;

    await Promise.all([
      wallSvc.deleteWall(wallAId),
      wallSvc.deleteWall(wallBId),
      wallSvc.saveWall(wallEntityToSaveInput(merged)),
    ]);

    if (openingUpdates.length > 0) {
      await Promise.all(
        openingUpdates.map(({ openingId, nextParams }) =>
          openingSvc.updateOpening(openingId, { params: nextParams }),
        ),
      );
    }

    void recordWallChange('deleted', { id: wallAId, kind: merged.kind });
    void recordWallChange('deleted', { id: wallBId, kind: merged.kind });
    void recordWallChange('created', merged);

    const cId = companyIdRef.current;
    const pId = projectIdRef.current;
    const bId = buildingIdRef.current;
    const fId = floorIdRef.current ?? undefined;
    if (cId && pId && bId) {
      void bimToBoqBridge.deleteBoqItemForBim(wallAId, cId);
      void bimToBoqBridge.deleteBoqItemForBim(wallBId, cId);
      void bimToBoqBridge.upsertBoqItemForBim(
        'wall',
        { id: merged.id, kind: merged.kind, geometry: merged.geometry, params: merged.params as unknown as Readonly<{ [key: string]: unknown; category?: string }> },
        { companyId: cId, projectId: pId, buildingId: bId, floorId: fId },
        'created',
      );
    }
  }, []);

  useEffect(() => {
    return EventBus.on('bim:wall-merge-committed', ({ wallAId, wallBId, merged, openingUpdates }) => {
      void persistMerge(wallAId, wallBId, merged, openingUpdates);
    });
  }, [persistMerge]);
}
