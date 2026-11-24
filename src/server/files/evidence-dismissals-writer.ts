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

import type { EvidenceDismissReason, EvidenceRowKey } from '@/config/contact-document-evidence';
import { evidenceDocumentKey } from '@/lib/contacts/contact-evidence-comparison';
import {
  EVIDENCE_DISMISSALS_FIELD,
  readEvidenceDismissals,
  withEvidenceDismissal,
  withoutEvidenceDismissal,
} from '@/lib/contacts/contact-evidence-dismissals';
import { nowISO } from '@/lib/date-local';
import { recordFileAudit } from '@/services/file-audit-admin.service';
import type { EvidenceDismissal } from '@/types/file-record';

import {
  decideOnContactFile,
  storedEvidenceReading,
  type ContactFileDecision,
  type StoredFileData,
} from './stored-evidence-reading';

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

type Applied = Extract<EvidenceDismissalOutcome, { kind: 'dismissed' | 'restored' | 'nothing-to-dismiss' }>;

function decide(data: StoredFileData, input: EvidenceDismissalInput, now: string): ContactFileDecision<Applied> {
  const ledger = readEvidenceDismissals(data[EVIDENCE_DISMISSALS_FIELD]);
  const { command } = input;
  const write = (value: readonly EvidenceDismissal[]) => ({ field: EVIDENCE_DISMISSALS_FIELD, value });
  if (command.act === 'restore') return { outcome: { kind: 'restored' }, write: write(withoutEvidenceDismissal(ledger, command.row)) };
  // ADR-950 §10 — το κλειδί βγαίνει από την ανάγνωση **με τις διορθώσεις του ανθρώπου**: ό,τι δείχνει ο πίνακας.
  const { reading, purpose } = storedEvidenceReading(data);
  const key = evidenceDocumentKey(reading, purpose, command.row);
  if (key === null) return { outcome: { kind: 'nothing-to-dismiss' } };
  const dismissal: EvidenceDismissal = {
    row: command.row,
    documentValueAtDecision: key,
    reason: command.reason,
    decidedBy: input.uid,
    decidedAt: now,
  };
  return { outcome: { kind: 'dismissed', dismissal }, write: write(withEvidenceDismissal(ledger, dismissal)) };
}

/** **Αγνόησε / αναίρεσε** μια διαφορά. Ιδεμπότητα: ίδια πράξη δύο φορές ⇒ ίδιο μητρώο. */
export async function applyEvidenceDismissal(
  db: AdminFirestore,
  input: EvidenceDismissalInput,
  now: () => string = nowISO,
): Promise<EvidenceDismissalOutcome> {
  const at = now();
  const outcome = await decideOnContactFile(db, input, (data) => decide(data, input, at));
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
