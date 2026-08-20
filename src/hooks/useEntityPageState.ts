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
import {
  deriveEntitySelection,
  mayAutoSelectFirst,
  shouldClearStaleSelection,
  type EntitySelection,
} from './entity-selection-state';
import { useEntityFallbackResolution } from './useEntityFallbackResolution';

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
   *
   * ⚠️ **ΔΕΝ ΕΦΑΡΜΟΖΕΤΑΙ ΠΟΤΕ όταν η διεύθυνση ζητά ρητή ταυτότητα** (ADR-777
   * §8.31): «δεν βρήκα αυτό που ζήτησες» **δεν** είναι άδεια να δείξεις άλλο.
   */
  autoSelectFirstItem?: boolean;

  /**
   * 🔴 **ΥΠΟΧΡΕΩΤΙΚΟ, ΕΠΙΤΗΔΕΣ** — *«απάντησε η πηγή της λίστας;»* (ADR-777 §8.31).
   *
   * Συνήθως `!loading` του αντίστοιχου φορτωτή. **Δεν** έχει προεπιλογή: με
   * προεπιλογή `true` κάθε μελλοντικός καταναλωτής που θα το ξεχνούσε θα
   * ανακοίνωνε **σιωπηλά** «δεν βρέθηκε» για εγγραφή που απλώς δεν φόρτωσε
   * ακόμη — το σχήμα «**0 = κανείς δεν κοίταξε**» (μάθημα Μ-Α, §8.30). Ο
   * μεταγλωττιστής υποχρεώνει την απάντηση.
   */
  hasAnswered: boolean;

  /** Προαιρετικά: τα αρχειοθετημένα, αν η οθόνη τα έχει ήδη φορτωμένα. */
  archivedItems?: readonly T[];

  /**
   * Προαιρετικά: πηγή για ταυτότητα **εκτός** της φορτωμένης λίστας.
   * ⚠️ Πρέπει να ελέγχει εταιρεία — δες `useEntityFallbackResolution`.
   */
  resolveById?: (id: string) => Promise<T | null>;

  /** Προαιρετικά: πότε μια εγγραφή είναι αρχειοθετημένη από τη μορφή της. */
  isArchived?: (item: T) => boolean;
}

/**
 * Ό,τι **δεν** είναι σταθερή ρύθμιση της οθόνης αλλά **ζωντανή κατάσταση** της
 * πηγής δεδομένων — και γι' αυτό ταξιδεύει από τον καλούντα, σε κάθε απόδοση
 * (ADR-777 §8.31). Κοινό σχήμα για τους τέσσερις καταναλωτές.
 */
export interface EntityPageStateOptions<T extends IdentifiableEntity> {
  /** `!loading` του φορτωτή. Βλ. `EntityPageStateConfig.hasAnswered`. */
  readonly hasAnswered: boolean;
  readonly archivedItems?: readonly T[];
  readonly resolveById?: (id: string) => Promise<T | null>;
  readonly isArchived?: (item: T) => boolean;
}

/** The return type of useEntityPageState */
export interface EntityPageStateReturn<T extends IdentifiableEntity, F> {
  selectedItem: T | null;
  setSelectedItem: (item: (T | null) | ((prev: T | null) => T | null)) => void;
  viewMode: ViewMode;
  setViewMode: Dispatch<SetStateAction<ViewMode>>;
  showDashboard: boolean;
  setShowDashboard: Dispatch<SetStateAction<boolean>>;
  filteredItems: T[];
  filters: F;
  setFilters: Dispatch<SetStateAction<F>>;
  /** Extra URL params requested via config.extraUrlParams */
  extraParams: Record<string, string | null>;
  /**
   * **Τι ζήτησε η διεύθυνση και τι βρήκαμε** — ρητά (ADR-777 §8.31).
   *
   * Το `selectedItem` απαντά *«τι δείχνω»*· αυτό απαντά *«γιατί»*. Οι δύο
   * απαντήσεις **δεν** είναι η ίδια: `selectedItem === null` σημαίνει ταυτόχρονα
   * «ψάχνω», «δεν υπάρχει» και «δεν ζήτησες τίποτα» — και η οθόνη δεν μπορεί να
   * τα ξεχωρίσει χωρίς αυτό.
   */
  selection: EntitySelection<T>;
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
    hasAnswered,
    archivedItems,
    resolveById,
    isArchived,
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
    (item: (T | null) | ((prev: T | null) => T | null)) => {
      startTransition(() => {
        setSelectedItemRaw(item);
      });
    },
    [startTransition],
  );

  // ── Η επιλογή της διεύθυνσης, ως ΡΗΤΗ κατάσταση (ADR-777 §8.31) ────
  //
  // 🔴 Πριν από το §8.31 αυτό ήταν μια `useEffect` με τρεις σιωπηλές αστοχίες:
  // άδεια λίστα διαβαζόταν ως «δεν υπάρχει», και η αποτυχία εύρεσης έπεφτε στην
  // αυτόματη επιλογή ⇒ **ο άνθρωπος έβλεπε άλλη εγγραφή από αυτή που ζήτησε**.
  // Η απόφαση ζει πλέον σε καθαρή, καλέσιμη συνάρτηση.

  const presentInLoadedLists = useMemo(() => {
    if (!entityIdFromUrl) return true;
    const inActive = items.some((item) => item.id === entityIdFromUrl);
    return inActive || Boolean(archivedItems?.some((item) => item.id === entityIdFromUrl));
  }, [entityIdFromUrl, items, archivedItems]);

  const fallback = useEntityFallbackResolution<T>({
    requestedId: entityIdFromUrl,
    enabled: hasAnswered && !presentInLoadedLists,
    resolveById,
    loggerName,
  });

  const selection = useMemo(
    () =>
      deriveEntitySelection<T>({
        requestedId: entityIdFromUrl,
        hasAnswered,
        items,
        archivedItems,
        fallback,
        isArchived,
      }),
    [entityIdFromUrl, hasAnswered, items, archivedItems, fallback, isArchived],
  );

  useEffect(() => {
    if (selection.kind === 'selected' || selection.kind === 'archived') {
      logger.info('Auto-selecting entity from URL', { entityId: selection.item.id });
      setSelectedItemRaw(selection.item);
      return;
    }

    // 🔴 Η διεύθυνση ζητά ΑΛΛΗ ταυτότητα από αυτή που δείχνουμε ⇒ σβήσ' την.
    // Χωρίς αυτό, το πανό «δεν οδηγεί σε εγγραφή» εμφανιζόταν ΠΑΝΩ από την
    // προηγούμενη εγγραφή, που έμενε ορατή (μετρημένο ζωντανά, §8.31).
    if (shouldClearStaleSelection(selection, selectedItem?.id)) {
      setSelectedItemRaw(null);
      return;
    }

    // ⚠️ Ρητή ταυτότητα ⇒ ΚΑΜΙΑ αυτόματη επιλογή, σε καμία κατάσταση.
    if (mayAutoSelectFirst(selection, autoSelectFirstItem) && !selectedItem && items.length > 0) {
      setSelectedItemRaw(items[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, autoSelectFirstItem, items, selectedItem?.id]);

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
    selection,
  };
}
