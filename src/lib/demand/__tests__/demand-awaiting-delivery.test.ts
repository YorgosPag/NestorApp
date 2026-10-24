/**
 * ΑΓΚΥΡΕΣ — «χτίζονται N»: όσες ταιριάζουν σε ΟΛΑ εκτός από τον χρόνο (ADR-919 §12 · ADR-777 §8.99.2 (β)).
 *
 * 🔴 Περνούν από την **πραγματική** `matchDemand`, όχι από outcomes γραμμένα με το χέρι: το ελάττωμα που βρέθηκε
 * (μόνο-χρόνος ⇒ `nearMissed`, ποτέ `rejected`) ήταν αόρατο ακριβώς επειδή η σουίτα του ορίζοντα έφτιαχνε outcomes
 * χωρίς μηχανή.
 */

import { scheduledAvailability } from '@/lib/listings/availability-window';
import type { AvailabilityTrack, ScheduledAvailability } from '@/types/availability-history';
import type { DemandTiming } from '@/types/property-demand';

import { awaitingDeliveryOf, compareDeliveryPromise, isAwaitingDelivery } from '../demand-awaiting-delivery';
import { matchDemand } from '../demand-matching';
import { TODAY, demand, facts, listing, seek } from './demand-fixtures';

function scheduled(precision: 'quarter' | 'month' | 'day', anchor: string): ScheduledAvailability {
  const availability = scheduledAvailability(precision, anchor);
  if (availability.kind !== 'scheduled') throw new Error(`fixture: ${anchor} is not a valid ${precision}`);
  return availability;
}

const Q4_2026 = scheduled('quarter', '2026-10-01');
const Q4_2027 = scheduled('quarter', '2027-10-01');
const DEC_2027 = scheduled('month', '2027-12-01');
const Q2_2028 = scheduled('quarter', '2028-04-01');

const WINDOW: DemandTiming = { kind: 'window', fromDate: '2026-09-01', toDate: '2027-03-31' };

interface Candidate {
  readonly id: string;
  readonly availability: ScheduledAvailability;
  readonly price?: number;
  readonly track?: AvailabilityTrack | null;
}

function candidate({ id, availability, price = 200_000, track = null }: Candidate) {
  const commercial = { askingPrice: price, finalPrice: null, rentPrice: null, nightlyRate: null };
  return facts({ availability, listing: listing({ id, availability, availabilityTrack: track, commercial }) });
}

function run(candidates: readonly Candidate[], timing: DemandTiming = WINDOW, today: string = TODAY) {
  const results = matchDemand(demand({ timing, seeks: [seek('sell', { max: 250_000 })] }), candidates.map(candidate), today);
  return { results, awaiting: awaitingDeliveryOf(results.nearMissed, today) };
}

describe('Α — μόνο όσες σταματά ΜΟΝΟ ο χρόνος', () => {
  it('Α1 — άγκυρα ελαττώματος: μόνο-χρόνος ⇒ `nearMissed`, ποτέ `rejected`', () => {
    const { results } = run([{ id: 'p1', availability: Q4_2027 }]);
    expect(results.rejected).toHaveLength(0);
    expect(results.nearMissed).toHaveLength(1);
    expect(isAwaitingDelivery(results.nearMissed[0].match)).toBe(true);
  });

  it('Α2 — χρόνος + τιμή ⇒ δεν μετρά (η αναμονή μόνη της δεν την ξεκλειδώνει)', () => {
    const { awaiting } = run([{ id: 'p1', availability: Q4_2027, price: 300_000 }]);
    expect(awaiting).toBeNull();
  });

  it('Α2β — το κατηγόρημα: χρόνος ΠΡΩΤΟΣ μαζί με άλλο εμπόδιο ⇒ όχι (ανεξάρτητα από τη σειρά)', () => {
    const { results } = run([{ id: 'p1', availability: Q4_2027 }]);
    const timeOnly = results.nearMissed[0].match;
    expect(isAwaitingDelivery({ ...timeOnly, blockers: ['not-available-then', 'proximity-too-far'] })).toBe(false);
    expect(isAwaitingDelivery({ ...timeOnly, blockers: ['proximity-too-far', 'not-available-then'] })).toBe(false);
  });

  it('Α3 — καμία ⇒ `null`, ποτέ «0»', () => {
    expect(run([]).awaiting).toBeNull();
  });

  it('Α4 — ταίρι που ήδη ταιριάζει δεν είναι «χτίζεται»', () => {
    const { results, awaiting } = run([{ id: 'p1', availability: scheduled('month', '2027-02-01') }]);
    expect(results.matched).toHaveLength(1);
    expect(awaiting).toBeNull();
  });
});

