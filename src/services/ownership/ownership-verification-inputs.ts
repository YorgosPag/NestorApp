/**
 * @module services/ownership/ownership-verification-inputs
 * @description Οι **είσοδοι** της επαλήθευσης κατοχής (ADR-900 §3.8): τα bytes του ΠΚΑ και η περίληψη της σφραγίδας.
 *
 * Χωριστά από τον γραφέα (`ownership-verification.service.ts`, N.7.1): εδώ ζει ό,τι **διαβάζει**,
 * εκεί ό,τι **κρίνει και γράφει**.
 */

import 'server-only';

import { isExpectedSigner } from '@/config/trust/pdf-seal-trust';
import type { PkaFileRef } from '@/lib/ownership/pka-file-verdict';
import {
  downloadFileRecordBytes,
  type FileBytesDownload,
  type FileBytesReader,
} from '@/server/files/download-file-record-bytes';
import type { PdfSealVerdict } from '@/server/pdf-seal/pdf-seal.types';
import type { OwnershipSealSummary } from '@/types/ownership-verification';

/**
 * Ανώτατο μέγεθος ΠΚΑ. Το πιστοποιητικό είναι λίγες σελίδες κειμένου (δεκάδες–εκατοντάδες KB)· 10 MB
 * αφήνει περιθώριο για ενσωματωμένο διάγραμμα, ενώ κόβει την κατάχρηση (PDF-βόμβα στον αναλυτή).
 */
export const PKA_MAX_BYTES = 10 * 1024 * 1024;

/** Θύρα ανάγνωσης bytes — ο κοινός αναγνώστης του συστήματος αρχείων (`server/files/download-file-record-bytes`). */
export type PkaBytesReader = FileBytesReader;

export type PkaDownload = FileBytesDownload;

/** Τα bytes + το αποτύπωμά τους (`sha256:…`) — το μέγεθος κρίνεται **πριν** κατέβει οτιδήποτε. */
export function downloadPka(file: PkaFileRef, reader?: PkaBytesReader): Promise<PkaDownload> {
  return downloadFileRecordBytes(file, PKA_MAX_BYTES, reader);
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
