'use client';

/**
 * @module chart-card/editor/use-repeating-rows
 * @enterprise ADR-710 — Add / edit / remove over a list of form rows.
 *
 * The row-list half of a chart card's editor, kept apart from the submit half
 * (`use-entry-submit.ts`) because a single-record form needs the second and not the
 * first. Bundling them would have produced a hook with a mode flag — the shape this
 * module exists to avoid.
 *
 * ## Re-seeding is keyed, not identity-based
 *
 * The migrated `BudgetVarianceChart` re-seeded its rows from a `useEffect` on the
 * analysis object. That is correct only while the parent hands back a stable
 * reference; a parent that rebuilds it each render would wipe whatever the user was
 * typing, and nothing in the signature said so.
 *
 * Here the caller names the record with `seedKey` and the rows are rebuilt only when
 * that name changes. Re-seeding then depends on *which record is loaded*, which is
 * what was actually meant, and an unstable `seed` closure is harmless.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseRepeatingRowsOptions<TRow> {
  /** Builds the rows for the currently loaded record. */
  readonly seed: () => TRow[];
  /**
   * Identity of the loaded record — a document id, or a marker for "nothing loaded".
   * Rows are rebuilt from `seed()` exactly when this changes.
   */
  readonly seedKey: string;
  /** Builds a blank row for `addRow`. */
  readonly createRow: () => TRow;
}

export interface UseRepeatingRowsResult<TRow> {
  readonly rows: readonly TRow[];
  /** Merges a patch into one row. */
  readonly updateRow: (index: number, patch: Partial<TRow>) => void;
  readonly addRow: () => void;
  readonly removeRow: (index: number) => void;
}

export function useRepeatingRows<TRow>({
  seed,
  seedKey,
  createRow,
}: UseRepeatingRowsOptions<TRow>): UseRepeatingRowsResult<TRow> {
  const [rows, setRows] = useState<TRow[]>(seed);

  /** Latest closures, so the re-seed effect depends on `seedKey` and nothing else. */
  const seedRef = useRef(seed);
  seedRef.current = seed;
  const createRowRef = useRef(createRow);
  createRowRef.current = createRow;

  const loadedKey = useRef(seedKey);
  useEffect(() => {
    if (loadedKey.current === seedKey) return;
    loadedKey.current = seedKey;
    setRows(seedRef.current());
  }, [seedKey]);

  const updateRow = useCallback((index: number, patch: Partial<TRow>) => {
    setRows((previous) =>
      previous.map((row, position) => (position === index ? { ...row, ...patch } : row)),
    );
  }, []);

  const addRow = useCallback(() => {
    setRows((previous) => [...previous, createRowRef.current()]);
  }, []);

  const removeRow = useCallback((index: number) => {
    setRows((previous) => previous.filter((_, position) => position !== index));
  }, []);

  return { rows, updateRow, addRow, removeRow };
}
