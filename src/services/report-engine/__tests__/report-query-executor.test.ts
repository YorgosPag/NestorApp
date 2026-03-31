/**
 * @tests Report Query Executor — ADR-268
 * Tests filter planning, post-filtering, ref resolution logic, and utilities.
 */

import {
  planFilterExecution,
  applyPostFilters,
  getNestedValue,
  chunkArray,
} from '../report-query-executor';
import {
  applyComputedFields,
  expandRows,
} from '../report-query-transforms';
import { getDomainDefinition } from '@/config/report-builder/domain-definitions';
import type { ReportBuilderFilter } from '@/config/report-builder/report-builder-types';

// ============================================================================
// getNestedValue
// ============================================================================

describe('getNestedValue', () => {
  it('returns top-level value', () => {
    expect(getNestedValue({ name: 'Test' }, 'name')).toBe('Test');
  });

  it('returns nested value via dot path', () => {
    const obj = { commercial: { askingPrice: 150000 } };
    expect(getNestedValue(obj, 'commercial.askingPrice')).toBe(150000);
  });

  it('returns deeply nested value', () => {
    const obj = { commercial: { paymentSummary: { paidAmount: 50000 } } };
    expect(getNestedValue(obj, 'commercial.paymentSummary.paidAmount')).toBe(50000);
  });

  it('returns undefined for missing path', () => {
    expect(getNestedValue({ name: 'X' }, 'missing.path')).toBeUndefined();
  });

  it('returns undefined for null intermediate', () => {
    expect(getNestedValue({ a: null } as Record<string, unknown>, 'a.b')).toBeUndefined();
  });
});

// ============================================================================
// chunkArray
// ============================================================================

