import {
  compareOrderKeys,
  isValidOrderKey,
  keyBetween,
  keysBetween,
  OrderKeyError,
} from '../fractional-index';

/** Ντετερμινιστική ψευδοτυχαιότητα (mulberry32) — το test πρέπει να είναι αναπαραγώγιμο. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function assertStrictlyAscending(keys: readonly string[]): void {
  for (let i = 1; i < keys.length; i++) {
    expect(compareOrderKeys(keys[i - 1], keys[i])).toBe(-1);
  }
}

describe('keyBetween', () => {
  it('gives the canonical first key for an empty list', () => {
    expect(keyBetween(null, null)).toBe('a0');
  });

  it('produces keys strictly between the bounds', () => {
    const cases: Array<[string | null, string | null]> = [
      ['a0', null], [null, 'a0'], ['a0', 'a1'], ['a0', 'a0V'], ['Zz', 'a0'], ['a1', 'a2'], ['a0V', 'a1'],
    ];
    for (const [a, b] of cases) {
      const key = keyBetween(a, b);
      expect(isValidOrderKey(key)).toBe(true);
      if (a !== null) expect(compareOrderKeys(a, key)).toBe(-1);
      if (b !== null) expect(compareOrderKeys(key, b)).toBe(-1);
    }
  });

  it('rejects reversed or equal bounds and malformed keys', () => {
    expect(() => keyBetween('a1', 'a0')).toThrow(OrderKeyError);
    expect(() => keyBetween('a1', 'a1')).toThrow(OrderKeyError);
    expect(() => keyBetween('a10', null)).toThrow(OrderKeyError); // τελικό μηδέν
    expect(() => keyBetween('!', null)).toThrow(OrderKeyError);
  });

  it('survives 2000 random inserts and keeps a strict total order', () => {
    const random = seeded(923);
    const keys: string[] = [keyBetween(null, null)];
    for (let i = 0; i < 2000; i++) {
      const position = Math.floor(random() * (keys.length + 1));
      const before = position === 0 ? null : keys[position - 1];
      const after = position === keys.length ? null : keys[position];
      keys.splice(position, 0, keyBetween(before, after));
    }
    assertStrictlyAscending(keys);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('keeps keys short under repeated appends (no unbounded growth)', () => {
    let key = keyBetween(null, null);
    for (let i = 0; i < 1000; i++) key = keyBetween(key, null);
    expect(key.length).toBeLessThanOrEqual(4);
  });
});

describe('keysBetween', () => {
  it('returns exactly N ascending keys inside the bounds', () => {
    for (const [a, b] of [[null, null], ['a0', null], [null, 'a0'], ['a0', 'a1']] as const) {
      const keys = keysBetween(a, b, 25);
      expect(keys).toHaveLength(25);
      assertStrictlyAscending(keys);
      if (a !== null) expect(compareOrderKeys(a, keys[0])).toBe(-1);
      if (b !== null) expect(compareOrderKeys(keys[keys.length - 1], b)).toBe(-1);
    }
  });

  it('returns nothing for a non-positive count', () => {
    expect(keysBetween(null, null, 0)).toEqual([]);
  });
});

describe('ordering contract', () => {
  it('compares by code unit, never by locale (case-sensitive)', () => {
    expect(compareOrderKeys('Zz', 'a0')).toBe(-1);
    expect(['a0', 'Zz', 'a1'].sort(compareOrderKeys)).toEqual(['Zz', 'a0', 'a1']);
  });

  it('validates untrusted input', () => {
    expect(isValidOrderKey('a0')).toBe(true);
    expect(isValidOrderKey('')).toBe(false);
    expect(isValidOrderKey(42)).toBe(false);
    expect(isValidOrderKey('a00')).toBe(false);
  });
});
