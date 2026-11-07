/**
 * @fileoverview Βιβλίο Ε-Ε — τα σφάλματα του αντιλογισμού (καθαρό: καμία εξάρτηση από Firestore)
 * @description Χωριστά από τον γραφέα και το `reversal-service` ώστε ο μεταφραστής HTTP
 *   (`api/accounting/_shared/journal-reversal-errors.ts`) να τα αναγνωρίζει χωρίς να φορτώνει κανένα από τα δύο.
 *
 * @see ADR-ACC-010 §2.1.1 Φάση 8
 */

import type { FiscalPeriod, PostingPeriodDenial } from '../../types/fiscal-period';

/** Καμία υποψήφια ημερομηνία δεν έχει ανοιχτή περίοδο — ίδιο λεξιλόγιο αρνήσεων με κάθε καταχώρηση (Φ7). */
export class JournalReversalPeriodError extends Error {
  constructor(readonly code: PostingPeriodDenial, readonly postingDate: string, readonly period: FiscalPeriod | null) {
    super(`Journal reversal refused (${code}) for ${postingDate}`);
    this.name = 'JournalReversalPeriodError';
  }
}

/** Ο γραφέας αρνήθηκε τον αντιλογισμό της εγγραφής ενός τιμολογίου (π.χ. την έγραψε υποσύστημα) — ποτέ σιωπηλά. */
export class InvoiceJournalReversalRefusedError extends Error {
  constructor(readonly invoiceId: string, readonly reason: string) {
    super(`Journal reversal for invoice ${invoiceId} refused: ${reason}`);
    this.name = 'InvoiceJournalReversalRefusedError';
  }
}
