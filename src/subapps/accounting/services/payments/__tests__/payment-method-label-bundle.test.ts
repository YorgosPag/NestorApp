/**
 * @jest-environment node
 *
 * ADR-ACC-030 §3 — η ετικέτα τρόπου πληρωμής έξω από το i18next (email πωλήσεων / λογιστηρίου): τα ΙΔΙΑ κλειδιά με
 * την UI, για ΚΑΘΕ `PaymentMethod`, και στις δύο γλώσσες. Πριν, τα email έγραφαν ωμό «card» / «iris».
 */

import elAccounting from '@/i18n/locales/el/accounting.json';
import enAccounting from '@/i18n/locales/en/accounting.json';

import type { PaymentMethod } from '../../../types/common';
import { paymentMethodLabelIn } from '../payment-method-label-bundle';

/** `Record` ⇒ νέος `PaymentMethod` χωρίς γραμμή εδώ δεν μεταγλωττίζεται — το test τον ζητά αυτόματα. */
const ALL_METHODS: Readonly<Record<PaymentMethod, true>> = {
  cash: true, bank_transfer: true, card: true, iris: true, check: true, credit: true, mixed: true, non_cash: true,
};

describe('paymentMethodLabelIn', () => {
  it.each(Object.keys(ALL_METHODS))('%s: η ετικέτα της UI και στις δύο γλώσσες — ποτέ ο κωδικός ή το κλειδί', (method) => {
    const el = paymentMethodLabelIn(method, 'el');
    const en = paymentMethodLabelIn(method, 'en');
    expect(el).toBe(elAccounting.common.paymentMethods[method as PaymentMethod]);
    expect(en).toBe(enAccounting.common.paymentMethods[method as PaymentMethod]);
    expect(el).not.toContain('paymentMethods');
  });

  it('IRIS και κάρτα: οι ετικέτες που έλειπαν από τα email', () => {
    expect(paymentMethodLabelIn('iris', 'el')).toBe('IRIS (άμεση πληρωμή)');
    expect(paymentMethodLabelIn('card', 'en')).toBe('Card');
  });

  it('άγνωστος τρόπος ⇒ ο ίδιος ο κωδικός (ορατή απουσία, ποτέ κλειδί i18n)', () => {
    expect(paymentMethodLabelIn('credit_card', 'el')).toBe('credit_card');
  });
});
