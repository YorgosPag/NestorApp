/**
 * @fileoverview Accounting Subapp — useInvoice Hook
 * @description Client-side hook για μεμονωμένο τιμολόγιο (fetch + update)
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-002 Invoicing System
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { Invoice, UpdateInvoiceInput } from '@/subapps/accounting/types';

// ============================================================================
// TYPES
// ============================================================================

interface UseInvoiceReturn {
  /** Δεδομένα τιμολογίου */
  invoice: Invoice | null;
  /** Κατάσταση φόρτωσης */
  loading: boolean;
  /** Μήνυμα σφάλματος */
  error: string | null;
  /** Ενημέρωση τιμολογίου */
  updateInvoice: (data: UpdateInvoiceInput) => Promise<boolean>;
  /** Ανανέωση δεδομένων */
  refetch: () => Promise<void>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useInvoice(invoiceId: string | null): UseInvoiceReturn {
  const { user } = useAuth();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAuthHeaders = useCallback(async (): Promise<HeadersInit> => {
    if (!user) return {};
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }, [user]);

  const fetchInvoice = useCallback(async (): Promise<void> => {
    if (!user || !invoiceId) {
      setInvoice(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const headers = await getAuthHeaders();
      const response = await fetch(`/api/accounting/invoices/${invoiceId}`, { headers });

      if (!response.ok) {
        const errorData: { error?: string } = await response.json();
        throw new Error(errorData.error ?? `HTTP ${response.status}`);
      }

      const data: { invoice: Invoice } = await response.json();
      setInvoice(data.invoice);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'accounting.errors.invoiceLoadFailed';
      setError(message);
      setInvoice(null);
    } finally {
      setLoading(false);
    }
  }, [user, invoiceId, getAuthHeaders]);

  const updateInvoice = useCallback(
    async (data: UpdateInvoiceInput): Promise<boolean> => {
      if (!user || !invoiceId) return false;

      try {
        setError(null);
        const headers = await getAuthHeaders();
        const response = await fetch(`/api/accounting/invoices/${invoiceId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const errorData: { error?: string } = await response.json();
          throw new Error(errorData.error ?? `HTTP ${response.status}`);
        }

        await fetchInvoice();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'accounting.errors.invoiceUpdateFailed';
        setError(message);
        return false;
      }
    },
    [user, invoiceId, getAuthHeaders, fetchInvoice],
  );

  useEffect(() => {
    if (user && invoiceId) {
      fetchInvoice();
    }
  }, [user, invoiceId, fetchInvoice]);

  return {
    invoice,
    loading,
    error,
    updateInvoice,
    refetch: fetchInvoice,
  };
}
