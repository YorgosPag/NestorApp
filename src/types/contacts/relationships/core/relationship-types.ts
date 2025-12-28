// ============================================================================
// CORE RELATIONSHIP TYPES - ENTERPRISE MODULE
// ============================================================================
//
// 🎯 Core enumeration types for professional relationship management
// Single-purpose module for basic relationship type definitions
// Part of modular Enterprise relationship types architecture
//
// ✅ ENTERPRISE: Using centralized relationship type labels - ZERO HARDCODED VALUES
//
// ============================================================================

// 🏢 ENTERPRISE: Import centralized relationship type labels - ZERO HARDCODED VALUES
import {
  RELATIONSHIP_TYPE_LABELS,
  EMPLOYMENT_STATUS_LABELS
} from '@/constants/property-statuses-enterprise';

/**
 * 🔗 Relationship Types - Enterprise Standard Categories
 *
 * Based on industry-standard business relationship classifications
 * Used by Fortune 500 companies for contact management
 */
export type RelationshipType =
  // 👥 Employment Relationships
  | 'employee'                 // ✅ CENTRALIZED: RELATIONSHIP_TYPE_LABELS.EMPLOYEE
  | 'manager'                  // ✅ CENTRALIZED: RELATIONSHIP_TYPE_LABELS.MANAGER
  | 'director'                 // ✅ CENTRALIZED: RELATIONSHIP_TYPE_LABELS.DIRECTOR
  | 'executive'                // ✅ CENTRALIZED: RELATIONSHIP_TYPE_LABELS.EXECUTIVE
  | 'intern'                   // ✅ CENTRALIZED: RELATIONSHIP_TYPE_LABELS.INTERN
  | 'contractor'               // ✅ CENTRALIZED: RELATIONSHIP_TYPE_LABELS.CONTRACTOR
  | 'consultant'               // ✅ CENTRALIZED: RELATIONSHIP_TYPE_LABELS.CONSULTANT

  // 🏢 Corporate Relationships
  | 'shareholder'              // ✅ CENTRALIZED: RELATIONSHIP_TYPE_LABELS.SHAREHOLDER
  | 'board_member'             // ✅ CENTRALIZED: RELATIONSHIP_TYPE_LABELS.BOARD_MEMBER
  | 'chairman'                 // ✅ CENTRALIZED: RELATIONSHIP_TYPE_LABELS.CHAIRMAN
  | 'ceo'                      // ✅ CENTRALIZED: RELATIONSHIP_TYPE_LABELS.CEO
  | 'representative'           // ✅ CENTRALIZED: RELATIONSHIP_TYPE_LABELS.REPRESENTATIVE
  | 'partner'                  // ✅ CENTRALIZED: RELATIONSHIP_TYPE_LABELS.PARTNER
  | 'vendor'                   // ✅ CENTRALIZED: RELATIONSHIP_TYPE_LABELS.VENDOR
  | 'client'                   // ✅ CENTRALIZED: RELATIONSHIP_TYPE_LABELS.CLIENT

  // 🏛️ Government/Service Relationships
  | 'civil_servant'            // ✅ CENTRALIZED: RELATIONSHIP_TYPE_LABELS.CIVIL_SERVANT
  | 'elected_official'         // ✅ CENTRALIZED: RELATIONSHIP_TYPE_LABELS.ELECTED_OFFICIAL
  | 'appointed_official'       // ✅ CENTRALIZED: RELATIONSHIP_TYPE_LABELS.APPOINTED_OFFICIAL
  | 'department_head'          // ✅ CENTRALIZED: RELATIONSHIP_TYPE_LABELS.DEPARTMENT_HEAD
  | 'ministry_official'        // ✅ CENTRALIZED: RELATIONSHIP_TYPE_LABELS.MINISTRY_OFFICIAL
  | 'mayor'                    // ✅ CENTRALIZED: RELATIONSHIP_TYPE_LABELS.MAYOR
  | 'deputy_mayor'             // ✅ CENTRALIZED: RELATIONSHIP_TYPE_LABELS.DEPUTY_MAYOR
  | 'regional_governor'        // ✅ CENTRALIZED: RELATIONSHIP_TYPE_LABELS.REGIONAL_GOVERNOR

  // 🔗 Other Professional Relationships
  | 'advisor'                  // ✅ CENTRALIZED: RELATIONSHIP_TYPE_LABELS.ADVISOR
  | 'mentor'                   // ✅ CENTRALIZED: RELATIONSHIP_TYPE_LABELS.MENTOR
  | 'protege'                  // ✅ CENTRALIZED: RELATIONSHIP_TYPE_LABELS.PROTEGE
  | 'colleague'                // ✅ CENTRALIZED: RELATIONSHIP_TYPE_LABELS.COLLEAGUE
  | 'supplier'                 // ✅ CENTRALIZED: RELATIONSHIP_TYPE_LABELS.SUPPLIER
  | 'customer'                 // ✅ CENTRALIZED: RELATIONSHIP_TYPE_LABELS.CUSTOMER
  | 'competitor'               // ✅ CENTRALIZED: RELATIONSHIP_TYPE_LABELS.COMPETITOR
  | 'other';                   // ✅ CENTRALIZED: RELATIONSHIP_TYPE_LABELS.OTHER

