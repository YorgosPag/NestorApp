'use client';

/**
 * 🔴 ADR-828 Φ4β — **Η ΚΑΤΑΣΤΑΣΗ ΤΟΥ ΔΙΑΛΟΓΟΥ «ΠΡΟΣΑΡΜΟΣΜΕΝΗ ΤΑΞΙΝΟΜΗΣΗ…»**, με το μοτίβο
 * του ADR-739 §61: ελαφρύ store + **ένας** ξενιστής.
 *
 * Ο εκκινητής είναι item υπομενού — ξεμοντάρει τη στιγμή που το πατάς, άρα δεν μπορεί να
 * ζωγραφίσει τίποτα που το επιβιώνει. Ίδιο σχήμα, ίδιος λόγος, τρίτη φορά.
 *
 * ## 🔑 ΓΙΑΤΙ Ο ΣΤΟΧΟΣ ΤΑΞΙΔΕΥΕΙ ΜΕ ΤΟ ΑΙΤΗΜΑ
 * Ο κανόνας Α22 του δεξιού κλικ δίνει όρια που μπορεί να είναι **έξω** από την επιλογή
 * (δεξί κλικ στο `E5` με μαρκαρισμένο το `B2:D4`). Ένας ξενιστής που ρωτούσε μόνος του τη
 * ζωντανή επιλογή θα ταξινομούσε το `B2:D4` ενώ ο άνθρωπος πάτησε στο `E5` — αλλαγή μακριά
 * από τον δείκτη. Και ο `FormatTarget` κουβαλά **και** το μοντέλο, που είναι η βάση σύγκρισης
 * του compare-and-swap στη δέσμευση (ADR-739 §63): ένα `Ctrl+Z` ανάμεσα στο άνοιγμα και το
 * «ΟΚ» **δεν** γράφει πάνω σε πίνακα που δεν υπάρχει πια.
 *
 * @module subapps/dxf-viewer/state/table-sort-dialog-store
 * @see ui/components/table-sort/TableSortDialogHost.tsx — ο ΕΝΑΣ ξενιστής
 * @see state/table-format-cells-dialog-store.ts — το μοτίβο (ADR-739 §61)
 */

import { useSyncExternalStore } from 'react';
import { createExternalStore } from '../stores/createExternalStore';
import type { TableCellRangeBounds } from '../bim/table/table-cell-range';
import type { FormatTarget } from '../ui/table-cell-editor/table-format-snapshot';

export interface TableSortRequestState {
  /**
   * 🔴 Ο **σειριακός αριθμός του ανοίγματος** — η ταυτότητα της *ερώτησης*, όχι της κατάστασης.
   *
   * Ίδιος λόγος με το §61: τα επίπεδα ταξινόμησης είναι `useState` που σπέρνεται στο mount.
   * Χωρίς αυτόν, ένα δεύτερο άνοιγμα πάνω σε **άλλη** περιοχή θα κρατούσε τα κριτήρια της
   * προηγούμενης — δηλαδή το «ΟΚ» θα ταξινομούσε με κανόνα που ο άνθρωπος νομίζει ότι ακύρωσε.
   */
  readonly id: number;
  readonly target: FormatTarget;
  /** Τα όρια που άνοιξε το δεξί κλικ — **αυτά** ταξινομούνται, όχι η ζωντανή επιλογή. */
  readonly range: TableCellRangeBounds;
}

const requestStore = createExternalStore<TableSortRequestState | null>(null);

/** Μονότονα αύξων· δες {@link TableSortRequestState.id}. Ποτέ ρολόι, ποτέ τυχαίος. */
let nextRequestId = 1;

/**
 * Άνοιξε τον διάλογο.
 *
 * ⚠️ `target === null` ⇒ **δεν ανοίγει**: ποτέ διάλογος πάνω σε πίνακα που δεν υπάρχει πια
 * (ένα `Ctrl+Z` ανάμεσα στο άνοιγμα του μενού και το πάτημα του item). Ίδια σύμβαση με το §61.
 */
export function openTableSortDialog(options: {
  readonly target: FormatTarget | null;
  readonly range: TableCellRangeBounds;
}): void {
  if (options.target === null) return;
  requestStore.set({ id: nextRequestId++, target: options.target, range: options.range });
}

/** Άκυρο / `Escape` / `✕` / ΟΚ — και τα τέσσερα κλείνουν τον **έναν** διάλογο. */
export function closeTableSortDialog(): void {
  requestStore.set(null);
}

/** Τι είναι ανοιχτό **τη στιγμή της κλήσης**· `null` = κλειστός. */
export function getTableSortRequest(): TableSortRequestState | null {
  return requestStore.get();
}

/** Συνδρομή για `useSyncExternalStore`· επιστρέφει την αποδέσμευση. */
export function subscribeTableSortDialog(listener: () => void): () => void {
  return requestStore.subscribe(listener);
}

/**
 * Το αίτημα ως αντιδραστική τιμή — για τον ξενιστή.
 *
 * Ο server snapshot είναι `null` (κλειστός): ο διάλογος είναι καθαρά πράξη χρήστη, οπότε καμία
 * απόδοση στον διακομιστή δεν μπορεί να έχει άλλη απάντηση.
 */
export function useTableSortRequest(): TableSortRequestState | null {
  return useSyncExternalStore(subscribeTableSortDialog, getTableSortRequest, () => null);
}

/** Test helper — μηδενισμός μεταξύ tests, ίδιο μοτίβο με τα υπόλοιπα stores του subapp. */
export function __resetTableSortDialogForTests(): void {
  requestStore.reset(null);
  nextRequestId = 1;
}
