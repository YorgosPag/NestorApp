/**
 * @fileoverview customer-vat-application — μία συνάρτηση για προεπισκόπηση και εφαρμογή, αναίρεση χωρίς απώλεια
 *   (ADR-ACC-003 §22.5)
 */

import type { InvoiceLineItem } from '@/subapps/accounting/types';
import { newInvoiceLineItem } from '../invoice-line-defaults';
import { planCustomerVatApplication, revertCustomerVatApplication } from '../customer-vat-application';

const SUGGESTION = { vatRate: 0, vatExemptionCategory: 4 } as const;

function line(lineNumber: number, patch: Partial<InvoiceLineItem> = {}): InvoiceLineItem {
  return { ...newInvoiceLineItem(lineNumber), ...patch };
}

describe('planCustomerVatApplication', () => {
  it('24% ⇒ 0% + κωδ. 4, και η αλλαγή καταγράφεται με την προηγούμενη τιμή', () => {
    const { lines, changes } = planCustomerVatApplication([line(1)], SUGGESTION);
    expect(lines[0]).toMatchObject({ vatRate: 0, vatExemptionCategory: 4 });
    expect(changes).toEqual([{ lineNumber: 1, fromRate: 24, fromExemption: null }]);
  });

  it('γραμμή ήδη 0% ΜΕ αιτία μένει ως έχει (ο άνθρωπος ή η υπηρεσία έχει αποφασίσει)', () => {
    const decided = line(1, { vatRate: 0, vatExemptionCategory: 15 });
    const { lines, changes } = planCustomerVatApplication([decided], SUGGESTION);
    expect(lines[0]).toBe(decided);
    expect(changes).toEqual([]);
  });

  it('γραμμή 0% ΧΩΡΙΣ αιτία παίρνει την αιτία', () => {
    const { lines, changes } = planCustomerVatApplication([line(1, { vatRate: 0, vatExemptionCategory: null })], SUGGESTION);
    expect(lines[0].vatExemptionCategory).toBe(4);
    expect(changes).toEqual([{ lineNumber: 1, fromRate: 0, fromExemption: null }]);
  });

  it('καθαρή — δεν μεταλλάσσει την είσοδο', () => {
    const input = [line(1), line(2, { vatRate: 13 })];
    // jsdom (περιβάλλον των σουιτών accounting) δεν έχει `structuredClone`· οι γραμμές είναι καθαρό JSON.
    const snapshot: InvoiceLineItem[] = JSON.parse(JSON.stringify(input));
    planCustomerVatApplication(input, SUGGESTION);
    expect(input).toEqual(snapshot);
  });
});

describe('revertCustomerVatApplication', () => {
  it('επαναφέρει ό,τι άλλαξε η εφαρμογή', () => {
    const original = [line(1), line(2, { vatRate: 13 })];
    const { lines, changes } = planCustomerVatApplication(original, SUGGESTION);
    expect(revertCustomerVatApplication(lines, SUGGESTION, changes)).toEqual(
      original.map((item) => ({ ...item, vatExemptionCategory: null })),
    );
  });

  it('ό,τι άγγιξε ο άνθρωπος μετά την εφαρμογή ΔΕΝ χάνεται', () => {
    const { lines, changes } = planCustomerVatApplication([line(1), line(2)], SUGGESTION);
    const edited = [
      { ...lines[0], description: 'Μελέτη' },
      { ...lines[1], vatRate: 6, vatExemptionCategory: null },
      line(3, { vatRate: 0, vatExemptionCategory: 4 }),
    ];
    const reverted = revertCustomerVatApplication(edited, SUGGESTION, changes);
    expect(reverted[0]).toMatchObject({ description: 'Μελέτη', vatRate: 24, vatExemptionCategory: null });
    expect(reverted[1]).toBe(edited[1]);
    expect(reverted[2]).toBe(edited[2]);
  });
});
