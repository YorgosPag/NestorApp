/**
 * ΑΓΚΥΡΕΣ — **σύνολο διαμονής με ημερομηνίες** (ADR-777 §8.60.12).
 *
 * 🔴 Η κρίσιμη ομάδα είναι η **Σ1**: τιμή διαμονής για ημερομηνίες που το κατάλυμα **δεν**
 * δέχεται είναι αριθμός για κάτι που δεν αγοράζεται. Ελέγχονται **όλα** τα «όχι», όχι
 * δείγμα.
 */

import { NO_STAY_TOTALS, stayTotalOf, stayTotalsOf } from '../listing-stay-total';
import type { PublicStayAnswer } from '@/lib/stay/stay-public-request';
import type { StayAvailabilityAnswer } from '@/lib/stay/stay-availability-vocabulary';
import type { StayQuote } from '@/lib/stay/stay-nightly-quote';

const PRICED: StayQuote = {
  kind: 'priced',
  nights: [
    { date: '2026-10-03', amountMinor: 5000, source: 'base' },
    { date: '2026-10-04', amountMinor: 6500, source: 'day' },
    { date: '2026-10-05', amountMinor: 5000, source: 'base' },
  ],
  totalMinor: 16500,
};

function stay(answer: StayAvailabilityAnswer, quote: StayQuote | null = PRICED): PublicStayAnswer {
  return { answer, quote };
}

describe('Σ1 — σύνολο ΜΟΝΟ για διαθέσιμη διαμονή', () => {
  it('διαθέσιμη + τιμολογημένη ⇒ σύνολο του διακομιστή και πλήθος νυχτών', () => {
    expect(stayTotalOf(stay({ kind: 'free' }))).toEqual({ totalMinor: 16500, nights: 3 });
  });

  it.each<[string, StayAvailabilityAnswer]>([
    ['κατειλημμένο', { kind: 'occupied' } as StayAvailabilityAnswer],
    ['υπό όρους', { kind: 'conditional', conditionalFrom: null }],
    ['λιγότερες νύχτες από το ελάχιστο', { kind: 'below-min-nights', minNights: 5, asked: 3 }],
    ['περισσότερα άτομα', { kind: 'over-capacity', maxGuests: 2, asked: 4 }],
    ['άγνωστοι όροι', { kind: 'terms-unknown' }],
    ['δεν διαβάστηκε', { kind: 'unreadable' }],
    ['δεν είναι κατάλυμα', { kind: 'not-a-stay' }],
  ])('ΚΑΝΕΝΑ σύνολο όταν η απάντηση είναι «%s»', (_label, answer) => {
    expect(stayTotalOf(stay(answer))).toBeNull();
  });
});

describe('Σ2 — σύνολο ΜΟΝΟ όταν τιμολογείται ΚΑΘΕ νύχτα', () => {
  it('νύχτες χωρίς τιμή ⇒ κανένα μερικό άθροισμα', () => {
    expect(stayTotalOf(stay({ kind: 'free' }, { kind: 'unpriced', missing: ['2026-10-04'] }))).toBeNull();
  });

  it('χωρίς τιμολόγηση ⇒ κανένα σύνολο', () => {
    expect(stayTotalOf(stay({ kind: 'free' }, null))).toBeNull();
  });

  it('μηδέν νύχτες ⇒ κανένα σύνολο («0 € · 0 νύχτες» δεν είναι απάντηση)', () => {
    expect(stayTotalOf(stay({ kind: 'free' }, { kind: 'priced', nights: [], totalMinor: 0 }))).toBeNull();
  });

  it('καμία απάντηση ⇒ κανένα σύνολο', () => {
    expect(stayTotalOf(undefined)).toBeNull();
  });
});

describe('Σ3 — ο πίνακας συνόλων', () => {
  it('κρατά ΜΟΝΟ τις αγγελίες με σύνολο', () => {
    const totals = stayTotalsOf({
      a: stay({ kind: 'free' }),
      b: stay({ kind: 'occupied' } as StayAvailabilityAnswer),
      c: stay({ kind: 'free' }, null),
    });
    expect(totals).toEqual({ a: { totalMinor: 16500, nights: 3 } });
  });

  it('η κενή προεπιλογή είναι ΕΝΑ παγωμένο αντικείμενο', () => {
    expect(Object.isFrozen(NO_STAY_TOTALS)).toBe(true);
    expect(NO_STAY_TOTALS).toEqual({});
  });
});
