'use client';

import React, { createContext, useContext, useMemo, useSyncExternalStore } from 'react';
import { useSelectionSystemState, type SelectionContextType } from './useSelectionSystemState';
import { SelectedEntitiesStore, subscribeSelection, getSelectionVersion } from './SelectedEntitiesStore';
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
  // DXF CANVAS SEMANTIC ACTIONS (AutoCAD-behavior rules live here, not in UI)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * AutoCAD PICKADD=1 entity click handler.
   * shiftKey=false + existing selection → ADD; empty → single select (clears overlays).
   * shiftKey=true → toggle entity in/out of selection.
   */
  handleEntityClick: (entityId: string, opts: { shiftKey: boolean }) => void;

  /**
   * Apply marquee/lasso result to selection.
   * subtract=false → additive (PICKADD=1); subtract=true → remove matched ids.
   */
  handleMarqueeResult: (layerIds: string[], entityIds: string[], opts: { subtract: boolean }) => void;

  /**
   * Replace the entire dxf-entity selection (e.g. Ctrl+A, select-by-layer).
   * Preserves overlay selections.
   */
  replaceEntitySelection: (entityIds: string[]) => void;

  /**
   * Select a single overlay, replacing any existing overlay selection.
   * Pass null to clear overlay selection only (e.g. deselect on backdrop click).
   */
  handleOverlaySelect: (overlayId: string | null) => void;

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

  /** Convenience: get selected dxf-entity IDs */
  getSelectedEntityIds: () => string[];

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

  // ADR-532: the selection set lives in SelectedEntitiesStore now, not context.
  // Subscribe to the store version so consumers of this compat hook re-render on
  // selection change exactly as before (number snapshot = safe). Keying the memo
  // on `version` reproduces the old "new hook object per change" contract.
  // NOTE: Stage B migrates the 4 orchestrators OFF this hook to imperative store
  // reads + leaf subscriptions — THAT is what kills the re-render cascade.
  const version = useSyncExternalStore(subscribeSelection, getSelectionVersion, getSelectionVersion);

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

    // DXF canvas semantic actions — AutoCAD behavior rules live here
    handleEntityClick: (entityId: string, opts: { shiftKey: boolean }) => {
      if (opts.shiftKey) {
        context.toggleEntity({ id: entityId, type: 'dxf-entity' });
      } else if (context.getSelectionCountByType('dxf-entity') > 0) {
        // PICKADD=1: existing selection → add without clearing
        if (!context.isEntitySelected(entityId)) {
          context.addEntity({ id: entityId, type: 'dxf-entity' });
        }
      } else {
        // No prior selection → single select (clears all including overlays)
        context.selectEntity({ id: entityId, type: 'dxf-entity' });
      }
    },

    handleMarqueeResult: (layerIds: string[], entityIds: string[], opts: { subtract: boolean }) => {
      if (opts.subtract) {
        entityIds.forEach(id => context.deselectEntity(id));
        layerIds.forEach(id => context.deselectEntity(id));
      } else {
        if (layerIds.length > 0) {
          context.addEntities(layerIds.map(id => ({ id, type: 'overlay' as const })));
        }
        if (entityIds.length > 0) {
          context.addEntities(entityIds.map(id => ({ id, type: 'dxf-entity' as const })));
        }
      }
    },

    // ADR-532: atomic replace with skip-if-unchanged (no legacy region effect) —
    // avoids the old clearByType+addEntities double-notify and prevents the 3D
    // bridge / layer-select round-trips from looping on identical sets.
    replaceEntitySelection: (entityIds: string[]) => {
      SelectedEntitiesStore.replaceEntitySelection(entityIds);
    },

    handleOverlaySelect: (overlayId: string | null) => {
      if (overlayId) {
        context.selectEntity({ id: overlayId, type: 'overlay' });
      } else {
        context.clearByType('overlay');
      }
    },

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

    getSelectedEntityIds: () =>
      context.getSelectedIdsByType('dxf-entity'),

    count: () =>
      context.getUniversalSelectionCount(),

    countByType: (type: SelectableEntityType) =>
      context.getSelectionCountByType(type),

    getPrimaryId: () =>
      context.primarySelectedId,

    // Full context access
    context,
  }), [context, version]);
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