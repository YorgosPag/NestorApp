import 'server-only';

/**
 * @fileoverview **Η ΕΓΓΡΑΦΗ ΑΡΧΕΙΟΥ ΠΟΥ ΓΕΝΝΙΕΤΑΙ ΚΑΤΕΥΘΕΙΑΝ `ready`** — τα bytes έχουν ήδη αποδειχτεί στον κάδο.
 * @related services/file-record/file-record-core.ts (ο ΕΝΑΣ builder: `buildPendingFileRecordData` + `buildFinalizeFileRecordUpdate`)
 * @module services/file-record/ready-file-record.server
 *
 * 🔑 **Ένας τρόπος να ειπωθεί «έτοιμο από τη γέννηση»** — ποτέ δύο διατυπώσεις σε δύο γραφείς. Τον μοιράζονται τα αντίγραφα
 * της παράδοσης (ADR-916 Φ-Γ1), τα αντίτυπα του Πρωτοκόλλου (Φ-Γ2 Σ4) και το περιεχόμενο μέσων καταλόγου που κατέβασε ο
 * διακομιστής (ADR-934 §5.2.2 Μ-β3). Ζούσε στον γραφέα της παράδοσης· μεταφέρθηκε εδώ όταν απέκτησε τρίτο καταναλωτή εκτός
 * του τομέα της, με ίδια συμπεριφορά.
 * 🔴 **Server-only, εκτός barrel**: γράφει `FieldValue.serverTimestamp()` (Admin SDK) — το `services/file-record/index.ts`
 * μένει καθαρό για τον πελάτη.
 */

import { FILE_STATUS } from '@/config/domain-constants';
import type { FileStoragePlacement } from '@/lib/files/file-storage-placement';
import { FieldValue } from '@/lib/firebaseAdmin';
import { buildProxyUrl } from '@/lib/storage/storage-object-url';

import { buildFinalizeFileRecordUpdate, type buildPendingFileRecordData } from './file-record-core';

/** Ό,τι μετρήθηκε στον κάδο: μέγεθος · θέση · αποτύπωμα (αν υπάρχει). */
export interface ReadyFileFacts {
  readonly sizeBytes: number;
  readonly placement: FileStoragePlacement;
  readonly hash: string | undefined;
}

/** **Τα δεδομένα της εγγραφής**, `ready` από τη γέννηση — για `tx.create` (ποτέ `set`, που θα σκέπαζε υπάρχουσα). */
export function readyFileRecordData(built: ReturnType<typeof buildPendingFileRecordData>, ready: ReadyFileFacts): Record<string, unknown> {
  return {
    ...built.recordBase,
    ...buildFinalizeFileRecordUpdate({
      sizeBytes: ready.sizeBytes, downloadUrl: buildProxyUrl(built.storagePath, ready.placement), hash: ready.hash, nextStatus: FILE_STATUS.READY,
    }),
    createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  };
}
