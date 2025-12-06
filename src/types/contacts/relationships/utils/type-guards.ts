// ============================================================================
// TYPE GUARDS & VALIDATION UTILITIES - ENTERPRISE MODULE
// ============================================================================
//
// 🔍 Type guard functions for relationship validation and categorization
// Enterprise-grade type safety and validation utilities
// Part of modular Enterprise relationship types architecture
//
// ============================================================================

// Import related types
import type { RelationshipType } from '../core/relationship-types';
import type { ContactRelationship } from '../interfaces/relationship';
import {
  EMPLOYMENT_RELATIONSHIP_TYPES,
  OWNERSHIP_RELATIONSHIP_TYPES,
  GOVERNMENT_RELATIONSHIP_TYPES
} from '../core/relationship-types';

/**
 * 🔍 Type guard for checking if a relationship is employment-based
 */
export function isEmploymentRelationship(relationship: ContactRelationship): boolean {
  return EMPLOYMENT_RELATIONSHIP_TYPES.includes(relationship.relationshipType);
}

/**
 * 🔍 Type guard for checking if a relationship is ownership-based
 */
export function isOwnershipRelationship(relationship: ContactRelationship): boolean {
  return OWNERSHIP_RELATIONSHIP_TYPES.includes(relationship.relationshipType);
}

/**
 * 🔍 Type guard for checking if a relationship is government-based
 */
export function isGovernmentRelationship(relationship: ContactRelationship): boolean {
  return GOVERNMENT_RELATIONSHIP_TYPES.includes(relationship.relationshipType);
}

/**
 * 🔍 Type guard for checking if relationship has active status
 */
export function isActiveRelationship(relationship: ContactRelationship): boolean {
  return relationship.status === 'active';
}

/**
 * 🔍 Type guard for checking if relationship has professional contact info
 */
export function hasProfessionalContactInfo(relationship: ContactRelationship): boolean {
  return !!(relationship.contactInfo?.businessEmail || relationship.contactInfo?.businessPhone);
}

/**
 * 🔍 Type guard for checking if relationship has financial information
 */
export function hasFinancialInfo(relationship: ContactRelationship): boolean {
  return !!(relationship.financialInfo?.annualCompensation || relationship.financialInfo?.ownershipPercentage);
}

/**
 * 🔍 Type guard for checking if relationship is managerial
 */
export function isManagerialRelationship(relationship: ContactRelationship): boolean {
  const managerialTypes: RelationshipType[] = [
    'manager', 'director', 'executive', 'ceo', 'department_head', 'chairman'
  ];
  return managerialTypes.includes(relationship.relationshipType);
}

/**
 * 🔍 Type guard for checking if relationship is external (non-employee)
 */
export function isExternalRelationship(relationship: ContactRelationship): boolean {
  const externalTypes: RelationshipType[] = [
    'vendor', 'client', 'supplier', 'customer', 'competitor', 'consultant', 'contractor'
  ];
  return externalTypes.includes(relationship.relationshipType);
}