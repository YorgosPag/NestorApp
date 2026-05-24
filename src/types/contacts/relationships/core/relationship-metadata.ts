// ============================================================================
// RELATIONSHIP METADATA REGISTRY — SINGLE SOURCE OF TRUTH (ADR-318 + ADR-372)
// ============================================================================
//
// One registry describes every RelationshipType's semantic properties:
//   - category           (employment, ownership, government, ...)
//   - derivesWorkAddress (always | optional | never)
//   - isEmployment / isOwnership / isGovernment / isProperty flags
//   - allowedCrossings   (SSoT — explicit list of valid {source, target} pairs)
//   - allowedFor         (derived — source contact types extracted from
//                         allowedCrossings; kept for backward compatibility)
//
// ADR-372 introduces `allowedCrossings`: a 2D source×target matrix that fully
// describes who may participate in each relationship type and on which side.
// The legacy single-axis `allowedFor` field is preserved but is now derived,
// guaranteeing zero divergence between source-filter and crossing-matrix.
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

/**
 * 🔗 ADR-372: explicit source→target pair describing one valid crossing for a
 * relationship type. A type may be valid for many crossings; the union of all
 * source values across its `allowedCrossings` is the legacy `allowedFor` set.
 */
export interface CrossingPair {
  source: ContactType;
  target: ContactType;
}

export interface RelationshipTypeMetadata {
  category: RelationshipCategory;
  derivesWorkAddress: WorkAddressDerivation;
  isEmployment: boolean;
  isOwnership: boolean;
  isGovernment: boolean;
  isProperty: boolean;
  /** ADR-372: explicit (source, target) crossings. SSoT for both axes. */
  allowedCrossings: CrossingPair[];
  /** DERIVED from `allowedCrossings` — distinct source types. Kept for back-compat. */
  allowedFor: ContactType[];
}

// ----------------------------------------------------------------------------
// CROSSING HELPERS — compact authoring for the matrix below
// ----------------------------------------------------------------------------

const PAIR = (source: ContactType, target: ContactType): CrossingPair => ({ source, target });

/** Bidirectional pair: `(a→b)` AND `(b→a)`. If `a === b`, collapses to single pair. */
const BIDIR = (a: ContactType, b: ContactType): CrossingPair[] =>
  a === b ? [PAIR(a, b)] : [PAIR(a, b), PAIR(b, a)];

/** Cartesian product between two contact-type sets. */
const BETWEEN = (sources: ContactType[], targets: ContactType[]): CrossingPair[] =>
  sources.flatMap(s => targets.map(t => PAIR(s, t)));

const ALL_CONTACT_TYPES: ContactType[] = ['individual', 'company', 'service'];

/** All 9 possible crossings — catch-all types use this. */
const ANY_CROSSING: CrossingPair[] = BETWEEN(ALL_CONTACT_TYPES, ALL_CONTACT_TYPES);

/** Concatenate crossing lists and dedupe by `source|target` key. */
const COMBINE = (...lists: CrossingPair[][]): CrossingPair[] => {
  const seen = new Set<string>();
  const out: CrossingPair[] = [];
  for (const list of lists) {
    for (const c of list) {
      const k = `${c.source}|${c.target}`;
      if (!seen.has(k)) {
        seen.add(k);
        out.push(c);
      }
    }
  }
  return out;
};

// ----------------------------------------------------------------------------
// META FACTORY — derives `allowedFor` from `allowedCrossings` automatically
// ----------------------------------------------------------------------------

const META = (
  category: RelationshipCategory,
  derivesWorkAddress: WorkAddressDerivation,
  flags: {
    employment?: boolean;
    ownership?: boolean;
    government?: boolean;
    property?: boolean;
  },
  allowedCrossings: CrossingPair[]
): RelationshipTypeMetadata => {
  const allowedFor = [...new Set(allowedCrossings.map(c => c.source))] as ContactType[];
  return {
    category,
    derivesWorkAddress,
    isEmployment: flags.employment ?? false,
    isOwnership: flags.ownership ?? false,
    isGovernment: flags.government ?? false,
    isProperty: flags.property ?? false,
    allowedCrossings,
    allowedFor,
  };
};

