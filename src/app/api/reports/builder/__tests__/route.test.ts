/**
 * @tests Builder API Route — ADR-268
 * Validates request validation logic (domain, filters, columns, limits).
 * Note: Auth + rate limiting tested separately (infrastructure).
 */

import {
  isValidDomainId,
  isValidOperatorForType,
  BUILDER_LIMITS,
  type BuilderQueryRequest,
} from '@/config/report-builder/report-builder-types';
import { getDomainDefinition } from '@/config/report-builder/domain-definitions';

/**
 * Replicate the validation logic from route.ts to test independently
 * (route handlers require Next.js runtime — test pure logic only).
 */
function validateBuilderRequest(body: BuilderQueryRequest): string | null {
  if (!body.domain || !isValidDomainId(body.domain)) {
    return `Invalid domain: "${body.domain}"`;
  }

  if (!Array.isArray(body.filters)) {
    return 'filters must be an array';
  }

  if (body.filters.length > BUILDER_LIMITS.MAX_ACTIVE_FILTERS) {
    return `Too many filters: ${body.filters.length}`;
  }

  if (!Array.isArray(body.columns) || body.columns.length === 0) {
    return 'columns must be a non-empty array';
  }

  const domain = getDomainDefinition(body.domain);
  const validFieldKeys = new Set(domain.fields.map((f) => f.key));

  for (const filter of body.filters) {
    if (!validFieldKeys.has(filter.fieldKey)) {
      return `Invalid filter field: "${filter.fieldKey}"`;
    }
    const fieldDef = domain.fields.find((f) => f.key === filter.fieldKey);
    if (fieldDef && !isValidOperatorForType(filter.operator, fieldDef.type)) {
      return `Invalid operator "${filter.operator}" for field "${filter.fieldKey}"`;
    }
  }

  for (const col of body.columns) {
    if (!validFieldKeys.has(col)) {
      return `Invalid column: "${col}"`;
    }
  }

  if (body.sortField && !validFieldKeys.has(body.sortField)) {
    return `Invalid sortField: "${body.sortField}"`;
  }

  return null;
}

// ============================================================================
// Valid Requests
// ============================================================================

describe('Builder Route — Valid Requests', () => {
  it('accepts minimal valid request', () => {
    const req: BuilderQueryRequest = {
      domain: 'projects',
      filters: [],
      columns: ['name', 'status'],
      limit: 500,
    };
    expect(validateBuilderRequest(req)).toBeNull();
  });

  it('accepts request with filters', () => {
    const req: BuilderQueryRequest = {
      domain: 'units',
      filters: [
        { id: '1', fieldKey: 'commercialStatus', operator: 'eq', value: 'sold' },
        { id: '2', fieldKey: 'areas.gross', operator: 'gt', value: 100 },
      ],
      columns: ['name', 'commercialStatus', 'areas.gross'],
      limit: 500,
    };
    expect(validateBuilderRequest(req)).toBeNull();
  });

  it('accepts request with sort', () => {
    const req: BuilderQueryRequest = {
      domain: 'buildings',
      filters: [],
      columns: ['name', 'progress'],
      sortField: 'progress',
      sortDirection: 'desc',
      limit: 100,
    };
    expect(validateBuilderRequest(req)).toBeNull();
  });
});

// ============================================================================
// Invalid Domain
// ============================================================================

describe('Builder Route — Invalid Domain', () => {
  it('rejects unknown domain', () => {
    const req = {
      domain: 'unknown' as BuilderQueryRequest['domain'],
      filters: [],
      columns: ['name'],
      limit: 500,
    };
    expect(validateBuilderRequest(req)).toContain('Invalid domain');
  });

  it('rejects empty domain', () => {
    const req = {
      domain: '' as BuilderQueryRequest['domain'],
      filters: [],
      columns: ['name'],
      limit: 500,
    };
    expect(validateBuilderRequest(req)).toContain('Invalid domain');
  });
});

// ============================================================================
// Invalid Filters
// ============================================================================

describe('Builder Route — Invalid Filters', () => {
  it('rejects too many filters', () => {
    const filters = Array.from({ length: 11 }, (_, i) => ({
      id: String(i),
      fieldKey: 'name',
      operator: 'eq' as const,
      value: `val${i}`,
    }));
    const req: BuilderQueryRequest = {
      domain: 'projects',
      filters,
      columns: ['name'],
      limit: 500,
    };
    expect(validateBuilderRequest(req)).toContain('Too many filters');
  });

  it('rejects filter with invalid field key', () => {
    const req: BuilderQueryRequest = {
      domain: 'projects',
      filters: [{ id: '1', fieldKey: 'nonExistent', operator: 'eq', value: 'x' }],
      columns: ['name'],
      limit: 500,
    };
    expect(validateBuilderRequest(req)).toContain('Invalid filter field');
  });

  it('rejects filter with wrong operator for type', () => {
    const req: BuilderQueryRequest = {
      domain: 'projects',
      filters: [
        { id: '1', fieldKey: 'status', operator: 'gt', value: 'active' }, // enum doesn't support gt
      ],
      columns: ['name'],
      limit: 500,
    };
    expect(validateBuilderRequest(req)).toContain('Invalid operator');
  });
});

// ============================================================================
// Invalid Columns
// ============================================================================

describe('Builder Route — Invalid Columns', () => {
  it('rejects empty columns', () => {
    const req: BuilderQueryRequest = {
      domain: 'projects',
      filters: [],
      columns: [],
      limit: 500,
    };
    expect(validateBuilderRequest(req)).toContain('columns must be a non-empty array');
  });

  it('rejects invalid column key', () => {
    const req: BuilderQueryRequest = {
      domain: 'projects',
      filters: [],
      columns: ['name', 'invalid_column'],
      limit: 500,
    };
    expect(validateBuilderRequest(req)).toContain('Invalid column');
  });
});

// ============================================================================
// Invalid Sort
// ============================================================================

describe('Builder Route — Invalid Sort', () => {
  it('rejects sort on invalid field', () => {
    const req: BuilderQueryRequest = {
      domain: 'projects',
      filters: [],
      columns: ['name'],
      sortField: 'nonExistent',
      limit: 500,
    };
    expect(validateBuilderRequest(req)).toContain('Invalid sortField');
  });
});
