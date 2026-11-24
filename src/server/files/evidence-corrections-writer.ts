/**
 * =============================================================================
 * Ο ΕΝΑΣ ΓΡΑΦΕΑΣ των «Διορθώσεων ανάγνωσης» — `FileRecord.evidenceCorrections` (ADR-950 §10)
 * =============================================================================
 *
 * Ίδιο ιδίωμα με τον γραφέα των «Αγνοήσεων»: **καθαρή** αλλαγή στον πυρήνα (`lib/contacts/contact-evidence-corrections`),
 * **λεπτή** συναλλαγή εδώ (`decideOnContactFile`), ημερολόγιο **μετά** τη δέσμευση.
 *
 * 🔑 **Ο διακομιστής ξανακρίνει την τιμή** με τους ίδιους ελεγκτές (`checkEvidenceCorrection`) — ο πελάτης τη δείχνει
 *    ζωντανά, αλλά δεν αποφασίζει. ΑΦΜ που δεν περνά το ψηφίο ελέγχου δεν αποθηκεύεται ποτέ ως «διόρθωση».
 * 🔑 **Το αποτύπωμα της μηχανής το παίρνει ο διακομιστής** από την αποθηκευμένη ανάγνωση τη στιγμή της συναλλαγής — η
 *    διόρθωση δένεται σε ό,τι πραγματικά είχε διαβαστεί, όχι σε ό,τι έδειχνε μια μπαγιάτικη οθόνη.
 * 🔑 **Δεν γράφει στην επαφή.** Η επαφή αλλάζει μόνο από την «Καταχώριση» / «Αποθήκευση» (4 φρουροί + Ιστορικό).
 *
 * @module server/files/evidence-corrections-writer
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import type { EvidenceFieldKey, EvidenceRowKey } from '@/config/contact-document-evidence';
import {
  checkEvidenceCorrection,
  EVIDENCE_CORRECTIONS_FIELD,
  evidenceRowFieldSpecs,
  machineReadingSignature,
  withEvidenceCorrection,
  withoutEvidenceCorrection,
} from '@/lib/contacts/contact-evidence-corrections';
import { nowISO } from '@/lib/date-local';
import { recordFileAudit } from '@/services/file-audit-admin.service';
import type { EvidenceCorrection } from '@/types/file-record';

import {
  decideOnContactFile,
  storedEvidenceReading,
  type ContactFileDecision,
  type StoredFileData,
} from './stored-evidence-reading';

export type EvidenceCorrectionCommand =
  | { readonly act: 'correct'; readonly row: EvidenceRowKey; readonly values: Readonly<Record<string, unknown>> }
  | { readonly act: 'clear'; readonly row: EvidenceRowKey };

export interface EvidenceCorrectionInput {
  readonly fileId: string;
  readonly companyId: string;
  readonly uid: string;
  readonly command: EvidenceCorrectionCommand;
}

export type EvidenceCorrectionOutcome =
  | { readonly kind: 'corrected'; readonly correction: EvidenceCorrection }
  | { readonly kind: 'cleared' }
  | { readonly kind: 'not-found' }
  | { readonly kind: 'not-a-contact-file' }
  /** Η γραμμή δεν ανήκει στην ανάγνωση αυτού του αρχείου (καμία ανάγνωση · άλλο είδος εγγράφου). */
  | { readonly kind: 'no-such-row' }
  | { readonly kind: 'invalid-value'; readonly fields: readonly EvidenceFieldKey[] };

type Applied = Extract<EvidenceCorrectionOutcome, { kind: 'corrected' | 'cleared' | 'no-such-row' | 'invalid-value' }>;

function decide(data: StoredFileData, input: EvidenceCorrectionInput, now: string): ContactFileDecision<Applied> {
  const { machine, purpose, corrections } = storedEvidenceReading(data);
  const { command } = input;
  const write = (value: readonly EvidenceCorrection[]) => ({ field: EVIDENCE_CORRECTIONS_FIELD, value });
  if (command.act === 'clear') return { outcome: { kind: 'cleared' }, write: write(withoutEvidenceCorrection(corrections, command.row)) };
  const specs = evidenceRowFieldSpecs(purpose, command.row);
  if (specs.length === 0) return { outcome: { kind: 'no-such-row' } };
  const check = checkEvidenceCorrection(purpose, command.row, command.values);
  if (!check.ok) return { outcome: { kind: 'invalid-value', fields: check.invalid } };
  const correction: EvidenceCorrection = {
    row: command.row,
    values: check.values,
    machineReadingAtCorrection: machineReadingSignature(machine, specs),
    correctedBy: input.uid,
    correctedAt: now,
  };
  return { outcome: { kind: 'corrected', correction }, write: write(withEvidenceCorrection(corrections, correction)) };
}

/** **Διόρθωσε / αναίρεσε** την ανάγνωση μιας γραμμής. Ιδεμπότητα: ίδια πράξη δύο φορές ⇒ ίδιο μητρώο. */
export async function applyEvidenceCorrection(
  db: AdminFirestore,
  input: EvidenceCorrectionInput,
  now: () => string = nowISO,
): Promise<EvidenceCorrectionOutcome> {
  const at = now();
  const outcome = await decideOnContactFile(db, input, (data) => decide(data, input, at));
  if (outcome.kind === 'corrected' || outcome.kind === 'cleared') {
    // Η **τιμή** δεν μπαίνει στο ίχνος (ΑΦΜ · τηλέφωνο): το αυθεντικό ίχνος είναι το ίδιο το μητρώο πάνω στο αρχείο.
    await recordFileAudit({
      fileId: input.fileId,
      action: outcome.kind === 'corrected' ? 'evidence_correct' : 'evidence_correct_clear',
      performedBy: input.uid,
      metadata: { row: input.command.row },
      companyId: input.companyId,
    });
  }
  return outcome;
}
