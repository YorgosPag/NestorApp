/**
 * @fileoverview Accounting Subapp — useExpenseDocuments Hook
 * @description Client-side hook για λίστα εγγράφων εξόδων ανά έτος/κατάσταση
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-10
 * @version 1.0.0
 * @see ADR-ACC-005 AI Document Processing
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { API_ROUTES } from '@/config/domain-constants';
import { createStaleCache } from '@/lib/stale-cache';
import type {
  ReceivedExpenseDocument,
  DocumentProcessingStatus,
} from '@/subapps/accounting/types';

// ADR-300: Module-level cache — survives React unmount/remount (navigation)
const expenseDocsCache = createStaleCache<ReceivedExpenseDocument[]>('accounting-documents');

// ============================================================================
// TYPES
// ============================================================================

interface UseExpenseDocumentsOptions {
  fiscalYear: number;
  status?: DocumentProcessingStatus;
}

interface UseExpenseDocumentsReturn {
  documents: ReceivedExpenseDocument[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useExpenseDocuments(options: UseExpenseDocumentsOptions): UseExpenseDocumentsReturn {
  const { fiscalYear, status } = options;
  const { user } = useAuth();

  // ADR-300: Seed from module-level cache → zero flash on re-navigation
  const cacheKey = `${fiscalYear}-${status ?? 'all'}`;
  const [documents, setDocuments] = useState<ReceivedExpenseDocument[]>(expenseDocsCache.get(cacheKey) ?? []);
  const [loading, setLoading] = useState(!expenseDocsCache.hasLoaded(cacheKey));
  const [error, setError] = useState<string | null>(null);

  const getAuthHeaders = useCallback(async (): Promise<HeadersInit> => {
    if (!user) return {};
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }, [user]);

  const fetchDocuments = useCallback(async (): Promise<void> => {
    if (!user) return;

    const key = `${fiscalYear}-${status ?? 'all'}`;
    try {
      // ADR-300: Only show spinner on first load — not on re-navigation
      if (!expenseDocsCache.hasLoaded(key)) setLoading(true);
      setError(null);

      const headers = await getAuthHeaders();
      const params = new URLSearchParams();
      params.set('fiscalYear', String(fiscalYear));
      if (status) params.set('status', status);

      const response = await fetch(`${API_ROUTES.ACCOUNTING.DOCUMENTS.LIST}?${params.toString()}`, { headers });

      if (!response.ok) {
        const errorData: { error?: string } = await response.json();
        throw new Error(errorData.error ?? `HTTP ${response.status}`);
      }

      const data: { success: boolean; data: ReceivedExpenseDocument[] } = await response.json();
      // ADR-300: Write to module-level cache so next remount skips spinner
      expenseDocsCache.set(data.data, key);
      setDocuments(data.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load documents';
      setError(message);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [user, fiscalYear, status, getAuthHeaders]);

  useEffect(() => {
    if (user) {
      fetchDocuments();
    }
  }, [user, fetchDocuments]);

  return {
    documents,
    loading,
    error,
    refetch: fetchDocuments,
  };
}
