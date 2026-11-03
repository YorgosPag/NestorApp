import { describePaymentPlan } from '../describe-payment-plan';
import { documentLocaleOf } from '../document-locale';
import type { PaymentPlan } from '../../types/payment-plan';
import { ADR_EXAMPLE_PLAN } from './document-fixtures';

const el = documentLocaleOf('el');
const en = documentLocaleOf('en');
const RAW_KEY = /\b(plan|parameter|milestones)\.[a-z_.]+/;

describe('describePaymentPlan — το παράδειγμα του ADR-928 §5.4.1', () => {
  it('ελληνικά', () => {
    const text = describePaymentPlan(ADR_EXAMPLE_PLAN, el);
    expect(text).toContain('Η πληρωμή γίνεται κάθε 2 εβδομάδες, την Παρασκευή, αν η ημέρα δεν είναι εργάσιμη, την προηγούμενη εργάσιμη.');
    expect(text).toContain('Η εξόφληση γίνεται με το ορόσημο «ολοκλήρωση του φέροντος οργανισμού».');
    expect(text).toContain('Τρόπος πληρωμής: με τραπεζική μεταφορά.');
    expect(text).toContain('Τρόπος εξόφλησης: 50% με τραπεζική μεταφορά και 50% με επιταγή 4 μηνών.');
    expect(text.join(' ')).not.toMatch(RAW_KEY);
  });

  it('αγγλικά, από τα ίδια δεδομένα', () => {
    const text = describePaymentPlan(ADR_EXAMPLE_PLAN, en);
    expect(text).toContain('Payment is made every 2 weeks, on Friday, on the previous business day if that day is not a business day.');
    expect(text).toContain('Final payment method: 50% by bank transfer and 50% by cheque at 4 months.');
    expect(text.join(' ')).not.toMatch(RAW_KEY);
  });
});

describe('describePaymentPlan — κάθε κλάδος αποδίδεται', () => {
  const plan = (patch: Partial<PaymentPlan>): PaymentPlan => ({ ...ADR_EXAMPLE_PLAN, ...patch });

  it.each<[string, Partial<PaymentPlan>, string]>([
    ['με το πέρας', { schedule: { kind: 'on_completion' } }, 'Η πληρωμή γίνεται με το πέρας των εργασιών.'],
    ['με αίτημα', { schedule: { kind: 'on_request' } }, 'Η πληρωμή γίνεται με την υποβολή λογαριασμού.'],
    ['ημέρες του μήνα', { schedule: { kind: 'recurring', every: 1, unit: 'month', anchor: { kind: 'month_days', days: [5, 20] }, holidayShift: 'none' } }, 'Η πληρωμή γίνεται κάθε μήνα, στις 5 και 20 του μήνα.'],
    ['οριστική παραλαβή', { finalSettlement: { kind: 'final_acceptance' } }, 'Η εξόφληση γίνεται με την οριστική παραλαβή.'],
    ['ημέρες μετά', { finalSettlement: { kind: 'days_after_completion', days: 30 } }, 'Η εξόφληση γίνεται 30 ημέρες μετά το πέρας των εργασιών.'],
    ['προκαταβολή', { advance: { amount: 100_000, recovery: { kind: 'per_payment', rate: 2_000 } } }, 'Προκαταβολή 1.000 €, που συμψηφίζεται κατά 20% σε κάθε λογαριασμό.'],
    ['επιταγή σε ημέρες', { settlement: { regular: [{ instrument: 'cheque', share: 10_000, chequeMaturityDays: 45 }], final: null } }, 'Τρόπος πληρωμής: με επιταγή 45 ημερών.'],
  ])('%s', (_label, patch, expected) => {
    // Το `Intl` βάζει NBSP πριν το «€»· σωστό για τυπογραφία, αδιάφορο για τη σύγκριση.
    expect(describePaymentPlan(plan(patch), el).map((text) => text.replace(/ /g, ' '))).toContain(expected);
  });

  it('κράτηση με δόσεις αποδέσμευσης', () => {
    const text = describePaymentPlan(plan({
      retention: { rate: 500, release: [{ share: 5_000, trigger: { kind: 'provisional_acceptance' } }, { share: 5_000, trigger: { kind: 'months_after', event: 'provisional_acceptance', months: 12 } }] },
    }), el);
    expect(text).toContain('Κράτηση καλής εκτέλεσης 5%, που αποδίδεται 50% στην προσωρινή παραλαβή και 50% 12 μήνες μετά την προσωρινή παραλαβή.');
  });
});
