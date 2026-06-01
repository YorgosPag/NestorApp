'use client';

/**
 * ADR-401 SSoT — persist entities whose structural-attach binding changed.
 *
 * Dedicated listener for `bim:entities-attached` (emitted by the Attach/Detach
 * commands on execute / undo / redo, carrying the post-change entities). For
 * each entity matching `isEntityType` it marks the id dirty + persists — same
 * contract as `useBimEntityMovedPersistEffect`, which already folds this event
 * in for wall / column. Stairs do NOT mount that shared effect (no
 * `bim:entities-moved` / `bim:envelope-applied` coupling), so they use this
 * focused hook instead.
 *
 * WHY a signal is needed: auto-attach targets NON-selected entities (the
 * walls/columns/stairs under a just-created beam/slab), which the selection-
 * debounce auto-save never catches — without persisting + marking dirty, the
 * binding change lives only in-memory and the next Firestore snapshot reverts it.
 *
 * @see hooks/data/useBimEntityMovedPersistEffect.ts — wall/column equivalent
 * @see core/commands/entity-commands/attach-persist-signal.ts — the emitter
 */

import { useEffect } from 'react';
import type { MutableRefObject } from 'react';
import { EventBus } from '../../systems/events/EventBus';
import type { AnySceneEntity } from '../../types/entities';

export function useBimEntityAttachedPersistEffect<T extends AnySceneEntity, S>(
  isEntityType: (e: AnySceneEntity) => e is T,
  serviceRef: MutableRefObject<S | null>,
  dirtyIdsRef: MutableRefObject<Set<string>>,
  persist: (entity: T) => Promise<void>,
): void {
  useEffect(() => {
    const off = EventBus.on('bim:entities-attached', ({ entities }) => {
      if (!serviceRef.current) return;
      for (const entity of entities) {
        if (!isEntityType(entity)) continue;
        dirtyIdsRef.current.add(entity.id);
        void persist(entity);
      }
    });
    return () => off();
  }, [isEntityType, serviceRef, dirtyIdsRef, persist]);
}
