'use client';

/**
 * @fileoverview **Επεξεργασία λίστας εταίρων / μελών / μετόχων** — μία, για τις τρεις νομικές μορφές.
 * @module subapps/accounting/components/setup/useRosterEditing
 *
 * 🔴 **ΕΞΑΓΩΓΗ (N.0.2 · CHECK 3.28)**: τα τρία `useCallback` (αλλαγή · προσθήκη · αφαίρεση) και το
 * άθροισμα των **ενεργών** ποσοστών ζούσαν αυτούσια στις ενότητες ΟΕ, ΕΠΕ και ΑΕ. Βρέθηκαν όταν η
 * Α23 (ADR-841 §7) άγγιξε και τις τρεις για το πεδίο ΓΕΜΗ.
 *
 * ⚠️ Το `createEmpty` πρέπει να είναι **σταθερή** αναφορά (συνάρτηση module), αλλιώς το `add`
 * αλλάζει ταυτότητα σε κάθε απόδοση.
 */

import { useCallback } from 'react';

interface Activatable {
  readonly isActive: boolean;
}

export interface RosterEditing<T> {
  readonly change: (index: number, updates: Partial<T>) => void;
  readonly add: () => void;
  readonly remove: (index: number) => void;
  /** Άθροισμα του ποσοστού **μόνο** των ενεργών — οι ανενεργοί δεν μετρούν στο 100%. */
  readonly activeShareSum: number;
}

export function useRosterEditing<T extends Activatable>(
  items: T[],
  onItemsChange: (items: T[]) => void,
  createEmpty: (index: number) => T,
  shareOf: (item: T) => number,
): RosterEditing<T> {
  const change = useCallback(
    (index: number, updates: Partial<T>) => {
      const next = [...items];
      next[index] = { ...next[index], ...updates };
      onItemsChange(next);
    },
    [items, onItemsChange],
  );

  const add = useCallback(() => {
    onItemsChange([...items, createEmpty(items.length)]);
  }, [items, onItemsChange, createEmpty]);

  const remove = useCallback(
    (index: number) => {
      onItemsChange(items.filter((_, i) => i !== index));
    },
    [items, onItemsChange],
  );

  const activeShareSum = items.filter((item) => item.isActive).reduce((sum, item) => sum + shareOf(item), 0);

  return { change, add, remove, activeShareSum };
}
