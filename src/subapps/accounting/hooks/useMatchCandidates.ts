/**
 * @fileoverview useMatchCandidates Hook (Phase 2d)
 * @description Fetches match candidates for a selected bank transaction
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-30
 * @see DECISIONS-PHASE-2.md Q11 (Reconciliation UI — candidates panel)
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { API_ROUTES } from '@/config/domain-constants';
import type { MatchCandidate, MatchCandidateGroup } from '@/subapps/accounting/types';

interface UseMatchCandidatesReturn {
  candidates: MatchCandidate[];
  groups: MatchCandidateGroup[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Fetch candidates for a selected transaction.
 * Aborts previous request when transactionId changes.
 */
export function useMatchCandidates(transactionId: string | null): UseMatchCandidatesReturn {
  const { user } = useAuth();
  const [candidates, setCandidates] = useState<MatchCandidate[]>([]);
  const [groups, setGroups] = useState<MatchCandidateGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchCandidates = useCallback(async () => {
    if (!user || !transactionId) {
      setCandidates([]);
      setGroups([]);
      return;
    }

    // Abort previous request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setLoading(true);
      setError(null);

      const token = await user.getIdToken();
      const url = `${API_ROUTES.ACCOUNTING.BANK.CANDIDATES}?transactionId=${encodeURIComponent(transactionId)}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });

      if (!response.ok) {
        const data: { error?: string } = await response.json();
        throw new Error(data.error ?? `HTTP ${response.status}`);
      }

      const result: {
        success: boolean;
        data: {
          candidates: MatchCandidate[];
          groups?: MatchCandidateGroup[];
        };
      } = await response.json();

      if (!controller.signal.aborted) {
        setCandidates(result.data?.candidates ?? []);
        setGroups(result.data?.groups ?? []);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const message = err instanceof Error ? err.message : 'Failed to load candidates';
      if (!controller.signal.aborted) {
        setError(message);
        setCandidates([]);
        setGroups([]);
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [user, transactionId]);

  useEffect(() => {
    void fetchCandidates();
    return () => abortRef.current?.abort();
  }, [fetchCandidates]);

  return { candidates, groups, loading, error, refetch: fetchCandidates };
}
