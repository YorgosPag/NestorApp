/**
 * =============================================================================
 * Ο ΕΝΑΣ ΓΡΑΦΕΑΣ των «Αγνοήσεων» — `FileRecord.evidenceDismissals` (ADR-950 §4.5)
 * =============================================================================
 *
 * Ίδιο ιδίωμα με τον γραφέα των γεγονότων εγγράφου (`document-facts-writer`): **καθαρή** αλλαγή στον πυρήνα
 * (`lib/contacts/contact-evidence-dismissals`), **λεπτή** συναλλαγή εδώ, ημερολόγιο **μετά** τη δέσμευση.
 *
 * 🔑 **Το κλειδί της τιμής το υπολογίζει ο διακομιστής** (`evidenceDocumentKey`) από την **αποθηκευμένη** ανάγνωση —
 *    ποτέ ο πελάτης. Κανείς δεν «αγνοεί» τιμή που το έγγραφο δεν είπε, και η απόφαση δένεται σε ό,τι πραγματικά
 *    διαβάστηκε τη στιγμή της συναλλαγής (όχι σε ό,τι έδειχνε μια μπαγιάτικη οθόνη).
 * 🔑 **Μόνο αρχεία επαφής** — η σύγκριση «έγγραφο ↔ επαφή» δεν έχει νόημα αλλού.
 * 🔴 **ΠΟΤΕ `updatedAt` / `revision`** (ίδιος λόγος με τα γεγονότα εγγράφου): η απόφαση **περιγράφει** την ανάγνωση,
 *    δεν αλλάζει τα bytes· αλλιώς κάθε αποτύπωμα ελέγχου μεταβίβασης του αρχείου θα γινόταν σιωπηλά «μη τρέχον».
 *
 * @module server/files/evidence-dismissals-writer
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';
import { z } from 'zod';

import type { EvidenceDismissReason, EvidenceRowKey } from '@/config/contact-document-evidence';
import { COLLECTIONS } from '@/config/firestore-collections';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { evidenceDocumentKey } from '@/lib/contacts/contact-evidence-comparison';
import {
  EVIDENCE_DISMISSALS_FIELD,
  readEvidenceDismissals,
  withEvidenceDismissal,
  withoutEvidenceDismissal,
} from '@/lib/contacts/contact-evidence-dismissals';
import { nowISO } from '@/lib/date-local';
import { isPayloadOwnedByCompany } from '@/lib/auth/tenant-ownership';
import { isPlainRecord } from '@/lib/type-guards';
import { DocumentEvidenceFieldSchema, type DocumentEvidenceField } from '@/schemas/ai-analysis';
import { recordFileAudit } from '@/services/file-audit-admin.service';
import type { EvidenceDismissal } from '@/types/file-record';

export type EvidenceDismissalCommand =
  | { readonly act: 'dismiss'; readonly row: EvidenceRowKey; readonly reason: EvidenceDismissReason }
  | { readonly act: 'restore'; readonly row: EvidenceRowKey };

export interface EvidenceDismissalInput {
  readonly fileId: string;
  readonly companyId: string;
  readonly uid: string;
  readonly command: EvidenceDismissalCommand;
}

export type EvidenceDismissalOutcome =
  | { readonly kind: 'dismissed'; readonly dismissal: EvidenceDismissal }
  | { readonly kind: 'restored' }
  | { readonly kind: 'not-found' }
  | { readonly kind: 'not-a-contact-file' }
  | { readonly kind: 'nothing-to-dismiss' };

type Data = Record<string, unknown>;

/** Η αποθηκευμένη ανάγνωση: πεδία + `purpose` για το οποίο ζητήθηκαν. Άκυρη ⇒ τίποτα. */
/**
 * ⚠️ Κρίνει **μόνο** τα δύο πεδία της ανάγνωσης, όχι όλη την ανάλυση: ο δίσκος κρατά `aiModel: null` /
 * `description: null` (γράφει ο `classify-background`), που το πλήρες σχήμα θα απέρριπτε ⇒ καμία «Αγνόηση» ποτέ.
 */
function storedReading(data: Data): { readonly fields: readonly DocumentEvidenceField[]; readonly purpose: string | null } {
  const analysis = isPlainRecord(data.ingestion) ? data.ingestion.analysis : undefined;
  if (!isPlainRecord(analysis)) return { fields: [], purpose: null };
  const fields = StoredEvidenceFieldsSchema.safeParse(analysis.fields);
  const purpose = typeof analysis.evidencePurpose === 'string' ? analysis.evidencePurpose : null;
  return { fields: fields.success ? fields.data : [], purpose };
}

const StoredEvidenceFieldsSchema = z.array(DocumentEvidenceFieldSchema);

function nextLedger(data: Data, input: EvidenceDismissalInput, now: string): EvidenceDismissalOutcome & { readonly ledger?: readonly EvidenceDismissal[] } {
  const ledger = readEvidenceDismissals(data[EVIDENCE_DISMISSALS_FIELD]);
  const { command } = input;
  if (command.act === 'restore') return { kind: 'restored', ledger: withoutEvidenceDismissal(ledger, command.row) };
  const { fields, purpose } = storedReading(data);
  const key = evidenceDocumentKey(fields, purpose, command.row);
  if (key === null) return { kind: 'nothing-to-dismiss' };
  const dismissal: EvidenceDismissal = {
    row: command.row,
    documentValueAtDecision: key,
    reason: command.reason,
    decidedBy: input.uid,
    decidedAt: now,
  };
  return { kind: 'dismissed', dismissal, ledger: withEvidenceDismissal(ledger, dismissal) };
}

async function commit(db: AdminFirestore, input: EvidenceDismissalInput, now: string): Promise<EvidenceDismissalOutcome> {
  const ref = db.collection(COLLECTIONS.FILES).doc(input.fileId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : undefined;
    // Ξένος μισθωτής = ανύπαρκτο (ένα 404, κανένα μαντείο ύπαρξης).
    const owner = typeof data?.companyId === 'string' ? data.companyId : null;
    if (data === undefined || !isPayloadOwnedByCompany({ companyId: owner }, input.companyId)) return { kind: 'not-found' };
    if (data.entityType !== ENTITY_TYPES.CONTACT) return { kind: 'not-a-contact-file' };
    const { ledger, ...outcome } = nextLedger(data, input, now);
    // 🔴 ΜΟΝΟ το πεδίο — κανένα `updatedAt` (βλ. κεφαλίδα).
    if (ledger !== undefined) tx.update(ref, { [EVIDENCE_DISMISSALS_FIELD]: ledger });
    return outcome;
  });
}

/** **Αγνόησε / αναίρεσε** μια διαφορά. Ιδεμπότητα: ίδια πράξη δύο φορές ⇒ ίδιο μητρώο. */
export async function applyEvidenceDismissal(
  db: AdminFirestore,
  input: EvidenceDismissalInput,
  now: () => string = nowISO,
): Promise<EvidenceDismissalOutcome> {
  const outcome = await commit(db, input, now());
  if (outcome.kind === 'dismissed' || outcome.kind === 'restored') {
    await recordFileAudit({
      fileId: input.fileId,
      action: outcome.kind === 'dismissed' ? 'evidence_dismiss' : 'evidence_restore',
      performedBy: input.uid,
      metadata: { row: input.command.row, reason: input.command.act === 'dismiss' ? input.command.reason : null },
      companyId: input.companyId,
    });
  }
  return outcome;
}
