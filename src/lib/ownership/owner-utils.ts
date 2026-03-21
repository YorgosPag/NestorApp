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
// DUAL-WRITE PAYLOAD
// ============================================================================

/**
 * Build the dual-write fields for Firestore commercial data.
 * SSoT for backward-compat `buyerContactId` + `buyerName` + new `owners[]`.
 *
 * Used in: ReserveDialog PATCH, SellDialog PATCH, appurtenance sync.
 */
export function buildOwnerFields(owners: PropertyOwnerEntry[]): {
  buyerContactId: string | null;
  buyerName: string | null;
  owners: PropertyOwnerEntry[] | null;
} {
  return {
    buyerContactId: getPrimaryBuyerContactId(owners),
    buyerName: formatOwnerNames(owners),
    owners: owners.length > 0 ? owners : null,
  };
}
