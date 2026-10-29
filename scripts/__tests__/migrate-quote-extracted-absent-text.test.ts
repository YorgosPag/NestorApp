/**
 * ADR-327 §8.5.4 — η μετάπτωση του «null»-κειμένου: ιδεμποτική, γράφει μόνο `extractedData`, ξεχωρίζει καθαρισμό από
 * σκέτη σφραγίδα έκδοσης, και δεν αγγίζει προσφορές χωρίς εξαγωγή.
 */

import { planAbsentText } from '../migrate-quote-extracted-absent-text';
import { QUOTE_EXTRACTION_NORMALIZATION_VERSION } from '../../src/subapps/procurement/services/external/quote-extraction-version';

const field = <T>(value: T, confidence = 95) => ({ value, confidence });

function legacyExtraction(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    vendorName: field('MACON ATEE'), vendorVat: field('null', 0), vendorPhone: field('+30 2310 428900'),
    vendorEmails: field(['info@macon.gr']), vendorAddress: field(null, 0), vendorCity: field(null, 0),
    vendorPostalCode: field(null, 0), vendorCountry: field(null, 0), quoteDate: field('2023-07-07'),
    validUntil: field('null', 0), quoteReference: field(null, 0), lineItems: [],
    subtotal: field(null, 0), vatAmount: field(null, 0), totalAmount: field(null, 0),
    paymentTerms: field(null, 0), deliveryTerms: field(null, 0), warranty: field(null, 0), notes: field(null, 0),
    tradeHint: field(null, 0), pricingType: field(null, 0), vatIncluded: field(null, 0), laborIncluded: field(null, 0),
    vendorBankAccounts: [], detectedLanguage: 'el', overallConfidence: 90,
    ...overrides,
  };
}

describe('planAbsentText', () => {
  it('παλιά εξαγωγή με «null» ⇒ καθαρισμός, με τα πεδία που άλλαξαν, confidence αμετάβλητη', () => {
    const plan = planAbsentText({ extractedData: legacyExtraction() });
    expect(plan.kind).toBe('clean');
    if (plan.kind !== 'clean') return;
    expect(plan.changedFields).toEqual(['vendorVat', 'validUntil']);
    expect(plan.extractedData.vendorVat).toEqual({ value: null, confidence: 0 });
    expect(plan.extractedData.normalizationVersion).toBe(QUOTE_EXTRACTION_NORMALIZATION_VERSION);
  });

  it('παλιά εξαγωγή ΧΩΡΙΣ «null» ⇒ μόνο σφραγίδα έκδοσης (καμία ορατή αλλαγή)', () => {
    const plan = planAbsentText({ extractedData: legacyExtraction({ vendorVat: field(null, 0), validUntil: field(null, 0) }) });
    expect(plan.kind).toBe('stamp');
  });

  it('ιδεμποτική: ό,τι παρήγαγε το σχέδιο ⇒ καμία εγγραφή τη δεύτερη φορά', () => {
    const first = planAbsentText({ extractedData: legacyExtraction() });
    if (first.kind === 'noop') throw new Error('expected a write');
    expect(planAbsentText({ extractedData: first.extractedData })).toEqual({ kind: 'noop' });
  });

  it('προσφορά χωρίς εξαγωγή (χειροκίνητη) ⇒ καμία εγγραφή', () => {
    expect(planAbsentText({ extractedData: null })).toEqual({ kind: 'noop' });
    expect(planAbsentText({})).toEqual({ kind: 'noop' });
  });
});
