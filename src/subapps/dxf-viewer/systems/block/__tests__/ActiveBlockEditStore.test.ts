import {
  enterBlockEdit,
  exitBlockEdit,
  getActiveBlockEditId,
  getActiveBlockEditName,
  isBlockEditActive,
  subscribeBlockEdit,
} from '../ActiveBlockEditStore';

/**
 * ADR-641 Φ1 — Block Editor (BEDIT) session store. Single active block (no stack, unlike
 * ActiveGroupStore), enter/exit is plain state (not undoable), subscribers fire on real changes only.
 */

afterEach(() => exitBlockEdit()); // reset the singleton between tests

describe('ActiveBlockEditStore', () => {
  it('starts inactive', () => {
    expect(getActiveBlockEditId()).toBeNull();
    expect(getActiveBlockEditName()).toBeNull();
    expect(isBlockEditActive()).toBe(false);
  });

  it('enter sets id + name and marks active', () => {
    enterBlockEdit('blk1', '*U2');
    expect(getActiveBlockEditId()).toBe('blk1');
    expect(getActiveBlockEditName()).toBe('*U2');
    expect(isBlockEditActive()).toBe(true);
  });

  it('exit clears back to the top level', () => {
    enterBlockEdit('blk1', '*U2');
    exitBlockEdit();
    expect(getActiveBlockEditId()).toBeNull();
    expect(getActiveBlockEditName()).toBeNull();
    expect(isBlockEditActive()).toBe(false);
  });

  it('entering a DIFFERENT block replaces the active one (single-level, no stack)', () => {
    enterBlockEdit('blk1', 'A');
    enterBlockEdit('blk2', 'B');
    expect(getActiveBlockEditId()).toBe('blk2');
    expect(getActiveBlockEditName()).toBe('B');
  });

  it('notifies subscribers on change but not on no-op re-enter of the same block', () => {
    const calls: number[] = [];
    const unsub = subscribeBlockEdit(() => calls.push(1));
    enterBlockEdit('blk1', 'A');   // change → emit
    enterBlockEdit('blk1', 'A');   // no-op (already active) → no emit
    exitBlockEdit();               // change → emit
    exitBlockEdit();               // no-op (already inactive) → no emit
    unsub();
    expect(calls).toHaveLength(2);
  });

  it('ignores an empty blockId', () => {
    enterBlockEdit('', 'X');
    expect(isBlockEditActive()).toBe(false);
  });

  it('unsubscribe stops further notifications', () => {
    const calls: number[] = [];
    const unsub = subscribeBlockEdit(() => calls.push(1));
    enterBlockEdit('blk1', 'A');
    unsub();
    exitBlockEdit();
    expect(calls).toHaveLength(1);
  });
});
