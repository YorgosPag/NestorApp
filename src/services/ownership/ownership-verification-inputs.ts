/**
 * @module services/ownership/ownership-verification-inputs
 * @description Οι **είσοδοι** της επαλήθευσης κατοχής (ADR-900 §3.8): τα bytes του ΠΚΑ και η περίληψη της σφραγίδας.
 *
 * Χωριστά από τον γραφέα (`ownership-verification.service.ts`, N.7.1): εδώ ζει ό,τι **διαβάζει**,
 * εκεί ό,τι **κρίνει και γράφει**.
 */

import 'server-only';

import { createHash } from 'crypto';

import { isExpectedSigner } from '@/config/trust/pdf-seal-trust';
import type { PkaFileRef } from '@/lib/ownership/pka-file-verdict';
import { fileRecordBucket } from '@/server/files/file-record-bucket';
import type { PdfSealVerdict } from '@/server/pdf-seal/pdf-seal.types';
import type { OwnershipSealSummary } from '@/types/ownership-verification';

/**
 * Ανώτατο μέγεθος ΠΚΑ. Το πιστοποιητικό είναι λίγες σελίδες κειμένου (δεκάδες–εκατοντάδες KB)· 10 MB
 * αφήνει περιθώριο για ενσωματωμένο διάγραμμα, ενώ κόβει την κατάχρηση (PDF-βόμβα στον αναλυτή).
 */
export const PKA_MAX_BYTES = 10 * 1024 * 1024;

/** Θύρα ανάγνωσης bytes — ο κάδος της θέσης του αρχείου στην παραγωγή, διπλό στα tests. */
export type PkaBytesReader = (file: PkaFileRef) => Promise<{ readonly size: number; readonly read: () => Promise<Buffer> }>;

const storageReader: PkaBytesReader = async (file) => {
  const object = fileRecordBucket({ storagePlacement: file.storagePlacement }).file(file.storagePath);
  const [metadata] = await object.getMetadata();
  return {
    size: Number(metadata.size ?? Number.POSITIVE_INFINITY),
    read: async () => (await object.download())[0],
  };
};

export type PkaDownload =
  | { readonly kind: 'read'; readonly bytes: Buffer; readonly digest: string }
  | { readonly kind: 'too-large' };

/** Τα bytes + το αποτύπωμά τους (`sha256:…`) — το μέγεθος κρίνεται **πριν** κατέβει οτιδήποτε. */
export async function downloadPka(file: PkaFileRef, reader: PkaBytesReader = storageReader): Promise<PkaDownload> {
  const handle = await reader(file);
  if (!(handle.size <= PKA_MAX_BYTES)) return { kind: 'too-large' };
  const bytes = await handle.read();
  if (bytes.byteLength > PKA_MAX_BYTES) return { kind: 'too-large' };
  return { kind: 'read', bytes, digest: `sha256:${createHash('sha256').update(bytes).digest('hex')}` };
}

/**
 * Η σφραγίδα όπως την κρατά η επαλήθευση. **Επιβεβαιωμένος εκδότης** = αλυσίδα σε ρίζα του μητρώου **ΚΑΙ**
 * υπογράφων = ο αναμενόμενος φορέας (`config/trust/pdf-seal-trust.ts`). Κενό μητρώο ⇒ ποτέ.
 */
export function sealSummaryOf(verdict: PdfSealVerdict): OwnershipSealSummary {
  if (verdict.kind === 'invalid') {
    return { kind: 'invalid', reason: verdict.reason, signer: null, signedAt: null, issuerConfirmed: false };
  }
  const { signer } = verdict;
  return {
    kind: 'valid',
    reason: null,
    signer: signer.organizationIdentifier ?? signer.organization ?? signer.commonName,
    signedAt: verdict.signedAt,
    issuerConfirmed: verdict.chainTrusted && isExpectedSigner('ktimatologio-pka', signer.organizationIdentifier),
  };
}
