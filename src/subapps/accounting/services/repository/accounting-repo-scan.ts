/**
 * @fileoverview Accounting Repository — Πλήρης σάρωση για ΥΠΟΛΟΓΙΣΜΟ (SSoT)
 * @description Ο ένας μηχανισμός «όλη η εμβέλεια ή σφάλμα» πάνω στον οποίο στέκονται οι σαρώσεις του καθολικού
 *   ημερολογίου, του καθολικού τράπεζας και των υποψηφίων αντιστοίχισης (ADR-ACC-010 §2.1.1).
 *
 * Συμβόλαιο:
 *   - σελιδοποίηση με cursor μέσω του SSoT `processAdminBatch` — καμία `pageSize` στον καλούντα·
 *   - ΚΑΝΕΝΑ fallback: σφάλμα Firestore = σφάλμα του υπολογισμού, ποτέ «μηδέν εγγραφές»·
 *   - ρητό ανώτατο όριο που ΠΕΤΑ (`LedgerScanLimitError`), δεν κόβει.
 *
 * ⚠️ Το CHECK 3.91 ΔΕΝ βλέπει ερωτήματα που περνούν από εδώ (το τερματικό `.get()` ζει μέσα στο
 * `processAdminBatch`). Κάθε κατασκευαστής ερωτήματος που καταλήγει εδώ χρειάζεται άγκυρα ισοτιμίας δεικτών.
 *
 * @see ADR-ACC-010 §2.1.1
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, max 500 lines
 */

import type { DocumentData, Firestore, Query } from 'firebase-admin/firestore';

import { safeFirestoreOperation } from '@/lib/firebaseAdmin';
import { processAdminBatch, BATCH_SIZE_READ } from '@/lib/admin-batch-utils';

import type { PeriodRange } from '../../types/common';

/**
 * Πάνω από αυτόν τον αριθμό εγγραφών σε ΜΙΑ εμβέλεια η σάρωση πετά. Όριο μνήμης, όχι επιχειρηματικό·
 * ένα βιβλίο εσόδων-εξόδων Β' κατηγορίας δεν το πλησιάζει ούτε σε έτος.
 */
export const LEDGER_SCAN_CEILING = 100_000;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Η εμβέλεια ξεπέρασε το ανώτατο όριο — ο υπολογισμός ΔΕΝ θα έβγαινε πλήρης, άρα δεν βγαίνει καθόλου. */
export class LedgerScanLimitError extends Error {
  constructor(readonly ledger: string, readonly scope: unknown, readonly ceiling: number) {
    super(`${ledger} scan exceeded ${ceiling} documents for scope ${JSON.stringify(scope)}`);
    this.name = 'LedgerScanLimitError';
  }
}

/** Τα όρια περιόδου είναι `YYYY-MM-DD` και `from <= to` — αλλιώς η σύγκριση συμβολοσειρών θα έλεγε ψέματα. */
export function assertLedgerPeriod(ledger: string, period: PeriodRange): void {
  if (!ISO_DATE.test(period.from) || !ISO_DATE.test(period.to)) {
    throw new Error(`${ledger} period must be YYYY-MM-DD: ${period.from}..${period.to}`);
  }
  if (period.from > period.to) {
    throw new Error(`${ledger} period is inverted: ${period.from} > ${period.to}`);
  }
}

/** Παράμετροι μίας πλήρους σάρωσης. */
export interface LedgerScan<T> {
  /** Όνομα του καθολικού — εμφανίζεται στο σφάλμα. */
  readonly ledger: string;
  /** Η εμβέλεια — εμφανίζεται στο σφάλμα. */
  readonly scope: unknown;
  /** Το ερώτημα, χτισμένο πάνω στη βάση που δίνει η σάρωση. */
  readonly build: (db: Firestore) => Query;
  /** Έγγραφο → τύπος τομέα. */
  readonly map: (data: DocumentData) => T;
  readonly ceiling?: number;
  /** Ο τύπος σφάλματος υπέρβασης του καλούντος (προεπιλογή: `LedgerScanLimitError`). */
  readonly limitError?: (ceiling: number) => LedgerScanLimitError;
}

/** Όλα τα έγγραφα της εμβέλειας, με τη σειρά του ερωτήματος. Πετά σε σφάλμα ή σε υπέρβαση ορίου. */
export async function scanLedger<T>(scan: LedgerScan<T>): Promise<T[]> {
  const ceiling = scan.ceiling ?? LEDGER_SCAN_CEILING;
  // Χωρίς fallback: το safeFirestoreOperation ξαναρίχνει το σφάλμα αντί να επιστρέψει «κενό».
  return safeFirestoreOperation(async (db) => {
    const items: T[] = [];
    await processAdminBatch(scan.build(db), BATCH_SIZE_READ, (docs) => {
      for (const doc of docs) items.push(scan.map(doc.data()));
      if (items.length > ceiling) {
        throw scan.limitError?.(ceiling) ?? new LedgerScanLimitError(scan.ledger, scan.scope, ceiling);
      }
    });
    return items;
  });
}
