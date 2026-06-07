/**
 * =============================================================================
 * Multi-Level Unit Service — ADR-236
 * =============================================================================
 *
 * Utility functions for multi-level property management.
 * Converts floor selections to PropertyLevel arrays, derives backward-compatible
 * fields, and validates multi-level floor constraints.
 *
 * @module services/multi-level
 * @since ADR-236 — Multi-Level Property Management
 */

import type { PropertyLevel, LevelData } from '@/types/property';
import type { OrientationType } from '@/constants/property-features-enterprise';

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
  /** Sorted PropertyLevel array */
  levels: PropertyLevel[];
}

// =============================================================================
// BUILD LEVELS FROM SELECTION
// =============================================================================

/**
 * Convert selected floor options into a PropertyLevel array.
 *
 * @param selectedFloors — floor options selected by the user
 * @param primaryFloorId — the floor ID marked as primary (entrance)
 * @returns sorted PropertyLevel array with exactly one isPrimary=true
 */
export function buildLevelsFromSelection(
  selectedFloors: FloorOption[],
  primaryFloorId: string
): PropertyLevel[] {
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
 * Auto-derive `floor`, `floorId`, `isMultiLevel`, and `levels` from a PropertyLevel array.
 * The primary level determines the backward-compatible `floor`/`floorId` fields.
 *
 * @param levels — PropertyLevel array (must have exactly one primary)
 * @returns derived fields ready for Firestore persistence
 */
export function deriveMultiLevelFields(levels: PropertyLevel[]): DerivedMultiLevelFields {
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
 * @param levels — candidate PropertyLevel array
 */

// =============================================================================
// AGGREGATE LEVEL DATA (ADR-236 Phase 2)
// =============================================================================

/** Aggregated totals computed from per-level data */
export interface AggregatedPropertyData {
  areas: {
    gross: number;
    net: number;
    balcony: number;
    terrace: number;
    garden: number;
  };
  layout: {
    bedrooms: number;
    bathrooms: number;
    wc: number;
  };
  orientations: OrientationType[];
}

/**
 * Aggregate per-level data into unit-level totals.
 *
 * - **Areas**: SUM each measurement across all levels
 * - **Layout**: SUM bedrooms, bathrooms, wc across all levels
 * - **Orientations**: UNION (unique values from all levels)
 * - **Finishes**: NOT aggregated — each level keeps its own
 *
 * Pure function, safe for both client-side and server-side usage.
 *
 * @param levelData — Record<floorId, LevelData> from the unit document
 * @returns aggregated totals ready to be merged into top-level unit fields
 */
export function aggregateLevelData(levelData: Record<string, LevelData>): AggregatedPropertyData {
  const entries = Object.values(levelData);

  const areas = {
    gross: 0,
    net: 0,
    balcony: 0,
    terrace: 0,
    garden: 0,
  };

  const layout = {
    bedrooms: 0,
    bathrooms: 0,
    wc: 0,
  };

  const orientationSet = new Set<OrientationType>();

  for (const level of entries) {
    if (level.areas) {
      areas.gross += level.areas.gross ?? 0;
      areas.net += level.areas.net ?? 0;
      areas.balcony += level.areas.balcony ?? 0;
      areas.terrace += level.areas.terrace ?? 0;
      areas.garden += level.areas.garden ?? 0;
    }

    if (level.layout) {
      layout.bedrooms += level.layout.bedrooms ?? 0;
      layout.bathrooms += level.layout.bathrooms ?? 0;
      layout.wc += level.layout.wc ?? 0;
    }

    if (level.orientations) {
      for (const o of level.orientations) {
        orientationSet.add(o);
      }
    }
  }

  return {
    areas,
    layout,
    orientations: Array.from(orientationSet),
  };
}

// =============================================================================
// LEVEL DATA SEED (ADR-236 Phase 2 — Revit-grade per-level initialization)
// =============================================================================

/**
 * Canonical empty per-level data schema.
 *
 * Revit pattern: a newly-created level card is a **fully-formed object with
 * zeroed measurements**, never an empty `{}`. This guarantees:
 *   - `aggregateLevelData` iterates real numeric fields (no `undefined` math)
 *   - the per-level UI renders all inputs from creation (no "ghost" empty level)
 *   - search / BOQ / reports read a stable shape
 *
 * Factory (not a shared const) so each level gets its own object instance —
 * no accidental cross-level mutation aliasing.
 */
export function buildEmptyLevelData(): LevelData {
  return {
    areas: { gross: 0, net: 0, balcony: 0, terrace: 0, garden: 0 },
    layout: { bedrooms: 0, bathrooms: 0, wc: 0 },
    orientations: [],
  };
}

/**
 * Reconcile `levelData` against the declared `levels` array — the SSoT seed.
 *
 * Rules (idempotent, belt-and-suspenders):
 *  - Every `level.floorId` MUST have an entry. Missing → seed {@link buildEmptyLevelData}.
 *  - Existing non-empty entries are PRESERVED untouched (no data loss).
 *  - Existing empty `{}` entries are replaced with the full empty schema.
 *  - Orphan keys (floorId no longer in `levels`) are DROPPED (no stale data).
 *
 * Pure function — safe for client (auto level creation) and server (write
 * normalizer) so both produce identical shapes.
 *
 * @param levels — declared PropertyLevel array
 * @param existing — current per-level data map (may be partial / empty)
 * @returns complete `Record<floorId, LevelData>` with one entry per level
 */
export function buildSeededLevelData(
  levels: readonly PropertyLevel[],
  existing?: Record<string, LevelData> | null,
): Record<string, LevelData> {
  const source = existing ?? {};
  const seeded: Record<string, LevelData> = {};

  for (const level of levels) {
    const current = source[level.floorId];
    const hasContent =
      current && typeof current === 'object' && Object.keys(current).length > 0;
    seeded[level.floorId] = hasContent ? current : buildEmptyLevelData();
  }

  return seeded;
}