describe('chunkArray', () => {
  it('chunks array into specified size', () => {
    const result = chunkArray([1, 2, 3, 4, 5], 2);
    expect(result).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('returns single chunk if array smaller than size', () => {
    expect(chunkArray([1, 2], 10)).toEqual([[1, 2]]);
  });

  it('returns empty array for empty input', () => {
    expect(chunkArray([], 5)).toEqual([]);
  });

  it('handles exact multiple', () => {
    const result = chunkArray([1, 2, 3, 4], 2);
    expect(result).toEqual([[1, 2], [3, 4]]);
  });
});

// ============================================================================
// planFilterExecution
// ============================================================================

describe('planFilterExecution', () => {
  const projectFields = getDomainDefinition('projects').fields;
  const unitFields = getDomainDefinition('properties').fields;

  it('routes equality filter to Firestore', () => {
    const filters: ReportBuilderFilter[] = [
      { id: '1', fieldKey: 'status', operator: 'eq', value: 'active' },
    ];
    const plan = planFilterExecution(filters, projectFields);

    expect(plan.firestoreClauses).toHaveLength(1);
    expect(plan.firestoreClauses[0].opStr).toBe('==');
    expect(plan.postFilters).toHaveLength(0);
  });

  it('routes "in" filter to Firestore', () => {
    const filters: ReportBuilderFilter[] = [
      { id: '1', fieldKey: 'status', operator: 'in', value: ['planning', 'in_progress'] },
    ];
    const plan = planFilterExecution(filters, projectFields);

    expect(plan.firestoreClauses).toHaveLength(1);
    expect(plan.firestoreClauses[0].opStr).toBe('in');
    expect(plan.postFilters).toHaveLength(0);
  });

  it('routes "contains" to post-filter (always)', () => {
    const filters: ReportBuilderFilter[] = [
      { id: '1', fieldKey: 'name', operator: 'contains', value: 'Tower' },
    ];
    const plan = planFilterExecution(filters, projectFields);

    expect(plan.firestoreClauses).toHaveLength(0);
    expect(plan.postFilters).toHaveLength(1);
  });

  it('allows first inequality field in Firestore', () => {
    const filters: ReportBuilderFilter[] = [
      { id: '1', fieldKey: 'totalValue', operator: 'gt', value: 100000 },
    ];
    const plan = planFilterExecution(filters, projectFields);

    expect(plan.firestoreClauses).toHaveLength(1);
    expect(plan.firestoreClauses[0].opStr).toBe('>');
    expect(plan.postFilters).toHaveLength(0);
  });

  it('routes second inequality field to post-filter', () => {
    const filters: ReportBuilderFilter[] = [
      { id: '1', fieldKey: 'totalValue', operator: 'gt', value: 100000 },
      { id: '2', fieldKey: 'progress', operator: 'lt', value: 50 },
    ];
    const plan = planFilterExecution(filters, projectFields);

    // First inequality → Firestore, second → post-filter
    expect(plan.firestoreClauses).toHaveLength(1);
    expect(plan.postFilters).toHaveLength(1);
    expect(plan.postFilters[0].fieldKey).toBe('progress');
  });

  it('handles "between" as two Firestore clauses', () => {
    const filters: ReportBuilderFilter[] = [
      { id: '1', fieldKey: 'totalValue', operator: 'between', value: [50000, 200000] },
    ];
    const plan = planFilterExecution(filters, projectFields);

    expect(plan.firestoreClauses).toHaveLength(2);
    expect(plan.firestoreClauses[0].opStr).toBe('>=');
    expect(plan.firestoreClauses[1].opStr).toBe('<=');
  });

  it('handles mixed equality + inequality correctly', () => {
    const filters: ReportBuilderFilter[] = [
      { id: '1', fieldKey: 'status', operator: 'eq', value: 'in_progress' },
      { id: '2', fieldKey: 'totalValue', operator: 'gte', value: 100000 },
      { id: '3', fieldKey: 'name', operator: 'contains', value: 'Αθήνα' },
    ];
    const plan = planFilterExecution(filters, projectFields);

    // eq → Firestore, gte → Firestore (first inequality), contains → post-filter
    expect(plan.firestoreClauses).toHaveLength(2);
    expect(plan.postFilters).toHaveLength(1);
    expect(plan.postFilters[0].operator).toBe('contains');
  });

  it('skips filters for unknown field keys', () => {
    const filters: ReportBuilderFilter[] = [
      { id: '1', fieldKey: 'nonExistent', operator: 'eq', value: 'test' },
    ];
    const plan = planFilterExecution(filters, projectFields);

    expect(plan.firestoreClauses).toHaveLength(0);
    expect(plan.postFilters).toHaveLength(0);
  });
});

// ============================================================================
// applyPostFilters
// ============================================================================

describe('applyPostFilters', () => {
  const fields = getDomainDefinition('projects').fields;

  const rows: Record<string, unknown>[] = [
    { id: '1', name: 'Tower Alpha', status: 'in_progress', totalValue: 500000, progress: 60 },
    { id: '2', name: 'Residence Beta', status: 'completed', totalValue: 300000, progress: 100 },
    { id: '3', name: 'Tower Gamma', status: 'planning', totalValue: 800000, progress: 10 },
  ];

  it('filters by "contains"', () => {
    const filters: ReportBuilderFilter[] = [
      { id: '1', fieldKey: 'name', operator: 'contains', value: 'Tower' },
    ];
    const result = applyPostFilters(rows, filters, fields);
    expect(result).toHaveLength(2);
    expect(result[0]['name']).toBe('Tower Alpha');
  });

  it('"contains" is case-insensitive', () => {
    const filters: ReportBuilderFilter[] = [
      { id: '1', fieldKey: 'name', operator: 'contains', value: 'tower' },
    ];
    const result = applyPostFilters(rows, filters, fields);
    expect(result).toHaveLength(2);
  });

  it('filters by "gt" (number)', () => {
    const filters: ReportBuilderFilter[] = [
      { id: '1', fieldKey: 'totalValue', operator: 'gt', value: 400000 },
    ];
    const result = applyPostFilters(rows, filters, fields);
    expect(result).toHaveLength(2);
  });

  it('filters by "between" (number)', () => {
    const filters: ReportBuilderFilter[] = [
      { id: '1', fieldKey: 'progress', operator: 'between', value: [20, 80] },
    ];
    const result = applyPostFilters(rows, filters, fields);
    expect(result).toHaveLength(1);
    expect(result[0]['name']).toBe('Tower Alpha');
  });

  it('applies multiple filters (AND logic)', () => {
    const filters: ReportBuilderFilter[] = [
      { id: '1', fieldKey: 'name', operator: 'contains', value: 'Tower' },
      { id: '2', fieldKey: 'totalValue', operator: 'gt', value: 600000 },
    ];
    const result = applyPostFilters(rows, filters, fields);
    expect(result).toHaveLength(1);
    expect(result[0]['name']).toBe('Tower Gamma');
  });

  it('"neq" excludes matching values', () => {
    const filters: ReportBuilderFilter[] = [
      { id: '1', fieldKey: 'status', operator: 'neq', value: 'completed' },
    ];
    const result = applyPostFilters(rows, filters, fields);
    expect(result).toHaveLength(2);
    expect(result.every((r) => r['status'] !== 'completed')).toBe(true);
  });

  it('"in" filters by array of values', () => {
    const filters: ReportBuilderFilter[] = [
      { id: '1', fieldKey: 'status', operator: 'in', value: ['planning', 'completed'] },
    ];
    const result = applyPostFilters(rows, filters, fields);
    expect(result).toHaveLength(2);
  });
});

// ============================================================================
// Nested field filtering (Units domain)
// ============================================================================

describe('applyPostFilters — nested fields', () => {
  const fields = getDomainDefinition('properties').fields;

  const rows: Record<string, unknown>[] = [
    { id: 'u1', name: 'A-101', areas: { gross: 120 }, commercial: { askingPrice: 200000 } },
    { id: 'u2', name: 'A-102', areas: { gross: 85 }, commercial: { askingPrice: 150000 } },
    { id: 'u3', name: 'B-201', areas: { gross: 200 }, commercial: { askingPrice: 350000 } },
  ];

  it('filters by nested "areas.gross"', () => {
    const filters: ReportBuilderFilter[] = [
      { id: '1', fieldKey: 'areas.gross', operator: 'gte', value: 100 },
    ];
    const result = applyPostFilters(rows, filters, fields);
    expect(result).toHaveLength(2);
  });

  it('filters by nested "commercial.askingPrice"', () => {
    const filters: ReportBuilderFilter[] = [
      { id: '1', fieldKey: 'commercial.askingPrice', operator: 'between', value: [160000, 300000] },
    ];
    const result = applyPostFilters(rows, filters, fields);
    expect(result).toHaveLength(1);
    expect(result[0]['name']).toBe('A-101');
  });
});

// ============================================================================
// Phase 5 — applyComputedFields
// ============================================================================

describe('applyComputedFields', () => {
  it('returns rows unchanged when no computed fields', () => {
    const rows = [{ id: '1', name: 'Test' }];
    const fields = [
      { key: 'name', labelKey: 'n', type: 'text' as const, filterable: true, sortable: true, defaultVisible: true },
    ];
    const result = applyComputedFields(rows, fields);
    expect(result).toEqual(rows);
  });

  it('injects computed values into rows', () => {
    const rows = [
      { id: '1', price: 100000, paid: 60000 },
      { id: '2', price: 200000, paid: 200000 },
    ];
    const fields = [
      { key: 'price', labelKey: 'p', type: 'currency' as const, filterable: true, sortable: true, defaultVisible: true },
      {
        key: 'paidPct',
        labelKey: 'pp',
        type: 'percentage' as const,
        filterable: true,
        sortable: true,
        defaultVisible: true,
        computed: true,
        computeFn: (doc: Record<string, unknown>) => {
          const price = doc['price'] as number;
          const paid = doc['paid'] as number;
          return price > 0 ? Math.round((paid / price) * 100) : 0;
        },
      },
    ];
    const result = applyComputedFields(rows, fields);
    expect(result[0]['paidPct']).toBe(60);
    expect(result[1]['paidPct']).toBe(100);
  });

  it('does not mutate original rows', () => {
    const original = { id: '1', value: 10 };
    const rows = [original];
    const fields = [
      {
        key: 'doubled',
        labelKey: 'd',
        type: 'number' as const,
        filterable: true,
        sortable: true,
        defaultVisible: true,
        computed: true,
        computeFn: (doc: Record<string, unknown>) => (doc['value'] as number) * 2,
      },
    ];
    applyComputedFields(rows, fields);
    expect(original).not.toHaveProperty('doubled');
  });
});

// ============================================================================
// Phase 5 — expandRows
// ============================================================================

describe('expandRows', () => {
  it('returns rows unchanged when expansion field is empty array', () => {
    const rows = [{ id: '1', name: 'Table A', rows: [] }];
    const result = expandRows(rows, 'rows');
    expect(result).toHaveLength(1);
    expect(result[0]['id']).toBe('1');
  });

  it('returns rows unchanged when expansion field is missing', () => {
    const rows = [{ id: '1', name: 'No rows' }];
    const result = expandRows(rows, 'rows');
    expect(result).toHaveLength(1);
  });

  it('expands array elements into separate rows', () => {
    const rows = [
      {
        id: 'table1',
        projectId: 'p1',
        rows: [
          { ordinal: 1, description: 'Unit A', areaSqm: 100 },
          { ordinal: 2, description: 'Unit B', areaSqm: 80 },
        ],
      },
    ];
    const result = expandRows(rows, 'rows');
    expect(result).toHaveLength(2);
    // Row-level fields override parent
    expect(result[0]['ordinal']).toBe(1);
    expect(result[0]['description']).toBe('Unit A');
    expect(result[1]['areaSqm']).toBe(80);
    // Parent fields preserved
    expect(result[0]['projectId']).toBe('p1');
    expect(result[1]['projectId']).toBe('p1');
    // Expansion metadata
    expect(result[0]['_parentId']).toBe('table1');
    expect(result[0]['_expansionIndex']).toBe(0);
    expect(result[1]['_expansionIndex']).toBe(1);
  });

  it('handles multiple parent docs', () => {
    const rows = [
      { id: 't1', rows: [{ ordinal: 1 }, { ordinal: 2 }] },
      { id: 't2', rows: [{ ordinal: 1 }] },
    ];
    const result = expandRows(rows, 'rows');
    expect(result).toHaveLength(3);
  });
});

// ============================================================================
// Phase 5 — Computed fields route to postFilters
// ============================================================================

describe('planFilterExecution — computed fields', () => {
  const paymentFields = getDomainDefinition('paymentPlans').fields;

  it('routes computed field equality filter to postFilters', () => {
    const filters: ReportBuilderFilter[] = [
      { id: '1', fieldKey: 'agingBucket', operator: 'eq', value: '31-60' },
    ];
    const plan = planFilterExecution(filters, paymentFields);
    expect(plan.firestoreClauses).toHaveLength(0);
    expect(plan.postFilters).toHaveLength(1);
  });

  it('routes computed field numeric filter to postFilters', () => {
    const filters: ReportBuilderFilter[] = [
      { id: '1', fieldKey: 'daysOverdue', operator: 'gt', value: 30 },
    ];
    const plan = planFilterExecution(filters, paymentFields);
    expect(plan.firestoreClauses).toHaveLength(0);
    expect(plan.postFilters).toHaveLength(1);
  });

  it('handles mix of stored + computed filters', () => {
    const filters: ReportBuilderFilter[] = [
      { id: '1', fieldKey: 'status', operator: 'eq', value: 'active' },
      { id: '2', fieldKey: 'completionPct', operator: 'lt', value: 50 },
    ];
    const plan = planFilterExecution(filters, paymentFields);
    expect(plan.firestoreClauses).toHaveLength(1); // status → Firestore
    expect(plan.postFilters).toHaveLength(1); // completionPct → JS
  });
});
