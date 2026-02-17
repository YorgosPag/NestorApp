/**
 * BuildingSpace Shared Types — Centralized type definitions
 * for table columns, card fields, and action handlers
 * used by all building space tabs (Units, Parking, Storage).
 *
 * @module components/building-management/shared/types
 */

import type { ReactNode } from 'react';

// ============================================================================
// TABLE COLUMN DEFINITION
// ============================================================================

/**
 * Generic table column configuration.
 * Each tab defines its own columns array using this interface.
 *
 * @template T — The entity type (Unit, ParkingSpot, StorageUnit)
 */
export interface SpaceColumn<T> {
  /** Unique key for React key prop */
  key: string;
  /** Column header label */
  label: string;
  /** Optional fixed width class (e.g. "w-28") */
  width?: string;
  /** How to render the cell content for a given item */
  render: (item: T) => ReactNode;
  /** Optional: align text right (for actions column) */
  alignRight?: boolean;
}

// ============================================================================
// CARD FIELD DEFINITION
// ============================================================================

/**
 * Generic card field configuration for key-value display.
 * Used inside the <dl> grid of each space card.
 *
 * @template T — The entity type
 */
export interface SpaceCardField<T> {
  /** Field label (displayed as <dt>) */
  label: string;
  /** How to render the field value (displayed as <dd>) */
  render: (item: T) => ReactNode;
}

// ============================================================================
// ACTION HANDLERS
// ============================================================================

/**
 * Shared action handler configuration.
 * All 4 action icons use these callbacks.
 *
 * @template T — The entity type
 */
export interface SpaceActions<T> {
  onView?: (item: T) => void;
  onEdit?: (item: T) => void;
  onUnlink?: (item: T) => void;
  onDelete?: (item: T) => void;
}

/**
 * Loading state for action icons (shows spinner on the active item).
 */
export interface SpaceActionState {
  editingId?: string | null;
  deletingId?: string | null;
  unlinkingId?: string | null;
}
