/**
 * @tests Domain Definitions — ADR-268 Report Builder
 * Validates all 4 domain schemas have correct structure, no duplicate keys, valid types.
 */

import {
  DOMAIN_DEFINITIONS,
  getDomainDefinition,
  getFieldDefinition,
  getFilterableFields,
  getDefaultColumns,
  getSortableFields,
} from '../domain-definitions';
import {
  VALID_DOMAIN_IDS,
  type BuilderDomainId,
  type FieldValueType,
} from '../report-builder-types';

// ============================================================================
// Schema Integrity
// ============================================================================

describe('Domain Definitions — Schema Integrity', () => {
  it('defines all 4 Phase 1 domains', () => {
    const definedIds = Object.keys(DOMAIN_DEFINITIONS);
    expect(definedIds).toHaveLength(4);
    expect(definedIds).toEqual(
      expect.arrayContaining(['projects', 'buildings', 'floors', 'units']),
    );
  });

  it.each(VALID_DOMAIN_IDS)('%s has required properties', (domainId) => {
    const def = getDomainDefinition(domainId);

    expect(def.id).toBe(domainId);
    expect(def.collection).toBeTruthy();
    expect(def.labelKey).toMatch(/^domains\.\w+\.label$/);
    expect(def.descriptionKey).toMatch(/^domains\.\w+\.description$/);
    expect(def.entityLinkPath).toContain('{');
    expect(def.fields.length).toBeGreaterThan(0);
    expect(def.defaultSortField).toBeTruthy();
    expect(['asc', 'desc']).toContain(def.defaultSortDirection);
  });

  it.each(VALID_DOMAIN_IDS)('%s has no duplicate field keys', (domainId) => {
    const def = getDomainDefinition(domainId);
    const keys = def.fields.map((f) => f.key);
    const unique = new Set(keys);
    expect(keys.length).toBe(unique.size);
  });

  it.each(VALID_DOMAIN_IDS)('%s defaultSortField exists in fields', (domainId) => {
    const def = getDomainDefinition(domainId);
    const fieldKeys = def.fields.map((f) => f.key);
    expect(fieldKeys).toContain(def.defaultSortField);
  });

  it.each(VALID_DOMAIN_IDS)(
    '%s fields have valid FieldValueType',
    (domainId) => {
      const validTypes: FieldValueType[] = [
        'text', 'enum', 'number', 'currency', 'percentage', 'date', 'boolean',
      ];
      const def = getDomainDefinition(domainId);
      for (const field of def.fields) {
        expect(validTypes).toContain(field.type);
      }
    },
  );
});

// ============================================================================
// Enum Fields
// ============================================================================

describe('Domain Definitions — Enum Fields', () => {
  it.each(VALID_DOMAIN_IDS)(
    '%s enum fields have enumValues defined',
    (domainId) => {
      const def = getDomainDefinition(domainId);
      const enumFields = def.fields.filter((f) => f.type === 'enum');

      for (const field of enumFields) {
        expect(field.enumValues).toBeDefined();
        expect(field.enumValues!.length).toBeGreaterThan(0);
        expect(field.enumLabelPrefix).toBeTruthy();
      }
    },
  );

  it.each(VALID_DOMAIN_IDS)(
    '%s non-enum fields do NOT have enumValues',
    (domainId) => {
      const def = getDomainDefinition(domainId);
      const nonEnumFields = def.fields.filter((f) => f.type !== 'enum');

      for (const field of nonEnumFields) {
        expect(field.enumValues).toBeUndefined();
      }
    },
  );
});

// ============================================================================
// Ref Fields
// ============================================================================

describe('Domain Definitions — Reference Fields', () => {
  it.each(VALID_DOMAIN_IDS)(
    '%s ref fields point to valid domains',
    (domainId) => {
      const def = getDomainDefinition(domainId);
      const refFields = def.fields.filter((f) => f.refDomain);

      for (const field of refFields) {
        expect(VALID_DOMAIN_IDS).toContain(field.refDomain);
        // Ref should not point to self
        expect(field.refDomain).not.toBe(domainId);
      }
    },
  );

  it('buildings.projectId refs projects', () => {
    const field = getFieldDefinition('buildings', 'projectId');
    expect(field?.refDomain).toBe('projects');
    expect(field?.refDisplayField).toBe('name');
  });

  it('units.buildingId refs buildings', () => {
    const field = getFieldDefinition('units', 'buildingId');
    expect(field?.refDomain).toBe('buildings');
  });

  it('units.project refs projects', () => {
    const field = getFieldDefinition('units', 'project');
    expect(field?.refDomain).toBe('projects');
  });
});

// ============================================================================
// Accessor Functions
// ============================================================================

describe('Domain Definitions — Accessors', () => {
  it('getDomainDefinition throws for invalid ID', () => {
    expect(() =>
      getDomainDefinition('invalid' as BuilderDomainId),
    ).toThrow('Unknown domain');
  });

  it('getFieldDefinition returns undefined for missing field', () => {
    expect(getFieldDefinition('projects', 'nonExistent')).toBeUndefined();
  });

  it('getFilterableFields returns only filterable fields', () => {
    const fields = getFilterableFields('projects');
    expect(fields.length).toBeGreaterThan(0);
    expect(fields.every((f) => f.filterable)).toBe(true);
  });

  it('getDefaultColumns returns only defaultVisible field keys', () => {
    const columns = getDefaultColumns('units');
    expect(columns.length).toBeGreaterThan(0);

    const def = getDomainDefinition('units');
    for (const key of columns) {
      const field = def.fields.find((f) => f.key === key);
      expect(field?.defaultVisible).toBe(true);
    }
  });

  it('getSortableFields returns only sortable fields', () => {
    const fields = getSortableFields('buildings');
    expect(fields.length).toBeGreaterThan(0);
    expect(fields.every((f) => f.sortable)).toBe(true);
  });
});

// ============================================================================
// Format Field Consistency
// ============================================================================

describe('Domain Definitions — Format Consistency', () => {
  it.each(VALID_DOMAIN_IDS)(
    '%s currency fields have format: currency',
    (domainId) => {
      const def = getDomainDefinition(domainId);
      const currencyFields = def.fields.filter((f) => f.type === 'currency');
      for (const field of currencyFields) {
        expect(field.format).toBe('currency');
      }
    },
  );

  it.each(VALID_DOMAIN_IDS)(
    '%s percentage fields have format: percentage',
    (domainId) => {
      const def = getDomainDefinition(domainId);
      const pctFields = def.fields.filter((f) => f.type === 'percentage');
      for (const field of pctFields) {
        expect(field.format).toBe('percentage');
      }
    },
  );

  it.each(VALID_DOMAIN_IDS)(
    '%s date fields have format: date',
    (domainId) => {
      const def = getDomainDefinition(domainId);
      const dateFields = def.fields.filter((f) => f.type === 'date');
      for (const field of dateFields) {
        expect(field.format).toBe('date');
      }
    },
  );
});
