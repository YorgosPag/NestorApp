/**
 * Παραπομπή απαλλαγής ΦΠΑ στο PDF (ν. 4308/2014 άρθρο 9) — ομαδοποίηση γραμμών ανά αιτία και κείμενο στη
 * γλώσσα του εγγράφου, με τη διάταξη του νόμου που ίσχυε την ημερομηνία έκδοσης.
 */

import { makeInvoice, makeLine } from '../../mydata/__tests__/mydata-fixtures';
import { groupVatExemptionLines, vatExemptionNoteTexts } from '../invoice-pdf-vat-exemption';

describe('groupVatExemptionLines', () => {
  it('ομαδοποιεί ανά αιτία, με σειρά πρώτης εμφάνισης', () => {
    const lines = [
      makeLine({ lineNumber: 1, vatRate: 0, vatExemptionCategory: 15 }),
      makeLine({ lineNumber: 2, vatRate: 24 }),
      makeLine({ lineNumber: 3, vatRate: 0, vatExemptionCategory: 14 }),
      makeLine({ lineNumber: 4, vatRate: 0, vatExemptionCategory: 15 }),
    ];
    expect(groupVatExemptionLines(lines)).toEqual([
      { code: 15, lineNumbers: [1, 4] },
      { code: 14, lineNumbers: [3] },
    ]);
  });

  it('αγνοεί 0% χωρίς (ή με άκυρη) αιτία και αιτία σε γραμμή με ΦΠΑ', () => {
    const lines = [
      makeLine({ lineNumber: 1, vatRate: 0 }),
      makeLine({ lineNumber: 2, vatRate: 0, vatExemptionCategory: 99 }),
      makeLine({ lineNumber: 3, vatRate: 24, vatExemptionCategory: 15 }),
    ];
    expect(groupVatExemptionLines(lines)).toEqual([]);
  });
});

describe('vatExemptionNoteTexts', () => {
  it('χωρίς απαλλαγή → null (η ενότητα δεν σχεδιάζεται)', () => {
    expect(vatExemptionNoteTexts(makeInvoice())).toBeNull();
  });

  it('ελληνικά, ν. 5144/2024, πληθυντικός «Γραμμές»', () => {
    const invoice = makeInvoice({
      issueDate: '2026-11-09',
      lineItems: [
        makeLine({ lineNumber: 1, vatRate: 0, vatExemptionCategory: 15 }),
        makeLine({ lineNumber: 2, vatRate: 0, vatExemptionCategory: 15 }),
      ],
    });
    expect(vatExemptionNoteTexts(invoice)).toEqual({
      heading: 'ΑΠΑΛΛΑΓΗ ΦΠΑ / VAT EXEMPTION',
      lines: ['Γραμμές 1, 2: Χωρίς ΦΠΑ - άρθρο 44 του Κώδικα ΦΠΑ (ν. 5144/2024)'],
    });
  });

  it('τιμολόγιο πριν τις 11/10/2024 → διάταξη του ν. 2859/2000, ενικός «Γραμμή»', () => {
    const invoice = makeInvoice({
      issueDate: '2024-03-01',
      lineItems: [makeLine({ lineNumber: 3, vatRate: 0, vatExemptionCategory: 15 })],
    });
    expect(vatExemptionNoteTexts(invoice)?.lines).toEqual([
      'Γραμμή 3: Χωρίς ΦΠΑ - άρθρο 39 του Κώδικα ΦΠΑ (ν. 2859/2000)',
    ]);
  });
});
