'use client';

/**
 * Wall soft-lock lifecycle — extracted from `useWallPersistence` (N.7.1 file
 * size). Owns the soft-lock TTL semantics around the primary selection:
 *
 *   - `acquireLock(wallId)` — acquire (releasing any other held lock first) and
 *     arm a TTL timer that auto-releases after `LOCK_TTL_MS`.
 *   - `releaseLock()` — release the held lock and clear the timer (idempotent,
 *     non-fatal on failure — the remote lock TTL-expires anyway).
 *   - selection effect — release when the primary selection drops or moves to a
 *     different wall.
 *   - unmount cleanup — clear the timer + release.
 *
 * The persistence hook passes its `serviceRef` (so this hook always talks to the
 * current Firestore service instance) and the current primary-selected wall.
 *
 * @see ./useWallPersistence.ts
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.10
 */

import { useCallback, useEffect, useRef, type RefObject } from 'react';

import type { WallEntity } from '../../bim/types/wall-types';
import type { WallFirestoreService } from '../../bim/walls/wall-firestore-service';
import { DXF_TIMING } from '../../config/dxf-timing';

const LOCK_TTL_MS = DXF_TIMING.lifecycle.LOCK_TTL; // ADR-516

export interface UseWallSoftLockResult {
  readonly acquireLock: (wallId: string) => Promise<void>;
  readonly releaseLock: () => Promise<void>;
  /** The wall id whose lock is currently held, or `null`. */
  readonly getHeldWallId: () => string | null;
}

export function useWallSoftLock(
  serviceRef: RefObject<WallFirestoreService | null>,
  primarySelectedWall: WallEntity | null,
): UseWallSoftLockResult {
  const lockHeldRef = useRef<string | null>(null);
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const releaseLock = useCallback(async () => {
    const svc = serviceRef.current;
    const held = lockHeldRef.current;
    if (!svc || !held) return;
    lockHeldRef.current = null;
    if (lockTimerRef.current) {
      clearTimeout(lockTimerRef.current);
      lockTimerRef.current = null;
    }
    try {
      await svc.releaseLock(held);
    } catch {
      /* non-fatal — lock will TTL-expire on remote side */
    }
  }, [serviceRef]);

  const acquireLock = useCallback(
    async (wallId: string) => {
      const svc = serviceRef.current;
      if (!svc) return;
      if (lockHeldRef.current === wallId) return;
      if (lockHeldRef.current && lockHeldRef.current !== wallId) {
        await releaseLock();
      }
      try {
        await svc.acquireLock(wallId);
        lockHeldRef.current = wallId;
        if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
        lockTimerRef.current = setTimeout(() => {
          void releaseLock();
        }, LOCK_TTL_MS);
      } catch {
        /* non-fatal */
      }
    },
    [serviceRef, releaseLock],
  );

  // Release lock when primary selection drops or changes wall.
  useEffect(() => {
    if (!primarySelectedWall) {
      void releaseLock();
    } else if (
      lockHeldRef.current &&
      lockHeldRef.current !== primarySelectedWall.id
    ) {
      void releaseLock();
    }
    return () => {
      void releaseLock();
    };
  }, [primarySelectedWall?.id, releaseLock]);

  // Unmount cleanup — clear timer + release.
  useEffect(() => {
    return () => {
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
      void releaseLock();
    };
  }, [releaseLock]);

  const getHeldWallId = useCallback(() => lockHeldRef.current, []);

  return { acquireLock, releaseLock, getHeldWallId };
}
