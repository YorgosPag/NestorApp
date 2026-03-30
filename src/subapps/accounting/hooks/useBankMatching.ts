'use client';

/**
 * @fileoverview useBankMatching Hook — Candidates + Match + Reconcile
 * @description Client-side hook for smart bank matching (MatchingEngine integration)
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-30
 * @see AUDIT-2026-03-29.md A-3, A-4 — MatchingEngine wiring
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { API_ROUTES } from '@/config/domain-constants';
import type { MatchCandidate, MatchResult } from '@/subapps/accounting/types';

// ============================================================================
// TYPES
// ============================================================================

interface UseBankMatchingReturn {
  /** Current candidates for selected transaction */
  candidates: MatchCandidate[];
  /** Loading state for candidates fetch */
  loadingCandidates: boolean;
  /** Loading state for match execution */
  matching: boolean;
  /** Error message */
  error: string | null;
  /** Fetch candidates for a transaction */
  fetchCandidates: (transactionId: string) => Promise<void>;
  /** Execute 1:1 match */
  executeMatch: (transactionId: string, entityId: string, entityType: string) => Promise<MatchResult | null>;
  /** Clear candidates */
  clearCandidates: () => void;
}

// ============================================================================
// HOOK
// ============================================================================

export function useBankMatching(): UseBankMatchingReturn {
  const { user } = useAuth();

  const [candidates, setCandidates] = useState<MatchCandidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [matching, setMatching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAuthHeaders = useCallback(async (): Promise<HeadersInit> => {
    if (!user) return {};
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }, [user]);

  const fetchCandidates = useCallback(async (transactionId: string): Promise<void> => {
    if (!user) return;

    try {
      setLoadingCandidates(true);
      setError(null);

      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_ROUTES.ACCOUNTING.BANK.CANDIDATES}?transactionId=${encodeURIComponent(transactionId)}`,
        { headers }
      );

      if (!response.ok) {
        const errorData: { error?: string } = await response.json();
        throw new Error(errorData.error ?? `HTTP ${response.status}`);
      }

      const result: { success: boolean; data: { candidates: MatchCandidate[] } } = await response.json();
      setCandidates(result.data?.candidates ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Σφάλμα φόρτωσης υποψήφιων αντιστοιχίσεων';
      setError(message);
      setCandidates([]);
    } finally {
      setLoadingCandidates(false);
    }
  }, [user, getAuthHeaders]);

  const executeMatch = useCallback(async (
    transactionId: string,
    entityId: string,
    entityType: string
  ): Promise<MatchResult | null> => {
    if (!user) return null;

    try {
      setMatching(true);
      setError(null);

      const headers = await getAuthHeaders();
      const response = await fetch(API_ROUTES.ACCOUNTING.BANK.MATCH, {
        method: 'POST',
        headers,
        body: JSON.stringify({ transactionId, entityId, entityType }),
      });

      if (!response.ok) {
        const errorData: { error?: { detail?: string }; success?: boolean } = await response.json();
        const detail = typeof errorData.error === 'object'
          ? errorData.error?.detail
          : String(errorData.error);
        throw new Error(detail ?? `HTTP ${response.status}`);
      }

      const result: { success: boolean; data: MatchResult } = await response.json();
      setCandidates([]);
      return result.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Σφάλμα αντιστοίχισης';
      setError(message);
      return null;
    } finally {
      setMatching(false);
    }
  }, [user, getAuthHeaders]);

  const clearCandidates = useCallback(() => {
    setCandidates([]);
    setError(null);
  }, []);

  return {
    candidates,
    loadingCandidates,
    matching,
    error,
    fetchCandidates,
    executeMatch,
    clearCandidates,
  };
}
