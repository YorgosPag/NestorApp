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
  GOVERNMENT_RELATIONSHIP_TYPES,
  isManagerialRelationshipType
} from '../core/relationship-metadata';
import { isManagerialPosition } from '../core/relationship-positions';

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
 * 🔍 THE ONE managerial judgement (ADR-372 §8.3): the ROLE is declared
 * people-managing (`isManagerial` in the metadata registry) OR the position is a
 * preset declared people-managing. Free-text job titles are never guessed.
 */
export function isManagerialRelationship(
  relationship: Pick<ContactRelationship, 'relationshipType' | 'position'>
): boolean {
  return isManagerialRelationshipType(relationship.relationshipType)
    || isManagerialPosition(relationship.position);
}

/**
 * 🔍 Type guard for checking if relationship is external (non-employee)
 */
export function isExternalRelationship(relationship: ContactRelationship): boolean {
  const externalTypes: RelationshipType[] = [
    'vendor', 'competitor', 'consultant', 'contractor'
  ];
  return externalTypes.includes(relationship.relationshipType);
}