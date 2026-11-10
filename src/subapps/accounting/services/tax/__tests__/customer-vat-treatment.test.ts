/**
 * @fileoverview customer-vat-treatment — ο ΕΝΑΣ κριτής τόπου παροχής από τον πελάτη (ADR-ACC-003 §22.5)
 */

import { GREEK_EXEMPT_VAT_RATE } from '../../config/vat-rates';
import { requiresVatExemption } from '../../mydata/mydata-codes';
import type { InvoiceType } from '../../../types/invoice';
import {
  PLACE_OF_SUPPLY_EXEMPTION_CODE,
  assessCustomerVatTreatment,
  customerVatSuggestionKey,
  lineVatDefaultOf,
  resolveByCustomerScenario,
  type CustomerVatFacts,
  type CustomerVatSuggestion,
} from '../customer-vat-treatment';

const customer = (country: string, vatNumber: string | null = null): CustomerVatFacts => ({ country, vatNumber });

function expectSuggestion(facts: CustomerVatFacts, type: InvoiceType = 'service_invoice'): CustomerVatSuggestion {
  const result = assessCustomerVatTreatment(facts, type);
  if (result.kind !== 'suggestion') throw new Error(`expected suggestion, got ${result.kind}`);
  return result;
}

describe('assessCustomerVatTreatment — καμία πρόταση όπου ο ΦΠΑ είναι ελληνικός', () => {
  it.each([
    ['ελληνικός πελάτης (κωδικός)', customer('GR', '094014201')],
    ['ελληνικός πελάτης (ετικέτα)', customer('Ελλάδα', '094014201')],
    ['κενή χώρα', customer('', null)],
    ['ιδιώτης ΕΕ — άρθρο 18 παρ. 2β', customer('NL', null)],
    ['ιδιώτης ΕΕ με κενό ΑΦΜ', customer('DE', '   ')],
  ])('%s', (_label, facts) => {
    expect(assessCustomerVatTreatment(facts, 'service_invoice')).toEqual({ kind: 'none' });
  });

  it.each<InvoiceType>(['sales_invoice', 'retail_receipt', 'service_receipt', 'credit_invoice'])(
    'τύπος %s: ο τόπος παροχής υπηρεσιών δεν κρίνεται (αγαθά 1.2/1.3 δεν υποστηρίζονται, πιστωτικό = αρχικό)',
    (type) => {
      expect(assessCustomerVatTreatment(customer('NL', 'NL123456789B01'), type)).toEqual({ kind: 'none' });
    },
  );
});

describe('assessCustomerVatTreatment — άγνωστη χώρα', () => {
  it('δεν μαντεύει: επιστρέφει το κείμενο, όχι πρόταση', () => {
    expect(assessCustomerVatTreatment(customer('Switzerland', 'CHE-123'), 'service_invoice')).toEqual({
      kind: 'unknown_country',
      country: 'Switzerland',
    });
  });
});

