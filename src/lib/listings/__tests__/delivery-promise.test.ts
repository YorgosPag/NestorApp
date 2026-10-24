/**
 * ADR-919 §12 — το ΕΝΑ κριτήριο «χτίζεται» (μελλοντική υπόσχεση) και το ΕΝΑ συγκριτικό, κοινά σε ζήτηση και περιοχή.
 */

import { scheduledAvailability } from '@/lib/listings/availability-window';
import {
  compareDeliveryPromise,
  deliveredBy,
  futureDeliveryPromiseOf,
  upcomingDeliveryQuarters,
} from '@/lib/listings/delivery-promise';
import type { ScheduledAvailability } from '@/types/availability-history';
import type { AvailabilityPrecision } from '@/types/listing-availability';
import { LISTING_AVAILABILITY_READY, LISTING_AVAILABILITY_UNKNOWN } from '@/types/listing-availability';

function promise(precision: AvailabilityPrecision, anchor: string): ScheduledAvailability {
  const availability = scheduledAvailability(precision, anchor);
  if (availability.kind !== 'scheduled') throw new Error(`fixture: ${precision} ${anchor}`);
  return availability;
}

const Q4_2027 = promise('quarter', '2027-10-01');

describe('futureDeliveryPromiseOf — μόνο μελλοντική υπόσχεση', () => {
  it('υπόσχεση που λήγει μετά από σήμερα ⇒ η ίδια η υπόσχεση', () => {
    expect(futureDeliveryPromiseOf(Q4_2027, '2026-10-24')).toBe(Q4_2027);
  });

  it('το σύνορο: τέλος == σήμερα ⇒ null (η υπόσχεση δεν είναι πια μελλοντική)', () => {
    expect(futureDeliveryPromiseOf(Q4_2027, Q4_2027.window.end)).toBeNull();
  });

  it('ληγμένη υπόσχεση ⇒ null (ανήκει στο `slipNoticeOf`, όχι στο «χτίζεται»)', () => {
    expect(futureDeliveryPromiseOf(promise('month', '2025-03-01'), '2026-10-24')).toBeNull();
  });

  it('`ready` και `unknown` δεν «χτίζονται» ποτέ', () => {
    expect(futureDeliveryPromiseOf(LISTING_AVAILABILITY_READY, '2026-10-24')).toBeNull();
    expect(futureDeliveryPromiseOf(LISTING_AVAILABILITY_UNKNOWN, '2026-10-24')).toBeNull();
  });
});

describe('compareDeliveryPromise — νωρίτερο τέλος, μετά στενότερη ακρίβεια', () => {
  it('ταξινόμηση κατά τέλος, και στην ισοπαλία τέλους η μεταγενέστερη αρχή πρώτα', () => {
    const dec2027 = promise('month', '2027-12-01');
    const q2_2028 = promise('quarter', '2028-04-01');
    expect([q2_2028, Q4_2027, dec2027].sort(compareDeliveryPromise)).toEqual([dec2027, Q4_2027, q2_2028]);
    expect(compareDeliveryPromise(Q4_2027, Q4_2027)).toBe(0);
  });
});

describe('deliveredBy — «διαθέσιμο ως» (ADR-919 §12)', () => {
  it('`ready` ⇒ ναι, `unknown` ⇒ null (άγνοια, ποτέ «όχι»)', () => {
    expect(deliveredBy(LISTING_AVAILABILITY_READY, '2026-10-24')).toBe(true);
    expect(deliveredBy(LISTING_AVAILABILITY_UNKNOWN, '2026-10-24')).toBeNull();
  });

  it('`scheduled`: κρίνει το ΤΕΛΟΣ του παραθύρου, με το σύνορο μέσα', () => {
    expect(deliveredBy(Q4_2027, Q4_2027.window.end)).toBe(true);
    expect(deliveredBy(Q4_2027, '2027-12-30')).toBe(false);
    expect(deliveredBy(Q4_2027, Q4_2027.window.start)).toBe(false);
  });
});

describe('upcomingDeliveryQuarters — οι επιλογές του «διαθέσιμο ως»', () => {
  it('από το τρέχον τρίμηνο, με αλλαγή έτους, και τιμή = τέλος τριμήνου', () => {
    const quarters = upcomingDeliveryQuarters('2026-10-24', 3);
    expect(quarters.map((q) => q.window)).toEqual([
      { start: '2026-10-01', end: '2026-12-31' },
      { start: '2027-01-01', end: '2027-03-31' },
      { start: '2027-04-01', end: '2027-06-30' },
    ]);
    expect(quarters.every((q) => q.precision === 'quarter')).toBe(true);
  });

  it('η πρώτη μέρα του τριμήνου ανήκει σε αυτό', () => {
    expect(upcomingDeliveryQuarters('2027-01-01', 1)[0].window.start).toBe('2027-01-01');
  });
});
