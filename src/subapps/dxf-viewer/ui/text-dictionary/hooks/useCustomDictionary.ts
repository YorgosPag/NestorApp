/**
 * ADR-344 Phase 8 — React hook bundle for the custom dictionary Manager.
 *
 * Two hooks:
 *   - `useCustomDictionary(companyId)` — fetch + cache the list (lightweight
 *     SWR-style implementation: refetch on mount + manual invalidate).
 *   - `useCustomDictionaryMutations({ entries, setEntries })` — optimistic
 *     CRUD against `/api/dxf/custom-dictionary` with rollback on failure.
 *
 * Pattern mirrors `useTextTemplates` + `useTextTemplateMutations` (Phase
 * 7.D). The fetch hook is intentionally minimal — when react-query is
 * added project-wide, this becomes a thin adapter.
 *
 * @module ui/text-dictionary/hooks/useCustomDictionary
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { nowISO } from '@/lib/date-local';
import type {
  SpellLanguage,
} from '@/subapps/dxf-viewer/text-engine/spell';
import type { SerializedCustomDictionaryEntry } from '@/app/api/dxf/custom-dictionary/_helpers';

const API_ROOT = '/api/dxf/custom-dictionary';

export interface UseCustomDictionaryResult {
  readonly entries: readonly SerializedCustomDictionaryEntry[];
  readonly loading: boolean;
  readonly error: Error | null;
  readonly refresh: () => Promise<void>;
  readonly setEntriesLocal: (
    updater: (
      prev: readonly SerializedCustomDictionaryEntry[],
    ) => readonly SerializedCustomDictionaryEntry[],
  ) => void;
}

async function fetchEntries(): Promise<SerializedCustomDictionaryEntry[]> {
  const res = await fetch(API_ROOT, { method: 'GET', credentials: 'include' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(typeof body.error === 'string' ? body.error : 'Failed to load dictionary');
  }
  const body = (await res.json()) as { entries: SerializedCustomDictionaryEntry[] };
  return body.entries;
}

export function useCustomDictionary(companyId: string | null): UseCustomDictionaryResult {
  const [entries, setEntries] = useState<readonly SerializedCustomDictionaryEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (companyId === null) {
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await fetchEntries();
      setEntries(next);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { entries, loading, error, refresh, setEntriesLocal: setEntries };
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export interface CreateDictionaryEntryInput {
  readonly term: string;
  readonly language: SpellLanguage;
}

export interface UpdateDictionaryEntryPatch {
  readonly term?: string;
  readonly language?: SpellLanguage;
}

export interface UseCustomDictionaryMutationsArgs {
  readonly entries: readonly SerializedCustomDictionaryEntry[];
  readonly setEntries: (
    updater: (
      prev: readonly SerializedCustomDictionaryEntry[],
    ) => readonly SerializedCustomDictionaryEntry[],
  ) => void;
}

export interface UseCustomDictionaryMutationsResult {
  readonly create: (input: CreateDictionaryEntryInput) => Promise<SerializedCustomDictionaryEntry>;
  readonly update: (
    entryId: string,
    patch: UpdateDictionaryEntryPatch,
  ) => Promise<SerializedCustomDictionaryEntry>;
  readonly remove: (entryId: string) => Promise<void>;
}

async function parseJsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
    const message = typeof body.error === 'string' ? body.error : `HTTP ${res.status}`;
    const err = new Error(message) as Error & { code?: string };
    if (body.code) err.code = body.code;
    throw err;
  }
  return (await res.json()) as T;
}

export function useCustomDictionaryMutations(
  args: UseCustomDictionaryMutationsArgs,
): UseCustomDictionaryMutationsResult {
  const { entries, setEntries } = args;

  const create = useCallback(
    async (input: CreateDictionaryEntryInput) => {
      const res = await fetch(API_ROOT, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      });
      const body = await parseJsonOrThrow<{ entry: SerializedCustomDictionaryEntry }>(res);
      setEntries((prev) => [body.entry, ...prev]);
      return body.entry;
    },
    [setEntries],
  );

  const update = useCallback(
    async (entryId: string, patch: UpdateDictionaryEntryPatch) => {
      const previous = entries;
      // Optimistic local apply.
      setEntries((prev) =>
        prev.map((e) =>
          e.id === entryId
            ? {
                ...e,
                term: patch.term ?? e.term,
                language: patch.language ?? e.language,
                updatedAt: nowISO(),
              }
            : e,
        ),
      );
      try {
        const res = await fetch(`${API_ROOT}/${encodeURIComponent(entryId)}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(patch),
        });
        const body = await parseJsonOrThrow<{ entry: SerializedCustomDictionaryEntry }>(res);
        setEntries((prev) => prev.map((e) => (e.id === entryId ? body.entry : e)));
        return body.entry;
      } catch (err) {
        // Rollback.
        setEntries(() => previous);
        throw err;
      }
    },
    [entries, setEntries],
  );

  const remove = useCallback(
    async (entryId: string) => {
      const previous = entries;
      setEntries((prev) => prev.filter((e) => e.id !== entryId));
      try {
        const res = await fetch(`${API_ROOT}/${encodeURIComponent(entryId)}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        await parseJsonOrThrow<{ deleted: true }>(res);
      } catch (err) {
        setEntries(() => previous);
        throw err;
      }
    },
    [entries, setEntries],
  );

  return { create, update, remove };
}
