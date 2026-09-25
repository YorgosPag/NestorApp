import 'server-only';

/**
 * =============================================================================
 * SHARE DOWNLOAD — παράδοση αρχείου από σύνδεσμο κοινοποίησης (ADR-884 Φ0.12)
 * =============================================================================
 *
 * 🔴 **Πριν**: η σελίδα διάβαζε το `downloadUrl` του `FileRecord` (μόνιμο URL με
 * διακριτικό Firebase, που **δεν λήγει ποτέ**) και το άνοιγε. Όποιος το αντέγραφε από τα
 * εργαλεία του browser κρατούσε **μόνιμη** πρόσβαση — πέρα από τη λήξη, το όριο και την
 * ανάκληση του συνδέσμου.
 *
 * **Τώρα**: κάθε παράδοση bytes είναι **V4 υπογεγραμμένο URL 15′**
 * (`lib/storage/signed-download-url.ts`) — `inline` για την προεπισκόπηση, `attachment`
 * με το όνομα του αρχείου για τη λήψη. Η ανάκληση του συνδέσμου κόβει κάθε παράδοση το
 * πολύ σε 15′.
 *
 * 🔑 **Πότε μετρά** (πρότυπο Google Drive: μετρά το **άνοιγμα**): η επίλυση καταγράφει
 * την πρόσβαση και εκδίδει κουπόνι επίσκεψης· προεπισκόπηση και λήψη **μέσα στην ίδια
 * επίσκεψη** δεν ξαναμετρούν. Λήψη **χωρίς** κουπόνι (π.χ. script που δεν άνοιξε ποτέ τη
 * σελίδα) μετρά — δεν υπάρχει διαδρομή που δίνει bytes χωρίς να ξοδεύει όριο.
 *
 * @module server/sharing/share-download
 */

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { signedDownloadUrl } from '@/lib/storage/signed-download-url';
import { createModuleLogger } from '@/lib/telemetry';
import type { ShareDownloadOutcome } from '@/services/sharing/share-resolve-contract';
import { recordShareAccess } from './share-access';
import { passShareGate, type ShareGateInput } from './share-gate';

const logger = createModuleLogger('ShareDownload');

/** `inline` = προεπισκόπηση στη σελίδα · `attachment` = λήψη με όνομα αρχείου. */
export type SharedFileDisposition = 'inline' | 'attachment';

/**
 * Υπογράφει URL για το αρχείο `fileId`, από τη διαδρομή **του εγγράφου** (ποτέ του
 * αιτήματος). `null` ⇒ το αρχείο λείπει ή δεν υπογράφεται.
 */
export async function signSharedFileUrl(
  adminDb: Firestore,
  fileId: string,
  disposition: SharedFileDisposition,
): Promise<string | null> {
  const snap = await adminDb.collection(COLLECTIONS.FILES).doc(fileId).get();
  const data = snap.data();
  const storagePath = typeof data?.storagePath === 'string' ? data.storagePath : '';
  if (!snap.exists || storagePath === '') return null;

  const fileName = typeof data?.originalFilename === 'string' ? data.originalFilename : undefined;
  const signed = await signedDownloadUrl({
    storagePath,
    ...(disposition === 'attachment' ? { downloadFileName: fileName } : {}),
  });
  if (signed.outcome === 'signed') return signed.url;
  logger.error('Shared file could not be signed', { fileId, why: signed.why });
  return null;
}

/** Λήψη αρχείου — ο κωδικός **δεν** γίνεται δεκτός εδώ· απαιτείται το κουπόνι της επίλυσης. */
export async function issueShareDownload(input: ShareGateInput): Promise<ShareDownloadOutcome> {
  const verdict = await passShareGate({ ...input, password: undefined });
  if (!verdict.pass) return { status: 'refused', reason: verdict.reason };

  const { share } = verdict;
  if (share.entityType !== 'file') return { status: 'refused', reason: 'not-found' };

  if (!input.hasGrant(share.id)) {
    const access = await recordShareAccess(input.adminDb, share);
    if (access !== 'recorded') {
      return { status: 'refused', reason: access === 'gone' ? 'not-found' : access };
    }
  }

  const url = await signSharedFileUrl(input.adminDb, share.entityId, 'attachment');
  return url === null ? { status: 'refused', reason: 'not-found' } : { status: 'signed', url };
}
