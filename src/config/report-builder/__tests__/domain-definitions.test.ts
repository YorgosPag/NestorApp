/**
 * @tests Domain Definitions — ADR-268 Report Builder
 * Validates all 14 domain schemas have correct structure, no duplicate keys, valid types.
 * Phase 1: projects, buildings, floors, units
 * Phase 4a: +parking, storage, individuals, companies (group, preFilters, conditionalOn)
 * Phase 4b: +buyers, suppliers, engineers, workers, legal, agents (persona resolver)
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
/**
 * Inline copy of getNestedValue for testing — avoids importing server-only module.
 * The real function lives in report-query-executor.ts (server-only, Firebase Admin).
 * Includes persona resolver: persona.<type>.<field> (Q93).
 */
function getNestedValue(obj: Record<string, unknown>, dotPath: string): unknown {
  // Persona resolver: persona.<type>.<field>
  if (dotPath.startsWith('persona.')) {
    const [, personaType, ...fieldParts] = dotPath.split('.');
    const personas = obj['personas'];
    if (!Array.isArray(personas)) return undefined;
    const match = personas.find(
      (p: Record<string, unknown>) => p['personaType'] === personaType,
    );
    if (!match || !fieldParts.length) return undefined;
    return fieldParts.length === 1
      ? (match as Record<string, unknown>)[fieldParts[0]]
      : getNestedValue(match as Record<string, unknown>, fieldParts.join('.'));
  }

  const parts = dotPath.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    if (Array.isArray(current) && /^\d+$/.test(part)) {
      current = (current as unknown[])[parseInt(part, 10)];
    } else {
      current = (current as Record<string, unknown>)[part];
    }
  }
  return current;
}

// ============================================================================
// Schema Integrity
// ============================================================================

