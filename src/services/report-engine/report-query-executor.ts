/**
 * @module services/report-engine/report-query-executor
 * @enterprise ADR-268 — Dynamic Report Builder Query Engine
 *
 * Builds dynamic Firestore queries from BuilderQueryRequest.
 * Hybrid strategy: equality filters via Firestore, inequality/contains via JS post-filter.
 * Server-only — uses Firebase Admin SDK.
 */

import 'server-only';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry';
import {
  getDomainDefinition,
} from '@/config/report-builder/domain-definitions';
import {
  BUILDER_LIMITS,
  type BuilderQueryRequest,
  type BuilderQueryResponse,
  type ReportBuilderFilter,
  type FieldDefinition,
  type DomainDefinition,
  type PreFilter,
} from '@/config/report-builder/report-builder-types';
import {
  applyComputedFields,
  expandRows,
  applySortInJs,
  getNestedValue,
  chunkArray,
} from './report-query-transforms';

const logger = createModuleLogger('ReportQueryExecutor');

// ============================================================================
// Types
// ============================================================================

interface FirestoreWhereClause {
  fieldPath: string;
  opStr: FirebaseFirestore.WhereFilterOp;
  value: unknown;
}

interface FilterPlan {
  firestoreClauses: FirestoreWhereClause[];
  postFilters: ReportBuilderFilter[];
}

// ============================================================================
// Main Entry Point
// ============================================================================

