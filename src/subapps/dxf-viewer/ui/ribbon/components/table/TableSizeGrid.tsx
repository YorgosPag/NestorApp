'use client';

/**
 * ADR-739 §39 — **το πλέγμα επιλογής μεγέθους** (μοτίβο Word).
 *
 * ## Γιατί `<table role="grid">` και όχι πλέγμα από `<button>`
 * Δεν είναι σημασιολογικός καλλωπισμός — είναι **ο φύλακας των βελών**. Το
 * `useKeyboardShortcuts` πανάρει τον καμβά ±80px με τα βέλη σε **window capture**, και το
 * `popover.tsx` (σε αντίθεση με το `dialog.tsx`) **δεν** σπρώχνει modal scope. Επειδή όμως τα
 * `'grid' | 'gridcell' | 'row'` είναι ήδη στα `ARROW_NAVIGATION_ROLES` του
 * `lib/a11y/keyboard-scope.ts`, ο accelerator **παραιτείται μόνος του** όσο η εστίαση είναι σε
 * κυψελίδα. Μηδέν `stopPropagation`, καμία νέα εγγραφή στο πληκτρολόγιο.
 *
 * ## Καμία `title=` σε 80 κυψελίδες
 * Η περιγραφή κάθε κυψελίδας δίνεται με `aria-label`. Native tooltip εδώ θα ήταν 80 νέες
 * παραβιάσεις του CHECK 3.23 σε ένα component.
 *
 * Το component **δεν ξέρει τον store**: παίρνει το τρέχον μέγεθος και αναφέρει προθέσεις.
 *
 * @module subapps/dxf-viewer/ui/ribbon/components/table/TableSizeGrid
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  type GridDims,
  type GridPos,
  MIN_FOCUSABLE_ROW_INDEX,
  isGridCommitKey,
  nextGridFocus,
} from './table-size-grid-keyboard';
import { type TableMenuSize, gridCellToSize, isCellInSelection } from './table-size-menu-model';

interface TableSizeGridProps {
  readonly dims: GridDims;
  /** Το μέγεθος που κρατά ο store — αρχική εστίαση και αρχικό φωτισμένο ορθογώνιο. */
  readonly current: TableMenuSize;
  /** Ζωντανή προεπισκόπηση· `null` = επιστροφή στο `current` (φύγαμε από το πλέγμα). */
  readonly onPreview: (size: TableMenuSize | null) => void;
  readonly onCommit: (size: TableMenuSize) => void;
  /** Το id της λεζάντας, ώστε το πλέγμα να την περιγράφει. */
  readonly captionId: string;
}

/** Η κυψελίδα που αντιστοιχεί στο τρέχον μέγεθος — εκεί ξεκινά η εστίαση. */
function initialFocus(current: TableMenuSize, dims: GridDims): GridPos {
  return {
    col: Math.min(current.columnCount - 1, dims.columns - 1),
    row: Math.min(Math.max(current.totalRowCount - 1, MIN_FOCUSABLE_ROW_INDEX), dims.rows - 1),
  };
}

const rowIndexes = (count: number): number[] => Array.from({ length: count }, (_, i) => i);

export const TableSizeGrid: React.FC<TableSizeGridProps> = ({
  dims,
  current,
  onPreview,
  onCommit,
  captionId,
}) => {
  const { t } = useTranslation('dxf-viewer-shell');
  const gridRef = useRef<HTMLTableElement>(null);
  const [focus, setFocus] = useState<GridPos>(() => initialFocus(current, dims));
  // Η προεπισκόπηση ακολουθεί το ποντίκι· όταν δεν υπάρχει, το φωτισμένο είναι το `current`.
  const [preview, setPreview] = useState<TableMenuSize | null>(null);

  const lit = preview ?? current;

  // Η εστίαση του DOM ακολουθεί την εστίαση της κατάστασης (roving tabindex, APG Grid).
  useEffect(() => {
    const cell = gridRef.current?.querySelector<HTMLTableCellElement>(
      `[data-col="${focus.col}"][data-row="${focus.row}"]`,
    );
    if (cell && gridRef.current?.contains(document.activeElement)) cell.focus();
  }, [focus]);

  const showPreview = useCallback(
    (size: TableMenuSize | null) => {
      setPreview(size);
      onPreview(size);
    },
    [onPreview],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTableElement>) => {
      if (isGridCommitKey(event.key)) {
        event.preventDefault();
        onCommit(gridCellToSize(focus.col, focus.row));
        return;
      }
      const next = nextGridFocus(focus, event.nativeEvent, dims);
      // `null` = δεν μας αφορά (π.χ. Tab) ⇒ κανένα preventDefault, το πλήκτρο συνεχίζει.
      if (!next) return;
      event.preventDefault();
      setFocus(next);
      showPreview(gridCellToSize(next.col, next.row));
    },
    [focus, dims, onCommit, showPreview],
  );

  const handleCellEnter = useCallback(
    (col: number, row: number) => {
      setFocus({ col, row: Math.max(row, MIN_FOCUSABLE_ROW_INDEX) });
      showPreview(gridCellToSize(col, row));
    },
    [showPreview],
  );

  return (
    <table
      ref={gridRef}
      role="grid"
      className="dxf-ribbon-table-grid"
      aria-label={t('ribbon.commands.tableMenu.gridLabel')}
      aria-describedby={captionId}
      onKeyDown={handleKeyDown}
      onMouseLeave={() => showPreview(null)}
      onBlur={() => showPreview(null)}
    >
      <tbody>
        {rowIndexes(dims.rows).map((row) => (
          <tr key={row}>
            {rowIndexes(dims.columns).map((col) => {
              const size = gridCellToSize(col, row);
              const inSelection = isCellInSelection(col, row, lit);
              const isFocused = focus.col === col && focus.row === row;
              return (
                <td
                  key={col}
                  role="gridcell"
                  data-col={col}
                  data-row={row}
                  data-in-selection={inSelection ? 'true' : undefined}
                  data-focused={isFocused ? 'true' : undefined}
                  aria-selected={inSelection}
                  aria-label={t('ribbon.commands.tableMenu.cellLabel', {
                    columns: size.columnCount,
                    rows: size.totalRowCount,
                  })}
                  tabIndex={isFocused ? 0 : -1}
                  onMouseEnter={() => handleCellEnter(col, row)}
                  onFocus={() => showPreview(size)}
                  onClick={() => onCommit(size)}
                />
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
};
