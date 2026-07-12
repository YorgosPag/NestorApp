'use client';

/**
 * ADR-643 Φ4 (delete) — user hatch image removal (thin orchestrator, FULL SSoT reuse).
 *
 * Mirror του `hatch-image-upload.service.ts`, αντίστροφη φορά: αφαιρεί ένα
 * user-uploaded fill image από την κοινή material library. Επειδή το upload το
 * έγραψε ως `bim_materials` doc (`bmat_*`) + Storage thumbnail, το delete καθαρίζει
 * **και τα δύο**:
 *   1. Firestore doc → `MaterialLibraryService.deleteMaterial` (throws σε builtin /
 *      not-found — ο guard της βιβλιοθήκης· τα builtin CC0 υλικά δεν σβήνονται).
 *   2. Storage thumbnail → `deleteMaterialThumbnailByUrl` (best-effort· ένα orphan
 *      blob δεν μπλοκάρει ποτέ το UX — το doc είναι το SSoT ύπαρξης).
 *
 * Η αφαίρεση από το picker γίνεται αυτόματα: το `bim_materials` live snapshot
 * (`useMaterialLibrary`) ξανα-τρέχει και το always-on `UserMaterialRegistryHost`
 * κάνει replace τον 2D image store — μηδέν χειροκίνητο unregister.
 *
 * Zero νέο service / collection / storage helper: reuse `deleteMaterial` +
 * `deleteMaterialThumbnailByUrl`.
 *
 * @see ./hatch-image-upload.service.ts — η αντίστροφη (upload) φορά
 * @see ./MaterialLibraryService.ts — deleteMaterial (Firestore doc, builtin guard)
 * @see ./bim-material-thumbnail-upload.service.ts — deleteMaterialThumbnailByUrl (Storage)
 * @see docs/centralized-systems/reference/adrs/ADR-643-hatch-image-fill.md §4 Φ4
 */

import { createModuleLogger } from '@/lib/telemetry';
import { createMaterialLibraryService } from './MaterialLibraryService';
import { deleteMaterialThumbnailByUrl } from './bim-material-thumbnail-upload.service';

const logger = createModuleLogger('HatchImageDelete');

export interface HatchImageDeleteInput {
  /** `bmat_*` id (= το `HatchImageFill.assetId`) του user-uploaded υλικού. */
  readonly assetId: string;
  readonly companyId: string;
  readonly userId: string;
  readonly projectId?: string;
  /** Το `thumbnailUrl` του doc (για το Storage cleanup)· absent → μόνο doc delete. */
  readonly thumbnailUrl?: string;
}

/**
 * Αφαιρεί ένα user-uploaded image material: πρώτα το Firestore doc (αν αποτύχει, το
 * error διαδίδεται — τίποτα δεν σβήστηκε), μετά best-effort το Storage thumbnail.
 * Throws το error του `deleteMaterial` (builtin/not-found/permission) ώστε το UI να
 * το δείξει· το Storage σφάλμα καταγράφεται μόνο (δεν μπλοκάρει).
 */
export async function deleteHatchImageMaterial(input: HatchImageDeleteInput): Promise<void> {
  const { assetId, companyId, userId, projectId, thumbnailUrl } = input;
  const service = createMaterialLibraryService({ companyId, userId, projectId });

  await service.deleteMaterial(assetId); // SSoT existence — throws before any storage op

  if (thumbnailUrl) {
    try {
      await deleteMaterialThumbnailByUrl(thumbnailUrl);
    } catch (err) {
      // Best-effort: το doc έφυγε (η εικόνα εξαφανίστηκε από το UI)· ένα orphan blob
      // δεν αξίζει να αποτύχει το delete. Καταγραφή για μελλοντικό storage-gc.
      logger.warn('Thumbnail storage cleanup failed (orphan blob left)', {
        assetId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
