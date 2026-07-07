/**
 * ADR-575 §selection/hover semantics — unit tests for the enter-group drill-in SSoT
 * (`ActiveGroupStore`): stack push/pop, active-id getter, nesting, subscriptions.
 */

import {
  enterGroup,
  exitActiveGroup,
  exitAllGroups,
  getActiveGroupId,
  getActiveGroupStack,
  isInsideGroup,
  subscribeActiveGroup,
} from '../ActiveGroupStore';

afterEach(() => exitAllGroups());

describe('ActiveGroupStore', () => {
  it('starts empty (top scene level)', () => {
    expect(getActiveGroupId()).toBeNull();
    expect(getActiveGroupStack()).toEqual([]);
  });

  it('enter pushes the active group; getActiveGroupId returns the innermost', () => {
    enterGroup('g1');
    expect(getActiveGroupId()).toBe('g1');
    expect(isInsideGroup('g1')).toBe(true);

    enterGroup('g2'); // nested
    expect(getActiveGroupId()).toBe('g2');
    expect(getActiveGroupStack()).toEqual(['g1', 'g2']);
    expect(isInsideGroup('g1')).toBe(true);
  });

  it('re-entering the same active group is a no-op (no duplicate push)', () => {
    enterGroup('g1');
    enterGroup('g1');
    expect(getActiveGroupStack()).toEqual(['g1']);
  });

  it('exitActiveGroup pops ONE level; exitAllGroups clears', () => {
    enterGroup('g1');
    enterGroup('g2');
    exitActiveGroup();
    expect(getActiveGroupStack()).toEqual(['g1']);
    expect(getActiveGroupId()).toBe('g1');

    enterGroup('g3');
    exitAllGroups();
    expect(getActiveGroupStack()).toEqual([]);
    expect(getActiveGroupId()).toBeNull();
  });

  it('exit when already empty is a safe no-op', () => {
    expect(() => exitActiveGroup()).not.toThrow();
    expect(() => exitAllGroups()).not.toThrow();
    expect(getActiveGroupId()).toBeNull();
  });

  it('returns a stable stack reference until it mutates (useSyncExternalStore-safe)', () => {
    enterGroup('g1');
    const a = getActiveGroupStack();
    const b = getActiveGroupStack();
    expect(a).toBe(b);
    enterGroup('g2');
    expect(getActiveGroupStack()).not.toBe(a);
  });

  it('notifies subscribers on change only', () => {
    let calls = 0;
    const unsub = subscribeActiveGroup(() => { calls += 1; });
    enterGroup('g1');
    enterGroup('g1'); // no-op → no notify
    enterGroup('g2');
    exitActiveGroup();
    unsub();
    enterGroup('g3'); // after unsub → not counted
    expect(calls).toBe(3);
  });
});
