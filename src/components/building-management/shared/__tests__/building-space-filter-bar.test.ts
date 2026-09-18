/**
 * BuildingSpaceFilterBar — the value narrowing shared by the Units, Parking and Storage tabs.
 */

import { narrowSpaceFilterValue } from '../BuildingSpaceFilterBar';

type Kind = 'small' | 'large';

const OPTIONS = [
  { value: 'small', label: 'Small' },
  { value: 'large', label: 'Large' },
] as const satisfies ReadonlyArray<{ value: Kind; label: string }>;

describe('narrowSpaceFilterValue', () => {
  it('keeps the «all» sentinel', () => {
    expect(narrowSpaceFilterValue<Kind>('all', OPTIONS)).toBe('all');
  });

  it('passes a listed option through', () => {
    expect(narrowSpaceFilterValue<Kind>('large', OPTIONS)).toBe('large');
  });

  it('rejects anything that is not listed', () => {
    expect(narrowSpaceFilterValue<Kind>('huge', OPTIONS)).toBeNull();
    expect(narrowSpaceFilterValue<Kind>('', OPTIONS)).toBeNull();
  });
});
