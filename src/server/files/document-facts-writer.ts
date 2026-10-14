/**
 * =============================================================================
 * Ο ΕΝΑΣ ΓΡΑΦΕΑΣ των γεγονότων εγγράφου — `FileRecord.documentFacts` (ADR-915 Φ3)
 * =============================================================================
 *
 * Ίδιο ιδίωμα με τον γραφέα των `imageDimensions` (ADR-899 §3.7): **καθαρή κρίση** στον πυρήνα
 * (`documentFactsVerdict`), **λεπτή** συναλλαγή εδώ. Ο πελάτης δεν γράφει το πεδίο (`firestore.rules`
 * `documentFactsUnchanged`)· δεύτερος γραφέας στον διακομιστή = άγκυρα `document-facts-authority.test.ts`.
 *
 * 🔴 **ΠΟΤΕ `updatedAt` / `revision`.** Το αποτύπωμα του ελέγχου μεταβίβασης είναι `fileId:revision:updatedAt`
 * (`conveyance-evidence.server.ts`): αν η καταγραφή γεγονότων το άλλαζε, **κάθε** εγκεκριμένη γραμμή του ίδιου
 * αρχείου θα γινόταν σιωπηλά «μη τρέχουσα». Τα γεγονότα **περιγράφουν** τα bytes, δεν τα αλλάζουν.
 *
 * 📒 Το ημερολόγιο (`file_audit_log`) γράφεται **μετά** τη δέσμευση και **ποτέ** δεν την ακυρώνει (ADR-862 §5.7): το
 * αυθεντικό ίχνος είναι το `{ recordedBy, recordedAt, source }` πάνω στο ίδιο το έγγραφο.
 *
 * @module server/files/document-facts-writer
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { nowISO } from '@/lib/date-local';
import {
  DOCUMENT_FACTS_FIELD,
  documentFactsVerdict,
  readDocumentFacts,
  type DocumentFacts,
  type DocumentFactsClaim,
  type DocumentFactsVerdict,
} from '@/lib/document-validity/document-facts';
import { fileCustodyOf } from '@/lib/files/file-custody';
import { custodyOnly, type CustodyScope } from '@/lib/workspace/custody-scope';
import { recordFileAudit } from '@/services/file-audit-admin.service';

export type { DocumentFactsClaim };

export interface RecordDocumentFactsInput {
  /** Η συλλογή του κατόχου — `files` ή `files_personal` (ό,τι έχει ήδη επιλύσει ο καλών). */
  readonly fileCollection: string;
  readonly fileId: string;
  readonly claim: DocumentFactsClaim;
}

/** `no-file` = το αρχείο δεν υπάρχει (πια) — τίποτα δεν γράφτηκε. */
export type RecordDocumentFactsOutcome = DocumentFactsVerdict | 'no-file';

interface Committed {
  readonly verdict: RecordDocumentFactsOutcome;
  readonly custody: CustodyScope | null;
}

async function commitFacts(db: AdminFirestore, input: RecordDocumentFactsInput, facts: DocumentFacts): Promise<Committed> {
  const ref = db.collection(input.fileCollection).doc(input.fileId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : undefined;
    if (data === undefined) return { verdict: 'no-file', custody: null };
    const verdict = documentFactsVerdict(readDocumentFacts(data[DOCUMENT_FACTS_FIELD]), facts);
    // 🔴 ΜΟΝΟ το πεδίο — κανένα `updatedAt` (βλ. κεφαλίδα).
    if (verdict === 'write') tx.update(ref, { [DOCUMENT_FACTS_FIELD]: facts });
    return { verdict, custody: fileCustodyOf(data) };
  });
}

/** Η γραμμή ημερολογίου ως **επίπεδο** πλαίσιο — ό,τι χρειάζεται ο άνθρωπος για να καταλάβει τι γράφτηκε. */
function auditMetadataOf(facts: DocumentFacts): Record<string, string | null> {
  const source = facts.source.kind === 'document-text' ? `document-text:${facts.source.reader}` : `attested:${facts.source.via}`;
  return { kind: facts.kind, issuedOn: facts.issuedOn, printedValidUntil: facts.printedValidUntil, source };
}

/**
 * **Γράψε τα γεγονότα ενός εγγράφου** — ιδεμπότητα, με ιεραρχία προέλευσης (`documentFactsVerdict`).
 *
 * @returns Τι έγινε. `outranked` = υπάρχει ήδη ανάγνωση του ίδιου του εγγράφου· η δήλωση ανθρώπου **δεν** τη σβήνει.
 */
export async function recordDocumentFacts(
  db: AdminFirestore,
  input: RecordDocumentFactsInput,
  now: () => string = nowISO,
): Promise<RecordDocumentFactsOutcome> {
  const facts: DocumentFacts = { ...input.claim, recordedAt: now() };
  const { verdict, custody } = await commitFacts(db, input, facts);
  if (verdict === 'write' && custody !== null) {
    await recordFileAudit({
      fileId: input.fileId,
      action: 'document_facts_record',
      performedBy: facts.recordedBy,
      metadata: auditMetadataOf(facts),
      ...custodyOnly(custody),
    });
  }
  return verdict;
}
