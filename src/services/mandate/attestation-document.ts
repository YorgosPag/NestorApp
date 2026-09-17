/**
 * @fileoverview **ΤΟ ΕΝΤΥΠΟ ΤΗΣ ΒΕΒΑΙΩΣΗΣ, ΑΠΟ ΤΗ ΒΑΣΗ** — μία ανάγνωση, ένας κριτής, ένα πάγωμα, δύο γραφείς.
 * @related ADR-864 §18.4 Δ1 · §19 (Α31-Α32) · lib/mandate/attestation-document-verdict.ts ·
 *   services/mandate/attestation-evidence.ts
 * @module services/mandate/attestation-document
 *
 * 🔑 Καλείται από **τη συναίνεση κλειστής διάθεσης** (έντυπο) **και** από **τη βεβαίωση εντολής**
 * (brokered) — ίδια ερώτηση, ίδιο κενό μέχρι σήμερα (§18.2), άρα **ένας** κριτής **και ένα** πάγωμα (Α32):
 * γραφέας που θα έγραφε μόνο `documentPath` θα άφηνε ξανά την απόδειξη στο έλεος του γραφείου.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import {
  judgeAttestationDocument,
  type AttestationDocumentVerdict,
} from '@/lib/mandate/attestation-document-verdict';
import { freezeAttestationEvidence, type EvidenceBucket } from '@/services/mandate/attestation-evidence';
import type { AttestationEvidence } from '@/types/owner-property-mandate';

interface AttestationDocumentInput {
  readonly fileId: string | null;
  readonly companyId: string | null;
  readonly ownerPropertyId: string;
}

async function attestationDocumentOf(adminDb: AdminFirestore, input: AttestationDocumentInput): Promise<AttestationDocumentVerdict> {
  const fileId = input.fileId?.trim() ?? '';
  if (fileId === '') return { kind: 'refused', reason: 'consent-document-missing' };

  const snapshot = await adminDb.collection(COLLECTIONS.FILES).doc(fileId).get();
  return judgeAttestationDocument(snapshot.exists ? (snapshot.data() ?? null) : null, {
    companyId: input.companyId ?? '',
    ownerPropertyId: input.ownerPropertyId,
  });
}

export type AttestedDocument =
  | { readonly kind: 'frozen'; readonly storagePath: string; readonly evidence: AttestationEvidence }
  | Extract<AttestationDocumentVerdict, { kind: 'refused' }>
  /** Το αρχείο κρίθηκε έγκυρο αλλά **εμείς** δεν το παγώσαμε — ποτέ βεβαίωση χωρίς αποδεικτικό. */
  | { readonly kind: 'failed' };

/**
 * **Κρίνε και πάγωσε.** Το αντίγραφο βγαίνει **χωρίς** hold: ο καλών οφείλει να καλέσει
 * `settleAttestationEvidence(evidence, committed)` μετά την εγγραφή — σφράγιση ή απόρριψη.
 */
export async function attestedDocumentOf(
  adminDb: AdminFirestore,
  input: AttestationDocumentInput,
  bucket?: EvidenceBucket,
): Promise<AttestedDocument> {
  const verdict = await attestationDocumentOf(adminDb, input);
  if (verdict.kind === 'refused') return verdict;

  const frozen = await freezeAttestationEvidence(verdict, input.ownerPropertyId, bucket);
  switch (frozen.kind) {
    case 'frozen':
      return { kind: 'frozen', storagePath: verdict.storagePath, evidence: frozen.evidence };
    case 'too-large':
      return { kind: 'refused', reason: 'consent-document-invalid' };
    case 'failed':
      return { kind: 'failed' };
  }
}
