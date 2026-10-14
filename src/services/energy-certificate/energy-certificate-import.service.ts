/**
 * @module services/energy-certificate/energy-certificate-import.service
 * @description **Η εισαγωγή ΠΕΑ από αρχείο** (ADR-777 §8.96) — `fileId` → πρόταση για το μπλοκ. **Δεν γράφει τίποτα.**
 *
 * Ροή (ίδιο σχήμα με την επαλήθευση κατοχής του ΠΚΑ, ADR-900 §3.8):
 *
 *   κριτής αρχείου (`judgeContainerFile`: δικό σου · αυτού του ακινήτου · έτοιμο · PDF) → bytes με όριο
 *   (`downloadFileRecordBytes`) → κείμενο (`extractPdfText`) → ανάγνωση (`readPeaText`) → πρόταση (`peaProposalOf`)
 *
 * 🔑 **Ένα αρχείο, δύο όψεις**: το ΠΕΑ έχει ήδη ανέβει από τον **κανονικό** αγωγό του συστήματος αρχείων, με τον τύπο
 * `study-energy-certificate` — άρα είναι ήδη στα «Έγγραφα». Εδώ μόνο **διαβάζεται**. Η εφαρμογή στο μπλοκ γίνεται από
 * τον άνθρωπο, μέσα από τον ΙΔΙΟ δρόμο εγγραφής με το χειροκίνητο, άρα κανένας δεύτερος γραφέας του `energy`.
 * 🔑 **Ιδεμπότητο από τη φύση του**: ίδιο αρχείο ⇒ ίδια πρόταση· τίποτα δεν αλλάζει στη βάση.
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
import { judgeContainerFile, type ExpectedContainer } from '@/lib/files/container-file-verdict';
import { downloadFileRecordBytes, type FileBytesReader } from '@/server/files/download-file-record-bytes';

/** Το ΠΕΑ είναι δύο σελίδες κειμένου· 10 MB κόβει το PDF-βόμβα, όπως στο ΠΚΑ. */
export const PEA_MAX_BYTES = 10 * 1024 * 1024;
/** Το έντυπο έχει δύο σελίδες· διαβάζονται λίγες παραπάνω για ανοχή, ποτέ ολόκληρο ένα λάθος PDF εκατό σελίδων. */
const PEA_MAX_PAGES = 4;

/** Ό,τι ξέρει ο καλών για το ακίνητο — η διαδρομή το έχει ήδη διαβάσει και εξουσιοδοτήσει. */
export interface EnergyCertificateImportTarget {
  /** Η συλλογή αρχείων του κατόχου (`files` · `files_personal`). */
  readonly fileCollection: string;
  /** Το δοχείο στο οποίο **πρέπει** να ανήκει το αρχείο — τα «Έγγραφα» αυτού του ακινήτου. */
  readonly container: Omit<ExpectedContainer, 'contentType'>;
  readonly current: EnergyCertificate;
  readonly propertyArea: number | null;
  readonly today: string;
}

export interface EnergyCertificateImportDeps {
  readonly readPdfText: (pdf: Buffer, options: { readonly maxPages: number }) => Promise<string[]>;
  readonly readBytes?: FileBytesReader;
}

/** Ένα ανεβασμένο ΠΕΑ → η πρόταση για το μπλοκ, ή άρνηση με όνομα. */
export async function proposeEnergyCertificateImport(
  db: AdminFirestore,
  fileId: string,
  target: EnergyCertificateImportTarget,
  deps: EnergyCertificateImportDeps,
): Promise<PeaImportOutcome> {
  const snap = await db.collection(target.fileCollection).doc(fileId).get();
  const verdict = judgeContainerFile(fileId, snap.exists ? (snap.data() ?? null) : null, {
    ...target.container,
    contentType: 'application/pdf',
  });
  if (verdict.kind === 'refused') return verdict;

  const download = await downloadFileRecordBytes(verdict.file, PEA_MAX_BYTES, deps.readBytes);
  if (download.kind === 'too-large') return { kind: 'refused', reason: 'file-too-large' };

  const text = readPeaText(await deps.readPdfText(download.bytes, { maxPages: PEA_MAX_PAGES }));
  if (text.kind === 'not-a-certificate') return { kind: 'refused', reason: 'not-a-certificate' };

  const { current, propertyArea, today } = target;
  return { kind: 'proposal', proposal: peaProposalOf(text.reading, { fileId, current, propertyArea, today }) };
}
