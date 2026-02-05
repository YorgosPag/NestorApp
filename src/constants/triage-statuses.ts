/**
 * =============================================================================
 * 🏢 ENTERPRISE: Triage Status Constants (Isomorphic)
 * =============================================================================
 *
 * Server-safe constants που μπορούν να χρησιμοποιηθούν:
 * - Client-side (React components)
 * - Server-side (API routes, server actions)
 *
 * Pattern: Google Cloud, AWS, Microsoft Azure - Shared constants
 *
 * @file triage-statuses.ts
 * @created 2026-02-06
 * @enterprise Single Source of Truth
 */

/**
 * 🏢 ENTERPRISE: Triage Status Values
 *
 * Centralized definition για email triage workflow.
 * Used by AI Inbox system για manual review και approval.
 */
export const TRIAGE_STATUSES = {
  PENDING: 'pending',
  REVIEWED: 'reviewed',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

/**
 * 🏢 ENTERPRISE: Triage Status Type
 *
 * Type-safe union από τα available status values.
 */
export type TriageStatus = typeof TRIAGE_STATUSES[keyof typeof TRIAGE_STATUSES];

/**
 * 🏢 ENTERPRISE: Triage Status Array
 *
 * Array of all valid triage status values.
 * Used for iteration, validation, and Firestore queries.
 */
export const TRIAGE_STATUS_VALUES: TriageStatus[] = Object.values(TRIAGE_STATUSES);
