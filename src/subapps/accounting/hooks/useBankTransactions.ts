/**
 * @fileoverview Accounting Subapp — useBankTransactions Hook
 * @description Η ΣΕΛΙΔΑ τραπεζικών κινήσεων με δρομέα (ADR-ACC-010 §2.1.1 Φάση 3β) πάνω στο κοινό
 *   `useCursorPagedList`, και η εισαγωγή CSV.
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-10
 * @version 2.0.0
 * @see ADR-ACC-008 Bank Reconciliation
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles
 */

'use client';

import { useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useCursorPagedList, type CachedFirstPage, type UseCursorPagedListReturn } from '@/hooks/useCursorPagedList';
import { API_ROUTES } from '@/config/domain-constants';
import { createStaleCache } from '@/lib/stale-cache';
import type { BankTransaction, TransactionDirection, MatchStatus, ImportBatch } from '@/subapps/accounting/types';

// ADR-300: Module-level cache — survives React unmount/remount (navigation)
const bankTransactionsCache = createStaleCache<CachedFirstPage<BankTransaction>>('accounting-bank');

interface UseBankTransactionsOptions {
  /** Φίλτρο τραπεζικού λογαριασμού */
  accountId?: string;
  /** Φίλτρο κατεύθυνσης */
  direction?: TransactionDirection;
  /** Φίλτρο κατάστασης αντιστοίχισης */
  matchStatus?: MatchStatus;
}

interface UseBankTransactionsReturn extends UseCursorPagedListReturn<BankTransaction> {
  /** Εισαγωγή CSV. Αποτυχία ⇒ ΠΕΤΑ, ώστε ο διάλογος εισαγωγής να δείξει το σφάλμα εκεί που ρωτήθηκε. */
  importTransactions: (accountId: string, file: File) => Promise<ImportBatch>;
}

export function useBankTransactions(options: UseBankTransactionsOptions = {}): UseBankTransactionsReturn {
  const { accountId, direction, matchStatus } = options;
  const { user } = useAuth();
  const params = useMemo(() => ({ accountId, direction, matchStatus }), [accountId, direction, matchStatus]);

  const list = useCursorPagedList<BankTransaction>({
    url: API_ROUTES.ACCOUNTING.BANK.TRANSACTIONS,
    params,
    enabled: user !== null,
    cache: bankTransactionsCache,
  });
  const { refetch } = list;

  const importTransactions = useCallback(
    async (targetAccountId: string, file: File): Promise<ImportBatch> => {
      if (!user) throw new Error('Not authenticated');
      const token = await user.getIdToken();
      const formData = new FormData();
      formData.append('file', file);
      formData.append('accountId', targetAccountId);

      const response = await fetch(API_ROUTES.ACCOUNTING.BANK.IMPORT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const body: { batch?: ImportBatch; error?: string } = await response.json();
      if (!response.ok || !body.batch) throw new Error(body.error ?? `HTTP ${response.status}`);

      await refetch();
      return body.batch;
    },
    [user, refetch],
  );

  return { ...list, importTransactions };
}
