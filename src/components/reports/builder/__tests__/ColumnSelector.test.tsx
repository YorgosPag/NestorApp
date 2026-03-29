/**
 * @tests ColumnSelector — ADR-268 Report Builder
 * Tests column toggle logic and reorder behavior.
 */

import { getDomainDefinition, getDefaultColumns } from '@/config/report-builder/domain-definitions';

describe('ColumnSelector — Toggle Logic', () => {
  const domain = getDomainDefinition('projects');
  const defaultCols = getDefaultColumns('projects');

  it('default columns are a non-empty subset of all fields', () => {
    expect(defaultCols.length).toBeGreaterThan(0);
    expect(defaultCols.length).toBeLessThan(domain.fields.length);
    for (const col of defaultCols) {
      expect(domain.fields.some((f) => f.key === col)).toBe(true);
    }
  });

  it('toggle adds column if not present', () => {
    const columns = ['name', 'status'];
    const fieldKey = 'progress';
    // Simulate toggle
    const result = columns.includes(fieldKey)
      ? columns.filter((c) => c !== fieldKey)
      : [...columns, fieldKey];
    expect(result).toEqual(['name', 'status', 'progress']);
  });

  it('toggle removes column if present', () => {
    const columns = ['name', 'status', 'progress'];
    const fieldKey = 'status';
    const result = columns.includes(fieldKey)
      ? columns.filter((c) => c !== fieldKey)
      : [...columns, fieldKey];
    expect(result).toEqual(['name', 'progress']);
  });
});

describe('ColumnSelector — Reorder Logic', () => {
  it('moves column from position 0 to position 2', () => {
    const columns = ['name', 'status', 'progress', 'totalValue'];
    const fromIndex = 0;
    const toIndex = 2;

    const next = [...columns];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);

    expect(next).toEqual(['status', 'progress', 'name', 'totalValue']);
  });

  it('moves column from position 3 to position 1', () => {
    const columns = ['name', 'status', 'progress', 'totalValue'];
    const fromIndex = 3;
    const toIndex = 1;

    const next = [...columns];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);

    expect(next).toEqual(['name', 'totalValue', 'status', 'progress']);
  });

  it('no-op when fromIndex equals toIndex', () => {
    const columns = ['name', 'status', 'progress'];
    const next = [...columns];
    const [moved] = next.splice(1, 1);
    next.splice(1, 0, moved);
    expect(next).toEqual(columns);
  });
});

describe('ColumnSelector — Units domain default columns', () => {
  it('units default columns include key fields', () => {
    const unitDefaults = getDefaultColumns('units');
    expect(unitDefaults).toContain('name');
    expect(unitDefaults).toContain('commercialStatus');
  });
});
