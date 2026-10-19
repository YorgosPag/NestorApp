/**
 * Owner utilities — SSoT for ownership validation, formatting, and accessors.
 *
 * Pure business logic. No React, no UI, no side effects.
 * Used by: OwnersList (component), SalesActionDialogs, ProjectLandownersTab, etc.
 *
 * @module lib/ownership/owner-utils
 * @enterprise ADR-244 (Multi-Buyer Co-Ownership)
 */

import { isFiniteNumber, isRecord, trimmedStringOrNull } from '@/lib/type-guards';
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
export function isOwnersValid(owners: readonly PropertyOwnerEntry[]): boolean {
  if (owners.length === 0) return false;
  if (owners.some(o => !o.contactId)) return false;
  if (owners.length === 1) return true;
  const total = owners.reduce((sum, o) => sum + o.ownershipPct, 0);
  return Math.abs(total - 100) < PCT_TOLERANCE;
}

/**
 * Check if an owners list is valid for submission **when empty is a legitimate state**.
 *
 * Counterpart of `isOwnersValid` for domains that render `OwnersList` with
 * `allowEmpty` (e.g. project landowners: a project may legitimately have none).
 * Empty ⇒ valid (there is nothing to validate); otherwise the full
 * `isOwnersValid` rules apply — no rule is restated here.
 *
 * Use `isOwnersValid` when at least one owner is mandatory (sale/reservation:
 * a transaction without a buyer is meaningless).
 */
export function isOptionalOwnersValid(owners: readonly PropertyOwnerEntry[]): boolean {
  return owners.length === 0 || isOwnersValid(owners);
}

/**
 * Check if ownership percentages sum to 100% (or list is empty/single).
 * UI-only — used by OwnersList validation indicator.
 * Does NOT check contactId selection (use isOwnersValid for full check).
 */
export function isPercentageValid(owners: readonly PropertyOwnerEntry[]): boolean {
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
export function formatOwnerNames(owners: readonly Pick<PropertyOwnerEntry, 'name'>[]): string | null {
  if (owners.length === 0) return null;
  return owners.map(o => o.name).join(' & ');
}

// ============================================================================
// ACCESSORS
// ============================================================================

/**
 * Get primary buyer contactId (first owner) for backward-compat `buyerContactId`.
 */
export function getPrimaryBuyerContactId(owners: readonly PropertyOwnerEntry[]): string | null {
  return owners[0]?.contactId ?? null;
}

// ============================================================================
// STORED (RAW) OWNERS — the ONE reader of `commercial.owners` as it lies in Firestore
// ============================================================================

/** A stored owner as far as it can be trusted: `ownershipPct` `null` = not a finite number (never guessed). */
export interface StoredOwnerShare {
  readonly contactId: string;
  readonly ownershipPct: number | null;
}

/**
 * Parse raw `commercial.owners` (untyped Firestore data) — entries without a contact are dropped, order is kept.
 * ADR-915 §26: the registry reads shares (ΑΚ 789 majority) and the conveyance subject reads contacts from HERE.
 */
export function readStoredOwners(rawOwners: unknown): readonly StoredOwnerShare[] {
  if (!Array.isArray(rawOwners)) return [];
  return rawOwners.flatMap((raw): StoredOwnerShare[] => {
    if (!isRecord(raw)) return [];
    const contactId = trimmedStringOrNull(raw.contactId);
    if (contactId === null) return [];
    return [{ contactId, ownershipPct: isFiniteNumber(raw.ownershipPct) ? raw.ownershipPct : null }];
  });
}

// ============================================================================
// STORED BUYERS — who bought a stored property (customers tabs read HERE)
// ============================================================================

/** Stored property is sold — canonical `commercialStatus`, or the legacy `status` of older docs. */
export function isStoredPropertySold(property: Readonly<Record<string, unknown>>): boolean {
  return property.commercialStatus === 'sold' || property.status === 'sold';
}

/**
 * Buyer contactIds of a stored property, unique, in owner order.
 * Canonical: `commercial.owners[]` (ADR-244) minus landowners (antiparochi ≠ customer).
 * Fallback: legacy `soldTo` — ONLY when the doc has no stored owners at all.
 */
export function readStoredBuyerContactIds(property: Readonly<Record<string, unknown>>): readonly string[] {
  const commercial = isRecord(property.commercial) ? property.commercial : null;
  const rawOwners = Array.isArray(commercial?.owners) ? commercial.owners : [];
  if (rawOwners.length > 0) {
    const buyers = rawOwners.filter(raw => isRecord(raw) && raw.role !== 'landowner');
    return [...new Set(readStoredOwners(buyers).map(o => o.contactId))];
  }
  const legacy = trimmedStringOrNull(property.soldTo);
  return legacy === null ? [] : [legacy];
}

/** Sold properties count + properties-per-buyer, for the project/building customers endpoints. */
export function countSoldPropertiesPerBuyer(properties: readonly Readonly<Record<string, unknown>>[]): {
  readonly soldPropertiesCount: number;
  readonly propertiesPerBuyer: Readonly<Record<string, number>>;
} {
  const propertiesPerBuyer: Record<string, number> = {};
  let soldPropertiesCount = 0;
  for (const property of properties) {
    if (!isStoredPropertySold(property)) continue;
    const buyerIds = readStoredBuyerContactIds(property);
    if (buyerIds.length === 0) continue;
    soldPropertiesCount += 1;
    for (const id of buyerIds) propertiesPerBuyer[id] = (propertiesPerBuyer[id] ?? 0) + 1;
  }
  return { soldPropertiesCount, propertiesPerBuyer };
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
export function extractOwnerContactIds(owners: readonly PropertyOwnerEntry[]): string[] {
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
