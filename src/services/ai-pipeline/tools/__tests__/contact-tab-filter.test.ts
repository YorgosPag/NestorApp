/**
 * CONTACT TAB FILTER TESTS — RBAC Field Filtering
 *
 * Tests filterContactByTab, getValidTabIds, resolveContactType
 * ensuring server-side field filtering prevents data leakage.
 *
 * @see ADR-171 (Autonomous AI Agent)
 * @module __tests__/contact-tab-filter
 */

// ── Mock server-only ──
jest.mock('server-only', () => ({}));

// ── Mock section configs with realistic inline data (Jest hoists mocks) ──
jest.mock('@/config/individual-config', () => ({
  INDIVIDUAL_SECTIONS: [
    { id: 'basicInfo', fields: [{ id: 'firstName' }, { id: 'lastName' }, { id: 'middleName' }] },
    { id: 'identity', fields: [{ id: 'afm' }, { id: 'adt' }, { id: 'doy' }] },
    { id: 'communication' }, // array field section — no fields, uses ARRAY_FIELD_SECTIONS
  ],
}));

jest.mock('@/config/company-gemi', () => ({
  COMPANY_GEMI_SECTIONS: [
    { id: 'companyInfo', fields: [{ id: 'companyName' }, { id: 'tradeName' }] },
  ],
}));

jest.mock('@/config/service-config', () => ({
  SERVICE_SECTIONS: [
    { id: 'serviceInfo', fields: [{ id: 'serviceName' }, { id: 'category' }] },
  ],
}));

jest.mock('@/config/section-field-utils', () => ({
  extractRealFieldIds: jest.fn((section: { id: string; fields?: Array<{ id: string }> }) => {
    if (!section.fields) return [];
    return section.fields.map((f: { id: string }) => f.id);
  }),
  ARRAY_FIELD_SECTIONS: {
    communication: ['phones', 'emails', 'websites'],
  } as Record<string, string[]>,
}));

import {
  filterContactByTab,
  getValidTabIds,
  resolveContactType,
} from '../contact-tab-filter';

// ============================================================================
// resolveContactType
// ============================================================================

describe('resolveContactType', () => {
  it('resolves "company" from type field', () => {
    expect(resolveContactType({ type: 'company' })).toBe('company');
  });

  it('resolves "service" from type field', () => {
    expect(resolveContactType({ type: 'service' })).toBe('service');
  });

  it('resolves "individual" from type field', () => {
    expect(resolveContactType({ type: 'individual' })).toBe('individual');
  });

  it('defaults to "individual" when type is missing', () => {
    expect(resolveContactType({})).toBe('individual');
  });

  it('falls back to contactType when type is missing', () => {
    expect(resolveContactType({ contactType: 'company' })).toBe('company');
  });

  it('defaults to "individual" for unknown type', () => {
    expect(resolveContactType({ type: 'unknown_type' })).toBe('individual');
  });
});

// ============================================================================
// getValidTabIds
// ============================================================================

describe('getValidTabIds', () => {
  it('returns tab IDs for individual', () => {
    const tabs = getValidTabIds('individual');
    expect(tabs).toContain('basicInfo');
    expect(tabs).toContain('identity');
    expect(tabs).toContain('communication');
  });

  it('returns tab IDs for company', () => {
    const tabs = getValidTabIds('company');
    expect(tabs).toContain('companyInfo');
  });

  it('returns tab IDs for service', () => {
    const tabs = getValidTabIds('service');
    expect(tabs).toContain('serviceInfo');
  });
});

// ============================================================================
// filterContactByTab
// ============================================================================

describe('filterContactByTab', () => {
  const fullContact = {
    id: 'cont_001',
    type: 'individual',
    contactType: 'individual',
    status: 'active',
    displayName: 'Γιώργος Παπαδόπουλος',
    companyId: 'comp_001',
    firstName: 'Γιώργος',
    lastName: 'Παπαδόπουλος',
    middleName: 'Ν.',
    afm: '123456789',
    adt: 'ΑΒ123456',
    doy: 'Θεσσαλονίκης',
    phones: [{ value: '6974050025' }],
    emails: [{ value: 'test@test.gr' }],
    websites: [],
    extraField: 'should be excluded',
  };

  it('filters to basicInfo tab fields only', () => {
    const result = filterContactByTab(fullContact, 'individual', 'basicInfo');
    expect(result).toHaveProperty('firstName');
    expect(result).toHaveProperty('lastName');
    expect(result).toHaveProperty('middleName');
    expect(result).not.toHaveProperty('afm');
    expect(result).not.toHaveProperty('phones');
    expect(result).not.toHaveProperty('extraField');
  });

  it('filters to identity tab fields only', () => {
    const result = filterContactByTab(fullContact, 'individual', 'identity');
    expect(result).toHaveProperty('afm');
    expect(result).toHaveProperty('adt');
    expect(result).toHaveProperty('doy');
    expect(result).not.toHaveProperty('firstName');
    expect(result).not.toHaveProperty('phones');
  });

  it('filters to communication tab (array field section)', () => {
    const result = filterContactByTab(fullContact, 'individual', 'communication');
    expect(result).toHaveProperty('phones');
    expect(result).toHaveProperty('emails');
    expect(result).toHaveProperty('websites');
    expect(result).not.toHaveProperty('firstName');
    expect(result).not.toHaveProperty('afm');
  });

  it('ALWAYS includes identity fields regardless of tab', () => {
    const result = filterContactByTab(fullContact, 'individual', 'basicInfo');
    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('type');
    expect(result).toHaveProperty('contactType');
    expect(result).toHaveProperty('status');
    expect(result).toHaveProperty('displayName');
    expect(result).toHaveProperty('companyId');
  });

  it('returns full document for unknown tab (safe fallback)', () => {
    const result = filterContactByTab(fullContact, 'individual', 'nonexistent_tab');
    expect(result).toEqual(fullContact);
  });

  it('returns full document for unknown contact type (safe fallback)', () => {
    const result = filterContactByTab(
      fullContact,
      'alien' as 'individual',
      'basicInfo'
    );
    expect(result).toEqual(fullContact);
  });

  it('handles empty data object', () => {
    const result = filterContactByTab({}, 'individual', 'basicInfo');
    expect(Object.keys(result)).toHaveLength(0);
  });
});
