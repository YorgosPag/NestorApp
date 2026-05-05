/**
 * =============================================================================
 * useAddressUndo — Undo/Redo stack hook (ADR-332 Phase 2, Layer 4)
 * =============================================================================
 *
 * Session-scoped undo/redo stack persisted in `sessionStorage` so it survives
 * navigation between address editors within a single tab session
 * (ADR-332 §3.8).
 *
 * Behaviour:
 *   - **TTL: 60 s** since last activity per entry. Stale entries are purged on
 *     every read & write.
 *   - **Max stack size: 20** per side (undo / redo).
 *   - **5 op kinds** tracked: field-correction, bulk-correction,
 *     suggestion-accepted, drag-applied, form-cleared.
 *   - `push(...)` clears the redo stack (standard editor semantics).
 *   - `undo()` returns the popped entry (so the caller can restore `before`)
 *     and pushes it onto the redo stack.
 *   - `redo()` mirrors `undo()` in reverse.
 *
 * `sessionStorage` is treated as the source of truth — every operation reads
 * the current persisted state, computes the next state, then writes back.
 * This keeps the hook robust under concurrent editors mounted in the same tab.
 *
 * @module components/shared/addresses/editor/hooks/useAddressUndo
 * @see ADR-332 §3.8 Undo/Redo
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ResolvedAddressFields,
  UndoEntry,
  UndoOpKind,
} from '../types';

export const ADDRESS_UNDO_STORAGE_KEY = 'address-editor-undo-stack';
export const ADDRESS_UNDO_TTL_MS = 60_000;
export const ADDRESS_UNDO_MAX_STACK = 20;

interface StoredState {
  undo: UndoEntry[];
  redo: UndoEntry[];
}

const EMPTY_STATE: StoredState = { undo: [], redo: [] };

function isEntry(value: unknown): value is UndoEntry {
  if (!value || typeof value !== 'object') return false;
  const e = value as Partial<UndoEntry>;
  return (
    typeof e.id === 'string' &&
    typeof e.timestamp === 'number' &&
    typeof e.kind === 'string' &&
    typeof e.i18nKey === 'string'
  );
}

function purge(state: StoredState, now: number = Date.now()): StoredState {
  const fresh = (e: UndoEntry) => now - e.timestamp <= ADDRESS_UNDO_TTL_MS;
  return { undo: state.undo.filter(fresh), redo: state.redo.filter(fresh) };
}

function readStorage(): StoredState {
  if (typeof window === 'undefined') return EMPTY_STATE;
  try {
    const raw = window.sessionStorage.getItem(ADDRESS_UNDO_STORAGE_KEY);
    if (!raw) return EMPTY_STATE;
    const parsed = JSON.parse(raw) as Partial<StoredState>;
    const undo = Array.isArray(parsed.undo) ? parsed.undo.filter(isEntry) : [];
    const redo = Array.isArray(parsed.redo) ? parsed.redo.filter(isEntry) : [];
    return purge({ undo, redo });
  } catch {
    return EMPTY_STATE;
  }
}

function writeStorage(state: StoredState): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(ADDRESS_UNDO_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota exceeded or storage disabled — silent. The in-memory state still works.
  }
}

function trim(stack: UndoEntry[]): UndoEntry[] {
  return stack.length > ADDRESS_UNDO_MAX_STACK
    ? stack.slice(stack.length - ADDRESS_UNDO_MAX_STACK)
    : stack;
}

export interface PushUndoInput {
  kind: UndoOpKind;
  before: ResolvedAddressFields;
  after: ResolvedAddressFields;
  i18nKey: string;
  i18nParams?: Record<string, string | number>;
}

export interface UseAddressUndoResult {
  entries: UndoEntry[];
  redoEntries: UndoEntry[];
  canUndo: boolean;
  canRedo: boolean;
  push: (input: PushUndoInput) => UndoEntry;
  undo: () => UndoEntry | null;
  redo: () => UndoEntry | null;
  clear: () => void;
}

function makeEntryId(seqRef: { current: number }): string {
  seqRef.current += 1;
  return `undo_${Date.now().toString(36)}_${seqRef.current.toString(36)}`;
}

export function useAddressUndo(): UseAddressUndoResult {
  const [snapshot, setSnapshot] = useState<StoredState>(EMPTY_STATE);
  const seqRef = useRef(0);

  // Hydrate from sessionStorage after mount (SSR-safety).
  useEffect(() => {
    setSnapshot(readStorage());
  }, []);

  const commit = useCallback((next: StoredState): StoredState => {
    const purged = purge(next);
    writeStorage(purged);
    setSnapshot(purged);
    return purged;
  }, []);

  const push = useCallback(
    (input: PushUndoInput): UndoEntry => {
      const current = purge(readStorage());
      const entry: UndoEntry = {
        id: makeEntryId(seqRef),
        timestamp: Date.now(),
        kind: input.kind,
        before: input.before,
        after: input.after,
        i18nKey: input.i18nKey,
        i18nParams: input.i18nParams,
      };
      commit({ undo: trim([...current.undo, entry]), redo: [] });
      return entry;
    },
    [commit],
  );

  const undo = useCallback((): UndoEntry | null => {
    const current = purge(readStorage());
    if (current.undo.length === 0) {
      commit(current);
      return null;
    }
    const popped = current.undo[current.undo.length - 1] ?? null;
    if (!popped) return null;
    commit({
      undo: current.undo.slice(0, -1),
      redo: trim([...current.redo, popped]),
    });
    return popped;
  }, [commit]);

  const redo = useCallback((): UndoEntry | null => {
    const current = purge(readStorage());
    if (current.redo.length === 0) {
      commit(current);
      return null;
    }
    const popped = current.redo[current.redo.length - 1] ?? null;
    if (!popped) return null;
    commit({
      undo: trim([...current.undo, popped]),
      redo: current.redo.slice(0, -1),
    });
    return popped;
  }, [commit]);

  const clear = useCallback(() => {
    commit(EMPTY_STATE);
  }, [commit]);

  return {
    entries: snapshot.undo,
    redoEntries: snapshot.redo,
    canUndo: snapshot.undo.length > 0,
    canRedo: snapshot.redo.length > 0,
    push,
    undo,
    redo,
    clear,
  };
}

/** Internal helpers exposed for unit tests only. */
export const __test__ = { purge, readStorage, writeStorage, trim };
