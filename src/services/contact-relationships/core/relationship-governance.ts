import type { ContactRelationship, RelationshipType } from '@/types/contacts/relationships';
import { EMPLOYMENT_RELATIONSHIP_TYPES } from '@/types/contacts/relationships';

export const PROTECTED_COMPANY_RELATIONSHIP_TYPES: RelationshipType[] = [
  'shareholder',
  'board_member',
  'representative',
  'director',
  'ceo',
  'chairman'
];

export const HIERARCHY_IMPACT_RELATIONSHIP_TYPES: RelationshipType[] = [
  ...EMPLOYMENT_RELATIONSHIP_TYPES,
  'ceo',
  'chairman'
];

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
