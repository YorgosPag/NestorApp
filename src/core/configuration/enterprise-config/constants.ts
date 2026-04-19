/**
 * ============================================================================
 * 🏢 ENTERPRISE CONFIGURATION CONSTANTS
 * ============================================================================
 *
 * Firestore collection & document name constants.
 * Extracted from enterprise-config-management.ts (ADR-314 C.5.43 SRP split).
 *
 * ============================================================================
 */

/**
 * Configuration collection names για Firestore
 */
export const CONFIGURATION_COLLECTIONS = {
  SYSTEM: 'system',
  COMPANIES: 'companies',
  USERS: 'users',
  TEMPLATES: 'templates'
} as const;

/**
 * Configuration document names
 */
export const CONFIGURATION_DOCUMENTS = {
  MAIN: 'configuration',
  COMPANY: 'company',
  SETTINGS: 'settings',
  PROJECT_TEMPLATES: 'project-templates'
} as const;
