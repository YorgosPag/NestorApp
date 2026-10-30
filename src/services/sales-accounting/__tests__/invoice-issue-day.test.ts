/**
 * ADR-ACC-010 §2.1.1 — το τιμολόγιο πώλησης παίρνει ημέρα έκδοσης και **χρήση** από τη λογιστική ημέρα Αθήνας.
 * Πριν: `nowISO().slice(0, 10)` + `new Date().getFullYear()` του διακομιστή (UTC) ⇒ πώληση 1/1 01:00 ώρα Ελλάδας
 * έβγαινε τιμολόγιο 31/12 στην ΠΡΟΗΓΟΥΜΕΝΗ χρήση.
 */

jest.mock('@/lib/firebaseAdmin', () => ({ safeFirestoreOperation: jest.fn() }));
jest.mock('@/services/entity-audit.service', () => ({ EntityAuditService: { recordChange: jest.fn() } }));

import { buildInvoiceInput, type BuildInvoiceInputParams } from '../sales-accounting-helpers';

const PARAMS = {
  type: 'sales_invoice',
  series: 'Α',
  issuer: {},
  customer: {},
  description: 'Πώληση — Διαμέρισμα Α1',
  netAmount: 100_000,
  vatAmount: 24_000,
  grossAmount: 124_000,
  paymentMethod: 'bank_transfer',
  projectId: null,
  propertyId: 'prop_1',
  relatedInvoiceId: null,
  notes: null,
} as unknown as BuildInvoiceInputParams;

afterEach(() => {
  jest.useRealTimers();
});

describe('buildInvoiceInput — ημέρα έκδοσης & χρήση', () => {
  it('31/12 22:30Z = 1/1 00:30 ώρα Ελλάδας ⇒ τιμολόγιο 1/1 της ΝΕΑΣ χρήσης', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-12-31T22:30:00.000Z'));
    const input = buildInvoiceInput(PARAMS);
    expect(input.issueDate).toBe('2027-01-01');
    expect(input.fiscalYear).toBe(2027);
  });

  it('μέσα στην ημέρα — καμία διαφορά', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-14T09:00:00.000Z'));
    const input = buildInvoiceInput(PARAMS);
    expect(input.issueDate).toBe('2026-07-14');
    expect(input.fiscalYear).toBe(2026);
  });
});
