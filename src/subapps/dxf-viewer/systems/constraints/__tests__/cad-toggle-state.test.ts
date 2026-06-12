/**
 * cad-toggle-state — subscribable in-memory SSoT tests.
 *
 * Locks in the 2026-06-12 fix: ortho/polar are a single shared store that every
 * `useCadToggles` instance reads via `useSyncExternalStore`, so a toggle in one
 * instance is observed instantly by all others (no Firestore round-trip). These
 * tests cover the store contract that makes that safe:
 *   - getters reflect the last `set`
 *   - `subscribe` is notified on real changes
 *   - the no-op guard suppresses notifications for unchanged values (so the ~5
 *     live hook instances pushing the same value never spuriously re-render)
 *   - `setSnap` is independent of ortho/polar
 */
import { cadToggleState } from '../cad-toggle-state';

describe('cad-toggle-state', () => {
  beforeEach(() => {
    // Reset to the canonical idle state between tests.
    cadToggleState.set(true, false);
    cadToggleState.set(false, false);
    cadToggleState.setSnap(false, 0);
  });

  it('1. getters reflect the last set()', () => {
    cadToggleState.set(true, false);
    expect(cadToggleState.isOrthoOn()).toBe(true);
    expect(cadToggleState.isPolarOn()).toBe(false);

    cadToggleState.set(false, true);
    expect(cadToggleState.isOrthoOn()).toBe(false);
    expect(cadToggleState.isPolarOn()).toBe(true);
  });

  it('2. subscribe is notified synchronously on a real change', () => {
    const fn = jest.fn();
    const unsub = cadToggleState.subscribe(fn);
    cadToggleState.set(true, false);
    expect(fn).toHaveBeenCalledTimes(1);
    unsub();
  });

  it('3. no-op guard: setting the same value does NOT notify', () => {
    cadToggleState.set(true, false);
    const fn = jest.fn();
    const unsub = cadToggleState.subscribe(fn);
    cadToggleState.set(true, false); // unchanged
    expect(fn).not.toHaveBeenCalled();
    unsub();
  });

  it('4. unsubscribe stops further notifications', () => {
    const fn = jest.fn();
    const unsub = cadToggleState.subscribe(fn);
    unsub();
    cadToggleState.set(true, false);
    expect(fn).not.toHaveBeenCalled();
  });

  it('5. multiple subscribers are all notified', () => {
    const a = jest.fn();
    const b = jest.fn();
    const ua = cadToggleState.subscribe(a);
    const ub = cadToggleState.subscribe(b);
    cadToggleState.set(false, true);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    ua();
    ub();
  });

  it('6. setSnap reflects + is independent of ortho/polar', () => {
    cadToggleState.set(true, false);
    cadToggleState.setSnap(true, 50);
    expect(cadToggleState.isSnapOn()).toBe(true);
    expect(cadToggleState.getSnapStep()).toBe(50);
    expect(cadToggleState.isOrthoOn()).toBe(true); // unchanged by setSnap
  });

  it('7. setSnap no-op guard suppresses redundant notify', () => {
    cadToggleState.setSnap(true, 50);
    const fn = jest.fn();
    const unsub = cadToggleState.subscribe(fn);
    cadToggleState.setSnap(true, 50); // unchanged
    expect(fn).not.toHaveBeenCalled();
    unsub();
  });
});
