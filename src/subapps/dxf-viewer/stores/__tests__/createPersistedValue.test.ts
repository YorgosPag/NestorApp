/// <reference types="jest" />
/**
 * @file createPersistedValue.test.ts
 * @description SSoT primitive test — reactive + localStorage-persisted value composed from
 * createExternalStore (reactive) + storage-utils (localStorage). Verifies hydrate-on-init,
 * persist-on-change, removeOnDefault, validate, equals no-op, and reset-without-persist.
 */

import { createPersistedValue } from '../createPersistedValue';

const KEY = 'test:createPersistedValue';

beforeEach(() => {
  localStorage.clear();
});

describe('createPersistedValue', () => {
  it('hydrates from the default when nothing is stored', () => {
    const store = createPersistedValue<number>(KEY, 42);
    expect(store.get()).toBe(42);
  });

  it('hydrates from a previously stored (JSON) value', () => {
    localStorage.setItem(KEY, JSON.stringify(7));
    const store = createPersistedValue<number>(KEY, 42);
    expect(store.get()).toBe(7);
  });

  it('persists on set and notifies subscribers', () => {
    const store = createPersistedValue<number>(KEY, 1);
    let notified = 0;
    store.subscribe(() => { notified += 1; });
    store.set(5);
    expect(store.get()).toBe(5);
    expect(notified).toBe(1);
    expect(JSON.parse(localStorage.getItem(KEY) as string)).toBe(5);
  });

  it('persists objects as JSON round-trips', () => {
    const store = createPersistedValue<{ a: number; b: string }>(KEY, { a: 0, b: '' });
    store.set({ a: 1, b: 'x' });
    const rehydrated = createPersistedValue<{ a: number; b: string }>(KEY, { a: 0, b: '' });
    expect(rehydrated.get()).toEqual({ a: 1, b: 'x' });
  });

  it('removeOnDefault: removes the key when set back to the default', () => {
    const store = createPersistedValue<number>(KEY, 1, { removeOnDefault: true });
    store.set(3);
    expect(localStorage.getItem(KEY)).not.toBeNull();
    store.set(1); // back to default
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('equals: a suppressed write neither notifies nor persists', () => {
    const store = createPersistedValue<number>(KEY, 1, { equals: Object.is });
    store.set(9);
    localStorage.clear(); // wipe the persisted 9
    let notified = 0;
    store.subscribe(() => { notified += 1; });
    store.set(9); // equal → no-op
    expect(notified).toBe(0);
    expect(localStorage.getItem(KEY)).toBeNull(); // no re-persist
  });

  it('validate: normalises a corrupt hydrated value', () => {
    localStorage.setItem(KEY, JSON.stringify(-5));
    const store = createPersistedValue<number>(KEY, 1, {
      validate: (v) => (Number.isFinite(v) && v > 0 ? v : 1),
    });
    expect(store.get()).toBe(1);
  });

  it('reset: replaces state WITHOUT persisting (test/lifecycle)', () => {
    const store = createPersistedValue<number>(KEY, 1);
    store.set(4);
    store.reset(1);
    expect(store.get()).toBe(1);
    // reset does not persist — the last persisted value (4) stays untouched
    expect(JSON.parse(localStorage.getItem(KEY) as string)).toBe(4);
  });
});
