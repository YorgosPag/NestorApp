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
 * ADR-929 Φ5.2γ — «τι έχει ο server» και η σειρά των εγγραφών ζουν στο κοινό
 * `services/background-write-ledger.ts` (πριν: `useRef` εδώ, αόρατο στη βαθμονόμηση).
 * Το autosave μπαίνει στην **ίδια** ουρά με τη βαθμονόμηση (`commit-calibration.ts`),
 * διαβάζει το στιγμιότυπο **τη στιγμή της εκτέλεσης**, και όσο εκκρεμεί βαθμονόμηση
 * στέλνει τη δεσμευμένη θέση — τη νέα τη γράφει η βαθμονόμηση μαζί με τα overlays.
 *
 * @module subapps/dxf-viewer/floorplan-background/hooks/useFloorplanBackgroundPersistence
 * @enterprise ADR-340 Phase 7 — D1 (kind: 'url'), D2 (optimistic + 500ms debounce)
 */

import { useEffect, useRef } from 'react';
import { DXF_TIMING } from '../../config/dxf-timing';
import { getFloorBackground, useFloorplanBackgroundStore } from '../stores/floorplanBackgroundStore';
import { FloorplanBackgroundApiClient } from '../services/floorplan-background-api-client';
import {
  enqueueBackgroundWrite,
  getCommittedBackground,
  setCommittedBackground,
  snapshotOf,
  snapshotsEqual,
  transformForAutosave,
} from '../services/background-write-ledger';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useFloorplanBackgroundPersistence');

const DEBOUNCE_MS = DXF_TIMING.persist.ENTITY_AUTOSAVE; // ADR-516

/** Μία εγγραφή autosave, μέσα στην ουρά του ορόφου: ό,τι ισχύει ΤΗ ΣΤΙΓΜΗ που έρχεται η σειρά της. */
async function autosaveFloor(floorId: string): Promise<void> {
  const bg = getFloorBackground(floorId);
  if (!bg) return;
  const latest = { ...snapshotOf(bg), transform: transformForAutosave(floorId, bg.transform) };
  const last = getCommittedBackground(floorId);
  if (last && snapshotsEqual(last, latest)) return;
  await FloorplanBackgroundApiClient.patchTransform(latest.id, {
    transform: latest.transform,
    opacity: latest.opacity,
    visible: latest.visible,
    locked: latest.locked,
  });
  setCommittedBackground(floorId, latest);
}

async function hydrateFloor(floorId: string, isCancelled: () => boolean): Promise<void> {
  const { background, fileRecord } = await FloorplanBackgroundApiClient.getByFloor(floorId);
  if (isCancelled()) return;
  if (!background) {
    // No persisted background — nothing to hydrate; allow user to upload.
    setCommittedBackground(floorId, null);
    return;
  }
  const downloadUrl = fileRecord?.downloadUrl ?? null;
  if (!downloadUrl) {
    logger.warn('Persistence hydrate: missing downloadUrl', { backgroundId: background.id, fileId: background.fileId });
    return;
  }
  await useFloorplanBackgroundStore
    .getState()
    ._hydratePersistedBackground(floorId, background, { kind: 'url', url: downloadUrl });
  setCommittedBackground(floorId, snapshotOf(background));
}

/**
 * Wire persistence for a given floorId. Pass `null` to disable (e.g. no
 * level selected). Re-runs hydration on floorId change.
 */
export function useFloorplanBackgroundPersistence(floorId: string | null): void {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Hydration on floorId change ─────────────────────────────────────────
  useEffect(() => {
    if (!floorId) return;
    let cancelled = false;
    hydrateFloor(floorId, () => cancelled).catch((err: unknown) => {
      if (!cancelled) logger.error('Persistence hydrate failed', { floorId, err });
    });
    return () => { cancelled = true; };
  }, [floorId]);

  // ── Debounced commit on store change ────────────────────────────────────
  useEffect(() => {
    if (!floorId) return;

    const unsub = useFloorplanBackgroundStore.subscribe((state, prev) => {
      const bg = state.floors[floorId]?.background;
      if (!bg || prev.floors[floorId]?.background === bg) return;
      const last = getCommittedBackground(floorId);
      if (last && snapshotsEqual(last, snapshotOf(bg))) return;

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        enqueueBackgroundWrite(floorId, () => autosaveFloor(floorId)).catch((err: unknown) => {
          logger.error('Persistence commit failed', { floorId, err });
        });
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
