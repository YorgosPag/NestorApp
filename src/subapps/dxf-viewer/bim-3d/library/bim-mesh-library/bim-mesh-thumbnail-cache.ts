'use client';

/**
 * bimMeshThumbnailStore — entity-agnostic preview-image cache (ADR-411).
 *
 * Resolves the Storage download URL of each catalog asset's preview thumbnail
 * (`bim-mesh-library/<category>/thumbnails/<assetId>.png`) and caches it. A
 * library picker (e.g. `useRibbonFurnitureBridge`, `useRibbonMepFixtureBridge`)
 * subscribes via `use()` and re-renders its dropdown with `<img>` previews once
 * URLs resolve.
 *
 * Generalises `furniture-thumbnail-cache.ts` (ADR-410), which now delegates here.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-411-bim-mesh-library.md
 */

import { useSyncExternalStore } from 'react';
import { ref, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { createExternalStore } from '../../../stores/createExternalStore';
import { meshThumbnailStoragePath, meshAssetKey } from './bim-mesh-url-resolver';

// Async Map cache· η reactivity είναι ΜΟΝΟ ένα monotonic version signal → external-store
// SSoT (η pub/sub μηχανή). Τα urls/inFlight είναι ασύγχρονο cache, μένουν imperative.
const urls = new Map<string, string>();
const inFlight = new Set<string>();
const versionStore = createExternalStore<number>(0);

function emit(): void {
  versionStore.set(versionStore.get() + 1);
}

/** Resolve one category asset thumbnail (idempotent, fire-and-forget). */
function preload(category: string, assetId: string): void {
  const key = meshAssetKey(category, assetId);
  if (urls.has(key) || inFlight.has(key)) return;
  inFlight.add(key);
  void getDownloadURL(ref(storage, meshThumbnailStoragePath(category, assetId)))
    .then((url) => {
      urls.set(key, url);
      inFlight.delete(key);
      emit();
    })
    .catch(() => {
      // Missing/locked thumbnail → leave uncached; the picker shows text only.
      inFlight.delete(key);
    });
}

/** Resolve every asset thumbnail in a category catalog (idempotent). */
function preloadMany(category: string, assetIds: readonly string[]): void {
  for (const id of assetIds) preload(category, id);
}

function get(category: string, assetId: string): string | undefined {
  return urls.get(meshAssetKey(category, assetId));
}

export const bimMeshThumbnailStore = {
  preload,
  preloadMany,
  get,
  /** React subscription — returns a version number that bumps on each resolve. */
  use(): number {
    return useSyncExternalStore(versionStore.subscribe, versionStore.get, () => 0);
  },
};
