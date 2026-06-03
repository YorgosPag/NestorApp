/**
 * Furniture glTF library — Storage URL resolver (SSoT) — ADR-410.
 *
 * The single place that maps a catalog `assetId` → a downloadable mesh URL.
 * Like a Revit content library, the meshes live in a company-scoped Firebase
 * Storage path (`furniture-library/<assetId>.glb`); this module resolves the
 * download URL (with in-flight de-duplication so concurrent placements of the
 * same asset share one network round-trip).
 *
 * If we ever change hosting (CDN, bundle, signed URLs), THIS is the only file
 * that changes — the cache + converter stay untouched (full SSOT).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-410-cc0-mesh-furniture-import.md
 */

import { ref, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';

/** Storage folder that holds the CC0 furniture mesh library. */
export const FURNITURE_LIBRARY_PATH = 'furniture-library';

/** Storage object path for a given asset id. */
export function furnitureAssetStoragePath(assetId: string): string {
  return `${FURNITURE_LIBRARY_PATH}/${assetId}.glb`;
}

/** In-flight URL resolutions, keyed by assetId (de-dup concurrent requests). */
const inFlight = new Map<string, Promise<string>>();

/**
 * Resolve the download URL for a furniture asset's `.glb`. De-duplicated: a
 * second call for the same `assetId` while the first is pending returns the same
 * Promise. Rejections clear the cache entry so a retry can re-attempt.
 */
export function resolveFurnitureMeshUrl(assetId: string): Promise<string> {
  const existing = inFlight.get(assetId);
  if (existing) return existing;

  const promise = getDownloadURL(ref(storage, furnitureAssetStoragePath(assetId)))
    .catch((err) => {
      inFlight.delete(assetId);
      throw err;
    });
  inFlight.set(assetId, promise);
  return promise;
}
