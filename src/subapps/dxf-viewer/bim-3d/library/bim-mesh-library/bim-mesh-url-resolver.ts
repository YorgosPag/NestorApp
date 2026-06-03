/**
 * BIM mesh library — Storage URL resolver (entity-agnostic SSoT) — ADR-411.
 *
 * The single place that maps a (`bimCategory`, `assetId`) pair → a downloadable
 * glTF URL. Like a Revit content library, the meshes live in a company-scoped
 * Firebase Storage tree organised by BIM category:
 *
 *   bim-mesh-library/<category>/<assetId>.glb
 *
 * In-flight de-duplication so concurrent placements of the same asset share one
 * network round-trip. If hosting ever changes (CDN, bundle, signed URLs), THIS is
 * the only file that changes — the cache + converter stay untouched (full SSOT).
 *
 * Generalises `furniture-gltf-library.ts` (ADR-410), which now delegates here.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-411-bim-mesh-library.md
 */

import { ref, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';

/** Root Storage folder for the entity-agnostic CC0 mesh library. */
export const BIM_MESH_LIBRARY_ROOT = 'bim-mesh-library';

/** Storage object path for a given category + asset id. */
export function meshAssetStoragePath(category: string, assetId: string): string {
  return `${BIM_MESH_LIBRARY_ROOT}/${category}/${assetId}.glb`;
}

/** Storage object path for a category + asset preview thumbnail. */
export function meshThumbnailStoragePath(category: string, assetId: string): string {
  return `${BIM_MESH_LIBRARY_ROOT}/${category}/thumbnails/${assetId}.png`;
}

/** Cache key for a category + asset (globally unique across categories). */
export function meshAssetKey(category: string, assetId: string): string {
  return `${category}/${assetId}`;
}

/** In-flight URL resolutions, keyed by `category/assetId` (de-dup concurrent). */
const inFlight = new Map<string, Promise<string>>();

/**
 * Resolve the download URL for an asset's `.glb`. De-duplicated: a second call
 * for the same asset while the first is pending returns the same Promise.
 * Rejections clear the cache entry so a retry can re-attempt.
 */
export function resolveMeshUrl(category: string, assetId: string): Promise<string> {
  const key = meshAssetKey(category, assetId);
  const existing = inFlight.get(key);
  if (existing) return existing;

  const promise = getDownloadURL(ref(storage, meshAssetStoragePath(category, assetId)))
    .catch((err) => {
      inFlight.delete(key);
      throw err;
    });
  inFlight.set(key, promise);
  return promise;
}
