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
  /**
   * ADR-372 §Β2 — reciprocal-role model. `true` = the role reads the same from
   * both sides (partner, colleague, friend…). `false` = DIRECTED: `source` IS
   * <role> OF `target` (employee → employer); the other side reads the INVERSE
   * label (`relationships.inverseTypes.*`). One stored record, never two.
   */
  symmetric: boolean;
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
const BETWEEN = (sources: readonly ContactType[], targets: readonly ContactType[]): CrossingPair[] =>
  sources.flatMap(s => targets.map(t => PAIR(s, t)));

/** The three contact kinds every crossing is drawn from (pure — no UI constants). */
export const CROSSING_CONTACT_TYPES: readonly ContactType[] = ['individual', 'company', 'service'];

/** All 9 possible crossings — catch-all types use this. */
const ANY_CROSSING: CrossingPair[] = BETWEEN(CROSSING_CONTACT_TYPES, CROSSING_CONTACT_TYPES);

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
    symmetric?: boolean;
  },
  allowedCrossings: CrossingPair[]
): RelationshipTypeMetadata => {
  const allowedFor = [...new Set(allowedCrossings.map(c => c.source))] as ContactType[];
  return {
    category,
    symmetric: flags.symmetric ?? false,
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

// ADR-372 §Β2: DIRECTED crossings are written ONCE, in canonical direction
// (role-holder → other party). The card the user starts from no longer matters:
// `relationship-orientation.ts` derives the stored direction from this matrix.

// Employment: an individual (source) works for a company or a public service (target).
const EMPLOYMENT_CROSSINGS: CrossingPair[] = [
  PAIR('individual', 'company'),
  PAIR('individual', 'service'),
];

// Corporate governance — board member / chairman / CEO (source) of a company (target).
const BOARD_LEVEL_CROSSINGS: CrossingPair[] = [PAIR('individual', 'company')];

// Shareholder (source) of a company (target) — a company may also hold shares.
const SHAREHOLDER_CROSSINGS: CrossingPair[] = [
  PAIR('individual', 'company'),
  PAIR('company', 'company'),
];

// Partner — wide partnership: ind↔company, company↔company, company↔service.
const PARTNER_CROSSINGS: CrossingPair[] = COMBINE(
  BIDIR('individual', 'company'),
  BIDIR('company', 'company'),
  BIDIR('company', 'service'),
);

// Consultant (source: a person or a firm) advises a company or a public service
// (target); a firm may also advise a private individual.
const PROFESSIONAL_SERVICES_CROSSINGS: CrossingPair[] = COMBINE(
  BETWEEN(['individual', 'company'], ['company', 'service']),
  [PAIR('company', 'individual')],
);

// Representative (source) represents a company or a public service (target).
const REPRESENTATIVE_CROSSINGS: CrossingPair[] = BETWEEN(['individual', 'company'], ['company', 'service']);

// Government roles — an individual (source) holds office in a public service (target).
const GOVERNMENT_CROSSINGS: CrossingPair[] = [PAIR('individual', 'service')];

// Vendor (source) supplies a customer (target) — any pairing, incl. freelancers.
// The customer side reads the INVERSE label («Πελάτης»): one role, two readings.
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
  CROSSING_CONTACT_TYPES,
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
  partner:            META('ownership',    'always',   { ownership: true, symmetric: true }, PARTNER_CROSSINGS),
  representative:     META('professional', 'optional', {},                    REPRESENTATIVE_CROSSINGS),
  vendor:             META('professional', 'never',    {},                    COMMERCIAL_CROSSINGS),

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
  competitor:         META('professional', 'never',    { symmetric: true }, COMPETITOR_CROSSINGS),
  business_contact:   META('professional', 'optional', { symmetric: true }, ANY_CROSSING),

  // Personal — mentor → mentee is DIRECTED (inverse «Καθοδηγούμενος»); the rest symmetric.
  mentor:             META('personal',     'never',    {}, PERSONAL_CROSSINGS),
  colleague:          META('personal',     'never',    { symmetric: true }, PERSONAL_CROSSINGS),
  friend:             META('personal',     'never',    { symmetric: true }, PERSONAL_CROSSINGS),
  family:             META('personal',     'never',    { symmetric: true }, PERSONAL_CROSSINGS),
  other:              META('personal',     'never',    { symmetric: true }, ANY_CROSSING),

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
  return sources.flatMap(source => CROSSING_CONTACT_TYPES.map(target => ({ source, target })));
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
