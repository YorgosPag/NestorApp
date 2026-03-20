/**
 * @file Versioning Configuration — Constants for Optimistic Concurrency Control
 * @module config/versioning-config
 *
 * 🏢 ENTERPRISE: SPEC-256A — Single source of truth for versioning constants.
 *
 * @see src/types/versioning.ts (types)
 * @see src/lib/firestore/version-check.ts (server logic)
 */

// ============================================
// CONSTANTS
// ============================================

/** Firestore field name for version counter */
export const VERSION_FIELD = '_v' as const;

/** Default version for documents that have never been versioned */
export const DEFAULT_VERSION = 0;

/** HTTP status code for version conflicts */
export const CONFLICT_STATUS = 409;

/** Error code sent in 409 response body */
export const CONFLICT_CODE = 'VERSION_CONFLICT' as const;

/**
 * Collections excluded from versioning (append-only / immutable).
 * These collections never need conflict detection because documents
 * are created once and never updated, or are system-managed.
 */
export const EXCLUDED_COLLECTIONS: ReadonlySet<string> = new Set([
  'audit_log',
  'entity_audit',
  'communications',
  'messages',
  'email_ingestion_queue',
  'ai_chat_history',
  'attendance_qr_tokens',
  'file_audit_log',
  'file_comments',
]);
