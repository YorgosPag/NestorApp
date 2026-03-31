/**
 * 🛡️ PROPERTY FIELD LOCKING — Shared Utility (ADR-249 P0-2)
 *
 * Validates that locked fields on sold/rented/reserved properties cannot be modified.
 * Extracted from units/[id]/route.ts for reuse across multiple endpoints.
 *
 * Legal requirement: After sale/reservation, critical fields (cadastre, tax office,
 * contracts) must remain immutable.
 *
 * @module lib/firestore/property-field-locking
 * @enterprise ADR-249 SPEC-249A — Critical Server Guards
 */

import 'server-only';

import { ApiError } from '@/lib/api/ApiErrorHandler';

// ============================================================================
// LOCKED FIELD DEFINITIONS
// ============================================================================

/**
 * Fields locked when a property is sold or rented.
 * These fields are referenced in contracts, cadastre, and tax office documents.
 */
const SOLD_LOCKED_FIELDS = [
  'code', 'type', 'name', 'areas', 'layout', 'floor', 'floorId',
  'commercialStatus', 'buildingId', 'linkedSpaces',
  'orientations', 'condition', 'energy', 'systemsOverride',
  'finishes', 'interiorFeatures', 'securityFeatures',
  'levels', 'isMultiLevel', 'levelData',
] as const;

/**
 * Fields locked when a property is reserved.
 * Subset of sold-locked fields — only identity fields are immutable.
 */
const RESERVED_LOCKED_FIELDS = ['code', 'type', 'name'] as const;

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Validates that no locked fields are being modified on a property with a given commercialStatus.
 *
 * @param commercialStatus - Current commercialStatus of the property document
 * @param updateKeys - Keys present in the update payload (Object.keys(body))
 * @throws ApiError(403) if any locked field is present in updateKeys
 */
export function validatePropertyFieldLocking(
  commercialStatus: string | null | undefined,
  updateKeys: readonly string[]
): void {
  if (!commercialStatus) return;

  if (commercialStatus === 'sold' || commercialStatus === 'rented') {
    const attempted = SOLD_LOCKED_FIELDS.filter(f => updateKeys.includes(f));
    if (attempted.length > 0) {
      throw new ApiError(
        403,
        `Cannot modify locked fields on a ${commercialStatus} property: ${attempted.join(', ')}`
      );
    }
  } else if (commercialStatus === 'reserved') {
    const attempted = RESERVED_LOCKED_FIELDS.filter(f => updateKeys.includes(f));
    if (attempted.length > 0) {
      throw new ApiError(
        403,
        `Cannot modify locked fields on a reserved property: ${attempted.join(', ')}`
      );
    }
  }
}
