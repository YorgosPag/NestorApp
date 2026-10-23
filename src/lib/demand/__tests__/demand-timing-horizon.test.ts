/**
 * ΑΓΚΥΡΕΣ — «η νωρίτερη παραδίδεται …» χωρίς δεύτερη κρίση χρόνου (ADR-919 §11 · §3.7).
 */

import { scheduledAvailability } from '@/lib/listings/availability-window';
import type { ListingAvailability } from '@/types/listing-availability';

import type { DemandOutcome } from '../demand-matching';
import type { DemandBlocker } from '../demand-match-vocabulary';
import { earliestTimingBlockedPromise } from '../demand-timing-horizon';

function outcome(availability: ListingAvailability, blockers: readonly DemandBlocker[]): DemandOutcome {
  return { facts: { availability }, match: { blockers } } as unknown as DemandOutcome;
}

const Q4_2027 = scheduledAvailability('quarter', '2027-10-01');
const Q1_2028 = scheduledAvailability('quarter', '2028-01-01');
const DEC_2027 = scheduledAvailability('month', '2027-12-01');

describe('Ο — μόνο ό,τι σημάδεψε η ΜΗΧΑΝΗ', () => {
  it('Ο1 — από τις αγγελίες με `not-available-then`, η νωρίτερη κατά ΤΕΛΟΣ', () => {
    expect(earliestTimingBlockedPromise([
      outcome(Q1_2028, ['not-available-then']),
      outcome(Q4_2027, ['not-available-then', 'price-above']),
    ])).toEqual(Q4_2027);
  });

  it('Ο2 — αγγελία με νωρίτερη υπόσχεση αλλά ΑΛΛΟ εμπόδιο δεν μετρά (η μηχανή δεν την σταμάτησε ο χρόνος)', () => {
    expect(earliestTimingBlockedPromise([
      outcome(Q4_2027, ['price-above']),
      outcome(Q1_2028, ['not-available-then']),
    ])).toEqual(Q1_2028);
  });

  it('Ο3 — ίδιο τέλος ⇒ η πιο στενή ακρίβεια (Δεκέμβριος, όχι Δ΄ τρίμηνο)', () => {
    expect(earliestTimingBlockedPromise([
      outcome(Q4_2027, ['not-available-then']),
      outcome(DEC_2027, ['not-available-then']),
    ])).toEqual(DEC_2027);
  });

  it('Ο4 — κανένα εμπόδιο χρόνου ⇒ `null`', () => {
    expect(earliestTimingBlockedPromise([outcome({ kind: 'unknown' }, ['availability-unknown'])])).toBeNull();
  });
});
