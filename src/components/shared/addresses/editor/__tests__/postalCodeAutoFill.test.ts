/**
 * Unit tests for `postalCodeAutoFill` (ADR-332 §4 Phase 9).
 *
 * Uses an in-memory hierarchy fixture so the tests stay deterministic and
 * avoid importing the 3.2 MB `administrative-hierarchy.json` payload.
 */

import {
  autoFillFromPostalCode,
  isValidGreekPostalCode,
} from '../helpers/postalCodeAutoFill';
import { buildHierarchyLookup } from '../helpers/hierarchyLookup';
import type { AdminEntity } from '@/hooks/useAdministrativeHierarchy';

function entity(partial: Partial<AdminEntity> & Pick<AdminEntity, 'id' | 'name' | 'level'>): AdminEntity {
  return {
    shortName: partial.name,
    normalizedName: partial.name.toLowerCase(),
    code: partial.code ?? partial.id,
    parentId: partial.parentId ?? null,
    postalCode: partial.postalCode,
    article: partial.article,
    ...partial,
  } as AdminEntity;
}

const fixture: AdminEntity[] = [
  entity({ id: 'region:KM', name: 'Κεντρική Μακεδονία', level: 3, parentId: null }),
  entity({ id: 'regional_unit:THES', name: 'Π.Ε. Θεσσαλονίκης', level: 4, parentId: 'region:KM' }),
  entity({ id: 'municipality:THES', name: 'Δήμος Θεσσαλονίκης', level: 5, parentId: 'regional_unit:THES' }),
  entity({ id: 'municipal_unit:THES', name: 'Δ.Ε. Θεσσαλονίκης', level: 6, parentId: 'municipality:THES' }),
  entity({ id: 'community:THES', name: 'Κοινότητα Θεσσαλονίκης', level: 7, parentId: 'municipal_unit:THES' }),
  entity({
    id: 'settlement:THES1',
    name: 'Θεσσαλονίκη',
    level: 8,
    parentId: 'community:THES',
    postalCode: '54635',
  }),
  // Second settlement sharing a postal code, in a different municipality →
  // postal-code lookup should report only common ancestors (region only).
  entity({ id: 'region:KM2', name: 'Κεντρική Μακεδονία', level: 3, parentId: null }),
  entity({
    id: 'regional_unit:KIL',
    name: 'Π.Ε. Κιλκίς',
    level: 4,
    parentId: 'region:KM',
  }),
  entity({
    id: 'municipality:KIL',
    name: 'Δήμος Κιλκίς',
    level: 5,
    parentId: 'regional_unit:KIL',
  }),
  entity({
    id: 'settlement:SHARED1',
    name: 'Άνω Λεύκη',
    level: 8,
    parentId: 'municipality:KIL',
    postalCode: '99999',
  }),
  entity({
    id: 'settlement:SHARED2',
    name: 'Κάτω Λεύκη',
    level: 8,
    parentId: 'municipality:THES',
    postalCode: '99999',
  }),
];

const lookup = buildHierarchyLookup(fixture);

describe('isValidGreekPostalCode', () => {
  it.each([
    ['54635', true],
    ['10000', true],
    ['00000', false],
    ['00100', false],
    ['1234', false],
    ['123456', false],
    ['ABCDE', false],
    ['', false],
  ])('validates %s → %s', (input, expected) => {
    expect(isValidGreekPostalCode(input)).toBe(expected);
  });
});

describe('autoFillFromPostalCode', () => {
  it('returns null for malformed postal code', () => {
    expect(autoFillFromPostalCode('1234', lookup)).toBeNull();
    expect(autoFillFromPostalCode('00000', lookup)).toBeNull();
  });

  it('returns null when no settlement matches', () => {
    expect(autoFillFromPostalCode('54600', lookup)).toBeNull();
  });

  it('autofills full chain for unique postal code', () => {
    const result = autoFillFromPostalCode('54635', lookup);
    expect(result).not.toBeNull();
    expect(result!.postalCode).toBe('54635');
    expect(result!.settlementCandidates).toHaveLength(1);
    expect(result!.fields).toEqual({
      city: 'Δήμος Θεσσαλονίκης',
      county: 'Π.Ε. Θεσσαλονίκης',
      region: 'Κεντρική Μακεδονία',
      country: 'Ελλάδα',
    });
  });

  it('returns only common ancestors for shared postal code', () => {
    const result = autoFillFromPostalCode('99999', lookup);
    expect(result).not.toBeNull();
    expect(result!.settlementCandidates).toHaveLength(2);
    // Region matches (same parent chain), municipality differs → skipped.
    expect(result!.fields.region).toBe('Κεντρική Μακεδονία');
    expect(result!.fields.city).toBeUndefined();
    expect(result!.fields.county).toBeUndefined();
  });
});
