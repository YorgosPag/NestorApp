/**
 * @fileoverview Accounting Repository — Invoice Ledger Scan (απαιτήσεις)
 * @description Ανάγνωση των παραστατικών πωλήσεων για ΥΠΟΛΟΓΙΣΜΟ απαιτήσεων (υπόλοιπο πελάτη, ηλικίωση, έλεγχος
 *   πιστωτικού ορίου): ΟΛΗ η εμβέλεια ή σφάλμα.
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ (2026-10-15, «σελίδα ≠ καθολικό» Φάση 3): το υπόλοιπο πελάτη διάβαζε
 *   `listInvoices({ customerId, fiscalYear }, 1000)` — σελίδα της οθόνης, ΜΙΑΣ χρήσης, με ερώτημα χωρίς δείκτη ⇒
 *   `FAILED_PRECONDITION` ⇒ fallback «κανένα τιμολόγιο» ⇒ **υπόλοιπο 0 € που γραφόταν** πάνω στο αποθηκευμένο.
 *
 * Ο μηχανισμός (cursor, χωρίς fallback, όριο που πετά) ζει στο SSoT `accounting-repo-scan.ts`.
 *
 * @see ADR-ACC-010 §2.1.1 (Φάση 3)
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, max 500 lines
 */

import type { Query } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { addDaysToDateKey, isDateKey } from '@/lib/calendar/date-key';

import type { InvoiceLedgerQuery } from '../../types/customer-balance';
import type { Invoice } from '../../types/invoice';
import type { TenantContext } from '../../types/common';

import { scanLedger } from './accounting-repo-scan';

const LEDGER = 'Invoice ledger';

/** Το πεδίο του πελάτη μέσα στο παραστατικό (snapshot `customer`). */
export const INVOICE_CUSTOMER_FIELD = 'customer.contactId';

/**
 * Το αποκλειστικό άνω όριο της σάρωσης: η ΕΠΟΜΕΝΗ ημέρα του `asOf`. Το `issueDate` γράφεται `YYYY-MM-DD`, αλλά
 * ένα πλήρες ISO (`2026-03-01T10:00Z`) της ίδιας ημέρας είναι λεξικογραφικά > `2026-03-01` — το `<` της επόμενης
 * ημέρας τα πιάνει και τα δύο.
 */
function exclusiveUpperBound(asOf: string): string {
  const next = isDateKey(asOf) ? addDaysToDateKey(asOf, 1) : null;
  if (next === null) throw new Error(`${LEDGER} asOf must be an existing YYYY-MM-DD day: ${asOf}`);
  return next;
}

/**
 * Χτίζει το ερώτημα της εμβέλειας. Κάθε κλάδος αντιστοιχεί σε δείκτη του `firestore.indexes.json` — τους φυλά η
 * άγκυρα `__tests__/invoice-ledger-index.test.ts` (το CHECK 3.91 δεν βλέπει σάρωση μέσω `processAdminBatch`).
 */
export function buildInvoiceLedgerQuery(base: Query, companyId: string, query: InvoiceLedgerQuery): Query {
  const { scope } = query;
  const upper = exclusiveUpperBound(scope.asOf);
  let q = base.where('companyId', '==', companyId);
  if (scope.kind === 'customer') q = q.where(INVOICE_CUSTOMER_FIELD, '==', scope.customerId);
  return q.where('issueDate', '<', upper).orderBy('issueDate', 'asc');
}

/** Όλα τα παραστατικά της εμβέλειας, παλαιότερο πρώτο. Πετά σε σφάλμα ή σε υπέρβαση ορίου — ποτέ μερικό. */
export async function collectInvoices(
  tenant: TenantContext,
  query: InvoiceLedgerQuery,
  ceiling?: number
): Promise<Invoice[]> {
  return scanLedger({
    ledger: LEDGER,
    scope: query.scope,
    ceiling,
    build: (db) => buildInvoiceLedgerQuery(db.collection(COLLECTIONS.ACCOUNTING_INVOICES), tenant.companyId, query),
    map: (data) => data as Invoice,
  });
}
