/**
 * @fileoverview **ΤΟ ΕΝΤΥΠΟ ΤΗΣ ΒΕΒΑΙΩΣΗΣ, ΑΠΟ ΤΗ ΒΑΣΗ** — μία ανάγνωση, ένας κριτής, δύο γραφείς.
 * @related ADR-864 §18.4 Δ1 · lib/mandate/attestation-document-verdict.ts
 * @module services/mandate/attestation-document
 *
 * 🔑 Καλείται από **τη συναίνεση κλειστής διάθεσης** (έντυπο) **και** από **τη βεβαίωση εντολής**
 * (brokered) — ίδια ερώτηση, ίδιο κενό μέχρι σήμερα (§18.2), άρα **ένας** κριτής.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import {
  judgeAttestationDocument,
  type AttestationDocumentVerdict,
} from '@/lib/mandate/attestation-document-verdict';

export async function attestationDocumentOf(
  adminDb: AdminFirestore,
  input: { readonly fileId: string | null; readonly companyId: string | null; readonly ownerPropertyId: string },
): Promise<AttestationDocumentVerdict> {
  const fileId = input.fileId?.trim() ?? '';
  if (fileId === '') return { kind: 'refused', reason: 'consent-document-missing' };

  const snapshot = await adminDb.collection(COLLECTIONS.FILES).doc(fileId).get();
  return judgeAttestationDocument(snapshot.exists ? (snapshot.data() ?? null) : null, {
    companyId: input.companyId ?? '',
    ownerPropertyId: input.ownerPropertyId,
  });
}
