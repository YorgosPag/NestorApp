/**
 * @module server/files/download-file-record-bytes
 * @description **Τα bytes ενός αρχείου του συστήματος αρχείων, με όριο μεγέθους** — ο ΕΝΑΣ αναγνώστης για κάθε ροή
 * που αναλύει ανεβασμένο έγγραφο στον server (ΠΚΑ · ADR-900 §3.8, ΠΕΑ · ADR-777 §8.96).
 *
 * 🔑 **Το μέγεθος κρίνεται ΠΡΙΝ κατέβει οτιδήποτε** (μεταδεδομένα του κάδου), και ξανά πάνω στα bytes: ένα PDF-βόμβα
 * δεν φτάνει ποτέ στον αναλυτή.
 * 🔑 **Θύρα ανάγνωσης**: στην παραγωγή ο κάδος της θέσης του αρχείου (`fileRecordBucket`), στα tests διπλό.
 */

import 'server-only';

import { createHash } from 'crypto';

import { fileRecordBucket } from '@/server/files/file-record-bucket';

/** Ό,τι χρειάζεται για να βρεθεί το αντικείμενο στον κάδο — το δίνει ο κριτής του αρχείου. */
export interface FileRecordRef {
  readonly fileId: string;
  readonly storagePath: string;
  readonly storagePlacement: unknown;
}

/** Θύρα ανάγνωσης bytes — ο κάδος της θέσης του αρχείου στην παραγωγή, διπλό στα tests. */
export type FileBytesReader = (
  file: FileRecordRef,
) => Promise<{ readonly size: number; readonly read: () => Promise<Buffer> }>;

const storageReader: FileBytesReader = async (file) => {
  const object = fileRecordBucket({ storagePlacement: file.storagePlacement }).file(file.storagePath);
  const [metadata] = await object.getMetadata();
  return {
    size: Number(metadata.size ?? Number.POSITIVE_INFINITY),
    read: async () => (await object.download())[0],
  };
};

/**
 * Το ΕΝΑ όριο για έγγραφα-κείμενο (ΠΚΑ · ΠΕΑ · ενημερότητες — ADR-900 §3.8 · ADR-915 §20): μία-δύο σελίδες κειμένου
 * είναι λίγα KB· 10 MB κόβουν το PDF-βόμβα πριν φτάσει στον αναλυτή.
 */
export const DOCUMENT_TEXT_MAX_BYTES = 10 * 1024 * 1024;

/** Ο τύπος που δέχεται κάθε ανάγνωση κειμένου εγγράφου — το `pdf.js` δεν διαβάζει τίποτε άλλο. */
export const PDF_CONTENT_TYPE = 'application/pdf';

export type FileBytesDownload =
  | { readonly kind: 'read'; readonly bytes: Buffer; readonly digest: string }
  | { readonly kind: 'too-large' };

/** Τα bytes + το αποτύπωμά τους (`sha256:…`), ή `too-large` — άγνωστο μέγεθος μετρά ως υπερβολικό. */
export async function downloadFileRecordBytes(
  file: FileRecordRef,
  maxBytes: number,
  reader: FileBytesReader = storageReader,
): Promise<FileBytesDownload> {
  const handle = await reader(file);
  if (!(handle.size <= maxBytes)) return { kind: 'too-large' };
  const bytes = await handle.read();
  if (bytes.byteLength > maxBytes) return { kind: 'too-large' };
  return { kind: 'read', bytes, digest: `sha256:${createHash('sha256').update(bytes).digest('hex')}` };
}
