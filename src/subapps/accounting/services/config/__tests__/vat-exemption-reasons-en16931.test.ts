/**
 * @fileoverview Αντιστοίχιση EN 16931 μέσα στον ΕΝΑ κατάλογο αιτιών §8.3 (ADR-ACC-003 §22.6)
 *
 * Το «πάγωμα» του πίνακα είναι σκόπιμο: κάθε αλλαγή αντιστοίχισης είναι **νομική** απόφαση και πρέπει να φαίνεται στο
 * diff του test, μαζί με το ADR.
 */

import { CUSTOMER_VAT_SCENARIOS } from '../../tax/customer-vat-treatment';
import { vatexCategory } from '../en16931-vat-codes';
import {
  VAT_EXEMPTION_REASONS,
  en16931MappingOf,
  type En16931ExemptionMapping,
  type En16931FixedTreatment,
} from '../vat-exemption-reasons';

function fixedTreatmentsOf(mapping: En16931ExemptionMapping): readonly En16931FixedTreatment[] {
  if (mapping.kind === 'fixed') return [mapping];
  if (mapping.kind === 'byCustomerScenario') return CUSTOMER_VAT_SCENARIOS.map((s) => mapping.byScenario[s]);
  return [];
}

function summary(mapping: En16931ExemptionMapping): string {
  if (mapping.kind === 'unmapped') return 'unmapped';
  if (mapping.kind === 'fixed') return `${mapping.category}/${mapping.vatex ?? '—'}/${mapping.fidelity}`;
  return CUSTOMER_VAT_SCENARIOS.map((s) => `${s}:${summary(mapping.byScenario[s])}`).join(' ');
}

describe('VAT_EXEMPTION_REASONS[].en16931', () => {
  it('και οι 31 αιτίες έχουν αντιστοίχιση (ή ρητό unmapped)', () => {
    expect(VAT_EXEMPTION_REASONS).toHaveLength(31);
    for (const reason of VAT_EXEMPTION_REASONS) expect(reason.en16931).toBeDefined();
  });

  it('δεσμός κατηγορίας ↔ VATEX (Peppol P0104–P0111) σε κάθε μεταχείριση', () => {
    for (const reason of VAT_EXEMPTION_REASONS) {
      for (const treatment of fixedTreatmentsOf(reason.en16931)) {
        if (treatment.vatex !== null) expect([reason.code, vatexCategory(treatment.vatex)]).toEqual([reason.code, treatment.category]);
      }
    }
  });

  it('VATEX null μόνο σε κατηγορία E — στις AE / K / G / O το BR-x-10 θέλει τον κωδικό της κατηγορίας', () => {
    for (const reason of VAT_EXEMPTION_REASONS) {
      for (const treatment of fixedTreatmentsOf(reason.en16931)) {
        if (treatment.vatex === null) expect([reason.code, treatment.category]).toEqual([reason.code, 'E']);
      }
    }
  });

  it('ο πίνακας (νομική απόφαση — αλλάζει μόνο μαζί με το ADR-ACC-003 §22.6)', () => {
    const table = Object.fromEntries(VAT_EXEMPTION_REASONS.map((r) => [r.code, summary(r.en16931)]));
    expect(table).toEqual({
      1: 'O/VATEX-EU-O/exact',
      2: 'O/VATEX-EU-O/exact',
      3: 'O/VATEX-EU-O/article',
      4: 'eu_business:AE/VATEX-EU-AE/exact non_eu_business:G/VATEX-EU-G/exact non_eu_consumer:G/VATEX-EU-G/exact',
      5: 'unmapped',
      6: 'E/VATEX-EU-79-C/exact',
      7: 'E/—/article',
      8: 'G/VATEX-EU-G/article',
      9: 'E/—/article',
      10: 'E/—/article',
      11: 'E/—/article',
      12: 'E/VATEX-EU-148/article',
      13: 'E/VATEX-EU-148/article',
      14: 'K/VATEX-EU-IC/exact',
      15: 'E/—/exact',
      16: 'AE/VATEX-EU-AE/exact',
      17: 'unmapped',
      18: 'unmapped',
      19: 'E/—/article',
      20: 'E/—/article',
      21: 'unmapped',
      22: 'E/VATEX-EU-F/article',
      23: 'E/—/article',
      24: 'unmapped',
      25: 'unmapped',
      26: 'unmapped',
      27: 'unmapped',
      28: 'G/VATEX-EU-G/article',
      29: 'unmapped',
      30: 'unmapped',
      31: 'unmapped',
    });
  });

  it('en16931MappingOf διαβάζει τον κατάλογο (ίδιο αντικείμενο, όχι αντίγραφο)', () => {
    for (const reason of VAT_EXEMPTION_REASONS) expect(en16931MappingOf(reason.code)).toBe(reason.en16931);
  });
});
