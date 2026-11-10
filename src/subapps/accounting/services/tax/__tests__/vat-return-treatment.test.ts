/**
 * @fileoverview vat-return-treatment — ο ΕΝΑΣ επιλυτής §8.3 → δήλωση ΦΠΑ (ADR-ACC-003 §22.7)
 */

import type { InvoiceType } from '../../../types/invoice';
import { MYDATA_SELF_ASSESSED_VAT_CATEGORIES, myDataVatCategoryOf } from '../../mydata/mydata-codes';
import type { VatExemptionCode } from '../../config/vat-exemption-reasons';
import type { CustomerVatFacts } from '../customer-vat-treatment';
import {
  recipientVatClassificationOf,
  resolveVatReturnTreatment,
  type VatReturnResolution,
  type VatReturnResolved,
} from '../vat-return-treatment';

const GREEK: CustomerVatFacts = { country: 'GR', vatNumber: '094014201' };
const EU_BUSINESS: CustomerVatFacts = { country: 'NL', vatNumber: 'NL123456789B01' };
const EU_CONSUMER: CustomerVatFacts = { country: 'NL', vatNumber: null };
const US_BUSINESS: CustomerVatFacts = { country: 'US', vatNumber: '12-3456789' };
const US_CONSUMER: CustomerVatFacts = { country: 'US', vatNumber: null };

function resolve(
  code: VatExemptionCode,
  customer: CustomerVatFacts = GREEK,
  invoiceType: InvoiceType = 'service_invoice',
): VatReturnResolution {
  return resolveVatReturnTreatment({ vatExemptionCategory: code, customer, invoiceType });
}

function expectResolved(result: VatReturnResolution): VatReturnResolved {
  if (result.kind !== 'resolved') throw new Error(`expected resolved, got ${result.kind}`);
  return result;
}

describe('αιτία 4 (τόπος παροχής) — κατά σενάριο του κριτή της §22.5', () => {
  it('επιχείρηση ΕΕ ⇒ 345 (ενδοκοινοτικές παροχές υπηρεσιών άρθρ. 18.2.α)', () => {
    const result = expectResolved(resolve(4, EU_BUSINESS, 'service_invoice_eu'));
    expect(result).toMatchObject({ field: 345, deductible: true, fidelity: 'exact', scenario: 'eu_business' });
  });

  it.each([
    ['επιχείρηση εκτός ΕΕ', US_BUSINESS, 'non_eu_business'],
    ['ιδιώτης εκτός ΕΕ (§15)', US_CONSUMER, 'non_eu_consumer'],
  ] as const)('%s ⇒ 349 (άρθρο 35 §2α)', (_label, customer, scenario) => {
    const result = expectResolved(resolve(4, customer, 'service_invoice_3rd'));
    expect(result).toMatchObject({ field: 349, deductible: true, scenario });
    expect(result.sources).toContain('vat_code_art35_2a');
  });

  it.each([
    ['ελληνικός πελάτης', GREEK],
    ['ιδιώτης ΕΕ (§2β)', EU_CONSUMER],
  ] as const)('%s ⇒ αντίφαση, όχι πεδίο', (_label, customer) => {
    expect(resolve(4, customer)).toEqual({ kind: 'needs_review', reason: 'scenario_mismatch' });
  });

  it('άγνωστη χώρα ⇒ καμία μαντεψιά ΕΕ / εκτός ΕΕ', () => {
    expect(resolve(4, { country: 'Atlantis', vatNumber: 'X1' })).toEqual({ kind: 'needs_review', reason: 'unknown_country' });
  });
});

describe('σταθερά πεδία', () => {
  it.each([
    [14, 342, true],
    [8, 348, true],
    [12, 348, true],
    [9, 349, true],
    [16, 349, true],
    [29, 349, true],
    [7, 310, false],
  ] as const)('αιτία %i ⇒ πεδίο %i (δικαίωμα έκπτωσης: %s), ανεξάρτητα από τον πελάτη', (code, field, deductible) => {
    for (const customer of [GREEK, EU_BUSINESS, US_CONSUMER]) {
      expect(expectResolved(resolve(code, customer))).toMatchObject({ field, deductible, scenario: null });
    }
  });
});

describe('ρητές απαντήσεις χωρίς πεδίο — ποτέ κενό', () => {
  it('αιτία 15 (μικρές επιχειρήσεις) ⇒ δεν υποβάλλεται Φ2 (άρθρο 44α §1)', () => {
    expect(resolve(15)).toEqual({ kind: 'not_filed', sources: ['vat_code_art44a_1'] });
  });

  it('αιτία 22 στο τιμολόγιο ⇒ χωρίς πεδίο (ΑΑΔΕ FAQ 2023)', () => {
    expect(resolve(22)).toEqual({ kind: 'not_reported', sources: ['aade_faq_2023'] });
  });

  it.each([1, 5, 11, 20, 31] as const)('αιτία %i ⇒ needs_review / unmapped (κρίση λογιστή)', (code) => {
    expect(resolve(code)).toEqual({ kind: 'needs_review', reason: 'unmapped' });
  });
});

describe('recipientVatClassificationOf — πλευρά λήπτη', () => {
  it('αιτία 16 ⇒ VAT_366 με κατηγορίες 24% / 17% (σφάλματα 317 / 334)', () => {
    expect(recipientVatClassificationOf(16)).toEqual({
      kind: 'required',
      classification: 'VAT_366',
      vatCategories: MYDATA_SELF_ASSESSED_VAT_CATEGORIES,
      sources: ['aade_mydata_317_334'],
    });
  });

  it('η κατηγορία 1 της αυτοεπιβάρυνσης είναι ο συντελεστής 24% του πίνακα συντελεστών', () => {
    expect(MYDATA_SELF_ASSESSED_VAT_CATEGORIES).toContain(myDataVatCategoryOf(24));
  });

  it.each([4, 7, 14, 15] as const)('αιτία %i ⇒ by_purchase (κρίνει η φύση της αγοράς)', (code) => {
    expect(recipientVatClassificationOf(code)).toEqual({ kind: 'by_purchase' });
  });
});
