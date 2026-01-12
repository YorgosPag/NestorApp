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

import { Query, QuerySnapshot, DocumentSnapshot, limit, startAfter } from 'firebase/firestore';

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

  let paginatedQuery = baseQuery;

  // Add limit
  paginatedQuery = limit(paginatedQuery, pageSize);

  // Add cursor for next pages
  if (options.startAfter) {
    paginatedQuery = startAfter(paginatedQuery, options.startAfter);
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
export function createPaginationState(): PaginationState {
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
  state: PaginationState,
  result: PaginatedResult<T>,
  append: boolean = true
): PaginationState {
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

// =============================================================================
// ENTERPRISE PAGINATION PATTERNS
// =============================================================================

/**
 * Infinite scroll pagination (for large lists)
 */
export class InfiniteScrollPagination<T> {
  private query: Query;
  private mapper: DocumentMapper<T>;
  private pageSize: number;
  private state: PaginationState<T>;

  constructor(
    query: Query,
    mapper: DocumentMapper<T>,
    pageSize: number = PAGINATION_DEFAULTS.PAGE_SIZE
  ) {
    this.query = query;
    this.mapper = mapper;
    this.pageSize = pageSize;
    this.state = createPaginationState();
  }

  async loadNext(): Promise<PaginatedResult<T>> {
    if (!this.state.hasNext || this.state.isLoading) {
      return {
        items: [],
        hasNext: false,
        totalShown: this.state.allItems.length,
        pageSize: this.pageSize
      };
    }

    this.state.isLoading = true;

    try {
      const paginatedQuery = applyPagination(this.query, {
        pageSize: this.pageSize,
        startAfter: this.state.lastCursor
      });

      const snapshot = await paginatedQuery.get();
      const result = processPaginationResult(snapshot, this.pageSize, this.mapper);

      this.state = updatePaginationState(this.state, result, true);
      this.state.isLoading = false;

      return result;
    } catch (error) {
      this.state.isLoading = false;
      throw error;
    }
  }

  getAllItems(): T[] {
    return this.state.allItems;
  }

  getState(): PaginationState {
    return { ...this.state };
  }

  reset(): void {
    this.state = createPaginationState();
  }
}

/**
 * Page-based pagination (for traditional page navigation)
 */
export class PageBasedPagination<T> {
  private query: Query;
  private mapper: DocumentMapper<T>;
  private pageSize: number;
  private cursors: Map<number, DocumentSnapshot> = new Map();

  constructor(
    query: Query,
    mapper: DocumentMapper<T>,
    pageSize: number = PAGINATION_DEFAULTS.PAGE_SIZE
  ) {
    this.query = query;
    this.mapper = mapper;
    this.pageSize = pageSize;
  }

  async loadPage(pageNumber: number): Promise<PaginatedResult<T>> {
    const startCursor = pageNumber > 0 ? this.cursors.get(pageNumber - 1) : undefined;

    const paginatedQuery = applyPagination(this.query, {
      pageSize: this.pageSize,
      startAfter: startCursor
    });

    const snapshot = await paginatedQuery.get();
    const result = processPaginationResult(snapshot, this.pageSize, this.mapper);

    // Cache cursor for next page
    if (result.nextCursor) {
      this.cursors.set(pageNumber, result.nextCursor);
    }

    return result;
  }

  clearCache(): void {
    this.cursors.clear();
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Calculate pagination metrics for UI display
 */
export function calculatePaginationMetrics(
  currentItems: number,
  hasNext: boolean,
  pageSize: number
): {
  showingFrom: number;
  showingTo: number;
  hasNext: boolean;
  estimatedTotal: string;
} {
  const showingFrom = currentItems > 0 ? 1 : 0;
  const showingTo = currentItems;

  return {
    showingFrom,
    showingTo,
    hasNext,
    estimatedTotal: hasNext ? `${currentItems}+` : currentItems.toString()
  };
}