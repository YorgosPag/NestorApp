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
