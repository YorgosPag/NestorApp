/**
 * Παραπομπή απαλλαγής ΦΠΑ και ένδειξη αντίστροφης επιβάρυνσης στο PDF (ν. 4308/2014 άρθρο 9 §1 ιβ / ιγ) — ομαδοποίηση γραμμών ανά αιτία και κείμενο στη
 * γλώσσα του εγγράφου, με τη διάταξη του νόμου που ίσχυε την ημερομηνία έκδοσης.
 */

import { makeInvoice, makeLine } from '../../mydata/__tests__/mydata-fixtures';
import { groupVatExemptionLines, reverseChargeNoteTexts, vatExemptionNoteTexts } from '../invoice-pdf-vat-exemption';

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

describe('reverseChargeNoteTexts — ν. 4308/2014 άρθρο 9 §1 ιγ (ADR-ACC-003 §22.9)', () => {
  const EU_CUSTOMER = {
    ...makeInvoice().customer,
    name: 'Test Bau GmbH', vatNumber: 'DE811569869', city: 'München', postalCode: '80331', country: 'DE',
  };

  it('χωρίς λήπτη υπόχρεο → null (ελληνικός πελάτης, αιτία 15)', () => {
    const invoice = makeInvoice({ lineItems: [makeLine({ lineNumber: 1, vatRate: 0, vatExemptionCategory: 15 })] });
    expect(reverseChargeNoteTexts(invoice)).toBeNull();
  });

  it('2.2 + επιχείρηση ΕΕ + αιτία 4 → η αναφορά «Αντίστροφη επιβάρυνση» ΑΥΤΟΥΣΙΑ (ΔΕΕ C-247/21)', () => {
    const invoice = makeInvoice({
      type: 'service_invoice_eu',
      customer: EU_CUSTOMER,
      lineItems: [makeLine({ lineNumber: 1, vatRate: 0, vatExemptionCategory: 4 })],
    });
    expect(reverseChargeNoteTexts(invoice)).toEqual({
      heading: 'ΑΝΤΙΣΤΡΟΦΗ ΕΠΙΒΑΡΥΝΣΗ / REVERSE CHARGE',
      lines: ['Γραμμή 1: Αντίστροφη επιβάρυνση — ο λήπτης είναι υπόχρεος καταβολής του ΦΠΑ'],
    });
  });

  it('αιτία 16, πληθυντικός, αγγλικά «Reverse charge»', () => {
    const invoice = makeInvoice({
      lineItems: [
        makeLine({ lineNumber: 1, vatRate: 0, vatExemptionCategory: 16 }),
        makeLine({ lineNumber: 2, vatRate: 24 }),
        makeLine({ lineNumber: 3, vatRate: 0, vatExemptionCategory: 16 }),
      ],
    });
    expect(reverseChargeNoteTexts(invoice, 'en')).toEqual({
      heading: 'REVERSE CHARGE',
      lines: ['Lines 1, 3: Reverse charge — the customer is liable for the payment of VAT'],
    });
  });
});
