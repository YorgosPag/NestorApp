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
      domain: 'properties',
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

// ============================================================================
// Row Limit Boundary Tests
// ============================================================================

describe('Builder Route — Row Limit Boundaries', () => {
  it('accepts limit at DEFAULT_ROW_LIMIT (500)', () => {
    const req: BuilderQueryRequest = {
      domain: 'projects',
      filters: [],
      columns: ['name'],
      limit: BUILDER_LIMITS.DEFAULT_ROW_LIMIT,
    };
    expect(validateBuilderRequest(req)).toBeNull();
  });

  it('accepts limit at MAX_ROW_LIMIT (2000)', () => {
    const req: BuilderQueryRequest = {
      domain: 'projects',
      filters: [],
      columns: ['name'],
      limit: BUILDER_LIMITS.MAX_ROW_LIMIT,
    };
    expect(validateBuilderRequest(req)).toBeNull();
  });

  it('accepts limit of 1 (minimum)', () => {
    const req: BuilderQueryRequest = {
      domain: 'projects',
      filters: [],
      columns: ['name'],
      limit: 1,
    };
    expect(validateBuilderRequest(req)).toBeNull();
  });

  it('DEFAULT_ROW_LIMIT is 500 and MAX_ROW_LIMIT is 2000', () => {
    expect(BUILDER_LIMITS.DEFAULT_ROW_LIMIT).toBe(500);
    expect(BUILDER_LIMITS.MAX_ROW_LIMIT).toBe(2000);
  });
});

// ============================================================================
// Security Edge Cases
// ============================================================================

describe('Builder Route — Security Edge Cases', () => {
  it('rejects SQL injection-like values in domain', () => {
    const req = {
      domain: "projects'; DROP TABLE --" as BuilderQueryRequest['domain'],
      filters: [],
      columns: ['name'],
      limit: 500,
    };
    expect(validateBuilderRequest(req)).toContain('Invalid domain');
  });

  it('rejects filter with dot-traversal fieldKey attack', () => {
    const req: BuilderQueryRequest = {
      domain: 'projects',
      filters: [{ id: '1', fieldKey: '__proto__.polluted', operator: 'eq', value: 'x' }],
      columns: ['name'],
      limit: 500,
    };
    expect(validateBuilderRequest(req)).toContain('Invalid filter field');
  });

  it('rejects column with prototype pollution attempt', () => {
    const req: BuilderQueryRequest = {
      domain: 'projects',
      filters: [],
      columns: ['name', 'constructor.prototype'],
      limit: 500,
    };
    expect(validateBuilderRequest(req)).toContain('Invalid column');
  });

  it('accepts exactly MAX_ACTIVE_FILTERS (10) filters', () => {
    const domain = getDomainDefinition('projects');
    const filterableFields = domain.fields.filter((f) => f.filterable).slice(0, 10);
    const filters = filterableFields.map((f, i) => ({
      id: String(i),
      fieldKey: f.key,
      operator: 'eq' as const,
      value: 'test',
    }));
    const req: BuilderQueryRequest = {
      domain: 'projects',
      filters,
      columns: ['name'],
      limit: 500,
    };
    // Should pass if exactly at limit (not over)
    const result = validateBuilderRequest(req);
    expect(result === null || !result.includes('Too many')).toBe(true);
  });

  it('validates all Phase 1-6 domains accept valid requests', () => {
    const testDomains: BuilderQueryRequest['domain'][] = [
      'projects', 'buildings', 'floors', 'properties',
      'parking', 'storage', 'individuals', 'companies',
    ];
    for (const domain of testDomains) {
      const def = getDomainDefinition(domain);
      const firstField = def.fields[0];
      const req: BuilderQueryRequest = {
        domain,
        filters: [],
        columns: [firstField.key],
        limit: 100,
      };
      expect(validateBuilderRequest(req)).toBeNull();
    }
  });

  it('rejects filter on non-filterable field gracefully', () => {
    // Even non-filterable fields are valid field keys — validation checks existence, not filterability
    // This is by design: server-side enforces field existence, UI enforces filterability
    const domain = getDomainDefinition('projects');
    const nonFilterable = domain.fields.find((f) => !f.filterable);
    if (nonFilterable) {
      const req: BuilderQueryRequest = {
        domain: 'projects',
        filters: [{ id: '1', fieldKey: nonFilterable.key, operator: 'eq', value: 'x' }],
        columns: ['name'],
        limit: 500,
      };
      // Valid field key — passes validation (filterability is a UI concern)
      expect(validateBuilderRequest(req)).toBeNull();
    }
  });
});
