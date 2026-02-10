/**
 * @fileoverview Accounting Subapp — useBankTransactions Hook
 * @description Client-side hook για τραπεζικές συναλλαγές με φίλτρα και CSV import
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-008 Bank Reconciliation
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type {
  BankTransaction,
  TransactionDirection,
  MatchStatus,
  ImportBatch,
} from '@/subapps/accounting/types';

// ============================================================================
// TYPES
// ============================================================================

interface UseBankTransactionsOptions {
  /** Φίλτρο τραπεζικού λογαριασμού */
  accountId?: string;
  /** Φίλτρο κατεύθυνσης */
  direction?: TransactionDirection;
  /** Φίλτρο κατάστασης αντιστοίχισης */
  matchStatus?: MatchStatus;
  /** Αυτόματο fetch κατά το mount (default: true) */
  autoFetch?: boolean;
}

interface UseBankTransactionsReturn {
  /** Λίστα τραπεζικών συναλλαγών */
  transactions: BankTransaction[];
  /** Κατάσταση φόρτωσης */
  loading: boolean;
  /** Μήνυμα σφάλματος */
  error: string | null;
  /** Ανανέωση δεδομένων */
  refetch: () => Promise<void>;
  /** Εισαγωγή τραπεζικών κινήσεων από CSV */
  importTransactions: (accountId: string, file: File) => Promise<ImportBatch | null>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useBankTransactions(options: UseBankTransactionsOptions = {}): UseBankTransactionsReturn {
  const { accountId, direction, matchStatus, autoFetch = true } = options;
  const { user } = useAuth();

  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAuthHeaders = useCallback(async (): Promise<HeadersInit> => {
    if (!user) return {};
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }, [user]);

  const buildQueryString = useCallback((): string => {
    const params = new URLSearchParams();
    if (accountId) params.set('accountId', accountId);
    if (direction) params.set('direction', direction);
    if (matchStatus) params.set('matchStatus', matchStatus);
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }, [accountId, direction, matchStatus]);

  const fetchTransactions = useCallback(async (): Promise<void> => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const headers = await getAuthHeaders();
      const queryString = buildQueryString();
      const response = await fetch(`/api/accounting/bank/transactions${queryString}`, { headers });

      if (!response.ok) {
        const errorData: { error?: string } = await response.json();
        throw new Error(errorData.error ?? `HTTP ${response.status}`);
      }

      const result: { success: boolean; data: { items: BankTransaction[] } } = await response.json();
      setTransactions(result.data?.items ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'accounting.errors.bankTransactionsLoadFailed';
      setError(message);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [user, getAuthHeaders, buildQueryString]);

  const importTransactions = useCallback(
    async (targetAccountId: string, file: File): Promise<ImportBatch | null> => {
      if (!user) return null;

      try {
        setError(null);

        const token = await user.getIdToken();
        const formData = new FormData();
        formData.append('file', file);
        formData.append('accountId', targetAccountId);

        const response = await fetch('/api/accounting/bank/import', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        if (!response.ok) {
          const errorData: { error?: string } = await response.json();
          throw new Error(errorData.error ?? `HTTP ${response.status}`);
        }

        const result: { batch: ImportBatch } = await response.json();
        await fetchTransactions();
        return result.batch;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'accounting.errors.bankImportFailed';
        setError(message);
        return null;
      }
    },
    [user, fetchTransactions],
  );

  useEffect(() => {
    if (autoFetch && user) {
      fetchTransactions();
    }
  }, [autoFetch, user, fetchTransactions]);

  return {
    transactions,
    loading,
    error,
    refetch: fetchTransactions,
    importTransactions,
  };
}
