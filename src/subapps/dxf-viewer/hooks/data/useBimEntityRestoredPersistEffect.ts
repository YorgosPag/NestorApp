'use client';

/**
 * ADR-381 SSoT — `bim:entity-restore-requested` persistence side-effect.
 *
 * Symmetric inverse του `useBimEntityMovedPersistEffect` για undo→restore flow.
 * Each BIM persistence hook (`useWallPersistence`, `useSlabPersistence`, κλπ)
 * calls this once με entity-type discriminator + per-hook `persistRestore`.
 *
 * Triggered by `DeleteEntityCommand.undo()` / `DeleteMultipleEntitiesCommand.undo()`
 * which emit `bim:entity-restore-requested` AFTER `sceneManager.addEntity(snapshot)`.
 *
 * Effect flow:
 *   1. Type-guard payload — single shared event fans out to 7 hooks
 *   2. `pendingFirstSaveIdsRef.add(id)` — marks "in-flight first save" so the
 *      subscribe-loop ghost-drop guard does NOT drop the entity during the race
 *   3. `deletedIdsRef.delete(id)` — clear tombstone (entity is back, not deleted)
 *   4. Invoke per-hook `persistRestore(entity)` — writes Firestore doc +
 *      audit row με `action='restored'` (όχι misleading `'created'`)
 *
 * @see docs/centralized-systems/reference/adrs/ADR-381-symmetric-bim-delete-undo.md
 */

import { useEffect } from 'react';
import type { MutableRefObject } from 'react';
import { EventBus } from '../../systems/events/EventBus';
import type { AnySceneEntity } from '../../types/entities';

type BimRestoreEntityType =
  | 'wall' | 'opening' | 'slab' | 'slab-opening' | 'column' | 'beam' | 'stair';

export function useBimEntityRestoredPersistEffect<T extends AnySceneEntity, S>(
  entityType: BimRestoreEntityType,
  isEntityType: (e: AnySceneEntity) => e is T,
  serviceRef: MutableRefObject<S | null>,
  pendingFirstSaveIdsRef: MutableRefObject<Set<string>>,
  deletedIdsRef: MutableRefObject<Set<string>>,
  persistRestore: (entity: T) => Promise<void>,
): void {
  useEffect(() => {
    return EventBus.on('bim:entity-restore-requested', (payload) => {
      if (payload.entityType !== entityType) return;
      if (!serviceRef.current) return;
      const snapshot = payload.entitySnapshot;
      if (!isEntityType(snapshot)) return;
      pendingFirstSaveIdsRef.current.add(snapshot.id);
      deletedIdsRef.current.delete(snapshot.id);
      void persistRestore(snapshot);
    });
  }, [entityType, isEntityType, serviceRef, pendingFirstSaveIdsRef, deletedIdsRef, persistRestore]);
}
