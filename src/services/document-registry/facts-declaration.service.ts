/**
 * @fileoverview ADR-915 §33 — **η πράξη** «Συμπλήρωση στοιχείων»: ο άνθρωπος δηλώνει από το μητρώο λήξεων έκδοση ·
 *   τυπωμένη λήξη · κατηγορία ενός αρχείου που υπόσχεται παρακολουθούμενο είδος (ΥΔΕ · σαρωμένη φορολογική).
 * @related lib/document-validity/facts-declaration.ts (ο κριτής) · server/files/document-facts-writer.ts (ο ΕΝΑΣ γραφέας) ·
 *   app/api/document-registry/document-facts/route.ts (το σύνορο)
 * @module services/document-registry/facts-declaration.service
 *
 * 🔑 **Το αρχείο διαβάζεται με την ταυτότητά του**, όχι μέσα από την όψη: εταιρεία από το `ctx` (ξένο ≡ ανύπαρκτο, 404) ·
 *    ζωντανό · και το είδος **υπόσχεται ή φιλοξενεί** η θέση του (`documentKindsOfFile`) — αλλιώς μια ΥΔΕ θα δηλωνόταν
 *    «φορολογική» και θα εμφανιζόταν με λάθος κανόνα.
 * 🔑 **ΜΟΝΟ ο ΕΝΑΣ γραφέας** (`recordDocumentFacts`): η ιεραρχία (ανάγνωση εγγράφου · έγκριση ελεγκτή > δήλωση μητρώου)
 *    και το CAS (`expectedStoragePath`) κρίνονται **μέσα** στη συναλλαγή του — καμία προ-ανάγνωση εδώ που θα έτρεχε αγώνα.
 * 🔑 Η υπόδειξη κατηγορίας από τον τύπο ακινήτου **δεν** διαβάζεται εδώ: ό,τι γράφεται είναι ό,τι δήλωσε ο άνθρωπος.
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { documentKindsOfFile } from '@/lib/conveyance/document-kind-of-file';
import type { RecordDocumentFactsOutcome } from '@/lib/document-validity/document-facts';
import {
  judgeFactsDeclaration,
  type FactsDeclarationBody,
  type FactsDeclarationServiceRefusal,
} from '@/lib/document-validity/facts-declaration';
import { isLiveFileRecord } from '@/lib/files/container-file-verdict';
import { recordDocumentFacts } from '@/server/files/document-facts-writer';

export interface FactsDeclarationActor {
  readonly companyId: string;
  readonly uid: string;
}

export type FactsDeclarationResult =
  | { readonly ok: true; readonly outcome: 'changed' | 'unchanged' }
  | { readonly ok: false; readonly refusal: FactsDeclarationServiceRefusal };

/** Η έκβαση του γραφέα → αποτέλεσμα της πράξης, κάθε τιμή ρητά. */
const WRITER_RESULT: Readonly<Record<RecordDocumentFactsOutcome, FactsDeclarationResult>> = {
  write: { ok: true, outcome: 'changed' },
  'already-recorded': { ok: true, outcome: 'unchanged' },
  outranked: { ok: false, refusal: 'outranked' },
  'no-file': { ok: false, refusal: 'absent' },
  'not-this-object': { ok: false, refusal: 'not-this-object' },
};

/** Το αρχείο ως το βλέπει το γραφείο — `null` όταν είναι ξένο, ανύπαρκτο ή όχι ζωντανό (ίδια απάντηση και για τα τρία). */
async function readOwnLiveFile(db: Firestore, companyId: string, fileId: string): Promise<Readonly<Record<string, unknown>> | null> {
  const snapshot = await db.collection(COLLECTIONS.FILES).doc(fileId).get();
  const data = snapshot.exists ? snapshot.data() : undefined;
  if (data === undefined || data[FIELDS.COMPANY_ID] !== companyId || !isLiveFileRecord(data)) return null;
  return data;
}

export async function declareDocumentFacts(
  db: Firestore,
  actor: FactsDeclarationActor,
  body: FactsDeclarationBody,
): Promise<FactsDeclarationResult> {
  const file = await readOwnLiveFile(db, actor.companyId, body.fileId);
  if (file === null) return { ok: false, refusal: 'absent' };
  if (!documentKindsOfFile(file).includes(body.kind)) return { ok: false, refusal: 'kind-not-promised' };
  const judgement = judgeFactsDeclaration(body);
  if (!judgement.ok) return judgement;
  const outcome = await recordDocumentFacts(db, {
    fileCollection: COLLECTIONS.FILES,
    fileId: body.fileId,
    claim: {
      kind: body.kind,
      ...judgement.facts,
      source: { kind: 'attested', via: 'registry-declaration' },
      recordedBy: actor.uid,
    },
    expectedStoragePath: body.storagePath,
  });
  return WRITER_RESULT[outcome];
}
