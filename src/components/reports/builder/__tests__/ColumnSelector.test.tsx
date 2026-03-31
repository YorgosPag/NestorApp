/**
 * @tests ColumnSelector — ADR-268 Report Builder
 * Tests column toggle logic and reorder behavior.
 */

import { getDomainDefinition, getDefaultColumns } from '@/config/report-builder/domain-definitions';
import { VALID_DOMAIN_IDS } from '@/config/report-builder/report-builder-types';

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

describe('ColumnSelector — Properties domain default columns', () => {
  it('properties default columns include key fields', () => {
    const unitDefaults = getDefaultColumns('properties');
    expect(unitDefaults).toContain('name');
    expect(unitDefaults).toContain('commercialStatus');
  });
});

describe('ColumnSelector — Boundary & Duplicate Detection', () => {
  it('default columns are always non-empty for every domain', () => {
    for (const id of VALID_DOMAIN_IDS) {
      const defaults = getDefaultColumns(id);
      expect(defaults.length).toBeGreaterThan(0);
    }
  });

  it('default columns contain no duplicates for any domain', () => {
    for (const id of VALID_DOMAIN_IDS) {
      const defaults = getDefaultColumns(id);
      const unique = new Set(defaults);
      expect(defaults.length).toBe(unique.size);
    }
  });

  it('toggle to 0 columns leaves empty array (minimum boundary)', () => {
    const columns = ['name'];
    const result = columns.filter((c) => c !== 'name');
    expect(result).toHaveLength(0);
  });

  it('adding duplicate column does not create duplicates (guard logic)', () => {
    const columns = ['name', 'status'];
    const fieldKey = 'name'; // already present
    const result = columns.includes(fieldKey)
      ? columns // no-op: already present
      : [...columns, fieldKey];
    expect(result).toEqual(['name', 'status']);
    expect(new Set(result).size).toBe(result.length);
  });

  it('all default column keys exist in domain field definitions', () => {
    for (const id of VALID_DOMAIN_IDS) {
      const def = getDomainDefinition(id);
      const fieldKeys = def.fields.map((f) => f.key);
      const defaults = getDefaultColumns(id);
      for (const col of defaults) {
        expect(fieldKeys).toContain(col);
      }
    }
  });
});
