/**
 * Unit tests for `validateGreekHierarchy` (ADR-332 §3.9).
 */

import { validateGreekHierarchy } from '../helpers/validateGreekHierarchy';
import { buildHierarchyLookup } from '../helpers/hierarchyLookup';
import type { AdminEntity } from '@/hooks/useAdministrativeHierarchy';

const fixture: AdminEntity[] = [
  {
    id: 'region:KM',
    name: 'Κεντρική Μακεδονία',
    shortName: 'Κ. Μακεδονία',
    normalizedName: 'κεντρικη μακεδονια',
    code: 'KM',
    parentId: null,
    level: 3,
  },
  {
    id: 'regional_unit:THES',
    name: 'Π.Ε. Θεσσαλονίκης',
    shortName: 'Π.Ε. Θεσσ.',
    normalizedName: 'π.ε. θεσσαλονικης',
    code: 'THES',
    parentId: 'region:KM',
    level: 4,
  },
  {
    id: 'municipality:THES',
    name: 'Δήμος Θεσσαλονίκης',
    shortName: 'Δ. Θεσσ.',
    normalizedName: 'δημος θεσσαλονικης',
    code: 'M-THES',
    parentId: 'regional_unit:THES',
    level: 5,
  },
  {
    id: 'settlement:54635',
    name: 'Θεσσαλονίκη',
    shortName: 'Θεσσαλονίκη',
    normalizedName: 'θεσσαλονικη',
    code: 'STL-54635',
    parentId: 'municipality:THES',
    level: 8,
    postalCode: '54635',
  },
];

const lookup = buildHierarchyLookup(fixture);

describe('validateGreekHierarchy', () => {
  it('returns valid when no postal code provided', () => {
    const result = validateGreekHierarchy({ city: 'Anywhere' }, lookup);
    expect(result.valid).toBe(true);
    expect(result.mismatches).toHaveLength(0);
  });

  it('flags malformed postal code as error', () => {
    const result = validateGreekHierarchy({ postalCode: '00100' }, lookup);
    expect(result.valid).toBe(false);
    expect(result.mismatches).toHaveLength(1);
    expect(result.mismatches[0].kind).toBe('postal-code-invalid');
    expect(result.mismatches[0].severity).toBe('error');
  });

  it('flags 4-digit postal code as invalid', () => {
    const result = validateGreekHierarchy({ postalCode: '1234' }, lookup);
    expect(result.mismatches[0].kind).toBe('postal-code-invalid');
  });

  it('flags unknown postal code as warning', () => {
    const result = validateGreekHierarchy({ postalCode: '54600' }, lookup);
    expect(result.valid).toBe(false);
    expect(result.mismatches[0].kind).toBe('postal-code-unknown');
    expect(result.mismatches[0].severity).toBe('warning');
  });

  it('returns valid when postal code matches and city is absent', () => {
    const result = validateGreekHierarchy({ postalCode: '54635' }, lookup);
    expect(result.valid).toBe(true);
  });

  it('returns valid when city matches resolved municipality', () => {
    const result = validateGreekHierarchy(
      { postalCode: '54635', city: 'Δήμος Θεσσαλονίκης' },
      lookup,
    );
    expect(result.valid).toBe(true);
  });

  it('matches case- and accent-insensitively', () => {
    const result = validateGreekHierarchy(
      { postalCode: '54635', city: 'δημος θεσσαλονικης' },
      lookup,
    );
    expect(result.valid).toBe(true);
  });

  it('flags region mismatch when city contradicts postal code', () => {
    const result = validateGreekHierarchy(
      { postalCode: '54635', city: 'Athens' },
      lookup,
    );
    expect(result.valid).toBe(false);
    const mismatch = result.mismatches.find((m) => m.field === 'city');
    expect(mismatch).toBeDefined();
    expect(mismatch!.kind).toBe('postal-code-region-mismatch');
    expect(mismatch!.expected).toBe('Δήμος Θεσσαλονίκης');
    expect(mismatch!.got).toBe('Athens');
  });

  it('flags region mismatch on the regional unit field too', () => {
    const result = validateGreekHierarchy(
      {
        postalCode: '54635',
        county: 'Wrong Regional Unit',
      },
      lookup,
    );
    expect(result.mismatches.some((m) => m.field === 'county')).toBe(true);
  });

  it('produces i18n keys without raw strings', () => {
    const result = validateGreekHierarchy({ postalCode: '00000' }, lookup);
    for (const m of result.mismatches) {
      expect(m.i18nKey).toMatch(/^addresses\.hierarchy\./);
    }
  });
});
