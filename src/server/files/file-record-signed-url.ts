/**
 * @fileoverview **Υπογεγραμμένος σύνδεσμος από έγγραφο αρχείου** — το κοινό βήμα των ουρών ελέγχου (ADR-900 §3.8 · ADR-923 §5.13).
 * @module server/files/file-record-signed-url
 *
 * Το ίχνος `document_accessed` μένει στον καλούντα: μόνο εκείνος ξέρει σε ποιο βιβλίο ανήκει το άνοιγμα.
 */

import 'server-only';

import type { DocumentSnapshot } from 'firebase-admin/firestore';

import { signedDownloadUrl } from '@/lib/storage/signed-download-url';
import { fileRecordBucket } from '@/server/files/file-record-bucket';

export type FileRecordSignedUrl = { readonly url: string } | { readonly error: 'NOT_FOUND' | 'UNAVAILABLE' };

export async function signedUrlOfFileRecord(fileSnap: DocumentSnapshot): Promise<FileRecordSignedUrl> {
  const storagePath = fileSnap.get('storagePath');
  if (!fileSnap.exists || typeof storagePath !== 'string') return { error: 'NOT_FOUND' };
  const signed = await signedDownloadUrl({
    bucket: fileRecordBucket({ storagePlacement: fileSnap.get('storagePlacement') }),
    storagePath,
  });
  return signed.outcome === 'signed' ? { url: signed.url } : { error: 'UNAVAILABLE' };
}
