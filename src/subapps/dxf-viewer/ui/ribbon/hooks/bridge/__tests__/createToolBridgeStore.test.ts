/**
 * createToolBridgeStore — SSoT factory για τα drawing-mode ↔ ribbon handle bridges.
 *
 * Locks the behaviour κάθε migrated `*-tool-bridge-store.ts` βασίζεται: null initial
 * handle, set/get round-trip, subscribe/unsubscribe notification, και το identity-guard
 * (Object.is) στο `set` που κάνει bail το redundant write (== το χειροκίνητο
 * `if (next === handle) return`). Ο `use()` React binding delegate-άρει στα ήδη
 * tested `store.subscribe`/`store.get` του `createExternalStore`.
 */

import { createToolBridgeStore } from '../createToolBridgeStore';

interface FakeHandle {
  readonly isActive: boolean;
  readonly kind: string;
}

describe('createToolBridgeStore', () => {
  it('starts with a null handle', () => {
    const store = createToolBridgeStore<FakeHandle>();
    expect(store.get()).toBeNull();
  });

  it('round-trips the published handle via get()', () => {
    const store = createToolBridgeStore<FakeHandle>();
    const handle: FakeHandle = { isActive: true, kind: 'rect' };
    store.set(handle);
    expect(store.get()).toBe(handle);
  });

  it('reflects the latest handle across successive set() calls', () => {
    const store = createToolBridgeStore<FakeHandle>();
    store.set({ isActive: true, kind: 'rect' });
    expect(store.get()?.kind).toBe('rect');
    store.set({ isActive: true, kind: 'poly' });
    expect(store.get()?.kind).toBe('poly');
  });

  it('clears to null', () => {
    const store = createToolBridgeStore<FakeHandle>();
    store.set({ isActive: true, kind: 'rect' });
    store.set(null);
    expect(store.get()).toBeNull();
  });

  it('notifies subscribers on set() and returns an unsubscribe', () => {
    const store = createToolBridgeStore<FakeHandle>();
    let hits = 0;
    const unsub = store.subscribe(() => { hits += 1; });
    store.set({ isActive: true, kind: 'rect' });
    expect(hits).toBe(1);
    unsub();
    store.set({ isActive: false, kind: 'poly' });
    expect(hits).toBe(1);
  });

  it('is a no-op when set with the identical handle reference (Object.is guard)', () => {
    const store = createToolBridgeStore<FakeHandle>();
    const handle: FakeHandle = { isActive: true, kind: 'rect' };
    store.set(handle);
    let hits = 0;
    store.subscribe(() => { hits += 1; });
    store.set(handle); // identical → bail, no notify
    expect(hits).toBe(0);
    expect(store.get()).toBe(handle);
  });

  it('does not bail on a fresh null after a real handle (null !== handle)', () => {
    const store = createToolBridgeStore<FakeHandle>();
    store.set({ isActive: true, kind: 'rect' });
    let hits = 0;
    store.subscribe(() => { hits += 1; });
    store.set(null);
    expect(hits).toBe(1);
    store.set(null); // now null === null → bail
    expect(hits).toBe(1);
  });

  it('isolates state between factory instances', () => {
    const a = createToolBridgeStore<FakeHandle>();
    const b = createToolBridgeStore<FakeHandle>();
    a.set({ isActive: true, kind: 'a' });
    expect(a.get()?.kind).toBe('a');
    expect(b.get()).toBeNull();
  });

  it('exposes a use() React binding', () => {
    const store = createToolBridgeStore<FakeHandle>();
    expect(typeof store.use).toBe('function');
  });
});
