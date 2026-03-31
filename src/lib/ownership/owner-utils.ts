/**
 * Owner utilities — SSoT for ownership validation, formatting, and accessors.
 *
 * Pure business logic. No React, no UI, no side effects.
 * Used by: OwnersList (component), SalesActionDialogs, ProjectLandownersTab, etc.
 *
 * @module lib/ownership/owner-utils
 * @enterprise ADR-244 (Multi-Buyer Co-Ownership)
 */

import type { PropertyOwnerEntry } from '@/types/ownership-table';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Floating-point tolerance for 100% validation */
export const PCT_TOLERANCE = 0.01;

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Check if owners array is valid for submission.
 * - At least 1 owner
 * - All have contactId selected
 * - Percentages sum to 100% (single owner auto-valid)
 */
export function isOwnersValid(owners: PropertyOwnerEntry[]): boolean {
  if (owners.length === 0) return false;
  if (owners.some(o => !o.contactId)) return false;
  if (owners.length === 1) return true;
  const total = owners.reduce((sum, o) => sum + o.ownershipPct, 0);
  return Math.abs(total - 100) < PCT_TOLERANCE;
}

/**
 * Check if ownership percentages sum to 100% (or list is empty/single).
 * UI-only — used by OwnersList validation indicator.
 * Does NOT check contactId selection (use isOwnersValid for full check).
 */
export function isPercentageValid(owners: PropertyOwnerEntry[]): boolean {
  if (owners.length <= 1) return true;
  const total = owners.reduce((sum, o) => sum + o.ownershipPct, 0);
  return Math.abs(total - 100) < PCT_TOLERANCE;
}

// ============================================================================
// FORMATTING
// ============================================================================

/**
 * Format owner names for display / backward-compat `buyerName` field.
 * Single owner: "Γιάννης Π."
 * Multiple: "Γιάννης Π. & Μαρία Κ."
 * Empty: null
 */
export function formatOwnerNames(owners: PropertyOwnerEntry[]): string | null {
  if (owners.length === 0) return null;
  return owners.map(o => o.name).join(' & ');
}

// ============================================================================
// ACCESSORS
// ============================================================================

/**
 * Get primary buyer contactId (first owner) for backward-compat `buyerContactId`.
 */
export function getPrimaryBuyerContactId(owners: PropertyOwnerEntry[]): string | null {
  return owners[0]?.contactId ?? null;
}

// ============================================================================
// FLAT ARRAY FOR FIRESTORE QUERIES
// ============================================================================

/**
 * Extract flat array of contactIds from owners — for Firestore `array-contains` queries.
 * Firestore cannot query nested objects inside arrays, so we denormalize to a flat string[].
 *
 * Pattern: Same as `landownerContactIds` in Project type.
 */
export function extractOwnerContactIds(owners: PropertyOwnerEntry[]): string[] {
  return owners.map(o => o.contactId).filter(Boolean);
}

// ============================================================================
// OWNER FIELDS PAYLOAD (SSoT — ADR-244 Phase 3)
// ============================================================================

/**
 * Build the owner fields for Firestore commercial data.
 * SSoT: `owners[]` + `ownerContactIds[]` (flat array for queries).
 *
 * Used in: ReserveDialog PATCH, SellDialog PATCH, appurtenance sync.
 */
export function buildOwnerFields(owners: PropertyOwnerEntry[]): {
  owners: PropertyOwnerEntry[] | null;
  ownerContactIds: string[] | null;
} {
  const hasOwners = owners.length > 0;
  return {
    owners: hasOwners ? owners : null,
    ownerContactIds: hasOwners ? extractOwnerContactIds(owners) : null,
  };
}
