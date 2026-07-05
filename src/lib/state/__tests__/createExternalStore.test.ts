/**
 * createExternalStore — SSoT pub/sub factory. Locks the behaviour every migrated store
 * relies on (notify-all-on-set, subscribe/unsubscribe, optional equality guard) so the
 * ~100+ hand-rolled stores can delegate to it without any behaviour drift.
 *
 * Promoted to the shared platform lib in WAVE 3; the dxf path is a re-export shim.
 */

import { createExternalStore } from '../createExternalStore';

describe('createExternalStore', () => {
  it('returns the initial value from get()', () => {
    const s = createExternalStore(42);
    expect(s.get()).toBe(42);
  });

  it('set() replaces state and notifies every subscriber (insertion order)', () => {
    const s = createExternalStore<number>(0);
    const order: string[] = [];
    s.subscribe(() => order.push('a'));
    s.subscribe(() => order.push('b'));
    s.set(1);
    expect(s.get()).toBe(1);
    expect(order).toEqual(['a', 'b']);
  });

  it('unsubscribe stops further notifications', () => {
    const s = createExternalStore<number>(0);
    let hits = 0;
    const unsub = s.subscribe(() => { hits += 1; });
    s.set(1);
    unsub();
    s.set(2);
    expect(hits).toBe(1);
    expect(s.get()).toBe(2);
  });

  it('the same listener added twice is deduped (Set semantics)', () => {
    const s = createExternalStore<number>(0);
    let hits = 0;
    const fn = () => { hits += 1; };
    s.subscribe(fn);
    s.subscribe(fn);
    s.set(1);
    expect(hits).toBe(1);
  });

  it('without equals: notifies even on an identical value (default behaviour)', () => {
    const s = createExternalStore<number>(7);
    let hits = 0;
    s.subscribe(() => { hits += 1; });
    s.set(7);
    expect(hits).toBe(1);
  });

  it('with equals=Object.is: a no-op write neither reassigns nor notifies', () => {
    const s = createExternalStore<string | null>(null, { equals: Object.is });
    let hits = 0;
    s.subscribe(() => { hits += 1; });
    s.set(null);          // equal → bail
    expect(hits).toBe(0);
    s.set('x');           // changed → notify
    s.set('x');           // equal → bail
    expect(hits).toBe(1);
    expect(s.get()).toBe('x');
  });

  it('with a custom equals: suppresses notify when the comparator reports equal', () => {
    const s = createExternalStore<{ v: number }>({ v: 1 }, { equals: (a, b) => a.v === b.v });
    let hits = 0;
    s.subscribe(() => { hits += 1; });
    s.set({ v: 1 }); // different ref, equal by comparator → bail
    expect(hits).toBe(0);
    s.set({ v: 2 });
    expect(hits).toBe(1);
  });

  it('reset() replaces state silently (no notify) and bypasses the equals guard', () => {
    const s = createExternalStore<number>(0, { equals: Object.is });
    let hits = 0;
    s.subscribe(() => { hits += 1; });
    s.reset(5);           // silent: state changes but subscribers are NOT called
    expect(s.get()).toBe(5);
    expect(hits).toBe(0);
  });

  it('reset() drops every current subscriber (mirrors listeners.clear())', () => {
    const s = createExternalStore<number>(0);
    let hits = 0;
    s.subscribe(() => { hits += 1; });
    s.reset(0);
    s.set(1);             // no live subscriber remains → no notify
    expect(hits).toBe(0);
    expect(s.get()).toBe(1);
  });
});
