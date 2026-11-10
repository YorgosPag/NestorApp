/**
 * @fileoverview Αντιστοίχιση δήλωσης ΦΠΑ (Φ2 + χαρακτηρισμός λήπτη) μέσα στον ΕΝΑ κατάλογο αιτιών §8.3 (ADR-ACC-003 §22.7)
 *
 * Το «πάγωμα» του πίνακα είναι σκόπιμο: κάθε αλλαγή είναι **νομική** απόφαση και φαίνεται στο diff του test, μαζί με το ADR.
 */

import { MYDATA_EXPENSE_VAT_CLASSIFICATIONS } from '../../mydata/mydata-codes';
import { CUSTOMER_VAT_SCENARIOS } from '../../tax/customer-vat-treatment';
import {
  VAT_EXEMPTION_REASONS,
  vatReturnMappingOf,
  type VatReturnFieldTreatment,
  type VatReturnOutputMapping,
} from '../vat-exemption-reasons';
import { VAT_RETURN_EXEMPT_OUTPUT_FIELDS, isDeductibleVatReturnField } from '../vat-return-form';

function fieldTreatmentsOf(output: VatReturnOutputMapping): readonly VatReturnFieldTreatment[] {
  if (output.kind === 'field') return [output];
  if (output.kind === 'byCustomerScenario') return CUSTOMER_VAT_SCENARIOS.map((s) => output.byScenario[s]);
  return [];
}

function summary(output: VatReturnOutputMapping): string {
  if (output.kind === 'field') return `${output.field}/${output.fidelity}`;
  if (output.kind === 'byCustomerScenario') {
    return CUSTOMER_VAT_SCENARIOS.map((s) => `${s}:${summary(output.byScenario[s])}`).join(' ');
  }
  return output.kind;
}

describe('VAT_RETURN_EXEMPT_OUTPUT_FIELDS (Φ2 2025)', () => {
  it('τα πέντε πεδία εκροών χωρίς ΦΠΑ, μόνο το 310 χωρίς δικαίωμα έκπτωσης', () => {
    expect(VAT_RETURN_EXEMPT_OUTPUT_FIELDS.map((f) => f.field)).toEqual([342, 345, 348, 349, 310]);
    expect(VAT_RETURN_EXEMPT_OUTPUT_FIELDS.filter((f) => !isDeductibleVatReturnField(f.field)).map((f) => f.field)).toEqual([310]);
  });
});

describe('VAT_EXEMPTION_REASONS[].vatReturn', () => {
  it('και οι 31 αιτίες έχουν αντιστοίχιση (ή ρητό unmapped), κάθε μεταχείριση με επίσημη πηγή', () => {
    expect(VAT_EXEMPTION_REASONS).toHaveLength(31);
    for (const reason of VAT_EXEMPTION_REASONS) {
      expect(reason.vatReturn).toBeDefined();
      for (const treatment of fieldTreatmentsOf(reason.vatReturn.output)) {
        expect([reason.code, treatment.sources.length > 0]).toEqual([reason.code, true]);
      }
    }
  });

  it('ο πίνακας εκδότη → Φ2 (νομική απόφαση — αλλάζει μόνο μαζί με το ADR-ACC-003 §22.7)', () => {
    const table = Object.fromEntries(VAT_EXEMPTION_REASONS.map((r) => [r.code, summary(r.vatReturn.output)]));
    expect(table).toEqual({
      1: 'unmapped',
      2: 'unmapped',
      3: '349/article',
      4: 'eu_business:345/exact non_eu_business:349/exact non_eu_consumer:349/exact',
      5: 'unmapped',
      6: 'unmapped',
      7: '310/article',
      8: '348/exact',
      9: '349/article',
      10: '349/article',
      11: 'unmapped',
      12: '348/exact',
      13: '348/exact',
      14: '342/exact',
      15: 'not_filed',
      16: '349/article',
      17: 'unmapped',
      18: 'unmapped',
      19: 'unmapped',
      20: 'unmapped',
      21: 'unmapped',
      22: 'not_reported',
      23: 'unmapped',
      24: 'unmapped',
      25: 'unmapped',
      26: 'unmapped',
      27: 'unmapped',
      28: '348/exact',
      29: '349/exact',
      30: '349/exact',
      31: 'unmapped',
    });
  });

  it('λήπτης: ΜΟΝΟ η αιτία 16 απαιτεί χαρακτηρισμό — VAT_366 με αυτοεπιβάρυνση (σφάλματα 317 / 334)', () => {
    const required = VAT_EXEMPTION_REASONS.filter((r) => r.vatReturn.recipient.kind === 'required').map((r) => r.code);
    expect(required).toEqual([16]);
    expect(vatReturnMappingOf(16).recipient).toEqual({
      kind: 'required', classification: 'VAT_366', selfAssessed: true, sources: ['aade_mydata_317_334'],
    });
  });

  it('ο χαρακτηρισμός λήπτη είναι κωδικός του §8.11', () => {
    const recipient = vatReturnMappingOf(16).recipient;
    if (recipient.kind !== 'required') throw new Error('expected required');
    expect(MYDATA_EXPENSE_VAT_CLASSIFICATIONS).toContain(recipient.classification);
  });
});
