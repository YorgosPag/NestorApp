/**
 * @fileoverview Accounting Subapp — useExpenseDocument Hook
 * @description Client-side hook για μεμονωμένο έγγραφο + confirm/reject actions
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
  ExpenseCategory,
} from '@/subapps/accounting/types';

// ============================================================================
// TYPES
// ============================================================================

interface ConfirmParams {
  confirmedCategory?: ExpenseCategory;
  confirmedNetAmount?: number;
  confirmedVatAmount?: number;
  confirmedDate?: string;
  confirmedIssuerName?: string;
  notes?: string;
}

interface UseExpenseDocumentReturn {
  document: ReceivedExpenseDocument | null;
  loading: boolean;
  error: string | null;
  confirming: boolean;
  refetch: () => Promise<void>;
  confirmDocument: (params: ConfirmParams) => Promise<boolean>;
  rejectDocument: (notes?: string) => Promise<boolean>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useExpenseDocument(documentId: string | null): UseExpenseDocumentReturn {
  const { user } = useAuth();

  const [document, setDocument] = useState<ReceivedExpenseDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const getAuthHeaders = useCallback(async (): Promise<HeadersInit> => {
    if (!user) return {};
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }, [user]);

  const fetchDocument = useCallback(async (): Promise<void> => {
    if (!user || !documentId) return;

    try {
      setLoading(true);
      setError(null);

      const headers = await getAuthHeaders();
      const response = await fetch(`/api/accounting/documents/${documentId}`, { headers });

      if (!response.ok) {
        const errorData: { error?: string } = await response.json();
        throw new Error(errorData.error ?? `HTTP ${response.status}`);
      }

      const data: { success: boolean; data: ReceivedExpenseDocument } = await response.json();
      setDocument(data.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load document';
      setError(message);
      setDocument(null);
    } finally {
      setLoading(false);
    }
  }, [user, documentId, getAuthHeaders]);

  useEffect(() => {
    if (user && documentId) {
      fetchDocument();
    }
  }, [user, documentId, fetchDocument]);

  const confirmDocument = useCallback(async (params: ConfirmParams): Promise<boolean> => {
    if (!user || !documentId) return false;

    try {
      setConfirming(true);
      const headers = await getAuthHeaders();

      const response = await fetch(`/api/accounting/documents/${documentId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ action: 'confirm', ...params }),
      });

      if (!response.ok) {
        const errorData: { error?: string } = await response.json();
        throw new Error(errorData.error ?? `HTTP ${response.status}`);
      }

      // Refetch to get updated data
      await fetchDocument();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to confirm document';
      setError(message);
      return false;
    } finally {
      setConfirming(false);
    }
  }, [user, documentId, getAuthHeaders, fetchDocument]);

  const rejectDocument = useCallback(async (notes?: string): Promise<boolean> => {
    if (!user || !documentId) return false;

    try {
      setConfirming(true);
      const headers = await getAuthHeaders();

      const response = await fetch(`/api/accounting/documents/${documentId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ action: 'reject', notes }),
      });

      if (!response.ok) {
        const errorData: { error?: string } = await response.json();
        throw new Error(errorData.error ?? `HTTP ${response.status}`);
      }

      await fetchDocument();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reject document';
      setError(message);
      return false;
    } finally {
      setConfirming(false);
    }
  }, [user, documentId, getAuthHeaders, fetchDocument]);

  return {
    document,
    loading,
    error,
    confirming,
    refetch: fetchDocument,
    confirmDocument,
    rejectDocument,
  };
}
