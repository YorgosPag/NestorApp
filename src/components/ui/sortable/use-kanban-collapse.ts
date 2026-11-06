'use client';

/**
 * @fileoverview **Ποιες στήλες ενός πίνακα είναι συμπτυγμένες** — προτίμηση του ανθρώπου, ανά συσκευή (ADR-930 §3.11).
 * @module components/ui/sortable/use-kanban-collapse
 *
 * 📚 HubSpot board view: σύμπτυξη ανά στήλη, προσωπική — δεν αλλάζει τον πίνακα κανενός άλλου.
 * 🔑 Αποθηκεύονται μόνο οι **ρητές** επιλογές (`kanban-model` → `parseCollapseChoices`)· η προεπιλογή του καταναλωτή
 *    (π.χ. «τα κλειστά στάδια ξεκινούν συμπτυγμένα») ισχύει όπου ο άνθρωπος δεν επέλεξε.
 * 🔑 Ίδιος μηχανισμός με την ταξινόμηση της ροής (`@/lib/storage`): ένα κλειδί του `STORAGE_KEYS`, καμία δεύτερη αποθήκη.
 */

import { useCallback, useMemo, useState } from 'react';

import { safeGetItem, safeSetItem } from '@/lib/storage';
import { parseCollapseChoices, resolveCollapsedColumns, type KanbanCollapseChoices } from './kanban-model';

const NEVER = () => false;

interface KanbanCollapseState {
  readonly collapsed: ReadonlySet<string>;
  readonly setCollapsed: (columnId: string, collapsed: boolean) => void;
}

export function useKanbanCollapse(
  storageKey: string,
  columnIds: readonly string[],
  collapsedByDefault: (columnId: string) => boolean = NEVER,
): KanbanCollapseState {
  const [choices, setChoices] = useState<KanbanCollapseChoices>(
    () => parseCollapseChoices(safeGetItem<unknown>(storageKey, {}), columnIds),
  );
  const collapsed = useMemo(
    () => resolveCollapsedColumns(columnIds, choices, collapsedByDefault),
    [choices, collapsedByDefault, columnIds],
  );
  // Η εγγραφή ΕΞΩ από τον updater του `setState`: ο updater πρέπει να είναι καθαρός (το StrictMode τον τρέχει δύο φορές).
  const setCollapsed = useCallback((columnId: string, next: boolean) => {
    const updated = { ...choices, [columnId]: next };
    setChoices(updated);
    safeSetItem(storageKey, updated);
  }, [choices, storageKey]);
  return { collapsed, setCollapsed };
}
