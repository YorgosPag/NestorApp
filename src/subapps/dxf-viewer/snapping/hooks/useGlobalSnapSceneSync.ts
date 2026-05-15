/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * @module useGlobalSnapSceneSync
 * @description Sole owner of SnapEngine scene-initialize lifecycle (SSoT, GOL).
 *
 * MUST be invoked exactly ONCE per app lifecycle — from CanvasSection.
 * Other call sites are forbidden (enforced by registry rule `snap-scene-sync`).
 *
 * Two performance levers:
 *   1. Singleton engine (see `global-snap-engine.ts`) — eliminates 3× duplicate
 *      `initialize()` runs that the per-hook architecture caused.
 *   2. `requestIdleCallback` deferral — moves the remaining O(N) spatial-index
 *      rebuild OFF the React commit critical path. Snap may be stale for a
 *      single frame after a scene change, which is acceptable: the user is
 *      not snapping while clicking to commit the entity that triggered it.
 *
 * Fingerprint guard prevents redundant initialize when React rebuilds the
 * scene reference but geometry is unchanged (e.g. settings change re-renders).
 *
 * @since 2026-05-11
 */

import { useEffect, useRef } from 'react';

import { perfMark } from '../../debug/perf-line-profile';
import {
  getGlobalSnapEngine,
  getLastSnapEntityFingerprint,
  setLastSnapEntityFingerprint,
} from '../global-snap-engine';
import type { Entity } from '../extended-types';
import { isArrayEntity } from '../../types/entities';
import type { PathParams } from '../../systems/array/types';
import type { SceneModel } from '../../types/scene';
import { expandArrayEntity } from '../../systems/array/array-expander';
import type { Overlay } from '../../overlays/types';
import { overlaysToRegions } from '../../overlays/overlay-adapter';
import { regionsToSnapEntities } from '../../overlays/snap-adapter';

interface UseGlobalSnapSceneSyncParams {
  scene: SceneModel | null;
  overlays?: readonly Overlay[];
}

/** Sample-based fingerprint: length + first-5 ids + last-5 ids. O(1) compare. */
function computeFingerprint(entities: readonly Entity[]): string {
  const len = entities.length;
  if (len === 0) return '0';
  const sampleSize = Math.min(5, len);
  const firstIds: string[] = [];
  const lastIds: string[] = [];
  for (let i = 0; i < sampleSize; i++) firstIds.push(entities[i].id);
  for (let i = Math.max(0, len - sampleSize); i < len; i++) lastIds.push(entities[i].id);
  return `${len}|${firstIds.join(',')}|${lastIds.join(',')}`;
}

type IdleHandle = number;
type IdleCallback = (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void;
interface IdleScheduler {
  request: (cb: IdleCallback, opts?: { timeout: number }) => IdleHandle;
  cancel: (handle: IdleHandle) => void;
}

function getIdleScheduler(): IdleScheduler {
  if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
    return {
      request: (cb, opts) => window.requestIdleCallback(cb, opts),
      cancel: (h) => window.cancelIdleCallback(h),
    };
  }
  return {
    request: (cb, opts) => window.setTimeout(() => cb({ didTimeout: true, timeRemaining: () => 0 }), opts?.timeout ?? 0) as unknown as IdleHandle,
    cancel: (h) => window.clearTimeout(h as unknown as number),
  };
}

export function useGlobalSnapSceneSync({
  scene,
  overlays,
}: UseGlobalSnapSceneSyncParams): void {
  const dxfEntities = scene?.entities;
  const dxfLen = dxfEntities?.length ?? 0;
  const overlayLen = overlays?.length ?? 0;
  const pendingIdleHandleRef = useRef<IdleHandle | null>(null);
  const scheduler = useRef(getIdleScheduler()).current;

  useEffect(() => {
    const rawEnts = (scene?.entities ?? []) as readonly Entity[];
    // ADR-353: expand ArrayEntities into individual snap candidates.
    const dxfEnts: Entity[] = [];
    for (const e of rawEnts) {
      if (isArrayEntity(e)) {
        const pathEnt = e.arrayKind === 'path' && e.params.kind === 'path'
          ? rawEnts.find(r => r.id === (e.params as PathParams).pathEntityId)
          : undefined;
        for (const item of expandArrayEntity(e, pathEnt as Entity | undefined)) dxfEnts.push(item as Entity);
      } else {
        dxfEnts.push(e);
      }
    }
    const overlayEnts: Entity[] = overlays?.length
      ? regionsToSnapEntities(overlaysToRegions([...overlays]))
      : [];
    const allEntities: Entity[] = [...dxfEnts, ...overlayEnts];

    const fingerprint = computeFingerprint(allEntities);
    if (fingerprint === getLastSnapEntityFingerprint()) {
      return;
    }
    setLastSnapEntityFingerprint(fingerprint);

    if (pendingIdleHandleRef.current !== null) {
      scheduler.cancel(pendingIdleHandleRef.current);
      pendingIdleHandleRef.current = null;
    }

    pendingIdleHandleRef.current = scheduler.request(() => {
      pendingIdleHandleRef.current = null;
      perfMark(`useGlobalSnapSceneSync.initialize(n=${allEntities.length})`, () => {
        getGlobalSnapEngine().initialize(allEntities);
      });
    }, { timeout: 250 });

    return () => {
      if (pendingIdleHandleRef.current !== null) {
        scheduler.cancel(pendingIdleHandleRef.current);
        pendingIdleHandleRef.current = null;
      }
    };
  }, [dxfLen, overlayLen, scene, overlays, scheduler]);
}