describe('assessCustomerVatTreatment — σενάρια', () => {
  it('επιχείρηση ΕΕ ⇒ 0% · κωδ. 4 · 2.2 · παρ. 2α · επιφυλάξεις ακινήτου και μη επαληθευμένου ΑΦΜ', () => {
    const result = expectSuggestion(customer('Ολλανδία', 'NL123456789B01'));
    expect(result).toEqual({
      kind: 'suggestion',
      scenario: 'eu_business',
      countryCode: 'NL',
      vatRate: GREEK_EXEMPT_VAT_RATE,
      vatExemptionCategory: 4,
      invoiceType: 'service_invoice_eu',
      basis: 'art18_2a',
      caveats: ['immovableProperty', 'vatNumberNotVerified'],
    });
  });

  it('επιχείρηση εκτός ΕΕ ⇒ 2.3 · παρ. 2α', () => {
    const result = expectSuggestion(customer('US', '12-3456789'));
    expect(result.scenario).toBe('non_eu_business');
    expect(result.invoiceType).toBe('service_invoice_3rd');
    expect(result.basis).toBe('art18_2a');
  });

  it('ιδιώτης εκτός ΕΕ ⇒ 2.3 · παρ. 15 με όρο «μόνο οι υπηρεσίες της παραγράφου»', () => {
    const result = expectSuggestion(customer('GB', null));
    expect(result.scenario).toBe('non_eu_consumer');
    expect(result.basis).toBe('art18_15');
    expect(result.caveats).toEqual(['listedServicesOnly', 'immovableProperty']);
  });

  it('η κρίση δεν εξαρτάται από το ποιο 2.x έχει ήδη επιλεγεί', () => {
    const facts = customer('DE', 'DE123456789');
    expect(expectSuggestion(facts, 'service_invoice_eu')).toEqual(expectSuggestion(facts, 'service_invoice'));
    expect(expectSuggestion(facts, 'service_invoice_3rd').invoiceType).toBe('service_invoice_eu');
  });

  it('ο κωδικός της πρότασης είναι αιτία που ο συντελεστής δέχεται (καμία αντίφαση)', () => {
    expect(PLACE_OF_SUPPLY_EXEMPTION_CODE).toBe(4);
    expect(requiresVatExemption(GREEK_EXEMPT_VAT_RATE)).toBe(true);
  });
});

describe('lineVatDefaultOf / customerVatSuggestionKey', () => {
  const suggestion = expectSuggestion(customer('FR', 'FR12345678901'));

  it('η αποδεκτή πρόταση γίνεται αφετηρία γραμμής 0% + κωδ. 4', () => {
    expect(lineVatDefaultOf(suggestion)).toEqual({ vatRate: GREEK_EXEMPT_VAT_RATE, vatExemptionCategory: 4 });
  });

  it('αλλάζει η ταυτότητα όταν αλλάζει ΑΦΜ ή χώρα — η απόρριψη δεν «κολλά» σε άλλον πελάτη', () => {
    const base = customerVatSuggestionKey(customer('FR', 'FR12345678901'), suggestion);
    const otherVat = customerVatSuggestionKey(customer('FR', 'FR99999999999'), suggestion);
    const otherCountry = expectSuggestion(customer('IT', 'FR12345678901'));
    expect(otherVat).not.toBe(base);
    expect(customerVatSuggestionKey(customer('IT', 'FR12345678901'), otherCountry)).not.toBe(base);
  });
});

describe('resolveByCustomerScenario — η μία γέφυρα δεδομένων ανά σενάριο (§22.6 · §22.7)', () => {
  const byScenario = { eu_business: 'A', non_eu_business: 'B', non_eu_consumer: 'C' } as const;

  it.each([
    [customer('NL', 'NL123456789B01'), 'service_invoice_eu', 'A', 'eu_business'],
    [customer('US', '12-3456789'), 'service_invoice_3rd', 'B', 'non_eu_business'],
    [customer('US'), 'service_invoice_3rd', 'C', 'non_eu_consumer'],
  ] as const)('%o ⇒ η τιμή του σεναρίου του κριτή', (facts, type, value, scenario) => {
    expect(resolveByCustomerScenario(byScenario, facts, type)).toEqual({ value, scenario });
  });

  it('ελληνικός πελάτης / ιδιώτης ΕΕ / τιμολόγιο πώλησης ⇒ scenario_mismatch', () => {
    expect(resolveByCustomerScenario(byScenario, customer('GR', '094014201'), 'service_invoice')).toBe('scenario_mismatch');
    expect(resolveByCustomerScenario(byScenario, customer('NL'), 'service_invoice')).toBe('scenario_mismatch');
    expect(resolveByCustomerScenario(byScenario, customer('US', '1'), 'sales_invoice')).toBe('scenario_mismatch');
  });

  it('άγνωστη χώρα ⇒ unknown_country', () => {
    expect(resolveByCustomerScenario(byScenario, customer('Atlantis', 'X1'), 'service_invoice')).toBe('unknown_country');
  });
});
