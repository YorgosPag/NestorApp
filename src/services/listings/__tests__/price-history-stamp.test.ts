/**
 * @fileoverview **Η ΣΦΡΑΓΙΔΑ ΤΟΥ ΙΣΤΟΡΙΚΟΥ ΤΙΜΗΣ** — CAS, μηδενικό κόστος, ποτέ εξαίρεση.
 * @related ADR-777 §8.69 · services/listings/price-history-stamp.ts · listed-at-stamp.test.ts
 *
 * Ίδια ελάχιστη Firestore με το `listed-at-stamp.test.ts`: **πραγματική** σημασιολογία
 * συναλλαγής και λαβή αγώνα ανάμεσα στην έξω ανάγνωση και τη συναλλαγή.
 */

import type { PriceObservation } from '@/types/price-history';

import { resolvePriceHistory } from '../price-history-stamp';

const AT_FIRST = '2026-08-01T08:00:00.000Z';
const AT_LATER = '2026-08-20T08:00:00.000Z';
const PROPERTIES = 'properties';
const ID = 'prop_a0000001-7777-4aaa-8aaa-000000000001';

const SALE_300K = { role: 'sale', amount: 300_000 } as const;
const SALE_270K = { role: 'sale', amount: 270_000 } as const;

function storeOf(initial: Record<string, unknown> | undefined) {
  const state: { doc: Record<string, unknown> | undefined } = { doc: initial };
  const counters = { transactions: 0, updates: 0 };
  let onBeforeTransactionRead: (() => void) | null = null;
  let failUpdate = false;

  const adminDb = {
    collection: () => ({ doc: () => ({}) }),
    runTransaction: async <T,>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
      counters.transactions += 1;
      const tx = {
        get: async () => {
          onBeforeTransactionRead?.();
          return { data: () => state.doc };
        },
        update: (_ref: unknown, patch: Record<string, unknown>) => {
          if (failUpdate) throw new Error('PERMISSION_DENIED');
          counters.updates += 1;
          state.doc = { ...(state.doc ?? {}), ...patch };
        },
      };
      return fn(tx);
    },
  } as never;

  return {
    adminDb,
    counters,
    state,
    current: () => state.doc?.priceHistory,
    race: (fn: () => void) => {
      onBeforeTransactionRead = fn;
    },
    breakUpdate: () => {
      failUpdate = true;
    },
  };
}

describe('Σ. Η ΣΦΡΑΓΙΔΑ ΤΟΥ ΙΣΤΟΡΙΚΟΥ ΤΙΜΗΣ', () => {
  it('Σ1 — πρώτη δημοσίευση γράφει μία παρατήρηση με τη στιγμή του περάσματος', async () => {
    const store = storeOf({});

    const result = await resolvePriceHistory(store.adminDb, PROPERTIES, ID, store.current(), SALE_300K, AT_FIRST);

    const expected: PriceObservation[] = [{ at: AT_FIRST, price: SALE_300K }];
    expect(result).toEqual(expected);
    expect(store.state.doc?.priceHistory).toEqual(expected);
  });

  it('🔴 Σ2 — αποθήκευση που ΔΕΝ άγγιξε την τιμή ΔΕΝ ανοίγει καν συναλλαγή', async () => {
    const store = storeOf({ priceHistory: [{ at: AT_FIRST, price: SALE_300K }] });

    const result = await resolvePriceHistory(store.adminDb, PROPERTIES, ID, store.current(), SALE_300K, AT_LATER);

    expect(result).toEqual([{ at: AT_FIRST, price: SALE_300K }]);
    expect(store.counters.transactions).toBe(0);
  });

  it('Σ3 — ακίνητο που δεν μπήκε ποτέ στην αγορά δεν αποκτά ιστορικό', async () => {
    const store = storeOf({});

    const result = await resolvePriceHistory(store.adminDb, PROPERTIES, ID, store.current(), null, AT_FIRST);

    expect(result).toEqual([]);
    expect(store.counters.transactions).toBe(0);
    expect(store.state.doc?.priceHistory).toBeUndefined();
  });

  it('🔴 Σ4 — ΤΑΥΤΟΧΡΟΝΑ περάσματα με την ίδια τιμή γράφουν ΜΙΑ παρατήρηση, όχι δύο', async () => {
    const store = storeOf({ priceHistory: [{ at: AT_FIRST, price: SALE_300K }] });
    const staleCurrent = store.current();

    // Άλλο πέρασμα κατέγραψε ήδη τη μείωση ανάμεσα στην έξω ανάγνωση και τη συναλλαγή.
    const winner = [
      { at: AT_FIRST, price: SALE_300K },
      { at: AT_LATER, price: SALE_270K },
    ];
    store.race(() => {
      store.state.doc = { priceHistory: winner };
    });

    const result = await resolvePriceHistory(store.adminDb, PROPERTIES, ID, staleCurrent, SALE_270K, AT_LATER);

    expect(result).toEqual(winner);
    expect(store.counters.updates).toBe(0);
  });

  it('🔴 Σ5 — αποτυχία γραφής ⇒ `null` (καμία σήμανση), ΠΟΤΕ εξαίρεση, ΠΟΤΕ παλιό ιστορικό', async () => {
    const store = storeOf({ priceHistory: [{ at: AT_FIRST, price: SALE_300K }] });
    store.breakUpdate();

    const result = await resolvePriceHistory(store.adminDb, PROPERTIES, ID, store.current(), SALE_270K, AT_LATER);

    // Το παλιό ιστορικό ΔΕΝ περιέχει τα 270.000 — μείωση πάνω του θα έλεγε λάθος ποσό.
    expect(result).toBeNull();
  });

  it('Σ6 — απόσυρση καταγράφεται ως «εκτός αγοράς» — δεν σβήνει το ιστορικό', async () => {
    const store = storeOf({ priceHistory: [{ at: AT_FIRST, price: SALE_300K }] });

    const result = await resolvePriceHistory(store.adminDb, PROPERTIES, ID, store.current(), null, AT_LATER);

    expect(result).toEqual([
      { at: AT_FIRST, price: SALE_300K },
      { at: AT_LATER, price: null },
    ]);
  });
});
