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
import { buildImportedMeshPath } from '@/services/upload/utils/storage-path';

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

/**
 * ADR-683 Φ3 — Storage path για εισαγόμενο `.glb` (project-scoped, ΟΧΙ βιβλιοθήκη).
 *
 * Το `bim-mesh-library/` είναι curated κατάλογος με write μόνο από super-admin· τα εισαγόμενα
 * ανεβαίνουν από τον χρήστη και ανήκουν σε **ένα** έργο. Ξεχωριστό δέντρο, ξεχωριστά rules
 * (βλ. `storage.rules` → `@pathId: imported_meshes`). ΕΝΑ σημείο που χτίζει αυτό το path.
 */
export function importedMeshStoragePath(
  companyId: string,
  projectId: string,
  uploadId: string,
): string {
  return buildImportedMeshPath({ companyId, projectId, uploadId });
}

/**
 * ADR-683 Φ3 — μητρώο **προ-δηλωμένων** Storage paths, keyed by `category/assetId`.
 *
 * Η curated βιβλιοθήκη (`bim-mesh-library/…`) έχει προβλέψιμο path από `category` + `assetId`. Τα
 * **εισαγόμενα** πλέγματα όχι: ζουν σε project-scoped path (`projects/<projectId>/imported-meshes/
 * <uploadId>.glb`), και ο resolver δεν ξέρει — ούτε πρέπει να ξέρει — το project layout.
 *
 * Αντί να μολυνθεί η υπογραφή του cache με projectId, η οντότητα **δηλώνει** το path της στο
 * hydrate. Ο resolver το προτιμά όταν υπάρχει, αλλιώς χτίζει το κλασικό library path. Έτσι η
 * υπόσχεση του αρχείου («αν αλλάξει το hosting, ΜΟΝΟ αυτό το αρχείο αλλάζει») μένει αληθινή.
 */
const registeredPaths = new Map<string, string>();

/**
 * Δηλώνει το Storage path ενός asset που δεν ακολουθεί τη σύμβαση της βιβλιοθήκης.
 * Idempotent — η επανα-δήλωση ίδιου path είναι no-op· αλλαγή path καθαρίζει το in-flight cache
 * ώστε το επόμενο resolve να ξαναχτυπήσει το σωστό αρχείο.
 */
export function registerMeshAssetPath(category: string, assetId: string, storagePath: string): void {
  const key = meshAssetKey(category, assetId);
  if (registeredPaths.get(key) === storagePath) return;
  registeredPaths.set(key, storagePath);
  inFlight.delete(key);
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

  // ADR-683 Φ3 — προ-δηλωμένο (project-scoped) path προηγείται· αλλιώς η σύμβαση βιβλιοθήκης.
  const path = registeredPaths.get(key) ?? meshAssetStoragePath(category, assetId);
  const promise = getDownloadURL(ref(storage, path))
    .catch((err) => {
      inFlight.delete(key);
      throw err;
    });
  inFlight.set(key, promise);
  return promise;
}
