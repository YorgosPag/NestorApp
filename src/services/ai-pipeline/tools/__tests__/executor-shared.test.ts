/* eslint-disable no-restricted-syntax */
/**
 * =============================================================================
 * EXECUTOR-SHARED — Unit Tests for Pure Functions
 * =============================================================================
 *
 * Tests ONLY pure/synchronous functions from executor-shared.ts.
 * Skips: auditWrite, emitSyncSignalIfMapped (Firestore/async side-effects).
 */

jest.mock('server-only', () => ({}));
jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: jest.fn() }));
jest.mock('@/lib/telemetry/Logger', () => ({
  createModuleLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));
jest.mock('@/lib/error-utils', () => ({
  getErrorMessage: jest.fn((e: unknown) => (e instanceof Error ? e.message : String(e))),
}));
jest.mock('@/config/firestore-collections', () => ({
  COLLECTIONS: {
    PROJECTS: 'projects',
    BUILDINGS: 'buildings',
    PROPERTIES: 'properties',
    FLOORS: 'floors',
    CONTACTS: 'contacts',
    CONSTRUCTION_PHASES: 'construction_phases',
    CONSTRUCTION_TASKS: 'construction_tasks',
    LEADS: 'leads',
    OPPORTUNITIES: 'opportunities',
    APPOINTMENTS: 'appointments',
    TASKS: 'tasks',
    OBLIGATIONS: 'obligations',
    MESSAGES: 'messages',
    COMMUNICATIONS: 'communications',
    INVOICES: 'invoices',
    PAYMENTS: 'payments',
    CONTACT_LINKS: 'contact_links',
    EMPLOYMENT_RECORDS: 'employment_records',
    ATTENDANCE_EVENTS: 'attendance_events',
    CONVERSATIONS: 'conversations',
    ACTIVITIES: 'activities',
    FILES: 'files',
    PARKING_SPACES: 'parking_spaces',
    AI_PIPELINE_AUDIT: 'ai_pipeline_audit',
    ESCO_CACHE: 'esco_cache',
    ESCO_SKILLS_CACHE: 'esco_skills_cache',
    ACCOUNTING_INVOICES: 'accounting_invoices',
    ACCOUNTING_BANK_TRANSACTIONS: 'accounting_bank_transactions',
    ACCOUNTING_JOURNAL_ENTRIES: 'accounting_journal_entries',
    ACCOUNTING_FIXED_ASSETS: 'accounting_fixed_assets',
    FLOORPLANS: 'floorplans',
  },
}));
jest.mock('@/config/ai-role-access-matrix', () => ({
  resolveAccessConfig: jest.fn(() => ({
    allowedCollections: ['properties', 'buildings', 'contacts'],
    blockedFields: [],
    scopeLevel: 'project',
  })),
  UNLINKED_ACCESS: {
    allowedCollections: ['contacts'],
    blockedFields: [],
    scopeLevel: 'none',
  },
  deriveBlockedFieldSet: jest.fn(
    (fields: string[]) => new Set(fields.filter((f: string) => !f.includes('.')))
  ),
}));

import type { AgenticContext, QueryFilter } from '../executor-shared';
import {
  buildAttribution,
  enforceCompanyScope,
  coerceFilterValue,
  mapOperator,
  flattenNestedFields,
  redactSensitiveFields,
  redactRoleBlockedFields,
  truncateResult,
  isReadAllowed,
  isWriteAllowed,
  extractAttachments,
  enforceRoleAccess,
} from '../executor-shared';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function createCtx(overrides?: Partial<AgenticContext>): AgenticContext {
  return {
    companyId: 'comp_pagonis',
    isAdmin: true,
    channel: 'telegram',
    channelSenderId: 'tg_12345',
    requestId: 'req_001',
    ...overrides,
  } as unknown as AgenticContext;
}

// ===========================================================================
// 1. buildAttribution
// ===========================================================================

describe('buildAttribution', () => {
  it('uses displayName and omits role prefix for admin', () => {
    const ctx = createCtx({
      contactMeta: { displayName: 'Giorgos' } as AgenticContext['contactMeta'],
    });
    expect(buildAttribution(ctx)).toBe('AI Agent (Giorgos via telegram)');
  });

  it('falls back to channelSenderId when no contactMeta', () => {
    const ctx = createCtx({ contactMeta: undefined });
    expect(buildAttribution(ctx)).toBe('AI Agent (tg_12345 via telegram)');
  });

  it('adds buyer prefix for non-admin', () => {
    const ctx = createCtx({
      isAdmin: false,
      contactMeta: { displayName: 'Dimitris' } as AgenticContext['contactMeta'],
    });
    expect(buildAttribution(ctx)).toBe('AI Agent (buyer: Dimitris via telegram)');
  });

  it('reflects channel correctly', () => {
    const ctx = createCtx({ channel: 'email' });
    expect(buildAttribution(ctx)).toContain('via email');
  });
});

// ===========================================================================
// 2. enforceCompanyScope
// ===========================================================================

describe('enforceCompanyScope', () => {
  it('adds companyId filter when absent', () => {
    const filters: QueryFilter[] = [{ field: 'status', operator: '==', value: 'active' }];
    const result = enforceCompanyScope(filters, 'comp', 'contacts');
    expect(result[0]).toEqual({ field: 'companyId', operator: '==', value: 'comp' });
    expect(result).toHaveLength(2);
  });

  it('overwrites existing companyId with the correct tenant', () => {
    const filters: QueryFilter[] = [{ field: 'companyId', operator: '==', value: 'wrong' }];
    const result = enforceCompanyScope(filters, 'comp', 'contacts');
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe('comp');
  });

  it('skips subcollections (path contains "/")', () => {
    const filters: QueryFilter[] = [{ field: 'companyId', operator: '==', value: 'x' }];
    const result = enforceCompanyScope(filters, 'comp', 'units/abc/payment_plans');
    expect(result.every(f => f.field !== 'companyId')).toBe(true);
  });

  it('removes companyId for buildings (optional collection)', () => {
    const filters: QueryFilter[] = [{ field: 'companyId', operator: '==', value: 'x' }];
    const result = enforceCompanyScope(filters, 'comp', 'buildings');
    expect(result.every(f => f.field !== 'companyId')).toBe(true);
  });

  it('removes companyId for floors (optional collection)', () => {
    const result = enforceCompanyScope([], 'comp', 'floors');
    expect(result).toHaveLength(0);
  });

  it('removes companyId for construction_phases', () => {
    const filters: QueryFilter[] = [{ field: 'companyId', operator: '==', value: 'x' }];
    const result = enforceCompanyScope(filters, 'comp', 'construction_phases');
    expect(result).toHaveLength(0);
  });
});

// ===========================================================================
// 3. coerceFilterValue
// ===========================================================================

describe('coerceFilterValue', () => {
  it('converts "true" string to boolean true', () => {
    expect(coerceFilterValue('true')).toBe(true);
  });

  it('converts "false" string to boolean false', () => {
    expect(coerceFilterValue('false')).toBe(false);
  });

  it('converts "null" string to null', () => {
    expect(coerceFilterValue('null')).toBeNull();
  });

  it('converts integer string to number', () => {
    expect(coerceFilterValue('42')).toBe(42);
  });

  it('converts decimal string to number', () => {
    expect(coerceFilterValue('3.14')).toBeCloseTo(3.14);
  });

  it('passes arrays through unchanged', () => {
    const arr = ['a', 'b'];
    expect(coerceFilterValue(arr)).toBe(arr);
  });

  it('passes normal strings through', () => {
    expect(coerceFilterValue('hello')).toBe('hello');
  });

  it('passes non-string types through', () => {
    expect(coerceFilterValue(99)).toBe(99);
    expect(coerceFilterValue(false)).toBe(false);
  });
});

// ===========================================================================
// 4. mapOperator
// ===========================================================================

describe('mapOperator', () => {
  it('maps "==" to "=="', () => {
    expect(mapOperator('==')).toBe('==');
  });

  it('maps "in" to "in"', () => {
    expect(mapOperator('in')).toBe('in');
  });

  it('maps "array-contains" to "array-contains"', () => {
    expect(mapOperator('array-contains')).toBe('array-contains');
  });

  it('returns null for unknown operator', () => {
    expect(mapOperator('LIKE')).toBeNull();
  });
});

// ===========================================================================
// 5. flattenNestedFields
// ===========================================================================

describe('flattenNestedFields', () => {
  it('extracts commercial.askingPrice to _askingPrice', () => {
    const data = { id: '1', commercial: { askingPrice: 250000 } };
    const result = flattenNestedFields(data);
    expect(result._askingPrice).toBe(250000);
    expect(result.commercial).toBeUndefined();
  });

  it('extracts commercial.finalPrice to _finalPrice', () => {
    const result = flattenNestedFields({ commercial: { finalPrice: 200000 } });
    expect(result._finalPrice).toBe(200000);
  });

  it('extracts paymentSummary.totalAmount to _paymentTotal', () => {
    const result = flattenNestedFields({
      commercial: { paymentSummary: { totalAmount: 100000 } },
    });
    expect(result._paymentTotal).toBe(100000);
  });

  it('extracts areas.gross and areas.net', () => {
    const result = flattenNestedFields({ areas: { gross: 120, net: 95 } });
    expect(result._areaGross).toBe(120);
    expect(result._areaNet).toBe(95);
    expect(result.areas).toBeUndefined();
  });

  it('passes through data without nested fields', () => {
    const data = { id: '1', name: 'Unit A' };
    const result = flattenNestedFields(data);
    expect(result).toEqual(data);
  });
});

// ===========================================================================
// 6. redactSensitiveFields
// ===========================================================================

describe('redactSensitiveFields', () => {
  it('redacts password and token', () => {
    const result = redactSensitiveFields({ password: 'test-pw-value', token: 'test-tok-value' });
    expect(result.password).toBe('[REDACTED]');
    expect(result.token).toBe('[REDACTED]');
  });

  it('redacts apiKey', () => {
    const result = redactSensitiveFields({ apiKey: 'key_xyz' });
    expect(result.apiKey).toBe('[REDACTED]');
  });

  it('passes clean fields through', () => {
    const result = redactSensitiveFields({ name: 'George', email: 'g@test.com' });
    expect(result.name).toBe('George');
    expect(result.email).toBe('g@test.com');
  });
});

// ===========================================================================
// 7. redactRoleBlockedFields
// ===========================================================================

describe('redactRoleBlockedFields', () => {
  it('returns data untouched for admin', () => {
    const ctx = createCtx({ isAdmin: true });
    const data = { secret: 'value', name: 'Test' };
    expect(redactRoleBlockedFields(data, ctx)).toBe(data);
  });

  it('removes blocked top-level keys for non-admin', () => {
    const { deriveBlockedFieldSet } = jest.requireMock('@/config/ai-role-access-matrix');
    const { resolveAccessConfig } = jest.requireMock('@/config/ai-role-access-matrix');
    resolveAccessConfig.mockReturnValueOnce({
      allowedCollections: ['properties'],
      blockedFields: ['salary'],
      scopeLevel: 'project',
    });
    deriveBlockedFieldSet.mockReturnValueOnce(new Set(['salary']));

    const ctx = createCtx({
      isAdmin: false,
      contactMeta: {
        displayName: 'User',
        projectRoles: [{ projectId: 'p1', role: 'buyer' }],
      } as AgenticContext['contactMeta'],
    });
    const result = redactRoleBlockedFields({ salary: 50000, name: 'User' }, ctx);
    expect(result).not.toHaveProperty('salary');
    expect(result.name).toBe('User');
  });

  it('removes nested child when blockedFields contains dotted path', () => {
    const { deriveBlockedFieldSet, resolveAccessConfig } =
      jest.requireMock('@/config/ai-role-access-matrix');
    resolveAccessConfig.mockReturnValueOnce({
      allowedCollections: ['properties'],
      blockedFields: ['commercial.askingPrice'],
      scopeLevel: 'project',
    });
    deriveBlockedFieldSet.mockReturnValueOnce(new Set<string>());

    const ctx = createCtx({
      isAdmin: false,
      contactMeta: {
        displayName: 'User',
        projectRoles: [{ projectId: 'p1', role: 'buyer' }],
      } as AgenticContext['contactMeta'],
    });
    const data = { commercial: { askingPrice: 100, finalPrice: 80 }, name: 'Unit' };
    const result = redactRoleBlockedFields(data, ctx);
    expect((result.commercial as Record<string, unknown>).askingPrice).toBeUndefined();
    expect((result.commercial as Record<string, unknown>).finalPrice).toBe(80);
  });

  it('passes through when blockedFields is empty', () => {
    const { resolveAccessConfig } = jest.requireMock('@/config/ai-role-access-matrix');
    resolveAccessConfig.mockReturnValueOnce({
      allowedCollections: ['properties'],
      blockedFields: [],
      scopeLevel: 'project',
    });

    const ctx = createCtx({
      isAdmin: false,
      contactMeta: {
        displayName: 'User',
        projectRoles: [{ projectId: 'p1', role: 'buyer' }],
      } as AgenticContext['contactMeta'],
    });
    const data = { name: 'Test', value: 42 };
    expect(redactRoleBlockedFields(data, ctx)).toBe(data);
  });
});

// ===========================================================================
// 8. truncateResult
// ===========================================================================

describe('truncateResult', () => {
  it('passes through data under MAX_RESULT_JSON_LENGTH', () => {
    const data = [{ id: '1' }, { id: '2' }];
    expect(truncateResult(data)).toEqual(data);
  });

  it('truncates large arrays and appends truncation marker', () => {
    const bigArray = Array.from({ length: 500 }, (_, i) => ({
      id: `item_${i}`,
      description: 'x'.repeat(100),
    }));
    const result = truncateResult(bigArray) as Array<Record<string, unknown>>;
    expect(Array.isArray(result)).toBe(true);
    const last = result[result.length - 1];
    expect(last._truncated).toBe(true);
    expect(last._originalCount).toBe(500);
    expect(result.length).toBeLessThan(500);
  });

  it('passes through non-array over limit without truncation', () => {
    const bigObj = { data: 'x'.repeat(10000) };
    expect(truncateResult(bigObj)).toBe(bigObj);
  });
});

// ===========================================================================
// 9. isReadAllowed
// ===========================================================================

describe('isReadAllowed', () => {
  it('allows "contacts" (whitelisted)', () => {
    expect(isReadAllowed('contacts')).toBe(true);
  });

  it('denies "ai_chat_history" (not whitelisted)', () => {
    expect(isReadAllowed('ai_chat_history')).toBe(false);
  });

  it('allows subcollection when first segment is whitelisted', () => {
    expect(isReadAllowed('properties/x/payment_plans')).toBe(true);
  });
});

// ===========================================================================
// 10. isWriteAllowed
// ===========================================================================

describe('isWriteAllowed', () => {
  it('allows "contacts" (whitelisted)', () => {
    expect(isWriteAllowed('contacts')).toBe(true);
  });

  it('denies "messages" (not in write whitelist)', () => {
    expect(isWriteAllowed('messages')).toBe(false);
  });

  it('allows subcollection when first segment is whitelisted', () => {
    expect(isWriteAllowed('contacts/x/sub')).toBe(true);
  });
});

// ===========================================================================
// 11. extractAttachments
// ===========================================================================

describe('extractAttachments', () => {
  it('returns undefined for undefined input', () => {
    expect(extractAttachments(undefined)).toBeUndefined();
  });

  it('returns undefined for empty array', () => {
    expect(extractAttachments([])).toBeUndefined();
  });

  it('filters out items without fileRecordId', () => {
    const input = [
      { filename: 'a.pdf', contentType: 'application/pdf' },
      { fileRecordId: 'fr_1', filename: 'b.pdf', contentType: 'application/pdf', storageUrl: 'gs://bucket/b.pdf' },
    ];
    const result = extractAttachments(input);
    expect(result).toHaveLength(1);
    expect(result![0].fileRecordId).toBe('fr_1');
  });

  it('maps valid items with storageUrl fallback to empty string', () => {
    const input = [
      { fileRecordId: 'fr_2', filename: 'c.jpg', contentType: 'image/jpeg' },
    ];
    const result = extractAttachments(input);
    expect(result![0].storageUrl).toBe('');
  });
});

// ===========================================================================
// 12. enforceRoleAccess
// ===========================================================================

describe('enforceRoleAccess', () => {
  it('allows admin unconditionally', () => {
    const ctx = createCtx({ isAdmin: true });
    const result = enforceRoleAccess('contacts', [], ctx);
    expect(result.allowed).toBe(true);
  });

  it('denies non-admin on blocked collection', () => {
    const { resolveAccessConfig } = jest.requireMock('@/config/ai-role-access-matrix');
    resolveAccessConfig.mockReturnValueOnce({
      allowedCollections: ['contacts'],
      blockedFields: [],
      scopeLevel: 'project',
    });

    const ctx = createCtx({
      isAdmin: false,
      contactMeta: {
        displayName: 'User',
        projectRoles: [{ projectId: 'p1', role: 'buyer' }],
      } as AgenticContext['contactMeta'],
    });
    const result = enforceRoleAccess('invoices', [], ctx);
    expect(result.allowed).toBe(false);
  });

  it('returns error when property-scoped with no linkedProperties on sensitive collection', () => {
    const { resolveAccessConfig } = jest.requireMock('@/config/ai-role-access-matrix');
    resolveAccessConfig.mockReturnValueOnce({
      allowedCollections: ['properties', 'files', 'payments'],
      blockedFields: [],
      scopeLevel: 'property',
    });

    const ctx = createCtx({
      isAdmin: false,
      contactMeta: {
        displayName: 'Buyer',
        projectRoles: [{ projectId: 'p1', role: 'buyer' }],
        linkedPropertyIds: [],
      } as unknown as AgenticContext['contactMeta'],
    });
    const result = enforceRoleAccess('properties', [], ctx);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.result.error).toContain('ακίνητα');
    }
  });

  it('injects id filter for properties when property-scoped with linkedProperties', () => {
    const { resolveAccessConfig } = jest.requireMock('@/config/ai-role-access-matrix');
    resolveAccessConfig.mockReturnValueOnce({
      allowedCollections: ['properties'],
      blockedFields: [],
      scopeLevel: 'property',
    });

    const ctx = createCtx({
      isAdmin: false,
      contactMeta: {
        displayName: 'Buyer',
        projectRoles: [{ projectId: 'p1', role: 'buyer' }],
        linkedPropertyIds: ['prop_1', 'prop_2'],
      } as unknown as AgenticContext['contactMeta'],
    });
    const result = enforceRoleAccess('properties', [], ctx);
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      const idFilter = result.filters.find(f => f.field === 'id');
      expect(idFilter).toBeDefined();
      expect(idFilter!.operator).toBe('in');
      expect(idFilter!.value).toEqual(['prop_1', 'prop_2']);
    }
  });

  it('injects projectId filter for project-scoped collections', () => {
    const { resolveAccessConfig } = jest.requireMock('@/config/ai-role-access-matrix');
    resolveAccessConfig.mockReturnValueOnce({
      allowedCollections: ['properties', 'buildings', 'contacts'],
      blockedFields: [],
      scopeLevel: 'project',
    });

    const ctx = createCtx({
      isAdmin: false,
      contactMeta: {
        displayName: 'User',
        projectRoles: [{ projectId: 'proj_1', role: 'buyer' }],
        linkedPropertyIds: [],
      } as unknown as AgenticContext['contactMeta'],
    });
    const result = enforceRoleAccess('buildings', [], ctx);
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      const projFilter = result.filters.find(f => f.field === 'projectId');
      expect(projFilter).toBeDefined();
      expect(projFilter!.operator).toBe('in');
      expect(projFilter!.value).toEqual(['proj_1']);
    }
  });
});
