/**
 * @tests Report Builder Types — ADR-268
 * Type guards, validators, URL encode/decode round-trip.
 */

import {
  isValidDomainId,
  isValidOperatorForType,
  isValidFilterValue,
  encodeBuilderState,
  decodeBuilderState,
  BUILDER_LIMITS,
  VALID_DOMAIN_IDS,
  OPERATORS_BY_TYPE,
  type ReportBuilderFilter,
} from '../report-builder-types';

// ============================================================================
// isValidDomainId
// ============================================================================

describe('isValidDomainId', () => {
  it.each(VALID_DOMAIN_IDS)('returns true for "%s"', (id) => {
    expect(isValidDomainId(id)).toBe(true);
  });

  it.each(['invalid', '', null, undefined, 123, 'PROJECT'])('returns false for %p', (val) => {
    expect(isValidDomainId(val)).toBe(false);
  });
});

// ============================================================================
// isValidOperatorForType
// ============================================================================

describe('isValidOperatorForType', () => {
  it('allows "contains" for text', () => {
    expect(isValidOperatorForType('contains', 'text')).toBe(true);
  });

  it('disallows "contains" for number', () => {
    expect(isValidOperatorForType('contains', 'number')).toBe(false);
  });

  it('allows "in" for enum', () => {
    expect(isValidOperatorForType('in', 'enum')).toBe(true);
  });

  it('disallows "in" for text', () => {
    expect(isValidOperatorForType('in', 'text')).toBe(false);
  });

  it('allows only "eq" for boolean', () => {
    expect(isValidOperatorForType('eq', 'boolean')).toBe(true);
    expect(isValidOperatorForType('neq', 'boolean')).toBe(false);
  });

  it('allows "between" for date', () => {
    expect(isValidOperatorForType('between', 'date')).toBe(true);
  });

  it('allows "before"/"after" for date', () => {
    expect(isValidOperatorForType('before', 'date')).toBe(true);
    expect(isValidOperatorForType('after', 'date')).toBe(true);
  });

  it('allows numeric operators for currency', () => {
    expect(isValidOperatorForType('gt', 'currency')).toBe(true);
    expect(isValidOperatorForType('lte', 'currency')).toBe(true);
    expect(isValidOperatorForType('between', 'currency')).toBe(true);
  });
});

// ============================================================================
// isValidFilterValue
// ============================================================================

describe('isValidFilterValue', () => {
  it('accepts string for eq', () => {
    expect(isValidFilterValue('active', 'eq')).toBe(true);
  });

  it('accepts number for gt', () => {
    expect(isValidFilterValue(100, 'gt')).toBe(true);
  });

  it('accepts boolean for eq', () => {
    expect(isValidFilterValue(true, 'eq')).toBe(true);
  });

  it('accepts string array for in', () => {
    expect(isValidFilterValue(['sold', 'reserved'], 'in')).toBe(true);
  });

  it('rejects number array for in', () => {
    expect(isValidFilterValue([1, 2], 'in')).toBe(false);
  });

  it('accepts [number, number] for between', () => {
    expect(isValidFilterValue([100, 200], 'between')).toBe(true);
  });

  it('accepts [string, string] for between (date range)', () => {
    expect(isValidFilterValue(['2025-01-01', '2025-12-31'], 'between')).toBe(true);
  });

  it('rejects invalid between tuple', () => {
    expect(isValidFilterValue([100, 'abc'], 'between')).toBe(false);
    expect(isValidFilterValue([100], 'between')).toBe(false);
  });

  it('rejects null and undefined', () => {
    expect(isValidFilterValue(null, 'eq')).toBe(false);
    expect(isValidFilterValue(undefined, 'eq')).toBe(false);
  });
});

// ============================================================================
// URL Encode/Decode Round-Trip
// ============================================================================

