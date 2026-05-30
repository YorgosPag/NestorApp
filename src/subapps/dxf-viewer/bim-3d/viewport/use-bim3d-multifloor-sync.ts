'use client';

/**
 * ADR-399 Phase B — wiring hook for the "Όλοι οι όροφοι" (all floors) 3D scope.
 *
 * Mounted once by `BimViewport3D`. Responsibilities:
 *   1. Run {@link useFloors3DAggregator} while scope === 'all' (it produces the
 *      per-floor stack into the `multi-floor-3d-source` SSoT).
 *   2. Rebuild the scene through the scope-aware {@link resyncBimScene} whenever
 *      the scope flips (single ↔ all) or the aggregated stack changes (async
 *      floor loads / active-floor edits).
 *
 * No-op in the read-only Properties pipeline (`externalEntitiesMode`) — the
 * floor tab bar (and therefore the 'all' scope) only exists on /dxf/viewer.
 */

import { useEffect, useSyncExternalStore, type RefObject } from 'react';
import { useViewMode3DStore } from '../stores/ViewMode3DStore';
import type { Bim3DEntities } from '../stores/Bim3DEntitiesStore';
import { resyncBimScene } from '../scene/bim3d-resync';
import { subscribeMultiFloorStack } from '../scene/multi-floor-3d-source';
import { useFloors3DAggregator } from '../../hooks/data/useFloors3DAggregator';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';

export function useBim3DMultiFloorSync(
  managerRef: RefObject<ThreeJsSceneManager | null>,
  externalEntitiesMode: boolean,
  bimEntities: Bim3DEntities | null | undefined,
): void {
  const scope = useSyncExternalStore(
    useViewMode3DStore.subscribe,
    () => useViewMode3DStore.getState().floor3DScope,
    () => 'single' as const,
  );
  const active = scope === 'all' && !externalEntitiesMode;

  // Producer — fills / clears the multi-floor source SSoT.
  useFloors3DAggregator(active);

  // Rebuild on scope flips (single ↔ all).
  useEffect(() => {
    resyncBimScene(managerRef.current, { externalEntitiesMode, bimEntities });
  }, [scope, externalEntitiesMode, bimEntities, managerRef]);

  // Rebuild when the stack changes (async loads / active-floor edits) while 'all'.
  useEffect(() => {
    return subscribeMultiFloorStack(() => {
      if (useViewMode3DStore.getState().floor3DScope === 'all') {
        resyncBimScene(managerRef.current, { externalEntitiesMode, bimEntities });
      }
    });
  }, [externalEntitiesMode, bimEntities, managerRef]);
}
