/**
 * UNIVERSAL SELECTION TYPES
 *
 * 🏢 ENTERPRISE (2026-01-25): Centralized type definitions for universal entity selection
 *
 * This module defines types that allow the Selection System to handle ALL entity types:
 * - DXF entities (lines, circles, polylines, etc.)
 * - Overlay regions
 * - Color layers
 * - Measurements (future)
 * - Annotations (future)
 *
 * @see ADR-030 in centralized_systems_TABLE.md
 */

/**
 * Entity types supported by the Universal Selection System
 * Extensible for future entity types
 */
export type SelectableEntityType =
  | 'dxf-entity'      // DXF geometric entities (lines, circles, polylines, etc.)
  | 'overlay'         // Overlay regions/polygons
  | 'color-layer'     // Color layers from canvas
  | 'region'          // Regions (alias for overlay for backward compatibility)
  | 'measurement'     // Measurements (future)
  | 'annotation';     // Annotations (future)

/**
 * Base interface for ALL selectable entities
 *
 * This minimal interface ensures any entity type can be selected
 * while keeping implementation flexible for each entity type.
 *
 * @property id - Unique identifier for the entity
 * @property type - The type of entity (for multi-type filtering)
 * @property layer - Optional layer the entity belongs to
 * @property visible - Optional visibility state
 * @property locked - Optional lock state (locked entities cannot be selected)
 */
export interface Selectable {
  readonly id: string;
  readonly type: SelectableEntityType;
  readonly layer?: string;
  readonly visible?: boolean;
  readonly locked?: boolean;
}

/**
 * Selection entry stored in the universal selection state
 *
 * Includes timestamp for ordering (first selected, last selected, etc.)
 * This enables features like:
 * - Selection order for batch operations
 * - "Select Similar" based on first selected
 * - Undo/Redo of selection changes
 */
export interface SelectionEntry {
  /** Unique identifier of the selected entity */
  readonly id: string;
  /** Type of the selected entity (for filtering and type-specific operations) */
  readonly type: SelectableEntityType;
  /** Timestamp when entity was added to selection (for ordering) */
  readonly timestamp: number;
}

/**
 * Universal selection state that replaces type-specific selection arrays
 *
 * Uses Map<string, SelectionEntry> for O(1) lookup performance
 * while maintaining ordering via timestamps
 */
export interface UniversalSelectionState {
  /** All selected entities indexed by ID for O(1) lookup */
  readonly selectedEntities: Map<string, SelectionEntry>;

  /** Primary selected entity ID (for properties panel, first selected, etc.) */
  readonly primarySelectedId: string | null;
}

/**
 * Default empty universal selection state
 */
export const DEFAULT_UNIVERSAL_SELECTION_STATE: UniversalSelectionState = {
  selectedEntities: new Map(),
  primarySelectedId: null,
};

/**
 * Helper type for selection action payloads
 */
export interface SelectionPayload {
  id: string;
  type: SelectableEntityType;
}

/**
 * Helper to create a SelectionEntry from a payload
 */
export function createSelectionEntry(payload: SelectionPayload): SelectionEntry {
  return {
    id: payload.id,
    type: payload.type,
    timestamp: Date.now(),
  };
}

/**
 * Helper to check if an entity type matches a filter
 * Supports 'region' as alias for 'overlay' for backward compatibility
 */
export function matchesEntityType(
  entityType: SelectableEntityType,
  filterType: SelectableEntityType
): boolean {
  if (entityType === filterType) return true;
  // Handle region/overlay alias
  if ((entityType === 'region' && filterType === 'overlay') ||
      (entityType === 'overlay' && filterType === 'region')) {
    return true;
  }
  return false;
}
