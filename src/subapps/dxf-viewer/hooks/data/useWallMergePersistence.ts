'use client';

/**
 * ADR-566 — Wall Merge Persistence hook.
 *
 * Listens for `bim:wall-merge-committed` and persists the merge result to Firestore
 * (inverse of `useWallSplitPersistence`):
 *   1. deleteWall(wallAId) + deleteWall(wallBId) + saveWall(merged)  ← parallel
 *   2. updateOpening(id, { params }) per re-hosted opening
 *   3. BOQ bridge: deleteBoqItemForBim(A) + deleteBoqItemForBim(B) + upsert merged
 *   4. Audit records
 *
 * Thin binding over `useWallBooleanOpPersistence` (ADR-628) — the invariant scaffold
 * (service refs / scope-init effect / live BOQ scope / subscribe) lives there once;
 * this file owns only the merge-specific delete/save/BOQ/audit sequence. Mounted
 * inside `WallPersistenceHost`. Purely side-effect — no return value, no UI state.
 *
 * @see hooks/data/useWallSplitPersistence.ts — the mirrored inverse operation
 * @see hooks/data/use-wall-boolean-op-persistence.ts — the shared primitive
 * @see docs/centralized-systems/reference/adrs/ADR-566-merge-join-walls.md
 */

import { entityToSaveInput as wallEntityToSaveInput } from '../../bim/walls/wall-firestore-service';
import { recordWallChange } from '../../bim/walls/wall-audit-client';
import {
  useWallBooleanOpPersistence,
  upsertMergedWallBoq,
  deleteWallBoq,
  applyOpeningUpdates,
  type UseWallBooleanOpPersistenceParams,
} from './use-wall-boolean-op-persistence';

// Public API (unchanged) — kept as a named alias for back-compat.
export type UseWallMergePersistenceParams = UseWallBooleanOpPersistenceParams;

export function useWallMergePersistence(params: UseWallMergePersistenceParams): void {
  useWallBooleanOpPersistence(
    params,
    'bim:wall-merge-committed',
    async ({ wallAId, wallBId, merged, openingUpdates }, { wallSvc, openingSvc, boqScope }) => {
      await Promise.all([
        wallSvc.deleteWall(wallAId),
        wallSvc.deleteWall(wallBId),
        wallSvc.saveWall(wallEntityToSaveInput(merged)),
      ]);

      await applyOpeningUpdates(openingSvc, openingUpdates);

      void recordWallChange('deleted', { id: wallAId, kind: merged.kind });
      void recordWallChange('deleted', { id: wallBId, kind: merged.kind });
      void recordWallChange('created', merged);

      if (boqScope) {
        deleteWallBoq(wallAId, boqScope.companyId);
        deleteWallBoq(wallBId, boqScope.companyId);
        upsertMergedWallBoq(merged, boqScope);
      }
    },
  );
}
