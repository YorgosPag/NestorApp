/**
 * =============================================================================
 * Ο αναγνώστης των γεγονότων εγγράφου ΜΕΣΑ ΑΠΟ ΤΟ ΔΟΧΕΙΟ (ADR-915 Φ3β-2)
 * =============================================================================
 *
 * `fileId` (από το μπλοκ ενός ακινήτου, άρα κάποτε από τον πελάτη) → τα γεγονότα του αρχείου, **μόνο** αν το αρχείο
 * ανήκει στο δοχείο που ρωτά. Περνά από τον **ΙΔΙΟ** κριτή με την εισαγωγή (`judgeContainerFile`): ξένος κάτοχος ·
 * άλλο ακίνητο · κάδος · όχι έτοιμο · άλλος τύπος ⇒ `null`. Καμία διάκριση προς τα έξω — ένα πλαστό `sourceFileId`
 * δεν μαθαίνει ποτέ αν υπάρχει το ξένο αρχείο, ούτε δανείζεται τη λήξη του.
 *
 * 🔑 **Ανεκτικός**: κάθε «δεν ξέρω» (καμία εγγραφή · απόν/αλλοιωμένο πεδίο) = `null`, και ο καλών συνεχίζει ακριβώς
 * όπως πριν τη Φ3 — καμία μαζική μετάπτωση.
 * 🔑 **Μόνο ανάγνωση**: ο ΕΝΑΣ γραφέας μένει το `document-facts-writer`.
 *
 * @module server/files/document-facts-read
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { DOCUMENT_FACTS_FIELD, readDocumentFacts, type DocumentFacts } from '@/lib/document-validity/document-facts';
import { judgeContainerFile, type ExpectedContainer } from '@/lib/files/container-file-verdict';

/** Πού ζει ένα αρχείο και σε ποιο δοχείο **πρέπει** να ανήκει. */
export interface ContainerFileScope {
  /** Η συλλογή του κατόχου — `files` ή `files_personal`. */
  readonly fileCollection: string;
  readonly container: ExpectedContainer;
}

/** Τα γεγονότα του `fileId`, ή `null` = «δεν ξέρουμε» (ή «δεν είναι δικό σου» — ίδια απάντηση). */
export async function readContainerDocumentFacts(
  db: AdminFirestore,
  scope: ContainerFileScope,
  fileId: string,
): Promise<DocumentFacts | null> {
  const snap = await db.collection(scope.fileCollection).doc(fileId).get();
  const data = snap.exists ? (snap.data() ?? null) : null;
  if (judgeContainerFile(fileId, data, scope.container).kind === 'refused' || data === null) return null;
  return readDocumentFacts(data[DOCUMENT_FACTS_FIELD]);
}
