/**
 * **Αποθήκευση πολλών γραμμών τιμοκαταλόγου σε δέσμες, σειριακά, με αλυσίδα CAS** (ADR-923 §5.11 «3δ» Τμήμα 1).
 *
 * Μια επικόλληση 4.000 γραμμών δεν χωρά σε μία συναλλαγή (`PRICE_LINES_PER_TRANSACTION`). Χωρίζεται σε δέσμες, και η
 * καθεμιά στέλνεται **μόνο** αφού απαντήσει η προηγούμενη, με το `linesRevision` που **εκείνη** επέστρεψε:
 *
 * ```
 * δέσμη 1 (expected = r)   → r+1
 * δέσμη 2 (expected = r+1) → r+2      ← ποτέ παράλληλα: δύο δέσμες με ίδιο expected = 409 η μία στην άλλη
 * δέσμη 3 (expected = r+2) ✕ 409      ← σταματά· «αποθηκεύτηκαν 800 από 1.200», ποτέ «αποθηκεύτηκαν»
 * ```
 *
 * 🔑 **Καμία δέσμη μετά από αποτυχία**: η επόμενη θα έστελνε `expected` που δεν ισχύει πια, ή θα έγραφε πάνω σε αλλαγή
 *    άλλου. Ο άνθρωπος βλέπει **ακριβώς** τι μπήκε — το SAP (mass maintenance) και το commercetools (import containers)
 *    αναφέρουν επίσης ανά δέσμη, ποτέ «όλα ή τίποτα» που δεν μπορούν να εγγυηθούν.
 * 🔑 Η αλυσίδα ξεκινά από το `linesRevision` που **διάβασε** ο άνθρωπος — όχι από το νεότερο γνωστό: αλλαγή άλλου
 *    στο μεταξύ **πρέπει** να δώσει 409 (ADR-923 §5.9.2, ίδιος κανόνας με το `useCatalogOptimistic`).
 * ⚠️ Καθαρό: η αποστολή έρχεται ως συνάρτηση — καμία εισαγωγή δικτύου, ώστε το ίδιο μοντέλο να δοκιμάζεται χωρίς διακομιστή.
 *
 * @module subapps/catalog/pricing/price-line-batches
 */

import type { PriceLineBatch, PriceLineBatchResult, PriceLineInput } from '../types/price-list-requests';
import type { PriceLineSubject } from '../types/price-list';
import { PRICE_LINES_PER_TRANSACTION } from '../vocabulary/pricing';

/** Μία δέσμη χωρίς το `expectedLinesRevision` — αυτό το δίνει η αλυσίδα τη στιγμή της αποστολής. */
export type PriceLineChunk = Omit<PriceLineBatch, 'expectedLinesRevision'>;

/**
 * Χωρίζει τις αλλαγές σε δέσμες των ≤ `size` εγγραφών (εισαγωγές **και** διαγραφές μετρούν μαζί, όπως στον γραφέα).
 * Πρώτα οι διαγραφές: μια γραμμή που μετακινείται (διαγραφή + νέα) δεν βρίσκεται ποτέ διπλή ανάμεσα σε δύο δέσμες.
 */
export function chunkPriceLineChanges(
  upserts: readonly PriceLineInput[],
  deletes: readonly PriceLineSubject[],
  size: number = PRICE_LINES_PER_TRANSACTION,
): readonly PriceLineChunk[] {
  if (!Number.isInteger(size) || size < 1) throw new RangeError(`chunk size must be a positive integer, got ${size}`);
  const work: readonly ({ readonly kind: 'delete'; readonly subject: PriceLineSubject } | { readonly kind: 'upsert'; readonly line: PriceLineInput })[] = [
    ...deletes.map((subject) => ({ kind: 'delete' as const, subject })),
    ...upserts.map((line) => ({ kind: 'upsert' as const, line })),
  ];
  const chunks: PriceLineChunk[] = [];
  for (let start = 0; start < work.length; start += size) {
    const slice = work.slice(start, start + size);
    chunks.push({
      upserts: slice.flatMap((item) => (item.kind === 'upsert' ? [item.line] : [])),
      deletes: slice.flatMap((item) => (item.kind === 'delete' ? [item.subject] : [])),
    });
  }
  return chunks;
}

const sizeOf = (chunk: PriceLineChunk): number => chunk.upserts.length + chunk.deletes.length;

/** Το αποτέλεσμα όλης της αποθήκευσης — **ποτέ** «αποθηκεύτηκαν» όταν μπήκε μόνο ένα μέρος. */
export type PriceLineSaveOutcome =
  | { readonly kind: 'saved'; readonly linesRevision: number; readonly written: number; readonly total: number }
  | {
      readonly kind: 'partial';
      /** Το `linesRevision` μετά την τελευταία **επιτυχημένη** δέσμη (ή το αρχικό, αν απέτυχε η πρώτη). */
      readonly linesRevision: number;
      /** Πόσες γραμμές της επικόλλησης έφτασαν στον διακομιστή (σε επιτυχημένες δέσμες). */
      readonly saved: number;
      readonly total: number;
      /** Η δέσμη που απέτυχε (0-based) — οι επόμενες **δεν** στάλθηκαν. */
      readonly failedChunk: number;
      readonly cause: unknown;
    };

export type SendPriceLineBatch = (batch: PriceLineBatch) => Promise<PriceLineBatchResult>;

/** Στέλνει τις δέσμες **μία-μία**, η καθεμιά με το `linesRevision` της προηγούμενης απάντησης. */
export async function sendPriceLineChunks(
  send: SendPriceLineBatch,
  startLinesRevision: number,
  chunks: readonly PriceLineChunk[],
): Promise<PriceLineSaveOutcome> {
  const total = chunks.reduce((sum, chunk) => sum + sizeOf(chunk), 0);
  let linesRevision = startLinesRevision;
  let saved = 0;
  let written = 0;
  for (const [index, chunk] of chunks.entries()) {
    try {
      const result = await send({ expectedLinesRevision: linesRevision, ...chunk });
      linesRevision = result.linesRevision;
      written += result.written;
      saved += sizeOf(chunk);
    } catch (cause) {
      return { kind: 'partial', linesRevision, saved, total, failedChunk: index, cause };
    }
  }
  return { kind: 'saved', linesRevision, written, total };
}
