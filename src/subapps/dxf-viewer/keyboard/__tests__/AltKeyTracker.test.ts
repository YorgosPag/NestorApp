/**
 * ADR-363 Phase 1G.5 — AltKeyTracker unit tests.
 *
 * Mirrors the Ctrl/Shift tracker contract: live Alt modifier state read at
 * grip-commit time without a React subscription. Verifies keydown/keyup/blur
 * transitions, key filtering, and subscriber notification.
 */

import { AltKeyTracker } from '../AltKeyTracker';

function key(type: 'keydown' | 'keyup', k: string): void {
  window.dispatchEvent(new KeyboardEvent(type, { key: k }));
}

describe('ADR-363 Phase 1G.5 — AltKeyTracker', () => {
  afterEach(() => {
    AltKeyTracker._setForTest(false);
  });

  it('defaults to not-pressed', () => {
    expect(AltKeyTracker.getSnapshot()).toBe(false);
  });

  it('keydown "Alt" sets pressed; keyup "Alt" clears it', () => {
    key('keydown', 'Alt');
    expect(AltKeyTracker.getSnapshot()).toBe(true);
    key('keyup', 'Alt');
    expect(AltKeyTracker.getSnapshot()).toBe(false);
  });

  it('ignores non-Alt keys', () => {
    key('keydown', 'Control');
    key('keydown', 'Shift');
    key('keydown', 'a');
    expect(AltKeyTracker.getSnapshot()).toBe(false);
  });

  it('blur clears a held Alt (focus loss / Alt+Tab)', () => {
    key('keydown', 'Alt');
    expect(AltKeyTracker.getSnapshot()).toBe(true);
    window.dispatchEvent(new Event('blur'));
    expect(AltKeyTracker.getSnapshot()).toBe(false);
  });

  it('notifies subscribers on transition only (deduped)', () => {
    const listener = jest.fn();
    const unsubscribe = AltKeyTracker.subscribe(listener);
    key('keydown', 'Alt');
    key('keydown', 'Alt'); // already pressed → no second notification
    expect(listener).toHaveBeenCalledTimes(1);
    key('keyup', 'Alt');
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    key('keydown', 'Alt');
    expect(listener).toHaveBeenCalledTimes(2); // unsubscribed
  });

  it('_setForTest drives the snapshot directly', () => {
    AltKeyTracker._setForTest(true);
    expect(AltKeyTracker.getSnapshot()).toBe(true);
    AltKeyTracker._setForTest(false);
    expect(AltKeyTracker.getSnapshot()).toBe(false);
  });
});
