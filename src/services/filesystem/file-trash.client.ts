/**
 * @fileoverview **Ο ΠΕΛΑΤΗΣ ΤΟΥ ΚΑΔΟΥ ΤΩΝ ΕΤΑΙΡΙΚΩΝ ΑΡΧΕΙΩΝ** — ο καταναλωτής του `POST /api/files/trash`.
 * @related app/api/files/trash/route.ts · services/file-record/file-trash.service.ts
 * @module services/filesystem/file-trash.client
 *
 * 🔑 **Γιατί υπάρχει** (ADR-845 §7.17 Α2): ο κάδος γραφόταν από τον browser, και η δημόσια αγγελία
 * δεν το μάθαινε. Εδώ ο πελάτης **ζητά**· ο ΕΝΑΣ γραφέας του διακομιστή κρίνει, γράφει, καταγράφει
 * και ξαναπροβάλλει. Ίδιο σχήμα με το `container-transition.client` — και χωριστό module για τον
 * ίδιο λόγο: το `file-record-lifecycle` **δεν μπορεί** να εισάγει την πύλη (`file-mutation-gateway`
 * → `FileRecordService` → lifecycle = κύκλος).
 *
 * ⚠️ **Ένα αίτημα ανά δέσμη, όχι ανά αρχείο**: ο διακομιστής ξαναπροβάλλει **μία** φορά ανά ακίνητο.
 * Πάνω από το ταβάνι η δέσμη **τεμαχίζεται εδώ**, σειριακά — ποτέ 400 στον άνθρωπο που διάλεξε 51.
 */

import { API_ROUTES } from '@/config/domain-constants';
import { apiClient } from '@/lib/api/enterprise-api-client';
import {
  MAX_FILES_PER_BATCH_ACT,
  type FileTrashResponse,
} from '@/services/file-record/file-batch-act.types';
import type { FileTrashAction } from '@/services/file-record/file-trash.service';

/** Η δέσμη σε κομμάτια που χωρούν σε ένα αίτημα. */
function chunksOf(fileIds: readonly string[]): string[][] {
  const chunks: string[][] = [];
  for (let start = 0; start < fileIds.length; start += MAX_FILES_PER_BATCH_ACT) {
    chunks.push(fileIds.slice(start, start + MAX_FILES_PER_BATCH_ACT));
  }
  return chunks;
}

/**
 * **Ζήτα κάδο ή επαναφορά για μια δέσμη εταιρικών αρχείων.**
 *
 * @returns Τι **έγινε πραγματικά**: `files` = όσα άλλαξαν · `errors` = ονομασμένη άρνηση ανά αρχείο.
 * Ο καλών αποφασίζει τι θα δει ο άνθρωπος — εδώ καμία ρίψη για άρνηση, μόνο για βλάβη δικτύου.
 */
export async function requestFileTrash(
  fileIds: readonly string[],
  action: FileTrashAction,
): Promise<FileTrashResponse> {
  const merged = {
    processedCount: 0,
    errors: [] as string[],
    listings: [] as FileTrashResponse['listings'][number][],
    files: [] as FileTrashResponse['files'][number][],
  };

  for (const chunk of chunksOf(fileIds)) {
    const part = await apiClient.post<FileTrashResponse>(API_ROUTES.FILES.TRASH, { fileIds: chunk, action });
    merged.processedCount += part.processedCount;
    merged.errors.push(...part.errors);
    merged.listings.push(...part.listings);
    merged.files.push(...part.files);
  }

  return { success: true, ...merged };
}
