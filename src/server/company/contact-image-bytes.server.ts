import 'server-only';

/**
 * @fileoverview **Τα bytes της εικόνας μιας επαφής του χώρου** — για το «χρήση της εικόνας της επαφής ως λογότυπο»
 *   (ADR-951 §4).
 * @module server/company/contact-image-bytes.server
 *
 * Τρία ερωτήματα, τρεις υπάρχοντες απαντητές, αλυσοδεμένοι — κανένας δεύτερος κριτής:
 * 1. «σε ποιο αντικείμενο δείχνει το URL;» → `storageObjectFromUrl` (ADR-862 Φ0 Β8)·
 * 2. «σε ποιον χώρο ανήκει;» → `storagePathCustody` — **μόνο** ο ίδιος χώρος, αλλιώς τίποτα·
 * 3. «ποια bytes;» → `statStorageObject` + `readStorageObjectGeneration` (καρφωμένη γενιά: κανένας συναγωνισμός).
 * Ο κάδος από όσα δηλώνει το URL (`fileStoragePlacementOfBucket`), ποτέ μαντεψιά· ξένος κάδος ⇒ τίποτα.
 */

import { BRAND_LOGO_MAX_INPUT_BYTES } from '@/lib/company/brand-logo-policy';
import { FILE_STORAGE_PLACEMENT_LEGACY } from '@/lib/files/file-storage-placement';
import { storageObjectFromUrl } from '@/lib/storage/storage-object-url';
import { readStorageObjectGeneration, statStorageObject } from '@/lib/storage/storage-object-stream';
import { storagePathCustody } from '@/lib/storage/storage-path-custody';
import { createModuleLogger } from '@/lib/telemetry';
import { fileStorageBucket, fileStoragePlacementOfBucket } from '@/server/files/file-record-bucket';

const logger = createModuleLogger('ContactImageBytes');

/** Τα bytes, ή `null` με λόγο στο log — ο καλών δεν χρειάζεται να ξεχωρίσει (ίδια άρνηση προς τον άνθρωπο). */
export async function readContactImageBytes(imageUrl: string, companyId: string): Promise<Buffer | null> {
  const object = storageObjectFromUrl(imageUrl);
  if (object.outcome !== 'object') {
    logger.warn('Contact image URL unreadable', { companyId, why: object.why });
    return null;
  }
  const custody = storagePathCustody(object.storagePath);
  if (custody.kind !== 'company' || custody.companyId !== companyId) {
    logger.warn('Contact image outside the workspace', { companyId, custody: custody.kind });
    return null;
  }
  const placement = object.bucket === null ? FILE_STORAGE_PLACEMENT_LEGACY : fileStoragePlacementOfBucket(object.bucket);
  if (placement === null) {
    logger.warn('Contact image in a foreign bucket', { companyId });
    return null;
  }
  const bucket = fileStorageBucket(placement);
  const stat = await statStorageObject(object.storagePath, { bucket });
  if (stat.kind !== 'found') return null;
  if (stat.size !== null && stat.size > BRAND_LOGO_MAX_INPUT_BYTES) {
    logger.warn('Contact image larger than the logo input limit', { companyId, size: stat.size });
    return null;
  }
  return readStorageObjectGeneration(object.storagePath, stat.generation, { bucket });
}
