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
// =============================================================================
// PAGINATION INTERFACES
// =============================================================================

export interface PaginatedResult<T> {
  items: T[];
  hasNext: boolean;
  nextCursor?: DocumentSnapshot; // For next page
  totalShown: number; // Items shown so far
  pageSize: number;
}

// =============================================================================
// PAGINATION FUNCTIONS
// =============================================================================


