/**
 * ADR-507 §8 — `sameSet` SSoT tests (generic set-membership equality).
 */
import { sameSet } from '../set-equality';

describe('sameSet', () => {
  it('true for two sets with the same members (order-independent)', () => {
    expect(sameSet(new Set(['a', 'b', 'c']), new Set(['c', 'b', 'a']))).toBe(true);
  });

  it('true (short-circuit) for the same reference', () => {
    const s = new Set([1, 2, 3]);
    expect(sameSet(s, s)).toBe(true);
  });

  it('false on size mismatch', () => {
    expect(sameSet(new Set(['a']), new Set(['a', 'b']))).toBe(false);
  });

  it('false when a member differs', () => {
    expect(sameSet(new Set(['a', 'b']), new Set(['a', 'c']))).toBe(false);
  });

  it('true for two empty sets', () => {
    expect(sameSet(new Set<string>(), new Set<string>())).toBe(true);
  });

  it('works for non-string member types', () => {
    expect(sameSet(new Set([1, 2]), new Set([2, 1]))).toBe(true);
    expect(sameSet(new Set([1, 2]), new Set([1, 3]))).toBe(false);
  });
});
