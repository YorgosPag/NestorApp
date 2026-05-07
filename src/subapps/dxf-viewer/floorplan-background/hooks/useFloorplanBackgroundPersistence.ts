'use client';

/**
 * =============================================================================
 * useFloorplanBackgroundPersistence — Phase 7 wire-up hook
 * =============================================================================
 *
 * Bridges the in-memory `floorplanBackgroundStore` with the
 * `/api/floorplan-backgrounds` REST surface:
 *
 *   1. Hydrate: when `floorId` becomes non-null, GET the background + provider
 *      load via `kind: 'url'` (D1). AbortController on cleanup.
 *   2. Optimistic UI + debounced commit (D2): subscribe to transform / opacity
 *      / visible / locked deltas in the store and PATCH them after a 500 ms
 *      quiescence window. Pending changes coalesce into one request.
 *
 * Calibration writes go through a different endpoint (`PATCH kind:'calibration'`)
 * and are NOT auto-committed by this hook — they are user-initiated atomic
 * operations triggered from the calibration dialog.
 *
 * @module subapps/dxf-viewer/floorplan-background/hooks/useFloorplanBackgroundPersistence
 * @enterprise ADR-340 Phase 7 — D1 (kind: 'url'), D2 (optimistic + 500ms debounce)
 */

import { useEffect, useRef } from 'react';
import { useFloorplanBackgroundStore } from '../stores/floorplanBackgroundStore';
import { FloorplanBackgroundApiClient } from '../services/floorplan-background-api-client';
import type { BackgroundTransform, FloorplanBackground } from '../providers/types';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useFloorplanBackgroundPersistence');

const DEBOUNCE_MS = 500;

interface PersistableSnapshot {
  id: string;
  transform: BackgroundTransform;
  opacity: number;
  visible: boolean;
  locked: boolean;
}

function snapshot(bg: FloorplanBackground): PersistableSnapshot {
  return {
    id: bg.id,
    transform: { ...bg.transform },
    opacity: bg.opacity,
    visible: bg.visible,
    locked: bg.locked,
  };
}

function snapshotsEqual(a: PersistableSnapshot, b: PersistableSnapshot): boolean {
  return (
    a.id === b.id &&
    a.opacity === b.opacity &&
    a.visible === b.visible &&
    a.locked === b.locked &&
    a.transform.translateX === b.transform.translateX &&
    a.transform.translateY === b.transform.translateY &&
    a.transform.scaleX === b.transform.scaleX &&
    a.transform.scaleY === b.transform.scaleY &&
    a.transform.rotation === b.transform.rotation
  );
}

/**
 * Wire persistence for a given floorId. Pass `null` to disable (e.g. no
 * level selected). Re-runs hydration on floorId change.
 */
export function useFloorplanBackgroundPersistence(floorId: string | null): void {
  const lastCommittedRef = useRef<PersistableSnapshot | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Hydration on floorId change ─────────────────────────────────────────
  useEffect(() => {
    if (!floorId) {
      lastCommittedRef.current = null;
      return;
    }
    const ac = new AbortController();
    let cancelled = false;

    void (async () => {
      try {
        const { background, fileRecord } = await FloorplanBackgroundApiClient.getByFloor(floorId);
        if (cancelled || ac.signal.aborted) return;

        if (!background) {
          // No persisted background — nothing to hydrate; allow user to upload.
          lastCommittedRef.current = null;
          return;
        }

        const downloadUrl = fileRecord?.downloadUrl ?? null;
        if (!downloadUrl) {
          logger.warn('Persistence hydrate: missing downloadUrl', {
            backgroundId: background.id,
            fileId: background.fileId,
          });
          return;
        }

        await useFloorplanBackgroundStore
          .getState()
          ._hydratePersistedBackground(floorId, background, { kind: 'url', url: downloadUrl });

        lastCommittedRef.current = snapshot(background);
      } catch (err) {
        if (ac.signal.aborted) return;
        logger.error('Persistence hydrate failed', { floorId, err });
      }
    })();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [floorId]);

  // ── Debounced commit on store change ────────────────────────────────────
  useEffect(() => {
    if (!floorId) return;

    const unsub = useFloorplanBackgroundStore.subscribe((state, prev) => {
      const slot = state.floors[floorId];
      const bg = slot?.background;
      if (!bg) return;
      if (prev.floors[floorId]?.background === bg) return;

      const next = snapshot(bg);
      const last = lastCommittedRef.current;
      if (last && snapshotsEqual(last, next)) return;

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        try {
          await FloorplanBackgroundApiClient.patchTransform(next.id, {
            transform: next.transform,
            opacity: next.opacity,
            visible: next.visible,
            locked: next.locked,
          });
          lastCommittedRef.current = next;
        } catch (err) {
          logger.error('Persistence commit failed', { backgroundId: next.id, err });
        }
      }, DEBOUNCE_MS);
    });

    return () => {
      unsub();
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [floorId]);
}
