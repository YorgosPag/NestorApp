/**
 * @fileoverview **Η σύνδεση του ανεβασμένου αρχείου, με αντιστάθμιση** (ADR-923 §5.5.1). Το ανέβασμα προηγείται της σύνδεσης, άρα σύνδεση
 * που αποτυγχάνει αφήνει ζωντανό αρχείο χωρίς παρτίδα, και το `file-purge` σβήνει μόνο `PENDING/FAILED`: έτσι έμειναν 93,2 MB ορφανά.
 *
 * ⚠️ Πριν από τον κάδο ρωτάμε την παρτίδα: απάντηση που χάθηκε στο δίκτυο δεν σημαίνει ότι η σύνδεση δεν έγινε, και ο κάδος θα έσβηνε
 * το αρχείο μιας υγιούς παρτίδας. Ο άνθρωπος βλέπει πάντα την αρχική αιτία, ποτέ το σφάλμα της αντιστάθμισης.
 * @module components/catalog/imports/attach-import-file
 */

import { createModuleLogger } from '@/lib/telemetry';
import { attachImportFile, fetchImportBatch } from '@/services/catalog/catalog-import-api.client';
import { requestFileTrash } from '@/services/filesystem/file-trash.client';
import type { ImportBatchWire } from '@/subapps/catalog/types/catalog-import-requests';

const logger = createModuleLogger('catalog-import-attach');

async function releaseOrphan(batchId: string, fileId: string): Promise<boolean> {
  const { batch } = await fetchImportBatch(batchId);
  if (batch.fileId === fileId) return false;
  await requestFileTrash([fileId], 'trash');
  return true;
}

/** Η παρτίδα με το αρχείο της. Αν η σύνδεση έγινε ενώ χάθηκε η απάντηση, η ροή συνεχίζει κανονικά. */
export async function attachUploadedFile(batch: Pick<ImportBatchWire, 'id' | 'revision'>, fileId: string): Promise<ImportBatchWire> {
  try {
    return await attachImportFile(batch.id, batch.revision, fileId);
  } catch (cause) {
    const released = await releaseOrphan(batch.id, fileId).catch((error: unknown) => {
      logger.warn('Orphan import file was not released', { batchId: batch.id, fileId, error: String(error) });
      return true;
    });
    if (released) throw cause;
    return (await fetchImportBatch(batch.id)).batch;
  }
}
