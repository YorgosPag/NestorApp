/**
 * @jest-environment node
 *
 * Άγκυρες της μετάπτωσης νομικής μορφής (ADR-948 §8) — η καθαρή κρίση ανά επαφή (`planLegalForm`).
 * Ιδεμπότητα: ό,τι γράφει η μετάπτωση, το επόμενο πέρασμα το βλέπει ως `none`.
 */

import { planLegalForm } from '../migration-operations';

describe('planLegalForm — τι γίνεται σε μία επαφή', () => {
  it('Μ1 — παλαιά κεφαλαία ⇒ ξαναγράφεται στον κωδικό', () => {
    expect(planLegalForm('AE')).toEqual({ kind: 'rewrite', from: 'AE', to: 'ae' });
    expect(planLegalForm('SOLE_PROPRIETORSHIP')).toEqual({ kind: 'rewrite', from: 'SOLE_PROPRIETORSHIP', to: 'sole_proprietorship' });
  });

  it('Μ2 — ήδη κωδικός · κενό · απόν ⇒ τίποτα', () => {
    expect(planLegalForm('ae')).toEqual({ kind: 'none' });
    expect(planLegalForm('')).toEqual({ kind: 'none' });
    expect(planLegalForm(undefined)).toEqual({ kind: 'none' });
  });

  it('Μ3 — 🔴 άγνωστη τιμή ⇒ ΑΝΕΓΓΙΧΤΗ, αναφέρεται', () => {
    expect(planLegalForm('Ltd')).toEqual({ kind: 'unrecognized', value: 'Ltd' });
  });

  it('Μ4 — ιδεμπότητα: ό,τι γράφτηκε, ξανακρίνεται ως `none`', () => {
    for (const legacy of ['AE', 'ΕΠΕ', 'OTHER', ' ike ']) {
      const plan = planLegalForm(legacy);
      expect(plan.kind).toBe('rewrite');
      if (plan.kind === 'rewrite') expect(planLegalForm(plan.to)).toEqual({ kind: 'none' });
    }
  });
});
