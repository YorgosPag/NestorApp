/**
 * @module config/report-builder/report-builder-types
 * @enterprise ADR-268 — Dynamic Report Builder Type System
 *
 * Foundation types for the entire Report Builder feature.
 * All other report-builder modules import from here.
 */

import { generateTempId } from '@/services/enterprise-id.service';

// Phase 3 — Export types (barrel re-export for convenience)
export type {
  WatermarkMode,
  ExportFormat,
  ExportScope,
  BuilderExportParams,
} from '@/services/report-engine/builder-export-types';

// ============================================================================
// Field & Filter Types
// ============================================================================

/** Supported field value types — drive UI rendering + filter operators */
export type FieldValueType =
  | 'text'
  | 'enum'
  | 'number'
  | 'currency'
  | 'percentage'
  | 'date'
  | 'boolean';

/** Filter operators — each FieldValueType supports a subset */
export type FilterOperator =
  | 'eq'
  | 'neq'
  | 'contains'
  | 'starts_with'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'before'
  | 'after'
  | 'in';

/** Maps each FieldValueType to its valid operators */
export const OPERATORS_BY_TYPE: Record<FieldValueType, readonly FilterOperator[]> = {
  text: ['eq', 'neq', 'contains', 'starts_with'],
  enum: ['eq', 'neq', 'in'],
  number: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between'],
  currency: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between'],
  percentage: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between'],
  date: ['eq', 'before', 'after', 'between'],
  boolean: ['eq'],
} as const;

// ============================================================================
// Filter Value Types
// ============================================================================

/** Possible filter values — discriminated by operator */
export type FilterValue =
  | string
  | number
  | boolean
  | string[]              // for 'in' operator (multi-select)
  | [number, number]      // for numeric 'between'
  | [string, string];     // for date 'between'

/** A single active filter instance */
export interface ReportBuilderFilter {
  /** Unique client-side ID (enterprise-id.service) */
  id: string;
  /** Dot-path field key, e.g. 'commercial.askingPrice' */
  fieldKey: string;
  /** Selected operator */
  operator: FilterOperator;
  /** Filter value — type depends on field type + operator */
  value: FilterValue;
}

// ============================================================================
// Field & Domain Definitions
// ============================================================================

/** Phase 1 domain IDs */
export type BuilderDomainId = 'projects' | 'buildings' | 'floors' | 'units';

/** Schema for one field within a domain */
export interface FieldDefinition {
  /** Dot-path into Firestore document, e.g. 'areas.gross' */
  key: string;
  /** i18n key in report-builder-domains namespace */
  labelKey: string;
  /** Value type — drives rendering + available operators */
  type: FieldValueType;
  /** Can be used as a filter */
  filterable: boolean;
  /** Can be used for sorting */
  sortable: boolean;
  /** Shown by default when domain is selected */
  defaultVisible: boolean;
  /** For 'enum' type — list of valid values */
  enumValues?: readonly string[];
  /** i18n prefix for enum labels, e.g. 'domains.units.enums.commercialStatus' */
  enumLabelPrefix?: string;
  /** Auto-format hint for ReportTable (overrides type default) */
  format?: 'currency' | 'number' | 'percentage' | 'date' | 'text';
  /** Foreign key reference to another domain */
  refDomain?: BuilderDomainId;
  /** Field on referenced doc to display (default: 'name') */
  refDisplayField?: string;
}

/** Complete domain configuration */
export interface DomainDefinition {
  /** Domain identifier */
  id: BuilderDomainId;
  /** Firestore collection name (from COLLECTIONS) */
  collection: string;
  /** i18n key for domain name */
  labelKey: string;
  /** i18n key for domain description */
  descriptionKey: string;
  /** Next.js route template for entity links, e.g. '/projects/{id}' */
  entityLinkPath: string;
  /** All available fields in this domain */
  fields: FieldDefinition[];
  /** Default sort field key */
  defaultSortField: string;
  /** Default sort direction */
  defaultSortDirection: 'asc' | 'desc';
}

// ============================================================================
// Query Request / Response
// ============================================================================

