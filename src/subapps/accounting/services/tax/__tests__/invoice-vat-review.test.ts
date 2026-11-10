/**
 * @fileoverview invoice-vat-review — ο πρώτος καταναλωτής των επιλυτών §22.6 / §22.7 (ADR-ACC-003 §22.8)
 */

import type { InvoiceType } from '../../../types/invoice';
import type { CustomerVatFacts } from '../customer-vat-treatment';
import {
  INVOICE_VAT_REVIEW_CODES,
  INVOICE_VAT_REVIEW_SEVERITY,
  reviewInvoiceVat,
  type InvoiceVatFinding,
} from '../invoice-vat-review';

const GREEK: CustomerVatFacts = { country: 'GR', vatNumber: '094014201' };
const EU_BUSINESS: CustomerVatFacts = { country: 'NL', vatNumber: 'NL123456789B01' };
const UNKNOWN_COUNTRY: CustomerVatFacts = { country: 'Ατλαντίδα', vatNumber: 'X1' };

function review(
  lines: { vatRate: number; vatExemptionCategory?: number | null }[],
  customer: CustomerVatFacts = GREEK,
  type: InvoiceType = 'service_invoice',
): InvoiceVatFinding[] {
  return reviewInvoiceVat({
    type,
    customer,
    lineItems: lines.map((line, index) => ({ lineNumber: index + 1, ...line })),
  });
}

describe('βαθμίδες', () => {
  it('κάθε κωδικός έχει βαθμίδα — αντίφαση / άγνωστη χώρα = warn, κενό γνώσης = info', () => {
    expect(Object.keys(INVOICE_VAT_REVIEW_SEVERITY).sort()).toEqual([...INVOICE_VAT_REVIEW_CODES].sort());
    expect(INVOICE_VAT_REVIEW_SEVERITY).toEqual({
      VAT_EXEMPTION_SCENARIO_MISMATCH: 'warn',
      VAT_EXEMPTION_COUNTRY_UNKNOWN: 'warn',
      VAT_TREATMENT_UNMAPPED: 'info',
    });
  });
});

describe('ποιες γραμμές κρίνονται', () => {
  it('γραμμή 24% (ακόμη και με αιτία) ή 0% χωρίς αιτία ⇒ τίποτα (το «λείπει» είναι του preflight)', () => {
    expect(review([{ vatRate: 24, vatExemptionCategory: 1 }, { vatRate: 0, vatExemptionCategory: null }])).toEqual([]);
  });

  it('αιτία με πλήρη αντιστοίχιση (8 — εξαγωγή: 348 + G) ⇒ τίποτα', () => {
    expect(review([{ vatRate: 0, vatExemptionCategory: 8 }])).toEqual([]);
  });

  it('ρητή απάντηση χωρίς πεδίο (15 — δεν υποβάλλεται Φ2) ⇒ τίποτα: γνώση, όχι κενό', () => {
    expect(review([{ vatRate: 0, vatExemptionCategory: 15 }])).toEqual([]);
  });
});

describe('κενό αντιστοίχισης ⇒ ΕΝΑ εύρημα με τις διαστάσεις που το δίνουν', () => {
  it('αιτία 1: μόνο το Φ2 άγνωστο', () => {
    expect(review([{ vatRate: 0, vatExemptionCategory: 1 }])).toEqual([
      { code: 'VAT_TREATMENT_UNMAPPED', lineNumber: 1, vatExemptionCategory: 1, dimensions: ['vat_return'] },
    ]);
  });

  it('αιτία 29: μόνο η EN 16931 άγνωστη', () => {
    expect(review([{ vatRate: 0, vatExemptionCategory: 29 }])[0]?.dimensions).toEqual(['en16931']);
  });

  it('αιτία 5: και τα δύο — ένα εύρημα, όχι δύο', () => {
    const findings = review([{ vatRate: 0, vatExemptionCategory: 5 }]);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.dimensions).toEqual(['vat_return', 'en16931']);
  });
});

describe('αιτία 4 — ο ΕΝΑΣ κριτής τόπου παροχής', () => {
  it('Έλληνας πελάτης ⇒ αντίφαση, μία φορά, και στις δύο διαστάσεις', () => {
    expect(review([{ vatRate: 0, vatExemptionCategory: 4 }])).toEqual([
      {
        code: 'VAT_EXEMPTION_SCENARIO_MISMATCH', lineNumber: 1, vatExemptionCategory: 4,
        dimensions: ['vat_return', 'en16931'],
      },
    ]);
  });

  it('επιχείρηση ΕΕ σε 2.2 ⇒ τίποτα', () => {
    expect(review([{ vatRate: 0, vatExemptionCategory: 4 }], EU_BUSINESS, 'service_invoice_eu')).toEqual([]);
  });

  it('άγνωστη χώρα ⇒ COUNTRY_UNKNOWN, ποτέ μαντεψιά ΕΕ / εκτός ΕΕ', () => {
    const findings = review([{ vatRate: 0, vatExemptionCategory: 4 }], UNKNOWN_COUNTRY, 'service_invoice_eu');
    expect(findings.map((finding) => finding.code)).toEqual(['VAT_EXEMPTION_COUNTRY_UNKNOWN']);
  });

  it('η γραμμή κρατά τη θέση της', () => {
    const findings = review([{ vatRate: 24 }, { vatRate: 0, vatExemptionCategory: 4 }]);
    expect(findings[0]?.lineNumber).toBe(2);
  });
});
