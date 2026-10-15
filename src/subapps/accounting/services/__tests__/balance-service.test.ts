/**
 * @jest-environment node
 *
 * Υπόλοιπο πελάτη — υπηρεσία (ADR-ACC-010 §2.1.1, Φάση 3, 2026-10-15).
 *
 * 🔴 Τα περιστατικά που καρφώνει:
 * - σφάλμα ανάγνωσης ⇒ «υπόλοιπο 0» που ΓΡΑΦΟΤΑΝ πάνω στο αποθηκευμένο (Ε-1, Ε-2)·
 * - μαζική συμφωνία N+1: μία σάρωση ανά πελάτη (Σ-1)·
 * - υπόλοιπο ανά χρήση: η σάρωση δεν έχει χρήση (Υ-1)·
 * - ένα 500 μετά από ήδη δημιουργημένο τιμολόγιο ⇒ επανάληψη ⇒ διπλό τιμολόγιο (Ε-3).
 */

jest.mock('@/lib/telemetry/Logger', () => ({
  createModuleLogger: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() }),
}));

import type { Invoice } from '../../types/invoice';
import type { CustomerBalance, InvoiceLedgerQuery } from '../../types/customer-balance';
import {
  checkCreditLimit,
  computeCustomerBalance,
  hasActiveCreditLimit,
  reconcileAllBalances,
  refreshCustomerBalance,
} from '../balance-service';

const AS_OF = '2026-10-15';

const inv = (id: string, customerId: string, gross: number, issueDate = '2026-01-10') =>
  ({
    invoiceId: id,
    type: 'service_invoice',
    issueDate,
    dueDate: null,
    customer: { contactId: customerId, name: `Όνομα ${customerId}` },
    totalGrossAmount: gross,
    payments: [],
    totalPaid: 0,
    balanceDue: gross,
    paymentStatus: 'unpaid',
    mydata: { status: 'accepted' },
    relatedInvoiceId: null,
  }) as unknown as Invoice;

const stored = (customerId: string, netBalance: number, extra: Partial<CustomerBalance> = {}) =>
  ({ customerId, netBalance, creditLimit: null, creditHoldRule: 'off', ...extra }) as CustomerBalance;

function fakeRepo(book: Invoice[], balances: CustomerBalance[] = []) {
  const collectInvoices = jest.fn(async ({ scope }: InvoiceLedgerQuery) =>
    book.filter((i) => i.issueDate <= scope.asOf && (scope.kind === 'receivables' || i.customer.contactId === scope.customerId)));
  return {
    collectInvoices,
    getCustomerBalance: jest.fn(async (id: string) => balances.find((b) => b.customerId === id) ?? null),
    listCustomerBalances: jest.fn(async () => balances),
    upsertCustomerBalance: jest.fn(async () => undefined),
  };
}

describe('Υ — υπολογισμός από ΟΛΑ τα παραστατικά του πελάτη', () => {
  it('Υ-1 η σάρωση είναι εμβέλειας πελάτη ως σήμερα — χωρίς χρήση· τιμολόγια παλιών χρήσεων μετρούν', async () => {
    const repo = fakeRepo([inv('a', 'c1', 100, '2024-03-01'), inv('b', 'c1', 50, '2026-02-01'), inv('x', 'c2', 999)]);
    const balance = await computeCustomerBalance(repo, 'c1', AS_OF);
    expect(repo.collectInvoices).toHaveBeenCalledWith({ scope: { kind: 'customer', customerId: 'c1', asOf: AS_OF } });
    expect([balance.netBalance, balance.totalInvoiced, balance.asOf]).toEqual([150, 150, AS_OF]);
  });

  it('Υ-2 οι ρυθμίσεις πίστωσης του αποθηκευμένου διατηρούνται — ο υπολογισμός δεν τις παράγει', async () => {
    const repo = fakeRepo([inv('a', 'c1', 10)], [stored('c1', 0, { creditLimit: 500, creditHoldRule: 'auto', riskClass: 'high' })]);
    const balance = await computeCustomerBalance(repo, 'c1', AS_OF);
    expect([balance.creditLimit, balance.creditHoldRule, balance.riskClass]).toEqual([500, 'auto', 'high']);
  });
});

