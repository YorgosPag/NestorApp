/**
 * @fileoverview Accounting Subapp — useJournalEntries Hook
 * @description Η ΣΕΛΙΔΑ του Βιβλίου Εσόδων-Εξόδων με δρομέα (ADR-ACC-010 §2.1.1 Φάση 3β) — λεπτό περιτύλιγμα του
 *   κοινού `useCursorPagedList`. Σφάλμα = ρητό σφάλμα, ποτέ «καμία εγγραφή».
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-09
 * @version 2.0.0
 * @see ADR-ACC-001 Chart of Accounts
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles
 */

'use client';

import { useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useCursorPagedList, type CachedFirstPage, type UseCursorPagedListReturn } from '@/hooks/useCursorPagedList';
import { API_ROUTES } from '@/config/domain-constants';
import { createStaleCache } from '@/lib/stale-cache';
import type { JournalEntry, EntryType, FiscalQuarter } from '@/subapps/accounting/types';

// ADR-300: Module-level cache — survives React unmount/remount (navigation)
const journalCache = createStaleCache<CachedFirstPage<JournalEntry>>('accounting-journal');

interface UseJournalEntriesOptions {
  /** Φίλτρο τύπου (income/expense) */
  type?: EntryType;
  /** Φορολογικό έτος */
  fiscalYear?: number;
  /** Τρίμηνο */
  quarter?: FiscalQuarter;
}

export function useJournalEntries(options: UseJournalEntriesOptions = {}): UseCursorPagedListReturn<JournalEntry> {
  const { type, fiscalYear, quarter } = options;
  const { user } = useAuth();
  const params = useMemo(() => ({ type, fiscalYear, quarter }), [type, fiscalYear, quarter]);

  return useCursorPagedList<JournalEntry>({
    url: API_ROUTES.ACCOUNTING.JOURNAL,
    params,
    enabled: user !== null,
    cache: journalCache,
  });
}
