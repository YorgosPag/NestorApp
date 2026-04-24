// =============================================================================
// 🚀 PAGINATION UTILITIES - ENTERPRISE FIRESTORE PERFORMANCE
// =============================================================================
//
// ✅ High-performance pagination for Firestore collections
// ❌ No more loading thousands of documents at once
// 🛡️ Memory efficient with lazy loading
// 🎯 Used by projects, buildings, units, contacts collections
//
// =============================================================================

import { Query, QuerySnapshot, DocumentSnapshot, limit, startAfter, query } from 'firebase/firestore';

// =============================================================================
// 🏢 ENTERPRISE: Type Definitions (ADR-compliant - NO any)
// =============================================================================

/** Firestore document data type */
export type FirestoreDocData = Record<string, unknown>;

/** Document mapper function type */
export type DocumentMapper<T> = (doc: DocumentSnapshot) => T;

// =============================================================================
// PAGINATION INTERFACES
// =============================================================================

export interface PaginationOptions {
  pageSize?: number; // Default: 20
  startAfter?: DocumentSnapshot; // For cursor-based pagination
}

export interface PaginatedResult<T> {
  items: T[];
  hasNext: boolean;
  nextCursor?: DocumentSnapshot; // For next page
  totalShown: number; // Items shown so far
  pageSize: number;
}

export interface PaginationState<T = unknown> {
  currentPage: number;
  hasNext: boolean;
  isLoading: boolean;
  lastCursor?: DocumentSnapshot;
  allItems: T[]; // Accumulated items across pages
}

// =============================================================================
// PAGINATION CONSTANTS
// =============================================================================

export const PAGINATION_DEFAULTS = {
  PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100, // Prevent excessive loads
  PREFETCH_SIZE: 5 // Prefetch next N items for smooth scrolling
} as const;

// =============================================================================
// PAGINATION FUNCTIONS
// =============================================================================

/**
 * Apply pagination to a Firestore query
 */
export function applyPagination(
  baseQuery: Query,
  options: PaginationOptions = {}
): Query {
  const pageSize = Math.min(
    options.pageSize || PAGINATION_DEFAULTS.PAGE_SIZE,
    PAGINATION_DEFAULTS.MAX_PAGE_SIZE
  );

  let paginatedQuery = query(baseQuery, limit(pageSize));

  if (options.startAfter) {
    paginatedQuery = query(paginatedQuery, startAfter(options.startAfter));
  }

  return paginatedQuery;
}

/**
 * Process pagination results with metadata
 */
export function processPaginationResult<T>(
  snapshot: QuerySnapshot,
  pageSize: number,
  mapper: DocumentMapper<T>
): PaginatedResult<T> {
  const docs = snapshot.docs;
  const items = docs.map(mapper);

  // Check if there are more items (fetch pageSize + 1 and check)
  const hasNext = docs.length === pageSize;
  const nextCursor = hasNext ? docs[docs.length - 1] : undefined;

  return {
    items,
    hasNext,
    nextCursor,
    totalShown: items.length,
    pageSize
  };
}

/**
 * Create pagination state manager
 */
export function createPaginationState<T>(): PaginationState<T> {
  return {
    currentPage: 0,
    hasNext: true,
    isLoading: false,
    allItems: []
  };
}

/**
 * Update pagination state with new results
 */
export function updatePaginationState<T>(
  state: PaginationState<T>,
  result: PaginatedResult<T>,
  append: boolean = true
): PaginationState<T> {
  return {
    ...state,
    currentPage: state.currentPage + 1,
    hasNext: result.hasNext,
    lastCursor: result.nextCursor,
    allItems: append
      ? [...state.allItems, ...result.items]
      : result.items
  };
}

