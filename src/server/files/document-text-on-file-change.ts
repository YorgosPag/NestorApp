/**
 * =============================================================================
 * ΑΝΑΓΝΩΣΗ ΣΤΟ ΑΝΕΒΑΣΜΑ — δεύτερος καταναλωτής του CDC των αρχείων (ADR-915 §20 · ADR-905 §6)
 * =============================================================================
 *
 * 🔑 **Γιατί εδώ, και όχι σε νέα Cloud Function**: το `onConveyanceFileWrite` (ADR-905 §6, **στην παραγωγή** από
 *   2026-10-05) αναμεταδίδει ήδη **κάθε** εγγραφή της συλλογής `files` — πριν/μετά, υπογεγραμμένα, με επαναλήψεις και
 *   ιδεμποτία ανά γεγονός. Είναι ο μόνος παρατηρητής που βλέπει **όλους** τους δρόμους ανεβάσματος (ο browser κάνει
 *   `finalizeFileRecord` με το client SDK, όπου τα server hooks **δεν** τρέχουν — ADR-899 §3.7). Ένας δεύτερος trigger
 *   θα ήταν δεύτερο μονοπάτι, δεύτερο μυστικό και δεύτερο deploy για το **ίδιο** γεγονός· ο αναγνώστης θα έπρεπε να
 *   προβληθεί στα Functions (ADR-874) μαζί με το pdf.js. Εδώ ο αναγνώστης μένει **ένας**, στην εφαρμογή.
 *   Η μία ροή CDC με πολλούς καταναλωτές είναι το πρότυπο Debezium/Kafka Connect.
 * 🔑 **Πότε**: όταν αλλάζει το **κλειδί ανάγνωσης** — ό,τι, αν αλλάξει, αλλάζει την απάντηση «τι λέει αυτό το
 *   έγγραφο;» (γίνεται έτοιμο · νέα bytes · άλλος σκοπός). Η εγγραφή των ίδιων των γεγονότων **δεν** αλλάζει το κλειδί
 *   ⇒ κανένας βρόχος· μια επανάληψη του ίδιου γεγονότος ⇒ ο γραφέας απαντά `already-recorded`.
 * 🔒 Στο log μόνο `fileId` + έκβαση — ποτέ κείμενο, όνομα ή ημερομηνία του εγγράφου.
 *
 * @module server/files/document-text-on-file-change
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import type { DependencyChangeEvent, WireDocument } from '@/lib/conveyance/dependency-change-event';
import { isLiveFileRecord } from '@/lib/files/container-file-verdict';
import { createModuleLogger } from '@/lib/telemetry';
import { PDF_CONTENT_TYPE } from '@/server/files/download-file-record-bytes';
import {
  DOCUMENT_TEXT_AUTOMATION_ACTOR,
  readDocumentTextFacts,
  textReadableKindsOf,
  type DocumentTextDeps,
  type DocumentTextOutcome,
} from '@/server/files/document-text-reading';

const logger = createModuleLogger('DOCUMENT_TEXT_ON_FILE_CHANGE');

/** Τα πεδία που, αν αλλάξουν, αλλάζουν τα bytes ή το τι υπόσχεται το αρχείο. */
const READING_KEY_FIELDS = ['storagePath', 'storagePlacement', 'hash', 'revision', 'sizeBytes', 'entityType', 'purpose'] as const;

/** Το κλειδί ανάγνωσης — `null` όταν το αρχείο δεν είναι ζωντανό PDF (τίποτα να διαβαστεί). */
export function documentTextReadingKey(doc: WireDocument | null): string | null {
  if (doc === null || !isLiveFileRecord(doc) || doc.contentType !== PDF_CONTENT_TYPE) return null;
  return JSON.stringify(READING_KEY_FIELDS.map((field) => doc[field] ?? null));
}

/** Χρειάζεται ανάγνωση; Ζωντανό PDF που παρακολουθείται, με κλειδί που **άλλαξε**. */
export function documentTextReadingDue(event: DependencyChangeEvent): boolean {
  if (event.source !== 'file' || event.after === null) return false;
  const key = documentTextReadingKey(event.after);
  return key !== null && key !== documentTextReadingKey(event.before) && textReadableKindsOf(event.after).length > 0;
}

/**
 * **Ο καταναλωτής.** `null` = δεν χρειαζόταν ανάγνωση. Βλάβη υποδομής **πετά** ⇒ ο αποδέκτης απαντά 5xx ⇒ ο trigger
 * ξαναδοκιμάζει (ADR-905 §6.4) — η ανάγνωση είναι ιδεμπότητη.
 */
export async function readDocumentTextOnFileChange(
  db: AdminFirestore,
  event: DependencyChangeEvent,
  deps: DocumentTextDeps,
): Promise<DocumentTextOutcome | null> {
  if (!documentTextReadingDue(event) || event.after === null) return null;
  const outcome = await readDocumentTextFacts(
    db,
    { fileCollection: COLLECTIONS.FILES, fileId: event.docId, data: event.after, recordedBy: DOCUMENT_TEXT_AUTOMATION_ACTOR },
    deps,
  );
  logger.info('Document text read on file change', {
    fileId: event.docId,
    outcome: outcome.kind,
    ...(outcome.kind === 'recorded' ? { verdict: outcome.verdict } : {}),
  });
  return outcome;
}
