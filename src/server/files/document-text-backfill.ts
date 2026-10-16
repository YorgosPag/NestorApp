import 'server-only';

/**
 * @fileoverview 📄 **ΣΥΜΠΛΗΡΩΣΗ: ανάγνωση κειμένου για ό,τι ανέβηκε ΠΡΙΝ από την ανάγνωση στο ανέβασμα** (ADR-915 §20).
 * @module server/files/document-text-backfill
 * @related app/api/admin/backfill-document-text-facts (HTTP) · server/files/document-text-on-file-change (το CDC)
 *          — ίδιος πυρήνας (`readDocumentTextFacts`), μόνο η αφορμή διαφέρει.
 *
 * 🔑 **Μόνο όπου λείπει**: αρχείο που έχει ήδη γεγονότα **από το κείμενό του** δεν κατεβαίνει καν. Δήλωση ανθρώπου
 *   (`attested`) **δεν** εξαιρείται: η ανάγνωση του εγγράφου την ξεπερνά στην ιεραρχία (`documentFactsVerdict`).
 * 🔑 **Μόνο `files`**: το μητρώο λήξεων διαβάζει μόνο τα αρχεία της εταιρείας (ADR-915 §11.1 Ε1) — ίδιο εύρος με το CDC.
 * 🔑 **Dry-run = πραγματική ανάγνωση, καμία εγγραφή**: το GET κατεβάζει και κρίνει, ώστε η αναφορά να λέει **τι θα
 *   γραφτεί**, όχι απλώς «πόσα υποψήφια».
 * 🔒 Η αναφορά κρατά μόνο `fileId` + έκβαση — ποτέ κείμενο ή στοιχεία του εγγράφου.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { BATCH_SIZE_READ, processAdminBatch } from '@/lib/admin-batch-utils';
import { DOCUMENT_FACTS_FIELD, isDocumentText, readDocumentFacts } from '@/lib/document-validity/document-facts';
import { getErrorMessage } from '@/lib/error-utils';
import {
  DOCUMENT_TEXT_AUTOMATION_ACTOR,
  readDocumentTextFacts,
  textReadableKindsOf,
  type DocumentTextDeps,
  type DocumentTextOutcome,
} from '@/server/files/document-text-reading';

/** Η έκβαση ανά αρχείο ως ένα όνομα — `recorded:<verdict>` ή το είδος της έκβασης. */
export type DocumentTextBackfillOutcome = string;

/** Πόσα σφάλματα κρατά η αναφορά — τα υπόλοιπα μετριούνται μόνο. */
const MAX_REPORTED_ERRORS = 50;

export interface DocumentTextBackfillTally {
  scanned: number;
  candidates: number;
  readonly outcomes: Record<DocumentTextBackfillOutcome, number>;
  failed: number;
  readonly errors: string[];
}

/** Χρειάζεται ανάγνωση; Παρακολουθείται, διαβάζεται από κείμενο, και **δεν** έχει ήδη ανάγνωση του εγγράφου. */
export function needsDocumentText(data: Readonly<Record<string, unknown>>): boolean {
  return textReadableKindsOf(data).length > 0 && !isDocumentText(readDocumentFacts(data[DOCUMENT_FACTS_FIELD]));
}

/** Μία λέξη για την αναφορά. */
export function backfillOutcomeName(outcome: DocumentTextOutcome): DocumentTextBackfillOutcome {
  if (outcome.kind === 'recorded') return `recorded:${outcome.verdict}`;
  return outcome.kind === 'unreadable' ? `unreadable:${outcome.reason}` : outcome.kind;
}

/** Στο dry-run ο γραφέας **δεν** καλείται — η έκβαση λέει «θα γραφόταν». */
function dryRunDeps(deps: DocumentTextDeps): DocumentTextDeps {
  return { ...deps, recordFacts: async () => 'write' };
}

/**
 * **Όλη η συμπλήρωση.** Σειριακά: λίγες δεκάδες έγγραφα των λίγων KB — καμία πίεση στον κάδο ή στη μνήμη. Βλάβη ανά
 * αρχείο καταγράφεται και η σάρωση συνεχίζει.
 */
export async function runDocumentTextBackfill(db: Firestore, dryRun: boolean, deps: DocumentTextDeps): Promise<DocumentTextBackfillTally> {
  const tally: DocumentTextBackfillTally = { scanned: 0, candidates: 0, outcomes: {}, failed: 0, errors: [] };
  const effectiveDeps = dryRun ? dryRunDeps(deps) : deps;
  await processAdminBatch(db.collection(COLLECTIONS.FILES).orderBy('__name__'), BATCH_SIZE_READ, async (docs) => {
    tally.scanned += docs.length;
    for (const doc of docs) {
      const data = doc.data();
      if (!needsDocumentText(data)) continue;
      tally.candidates += 1;
      try {
        const file = { fileCollection: COLLECTIONS.FILES, fileId: doc.id, data, recordedBy: DOCUMENT_TEXT_AUTOMATION_ACTOR };
        const name = backfillOutcomeName(await readDocumentTextFacts(db, file, effectiveDeps));
        tally.outcomes[name] = (tally.outcomes[name] ?? 0) + 1;
      } catch (error) {
        tally.failed += 1;
        if (tally.errors.length < MAX_REPORTED_ERRORS) tally.errors.push(`${doc.id}: ${getErrorMessage(error)}`);
      }
    }
  });
  return tally;
}
