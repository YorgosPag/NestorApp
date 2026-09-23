/**
 * @jest-environment node
 *
 * @fileoverview 🗺️ **ΑΓΚΥΡΑ — μία λήψη ανά κλειδί, με σειρά, και καθαρό ξήλωμα.** (ADR-777 §8.70 Φ2)
 * @related lib/maps/map-snapshot-store.ts
 *
 * | Μετάλλαξη | Αποτέλεσμα |
 * |---|---|
 * | το `request` ξαναβάζει υπάρχον κλειδί στην ουρά | δεύτερη εργασία ⇒ 🔴 |
 * | το `dispose` δεν αποδεσμεύει URL | διαρροή ⇒ 🔴 |
 * | αργό `settle` μετά το ξήλωμα γράφει κατάσταση | ζωντανό νεκρό κατάστημα ⇒ 🔴 |
 */

import { createMapSnapshotStore, type MapSnapshotUrlFactory } from '../map-snapshot-store';

function fakeUrls(): MapSnapshotUrlFactory & { readonly revoked: string[] } {
  let n = 0;
  const revoked: string[] = [];
  return {
    create: () => `blob:snapshot-${n++}`,
    revoke: (url) => {
      revoked.push(url);
    },
    revoked,
  };
}

const RESULT = { blob: new Blob(['x']), attribution: [{ text: '© OSM' }] };

describe('createMapSnapshotStore', () => {
  it('🔑 ιδεμποτία: το ίδιο κλειδί Ν φορές ⇒ ΜΙΑ εργασία', () => {
    const store = createMapSnapshotStore<number>(fakeUrls());
    store.request('a', 1);
    store.request('a', 1);
    expect(store.takeNext()).toEqual({ key: 'a', payload: 1 });
    expect(store.takeNext()).toBeNull();
  });

  it('σειρά αιτήματος = σειρά λήψης', () => {
    const store = createMapSnapshotStore<number>(fakeUrls());
    store.request('a', 1);
    store.request('b', 2);
    expect([store.takeNext()?.key, store.takeNext()?.key]).toEqual(['a', 'b']);
  });

  it('queued → ready με URL και απόδοση · ειδοποιεί τους ακροατές', () => {
    const store = createMapSnapshotStore<number>(fakeUrls());
    const listener = jest.fn();
    store.subscribe(listener);
    store.request('a', 1);
    expect(store.get('a')).toEqual({ status: 'queued' });
    store.settle('a', RESULT);
    expect(store.get('a')).toEqual({ status: 'ready', url: 'blob:snapshot-0', attribution: RESULT.attribution });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('αποτυχία ⇒ `failed`, και ΔΕΝ ξαναζητείται', () => {
    const store = createMapSnapshotStore<number>(fakeUrls());
    store.request('a', 1);
    store.takeNext();
    store.settle('a', null);
    store.request('a', 1);
    expect(store.get('a')).toEqual({ status: 'failed' });
    expect(store.takeNext()).toBeNull();
  });

  it('`size` μετρά κάθε κλειδί που ζητήθηκε', () => {
    const store = createMapSnapshotStore<number>(fakeUrls());
    expect(store.size()).toBe(0);
    store.request('a', 1);
    expect(store.size()).toBe(1);
  });

  it('🔴 `dispose` αποδεσμεύει κάθε URL και σκοτώνει το κατάστημα', () => {
    const urls = fakeUrls();
    const store = createMapSnapshotStore<number>(urls);
    store.request('a', 1);
    store.request('b', 2);
    store.settle('a', RESULT);
    store.dispose();

    expect(urls.revoked).toEqual(['blob:snapshot-0']);
    store.settle('b', RESULT);
    store.request('c', 3);
    expect(store.get('b')).toBeUndefined();
    expect(store.takeNext()).toBeNull();
  });
});
