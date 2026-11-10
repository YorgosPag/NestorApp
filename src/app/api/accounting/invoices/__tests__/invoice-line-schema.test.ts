/**
 * ADR-ACC-003 §22.2 — ο διακομιστής επικυρώνει τις γραμμές και τα ποσά του τιμολογίου (POST + PATCH).
 * Αντίφαση = 400 με ακριβή διαδρομή, ποτέ σιωπηλή διόρθωση.
 */

import { InvoiceLineItemSchema, MAX_INVOICE_LINES, UpdateInvoiceSchema } from '../invoice-schemas';

const validLine = {
  lineNumber: 1, description: 'Μελέτη', quantity: 2, unit: 'pcs', unitPrice: 100,
  vatRate: 24, netAmount: 200, mydataCode: 'category1_3',
};

const zeroLine = { ...validLine, lineNumber: 2, vatRate: 0, vatExemptionCategory: 15 };

function pathsOf(result: { success: boolean; error?: { issues: { path: (string | number)[] }[] } }): string[] {
  return result.error?.issues.map((issue) => issue.path.join('.')) ?? [];
}

describe('InvoiceLineItemSchema', () => {
  it('δέχεται έγκυρη γραμμή 24% και γραμμή 0% με αιτία του καταλόγου', () => {
    expect(InvoiceLineItemSchema.safeParse(validLine).success).toBe(true);
    expect(InvoiceLineItemSchema.safeParse(zeroLine).success).toBe(true);
  });

  it('δέχεται γραμμή 0% ΧΩΡΙΣ αιτία (πρόχειρο — τη μπλοκάρει ο preflight, όχι η αποθήκευση)', () => {
    expect(InvoiceLineItemSchema.safeParse({ ...zeroLine, vatExemptionCategory: null }).success).toBe(true);
  });

  it.each([
    ['συντελεστής εκτός GREEK_VAT_RATES', { vatRate: 17 }, 'vatRate'],
    ['κωδικός εκτός καταλόγου §8.3', { vatRate: 0, vatExemptionCategory: 32 }, 'vatExemptionCategory'],
    ['δεκαδικός κωδικός', { vatRate: 0, vatExemptionCategory: 1.5 }, 'vatExemptionCategory'],
    ['αιτία σε γραμμή 24%', { vatExemptionCategory: 15 }, 'vatExemptionCategory'],
    ['καθαρό ≠ ποσότητα × τιμή', { netAmount: 199.99 }, 'netAmount'],
    ['κωδικός myDATA εκτός λεξιλογίου', { mydataCode: 'category1_2' }, 'mydataCode'],
    ['μη πεπερασμένη τιμή', { unitPrice: Number.POSITIVE_INFINITY }, 'unitPrice'],
  ])('απορρίπτει: %s', (_label, override, path) => {
    expect(pathsOf(InvoiceLineItemSchema.safeParse({ ...validLine, ...override }))).toContain(path);
  });

  it('κόβει πεδία που δεν ανήκουν στη γραμμή (π.χ. το ανύπαρκτο grossAmount)', () => {
    const parsed = InvoiceLineItemSchema.parse({ ...validLine, grossAmount: 9999 });
    expect(parsed).not.toHaveProperty('grossAmount');
  });
});

describe('UpdateInvoiceSchema — ποσά', () => {
  const amounts = {
    totalNetAmount: 400, totalVatAmount: 48, totalGrossAmount: 448,
    vatBreakdown: [{ vatRate: 0, netAmount: 200, vatAmount: 0 }, { vatRate: 24, netAmount: 200, vatAmount: 48 }],
  };

  it('δέχεται σύνολα ίσα με τον υπολογισμό των γραμμών (η σειρά της ανάλυσης δεν μετρά)', () => {
    expect(UpdateInvoiceSchema.safeParse({ lineItems: [validLine, zeroLine], ...amounts }).success).toBe(true);
  });

  it('απορρίπτει σύνολο που διαφέρει ακόμη και κατά ένα λεπτό', () => {
    const result = UpdateInvoiceSchema.safeParse({ lineItems: [validLine, zeroLine], ...amounts, totalVatAmount: 48.01 });
    expect(pathsOf(result)).toEqual(['totalVatAmount']);
  });

  it('απορρίπτει ανάλυση ΦΠΑ που δεν συμφωνεί', () => {
    const vatBreakdown = [{ vatRate: 24, netAmount: 400, vatAmount: 48 }];
    expect(pathsOf(UpdateInvoiceSchema.safeParse({ lineItems: [validLine, zeroLine], ...amounts, vatBreakdown })))
      .toEqual(['vatBreakdown']);
  });

  it('γραμμές χωρίς σύνολα ⇒ απόρριψη (τα σύνολα θα έμεναν μπαγιάτικα)', () => {
    expect(pathsOf(UpdateInvoiceSchema.safeParse({ lineItems: [validLine] })))
      .toEqual(['totalNetAmount', 'totalVatAmount', 'totalGrossAmount']);
  });

  it('σύνολα χωρίς γραμμές ⇒ απόρριψη', () => {
    expect(pathsOf(UpdateInvoiceSchema.safeParse({ totalNetAmount: 1 }))).toEqual(['lineItems']);
  });

  it('PATCH χωρίς ποσά (π.χ. μόνο σημειώσεις) περνά', () => {
    expect(UpdateInvoiceSchema.safeParse({ notes: 'x' }).success).toBe(true);
  });

  it(`απορρίπτει πάνω από ${MAX_INVOICE_LINES} γραμμές`, () => {
    const lineItems = Array.from({ length: MAX_INVOICE_LINES + 1 }, (_, i) => ({ ...validLine, lineNumber: i + 1 }));
    expect(pathsOf(UpdateInvoiceSchema.safeParse({ lineItems }))).toContain('lineItems');
  });
});
