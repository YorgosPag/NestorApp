import type { ContactRelationship, RelationshipType } from '@/types/contacts/relationships';
import { EMPLOYMENT_RELATIONSHIP_TYPES } from '@/types/contacts/relationships';
import { RECIPROCAL_MAPPINGS } from './relationship-helpers';

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
  affectsReciprocal: boolean;
  reciprocalType: RelationshipType | null;
  requiresTermination: boolean;
  canHardDelete: boolean;
}

export function getRelationshipGovernanceInfo(
  relationship: Pick<ContactRelationship, 'relationshipType' | 'status'>
): RelationshipGovernanceInfo {
  const reciprocalType = RECIPROCAL_MAPPINGS[relationship.relationshipType] ?? null;
  const isProtectedRole = PROTECTED_COMPANY_RELATIONSHIP_TYPES.includes(relationship.relationshipType);
  const affectsHierarchy = HIERARCHY_IMPACT_RELATIONSHIP_TYPES.includes(relationship.relationshipType);
  const affectsReciprocal = reciprocalType !== null;
  const isActive = relationship.status === 'active';
  const requiresTermination = isActive && (isProtectedRole || affectsHierarchy || affectsReciprocal);

  return {
    isProtectedRole,
    affectsHierarchy,
    affectsReciprocal,
    reciprocalType,
    requiresTermination,
    canHardDelete: !requiresTermination
  };
}
