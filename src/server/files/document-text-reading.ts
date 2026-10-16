/**
 * =============================================================================
 * ΑΝΑΓΝΩΣΗ ΚΕΙΜΕΝΟΥ ΕΓΓΡΑΦΟΥ → ΓΕΓΟΝΟΤΑ ΣΤΟ ΙΔΙΟ ΤΟ ΑΡΧΕΙΟ — ο ΕΝΑΣ δρόμος για κάθε αφορμή (ADR-915 §20)
 * =============================================================================
 *
 * Ροή (ίδιο σχήμα με την εισαγωγή ΠΕΑ / την επαλήθευση ΠΚΑ):
 *
 *   «τι υπόσχεται;» (`documentKindsOfFile`, από τον κατάλογο) → ζωντανό PDF με αντικείμενο → bytes με όριο
 *   (`downloadFileRecordBytes`) → κείμενο (`extractPdfText`) → κρίση (`judgeDocumentText`) → ο ΕΝΑΣ γραφέας
 *   (`recordDocumentFacts`, με **φραγμό bytes**)
 *
 * Αφορμές — όλες καλούν **αυτή** τη συνάρτηση, καμία δεν ξέρει αναγνώστες:
 *   - **ανέβασμα / νέα έκδοση** — δεύτερος καταναλωτής του CDC των αρχείων (`document-text-on-file-change`)
 *   - **«Ανάγνωση από το έγγραφο»** στον διάλογο ελέγχου της μεταβίβασης (ο άνθρωπος βλέπει την έκβαση)
 *   - **συμπλήρωση** για ό,τι ανέβηκε πριν (`/api/admin/backfill-document-text-facts`)
 *
 * 🔑 **Δύο είδη αποτυχίας, δύο συμπεριφορές**: βλάβη **υποδομής** (Storage) **πετά** — ο καλών αποφασίζει (το CDC
 *   ξαναδοκιμάζει, ο διάλογος δείχνει «ξαναδοκίμασε»)· αρχείο που **δεν διαβάζεται** (χαλασμένο PDF, σαρωμένη εικόνα,
 *   άλλο έντυπο) είναι **έκβαση**, όχι σφάλμα — η επανάληψη δεν θα το διορθώσει.
 * 🔒 **Ιδιωτικότητα**: το κείμενο δεν βγαίνει ποτέ από αυτή τη συνάρτηση, ούτε σε logs — μόνο είδος και ημερομηνίες.
 *
 * @module server/files/document-text-reading
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import type { DocumentKind } from '@/config/document-validity/document-validity';
import { documentKindsOfFile } from '@/lib/conveyance/document-kind-of-file';
import {
  documentTextMaxPages,
  documentTextReadersFor,
  judgeDocumentText,
  type DocumentTextOutcome,
  type DocumentTextUnreadable,
} from '@/lib/document-validity/document-text-facts';
import { isLiveFileRecord } from '@/lib/files/container-file-verdict';
import { recordDocumentFacts, type RecordDocumentFactsInput, type RecordDocumentFactsOutcome } from '@/server/files/document-facts-writer';
import {
  DOCUMENT_TEXT_MAX_BYTES,
  PDF_CONTENT_TYPE,
  downloadFileRecordBytes,
  type FileBytesReader,
} from '@/server/files/download-file-record-bytes';
import { RasterizeUnavailableError } from '@/services/pdf/pdf-rasterize.service';

/** Ο `recordedBy` κάθε **αυτόματης** ανάγνωσης — ονομασμένος αυτοματισμός, ποτέ ο άνθρωπος που ανέβασε. */
export const DOCUMENT_TEXT_AUTOMATION_ACTOR = 'system:document-text';

export type { DocumentTextOutcome, DocumentTextUnreadable };

export interface DocumentTextFile {
  /** `files` ή `files_personal` — ό,τι έχει ήδη επιλύσει ο καλών. */
  readonly fileCollection: string;
  readonly fileId: string;
  /** Η εγγραφή όπως την ξέρει ο καλών — ο φραγμός bytes του γραφέα κρίνει αν ισχύει ακόμη. */
  readonly data: Readonly<Record<string, unknown>>;
  /** Ποιος ζήτησε την ανάγνωση: `uid` ανθρώπου ή `DOCUMENT_TEXT_AUTOMATION_ACTOR`. */
  readonly recordedBy: string;
}

