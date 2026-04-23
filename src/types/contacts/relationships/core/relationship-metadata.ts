// ============================================================================
// RELATIONSHIP METADATA REGISTRY — SINGLE SOURCE OF TRUTH (ADR-318)
// ============================================================================
//
// One registry describes every RelationshipType's semantic properties:
//   - category         (employment, ownership, government, ...)
//   - derivesWorkAddress (always | optional | never)
//   - isEmployment / isOwnership / isGovernment / isProperty flags
//   - allowedFor       (which ContactType may own this relationship)
//
// Legacy arrays (EMPLOYMENT_RELATIONSHIP_TYPES, OWNERSHIP_RELATIONSHIP_TYPES,
// GOVERNMENT_RELATIONSHIP_TYPES, PROPERTY_RELATIONSHIP_TYPES) are DERIVED
// from this registry — zero duplication.
//
// ADR-318: `derivesWorkAddress` drives `useDerivedWorkAddresses` filtering.
// - 'always'   → every relationship of this type derives a work-address card
// - 'optional' → only if `ContactRelationship.isWorkplace === true`
// - 'never'    → no card derivation
//
// ============================================================================

import type { ContactType } from '../../contracts';
import type { RelationshipType } from './relationship-types';

export type WorkAddressDerivation = 'always' | 'optional' | 'never';

export type RelationshipCategory =
  | 'employment'
  | 'ownership'
  | 'government'
  | 'professional'
  | 'personal'
  | 'property';

export interface RelationshipTypeMetadata {
  category: RelationshipCategory;
  derivesWorkAddress: WorkAddressDerivation;
  isEmployment: boolean;
  isOwnership: boolean;
  isGovernment: boolean;
  isProperty: boolean;
  allowedFor: ContactType[];
}

const META = (
  category: RelationshipCategory,
  derivesWorkAddress: WorkAddressDerivation,
  flags: {
    employment?: boolean;
    ownership?: boolean;
    government?: boolean;
    property?: boolean;
  },
  allowedFor: ContactType[]
): RelationshipTypeMetadata => ({
  category,
  derivesWorkAddress,
  isEmployment: flags.employment ?? false,
  isOwnership: flags.ownership ?? false,
  isGovernment: flags.government ?? false,
  isProperty: flags.property ?? false,
  allowedFor,
});

export const RELATIONSHIP_METADATA: Record<RelationshipType, RelationshipTypeMetadata> = {
  // Employment
  employee:            META('employment', 'always',   { employment: true }, ['company', 'service']),
  manager:             META('employment', 'always',   { employment: true }, ['company', 'service']),
  director:            META('employment', 'always',   { employment: true }, ['company', 'service']),
  executive:           META('employment', 'always',   { employment: true }, ['company', 'service']),
  intern:              META('employment', 'always',   { employment: true }, ['company', 'service']),
  contractor:          META('employment', 'always',   { employment: true }, ['company', 'service']),
  consultant:          META('professional', 'optional', {},                  ['company', 'service']),

  // Ownership / Corporate
  shareholder:         META('ownership', 'always',   { ownership: true },   ['company']),
  board_member:        META('ownership', 'always',   { ownership: true },   ['company']),
  chairman:            META('ownership', 'always',   { ownership: true },   ['company']),
  ceo:                 META('ownership', 'always',   { ownership: true },   ['company']),
  partner:             META('ownership', 'always',   { ownership: true },   ['company']),
  representative:      META('professional', 'optional', {},                  ['company']),
  vendor:              META('professional', 'never',  {},                    ['company']),
  client:              META('professional', 'never',  {},                    ['company']),

  // Government
  civil_servant:       META('government', 'always',  { employment: true, government: true }, ['service']),
  department_head:     META('government', 'always',  { employment: true, government: true }, ['service']),
  ministry_official:   META('government', 'always',  { employment: true, government: true }, ['service']),
  elected_official:    META('government', 'never',   { government: true }, ['service']),
  appointed_official:  META('government', 'never',   { government: true }, ['service']),
  mayor:               META('government', 'never',   { government: true }, ['service']),
  deputy_mayor:        META('government', 'never',   { government: true }, ['service']),
  regional_governor:   META('government', 'never',   { government: true }, ['service']),

  // Professional (other)
  advisor:             META('professional', 'optional', {},                  ['company', 'service']),
  supplier:            META('professional', 'never',  {},                    ['company']),
  customer:            META('professional', 'never',  {},                    ['company']),
  competitor:          META('professional', 'never',  {},                    ['company']),
  business_contact:    META('professional', 'optional', {},                  ['individual']),

  // Personal
  mentor:              META('personal',    'never',  {},                     ['individual']),
  protege:             META('personal',    'never',  {},                     ['individual']),
  colleague:           META('personal',    'never',  {},                     ['individual']),
  friend:              META('personal',    'never',  {},                     ['individual']),
  family:              META('personal',    'never',  {},                     ['individual']),
  other:               META('personal',    'never',  {},                     ['individual', 'company', 'service']),

  // Property (ADR-244)
  property_buyer:      META('property',    'never',  { property: true },     ['individual', 'company']),
  property_co_buyer:   META('property',    'never',  { property: true },     ['individual', 'company']),
  property_landowner:  META('property',    'never',  { property: true },     ['individual', 'company']),
};

// ----------------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------------

export function getRelationshipMetadata(type: string): RelationshipTypeMetadata | undefined {
  return RELATIONSHIP_METADATA[type as RelationshipType];
}

export function getWorkAddressDerivation(type: string): WorkAddressDerivation {
  return RELATIONSHIP_METADATA[type as RelationshipType]?.derivesWorkAddress ?? 'never';
}

function typesMatching(predicate: (meta: RelationshipTypeMetadata) => boolean): RelationshipType[] {
  return (Object.keys(RELATIONSHIP_METADATA) as RelationshipType[])
    .filter(key => predicate(RELATIONSHIP_METADATA[key]));
}

// ----------------------------------------------------------------------------
// DERIVED ARRAYS — backward-compat with legacy exports
// ----------------------------------------------------------------------------

export const EMPLOYMENT_RELATIONSHIP_TYPES: RelationshipType[] = typesMatching(m => m.isEmployment);
export const OWNERSHIP_RELATIONSHIP_TYPES: RelationshipType[]  = typesMatching(m => m.isOwnership);
export const GOVERNMENT_RELATIONSHIP_TYPES: RelationshipType[] = typesMatching(m => m.isGovernment);
export const PROPERTY_RELATIONSHIP_TYPES: RelationshipType[]   = typesMatching(m => m.isProperty);