describe('Σ — η σκάλα', () => {
  it('Σ1 — αύξουσα κατά τέλος, σωρευτική, ίσα τέλη σε ΕΝΑ σκαλί με τη στενότερη υπόσχεση', () => {
    const { awaiting } = run([
      { id: 'p1', availability: Q2_2028 },
      { id: 'p2', availability: Q4_2027 },
      { id: 'p3', availability: DEC_2027 },
    ]);
    expect(awaiting).toEqual({
      count: 3,
      steps: [{ promise: DEC_2027, unlocks: 2 }, { promise: Q2_2028, unlocks: 3 }],
      slipped: 0,
    });
  });

  it('Σ2 — το συγκριτικό: νωρίτερο τέλος, μετά στενότερη ακρίβεια', () => {
    expect([Q2_2028, Q4_2027, DEC_2027].sort(compareDeliveryPromise)).toEqual([DEC_2027, Q4_2027, Q2_2028]);
    expect(compareDeliveryPromise(Q4_2027, Q4_2027)).toBe(0);
  });
});

describe('Μ — πόσες έχουν ήδη μετατεθεί (μέσω `slipNoticeOf`)', () => {
  it('Μ1 — μετρά μόνο αγγελία με ≥1 μετάθεση', () => {
    const slippedTrack: AvailabilityTrack = { originally: Q4_2026, slips: 1, lastChange: null };
    const freshTrack: AvailabilityTrack = { originally: Q4_2027, slips: 0, lastChange: null };
    const { awaiting } = run([
      { id: 'p1', availability: Q4_2027, track: slippedTrack },
      { id: 'p2', availability: Q2_2028, track: freshTrack },
    ]);
    expect(awaiting?.slipped).toBe(1);
  });
});

describe('Ζ — τα τρία «πότε»', () => {
  it('Ζ1 — «τώρα»: κάθε μελλοντική υπόσχεση είναι «χτίζεται»', () => {
    expect(run([{ id: 'p1', availability: Q4_2027 }], { kind: 'now' }).awaiting?.count).toBe(1);
  });

  it('Ζ2 — «όποτε»: δεν υπάρχει χρονικό εμπόδιο, άρα ποτέ «χτίζονται» (ταιριάζουν ήδη)', () => {
    const { results, awaiting } = run([{ id: 'p1', availability: Q4_2027 }], { kind: 'whenever' });
    expect(results.matched).toHaveLength(1);
    expect(awaiting).toBeNull();
  });
});

describe('Χ — μόνο ΜΕΛΛΟΝΤΙΚΗ υπόσχεση (σύνορο του «σήμερα», καμία ανάγνωση ρολογιού)', () => {
  const pastWindow: DemandTiming = { kind: 'window', fromDate: '2026-01-01', toDate: '2026-06-30' };

  it('Χ1 — ληγμένη υπόσχεση που σταματά παλιό διάστημα ΔΕΝ είναι «χτίζεται»', () => {
    const { results, awaiting } = run([{ id: 'p1', availability: scheduled('month', '2026-07-01') }], pastWindow);
    expect(isAwaitingDelivery(results.nearMissed[0].match)).toBe(true);
    expect(awaiting).toBeNull();
  });

  it('Χ2 — τέλος == σήμερα ⇒ όχι · τέλος == αύριο ⇒ ναι', () => {
    const endsToday = scheduled('day', '2026-08-11');
    const endsTomorrow = scheduled('day', '2026-08-12');
    expect(run([{ id: 'p1', availability: endsToday }], pastWindow).awaiting).toBeNull();
    expect(run([{ id: 'p1', availability: endsTomorrow }], pastWindow).awaiting?.count).toBe(1);
  });

  it('Χ3 — κρίνεται το ΤΕΛΟΣ: Γ΄ τρίμηνο 2026 (άρχισε, λήγει 30/9) είναι ακόμη υπόσχεση στις 11/8', () => {
    expect(run([{ id: 'p1', availability: scheduled('quarter', '2026-07-01') }], pastWindow).awaiting?.count).toBe(1);
  });
});
