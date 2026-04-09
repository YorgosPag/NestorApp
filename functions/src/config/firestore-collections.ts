/**
 * =============================================================================
 * CLOUD FUNCTIONS: Firestore Collection Names (SSoT Mirror)
 * =============================================================================
 *
 * Single Source of Truth for collection names used by Cloud Functions.
 * Mirrors the main app's src/config/firestore-collections.ts.
 *
 * WHY A SEPARATE FILE:
 * Cloud Functions run in a separate deployment environment and cannot
 * import from the Next.js app's src/ directory. This file mirrors only
 * the collections that Cloud Functions actually use.
 *
 * RULE: When adding a collection here, ensure it matches the main app's
 * COLLECTIONS constant in src/config/firestore-collections.ts.
 *
 * @module functions/config/firestore-collections
 * @enterprise SSoT — Centralized collection names for Cloud Functions
 */

export const COLLECTIONS = {
  // 📄 FILES
  FILES: 'files',

  // 📋 AUDIT (Cloud Function system events)
  CLOUD_FUNCTION_AUDIT_LOG: 'audit_log',

  // 🔍 SEARCH
  PROJECTS: 'projects',
  BUILDINGS: 'buildings',
  UNITS: 'units',
  CONTACTS: 'contacts',
  SEARCH_DOCUMENTS: 'searchDocuments',
} as const;
