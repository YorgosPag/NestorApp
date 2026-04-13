'use client';

/**
 * ADR-203: Centralized Entity Page State Hook
 *
 * Generic hook that encapsulates the common page-state pattern shared by
 * Projects, Buildings, Parking, and Storages pages.
 *
 * Centralizes:
 * - URL parameter handling (contextual navigation / deep-links)
 * - Selected item state with useTransition (INP optimization)
 * - View mode state (list | grid | byType | byStatus)
 * - Dashboard toggle
 * - Filter state management
 * - Auto-select from URL parameter
 * - Data sync when source array refreshes
 * - Filtered items via caller-supplied filter function
 */

import {
  useState,
  useMemo,
  useEffect,
  useTransition,
  useCallback,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { useSearchParams } from 'next/navigation';
import { createModuleLogger } from '@/lib/telemetry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimum constraint for any entity managed by this hook */
export interface IdentifiableEntity {
  id: string;
}

export type ViewMode = 'list' | 'grid' | 'byType' | 'byStatus';

/** Per-entity configuration that drives the generic hook */
export interface EntityPageStateConfig<T extends IdentifiableEntity, F> {
  /** Name of the URL search-param that carries the entity id (e.g. 'projectId') */
  urlParamName: string;

  /** Logger module name (e.g. 'useProjectsPageState') */
  loggerName: string;

  /** Default filter state */
  defaultFilters: F;

  /**
   * Pure function that filters the full list according to the current filters.
   * Receives the full items array + current filter state.
   */
  filterFn: (items: T[], filters: F) => T[];

  /**
   * Optional: extra URL params to extract and expose (e.g. 'tab' for projects).
   * Values are returned in `extraParams` record.
   */
  extraUrlParams?: string[];

  /**
   * Optional: fields to compare when detecting data-sync changes.
   * If omitted, a referential-equality check on the found item is used.
   */
  syncCompareFields?: (keyof T)[];

  /**
   * Optional: auto-select the first item when no URL-selected item exists.
   * Defaults to true to preserve the existing page behavior.
   */
  autoSelectFirstItem?: boolean;
}

/** The return type of useEntityPageState */
export interface EntityPageStateReturn<T extends IdentifiableEntity, F> {
  selectedItem: T | null;
  setSelectedItem: (item: T | null) => void;
  viewMode: ViewMode;
  setViewMode: Dispatch<SetStateAction<ViewMode>>;
  showDashboard: boolean;
  setShowDashboard: Dispatch<SetStateAction<boolean>>;
  filteredItems: T[];
  filters: F;
  setFilters: Dispatch<SetStateAction<F>>;
  /** Extra URL params requested via config.extraUrlParams */
  extraParams: Record<string, string | null>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useEntityPageState<T extends IdentifiableEntity, F>(
  items: T[],
  config: EntityPageStateConfig<T, F>,
): EntityPageStateReturn<T, F> {
  const {
    urlParamName,
    loggerName,
    defaultFilters,
    filterFn,
    extraUrlParams = [],
    syncCompareFields,
    autoSelectFirstItem = true,
  } = config;

  const logger = createModuleLogger(loggerName);

  // ── URL parameters ──────────────────────────────────────────────────
  const searchParams = useSearchParams();
  const entityIdFromUrl = searchParams.get(urlParamName);

  const extraParams = useMemo(() => {
    const result: Record<string, string | null> = {};
    for (const param of extraUrlParams) {
      result[param] = searchParams.get(param);
    }
    return result;
  }, [searchParams, extraUrlParams]);

  // ── Core state ──────────────────────────────────────────────────────
  const [selectedItem, setSelectedItemRaw] = useState<T | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [showDashboard, setShowDashboard] = useState(false);
  const [filters, setFilters] = useState<F>(defaultFilters);

  // INP optimization: defer heavy detail-panel re-render (from buildings pattern)
  const [, startTransition] = useTransition();
  const setSelectedItem = useCallback(
    (item: T | null) => {
      startTransition(() => {
        setSelectedItemRaw(item);
      });
    },
    [startTransition],
  );

  // ── Auto-select from URL parameter ─────────────────────────────────
  useEffect(() => {
    if (!items.length) return;

    if (entityIdFromUrl) {
      const found = items.find((item) => item.id === entityIdFromUrl);
      if (found) {
        logger.info('Auto-selecting entity from URL', { entityId: found.id });
        setSelectedItemRaw(found);
        return;
      }
    }

    // Default: select first item if nothing selected
    if (autoSelectFirstItem && !selectedItem && items.length > 0) {
      setSelectedItemRaw(items[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, entityIdFromUrl, autoSelectFirstItem]);

  // ── Sync selected item with refreshed data ─────────────────────────
  useEffect(() => {
    if (!selectedItem || !items.length) return;

    const updated = items.find((item) => item.id === selectedItem.id);
    if (!updated) return;

    if (syncCompareFields) {
      const hasChanged = syncCompareFields.some(
        (field) => updated[field] !== selectedItem[field],
      );
      if (hasChanged) {
        logger.info('Syncing selected item with updated data', { entityId: updated.id });
        setSelectedItemRaw(updated);
      }
    } else {
      // Referential check — always sync to latest reference
      if (updated !== selectedItem) {
        setSelectedItemRaw(updated);
      }
    }
    // selectedItem?.id is included so the sync fires when the selected ID
    // changes (e.g. after building creation replaces '__new__' with the real ID
    // via startTransition — by the time the transition commits, items already
    // has the full document from onSnapshot, but [items] dep alone won't
    // re-trigger since items didn't change in that render cycle).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, selectedItem?.id]);

  // ── Filtered items ─────────────────────────────────────────────────
  const filteredItems = useMemo(
    () => filterFn(items, filters),
    [items, filters, filterFn],
  );

  return {
    selectedItem,
    setSelectedItem,
    viewMode,
    setViewMode,
    showDashboard,
    setShowDashboard,
    filteredItems,
    filters,
    setFilters,
    extraParams,
  };
}