describe('URL State — encodeBuilderState / decodeBuilderState', () => {
  it('round-trips domain only', () => {
    const encoded = encodeBuilderState('projects', [], []);
    const params = new URLSearchParams(encoded);
    const decoded = decodeBuilderState(params);

    expect(decoded.domain).toBe('projects');
    expect(decoded.filters).toBeUndefined();
    expect(decoded.columns).toBeUndefined();
  });

  it('round-trips domain + columns', () => {
    const columns = ['name', 'status', 'progress'];
    const encoded = encodeBuilderState('buildings', [], columns);
    const decoded = decodeBuilderState(new URLSearchParams(encoded));

    expect(decoded.domain).toBe('buildings');
    expect(decoded.columns).toEqual(columns);
  });

  it('round-trips domain + filters + columns', () => {
    const filters: ReportBuilderFilter[] = [
      { id: 'f1', fieldKey: 'status', operator: 'eq', value: 'active' },
      { id: 'f2', fieldKey: 'totalValue', operator: 'gt', value: 50000 },
    ];
    const columns = ['name', 'status', 'totalValue'];

    const encoded = encodeBuilderState('projects', filters, columns);
    const decoded = decodeBuilderState(new URLSearchParams(encoded));

    expect(decoded.domain).toBe('projects');
    expect(decoded.columns).toEqual(columns);
    expect(decoded.filters).toHaveLength(2);
    // Decoded filters get new IDs (crypto.randomUUID), so check content
    expect(decoded.filters![0].fieldKey).toBe('status');
    expect(decoded.filters![0].operator).toBe('eq');
    expect(decoded.filters![0].value).toBe('active');
    expect(decoded.filters![1].fieldKey).toBe('totalValue');
    expect(decoded.filters![1].value).toBe(50000);
  });

  it('round-trips sort and limit', () => {
    const encoded = encodeBuilderState(
      'properties', [], ['name'], 'commercial.finalPrice', 'desc', 1000,
    );
    const decoded = decodeBuilderState(new URLSearchParams(encoded));

    expect(decoded.sortField).toBe('commercial.finalPrice');
    expect(decoded.sortDirection).toBe('desc');
    expect(decoded.limit).toBe(1000);
  });

  it('omits default limit from URL', () => {
    const encoded = encodeBuilderState(
      'projects', [], [], undefined, undefined, BUILDER_LIMITS.DEFAULT_ROW_LIMIT,
    );
    const params = new URLSearchParams(encoded);
    expect(params.has('l')).toBe(false);
  });

  it('handles invalid base64 filters gracefully', () => {
    const params = new URLSearchParams('d=projects&f=not-valid-base64!!!');
    const decoded = decodeBuilderState(params);
    expect(decoded.domain).toBe('projects');
    expect(decoded.filters).toBeUndefined();
  });

  it('ignores invalid domain', () => {
    const params = new URLSearchParams('d=invalid');
    const decoded = decodeBuilderState(params);
    expect(decoded.domain).toBeUndefined();
  });

  it('caps limit at MAX_ROW_LIMIT', () => {
    const params = new URLSearchParams('d=projects&l=99999');
    const decoded = decodeBuilderState(params);
    expect(decoded.limit).toBeUndefined();
  });
});

// ============================================================================
// OPERATORS_BY_TYPE Completeness
// ============================================================================

describe('OPERATORS_BY_TYPE — Completeness', () => {
  const allTypes: readonly string[] = [
    'text', 'enum', 'number', 'currency', 'percentage', 'date', 'boolean',
  ];

  it('has entries for every FieldValueType', () => {
    for (const type of allTypes) {
      expect(OPERATORS_BY_TYPE).toHaveProperty(type);
      expect(OPERATORS_BY_TYPE[type as keyof typeof OPERATORS_BY_TYPE].length).toBeGreaterThan(0);
    }
  });

  it('all operator arrays contain only valid FilterOperator values', () => {
    const validOps = new Set([
      'eq', 'neq', 'contains', 'starts_with',
      'gt', 'gte', 'lt', 'lte', 'between',
      'before', 'after', 'in',
    ]);

    for (const ops of Object.values(OPERATORS_BY_TYPE)) {
      for (const op of ops) {
        expect(validOps.has(op)).toBe(true);
      }
    }
  });
});

