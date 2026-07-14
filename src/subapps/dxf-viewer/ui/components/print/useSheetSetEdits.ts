'use client';

/**
 * ADR-651 Φάση Ι — το state του πίνακα φύλλων: ποιες γραμμές είναι επιλεγμένες και τι έχει
 * πληκτρολογήσει ο χρήστης (pending), **χωρίς** να έχει γραφτεί τίποτα ακόμη.
 *
 * Ο διάλογος δεν υπολογίζει ποτέ μόνος του αρίθμηση/τίτλο — κάθε πράξη εδώ είναι κλήση σε
 * **καθαρή** συνάρτηση του μοντέλου (`sheet-edits.ts`). Το hook κρατά μόνο React state.
 *
 * @see ../../../text-engine/title-block/sheet-edits.ts — οι καθαρές πράξεις (επαναρίθμηση κ.λπ.)
 */

import * as React from 'react';

import {
  autoNumberSheets,
  mergeSheetEdits,
  renumberSheets,
  sheetEditValues,
} from '../../../text-engine/title-block/sheet-edits';
import type { SheetIdentityEdits, SheetRow } from '../../../text-engine/title-block/sheet-set';

const NO_EDITS: SheetIdentityEdits = {};

export interface UseSheetSetEditsResult {
  readonly edits: SheetIdentityEdits;
  readonly selected: ReadonlySet<string>;
  readonly allSelected: boolean;
  readonly selectedCount: number;
  readonly toggleRow: (levelId: string) => void;
  readonly toggleAll: () => void;
  readonly setNumber: (levelId: string, text: string) => void;
  readonly setTitle: (levelId: string, text: string) => void;
  readonly renumber: (prefix: string, start: number) => void;
  readonly resetNumbers: () => void;
  /** Η τιμή που δείχνει το πεδίο μιας γραμμής (pending ⇒ αλλιώς το persisted κείμενο). */
  readonly valuesFor: (row: SheetRow) => { readonly sheetNumber: string; readonly title: string };
}

export function useSheetSetEdits(rows: readonly SheetRow[]): UseSheetSetEditsResult {
  const [edits, setEdits] = React.useState<SheetIdentityEdits>(NO_EDITS);
  const [selected, setSelected] = React.useState<ReadonlySet<string>>(() => new Set());

  const toggleRow = React.useCallback((levelId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(levelId)) next.add(levelId);
      return next;
    });
  }, []);

  const allSelected = rows.length > 0 && rows.every((row) => selected.has(row.levelId));

  const toggleAll = React.useCallback(() => {
    setSelected((prev) => {
      const all = rows.length > 0 && rows.every((row) => prev.has(row.levelId));
      return all ? new Set<string>() : new Set(rows.map((row) => row.levelId));
    });
  }, [rows]);

  const setNumber = React.useCallback((levelId: string, text: string) => {
    setEdits((prev) => mergeSheetEdits(prev, { [levelId]: { sheetNumber: text } }));
  }, []);

  const setTitle = React.useCallback((levelId: string, text: string) => {
    setEdits((prev) => mergeSheetEdits(prev, { [levelId]: { title: text } }));
  }, []);

  // Μαζικές πράξεις: idempotent by construction — `mergeSheetEdits` επιστρέφει την ΙΔΙΑ
  // αναφορά όταν το patch δεν αλλάζει τίποτα (ίδιο κουμπί δύο φορές ⇒ μηδέν re-render).
  const renumber = React.useCallback(
    (prefix: string, start: number) => {
      setEdits((prev) => mergeSheetEdits(prev, renumberSheets(rows, selected, { prefix, start })));
    },
    [rows, selected],
  );

  const resetNumbers = React.useCallback(() => {
    setEdits((prev) => mergeSheetEdits(prev, autoNumberSheets(rows, selected)));
  }, [rows, selected]);

  const valuesFor = React.useCallback((row: SheetRow) => sheetEditValues(row, edits), [edits]);

  return {
    edits,
    selected,
    allSelected,
    selectedCount: selected.size,
    toggleRow,
    toggleAll,
    setNumber,
    setTitle,
    renumber,
    resetNumbers,
    valuesFor,
  };
}
