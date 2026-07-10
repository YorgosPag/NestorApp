'use client';

/**
 * ADR-363 Phase X — Wall Split Persistence hook.
 *
 * Listens for `bim:wall-split-committed` and persists the split result to Firestore:
 *   1. deleteWall(originalWallId) + saveWall(wall1) + saveWall(wall2)  ← parallel
 *   2. updateOpening(id, { params }) per redistributed opening
 *   3. BOQ bridge: deleteBoqItemForBim(original) + upsert wall1 + upsert wall2
 *   4. Audit records
 *
 * Thin binding over `useWallBooleanOpPersistence` (ADR-628) — the invariant scaffold
 * (service refs / scope-init effect / live BOQ scope / subscribe) lives there once;
 * this file owns only the split-specific delete/save/BOQ/audit sequence. Mounted
 * inside `WallPersistenceHost`. Purely side-effect — no return value, no UI state.
 *
 * @see hooks/data/useWallMergePersistence.ts — the mirrored inverse operation
 * @see hooks/data/use-wall-boolean-op-persistence.ts — the shared primitive
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §Phase X
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
export type UseWallSplitPersistenceParams = UseWallBooleanOpPersistenceParams;

export function useWallSplitPersistence(params: UseWallSplitPersistenceParams): void {
  useWallBooleanOpPersistence(
    params,
    'bim:wall-split-committed',
    async ({ originalWallId, wall1, wall2, openingUpdates }, { wallSvc, openingSvc, boqScope }) => {
      await Promise.all([
        wallSvc.deleteWall(originalWallId),
        wallSvc.saveWall(wallEntityToSaveInput(wall1)),
        wallSvc.saveWall(wallEntityToSaveInput(wall2)),
      ]);

      await applyOpeningUpdates(openingSvc, openingUpdates);

      void recordWallChange('deleted', { id: originalWallId, kind: wall1.kind });
      void recordWallChange('created', wall1);
      void recordWallChange('created', wall2);

      if (boqScope) {
        deleteWallBoq(originalWallId, boqScope.companyId);
        upsertMergedWallBoq(wall1, boqScope);
        upsertMergedWallBoq(wall2, boqScope);
      }
    },
  );
}
