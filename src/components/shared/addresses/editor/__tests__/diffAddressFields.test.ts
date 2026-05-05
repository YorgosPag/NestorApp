/**
 * Tests — diffAddressFields (ADR-332 Phase 1)
 */

import { diffAddressFields, hasFieldConflicts } from '../helpers/diffAddressFields';

describe('diffAddressFields', () => {
  it('returns empty when no fields differ', () => {
    expect(
      diffAddressFields(
        { street: 'Πανεπιστημίου', postalCode: '54635', city: 'Θεσσαλονίκη' },
        { street: 'Πανεπιστημίου', postalCode: '54635', city: 'Θεσσαλονίκη' },
      ),
    ).toEqual([]);
  });

  it('detects mismatch on differing values', () => {
    const out = diffAddressFields(
      { postalCode: '54600', city: 'Θεσσαλονίκη' },
      { postalCode: '54635', city: 'Θεσσαλονίκη' },
    );
    expect(out).toEqual([{ field: 'postalCode', userValue: '54600', resolvedValue: '54635' }]);
  });

  it('treats empty user field as not-a-conflict', () => {
    const out = diffAddressFields(
      { city: '' },
      { city: 'Θεσσαλονίκη' },
    );
    expect(out).toEqual([]);
  });

  it('treats empty resolved field as not-a-conflict', () => {
    const out = diffAddressFields(
      { city: 'Θεσσαλονίκη' },
      { city: '' },
    );
    expect(out).toEqual([]);
  });

  it('is case-insensitive and accent-insensitive', () => {
    const out = diffAddressFields(
      { city: 'ΘΕΣΣΑΛΟΝΙΚΗ' },
      { city: 'Θεσσαλονίκη' },
    );
    expect(out).toEqual([]);
  });

  it('trims whitespace before comparison', () => {
    const out = diffAddressFields(
      { city: '  Θεσσαλονίκη  ' },
      { city: 'Θεσσαλονίκη' },
    );
    expect(out).toEqual([]);
  });

  it('returns multiple conflicts when several fields differ', () => {
    const out = diffAddressFields(
      { street: 'Παύλου Μελά', city: 'Καλαμαριά', postalCode: '55131' },
      { street: 'Πανεπιστημίου', city: 'Θεσσαλονίκη', postalCode: '54635' },
    );
    expect(out).toHaveLength(3);
    expect(out.map((c) => c.field).sort()).toEqual(['city', 'postalCode', 'street']);
  });

  it('hasFieldConflicts is true iff diff non-empty', () => {
    expect(hasFieldConflicts({ city: 'Α' }, { city: 'Β' })).toBe(true);
    expect(hasFieldConflicts({ city: 'Α' }, { city: 'Α' })).toBe(false);
    expect(hasFieldConflicts({}, {})).toBe(false);
  });
});
