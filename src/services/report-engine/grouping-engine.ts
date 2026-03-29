/**
 * @module services/report-engine/grouping-engine
 * @enterprise ADR-268 Phase 2 — Client-side Grouping & Aggregation Engine
 *
 * Pure functions for grouping flat query results into a tree structure
 * with aggregation subtotals. Operates on max 2000 rows client-side (Q41).
 *
 * Reuses getNestedValue from report-query-executor for dot-path resolution.
 */

import type {
  AggregationFunction,
  BuilderChartType,
  BuilderDomainId,
  FieldAggregation,
  FieldDefinition,
  FieldValueType,
  GroupByConfig,
  GroupedRow,
  GroupingResult,
} from '@/config/report-builder/report-builder-types';
import { AGGREGATIONS_BY_TYPE } from '@/config/report-builder/report-builder-types';
import type { ReportKPI } from '@/components/reports/core/ReportKPIGrid';
import { Hash, DollarSign, TrendingUp, Layers, Percent } from 'lucide-react';

/**
 * Resolve a dot-path value from an object.
 * Duplicated from report-query-executor to avoid firebase-admin transitive dependency.
 */
function getNestedValue(obj: Record<string, unknown>, dotPath: string): unknown {
  const parts = dotPath.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

// ============================================================================
// Constants
// ============================================================================

/** Sentinel key for rows with null/undefined group-by value */
export const UNKNOWN_GROUP_KEY = '__unknown__';

// ============================================================================
// Aggregate Key Helpers
// ============================================================================

/** Build composite key: "SUM:areas.gross" */
export function aggregateKey(fn: AggregationFunction, fieldKey: string): string {
  return `${fn}:${fieldKey}`;
}

/** Stable string representation of a group value */
function toGroupKey(value: unknown): string {
  if (value === null || value === undefined) return UNKNOWN_GROUP_KEY;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

// ============================================================================
// Value Extraction
// ============================================================================

/** Extract numeric values from rows for a given dot-path field */
export function extractNumericValues(
  rows: Record<string, unknown>[],
  fieldKey: string,
): number[] {
  const values: number[] = [];
  for (const row of rows) {
    const raw = getNestedValue(row, fieldKey);
    if (typeof raw === 'number' && !Number.isNaN(raw)) {
      values.push(raw);
    }
  }
  return values;
}

// ============================================================================
// Aggregation Computation
// ============================================================================

/** Compute a single aggregation over numeric values */
export function computeAggregate(
  values: number[],
  fn: AggregationFunction,
): number {
  if (fn === 'COUNT') return values.length;
  if (values.length === 0) return 0;

  switch (fn) {
    case 'SUM':
      return values.reduce((a, b) => a + b, 0);
    case 'AVG':
      return values.reduce((a, b) => a + b, 0) / values.length;
    case 'MIN':
      return Math.min(...values);
    case 'MAX':
      return Math.max(...values);
  }
}

/** Compute all aggregations for a set of rows */
function computeAggregates(
  rows: Record<string, unknown>[],
  aggregations: FieldAggregation[],
): Record<string, number> {
  const result: Record<string, number> = {};

  result[aggregateKey('COUNT', '*')] = rows.length;

  for (const agg of aggregations) {
    const key = aggregateKey(agg.function, agg.fieldKey);
    if (agg.function === 'COUNT') {
      result[key] = rows.length;
    } else {
      const values = extractNumericValues(rows, agg.fieldKey);
      result[key] = computeAggregate(values, agg.function);
    }
  }

  return result;
}

// ============================================================================
// Main Grouping Function
// ============================================================================

/** Group flat rows by 1-2 levels with aggregations */
export function groupRows(
  rows: Record<string, unknown>[],
  config: GroupByConfig,
  fields: FieldDefinition[],
): GroupingResult {
  if (rows.length === 0) {
    return { groups: [], grandTotals: { [aggregateKey('COUNT', '*')]: 0 }, totalRowCount: 0 };
  }

  // Build level-1 buckets
  const l1Map = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    const key = toGroupKey(getNestedValue(row, config.level1));
    const bucket = l1Map.get(key);
    if (bucket) {
      bucket.push(row);
    } else {
      l1Map.set(key, [row]);
    }
  }

  const groups: GroupedRow[] = [];

  for (const [l1Key, l1Rows] of l1Map) {
    if (config.level2) {
      // Build level-2 sub-groups
      const l2Map = new Map<string, Record<string, unknown>[]>();
      for (const row of l1Rows) {
        const key = toGroupKey(getNestedValue(row, config.level2));
        const bucket = l2Map.get(key);
        if (bucket) {
          bucket.push(row);
        } else {
          l2Map.set(key, [row]);
        }
      }

      const children: GroupedRow[] = [];
      for (const [l2Key, l2Rows] of l2Map) {
        children.push({
          groupKey: l2Key,
          groupField: config.level2,
          depth: 1,
          aggregates: computeAggregates(l2Rows, config.aggregations),
          children: l2Rows,
          rowCount: l2Rows.length,
        });
      }

      groups.push({
        groupKey: l1Key,
        groupField: config.level1,
        depth: 0,
        aggregates: computeAggregates(l1Rows, config.aggregations),
        children,
        rowCount: l1Rows.length,
      });
    } else {
      groups.push({
        groupKey: l1Key,
        groupField: config.level1,
        depth: 0,
        aggregates: computeAggregates(l1Rows, config.aggregations),
        children: l1Rows,
        rowCount: l1Rows.length,
      });
    }
  }

  const grandTotals = computeAggregates(rows, config.aggregations);

  return { groups, grandTotals, totalRowCount: rows.length };
}

// ============================================================================
// Sorting
// ============================================================================

/** Sort groups by a specific aggregate value (in-place) */
export function sortGroupsByAggregate(
  groups: GroupedRow[],
  aggKey: string,
  direction: 'asc' | 'desc',
): void {
  const mult = direction === 'asc' ? 1 : -1;
  groups.sort((a, b) => mult * ((a.aggregates[aggKey] ?? 0) - (b.aggregates[aggKey] ?? 0)));
}

// ============================================================================
// Percent of Total
// ============================================================================

/** Compute % of total COUNT for each group */
export function computePercentOfTotal(
  groups: GroupedRow[],
  totalRowCount: number,
): Map<string, number> {
  const result = new Map<string, number>();
  if (totalRowCount === 0) return result;

  for (const group of groups) {
    result.set(group.groupKey, (group.rowCount / totalRowCount) * 100);
  }
  return result;
}

// ============================================================================
// Chart Auto-Suggest
// ============================================================================

/** Suggest chart type based on group-by field type and group count */
export function suggestChartType(
  fieldType: FieldValueType,
  groupCount: number,
): BuilderChartType {
  if (fieldType === 'boolean') return 'pie';
  if (fieldType === 'enum' && groupCount <= 8) return 'pie';
  if (fieldType === 'enum') return 'bar';
  if (fieldType === 'date') return 'line';
  if (fieldType === 'text' && groupCount <= 5) return 'pie';
  return 'bar';
}

// ============================================================================
// KPI Generation
// ============================================================================

/** Generate context-aware KPIs from grouped data (max 4) */
export function generateKPIs(
  result: GroupingResult,
  config: GroupByConfig,
  domain: BuilderDomainId,
  columns: string[],
  fields: FieldDefinition[],
): ReportKPI[] {
  const kpis: ReportKPI[] = [];
  const fieldMap = new Map(fields.map(f => [f.key, f]));

  // Slot 1: Total count (always)
  kpis.push({
    title: 'Total',
    value: result.totalRowCount,
    icon: Hash,
    color: 'blue',
  });

  // Slot 2: First SUM of a currency/number field
  const sumEntry = findFirstAggregate(result.grandTotals, 'SUM', columns, fieldMap);
  if (sumEntry) {
    const field = fieldMap.get(sumEntry.fieldKey);
    kpis.push({
      title: `Total ${field?.labelKey ?? sumEntry.fieldKey}`,
      value: formatAggregateValue(sumEntry.value, field?.type),
      icon: DollarSign,
      color: 'green',
    });
  }

  // Slot 3: First AVG of a numeric field
  const avgEntry = findFirstAggregate(result.grandTotals, 'AVG', columns, fieldMap);
  if (avgEntry) {
    const field = fieldMap.get(avgEntry.fieldKey);
    kpis.push({
      title: `Avg ${field?.labelKey ?? avgEntry.fieldKey}`,
      value: formatAggregateValue(avgEntry.value, field?.type),
      icon: TrendingUp,
      color: 'purple',
    });
  }

  // Slot 4: Domain-specific insight OR group count
  const domainKPI = getDomainSpecificKPI(result, config, domain);
  if (domainKPI) {
    kpis.push(domainKPI);
  } else if (kpis.length < 4) {
    kpis.push({
      title: 'Groups',
      value: result.groups.length,
      icon: Layers,
      color: 'orange',
    });
  }

  return kpis.slice(0, 4);
}

/** Find first aggregate of a given function type in grandTotals */
function findFirstAggregate(
  grandTotals: Record<string, number>,
  fn: AggregationFunction,
  columns: string[],
  fieldMap: Map<string, FieldDefinition>,
): { fieldKey: string; value: number } | null {
  for (const col of columns) {
    const field = fieldMap.get(col);
    if (!field) continue;
    const validFns = AGGREGATIONS_BY_TYPE[field.type];
    if (!validFns.includes(fn)) continue;
    const key = aggregateKey(fn, col);
    if (key in grandTotals) {
      return { fieldKey: col, value: grandTotals[key] };
    }
  }
  return null;
}

/** Format aggregate value based on field type */
function formatAggregateValue(value: number, fieldType?: FieldValueType): string {
  if (fieldType === 'currency') {
    return new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' }).format(value);
  }
  if (fieldType === 'percentage') {
    return `${value.toFixed(1)}%`;
  }
  return new Intl.NumberFormat('el-GR', { maximumFractionDigits: 1 }).format(value);
}

/** Domain-specific KPI insight (e.g. "Sold %" for units) */
function getDomainSpecificKPI(
  result: GroupingResult,
  config: GroupByConfig,
  domain: BuilderDomainId,
): ReportKPI | null {
  if (domain === 'units' && config.level1 === 'commercialStatus') {
    const soldGroup = result.groups.find(g => g.groupKey === 'sold');
    if (soldGroup && result.totalRowCount > 0) {
      const pct = ((soldGroup.rowCount / result.totalRowCount) * 100).toFixed(1);
      return { title: 'Sold %', value: `${pct}%`, icon: Percent, color: 'green' };
    }
  }
  if (domain === 'projects' && config.level1 === 'status') {
    const completedGroup = result.groups.find(g => g.groupKey === 'completed');
    if (completedGroup && result.totalRowCount > 0) {
      const pct = ((completedGroup.rowCount / result.totalRowCount) * 100).toFixed(1);
      return { title: 'Completed %', value: `${pct}%`, icon: Percent, color: 'green' };
    }
  }
  return null;
}
