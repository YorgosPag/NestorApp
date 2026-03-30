/**
 * @fileoverview useMatchActions Hook (Phase 2d)
 * @description Actions for matching, batch matching, and excluding bank transactions
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-30
 * @see DECISIONS-PHASE-2.md Q11 (Reconciliation UI — match actions)
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { API_ROUTES } from '@/config/domain-constants';
import type { MatchableEntityType, MatchResult, MatchedEntityRef } from '@/subapps/accounting/types';

interface BatchResult {
  results: MatchResult[];
  total: number;
  matched: number;
  unmatched: number;
}

interface UseMatchActionsReturn {
  /** Match a single transaction to an entity */
  matchSingle: (
    transactionId: string,
    entityId: string,
    entityType: MatchableEntityType
  ) => Promise<MatchResult | null>;
  /** Match N:M group */
  matchGroup: (
    transactionIds: string[],
    entityRefs: MatchedEntityRef[]
  ) => Promise<MatchResult | null>;
  /** Batch auto-match transactions */
  matchBatch: (transactionIds: string[]) => Promise<BatchResult | null>;
  /** Exclude a transaction from matching */
  excludeTransaction: (transactionId: string) => Promise<boolean>;
  /** Loading state */
  matching: boolean;
  /** Batch progress */
  batchProgress: { running: boolean; completed: number; total: number } | null;
}

export function useMatchActions(): UseMatchActionsReturn {
  const { user } = useAuth();
  const [matching, setMatching] = useState(false);
  const [batchProgress, setBatchProgress] = useState<UseMatchActionsReturn['batchProgress']>(null);

  const getHeaders = useCallback(async (): Promise<HeadersInit> => {
    if (!user) throw new Error('Not authenticated');
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }, [user]);

  const matchSingle = useCallback(async (
    transactionId: string,
    entityId: string,
    entityType: MatchableEntityType
  ): Promise<MatchResult | null> => {
    try {
      setMatching(true);
      const headers = await getHeaders();
      const response = await fetch(API_ROUTES.ACCOUNTING.BANK.MATCH, {
        method: 'POST',
        headers,
        body: JSON.stringify({ transactionId, entityId, entityType }),
      });
      if (!response.ok) {
        const data: { error?: string } = await response.json();
        throw new Error(data.error ?? `HTTP ${response.status}`);
      }
      const result: { data: MatchResult } = await response.json();
      return result.data;
    } catch {
      return null;
    } finally {
      setMatching(false);
    }
  }, [getHeaders]);

  const matchGroup = useCallback(async (
    transactionIds: string[],
    entityRefs: MatchedEntityRef[]
  ): Promise<MatchResult | null> => {
    try {
      setMatching(true);
      const headers = await getHeaders();
      const response = await fetch(API_ROUTES.ACCOUNTING.BANK.MATCH, {
        method: 'POST',
        headers,
        body: JSON.stringify({ transactionIds, entityRefs }),
      });
      if (!response.ok) {
        const data: { error?: string } = await response.json();
        throw new Error(data.error ?? `HTTP ${response.status}`);
      }
      const result: { data: MatchResult } = await response.json();
      return result.data;
    } catch {
      return null;
    } finally {
      setMatching(false);
    }
  }, [getHeaders]);

  const matchBatch = useCallback(async (
    transactionIds: string[]
  ): Promise<BatchResult | null> => {
    try {
      setBatchProgress({ running: true, completed: 0, total: transactionIds.length });
      const headers = await getHeaders();
      const response = await fetch(API_ROUTES.ACCOUNTING.BANK.MATCH_BATCH, {
        method: 'POST',
        headers,
        body: JSON.stringify({ transactionIds }),
      });
      if (!response.ok) {
        const data: { error?: string } = await response.json();
        throw new Error(data.error ?? `HTTP ${response.status}`);
      }
      const result: { data: BatchResult } = await response.json();
      setBatchProgress({
        running: false,
        completed: result.data.matched,
        total: result.data.total,
      });
      return result.data;
    } catch {
      setBatchProgress(null);
      return null;
    }
  }, [getHeaders]);

  const excludeTransaction = useCallback(async (
    transactionId: string
  ): Promise<boolean> => {
    try {
      setMatching(true);
      const headers = await getHeaders();
      const response = await fetch(API_ROUTES.ACCOUNTING.BANK.MATCH, {
        method: 'POST',
        headers,
        body: JSON.stringify({ transactionId, action: 'exclude' }),
      });
      return response.ok;
    } catch {
      return false;
    } finally {
      setMatching(false);
    }
  }, [getHeaders]);

  return { matchSingle, matchGroup, matchBatch, excludeTransaction, matching, batchProgress };
}
