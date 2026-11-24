import 'server-only';

/**
 * @fileoverview **Τα bytes του λογοτύπου εταιρείας στον server** — καρφωμένη γενιά + έλεγχος sha256 (ADR-ACC-018 §17.3).
 * @module server/company/brand-logo-image.server
 * @related lib/company/brand-logo-image (ο τύπος + ο έλεγχος, κοινά με τον browser) ·
 *   lib/storage/storage-object-stream (`readStorageObjectGeneration`) · server/files/file-record-bucket (ο ΕΝΑΣ επιλογέας κάδου)
 *
 * 🔑 **Ακριβώς αυτά τα bytes ή τίποτα**: η ανάγνωση καρφώνεται στη γενιά GCS της αναφοράς και τα bytes ελέγχονται με
 *    το sha256 της. Επανεκτύπωση εκδομένου παραστατικού δίνει ό,τι πήρε ο πελάτης — ή κεφαλίδα χωρίς λογότυπο.
 * 🔑 **Μόνο ο χώρος του παραστατικού**: η αναφορά πρέπει να ζει κάτω από `companies/{companyId}/…` του ίδιου χώρου
 *    (`storagePathCustody`, ο ΕΝΑΣ κριτής). Μια αναφορά που δείχνει αλλού ⇒ `null` — ο server δεν διαβάζει ποτέ ξένα
 *    bytes επειδή τα όρισε ένα πεδίο εγγράφου.
 * 📦 Ο κάδος: ο γραφέας (`brand-logo-store.server`) ανεβάζει με `uploadPublicFile` χωρίς ρητό κάδο ⇒ θέση
 *    `legacy-default`. Η αναφορά δεν κρατά θέση· αν ο γραφέας αλλάξει κάδο, η αναφορά πρέπει να αποκτήσει θέση.
 * 🔑 Κάθε αποτυχία ⇒ `null` + προειδοποίηση, ποτέ αποτυχία του PDF.
 */

import { pdfBrandImageOf, type PdfBrandImage } from '@/lib/company/brand-logo-image';
import { FILE_STORAGE_PLACEMENT_LEGACY } from '@/lib/files/file-storage-placement';
import { readStorageObjectGeneration } from '@/lib/storage/storage-object-stream';
import { storagePathCustody } from '@/lib/storage/storage-path-custody';
import { createModuleLogger } from '@/lib/telemetry';
import { fileStorageBucket } from '@/server/files/file-record-bucket';
import type { BrandLogoRef } from '@/types/company-brand';

const logger = createModuleLogger('BrandLogoImage');

/** Το λογότυπο της αναφοράς, έτοιμο για το PDF του χώρου `companyId` — ή `null`. */
export async function readPdfBrandImage(ref: BrandLogoRef | null, companyId: string): Promise<PdfBrandImage | null> {
  if (ref === null) return null;
  const custody = storagePathCustody(ref.storagePath);
  if (custody.kind !== 'company' || custody.companyId !== companyId) {
    logger.warn('Brand logo ref outside the document company', { companyId, custody: custody.kind });
    return null;
  }
  try {
    const bytes = await readStorageObjectGeneration(ref.storagePath, ref.generation, {
      bucket: fileStorageBucket(FILE_STORAGE_PLACEMENT_LEGACY),
    });
    if (bytes === null) {
      logger.warn('Brand logo generation absent', { companyId, storagePath: ref.storagePath });
      return null;
    }
    const image = await pdfBrandImageOf(ref, new Uint8Array(bytes));
    if (image === null) logger.warn('Brand logo sha256 mismatch', { companyId, storagePath: ref.storagePath });
    return image;
  } catch (error) {
    logger.warn('Brand logo read failed', { companyId, error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}
