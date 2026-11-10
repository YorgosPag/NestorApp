/**
 * Ο ΕΝΑΣ κανόνας «ποιοι λογαριασμοί, πότε» + ο λύτης «ακριβώς ένας προεπιλεγμένος».
 * @see ADR-ACC-018 §15 · ADR-ACC-008 §2
 */

import type { BankAccountConfig } from '../../../types';
import {
  MAX_INVOICE_PAYMENT_ACCOUNTS,
  isTransferPaymentMethod,
  resolveInvoiceDefault,
  resolveInvoicePaymentAccounts,
  selectInvoicePaymentAccounts,
  showsPaymentInstructions,
} from '../invoice-payment-accounts';

function account(id: string, overrides: Partial<BankAccountConfig> = {}): BankAccountConfig {
  return {
    accountId: id, bankName: `Bank ${id}`, iban: `GR00${id}`, label: id, type: 'business', currency: 'EUR',
    isActive: true, bankCode: 'ETHNGRAA', holderName: 'Δικαιούχος', showOnInvoices: true, isDefaultForInvoices: false,
    sortOrder: 0, notes: null, createdAt: `2026-11-10T00:00:0${id.length}Z`, ...overrides,
  };
}

describe('showsPaymentInstructions', () => {
  it('μόνο τρόποι με μεταφορά, ποτέ σε πιστωτικό', () => {
    expect(showsPaymentInstructions({ type: 'service_invoice', paymentMethod: 'bank_transfer' })).toBe(true);
    expect(showsPaymentInstructions({ type: 'service_invoice', paymentMethod: 'credit' })).toBe(true);
    expect(showsPaymentInstructions({ type: 'service_invoice', paymentMethod: 'mixed' })).toBe(true);
    expect(showsPaymentInstructions({ type: 'service_invoice', paymentMethod: 'cash' })).toBe(false);
    expect(showsPaymentInstructions({ type: 'service_invoice', paymentMethod: 'card' })).toBe(false);
    expect(showsPaymentInstructions({ type: 'credit_invoice', paymentMethod: 'bank_transfer' })).toBe(false);
  });

  it('ο φρουρός δέχεται μόνο γνωστό τρόπο μεταφοράς από «έξω»', () => {
    expect(isTransferPaymentMethod('bank_transfer')).toBe(true);
    expect(isTransferPaymentMethod('wire')).toBe(false);
    expect(isTransferPaymentMethod(undefined)).toBe(false);
  });
});

describe('selectInvoicePaymentAccounts', () => {
  const subject = { type: 'service_invoice', paymentMethod: 'bank_transfer' } as const;

  it('μόνο ενεργοί + «Στα τιμολόγια», ο προεπιλεγμένος πρώτος, έως 3', () => {
    const accounts = [
      account('a', { sortOrder: 0 }), account('b', { sortOrder: 1, isDefaultForInvoices: true }),
      account('c', { sortOrder: 2, showOnInvoices: false }), account('d', { sortOrder: 3, isActive: false }),
      account('e', { sortOrder: 4 }), account('f', { sortOrder: 5 }),
    ];
    const selected = selectInvoicePaymentAccounts(accounts, subject, 'Εκδότης');
    expect(selected.map((a) => a.bankName)).toEqual(['Bank b', 'Bank a', 'Bank e']);
    expect(selected).toHaveLength(MAX_INVOICE_PAYMENT_ACCOUNTS);
  });

  it('BIC + δικαιούχος· κενός δικαιούχος ⇒ επωνυμία εκδότη (BT-85)', () => {
    const [selected] = selectInvoicePaymentAccounts([account('a', { holderName: '  ' })], subject, 'Εκδότης ΑΕ');
    expect(selected).toEqual({ bankName: 'Bank a', iban: 'GR00a', bic: 'ETHNGRAA', holderName: 'Εκδότης ΑΕ' });
  });

  it('μετρητά ⇒ κενό snapshot', () => {
    expect(selectInvoicePaymentAccounts([account('a')], { type: 'service_invoice', paymentMethod: 'cash' }, 'X')).toEqual([]);
  });
});

describe('resolveInvoicePaymentAccounts', () => {
  it('ΔΕΝ διαβάζει το μητρώο όταν το παραστατικό δεν πληρώνεται με μεταφορά', async () => {
    const read = jest.fn(async () => [account('a')]);
    await expect(resolveInvoicePaymentAccounts(read, { type: 'retail_receipt', paymentMethod: 'cash' }, 'X')).resolves.toEqual([]);
    await expect(resolveInvoicePaymentAccounts(read, { type: 'bogus', paymentMethod: 'bank_transfer' }, 'X')).resolves.toEqual([]);
    expect(read).not.toHaveBeenCalled();
  });

  it('μεταφορά ⇒ snapshot από το μητρώο', async () => {
    const read = jest.fn(async () => [account('a')]);
    const result = await resolveInvoicePaymentAccounts(read, { type: 'service_invoice', paymentMethod: 'bank_transfer' }, 'X');
    expect(result).toHaveLength(1);
    expect(read).toHaveBeenCalledTimes(1);
  });
});

describe('resolveInvoiceDefault — ακριβώς ένας προεπιλεγμένος', () => {
  it('ο ζητούμενος κερδίζει αν τυπώνεται', () => {
    const accounts = [account('a', { isDefaultForInvoices: true }), account('b')];
    expect(resolveInvoiceDefault(accounts, 'b')).toBe('b');
  });

  it('ζητούμενος που ΔΕΝ τυπώνεται ⇒ μένει ο υπάρχων', () => {
    const accounts = [account('a', { isDefaultForInvoices: true }), account('b', { showOnInvoices: false })];
    expect(resolveInvoiceDefault(accounts, 'b')).toBe('a');
  });

  it('κανένας προεπιλεγμένος ⇒ ο πρώτος που τυπώνεται', () => {
    expect(resolveInvoiceDefault([account('a', { sortOrder: 1 }), account('b', { sortOrder: 0 })], null)).toBe('b');
  });

  it('αποεπιλογή ⇒ άλλος, εκτός αν είναι ο μόνος που τυπώνεται', () => {
    const two = [account('a', { sortOrder: 0 }), account('b', { sortOrder: 1 })];
    expect(resolveInvoiceDefault(two, null, 'a')).toBe('b');
    expect(resolveInvoiceDefault([account('a')], null, 'a')).toBe('a');
  });

  it('κανένας δεν τυπώνεται ⇒ null', () => {
    expect(resolveInvoiceDefault([account('a', { showOnInvoices: false })], null)).toBeNull();
  });
});
