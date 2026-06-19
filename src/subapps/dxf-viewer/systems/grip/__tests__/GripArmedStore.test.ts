/**
 * @fileoverview Tests for GripArmedStore (ADR-501) — armed-grip SSoT.
 * Covers toggle / setOnly / armMany / clear, key membership, ref retention,
 * snapshot referential stability (useSyncExternalStore contract), and notify.
 */

import { GripArmedStore } from '../GripArmedStore';

const refOf = (entityId: string, gripIndex: number) => ({ entityId, gripIndex });

describe('GripArmedStore — ADR-501', () => {
  beforeEach(() => GripArmedStore.clear());

  it('starts empty', () => {
    expect(GripArmedStore.size).toBe(0);
    expect(GripArmedStore.getKeysSnapshot().size).toBe(0);
  });

  it('setOnly arms exactly one grip (replacing any prior set)', () => {
    GripArmedStore.toggle(refOf('e1', 0));
    GripArmedStore.toggle(refOf('e2', 1));
    GripArmedStore.setOnly(refOf('e3', 2));
    expect(GripArmedStore.size).toBe(1);
    expect(GripArmedStore.has('e3', 2)).toBe(true);
    expect(GripArmedStore.has('e1', 0)).toBe(false);
  });

  it('toggle adds then removes the same grip', () => {
    GripArmedStore.toggle(refOf('e1', 0));
    expect(GripArmedStore.has('e1', 0)).toBe(true);
    GripArmedStore.toggle(refOf('e1', 0));
    expect(GripArmedStore.has('e1', 0)).toBe(false);
  });

  it('toggle multi-selects distinct grips', () => {
    GripArmedStore.toggle(refOf('e1', 0));
    GripArmedStore.toggle(refOf('e1', 1));
    GripArmedStore.toggle(refOf('e2', 0));
    expect(GripArmedStore.size).toBe(3);
  });

  it('armMany adds a batch (marquee)', () => {
    GripArmedStore.armMany([refOf('e1', 0), refOf('e1', 1), refOf('e2', 0)]);
    expect(GripArmedStore.size).toBe(3);
    expect(GripArmedStore.has('e2', 0)).toBe(true);
  });

  it('retains GripRefs for the group-move commit', () => {
    GripArmedStore.armMany([refOf('e1', 0), refOf('e2', 3)]);
    const refs = GripArmedStore.getRefsSnapshot();
    expect(refs).toEqual(
      expect.arrayContaining([
        { entityId: 'e1', gripIndex: 0 },
        { entityId: 'e2', gripIndex: 3 },
      ]),
    );
  });

  it('handles entity ids containing underscores (key is not re-parsed)', () => {
    GripArmedStore.setOnly(refOf('dxf_wall_42', 5));
    expect(GripArmedStore.has('dxf_wall_42', 5)).toBe(true);
    expect(GripArmedStore.getRefsSnapshot()[0]).toEqual({ entityId: 'dxf_wall_42', gripIndex: 5 });
  });

  it('keysSnapshot is referentially stable between mutations (useSyncExternalStore)', () => {
    GripArmedStore.toggle(refOf('e1', 0));
    const a = GripArmedStore.getKeysSnapshot();
    const b = GripArmedStore.getKeysSnapshot();
    expect(a).toBe(b); // same ref when nothing changed
    GripArmedStore.toggle(refOf('e1', 1));
    expect(GripArmedStore.getKeysSnapshot()).not.toBe(a); // new ref after mutation
  });

  it('notifies subscribers on mutation and stops after unsubscribe', () => {
    let calls = 0;
    const unsub = GripArmedStore.subscribe(() => { calls += 1; });
    GripArmedStore.toggle(refOf('e1', 0));
    expect(calls).toBe(1);
    unsub();
    GripArmedStore.toggle(refOf('e1', 1));
    expect(calls).toBe(1);
  });

  it('clear empties the set; clearing again is a silent no-op (no notify)', () => {
    GripArmedStore.toggle(refOf('e1', 0));
    let calls = 0;
    GripArmedStore.subscribe(() => { calls += 1; });
    GripArmedStore.clear();
    expect(GripArmedStore.size).toBe(0);
    expect(calls).toBe(1);
    GripArmedStore.clear(); // already empty
    expect(calls).toBe(1);
  });
});
