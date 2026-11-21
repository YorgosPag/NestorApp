// ============================================================================
// CORE RELATIONSHIP TYPES - ENTERPRISE MODULE
// ============================================================================
//
// 🎯 Core enumeration types for professional relationship management
// Single-purpose module for basic relationship type definitions
// Part of modular Enterprise relationship types architecture
//
// ADR-318: semantic properties (category, derivesWorkAddress) live in
// `relationship-metadata.ts`. Legacy arrays are re-exported from that SSoT.
//
// ============================================================================

/**
 * 🔗 Relationship Types — ROOT of the `relationship-type` vocabulary
 * (ADR-372 §8.3 · ADR-812 / CHECK 3.73). Every other declaration that
 * enumerates these values MUST be typed on `RelationshipType` (or a derived
 * type), so a new role breaks compilation instead of fading on screen.
 *
 * ⚠️ ORDER IS UI ORDER: `getOfferedOrientedRoles` walks this array, so the
 * relationship dropdown lists roles in exactly this sequence.
 */
export const RELATIONSHIP_TYPES = [
  // 👥 Employment
  'employee',
  'manager',
  'director',
  'executive',
  'intern',
  'contractor',
  'consultant',

  // 🏢 Corporate
  'shareholder',
  'board_member',
  'chairman',
  'ceo',
  'partner',
  'representative',
  'vendor',

  // 🏛️ Government / public service
  'civil_servant',
  'department_head',
  'ministry_official',
  'elected_official',
  'appointed_official',
  'mayor',
  'deputy_mayor',
  'regional_governor',

  // 🔗 Other professional
  // ADR-372 §Β1: synonyms are ONE role. `client`/`customer` = the INVERSE reading
  // of `vendor`, `protege` = inverse of `mentor`, `supplier` = `vendor`,
  // `advisor` = `consultant` — accepted only as INPUT aliases
  // (`RELATIONSHIP_TYPE_INPUT_ALIASES` in relationship-orientation.ts).
  'competitor',
  'business_contact',

  // 👤 Personal
  'mentor',
  'colleague',
  'friend',
  'family',
  'other',

  // 🏠 ADR-244: property ownership roles (owned by the property module)
  'property_buyer',
  'property_co_buyer',
  'property_landowner',
] as const;

export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

/** ADR-244 property roles — derived by prefix, never re-enumerated. */
export type PropertyRelationshipType = Extract<RelationshipType, `property_${string}`>;

/**
 * 📊 Relationship Status - Lifecycle Management
 */
export type RelationshipStatus =
  | 'active'
  | 'inactive'
  | 'pending'
  | 'terminated'
  | 'suspended';

/**
 * 💼 Employment Status - Detailed Work Classification
 */
export type EmploymentStatus =
  | 'full_time'
  | 'part_time'
  | 'contract'
  | 'temporary'
  | 'seasonal'
  | 'volunteer'
  | 'retired'
  | 'on_leave'
  | 'terminated';

// ============================================================================
// TYPE COLLECTIONS — DERIVED FROM METADATA REGISTRY (ADR-318 SSoT)
// ============================================================================
// `EMPLOYMENT_RELATIONSHIP_TYPES`, `OWNERSHIP_RELATIONSHIP_TYPES`,
// `GOVERNMENT_RELATIONSHIP_TYPES`, `PROPERTY_RELATIONSHIP_TYPES` are
// exported from `./relationship-metadata` (the SSoT). Import them from
// `./relationship-metadata` directly, or via the `./core` barrel.
// ============================================================================

/**
 * 📊 Relationship priority scores for sorting
 */
export const RELATIONSHIP_TYPE_PRIORITY_SCORES: Record<RelationshipType, number> = {
  'ceo': 100,
  'chairman': 95,
  'director': 90,
  'executive': 85,
  'manager': 80,
  'board_member': 75,
  'elected_official': 75,
  'mayor': 70,
  'regional_governor': 70,
  'department_head': 65,
  'ministry_official': 60,
  'shareholder': 55,
  'representative': 50,
  'employee': 45,
  'civil_servant': 40,
  'contractor': 35,
  'consultant': 35,
  'partner': 25,
  'vendor': 20,
  'colleague': 15,
  'intern': 10,
  'other': 5,
  'appointed_official': 60,
  'deputy_mayor': 65,
  'mentor': 25,
  'competitor': 5,
  'business_contact': 20,
  'friend': 10,
  'family': 10,
  'property_buyer': 30,
  'property_co_buyer': 25,
  'property_landowner': 35
};
