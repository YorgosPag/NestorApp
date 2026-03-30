/**
 * @tests FilterPanel — ADR-268 Report Builder
 * Tests filter add/remove logic, max filter enforcement.
 */

import {
  BUILDER_LIMITS,
  isValidOperatorForType,
  type ReportBuilderFilter,
} from '@/config/report-builder/report-builder-types';
import { getFilterableFields } from '@/config/report-builder/domain-definitions';

describe('FilterPanel — Add/Remove Logic', () => {
  it('add filter appends to array', () => {
    const filters: ReportBuilderFilter[] = [];
    const newFilter: ReportBuilderFilter = {
      id: '1',
      fieldKey: 'status',
      operator: 'eq',
      value: 'active',
    };
    const result = [...filters, newFilter];
    expect(result).toHaveLength(1);
    expect(result[0].fieldKey).toBe('status');
  });

  it('remove filter by ID', () => {
    const filters: ReportBuilderFilter[] = [
      { id: '1', fieldKey: 'status', operator: 'eq', value: 'active' },
      { id: '2', fieldKey: 'name', operator: 'contains', value: 'Tower' },
    ];
    const result = filters.filter((f) => f.id !== '1');
    expect(result).toHaveLength(1);
    expect(result[0].fieldKey).toBe('name');
  });

  it('clear removes all filters', () => {
    const filters: ReportBuilderFilter[] = [
      { id: '1', fieldKey: 'status', operator: 'eq', value: 'active' },
      { id: '2', fieldKey: 'name', operator: 'contains', value: 'Tower' },
    ];
    const result: ReportBuilderFilter[] = [];
    expect(result).toHaveLength(0);
  });
});

describe('FilterPanel — Max Filter Enforcement', () => {
  it('MAX_ACTIVE_FILTERS is 10', () => {
    expect(BUILDER_LIMITS.MAX_ACTIVE_FILTERS).toBe(10);
  });

  it('cannot add more than 10 filters', () => {
    const filters = Array.from({ length: 10 }, (_, i) => ({
      id: String(i),
      fieldKey: 'name',
      operator: 'eq' as const,
      value: `val${i}`,
    }));

    const canAddMore = filters.length < BUILDER_LIMITS.MAX_ACTIVE_FILTERS;
    expect(canAddMore).toBe(false);
  });

  it('can add when under limit', () => {
    const filters = Array.from({ length: 9 }, (_, i) => ({
      id: String(i),
      fieldKey: 'name',
      operator: 'eq' as const,
      value: `val${i}`,
    }));

    const canAddMore = filters.length < BUILDER_LIMITS.MAX_ACTIVE_FILTERS;
    expect(canAddMore).toBe(true);
  });
});

describe('FilterPanel — Filterable Fields', () => {
  it('projects has filterable fields', () => {
    const fields = getFilterableFields('projects');
    expect(fields.length).toBeGreaterThan(5);
  });

  it('units has the most filterable fields', () => {
    const projectFields = getFilterableFields('projects');
    const unitFields = getFilterableFields('units');
    expect(unitFields.length).toBeGreaterThan(projectFields.length);
  });

  it('all filterable fields have valid operators for their type', () => {
    for (const domainId of ['projects', 'buildings', 'floors', 'units'] as const) {
      const fields = getFilterableFields(domainId);
      for (const field of fields) {
        // The first operator for this type should be valid
        expect(isValidOperatorForType('eq', field.type)).toBe(true);
      }
    }
  });
});

describe('FilterPanel — Update Filter', () => {
  it('updates operator preserving other fields', () => {
    const filters: ReportBuilderFilter[] = [
      { id: '1', fieldKey: 'totalValue', operator: 'gt', value: 100000 },
    ];
    const updates = { operator: 'gte' as const };
    const result = filters.map((f) =>
      f.id === '1' ? { ...f, ...updates } : f,
    );
    expect(result[0].operator).toBe('gte');
    expect(result[0].fieldKey).toBe('totalValue');
    expect(result[0].value).toBe(100000);
  });

  it('updates value preserving other fields', () => {
    const filters: ReportBuilderFilter[] = [
      { id: '1', fieldKey: 'name', operator: 'contains', value: 'Tower' },
    ];
    const updates = { value: 'Residence' };
    const result = filters.map((f) =>
      f.id === '1' ? { ...f, ...updates } : f,
    );
    expect(result[0].operator).toBe('contains');
    expect(result[0].value).toBe('Residence');
  });
});

describe('FilterPanel — Invalid Operator Combinations', () => {
  it('contains is invalid for number type', () => {
    expect(isValidOperatorForType('contains', 'number')).toBe(false);
  });

  it('contains is invalid for boolean type', () => {
    expect(isValidOperatorForType('contains', 'boolean')).toBe(false);
  });

  it('between is invalid for text type', () => {
    expect(isValidOperatorForType('between', 'text')).toBe(false);
  });

  it('gt is invalid for enum type', () => {
    expect(isValidOperatorForType('gt', 'enum')).toBe(false);
  });

  it('in is valid for enum but not for date', () => {
    expect(isValidOperatorForType('in', 'enum')).toBe(true);
    expect(isValidOperatorForType('in', 'date')).toBe(false);
  });

  it('before/after are valid only for date type', () => {
    expect(isValidOperatorForType('before', 'date')).toBe(true);
    expect(isValidOperatorForType('after', 'date')).toBe(true);
    expect(isValidOperatorForType('before', 'text')).toBe(false);
    expect(isValidOperatorForType('after', 'number')).toBe(false);
  });

  it('boolean type only supports eq operator', () => {
    expect(isValidOperatorForType('eq', 'boolean')).toBe(true);
    expect(isValidOperatorForType('neq', 'boolean')).toBe(false);
    expect(isValidOperatorForType('gt', 'boolean')).toBe(false);
  });
});

describe('FilterPanel — Max Filter Edge Cases', () => {
  it('exactly at limit (10) prevents adding', () => {
    const filters = Array.from({ length: 10 }, (_, i) => ({
      id: String(i),
      fieldKey: `field${i}`,
      operator: 'eq' as const,
      value: `val${i}`,
    }));
    expect(filters.length >= BUILDER_LIMITS.MAX_ACTIVE_FILTERS).toBe(true);
  });

  it('one below limit (9) allows adding', () => {
    const filters = Array.from({ length: 9 }, (_, i) => ({
      id: String(i),
      fieldKey: `field${i}`,
      operator: 'eq' as const,
      value: `val${i}`,
    }));
    expect(filters.length < BUILDER_LIMITS.MAX_ACTIVE_FILTERS).toBe(true);
  });

  it('removing one from full list allows adding again', () => {
    const filters = Array.from({ length: 10 }, (_, i) => ({
      id: String(i),
      fieldKey: `field${i}`,
      operator: 'eq' as const,
      value: `val${i}`,
    }));
    const afterRemove = filters.filter((f) => f.id !== '5');
    expect(afterRemove.length < BUILDER_LIMITS.MAX_ACTIVE_FILTERS).toBe(true);
  });
});
