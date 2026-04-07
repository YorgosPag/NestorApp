/**
 * Relationship Query Builder — Type Definitions
 *
 * Extracted from RelationshipQueryBuilder.ts (ADR-065 Phase 6).
 *
 * @module services/contact-relationships/search/relationship-query-types
 */

import type { WhereFilterOp, DocumentSnapshot, Query } from 'firebase/firestore';

// ============================================================================
// QUERY BUILDER TYPES
// ============================================================================

/**
 * Type-safe query filter value types.
 * Supports all Firestore-compatible primitive and array types.
 */
export type QueryFilterValue =
  | string
  | number
  | boolean
  | Date
  | null
  | string[]
  | number[]
  | boolean[];

export interface QueryFilter {
  field: string;
  operator: WhereFilterOp;
  value: QueryFilterValue;
}

export interface QuerySort {
  field: string;
  direction: 'asc' | 'desc';
}

export interface QueryPagination {
  limit?: number;
  startAfter?: DocumentSnapshot;
  endBefore?: DocumentSnapshot;
}

export interface CompiledQuery {
  firestoreQuery: Query;
  filters: QueryFilter[];
  sorts: QuerySort[];
  pagination?: QueryPagination;
  estimatedCost: number;
}