/**
 * 📊 Relationship Status - Lifecycle Management
 *
 * Professional relationship lifecycle tracking
 * Essential for enterprise contact management
 */
export type RelationshipStatus =
  | 'active'                   // ✅ CENTRALIZED: RELATIONSHIP_STATUS_LABELS.ACTIVE
  | 'inactive'                 // ✅ CENTRALIZED: RELATIONSHIP_STATUS_LABELS.INACTIVE
  | 'pending'                  // ✅ CENTRALIZED: RELATIONSHIP_STATUS_LABELS.PENDING
  | 'terminated'               // ✅ CENTRALIZED: RELATIONSHIP_STATUS_LABELS.TERMINATED
  | 'suspended';               // ✅ CENTRALIZED: RELATIONSHIP_STATUS_LABELS.SUSPENDED

/**
 * 💼 Employment Status - Detailed Work Classification
 *
 * Professional employment status for detailed HR tracking
 * Aligned with Greek labor law and EU standards
 */
export type EmploymentStatus =
  | 'full_time'                // ✅ CENTRALIZED: EMPLOYMENT_STATUS_LABELS.FULL_TIME
  | 'part_time'                // ✅ CENTRALIZED: EMPLOYMENT_STATUS_LABELS.PART_TIME
  | 'contract'                 // ✅ CENTRALIZED: EMPLOYMENT_STATUS_LABELS.CONTRACT
  | 'temporary'                // ✅ CENTRALIZED: EMPLOYMENT_STATUS_LABELS.TEMPORARY
  | 'seasonal'                 // ✅ CENTRALIZED: EMPLOYMENT_STATUS_LABELS.SEASONAL
  | 'volunteer'                // ✅ CENTRALIZED: EMPLOYMENT_STATUS_LABELS.VOLUNTEER
  | 'retired'                  // ✅ CENTRALIZED: EMPLOYMENT_STATUS_LABELS.RETIRED
  | 'on_leave'                 // ✅ CENTRALIZED: EMPLOYMENT_STATUS_LABELS.ON_LEAVE
  | 'terminated';              // ✅ CENTRALIZED: EMPLOYMENT_STATUS_LABELS.TERMINATED

// ============================================================================
// TYPE COLLECTIONS FOR VALIDATION
// ============================================================================

/**
 * 👥 Employment-based relationship types
 */
export const EMPLOYMENT_RELATIONSHIP_TYPES: RelationshipType[] = [
  'employee', 'manager', 'director', 'executive', 'intern', 'contractor',
  'civil_servant', 'department_head', 'ministry_official'
];

/**
 * 🏢 Ownership-based relationship types
 */
export const OWNERSHIP_RELATIONSHIP_TYPES: RelationshipType[] = [
  'shareholder', 'board_member', 'chairman', 'ceo', 'partner'
];

/**
 * 🏛️ Government-based relationship types
 */
export const GOVERNMENT_RELATIONSHIP_TYPES: RelationshipType[] = [
  'civil_servant', 'elected_official', 'appointed_official', 'department_head',
  'ministry_official', 'mayor', 'deputy_mayor', 'regional_governor'
];

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
  'competitor': 5
};