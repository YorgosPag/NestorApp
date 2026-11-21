import type { ContactRelationship, RelationshipType } from '@/types/contacts/relationships';
import { ORG_CHART_RELATIONSHIP_TYPES } from '@/types/contacts/relationships/core/relationship-metadata';

export const PROTECTED_COMPANY_RELATIONSHIP_TYPES: RelationshipType[] = [
  'shareholder',
  'board_member',
  'representative',
  'director',
  'ceo',
  'chairman'
];

/** Roles whose ending changes the org chart (ADR-372 §8.3 — `orgChartLevel` in the registry). */
export const HIERARCHY_IMPACT_RELATIONSHIP_TYPES: RelationshipType[] = ORG_CHART_RELATIONSHIP_TYPES;

export interface RelationshipGovernanceInfo {
  isProtectedRole: boolean;
  affectsHierarchy: boolean;
  requiresTermination: boolean;
  canHardDelete: boolean;
}

export function getRelationshipGovernanceInfo(
  relationship: Pick<ContactRelationship, 'relationshipType' | 'status'>
): RelationshipGovernanceInfo {
  const isProtectedRole = PROTECTED_COMPANY_RELATIONSHIP_TYPES.includes(relationship.relationshipType);
  const affectsHierarchy = HIERARCHY_IMPACT_RELATIONSHIP_TYPES.includes(relationship.relationshipType);
  const isActive = relationship.status === 'active';
  const requiresTermination = isActive && (isProtectedRole || affectsHierarchy);

  return {
    isProtectedRole,
    affectsHierarchy,
    requiresTermination,
    canHardDelete: !requiresTermination
  };
}