export async function executeBuilderQuery(
  companyId: string,
  request: BuilderQueryRequest,
): Promise<BuilderQueryResponse> {
  const startTime = Date.now();
  const domain = getDomainDefinition(request.domain);
  const fields = domain.fields;
  const sortField = request.sortField ?? domain.defaultSortField;
  const sortDirection = request.sortDirection ?? domain.defaultSortDirection;
  const sortFieldDef = fields.find((f) => f.key === sortField);
  const isSortComputed = sortFieldDef?.computed === true;

  // Plan which filters go to Firestore vs JS
  const plan = planFilterExecution(request.filters, fields);

  // Computed sort or post-filters → need extra headroom from Firestore
  const needsHeadroom = plan.postFilters.length > 0 || isSortComputed;

  // Build and execute Firestore query
  const rawRows = await executeFirestoreQuery(
    domain.collection,
    companyId,
    plan.firestoreClauses,
    isSortComputed ? domain.defaultSortField : sortField,
    isSortComputed ? domain.defaultSortDirection : sortDirection,
    needsHeadroom
      ? Math.min(request.limit * 3, BUILDER_LIMITS.MAX_SERVER_FETCH)
      : request.limit,
    domain.preFilters,
    domain.queryType,
  );

  // Phase 5 — Apply computed fields (after fetch, before post-filters)
  const withComputed = applyComputedFields(rawRows, fields);

  // Phase 5 — Row expansion for detail-grain domains (e.g. C7b ownership rows)
  const expanded = domain.rowExpansionField
    ? expandRows(withComputed, domain.rowExpansionField)
    : withComputed;

  // Apply post-filters
  const filtered = plan.postFilters.length > 0
    ? applyPostFilters(expanded, plan.postFilters, fields)
    : expanded;

  // Phase 5 — JS sort for computed fields (Firestore can't sort on virtual columns)
  const sorted = isSortComputed
    ? applySortInJs(filtered, sortField, sortDirection, getNestedValue)
    : filtered;

  const totalMatched = sorted.length;
  const limit = Math.min(request.limit, BUILDER_LIMITS.MAX_ROW_LIMIT);
  const truncated = totalMatched > limit;
  const limitedRows = sorted.slice(0, limit);

  // Resolve refs
  const resolvedRefs = await resolveRefs(limitedRows, fields, request.columns);

  // Project columns
  const projected = projectColumns(limitedRows, request.columns);

  logger.info('Builder query executed', {
    domain: request.domain,
    filters: request.filters.length,
    totalMatched,
    returned: projected.length,
    timeMs: Date.now() - startTime,
  });

  return {
    rows: projected,
    totalMatched,
    truncated,
    resolvedRefs,
    generatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Filter Planning
// ============================================================================

/**
 * Classifies filters into Firestore-native vs JS post-filters.
 * Firestore supports ONE inequality field per compound query.
 */
export function planFilterExecution(
  filters: ReportBuilderFilter[],
  fields: FieldDefinition[],
): FilterPlan {
  const firestoreClauses: FirestoreWhereClause[] = [];
  const postFilters: ReportBuilderFilter[] = [];
  let inequalityFieldUsed: string | null = null;

  for (const filter of filters) {
    const field = fields.find((f) => f.key === filter.fieldKey);
    if (!field) continue;

    // Phase 5 — Computed fields cannot be pushed to Firestore
    if (field.computed) {
      postFilters.push(filter);
      continue;
    }

    const clauses = mapFilterToFirestore(filter, inequalityFieldUsed);

    if (clauses === null) {
      // Cannot use Firestore — post-filter
      postFilters.push(filter);
    } else {
      firestoreClauses.push(...clauses.clauses);
      if (clauses.usesInequality) {
        inequalityFieldUsed = filter.fieldKey;
      }
    }
  }

  return { firestoreClauses, postFilters };
}

// ============================================================================
// Filter → Firestore Mapping
// ============================================================================

interface MappingResult {
  clauses: FirestoreWhereClause[];
  usesInequality: boolean;
}

function mapFilterToFirestore(
  filter: ReportBuilderFilter,
  inequalityFieldUsed: string | null,
): MappingResult | null {
  const { fieldKey, operator, value } = filter;

  // Equality operators — always Firestore-native
  if (operator === 'eq') {
    return { clauses: [{ fieldPath: fieldKey, opStr: '==', value }], usesInequality: false };
  }
  if (operator === 'neq') {
    return { clauses: [{ fieldPath: fieldKey, opStr: '!=', value }], usesInequality: false };
  }

  // 'in' operator — Firestore-native (chunk handled at query level)
  if (operator === 'in' && Array.isArray(value)) {
    return { clauses: [{ fieldPath: fieldKey, opStr: 'in', value }], usesInequality: false };
  }

  // 'contains' — always post-filter (Firestore has no substring search)
  if (operator === 'contains') return null;

  // Inequality operators — only if no other field is using inequality
  const isNewInequality = inequalityFieldUsed !== null && inequalityFieldUsed !== fieldKey;
  if (isNewInequality) return null;

  if (operator === 'gt') {
    return { clauses: [{ fieldPath: fieldKey, opStr: '>', value }], usesInequality: true };
  }
  if (operator === 'gte') {
    return { clauses: [{ fieldPath: fieldKey, opStr: '>=', value }], usesInequality: true };
  }
  if (operator === 'lt') {
    return { clauses: [{ fieldPath: fieldKey, opStr: '<', value }], usesInequality: true };
  }
  if (operator === 'lte') {
    return { clauses: [{ fieldPath: fieldKey, opStr: '<=', value }], usesInequality: true };
  }

  if (operator === 'before') {
    return { clauses: [{ fieldPath: fieldKey, opStr: '<', value }], usesInequality: true };
  }
  if (operator === 'after') {
    return { clauses: [{ fieldPath: fieldKey, opStr: '>', value }], usesInequality: true };
  }

  if (operator === 'between' && Array.isArray(value) && value.length === 2) {
    return {
      clauses: [
        { fieldPath: fieldKey, opStr: '>=', value: value[0] },
        { fieldPath: fieldKey, opStr: '<=', value: value[1] },
      ],
      usesInequality: true,
    };
  }

  if (operator === 'starts_with' && typeof value === 'string') {
    if (isNewInequality) return null;
    return {
      clauses: [
        { fieldPath: fieldKey, opStr: '>=', value },
        { fieldPath: fieldKey, opStr: '<', value: value + '\uf8ff' },
      ],
      usesInequality: true,
    };
  }

  return null;
}

// ============================================================================
// Firestore Query Execution
// ============================================================================

async function executeFirestoreQuery(
  collection: string,
  companyId: string,
  clauses: FirestoreWhereClause[],
  sortField: string,
  sortDirection: 'asc' | 'desc',
  limit: number,
  preFilters?: PreFilter[],
  queryType?: DomainDefinition['queryType'],
): Promise<Record<string, unknown>[]> {
  const db = getAdminFirestore();
  let query: FirebaseFirestore.Query = queryType === 'collectionGroup'
    ? db.collectionGroup(collection).where('companyId', '==', companyId)
    : db.collection(collection).where('companyId', '==', companyId);

  // Apply domain pre-filters (e.g. type='individual' for B1)
  if (preFilters) {
    for (const pf of preFilters) {
      query = query.where(
        pf.fieldPath,
        pf.opStr as FirebaseFirestore.WhereFilterOp,
        pf.value,
      );
    }
  }

  // Handle 'in' clauses with chunking
  const inClauses = clauses.filter((c) => c.opStr === 'in');
  const otherClauses = clauses.filter((c) => c.opStr !== 'in');

  for (const clause of otherClauses) {
    query = query.where(clause.fieldPath, clause.opStr, clause.value);
  }

  // If no 'in' clauses, simple query
  if (inClauses.length === 0) {
    query = query.orderBy(sortField, sortDirection).limit(limit);
    const snap = await query.get();
    return snap.docs.map(docToRow);
  }

  // With 'in' clauses — need chunking for >10 values
  return executeChunkedInQuery(query, inClauses, sortField, sortDirection, limit);
}

async function executeChunkedInQuery(
  baseQuery: FirebaseFirestore.Query,
  inClauses: FirestoreWhereClause[],
  sortField: string,
  sortDirection: 'asc' | 'desc',
  limit: number,
): Promise<Record<string, unknown>[]> {
  // For simplicity, handle first 'in' clause with chunking
  // Additional 'in' clauses become post-filters (rare edge case)
  const primaryIn = inClauses[0];
  const values = primaryIn.value as string[];
  const chunks = chunkArray(values, BUILDER_LIMITS.FIRESTORE_IN_LIMIT);

  const allRows: Record<string, unknown>[] = [];

  for (const chunk of chunks) {
    const q = baseQuery
      .where(primaryIn.fieldPath, 'in', chunk)
      .orderBy(sortField, sortDirection)
      .limit(limit);

    const snap = await q.get();
    allRows.push(...snap.docs.map(docToRow));

    if (allRows.length >= limit) break;
  }

  return allRows.slice(0, limit);
}

// ============================================================================
// Post-Filtering (JS)
// ============================================================================

export function applyPostFilters(
  rows: Record<string, unknown>[],
  filters: ReportBuilderFilter[],
  fields: FieldDefinition[],
): Record<string, unknown>[] {
  return rows.filter((row) =>
    filters.every((filter) => matchesFilter(row, filter)),
  );
}

function matchesFilter(row: Record<string, unknown>, filter: ReportBuilderFilter): boolean {
  const cellValue = getNestedValue(row, filter.fieldKey);
  const { operator, value: filterValue } = filter;

  if (cellValue === null || cellValue === undefined) {
    return operator === 'neq';
  }

  if (operator === 'contains' && typeof filterValue === 'string') {
    return String(cellValue).toLowerCase().includes(filterValue.toLowerCase());
  }
  if (operator === 'starts_with' && typeof filterValue === 'string') {
    return String(cellValue).toLowerCase().startsWith(filterValue.toLowerCase());
  }
  if (operator === 'eq') return cellValue === filterValue;
  if (operator === 'neq') return cellValue !== filterValue;

  const numCell = Number(cellValue);
  const numFilter = Number(filterValue);

  if (operator === 'gt') return numCell > numFilter;
  if (operator === 'gte') return numCell >= numFilter;
  if (operator === 'lt') return numCell < numFilter;
  if (operator === 'lte') return numCell <= numFilter;

  if (operator === 'before') return String(cellValue) < String(filterValue);
  if (operator === 'after') return String(cellValue) > String(filterValue);

  if (operator === 'between' && Array.isArray(filterValue) && filterValue.length === 2) {
    const [min, max] = filterValue;
    if (typeof min === 'number') return numCell >= min && numCell <= (max as number);
    return String(cellValue) >= String(min) && String(cellValue) <= String(max);
  }

  if (operator === 'in' && Array.isArray(filterValue)) {
    return filterValue.includes(String(cellValue));
  }

  return true;
}

// ============================================================================
// Reference Resolution
// ============================================================================

async function resolveRefs(
  rows: Record<string, unknown>[],
  fields: FieldDefinition[],
  requestedColumns: string[],
): Promise<Record<string, Record<string, string>>> {
  const resolved: Record<string, Record<string, string>> = {};
  const refFields = fields.filter(
    (f) => f.refDomain && requestedColumns.includes(f.key),
  );

  if (refFields.length === 0) return resolved;

  const db = getAdminFirestore();

  for (const refField of refFields) {
    const ids = collectUniqueIds(rows, refField.key);
    if (ids.length === 0) continue;

    const targetDomain = getDomainDefinition(refField.refDomain!);
    const displayField = refField.refDisplayField ?? 'name';
    const docs = await batchGetDocs(db, targetDomain.collection, ids);

    const nameMap: Record<string, string> = {};
    for (const doc of docs) {
      if (doc.exists) {
        const data = doc.data() as Record<string, unknown>;
        nameMap[doc.id] = String(getNestedValue(data, displayField) ?? doc.id);
      }
    }

    resolved[refField.refDomain!] = {
      ...resolved[refField.refDomain!],
      ...nameMap,
    };
  }

  return resolved;
}

function collectUniqueIds(rows: Record<string, unknown>[], fieldKey: string): string[] {
  const ids = new Set<string>();
  for (const row of rows) {
    const val = getNestedValue(row, fieldKey);
    if (typeof val === 'string' && val) ids.add(val);
  }
  return Array.from(ids);
}

async function batchGetDocs(
  db: FirebaseFirestore.Firestore,
  collection: string,
  ids: string[],
): Promise<FirebaseFirestore.DocumentSnapshot[]> {
  const chunks = chunkArray(ids, 100);
  const allDocs: FirebaseFirestore.DocumentSnapshot[] = [];

  for (const chunk of chunks) {
    const refs = chunk.map((id) => db.collection(collection).doc(id));
    const snaps = await db.getAll(...refs);
    allDocs.push(...snaps);
  }

  return allDocs;
}

// ============================================================================
// Column Projection
// ============================================================================

function projectColumns(
  rows: Record<string, unknown>[],
  columns: string[],
): Record<string, unknown>[] {
  return rows.map((row) => {
    const projected: Record<string, unknown> = { id: row['id'] };
    for (const col of columns) {
      projected[col] = getNestedValue(row, col);
    }
    return projected;
  });
}

// ============================================================================
// Utilities
// ============================================================================

function docToRow(doc: FirebaseFirestore.DocumentSnapshot): Record<string, unknown> {
  return { id: doc.id, ...doc.data() } as Record<string, unknown>;
}

// Re-export shared utilities + transforms for backward compatibility
export { getNestedValue, chunkArray, applyComputedFields, expandRows } from './report-query-transforms';
