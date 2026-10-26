'use client';
/**
 * **Η κατάσταση ελέγχου του πλέγματος** — επιλογή, κατάσταση γραφής, `draft`, επιλογές, ανακοίνωση (ADR-923 §5.10.4 Β1).
 *
 * Τα δεδομένα **δεν** ζουν εδώ (ένας ιδιοκτήτης: ο καταναλωτής). Κάθε χειριστής διαβάζει το στιγμιότυπο **τη στιγμή
 * του συμβάντος** από `ref` (ιδίωμα ADR-040: getter, όχι παλιό στιγμιότυπο closure) — αλλιώς μια επικόλληση αμέσως
 * μετά από πληκτρολόγηση θα έγραφε πάνω σε γραμμές ενός render πριν.
 *
 * @module components/ui/data-grid/use-data-grid
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

import type { GridCell } from '@/lib/spreadsheet/grid-navigation';

import {
  INITIAL_GRID_STATE,
  commitDraft,
  reconcileState,
  type GridControlState,
  type GridOutcome,
  type GridSnapshot,
} from './data-grid-actions';
import type { DataGridProps } from './data-grid-types';

export interface DataGridController<Row> {
  readonly state: GridControlState;
  readonly choicesOpen: boolean;
  readonly announcement: string;
  /** Το στιγμιότυπο **τώρα** — για χειριστές συμβάντων. */
  readonly snapshot: () => GridSnapshot<Row>;
  /** Εφαρμογή ενός αποτελέσματος: νέα κατάσταση + (αν υπάρχει) **μία** αλλαγή προς τον καταναλωτή. */
  readonly apply: (outcome: GridOutcome<Row>) => void;
  readonly setState: (state: GridControlState) => void;
  readonly setChoicesOpen: (open: boolean) => void;
  readonly inputRef: RefObject<HTMLInputElement | null>;
  /** Δέσμευση πριν η εστία φύγει από το πλέγμα (Excel: κλικ αλλού = δέσμευση). */
  readonly commitOnLeave: () => void;
  readonly hasFocus: RefObject<boolean>;
}

export function useDataGrid<Row>(props: DataGridProps<Row>, pageRows: number): DataGridController<Row> {
  const [state, setStateRaw] = useState<GridControlState>(INITIAL_GRID_STATE);
  const [choicesOpen, setChoicesOpen] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const hasFocus = useRef(false);
  const stateRef = useRef(state);
  const propsRef = useRef(props);
  propsRef.current = props;

  const snapshot = useCallback((): GridSnapshot<Row> => {
    const current = propsRef.current;
    return {
      rows: current.rows,
      columns: current.columns,
      createRow: current.createRow,
      maxRows: current.maxRows,
      editable: current.onChange !== undefined,
      state: stateRef.current,
      pageRows,
    };
  }, [pageRows]);

  const setState = useCallback((next: GridControlState) => {
    stateRef.current = next;
    setStateRaw(next);
  }, []);

  const apply = useCallback((outcome: GridOutcome<Row>) => {
    setState(outcome.state);
    const { change } = outcome;
    if (!change) return;
    if (change.report || change.rejected.length > 0) {
      setAnnouncement(propsRef.current.words.pasted(change.report ?? emptyReport(), change.rejected.length));
    }
    if (change.rows !== propsRef.current.rows) propsRef.current.onChange?.(change);
  }, [setState]);

  const commitOnLeave = useCallback(() => {
    const outcome = commitDraft(snapshot());
    apply(outcome);
  }, [apply, snapshot]);

  useReconcile(props.rows.length, props.columns.length, snapshot, setState);
  useFocusCursor(state.selection.cursor, state.mode, inputRef, hasFocus);

  return { state, choicesOpen, announcement, snapshot, apply, setState, setChoicesOpen, inputRef, commitOnLeave, hasFocus };
}

const emptyReport = () => ({ offeredRows: 0, offeredCols: 0, appendedRows: 0, clippedRows: 0, clippedCols: 0, skippedReadOnly: 0 });

/** Γραμμές/στήλες άλλαξαν από έξω ⇒ η επιλογή μένει μέσα στο πλέγμα (ποτέ δρομέας στο κενό). */
function useReconcile<Row>(rows: number, cols: number, snapshot: () => GridSnapshot<Row>, setState: (s: GridControlState) => void) {
  useLayoutEffect(() => {
    const snap = snapshot();
    const next = reconcileState(snap);
    if (next !== snap.state) setState(next);
  }, [rows, cols, snapshot, setState]);
}

/** Η εστία ακολουθεί τον δρομέα — **μόνο** όσο το πλέγμα έχει την εστία (αλλιώς θα την έκλεβε από τη σελίδα). */
function useFocusCursor(cursor: GridCell, mode: string, inputRef: RefObject<HTMLInputElement | null>, hasFocus: RefObject<boolean>) {
  useEffect(() => {
    const input = inputRef.current;
    if (!input || !hasFocus.current) return;
    if (document.activeElement !== input) input.focus({ preventScroll: true });
    input.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [cursor.row, cursor.col, mode, inputRef, hasFocus]);
}
