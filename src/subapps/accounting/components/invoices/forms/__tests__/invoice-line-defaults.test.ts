/**
 * @fileoverview invoice-line-defaults — η νέα γραμμή ξεκινά από το καθεστώς ΦΠΑ της επιχείρησης· όταν το προφίλ
 *   φτάσει μετά τη φόρμα, αλλάζουν ΜΟΝΟ οι ανέγγιχτες γραμμές (ADR-ACC-003 §22.4).
 */

import { companyLineVatDefault } from '@/subapps/accounting/services/setup/company-vat-regime';
import type { InvoiceLineItem } from '@/subapps/accounting/types';
import { isPristineInvoiceLine, newInvoiceLineItem, reseedPristineInvoiceLines } from '../invoice-line-defaults';

const STANDARD = companyLineVatDefault(null);
const EXEMPT_15 = companyLineVatDefault({ vatRegime: 'exempt', vatExemptionCategory: 15 });

describe('newInvoiceLineItem', () => {
  it('χωρίς αφετηρία ⇒ 24%, χωρίς αιτία, μονάδα-κωδικός', () => {
    expect(newInvoiceLineItem(1)).toMatchObject({ lineNumber: 1, vatRate: 24, vatExemptionCategory: null, unit: 'pcs' });
  });

  it('απαλλασσόμενη ⇒ 0% + αιτία', () => {
    expect(newInvoiceLineItem(3, EXEMPT_15)).toMatchObject({ lineNumber: 3, vatRate: 0, vatExemptionCategory: 15 });
  });
});

describe('isPristineInvoiceLine', () => {
  it('νέα γραμμή ⇒ ανέγγιχτη', () => {
    expect(isPristineInvoiceLine(newInvoiceLineItem(1), STANDARD)).toBe(true);
  });

  it('με περιγραφή ⇒ αγγιγμένη', () => {
    expect(isPristineInvoiceLine({ ...newInvoiceLineItem(1), description: 'Μελέτη' }, STANDARD)).toBe(false);
  });

  it('ο άνθρωπος άλλαξε συντελεστή ⇒ αγγιγμένη', () => {
    expect(isPristineInvoiceLine({ ...newInvoiceLineItem(1), vatRate: 13 }, STANDARD)).toBe(false);
  });
});

describe('reseedPristineInvoiceLines', () => {
  it('🔑 το προφίλ φτάνει: η ανέγγιχτη γραμμή γίνεται 0% + 15, η αγγιγμένη μένει ΑΚΡΙΒΩΣ ως έχει', () => {
    const touched: InvoiceLineItem = { ...newInvoiceLineItem(2), description: 'Μελέτη', unitPrice: 100, netAmount: 100 };
    const [first, second] = reseedPristineInvoiceLines([newInvoiceLineItem(1), touched], STANDARD, EXEMPT_15);
    expect(first).toEqual(newInvoiceLineItem(1, EXEMPT_15));
    expect(second).toBe(touched);
  });

  it('επιστροφή σε κανονικό: η ανέγγιχτη 0% γραμμή επιστρέφει στο 24% χωρίς αιτία', () => {
    const [line] = reseedPristineInvoiceLines([newInvoiceLineItem(1, EXEMPT_15)], EXEMPT_15, STANDARD);
    expect(line).toEqual(newInvoiceLineItem(1));
  });
});
