'use client';

/**
 * ADR-736 Φ3 — **ΕΝΑ** σημείο καλωδίωσης του resolver εξωτερικών αναφορών με τα πραγματικά
 * SSoT της εφαρμογής. Ίδιο μοτίβο με το `mesh3d-material-import/foreign-texture-deps.ts`
 * (ADR-691): ο resolver είναι σκόπιμα **καθαρός** (μηδέν Firebase, μηδέν React) και ζητά τα
 * πάντα injected· η καλωδίωση ζει εδώ, μία φορά, ώστε ο δεύτερος καλών (wizard **και**
 * modal εισαγωγής) να μη γράψει structural clone (N.18).
 *
 * **Τι δανείζεται και από πού — κανένα δίδυμο:**
 * | Ερώτηση | SSoT |
 * |---|---|
 * | διαστάσεις σε pixels | `io/shared/foreign-asset-pixel-size` |
 * | ταυτότητα περιεχομένου | `io/shared/foreign-asset-content-hash` (ίδιο με ADR-678) |
 * | ταυτότητα asset | `generateDeterministicFileId` (N.6 — **ποτέ** `addDoc`/τυχαίο id) |
 * | Storage path | `buildDxfExternalReferencePath` (company-scoped builder) |
 * | επικύρωση + ανέβασμα | `validateImageAssetFile` / `uploadImageAsset` (ADR-651 Φ Ε) |
 *
 * @see ./dxf-external-reference-resolver.ts — ο καταναλωτής του συμβολαίου
 */

import {
  validateImageAssetFile,
  uploadImageAsset,
  findImageAssetUrl,
} from '@/services/upload/image-asset-upload';
import { buildDxfExternalReferencePath } from '@/services/upload/utils/storage-path-bim';
import { generateDeterministicFileId } from '@/services/enterprise-id.service';
import { sha256HexOfFile } from './shared/foreign-asset-content-hash';
import { foreignAssetPixelSize } from './shared/foreign-asset-pixel-size';
import type { ResolveExternalReferencesDeps } from './dxf-external-reference-resolver';

/**
 * Ανώτατο μέγεθος ενός συνημμένου, σε bytes. **Πρέπει να συμφωνεί με τους `storage.rules`**
 * (`dxf_external_references` → `size < 25 MB`): ο client κόβει πρώτος ώστε ο χρήστης να πάρει
 * κατανοητό μήνυμα αντί για ένα αδιάγνωστο `storage/unauthorized` μετά από 25 MB ανεβάσματος.
 * Γενναιόδωρο σε σχέση με τα thumbnails υλικών (5 MB) γιατί μια σάρωση τοπογραφικού
 * διαγράμματος σε 600 dpi είναι πραγματικά τόσο μεγάλη.
 */
export const MAX_DXF_EXTERNAL_REFERENCE_BYTES = 25 * 1024 * 1024;

/**
 * Το πλήρες συμβόλαιο του resolver, καλωδιωμένο.
 *
 * Το `uploadByContent` είναι **idempotent by construction**: το path παράγεται από το
 * `contentHash`, οπότε ίδια bytes ⇒ ίδιο αντικείμενο. Ο έλεγχος «υπάρχει ήδη;» προηγείται —
 * χωρίς αυτόν το dedup θα ήταν μόνο λογικό (ένα αντικείμενο) και όχι πραγματικό (μηδέν
 * ξανα-ανέβασμα), και το ίδιο διάταγμα θα ταξίδευε ξανά σε κάθε έργο του γραφείου.
 */
export function buildDxfExternalReferenceDeps(companyId: string): ResolveExternalReferencesDeps {
  return {
    pixelSizeOf: foreignAssetPixelSize,
    hashFile: sha256HexOfFile,
    uploadByContent: async (file, contentHash) => {
      // Πετά `ImageAssetUploadError` με code 'format'/'size' — ο resolver τα μεταφράζει σε
      // ονομαστική αποτυχία **αυτής** της αναφοράς, χωρίς να ρίξει τις υπόλοιπες.
      const ext = validateImageAssetFile(file, MAX_DXF_EXTERNAL_REFERENCE_BYTES);
      const storagePath = buildDxfExternalReferencePath({
        companyId,
        fileId: generateDeterministicFileId(contentHash),
        ext,
      });
      return (await findImageAssetUrl(storagePath)) ?? uploadImageAsset({ file, storagePath, ext });
    },
  };
}
