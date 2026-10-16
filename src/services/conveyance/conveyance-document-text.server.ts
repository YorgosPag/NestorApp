/**
 * =============================================================================
 * «Ανάγνωση από το έγγραφο» στον διάλογο ελέγχου — το δίχτυ της ανάγνωσης στο ανέβασμα (ADR-915 §20)
 * =============================================================================
 *
 * Η ανάγνωση γίνεται **ήδη** αυτόματα στο ανέβασμα (CDC). Εδώ ο **άνθρωπος** τη ζητά για το αρχείο που ελέγχει — και
 * **βλέπει την έκβαση**: «διαβάστηκε» · «δεν αναγνωρίστηκε ως …» · «είναι άλλο έγγραφο». Αυτό δεν το δίνει κανένα
 * αυτόματο μονοπάτι, και είναι η απάντηση στο ερώτημα «γιατί το μητρώο λέει “άγνωστο”;».
 *
 * 🔑 **Το ΙΔΙΟ αρχείο με την αποδοχή**: ο client στέλνει το `fileId` που βλέπει (`row.files[0]`)· εδώ ξαναβρίσκεται το
 *   **νεότερο** αρχείο της γραμμής με τις ίδιες κρίσεις του καταλόγου (`rowFiles` — ADR-915 §22). Διαφορετικό ⇒ `stale` — ο
 *   άνθρωπος θα διάβαζε έγγραφο άλλο από αυτό που πάει να εγκρίνει (CAS, ίδιο ιδίωμα με το `expectedVersion`).
 * 🔑 Μόνο αρχεία **του χώρου** (`owned`): ό,τι στάλθηκε από επαγγελματία ζει στον δικό του χώρο (ADR-901 Φ4.4) και το
 *   μητρώο δεν το διαβάζει (ADR-915 §11.1 Ε1).
 *
 * @module services/conveyance/conveyance-document-text.server
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { resolveCaseRow, rowFiles } from '@/lib/conveyance/case-rows';
import { documentTextReadersFor } from '@/lib/document-validity/document-text-facts';
import type { CaseDocumentTextRefusal, CaseDocumentTextResult } from '@/lib/conveyance/case-document-text';
import { readDocumentTextFacts, type DocumentTextDeps } from '@/server/files/document-text-reading';
import type { ConveyanceCase } from '@/types/conveyance-case';
import { collectCaseEvidence, HOST_EVIDENCE_VIEWER } from './conveyance-case-evidence.server';

export type { CaseDocumentTextResult };

export interface CaseDocumentTextRequest {
  readonly record: ConveyanceCase;
  readonly itemId: string;
  /** Το αρχείο που **βλέπει** ο άνθρωπος — ο φραγμός CAS. */
  readonly fileId: string;
  readonly actorUid: string;
}

type RowFile = { readonly kind: 'file'; readonly fileId: string } | Extract<CaseDocumentTextResult, { readonly kind: 'refused' }>;

const refusedRow = (reason: CaseDocumentTextRefusal) => ({ kind: 'refused', reason }) as const;

/** Το νεότερο αρχείο της γραμμής, όπως το βλέπει ο οικοδεσπότης — ή γιατί όχι. */
async function newestRowFile(db: Firestore, request: CaseDocumentTextRequest): Promise<RowFile> {
  // ADR-915 §22 — η γραμμή λύνεται μέσα στην υπόθεση: γραμμή προσώπου ⇒ μόνο τα αρχεία **της επαφής του**.
  const row = resolveCaseRow(request.record, request.itemId);
  const item = row?.item;
  if (row === null || item?.documentKind === undefined || item.satisfaction.kind !== 'files') return refusedRow('not-text-readable');
  if (documentTextReadersFor([item.documentKind]).length === 0) return refusedRow('not-text-readable');
  const evidence = await collectCaseEvidence(db, request.record, HOST_EVIDENCE_VIEWER);
  const newest = rowFiles(row, evidence.files)[0];
  if (newest === undefined) return refusedRow('no-file');
  if (newest.fileId !== request.fileId) return refusedRow('stale');
  return newest.source.kind === 'owned' ? { kind: 'file', fileId: newest.fileId } : refusedRow('contributed-file');
}

/** **Διάβασε το έγγραφο της γραμμής** — ο ίδιος πυρήνας με το ανέβασμα· `recordedBy` = ο άνθρωπος που το ζήτησε. */
export async function readCaseRowDocumentText(
  db: Firestore,
  request: CaseDocumentTextRequest,
  deps: DocumentTextDeps,
): Promise<CaseDocumentTextResult> {
  const row = await newestRowFile(db, request);
  if (row.kind === 'refused') return row;
  const data = (await db.collection(COLLECTIONS.FILES).doc(row.fileId).get()).data();
  if (data === undefined) return refusedRow('no-file');
  return readDocumentTextFacts(db, { fileCollection: COLLECTIONS.FILES, fileId: row.fileId, data, recordedBy: request.actorUid }, deps);
}