describe('Domain Definitions — Schema Integrity', () => {
  it('defines all domains (Phase 1-6)', () => {
    const definedIds = Object.keys(DOMAIN_DEFINITIONS);
    expect(definedIds.length).toBe(VALID_DOMAIN_IDS.length);
    expect(definedIds).toEqual(
      expect.arrayContaining([
        'projects', 'buildings', 'floors', 'units',
        'parking', 'storage', 'individuals', 'companies',
        'buyers', 'suppliers', 'engineers', 'workers', 'legal', 'agents',
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
// Domain Groups (Q87)
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

  it('people domains have group people', () => {
    for (const id of ['individuals', 'companies', 'buyers'] as BuilderDomainId[]) {
      expect(getDomainDefinition(id).group).toBe('people');
    }
  });

  it('specialist domains have group specialists', () => {
    for (const id of ['suppliers', 'engineers', 'workers', 'legal', 'agents'] as BuilderDomainId[]) {
      expect(getDomainDefinition(id).group).toBe('specialists');
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
// PreFilters (Phase 4a + 4b)
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

  it('buyers has buyerContactId != null preFilter (Q94)', () => {
    const def = getDomainDefinition('buyers');
    expect(def.preFilters).toBeDefined();
    expect(def.preFilters).toHaveLength(1);
    expect(def.preFilters![0]).toEqual({
      fieldPath: 'commercial.buyerContactId',
      opStr: '!=',
      value: null,
    });
  });

  it('persona domains use array-contains on personaTypes (Q88)', () => {
    const personaDomains: Array<{ id: BuilderDomainId; personaType: string }> = [
      { id: 'suppliers', personaType: 'supplier' },
      { id: 'engineers', personaType: 'engineer' },
      { id: 'workers', personaType: 'construction_worker' },
      { id: 'agents', personaType: 'real_estate_agent' },
    ];

    for (const { id, personaType } of personaDomains) {
      const def = getDomainDefinition(id);
      const personaFilter = def.preFilters!.find(
        (pf) => pf.fieldPath === 'personaTypes',
      );
      expect(personaFilter).toBeDefined();
      expect(personaFilter!.opStr).toBe('array-contains');
      expect(personaFilter!.value).toBe(personaType);
    }
  });

  it('legal uses array-contains-any for dual persona (Q80)', () => {
    const def = getDomainDefinition('legal');
    const personaFilter = def.preFilters!.find(
      (pf) => pf.fieldPath === 'personaTypes',
    );
    expect(personaFilter).toBeDefined();
    expect(personaFilter!.opStr).toBe('array-contains-any');
    expect(personaFilter!.value).toEqual(['lawyer', 'notary']);
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
// ConditionalOn (Q92)
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

  it('buyers.buildingId refs buildings', () => {
    const field = getFieldDefinition('buyers', 'buildingId');
    expect(field?.refDomain).toBe('buildings');
    expect(field?.refDisplayField).toBe('name');
  });

  it('buyers.project refs projects', () => {
    const field = getFieldDefinition('buyers', 'project');
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

// ============================================================================
// getNestedValue — Array Index + Persona Resolver
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

// ============================================================================
// Persona Resolver — Q93
// ============================================================================

describe('getNestedValue — Persona Resolver (Q93)', () => {
  const contactWithPersonas: Record<string, unknown> = {
    firstName: 'Νίκος',
    lastName: 'Παπαδόπουλος',
    personas: [
      {
        personaType: 'engineer',
        status: 'active',
        teeRegistryNumber: '12345',
        engineerSpecialty: 'civil',
        licenseClass: 'A',
        ptdeNumber: 'PT-001',
      },
      {
        personaType: 'client',
        status: 'active',
        clientSince: '2024-01-01',
      },
      {
        personaType: 'construction_worker',
        status: 'active',
        ikaNumber: 'IKA-789',
        dailyWage: 85.5,
        insuranceClassId: 12,
      },
    ],
  };

  it('resolves persona.engineer.teeRegistryNumber', () => {
    expect(getNestedValue(contactWithPersonas, 'persona.engineer.teeRegistryNumber'))
      .toBe('12345');
  });

  it('resolves persona.engineer.engineerSpecialty', () => {
    expect(getNestedValue(contactWithPersonas, 'persona.engineer.engineerSpecialty'))
      .toBe('civil');
  });

  it('resolves persona.construction_worker.dailyWage', () => {
    expect(getNestedValue(contactWithPersonas, 'persona.construction_worker.dailyWage'))
      .toBe(85.5);
  });

  it('resolves persona.construction_worker.ikaNumber', () => {
    expect(getNestedValue(contactWithPersonas, 'persona.construction_worker.ikaNumber'))
      .toBe('IKA-789');
  });

  it('resolves persona.client.clientSince', () => {
    expect(getNestedValue(contactWithPersonas, 'persona.client.clientSince'))
      .toBe('2024-01-01');
  });

  it('returns undefined for non-existent persona type', () => {
    expect(getNestedValue(contactWithPersonas, 'persona.supplier.supplierCategory'))
      .toBeUndefined();
  });

  it('returns undefined for non-existent field on existing persona', () => {
    expect(getNestedValue(contactWithPersonas, 'persona.engineer.nonExistentField'))
      .toBeUndefined();
  });

  it('returns undefined when contact has no personas', () => {
    const obj = { firstName: 'Test' } as Record<string, unknown>;
    expect(getNestedValue(obj, 'persona.engineer.teeRegistryNumber'))
      .toBeUndefined();
  });

  it('returns undefined when personas is empty array', () => {
    const obj = { personas: [] } as Record<string, unknown>;
    expect(getNestedValue(obj, 'persona.engineer.teeRegistryNumber'))
      .toBeUndefined();
  });

  it('does not interfere with regular dot paths', () => {
    const obj = { commercial: { buyerName: 'Test' } } as Record<string, unknown>;
    expect(getNestedValue(obj, 'commercial.buyerName')).toBe('Test');
  });
});

// ============================================================================
// Phase 4b — Persona Domain Fields (B4-B8)
// ============================================================================

describe('Domain Definitions — Phase 4b Persona Fields', () => {
  it('persona domains have persona.* field keys', () => {
    const personaDomains: BuilderDomainId[] = [
      'suppliers', 'engineers', 'workers', 'legal', 'agents',
    ];

    for (const id of personaDomains) {
      const def = getDomainDefinition(id);
      const personaFields = def.fields.filter((f) => f.key.startsWith('persona.'));
      expect(personaFields.length).toBeGreaterThan(0);
    }
  });

  it('buyers domain has NO persona.* fields (transaction-based)', () => {
    const def = getDomainDefinition('buyers');
    const personaFields = def.fields.filter((f) => f.key.startsWith('persona.'));
    expect(personaFields).toHaveLength(0);
  });

  it('engineers has teeRegistryNumber and engineerSpecialty', () => {
    const def = getDomainDefinition('engineers');
    const keys = def.fields.map((f) => f.key);
    expect(keys).toContain('persona.engineer.teeRegistryNumber');
    expect(keys).toContain('persona.engineer.engineerSpecialty');
  });

  it('workers has ikaNumber and dailyWage', () => {
    const def = getDomainDefinition('workers');
    const keys = def.fields.map((f) => f.key);
    expect(keys).toContain('persona.construction_worker.ikaNumber');
    expect(keys).toContain('persona.construction_worker.dailyWage');
  });

  it('legal has both lawyer and notary fields', () => {
    const def = getDomainDefinition('legal');
    const keys = def.fields.map((f) => f.key);
    expect(keys).toContain('persona.lawyer.barAssociationNumber');
    expect(keys).toContain('persona.notary.notaryRegistryNumber');
  });

  it('all persona domains share common contact fields', () => {
    const personaDomains: BuilderDomainId[] = [
      'suppliers', 'engineers', 'workers', 'legal', 'agents',
    ];
    const commonFields = ['firstName', 'lastName', 'emails.0.email', 'phones.0.number', 'status'];

    for (const id of personaDomains) {
      const def = getDomainDefinition(id);
      const keys = def.fields.map((f) => f.key);
      for (const common of commonFields) {
        expect(keys).toContain(common);
      }
    }
  });
});

// ============================================================================
// Boundary & Consistency Tests (Phase 7 enrichment)
// ============================================================================

describe('Domain Definitions — Boundary & Consistency', () => {
  it('every domain has at least one defaultVisible field', () => {
    for (const id of VALID_DOMAIN_IDS) {
      const def = getDomainDefinition(id);
      const visibleFields = def.fields.filter((f) => f.defaultVisible);
      expect(visibleFields.length).toBeGreaterThan(0);
    }
  });

  it('every domain has at least one filterable field', () => {
    for (const id of VALID_DOMAIN_IDS) {
      const fields = getFilterableFields(id);
      expect(fields.length).toBeGreaterThan(0);
    }
  });

  it('every domain has at least one sortable field', () => {
    for (const id of VALID_DOMAIN_IDS) {
      const fields = getSortableFields(id);
      expect(fields.length).toBeGreaterThan(0);
    }
  });

  it('no domain has empty labelKey or descriptionKey', () => {
    for (const id of VALID_DOMAIN_IDS) {
      const def = getDomainDefinition(id);
      expect(def.labelKey.length).toBeGreaterThan(0);
      expect(def.descriptionKey.length).toBeGreaterThan(0);
    }
  });

  it('no field has empty key', () => {
    for (const id of VALID_DOMAIN_IDS) {
      const def = getDomainDefinition(id);
      for (const field of def.fields) {
        expect(field.key.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('entityLinkPath contains {id} placeholder for all domains', () => {
    for (const id of VALID_DOMAIN_IDS) {
      const def = getDomainDefinition(id);
      expect(def.entityLinkPath).toContain('{');
    }
  });

  it('getFieldDefinition returns correct field by key for all domains', () => {
    for (const id of VALID_DOMAIN_IDS) {
      const def = getDomainDefinition(id);
      const firstField = def.fields[0];
      const retrieved = getFieldDefinition(id, firstField.key);
      expect(retrieved).toBeDefined();
      expect(retrieved!.key).toBe(firstField.key);
    }
  });
});
