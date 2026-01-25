'use client';

import React, { createContext, useContext, useMemo } from 'react';
import { useSelectionSystemState, type SelectionContextType } from './useSelectionSystemState';
import type { UniversalSelectionActions } from './config';
import type { SelectableEntityType, SelectionEntry, SelectionPayload } from './types';

// Create context
export const SelectionContext = createContext<SelectionContextType | null>(null);

// Provider component
export function SelectionSystem({ children }: { children: React.ReactNode }) {
  const { contextValue } = useSelectionSystemState();

  return (
    <SelectionContext.Provider value={contextValue}>
      {children}
    </SelectionContext.Provider>
  );
}

// Hook for consuming the selection context
export function useSelection(): SelectionContextType {
  const context = useContext(SelectionContext);
  if (!context) {
    throw new Error('useSelection must be used within a SelectionSystem');
  }
  return context;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🏢 ENTERPRISE (2026-01-25): Universal Selection Hook
// This is the PRIMARY selection API going forward
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Universal Selection Hook
 *
 * Provides a clean, type-safe API for selecting ANY entity type:
 * - DXF entities, overlays, color layers, measurements, annotations
 *
 * Usage:
 * ```typescript
 * const selection = useUniversalSelection();
 *
 * // Select a single overlay
 * selection.select('overlay-123', 'overlay');
 *
 * // Select multiple entities
 * selection.selectMultiple([
 *   { id: 'overlay-1', type: 'overlay' },
 *   { id: 'entity-2', type: 'dxf-entity' }
 * ]);
 *
 * // Check if selected
 * if (selection.isSelected('overlay-123')) { ... }
 *
 * // Get all selected overlay IDs
 * const overlayIds = selection.getIdsByType('overlay');
 * ```
 */
export interface UniversalSelectionHook {
  // ═══════════════════════════════════════════════════════════════════════════
  // SELECTION ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Select a single entity (replaces current selection) */
  select: (id: string, type: SelectableEntityType) => void;

  /** Select multiple entities (replaces current selection) */
  selectMultiple: (payloads: SelectionPayload[]) => void;

  /** Add an entity to current selection */
  add: (id: string, type: SelectableEntityType) => void;

  /** Add multiple entities to current selection */
  addMultiple: (payloads: SelectionPayload[]) => void;

  /** Remove an entity from selection */
  deselect: (id: string) => void;

  /** Toggle entity selection */
  toggle: (id: string, type: SelectableEntityType) => void;

  /** Clear all selections */
  clearAll: () => void;

  /** Clear selections of a specific type only */
  clearByType: (type: SelectableEntityType) => void;

  // ═══════════════════════════════════════════════════════════════════════════
  // QUERY METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Check if an entity is selected */
  isSelected: (id: string) => boolean;

  /** Get all selected entries */
  getAll: () => SelectionEntry[];

  /** Get selected entries of a specific type */
  getByType: (type: SelectableEntityType) => SelectionEntry[];

  /** Get all selected IDs */
  getIds: () => string[];

  /** Get selected IDs of a specific type */
  getIdsByType: (type: SelectableEntityType) => string[];

  /** Get total selection count */
  count: () => number;

  /** Get selection count for a specific type */
  countByType: (type: SelectableEntityType) => number;

  /** Get the primary selected ID (first selected or most recently selected) */
  getPrimaryId: () => string | null;

  // ═══════════════════════════════════════════════════════════════════════════
  // FULL CONTEXT ACCESS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Full context for advanced use cases */
  context: SelectionContextType;
}

export function useUniversalSelection(): UniversalSelectionHook {
  const context = useContext(SelectionContext);
  if (!context) {
    throw new Error('useUniversalSelection must be used within a SelectionSystem');
  }

  return useMemo((): UniversalSelectionHook => ({
    // Selection Actions - convenience wrappers
    select: (id: string, type: SelectableEntityType) =>
      context.selectEntity({ id, type }),

    selectMultiple: (payloads: SelectionPayload[]) =>
      context.selectEntities(payloads),

    add: (id: string, type: SelectableEntityType) =>
      context.addEntity({ id, type }),

    addMultiple: (payloads: SelectionPayload[]) =>
      context.addEntities(payloads),

    deselect: (id: string) =>
      context.deselectEntity(id),

    toggle: (id: string, type: SelectableEntityType) =>
      context.toggleEntity({ id, type }),

    clearAll: () =>
      context.clearAllSelections(),

    clearByType: (type: SelectableEntityType) =>
      context.clearByType(type),

    // Query Methods
    isSelected: (id: string) =>
      context.isEntitySelected(id),

    getAll: () =>
      context.getSelectedEntries(),

    getByType: (type: SelectableEntityType) =>
      context.getSelectedByType(type),

    getIds: () =>
      context.getSelectedIds(),

    getIdsByType: (type: SelectableEntityType) =>
      context.getSelectedIdsByType(type),

    count: () =>
      context.getUniversalSelectionCount(),

    countByType: (type: SelectableEntityType) =>
      context.getSelectionCountByType(type),

    getPrimaryId: () =>
      context.primarySelectedId,

    // Full context access
    context,
  }), [context]);
}

// ═══════════════════════════════════════════════════════════════════════════════
// BACKWARD COMPATIBILITY HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Backward compatible hook for overlay selection
 * @deprecated Use useUniversalSelection instead
 */
export function useOverlaySelection() {
  const universal = useUniversalSelection();

  return useMemo(() => ({
    /** Select overlay(s) */
    select: (ids: string | string[]) => {
      const idArray = Array.isArray(ids) ? ids : [ids];
      universal.selectMultiple(idArray.map(id => ({ id, type: 'overlay' as const })));
    },

    /** Add overlay to selection */
    add: (id: string) => universal.add(id, 'overlay'),

    /** Remove overlay from selection */
    remove: (id: string) => universal.deselect(id),

    /** Toggle overlay selection */
    toggle: (id: string) => universal.toggle(id, 'overlay'),

    /** Clear overlay selection */
    clear: () => universal.clearByType('overlay'),

    /** Check if overlay is selected */
    isSelected: (id: string) => universal.isSelected(id),

    /** Get all selected overlay IDs */
    getSelectedIds: () => universal.getIdsByType('overlay'),

    /** Get count of selected overlays */
    count: () => universal.countByType('overlay'),
  }), [universal]);
}

// Backward compatibility exports
export { useSelection as useSelectionContext };
export type { SelectionContextType };
export type { SelectableEntityType, SelectionEntry, SelectionPayload } from './types';