/**
 * =============================================================================
 * Multi-Level Unit Service — ADR-236
 * =============================================================================
 *
 * Utility functions for multi-level property management.
 * Converts floor selections to UnitLevel arrays, derives backward-compatible
 * fields, and validates multi-level floor constraints.
 *
 * @module services/multi-level
 * @since ADR-236 — Multi-Level Property Management
 */

import type { UnitLevel } from '@/types/unit';

// =============================================================================
// TYPES
// =============================================================================

/** Floor option from Firestore (used by FloorSelectField and FloorMultiSelectField) */
export interface FloorOption {
  /** Firestore floor document ID */
  id: string;
  /** Floor number */
  number: number;
  /** Human-readable name */
  name: string;
}

/** Derived fields for backward compatibility */
export interface DerivedMultiLevelFields {
  /** Primary floor number (entrance level) */
  floor: number;
  /** Primary floor document ID */
  floorId: string;
  /** Whether unit is multi-level */
  isMultiLevel: boolean;
  /** Sorted UnitLevel array */
  levels: UnitLevel[];
}

// =============================================================================
// BUILD LEVELS FROM SELECTION
// =============================================================================

/**
 * Convert selected floor options into a UnitLevel array.
 *
 * @param selectedFloors — floor options selected by the user
 * @param primaryFloorId — the floor ID marked as primary (entrance)
 * @returns sorted UnitLevel array with exactly one isPrimary=true
 */
export function buildLevelsFromSelection(
  selectedFloors: FloorOption[],
  primaryFloorId: string
): UnitLevel[] {
  return selectedFloors
    .map((floor) => ({
      floorId: floor.id,
      floorNumber: floor.number,
      name: floor.name,
      isPrimary: floor.id === primaryFloorId,
    }))
    .sort((a, b) => a.floorNumber - b.floorNumber);
}

// =============================================================================
// DERIVE BACKWARD-COMPATIBLE FIELDS
// =============================================================================

/**
 * Auto-derive `floor`, `floorId`, `isMultiLevel`, and `levels` from a UnitLevel array.
 * The primary level determines the backward-compatible `floor`/`floorId` fields.
 *
 * @param levels — UnitLevel array (must have exactly one primary)
 * @returns derived fields ready for Firestore persistence
 */
export function deriveMultiLevelFields(levels: UnitLevel[]): DerivedMultiLevelFields {
  const primary = levels.find((l) => l.isPrimary) ?? levels[0];

  return {
    floor: primary?.floorNumber ?? 0,
    floorId: primary?.floorId ?? '',
    isMultiLevel: levels.length >= 2,
    levels: [...levels].sort((a, b) => a.floorNumber - b.floorNumber),
  };
}

// =============================================================================
// VALIDATION
// =============================================================================

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate multi-level floor selection.
 *
 * Rules:
 * - All floors must belong to the same building (caller responsibility — floors come from same query)
 * - Exactly one floor must be marked as primary
 * - At least 2 floors required for multi-level
 *
 * @param levels — candidate UnitLevel array
 */
export function validateMultiLevelFloors(levels: UnitLevel[]): ValidationResult {
  if (levels.length < 2) {
    return { valid: false, error: 'Multi-level units require at least 2 floors' };
  }

  const primaryCount = levels.filter((l) => l.isPrimary).length;
  if (primaryCount === 0) {
    return { valid: false, error: 'Exactly one floor must be marked as primary' };
  }
  if (primaryCount > 1) {
    return { valid: false, error: 'Only one floor can be primary' };
  }

  // Check for duplicate floorIds
  const ids = new Set(levels.map((l) => l.floorId));
  if (ids.size !== levels.length) {
    return { valid: false, error: 'Duplicate floors are not allowed' };
  }

  return { valid: true };
}
