import 'server-only';

/**
 * Ο κάδος των **PDF εκδόσεων** (ADR-923 §5.6): σφραγισμένη ρίζα `catalog-publications/` (`storage.rules`: `if false`,
 * `storage-path-custody`: `server-only`). Δεν είναι `FileRecord`: το αποτέλεσμα ανήκει στην έκδοση (`catalog_publication_runs`).
 * Ζει στον κανονικό κάδο, ίδια απόφαση με κάθε άλλο παράγωγο του διακομιστή. Το orphan-cleanup κοιτά μόνο `companies/`.
 * @module server/catalog/publishing/publication-bucket.server
 */

import type { Bucket } from '@google-cloud/storage';

import { fileStorageBucket } from '@/server/files/file-record-bucket';
import { FILE_STORAGE_PLACEMENT_LEGACY } from '@/lib/files/file-storage-placement';

export function publicationBucket(): Bucket {
  return fileStorageBucket(FILE_STORAGE_PLACEMENT_LEGACY);
}