// ----------------------------------------------------------------------------
// COMMON CROSSING PRESETS (named for the registry below)
// ----------------------------------------------------------------------------

// Employment: an individual works for a company or a public service.
const EMPLOYMENT_CROSSINGS: CrossingPair[] = COMBINE(
  BIDIR('individual', 'company'),
  BIDIR('individual', 'service'),
);

// Ownership / corporate governance — board / shareholder.
const BOARD_LEVEL_CROSSINGS: CrossingPair[] = BIDIR('individual', 'company');

// Shareholder — a company may also hold shares of another company.
const SHAREHOLDER_CROSSINGS: CrossingPair[] = COMBINE(
  BIDIR('individual', 'company'),
  BIDIR('company', 'company'),
);

// Partner — wide partnership: ind↔company, company↔company, company↔service.
const PARTNER_CROSSINGS: CrossingPair[] = COMBINE(
  BIDIR('individual', 'company'),
  BIDIR('company', 'company'),
  BIDIR('company', 'service'),
);

// Consulting / advisory — flexible across all business entity pairings.
const PROFESSIONAL_SERVICES_CROSSINGS: CrossingPair[] = COMBINE(
  BIDIR('individual', 'company'),
  BIDIR('individual', 'service'),
  BIDIR('company', 'company'),
  BIDIR('company', 'service'),
);

// Representative — represents a company or a public service.
const REPRESENTATIVE_CROSSINGS: CrossingPair[] = PROFESSIONAL_SERVICES_CROSSINGS;

// Government roles — strictly between an individual and a public service.
const GOVERNMENT_CROSSINGS: CrossingPair[] = BIDIR('individual', 'service');

// Vendor / Client / Supplier / Customer — any business pairing, including ind↔ind freelancer cases.
const COMMERCIAL_CROSSINGS: CrossingPair[] = ANY_CROSSING;

// Competitor — companies, freelancers, mixed; services don't compete with others here.
const COMPETITOR_CROSSINGS: CrossingPair[] = COMBINE(
  BIDIR('individual', 'individual'),
  BIDIR('individual', 'company'),
  BIDIR('company', 'company'),
);

// Personal — individual to individual only.
const PERSONAL_CROSSINGS: CrossingPair[] = [PAIR('individual', 'individual')];

// Property roles — buyer/landowner sits on the ind/company side.
const PROPERTY_CROSSINGS: CrossingPair[] = BETWEEN(
  ['individual', 'company'],
  ALL_CONTACT_TYPES,
);

// ============================================================================
// REGISTRY (SSoT)
// ============================================================================

