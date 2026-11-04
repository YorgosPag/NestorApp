import { removeAt, replaceAt } from '../array-utils';

describe('array-utils — immutable list edits (ADR-928 Φ3γ-2)', () => {
  const items = ['a', 'b', 'c'] as const;

  it('replaceAt returns a new array with only row i changed', () => {
    const next = replaceAt(items, 1, 'B');
    expect(next).toEqual(['a', 'B', 'c']);
    expect(items).toEqual(['a', 'b', 'c']);
  });

  it('removeAt drops only row i', () => {
    expect(removeAt(items, 0)).toEqual(['b', 'c']);
    expect(removeAt(items, 2)).toEqual(['a', 'b']);
  });

  it.each([-1, 3, 1.5, Number.NaN])('an index outside the list (%p) returns the SAME array', (index) => {
    expect(replaceAt(items, index, 'x')).toBe(items);
    expect(removeAt(items, index)).toBe(items);
  });
});
