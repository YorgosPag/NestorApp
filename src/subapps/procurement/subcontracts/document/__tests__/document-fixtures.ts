/**
 * Κοινά δεδομένα των tests του εγγράφου (ADR-928 §5.17) — ένας ορισμός, πολλές σουίτες (CHECK 3.28).
 */

import { plasteringTerms, sampleAgreement, SAMPLE_LINE } from '../../agreements/__tests__/agreement-fixtures';
import { buildAgreementSnapshot } from '../../agreements/agreement-snapshot';
import { paymentInstrument, retentionBody, retentionRate } from '../../clauses/__tests__/clause-fixtures';
import type { FrozenClause, SubcontractAgreementSnapshot } from '../../types/agreement';
import type { PaymentPlan } from '../../types/payment-plan';

/** Το παράδειγμα του ADR-928 §5.4.1: ανά δύο εβδομάδες την Παρασκευή, εξόφληση μετά τον φέροντα οργανισμό, 50/50. */
export const ADR_EXAMPLE_PLAN: PaymentPlan = {
  ...plasteringTerms.paymentPlan,
  basis: 'measured_progress',
  schedule: { kind: 'recurring', every: 2, unit: 'week', anchor: { kind: 'weekday', weekday: 5 }, holidayShift: 'previous_business_day' },
  finalSettlement: { kind: 'milestone', milestone: 'structure.frame_complete' },
  settlement: {
    regular: [{ instrument: 'bank_transfer', share: 10_000 }],
    final: [{ instrument: 'bank_transfer', share: 5_000 }, { instrument: 'cheque', share: 5_000, chequeMaturityDays: 120 }],
  },
};

/** Ρήτρα κράτησης παγωμένη με αγγλική μετάφραση· η ρήτρα μέσου πληρωμής χωρίς μετάφραση. */
export const RETENTION_CLAUSE: FrozenClause = {
  clauseId: 'sccl_retention', clauseKey: 'retention.performance', version: 1, contentHash: 'h1',
  title: { el: 'Κράτηση καλής εκτέλεσης', en: 'Performance retention' }, body: retentionBody, parameters: [retentionRate],
  translations: {
    en: {
      body: { heading: 'Performance retention', blocks: [{ kind: 'paragraph', inlines: [{ kind: 'text', text: 'Each payment withholds ' }, { kind: 'param', key: 'rate' }, { kind: 'text', text: '.' }] }] },
      status: 'approved', origin: 'human', sourceHash: 's1', proposedBy: 'u1', approvedBy: 'u2', approvedAt: '2026-11-01T00:00:00.000Z',
    },
  },
  values: { rate: { kind: 'percent', value: 500 } },
};

export const INSTRUMENT_CLAUSE: FrozenClause = {
  clauseId: 'sccl_instruments', clauseKey: 'payment.instruments', version: 2, contentHash: 'h2',
  title: { el: 'Μέσο πληρωμής' },
  body: { heading: 'Μέσο πληρωμής', blocks: [{ kind: 'paragraph', inlines: [{ kind: 'text', text: 'Πληρωμή: ' }, { kind: 'param', key: 'instrument' }, { kind: 'text', text: ' · ' }, { kind: 'param', key: 'absent' }] }] },
  parameters: [paymentInstrument], translations: {}, values: { instrument: { kind: 'enum', value: 'bank' } },
};

/** Δύο γραμμές: μία με ποσότητα (120 m² × 9,00 €), μία χωρίς ⇒ η αξία είναι κατώτατο. */
export function sampleSnapshot(): SubcontractAgreementSnapshot {
  const agreement = sampleAgreement({
    lines: [{ ...SAMPLE_LINE, estimatedMilliQuantity: 120_000 }, { ...SAMPLE_LINE, id: 'extra', description: { el: 'Πρόσθετο επίχρισμα', en: 'Extra plaster' } }],
    terms: { ...plasteringTerms, minimumOutputs: [], paymentPlan: ADR_EXAMPLE_PLAN },
  });
  return buildAgreementSnapshot(agreement, [RETENTION_CLAUSE, INSTRUMENT_CLAUSE]);
}
