/**
 * @fileoverview en16931-vat-treatment — ο ΕΝΑΣ επιλυτής §8.3 → EN 16931 (ADR-ACC-003 §22.6)
 */

import type { InvoiceType } from '../../../types/invoice';
import type { VatExemptionCode } from '../../config/vat-exemption-reasons';
import type { CustomerVatFacts } from '../customer-vat-treatment';
import {
  resolveEn16931VatTreatment,
  type En16931Profile,
  type En16931Resolution,
  type En16931Resolved,
} from '../en16931-vat-treatment';

const GREEK: CustomerVatFacts = { country: 'GR', vatNumber: '094014201' };
const EU_BUSINESS: CustomerVatFacts = { country: 'NL', vatNumber: 'NL123456789B01' };
const EU_CONSUMER: CustomerVatFacts = { country: 'NL', vatNumber: null };
const US_BUSINESS: CustomerVatFacts = { country: 'US', vatNumber: '12-3456789' };
const US_CONSUMER: CustomerVatFacts = { country: 'US', vatNumber: null };

function resolve(
  code: VatExemptionCode,
  customer: CustomerVatFacts = GREEK,
  profile: En16931Profile = 'en16931',
  invoiceType: InvoiceType = 'service_invoice',
): En16931Resolution {
  return resolveEn16931VatTreatment({ vatExemptionCategory: code, customer, invoiceType }, profile);
}

function expectResolved(result: En16931Resolution): En16931Resolved {
  if (result.kind !== 'resolved') throw new Error(`expected resolved, got ${result.reason}`);
  return result;
}

describe('αιτία 4 (τόπος παροχής) — κατά σενάριο του κριτή της §22.5', () => {
  it('επιχείρηση ΕΕ ⇒ AE + VATEX-EU-AE (Οδηγία 196 · 226 §11α), με ταυτοποίηση αγοραστή', () => {
    const result = expectResolved(resolve(4, EU_BUSINESS, 'en16931', 'service_invoice_eu'));
    expect(result).toMatchObject({ category: 'AE', vatex: 'VATEX-EU-AE', fidelity: 'exact', basis: 'customer_scenario' });
    expect(result.scenario).toBe('eu_business');
    expect(result.rules.buyerVatId).toBe('requiredOrRegistration');
  });

  it.each([
    ['επιχείρηση εκτός ΕΕ', US_BUSINESS, 'non_eu_business'],
    ['ιδιώτης εκτός ΕΕ (§15)', US_CONSUMER, 'non_eu_consumer'],
  ] as const)('%s ⇒ G + VATEX-EU-G (ΟΧΙ O: BR-O-02 απαγορεύει τον ΑΦΜ του πωλητή)', (_label, customer, scenario) => {
    const result = expectResolved(resolve(4, customer, 'en16931', 'service_invoice_3rd'));
    expect(result).toMatchObject({ category: 'G', vatex: 'VATEX-EU-G', fidelity: 'exact', scenario });
    expect(result.rules.sellerVatId).toBe('required');
  });

  it.each([
    ['ελληνικός πελάτης', GREEK, 'service_invoice'],
    ['ιδιώτης ΕΕ (άρθρο 18 §2β — ελληνικός ΦΠΑ)', EU_CONSUMER, 'service_invoice'],
    ['μη παροχή υπηρεσιών', EU_BUSINESS, 'sales_invoice'],
  ] as const)('%s ⇒ αντίφαση, ποτέ σιωπηλή μεταχείριση', (_label, customer, type) => {
    for (const profile of ['en16931', 'gr-b2g-peppol'] as const) {
      expect(resolve(4, customer, profile, type)).toEqual({ kind: 'needs_review', reason: 'scenario_mismatch' });
    }
  });

  it('άγνωστη χώρα ⇒ needs_review, χωρίς μαντεψιά ΕΕ / εκτός ΕΕ — και στο B2G', () => {
    const unknown: CustomerVatFacts = { country: 'Atlantis', vatNumber: 'X1' };
    for (const profile of ['en16931', 'gr-b2g-peppol'] as const) {
      expect(resolve(4, unknown, profile)).toEqual({ kind: 'needs_review', reason: 'unknown_country' });
    }
  });
});

describe('σταθερές μεταχειρίσεις του καταλόγου', () => {
  it.each([
    [14, 'K', 'VATEX-EU-IC'],
    [16, 'AE', 'VATEX-EU-AE'],
    [6, 'E', 'VATEX-EU-79-C'],
    [8, 'G', 'VATEX-EU-G'],
    [1, 'O', 'VATEX-EU-O'],
  ] as const)('αιτία %i ⇒ %s + %s, ανεξάρτητα από τον πελάτη', (code, category, vatex) => {
    for (const customer of [GREEK, EU_BUSINESS, US_CONSUMER]) {
      expect(expectResolved(resolve(code, customer))).toMatchObject({ category, vatex, basis: 'catalog', scenario: null });
    }
  });

  it('O φέρει τους κανόνες του: χωρίς ΑΦΜ πωλητή, αποκλειστική κατηγορία', () => {
    expect(expectResolved(resolve(1)).rules).toMatchObject({ sellerVatId: 'forbidden', exclusive: true });
  });

  it('E χωρίς VATEX (αιτία 7) ⇒ resolved με vatex null — αρκεί το BT-120 (BR-E-10)', () => {
    expect(expectResolved(resolve(7))).toMatchObject({ category: 'E', vatex: null, fidelity: 'article' });
  });
});

describe('προφίλ: unmapped και εφεδρεία ΓΓΠΣ', () => {
  it.each<VatExemptionCode>([5, 17, 18, 21, 24, 27, 29, 30, 31])('en16931: αιτία %i ⇒ needs_review(unmapped)', (code) => {
    expect(resolve(code)).toEqual({ kind: 'needs_review', reason: 'unmapped' });
  });

  it('gr-b2g-peppol: unmapped ⇒ O + VATEX-EU-O, ΣΗΜΑΔΕΜΕΝΟ ως εφεδρεία χωρίς αρχική κρίση', () => {
    expect(expectResolved(resolve(27, GREEK, 'gr-b2g-peppol'))).toMatchObject({
      category: 'O',
      vatex: 'VATEX-EU-O',
      fidelity: 'fallback',
      basis: 'gsis_fallback',
      supersededCategory: null,
    });
  });

  it('gr-b2g-peppol: E χωρίς VATEX (αιτία 15) ⇒ εφεδρεία που ΘΥΜΑΤΑΙ την κατηγορία E', () => {
    const result = expectResolved(resolve(15, GREEK, 'gr-b2g-peppol'));
    expect(result).toMatchObject({ category: 'O', basis: 'gsis_fallback', supersededCategory: 'E' });
    expect(result.rules.sellerVatId).toBe('forbidden');
  });

  it('gr-b2g-peppol: όπου υπάρχει VATEX, ΚΑΜΙΑ εφεδρεία', () => {
    expect(expectResolved(resolve(14, GREEK, 'gr-b2g-peppol'))).toMatchObject({ category: 'K', basis: 'catalog' });
  });
});
