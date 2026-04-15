/**
 * @fileoverview Accounting Subapp — useJournalEntries Hook
 * @description Client-side hook για εγγραφές Βιβλίου Εσόδων-Εξόδων με φίλτρα
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-001 Chart of Accounts
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { API_ROUTES } from '@/config/domain-constants';
import { createStaleCache } from '@/lib/stale-cache';
import type {
  JournalEntry,
  EntryType,
  AccountCategory,
  FiscalQuarter,
  CreateJournalEntryInput,
} from '@/subapps/accounting/types';

// ADR-300: Module-level cache — survives React unmount/remount (navigation)
const journalCache = createStaleCache<JournalEntry[]>('accounting-journal');

// ============================================================================
// TYPES
// ============================================================================

interface UseJournalEntriesOptions {
  /** Φίλτρο τύπου (income/expense) */
  type?: EntryType;
  /** Φίλτρο κατηγορίας */
  category?: AccountCategory;
  /** Φορολογικό έτος */
  fiscalYear?: number;
  /** Τρίμηνο */
  quarter?: FiscalQuarter;
  /** Αυτόματο fetch κατά το mount (default: true) */
  autoFetch?: boolean;
}

interface UseJournalEntriesReturn {
  /** Λίστα εγγραφών */
  entries: JournalEntry[];
  /** Κατάσταση φόρτωσης */
  loading: boolean;
  /** Μήνυμα σφάλματος */
  error: string | null;
  /** Ανανέωση δεδομένων */
  refetch: () => Promise<void>;
  /** Δημιουργία νέας εγγραφής */
  createEntry: (data: CreateJournalEntryInput) => Promise<{ id: string } | null>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useJournalEntries(options: UseJournalEntriesOptions = {}): UseJournalEntriesReturn {
  const { type, category, fiscalYear, quarter, autoFetch = true } = options;
  const { user } = useAuth();

  // ADR-300: Seed from module-level cache → zero flash on re-navigation
  const cacheKey = `${type ?? 'all'}-${category ?? 'all'}-${fiscalYear ?? 'all'}-${quarter ?? 'all'}`;
  const [entries, setEntries] = useState<JournalEntry[]>(journalCache.get(cacheKey) ?? []);
  const [loading, setLoading] = useState(!journalCache.hasLoaded(cacheKey));
  const [error, setError] = useState<string | null>(null);

  const getAuthHeaders = useCallback(async (): Promise<HeadersInit> => {
    if (!user) return {};
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }, [user]);

  const buildQueryString = useCallback((): string => {
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    if (category) params.set('category', category);
    if (fiscalYear !== undefined) params.set('fiscalYear', String(fiscalYear));
    if (quarter !== undefined) params.set('quarter', String(quarter));
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }, [type, category, fiscalYear, quarter]);

  const fetchEntries = useCallback(async (): Promise<void> => {
    if (!user) return;

    const key = `${type ?? 'all'}-${category ?? 'all'}-${fiscalYear ?? 'all'}-${quarter ?? 'all'}`;
    try {
      // ADR-300: Only show spinner on first load — not on re-navigation
      if (!journalCache.hasLoaded(key)) setLoading(true);
      setError(null);

      const headers = await getAuthHeaders();
      const queryString = buildQueryString();
      const response = await fetch(`${API_ROUTES.ACCOUNTING.JOURNAL}${queryString}`, { headers });

      if (!response.ok) {
        const errorData: { error?: string } = await response.json();
        throw new Error(errorData.error ?? `HTTP ${response.status}`);
      }

      const result: { success: boolean; data: { items: JournalEntry[] } } = await response.json();
      // ADR-300: Write to module-level cache so next remount skips spinner
      const items = result.data?.items ?? [];
      journalCache.set(items, key);
      setEntries(items);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'accounting.errors.journalEntriesLoadFailed';
      setError(message);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [user, getAuthHeaders, buildQueryString, type, category, fiscalYear, quarter]);

  const createEntry = useCallback(
    async (data: CreateJournalEntryInput): Promise<{ id: string } | null> => {
      if (!user) return null;

      try {
        setError(null);
        const headers = await getAuthHeaders();
        const response = await fetch(API_ROUTES.ACCOUNTING.JOURNAL, {
          method: 'POST',
          headers,
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const errorData: { error?: string } = await response.json();
          throw new Error(errorData.error ?? `HTTP ${response.status}`);
        }

        const result: { id: string } = await response.json();
        await fetchEntries();
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'accounting.errors.journalEntryCreateFailed';
        setError(message);
        return null;
      }
    },
    [user, getAuthHeaders, fetchEntries],
  );

  useEffect(() => {
    if (autoFetch && user) {
      fetchEntries();
    }
  }, [autoFetch, user, fetchEntries]);

  return {
    entries,
    loading,
    error,
    refetch: fetchEntries,
    createEntry,
  };
}
