/**
 * RF του τιμολογίου (ISO 11649): κωδικός σειράς στα λατινικά + αριθμός 9 ψηφίων — και η ΑΝΤΙΣΤΡΟΦΗ του στη συμφωνία
 * τράπεζας, ώστε το RF που τυπώνει το τιμολόγιο να ταιριάζει χωρίς μαντεψιά.
 * @see ADR-ACC-018 §15 · ADR-ACC-008 §14
 */

import type { InvoiceSeries } from '../../../types/invoice';
import { isValidCreditorReference } from '../../payments/creditor-reference';
import { extractInvoiceReferences, invoiceCreditorReference, seriesReferenceCode } from '../matching-reference';

function series(code: string): InvoiceSeries {
  return { code, prefix: `ΤΠΥ-${code}`, nextNumber: 1, documentTypes: ['service_invoice'], isActive: true, description: '' };
}

describe('seriesReferenceCode', () => {
  it('διπλώνει ελληνικά ομόγλυφα στα λατινικά (Α → A)', () => {
    expect(seriesReferenceCode('Α')).toBe('A');
    expect(seriesReferenceCode('A')).toBe('A');
    expect(seriesReferenceCode('credit')).toBe('CREDIT');
  });

  it('χαρακτήρας χωρίς λατινικό ομόγλυφο (Γ) ⇒ κανένα RF — ποτέ σύγκρουση δύο σειρών', () => {
    expect(seriesReferenceCode('Γ')).toBeNull();
    expect(seriesReferenceCode('A-1')).toBeNull();
  });
});

describe('invoiceCreditorReference', () => {
  it('έγκυρο RF με αριθμό 9 ψηφίων', () => {
    const rf = invoiceCreditorReference('A', 42);
    expect(rf).not.toBeNull();
    expect(rf?.endsWith('A000000042')).toBe(true);
    expect(isValidCreditorReference(rf ?? '')).toBe(true);
  });

  it('«A1»+23 και «A»+123 δίνουν ΔΙΑΦΟΡΕΤΙΚΟ RF', () => {
    expect(invoiceCreditorReference('A1', 23)).not.toBe(invoiceCreditorReference('A', 123));
  });

  it('αριθμός εκτός ορίων ⇒ null', () => {
    expect(invoiceCreditorReference('A', 0)).toBeNull();
    expect(invoiceCreditorReference('A', 1_000_000_000)).toBeNull();
  });
});

describe('extractInvoiceReferences — RF στην αιτιολογία', () => {
  it('αποκωδικοποιεί το RF του τιμολογίου σε (σειρά, αριθμό)', () => {
    const rf = invoiceCreditorReference('A', 42) ?? '';
    expect(extractInvoiceReferences([`ΚΑΤΑΘΕΣΗ ${rf}`], [series('A'), series('B')])).toEqual([{ series: 'A', number: 42 }]);
  });

  it('RF σειράς με ελληνικό κωδικό (Α) ⇒ η σειρά με τον ΑΠΟΘΗΚΕΥΜΕΝΟ κωδικό', () => {
    const rf = invoiceCreditorReference('Α', 7) ?? '';
    expect(extractInvoiceReferences([rf], [series('Α')])).toEqual([{ series: 'Α', number: 7 }]);
  });

  it('RF άγνωστης σειράς ή άκυρο RF ⇒ τίποτα', () => {
    const rf = invoiceCreditorReference('Z', 5) ?? '';
    expect(extractInvoiceReferences([rf], [series('A')])).toEqual([]);
    expect(extractInvoiceReferences(['RF19539007547034'], [series('A')])).toEqual([]);
  });
});
