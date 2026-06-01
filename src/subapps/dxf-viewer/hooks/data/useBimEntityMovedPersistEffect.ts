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
 * ADR-396 P7 Part B — the same persist path also handles `bim:envelope-applied`
 * (thermal envelope per-element `envelopeLayer` writes). Both events carry the
 * changed entities directly; identical save+audit+structural-BOQ side-effect.
 * Openings are NOT in this family (they don't use this effect) — Z4 reveals are
 * persisted by a dedicated listener in `useOpeningPersistence`.
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
    const persistChanged = (entities: ReadonlyArray<AnySceneEntity>): void => {
      if (!serviceRef.current) return;
      for (const entity of entities) {
        if (!isEntityType(entity)) continue;
        dirtyIdsRef.current.add(entity.id);
        void persist(entity);
      }
    };
    const offMoved = EventBus.on('bim:entities-moved', ({ movedEntities }) =>
      persistChanged(movedEntities),
    );
    const offEnvelope = EventBus.on('bim:envelope-applied', ({ entities }) =>
      persistChanged(entities),
    );
    // ADR-401 — attach/detach commands broadcast the entities whose structural
    // binding changed (auto-attach below a new host hits NON-selected entities,
    // which the selection-debounce auto-save never catches). Same persist path.
    const offAttached = EventBus.on('bim:entities-attached', ({ entities }) =>
      persistChanged(entities),
    );
    return () => {
      offMoved();
      offEnvelope();
      offAttached();
    };
  }, [isEntityType, serviceRef, dirtyIdsRef, persist]);
}
