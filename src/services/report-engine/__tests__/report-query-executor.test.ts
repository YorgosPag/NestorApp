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
  const unitFields = getDomainDefinition('units').fields;

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
  const fields = getDomainDefinition('units').fields;

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
