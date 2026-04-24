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