export const RELATIONSHIP_METADATA: Record<RelationshipType, RelationshipTypeMetadata> = {
  // Employment
  employee:           META('employment',   'always',   { employment: true }, EMPLOYMENT_CROSSINGS),
  manager:            META('employment',   'always',   { employment: true }, EMPLOYMENT_CROSSINGS),
  director:           META('employment',   'always',   { employment: true }, EMPLOYMENT_CROSSINGS),
  executive:          META('employment',   'always',   { employment: true }, EMPLOYMENT_CROSSINGS),
  intern:             META('employment',   'always',   { employment: true }, EMPLOYMENT_CROSSINGS),
  contractor:         META('employment',   'always',   { employment: true }, EMPLOYMENT_CROSSINGS),
  consultant:         META('professional', 'optional', {},                    PROFESSIONAL_SERVICES_CROSSINGS),

  // Ownership / Corporate
  shareholder:        META('ownership',    'always',   { ownership: true },   SHAREHOLDER_CROSSINGS),
  board_member:       META('ownership',    'always',   { ownership: true },   BOARD_LEVEL_CROSSINGS),
  chairman:           META('ownership',    'always',   { ownership: true },   BOARD_LEVEL_CROSSINGS),
  ceo:                META('ownership',    'always',   { ownership: true },   BOARD_LEVEL_CROSSINGS),
  partner:            META('ownership',    'always',   { ownership: true },   PARTNER_CROSSINGS),
  representative:     META('professional', 'optional', {},                    REPRESENTATIVE_CROSSINGS),
  vendor:             META('professional', 'never',    {},                    COMMERCIAL_CROSSINGS),
  client:             META('professional', 'never',    {},                    COMMERCIAL_CROSSINGS),

  // Government
  civil_servant:      META('government',   'always',   { employment: true, government: true }, GOVERNMENT_CROSSINGS),
  department_head:    META('government',   'always',   { employment: true, government: true }, GOVERNMENT_CROSSINGS),
  ministry_official:  META('government',   'always',   { employment: true, government: true }, GOVERNMENT_CROSSINGS),
  elected_official:   META('government',   'never',    { government: true },                   GOVERNMENT_CROSSINGS),
  appointed_official: META('government',   'never',    { government: true },                   GOVERNMENT_CROSSINGS),
  mayor:              META('government',   'never',    { government: true },                   GOVERNMENT_CROSSINGS),
  deputy_mayor:       META('government',   'never',    { government: true },                   GOVERNMENT_CROSSINGS),
  regional_governor:  META('government',   'never',    { government: true },                   GOVERNMENT_CROSSINGS),

  // Professional (other)
  advisor:            META('professional', 'optional', {}, PROFESSIONAL_SERVICES_CROSSINGS),
  supplier:           META('professional', 'never',    {}, COMMERCIAL_CROSSINGS),
  customer:           META('professional', 'never',    {}, COMMERCIAL_CROSSINGS),
  competitor:         META('professional', 'never',    {}, COMPETITOR_CROSSINGS),
  business_contact:   META('professional', 'optional', {}, ANY_CROSSING),

  // Personal
  mentor:             META('personal',     'never',    {}, PERSONAL_CROSSINGS),
  protege:            META('personal',     'never',    {}, PERSONAL_CROSSINGS),
  colleague:          META('personal',     'never',    {}, PERSONAL_CROSSINGS),
  friend:             META('personal',     'never',    {}, PERSONAL_CROSSINGS),
  family:             META('personal',     'never',    {}, PERSONAL_CROSSINGS),
  other:              META('personal',     'never',    {}, ANY_CROSSING),

  // Property (ADR-244)
  property_buyer:     META('property',     'never',    { property: true }, PROPERTY_CROSSINGS),
  property_co_buyer:  META('property',     'never',    { property: true }, PROPERTY_CROSSINGS),
  property_landowner: META('property',     'never',    { property: true }, PROPERTY_CROSSINGS),
};

// ----------------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------------

/**
 * Builds a default `allowedCrossings` array for dynamic (custom) types where
 * only the source contact types are known. All targets are permitted.
 */
export function buildCrossingsForSources(sources: ContactType[]): CrossingPair[] {
  return sources.flatMap(source => ALL_CONTACT_TYPES.map(target => ({ source, target })));
}

export function getRelationshipMetadata(type: string): RelationshipTypeMetadata | undefined {
  return RELATIONSHIP_METADATA[type as RelationshipType];
}

export function getWorkAddressDerivation(type: string): WorkAddressDerivation {
  return RELATIONSHIP_METADATA[type as RelationshipType]?.derivesWorkAddress ?? 'never';
}

/**
 * 🔗 ADR-372: tells whether a relationship type permits the given
 * (source → target) crossing. Unknown types resolve to `false`.
 */
export function isCrossingAllowed(
  type: string,
  source: ContactType,
  target: ContactType
): boolean {
  const meta = RELATIONSHIP_METADATA[type as RelationshipType];
  if (!meta) return false;
  return meta.allowedCrossings.some(c => c.source === source && c.target === target);
}

/**
 * 🔗 ADR-372: returns every `RelationshipType` whose matrix accepts the given
 * (source, target) crossing. Ordering follows the registry declaration order.
 */
export function getRelationshipTypesForCrossing(
  source: ContactType,
  target: ContactType
): RelationshipType[] {
  return (Object.keys(RELATIONSHIP_METADATA) as RelationshipType[]).filter(type =>
    isCrossingAllowed(type, source, target)
  );
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
