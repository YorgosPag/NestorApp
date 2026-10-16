/**
 * @module services/energy-certificate/energy-certificate-import.service
 * @description **Η εισαγωγή ΠΕΑ από αρχείο** (ADR-777 §8.96) — `fileId` → πρόταση για το μπλοκ. **Δεν γράφει το ακίνητο.**
 *
 * 📅 **ADR-915 Φ3 — γράφει ό,τι λέει το έγγραφο, ΣΤΟ έγγραφο**: έκδοση + τυπωμένη «Ημερομηνία Ισχύος» →
 * `FileRecord.documentFacts`, μέσω του ΕΝΟΣ γραφέα (`recordDocumentFacts`, προέλευση `document-text`). Είναι γεγονός
 * για τα **bytes** (όπως οι διαστάσεις μιας εικόνας), όχι απόφαση για το ακίνητο — γι' αυτό γράφεται εδώ και όχι στην
 * «Αποθήκευση». Ίδια bytes ⇒ ίδια γεγονότα ⇒ ο γραφέας απαντά `already-recorded` (η ιδεμπότητα μένει).
 * ⚠️ Χωρίς αναγνωσμένη ημερομηνία έκδοσης **δεν** γράφεται τίποτα: μια κενή ανάγνωση θα υπερίσχυε (`document-text`)
 * της ημερομηνίας που θα δηλώσει αργότερα ο ελεγκτής.
 *
 * Ροή (ίδιο σχήμα με την επαλήθευση κατοχής του ΠΚΑ, ADR-900 §3.8):
 *
 *   κριτής αρχείου (`judgeContainerFile`: δικό σου · αυτού του ακινήτου · έτοιμο · PDF) → bytes με όριο
 *   (`downloadFileRecordBytes`) → κείμενο (`extractPdfText`) → ανάγνωση (`readPeaText`) → πρόταση (`peaProposalOf`)
 *
 * 🔑 **Ένα αρχείο, δύο όψεις**: το ΠΕΑ έχει ήδη ανέβει από τον **κανονικό** αγωγό του συστήματος αρχείων, με τον τύπο
 * `study-energy-certificate` — άρα είναι ήδη στα «Έγγραφα». Εδώ μόνο **διαβάζεται**. Η εφαρμογή στο μπλοκ γίνεται από
 * τον άνθρωπο, μέσα από τον ΙΔΙΟ δρόμο εγγραφής με το χειροκίνητο, άρα κανένας δεύτερος γραφέας του `energy`.
 * 🔑 **Ιδεμπότητο από τη φύση του**: ίδιο αρχείο ⇒ ίδια πρόταση και ίδια γεγονότα εγγράφου.
 *
 * ⚠️ Βλάβη υποδομής (Storage · pdf.js) **πετά** — η διαδρομή τη γυρίζει σε 503 («ξαναδοκίμασε»). Άρνηση με όνομα
 * σημαίνει «αυτό το αρχείο δεν διαβάζεται έτσι», και η επανάληψη δεν θα βοηθήσει.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import type { EnergyCertificate } from '@/lib/energy-certificate/energy-certificate';
import type { PeaImportOutcome } from '@/lib/energy-certificate/pea-import-outcome';
import { peaProposalOf } from '@/lib/energy-certificate/pea-proposal';
import { readPeaText } from '@/lib/energy-certificate/pea-text';
import type { PeaReading } from '@/lib/energy-certificate/pea-text';
import { peaTextFacts } from '@/lib/document-validity/document-text-facts';
import { judgeContainerFile } from '@/lib/files/container-file-verdict';
import type { ContainerFileScope } from '@/server/files/document-facts-read';
import { recordDocumentFacts, type DocumentFactsClaim } from '@/server/files/document-facts-writer';
import { DOCUMENT_TEXT_MAX_BYTES, downloadFileRecordBytes } from '@/server/files/download-file-record-bytes';
import type { DocumentTextDeps } from '@/server/files/document-text-reading';

/** Το ΠΕΑ είναι δύο σελίδες κειμένου· 10 MB κόβει το PDF-βόμβα — το ΕΝΑ όριο κάθε ανάγνωσης κειμένου εγγράφου. */
export const PEA_MAX_BYTES = DOCUMENT_TEXT_MAX_BYTES;
/** Το έντυπο έχει δύο σελίδες· διαβάζονται λίγες παραπάνω για ανοχή, ποτέ ολόκληρο ένα λάθος PDF εκατό σελίδων. */
const PEA_MAX_PAGES = 4;

/** Ό,τι ξέρει ο καλών για το ακίνητο — η διαδρομή το έχει ήδη διαβάσει και εξουσιοδοτήσει. */
export interface EnergyCertificateImportTarget extends ContainerFileScope {
  readonly current: EnergyCertificate;
  readonly propertyArea: number | null;
  readonly today: string;
  /** Ποιος ζήτησε την ανάγνωση — ο `recordedBy` των γεγονότων εγγράφου (ADR-915 Φ3). */
  readonly actorUid: string;
}

/** Οι θύρες κάθε ανάγνωσης κειμένου εγγράφου — **οι ίδιες** με την ανάγνωση στο ανέβασμα (ADR-915 §20). */
export type EnergyCertificateImportDeps = DocumentTextDeps;

/**
 * Ό,τι διάβασε ο αναγνώστης ΠΕΑ, ως γεγονότα εγγράφου — ή `null` όταν η έκδοση δεν διαβάστηκε. Η μετάφραση ζει
 * **μία** φορά (`peaTextFacts`, ADR-915 §20) — την ίδια χρησιμοποιεί η ανάγνωση στο ανέβασμα.
 */
export function peaDocumentFacts(reading: PeaReading, actorUid: string): DocumentFactsClaim | null {
  const facts = peaTextFacts(reading);
  return facts === null ? null : { ...facts, recordedBy: actorUid };
}

/** Ένα ανεβασμένο ΠΕΑ → η πρόταση για το μπλοκ, ή άρνηση με όνομα. */
export async function proposeEnergyCertificateImport(
  db: AdminFirestore,
  fileId: string,
  target: EnergyCertificateImportTarget,
  deps: EnergyCertificateImportDeps,
): Promise<PeaImportOutcome> {
  const snap = await db.collection(target.fileCollection).doc(fileId).get();
  const verdict = judgeContainerFile(fileId, snap.exists ? (snap.data() ?? null) : null, target.container);
  if (verdict.kind === 'refused') return verdict;

  const download = await downloadFileRecordBytes(verdict.file, PEA_MAX_BYTES, deps.readBytes);
  if (download.kind === 'too-large') return { kind: 'refused', reason: 'file-too-large' };

  const text = readPeaText(await deps.readPdfText(download.bytes, { maxPages: PEA_MAX_PAGES }));
  if (text.kind === 'not-a-certificate') return { kind: 'refused', reason: 'not-a-certificate' };

  const claim = peaDocumentFacts(text.reading, target.actorUid);
  if (claim !== null) {
    await (deps.recordFacts ?? recordDocumentFacts)(db, { fileCollection: target.fileCollection, fileId, claim });
  }

  const { current, propertyArea, today } = target;
  return { kind: 'proposal', proposal: peaProposalOf(text.reading, { fileId, current, propertyArea, today }) };
}