describe('Ε — σφάλμα ≠ μηδέν', () => {
  it('Ε-1 σφάλμα σάρωσης ⇒ το σφάλμα φτάνει στον καλούντα', async () => {
    const repo = fakeRepo([]);
    repo.collectInvoices.mockRejectedValueOnce(new Error('FAILED_PRECONDITION'));
    await expect(computeCustomerBalance(repo, 'c1', AS_OF)).rejects.toThrow('FAILED_PRECONDITION');
  });

  it('Ε-2 + Ε-3 ανανέωση μετά την εγγραφή: δεν ρίχνει το αίτημα ΚΑΙ δεν γράφει «0»', async () => {
    const repo = fakeRepo([]);
    repo.collectInvoices.mockRejectedValueOnce(new Error('FAILED_PRECONDITION'));
    await expect(refreshCustomerBalance(repo, 'c1')).resolves.toBe(false);
    expect(repo.upsertCustomerBalance).not.toHaveBeenCalled();
  });

  it('Ε-4 επιτυχής ανανέωση γράφει το υπόλοιπο', async () => {
    const repo = fakeRepo([inv('a', 'c1', 70, '2026-01-01')]);
    await expect(refreshCustomerBalance(repo, 'c1')).resolves.toBe(true);
    expect(repo.upsertCustomerBalance).toHaveBeenCalledWith('c1', expect.objectContaining({ netBalance: 70 }));
  });
});

describe('Σ — μαζική συμφωνία: ΜΙΑ σάρωση, ομαδοποίηση ανά πελάτη', () => {
  const book = [inv('a', 'c1', 100), inv('b', 'c2', 40), inv('c', 'c1', 5)];

  it('Σ-1 μία σάρωση εμβέλειας εταιρείας για όλους (όχι N+1)', async () => {
    const repo = fakeRepo(book);
    await reconcileAllBalances(repo, AS_OF);
    expect(repo.collectInvoices).toHaveBeenCalledTimes(1);
    expect(repo.collectInvoices).toHaveBeenCalledWith({ scope: { kind: 'receivables', asOf: AS_OF } });
  });

  it('Σ-2 κάθε πελάτης παίρνει το δικό του σύνολο· διορθώσεις μετρώνται', async () => {
    const repo = fakeRepo(book, [stored('c1', 105), stored('c2', 0)]);
    const result = await reconcileAllBalances(repo, AS_OF);
    const written = Object.fromEntries(
      repo.upsertCustomerBalance.mock.calls.map(([id, b]: [string, CustomerBalance]) => [id, b.netBalance]));
    expect(written).toEqual({ c1: 105, c2: 40 });
    expect(result).toEqual({ reconciled: 2, corrected: 1, unattributedInvoices: 0, asOf: AS_OF });
  });

  it('Σ-3 αποθηκευμένος πελάτης χωρίς πια παραστατικά μηδενίζεται (όχι μπαγιάτικο υπόλοιπο)', async () => {
    const repo = fakeRepo([], [stored('ghost', 300)]);
    const result = await reconcileAllBalances(repo, AS_OF);
    expect(repo.upsertCustomerBalance).toHaveBeenCalledWith('ghost', expect.objectContaining({ netBalance: 0 }));
    expect(result.corrected).toBe(1);
  });

  it('Σ-4 σφάλμα σάρωσης ⇒ καμία εγγραφή', async () => {
    const repo = fakeRepo(book);
    repo.collectInvoices.mockRejectedValueOnce(new Error('boom'));
    await expect(reconcileAllBalances(repo, AS_OF)).rejects.toThrow('boom');
    expect(repo.upsertCustomerBalance).not.toHaveBeenCalled();
  });
});

describe('Π — πιστωτικό όριο (SAP / NetSuite)', () => {
  const withLimit = (rule: CustomerBalance['creditHoldRule'], netBalance = 800) =>
    stored('c1', netBalance, { creditLimit: 1000, creditHoldRule: rule });

  it('Π-1 auto + υπέρβαση ⇒ μπλοκ, με δομημένα ποσά (όχι κείμενο)', () => {
    expect(checkCreditLimit(withLimit('auto'), 250)).toEqual({
      allowed: false, exceedsLimit: true, exposure: 800, projectedExposure: 1050, availableCredit: 200,
    });
  });

  it('Π-2 manual + υπέρβαση ⇒ επιτρέπεται με σήμανση· ακριβώς στο όριο ⇒ όχι υπέρβαση', () => {
    expect(checkCreditLimit(withLimit('manual'), 250)).toMatchObject({ allowed: true, exceedsLimit: true });
    expect(checkCreditLimit(withLimit('auto'), 200)).toMatchObject({ allowed: true, exceedsLimit: false });
  });

  it('Π-3 χωρίς όριο ή off ⇒ ούτε έλεγχος ούτε σάρωση', () => {
    expect(checkCreditLimit(withLimit('off'), 1e6)).toMatchObject({ allowed: true, exceedsLimit: false, availableCredit: null });
    expect([hasActiveCreditLimit(null), hasActiveCreditLimit(withLimit('off')), hasActiveCreditLimit(withLimit('auto'))])
      .toEqual([false, false, true]);
  });
});
