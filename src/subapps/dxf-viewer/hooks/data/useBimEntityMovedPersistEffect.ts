'use client';

/**
 * ADR-363 SSoT — Single EventBus `bim:entities-moved` persistence side-effect.
 *
 * Eliminates the 5× duplicated useEffect block that was copy-pasted into
 * useWallPersistence, useBeamPersistence, useSlabPersistence,
 * useColumnPersistence, useSlabOpeningPersistence.
 *
 * Each hook calls this once:
 *   useBimEntityMovedPersistEffect(isWall, serviceRef, dirtyIdsRef, persist);
 *
 * WHY payload-based: entities travel in the EventBus payload (built in
 * MoveMultipleEntitiesCommand from snapshot + updates). This avoids calling
 * `levelManager.getLevelScene()` at synchronous emit time — which returns stale
 * React state and would persist the pre-move params.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.10
 */

import { useEffect } from 'react';
import type { MutableRefObject } from 'react';
import { EventBus } from '../../systems/events/EventBus';
import type { AnySceneEntity } from '../../types/entities';

export function useBimEntityMovedPersistEffect<T extends AnySceneEntity, S>(
  isEntityType: (e: AnySceneEntity) => e is T,
  serviceRef: MutableRefObject<S | null>,
  dirtyIdsRef: MutableRefObject<Set<string>>,
  persist: (entity: T) => Promise<void>,
): void {
  useEffect(() => {
    return EventBus.on('bim:entities-moved', ({ movedEntities }) => {
      if (!serviceRef.current) return;
      for (const entity of movedEntities) {
        if (!isEntityType(entity)) continue;
        dirtyIdsRef.current.add(entity.id);
        void persist(entity);
      }
    });
  }, [isEntityType, serviceRef, dirtyIdsRef, persist]);
}
