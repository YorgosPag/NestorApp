// ============================================================================
// ENTERPRISE RELATIONSHIP TYPES - MAIN MODULE EXPORTS
// ============================================================================
//
// 🎯 Centralized exports for all relationship types and utilities
// Provides clean import paths and backward compatibility
// Replaces the monolithic relationships.ts with modular architecture
//
// ============================================================================

// ============================================================================
// CORE TYPES
// ============================================================================
export * from './core';

// ============================================================================
// INTERFACES
// ============================================================================
export * from './interfaces';

// ============================================================================
// COMPLEX STRUCTURES
// ============================================================================
export * from './structures';

// ============================================================================
// UTILITIES & HELPERS
// ============================================================================
export * from './utils';

// ============================================================================
// BACKWARD COMPATIBILITY EXPORTS
// ============================================================================

// Re-export main types for backward compatibility with existing imports
export type {
  RelationshipType,
  RelationshipStatus,
  EmploymentStatus
} from './core';

export type {
  ProfessionalContactInfo,
  FinancialInfo,
  PerformanceInfo,
  ContactRelationship,
  ContactWithRelationship
} from './interfaces';

export type {
  OrganizationTree,
  OrganizationHierarchyNode,
  RelationshipSearchCriteria
} from './structures';

export {
  isEmploymentRelationship,
  isOwnershipRelationship,
  isGovernmentRelationship,
  getRelationshipPriorityScore
} from './utils';