export interface DocumentTextDeps {
  readonly readPdfText: (pdf: Buffer, options: { readonly maxPages: number }) => Promise<string[]>;
  readonly readBytes?: FileBytesReader;
  /** Ο ΕΝΑΣ γραφέας — αντικαθίσταται μόνο σε test. */
  readonly recordFacts?: (db: AdminFirestore, input: RecordDocumentFactsInput) => Promise<RecordDocumentFactsOutcome>;
}

const unreadable = (reason: DocumentTextUnreadable): DocumentTextOutcome => ({ kind: 'unreadable', reason });

/** Ό,τι παρακολουθείται **και** διαβάζεται από κείμενο. Κενό ⇒ το αρχείο δεν μας αφορά. */
export function textReadableKindsOf(data: Readonly<Record<string, unknown>>): readonly DocumentKind[] {
  const kinds = documentKindsOfFile(data);
  return documentTextReadersFor(kinds).length === 0 ? [] : kinds;
}

/** Το αντικείμενο που θα διαβαστεί — ή γιατί όχι. */
function objectOf(data: Readonly<Record<string, unknown>>): { readonly storagePath: string } | DocumentTextUnreadable {
  if (!isLiveFileRecord(data)) return 'not-live';
  if (data.contentType !== PDF_CONTENT_TYPE) return 'not-pdf';
  const { storagePath } = data;
  return typeof storagePath === 'string' && storagePath !== '' ? { storagePath } : 'no-object';
}

/**
 * Κείμενο σελίδων, ή `null` όταν **το PDF** δεν αναλύεται (έκβαση του αρχείου: χαλασμένο, κρυπτογραφημένο, όχι PDF).
 * 🔴 Ο αναλυτής που **δεν φορτώνει** (`RasterizeUnavailableError`) είναι βλάβη **υποδομής** ⇒ πετά. Μετρημένο: όταν το
 * pdf.js δεν φόρτωνε, η πρώτη εκδοχή το έλεγε «unparsable» για **κάθε** αρχείο — σιωπηλό «δεν διαβάζεται» χωρίς επανάληψη.
 */
async function pagesOf(bytes: Buffer, maxPages: number, deps: DocumentTextDeps): Promise<string[] | null> {
  try {
    return await deps.readPdfText(bytes, { maxPages });
  } catch (error) {
    if (error instanceof RasterizeUnavailableError) throw error;
    return null;
  }
}

/**
 * **Διάβασε το έγγραφο και γράψε ό,τι λέει, στο ίδιο το αρχείο.** Ιδεμπότητο: ίδια bytes ⇒ ίδια γεγονότα ⇒ ο γραφέας
 * απαντά `already-recorded`. Πετά **μόνο** για βλάβη υποδομής (Storage · Firestore).
 */
export async function readDocumentTextFacts(db: AdminFirestore, file: DocumentTextFile, deps: DocumentTextDeps): Promise<DocumentTextOutcome> {
  const kinds = textReadableKindsOf(file.data);
  if (kinds.length === 0) return { kind: 'not-tracked' };
  const object = objectOf(file.data);
  if (typeof object === 'string') return unreadable(object);

  const ref = { fileId: file.fileId, storagePath: object.storagePath, storagePlacement: file.data.storagePlacement };
  const download = await downloadFileRecordBytes(ref, DOCUMENT_TEXT_MAX_BYTES, deps.readBytes);
  if (download.kind === 'too-large') return unreadable('too-large');

  const readers = documentTextReadersFor(kinds);
  const pages = await pagesOf(download.bytes, documentTextMaxPages(readers), deps);
  if (pages === null) return unreadable('unparsable');

  const verdict = judgeDocumentText(pages, kinds, readers);
  if (verdict.kind !== 'read') return verdict;
  const recordFacts = deps.recordFacts ?? recordDocumentFacts;
  const written = await recordFacts(db, {
    fileCollection: file.fileCollection,
    fileId: file.fileId,
    claim: { ...verdict.facts, recordedBy: file.recordedBy },
    expectedStoragePath: object.storagePath,
  });
  return { kind: 'recorded', facts: verdict.facts, verdict: written };
}