/** Client → Server query request */
export interface BuilderQueryRequest {
  /** Target domain */
  domain: BuilderDomainId;
  /** Active filters (AND logic) */
  filters: ReportBuilderFilter[];
  /** Field keys to return */
  columns: string[];
  /** Sort field key */
  sortField?: string;
  /** Sort direction */
  sortDirection?: 'asc' | 'desc';
  /** Row limit (default: 500, max: 2000) */
  limit: number;
}

/** Server → Client query response */
export interface BuilderQueryResponse {
  /** Result rows — only requested columns */
  rows: Record<string, unknown>[];
  /** Total docs matching filters (before limit) */
  totalMatched: number;
  /** True if totalMatched > limit */
  truncated: boolean;
  /** Resolved ref display names: { domainId: { docId: displayName } } */
  resolvedRefs: Record<string, Record<string, string>>;
  /** ISO timestamp of query execution */
  generatedAt: string;
}

// ============================================================================
// AI Query Translation
// ============================================================================

/** Output from AI natural language → structured query */
export interface AITranslatedQuery {
  /** Detected domain */
  domain: BuilderDomainId;
  /** Generated filters */
  filters: ReportBuilderFilter[];
  /** Suggested columns */
  columns: string[];
  /** 0-1 confidence score */
  confidence: number;
  /** Human-readable explanation */
  explanation: string;
}

// ============================================================================
// Phase 2 — Grouping & Aggregation Types
// ============================================================================

/** Aggregation function identifiers */
export type AggregationFunction = 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX';

/** Maps FieldValueType to valid aggregation functions */
export const AGGREGATIONS_BY_TYPE: Record<FieldValueType, readonly AggregationFunction[]> = {
  text:       ['COUNT'],
  enum:       ['COUNT'],
  number:     ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'],
  currency:   ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'],
  percentage: ['COUNT', 'AVG', 'MIN', 'MAX'],
  date:       ['COUNT', 'MIN', 'MAX'],
  boolean:    ['COUNT'],
} as const;

/** A single aggregation applied to a field */
export interface FieldAggregation {
  fieldKey: string;
  function: AggregationFunction;
}

/** Group-by configuration (1-2 levels) */
export interface GroupByConfig {
  level1: string;
  level2?: string;
  aggregations: FieldAggregation[];
}

/** A single grouped row in the output tree */
export interface GroupedRow {
  groupKey: string;
  groupField: string;
  depth: number;
  aggregates: Record<string, number>;
  children: Array<GroupedRow | Record<string, unknown>>;
  rowCount: number;
}

/** Complete grouping result */
export interface GroupingResult {
  groups: GroupedRow[];
  grandTotals: Record<string, number>;
  totalRowCount: number;
}

/** Chart type for builder visualizations */
export type BuilderChartType = 'bar' | 'line' | 'area' | 'pie' | 'stacked-bar';

/** Cross-filter state from chart click */
export interface ChartCrossFilter {
  fieldKey: string;
  value: string;
  label: string;
}

// ============================================================================
// URL State Encoding
// ============================================================================

/** Serialized builder state for URL sharing */
export interface BuilderURLState {
  /** Domain ID */
  d: BuilderDomainId;
  /** Base64-encoded JSON filters */
  f?: string;
  /** Comma-separated column keys */
  c?: string;
  /** Sort field */
  s?: string;
  /** Sort direction */
  sd?: 'asc' | 'desc';
  /** Row limit (only if non-default) */
  l?: string;
  /** Base64-encoded JSON group-by config */
  g?: string;
}

// ============================================================================
// Constants
// ============================================================================

export const BUILDER_LIMITS = {
  DEFAULT_ROW_LIMIT: 500,
  MAX_ROW_LIMIT: 2000,
  MAX_ACTIVE_FILTERS: 10,
  MAX_JOIN_DEPTH: 3,
  /** Firestore 'in' query max items */
  FIRESTORE_IN_LIMIT: 10,
  /** Max docs to fetch server-side (for post-filter headroom) */
  MAX_SERVER_FETCH: 6000,
  /** Phase 2 — Grouping limits */
  MAX_GROUP_LEVELS: 2,
  MAX_KPIS: 4,
  MAX_AGGREGATIONS: 8,
} as const;

