/**
 * ADR-929 §6.9 #19 — ξένα σύνολα (union-find): ο κοινός πυρήνας των `pdf-tables/ruled-grid`,
 * `spatial-tour/space-detect/separation-suggest` και των ανεξάρτητων μονάδων της καταγραφής.
 * Ωμή δύναμη: σε κάθε βήμα η απάντηση συγκρίνεται με ετικέτες που ξαναγράφονται ολόκληρες (O(n) ανά ένωση, προφανώς σωστό).
 */

import { describe, it, expect } from '@jest/globals';
import { createDisjointSets, createKeyedDisjointSets } from '../disjoint-sets';

describe('createDisjointSets', () => {
  it('αρχικά μονοσύνολα · groups σε αύξουσα σειρά', () => {
    const s = createDisjointSets(4);
    expect(s.count).toBe(4);
    expect(s.groups()).toEqual([[0], [1], [2], [3]]);
    expect(s.same(0, 1)).toBe(false);
    expect(s.sizeOf(2)).toBe(1);
  });

  it('union: true μόνο όταν ενώνει διαφορετικά σύνολα · μεταβατικότητα · μέγεθος', () => {
    const s = createDisjointSets(5);
    expect(s.union(0, 1)).toBe(true);
    expect(s.union(1, 0)).toBe(false);
    expect(s.union(3, 4)).toBe(true);
    expect(s.union(1, 4)).toBe(true);
    expect(s.same(0, 3)).toBe(true);
    expect(s.sizeOf(4)).toBe(4);
    expect(s.groups()).toEqual([[0, 1, 3, 4], [2]]);
  });

  it('ωμή δύναμη: 200 ντετερμινιστικές τυχαίες ενώσεις σε 60 στοιχεία ⇒ ίδια διαμέριση με τις ετικέτες', () => {
    const n = 60;
    const s = createDisjointSets(n);
    const label = Array.from({ length: n }, (_, i) => i);
    let seed = 12345;
    const next = (): number => { seed = (seed * 1664525 + 1013904223) % 4294967296; return Math.floor((seed / 4294967296) * n); };
    for (let step = 0; step < 200; step++) {
      const a = next();
      const b = next();
      const merged = label[a] !== label[b];
      expect(s.union(a, b)).toBe(merged);
      if (merged) { const from = label[b]; for (let i = 0; i < n; i++) if (label[i] === from) label[i] = label[a]; }
      for (let i = 0; i < n; i += 7) for (let j = 0; j < n; j += 5) expect(s.same(i, j)).toBe(label[i] === label[j]);
    }
    const expected = new Map<number, number[]>();
    for (let i = 0; i < n; i++) expected.set(label[i], [...(expected.get(label[i]) ?? []), i]);
    expect(s.groups()).toEqual([...expected.values()]);
  });

  it('μακριά αλυσίδα 100 000 στοιχείων ⇒ καμία υπερχείλιση στοίβας (επαναληπτικό find)', () => {
    const n = 100_000;
    const s = createDisjointSets(n);
    for (let i = 1; i < n; i++) s.union(i - 1, i);
    expect(s.sizeOf(0)).toBe(n);
    expect(s.same(0, n - 1)).toBe(true);
  });

  it('εκτός ορίων / μη ακέραιο ⇒ RangeError, ποτέ σιωπηλά', () => {
    expect(() => createDisjointSets(-1)).toThrow(RangeError);
    expect(() => createDisjointSets(1.5)).toThrow(RangeError);
    const s = createDisjointSets(3);
    expect(() => s.find(3)).toThrow(RangeError);
    expect(() => s.union(0, -1)).toThrow(RangeError);
    expect(() => s.same(0.5, 1)).toThrow(RangeError);
  });
});

describe('createKeyedDisjointSets (ADR-929 §6.9 #20)', () => {
  it('διπλό κλειδί ⇒ μετρά η πρώτη εμφάνιση · αρχικά μονοσύνολα με τη σειρά των keys', () => {
    const s = createKeyedDisjointSets(['c', 'a', 'c', 'b']);
    expect(s.count).toBe(3);
    expect(s.groups()).toEqual([['c'], ['a'], ['b']]);
    expect(s.has('a')).toBe(true);
    expect(s.has('z')).toBe(false);
  });

  it('groups: σύνολα με σειρά πρώτης εμφάνισης, μέλη με σειρά των keys — ανεξάρτητα από σειρά/φορά των ενώσεων', () => {
    const keys = ['w3', 'w1', 'w4', 'w2', 'w5'];
    const forward = createKeyedDisjointSets(keys);
    forward.union('w2', 'w3');
    forward.union('w5', 'w1');
    const backward = createKeyedDisjointSets(keys);
    expect(backward.union('w1', 'w5')).toBe(true);
    expect(backward.union('w3', 'w2')).toBe(true);
    expect(backward.union('w2', 'w3')).toBe(false);
    const expected = [['w3', 'w2'], ['w1', 'w5'], ['w4']];
    expect(forward.groups()).toEqual(expected);
    expect(backward.groups()).toEqual(expected);
    expect(forward.same('w2', 'w3')).toBe(true);
    expect(forward.same('w2', 'w1')).toBe(false);
    expect(forward.sizeOf('w5')).toBe(2);
  });

  it('κλειδιά οποιουδήποτε τύπου (ταυτότητα SameValueZero του Map)', () => {
    const a = { id: 1 };
    const b = { id: 1 };
    const s = createKeyedDisjointSets([a, b]);
    expect(s.same(a, b)).toBe(false);
    s.union(a, b);
    expect(s.groups()).toEqual([[a, b]]);
  });

  it('άγνωστο κλειδί ⇒ RangeError, ποτέ σιωπηλή καταχώριση', () => {
    const s = createKeyedDisjointSets(['a', 'b']);
    expect(() => s.union('a', 'x')).toThrow(RangeError);
    expect(() => s.same('x', 'a')).toThrow(RangeError);
    expect(() => s.sizeOf('x')).toThrow(RangeError);
    expect(s.count).toBe(2);
    expect(s.groups()).toEqual([['a'], ['b']]);
  });
});
