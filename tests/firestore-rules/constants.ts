/**
 * 🔒 Firestore Rules Test Constants
 *
 * CENTRALIZED collection names and test constants for Firestore security rules testing.
 * This file is the Single Source of Truth (SSoT) for collection names in tests.
 *
 * @module tests/firestore-rules/constants
 * @version 1.0.0
 * @since 2026-01-29 - Security Gate Phase 1 (PR-1A)
 *
 * 🏢 ENTERPRISE: NO hardcoded strings in test files - use these constants!
 */

// =============================================================================
// BUSINESS COLLECTIONS (Tenant-Isolated via companyId)
// =============================================================================
// These collections contain per-tenant business data and MUST have tenant isolation.
// Pattern: belongsToCompany(resource.data.companyId) || isSuperAdminOnly()

export const TENANT_ISOLATED_COLLECTIONS = {
  // Core Business
  PROJECTS: 'projects',
  BUILDINGS: 'buildings',
  FLOORS: 'floors',
  UNITS: 'units',
  CONTACTS: 'contacts',
  FILES: 'files',

  // DXF/CAD
  DXF_OVERLAY_LEVELS: 'dxf-overlay-levels',
  DXF_OVERLAY_LEVELS_ALT: 'dxfOverlayLevels',
  LAYERS: 'layers',
  FLOORPLANS: 'floorplans',
  PROJECT_FLOORPLANS: 'project_floorplans',
  BUILDING_FLOORPLANS: 'building_floorplans',
  UNIT_FLOORPLANS: 'unit_floorplans',

  // Building Components
  STORAGE_UNITS: 'storage_units',
  PARKING_SPOTS: 'parking_spots',

  // CRM
  LEADS: 'leads',
  OPPORTUNITIES: 'opportunities',
  ACTIVITIES: 'activities',
  RELATIONSHIPS: 'relationships',

  // Messaging
  CONVERSATIONS: 'conversations',
  MESSAGES: 'messages',
  EXTERNAL_IDENTITIES: 'external_identities',
  COMMUNICATIONS: 'communications',
  NOTIFICATIONS: 'notifications',

  // Tasks & Workflows
  TASKS: 'tasks',
  WORKSPACES: 'workspaces',
  TEAMS: 'teams',

  // Analytics
  ANALYTICS: 'analytics',

  // Obligations
  OBLIGATIONS: 'obligations',

  // Templates (Admin-created)
  ADMIN_BUILDING_TEMPLATES: 'admin_building_templates',
} as const;

// =============================================================================
// SYSTEM COLLECTIONS (Global Config - No Tenant Isolation)
// =============================================================================
// These collections contain system-wide data that ALL authenticated users need.
// They are READ-ONLY for clients (write: if false) and don't have per-tenant data.
// Pattern: isAuthenticated() (read-only)

export const SYSTEM_COLLECTIONS = {
  // Navigation & UI
  NAVIGATION_COMPANIES: 'navigation_companies',

  // Security & Roles
  SECURITY_ROLES: 'security_roles',
  POSITIONS: 'positions',

  // System Config
  SYSTEM: 'system',
  CONFIG: 'config',

  // Security Policies
  EMAIL_DOMAIN_POLICIES: 'email_domain_policies',
  COUNTRY_SECURITY_POLICIES: 'country_security_policies',

  // Global Counters
  COUNTERS: 'counters',

  // Bot Config
  BOT_CONFIGS: 'bot_configs',

  // Audit Logs (Read-only)
  AUDIT_LOGS: 'audit_logs',
  SYSTEM_AUDIT_LOGS: 'system_audit_logs',
  RELATIONSHIP_AUDIT: 'relationship_audit',
  AUDIT_LOG: 'audit_log',
} as const;

// =============================================================================
// OWNERSHIP-BASED COLLECTIONS (User-specific, not company-specific)
// =============================================================================
// These collections use ownerId or userId instead of companyId for access control.
// Pattern: resource.data.ownerId == request.auth.uid

export const OWNERSHIP_COLLECTIONS = {
  // User Sessions
  USERS: 'users',
  USER_SESSIONS: 'sessions', // subcollection of users
  USER_NOTIFICATION_SETTINGS: 'user_notification_settings',

  // CAD Files (owner-based)
  CAD_FILES: 'cadFiles',

  // Contact Relationships (source/target based)
  CONTACT_RELATIONSHIPS: 'contact_relationships',
} as const;

// =============================================================================
// COMPANY SUBCOLLECTIONS
// =============================================================================
// These are subcollections under /companies/{companyId}/

export const COMPANY_SUBCOLLECTIONS = {
  AUDIT_LOGS: 'audit_logs',
} as const;

// =============================================================================
// TEST DOCUMENT IDS
// =============================================================================
// Standardized document IDs for testing to ensure consistency.

export const TEST_DOC_IDS = {
  // Company A documents
  BUILDING_A1: 'building-a1',
  PROJECT_A1: 'project-a1',
  CONTACT_A1: 'contact-a1',
  FILE_A1: 'file-a1',
  UNIT_A1: 'unit-a1',
  FLOOR_A1: 'floor-a1',

  // Company B documents
  BUILDING_B1: 'building-b1',
  PROJECT_B1: 'project-b1',
  CONTACT_B1: 'contact-b1',
  FILE_B1: 'file-b1',
  UNIT_B1: 'unit-b1',
  FLOOR_B1: 'floor-b1',

  // Legacy documents (no companyId)
  LEGACY_BUILDING: 'building-legacy-a1',
  LEGACY_PROJECT: 'project-legacy-a1',

  // Test operations
  NEW_DOC: 'new-doc-test',
  UPDATE_DOC: 'update-doc-test',
  DELETE_DOC: 'delete-doc-test',
} as const;

// =============================================================================
// TEST COMPANIES
// =============================================================================

export const TEST_COMPANIES = {
  COMPANY_A: 'company-a',
  COMPANY_B: 'company-b',
  COMPANY_ROOT: 'company-root', // Super admin's company
} as const;

// =============================================================================
// HELPER TYPES
// =============================================================================

export type TenantIsolatedCollection =
  (typeof TENANT_ISOLATED_COLLECTIONS)[keyof typeof TENANT_ISOLATED_COLLECTIONS];

export type SystemCollection =
  (typeof SYSTEM_COLLECTIONS)[keyof typeof SYSTEM_COLLECTIONS];

export type OwnershipCollection =
  (typeof OWNERSHIP_COLLECTIONS)[keyof typeof OWNERSHIP_COLLECTIONS];
