/**
 * @fileoverview Δεδομένα δοκιμής για τη διαβίβαση myDATA — **μόνο για tests**.
 * @module subapps/accounting/services/mydata/__tests__/mydata-fixtures
 *
 * ΑΦΜ με έγκυρο ψηφίο ελέγχου (mod-11): `094014201` (εκδότης), `800123456` (λήπτης).
 */

import type { Invoice, InvoiceLineItem } from '../../../types/invoice';

export const ISSUER_VAT = '094014201';
export const CUSTOMER_VAT = '800123456';

export function makeLine(overrides: Partial<InvoiceLineItem> = {}): InvoiceLineItem {
  return {
    lineNumber: 1,
    description: 'Μελέτη',
    quantity: 1,
    unit: 'τεμ',
    unitPrice: 1000,
    vatRate: 24,
    netAmount: 1000,
    mydataCode: 'category1_3',
    ...overrides,
  };
}

/** Έγκυρο ΤΠΥ 24%, ελληνικός λήπτης, κατάθεση — διαβιβάσιμο όπως είναι. */
export function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    invoiceId: 'inv_test_1',
    series: 'A',
    number: 42,
    type: 'service_invoice',
    issueDate: '2026-11-09',
    dueDate: null,
    issuer: {
      name: 'Εκδότης ΑΕ', vatNumber: ISSUER_VAT, taxOffice: 'Α΄ Αθηνών', address: 'Οδός 1', city: 'Αθήνα',
      postalCode: '10431', phone: null, mobile: null, email: null, website: null, profession: 'Μηχανικός',
      bankAccounts: [{ bankName: 'Τράπεζα', iban: 'GR1601101250000000012300695' }],
    },
    customer: {
      contactId: null, name: 'Πελάτης ΙΚΕ', vatNumber: CUSTOMER_VAT, taxOffice: null, address: 'Οδός 2',
      city: 'Θεσσαλονίκη', postalCode: '54621', country: 'GR', email: null,
    },
    lineItems: [makeLine()],
    currency: 'EUR',
    totalNetAmount: 1000,
    totalVatAmount: 240,
    totalGrossAmount: 1240,
    vatBreakdown: [{ vatRate: 24, netAmount: 1000, vatAmount: 240 }],
    paymentMethod: 'bank_transfer',
    paymentStatus: 'unpaid',
    payments: [],
    totalPaid: 0,
    balanceDue: 1240,
    mydata: {
      status: 'draft', mark: null, uid: null, authCode: null, submittedAt: null, respondedAt: null, errorMessage: null,
    },
    projectId: null,
    propertyId: null,
    relatedInvoiceId: null,
    journalEntryId: null,
    notes: null,
    fiscalYear: 2026,
    createdAt: '2026-11-09T10:00:00.000Z',
    updatedAt: '2026-11-09T10:00:00.000Z',
    ...overrides,
  };
}
