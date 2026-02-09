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
import type {
  ReceivedExpenseDocument,
  DocumentProcessingStatus,
} from '@/subapps/accounting/types';

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

  const [documents, setDocuments] = useState<ReceivedExpenseDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAuthHeaders = useCallback(async (): Promise<HeadersInit> => {
    if (!user) return {};
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }, [user]);

  const fetchDocuments = useCallback(async (): Promise<void> => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const headers = await getAuthHeaders();
      const params = new URLSearchParams();
      params.set('fiscalYear', String(fiscalYear));
      if (status) params.set('status', status);

      const response = await fetch(`/api/accounting/documents?${params.toString()}`, { headers });

      if (!response.ok) {
        const errorData: { error?: string } = await response.json();
        throw new Error(errorData.error ?? `HTTP ${response.status}`);
      }

      const data: { success: boolean; data: ReceivedExpenseDocument[] } = await response.json();
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
