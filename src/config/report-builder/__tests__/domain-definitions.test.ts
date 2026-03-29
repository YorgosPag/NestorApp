/**
 * @tests Domain Definitions — ADR-268 Report Builder
 * Validates all 8 domain schemas have correct structure, no duplicate keys, valid types.
 * Phase 4a: +parking, storage, individuals, companies (group, preFilters, conditionalOn)
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
  DOMAIN_GROUP_ORDER,
  type BuilderDomainId,
  type FieldValueType,
  type DomainGroup,
} from '../report-builder-types';
import { getNestedValue } from '@/services/report-engine/report-query-executor';

// ============================================================================
// Schema Integrity
// ============================================================================

describe('Domain Definitions — Schema Integrity', () => {
  it('defines all 8 domains (Phase 1 + Phase 4a)', () => {
    const definedIds = Object.keys(DOMAIN_DEFINITIONS);
    expect(definedIds).toHaveLength(8);
    expect(definedIds).toEqual(
      expect.arrayContaining([
        'projects', 'buildings', 'floors', 'units',
        'parking', 'storage', 'individuals', 'companies',
      ]),
    );
  });

  it('VALID_DOMAIN_IDS matches DOMAIN_DEFINITIONS keys', () => {
    const defKeys = Object.keys(DOMAIN_DEFINITIONS).sort();
    const validIds = [...VALID_DOMAIN_IDS].sort();
    expect(validIds).toEqual(defKeys);
  });

  it.each(VALID_DOMAIN_IDS)('%s has required properties', (domainId) => {
    const def = getDomainDefinition(domainId);

    expect(def.id).toBe(domainId);
    expect(def.collection).toBeTruthy();
    expect(def.group).toBeTruthy();
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
// Phase 4a — Domain Groups (Q87)
// ============================================================================

describe('Domain Definitions — Groups', () => {
  const validGroups: DomainGroup[] = [...DOMAIN_GROUP_ORDER];

  it.each(VALID_DOMAIN_IDS)('%s has a valid group', (domainId) => {
    const def = getDomainDefinition(domainId);
    expect(validGroups).toContain(def.group);
  });

  it('real estate domains have group realestate', () => {
    for (const id of ['projects', 'buildings', 'floors', 'units', 'parking', 'storage'] as BuilderDomainId[]) {
      expect(getDomainDefinition(id).group).toBe('realestate');
    }
  });

  it('contact domains have group people', () => {
    for (const id of ['individuals', 'companies'] as BuilderDomainId[]) {
      expect(getDomainDefinition(id).group).toBe('people');
    }
  });

  it('every domain is covered by at least one group', () => {
    for (const id of VALID_DOMAIN_IDS) {
      const def = getDomainDefinition(id);
      expect(DOMAIN_GROUP_ORDER).toContain(def.group);
    }
  });
});

// ============================================================================
// Phase 4a — PreFilters
// ============================================================================

describe('Domain Definitions — PreFilters', () => {
  it('individuals has type==individual preFilter', () => {
    const def = getDomainDefinition('individuals');
    expect(def.preFilters).toBeDefined();
    expect(def.preFilters).toHaveLength(1);
    expect(def.preFilters![0]).toEqual({
      fieldPath: 'type',
      opStr: '==',
      value: 'individual',
    });
  });

  it('companies has type IN [company, service] preFilter', () => {
    const def = getDomainDefinition('companies');
    expect(def.preFilters).toBeDefined();
    expect(def.preFilters).toHaveLength(1);
    expect(def.preFilters![0]).toEqual({
      fieldPath: 'type',
      opStr: 'in',
      value: ['company', 'service'],
    });
  });

  it('parking has no preFilters', () => {
    expect(getDomainDefinition('parking').preFilters).toBeUndefined();
  });

  it('storage has no preFilters', () => {
    expect(getDomainDefinition('storage').preFilters).toBeUndefined();
  });

  it('Phase 1 domains have no preFilters', () => {
    for (const id of ['projects', 'buildings', 'floors', 'units'] as BuilderDomainId[]) {
      expect(getDomainDefinition(id).preFilters).toBeUndefined();
    }
  });
});

// ============================================================================
// Phase 4a — ConditionalOn (Q92)
// ============================================================================

describe('Domain Definitions — ConditionalOn', () => {
  it('companies.companyName is conditional on type=company', () => {
    const field = getFieldDefinition('companies', 'companyName');
    expect(field?.conditionalOn).toEqual({ field: 'type', value: 'company' });
  });

  it('companies.serviceName is conditional on type=service', () => {
    const field = getFieldDefinition('companies', 'serviceName');
    expect(field?.conditionalOn).toEqual({ field: 'type', value: 'service' });
  });

  it('companies.legalForm is conditional on type=company', () => {
    const field = getFieldDefinition('companies', 'legalForm');
    expect(field?.conditionalOn).toEqual({ field: 'type', value: 'company' });
  });

  it('companies.serviceType is conditional on type=service', () => {
    const field = getFieldDefinition('companies', 'serviceType');
    expect(field?.conditionalOn).toEqual({ field: 'type', value: 'service' });
  });

  it('individuals fields have no conditionalOn', () => {
    const def = getDomainDefinition('individuals');
    for (const field of def.fields) {
      expect(field.conditionalOn).toBeUndefined();
    }
  });
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

  it('parking.buildingId refs buildings', () => {
    const field = getFieldDefinition('parking', 'buildingId');
    expect(field?.refDomain).toBe('buildings');
    expect(field?.refDisplayField).toBe('name');
  });

  it('storage.buildingId refs buildings', () => {
    const field = getFieldDefinition('storage', 'buildingId');
    expect(field?.refDomain).toBe('buildings');
    expect(field?.refDisplayField).toBe('name');
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

// ============================================================================
// getNestedValue — Array Index Support (Phase 4a)
// ============================================================================

describe('getNestedValue — Array Index Support', () => {
  it('resolves simple dot path', () => {
    const obj = { a: { b: 'hello' } } as Record<string, unknown>;
    expect(getNestedValue(obj, 'a.b')).toBe('hello');
  });

  it('resolves array index path (emails.0.email)', () => {
    const obj = {
      emails: [
        { email: 'test@example.com', type: 'work' },
        { email: 'personal@example.com', type: 'personal' },
      ],
    } as Record<string, unknown>;
    expect(getNestedValue(obj, 'emails.0.email')).toBe('test@example.com');
    expect(getNestedValue(obj, 'emails.1.email')).toBe('personal@example.com');
  });

  it('returns undefined for out-of-bounds array index', () => {
    const obj = { emails: [{ email: 'a@b.com' }] } as Record<string, unknown>;
    expect(getNestedValue(obj, 'emails.5.email')).toBeUndefined();
  });

  it('returns undefined for null/missing nested values', () => {
    const obj = { emails: null } as Record<string, unknown>;
    expect(getNestedValue(obj, 'emails.0.email')).toBeUndefined();
  });

  it('resolves phones.0.number pattern', () => {
    const obj = {
      phones: [{ number: '+30-210-1234567', type: 'mobile' }],
    } as Record<string, unknown>;
    expect(getNestedValue(obj, 'phones.0.number')).toBe('+30-210-1234567');
  });
});
