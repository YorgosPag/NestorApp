/**
 * @fileoverview **Η ΣΦΡΑΓΙΔΑ ΤΟΥ ΙΣΤΟΡΙΚΟΥ ΔΙΑΘΕΣΙΜΟΤΗΤΑΣ**: CAS, μηδενικό κόστος, ποτέ εξαίρεση (ADR-919 §10).
 * @related services/listings/availability-history-stamp.ts · property-history-stamp.ts · price-history-stamp.test.ts
 */

import { scheduledAvailability } from '@/lib/listings/availability-window';
import { LISTING_AVAILABILITY_READY } from '@/types/listing-availability';

import { resolveAvailabilityHistory } from '../availability-history-stamp';
import { historyStoreOf } from './property-history-store';

const AT_FIRST = '2026-08-01T08:00:00.000Z';
const AT_LATER = '2026-08-20T08:00:00.000Z';
const PROPERTIES = 'properties';
const ID = 'prop_a0000001-7777-4aaa-8aaa-000000000002';

const Q2 = scheduledAvailability('quarter', '2027-05-01');
const Q4 = scheduledAvailability('quarter', '2027-11-01');

const storeOf = (initial: Record<string, unknown> | undefined) => historyStoreOf('availabilityHistory', initial);

describe('Σ. Η ΣΦΡΑΓΙΔΑ ΤΟΥ ΙΣΤΟΡΙΚΟΥ ΔΙΑΘΕΣΙΜΟΤΗΤΑΣ', () => {
  it('Σ1 — η πρώτη δημόσια υπόσχεση γράφει μία παρατήρηση με τη στιγμή του περάσματος', async () => {
    const store = storeOf({});

    const result = await resolveAvailabilityHistory(store.adminDb, PROPERTIES, ID, store.current(), Q2, AT_FIRST);

    expect(result).toEqual([{ at: AT_FIRST, availability: Q2 }]);
    expect(store.state.doc?.availabilityHistory).toEqual(result);
  });

  it('🔴 Σ2 — ίδια δημόσια τιμή ΔΕΝ ανοίγει καν συναλλαγή', async () => {
    const store = storeOf({ availabilityHistory: [{ at: AT_FIRST, availability: Q2 }] });

    const result = await resolveAvailabilityHistory(store.adminDb, PROPERTIES, ID, store.current(), Q2, AT_LATER);

    expect(result).toEqual([{ at: AT_FIRST, availability: Q2 }]);
    expect(store.counters.transactions).toBe(0);
  });

  it('Σ3 — έτοιμο ακίνητο ή μη δημόσια αγγελία δεν αποκτά ιστορικό', async () => {
    const store = storeOf({});

    await resolveAvailabilityHistory(store.adminDb, PROPERTIES, ID, store.current(), LISTING_AVAILABILITY_READY, AT_FIRST);
    await resolveAvailabilityHistory(store.adminDb, PROPERTIES, ID, store.current(), null, AT_FIRST);

    expect(store.counters.transactions).toBe(0);
    expect(store.state.doc?.availabilityHistory).toBeUndefined();
  });

  it('🔴 Σ4 — ΤΑΥΤΟΧΡΟΝΑ περάσματα με την ίδια μετάθεση γράφουν ΜΙΑ παρατήρηση', async () => {
    const store = storeOf({ availabilityHistory: [{ at: AT_FIRST, availability: Q2 }] });
    const staleCurrent = store.current();
    const winner = [
      { at: AT_FIRST, availability: Q2 },
      { at: AT_LATER, availability: Q4 },
    ];
    store.race(() => {
      store.state.doc = { availabilityHistory: winner };
    });

    const result = await resolveAvailabilityHistory(store.adminDb, PROPERTIES, ID, staleCurrent, Q4, AT_LATER);

    expect(result).toEqual(winner);
    expect(store.counters.updates).toBe(0);
  });

  it('🔴 Σ5 — αποτυχία γραφής ⇒ `null` (καμία ιστορία), ΠΟΤΕ εξαίρεση', async () => {
    const store = storeOf({ availabilityHistory: [{ at: AT_FIRST, availability: Q2 }] });
    store.breakUpdate();

    const result = await resolveAvailabilityHistory(store.adminDb, PROPERTIES, ID, store.current(), Q4, AT_LATER);

    expect(result).toBeNull();
  });

  it('Σ6 — η μετάθεση προστίθεται, το ιστορικό δεν ξαναγράφεται', async () => {
    const store = storeOf({ availabilityHistory: [{ at: AT_FIRST, availability: Q2 }] });

    const result = await resolveAvailabilityHistory(store.adminDb, PROPERTIES, ID, store.current(), Q4, AT_LATER);

    expect(result).toEqual([
      { at: AT_FIRST, availability: Q2 },
      { at: AT_LATER, availability: Q4 },
    ]);
    expect(store.counters.updates).toBe(1);
  });
});
