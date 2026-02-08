// ============================================================================
// SEARCH & FILTER STRUCTURES - ENTERPRISE MODULE
// ============================================================================
//
// 🔍 Advanced search and filtering criteria for relationship queries
// Enterprise-grade search capabilities for organizational reporting
// Part of modular Enterprise relationship types architecture
//
// ============================================================================

// Import related types
import type { RelationshipType, RelationshipStatus } from '../core/relationship-types';
import type { ContactRelationship } from '../interfaces/relationship';

/**
 * 🔍 Relationship Search/Filter Criteria
 *
 * Advanced search and filtering for enterprise relationship queries
 * Supports complex organizational reporting and analytics
 */
export interface RelationshipSearchCriteria {
  /** 👤 Source contact filter */
  sourceContactIds?: string[];

  /** 👥 Target contact filter */
  targetContactIds?: string[];

  /** 🔗 Relationship types filter */
  relationshipTypes?: RelationshipType[];

  /** 📊 Status filter */
  statuses?: RelationshipStatus[];

  /** 🏢 Department filter */
  departments?: string[];

  /** 💼 Position filter (exact match) */
  positions?: string[];

  /** 👔 Seniority level filter */
  seniorityLevels?: string[];

  /** 📅 Date range filters */
  dateRanges?: {
    startDateFrom?: string;
    startDateTo?: string;
    endDateFrom?: string;
    endDateTo?: string;
  };

  /** 🏷️ Tags filter */
  tags?: string[];

  /** ⭐ Priority filter */
  priorities?: string[];

  /** 📞 Has contact info */
  hasContactInfo?: boolean;

  /** 💰 Has financial info */
  hasFinancialInfo?: boolean;

  /** 📊 Performance rating filter */
  performanceRatings?: string[];

  /** 🔍 Text search (positions, notes, etc.) */
  textSearch?: string;

  /** 📋 Custom field filters */
  customFieldFilters?: Record<string, unknown>;

  /** 📄 Pagination */
  limit?: number;
  offset?: number;

  /** 📊 Sorting */
  orderBy?: {
    field: keyof ContactRelationship;
    direction: 'asc' | 'desc';
  };
}