// ============================================================================
// BUILDER_LIMITS Sanity
// ============================================================================

describe('BUILDER_LIMITS', () => {
  it('DEFAULT < MAX row limit', () => {
    expect(BUILDER_LIMITS.DEFAULT_ROW_LIMIT).toBeLessThan(BUILDER_LIMITS.MAX_ROW_LIMIT);
  });

  it('MAX_ROW_LIMIT is 2000', () => {
    expect(BUILDER_LIMITS.MAX_ROW_LIMIT).toBe(2000);
  });

  it('FIRESTORE_IN_LIMIT is 10', () => {
    expect(BUILDER_LIMITS.FIRESTORE_IN_LIMIT).toBe(10);
  });

  it('MAX_ACTIVE_FILTERS is 10', () => {
    expect(BUILDER_LIMITS.MAX_ACTIVE_FILTERS).toBe(10);
  });
});

// ============================================================================
// Security & Boundary Tests (SPEC-011 enrichment)
// ============================================================================

describe('Security — Input Injection', () => {
  it('rejects filter values with XSS attempt', () => {
    // XSS strings should still be "valid" filter values (they are strings)
    // but should NOT cause isValidDomainId to accept them
    expect(isValidDomainId('<script>alert(1)</script>')).toBe(false);
    expect(isValidDomainId('projects" OR 1=1 --')).toBe(false);
  });

  it('rejects prototype pollution domain IDs', () => {
    expect(isValidDomainId('__proto__')).toBe(false);
    expect(isValidDomainId('constructor')).toBe(false);
    expect(isValidDomainId('toString')).toBe(false);
  });

  it('filter value accepts safe strings for eq operator', () => {
    // Normal strings with special chars should be valid for eq
    expect(isValidFilterValue('Παγώνης & Σία', 'eq')).toBe(true);
    expect(isValidFilterValue('report@email.com', 'eq')).toBe(true);
  });
});

describe('Boundary — Edge Values', () => {
  it('rejects empty string as domain ID', () => {
    expect(isValidDomainId('')).toBe(false);
  });

  it('isValidFilterValue accepts string pair for between (date ranges)', () => {
    // Empty strings are valid for between (used with date pickers that start empty)
    expect(isValidFilterValue(['', ''], 'between')).toBe(true);
  });

  it('isValidFilterValue accepts empty array for in (selects nothing)', () => {
    // Empty array = no match, valid filter state
    expect(isValidFilterValue([], 'in')).toBe(true);
  });

  it('BUILDER_LIMITS.DEFAULT_ROW_LIMIT is positive', () => {
    expect(BUILDER_LIMITS.DEFAULT_ROW_LIMIT).toBeGreaterThan(0);
  });

  it('all VALID_DOMAIN_IDS are non-empty strings', () => {
    for (const id of VALID_DOMAIN_IDS) {
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    }
  });

  it('URL encode/decode handles ASCII-safe filter values', () => {
    const filters: ReportBuilderFilter[] = [
      { id: 'f1', fieldKey: 'name', operator: 'eq', value: 'Test & Co' },
    ];
    const encoded = encodeBuilderState('projects', filters, ['name']);
    const decoded = decodeBuilderState(new URLSearchParams(encoded));
    expect(decoded.filters![0].value).toBe('Test & Co');
  });

  it('URL encode/decode preserves numeric filter values', () => {
    const filters: ReportBuilderFilter[] = [
      { id: 'f1', fieldKey: 'totalValue', operator: 'gt', value: 99999 },
    ];
    const encoded = encodeBuilderState('projects', filters, ['totalValue']);
    const decoded = decodeBuilderState(new URLSearchParams(encoded));
    expect(decoded.filters![0].value).toBe(99999);
  });
});
