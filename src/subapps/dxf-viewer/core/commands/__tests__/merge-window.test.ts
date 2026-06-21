/**
 * ADR-507 §8 — `merge-window` SSoT helper tests.
 */
import { isWithinMergeWindow, sameEntityIdSet } from '../merge-window';
import { DEFAULT_MERGE_CONFIG } from '../interfaces';
import type { ICommand } from '../interfaces';

const at = (timestamp: number): ICommand => ({ timestamp } as unknown as ICommand);

describe('isWithinMergeWindow', () => {
  const W = DEFAULT_MERGE_CONFIG.mergeTimeWindow; // 500ms

  it('true when the gap is below the window', () => {
    expect(isWithinMergeWindow(at(1000), at(1000 + W - 1))).toBe(true);
    expect(isWithinMergeWindow(at(1000), at(1000))).toBe(true);
  });

  it('false at or beyond the window boundary', () => {
    expect(isWithinMergeWindow(at(1000), at(1000 + W))).toBe(false);
    expect(isWithinMergeWindow(at(1000), at(1000 + W + 5000))).toBe(false);
  });
});

describe('sameEntityIdSet', () => {
  it('is order-independent', () => {
    expect(sameEntityIdSet(['a', 'b', 'c'], ['c', 'a', 'b'])).toBe(true);
  });

  it('false on length mismatch', () => {
    expect(sameEntityIdSet(['a'], ['a', 'b'])).toBe(false);
  });

  it('false on different members', () => {
    expect(sameEntityIdSet(['a', 'b'], ['a', 'c'])).toBe(false);
  });

  it('is duplicate-aware (set size, not just length)', () => {
    expect(sameEntityIdSet(['a', 'a'], ['a', 'b'])).toBe(false);
  });

  it('true for two empty sets', () => {
    expect(sameEntityIdSet([], [])).toBe(true);
  });
});
