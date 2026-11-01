/**
 * @fileoverview Άγκυρες της κρίσης ΑΦΜ ↔ Αρ. ΓΕΜΗ — ADR-923 §5.13 Ε1β.
 */

import { judgeRegistryTaxBinding } from '@/lib/company/registry-tax-binding';

const NUMBER = '123456789000';
const OTHER = '999999999000';

describe('judgeRegistryTaxBinding', () => {
  it('ταιριάζει όταν ο δηλωμένος αριθμός είναι ανάμεσα σε πολλά αποτελέσματα', () => {
    const search = { kind: 'results', registrationNumbers: [OTHER, NUMBER] } as const;
    expect(judgeRegistryTaxBinding(NUMBER, search)).toEqual({ state: 'matched' });
  });

  it('δεν ταιριάζει όταν το ΑΦΜ ανήκει σε άλλον αριθμό', () => {
    const search = { kind: 'results', registrationNumbers: [OTHER] } as const;
    expect(judgeRegistryTaxBinding(NUMBER, search)).toEqual({ state: 'mismatched' });
  });

  it('κενή αναζήτηση σημαίνει not-found, όχι mismatched', () => {
    const search = { kind: 'results', registrationNumbers: [] } as const;
    expect(judgeRegistryTaxBinding(NUMBER, search)).toEqual({ state: 'not-found' });
  });

  it('μητρώο που δεν απάντησε μένει undetermined, ποτέ «όχι»', () => {
    const search = { kind: 'unavailable', reason: 'rate-limited' } as const;
    expect(judgeRegistryTaxBinding(NUMBER, search)).toEqual({ state: 'undetermined', reason: 'rate-limited' });
  });

  it('χωρίς έγκυρο αριθμό δεν υπάρχει σύγκριση, ακόμη κι αν το μητρώο απάντησε', () => {
    const search = { kind: 'results', registrationNumbers: [NUMBER] } as const;
    expect(judgeRegistryTaxBinding(null, search)).toEqual({ state: 'not-comparable', gap: 'no-registration-number' });
    expect(judgeRegistryTaxBinding('abc', search)).toEqual({ state: 'not-comparable', gap: 'no-registration-number' });
  });

  it('άκυρο ΑΦΜ ονομάζεται ως τέτοιο', () => {
    expect(judgeRegistryTaxBinding(NUMBER, { kind: 'invalid-tax-id' })).toEqual({ state: 'not-comparable', gap: 'invalid-tax-id' });
  });
});
