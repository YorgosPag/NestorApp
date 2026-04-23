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
 * 🔗 Relationship Types - Enterprise Standard Categories
 *
 * Based on industry-standard business relationship classifications
 * Used by Fortune 500 companies for contact management
 */
export type RelationshipType =
  // 👥 Employment Relationships
  | 'employee'
  | 'manager'
  | 'director'
  | 'executive'
  | 'intern'
  | 'contractor'
  | 'consultant'

  // 🏢 Corporate Relationships
  | 'shareholder'
  | 'board_member'
  | 'chairman'
  | 'ceo'
  | 'representative'
  | 'partner'
  | 'vendor'
  | 'client'

  // 🏛️ Government/Service Relationships
  | 'civil_servant'
  | 'elected_official'
  | 'appointed_official'
  | 'department_head'
  | 'ministry_official'
  | 'mayor'
  | 'deputy_mayor'
  | 'regional_governor'

  // 🔗 Other Professional Relationships
  | 'advisor'
  | 'mentor'
  | 'protege'
  | 'colleague'
  | 'supplier'
  | 'customer'
  | 'competitor'
  | 'business_contact'
  | 'friend'
  | 'family'
  | 'other'
  // ADR-244: Property ownership roles
  | 'property_buyer'
  | 'property_co_buyer'
  | 'property_landowner';

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
  'advisor': 30,
  'partner': 25,
  'vendor': 20,
  'client': 20,
  'colleague': 15,
  'intern': 10,
  'other': 5,
  'appointed_official': 60,
  'deputy_mayor': 65,
  'mentor': 25,
  'protege': 15,
  'supplier': 20,
  'customer': 20,
  'competitor': 5,
  'business_contact': 20,
  'friend': 10,
  'family': 10,
  'property_buyer': 30,
  'property_co_buyer': 25,
  'property_landowner': 35
};