/** All valid domain IDs */
export const VALID_DOMAIN_IDS: readonly BuilderDomainId[] = [
  'projects',
  'buildings',
  'floors',
  'units',
] as const;

// ============================================================================
// Type Guards & Validators
// ============================================================================

export function isValidDomainId(value: unknown): value is BuilderDomainId {
  return typeof value === 'string' && VALID_DOMAIN_IDS.includes(value as BuilderDomainId);
}

export function isValidOperatorForType(
  operator: FilterOperator,
  fieldType: FieldValueType,
): boolean {
  const validOps = OPERATORS_BY_TYPE[fieldType];
  return validOps.includes(operator);
}

export function isValidFilterValue(
  value: unknown,
  operator: FilterOperator,
): value is FilterValue {
  if (value === null || value === undefined) return false;

  if (operator === 'in') {
    return Array.isArray(value) && value.every(v => typeof v === 'string');
  }
  if (operator === 'between') {
    return (
      Array.isArray(value) &&
      value.length === 2 &&
      ((typeof value[0] === 'number' && typeof value[1] === 'number') ||
       (typeof value[0] === 'string' && typeof value[1] === 'string'))
    );
  }
  if (operator === 'eq' && typeof value === 'boolean') return true;

  return typeof value === 'string' || typeof value === 'number';
}

// ============================================================================
// URL State Helpers
// ============================================================================

export function encodeBuilderState(
  domain: BuilderDomainId,
  filters: ReportBuilderFilter[],
  columns: string[],
  sortField?: string,
  sortDirection?: 'asc' | 'desc',
  limit?: number,
  groupByConfig?: GroupByConfig | null,
): string {
  const params = new URLSearchParams();
  params.set('d', domain);

  if (filters.length > 0) {
    const stripped = filters.map(({ fieldKey, operator, value }) => ({
      fieldKey,
      operator,
      value,
    }));
    params.set('f', btoa(JSON.stringify(stripped)));
  }
  if (columns.length > 0) {
    params.set('c', columns.join(','));
  }
  if (sortField) params.set('s', sortField);
  if (sortDirection && sortDirection !== 'asc') params.set('sd', sortDirection);
  if (limit && limit !== BUILDER_LIMITS.DEFAULT_ROW_LIMIT) {
    params.set('l', String(limit));
  }
  if (groupByConfig) {
    params.set('g', btoa(JSON.stringify(groupByConfig)));
  }

  return params.toString();
}

export function decodeBuilderState(
  searchParams: URLSearchParams,
): Partial<{
  domain: BuilderDomainId;
  filters: ReportBuilderFilter[];
  columns: string[];
  sortField: string;
  sortDirection: 'asc' | 'desc';
  limit: number;
  groupByConfig: GroupByConfig;
}> {
  const result: ReturnType<typeof decodeBuilderState> = {};

  const d = searchParams.get('d');
  if (d && isValidDomainId(d)) result.domain = d;

  const f = searchParams.get('f');
  if (f) {
    try {
      const parsed = JSON.parse(atob(f)) as Array<{
        fieldKey: string;
        operator: FilterOperator;
        value: FilterValue;
      }>;
      result.filters = parsed.map((p) => ({
        id: generateTempId(),
        fieldKey: p.fieldKey,
        operator: p.operator,
        value: p.value,
      }));
    } catch {
      // Invalid filter encoding — ignore
    }
  }

  const c = searchParams.get('c');
  if (c) result.columns = c.split(',').filter(Boolean);

  const s = searchParams.get('s');
  if (s) result.sortField = s;

  const sd = searchParams.get('sd');
  if (sd === 'asc' || sd === 'desc') result.sortDirection = sd;

  const l = searchParams.get('l');
  if (l) {
    const num = Number(l);
    if (num > 0 && num <= BUILDER_LIMITS.MAX_ROW_LIMIT) result.limit = num;
  }

  const g = searchParams.get('g');
  if (g) {
    try {
      const parsed = JSON.parse(atob(g)) as GroupByConfig;
      if (parsed.level1 && Array.isArray(parsed.aggregations)) {
        result.groupByConfig = parsed;
      }
    } catch {
      // Invalid group-by encoding — ignore
    }
  }

  return result;
}
