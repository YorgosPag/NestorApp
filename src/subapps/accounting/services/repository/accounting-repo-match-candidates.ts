/**
 * @fileoverview Accounting Repository — Ανάκτηση υποψηφίων αντιστοίχισης (στένεμα, όχι σελίδα)
 * @description Ποια ανοιχτά στοιχεία ΜΠΟΡΟΥΝ να αντιστοιχιστούν σε μια τραπεζική κίνηση.
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ (2026-10-14, «σελίδα ≠ καθολικό» Φάση 2): η αυτόματη αντιστοίχιση εξέταζε τα 100 νεότερα
 *   απλήρωτα, τα 100 νεότερα μερικώς πληρωμένα και τις 100 νεότερες εγγραφές της χρήσης. Το 101ο — συχνά το
 *   ΠΑΛΙΟΤΕΡΟ απλήρωτο, δηλαδή αυτό που πληρώνεται τώρα — δεν εξεταζόταν ποτέ. Και το ερώτημα τιμολογίων δεν είχε
 *   δείκτη: `FAILED_PRECONDITION` ⇒ fallback ⇒ **κανένα τιμολόγιο υποψήφιο, χωρίς μήνυμα**.
 *
 * Λύση (πρακτική Xero / SAP Cash Application): στένεμα ΣΤΗ ΒΑΣΗ κατά ποσό — ερώτημα εύρους στη ζώνη ανοχής
 *   (`amountBandFor`), πλήρης σάρωση της ζώνης (SSoT `scanLedger`, όριο που πετά) — συν απευθείας εύρεση κατά
 *   αριθμό παραστατικού που αναγράφεται στο κείμενο της τράπεζας (εκεί που το Xero, κατά τους χρήστες του, σιωπά).
 *
 * @see ADR-ACC-010 §2.1.1 · ADR-ACC-008 Bank Reconciliation
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, max 500 lines
 */

import type { Query } from 'firebase-admin/firestore';

import { safeFirestoreOperation } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';

import type { AmountBand, InvoiceReference } from '../../types/bank';
import type { Invoice } from '../../types/invoice';
import type { JournalEntry } from '../../types/journal';
import type { TenantContext } from '../../types/common';
import { invoiceOpenAmountField, type InvoiceOpenAmountField } from '../../utils/invoice-open-amount';

import { applyJournalDefaults } from './accounting-repo-financial';
import { scanLedger } from './accounting-repo-scan';

/** Οι καταστάσεις πληρωμής που αφήνουν το τιμολόγιο ανοιχτό. */
export const OPEN_PAYMENT_STATUSES = ['unpaid', 'partial'] as const;

/** Τα δύο πεδία που μπορεί να φέρουν το ανοιχτό ποσό — βλ. `invoiceOpenAmountField`. */
export const INVOICE_OPEN_AMOUNT_FIELDS: readonly InvoiceOpenAmountField[] = ['balanceDue', 'totalGrossAmount'];

function assertBand(band: AmountBand): void {
  if (!Number.isFinite(band.min) || !Number.isFinite(band.max) || band.min > band.max) {
    throw new Error(`Candidate amount band is invalid: ${band.min}..${band.max}`);
  }
}

/** Ανοιχτά τιμολόγια με το `field` μέσα στη ζώνη. Δείκτες: άγκυρα `match-candidates-index.test.ts`. */
export function buildOpenInvoiceBandQuery(
  base: Query,
  companyId: string,
  field: InvoiceOpenAmountField,
  band: AmountBand
): Query {
  assertBand(band);
  return base
    .where('companyId', '==', companyId)
    .where('paymentStatus', 'in', [...OPEN_PAYMENT_STATUSES])
    .where(field, '>=', band.min)
    .where(field, '<=', band.max)
    .orderBy(field, 'asc');
}

/** Ενεργές εγγραφές της χρήσης με μικτό ποσό μέσα στη ζώνη. */
export function buildJournalBandQuery(base: Query, companyId: string, fiscalYear: number, band: AmountBand): Query {
  assertBand(band);
  return base
    .where('companyId', '==', companyId)
    .where('fiscalYear', '==', fiscalYear)
    .where(FIELDS.STATUS, '==', 'ACTIVE')
    .where('grossAmount', '>=', band.min)
    .where('grossAmount', '<=', band.max)
    .orderBy('grossAmount', 'asc');
}

/**
 * Όλα τα ανοιχτά τιμολόγια με ανοιχτό ποσό μέσα στη ζώνη. Ένα ερώτημα ανά πεδίο ποσού· κάθε τιμολόγιο
 * κρατιέται ΜΟΝΟ από το ερώτημα του δικού του πεδίου (`invoiceOpenAmountField`), άρα η ένωση είναι διαμέριση:
 * ούτε διπλότυπα, ούτε τιμολόγιο που η βαθμολόγηση θα έβλεπε με άλλο ποσό από αυτό που ζητήθηκε.
 */
export async function collectOpenInvoicesByAmount(tenant: TenantContext, band: AmountBand): Promise<Invoice[]> {
  const perField = await Promise.all(
    INVOICE_OPEN_AMOUNT_FIELDS.map((field) =>
      scanLedger<Invoice>({
        ledger: `Open invoices by ${field}`,
        scope: band,
        build: (db) => buildOpenInvoiceBandQuery(db.collection(COLLECTIONS.ACCOUNTING_INVOICES), tenant.companyId, field, band),
        map: (data) => data as Invoice,
      }).then((invoices) => invoices.filter((invoice) => invoiceOpenAmountField(invoice) === field))
    )
  );
  return perField.flat();
}

/** Όλες οι ενεργές εγγραφές της χρήσης με μικτό ποσό μέσα στη ζώνη. */
export async function collectActiveJournalEntriesByAmount(
  tenant: TenantContext,
  fiscalYear: number,
  band: AmountBand
): Promise<JournalEntry[]> {
  return scanLedger<JournalEntry>({
    ledger: 'Journal entries by amount',
    scope: { fiscalYear, band },
    build: (db) => buildJournalBandQuery(db.collection(COLLECTIONS.ACCOUNTING_JOURNAL_ENTRIES), tenant.companyId, fiscalYear, band),
    map: (data) => applyJournalDefaults(data as JournalEntry),
  });
}

/**
 * Τα ανοιχτά τιμολόγια που αναγράφονται ρητά (σειρά + αριθμός) — ανεξαρτήτως ποσού: μερική πληρωμή, προμήθεια
 * τράπεζας. Ερωτήματα μόνο ισότητας (εξυπηρετούνται από μονοπεδιακούς δείκτες). Χωρίς fallback.
 */
export async function findOpenInvoicesByReference(
  tenant: TenantContext,
  references: readonly InvoiceReference[]
): Promise<Invoice[]> {
  if (references.length === 0) return [];
  return safeFirestoreOperation(async (db) => {
    const snaps = await Promise.all(
      references.map((ref) =>
        db.collection(COLLECTIONS.ACCOUNTING_INVOICES)
          .where('companyId', '==', tenant.companyId)
          .where('series', '==', ref.series)
          .where('number', '==', ref.number)
          .get()
      )
    );
    const open = new Set<string>(OPEN_PAYMENT_STATUSES);
    return snaps
      .flatMap((snap) => snap.docs.map((doc) => doc.data() as Invoice))
      .filter((invoice) => open.has(invoice.paymentStatus));
  });
}
